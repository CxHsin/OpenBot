---
id: 011-preempt-running-work
phase: P1
status: green
decides: that a person speaking puts lower-priority work aside instead of waiting behind it
---

## Input

A routine is firing and its turn is mid-run (a browser action is in flight). The person sends
"Stop that and tell me what you found so far."

## Expected

- The person's turn starts before the routine's turn finishes.
- The routine's work is not lost: it is back on the queue with its journal, and resumes or is
  cancelled according to the person's message.
- The audit trail shows both initiators, `person` and `routine`, and shows which one was preempted.

## How to check

Timestamp order on the two runs, plus the routine's queue row still present and not `done`.

## Result, 2026-11-07

Scope: the local single API process, built-in V3 model, queued person input versus a routine in the
same owner's thread. Other replicas, Web streaming and other background trigger kinds are not
arbitrated by this implementation. Preemption waits for the active tool (including a subagent) to
settle; it never interrupts a side effect in flight. The next model request ends locally without
calling the provider, letting AG-UI tool results finish persistence before releasing the lock.
No synthetic provider usage is recorded. A durable `routine.resume` work key preserves the original
routine run; continuation reads the owner's existing Intelligence history and current grants.

The first live attempt revealed two failures: inherited scheduling state interrupted a subagent,
and a concatenated continuation run ID was rejected by the Intelligence lock endpoint. The SDK
regression now verifies emitted and stored tool results after yielding; subagents settle within
their parent tool, and continuations use a fresh UUID. The failure remains recorded on run
`routine_run_a4fde13d-2793-4955-ab2a-6d030f740968`; it was not overwritten as a pass.

The subsequent mid-work check used routine run
`routine_run_79217441-a55b-46c6-97f5-ad8f6dac9567`:

- Browser execution was observed at `13:25:46.421Z`; the person's input was durably received at
  `13:25:46.833Z` while background work continued.
- Completed browser/file results were durably retained; yield audit
  `30d8f518-6049-4e9c-80ec-6f430a12cddf` at `13:26:03.058Z` names the routine and checkpoint.
- The person's model run and reply precede continuation audit
  `0270ed52-460f-4263-b37f-da84280115e7` at `13:26:15.159Z`; the reply accurately reports the
  saved tool results and calls no tools itself.
- Queue key `13b502b1-c78e-4c8d-a731-5744e10d59a2` was unfinished while the person spoke, then
  completed. The original routine run reached succeeded at `13:26:33.814Z`, with `P1_ROUTINE_DONE`
  in the Web channel history. Its eight/seven queue claim attempts in live checks include deferrals
  while a person was active; they are not eight/seven model executions.
- All three computer actions occurred before yield; none were repeated on continuation. The
  temporary routine was paused after acceptance. This check is a manual firing, not a new cron test.

Tests also cover owner isolation, preserving unrelated errors, waiting for a person's turn, and a
crashed continuation becoming waiting instead of silently replaying effects. This is cooperative
P1 scheduling, not P2's general crash-resumable task journal. Evidence:
`.logs/p1-midflight-start.txt`, `.logs/p1-midflight-evidence.txt`, `.logs/p1-final-thread.txt`,
`.logs/next-final-tests.log`.
