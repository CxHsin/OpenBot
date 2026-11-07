---
id: 001-web-stack
phase: P0
status: red
decides: local Web chat, audited browsing, and routine creation through completion
---

## Input

Use General Assistant with `openai/gpt-6.1-sol` at the configured relay. Ask for a connection reply,
then open `https://example.com` and read its title and first sentence. Create a daily test routine
with timezone `Asia/Shanghai`, cron `0 9 * * *`, instruction `回复 P0 routine 验收成功`, and the
existing Web channel. Run it once with the application's run-now route, then pause it.

## Expected

- Chat returns `连接成功`.
- Browser navigation passes the gateway and is recorded with initiator `person`; the reply contains
  `Example Domain` and the first sentence read from the page.
- Routine creation writes exactly one row and completes the tool-result continuation without a
  model API error.
- The manual firing finishes as `succeeded` and its reply reaches the Web channel.
- The test routine is disabled afterwards.

## How to check

Read `/api/admin/audit-events`, `/api/routines`, and `/api/routines/:id/runs`; check the actual Web
channel reply. A successful database write followed by a model API error is a partial failure,
not permission to retry creation. This manual scenario does not prove scheduled firing or Telegram.

## Observed 2026-11-07

Chat and browser checks passed. Navigation audit: `b283d2ae-1bfd-47b5-a957-c9b6a25fbb0f`.
Routine `routine_b73e2352-8cc7-4ad6-b3e5-080882491851` was created, but the Responses continuation
failed with `Missing required parameter: input[23].id`. An earlier list-routines continuation failed
with the same symptom at `input[7].id`. Chat Completions was also tried: the relay's streamed tool
delta included `type: ""`, rejected by the SDK as `expected "function"`; its non-streamed tool
round trip passed. The source of the Responses ID mismatch is not yet isolated.

Run-now `routine_run_2ec37e33-de55-4fa4-9f8c-4a4e24cfe1ba` finished `succeeded` in 9.531 seconds,
and the channel displayed `P0 routine 验收成功`. The routine is now paused. Overall remains red
because tool-result continuation failed. The original Telegram exit eval remains red too.

Later the same day, `evals/002-relay-tool-continuation.md` passed after explicitly disabling
model-provider storage. This file preserves the initial creation failure; a new complete
creation-to-reply run has not yet been recorded. The original Telegram exit eval still remains red.
