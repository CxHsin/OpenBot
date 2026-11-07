# Design: a proactive personal agent on OpenBot

Status: draft, revised against upstream `947955a`. Supersedes the first draft that assumed
`proactive/` did not exist.

## The goal

One Bot a person can reach from wherever they already are. It works while they are away, keeps
its own long-running work, and comes back only when something is worth their attention. The shape
we are aiming at is the one described in [Always-on agents](https://www.joyehuang.me/blog/20261011---alwaysonagents/post):
triggers on one side, a thick server in the middle, and a computer the Bot can drive on the other.

## What upstream already has

Read these before planning anything. Most of the architecture is here.

| Concern | Where | What it does |
| --- | --- | --- |
| Durable work | `server/src/work/queue.ts` | `for update skip locked` claims with a lease renewed while running; a dead replica's work is reclaimed by the next claim. Clock is the database's. |
| Scheduled work | `server/src/routines/*`, `shared/routine-firing.ts` | Cron with a 15-minute floor, a 20-routine cap per person, a fatigue rule, and missed windows skipped rather than replayed. |
| Standing goals | `server/src/responsibilities/*`, `shared/responsibility-turn.ts` | Event- or schedule-triggered turns with success criteria and recorded progress. |
| Quiet check-ins | `server/src/proactive/*` | Hourly by default, reads only what is new, raises items only when something needs the person, dedupes across Bots, folds every Bot's items into at most one ping an hour. |
| Delivery | `server/src/delivery/*` | Slack, Teams, SMS and push, with outbox rows, dedupe keys, and `reply`/`question`/`approval`/`attention` kinds. |
| An agent's computer | `agent-computer/*`, `supervisor/*` | One container each, own Chromium, own profile, own workspace, egress filter. |
| Governance | `server/src/browser/*`, `server/src/audit/*` | Every action resolved, decided against a CEL policy, audited, then executed. Fail-closed. |
| Attribution | `toolkit/src/initiator.ts` | `person`, `routine`, `responsibility`, `memory`, `handoff`, `deployment`, carried inside a signed run assertion. |
| Routing | `server/src/routing/*` | Turns a message into a coworker, with ambiguity handled explicitly. |

That is the thick middle and the computer. What is missing is at the two ends: what can wake the
Bot, and how its work survives being interrupted.

## The gaps we are filling

1. **Inbound triggers are closed.** The Bot can be woken by a person, a schedule, a check-in and a
   handoff. It cannot be woken by an arbitrary event: a mail arriving, a webhook, a mention in a
   room it is not in, a file changing. Adding one today means adding a transport, not an event.
2. **Conversation scheduling is partial.** Queued Telegram/native messages now merge within five
   seconds, and a person's queued turn can make a routine yield at a completed tool boundary in the
   local API process. Other trigger kinds, Web streaming and cross-replica preemption remain open.
3. **A multi-step task has a state machine but not a resumable journal.** `tasks/state.ts` tracks
   where a task is; a turn that dies mid-way does not resume from its last completed step.
4. **There are four outbound kinds but no single contract.** Each surface renders its own way. A new
   channel is a new renderer, not a new adapter.
5. **There is no escalation ladder.** Nothing tries the cheap, reliable path first and climbs to the
   browser, the desktop, then the person.

Everything else in the Grok Bot shape is present. Do not rebuild it.

## Design

### Triggers

One normalized event enters at the server:

```
Event {
  source: "person" | "schedule" | "checkin" | "webhook" | "mail" | "chat" | "handoff"
  sourceId: string          // stable id at the source, for dedupe
  trust: "owner" | "known" | "untrusted"
  priority: number          // person > handoff > schedule > webhook
  receivedAt: ISO string
  payload: unknown          // always wrapped in an untrusted envelope before a model sees it
}
```

The router does four things, in this order: **dedupe** on `(source, sourceId)`; **coalesce** events
from the same conversation inside a short window into one turn; **preempt** when a `person` event
arrives and a lower-priority turn is running, putting the running work back on the queue rather than
killing it; **decide whether to speak**, which stays where it is today (`ping.ts` owns the hourly
slot and the fold).

The first P1 slice reuses the existing delivery inbox rather than introducing a second event bus.
`delivery/store.ts` claims one fixed five-second Telegram/native window transactionally, keeping
the covered inbox IDs on the leader work row. This adds up to five seconds to a lone queued message.
`scheduling/turns.ts` arbitrates a routine and person in the same owner's thread in one API process.
At the next model boundary, it ends the background model loop without another provider call,
lets completed tool results persist, releases the Intelligence lock, and queues `routine.resume`.
An active subagent settles as one parent tool. Resume uses the existing owner/thread/history,
rechecks normal admission and grants, and does not repeat completed actions. A continuation that
crashed after starting waits for inspection; this is not the general P2 crash recovery design.
No cross-replica interruption or Web-stream preemption is claimed by this slice.

The envelope matters more than the schema. Mail, chat and webhook payloads are data, never
instructions. `shared/responsibility-turn.ts` already does this with its `Event data:` section; every
new trigger reuses that shape rather than inventing one.

### Work that survives

A task is a row plus an ordered journal of steps. Each step writes what it did before the next one
starts. On restart, a claimed task resumes at the first step with no result, not at the beginning.

Two rules from the existing queue carry over unchanged: the lease is renewed by the runner and read
against the database clock, and the journal is append-only so a resumed run can be compared with
what actually happened.

The budget is part of the task row, not a counter in memory: tokens or money, whichever the
deployment sets. A task that reaches it stops and reports; it does not silently keep going.

### One way out

```
sendToUser({ kind, text, components?, draft?, dedupeKey })
```

`kind` is `text | card | form | approval-draft | reaction`. The server owns the rendering for each
transport; adding Telegram is one adapter and no change to any Bot. The existing `delivery/*`
outbox, its dedupe keys and its `attention` fold stay the transport underneath.

### The escalation ladder

Cheapest first, and stop at the first rung that answers:

1. known context in the conversation
2. a connector or MCP tool
3. web search
4. the browser on the Bot's computer
5. the full desktop
6. ask the person

This is guidance to the model plus a small amount of tool metadata, not a hand-written router. The
rungs are already built; what is missing is telling the model the order and auditing which rung a
run stopped on, so the ladder can be evaluated rather than assumed.

## What we deliberately do not build

Checked against "if the model were smart enough, would this code still be needed":

- no model selector, no Ask/Plan/Agent modes
- no keyword intent router; routing stays a model decision with an explicit ambiguous case
- no hand-written RAG chunking
- no per-task bespoke tools, unless an eval shows the win is reliability rather than intelligence
- no notification preferences UI beyond a budget and a quiet-hours switch

## Risks

- **Relay Responses storage may be incomplete.** A relay accepted tool calls but failed when the
  SDK referenced prior commentary by item ID. `OPENBOT_OPENAI_STATELESS=true` explicitly selects
  complete input replay (`store: false`) for API-key OpenAI Bots. Intelligence remains the durable
  conversation store, and tool execution still passes through the same grants and audit gateway.
- **CopilotKit Intelligence is an external dependency.** Threads and memory live there, and local
  self-hosting is a 30-day licence. Replacing it with Postgres plus pgvector is a later decision, and
  a good exercise, but not before the baseline exists. See `docs/decisions/`.
- **Upstream moves fast.** `main` changed on the day this fork was cut. Narrow hooks and a weekly
  `git merge upstream/main` keep the cost of divergence visible.
- **Windows.** The supervisor needs the Docker socket, and one container per Bot is heavy. Shared
  computer mode until there is a second person.

## Plan

P0 Telegram implementation: `server/src/delivery/telegram*.ts` adds private text over one local
long-polling API server. Authenticated delivery challenges bind the Telegram identity to an existing
owner/Bot/channel/thread. Incoming text uses the existing inbox and leased queue; replies and
scheduled notifications use the existing outbox, routing preferences and audit. Telegram inherits
the existing chat-connection capability; it adds no tool grants. No Telegram-native approval buttons
or multi-replica polling are implemented. Queued turn replies render allowed display components as
plain text before outbox delivery. Headless navigation refused for a required handback snapshot
returns that observation in the same tool result; the model decides again before another action.
Setup and limits are in `docs/telegram.md`. Real private-chat transport and a fresh complete automatic
reply have been verified. Built-in API-key headless requests now record provider input/output/cache
usage and elapsed/first-output time in audit, alongside the existing model-selection ledger. The
browser/file baseline also passed through authenticated native input and real Telegram output.
The Notion OAuth task passes using the owner's connection and read-only grants. The exact eval 000
Telegram-originated input also passes with browser results, complete delivery and same-turn usage:
110,443 tokens and 39.468 seconds from durable receipt to Telegram acceptance. P0's exit criterion
is green; historical usage remains unknown.
See evals 007–011 and `scripts/baseline.md` for measured scope and local P1 acceptance.

Each phase has one eval that decides it. A phase is not done until that eval is green.

| Phase | Work | Decided by |
| --- | --- | --- |
| P0 | Stack up, one Bot, one channel, one routine, one real channel (Telegram) | `evals/000-baseline-message.md` |
| P1 | Event type, dedupe, coalesce, person preempts | `evals/010-coalesce-two-messages.md`, `evals/011-preempt-running-work.md` |
| P2 | Task journal, resume, cancel, budget | `evals/020-resume-after-crash.md` |
| P3 | `sendToUser` and the five kinds | `evals/030-approval-draft.md` |
| P4 | Escalation ladder and the rung in the audit row | `evals/040-escalation-rung.md` |
| P5 | Commitments extracted from conversation | `evals/050-promise-extraction.md` |
| P6 | Every failure becomes an eval; weak/strong model delta measured | the whole suite, plus `evals/README.md` |

## Baseline numbers

Fill `scripts/baseline.md` before P1. Four numbers, measured on the same three tasks: success rate,
tokens per task, cache hit rate, and how many times a person had to intervene. Without them, every
later "delete the scaffolding" decision is a guess.
