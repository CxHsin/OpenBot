---
id: 014-responsibility-conversation-lock
phase: conversation-delegation
status: green
decides: a manual responsibility run waits for its creating conversation turn in one API process
---

## Input

In an ordinary conversation, ask the Bot to run an owned responsibility whose report channel is
that conversation. Keep the person turn active while the responsibility dispatcher starts.
The target instruction only replies `EVAL013_RUN_OK`, with no tools or external effects.

## Expected

The responsibility waits for the person turn to release the conversation thread, retains its
responsibility initiator and owner, then completes without `THREAD_LOCK_FAILED`.
No retry of an uncertain external action is introduced.

## Regression

`bun test server/src/scheduling/turns.test.ts`:
`a responsibility queued by a person waits for that conversation lock and keeps its initiator`.
The pre-fix direct-run path reproduced `THREAD_LOCK_FAILED` (3 pass, 1 fail);
the serialized path passes (4 pass, 0 fail). Logs: `.logs/conversation-lock-red.log` and
`.logs/conversation-lock-green.log`. This deterministic test exercises the scheduling boundary;
the original live replay below checks the production wiring as well.

## Observed failure and fix

2026-11-14: responsibility `13174ea9-15b5-4e83-b1e7-c1f126380f40`, run
`005057dc-d49c-464c-9c69-03a9057c680a`, failed while acquiring the Intelligence thread lock with
HTTP 409 `THREAD_LOCK_FAILED`. Its initiating person turn still held the same thread.

Responsibility wiring now uses the existing local conversation scheduling lane before invoking
the turn runner. Unlike a person, it does not ask a running routine to yield. The existing durable
queue and lease renewal remain in place; no owner, grants or initiator changes.
This is serialization in one API process, not cross-replica arbitration or preemptible responsibility work.

Live retry after restarting the API with the fix: run `bbbc631f-24b5-4dbf-929f-c1586eb58be7`
succeeded, started `2026-11-13T16:22:41.105Z`, finished `16:22:55.193Z`
(2026-11-14 00:22 local). History contains the exact standalone assistant reply `EVAL013_RUN_OK`.
The first failed row remains unchanged. Evidence: `.logs/conversation-live-run-evidence.json`,
`.logs/conversation-live-evidence.json`, `.logs/conversation-live-verify.mjs`.
The regression verifies initiator preservation at the scheduling boundary; this no-tool background
run does not establish background tool-grant enforcement or model usage attribution.
