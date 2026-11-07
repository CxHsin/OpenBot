# 1. Build on OpenBot, read DS-Bot for product decisions

Date: 2026-11-03

## Context

Two candidate bases, both recent and both shaped like a team of long-lived Bots.

`Fei2411/DS-Bot` is a plugin for DeepSeek Harness. It has the better product design: long-lived
Bot identities, Markdown memory in three scopes, group chats with turn-taking and `@` handoff, a
context steward that checkpoints a long conversation, and `show_view` cards. Its own `AGENTS.md`
forbids patching DSH, and every Bot runs inside a DSH session, so the agent loop belongs to the
host.

`CopilotKit/openbot` is a standalone deployment: Bun and Hono server, React app, PostgreSQL,
AG-UI agents, one computer container per Bot, a policy gateway in front of every action, a durable
work queue with leases, routines, responsibilities, proactive check-ins, and delivery to Slack,
Teams, SMS and push. It is MIT licensed and says in its README that it is a template to be cloned
and changed.

## Decision

OpenBot is the base. DS-Bot stays in `_ref/` as a reference for product decisions, not code.

## Why

- A proactive agent needs a loop that is not owned by a session manager. OpenBot's loop is ours;
  DS-Bot's is DSH's, and its hard rule is not to patch it.
- The expensive half of this system is governance and durability, not chat UI. OpenBot already has
  the gateway, the audit trail, the initiator attribution and the leased work queue.
- Merging the two is a rewrite in disguise: a DSH plugin and a Bun/Hono deployment share no runtime.

## What we take from DS-Bot anyway

Identity and role framing, the Markdown memory layout and its scopes, the group-chat turn rules,
the steward's checkpoint-versus-handoff distinction, and the card vocabulary. Each is a product
judgment we can implement against OpenBot's stores.

## Consequences

- We depend on CopilotKit Intelligence until we replace it. That is the next decision to make, and
  it should be made on evidence from the P0 baseline, not in advance.
- Upstream moves quickly. Divergence is kept narrow and measured by a weekly merge.
- Windows development is heavier than on macOS or Linux because of Docker and the supervisor.
