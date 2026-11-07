import { afterAll, beforeAll, expect, test } from "bun:test";
import { randomInt, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { TEST_POOL, testDatabaseUrl } from "../../tests/support/database";
import { guardDeliveryStore } from "../admin/controls";
import { GATED_ROUTES } from "../admin/gate";
import { createBotLifecycleStore } from "../agents/lifecycle";
import { createAuditStore, PERSON_INITIATOR, recordAuditEvent } from "../audit";
import { createDatabase } from "../db/client";
import { auditEvents } from "../db/schema";
import { agents, channels, users } from "../db/schema/core";
import { deliveryInbox, deliveryOutbox } from "../db/schema/delivery";
import { workItems } from "../db/schema/work";
import { createWorkQueue } from "../work/queue";
import { createDeliveryRouter } from "./router";
import { configuredDeliveryProviders, createDeliveryRoutes } from "./routes";
import { createDeliveryStore } from "./store";
import { createTelegramTransport } from "./telegram";
import { createTelegramIngress } from "./telegram-ingress";
import { DeliveryRefusedError } from "./types";

const db = createDatabase(testDatabaseUrl(), TEST_POOL);
const prefix = `telegram-${randomUUID()}`;
const botId = randomInt(100_000, 1_000_000_000_000);
const scope = {
  ownerUserId: `${prefix}-owner`,
  channelId: `${prefix}-channel`,
  agentId: `${prefix}-bot`,
  threadId: `${prefix}-thread`,
};
const audit = createAuditStore(db);
const store = guardDeliveryStore(
  createDeliveryStore(db),
  audit,
  (message) => new DeliveryRefusedError(message),
);
const sent: Record<string, unknown>[] = [];
const turns: unknown[] = [];
let access = true;
const transport = createTelegramTransport({
  token: "123:fixture-token",
  fetch: async (url, init) => {
    if (String(url).endsWith("/getMe"))
      return Response.json({
        ok: true,
        result: { id: botId, is_bot: true, username: "nailong_test_bot" },
      });
    sent.push(JSON.parse(String(init?.body)));
    return Response.json({ ok: true, result: { message_id: sent.length } });
  },
});
const scopeFor = async (owner: string, channel: string, agent: string) =>
  access &&
  owner === scope.ownerUserId &&
  channel === scope.channelId &&
  agent === scope.agentId
    ? scope
    : null;
const router = createDeliveryRouter({
  store,
  queue: createWorkQueue(db),
  owner: prefix,
  authoriseScope: async () => access,
  scopeFor,
  providers: { telegram: transport },
  runTurn: async (input) => {
    turns.push(input);
    return { replyText: "fixture reply" };
  },
  audit: (event) =>
    recordAuditEvent(audit, {
      actorUserId: event.ownerUserId,
      initiator: PERSON_INITIATOR,
      eventType:
        event.kind === "inbound" ? "delivery.received" : "delivery.sent",
      targetType: "channel",
      targetId: event.channelId,
      payload: { deliveryId: event.id },
    }),
});
const ingress = createTelegramIngress({ transport, store, router, scopeFor });
const routes = createDeliveryRoutes({
  store,
  router,
  scopeFor,
  telegram: transport,
  requireUser: async (c, next) => {
    if (c.req.header("authorization") !== "fixture-owner")
      return c.json({ error: "Unauthenticated" }, 401);
    c.set("actor", {
      id: scope.ownerUserId,
      email: "owner@example.test",
      role: "admin",
    });
    await next();
  },
  listConversations: async () => ({ channels: [], nextCursor: null }),
  history: async () => [],
});
const update = (text: string, id: number, sender = 456) => ({
  update_id: id,
  message: {
    from: { id: sender, is_bot: false },
    chat: { id: sender, type: "private" },
    text,
  },
});
const start = (
  target: unknown = { channelId: scope.channelId, agentId: scope.agentId },
  auth = true,
) =>
  routes.request("/telegram/start", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: "fixture-owner" } : {}),
    },
    body: JSON.stringify(target),
  });

/** Advance only this fixture's durable work; no five-second sleeps in integration tests. */
async function matureInbound() {
  const rows = await db
    .select({ id: deliveryInbox.id })
    .from(deliveryInbox)
    .where(eq(deliveryInbox.ownerUserId, scope.ownerUserId));
  if (rows.length)
    await db
      .update(workItems)
      .set({ runAt: new Date(0) })
      .where(
        and(
          eq(workItems.kind, "delivery.inbound"),
          inArray(
            workItems.key,
            rows.map((row) => row.id),
          ),
        ),
      );
}

beforeAll(async () => {
  await db
    .insert(users)
    .values({ id: scope.ownerUserId, email: `${prefix}@example.test` });
  await db.insert(agents).values({
    id: scope.agentId,
    name: "Telegram fixture",
    type: "built_in",
    configuration: {},
  });
  await db
    .insert(channels)
    .values({ id: scope.channelId, name: "Telegram fixture", description: "" });
});
afterAll(async () => {
  const rows = [
    ...(await db
      .select({ id: deliveryInbox.id })
      .from(deliveryInbox)
      .where(eq(deliveryInbox.ownerUserId, scope.ownerUserId))),
    ...(await db
      .select({ id: deliveryOutbox.id })
      .from(deliveryOutbox)
      .where(eq(deliveryOutbox.ownerUserId, scope.ownerUserId))),
  ];
  if (rows.length)
    await db.delete(workItems).where(
      and(
        inArray(workItems.kind, ["delivery.inbound", "delivery.outbound"]),
        inArray(
          workItems.key,
          rows.map((row) => row.id),
        ),
      ),
    );
  // Audit rows are append-only and intentionally survive their test actor, as in the audit suite.
  await db.delete(users).where(eq(users.id, scope.ownerUserId));
  await db.delete(channels).where(eq(channels.id, scope.channelId));
  await db.delete(agents).where(eq(agents.id, scope.agentId));
  await db.$client.end({ timeout: 5 });
});

test("Telegram is opt-in and linking requires authentication and an accessible canonical target", async () => {
  expect(
    configuredDeliveryProviders("http://localhost", {}).telegram,
  ).toBeUndefined();
  expect(
    configuredDeliveryProviders("http://localhost", {
      TELEGRAM_BOT_TOKEN: "123:fixture-token",
    }).telegram,
  ).toBeDefined();
  expect((await start(undefined, false)).status).toBe(401);
  expect(
    (await start({ channelId: "stranger-channel", agentId: scope.agentId }))
      .status,
  ).toBe(400);
  expect(
    (
      await start({
        channelId: scope.channelId,
        agentId: scope.agentId,
        threadId: "injected",
      })
    ).status,
  ).toBe(400);
  expect(
    GATED_ROUTES.some((rule) => rule.path.test("/api/delivery/telegram/start")),
  ).toBe(true);
});

test("Telegram can be selected in the existing stored notification routing preferences", async () => {
  const lifecycle = createBotLifecycleStore(db);
  await lifecycle.setRouting(scope.ownerUserId, "progress", ["telegram"]);
  expect((await lifecycle.routing(scope.ownerUserId)).progress).toEqual([
    "telegram",
  ]);
  await lifecycle.setRouting(scope.ownerUserId, "progress", "all");
});

test("link, deduplicated inbound, canonical turn, durable reply and audit traverse the real database queue", async () => {
  const response = await start();
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.url).toBe(`https://t.me/nailong_test_bot?start=${result.code}`);
  expect(await ingress.receive(update(`/start ${result.code}`, 1))).toEqual({
    kind: "linked",
  });
  expect(await ingress.receive(update(`/start ${result.code}`, 1))).toEqual({
    kind: "rejected",
  });
  await router.sweep("delivery.outbound");
  expect(sent).toHaveLength(1);
  expect(await ingress.receive(update("unbound message", 2, 789))).toEqual({
    queued: false,
  });
  const queued = await ingress.receive(update("read the page", 3));
  expect(queued).toMatchObject({ queued: true });
  expect(await ingress.receive(update("read the page", 3))).toMatchObject({
    queued: false,
  });
  await matureInbound();
  await router.sweep("delivery.inbound");
  await router.sweep("delivery.outbound");
  expect(turns).toHaveLength(1);
  expect(turns[0]).toMatchObject({ ...scope, text: "read the page" });
  expect(sent.at(-1)).toEqual({ chat_id: "456", text: "fixture reply" });
  const inbox = await db
    .select()
    .from(deliveryInbox)
    .where(eq(deliveryInbox.ownerUserId, scope.ownerUserId));
  const outbox = await db
    .select()
    .from(deliveryOutbox)
    .where(eq(deliveryOutbox.ownerUserId, scope.ownerUserId));
  expect(inbox).toHaveLength(1);
  expect(inbox[0]).toMatchObject({
    source: "telegram",
    state: "sent",
    ...scope,
  });
  expect(
    outbox.every((row) => row.transport === "telegram" && row.state === "sent"),
  ).toBe(true);
  const trail = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.actorUserId, scope.ownerUserId));
  expect(trail.map((row) => row.eventType)).toContain("delivery.linked");
  expect(trail.map((row) => row.eventType)).toContain("delivery.received");
  expect(trail.map((row) => row.eventType)).toContain("delivery.sent");
  expect(
    trail.find((row) => row.eventType === "delivery.linked")?.payload,
  ).toMatchObject({ transport: "telegram", identity: "456" });
});

test("revoked conversation stops queued inbound and scheduled outbound before execution", async () => {
  const count = sent.length;
  await ingress.receive(update("must not run", 4));
  await router.notify(scope, {
    id: "scheduled-fixture",
    kind: "reply",
    text: "must not send",
  });
  access = false;
  await matureInbound();
  await router.sweep("delivery.inbound");
  await router.sweep("delivery.outbound");
  expect(turns).toHaveLength(1);
  expect(sent).toHaveLength(count);
  access = true;
});

test("disconnected binding stops queued work and future inbound", async () => {
  const binding = await store.findBinding(
    "telegram",
    String(botId),
    "456",
    "456",
  );
  expect(binding).not.toBeNull();
  const count = sent.length;
  await ingress.receive(update("disconnected turn", 5));
  await router.notify(scope, {
    id: "disconnect-fixture",
    kind: "reply",
    text: "disconnected reply",
  });
  await store.removeBinding(scope.ownerUserId, binding!.id);
  await matureInbound();
  await router.sweep("delivery.inbound");
  await router.sweep("delivery.outbound");
  expect(await ingress.receive(update("after disconnect", 6))).toEqual({
    queued: false,
  });
  expect(turns).toHaveLength(1);
  expect(sent).toHaveLength(count);
});
