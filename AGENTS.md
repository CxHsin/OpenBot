# AGENTS.md

Working notes for agents and people who change this fork. Upstream has no `AGENTS.md`; everything
here is ours, and every rule names the failure that produced it. Add a rule only after a real
failure, and say which one at the end of the sentence.

## What this fork is

A secondary development of [CopilotKit/OpenBot](https://github.com/CopilotKit/openbot) toward a
proactive personal agent: one that a person can message from anywhere, that works while they are
away, and that comes back only when it has something worth their attention.

**Planning behavior:** read [product](docs/product.md) for goals and scope, then
[design](docs/design.md) and the relevant [decisions](docs/decisions/README.md).
**Changing code:** use [the development index](docs/dev/README.md) to load the relevant constraints.
**Verifying:** follow [verification](docs/dev/verification.md). The [docs index](docs/README.md)
connects these entry points; upstream references remain accurate where we have not changed behavior.
Repo workflows are in `.agents/skills/`: use `nailong-wayfinding` before an unclear or cross-module
task, `nailong-implementation` for a confirmed implementation, and `nailong-delivery` for Issues,
branches, commits, PRs and verification reports. These skills point to the docs above and do not
replace them.

## Hard rules

1. **Maintain the source-bearing baseline.** Runtime source is pinned to upstream
   `6d1919a3b53a0730894258f197f3beb4e8db4f2f`; assess later upstream changes individually and do not
   merge upstream/main wholesale, because merging `f71b0f4b` removed the backend source from this fork.
   `git remote upstream` points at `CopilotKit/openbot`. Prefer a
   new file or a narrow hook over editing a file upstream is actively changing, and keep our code
   inside `examples/nailong/`, `server/src/`, `shared/`, `evals/` and `docs/`. When an upstream file
   must change, change as little as possible and say why in the commit body.
2. **Every action a Bot takes goes through the gateway.** Browser, file, MCP and connector calls are
   decided against policy, audited, and only then executed. Do not call a computer, a connector or a
   transport directly from a tool; that path skips the audit row and the deny rules.
3. **Never widen what a run can do.** A routine, a check-in, a handoff and an unattended turn each
   carry an initiator and run with their owner's grants. A new trigger adopts the initiator and
   grants of whoever created it, and never adds any of its own.
4. **No secrets in the tree.** Keys live in `.env` (ignored), in the credential store, or in the
   deployment environment.
5. **No copy-paste from another product.** The reference checkouts live outside this tree, in
   `D:\Code\nailong-bot-ref\` (`openbot` upstream and `DS-Bot`). `DS-Bot` is Apache-2.0 and is read
   for design, not for code. If code is ever taken from it, record the origin and the notice. Keep
   reference checkouts outside the repository: a nested `biome.json` there breaks every lint run.

## Commands

Run from the repository root. Bun 1.4+ and Docker are prerequisites; `scripts/start.sh` needs a bash
shell (Git Bash or WSL on Windows). For dependency setup, database tests, or a failed Windows test
run, read `docs/dev/local.md` first. It records the verified commands and platform limits.

```sh
bun install
bun run lint          # biome, warnings are errors
bun run format:check  # biome format, no writes
bun run typecheck
bun test <path>       # relevant file or directory; integration tests need TEST_DATABASE_URL
bun run test:server:sharded # broader server sweep, with the test database configured
bun run test:smoke    # needs the stack up

bash scripts/start.sh # app :3010, API :3001, computers, worker
bash scripts/stop.sh
```

Windows notes: `scripts/start.sh` and `scripts/stop.sh` are bash; run them from Git Bash or WSL. For
a laptop, keep `OPENBOT_ONE_COMPUTER_EACH=false` so Bots share one computer instead of one container
each. `bun run dev` starts only the app and API server when Docker is not wanted.

Keep each test run's output in `.logs/` and capture its exit code before formatting the output.
Reproduce failures with a targeted command before repeating a broad sweep. Root `bun install`
does not install the independent Bot/computer/desktop packages; missing these dependencies and a
missing test database caused the initial full-suite failures in this fork.

## How a change is done

A change is done when all of these are true, and not before:

- `bun run lint`, `bun run format:check`, `bun run typecheck` pass.
- `bun test` passes for the packages touched, and a bug fix has a test that fails without it.
- Behavior visible to a person has an entry in `evals/` and that eval moves from red to green, or
  the reason it cannot be an eval is written in the pull request.
- Design and affected domain docs describe the delivered behavior; update their index and links
  when adding, merging or removing modules. Keep proposals distinguishable from current behavior.

**Creating or updating Issues/PRs:** read [CONTRIBUTING.md](CONTRIBUTING.md) and the corresponding
template, including CLI/API use. Shared workflow lives there; verification steps remain in the development guide.

## How we work with agents

- One task per branch. Nothing runs two agents against the same files at once.
- Every task starts from a written spec: goal, scope, non-goals, constraints and acceptance.
  Reuse an existing issue/spec when sufficient; see [plans](docs/dev/plans/README.md).
- A failure becomes a rule here or an eval in `evals/`, not only a patch. A patch fixes today; the
  rule or the eval is what keeps it fixed.
- Do not claim a behavior works from a passing model turn. Read the audit row, the database row, or
  the eval result.
