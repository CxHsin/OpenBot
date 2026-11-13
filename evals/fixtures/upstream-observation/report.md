# GitHub 上游首轮现场报告

2026-11-14；上游 806a8317f383a63f5f2c3796555f8a419e9b352a..f8af37ab73e96784f174a11104505a965e722cab，fork 6b5a0143c467a4ca391726329367b668978ac585。

我会在 computer 工作区运行指定的只读采集器，从首次基线检查上游，并对照 fork 评估相关变更；成功分析后才保存新游标。


本轮上游有 **1 条新提交，值得跟进，普通优先级**：主要改善 Windows 首次安装和启动体验。

来源：[上游提交 f8af37a（#1544）](https://github.com/CopilotKit/openbot/commit/f8af37ab73e96784f174a11104505a965e722cab) 及采集器生成的 `upstream-check.json`。关键变化包括：

- `desktop/src-tauri/windows/installer.nsi` 和 `installer-english.nsh`：改善 WebView2 下载、安装进度及失败说明。
- `desktop/src-tauri/windows/hooks.nsh`：安装完成启动后，等待应用窗口可见，减少用户看到“安装结束但应用未出现”的空档。
- `desktop/src-tauri/src/first_paint.rs` 和 `main.rs`：增加原生启动遮罩，首次页面绘制后撤下，并为 setup 页面加载完成后设置 10 秒撤罩兜底。

对照 fork `6b5a0143c467a4ca391726329367b668978ac585`，这些文件未出现在 fork 相对共同基线的改动清单中。本轮没有发现对可靠执行、工具权限与审计、持久委托或消息交付的直接改进。

建议将该提交列为 Windows 同步候选，先验证缺少 WebView2 的首装、下载失败、启动超时及 setup 未发 heartbeat 等场景。本轮完成了只读 patch 分析，尚未做 Windows 实机验证，不能将提交标题中的“永不白屏”视为已验证保证。

采集成功，已提交本轮检查点，游标推进至 `f8af37ab73e96784f174a11104505a965e722cab`，设置 `notify=true`；持续职责保持活动。
