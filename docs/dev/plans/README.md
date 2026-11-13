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

本次[文档基础整理](repo-harness.md)完成后，下一项为 P2 的有界任务 spec：盘点现有任务、队列与历史，
定义可恢复步骤及不确定副作用处理，确定验收后实现。取消、预算可分后续任务。
新的“持续盯 source”产品主线尚需具体 source 和任务范围，不在本次文档整理中新增功能。
基线测量以 [baseline](../../../scripts/baseline.md) 为准，历史运行过程见
[开发历史](../../local-development.md)。

## 任务 spec

每次任务至少明确：目标、范围、不做事项、相关约束和复用机制、验收方式与完成条件。
已有 issue/spec 覆盖时直接引用，无需复制。需要仓库内保留时放在本目录，名称描述任务。
纯文档任务说明为何无行为 eval。完成后标明状态与证据链接，当前行为仍以设计和领域文档为准。

开发中按真实失败补回归；重要决定按需写 ADR，不要求每个模块或改动都新增一份文档。
