import { afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { TEST_POOL, testDatabaseUrl } from "../../tests/support/database";
import { createDatabase } from "../db/client";
import {
  agents,
  channelAgents,
  channelMemberships,
  channels,
  routines,
  users,
  workItems,
} from "../db/schema";
import { createRoutineStore } from "../routines/store";
import { createRoutineWork } from "./routine-work";

const db = createDatabase(testDatabaseUrl(), TEST_POOL);
const store = createRoutineStore(db);
const prefix = `resume-${randomUUID()}`;
const owner = `${prefix}-owner`;
const bot = `${prefix}-bot`;
const channel = `${prefix}-channel`;
const audits: unknown[] = [];
let personActive = true;
const work = createRoutineWork({
  database: db,
  auditStore: {
    insert: async (event) => {
      audits.push(event);
    },
  },
  owner: prefix,
  routines: store,
  personIsActive: () => personActive,
});

afterAll(async () => {
  await db.$client`delete from work_items where kind='routine.resume' and payload->>'ownerUserId'=${owner}`;
  await db.delete(routines).where(eq(routines.ownerUserId, owner));
  await db.delete(channels).where(eq(channels.id, channel));
  await db.delete(agents).where(eq(agents.id, bot));
  await db.delete(users).where(eq(users.id, owner));
  await db.$client.close();
});

test("preemption persists work, waits for the person, and does not replay a crashed continuation", async () => {
  await db.insert(users).values({ id: owner, email: `${owner}@example.test` });
  await db
    .insert(agents)
    .values({ id: bot, name: "Test", type: "built_in", configuration: {} });
  await db
    .insert(channels)
    .values({ id: channel, name: "Test", description: "" });
  await db
    .insert(channelMemberships)
    .values({ channelId: channel, userId: owner });
  await db.insert(channelAgents).values({ channelId: channel, agentId: bot });
  const routine = await store.create({
    ownerUserId: owner,
    agentId: bot,
    channelId: channel,
    instruction: "Read progress",
    cron: "0 9 * * *",
  });
  const { runId } = await store.startManualRun(owner, routine.id);
  const input = {
    ownerUserId: owner,
    agentId: bot,
    threadId: "thread",
    routineId: routine.id,
    runId,
    instruction: "Read progress",
  };
  await work.defer(input, runId);
  let ran = 0;
  const runner = {
    run: async (id: string, resume?: boolean) => {
      expect(id).toBe(runId);
      expect(resume).toBe(true);
      ran++;
      await store.finishRun(runId, "succeeded");
    },
  };
  await work.sweep(runner);
  expect(ran).toBe(0);
  const queuedRows =
    await db.$client`select key,finished_at from work_items where kind='routine.resume' and payload->>'routineRunId'=${runId}`;
  const queued = queuedRows[0];
  expect(queued?.finished_at).toBeNull();
  personActive = false;
  await db
    .update(workItems)
    .set({ runAt: new Date(0) })
    .where(
      and(eq(workItems.kind, "routine.resume"), eq(workItems.key, queued!.key)),
    );
  await work.sweep(runner);
  expect(ran).toBe(1);
  expect(audits).toContainEqual(
    expect.objectContaining({
      eventType: "turn.preempted",
      initiator: { kind: "routine", id: routine.id },
    }),
  );
  expect(audits).toContainEqual(
    expect.objectContaining({ eventType: "turn.resumed" }),
  );
  const second = await store.startManualRun(owner, routine.id);
  await work.defer({ ...input, runId: second.runId }, second.runId);
  await db.$client`update work_items set payload=jsonb_set(payload, '{stage}', '"running"'::jsonb) where kind='routine.resume' and payload->>'routineRunId'=${second.runId}`;
  await work.sweep({
    run: async () => {
      throw new Error("Must not replay uncertain effects");
    },
  });
  const runs = await store.listRuns(owner, routine.id);
  expect(runs.find((run) => run.id === second.runId)?.status).toBe("waiting");
});
