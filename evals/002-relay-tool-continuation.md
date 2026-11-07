---
id: 002-relay-tool-continuation
phase: P0
status: green
decides: a built-in Bot completes sequential tool calls through the configured relay
---

## Spec

Goal: fix the observed Responses `Missing required parameter: input[n].id` after a server tool
finishes. Keep model transport changes narrow and explicit. Do not bypass tool grants, policy,
audit, or change stored history. Telegram, scheduling, new model selection and generic proxy
support are out of scope. Chat streaming is a recorded alternative failure; fixing it is not
required if Responses continuation works.

## Input

On the configured model, ask General Assistant to list routines, read the existing paused P0
routine, then list routines once again and report its ID and enabled state. No creation or deletion
is needed. In an isolated regression test, run the built-in agent against a local relay fixture
with two sequential server tools and require both results before its final reply.

## Expected

The isolated regression executes each tool once. The live run completes a tool-result continuation
and a subsequent read, the final reply arrives, and no missing-ID error appears.
Request inspection must preserve tool call/result matching, existing provider IDs,
reasoning, and message content. Verify the real run's tool audit rows and routine database state.
The regression must fail before the fix and pass after it.

## Result — 2026-11-07

The isolated live probe reproduced the error only after adding commentary before the first tool.
The SDK sent an `item_reference` with an ID, yet the relay answered HTTP 400:
`Missing required parameter: input[2].id`. The same probe with `store: false` replayed the complete
assistant text, executed both tools, and returned `PROBE_OK`. This establishes a failure resolving
stored item references at this relay, not that the SDK omitted the ID.

`OPENBOT_OPENAI_STATELESS=true` now opts API-key OpenAI Bots into SDK-managed complete input replay.
The deterministic regression (`server/src/openai-continuation.test.ts`) failed with the same missing-ID
symptom before the hook, then passed. It checks text, provider message ID, encrypted reasoning and
two matching tool results. Default configurations and Anthropic do not receive the option.

The existing Web channel was verified at 10:17–10:18 UTC. It displayed `开始检查`, tool results,
and the correct routine ID, `Asia/Shanghai` and `enabled: false`. The Bot first issued two reads
together, then issued a third read after receiving their results; this proves continuation across
steps but is not an exact two-call instruction-following pass. Audit rows:

- `f53dca93-25f0-44aa-a40e-fb3213b71280`
- `2a3a97de-e9d3-462d-9a57-a103981ce167`
- `85014992-415d-45f8-b9ea-cfb791c8a653`

All three record `mcp.call_succeeded`, initiator `person`, actor `dev-local-user`, tool
`routines/list_routines`, and an allowed, enforced policy decision. The database still contains
one paused P0 routine. Chat streaming's malformed delta remains outside this fix; the deployment
continues to use Responses. This result does not establish routine scheduled firing or Telegram.
