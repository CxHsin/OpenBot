import { AsyncLocalStorage } from "node:async_hooks";
import type { TurnRunner } from "@openbot/toolkit/run-turn";

type Input = Parameters<TurnRunner>[0];
type Background = {
  yieldRequested: boolean;
  yielded: boolean;
  released: Promise<void>;
  release(): void;
};
const checkpoints = new AsyncLocalStorage<Background>();

export class RoutinePreemptedError extends Error {
  override name = "RoutinePreemptedError";
  constructor() {
    super("The routine yielded to a person at a completed tool boundary.");
  }
}

/** Called before a new model request, after the SDK has settled the preceding tool results. */
export function yieldForPerson(): boolean {
  const active = checkpoints.getStore();
  if (active?.yieldRequested) {
    active.yielded = true;
    return true;
  }
  return false;
}

/** A subagent is one parent tool: let it settle before yielding the parent's turn. */
export function withoutTurnScheduling<T>(run: () => T): T {
  return checkpoints.exit(run);
}

/** Local arbitration for the single API process. Durable continuation belongs to the work queue. */
export function createTurnScheduling(deps: {
  defer(input: Input, routineRunId: string): Promise<void>;
}) {
  const backgrounds = new Map<string, Background>();
  const people = new Map<string, Promise<void>>();
  const keyOf = (input: Pick<Input, "ownerUserId" | "threadId">) =>
    JSON.stringify([input.ownerUserId, input.threadId]);
  async function conversation(input: Input, run: TurnRunner, preempt: boolean) {
    const key = keyOf(input);
    const previous = people.get(key);
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    people.set(key, waiting);
    try {
      await previous;
      const background = backgrounds.get(key);
      if (background) {
        if (preempt) background.yieldRequested = true;
        await background.released;
      }
      input.signal?.throwIfAborted();
      return await run(input);
    } finally {
      release();
      if (people.get(key) === waiting) people.delete(key);
    }
  }
  return {
    personIsActive(input: Pick<Input, "ownerUserId" | "threadId">) {
      return people.has(keyOf(input));
    },
    async person(input: Input, run: TurnRunner) {
      return conversation(input, run, true);
    },
    /** Shares the local conversation lane without acquiring the caller's still-held thread lock. */
    async responsibility(input: Input, run: TurnRunner) {
      return conversation(input, run, false);
    },
    async routine(input: Input, routineRunId: string, run: TurnRunner) {
      const key = keyOf(input);
      // A person already speaking wins before any background lock is acquired.
      while (people.has(key) || backgrounds.has(key)) {
        if (people.has(key)) await people.get(key);
        else await backgrounds.get(key)?.released;
      }
      input.signal?.throwIfAborted();
      let release!: () => void;
      const active: Background = {
        yieldRequested: false,
        yielded: false,
        released: new Promise<void>((resolve) => {
          release = resolve;
        }),
        release: () => release(),
      };
      backgrounds.set(key, active);
      try {
        const result = await checkpoints.run(active, () => run(input));
        if (active.yielded) throw new RoutinePreemptedError();
        return result;
      } catch (error) {
        if (!active.yielded) throw error;
        // The underlying turn has unwound and released its Intelligence lock before this write.
        await deps.defer(input, routineRunId);
        throw new RoutinePreemptedError();
      } finally {
        backgrounds.delete(key);
        active.release();
      }
    },
  };
}
