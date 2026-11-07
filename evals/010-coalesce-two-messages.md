---
id: 010-coalesce-two-messages
phase: P1
status: green
decides: that two messages sent seconds apart become one turn, the second amending the first
---

## Input

Two messages to the same channel, four seconds apart:

1. "Look at this post and tell me what to reply."
2. "Actually, Thursday is fine."

## Expected

- One turn runs, not two.
- The turn's stored user message contains both, in order.
- The Bot's answer treats Thursday as part of the same task, not as a separate request.
- One audit initiator `person` chain, not two.

## How to check

The channel transcript has one turn. `proactive_runs` is untouched. The audit rows for the turn
carry one run id.

## Result, 2026-11-07

The store transaction holds a per-conversation advisory lock, takes a fixed five-second window in
receipt order, records all covered inbox IDs on the leader's durable work item, and closes the
covered work keys. The router sends one combined user message and one reply. Recovery marks the
whole batch unknown instead of rerunning it. Windowing applies to queued Telegram and native input;
inline Slack/Teams and Web streaming do not use it.

Deterministic tests use the exact English inputs above and timestamps four seconds apart, assert
one ordered turn, one reply, concurrent claim exclusion, and durable recovery. Live owner-authorized
native inputs `075ae4b1-1ca9-415e-bcde-4ea7c770c3be` and
`9c1af8d2-7eea-4191-830b-a2acecce0697` also produced a single persisted user message with both
Chinese inputs and one Telegram reply containing `P1_PERSON_FIXED` and `周四可以`. Both inbox rows
are sent; only the first ID is a model run. The second input was approximately four seconds later.
Telegram polling itself was covered by the real-database transport integration test.

Evidence: `.logs/p1-fixed-thread.txt`, `.logs/p1-fixed-live-evidence.txt` and
`.logs/next-final-tests.log`. This intentionally adds up to five seconds of waiting to an isolated
message; the throughput/latency tradeoff is explicit, not a claimed speed improvement.
