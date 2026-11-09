# 开发入口

按本次修改选择上下文，无需读完所有文档。

| 任务 | 阅读入口 | 内容 |
| --- | --- | --- |
| 提 Issue、PR 或协作交付 | [contributing](contributing.md) | 模板、证据、标签与交付边界 |
| 配置环境、启动或排障 | [local](local.md) | 独立依赖、测试库、Windows 限制 |
| 选择测试、验证与交付 | [verification](verification.md) | 检查顺序、证据与失败处理 |
| 修改消息接入、合并、抢占或回复 | [messaging](messaging.md) | 身份、inbox/outbox、调度边界 |
| 修改任务状态、队列或恢复 | [tasks](tasks.md) | 事实来源、租约、重试与恢复区别 |
| 修改计算机动作、策略或审计 | [整体设计](../design.md)、[上游架构](../architecture.md) | 同时读 server/src/computer/gateway.ts 的顺序与原因 |
| 开始任务或查找下一步 | [plans](plans/README.md) | 当前阶段与轻量任务 spec |

领域文档记录代码不易表达的流程、约束和原因，引用代码与测试，不复制完整接口。
新增独立流程或重要约束时按需增文档，扩展时优先更新原文；合并、删除模块时同步处理文档和引用。
简单功能可用现有说明或代码注释。索引为新增文档说明阅读时机。
