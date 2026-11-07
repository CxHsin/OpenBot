---
id: 020-resume-after-crash
phase: P2
status: red
decides: that a multi-step task continues from its last completed step after the process dies
---

## Input

A task with three steps is started. After step two completes, the API server is killed before step
three begins. The server is started again.

## Expected

- Step one and step two do not run again.
- Step three runs, and the task ends with one result.
- The journal has exactly three completed steps, no duplicates.
- The audit trail shows one `handoff` or `person` chain, not two runs from the beginning.

## How to check

The task's journal rows, ordered; then the audit rows for the task's run id.
