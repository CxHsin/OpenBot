import { randomUUID } from "node:crypto";
import { keepLease } from "@openbot/toolkit/lease";
import type { TurnRunner } from "@openbot/toolkit/run-turn";
import { and, eq } from "drizzle-orm";
import { type AuditStore, recordAuditEvent } from "../audit";
import type { Database } from "../db/client";
import { routineRuns } from "../db/schema";
import { workItems } from "../db/schema/work";
import type { RoutineRunner } from "../routines/runner";
import type { RoutineStore } from "../routines/store";
import { createWorkQueue } from "../work/queue";

const KIND = "routine.resume";

/** Queue only identifiers. Completed steps remain in the owner's existing Intelligence history. */
export function createRoutineWork(deps: {
  database: Database;
  auditStore: AuditStore;
  owner: string;
  routines: RoutineStore;
  personIsActive(input: { ownerUserId: string; threadId: string }): boolean;
}) {
  const queue = createWorkQueue(deps.database);
  return {
    async defer(input: Parameters<TurnRunner>[0], routineRunId: string) {
      const key = randomUUID();
      await queue.offer({
        kind: KIND,
        key,
        payload: {
          routineRunId,
          ownerUserId: input.ownerUserId,
          threadId: input.threadId,
          agentId: input.agentId,
          previousRunId: input.runId,
          stage: "pending",
        },
      });
      await recordAuditEvent(deps.auditStore, {
        eventType: "turn.preempted",
        actorUserId: input.ownerUserId,
        targetType: "agent",
        targetId: input.agentId,
        initiator: { kind: "routine", id: input.routineId },
        payload: {
          routineRunId,
          runId: input.runId,
          threadId: input.threadId,
          workKey: key,
          checkpoint: "before_model_request",
          history: "Intelligence",
        },
      });
    },
    async sweep(runner: RoutineRunner) {
      for (const item of await queue.claim({
        kind: KIND,
        owner: deps.owner,
        leaseMs: 60_000,
        limit: 1,
        maxAttempts: 1000,
      })) {
        const { routineRunId, ownerUserId, threadId, agentId, stage } =
          item.payload;
        if (
          typeof routineRunId !== "string" ||
          typeof ownerUserId !== "string" ||
          typeof threadId !== "string" ||
          typeof agentId !== "string"
        ) {
          await queue.finish({ kind: KIND, key: item.key, owner: deps.owner });
          continue;
        }
        const [existing] = await deps.database
          .select({ status: routineRuns.status })
          .from(routineRuns)
          .where(eq(routineRuns.id, routineRunId));
        if (!existing || existing.status !== null) {
          await queue.finish({ kind: KIND, key: item.key, owner: deps.owner });
          continue;
        }
        if (stage === "running") {
          // A process died after beginning the continuation: its effects may be uncertain.
          await deps.routines.finishRun(
            routineRunId,
            "waiting",
            "Continuation stopped after execution began; inspect history before resuming.",
          );
          await queue.finish({ kind: KIND, key: item.key, owner: deps.owner });
          continue;
        }
        if (deps.personIsActive({ ownerUserId, threadId })) {
          await queue.release({
            kind: KIND,
            key: item.key,
            owner: deps.owner,
            delayMs: 2_000,
          });
          continue;
        }
        const controller = new AbortController();
        let lost = false;
        const lease = keepLease({
          renew: async () => {
            if (
              !(await queue.renew({
                kind: KIND,
                key: item.key,
                owner: deps.owner,
                leaseMs: 60_000,
              }))
            )
              throw Object.assign(new Error("Continuation lease lost"), {
                name: "PlatformRequestError",
                status: 409,
              });
          },
          everyMs: 20_000,
          lifetimeMs: 60_000,
          onLost: () => {
            lost = true;
            controller.abort();
          },
        });
        try {
          await deps.database
            .update(workItems)
            .set({ payload: { ...item.payload, stage: "running" } })
            .where(
              and(
                eq(workItems.kind, KIND),
                eq(workItems.key, item.key),
                eq(workItems.claimedBy, deps.owner),
              ),
            );
          await recordAuditEvent(deps.auditStore, {
            eventType: "turn.resumed",
            actorUserId: ownerUserId,
            targetType: "agent",
            targetId: agentId,
            initiator: {
              kind: "routine",
              id:
                (await deps.routines.runContext(routineRunId))?.routineId ??
                routineRunId,
            },
            payload: { routineRunId, threadId, workKey: item.key },
          });
          await runner.run(routineRunId, true, controller.signal);
          if (!lost)
            await queue.finish({
              kind: KIND,
              key: item.key,
              owner: deps.owner,
            });
        } finally {
          lease.stop();
        }
      }
    },
  };
}
