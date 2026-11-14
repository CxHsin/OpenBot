# 消息接入与交付

当前使用上游实现。阅读 `server/src/delivery/` 的 routes、router、store 与 transport，
以及[上游架构](../architecture.md)和[审批](../approvals.md)。

核对身份与会话归属、inbox/outbox 去重、失败与投递状态、工具网关及审计。
已移除 fork Telegram、五秒合并与本地 routine 抢占续跑；不要以旧验收推断当前行为。
验证使用当前目录对应的上游测试，数据库准备见[local](local.md)。
