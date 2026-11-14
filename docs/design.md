# 当前设计边界

当前运行代码以已合入的 OpenBot 上游 `2adbd3f0` 为准。
2026-11-14 已按用户决定移除 fork 运行扩展，仅保留 repo harness 与产品目标文档。
这不是新的功能方案；后续开发先理解上游，再决定必要差异。

- 产品意图：[product](product.md)，其中目标不等同于已实现能力。
- 系统结构：[上游架构](architecture.md)。
- Bot 与产品概念：[How OpenBot works](how-openbot-works.md)。
- 后台执行：[Routines](routines.md)，包括 Goals 与 Check-ins。
- 行为边界：[Approvals](approvals.md)，以及服务端工具网关与审计。
- 源码基线与整理范围：[仓库现状](dev/repo-state.md)。

不再使用旧 P0–P6 路线作为开发队列；旧扩展的验收不能证明当前版本行为。
