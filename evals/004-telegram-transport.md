---
id: 004-telegram-transport
phase: P0
status: green
decides: Telegram private messages use the existing governed delivery turn and outbox
---

## Spec

Goal: connect one Telegram Bot to an existing person's Web conversation. Use the existing
delivery challenge, binding, inbox dedupe, leased work queue, governed turn runner and outbox.
An authenticated person requests a short-lived link code for an accessible Bot/channel, then
opens that code in a private Telegram chat. Only that bound Telegram identity may start turns.
Local development uses one server polling Telegram; no public webhook or tunnel is required.
Credentials stay in the ignored environment. Without credentials, the adapter stays disabled.

Out of scope: groups, attachments, Telegram-native approval buttons, new trigger/event routing,
multiple polling replicas, UI redesign and the remaining three-task model baseline.

## Expected

- Linking rejects expired/wrong-transport codes, changed access and group/bot messages.
- Normal private text is accepted only from a bound identity and chat. A duplicate update starts
  no second turn. The existing owner, Bot and thread are used with person attribution.
- Replies and scheduled notifications use the existing outbox, routing preferences and audit.
  Revoking a binding or scope before execution prevents the turn/send.
- Telegram text respects its message size limit. Provider failures record failure or uncertainty
  without exposing the token. A partial multi-message send is never reported as wholly unsent.
- Tests exercise the adapter through the existing router/store. Repository checks pass.
- For live acceptance, the user links their private chat, sends the HN prompt from eval 000,
  receives a matching reply, and the browser action, inbox, outbox and usage are inspected.

## Evidence

Implementation exists in `server/src/delivery/telegram.ts` and `telegram-ingress.ts`, with narrow
hooks in delivery routes/router, lifecycle routing, the enterprise chat gate and server assembly.
No schema migration is needed: existing transport columns and routing arrays store text.

On 2026-11-07, the 13 new tests passed against the dedicated `openbot_test` database. They verified
authenticated link creation, canonical scope, one-use code, private source validation, deduplicated
inbox, a single fixture model turn, outbox send, audit rows, routing preferences and revocation.
The provider test first reproduced treating an explicit `ok:false` response without `result` as
malformed; optional-result parsing now preserves the provider's refusal classification.
Audit rows remain append-only, including fixture rows. Test Bot realms are unique per run.

`https://api.telegram.org` was reachable from this machine (HTTP 302 to the official Bot docs).
At that point no real Bot token was configured. The initial fixture HTTP/model results did not
establish a live Telegram reply; the later live result follows below.

Related regression run: 88 pass, 0 fail across 9 files, including delivery router/routes/providers,
store/link audit and Bot lifecycle. Log: `.logs/telegram-related-tests.log`.
`bun run lint`, `bun run format:check`, `bun run typecheck` all exited 0.
The API was restarted on the new code. A live local probe at 11:27:43Z verified Web HTTP 200,
delivery HTTP 200, Intelligence mode with a valid license, `available.telegram=false` and an
unconfigured pairing request refused with HTTP 400. Evidence: `.logs/telegram-runtime-check.txt`.

### Live private-chat result

The user configured the token in the ignored environment and paired their private chat at
`2026-11-07T12:07:35.859Z`. Binding `868064af-9ae4-4ca7-a1b4-a8ed1050e039` maps to
`dev-local-user`, `general-assistant` and the existing Web thread. Telegram accepted connection
confirmation message `26`.

The HN request was recorded once as inbox `b96db1f4-c968-4159-b428-c3f8786cf2da` at
`12:07:57.898Z`. Both inbound and outbound queue items had attempts 1, finished without error.
Navigation audit `9e4b87f1-e648-4ff7-97c9-af3b050f0493` records person attribution and policy
allowed/enforced/carried out. Telegram accepted the original text at `12:08:31.276Z` (33.378 s).
It referred to a table without sending the titles; this failed the content requirement and led to
eval 005. The recorded titles were verified, recovered through the outbox and accepted as message
`29` at `12:21:10.237Z`; the user confirmed receipt. See `evals/005-telegram-component-text.md`.

This establishes real private-message transport and recovered content delivery. Eval 000 remains
red because this run has no token usage record; `model_usage` contains no row for the interval.
It is not evidence for automatic success on a new post-fix run or improved latency.

The subsequent automatic recheck passed content and transport without recovery: inbox
`64e10d30-6081-40b9-a5b5-e144f8cd5d2e`, outbox `5f630736-f0d7-43ee-8293-d3823bfd632b`,
Telegram message `31`, 27.071 seconds from durable receipt to acceptance. All three outgoing titles
match the fresh browser result; attempts 1 on both queue items. Evals 005/006 record the evidence and
timing limitations. Token usage remains the outstanding requirement of eval 000.
