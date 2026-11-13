import { afterEach, expect, test } from "bun:test";
import { callTool } from "../src/plugins/builtin-routines";
import { useResponsibilityChatTools } from "../src/responsibilities/chat-tools";
import {
  type Responsibility,
  ResponsibilityNotFoundError,
  type ResponsibilityStore,
  responsibilityInputSchema,
} from "../src/responsibilities/types";
import { RoutineRefusedError } from "../src/routines/store";

const connection = {
  url: "builtin://routines",
  actorId: "owner",
  botId: "bot",
};
const create = {
  title: "Upstream",
  instruction: "Analyze changes",
  successCriteria: "Sourced report",
};
afterEach(() => useResponsibilityChatTools(null));

function install() {
  const calls: unknown[][] = [];
  let saved: Responsibility | undefined;
  const unsupported = async (): Promise<never> => {
    throw new Error("Unexpected store call");
  };
  const store: ResponsibilityStore = {
    async create(owner, input) {
      calls.push(["create", owner, input]);
      saved = {
        ...responsibilityInputSchema.parse(input),
        id: "goal",
        ownerUserId: owner,
        threadId: "thread",
        status: "active",
        progress: "",
        lastResult: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      };
      return saved;
    },
    async list(owner) {
      return saved?.ownerUserId === owner ? [saved] : [];
    },
    async get(owner, id) {
      if (!saved || saved.ownerUserId !== owner || saved.id !== id)
        throw new ResponsibilityNotFoundError();
      return saved;
    },
    async transition(owner, id, status) {
      const row = await store.get(owner, id);
      saved = { ...row, status };
      calls.push(["transition", owner, id, status]);
      return saved;
    },
    update: unsupported,
    recordProgress: unsupported,
    listRuns: unsupported,
    ingestEvent: unsupported,
    beginRun: unsupported,
    settleRun: unsupported,
    resumeWaiting: unsupported,
  };
  useResponsibilityChatTools({
    store,
    engine: {
      async ingest(input) {
        calls.push(["ingest", input]);
        return { eventId: "event", duplicate: false, runIds: ["run"] };
      },
    },
    async conversationFor(owner, bot, channel) {
      calls.push(["channel", owner, bot, channel]);
      if (channel && channel !== "shared")
        throw new RoutineRefusedError("Not a shared channel.");
      return "shared";
    },
  });
  return { calls, store };
}

test("creation resolves shared channel and passes only connection-derived identity to the store", async () => {
  const { calls, store } = install();
  const result = await callTool(connection, "create_responsibility", {
    ...create,
    channelId: "",
  });
  expect(result.isError).toBe(false);
  expect(result.text).toContain("no schedule of its own");
  expect(calls[0]).toEqual(["channel", "owner", "bot", undefined]);
  expect(await store.get("owner", "goal")).toMatchObject({
    ownerUserId: "owner",
    agentId: "bot",
    channelId: "shared",
  });
  expect(
    (await callTool(connection, "list_responsibilities", {})).text,
  ).toContain("goal");
  expect(
    (await callTool(connection, "run_responsibility", { id: "goal" })).isError,
  ).toBe(false);
  expect(calls.find((call) => call[0] === "ingest")).toEqual([
    "ingest",
    expect.objectContaining({
      ownerUserId: "owner",
      responsibilityId: "goal",
      source: "manual",
    }),
  ]);
});

test("forged identity, missing actor, invalid channel and foreign Bot cannot mutate a delegation", async () => {
  const { calls, store } = install();
  expect(
    (
      await callTool(connection, "create_responsibility", {
        ...create,
        ownerUserId: "foreign",
      })
    ).isError,
  ).toBe(true);
  expect(
    (
      await callTool(
        { ...connection, actorId: "" },
        "create_responsibility",
        create,
      )
    ).isError,
  ).toBe(true);
  expect(
    (
      await callTool(connection, "create_responsibility", {
        ...create,
        channelId: "foreign",
      })
    ).isError,
  ).toBe(true);
  expect(calls.some((call) => call[0] === "create")).toBe(false);
  await callTool(connection, "create_responsibility", create);
  for (const foreign of [
    { ...connection, actorId: "other" },
    { ...connection, botId: "other" },
  ]) {
    expect(
      (await callTool(foreign, "pause_responsibility", { id: "goal" })).isError,
    ).toBe(true);
  }
  expect((await store.get("owner", "goal")).status).toBe("active");
  expect(
    (await callTool(connection, "pause_responsibility", { id: "goal" }))
      .isError,
  ).toBe(false);
  expect((await store.get("owner", "goal")).status).toBe("paused");
});

test("uninstalled delegation backend is an error result", async () => {
  useResponsibilityChatTools(null);
  expect(
    (await callTool(connection, "list_responsibilities", {})).isError,
  ).toBe(true);
});
