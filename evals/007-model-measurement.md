---
id: 007-model-measurement
phase: P0
status: green
decides: actual provider usage and per-request timing are durably attributable to a headless turn
---

Run a built-in Bot through a tool continuation. Record each model request's elapsed milliseconds,
input/output tokens and cache reads, tied to owner, thread, run and initiator. Sum requests once.
Unknown provider usage remains null rather than zero. Do not record prompts or credentials.
Assert model errors preserve the original error and partial usage is not presented as a complete
turn total. Check database audit rows on the live baseline, not only the model's final answer.

## Result, 2026-11-07

The actual SDK continuation test initially executed three model requests but recorded zero usage
rows (`.logs/model-measurement-red.log`). Wrapping the runtime's resolved V3 model now observes its
normalized usage and preserves the response stream. Three requests record three independent usage
values; missing usage remains null. Cancellation/incomplete streams do not acquire invented totals.

The authenticated native delivery API was used to submit two owner-authorized baseline tasks into
the existing channel. Replies used the real Telegram outbox. These are not new Telegram-originated
inputs. Both runs have one model-selection row and request metrics in audit:

| Task / run | Requests | Input | Output | Cache reads | Model request time | Receipt to Telegram acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| HN `dd4b9d8e-f9f8-43d2-b08c-56ff655fcc2c` | 3 | 57,885 | 232 | 55,936 | 16.659 s | 36.225 s |
| Browser/file `dc792760-82ab-4f4d-accb-a8beb526aba0` | 8 | 104,211 | 1,056 | 91,392 | 37.488 s | 55.335 s |

The second total includes the inline subagent's requests, attributed to the enclosing measured task.
These are provider-reported values, not estimates or monetary billing. `firstOutputMs` measures the
first provider text/reasoning/tool output, not the first visible Telegram token. Queued Telegram
answers are delivered after the turn completes. The HN sample includes the five-second coalescing
window. Remaining wall time includes initialization, tools, persistence and delivery; it is not all
browser time. Historical 27.071-second runs cannot be retroactively assigned usage.

Evidence: `.logs/baseline-dd4b9d8e-f9f8-43d2-b08c-56ff655fcc2c.txt`,
`.logs/baseline-dc792760-82ab-4f4d-accb-a8beb526aba0.txt`.
