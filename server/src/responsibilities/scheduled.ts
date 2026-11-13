import type { RoutineRunContext } from "../routines/store";
import type { ResponsibilityEngine } from "./engine";
import {
  type Responsibility,
  ResponsibilityNotFoundError,
  type ResponsibilityStore,
} from "./types";

/** A clock firing is an event, not a second model turn that asks the goal to run. */
export function createScheduledResponsibilityDispatch(deps: {
  store: Pick<ResponsibilityStore, "get">;
  engine: Pick<ResponsibilityEngine, "ingest">;
}) {
  return async (
    context: RoutineRunContext,
    routineRunId: string,
  ): Promise<boolean> => {
    if (!context.responsibilityId) return false;
    let goal: Responsibility;
    try {
      goal = await deps.store.get(
        context.ownerUserId,
        context.responsibilityId,
      );
    } catch (error) {
      if (error instanceof ResponsibilityNotFoundError) return false;
      throw error;
    }
    if (
      goal.status !== "active" ||
      goal.agentId !== context.agentId ||
      goal.channelId !== context.channelId
    )
      return false;
    await deps.engine.ingest({
      ownerUserId: context.ownerUserId,
      responsibilityId: goal.id,
      source: "schedule",
      externalId: `routine:${routineRunId}`,
      type: "routine.fired",
      payload: { routineId: context.routineId, routineRunId },
    });
    return true;
  };
}
