---
id: 005-telegram-component-text
phase: P0
status: green
decides: Telegram replies contain the data a Bot presents as display components
---

## Spec

The real Telegram HN turn on 2026-11-07 navigated the site and sent a reply referring to a table,
but its delivery outbox text omitted that table. Preserve the existing governed display component
result and render a plain-text equivalent when queuing asynchronous delivery replies. Never replay
the browser or re-run the model merely to recover already recorded output. Keep Slack/Teams native
inline rendering unchanged. No redesign of component tools, model prompting or usage storage.

## Expected

- A queued turn returning `replyText` plus an allowed `showTable` component sends the table title,
  column names and all row values in Telegram's plain text.
- Other registered display components preserve their labels, values and source attribution.
  A component-only result still gets delivered; the absence of components preserves existing text.
- A regression exercising the actual queued router path fails before the fix and passes after it.
- Recover the actual HN table from the saved thread, compare its titles to recorded browser evidence,
  and deliver the recovered result through the existing bound outbox without another model turn.

## Evidence

Initial delivery inbox `b96db1f4-c968-4159-b428-c3f8786cf2da` and outbox
`6d23a565-df1c-47a1-bbee-c679886d867a` are `sent`. Telegram accepted provider message `28`,
but its text says the titles are in a table and contains none. This is not a successful answer.

The original Intelligence thread contains an allowed `showTable` result. Its three original titles
match the successful `computer_navigate` tool result, in order: `Libghostty 1.0`, `Upload Your RAM`,
`Every Mac comes with an (undocumented) family member classifier`.

The queued delivery path had discarded `components` while keeping only `replyText`. It now appends
plain-text display results before offering the outbox row. Inline Slack/Teams rendering is unchanged.
The two router regressions failed before the fix (9 pass / 2 fail) and passed afterwards; the
renderer/router check was 14 pass / 0 fail. Related delivery/lifecycle tests: 93 pass / 0 fail.

The original allowed table was recovered without another model/browser run, checked against its
recorded browser result, and offered through the delivery router with a stable dedupe key. Existing
binding, component access, notification preferences and conversation access were checked. Outbox
`1a65b3ae-cd75-40c9-b359-572b157ea785` reached `sent`, Telegram message `29`, audit
`067233e7-dce0-46eb-a837-9cb86d4c394c`, at `2026-11-07T12:21:10.237Z`. The user confirmed receipt.
The correction explicitly states that the titles were read at 20:08 local, rather than claiming a
new live read. It is a manually recovered delivery, not a second successful model benchmark.

Evidence: `.logs/telegram-component-red.log`, `.logs/telegram-component-green.log`,
`.logs/telegram-thread-evidence.json`, `.logs/telegram-recovery-evidence.json`,
`.logs/telegram-live-evidence.json`. The original incomplete reply remains in the audit/history.

Final combined regression sweep including the headless navigation change: 191 pass / 0 fail;
lint, format:check and typecheck passed. API reloaded with the fix; no new model run was invented
to count the manually recovered correction as an automatic pass.

### Fresh automatic pass

The next real Telegram request, inbox `64e10d30-6081-40b9-a5b5-e144f8cd5d2e`, automatically
produced outbox `5f630736-f0d7-43ee-8293-d3823bfd632b`, state `sent`, Telegram message `31`.
Its text includes the allowed table title, provenance, all columns and all three rows, without
recovery or another person prompt. The original titles match this turn's browser result in order:
`Upload Your RAM`, `Libghostty 1.0`, `Need for Speed Underground 2 online in the browser`.
The change in ranking since the previous request is reflected in the new reply.
Delivery audit `46f99470-37b3-44c7-9042-4d0b0d36a271` is timestamped `12:34:05.395Z`.
Evidence: `.logs/telegram-recheck-20261107.txt`, `.logs/telegram-recheck-thread-20261107.txt`.
