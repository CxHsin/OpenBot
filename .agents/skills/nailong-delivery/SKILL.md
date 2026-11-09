---
name: nailong-delivery
description: Prepare nailong-bot Issues, commits, branches, pull requests, and review evidence according to the repository contribution workflow.
---

# nailong-bot delivery

Use this skill when creating or updating an Issue or PR, naming a branch, preparing commits, or
reporting verification. Read [the contribution rules](../../../docs/dev/contributing.md) and the
matching `.github` template first, including when using CLI or API automation.

## Issue

Choose the smallest matching template: bug, enhancement, maintenance, docs, refactor, or review
report. State user impact or failure, evidence level, scope, non-goals and observable acceptance.
Distinguish reproduced behavior, source-confirmed behavior and hypotheses. Use a fixed commit SHA for
source locations. Keep secrets, personal paths, transcripts and customer data out of public text.

Use only configured labels. `triage` means unscoped for scheduling; `needs-decision` means a human
choice is blocking; `blocked` names an external blocker. Do not invent labels or milestone placement.

## Branch and commit

Use `<type>/<issue>-<slug>` or `<type>/<slug>` with `feat`, `fix`, `refactor`, `docs`, `test`, `ci`
or `chore`. One task owns one branch. An independent PR targets `main`; a dependent PR names its
direct base and dependency. A hand-written commit uses `<type>(<scope>): <change>` and explains
important reasons in its body. Keep unrelated changes out of the branch.

## Pull request

Use the repository PR template. Describe the final problem and behavior, linked Issue (`Closes #N`
or `Refs #N`), preserved invariants, design decisions, tests/evals and their actual results. State
what was not run and why, deployment/configuration/migration/state impact, and whether user-visible
changelog text applies. Do not claim a model report, a skipped test, or a local-only run as proof of
broader behavior.

For review, check the diff against the spec and product/design constraints. Keep findings actionable,
ordered by impact, and point to fixed-SHA evidence. Merge, push, remote label changes and deployment
remain separate actions requiring the user's authorization.
