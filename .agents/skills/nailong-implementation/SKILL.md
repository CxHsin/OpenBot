---
name: nailong-implementation
description: Implement a confirmed nailong-bot task using its repository spec, domain constraints, existing mechanisms, and evidence-driven verification.
---

# nailong-bot implementation

Use this skill when a task has a confirmed scope and acceptance condition. It governs the repository
workflow; the product and domain documents remain authoritative for behavior.

## Before editing

1. Read the task spec, `AGENTS.md`, [contribution rules](../../../docs/dev/contributing.md), and
   the domain documents selected by [the development index](../../../docs/dev/README.md).
2. Inspect the existing entry point, callers, state lifetime, failure paths, tests and deciding eval.
   Prefer a narrow hook and an existing queue, store, gateway, audit or delivery abstraction.
3. Work on one task branch and an isolated worktree when another session is active. Use the project
   branch form `<type>/<issue>-<slug>` or `<type>/<slug>`; never mix unrelated cleanup into it.
4. For a behavior change, establish the relevant regression or eval evidence before claiming the
   implementation is complete. A bug fix must have a meaningful failure case.

## While editing

- Preserve owner, initiator and grants across queued, routine, handoff and unattended work.
- Route every Bot action through the gateway so policy, audit and execution keep their order.
- Treat queues, leases, database time, durable state and dedupe keys as existing contracts; do not
  replace them with in-memory state without an explicit decision and evidence.
- Keep external or irreversible side effects distinguishable from uncertain execution. Do not retry
  an action blindly after a lease loss, restart or missing result.
- Update the affected domain document, ADR or plan only when the delivered behavior or decision
  changes. Keep proposed design visibly separate from current behavior.

## Verify and finish

Follow [verification](../../../docs/dev/verification.md): targeted tests first, then the required
lint, format and type checks, then the deciding eval or its documented blocked evidence. Save logs in
`.logs/`, capture exit codes, and report actual results only. Inspect audit, database, delivery or
exact test evidence for claims about behavior.

Stop when the spec is met and its evidence is recorded. Record an out-of-scope discovery as a
separate task instead of expanding the branch silently.
