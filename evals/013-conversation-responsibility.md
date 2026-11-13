---
id: 013-conversation-responsibility
phase: conversation-delegation
status: green
decides: granted conversation tools persist and control an owned responsibility
---

## Input

[Spec](../docs/dev/plans/conversation-responsibilities.md).
Through builtin Routines, create a responsibility with title, instruction and successCriteria;
list it, update its title, run it, pause it before execution, resume and complete it.
Try another owner, another Bot, a forged owner argument and an invalid target channel.

## Expected

The stored owner and Bot come from the connection; channel is validated against shared membership.
The row survives subsequent store reads. Title and status updates are visible in the database.
The queued run cannot start after pausing. Completed responsibilities cannot resume.
Foreign identities and invalid channels are refused. Write tools remain writes under catalogue policy.
Conversation tools do not include report_responsibility_progress.

## How to check

- `server/tests/builtin-routines.test.ts` checks the discoverable list.
- `server/tests/plugin-catalogue.test.ts` checks the reviewed write list and classification.
- `server/tests/responsibilities-store.integration.test.ts`, test
  `conversation tools persist delegation identity, lifecycle and paused dispatch`, uses a real dedicated
  test database for the transport/store boundary. Its channel resolver is a controlled stub;
  `server/tests/routines-store.integration.test.ts` covers real shared-channel resolution.
- A live Bot run must additionally retain the actual tool calls, policy/audit results and database IDs.
  A direct transport call does not prove that live grants expose the tools or that a model selects them.

## Evidence

2026-11-14: targeted tests across builtin-routines, plugin-catalogue, responsibility-chat-tools,
responsibilities-engine and responsibility-trigger-tools: 98 pass, 0 fail.
The chat adapter tests check connection-derived identity, invalid channel refusal, foreign owner/Bot
refusal, manual event attribution and unavailable backend errors using recording stubs.
Lint, format:check and workspace typecheck pass. Logs: `.logs/conversation-tools-*`.
Additional `typecheck:tests` exits 1: eight headless-component TS6142 baseline entries differ
by Windows absolute path versus stored relative path. Its output reports eight removed and eight
new entries for the same modules; no errors name the files changed by this task. The baseline and
test-typecheck script were not changed to hide the failure.

Initial database run of responsibilities-store and routines-store: 0 pass, 57 fail due to
`ERR_POSTGRES_CONNECTION_REFUSED` against the dedicated openbot_test database.
Docker Desktop launch was attempted; its Linux-engine pipe remained unavailable.
That initial run did not verify persistence or execution. The retry below supersedes the database
blocker; the original failure log is retained.

### Retry, 2026-11-14

Docker engine 29.7.2 and Compose Postgres are available. Dedicated openbot_test migration exits 0.
The two database suites now pass: 60 pass, 0 fail, 179 assertions. In particular, the conversation
transport test verifies persisted owner/Bot/channel, listing, title changes, queued manual execution,
pause before beginRun, resume, completion and foreign identity refusal. Existing routine-store
integration tests verify real shared membership, default single-channel selection and ambiguity refusal.
Logs: `.logs/conversation-retry-migrate.log`, `.logs/conversation-retry-db.log`.
The five targeted non-database suites were also rerun: 98 pass, 0 fail. Lint, format:check and
workspace typecheck all exit 0; logs use the `.logs/conversation-retry-*` prefix.
The additional test-typecheck baseline-path discrepancy was not changed or rerun by this retry.

No API listener was found on ports 3001/3010 during the retry. A live model selection/grant/audit
replay remains unrun; eval status is red for that remaining acceptance, rather than blocked by Docker.

### Live acceptance, 2026-11-14

The subsequent acceptance supersedes that pending live status. Started the API with the existing
environment and stateless relay option. Full-stack start hit a Docker credential-helper PATH error;
the healthy existing Postgres/computer containers and a directly started API sufficed for this test.
No browser or external message transport was used.

Refreshed the existing Routines server through its admin API (9 → 16 tools), then granted the seven
new responsibility tools to General Assistant through the standard grant API. Existing installations
need this explicit refresh/grant; new tools are not silently authorized by deploying code.

Model: `openai/gpt-6.1-sol`, native conversation channel
`channel_97bde1a9-6dfb-4999-b0cf-620655ed591f`.
Actual ordinary conversation turns created, listed, renamed, paused, resumed, ran and completed
responsibility `13174ea9-15b5-4e83-b1e7-c1f126380f40`.
Database reads confirm owner `dev-local-user`, Bot `general-assistant`, the explicit channel,
updated title `EVAL013_20261114_UPDATED`, intermediate paused state and final completed state.

Every one of the seven tools has `mcp.call_succeeded` audit evidence: initiator person,
reachedAs dev-local-user, enforce-mode allowed and carriedOut decisions. Listing is read;
the six mutations are writes. Representative audit IDs:

- create: `9b749a68-a1bf-471d-9156-149696af8ca4`
- update: `6e2b2173-845d-4822-bad9-534a8cae997d`
- pause: `79027666-dfb0-4f4e-83c5-7dd8323b17bd`
- resume: `724dad38-75c7-435c-ab79-2aa5953f80ac`
- successful retry request: `14963c14-a36f-4d33-a046-f67552ca00d8`
- complete: `0f959059-979d-46e9-bb47-8adcbb25f133`
- final list: `2dba17ac-1928-492f-8f91-1a3e42c1b3a1`

The first manual run failed on the still-held conversation lock. This was fixed and replayed,
not counted as an initial success; see [eval 014](014-responsibility-conversation-lock.md).
The successful background run returned the exact `EVAL013_RUN_OK` message and has a succeeded
run row. The test target is now completed, with no schedule or subscriptions; no ongoing test work.
The seven tool grants remain enabled on General Assistant.

Full evidence and assertions are in `.logs/conversation-live-evidence.json`,
`.logs/conversation-live-paused-evidence.json` and `.logs/conversation-live-verify.mjs`.
Green covers this single-process conversation entry and the database/regression cases above.
It does not establish autonomous upstream monitoring, cross-replica scheduling, or background
tool action grants (the target deliberately called no tools). Background per-request usage/initiator
metrics were not observed; no cost or background model-audit attribution claim is made.

Final verification after the lock fix: 164 tests pass across 10 affected test files, 0 failures,
644 assertions. Workspace lint, format:check and typecheck exit 0. Format initially detected the
new local evidence scripts/JSON; those artifacts were formatted and format:check rerun successfully.
Logs: `.logs/conversation-accept-tests.log`, `.logs/conversation-accept-lint.log`,
`.logs/conversation-accept-format.log`, `.logs/conversation-accept-typecheck.log`.
