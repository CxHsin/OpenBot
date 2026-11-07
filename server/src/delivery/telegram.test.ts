import { expect, test } from "bun:test";
import type { DeliveryChallenge } from "../db/schema/delivery";
import { createTelegramIngress } from "./telegram-ingress";
import { createTelegramTransport } from "./telegram";
import { DeliveryProviderError } from "./types";

const token = "123:telegram-test-secret";
const bot = { id: 123, is_bot: true as const, username: "nailong_test_bot" };
const scope = {
  ownerUserId: "owner",
  channelId: "channel",
  agentId: "bot",
  threadId: "thread",
};
const code = "11111111-2222-4333-8444-555555555555";
const message = (text = "hello", id = 1) => ({
  update_id: id,
  message: {
    from: { id: 456, is_bot: false },
    chat: { id: 456, type: "private" },
    text,
  },
});

function wire(responses: (Response | Error)[]) {
  const calls: { method: string; body: Record<string, unknown> }[] = [];
  const transport = createTelegramTransport({
    token,
    fetch: async (url, init) => {
      calls.push({
        method: String(url).split("/").at(-1) ?? "",
        body: JSON.parse(String(init?.body)),
      });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      if (!response) throw new Error("Missing fixture response");
      return response;
    },
  });
  return { transport, calls };
}
const ok = (result: unknown) => Response.json({ ok: true, result });

test("Telegram uses getMe identity and long polling with the last acknowledged offset", async () => {
  const f = wire([ok(bot), ok([message()])]);
  expect(await f.transport.bot()).toEqual(bot);
  expect(await f.transport.bot()).toEqual(bot);
  expect(
    await f.transport.updates(17, new AbortController().signal),
  ).toHaveLength(1);
  expect(f.calls).toEqual([
    { method: "getMe", body: {} },
    {
      method: "getUpdates",
      body: { offset: 17, timeout: 25, allowed_updates: ["message"] },
    },
  ]);
});

test("plain text splits at Telegram's limit and preserves Unicode and Markdown literally", async () => {
  const f = wire([ok({ message_id: 10 }), ok({ message_id: 11 })]);
  const text = `${"a".repeat(4095)}😀*hello*`;
  expect(await f.transport.send({ id: "out", address: "456", text })).toEqual({
    id: "10,11",
    status: "sent",
  });
  const parts = f.calls.map(({ body }) => String(body.text));
  expect(parts.join("")).toBe(text);
  expect(
    parts.every((part) => part.length <= 4096 && !part.includes("�")),
  ).toBe(true);
  expect(f.calls[0]?.body).toEqual({ chat_id: "456", text: "a".repeat(4095) });
});

test("provider errors distinguish refusal, uncertainty and partial send without leaking a token", async () => {
  for (const [response, code, uncertain] of [
    [new Response("no", { status: 403 }), "HTTP_403", false],
    [
      Response.json({ ok: false, error_code: 400, description: token }),
      "API_400",
      false,
    ],
    [new Response("no", { status: 502 }), "HTTP_502", true],
    [new Response("not json"), "invalid_response", true],
    [
      new Error(
        `fetch failed: https://api.telegram.org/bot${token}/sendMessage`,
      ),
      "network_error",
      true,
    ],
  ] as const) {
    const f = wire([response]);
    try {
      await f.transport.send({ id: "out", address: "456", text: "hi" });
      throw new Error("Expected provider failure");
    } catch (error) {
      expect(error).toBeInstanceOf(DeliveryProviderError);
      expect(error).toMatchObject({ code, uncertain });
      expect(String(error)).not.toContain(token);
    }
  }
  const partial = wire([
    ok({ message_id: 10 }),
    new Response("no", { status: 400 }),
  ]);
  await expect(
    partial.transport.send({
      id: "out",
      address: "456",
      text: "x".repeat(4097),
    }),
  ).rejects.toMatchObject({ code: "partial_send", uncertain: true });
});

function ingressFixture() {
  const challenge: DeliveryChallenge = {
    ...scope,
    id: code,
    transport: "telegram",
    address: null,
  };
  const calls: unknown[] = [];
  const store = {
    readChallenge: async (id: string) => (id === code ? challenge : null),
    consumeChallenge: async () => true,
    bind: async (
      input: Parameters<import("./store").DeliveryStore["bind"]>[0],
    ) => {
      calls.push({ bind: input });
      return {
        ...input,
        id: "binding",
        enabled: true,
        mentionId: null,
        optedOutAt: null,
        createdAt: new Date(),
      };
    },
  };
  const router = {
    receive: async (
      input: Parameters<import("./router").DeliveryRouter["receive"]>[0],
    ) => {
      calls.push({ receive: input });
      return { queued: true, id: "inbox" };
    },
    notify: async (
      ...input: Parameters<import("./router").DeliveryRouter["notify"]>
    ) => {
      calls.push({ notify: input });
    },
  };
  const f = wire([ok(bot)]);
  const deps = {
    store,
    router,
    transport: f.transport,
    scopeFor: async () => scope,
  };
  return { calls, challenge, deps, create: () => createTelegramIngress(deps) };
}

test("a valid private link binds the canonical owner/thread and queues its confirmation", async () => {
  const f = ingressFixture();
  expect(await f.create().receive(message(`/start ${code}`))).toEqual({
    kind: "linked",
  });
  expect(f.calls[0]).toEqual({
    bind: {
      ...scope,
      transport: "telegram",
      realm: "123",
      identity: "456",
      address: "456",
    },
  });
  expect(f.calls[1]).toMatchObject({
    notify: [scope, { kind: "reply", id: "telegram-link:123:1" }],
  });
});

test("group, bot, mismatched identity, attachments and edited updates start no turn or pairing", async () => {
  const f = ingressFixture();
  const ingress = f.create();
  const base = message(`/start ${code}`);
  for (const update of [
    {
      ...base,
      message: { ...base.message, chat: { id: -456, type: "group" } },
    },
    { ...base, message: { ...base.message, from: { id: 456, is_bot: true } } },
    { ...base, message: { ...base.message, from: { id: 789, is_bot: false } } },
    { update_id: 1, edited_message: base.message },
    { update_id: 1, message: { ...base.message, text: undefined } },
  ])
    expect(await ingress.receive(update)).toEqual({ kind: "ignored" });
  expect(f.calls).toHaveLength(0);
});

test("expired, wrong-transport, consumed codes and changed conversation access cannot bind", async () => {
  for (const condition of [
    "expired",
    "transport",
    "consumed",
    "thread",
  ] as const) {
    const f = ingressFixture();
    if (condition === "expired") f.deps.store.readChallenge = async () => null;
    if (condition === "transport") f.challenge.transport = "sms";
    if (condition === "consumed")
      f.deps.store.consumeChallenge = async () => false;
    if (condition === "thread")
      f.deps.scopeFor = async () => ({ ...scope, threadId: "changed" });
    expect(await f.create().receive(message(`/start ${code}`))).toEqual({
      kind: "rejected",
    });
    expect(f.calls).toHaveLength(0);
  }
});

test("text goes through router identity resolution, never a caller-provided owner or thread", async () => {
  const f = ingressFixture();
  expect(await f.create().receive(message("read the page"))).toEqual({
    queued: true,
    id: "inbox",
  });
  expect(f.calls).toEqual([
    {
      receive: {
        source: "telegram",
        realm: "123",
        identity: "456",
        address: "456",
        externalId: "1",
        text: "read the page",
      },
    },
  ]);
});

test("a failed inbox write is not acknowledged; replay advances offset only after success", async () => {
  const f = ingressFixture();
  const offsets: (number | undefined)[] = [];
  f.deps.transport.updates = async (offset) => {
    offsets.push(offset);
    return [message("hi", 7)];
  };
  let fail = true;
  f.deps.router.receive = async () => {
    if (fail) throw new Error("DB unavailable");
    return { queued: true, id: "inbox" };
  };
  const ingress = f.create();
  const signal = new AbortController().signal;
  await expect(ingress.poll(signal)).rejects.toThrow("DB unavailable");
  fail = false;
  await ingress.poll(signal);
  await ingress.poll(signal);
  expect(offsets).toEqual([undefined, undefined, 8]);
});
