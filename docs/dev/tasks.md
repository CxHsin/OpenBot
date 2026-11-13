# 任务、队列与恢复

修改任务状态、重试、租约或恢复时阅读。

## 当前事实来源

`server/src/tasks/state.ts` 从队列、审批和问题等事实推导任务状态，解释了为何不另存一套状态账本。
任务执行相关入口是 `tasks/store.ts`、`runner.ts`、`turn.ts` 与 `server/src/db/schema/tasks.ts`。
引入新记录前先区分它保存的是新的执行事实，还是重复已有状态。

## 队列边界

`server/src/work/queue.ts` 使用数据库时钟计算和比较租约，以避免副本时钟偏移导致重复领取。
通知只是降低等待延迟，工作是否存在以数据库为准。重新领取只说明租约可用，
不证明前一次没有产生外部副作用；attempts 与错误信息保留这种区别。

P1 的 `scheduling/routine-work.ts` 使用已有会话历史续跑，并在已开始的 continuation 崩溃后等待检查。
这与步骤级 journal 恢复不同。当前 P2 是[目标设计](../design.md#work-that-survives)，尚未验收。
实现时必须处理“外部动作已完成，结果尚未落库”的窗口，不能盲目重放。
恢复保持原 initiator、owner 和 grants，动作继续经过网关。

## 验证与待完成

定时职责复用 routine clock、工作队列与 responsibility engine：routine 保存可选目标 ID，
firing 直接提交 schedule 事件，真实 routine run 及其 owner/Bot/channel 关联用于验证目标。
同一 routine run 的稳定事件键避免重复创建目标运行；时钟自身不生成模型轮次或通知。
暂停 routine 只停止后续 firing，不取消已经入队的目标工作；暂停或完成职责会阻止其开始。
目标缺失或状态不符时跳过，不退回普通 routine 指令。升级需应用迁移 0075。
现场与回归证据见 [eval 015](../../evals/015-scheduled-responsibility.md)。

持续检查通过 `finish_responsibility_check` 暂存进度与 notify；只有成功结算事务才写入职责
progress 与 run.notify。失败或等待审批丢弃暂存值；若运行期间 progress 已变更，拒绝旧结果
覆盖。notify=false 的成功运行保留结果，但跳过 channel activity 与 delivery；默认仍通知。
notify=true 的检查在结算前先交给既有通知入口；入队抛错不推进游标。部分入队或入队后结算前
崩溃仍有不确定窗口，不能视为外部投递与进度已经成为同一个事务。
GitHub 上游与 fork 的采集方式见 [observer](../../examples/nailong/README.md)，验收见
[eval 016](../../evals/016-upstream-observation.md)。

现有测试入口：`server/tests/tasks-state.test.ts`、`tasks.integration.test.ts`、
`work-queue.integration.test.ts`，以及 `server/src/scheduling/` 中的回归。
数据库准备见 [local](local.md)。
[eval 020](../../evals/020-resume-after-crash.md) 只验收崩溃恢复；取消和预算仍需独立验收覆盖。
下一任务需先定义恢复契约与证据，再选 schema 和模块接口，见[计划](plans/README.md)。
