# 验证与交付

仓库级完成条件见 [AGENTS](../../AGENTS.md)。此处指导选择和执行检查；
具体行为断言在测试和 [evals](../../evals/README.md)，运行输出保存在忽略的 `.logs/`。

## 流程

1. 实现前找到相关测试和 eval，明确本次完成条件；缺覆盖时说明需要补什么。
2. 先运行受影响模块的定向测试；bug 修复需要证明回归在无修复时失败。
3. 运行根目录 `bun run lint`、`bun run format:check`、`bun run typecheck`，以及受影响包测试。
4. 涉及真实渠道、外部服务或持续执行时，按对应 eval 检查数据库、审计与结果。
5. 对照 spec 审视范围、现有机制复用、边界和复杂度；交付行为变化、检查结果与局限。

文档整理无运行行为变化时，执行三项基础检查、链接检查与 diff 审阅即可；无需模型现场验收。
更广服务端扫描按影响选择 `bun run test:server:sharded`，环境准备见 [local](local.md)。

## 保存结果

每个命令保存独立输出，先捕获退出码，再显示或过滤日志。例如：

```powershell
New-Item -ItemType Directory -Force .logs | Out-Null
bun run lint *> .logs/lint.log
$checkExit = $LASTEXITCODE
Get-Content .logs/lint.log -Tail 25
Write-Output "Exit code: $checkExit"
```

失败先定向复现，保留原日志，再决定是否重复广泛扫描。根据最终统计和退出码判断，
不能把业务日志中的 error 字样直接当作测试失败。

区分确定性测试、真实验收和阶段完成；凭据缺失是受阻，跳过须说明，不能扩大通过结论。
只读与本次行为相关的 eval；不为普通静态检查再建一份 eval，也不把每次日志复制进文档。
