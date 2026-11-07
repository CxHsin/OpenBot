---
id: 003-scheduled-routine
phase: P0
status: green
decides: a routine fires on the normal worker schedule and delivers a Web reply
---

## Spec

Reuse the paused P0 test routine. Through the Bot's granted routine tools, set a daily schedule
a few minutes ahead in `Asia/Shanghai` and a unique reply marker, then enable it. Wait for the
existing worker to offer and dispatch it normally. Do not call run-now, alter next_run_at directly,
change system time, lower the 15-minute frequency floor or widen the Bot's grants.

## Expected

- The stored schedule has a future nextRunAt matching the intended local time.
- Before that time, there is no new firing.
- Exactly one new run has source `schedule` and status `succeeded`.
- The channel contains the unique reply from that firing, without a person sending another turn.
- Pause the test routine afterwards and verify it is disabled.

## Evidence

Record routine/run IDs, due/start/finish times, worker queue dispatch evidence, and the actual
channel reply. This checks one scheduled firing on the local stack; Telegram and broader uptime
or recovery behavior are separate evals.

### Local result, 2026-11-07

- Routine: `routine_b73e2352-8cc7-4ad6-b3e5-080882491851`, owner `dev-local-user`, Bot
  `general-assistant`, channel `channel_de01fd4e-be02-4607-bfc2-16c511b4efda`.
- Configuration: `49 18 * * *`, `Asia/Shanghai`, enabled. Stored due time:
  `2026-11-07T10:49:00.000Z` (18:49 local). At 10:48:42.274Z the database still contained only
  the earlier manual run; there was no queue item for this scheduled firing.
- Exactly one new run: `routine_run_78af92c7-5c24-4653-ae09-27a2ac445b17`, source `schedule`,
  status `succeeded`, no error. Started `10:49:30.095Z`, finished `10:49:40.024Z` (9.929 seconds).
  The 30.095-second start delay is consistent with the worker's normal 30-second sweep.
- Queue: one `routine.fire` item for this routine and scheduled minute, offered at
  `10:49:29.987Z`, dispatch finished `10:49:30.103Z`, attempts 1, no last error. Queue completion
  confirms dispatch; the separate run row above confirms model completion.
- The open Web channel received a new `Routine ran.` entry followed by the standalone paragraph
  `P0_SCHEDULE_20261107_1849_OK`, with no further user turn or page reload.
- Paused through `PUT /api/routines/:id/enabled` after delivery. A database read at
  `10:50:05.997Z` verified `enabled=false` and still exactly one scheduled run.

Evidence is saved locally in `.logs/schedule-evidence-1.txt` (before due),
`.logs/schedule-evidence-2.txt` (completed run, queue and paused state), and
`.logs/schedule-channel-delivery.txt` (Web snapshot). No run-now request or direct schedule-row
write was used in this acceptance.

During setup the model first supplied the channel's display name as `channelId`; the tool refused
it. The model then omitted that optional argument and successfully preserved the existing channel.
This result demonstrates the recovery observed here, not that every routine configuration is reliable.

Repository checks after recording this result: `bun run lint`, `bun run format:check` and
`bun run typecheck` all exited 0. No application code changed for this scheduled acceptance.
