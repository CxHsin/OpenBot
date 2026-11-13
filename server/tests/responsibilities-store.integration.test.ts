import { afterAll, beforeAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { createDatabase } from "../src/db/client";
import { agents, users } from "../src/db/schema/core";
import {
  responsibilityEvents,
  responsibilityRuns,
} from "../src/db/schema/responsibilities";
import { workItems } from "../src/db/schema/work";
import { callTool } from "../src/plugins/builtin-routines";
import { useResponsibilityChatTools } from "../src/responsibilities/chat-tools";
import { createResponsibilityStore } from "../src/responsibilities/store";
import {
  ResponsibilityNotFoundError,
  ResponsibilityRefusedError,
} from "../src/responsibilities/types";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const prefix = `responsibilities-${randomUUID()}`;
const ownerId = `${prefix}-owner`;
const strangerId = `${prefix}-stranger`;
const botId = `${prefix}-bot`;
const channelId = `${prefix}-channel`;
const store = createResponsibilityStore(database, {
  async resolveTarget(owner, bot, channel) {
    const [actor] = await database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, owner));
    return owner === ownerId && bot === botId && channel === channelId && actor
      ? { threadId: `${prefix}-thread` }
      : null;
  },
});
const keys: string[] = [];

beforeAll(async () => {
  await database.insert(users).values([
    { id: ownerId, email: `${ownerId}@example.test` },
    { id: strangerId, email: `${strangerId}@example.test` },
  ]);
  await database.insert(agents).values({
    id: botId,
    name: "Responsibility test Bot",
    type: "built_in",
    configuration: {},
  });
});
afterAll(async () => {
  if (keys.length)
    await database
      .delete(workItems)
      .where(
        and(
          eq(workItems.kind, "responsibility.run"),
          inArray(workItems.key, keys),
        ),
      );
  await database.delete(users).where(inArray(users.id, [ownerId, strangerId]));
  await database.delete(agents).where(eq(agents.id, botId));
  await database.$client.close();
});
async function goal() {
  return store.create(ownerId, {
    agentId: botId,
    channelId,
    title: "Quarterly graph",
    instruction: "Produce a graphical report",
    successCriteria: "The report has the quarterly graph",
    subscriptions: [{ source: "github", eventType: "issues.opened" }],
  });
}
async function event(id: string, externalId = randomUUID()) {
  const result = await store.ingestEvent({
    ownerUserId: ownerId,
    source: "manual",
    externalId,
    type: "requested",
    responsibilityId: id,
    payload: {},
  });
  keys.push(...result.runIds);
  return result;
}

test("successful quiet checks atomically retain progress and notification choice", async () => {
  const value = await goal();
  const { runIds } = await event(value.id);
  const runId = runIds[0];
  if (!runId) throw new Error("Missing run");
  await store.beginRun(runId);
  await store.settleRun(runId, {
    status: "succeeded",
    replyText: "Verified unchanged.",
    notify: false,
    checkpoint: { summary: "cursor: verified-tip", expectedProgress: "" },
  });
  expect((await store.get(ownerId, value.id)).progress).toBe(
    "cursor: verified-tip",
  );
  const [run] = await store.listRuns(ownerId, value.id);
  expect(run?.notify).toBe(false);
  expect(run?.replyText).toBe("Verified unchanged.");
  const next = await event(value.id);
  const nextId = next.runIds[0];
  if (!nextId) throw new Error("Missing next run");
  await store.beginRun(nextId);
  await expect(
    store.settleRun(nextId, {
      status: "succeeded",
      replyText: "Stale result",
      checkpoint: { summary: "cursor: stale", expectedProgress: "" },
    }),
  ).rejects.toThrow("progress changed");
  expect((await store.get(ownerId, value.id)).progress).toBe(
    "cursor: verified-tip",
  );
  await store.settleRun(nextId, { status: "failed", error: "stale check" });
  expect((await store.get(ownerId, value.id)).progress).toBe(
    "cursor: verified-tip",
  );
});

test("owned lifecycle survives reads and rejects another owner", async () => {
  const value = await goal();
  await expect(store.get(strangerId, value.id)).rejects.toBeInstanceOf(
    ResponsibilityNotFoundError,
  );
  await expect(
    store.update(strangerId, value.id, { title: "stolen" }),
  ).rejects.toBeInstanceOf(ResponsibilityNotFoundError);
  expect((await store.transition(ownerId, value.id, "paused")).status).toBe(
    "paused",
  );
  expect((await store.transition(ownerId, value.id, "active")).status).toBe(
    "active",
  );
  expect(
    (await store.update(ownerId, value.id, { title: "Annual graph" })).title,
  ).toBe("Annual graph");
  await store.transition(ownerId, value.id, "completed");
  await expect(
    store.transition(ownerId, value.id, "active"),
  ).rejects.toBeInstanceOf(ResponsibilityRefusedError);
});

test("conversation tools persist delegation identity, lifecycle and paused dispatch", async () => {
  useResponsibilityChatTools({
    store,
    engine: { ingest: (input) => store.ingestEvent(input) },
    async conversationFor(owner, bot, requested) {
      if (
        owner !== ownerId ||
        bot !== botId ||
        (requested && requested !== channelId)
      )
        throw new ResponsibilityRefusedError("No shared channel.");
      return channelId;
    },
  });
  const connection = { url: "builtin://routines", actorId: ownerId, botId };
  try {
    const created = await callTool(connection, "create_responsibility", {
      title: "Track upstream",
      instruction: "Analyze new commits",
      successCriteria: "Deliver sourced recommendations",
      channelId: "",
    });
    expect(created.isError).toBe(false);
    expect(created.text).toContain("no schedule of its own");
    const saved = (await store.list(ownerId)).find(
      (row) => row.title === "Track upstream",
    );
    if (!saved) throw new Error("Delegation was not persisted.");
    expect(saved.ownerUserId).toBe(ownerId);
    expect(saved.agentId).toBe(botId);
    expect(saved.channelId).toBe(channelId);
    expect(
      (await callTool(connection, "list_responsibilities", {})).text,
    ).toContain(saved.id);
    for (const foreign of [
      { ...connection, actorId: strangerId },
      { ...connection, botId: "other-bot" },
    ]) {
      expect(
        (await callTool(foreign, "pause_responsibility", { id: saved.id }))
          .isError,
      ).toBe(true);
    }
    expect(
      (
        await callTool(connection, "update_responsibility", {
          id: saved.id,
          patch: { title: "Track relevant upstream" },
        })
      ).isError,
    ).toBe(false);
    expect((await store.get(ownerId, saved.id)).title).toBe(
      "Track relevant upstream",
    );
    const queued = await callTool(connection, "run_responsibility", {
      id: saved.id,
    });
    expect(queued.isError).toBe(false);
    const result = JSON.parse(queued.text);
    keys.push(...result.runIds);
    expect(result.runIds).toHaveLength(1);
    expect(
      (await callTool(connection, "pause_responsibility", { id: saved.id }))
        .isError,
    ).toBe(false);
    expect((await store.get(ownerId, saved.id)).status).toBe("paused");
    expect(await store.beginRun(result.runIds[0])).toBeNull();
    expect(
      (await callTool(connection, "resume_responsibility", { id: saved.id }))
        .isError,
    ).toBe(false);
    expect((await store.get(ownerId, saved.id)).status).toBe("active");
    expect(
      (await callTool(connection, "complete_responsibility", { id: saved.id }))
        .isError,
    ).toBe(false);
    expect((await store.get(ownerId, saved.id)).status).toBe("completed");
    expect(
      (await callTool(connection, "resume_responsibility", { id: saved.id }))
        .isError,
    ).toBe(true);
    expect(
      (
        await callTool(connection, "create_responsibility", {
          title: "Forged",
          instruction: "Work",
          successCriteria: "Done",
          ownerUserId: strangerId,
        })
      ).isError,
    ).toBe(true);
    expect(
      (
        await callTool(connection, "create_responsibility", {
          title: "Wrong channel",
          instruction: "Work",
          successCriteria: "Done",
          channelId: "foreign",
        })
      ).isError,
    ).toBe(true);
  } finally {
    useResponsibilityChatTools(null);
  }
});

test("competing deliveries atomically produce one event, run and queue item", async () => {
  const value = await goal();
  const externalId = randomUUID();
  const results = await Promise.all(
    Array.from({ length: 4 }, () => event(value.id, externalId)),
  );
  expect(results.filter((result) => !result.duplicate)).toHaveLength(1);
  const runId = results[0]?.runIds[0];
  if (!runId) throw new Error("Expected a queued run.");
  expect(new Set(results.map((result) => result.eventId)).size).toBe(1);
  expect(
    await database
      .select()
      .from(responsibilityEvents)
      .where(eq(responsibilityEvents.externalId, externalId)),
  ).toHaveLength(1);
  expect(
    await database
      .select()
      .from(responsibilityRuns)
      .where(eq(responsibilityRuns.id, runId)),
  ).toHaveLength(1);
  expect(
    await database
      .select()
      .from(workItems)
      .where(
        and(eq(workItems.kind, "responsibility.run"), eq(workItems.key, runId)),
      ),
  ).toHaveLength(1);
  const contexts = await Promise.all([
    store.beginRun(runId),
    store.beginRun(runId),
  ]);
  expect(contexts.filter(Boolean)).toHaveLength(1);
});

test("pause before dispatch prevents the selected Bot from being run", async () => {
  const value = await goal();
  const result = await event(value.id);
  const runId = result.runIds[0];
  if (!runId) throw new Error("Expected a queued run.");
  await store.transition(ownerId, value.id, "paused");
  expect(await store.beginRun(runId)).toBeNull();
  expect((await store.listRuns(ownerId, value.id))[0]?.status).toBe("skipped");
});

test("waiting response resumes the same run once with stored pending tool context", async () => {
  const value = await goal();
  const result = await event(value.id);
  const runId = result.runIds[0];
  if (!runId) throw new Error("Expected a queued run.");
  await store.beginRun(runId);
  const waiting = {
    kind: "approval",
    requestId: "approval-1",
    continuation: {
      toolCallId: "call-1",
      runId: "agui-run-1",
      threadId: `${prefix}-thread`,
      args: { target: "save" },
    },
  };
  await store.settleRun(runId, {
    status: "waiting",
    waiting,
    error: "Approval required",
  });
  await expect(
    store.resumeWaiting(strangerId, runId, "yes"),
  ).rejects.toBeInstanceOf(ResponsibilityNotFoundError);
  const resumed = await Promise.all([
    store.resumeWaiting(ownerId, runId, { approved: true }),
    store.resumeWaiting(ownerId, runId, { approved: true }),
  ]);
  expect(resumed.filter(Boolean)).toHaveLength(1);
  const queued = await database
    .select()
    .from(workItems)
    .where(eq(workItems.kind, "responsibility.run"));
  keys.push(
    ...queued
      .filter((row) => row.payload.runId === runId)
      .map((row) => row.key),
  );
  const context = await store.beginRun(runId);
  expect(context?.runId).toBe(runId);
  expect(context?.continuation).toEqual({
    waiting,
    response: { approved: true },
  });
  await store.settleRun(runId, {
    status: "succeeded",
    replyText: "Graph rendered.",
  });
  expect((await store.get(ownerId, value.id)).lastResult).toBe(
    "Graph rendered.",
  );
});
