import { z } from "zod";
import {
  DeliveryProviderError,
  type ProviderFetch,
  type TextTransport,
} from "./types";

const botSchema = z.object({
  id: z.number().int().positive().safe(),
  is_bot: z.literal(true),
  username: z.string().regex(/^[A-Za-z0-9_]+$/),
});
const updateSchema = z.object({
  update_id: z.number().int().nonnegative().safe(),
});

/** Telegram's plain-text limit, without splitting a surrogate pair. */
function textParts(text: string): string[] {
  const parts: string[] = [];
  let part = "";
  for (const character of text) {
    if (part.length + character.length > 4096) {
      parts.push(part);
      part = "";
    }
    part += character;
  }
  if (part) parts.push(part);
  return parts;
}

export function createTelegramTransport(config: {
  token: string;
  fetch?: ProviderFetch;
}) {
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(config.token))
    throw new Error("TELEGRAM_BOT_TOKEN must be a BotFather token.");
  const request = config.fetch ?? fetch;
  async function call(method: string, body: object, signal?: AbortSignal) {
    let response: Response;
    try {
      response = await request(
        `https://api.telegram.org/bot${config.token}/${method}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(35_000)])
            : AbortSignal.timeout(35_000),
        },
      );
    } catch {
      // Native fetch errors may contain the URL (and therefore the token).
      throw new DeliveryProviderError("Telegram", "network_error", true);
    }
    if (!response.ok)
      throw new DeliveryProviderError(
        "Telegram",
        `HTTP_${response.status}`,
        response.status >= 500,
      );
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new DeliveryProviderError("Telegram", "invalid_response", true);
    }
    const parsed = z
      .object({
        ok: z.boolean(),
        result: z.unknown().optional(),
        error_code: z.number().optional(),
      })
      .safeParse(data);
    if (!parsed.success)
      throw new DeliveryProviderError("Telegram", "invalid_response", true);
    if (!parsed.data.ok)
      throw new DeliveryProviderError(
        "Telegram",
        `API_${parsed.data.error_code ?? "unknown"}`,
        !parsed.data.error_code || parsed.data.error_code >= 500,
      );
    return parsed.data.result;
  }
  let identity: Promise<z.infer<typeof botSchema>> | undefined;
  function bot() {
    identity ??= call("getMe", {})
      .then((result) => {
        const parsed = botSchema.safeParse(result);
        if (!parsed.success)
          throw new DeliveryProviderError("Telegram", "invalid_identity");
        return parsed.data;
      })
      .catch((error) => {
        identity = undefined;
        throw error;
      });
    return identity;
  }
  return {
    bot,
    async updates(offset: number | undefined, signal: AbortSignal) {
      const result = await call(
        "getUpdates",
        { offset, timeout: 25, allowed_updates: ["message"] },
        signal,
      );
      const parsed = z.array(updateSchema.passthrough()).safeParse(result);
      if (!parsed.success)
        throw new DeliveryProviderError("Telegram", "invalid_updates");
      return parsed.data;
    },
    async send(input: Parameters<TextTransport["send"]>[0]) {
      const parts = textParts(input.text);
      if (!/^[1-9]\d*$/.test(input.address) || !parts.length)
        throw new DeliveryProviderError("Telegram", "invalid_message");
      const ids: string[] = [];
      try {
        for (const text of parts) {
          const result = await call("sendMessage", {
            chat_id: input.address,
            text,
          });
          const parsed = z
            .object({ message_id: z.number().int().positive().safe() })
            .safeParse(result);
          if (!parsed.success)
            throw new DeliveryProviderError(
              "Telegram",
              "invalid_message_id",
              true,
            );
          ids.push(String(parsed.data.message_id));
        }
      } catch (error) {
        if (ids.length)
          throw new DeliveryProviderError("Telegram", "partial_send", true);
        throw error;
      }
      return { id: ids.join(","), status: "sent" as const };
    },
  };
}

export type TelegramTransport = ReturnType<typeof createTelegramTransport>;
