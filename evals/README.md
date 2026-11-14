# Evals

An eval here is a scenario with a fixed input, a stated expected result, and a way to decide it
that does not depend on the model's own report. A passing turn is not evidence; a database row, an
audit row, or an exact reply is.

## Layout

Each file is one scenario:

```md
---
id: 010-coalesce-two-messages
phase: P1
status: red
decides: what a green result proves
---

## Input
The exact messages, events, or schedule, in order.

## Expected
What must be true afterwards. Name the row, the column, or the reply.

## How to check
The query, the route, or the assertion. If it cannot be automated yet, say what a person looks at.
```

`status` is `red`, `green` or `blocked` (with the reason). Keep it honest: a red eval that is red
for the right reason is more useful than a green one that checks nothing.

## Rules

- One scenario per real failure or per phase exit criterion. Do not invent scenarios to fill the
  directory.
- Assert on state, not on prose. "The Bot said it did it" is not a result.
- A scenario that needs a model to be deterministic asserts on structure: which tool was called,
  which rung of the ladder, which row was written.
- Every bug fixed in this fork gets a scenario here before the fix is merged. The scenario is what
  keeps it fixed.

## Running

New scenarios must identify executable regressions and independent evidence against the current source.
The former fork-specific scenarios were removed with their runtime extensions. Their historical
results do not validate this upstream baseline. Keep run outputs in ignored .logs/.
