---
id: 000-baseline-message
phase: P0
status: red
decides: that a person can reach one Bot from a real channel and get a turn that used a tool
---

## Input

From Telegram, to the default Bot: "What is on news.ycombinator.com right now? Give me the top
three titles."

## Expected

- The reply arrives in Telegram, not only in the app.
- The turn called the browser tool at least once; the audit screen shows the browser action and its
  decision.
- The three titles match the front page at the time of the run.
- Tokens for the turn are recorded in usage.

## How to check

Read `/admin/audit`, filter by initiator `person`. The turn's browser rows are there, each with a
decision. Compare the titles with the page. Record tokens in `scripts/baseline.md`.

## Local result, 2026-11-07

The user's real Telegram HN request entered inbox `b96db1f4-c968-4159-b428-c3f8786cf2da`.
Browser navigation audit `9e4b87f1-e648-4ff7-97c9-af3b050f0493` records an enforced allow
decision, person attribution and execution. The saved navigation result and allowed `showTable`
agree on the top three titles. The original Telegram reply omitted the table, so the automatic
first attempt failed. Eval 005 fixes and records that failure, including the verified correction
delivered through the outbox and confirmed by the user.

The initial incomplete reply took 33.378 seconds from recorded inbox receipt to Telegram acceptance.
The first navigation was refused pending a handback snapshot, adding a separate model tool request;
eval 006 removes that extra snapshot-request round without automatically retrying any action.
The subsequent live recheck and its timing limits are recorded below.

Token and cache totals are not available in this turn's thread response or `model_usage` rows (none
for the interval). Therefore this eval stays red. Record a fresh automatic run with actual token
usage before marking the full P0 baseline complete. Evidence: `.logs/telegram-live-evidence.json`
and `.logs/telegram-thread-evidence.json`.

### Recheck after the delivery fix

A new identical user request at `12:33:38.324Z` completed automatically with all three titles in
Telegram message `31` at `12:34:05.395Z` (27.071 seconds from durable receipt to provider acceptance).
Navigation audit `6fe90465-8c4f-4eb4-85f6-3715e6953751` records an enforced allow, person
attribution and execution. The saved browser result, allowed table and outgoing text agree on
`Upload Your RAM`, `Libghostty 1.0`, and `Need for Speed Underground 2 online in the browser`,
in that order. Inbound/outbound each ran once, without error. Content and transport now pass on a
fresh automatic run. There is still no model_usage row or token/cache total for this run, so the
overall eval remains red on that requirement alone. Evidence: `.logs/telegram-recheck-20261107.txt`.

### Measurement enabled

Eval 007 now verifies actual usage, including a fresh native-API HN run that produced Telegram
message `33` with 58,117 tokens. This is a different ingress from this eval's specified Telegram
input, so it does not retroactively supply usage to message `31`. The exact same-turn Telegram
input + usage acceptance remains pending. Browser/file baseline passes (008); external connected
app baseline is blocked by an empty connection list (009). Do not mark full P0 complete yet.
