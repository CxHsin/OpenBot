# 本地开发

安装依赖、启动服务或遇到 Windows 环境失败时阅读。历史测试结果见
[本地开发历史](../local-development.md)，不能替代本次验证。

## 工具和依赖

Bun 安装位置为 `C:\Users\Cx\.bun\bin\bun.exe`，记录时版本为 1.4.4；实际要求以 package.json 与 CI 为准。
新终端会读取安装器更新的用户 PATH，已经打开的 PowerShell 可以临时添加。
根目录及 `agent-bot`、`agent-langgraph`、`agent-computer`、`agent-mastra`、`desktop`
需要分别安装依赖；根目录安装不会覆盖它们。

```powershell
$env:PATH = "$env:USERPROFILE\.bun\bin;$env:PATH"
bun --version
docker info --format '{{.ServerVersion}}'
```

运行前确认 Docker Desktop 可用。`docker --version` 只能证明 CLI 存在，`docker info` 才能验证引擎。

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

Compose 的 Postgres 使用 pgvector。应用库 `openbot` 与测试库 `openbot_test` 分开。
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


## 启动与停止

完整服务使用 Git Bash 或 WSL 执行 `bash scripts/start.sh` / `bash scripts/stop.sh`。
Windows 默认 bash 可能指向 WSL，先确认实际 shell。电脑上使用
`OPENBOT_ONE_COMPUTER_EACH=false` 共享 computer。`bun run dev` 仅启动 app/API，
不等于完整后台执行栈。通用服务与迁移命令见[上游开发说明](../development.md)。
Telegram 配置和长轮询限制见 [Telegram](../telegram.md)。

## 环境失败与验证

验证入口见 [verification](verification.md)。缺独立依赖、数据库、POSIX 路径假设或语言断言
曾导致 Windows 测试失败；具体记录见[历史限制](../local-development.md#剩余测试失败的证据与限制)。
这些是历史诊断，不自动豁免本次失败；先定向复现并判断原因。
