---
id: 008-browser-file-baseline
phase: P0
status: green
decides: a browser task writes a file, reads it back and delivers the verified result
---

## Input

From the authenticated owner's native delivery API, ask the default Bot to open HN, save its current
top three original titles to `p0-baseline-hn.md` with source and UTC time, read it back, and reply.
The existing Telegram binding carries the reply. Do not claim this input originated at Telegram.

## Expected

Browser, write and read calls have enforced allow/carriedOut audit rows. Saved content matches the
recorded browser result, in order. One successful reply reaches the bound Telegram account. Actual
usage is recorded for the task, including any inline subagent.

## Result, 2026-11-07

Run `dc792760-82ab-4f4d-accb-a8beb526aba0` completed; outbox
`294263ad-da07-482d-b685-db2e673d7126` is sent, Telegram message `32`. It used a subagent, whose
durable thread `55569917-dab5-8037-90ba-17e0f3fec972` records navigation, UTC date, write and read.
The original browser tool result, write contents and read-back match:
`Upload Your RAM`, `Libghostty 1.0`, `Need for Speed Underground 2 online in the browser`.
The 229-byte file contains source URL and `2026-11-07T12:58:14Z`. A later gateway read independently
confirmed it. Write audit `13f3025d-15cb-47b9-a419-147e8de63095` and read audit
`eb727be3-3ac8-4927-b13f-97027120b4df` both record execution with the owner's grants.

Task usage: 105,267 tokens including repeated input across eight requests; cache reads 91,392 /
104,211 input (87.70%). Receipt to provider acceptance 55.335 s, zero human repair prompts.
Evidence: `.logs/baseline-task3-child.txt`, `.logs/baseline-task3-audit.txt`,
`.logs/baseline-dc792760-82ab-4f4d-accb-a8beb526aba0.txt`.
