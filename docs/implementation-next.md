# P0 measurement and P1 conversational scheduling

Goal: record actual per-request model usage and elapsed time, finish the three baseline tasks,
then make successive Telegram messages amend one turn and allow a person to interrupt a routine.

Scope: built-in API-key headless turns, existing delivery inbox/outbox, existing routine queue and
Intelligence history. Owner identity, tool grants and gateway checks remain authoritative.
No model switching, replacement of Intelligence, new connector credentials, or desktop UI redesign.

Acceptance:

- `evals/007-model-measurement.md`: provider usage survives tool continuation; absent usage stays
  unknown; separate model request timing from tool and delivery time.
- `scripts/baseline.md`: check source data, saved file and delivered reply for the three tasks;
  unavailable app connections are recorded rather than invented.
- `evals/010-coalesce-two-messages.md`: four-second-apart messages become one ordered user turn.
- `evals/011-preempt-running-work.md`: the person starts before the interrupted routine completes,
  routine work remains durable, and both initiators are visible in audit. Never replay completed
  side effects blindly; resume uses persisted history and the original owner.

Run targeted regressions before the required lint, format and type checks. Record live evidence
separately from deterministic tests. A missing external credential does not count as a passing eval.
