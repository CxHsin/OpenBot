---
id: 015-scheduled-responsibility
phase: sustained-delegation
status: green
decides: an existing routine durably wakes its owned responsibility without a model intermediary
---

## Input

Create a responsibility, then schedule_responsibility with its id, cron and timezone.
Fire one routine run twice; pause the target and try a new firing. Repeat with a foreign owner/Bot.
Pause the routine and verify dispatch skips it.

## Expected

Routine stores the target id and uses the target's reporting channel. Same firing creates one
schedule event and at most one responsibility run. No clock-trigger acknowledgement is delivered.
Target and routine state are rechecked at firing. Owner, Bot and grants remain unchanged.
No second scheduler or queue. A target that disappeared must not execute as a normal routine.

## How to check

2026-11-14: 183 tests passed across 11 targeted files (788 assertions), including
`server/tests/routines-store.integration.test.ts`, `routine-runner.test.ts`, responsibility store,
engine/chat tools, catalogue and conversation scheduling regressions.
Database tests verify durable linkage after store reconstruction, repeated-firing dedupe,
forged-event rejection and owner/Bot/status boundaries. Runner tests cover no intermediary model,
paused routine and safe skipping without an ordinary-instruction fallback.

Live native Bot conversation created goal `1d0a89a1-8862-4201-ba27-016b0f35271c` and routine
`routine_cc545c65-1ef5-4ea4-b6cb-f7a72cad0a54`, cron `47 0 * * *`, timezone `Asia/Shanghai`.
The normal worker naturally fired at 2026-11-14 00:47:30 +08:00, without Run now or a manual goal run.
Routine run `routine_run_b1383d96-24c0-4bc9-9047-ce93e6664d12` succeeded in 43ms;
event `43e61df1-93ce-43bb-80b6-354a856b1f70` has source `schedule`, type `routine.fired`
and external ID `routine:routine_run_b1383d96-24c0-4bc9-9047-ce93e6664d12`.
Goal run `5b8b12b2-791a-4661-85c9-f477322b08cd` succeeded at 00:47:42 +08:00,
delivering exactly `EVAL015_SCHEDULE_OK` to the shared native conversation. The schedule tool
call has gateway success audit evidence. Test routine is now disabled and goal completed.

Local evidence: `.logs/scheduled-live-evidence.json`, `scheduled-live-verify.log`,
`scheduled-live-worker.log`, `scheduled-final-tests.log`; lint/format/typecheck logs use the
`scheduled-` prefix. Logs are ignored; identifiers above retain the acceptance record.
Manual Run now and normal scheduled firing are separate evidence; do not conflate them.
No upstream analysis, catch-up or report notification-deduplication claim is made by this eval.
