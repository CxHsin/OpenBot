import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { TurnRunner } from "@openbot/toolkit/run-turn";
import type { PlanLanguageModel } from "../agents/plan-model";
import type { AuditInitiator } from "../audit";
import { yieldForPerson } from "../scheduling/turns";

export type MeasuredTurn = {
  ownerUserId: string;
  agentId: string;
  threadId: string;
  runId: string;
  initiator: AuditInitiator;
};
export type ModelMeasurement = MeasuredTurn & {
  request: number;
  model: string;
  elapsedMs: number;
  firstOutputMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  status: "completed" | "failed" | "incomplete";
};
type Usage = Awaited<ReturnType<PlanLanguageModel["doGenerate"]>>["usage"];
const UNKNOWN_USAGE: Usage = {
  inputTokens: {
    total: undefined,
    noCache: undefined,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: undefined, text: undefined, reasoning: undefined },
};
const turns = new AsyncLocalStorage<MeasuredTurn & { requests: number }>();
let record: ((measurement: ModelMeasurement) => Promise<void>) | undefined;

export function configureModelMeasurement(writer: typeof record): void {
  record = writer;
}
export function modelMeasurementEnabled(): boolean {
  return record !== undefined;
}
export function inMeasuredTurn<T>(turn: MeasuredTurn, run: () => T): T {
  return turns.run({ ...turn, requests: 0 }, run);
}

export function measureTurns(run: TurnRunner): TurnRunner {
  return (input) => {
    const runId = input.runId ?? randomUUID();
    return inMeasuredTurn(
      {
        ownerUserId: input.ownerUserId,
        agentId: input.agentId,
        threadId: input.threadId,
        runId,
        initiator: input.initiator ?? { kind: "routine", id: input.routineId },
      },
      () => run({ ...input, runId }),
    );
  };
}

/** Observe the SDK's normalized usage; do not parse or retain prompts or transport headers. */
export function measuredModel(model: PlanLanguageModel): PlanLanguageModel {
  function begin() {
    const turn = turns.getStore();
    const writer = record;
    if (!turn || !writer) return undefined;
    const request = ++turn.requests;
    const started = performance.now();
    let firstOutputMs: number | null = null;
    let written = false;
    return {
      output() {
        firstOutputMs ??= performance.now() - started;
      },
      async finish(status: ModelMeasurement["status"], usage?: Usage) {
        if (written) return;
        written = true;
        const { requests: _, ...identity } = turn;
        try {
          await writer({
            ...identity,
            request,
            model: `${model.provider}/${model.modelId}`,
            elapsedMs: performance.now() - started,
            firstOutputMs,
            inputTokens: usage?.inputTokens.total ?? null,
            outputTokens: usage?.outputTokens.total ?? null,
            cacheReadTokens: usage?.inputTokens.cacheRead ?? null,
            status,
          });
        } catch {
          console.error(
            JSON.stringify({
              type: "model-measurement-write-failed",
              runId: turn.runId,
            }),
          );
        }
      },
    };
  }
  return new Proxy(model, {
    get(target, key) {
      if (key === "doGenerate")
        return async (
          options: Parameters<PlanLanguageModel["doGenerate"]>[0],
        ) => {
          if (yieldForPerson())
            return {
              content: [],
              finishReason: { unified: "stop", raw: "preempted" },
              usage: UNKNOWN_USAGE,
              warnings: [],
            };
          const observation = begin();
          try {
            const result = await target.doGenerate(options);
            await observation?.finish("completed", result.usage);
            return result;
          } catch (error) {
            await observation?.finish("failed");
            throw error;
          }
        };
      if (key === "doStream")
        return async (
          options: Parameters<PlanLanguageModel["doStream"]>[0],
        ) => {
          if (yieldForPerson())
            return {
              stream: new ReadableStream({
                start(controller) {
                  controller.enqueue({ type: "stream-start", warnings: [] });
                  controller.enqueue({
                    type: "finish",
                    finishReason: { unified: "stop", raw: "preempted" },
                    usage: UNKNOWN_USAGE,
                  });
                  controller.close();
                },
              }),
            };
          const observation = begin();
          try {
            const result = await target.doStream(options);
            if (!observation) return result;
            const reader = result.stream.getReader();
            return {
              ...result,
              stream: new ReadableStream({
                async pull(controller) {
                  try {
                    const { done, value: part } = await reader.read();
                    if (done) {
                      await observation.finish("incomplete");
                      controller.close();
                      return;
                    }
                    if (
                      ["text-delta", "reasoning-delta", "tool-call"].includes(
                        part.type,
                      )
                    )
                      observation.output();
                    if (part.type === "finish")
                      await observation.finish("completed", part.usage);
                    if (part.type === "error")
                      await observation.finish("failed");
                    controller.enqueue(part);
                  } catch (error) {
                    await observation.finish("failed");
                    controller.error(error);
                  }
                },
                async cancel(reason) {
                  await observation.finish("incomplete");
                  await reader.cancel(reason);
                },
              }),
            };
          } catch (error) {
            await observation?.finish("failed");
            throw error;
          }
        };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
