# 本地开发与验证

本机为 Windows，仓库是 `D:\Code\nailong-bot`，上游基点为 `947955a`。
开发环境与验证基线已准备好；应用启动进度见下方。
日志在被 Git 忽略的 `.logs/` 中。下方测试结果均来自当前本机运行，不代表全仓库测试通过。

## P0 启动进度（2026-11-07）

- CopilotKit CLI 登录成功；已创建并选择 `nailong-bot` 项目，项目密钥保存在根目录 `.env`。
  服务端通过 `--env-file=../.env` 读取它，无需向每个子包复制密钥。
- `openbot` Learning 容器已创建并自动分配；运行时 `/api/copilotkit/info`
  返回 `licenseStatus: valid`、`mode: intelligence`，注册了 `general-assistant` 和 `knowledge`。
- 应用数据库迁移完成，Web 在 `http://127.0.0.1:3010` 显示欢迎界面，API 在 3001。
- `agent-computer` 镜像构建成功，4100 端口的 `/health` 返回 200；routine worker
  已启动并完成一次空队列巡检。此前 Chromium 下载中断未在本次构建重现。
- 内置 Bot 的本地环境覆盖已配置 `OPENAI_BASE_URL=https://newapi.xinghengcode.shop/v1`、
  `BOT_PROVIDER=openai`、`BOT_MODEL=gpt-6.1-sol`、`COPILOTKIT_OPENAI_API=responses`、
  `OPENBOT_OPENAI_STATELESS=true`；
  管理 API 报告 `builtInModel: openai/gpt-6.1-sol`。模型名称来自该令牌的 `/v1/models`，
  用户最初提供的 `gpt6.1sol` 不在列表中。上游 tenant 包默认模型保持原样。
- 用户在 Web 凭据库轮换中转令牌后鉴权通过，聊天实际返回“连接成功”。密钥无需写入 `.env`。
- Bot 实际打开 `https://example.com` 并返回标题 `Example Domain` 及正文首句。
  导航审计行 `b283d2ae-1bfd-47b5-a957-c9b6a25fbb0f` 记录 `person` 发起、策略允许并执行。
  首次导航遇到 handback 后需重新 snapshot 的错误，后续导航和读取成功。
- 已启用内置 Routines 插件，仅授予 General Assistant `list_routines`、`create_routine`、
  `update_routine`。实际创建 `routine_b73e2352-8cc7-4ad6-b3e5-080882491851`，
  时区 Asia/Shanghai，每天 09:00；通过官方 run-now 路由触发，运行
  `routine_run_2ec37e33-de55-4fa4-9f8c-4a4e24cfe1ba` 在 09:54:21–09:54:31 UTC
  完成，状态 `succeeded`，频道实际出现“P0 routine 验收成功”。测试后已暂停。
  这验证手动触发的 headless 执行和回信，不代表已验证定时到点触发。
- Responses 续轮兼容问题已通过显式配置解决：模型先说进度、再调用工具时，SDK 默认用
  `item_reference` 引用之前的文本；中转对这类引用返回 `Missing required parameter: input[n].id`，
  尽管请求里存在 ID。`OPENBOT_OPENAI_STATELESS=true` 让 API-key OpenAI Bot 设置
  `providerOptions.openai.store=false`，由 SDK 在续轮重发完整输入，不伪造 ID 或删除历史。
  Intelligence 的持久会话不受此模型侧存储选项影响。未启用时保留上游默认行为。
- 连续工具调用的回归已从红转绿；Web 现有会话也完成“进度说明 → 查询 → 续轮复核 → 最终回复”。
  三条查询审计记录均为 `person`、策略允许并执行；测试任务仍暂停，详见
  `evals/002-relay-tool-continuation.md`。本轮相关测试 97 pass / 0 fail。
  原有 `openai-compatible-endpoint.test.ts` 的 beforeAll 在 Windows 用 URL pathname 产生
  `\\D:\\...` 夹具路径而无法加载，未纳入这 97 项，也未顺手修改。
- Chat Completions 的流式工具片段仍返回空字符串 `type`，被 SDK 拒绝；本次未修复它，
  应用继续使用 Responses。两个独立框架示例 Bot 容器仍缺环境密钥；
  定时到点触发后来已通过，见 `evals/003-scheduled-routine.md`；Telegram 与完整产品基线
  尚未验收。旧失败日志保存在 `.logs/`。
- `.copilotkit/` 是本地 CLI 项目选择状态，已忽略；账户登录信息和密钥不进入版本控制。

当前源码服务通过终端会话运行，终端结束或重启机器后需要重新启动。

## 工具和依赖

Bun 安装位置为 `C:\Users\Cx\.bun\bin\bun.exe`，当前版本 1.4.4；上游 CI 固定 1.4.3。
新终端会读取安装器更新的用户 PATH，已经打开的 PowerShell 可以临时添加。
根目录及 `agent-bot`、`agent-langgraph`、`agent-computer`、`agent-mastra`、`desktop`
的依赖现均已安装，安装日志为 `.logs/install-<package>.log`。

```powershell
$env:PATH = "$env:USERPROFILE\.bun\bin;$env:PATH"
bun --version
docker info --format '{{.ServerVersion}}'
```

Docker Desktop 当前可用。`docker --version` 只能证明 CLI 存在，`docker info` 才能验证引擎。

根目录以外还有独立包。按上游 `.github/workflows/ci.yml` 安装它们：

```powershell
bun install --frozen-lockfile
foreach ($packageDirectory in @('agent-bot', 'agent-langgraph', 'agent-computer', 'desktop')) {
    Push-Location -LiteralPath $packageDirectory
    try {
        bun install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { throw "Install failed: $packageDirectory" }
    } finally {
        Pop-Location
    }
}
Push-Location -LiteralPath agent-mastra
try { bun install } finally { Pop-Location }
```

`agent-mastra` 没有提交 lockfile，上游 CI 也单独使用 `bun install`。
根目录 workspaces 不包含上述独立包。只安装根依赖会使测试在导入时就报缺模块，
例如 `@ag-ui/encoder`、`web-bot-auth` 和 `react/jsx-dev-runtime`。

## 专用测试数据库

Compose 的 Postgres 已启动，包含 pgvector。应用库 `openbot` 与测试库 `openbot_test` 分开。
以下建库命令仅首次需要；若已有测试库，直接配置地址和执行迁移。

```powershell
docker compose up -d --wait postgres
$databaseContainer = docker compose ps -q postgres
docker exec $databaseContainer psql -U openbot -d openbot -c 'CREATE DATABASE openbot_test;'
docker exec $databaseContainer psql -U openbot -d openbot_test -c 'CREATE EXTENSION IF NOT EXISTS vector;'
```

每个新终端都需要设置测试地址。迁移命令临时使用 `DATABASE_URL`，结束后恢复原值：

```powershell
$env:TEST_DATABASE_URL = 'postgres://openbot:openbot@localhost:5432/openbot_test'
$savedDatabaseUrl = $env:DATABASE_URL
try {
    $env:DATABASE_URL = $env:TEST_DATABASE_URL
    bun run --filter server db:migrate
    if ($LASTEXITCODE -ne 0) { throw 'Test database migration failed' }
} finally {
    $env:DATABASE_URL = $savedDatabaseUrl
}
```

这套地址来自仓库的本地 Compose 默认值。运行集成测试前确认 Docker 引擎和库可连接。
测试拒绝使用应用库；不能通过切换到应用库来规避连接错误。

## 已验证的开发基线

已有的静态检查均通过：`bun run lint`、`bun run format:check`、`bun run typecheck`。

与当前架构相关的核心测试：213 pass、0 fail，11 个文件，约 10 秒。
日志：`.logs/core-baseline.log`。

```powershell
bun test `
  ./server/tests/proactive.test.ts `
  ./server/tests/proactive-store.integration.test.ts `
  ./server/tests/proactive-check-in.integration.test.ts `
  ./server/tests/routines-store.integration.test.ts `
  ./server/tests/tasks.integration.test.ts `
  ./server/tests/tasks-state.test.ts `
  ./server/tests/responsibilities-engine.test.ts `
  ./server/tests/responsibility-triggers.test.ts `
  ./server/tests/delivery-router.test.ts `
  ./server/tests/delivery-store.integration.test.ts `
  ./server/tests/work-queue.integration.test.ts
```

共享库、运行时和 worker，以及依赖补齐后的代表用例：348 pass、0 fail，31 个文件，约 3 秒。
日志：`.logs/runtime-portable.log`。

```powershell
bun test ./shared ./toolkit ./worker `
  ./tests/agent-bot.test.ts `
  ./agent-langgraph/tests/history.test.ts `
  ./agent-langgraph/tests/google-oauth-proxy.test.ts `
  ./agent-computer/tests/web-bot-auth.test.ts
```

补齐独立依赖后的桌面包测试为 150 pass、0 fail，4 个文件，约 19 秒。
命令为 `bun test ./desktop/src`，日志为 `.logs/desktop-baseline.log`。

这是明确限定范围的可用基线。更广的测试仍有失败；Web 局部验收结果见 `evals/001-web-stack.md`，
完整 P0 与其余功能验收场景尚未通过。
`scripts/baseline.md` 中的模型成功率、token 与缓存等指标仍待真实应用跑通后测量。

## 剩余测试失败的证据与限制

| 分类 | 证据 | 当前处理 |
| --- | --- | --- |
| 独立依赖缺失 | `tests/agent-bot.test.ts` 原来 3 fail，安装 `agent-bot` 依赖后 3 pass；LangGraph 和 Web Bot Auth 的代表用例也已通过 | 补齐独立包依赖，按包验证 |
| 本地语言与英文断言冲突 | `app-resilience-guards.test.ts` 期待 `/second/`，实际为 `30秒钟前`；另有 access-requests、check-in-row 的相同症状 | 记录为测试语言假设；本机设置 LANG/LC_ALL 后 Intl 默认仍为 zh-CN |
| POSIX/Linux 假设 | CLI 发现测试在 `.npm/_npx` 建夹具，实际代码在 Windows 使用 `AppData/Local/npm-cache`；有测试使用 `/dev/null`、Unix socket、Linux launcher 和 POSIX PATH | 这些用例需要适配 Windows，或在上游 Ubuntu CI 环境复核 |
| Shell 选择与夹具路径 | 默认 `bash` 指向 Windows 的 WSL 启动器；显式改用 Git Bash 后启动脚本测试仍有超时 | Git Bash 的存在不代表所有脚本夹具都兼容；不将超时判成业务 bug |
| 服务端断言扫描的路径假设 | `assertion-shape.test.ts` 独立运行仍为 3 pass、10 fail；断言期待 `clean/fixed.ts`，实际为 `clean\fixed.ts`，固定 allow-list 也使用 `/` | 已定位到测试扫描器的 Windows 路径差异；未修改上游工具 |
| Arcade 集成用例在组合中超时 | 分片中有 3 个失败，但该文件独立运行 18 pass、0 fail，约 44 秒 | 独立不能复现，仍需区分负载、测试顺序及状态干扰；不将它判为已修复 |
| 服务端广泛扫描 | 第 1 片 785 pass；第 2 片 820 pass、12 skip、13 fail，后续扫描已停止 | 全量结论未确认，优先使用上述相关模块基线 |
| Linux 浏览器配置 | `person-browser-rules.test.ts` 有 2 个 Windows 下失败用例，分别涉及 Linux launcher 和密码管理器 manifest | 不包含在上述跨平台运行时基线中；保留原始失败日志 |

诊断日志：`diagnostic-representatives.log`、`diagnostic-platform.log`、
`runtime-baseline.log`、`server-sharded.log`。后续定向复现结果在 `arcade-isolated.log`
与 `assertion-isolated.log`。不要把日志里应用主动打印的 `error:` 自动计为测试失败；
需读取最终统计、失败用例及进程退出码。

## 扩大验证范围

改动后先运行相关文件；需要服务端全面扫描时使用上游分片入口：

```powershell
New-Item -ItemType Directory -Path .logs -Force | Out-Null
bun run test:server:sharded *> .logs/server-sharded.log
$testExitCode = $LASTEXITCODE
Get-Content -LiteralPath .logs/server-sharded.log -Tail 25
Write-Output "Test exit code: $testExitCode"
```

分片工具会在每片结束后输出整片日志，期间没有输出不等于测试停止。
遇到长期未结束的片段，先保留日志、确认进程状态，再缩小范围。
完整根目录测试与浏览器集成测试范围更广，不能用它们代替相关模块的快速反馈。

## 下一步：完整 P0

账户连接和模型凭据已配置，Web 聊天、浏览器读取、audit 与一次 routine 手动执行已验证。
Responses 连续工具调用与一次自然定时触发已验证，接下来补齐完整基线。
Telegram 私聊 adapter 已接入原 delivery 链路，配置步骤见 `docs/telegram.md`。
用户已填写 `TELEGRAM_BOT_TOKEN` 并完成真实私聊配对；令牌保留在已忽略的环境文件中。
接入相关 9 个文件的回归为 88 pass、0 fail；lint、format:check、typecheck 均通过。
API 已重启加载代码，Web 与 delivery 返回 200，未配置 token 的 Telegram 正常保持禁用。
之后的真实 HN 消息成功执行浏览器操作并回到 Telegram，但首次回信漏掉表格内容。
已补上队列回信的组件纯文本呈现，核对原始网页读取记录后经 outbox 补发标题，用户确认收到。
原始回信耗时 33.378 秒；补发包含现场修复时间，不能计作正常响应速度。
还将 handback 后导航拒绝所需的新快照并入同一次工具结果，减少一次单独请求快照的模型往返；
不自动重试导航，也不改变策略或人工控制规则。实际提速需下一次可比请求测量。
证据见 `evals/004-telegram-transport.md` 至 `006-handback-navigation-latency.md`。
Token/cache 用量仍无真实记录，完整 P0 的 eval 000 保持红色。

后续同题真实复测：北京时间 20:33:38.324 入站，20:34:05.395 获 Telegram 接受，
耗时 27.071 秒；三条标题完整、顺序与该次浏览器结果一致，队列各执行一次、无需人工补发。
相对首次 33.378 秒少 6.307 秒，但只有一次样本，且本次未触发 handback，不能归因于单个改动。

2026-11-07 的定时验收复用原测试 routine：计划北京时间 18:49，正常 worker 在
18:49:30.095 启动，18:49:40.024 完成。数据库仅新增一次 `source=schedule`、
`status=succeeded` 的执行，队列 dispatch 一次且无错误，Web 频道无需新消息即收到
`P0_SCHEDULE_20261107_1849_OK`。验收后已暂停任务并读取数据库确认。
详细证据见 `evals/003-scheduled-routine.md`；这只确认本地一次定时触发。

## 用量与本地 P1 调度验收（2026-11-07）

实际中转的 token/cache 数据已通过 SDK 模型层观察并写入 audit，模型选择仍写原有
`model_usage`。三次模型请求的 HN 复测用量为 58,117 token，缓存读取率 96.63%，
入站到 Telegram 接受 36.225 秒；新消息合并窗口占用最多五秒，不作稳定提速承诺。
浏览器 → 写文件 → 读回 → Telegram 的实测为 105,267 token、55.335 秒；
子任务原始工具结果、文件内容和网关审计已独立核对，见 evals 007/008。
这些新请求经已认证 native API 入站，再由真实 Telegram outbox 回信；不冒充 Telegram 入站。

连接列表为空，已连接应用基线保持 blocked（eval 009）。精确的 Telegram 入站加同轮用量
验收仍待下一条真实消息（eval 000），完整 P0 尚未结束。

P1 当前覆盖同一绑定五秒内 Telegram/native 文字合并、单 API 进程内 person 对 routine
的协作式抢占、以及持久队列自动续跑。完成的工具结果保留在 Intelligence；不在执行中
取消可能有副作用的工具。子任务作为一个父工具完成后再让出执行。若续跑进程中断，
记录 waiting，避免重放不确定的操作。跨副本、Web 流式输入和其他后台触发源尚未覆盖。

首次真实续跑发现继承的调度上下文进入子任务，以及过长的续跑 runId 被锁接口拒绝。
修复后真实 SDK 回归确认工具结果已发送并保留；续跑使用新 UUID。最终中途插话验收
run `routine_run_79217441-a55b-46c6-97f5-ad8f6dac9567` 先响应人，再自动续跑为 succeeded，
续跑后无重复浏览器/文件动作。临时 routine `routine_b50602e9-38bb-40e7-beab-4129b5493085`
已暂停，原 P0 测试 routine 也保持暂停。证据见 evals 010/011。

相关 20 个文件共 253 pass / 0 fail，lint、format:check、typecheck 均通过。
日志 `.logs/next-final-tests.log`、`.logs/next-lint.log`、`.logs/next-format.log`、
`.logs/next-typecheck-all.log`。不代表全仓库测试通过。

## 恢复服务与 P0 收尾（2026-11-07）

恢复时 Postgres 和 agent-computer 容器仍健康；API、Web 和 worker 已重新启动。
API 从 `server/` 运行 `bun --env-file=../.env src/production-entry.ts`，Web 从 `app/`
运行 `bun run dev --host 127.0.0.1 --port 3010`。worker 从根目录运行前必须设置
`SERVER_INTERNAL_URL=http://127.0.0.1:3001`，再执行
`bun --env-file=.env worker/src/index.ts`；根 `.env` 不保证包含这个启动脚本注入的变量。
这次首次 worker 启动因缺该变量退出，补齐后巡检报告 idle，considered=0，无待触发任务。
本机只运行一个 Telegram 轮询 API；服务进程均需在退出或重启后重新检查。

Notion OAuth 已有有效个人连接，刷新返回 77 个工具。仅向 General Assistant 授予
`notion-search` 与 `notion-fetch`。真实 native 入站任务经网关读取页面并通过 Telegram
消息 `39` 回信，原始结果、读取审计、用量与投递均核对通过，eval 009 已绿。
精确 Telegram 入站 + 同轮工具 + 完整回信 + usage 的 eval 000 仍等待真实用户消息。
API 日志仍报告部分 Intelligence entitlement/memory/personal-skills 不可用；这次读取任务
能完成，不代表这些附加能力已恢复。

本次验证：原相关 20 个文件 253 pass / 0 fail；补充 lifecycle 与 copilot 5 个文件
142 pass / 0 fail。lint、format:check、typecheck 全部通过。日志在
`.logs/p0-closeout-tests.log`、`.logs/p0-closeout-additional-tests.log` 和
`.logs/p0-closeout-{lint,format,typecheck}.log`。没有重复全仓已知平台失败用例。

刷新 upstream/main 后发现基点落后 170 个提交，最新引用为 `2560040`，与入口、copilot、
delivery router、routine runner、subagent 均有重叠。先保存当前验收成果，再独立处理合并；
本次没有将未验证的上游变动带入运行环境。

随后真实 Telegram 入站验收已完成：run `f5cf08c1-81ba-4dca-8f60-960b3fa7ea8d`
的浏览器原始结果、表格与完整回信一致，Telegram 消息 `41` 投递成功；四次模型请求共
110,443 tokens，缓存读取率 73.85%，持久入站到 Telegram 接受耗时 39.468 秒。
没有人工修复或补发。eval 000 已转绿，P0 退出条件通过；上面的等待记录为此前状态。
