---
id: 040-escalation-rung
phase: P4
status: red
decides: that a run climbs the ladder only as far as it needs, and says which rung it stopped on
---

## Input

Three separate questions:

1. One answerable from the conversation.
2. One answerable from a connected app.
3. One that needs the browser on a site with no API.

## Expected

- Question 1 stops at rung 1; no tool call.
- Question 2 stops at rung 2; no browser action.
- Question 3 reaches rung 4.
- Each audit trail records the highest rung reached.

## How to check

Group audit rows by run id and take the maximum rung. Compare with the expected rung per question.
