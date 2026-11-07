# Telegram 私聊接入

P0 的 Telegram adapter 使用现有 delivery 的配对码、绑定、inbox、工作队列、outbox 和审计。
私聊文字进入原 owner、Bot、Web channel 和 Intelligence thread，按 `person` 发起同一条
受工具权限与策略约束的 turn。定时任务和其他通知也可通过同一绑定发回 Telegram。

## 本地配置

1. 在 Telegram 打开官方 [BotFather](https://t.me/BotFather)，用 `/newbot` 创建一个 Bot。
2. 将 BotFather 返回的 token 填入仓库根目录已忽略的 `.env`：

   ```dotenv
   TELEGRAM_BOT_TOKEN=
   ```

   等号后填写实际 token，不加 `bot` 前缀。不要把 token 发到会话或写进源码。
   这是 Telegram Bot 的 token，和模型中转密钥不同。
3. 重启 API server。无 token 时 Telegram 保持禁用，不影响 Web；worker 无需改配置。
4. 登录 Web 后，为已有 Bot/channel 请求配对链接。单用户本地开发可用：

   ```powershell
   $pairing = Invoke-RestMethod -Method Post `
     -Uri 'http://127.0.0.1:3001/api/delivery/telegram/start' `
     -ContentType 'application/json' `
     -Body '{"channelId":"你的现有频道 ID","agentId":"general-assistant"}'
   $pairing.url
   ```

   有账户认证的部署需从已登录的会话调用此接口。接口只接受调用者能访问的 Bot/channel，
   不接受自选 owner 或 thread。现有 `slackTeams` 管理能力同样控制 Telegram 配对。
5. 打开返回的 `https://t.me/...?...` 链接，在 Bot 私聊中点击 **Start**。
   配对码十分钟有效且只能用一次。连接确认通过 outbox 投递；后续直接发文字即可。

通过 `GET /api/delivery` 查看绑定与投递状态；用
`DELETE /api/delivery/bindings/:id` 断开。解除绑定或撤销会话访问权会阻止尚未执行的任务与投递。
接收通知仍遵守已有 Bot 通知等级及按类型的路由偏好；配对不会修改这些偏好。

## 本机运行方式

API server 使用 Telegram 官方 `getUpdates` 长轮询，不要求公网回调地址或 tunnel。
同一个 token 只启动一个轮询 API server，且不要同时为它配置 Telegram webhook。
该 P0 版本处理私聊文字；群聊、附件和 Telegram 内原生审批按钮不在本次范围内。
需要审批时，在现有 Web 页面处理。

队列执行的回信会把获准的表格、卡片和图表转换成纯文本，保留字段、数值与来源。
仅在 Web 打开后读取数据的活动报告会提示回到会话查看，不会生成未读取的数字。

同一绑定在第一条消息后的五秒内收到的补充，会按接收顺序合成一次执行、一次回复。
因此单条消息也会多等待最多五秒。该合并只覆盖队列中的 Telegram/native 输入。
在本地单个 API 进程中，人的消息还会使同一会话的 routine 在当前工具完成后让出执行权；
若工具是子任务，会等整个子任务返回。后台续跑沿用原主人的权限和已保存的会话结果。
该调度尚不覆盖 Web 流式输入或跨副本抢占，也不等于 P2 的通用崩溃恢复。

内置 API-key Bot 的后台模型请求会在 audit 中记录 `model.request_completed` / `failed`，
包含 runId、输入/输出 token、缓存读取和耗时；没有上游用量时保留未知。Telegram 仍在
本轮完成后发送最终文本，`firstOutputMs` 不代表手机上看见首字的时间。

收到文字先写持久 inbox 和队列再确认 offset。重启后重放的普通消息由数据库去重。
配对消费后若绑定失败，需重新申请配对码。网络不确定或长回复部分发出时，outbox 记录
`unknown`，沿用现有 delivery 的人工检查规则，不自动重发可能已经发出的内容。
正文按 4096 个 UTF-16 code units 分段，保留 Unicode 字符，按纯文本发送。

## 验证

详细标准在 `evals/004-telegram-transport.md`；真实聊天验收在
`evals/000-baseline-message.md`。本地测试使用独立测试库：

```powershell
$env:TEST_DATABASE_URL = 'postgres://openbot:openbot@localhost:5432/openbot_test'
bun test ./server/src/delivery/telegram.test.ts ./server/src/delivery/telegram.integration.test.ts
```

测试覆盖配对权限、过期码、私聊来源、去重、队列、outbox、断开绑定、撤销访问和审计。
Telegram HTTP 与模型回复在测试中使用 fixture；这些测试通过不代表真实 Telegram 验收通过。

官方协议：[getUpdates](https://core.telegram.org/bots/api#getupdates)、
[sendMessage](https://core.telegram.org/bots/api#sendmessage)、
[私聊深链接](https://core.telegram.org/bots/features#deep-linking)。
