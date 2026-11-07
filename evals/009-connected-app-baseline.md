---
id: 009-connected-app-baseline
phase: P0
status: green
decides: a question is answered from a real connected app without browser search
---

## Input

Through authenticated native delivery, ask General Assistant to use only the granted Notion
connector to fetch page `203f6c3b-20d7-80c0-9059-f1769772de31`: report its last-edited timestamp,
whether the returned content has text paragraphs, and the child page ID. Include its link; do not
change anything, search the web, or use a browser.

## Expected

- The Bot reads through the owner's built-in Notion OAuth connection and gateway.
- The answer agrees with the fetched metadata and content; it does not infer child contents.
- The audit records an enforced allow and execution of a read; no browser or write is performed.
- The answer reaches Telegram and actual model usage is recorded.

## Local result, 2026-11-07

The earlier empty connection list was a historical blocker. On restoring the API, the authenticated
connection route reported a non-revoked personal Notion connection created at `14:22:34.291Z`.
Refresh returned 77 tools. Only `notion-search` and `notion-fetch` were granted to General Assistant;
both classify as reads. No token adapter was added.

Native inbox/run `6628e571-603c-4cc9-b447-03f0846c852c` completed using one
`mcp__notion__notion-fetch` call. Its persisted tool result reports last edit
`2025-05-30T13:28:54.490Z` and a child reference to
`203f6c3b-20d7-800b-8bc3-e5ad0ea79ae4`, with no paragraphs in the returned content.
The reply states those facts and limits its finding to the returned parent page. Independent
gateway fetch agrees. Audit `f9ed4a8d-42a7-4557-abdc-61cc8738b1e3` records `person`, the correct
owner, `effect=read`, and an enforced allow with `carriedOut=true`. The saved turn contains no
browser, web-search or write tool call.

Outbox `a75eb5b3-0e88-4e35-a561-cc6ea3809825` is `sent`, Telegram message `39`;
delivery audit `e8ea0506-2a56-4e1f-851c-bf5a41a24c26` confirms acceptance at `14:35:03.723Z`.
Three model requests report 78,875 input + 498 output = 79,373 tokens, 51,584 cache reads
(65.40% of input), and 18.499 seconds of model request time. Durable receipt to Telegram
acceptance was 39.230 seconds. No intervention was needed after submission.

## How to check

Read persisted messages after user message `delivery:6628e571-603c-4cc9-b447-03f0846c852c`
in the existing channel history; compare the fetch result with the outbox text. Read the audit
IDs above and the `model.request_completed` rows with that run ID. Local evidence:
`.logs/p0-notion-source.txt`, `.logs/p0-notion-audit.txt`, `.logs/p0-notion-metrics.txt`,
`.logs/p0-notion-reply.txt`, and `.logs/p0-closeout-history.txt`.

This uses native ingress and real Telegram output. Eval 000 still requires its own fresh
Telegram-originated request with usage; this success does not change that requirement.
