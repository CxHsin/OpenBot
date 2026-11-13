# 定时唤醒持久委托

状态：实现并验收完成；证据见 [eval 015](../../../evals/015-scheduled-responsibility.md)。

## 目标与范围

让用户在普通对话中为已有 responsibility 配置 routine 时间表。
每次 routine firing 直接向现有 responsibility engine 提交 schedule 事件，无需模型转述。
每次 firing 用稳定事件 ID 去重，复用 routine cron 校验、20 项上限、租约和工作队列。
时区由用户指定；上游观察建议每日 Asia/Shanghai 09:00，但本功能不自动创建默认时间表。
暂停或完成目标后，排队的触发也不执行目标；暂停 routine 停止后续触发。
时钟触发本身不发送“已启动”通知，目标执行的结果仍走既有 delivery。

## 不做事项

本任务不采集上游、不保存 Git 游标、不实现无变化结果静默或跨报告去重、不新增调度器。
不回放离线时错过的每个时间窗。离线补查将由后续检查任务按上次成功游标完成。
不增加 owner/Bot 权限，不重命名 responsibility，不实现跨副本会话抢占。

## 约束与实现

新增 schedule_responsibility 工具，沿用 Routines transport 的显式授权和写操作分类。
routine 保存可选 responsibilityId；创建和 firing 均核对 owner、Bot、报告 channel 与目标关联。
保留普通 routine 行为；仅关联的 routine 使用直接触发路径。
需新增数据库迁移；部署前应用迁移。修改上游 routine store/runner 的原因是复用已有调度与执行入口，
避免另建定时表、轮询器或第二套队列。删除目标后的残留时间表应安全跳过，不能退化为普通模型任务。

## 验收

对应 eval 015：真实数据库保存关联，重建 store 后可读；重复同一 firing 只有一个目标 run；
外 owner/Bot 不能绑定，暂停或完成目标安全跳过；暂停 routine 不触发；
普通 routine 回归通过。现场通过 Bot 创建时间表，等待 worker 自然到点触发并交付一次后台结果，
保留调用、审计、routine run、目标 run 和消息证据，验收后已暂停测试时间表并完成验收目标。
本次没有使用 Run now 或 run_responsibility 触发该验收运行。
完成要求见 verification，包括相关测试、lint、format:check、typecheck。
