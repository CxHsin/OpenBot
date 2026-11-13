# Design: a proactive personal agent on OpenBot

Status: current architecture plus explicitly proposed extensions; upstream baseline `947955a`.

## Reading this design

Product intent and non-goals are in [product](product.md). This document describes system relationships;
local modification constraints are indexed in [dev](dev/README.md), decisions in [decisions](decisions/README.md),
and delivery status in [plans](dev/plans/README.md). Proposed contracts below are not implemented APIs.

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
| Governance | `server/src/computer/gateway.ts`, `server/src/audit.ts` | Every action resolved, decided against a CEL policy, audited, then executed. Fail-closed. |
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

Reuse the existing mechanisms above before introducing another subsystem.

## Design

### Triggers

**Proposed:** a normalized event contract; current P1 uses the existing delivery inbox:

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

**Current:** queued Telegram/native messages share a fixed five-second window. Local person/routine
arbitration yields at a completed tool boundary and resumes through the existing queue and history.
See [messaging](dev/messaging.md) for code, preserved constraints and validation. This does not provide
cross-replica or Web-stream preemption, or general crash recovery.

The envelope matters more than the schema. Mail, chat and webhook payloads are data, never
instructions. `shared/responsibility-turn.ts` already does this with its `Event data:` section; every
new trigger reuses that shape rather than inventing one.

### Work that survives

**Proposed P2, not current behavior.** Current state/queue semantics are in [tasks](dev/tasks.md).

A task is a row plus an ordered journal of steps. Each step writes what it did before the next one
starts. On restart, a claimed task resumes at the first step with no result, not at the beginning.

Two rules from the existing queue carry over unchanged: the lease is renewed by the runner and read
against the database clock, and the journal is append-only so a resumed run can be compared with
what actually happened.

The budget is part of the task row, not a counter in memory: tokens or money, whichever the
deployment sets. A task that reaches it stops and reports; it does not silently keep going.

### One way out

**Proposed P3:** this interface is not yet the shared outbound contract.

```
sendToUser({ kind, text, components?, draft?, dedupeKey })
```

`kind` is `text | card | form | approval-draft | reaction`. The server owns the rendering for each
transport; adding Telegram is one adapter and no change to any Bot. The existing `delivery/*`
outbox, its dedupe keys and its `attention` fold stay the transport underneath.

### The escalation ladder

**Proposed P4:** existing tools provide the rungs; ordering and rung measurement remain unaccepted.

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

## Implementation principles

Reuse model routing with an explicit ambiguous case rather than keyword routing. Avoid hand-written
RAG chunking or per-task bespoke tools unless eval evidence demonstrates a reliability need.
Product scope is defined in [product](product.md). The old “no model selector” wording did not distinguish
UI from runtime selection; do not interpret it as removal of existing provider/model support.

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
