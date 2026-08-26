# 产品运行可靠性 WP-R5：真实学习烟测工程实施与 Debug 验收文档

英文名称：Product Runtime Reliability WP-R5 Real Learning Smoke Engineering and Debug Plan

对应总契约：`product_runtime_reliability_and_real_trial_reentry_v1`

阶段版本：`product_runtime_reliability_wp_r5_v1`

状态：`DESIGN FROZEN / ENGINEERING READY / AWAITING CLEAN RUNTIME RE-ENTRY`

日期：2026-08-26

关联文档：

- [产品运行可靠性与真实 Trial 重新准入契约](./PRODUCT_RUNTIME_RELIABILITY_AND_REAL_TRIAL_REENTRY_CONTRACT.md)
- [WP-R4 Trial 重新准入工程实施与 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R4_TRIAL_REENTRY_ENGINEERING_AND_DEBUG_PLAN.md)
- [真实学习最小采集与观察契约](./REAL_LEARNING_DATA_COLLECTION_AND_OBSERVATION_CONTRACT.md)
- [真实 Trial Window 启动与运行验收契约](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_REAL_TRIAL_WINDOW_OPERATION_AND_ACCEPTANCE_CONTRACT.md)
- [真实 Trial 准入激活执行规程](./PRODUCT_RUNTIME_RELIABILITY_REAL_TRIAL_ADMISSION_ACTIVATION_RUNBOOK.md)

## 一、目的与完成语义

WP-R5 验证一条当前正式资源在当前 Product Runtime 中能够经由统一 Learning 入口，自然形成一次可恢复、可追溯、幂等的真实学习最小事件链。

本阶段只允许消费真实学生在产品界面中的自然操作，不允许工程代码、测试脚本或验收人员代写答案、伪造 Diagnosis、补造 Evidence、制造能力改善或写入虚假的 Trial Observation。

WP-R5 完成仅表示：

```text
当前已重新准入的 Runtime 能够完整承载一次最小真实学习事件链，
链路身份、顺序、恢复、幂等和 Observation fail-open 均可证明。
```

它不表示教育效果、题目区分度、能力提升或 Trial 收益已经成立。

## 二、进入条件

进入真实学习烟测前必须同时满足：

1. WP-R0—R4 工程、Debug 与浏览器验收通过；
2. 当前工作树为 `clean`，Production Build 与 Product Runtime Identity 来自同一 Commit；
3. Runtime Health 为 `ready`，正式资源可读，AI Provider 已完成 live availability 验证；
4. R4-P01—R4-P24 全部通过，且 Preflight 未过期；
5. 新 Trial Window、Preflight、Launch Record 与 Runtime Identity Binding 原子保存；
6. 操作者显式确认激活，复读得到 `effectiveMode = real_trial`；
7. 参与学生、开始时间、结束时间与时区均属于当前 Launch；
8. 正式题、Frozen Resource、Registry Head 和策略身份在烟测开始前未变化；
9. 不存在未解决 P0 / P1；
10. 烟测开始前 Session、Attempt、Evidence、Profile、真实分母和 Observation 的保护写入基线已记录；
11. 浏览器持久化控制面不存在仍处于 `real_trial` 的旧活动 Window；若存在，必须先安全关闭并保留全部历史审计。

任一条件不成立时必须停止在烟测前，不得用降级 Fixture、Demo Resource 或人工拼接事件替代。

## 三、唯一允许的最小链路

```text
Unified Learning Entry
→ Current Frozen Resource Match
→ create-or-resume one active Session
→ create one Round and frozen task queue
→ question_presented
→ student submits one natural valid answer
→ answer_submitted
→ diagnosis_completed
→ feedback_presented
→ next task or learning_round_completed
→ refresh and recover the same formal state
```

烟测使用现有 Material → Plan → Task → Candidate → Publish → Learning 主链，不创建平行 Runtime，不改变正式资源选择逻辑，也不把 Observation 变成 Learning 的阻断依赖。

## 四、身份与事件 Schema 冻结

WP-R5 不新增学生能力 Schema。烟测事件继续消费既有正式字段，且至少可稳定关联：

```ts
type ProductRuntimeReliabilityWPR5EventIdentity = {
  runtimeIdentityDigest: `sha256:${string}`;
  trialWindowId: string;
  launchRecordId: string;
  runtimeIdentityBindingId: string;
  studentId: string;
  learningSessionId: string;
  learningRoundId: string;
  taskId: string;
  resourceId: string;
  resourceVersionId: string;
  attemptId?: string;
  eventId: string;
  eventType:
    | 'question_presented'
    | 'answer_submitted'
    | 'diagnosis_completed'
    | 'feedback_presented'
    | 'learning_round_completed';
  occurredAt: string;
  dataOrigin: 'real_learning';
  runtimeScope: 'product_runtime';
};
```

禁止把测试事件、隔离验收事件、旧 Window 事件或无法证明 Runtime Identity 的历史事件标记为本次真实烟测事件。

## 五、RH-L01—RH-L16 验收矩阵

| ID | 验收项 | 通过标准 |
| --- | --- | --- |
| RH-L01 | Unified Entry | 当前 Product Runtime 的正式 `/learning` 可打开 |
| RH-L02 | Formal Match | 匹配 Current Frozen Resource，身份可追溯 |
| RH-L03 | Session | 只创建或恢复一个活动 Session |
| RH-L04 | Queue | Round 任务队列冻结且顺序可追溯 |
| RH-L05 | Presented | `question_presented` 只形成一次正式呈现事实 |
| RH-L06 | Valid Answer | 学生自然有效回答进入一次正式提交 |
| RH-L07 | Invalid Answer | 无效回答在 Provider 前阻断且不形成 Evidence |
| RH-L08 | Attempt Idempotency | 重复点击或恢复不形成第二个正式 Attempt |
| RH-L09 | Diagnosis | 正式 Diagnosis 完成并引用同一 Attempt |
| RH-L10 | Feedback | Feedback 引用同一 Diagnosis 与主要缺口 |
| RH-L11 | Next Task | 只有下一条 Session Frozen Resource 已完成实际匹配且通过执行门禁时，才投射可点击的继续入口 |
| RH-L12 | Round Complete | 完成事实最多形成一次 |
| RH-L13 | Refresh Recovery | 刷新后恢复同一 Session、Round、队列与进度 |
| RH-L14 | Observation Fail-open | Observation Repository 失败不阻断 Learning |
| RH-L15 | Event Chain | 五项最小事件身份一致、顺序完整且无孤儿事件 |
| RH-L16 | Forbidden Writes | 除自然 Learning Owner Fact 外未授权写入为 0 |

### 5.1 下一题准入与页面投射边界

Session 队列中存在 `nextResourceVersionId` 只表示队列仍有后续位置，不等于该题在当前 Runtime 中已经可执行。页面不得仅依据题号、队列长度或资源版本存在性投射“进入下一题”。

继续入口必须同时满足：

1. 当前 Round 已形成正式持久化结果；
2. 队列存在下一项；
3. 下一项精确 Resource Version 仍可按 Session 冻结身份读取；
4. `nextTaskResolution.status = matched`；
5. 单题身份、Validation、Review、Rubric 与 Quality Assessment 均满足执行门禁；
6. 当前 Checkpoint 不处于 `blocked` 或 `review_required`。

只要下一项返回 `blocked`、`review_required`、`candidate.rubric_not_observable`、`quality_evaluation_not_executable` 或其他不可执行结论，页面就必须：

- 不投射可点击的“进入第 N 题”；
- 保留当前 Round、Session、队列和已完成结果；
- 在修订仍可用时保留“根据反馈修订”；
- 将下一题状态投射为明确的准备/检查状态，不允许先推进 Round 再依靠异常回滚；
- 不将题组目标数量误写为当前可执行题量。

`canAdvance` 是正式准入结果的页面投影，不得由 `queue.hasNextTask` 单独推导。

当反馈中的“下一步这样做”与修订目标文本完全相同时，默认只展示一次修订目标；不得以两个标题重复投射同一句指导，使学生误认为存在两个不同动作。

### 5.2 终止阻断态退出与入口恢复边界

当当前题结果已经正式保存，但下一题未通过执行门禁，且当前反馈已经不存在可继续的修订、恢复或重试动作时，该状态属于“终止阻断态”，不再属于可恢复 Session。

学生点击“返回学习入口”时，系统必须：

1. 保留已经完成的 Round、Attempt、Diagnosis、Feedback、Evidence、队列和审计事实；
2. 将当前活动 Session 以 `interrupted / student_stopped` 安全收口，并将 Activity Context 标记为 `ended`；
3. 不推进 Round，不伪造下一题完成，也不删除历史事实；
4. 返回入口后不得再把同一 Session 投射为“可以继续上次学习”；
5. 入口只能展示新的可用学习、明确的无任务状态或真实可恢复状态；不得形成“反馈页 → 返回入口 → 继续学习 → 同一反馈页”的循环。

Session 收口成功后，页面必须同步清除收口前缓存的 Runtime 恢复投影；不得让旧的 `session_recoverable / continue_learning` 文案覆盖新的 `session_ended` 入口状态。

健康且可恢复的活动 Session 应由统一学习入口的正常状态卡片承载，并同时提供“继续学习”和“结束本次学习”。不得使用仅有单一“继续学习”动作的 Runtime 故障提示覆盖正常入口，否则学生在恢复目标已经失效时没有退出路径。

只有仍存在可执行下一题、可提交修订、可恢复提交，或页面实际提供且学生选择执行资源重试时，Session 才可继续保持 active。内部 `primaryAction` 仍为资源检查或重试，不得覆盖学生在反馈页明确选择“返回学习入口”的退出语义。

## 六、自然作答与人工边界

1. 工程验收人员不得代替学生输入答案；
2. 不要求学生为了测试故意答错、复制材料或触发能力缺口；
3. 空回答、字数不足、重复提交等失败分支使用既有自动化和只读浏览器验收证明，不要求污染真实 Trial；
4. 学生提交前可以正常使用产品已经提供的提示，但必须保留帮助级别和作答来源；
5. 真实回答、Diagnosis 和 Feedback 只能由现有 Owner 创建；
6. 若 Provider、Runtime 或正式资源在提交前失效，回答应保留并准确提示恢复，不得转写为成功事实；
7. 若无法取得真实学生自然作答，WP-R5 必须停在 `AWAITING_REAL_STUDENT_ACTION`，不得自动跨越。

## 七、Observation 与 Trial 边界

- 第一条 Observation 必须来自重新准入后的真实 Owner Fact；
- Observation 只旁路观察，不参与 Learning 成功判定；
- Observation 写入失败时 Learning 继续，错误进入运行观察；
- 旧 Window 与新 Window 的事件不得合并；
- 烟测只证明事件链成立，不把单次结果解释为教育效果；
- 激活后源码、产物、正式资源或策略身份变化时，WP-R3 必须使 Trial 自动回落 `off`。

## 八、失败回滚

以下任一情况发生时停止烟测并保持已有正式事实不丢失：

- Runtime Identity 不再 aligned；
- Trial Window 过期、失效或参与学生不匹配；
- Provider 不可用且当前动作依赖 Diagnosis；
- 正式资源身份变化；
- 出现第二个活动 Session 或重复 Attempt；
- 事件身份、顺序或引用关系不一致；
- Observation 反向阻断 Learning；
- 出现未授权 Formal Resource、Evidence、Profile 或真实分母写入。

回滚只允许关闭 Trial / 终止烟测，不删除已形成的真实 Session、Attempt、Diagnosis、Feedback 或审计事实。

## 九、Debug 与浏览器执行顺序

```text
1. 运行 WP-R0—R4 与旧主链自动化回归
2. Production Build
3. 生成并复算 Product Runtime Identity
4. 真实 Runtime Health / Provider / Formal Store 检查
5. R4-P01—R4-P24 只读 Preflight
6. 原子保存新的 Approval Bundle
7. 显式激活并复读 real_trial
8. 打开 Unified Learning Entry
9. 验收 RH-L01—RH-L05，不提交答案
10. 等待真实学生自然提交
11. 验收 RH-L06—RH-L12
12. 刷新恢复并验收 RH-L13—RH-L16
13. 输出只读验收报告
```

步骤 10 是不可自动跨越的人工边界。

## 十、零回归原则

每个执行步骤都必须证明旧主链零回归，新语义只在 WP-R5 允许的真实学习烟测边界内生效。尤其保持：

- Material → Plan → Task → Candidate → Publish → Learning 主链不重建；
- Frozen Resource 不批量覆盖；
- Single Choice、Revision、Targeted Micro-training、Retest 与 Transfer 沿用现有契约；
- Trial 关闭或 Observation 故障不阻断 Learning；
- 不新增默认产品页面，不投射内部 Runtime / Trial 标识给学生；
- 不以 Smoke Test 结果形成新的学生能力结论。

## 十一、完成定义

只有 RH-L01—RH-L16 全部具备证据，才能将 WP-R5 更新为：

```text
ENGINEERING COMPLETE
DEBUG ACCEPTED
REAL LEARNING SMOKE ACCEPTED
MINIMUM EVENT CHAIN VERIFIED
```

在真实学生自然提交发生前，准确状态只能是：

```text
DESIGN FROZEN
ENGINEERING READY
AWAITING_REAL_STUDENT_ACTION
```

## 十二、冻结声明

本文档冻结 WP-R5 的进入条件、最小事件链、身份边界、RH-L01—RH-L16、真实学生人工边界、Observation fail-open、回滚和零回归要求。任何后续实现不得用合成答案或测试事件替代真实学生行为，也不得在 Product Runtime Identity 建立后通过修改源码或文档使准入事实静默失效。
