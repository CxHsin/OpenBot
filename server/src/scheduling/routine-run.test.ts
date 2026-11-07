import { expect, test } from "bun:test";
import type { ChannelStore } from "../channels/routes";
import { createRoutineRunner } from "../routines/runner";
import type { RoutineStore } from "../routines/store";

test("continuations use a fresh bounded run id rather than concatenating the routine id", async () => {
  const id = `routine_run_${crypto.randomUUID()}`;
  const seen: string[] = [];
  const runner = createRoutineRunner({
    routineStore: {
      runContext: async () => ({
        routineId: "routine",
        ownerUserId: "owner",
        agentId: "bot",
        channelId: "channel",
        instruction: "Task",
        enabled: true,
      }),
      finishRun: async () => {},
    } as unknown as RoutineStore,
    channelStore: {
      get: async () => ({ threadId: "thread" }),
      signalBusy: async () => {},
      recordActivity: async () => {},
    } as unknown as ChannelStore,
    runTurn: async (input) => {
      seen.push(input.runId!);
      expect(input.instruction).toContain("Do not repeat completed actions");
      return { replyText: "Done" };
    },
  });
  await runner.run(id, true);
  await runner.run(id, true);
  expect(seen).toHaveLength(2);
  expect(seen[0]).toMatch(/^[0-9a-f-]{36}$/);
  expect(seen[0]).not.toBe(seen[1]);
});
