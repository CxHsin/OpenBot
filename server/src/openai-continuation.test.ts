import { afterEach, expect, test } from "bun:test";
import { BuiltInAgentWithSaneHistory } from "@openbot/toolkit/copilotkit/agents";
import { tap } from "rxjs";
import { z } from "zod";
import {
  builtInAgentConfiguration,
  runtimeModelForEnvironment,
} from "./copilot";
import {
  configureModelMeasurement,
  inMeasuredTurn,
  type ModelMeasurement,
} from "./measurement/model";
import {
  createTurnScheduling,
  RoutinePreemptedError,
} from "./scheduling/turns";

const names = [
  "OPENAI_BASE_URL",
  "COPILOTKIT_OPENAI_API",
  "OPENBOT_OPENAI_STATELESS",
] as const;
const saved = names.map((name) => process.env[name]);
afterEach(() => {
  configureModelMeasurement(undefined);
  names.forEach((name, index) => {
    if (saved[index] === undefined) delete process.env[name];
    else process.env[name] = saved[index];
  });
});

type Item = Record<string, unknown>;

// Minimal Responses SSE with the same commentary-before-tool shape seen at the relay.
function responseStream(step: number, omitUsage = false) {
  const text = step === 0 ? "Starting probe." : "PROBE_OK";
  const message = {
    id: `msg_probe_${step}`,
    type: "message",
    role: "assistant",
    status: "completed",
    phase: step === 0 ? "commentary" : "final_answer",
    content: [{ type: "output_text", text, annotations: [] }],
  };
  const call = {
    id: `fc_probe_${step}`,
    type: "function_call",
    call_id: `call_probe_${step}`,
    name: step === 0 ? "probe_first" : "probe_second",
    arguments: "{}",
    status: "completed",
  };
  const reasoning = {
    id: "rs_probe",
    type: "reasoning",
    summary: [],
    encrypted_content: "opaque-reasoning",
  };
  const output =
    step === 0 ? [reasoning, message, call] : step === 1 ? [call] : [message];
  const response = {
    id: `resp_probe_${step}`,
    model: "gpt-6.1-sol",
    created_at: 1794045000,
    output,
  };
  const events: Item[] = [{ type: "response.created", response }];
  output.forEach((item, index) => {
    events.push({
      type: "response.output_item.added",
      item,
      output_index: index,
    });
    if (item.type === "message") {
      events.push({
        type: "response.output_text.delta",
        item_id: item.id,
        output_index: index,
        content_index: 0,
        delta: text,
      });
    } else if (item.type === "function_call") {
      events.push({
        type: "response.function_call_arguments.delta",
        item_id: item.id,
        output_index: index,
        delta: "{}",
      });
    }
    events.push({
      type: "response.output_item.done",
      item,
      output_index: index,
    });
  });
  events.push({
    type: "response.completed",
    response: {
      ...response,
      status: "completed",
      ...(!omitUsage
        ? {
            usage: {
              input_tokens: 10,
              output_tokens: 5,
              total_tokens: 15,
              input_tokens_details: { cached_tokens: 4 },
            },
          }
        : {}),
    },
  });
  return new Response(
    events
      .map(
        (event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
      )
      .join(""),
    { headers: { "content-type": "text/event-stream" } },
  );
}

test("a stateless relay continues after commentary and two server tools without item references", async () => {
  const measurements: ModelMeasurement[] = [];
  configureModelMeasurement(async (measurement) => {
    measurements.push(measurement);
  });
  const requests: { input: Item[]; store?: boolean }[] = [];
  const endpoint = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as { input: Item[]; store?: boolean };
      requests.push(body);
      const reference = body.input.findIndex(
        (item) => item.type === "item_reference",
      );
      if (reference !== -1)
        return Response.json(
          {
            error: {
              message: `Missing required parameter: 'input[${reference}].id'.`,
              type: "invalid_request_error",
            },
          },
          { status: 400 },
        );
      return responseStream(requests.length - 1);
    },
  });
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${endpoint.port}/v1`;
  process.env.COPILOTKIT_OPENAI_API = "responses";
  process.env.OPENBOT_OPENAI_STATELESS = "true";
  const executed: string[] = [];
  try {
    const configuration = builtInAgentConfiguration(
      {
        id: "probe",
        name: "Probe",
        type: "built_in",
        systemPrompt: "Run the probe.",
      },
      runtimeModelForEnvironment({
        provider: "openai",
        defaultModel: "gpt-6.1-sol",
      }),
      "synthetic-key",
      ["probe_first", "probe_second"].map((name) => ({
        name,
        ref: `probe/${name}`,
        description: name,
        parameters: z.object({}),
        execute: async () => {
          executed.push(name);
          return `${name} successful`;
        },
      })),
    );
    const agent = new BuiltInAgentWithSaneHistory(configuration, {
      observe: (run) => run,
    });
    agent.addMessage({
      id: "user-probe",
      role: "user",
      content: "Run both probes and answer.",
    });
    await inMeasuredTurn(
      {
        ownerUserId: "owner",
        agentId: "probe",
        threadId: "thread",
        runId: "run",
        initiator: { kind: "person" },
      },
      () => agent.runAgent(),
    );
    expect(measurements).toHaveLength(3);
    expect(measurements.map((m) => m.inputTokens)).toEqual([10, 10, 10]);
    expect(measurements.map((m) => m.outputTokens)).toEqual([5, 5, 5]);
    expect(measurements.map((m) => m.cacheReadTokens)).toEqual([4, 4, 4]);
    expect(
      measurements.every((m) => m.runId === "run" && m.elapsedMs >= 0),
    ).toBe(true);
    expect(executed).toEqual(["probe_first", "probe_second"]);
    expect(agent.messages.at(-1)?.content).toBe("PROBE_OK");
    expect(requests).toHaveLength(3);
    expect(requests.every((request) => request.store === false)).toBe(true);
    expect(requests[1]?.input).toContainEqual(
      expect.objectContaining({
        role: "assistant",
        id: "msg_probe_0",
        content: [{ type: "output_text", text: "Starting probe." }],
      }),
    );
    expect(requests[1]?.input).toContainEqual(
      expect.objectContaining({
        type: "reasoning",
        encrypted_content: "opaque-reasoning",
      }),
    );
    expect(
      requests[2]?.input
        .filter((item) => item.type === "function_call_output")
        .map((item) => item.call_id),
    ).toEqual(["call_probe_0", "call_probe_1"]);
  } finally {
    await endpoint.stop(true);
  }
});

test("the real SDK stops before the next request after a tool settles when a person preempts", async () => {
  configureModelMeasurement(async () => {});
  let requests = 0;
  let entered!: () => void;
  const toolStarted = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let finishTool!: () => void;
  const toolCanFinish = new Promise<void>((resolve) => {
    finishTool = resolve;
  });
  const endpoint = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => responseStream(requests++),
  });
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${endpoint.port}/v1`;
  process.env.COPILOTKIT_OPENAI_API = "responses";
  let checkpointed = false;
  const emitted: { type: string; content?: unknown }[] = [];
  const scheduling = createTurnScheduling({
    defer: async () => {
      checkpointed = true;
    },
  });
  const input = {
    ownerUserId: "owner",
    agentId: "probe",
    threadId: "thread",
    routineId: "routine",
    runId: "background",
    instruction: "Probe",
  };
  try {
    const configuration = builtInAgentConfiguration(
      { id: "probe", name: "Probe", type: "built_in", systemPrompt: "Probe" },
      {
        provider: "openai",
        defaultModel: "gpt-6.1-sol",
        openaiStateless: true,
      },
      "synthetic-key",
      [
        {
          name: "probe_first",
          ref: "probe",
          description: "Probe",
          parameters: z.object({}),
          execute: async () => {
            entered();
            await toolCanFinish;
            return "completed action";
          },
        },
      ],
    );
    const agent = new BuiltInAgentWithSaneHistory(configuration, {
      observe: (run) => run.pipe(tap((event) => emitted.push(event))),
    });
    agent.addMessage({ id: "user", role: "user", content: "Probe" });
    const background = scheduling
      .routine(input, "background", async () => {
        await inMeasuredTurn(
          { ...input, initiator: { kind: "routine", id: "routine" } },
          () => agent.runAgent(),
        );
        return { replyText: "Done" };
      })
      .catch((error) => error);
    await toolStarted;
    const person = scheduling.person(
      { ...input, runId: "person" },
      async () => ({ replyText: "Progress" }),
    );
    await Promise.resolve();
    finishTool();
    expect(await background).toBeInstanceOf(RoutinePreemptedError);
    expect(await person).toEqual({ replyText: "Progress" });
    expect(checkpointed).toBe(true);
    expect(requests).toBe(1);
    expect(agent.messages).toContainEqual(
      expect.objectContaining({
        role: "tool",
        content: JSON.stringify("completed action"),
      }),
    );
    expect(emitted).toContainEqual(
      expect.objectContaining({
        type: "TOOL_CALL_RESULT",
        content: JSON.stringify("completed action"),
      }),
    );
  } finally {
    finishTool?.();
    await endpoint.stop(true);
  }
});

test("missing provider usage remains unknown instead of invented zero tokens", async () => {
  const measurements: ModelMeasurement[] = [];
  configureModelMeasurement(async (measurement) => {
    measurements.push(measurement);
  });
  const endpoint = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => responseStream(2, true),
  });
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${endpoint.port}/v1`;
  process.env.COPILOTKIT_OPENAI_API = "responses";
  try {
    const configuration = builtInAgentConfiguration(
      { id: "probe", name: "Probe", type: "built_in", systemPrompt: "Probe" },
      { provider: "openai", defaultModel: "gpt-6.1-sol" },
      "synthetic-key",
    );
    const agent = new BuiltInAgentWithSaneHistory(configuration, {
      observe: (run) => run,
    });
    agent.addMessage({ id: "user", role: "user", content: "Probe" });
    await inMeasuredTurn(
      {
        ownerUserId: "owner",
        agentId: "probe",
        threadId: "thread",
        runId: "unknown-usage",
        initiator: { kind: "person" },
      },
      () => agent.runAgent(),
    );
    expect(measurements).toHaveLength(1);
    expect(measurements[0]?.inputTokens).toBeNull();
    expect(measurements[0]?.outputTokens).toBeNull();
    expect(measurements[0]?.cacheReadTokens).toBeNull();
  } finally {
    await endpoint.stop(true);
  }
});

test("the compatibility option is explicit and only applies to API-key OpenAI models", () => {
  const bot = {
    id: "probe",
    name: "Probe",
    type: "built_in" as const,
    systemPrompt: "Probe",
  };
  delete process.env.OPENBOT_OPENAI_STATELESS;
  expect(
    builtInAgentConfiguration(
      bot,
      runtimeModelForEnvironment(
        { provider: "openai", defaultModel: "gpt-6.1-sol" },
        {},
      ),
      "key",
    ),
  ).not.toHaveProperty("providerOptions");
  process.env.OPENBOT_OPENAI_STATELESS = "true";
  expect(
    builtInAgentConfiguration(
      bot,
      runtimeModelForEnvironment(
        { provider: "anthropic", defaultModel: "claude-sonnet-4-5" },
        { OPENBOT_OPENAI_STATELESS: "true" },
      ),
      "key",
    ),
  ).not.toHaveProperty("providerOptions");
});
