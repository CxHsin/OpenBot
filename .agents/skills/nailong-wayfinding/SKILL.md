---
name: nailong-wayfinding
description: Route a nailong-bot task to the right product, design, domain, plan, and verification context before implementation.
---

# nailong-bot task routing

Use this skill when a request is new, underspecified, spans multiple modules, or is about to change
behavior. The result is a bounded route through the repository, not an implementation.

## Route

1. Read `AGENTS.md` and [the docs index](../../../docs/README.md). Read
   [product](../../../docs/product.md) when the request changes user value, scope or priority.
2. Read [design](../../../docs/design.md) for cross-module behavior and the relevant ADR in
   `docs/decisions/` when an existing decision may constrain the choice.
3. Use [the development index](../../../docs/dev/README.md) to select only the affected domain
   documents. Read the relevant code, callers, failure paths and tests before proposing a boundary.
4. Find the deciding eval in `evals/` when behavior visible to a person changes. A passing model
   response is not evidence; identify the database, audit, delivery, file or exact test evidence.
5. If the route is clear, write or update a task spec under `docs/dev/plans/` with goal, scope,
   non-goals, constraints, deciding evidence and done conditions. If a product or design decision
   remains open, present the options and stop before implementation.

## Output

Report the selected product context, design and domain entries, reused mechanisms, affected code and
tests, deciding eval, and unresolved decisions. Keep facts in their authoritative documents; link
to them instead of copying them into the route.

Do not create a second queue, permission model, tracker convention or document taxonomy merely
because the request is ambiguous. Resolve whether an existing mechanism covers it first.
