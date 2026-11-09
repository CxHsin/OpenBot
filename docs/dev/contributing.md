# 协作与交付

适用于人、agent 和自动化。产品范围见 [product](../product.md)，实现上下文见
[开发索引](README.md)，检查步骤见 [verification](verification.md)。

## 工作流程

1. 阅读用户安排或已确认的任务，明确目标、范围、非目标、约束与验收。已有 Issue/spec 足够时直接引用。
2. 发现范围外问题可记录为待分拣事项，不因发现问题自动扩展当前任务。用户明确安排的工作可直接开始，无需等待额外 milestone。
3. 一个任务一个分支；并行会话使用独立 worktree，避免同时改相同文件。命名与生命周期见下文。
4. 修复先复现，实施后运行相关验证，更新受影响领域文档和索引。重要选择写入 ADR，局部行为写领域文档。
5. 按 PR 模板交付。提交、推送、合并与发布遵循用户授权；合并不等于部署或现场验收。

本规范不要求所有小改动先创建 Issue；但独立问题应有可追踪的任务依据。
计划与 spec 的范围和状态见 [plans](plans/README.md)。

## Issue 类型与填写

| 类型 | 模板 | 必要信息 |
| --- | --- | --- |
| 缺陷 | [bug](../../.github/ISSUE_TEMPLATE/bug.md) | 现象、预期、证据等级、失败场景与验收 |
| 功能/改进 | [enhancement](../../.github/ISSUE_TEMPLATE/enhancement.md) | 用户价值、现状、目标、范围和验收 |
| 维护 | [maintenance](../../.github/ISSUE_TEMPLATE/maintenance.md) | 影响、边界、完成条件 |
| 文档 | [docs](../../.github/ISSUE_TEMPLATE/docs.md) | 读者、用途、内容和入口 |
| 重构总项 | [refactor](../../.github/ISSUE_TEMPLATE/refactor.md) | 结构问题、目标边界与子任务 |
| 审查报告 | [review-report](../../.github/ISSUE_TEMPLATE/review-report.md) | 范围、基线、完整发现与可执行子任务 |

标题描述“领域：现象或目标”。重构总项和审查报告不直接承载所有实现；可执行发现拆为子任务，
每项关联验证与进度，子项处理完再关闭总项。需要用户决定时列出选项、推荐、代价、可撤回性和阻塞项。

通过 CLI/API 创建或更新时也先读模板。front matter 用于标题提示与标签，不复制进正文；
删除占位符、模板注释和不适用的可选段落，不虚构结果。模板标签不存在时明确报告，不自行创建别名。

## 标签约定

以下是目标清单，尚未应用到 GitHub。已有标签复用原名；启用 Issues 和创建新标签需作为独立仓库配置动作。

| 分类 | 名称 | 使用条件 |
| --- | --- | --- |
| 主要类型 | `bug`、`enhancement`、`documentation`、`maintenance`、`refactor`、`review-report` | 选一个主要类型；后三项待创建 |
| 待分拣 | `triage` | 新 Issue 默认添加；维护者分拣后移除，不等于已排期 |
| 待决定 | `needs-decision` | 存在明确待决定问题；与 triage 可并存 |
| 受阻 | `blocked` | 说明阻碍与解除条件；解除后移除 |
| 优先级 | `priority:high`、`priority:normal`、`priority:low` | 按影响与紧迫性选择，最多一个；不使用与阶段混淆的 P0–P6 |
| 领域 | 按需增加 `area:<领域>` | 有真实筛选需求再创建，不批量预设 |

high 用于安全、数据完整性、核心流程不可用或阻塞近期目标；normal 为常规已计划工作；low 为可延后的改进。
未分级时可不填。保留已有辅助标签，不新增同义的 `type/bug`、`type:bug` 等变体。

## 证据与公开信息

区分“已复现（环境与方法）”“源码确认”“推测（确认方法）”。定位与验证记录 commit 基线；
公开源码引用使用完整 SHA 的 GitHub permalink，避免 main 移动后证据失效。
记录具体输入/状态、结果与用户影响；日志、截图和样例使用合成或脱敏数据。
不公开密钥、私人对话、个人路径和账户信息。可利用的安全问题不写公开 Issue，先私下告知维护者。

## 分支命名与生命周期

新任务分支采用 `<type>/<issue>-<slug>`；没有 Issue 时省略编号，使用
`<type>/<slug>`。分支名表达工作类型与内容，不包含 agent 或工具名称。

| type | 用途 | 示例 |
| --- | --- | --- |
| `feat` | 新功能与行为增强 | `feat/42-source-watch` |
| `fix` | 缺陷修复 | `fix/43-telegram-dedupe` |
| `refactor` | 保持行为的结构调整 | `refactor/task-runner` |
| `docs` | 文档 | `docs/contribution-guide` |
| `test` | 测试与 eval | `test/crash-recovery` |
| `ci` | CI 配置与检查流程 | `ci/server-shards` |
| `chore` | 依赖、工具及其他维护 | `chore/update-dependencies` |

slug 使用简短的小写英文和连字符，描述改动，不放个人信息、空格或含糊的 `temp`、`fix2`。
编号来自真实 Issue，不虚构编号，也不将 P0–P6 阶段号作为 Issue 编号。

- 独立任务从确认的 main 基线建立分支，记录用于实现与验证的 SHA；不直接在 main 开发。
- 一个分支聚焦一个任务，补充该任务的修复继续用原分支；无关工作另起分支。
- 独立 PR 指向 main。依赖 PR 指向上一层分支，在正文写明依赖与直接 base，只展示本任务 diff。
  上一层合并后更新 base，检查 diff 并验证受影响部分，再合并后续 PR。
- 同步上游作为单独维护任务，不夹带功能改动；目标是本 fork 的 main，不向 upstream/main 直接交付。
- 不改写共享分支历史。确需改写已推送分支时先确认无人依赖，并取得相应授权。
- 合并后确认提交已进入目标分支、无待保存工作，再清理本任务分支和独占 worktree。
  未合并或取消的工作先保留可恢复记录；删除远程分支、清理操作遵循用户授权。

## PR 与提交

模板见 [PR template](../../.github/pull_request_template.md)。PR 标题采用
`<type>(<scope>): <变化>`，scope 可省略，type 与分支表一致，正文可用中文。
例如 `fix(delivery): 避免重复处理 Telegram 消息`、`docs: 明确协作与验证流程`。
标题描述最终行为变化，不用 `update`、`misc` 或“修复一些问题”；合并前随最终范围更新标题与正文。
正文围绕问题、修改与证据展开，小改动简短写，界面改动提供合成数据截图。
完整解决使用 `Closes #N`；部分实现使用 `Refs #N` 并更新剩余范围，无 Issue 时链接任务依据。
独立 PR base 为 main；有依赖时明确 base/依赖，避免混入无关 diff。

手写 commit 标题使用同一格式，每次表达一个可理解的改动；正文解释重要原因，必要时关联 Issue。
Git 自动生成的 merge/revert 提交保留其语义，无需机械改成该格式。
修改上游文件时解释必要性与为何不能用更窄的扩展点。

涉及跨请求状态时说明持久位置、重启后行为、第二进程的具体结果及并发保护。
单进程限制如实写明，不能宣称未验证的多副本支持。动作仍须经过网关，新增拒绝和失败有审计，服务端自行解析可解析的目标。
配置、迁移、状态文件、兼容性和恢复影响按实际列出；无则写无。
用户可见变化更新 CHANGELOG 的 Unreleased，或解释为何部署行为没有变化。

验证正文只写实际命令、结果和范围，记录新增/修改测试、相关 eval，以及未运行项的原因与后续确认方法。
基线比较未执行就明确说明。长期决定不能只留在 Issue/PR 评论或聊天中。
发布说明和部署操作以现有发布文档及用户安排为准，本规范不新增生产分支或自动公告流程。
