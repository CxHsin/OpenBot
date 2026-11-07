---
id: 006-handback-navigation-latency
phase: P0
status: green
decides: a refused headless navigation returns the required fresh observation in the same tool result
---

## Spec

The first live Telegram HN turn took 33.378 seconds from inbox insertion to the first Telegram send.
Its initial navigation was refused because handback required a fresh snapshot. The model then spent
an additional round requesting that snapshot before trying navigation again. The first navigation
failure and subsequent successful navigation were 9.266 seconds apart; not all of that is model time.

For the explicit `StaleSnapshotError.snapshotRequired` refusal on `computer_navigate`, obtain a
fresh snapshot through the existing gateway and include it in the same tool result. Tell the model
the navigation did not happen and let it decide the next action after reading that observation.
Do not automatically retry navigation, click/type, weaken handback rules or change the model.

## Expected

- One tool invocation returns `ok:false`, `notPerformed:true` and the fresh snapshot after the
  computer's explicit handback-snapshot refusal; it never sends a second navigation itself.
- The snapshot keeps the existing untrusted-content envelope and ref generation.
- Human control still suspends the run; ordinary stale refs and unrelated errors are not recovered.
- The refusal and any later navigation retain gateway policy and audit.
- The regression fails before the change and passes afterwards. A live wall-time improvement needs
  a new comparable user request; do not infer seconds saved from the deterministic fixture.

## Result, 2026-11-07

The real-gateway regression initially failed on the same structured `snapshotRequired` refusal.
The headless navigation adapter now returns the observation in that tool result and makes no
automatic second navigation. The three tests then passed, including human-control suspension and
policy refusal. Ordinary stale-reference errors remain errors. Logs:
`.logs/handback-navigation-red.log`, `.logs/handback-navigation-green.log`.

This removes the separate snapshot-request round in that recovery path. A subsequent live sample
is recorded below; it did not enter that recovery path, so it cannot isolate this hook's benefit.

Final related sweep: 191 pass / 0 fail across 13 files (delivery, gateway and headless turns).
`bun run lint`, `bun run format:check` and `bun run typecheck` all exited 0. The API was restarted
with both fixes, Telegram remains available, Web returns HTTP 200, and correction message `29` is
still recorded `sent`. Logs: `.logs/telegram-live-final-*.log` and
`.logs/api-telegram-optimized.log`.

### Live recheck

The user's next identical Telegram prompt entered inbox `64e10d30-6081-40b9-a5b5-e144f8cd5d2e`
at `2026-11-07T12:33:38.324Z`. The model completed at `12:34:04.133Z`; Telegram accepted the
complete reply at `12:34:05.395Z`, a receipt-to-send latency of **27.071 seconds**, compared with
33.378 seconds for the first incomplete reply (6.307 seconds / 18.9% lower in these two samples).
The browser navigation reported 2321 ms. Both queue items had attempts 1 and no error.

This time the first navigation succeeded; no handback refusal or extra snapshot call occurred.
The two runs have different page state, context and model timing, so this is a single successful
sample, not a causal estimate or a sustained latency guarantee. It also excludes time before durable
server receipt and after provider acceptance. Evidence: `.logs/telegram-recheck-20261107.txt` and
`.logs/telegram-recheck-thread-20261107.txt`.
