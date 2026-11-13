# 开发计划与任务

## 当前阶段

截至 2026-11-08，此处引用已有验收，没有重新运行现场测试。
P0 已验收；P1 只在已记录的 Telegram/native、单 API 进程范围验收。
统一事件模型、Web 流式与跨副本抢占仍未完成。P2–P6 尚未验收。
历史任务见 [P0/P1 spec](p0-p1.md)，验收入口见 [evals](../../../evals/README.md)。

| Phase | Work | Decided by |
| --- | --- | --- |
| P0 | Stack up, one Bot, one channel, one routine, one real channel (Telegram) | [000-baseline-message.md](../../../evals/000-baseline-message.md) |
| P1 | Event type, dedupe, coalesce, person preempts | [010-coalesce-two-messages.md](../../../evals/010-coalesce-two-messages.md), [011-preempt-running-work.md](../../../evals/011-preempt-running-work.md) |
| P2 | Task journal, resume, cancel, budget | [020-resume-after-crash.md](../../../evals/020-resume-after-crash.md) |
| P3 | `sendToUser` and the five kinds | [030-approval-draft.md](../../../evals/030-approval-draft.md) |
| P4 | Escalation ladder and the rung in the audit row | [040-escalation-rung.md](../../../evals/040-escalation-rung.md) |
| P5 | Commitments extracted from conversation | [050-promise-extraction.md](../../../evals/050-promise-extraction.md) |
| P6 | Every failure becomes an eval; weak/strong model delta measured | the whole suite, plus [README.md](../../../evals/README.md) |


表中的路径以仓库根目录为基准。P2 的 020 仅覆盖恢复，取消和预算须补验收；
其他阶段的示例 eval 也不自动证明该阶段所有行为。按实际范围审视覆盖后再宣布阶段完成。

## 下一步

2026-11-13 确认以“关注 OpenBot 上游，结合本地差异交付影响分析”为首个产品场景。
下一项按[上游影响分析 spec](upstream-impact.md)先验证手动发起的一轮完整交付，
再定义持续观察、处理进度、通知去重与暂停的验收。
[首轮固定材料报告](../../../evals/fixtures/upstream-impact/report.md)已产出，
[eval 012](../../../evals/012-upstream-impact.md)仍为 red，待其余验收。
2026-11-14 已采用普通对话持久委托入口建议，实现与验收见
[conversation responsibilities](conversation-responsibilities.md)。eval 012 的其他未验收项保留。
普通对话入口已通过真实 Bot 工具选择、授权审计、数据库生命周期与一次后台执行验收，
见 [eval 013](../../../evals/013-conversation-responsibility.md) 和
[eval 014](../../../evals/014-responsibility-conversation-lock.md)。
[定时唤醒](scheduled-responsibilities.md)已通过真实自然到点验收，见
[eval 015](../../../evals/015-scheduled-responsibility.md)。
GitHub-only 持续观察已实现，见 [upstream observation](upstream-observation.md) 和
[eval 016](../../../evals/016-upstream-observation.md)：真实 Bot 首轮分析与重复检查静默通过，
每日 Asia/Shanghai 09:00 时间表已启用。离线区间、失败与历史改写由真实 Git fixture 覆盖。
后续按实际报告决定是否同步候选变化；不自动提交、合并或推送。
本轮代码审查、已修复问题及原后续路线表见 [review](upstream-observation-review.md)。
P2 保留为架构待办，按真实委托的中断与恢复要求确定范围，不作为首轮分析的前置项目；
取消、预算与通用恢复仍需各自验收，阶段表不因此改变完成状态。
基线测量以 [baseline](../../../scripts/baseline.md) 为准，历史运行过程见
[开发历史](../../local-development.md)。

## 任务 spec

每次任务至少明确：目标、范围、不做事项、相关约束和复用机制、验收方式与完成条件。
已有 issue/spec 覆盖时直接引用，无需复制。需要仓库内保留时放在本目录，名称描述任务。
纯文档任务说明为何无行为 eval。完成后标明状态与证据链接，当前行为仍以设计和领域文档为准。

开发中按真实失败补回归；重要决定按需写 ADR，不要求每个模块或改动都新增一份文档。
