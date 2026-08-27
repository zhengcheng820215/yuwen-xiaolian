# 产品运行可靠性 WP-R2 故障分类与恢复投射 Debug / 浏览器验收记录

日期：2026-08-25

分支：`main`

基线提交：`4d016c6`
阶段结论：`WP-R2 ENGINEERING COMPLETE / DEBUG ACCEPTED / BROWSER ACCEPTED`

> 快照边界：本文只记录 2026-08-25 验收时事实。Runtime、AI 配置和 Trial 状态均可能随启动环境变化，当前状态必须重新读取 Health；本文不构成持续在线证明。

## 1. 实施范围

本轮实现 `product_runtime_user_projection_v1`、GET-only Health Client、Recovery Projection Service、普通页面 Recovery Notice、Learning Entry 与 Live Learning 健康门禁、Workbench 安全文案、单飞动作工具及 Internal 浏览器验收页。单飞工具已通过纯函数与 Fixture 验收；生产页面继续使用各自主操作禁用、正式命令队列和既有幂等机制，不将“工具存在”表述为所有按钮均已改接该工具。

投射只消费 Runtime Health、冻结 Reason Code 和既有 Owner Fact。它不创建第二套 Session、Attempt、Checkpoint、发布或 Trial 状态。

## 2. Reason 到普通投射

| 原因域 | 普通状态 | 保留依据 | 主操作 |
| --- | --- | --- | --- |
| Runtime 不可达 / Health 超时 | runtime_unavailable | Owner Fact 或 unknown | 重新尝试 |
| Formal Store / Resource 不可读 | formal_resource_unavailable | Owner Fact 或 unknown | 重新读取 |
| 正常但无可用任务 | no_task | not_started | 无 |
| 已有 Session | session_recoverable | hasActiveSession | 继续学习 |
| Attempt 已提交、处理未完 | submission_recoverable | attemptCommitted + checkpointPhase | 继续处理 |
| AI 未配置 | ai_configuration_required | Owner Fact | 只阻断 AI 动作 |
| AI 暂不可达 | ai_temporarily_unavailable | draft 或 submitted Owner Fact | 安全重试 / 继续处理 |
| 身份冲突 | identity_conflict | Owner Fact | 返回入口重新确认 |

Trial mismatch、Trial observation failure 与不足以代表内容的固定 Build Label 不进入普通用户页面。

2026-08-27 补充边界：上述 fail-open 规则继续适用于“已有正式任务可开始”的普通学习；若入口已经没有可开始任务，同时 Health 明确给出 `trial_reentry_required / runtime_identity_insufficient`，则泛化的 `no_task` 会掩盖真实下一步。此时入口投射为 `trial_reentry_required`，只展示“真实测试尚未完成准入”和“前往真实测试准入”，导航到 Internal R4 v2 控制面；普通 Learning 页面本身仍保持零 Trial 写入、零激活能力。

## 3. Debug 结果

- `R2-C01—R2-C40`：`40 / 40 PASS`；
- Health 未检查时不再猜测 AI ready；
- 同事实得到稳定 Projection Digest；
- 普通 View 不含 internal、Reason Code、Revision、Checkpoint 或英文异常原文；
- 快速重复动作共享同一 Promise；
- unknown Owner Fact 不宣称内容已保存。

## 4. 浏览器结果

Internal 路由：`#/internal/acceptance/product-runtime-reliability-wp-r2`

- `R2-B01—R2-B18`：自动化 `18 / 18 PASS`；
- 真实浏览器：`18 / 18 PASS`；
- 真实 Formal Resource Revision：`1963`；
- Learning 入口真实页面显示“可以继续上次学习 / 上次学习进度已经保留 / 继续学习”，只有一个主操作；
- Workbench 在 AI 未配置时仍可浏览与本地编辑，既有 AI 状态提示和操作门禁保持有效；
- PC / Tablet 使用同一投射事实，不按视口改变业务结论。

2026-08-27 增补 `R2-B19`：验证“无任务 + Trial 重新准入要求”能够投射唯一的 Internal 准入入口；原 `R2-B01—R2-B18` 历史签署保持不变，当前扩展矩阵目标为 `19 / 19 PASS`。

## 5. 核心回归

| 回归 | 结果 |
| --- | --- |
| WP-R0 Debug / Browser | `32 / 32`、`12 / 12` |
| WP-R1 Debug / Browser | `36 / 36`、`14 / 14` |
| Structured Runtime Error | `11 / 11` |
| Question Workbench Presentation | `23 / 23` |
| Material Workbench State | `25 / 25` |
| Unified Learning Entry | `27 / 27` |
| Learning Session Task Queue | `21 / 21` |
| Phase 16.3 Diagnosis Boundary | `3 / 3` |
| Phase 16.3 Day 0 Integration | `15 / 15` |
| Learning Feedback Presentation | `10 / 10` |
| Complexity Stage 1 / Stage 4 | `28 / 28`、`64 / 64` |
| Real Trial Preflight | `56 / 56` |
| Production Build | `PASS` |

共执行 15 个核心回归脚本，失败数 `0`。构建仅保留既有大 Chunk 提示，不构成 WP-R2 阻塞。

## 6. 零写入与边界

浏览器验收前后正式资源 Revision 与 Digest 一致。Formal、Session、Attempt、Evidence、Profile、Calibration、Trial、Workbench 八类未授权写入均为 `0`。

当前 Runtime 健康事实仍包括：Formal Store ready，Revision `1963`；AI `not_configured`；Trial identity mismatch 且 effective off。WP-R2 准确门禁依赖 AI 的新操作，但没有写入 API Key、没有启用 Trial、没有制造真实 Attempt 或 Observation。

## 7. 遗留与下一步

WP-R2 已完成，不代表完整真实 Learning 可不受条件地启动。下一步进入 WP-R3，建立内容寻址 Product Runtime Identity 与 Trial 自动失效；之后 WP-R4 才能执行重新准入。AI 服务仍需在启动 Runtime 的同一进程环境中完成配置。
