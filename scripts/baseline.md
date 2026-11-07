# Baseline

Measured before any trigger work, on the same three tasks, on the model the Bot will actually use.
Fill this in by running the tasks by hand and recording what happened. Do not estimate.

| Field | Value |
| --- | --- |
| Date | 2026-11-07 |
| Commit | 947955a + uncommitted fork changes |
| Model | openai/gpt-6.1-sol |
| Bot | general-assistant |
| Transport | Telegram private chat |
| Computer mode | shared |

## Tasks

Use the same three every time so the numbers are comparable.

1. **Read and summarize.** "Open news.ycombinator.com and give me the top three titles."
2. **Connected app.** A question answerable from one connected app, with no web search needed.
3. **Multi-step.** A task that needs a browser action, a file written, and a reply.

## Numbers

| Task | Success | Tokens | Cache hit | Interventions | Wall time |
| --- | --- | --- | --- | --- | --- |
| 1 | First attempt failed; fresh retest passed after repair | unavailable | unavailable | First: engineering repair; retest: 0 | First: 33.378 s incomplete, 792.339 s corrected; retest: 27.071 s complete |
| 1, measured replay via native API → Telegram | Pass, source titles checked | 58,117 (57,885 input + 232 output) | 55,936 / 57,885 = 96.63% | 0 | 36.225 s |
| 2, Notion OAuth via native API → Telegram | Pass, fetched metadata and child reference checked | 79,373 (78,875 input + 498 output) | 51,584 / 78,875 = 65.40% | 0 after submission | 39.230 s |
| 3, native API → Telegram | Pass, saved file read back and source checked | 105,267 (104,211 input + 1,056 output) | 91,392 / 104,211 = 87.70% | 0 | 55.335 s |

Definitions, fixed now so later measurements mean the same thing:

- **Success**: the result is correct when checked against the source, not when the Bot says so.
- **Tokens**: total for the turn, from usage.
- **Cache hit**: reported cache reads as a share of input tokens. A miss on a repeated prefix is a
  bug, not a cost.
- **Interventions**: how many times a person had to type something to get the task finished.
- **Wall time**: from send to final reply.

## Notes

What surprised you. What the Bot did that was not asked. Anything that should become an eval.

Task 1 timing starts at durable inbox receipt and ends at Telegram provider acceptance; Telegram's
message submission timestamp was not recorded, so this excludes delivery to the server. The model
read the right page and saved the right titles but its original plain-text reply omitted the table.
The manually recovered correction is not an automatic success or a model latency measurement.
Token/cache totals are unknown and not estimated. Evals 005 and 006 pin the lost component data and
the extra snapshot-request round after handback. The fresh retest received at 20:33:38.324 local
returned a complete answer at 20:34:05.395, matched the fresh browser result, and needed no repair.
This one sample was 6.307 seconds faster; it did not hit handback recovery, so the difference cannot
be attributed to that hook alone. It is not a sustained performance measurement.

### Local P0 check, 2026-11-07

This is a partial startup check, not a measurement of the three tasks above. Model
`openai/gpt-6.1-sol` on Web, shared computer: chat passed; example.com browsing passed with an audit
row; a routine manual firing succeeded in 9.531 seconds and replied in the channel, then was paused.
Routine creation committed but its model continuation failed on a required Responses input ID.
Chat streaming also failed on a malformed tool delta. See `evals/001-web-stack.md`.

The later Responses continuation check passed with `OPENBOT_OPENAI_STATELESS=true`, including a
real Web turn with audited routine reads and a final reply. See `evals/002-relay-tool-continuation.md`.
At that point the three baseline tasks above had not been measured. Task 1's later failed initial
delivery and manual recovery are now recorded in the table; tasks 2 and 3 remain unmeasured.

A normal worker-scheduled firing also passed: due 18:49:00 local on 2026-11-07, started
18:49:30.095, finished 18:49:40.024, source `schedule`, status `succeeded`, one dispatch and one
new run. The Web channel received the unique reply without another person turn. The test routine
was paused afterwards. See `evals/003-scheduled-routine.md`.

The model usage API records model selection and run IDs; those records alone do not provide the
token/cache totals required above. New request metrics in audit provide the actual totals in the
measured rows above; old runs remain unknown.

### Measured task runs and P1 scope

Owner-authorized native delivery requests used the same existing channel and real Telegram outbox;
these are explicitly not new Telegram-originated inputs. HN run
`dd4b9d8e-f9f8-43d2-b08c-56ff655fcc2c` delivered message `33`, with three model requests totalling
16.659 seconds. Its wall time includes the new five-second coalescing wait. It is slower than the
27.071-second historical sample; no sustained speed improvement is claimed.

Task 3 run `dc792760-82ab-4f4d-accb-a8beb526aba0` delivered message `32`; eight requests including
its inline subagent totalled 37.488 seconds. The subagent's original browser result, write and read
are retained in thread `55569917-dab5-8037-90ba-17e0f3fec972`. Gateway write/read audits and an
independent gateway read confirm the 229-byte `p0-baseline-hn.md`. See evals 007 and 008.

`GET /api/plugins/connections` returned an empty list. Task 2 needs the owner's selected app and
authorization (eval 009), so the full three-task baseline is incomplete. P1 local implementation
was advanced under the user's explicit instruction to progress all three items; the missing
baseline is disclosed, not treated as a success. Evals 010/011 now have deterministic tests plus
live owner-input checks, including mid-work yield and automatic continuation without repeated
browser/file actions. The temporary test routine is paused.

### Connected-app baseline completed

On restoring the API, Notion OAuth was already connected. The built-in connector refreshed 77
tools; General Assistant was granted only `notion-search` and `notion-fetch`. Task 2 now asks for
the last-edited timestamp and child-page reference of a fixed accessible page, with no browser
or writes. Run `6628e571-603c-4cc9-b447-03f0846c852c` made one fetch and returned the correct
metadata and scoped description through Telegram message `39`. Original tool output, independent
gateway read, enforced read audit and outbox state agree (eval 009). Three model requests totalled
18.499 seconds. All three task types now have measured native-ingress runs with Telegram output;
the exact Telegram-ingress exit check in eval 000 remains pending.
