# OpenBot 上游影响分析：首轮固定样本

结论：优先评估 #1159 的普通对话长期目标入口；其余七项暂缓或不在本轮单独处理。
本轮没有发现需要立刻修改本地 Telegram 调度或恢复代码的已核实证据。

## 输入与限制

上游区间：`4d29ad48960474e70cdb7884f794ba9a461c6bb8`（不含）至
`2560040525b268ca9ee0274a67ff03595b4cb138`（含），共八个提交。
本地基线：`6b5a014`，完整 SHA、上游 diff、本地运行代码差异和关键源码见 [input.json](input.json)。
使用本地已有 Git 对象，未查询最新远程状态；这八项不是从 fork 基线以来的全部更新。
未提交的技能和计划文档不纳入代码分析。本轮只读源码，没有运行上游测试、复现桌面问题或执行合并。

## 建议优先跟进：普通对话中的长期目标入口

[e242ca1 / #1159](https://github.com/CopilotKit/openbot/commit/e242ca128339ed90d24b63dd3b86e01fc84bcb90)
将创建、列出、修改、执行、暂停、恢复和完成目标的工具加入 Routines transport，
通过新增的 `server/src/responsibilities/chat-tools.ts` 复用 responsibility 工具，
并从当前连接取得 owner、Bot 和报告会话。

本地 `server/src/plugins/builtin-routines.ts` 的 `listTools()` 仅合并 `TOOLS` 与
`TRIGGER_TOOLS`；`server/src/index.ts` 的 `responsibilityAnswerTurn` 才附加
`responsibilityTools`。这解释了一个值得核实的入口缺口：底层存在持久目标，
普通对话却没有相同的目标管理工具。它直接关系到产品的“用自然语言交代持续委托”。

上游工具说明同时明确：goal 本身没有时间表，需主动执行或由事件唤醒。
因此接入目标工具也不能单独证明“持续盯上游”已经成立。

建议下一步：单独定义普通对话创建与管理持久委托的任务，先验证工具目录中确实可用，
再检查数据库 owner、Bot、channel 与暂停状态。评估与现有 routine 的配合。
不要直接 cherry-pick：本地接口命名为 `create_responsibility` 等，上游适配器查找
`create_goal` 等；本地还修改了 `index.ts` 与 routine runner，须先盘点中间依赖。
本轮没有验证权限链和数据库写入，不据此宣称迁移可用。

## 八项变化的处理决定建议

| 提交与来源 | 源码变化及本地意义 | 建议与具体下一步 |
| --- | --- | --- |
| [b6bced4 / #1155](https://github.com/CopilotKit/openbot/commit/b6bced41a7955521ccdd4ad4a00c5a2eb6704465) | `app/src/lib/manage-paths.ts` 等统一个人版 Activity 与管理版 Audit 名称；改善状态理解，未改变动作审计机制 | 暂缓；个人版界面成为交付入口时一起检查名称，当前不单独移植 |
| [907fb48 / #1153](https://github.com/CopilotKit/openbot/commit/907fb48e060f849e4d8cd7b48996d091221830ba) | `app/src/lib/plugins/tool-result.ts` 等把特定运行时的 unavailable-tool 错误转成可读说明；不增加工具能力 | 暂缓；若 Web 端实际出现这类错误，使用上游 `unoffered-tool-step.test.tsx` 场景验证，再决定移植 |
| [c1d0f67 / #1156](https://github.com/CopilotKit/openbot/commit/c1d0f6786ec4555a5e9511eae9ce5d20ad9b48a8) | `app/src/components/gallery/cards.tsx` 将 tone 转为用户可读 badge；不改变通知触发或去重 | 本轮忽略；后续统一同步上游时保留，无需为影响分析任务单独改卡片 |
| [0aab0d9 / #1157](https://github.com/CopilotKit/openbot/commit/0aab0d966c32f74edd5763fee50b68001ddabee2) | `server/src/activity/activity.ts` 区分按需目标与有事件唤醒的目标，避免将所有 active goal 表示为 scheduled；本地没有 `onDemand` 字段 | 暂缓但关联 #1159；验收持久委托时检查触发依据，避免让用户误以为目标会自动运行 |
| [e242ca1 / #1159](https://github.com/CopilotKit/openbot/commit/e242ca128339ed90d24b63dd3b86e01fc84bcb90) | 普通对话获得目标工具；命中自然语言委托入口，详见上文 | 跟进；先建立工具可用性和身份、会话归属验收，再适配依赖 |
| [35843c9 / #1162](https://github.com/CopilotKit/openbot/commit/35843c925faad79e443c1b7e35aa7ed599024870) | `server/src/agents/profile-store.ts` 比较规范化 URL，`tenant-package.ts` 修复 personal starter 管理归属；本地这两个文件没有 `personalStarter` 逻辑 | 暂缓；采用上游个人版安装器时复验“改名后切 provider”，不声称本地已复现 |
| [0068048 / #1163](https://github.com/CopilotKit/openbot/commit/006804866437d9cac6a183c5eab7f5abb1183c29) | `server/src/tenant-package.ts` 随安装器切 harness 更新 starter 副标题；依赖较新的个人版路径 | 暂缓；与安装器升级一起检查，不影响本轮固定材料分析 |
| [2560040 / #1158](https://github.com/CopilotKit/openbot/commit/2560040525b268ca9ee0274a67ff03595b4cb138) | `desktop/src-tauri/src/app_update.rs` 提供 updatesItself，桌面更新界面据此显示能力；不涉及 Telegram、任务队列或数据分析 | 本轮忽略；发布自有桌面版本时再验证内部 build 的更新提示 |

## 决策反馈与未确定事项

2026-11-14 维护者已采用“优先评估普通对话持久委托入口”的建议，
理由为该入口直接服务自然语言持久委托目标。实现验收见
[eval 013](../../013-conversation-responsibility.md)。

缺少的运行证据包括：上游补丁在本地的依赖兼容性、真实 Bot 工具暴露与身份审计、
目标创建及暂停的数据库结果。它们需要下一项具体实现任务验证。
没有这些证据不能声称已实现持续观察，也不能把本轮源码判断当作运行回归通过。
