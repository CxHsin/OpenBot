import { z } from "zod";
import type { DeliveryRouter } from "./router";
import type { DeliveryScopeResolver } from "./routes";
import type { DeliveryStore } from "./store";
import type { TelegramTransport } from "./telegram";
import { DeliveryRefusedError } from "./types";

const privateText = z.object({
  update_id: z.number().int().nonnegative().safe(),
  message: z.object({
    from: z.object({
      id: z.number().int().positive().safe(),
      is_bot: z.literal(false),
    }),
    chat: z.object({
      id: z.number().int().positive().safe(),
      type: z.literal("private"),
    }),
    text: z.string().trim().min(1).max(16_000),
  }),
});

/** One local polling process; durable inbox dedupe survives its restart/offset replay. */
export function createTelegramIngress(deps: {
  transport: TelegramTransport;
  store: Pick<DeliveryStore, "readChallenge" | "consumeChallenge" | "bind">;
  router: Pick<DeliveryRouter, "receive" | "notify">;
  scopeFor: DeliveryScopeResolver;
}) {
  async function receive(update: unknown) {
    const parsed = privateText.safeParse(update);
    if (!parsed.success) return { kind: "ignored" as const };
    const { message, update_id: externalId } = parsed.data;
    if (message.from.id !== message.chat.id)
      return { kind: "ignored" as const };
    const bot = await deps.transport.bot();
    const address = String(message.chat.id);
    const realm = String(bot.id);
    const identity = String(message.from.id);
    if (/^\/start(?:@\w+)?(?:\s|$)/.test(message.text)) {
      const code = message.text.split(/\s+/)[1];
      const parsedCode = z.uuid().safeParse(code);
      if (!parsedCode.success) return { kind: "rejected" as const };
      const challenge = await deps.store.readChallenge(parsedCode.data);
      if (challenge?.transport !== "telegram")
        return { kind: "rejected" as const };
      const scope = await deps.scopeFor(
        challenge.ownerUserId,
        challenge.channelId,
        challenge.agentId,
      );
      if (
        !scope ||
        scope.ownerUserId !== challenge.ownerUserId ||
        scope.channelId !== challenge.channelId ||
        scope.agentId !== challenge.agentId ||
        scope.threadId !== challenge.threadId
      )
        return { kind: "rejected" as const };
      if (
        !(await deps.store.consumeChallenge(
          challenge.id,
          challenge.ownerUserId,
        ))
      )
        return { kind: "rejected" as const };
      try {
        await deps.store.bind({
          ...scope,
          transport: "telegram",
          identity,
          realm,
          address,
        });
      } catch (error) {
        if (error instanceof DeliveryRefusedError)
          return { kind: "rejected" as const };
        throw error;
      }
      // Even pairing confirmation uses the governed delivery outbox, never a direct send.
      await deps.router.notify(scope, {
        id: `telegram-link:${realm}:${externalId}`,
        text: "Telegram 已连接到你的 OpenBot 会话。现在可以在这里发消息。",
        kind: "reply",
      });
      return { kind: "linked" as const };
    }
    return deps.router.receive({
      source: "telegram",
      realm,
      identity,
      address,
      externalId: String(externalId),
      text: message.text,
    });
  }
  let offset: number | undefined;
  return {
    receive,
    async poll(signal: AbortSignal) {
      const updates = await deps.transport.updates(offset, signal);
      for (const update of updates) {
        if (signal.aborted) return;
        await receive(update);
        // A failed DB/queue operation is retried before acknowledging this update to Telegram.
        offset = update.update_id + 1;
      }
    },
  };
}
