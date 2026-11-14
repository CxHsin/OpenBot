# 仓库现状

2026-11-14：按用户决定，仅保留 repo harness 与上游内容，暂停新增运行功能。

## 基线

维护基线固定为 `6d1919a3b53a0730894258f197f3beb4e8db4f2f`，即删除后端源码提交
`f71b0f4b` 的父提交。该版本仍包含 server、worker、toolkit、supervisor、computer、
数据库迁移与 Helm chart，可在本仓库阅读、修改与构建后端。

此前曾合并 upstream/main 的 `2adbd3f0`；随后用户决定维护完整源码版本。
通过新提交恢复基线内容，保留已推送历史，不 reset 或强推。运行代码与固定基线一致，
本 fork 仅额外保留 repo harness 与产品文档；没有恢复旧 fork 运行扩展。
该基线已经移除旧 e2e 套件，因此不代表恢复所有历史测试目录。

后续 upstream/main 不再整批合并。按需评估并挑选仍适用于完整源码版本的变更，
每次核查源码、构建与验证入口；除非用户重新决定，不采用仅发布后端镜像的仓库形态。

## 移除内容

移除 fork 的 Telegram、消息五秒合并、routine 抢占续跑、模型测量、stateless relay
兼容与导航 handback 修复；相关专有测试、eval、阶段 spec 和基线记录也从当前树移除。
上游原有 Goals、Routines、Check-ins、任务队列、工具网关、审批与审计均保留。

保留 AGENTS、skills、贡献规范与模板、产品目标、文档入口、开发环境与验证指南，以及 eval 编写规则。
这些文档不表示额外运行能力。旧实现仍可从 Git 历史及本地备份分支
`backup/before-runtime-removal-20261114` 找回；日志与数据库不是运行代码一致性的证明。

## 本次任务依据

目标：去除运行扩展，获得清楚的上游加 harness 基线后再决定开发。
范围：恢复所有 server 差异，删除专有测试、eval 与旧阶段计划，修正文档引用。
后续决定：恢复并维护完整源码基线，验证后同步本地与 origin/main。
非目标：改写 Git 历史、清空数据库、部署或添加替代功能。
验收：运行目录与固定上游基线无差异；文档链接、lint、format:check、typecheck
及相关上游测试通过，失败如实记录。不再宣称已移除扩展的现场验收有效。

## 阅读顺序

1. [产品概念](../how-openbot-works.md)。
2. [系统架构](../architecture.md)。
3. [Routines、Goals 与 Check-ins](../routines.md)。
4. [审批与动作边界](../approvals.md)。
5. [开发入口](README.md)与[验证规则](verification.md)。
