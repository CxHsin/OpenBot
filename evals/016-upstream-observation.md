---
id: 016-upstream-observation
phase: sustained-delegation
status: green
decides: successful source checks retain a cursor and suppress unnecessary notifications
---

## Acceptance

Collect upstream commits from an explicit successful cursor to tip through the computer gateway,
including a committed GitHub fork version. Repeat at the same tip, then add commits while offline and
check the whole interval. Fetch failure or rewritten history must leave the cursor intact.
Only successful responsibility settlement commits progress; failed/suspended turns do not.
Concurrent progress cannot be overwritten by an older check. Quiet runs retain their result and
notify=false while neither channel activity nor delivery is called. Ordinary replies still post.
Inspect real gateway audit, stored run/progress and channel history before declaring green.

## Evidence — 2026-11-14

The user explicitly selected GitHub-only inputs: `CopilotKit/openbot` main and `CxHsin/OpenBot`
main. First live interval was the latest commit only,
`806a8317f383a63f5f2c3796555f8a419e9b352a..f8af37ab73e96784f174a11104505a965e722cab`;
fork tip `6b5a0143c467a4ca391726329367b668978ac585`, common base
`947955a57ba600a37906462a6d267b7abb6da7fc`. No host snapshot is used.
Full initial fetch exceeded the computer's 120-second limit; partial clone then fetched successfully.
Bot collection also succeeded through the gateway, with exitCode=0 and no timeout/truncation.

Native conversation created responsibility `394083a1-f92b-44ed-91aa-e70c483a85b3` and enabled routine
`routine_7c41ec0f-c756-47c6-badf-5c1816a70cc9`, cron `0 9 * * *`, timezone `Asia/Shanghai`.
First run `3712fdd7-72db-42b8-958b-411a0c24adbe` succeeded at 01:14:30 +08:00,
saved cursor `f8af37ab73e96784f174a11104505a965e722cab` and notify=true, and delivered the
[Windows installation/startup impact report](fixtures/upstream-observation/report.md).
Repeat run `238c5482-fd81-42c6-bd52-795f7e5f255e` succeeded at 01:16:18 +08:00,
retaining the same cursor and fork tip, recording verified no-change and notify=false.
Channel last activity remained the earlier person-request acknowledgement at 01:15:45;
there was no activity or outbox entry for the quiet run.

Seven computer action audit rows carry initiator kind `responsibility`, this goal ID, owner
`dev-local-user`, and allowed/carriedOut decisions. Commands include first-baseline and saved-tip
collection and no local snapshot. `.logs/observation-live-verify.mjs` asserts these facts against
`.logs/observation-live-evidence.json`; its saved output is `observation-live-verify.log`.
Both live runs were manually requested via the Bot. Daily schedule is configured; its future
09:00 firing is not claimed here. Natural clock-to-responsibility firing was separately accepted
in [eval 015](015-scheduled-responsibility.md).

189 targeted tests passed in 13 files (813 assertions), including `upstream-observer.test.ts`
(real Git fixture with distinct upstream/fork histories, offline interval, same tip, missing commit,
fetch failure and rewritten history), `responsibilities-store.integration.test.ts` (atomic quiet
checkpoint and stale progress rejection), `responsibilities-engine.test.ts` (quiet skips reply,
ordinary/actionable replies still notify, failure discards draft), and `responsibility-check.test.ts`.
Remaining routine, catalogue, tools and scheduling regressions also pass. Lint, format:check,
typecheck and diff whitespace checks pass; outputs use `.logs/observation-` prefix.

This proves source collection and checkpoint/notification behavior. Relevance judgement remains
model analysis; the reported Windows change has not been installed, merged or tested on Windows.
The existing queue's crash uncertainty remains; this adds no generic recovery journal.

## Review regressions — 2026-11-14

Review reproduced two gaps before fixes: a fork patch larger than 500KB blocked even unchanged
upstream checks, and a failed notification offer committed the check cursor before reporting the
delivery failure. The collector now writes large ranges to the workspace file for sliced reading;
actionable checks offer through existing activity/outbox before committing their checkpoint.
An offer error settles failed and leaves the old cursor. A partial offer or a crash before settlement
remains uncertain; no cross-run exactly-once guarantee is added.

Both regressions failed in `.logs/push-review-red.log` before fixes and pass in
`.logs/push-review-green.log`. Final targeted verification: 190 tests, 821 assertions, 13 files;
lint, format:check and typecheck exit 0 (`.logs/push-review-*.log`). No additional live model run
was used to claim these injected-failure cases. See the [review](../docs/dev/plans/upstream-observation-review.md).
