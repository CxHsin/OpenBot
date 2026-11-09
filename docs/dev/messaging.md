# 消息接入、调度与投递

修改渠道接入、身份绑定、合并、抢占或回复时阅读。
Telegram 配置与传输专有行为以 [Telegram](../telegram.md) 为准，此处说明跨模块关系。

## 流程与入口

Telegram ingress → delivery 持久 inbox/工作队列 → router 执行原 owner/thread 的 turn →
已有工具授权和网关 → outbox 投递。参见 `server/src/delivery/telegram-ingress.ts`、
`store.ts`、`router.ts`，以及 `server/src/scheduling/turns.ts` 与 `routine-work.ts`。

## 必须保留

身份由已有认证配对确定，不能由消息自选 owner/thread；配对不增加工具权限。
inbox 去重与 outbox 的 dedupe/unknown 语义继续由持久层负责。
Telegram/native 合并使用固定五秒窗口，因此单条消息也可能等待最多五秒。
person 对 routine 的让出只在同一 API 进程内、完成工具后的模型边界发生；子任务先整体返回。
不要在有副作用的工具执行中直接中止来实现抢占。

完成结果保存在 Intelligence，续跑沿用原 owner/thread 并重新检查正常准入与授权。
续跑已经开始后发生进程中断会等待检查；这不构成通用崩溃恢复。
Web 流式输入和跨副本抢占不在当前范围。

## 验证

传输测试及失败处理见 [Telegram 验证](../telegram.md#验证)。
合并见 [eval 010](../../evals/010-coalesce-two-messages.md)，抢占与续跑见
[eval 011](../../evals/011-preempt-running-work.md)，其中链接相应可执行回归和现场证据。
