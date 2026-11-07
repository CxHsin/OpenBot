import { expect, test } from "bun:test";
import {
  createTurnScheduling,
  RoutinePreemptedError,
  withoutTurnScheduling,
  yieldForPerson,
} from "./turns";

function latch() {
  let resolve!: () => void;
  return {
    promise: new Promise<void>((done) => {
      resolve = done;
    }),
    release: () => resolve(),
  };
}
const input = {
  ownerUserId: "owner",
  agentId: "bot",
  threadId: "thread",
  routineId: "routine",
  instruction: "Task",
  runId: "routine-run",
};

test("a person waits for the in-flight tool, then preempts before another model request and leaves a checkpoint", async () => {
  const enteredTool = latch();
  const finishTool = latch();
  const personEntered = latch();
  const finishPerson = latch();
  const events: string[] = [];
  const scheduling = createTurnScheduling({
    defer: async (turn, id) => {
      expect(turn.ownerUserId).toBe("owner");
      expect(id).toBe("routine-run");
      events.push("durable checkpoint");
    },
  });
  const background = scheduling.routine(input, "routine-run", async () => {
    events.push("tool started");
    enteredTool.release();
    await finishTool.promise;
    withoutTurnScheduling(() => expect(yieldForPerson()).toBe(false));
    events.push("tool recorded");
    if (yieldForPerson()) throw new RoutinePreemptedError();
    events.push("second model request");
    return { replyText: "finished" };
  });
  const outcome = background.catch((error) => error);
  await enteredTool.promise;
  const person = scheduling.person(
    { ...input, runId: "person-run", initiator: { kind: "person" } },
    async () => {
      events.push("person started");
      personEntered.release();
      await finishPerson.promise;
      return { replyText: "Progress" };
    },
  );
  await Promise.resolve();
  expect(events).toEqual(["tool started"]);
  finishTool.release();
  await personEntered.promise;
  expect(await outcome).toBeInstanceOf(RoutinePreemptedError);
  expect(events).toEqual([
    "tool started",
    "tool recorded",
    "durable checkpoint",
    "person started",
  ]);
  let resumed = false;
  const resume = scheduling.routine(
    { ...input, runId: "resume" },
    "routine-run",
    async () => {
      resumed = true;
      return { replyText: "continued" };
    },
  );
  await Promise.resolve();
  expect(resumed).toBe(false);
  finishPerson.release();
  await person;
  expect(await resume).toEqual({ replyText: "continued" });
});

test("another owner cannot preempt this owner's work", async () => {
  const hold = latch();
  const started = latch();
  let deferred = false;
  const scheduling = createTurnScheduling({
    defer: async () => {
      deferred = true;
    },
  });
  const background = scheduling.routine(input, "routine-run", async () => {
    started.release();
    await hold.promise;
    if (yieldForPerson()) throw new RoutinePreemptedError();
    return { replyText: "Done" };
  });
  await started.promise;
  await scheduling.person({ ...input, ownerUserId: "stranger" }, async () => ({
    replyText: "Other owner",
  }));
  hold.release();
  expect(await background).toEqual({ replyText: "Done" });
  expect(deferred).toBe(false);
});

test("an unrelated tool failure is preserved rather than requeued", async () => {
  const scheduling = createTurnScheduling({
    defer: async () => {
      throw new Error("Should not defer");
    },
  });
  const failure = new Error("Tool failed");
  await expect(
    scheduling.routine(input, "routine-run", async () => {
      throw failure;
    }),
  ).rejects.toBe(failure);
  expect(scheduling.personIsActive(input)).toBe(false);
});
