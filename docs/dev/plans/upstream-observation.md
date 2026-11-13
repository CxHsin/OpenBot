# 上游持续观察与成功游标

状态：实现与现场验收完成，见 [eval 016](../../../evals/016-upstream-observation.md)。
本地应用页面已启动并显示，GitHub 持续观察已启用为每日 Asia/Shanghai 09:00。

## 目标与范围

使用已有 computer 文件/命令网关采集 GitHub 上 OpenBot 与用户 fork，结合明确提交版本分析。
复用 responsibility.progress 保存上次成功处理的提交；离线恢复时直接从该提交补查至当前上游。
只在整个模型轮次成功后提交检查游标；失败、等待审批或材料缺失不能推进。
没有变化或没有值得通知的变化时，保存检查事实并不写 activity 或 delivery 通知。
保留 run 的结果及通知选择，使静默可核验。默认委托仍交付回复，静默必须显式选择。

## 边界与机制

采集器是 examples/nailong 中在 Bot computer 执行的 Bun/Git 程序，不从 API 宿主直接抓取资源。
所有 Bot 文件/命令继续通过现有 computer gateway。没有新增源权限、调度器或工作队列。
用户已明确只看 GitHub：比较对象为 CopilotKit/openbot 和 CxHsin/OpenBot 的 main，
报告披露两边 SHA，不读取或同步宿主工作区。
初次观察须指定基线提交；不可悄悄将当前 tip 作为已处理游标。非快进和不可读取游标报错。
检查完成工具仅在后台职责轮次存在，暂存结果，在成功结算事务中保存 progress 和通知选择；
并发旧游标不能覆盖新进度。普通进度报告不作为检查游标提交方式。
推送前审查修复了大补丁固定大小拒绝与通知入队失败仍推进游标的问题，见
[review](upstream-observation-review.md)。

## 不做事项

不自动改代码、提交、合并或推送，不扩大已确认的上游/fork 信息源，不建立通用步骤恢复 journal。
不承诺模型对相关性判断完全准确，不把缺失材料当作无变化。

## 验收

eval 016 覆盖连续提交、离线补查、相同 tip、fetch 失败及历史改写；失败不覆盖成功游标。
真实数据库验证成功结算原子写入游标、旧进度冲突，以及 quiet run 保留结果。
engine 验证 quiet 不调用投递；默认通知保持。真实 Bot 在已授权 computer 采集并完成检查，
核对 audit、run、progress 与渠道消息。应用页面实际启动并可见。
完成执行 verification 的相关测试、lint、format:check、typecheck。
