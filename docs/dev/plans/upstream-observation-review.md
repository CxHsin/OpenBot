# 持续委托推送前审查

基线：`6b5a0143c467a4ca391726329367b668978ac585`；目标为当前工作区的普通对话持久委托、
会话调度、定时关联与 GitHub 观察改动，包含新增文件。两份已有技能文件修改不在推送范围。
任务依据为 conversation-responsibilities、scheduled-responsibilities、upstream-observation spec，
约束采用 AGENTS、产品/设计与开发指南。未同步或合并 upstream。

## 已复现并修复

1. **大补丁导致观察永久阻断。** 原采集器对上游与 fork 合计补丁大于 500KB 一律拒绝，
   但接口没有指定终点或分页参数。fork 自身差异超限时，即使上游 unchanged 也失败。
   移除固定拒绝，继续写工作区 JSON 并分段读取。真实 Git fixture 现在覆盖大 fork 差异
   与大上游补查区间，确保完整末尾内容可读。
2. **通知入队失败丢失报告。** 原 engine 先结算成功并推进游标，再调用 onReply；onReply
   抛错只被写入返回报告，工作项仍结束。下轮可能在新游标处判为无变化，漏发重要结果。
   notify=true 的检查改为先交给既有通知入口，失败则结算 failed 并保留旧游标。
   普通非检查职责的行为保持兼容；成功入队不被解释为外部用户已经收到。

定向复现日志 `.logs/push-review-red.log` 中两项均失败；修复后的
`.logs/push-review-green.log` 中两项通过。回归分别在
`server/tests/upstream-observer.test.ts`、`server/tests/responsibilities-engine.test.ts`；
行为验收记录在 eval 016。完整检查输出采用 `.logs/push-review-` 前缀。
最终相关检查为 190 项测试、821 项断言、13 个文件全部通过；lint、format:check、typecheck
退出码均为 0。上述结果记录于审查完成时；提交与推送状态以 Git 历史为准。

## 保留的边界

入队与成功结算不是一个事务。部分通知入队后发生失败，或入队后结算前进程中断，仍需核对已产生
的效果；本任务不实现通用步骤 journal，也不承诺跨轮 exactly-once 通知。外部投递继续由现有
outbox 处理。当前会话串行仅限单 API 进程；未宣称跨副本抢占和通用恢复已经完成。

没有重新执行真实模型现场验收来证明这两种注入失败；修复依据为可重复的 Git 与 engine 回归。
原 eval 013–016 的现场证据保留其原有范围。

## 原路线图中的后续计划

来源为 [开发计划](README.md) 与 [design](../../design.md)，不是本次新增排期：

| 阶段 | 当初计划 | 当前剩余 |
| --- | --- | --- |
| P1 | 统一事件、去重、消息合并、用户抢占 | Telegram/native 单进程已验收；统一事件模型、Web 流式与跨副本抢占未完成 |
| P2 | 步骤 journal、恢复、取消、预算 | 尚未整体实现/验收；本次成功游标不等于通用恢复 |
| P3 | 统一 sendToUser，支持 text/card/form/approval-draft/reaction | 既有 delivery 可复用，统一契约仍待实现/验收 |
| P4 | 逐级使用已有上下文、连接器、搜索、浏览器、桌面、最后问人，并记录所用层级 | 工具已有，选择顺序与审计测量待验收 |
| P5 | 从对话中提取承诺，转为持续工作 | 显式职责入口已完成，自动提取仍待验收 |
| P6 | 真实失败转 eval，比较弱/强模型的效果 | 已有回归与 eval；系统性模型对照测量仍待完成 |

后续产品顺序已按用户选择调整为先跑通上游观察、核验报告价值，再按实际中断与行动需求选择
P2 等架构任务，不把原阶段表机械视为必须按顺序完成的清单。
