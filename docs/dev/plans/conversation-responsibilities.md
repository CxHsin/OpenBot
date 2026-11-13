# 普通对话中的持久委托

状态：2026-11-14 普通对话入口已实现并通过限定范围的现场验收，
见 [eval 013](../../../evals/013-conversation-responsibility.md)。
验收中发现的单进程会话锁竞争已修复并真实重试成功，见 eval 014。
持续观察与跨副本调度不在本次交付范围。

目标：通过已授权的 Routines transport 创建、查询、修改、执行、暂停、恢复和完成 responsibility。
复用现有 store、engine、工具和网关，不另建执行或权限机制。
报告 channel 复用 routine 的共享会话解析：只有一个时默认，多于一个时要求选择，
显式指定时核验 owner 和 Bot 成员关系。当前 transport 不携带当前会话 ID，不能声称自动选中当前会话。

不做：自动关注上游、调度、通知去重、通用恢复、目标接口重命名和上游同步。
普通对话不获得报告执行进度的工具，该能力留在 responsibility 执行回合。

验收：工具目录可发现、写操作被分类为 write；身份不可由模型参数覆盖；
创建保存到已验证的 channel；其他 Bot/owner 的目标不可操作；拒绝返回错误；
暂停后的执行由既有 engine/store 校验。对应 eval 013，数据库和真实运行证据分开记录。
执行相关定向测试及 lint、format:check、typecheck，日志保存在 .logs。

现场验收发现普通对话的 run 工具与当前会话竞争 Intelligence 锁。
本任务包含修复该直接阻碍执行入口的问题：复用本地会话调度，不增加队列或通用恢复。
回归与现场重试见 [eval 014](../../../evals/014-responsibility-conversation-lock.md)。
