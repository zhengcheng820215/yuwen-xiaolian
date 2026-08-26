# 真实 Trial 准入激活执行规程

英文名称：Real Trial Admission Activation Runbook

对应契约：`product_runtime_reliability_and_real_trial_reentry_v1`

执行版本：`real_trial_admission_activation_runbook_v1`

状态：`EXECUTION READY / REAL TRIAL REMAINS OFF UNTIL ALL GATES PASS`

日期：2026-08-26

关联文档：

- [WP-R4 Trial 重新准入工程实施与 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R4_TRIAL_REENTRY_ENGINEERING_AND_DEBUG_PLAN.md)
- [WP-R5 真实学习烟测工程实施与 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R5_REAL_LEARNING_SMOKE_ENGINEERING_AND_DEBUG_PLAN.md)
- [真实 Trial Window 启动与运行验收契约](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_REAL_TRIAL_WINDOW_OPERATION_AND_ACCEPTANCE_CONTRACT.md)

## 一、目的

本规程只负责把已经完成工程验收的当前 Product Runtime 安全地准入为一个新的真实 Trial Window。它不是产品功能设计，不新增普通用户步骤，不恢复旧 Trial，也不制造真实学习数据。

执行结果必须来自结构化 Runtime Owner Fact：

```text
Trial Window
+ Re-entry Preflight Report
+ Launch Record
+ Runtime Identity Binding
+ Activation State
+ Activation Audit
```

仓库文档只冻结操作边界，不作为激活成功的事实来源。Trial 激活后不得为了回填结果修改源码、策略、正式资源或仓库文档；否则当前 Runtime Identity 变化，WP-R3 必须使 Trial 自动失效。

## 二、启动前硬门禁

只有以下条件全部满足，才允许进入保存准入包：

1. 工作树为 `clean`；
2. Production Build 成功，Product Runtime Identity 来自同一 Commit 与同一产物；
3. Runtime Health 的核心运行域为 `ready`：Instance、Formal Store、Learning 均为 `ready`，AI Provider 为 `live_verified`；整体状态若仅因 `audit_evidence_incomplete / trial_reentry_required` 显示 `degraded`，不视为 R4-P01 失败，因为这两项正是本次重新准入要消除的预期控制面状态；
4. Formal Store、正式资源快照与 Registry 可读且身份一致；
5. AI Provider 已完成真实可用性验证，状态为 `live_verified`；仅配置 Key 不等于通过；
6. Trial Activation State 为 `off / off`，不存在活动旧 Window；
7. 当前参与学生、时区、开始时间与结束时间已经明确；
8. R4-P01—R4-P24 全部通过；
9. Preflight 期间受保护写入计数全部为 `0`；
10. 不存在未解决 P0 / P1。

任一项不能证明时必须停止，保持 `effectiveMode = off`。不得手工把 `PRODUCT_AI_PROVIDER_AVAILABILITY_VERIFIED` 设为 `true` 来代替真实 Provider 探测。

## 三、凭证与隐私边界

- Provider 凭证只能通过服务端环境注入；
- 日志、文档、Runtime Identity、Preflight、Launch、Binding 与 Audit 均不得包含凭证内容；
- 执行记录只允许写入 `configured / live_verified / unavailable` 等状态；
- 不读取、不复制、不截图、不提交学生答案、材料正文或题目正文；
- 激活阶段不得创建 Session、Attempt、Diagnosis、Evidence、Profile、Observation 或真实分母。

## 四、执行顺序

```text
A01 复读 git clean、Commit、Production Artifact 与 Runtime Identity
A02 执行 Provider 真实可用性验证
A03 复读 Runtime Health 核心运行域 = ready；只允许预期的 Trial 重新准入原因
A04 记录激活前保护写入基线
A05 创建新的 draft Trial Window 身份
A06 只读执行 R4-P01—R4-P24
A07 确认 Preflight eligible、未过期且零写入
A08 原子保存 Window / Report / Launch / Binding
A09 复读准入包四项身份完全一致，Trial 仍为 off
A10 操作者显式确认激活
A11 原子写入 active Window / real_trial State / Activation Audit
A12 立即复读 effectiveMode = real_trial 与 Runtime Identity aligned
A13 复读 Observation = 0、真实分母 = 0、学生 Owner Fact = 0
A14 进入 WP-R5，仅执行 RH-L01—RH-L05
A15 停在 AWAITING_REAL_STUDENT_ACTION
```

A10 不得由保存动作隐式替代；A14—A15 不允许工程人员代写学生答案。

上述 A04—A13 只能通过 `/internal/product-complexity-convergence-stage4-preflight`
的 R4 v2 Internal 操作边界执行。该入口必须先展示当前事实计算得到的
R4-P01—R4-P24，再分离“保存准入包”和“显式激活”两个动作；普通 Learning、
Workbench 页面不得出现激活入口。旧 v1 全通过 Fixture 与旧激活函数不得用于真实准入。

## 五、R4-P01—R4-P24 签署要求

Preflight 必须由当前运行事实逐项计算，不得使用全通过 Fixture。签署至少保存：

- Check ID；
- `passed / failed`；
- 结构化 evidence code；
- issue code；
- startedAt / completedAt / expiresAt；
- Runtime Identity Digest；
- protected write counts。

只有 24 项全部 `passed` 且 `issueCodes = []` 时，`eligibleForActivation` 才能为 `true`。

## 六、允许写入与零写入边界

Preflight 阶段全域零写入。保存和激活阶段只允许新增或推进：

| 阶段 | 允许写入 |
| --- | --- |
| 保存准入包 | 新 Window（draft）、Preflight、Launch、Binding |
| 显式激活 | 同一 Window（active）、Activation State、Activation Audit |

以下写入必须保持为 `0`：Formal Resource、Session、Round、Attempt、Diagnosis、Feedback、Evidence、Profile、真实分母、Observation。

## 七、失败与回滚

- Provider 未配置、未验证或不可用：停止在 A02，保持 off；
- Runtime Identity dirty / missing / mismatch：停止在 A01 或 A03，保持 off；
- 任一 Preflight 检查失败：不保存准入包；
- 准入包部分持久化失败：整组不具备可激活资格；
- 激活前身份、时间或策略变化：拒绝激活；
- 激活原子提交或复读失败：立即执行失效服务并回落 off；
- 激活后源码、产物、正式资源或策略身份变化：自动失效，不沿用旧 Binding。

任何失败都不得删除历史 Window、Launch、Binding、Audit 或真实 Owner Fact。

## 八、完成定义

真实 Trial 准入激活仅在以下事实同时成立时完成：

1. Provider 为 `live_verified`；
2. Runtime Health 核心运行域为 `ready`，整体状态不存在预期 Trial 重新准入原因以外的阻断或降级原因；
3. R4-P01—R4-P24 为 `24 / 24 PASS`；
4. 新 Window / Report / Launch / Binding 一一对应且身份一致；
5. 激活前 Trial 为 off；
6. 显式激活后 Window 为 active、State 为 real_trial、Audit 存在；
7. 复读 Runtime Identity 仍 aligned；
8. 激活阶段未制造任何真实学习或 Observation 事实；
9. Learning 与 Workbench 旧主链零回归；
10. 系统停在 WP-R5 `AWAITING_REAL_STUDENT_ACTION` 边界。

若 Provider 门禁未通过，准确状态必须记录为：

```text
ADMISSION BLOCKED / AI PROVIDER NOT LIVE VERIFIED / REAL TRIAL OFF
```

不得用“工程已完成”替代“真实 Trial 已激活”。

## 九、冻结声明

本规程冻结真实 Trial 准入激活的执行顺序、凭证边界、只读 Preflight、有限控制面写入、显式确认、失败回落和真实学生人工边界。它只授权 Internal R4 v2 操作边界承载上述准入动作，不授权普通产品页面新增 Trial 操作，也不允许绕过 Provider、Runtime Identity 或零写入门禁。
