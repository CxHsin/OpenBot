# 任务、队列与恢复

当前使用上游实现。任务入口为 `server/src/tasks/`，工作队列为 `server/src/work/queue.ts`。
`tasks/state.ts` 从队列、审批和问题等事实推导状态；先理解这些事实，再考虑新增记录。

工作队列使用数据库时钟与租约领取工作。重新领取不证明之前没有发生外部副作用，
也不等同于任意任务可以从最后一步恢复。恢复语义须结合具体执行器、历史和测试判断。

已移除 fork 的 routine 抢占与 continuation；旧 P2 journal 不再是当前开发计划。
相关上游测试包括 `server/tests/tasks-state.test.ts`、`tasks.integration.test.ts` 与
`work-queue.integration.test.ts`。数据库准备见[local](local.md)。
