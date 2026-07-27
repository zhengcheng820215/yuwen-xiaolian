# 系统地图（System Map）

本文档是系统的总导航，不是 Schema、实现说明或验收日志。

它只回答五个问题：

1. 产品的核心学习链路是什么；
2. 关键对象分别负责什么；
3. 模块之间有哪些权威关系；
4. 当前各 Phase 处于什么状态；
5. 详细规则应去哪里查阅。

字段、算法、Debug Case、指标分母和验收过程，以对应 Phase、Model、Runtime 与 Acceptance 文档为准。

## 一、产品主线

产品目标不是让学生完成更多题目，而是通过可追溯的真实表现，逐步形成更可靠的能力判断和下一步学习安排。

```text
发现问题
-> 生成任务
-> 学生作答
-> 形成 Diagnosis 与 Evidence
-> 判断 Evidence 是否足以影响长期状态
-> 更新成长记忆
-> 决定下一步任务
-> 复测、迁移或继续观察
```

一句话概括：

> 发现问题，进行训练，验证变化，形成成长记忆，再决定下一步。

## 二、当前主链路

正式内容进入链：

```text
StructuredQuestionDraft
↓
ResourceValidationResult
↓
QuestionQualityAssessment
↓
ResourceReviewDecision
↓
FrozenQuestionResource / ResourceRegistry
↓
ResourceMatchQualityResult
↓
ConcreteLearningTask
```

学生学习与证据回流链：

```text
Question / ConcreteLearningTask
+ StudentResponse
+ QuestionMetadata
↓
ResponseValidityResult
├─ invalid -> blocked / supplement response
└─ valid
   ↓
   DiagnosisResult
   ↓
   ├─ StudentThinkingAnalysis
   │  ↓
   │  LearningGap / StudentFeedbackActionPlan
   │  ↓
   │  StudentLearningNarrative
   │  ↓
   │  学生反馈与下一步训练提示
   │
   └─ AbilityEvidence[]
   ↓
   EvaluationResult
   ↓
   ProfileUpdateDecision
   ↓
   StudentAbilityProfile
   ↓
   GrowthMemoryRecord / GrowthMemorySummary
   ↓
   NextLearningStrategy
   ↓
   StrategyValidationResult
   ↓
   TaskRequest
   ↓
   TaskFulfillment
   ↓
   ConcreteLearningTask
   ↓
   下一轮真实作答
```

跨 Session 的延迟验证链：

```text
LearningSessionRecord
+ Evidence occurredAt
↓
DelayedRetestPlan
↓
新的复测任务与真实作答
↓
新的 AbilityEvidence
↓
Existing Evaluation / Profile / GrowthMemory Runtime
↓
RetentionEvaluationResult
```

真实 AI Diagnosis 链：

```text
Valid TaskExecutionResult
+ ConcreteLearningTask
↓
Versioned Real LLM Runtime
↓
Raw Output Isolation
↓
Schema / Identity / Boundary Validation
↓
Formal Diagnosis Candidate
↓
commitFormalDiagnosis()
↓
Committed DiagnosisResult
↓
Existing Evidence Return Runtime
```

## 三、权威关系

以下关系是跨 Phase 的稳定边界。

### 1. Evidence 与长期画像

```text
记录 AbilityEvidence
≠
更新 StudentAbilityProfile
```

Evidence 只有经过：

```text
EvaluationResult
-> ProfileUpdateDecision
-> Profile Executor
```

才可能改变长期画像。

### 2. 候选行动与长期判断

`EvidenceSummary / WeaknessRanking` 与 `EvaluationResult` 都消费 Evidence，但职责不同：

| 模块 | 回答的问题 |
| --- | --- |
| EvidenceSummary / WeaknessRanking | 当前哪些表现值得关注，候选行动方向是什么。 |
| EvaluationResult | 当前证据是否充分、是否冲突，最多允许形成多强的长期判断。 |

候选薄弱点不能直接决定长期能力状态。

### 2.1 Learning Gap 与能力状态

```text
Learning Gap
= 当前有效表现相对于正式任务要求缺少的能力动作
≠ Root Cause
≠ 长期 Ability Weakness
```

Learning Gap 只回答“当前还需要补充、修正或验证什么”，不能回答学生长期能力水平，也不能直接决定具体训练任务。无效作答或证据不足不得生成具体 Learning Gap。

当前 Runtime 通过 `TaskRequirementCoverage / primaryGap / gapReasonCode` 提供兼容表达，并通过只读 `StudentFeedbackGrounding` 将“已做到、主要缺口、改进动作”绑定到同一组正式来源。独立 `LearningGapAssessment` 已完成模型定义，但尚未作为新的正式持久化对象实现。长期语义见 [Learning Gap Model](../education/LEARNING_GAP_MODEL.md)。

### 3. LearningRound 与 LearningSession

```text
LearningRound
= 一次策略到 Evidence 回流的最小学习回合

LearningSession
= 一次连续学习活动，可以包含一个或多个 LearningRound
```

Session 结束只表示一次活动结束，不表示学习目标已经完成。

### 4. Retention 与正式更新

`RetentionEvaluationResult` 是对基线 Evidence 和延迟 Evidence 的比较观察，不是 AbilityEvidence，也不是 Phase 8 的输入。

延迟复测产生的新 AbilityEvidence 进入 Existing Phase 8 Runtime；Retention 只关联和解释已经形成的正式结果。

### 5. Evidence 质量与能力水平

```text
Evidence Quality 高
≠
学生能力高
```

质量等级只表示这条 Evidence 的判断条件和可信程度。Evidence 的方向仍可能是 positive、growth、weakness 或 insufficient。

### 6. 自适应约束与执行结果

`AdaptiveTaskConstraints.targetEvidenceQuality` 是观察目标，不是结果承诺。

任务执行后的真实 Evidence 质量，必须根据实际作答、提示依赖、材料关系、时间和追溯事实重新评估。

### 7. LLM 输出与正式 Diagnosis

```text
Raw Model Output
≠
Formal DiagnosisResult
```

只有通过 Schema、身份、语义边界和 Prompt 泄漏检查，并完成原子提交的 Candidate，才能成为正式 Diagnosis。Live 失败不能静默使用 mock 生成正式 Evidence。

### 8. Runtime 与学生展示

学生页面只消费学生可读状态和反馈，不重新判断能力，也不直接展示 Prompt、Raw Output、Evidence、Profile、内部 ID 或 Schema 字段。

## 四、核心对象

### 诊断与作答

| 对象 | 作用 |
| --- | --- |
| QuestionMetadata | 说明题目观察的能力、题型、Rubric 和评价方式。 |
| StudentResponse | 保存学生对具体任务的真实提交。 |
| StudentThinkingAnalysis | 依据原始作答与已校验 Coverage，描述已经完成的思考动作和答案连接断点，不还原学生内心。 |
| LearningGap | 描述当前表现相对任务要求缺少的能力动作，不等于 Root Cause 或长期能力结论。 |
| StudentFeedbackActionPlan | 把思考断点与 Gap 转换为学生可执行的思考问题和受控句式支架。 |
| StudentLearningNarrative | 将合法反馈事实投影为学生可理解的“已经完成的思考 / 思考缺口 / 下一步训练”。 |
| ResponseValidityResult | 判断回答是否具有最低限度的可观察表现。 |
| TaskExecutionResult | 作为任务执行层与 Diagnosis 层之间的正式交接对象。 |
| DiagnosisResult | 描述一次作答中的状态、表现、问题和根因假设。 |
| LearningGapAssessment | 描述有效表现相对于任务要求缺少的能力动作；当前为长期模型对象，Runtime 仍使用 `TaskRequirementCoverage / primaryGap / gapReasonCode` 兼容表达。 |
| StudentFeedbackGrounding | 当前反馈侧只读契约；把有依据的已完成动作、唯一主要 Gap 和可执行修改动作绑定到 Requirement 与来源链接，不形成长期能力结论。 |

### Evidence 与画像

| 对象 | 作用 |
| --- | --- |
| AbilityEvidence | 把一次真实表现沉淀为可追溯的能力证据。 |
| EvidenceSummary | 按能力汇总 Evidence 的方向分布。 |
| EvaluationResult | 判断多条 Evidence 是否足以支持正式状态结论。 |
| ProfileUpdateDecision | 决定画像是否以及如何更新。 |
| StudentAbilityProfile | 保存当前能力状态、关注点和待验证方向。 |

### 记忆与策略

| 对象 | 作用 |
| --- | --- |
| GrowthMemoryRecord | 保存一次评估、决策与画像变化事件。 |
| GrowthMemorySummary | 汇总近期成长轨迹，不重新生成能力结论。 |
| NextLearningStrategy | 决定下一步教育动作。 |
| StrategyValidationResult | 检查策略能否进入任务准备。 |
| TaskRequest | 把合法策略转换为任务模块可消费的请求。 |

### 任务与运行

| 对象 | 作用 |
| --- | --- |
| TaskResource | 保存可复用、可追溯的正式题目资源。 |
| ConcreteLearningTask | 某一学生在某一回合中可以真实完成的具体任务。 |
| TaskReadinessValidation | 判断任务能否展示、作答和进入 Diagnosis。 |
| LearningRoundResult | 保存一轮学习从策略到证据回流的运行结果。 |
| LearningSessionRecord | 把多个 Round 归入一次连续学习活动。 |
| UnifiedLearningEntryState | 把开始、继续、复测、反馈、阻断和结束状态转换为统一学生入口。 |
| Phase163MultiDayRunState | 保存多自然日运行事实、恢复、复测和异常演练状态。 |

### 内容资源准入

| 对象 | 作用 |
| --- | --- |
| StructuredQuestionDraft | 保存尚未成为正式资源的可编辑题目草稿。 |
| ResourceValidationResult | 校验题目内容、评价依据、能力、角色与版本关系。 |
| QuestionQualityAssessment | 评估当前 Draft Revision 的材料支持、观察价值、区分潜力与内部一致性，只提供审核建议。 |
| ResourceReviewDecision | 记录人工审核通过、退回或拒绝及其理由。 |
| FrozenQuestionResource | 保存通过校验和审核、不可静默修改的正式资源版本。 |
| ResourceRegistry | 维护资源的唯一当前冻结版本和完整版本历史。 |
| ResourceMatchQualityResult | 判断当前正式资源是否满足能力、角色、难度、材料、提示和版本约束。 |

### 跨时与质量

| 对象 | 作用 |
| --- | --- |
| DelayedRetestPlan | 记录为什么、何时以及针对什么能力进行延迟复测。 |
| RetentionEvaluationResult | 比较基线与延迟 Evidence，形成克制的保持性观察。 |
| EvidenceQualityAssessment | 评估一条 Evidence 的判断条件与使用限制。 |
| EvidenceConflictAssessment | 协调同一能力下多条 Evidence 的一致、混合与冲突关系。 |
| AdaptiveTaskConstraints | 在既有策略方向内约束任务角色、难度、材料和提示。 |

### 真实 AI Runtime

| 对象 | 作用 |
| --- | --- |
| DiagnosisRunRecord | 记录 Provider、Prompt、重试、耗时、Token 和验证状态。 |
| FormalDiagnosisCommit | 建立 Candidate 到正式 Diagnosis 的原子提交边界。 |
| DiagnosisQualityEvaluation | 在冻结样本上评估真实 Diagnosis 的教育可接受性。 |
| ControlledFeedbackResult | 把已确认、可追溯事实转换为学生可读反馈，并记录校验与模板回退状态。 |
| StudentLearningNarrativeProjection | 只读连接当前任务、本轮反馈、合法成长事实与下一策略，校验学生叙事的来源与表达边界，不产生新的教育结论。 |
| StudentLearningPresentation | 将已通过校验的叙事按“为什么练、发生了什么、怎么办、为什么继续”分阶段组织；不持久化，不参与正式判断。 |

## 五、Phase 状态

| Phase | 核心能力 | 当前状态 | 权威文档 |
| --- | --- | --- | --- |
| 1–4 | Diagnosis、Evidence、训练计划与 Student Profile 基础 | COMPLETE | [教育文档索引](../education/README.md) |
| 5 | Personalized Learning Runtime | PASS / FROZEN | [Phase 5 总结](../education/phase/phase5_summary.md) |
| 6 | Retest 与 Ability Change Evaluation | PASS / FROZEN | [Phase 6 总结](../education/phase/phase6_summary.md) |
| 7 | Beta Learning Flow | PASS / FROZEN | [Phase 7 总结](../education/phase/phase7_summary.md) |
| 8 | Evaluation、Growth Memory、Strategy 与 Task Fulfillment | PASS / FROZEN | [Phase 8 文档](../education/phase/phase8_1.md) |
| 9 | 真实任务执行与 Evidence 回流 | PASS / FROZEN | [Phase 9](../education/phase/phase9.md) |
| 10 | Learning Round Orchestration | PASS / FROZEN | [Phase 10 验收](../education/phase/phase10_acceptance_report.md) |
| 11 | Student Experience Alpha | PASS / FROZEN | [Phase 11](../education/phase/phase11.md) |
| 12 | Single-Student Usable Learning Foundation | PASS / FROZEN | [Phase 12 集成验收](../education/phase/phase12_integration_acceptance.md) |
| 12 UX Calibration | PC / Tablet 学习工作台体验准则 | ACCEPTED | [UX Calibration](../product/PC_LEARNING_WORKSPACE_UX_CALIBRATION.md) |
| 13 | Cross-Session、Delayed Retest 与 Retention | PASS / FROZEN | [Phase 13 验收](../education/phase/phase13_acceptance_report.md) |
| 14 | Evidence Quality、Conflict 与 Controlled Adaptation | PASS / FROZEN | [Phase 14](../education/phase/phase14.md) |
| 15.1 | Real LLM Runtime Foundation | PASS / FROZEN | [Phase 15.1](../education/phase/phase15_1.md) |
| 15.2 | Real Diagnosis Validation | PASS / FROZEN | [Phase 15.2 验收](../education/phase/phase15_2_acceptance_report.md) |
| 15.2 Policy v2.1 | Root Cause 校准与完整质量安全门 | 15 / 15 PASS / ACTIVE | [正式验收](../education/phase/reports/phase15_2/phase15-diagnosis-quality-policy-v2-1-acceptance-2026-07-17T11-00-12-239Z.md) |
| 15.3 | Controlled Feedback Expression | PASS / FROZEN | [Phase 15.3](../education/phase/phase15_3.md) |
| 15 | Real AI Diagnosis 与受控表达基础 | PASS / FROZEN | [Phase 15](../education/phase/phase15.md) |
| 16 | Structured Content 与 Real Learning Operation Foundation | ACCEPTED / IN PROGRESS | [Phase 16](../education/phase/phase16.md) |
| 16.1 | Structured Question Intake and Review | PASS | [Phase 16.1](../education/phase/phase16_1.md) |
| 16.2 | Resource Metadata and Matching Quality（16.2A / 16.2B 内部工作包） | PASS / FROZEN | [Phase 16.2](../education/phase/phase16_2.md) |
| 16.3 | Real Learning Operation and Multi-day Continuity（16.3A / B / C 内部工作包） | IN PROGRESS（A / B PASS / FROZEN；C ENGINEERING + HUMAN DEMO PASS / NATURAL-DAY PENDING 0 / 5） | [Phase 16.3](../education/phase/phase16_3.md) |
| 17 | Learning Resource Coverage Expansion + Material-grounded Ability Observation Foundation（17.1 / 17.2 / 17.3 / 17.4A / 17.4B / 17.5） | ACCEPTED / IN PROGRESS | [Phase 17](../education/phase/phase17.md) |
| 17.1 | Resource Coverage Contract | ENGINEERING + HUMAN DEMO PASS / INDEXEDDB SMOKE PENDING | [Phase 17.1](../education/phase/phase17_1.md) |
| 17.2 | Material Observation Design and First Frozen Resource Pack | ASSISTED DRAFT GENERATION 38 / 38 PASS / BATCH A OWNER REVIEW + FREEZE + REGISTRY + ACTIVE LINK 8 / 8 PASS / CONTROLLED LIVE EFFECTIVENESS PENDING | [Phase 17.2](../education/phase/phase17_2.md) |
| 17.3 | Formal Resource Runtime Integration and Source Preservation | WORK PACKAGE A 17 / 17 PASS / CONTROLLED LIVE 3 / 3 PASS / BATCH A `/learning` SINGLE-ROUND DEMO PASS | [Phase 17.3](../education/phase/phase17_3.md) |
| 17.4A | Shared Store Cutover | ENGINEERING + AUTOMATED DEBUG 10 / 10 PASS / STANDARD-BROWSER BASELINE CUTOVER + FRESH BASELINE QUALITY INITIALIZATION + CONTROLLED DUAL-CLIENT + INDEPENDENT BROWSER-KERNEL CONSISTENCY PASS | [Phase 17.4](../education/phase/phase17_4.md) |
| 17.4B | Migration and Recovery Hardening | PLANNED / P2 | [Phase 17.4](../education/phase/phase17_4.md) |
| 17.5 | Question Generation Quality Assessment | 17.5A 12 / 12 PASS；17.5B 9 / 9 PASS；17.5C1 18 / 18 PASS；17.5C2 17 / 17 PASS；17.5C3A 13 / 13 PASS；17.5C3B CALIBRATION RUNTIME 16 / 16 PASS / REAL TEN-MATERIAL CALIBRATION PENDING | [Phase 17.5](../education/phase/phase17_5.md) |

当前准确状态：

> 单学生、单浏览器、本地持久化的连续学习基础已经成立；Phase 15、16.2 已冻结，Phase 16.1 为 `PASS`。Phase 16.3A / B 已完成真实主链与统一入口；16.3C 已建立正式 `/learning`、服务端 Application Boundary、IndexedDB 多日记录和内部复核，工程模拟 `10 / 10 PASS`、Application Boundary Controlled Live Smoke 与 Lightweight Human Demo `4 / 4 PASS`。当前仍需完成 5—7 个自然日真实运行。

`/learning` 的当前入口状态由既有 `unifiedLearningEntryAgent` 统一解析并以 `UnifiedLearningEntryState` 输出，页面不得并行组合多个 Repository 原始记录决定主流程。Phase 16.3C 自然日验收应在学生入口与 PC / 平板页面收敛后，以同一稳定构建版本从 `0 / 5` 开始计时；验收期间影响入口状态机、身份关系或主流程的修复需要重新建立验收基线。

正式 `/learning` 与 Demo / Debug 已使用不同学生身份和数据作用域。产品入口只消费 `student-local-primary-v1` 对应的 Session、Round、Operation 与持久化记录；验收身份及带 Demo 标记的对象不得进入正式恢复或自然日计数。旧 Demo 数据保持隔离，内部清理只按 Demo 学生执行。作用域专项 Debug 为 `9 / 9 PASS`。

这里的 Phase 15 冻结表示 15.1、15.2、15.3 的 Runtime、专项质量验收和 `11 / 11` 确定性整链 Debug 均已成立。Phase 16.1 PASS 表示资源准入 Runtime `22 / 22`、Production Build 和最小工作台人工 Demo 已通过，不表示工作台 UX 或真实多日教学运行已经完成。Prompt v4 已成为正式 Provider 默认 Prompt；后续切换与回滚必须继续通过版本化配置显式执行。Phase 16.3A Controlled Live 已证明持久化第二任务串联，但不替代 16.3C 多日自然日验收。

## 六、各阶段能力地图

### Phase 1–7：学习闭环基础

建立了从题目诊断、Evidence、画像、个性化任务、学习 Session 到复测和能力变化判断的最小链路。

详细文档入口：[教育文档索引](../education/README.md)。

### Phase 8：判断、记忆、策略与任务准备

```text
Evidence
-> Evaluation
-> Profile Decision
-> Growth Memory
-> Next Strategy
-> TaskRequest
-> TaskFulfillment
```

详细文档入口：[Phase 8.1](../education/phase/phase8_1.md)、[Phase 8.2](../education/phase/phase8_2.md)、[Phase 8.3](../education/phase/phase8_3.md)、[Phase 8.4](../education/phase/phase8_4.md)。

### Phase 9：真实执行与回流

把任务资源转化为学生可执行任务，接收并校验真实作答，再将合法结果接回 Existing Diagnosis、Evidence 和 Phase 8 Runtime。

详细文档入口：[Phase 9](../education/phase/phase9.md)。

### Phase 10：Learning Round 编排

把 Phase 8 的策略链和 Phase 9 的执行链编排为一轮有开始、停止、失败和完成状态的学习回合。

详细文档入口：[Phase 10](../education/phase/phase10.md)。

### Phase 11：学生体验外壳

建立学生可独立完成的最小路径：进入任务、作答、获得可读反馈、理解本轮结果并找到下一步入口。

详细文档入口：[Phase 11](../education/phase/phase11.md)。

### Phase 12：单学生可持续学习

建立本地持久化、真实 TaskResource 和连续多轮运行，使上一轮正式结果能够保存、恢复并驱动下一轮。

详细文档入口：[Phase 12](../education/phase/phase12.md)、[集成验收](../education/phase/phase12_integration_acceptance.md)。

### Phase 13：跨 Session 与延迟复测

保存和查询跨 Session 历史，根据 Evidence 时间生成延迟复测计划，并将新的延迟 Evidence 转化为保持性观察。

详细文档入口：[Phase 13](../education/phase/phase13.md)、[验收报告](../education/phase/phase13_acceptance_report.md)。

### Phase 14：Evidence 质量与受控自适应

评估 Evidence 的判断价值，协调冲突 Evidence，并在 Existing Strategy 边界内生成结构化任务约束。

详细文档入口：[Phase 14](../education/phase/phase14.md)。

### Phase 15：真实 AI Diagnosis 与受控表达

Phase 15.1 已证明真实 Provider 可以安全进入 Runtime；Phase 15.2 已完成 Prompt v4 质量验证和 Policy v2.1 正式启用；Phase 15.3 当前确定性回归已扩展至 56 / 56 PASS，并保留既有 DeepSeek Live 12 / 12 和脱敏人工抽检 12 / 12，只把已确认事实转化为学生可读表达，越权或 Provider 失败时保留模板基线。学生点评与建议现在由同一主要缺口驱动：点评只描述本次完成情况，建议只提供下一步动作。独立整链 Debug 已以 11 / 11 验证 Formal Commit、Evidence Return、Phase 8、Phase 14.1 与 Controlled Feedback 的组合边界。Phase 15 当前为 `PASS / FROZEN`。

详细文档入口：[Phase 15](../education/phase/phase15.md)、[Phase 15.1](../education/phase/phase15_1.md)、[Phase 15.2](../education/phase/phase15_2.md)、[Phase 15.3](../education/phase/phase15_3.md)。

### Phase 16：结构化内容与真实学习运行

Phase 16.1 已建立正式题目资源的准入边界：人工录入先形成 Draft，通过结构化校验和人工审核后才能冻结为正式版本；Frozen Resource 不可静默编辑，修订必须生成新版本，ResourceRegistry 只指向唯一当前冻结版本。16.1A Runtime 为 `22 / 22 PASS`，16.1B 最小录入工作台已通过人工 Demo 验收，但连续录题效率与工作台 UX 仍需后续优化。

Phase 16.2A 已完成 `12 / 12 PASS`，Phase 16.2B 已完成 `16 / 16 PASS`：Registry 当前 Frozen Version 先经过身份、审核、校验、primary ability、task role、核心难度和 Rubric Gate，再由 Quality Gate 复核材料关系、近期重复、提示、能力要求、偏好和创建前 Registry 状态，形成正式四类分流。轻量 Match Review Demo 已完成 `8 / 8` Case 人工验收，Phase 16.1 -> 16.2 人工联调 Demo 已完成 `4 / 4 PASS`，并通过 PC / 平板布局检查；随后 [Phase 1–16.2 组合式全链路 Runtime 回归](../education/phase/reports/phase1_16_2_integrated_runtime_regression_2026-07-20.md) 完成 48 个确定性脚本与 Production Build，结果为 `PASS`。单对象 E2E 与受控 DeepSeek 真实 Provider Smoke 进一步取得 `5 / 5 PASS`。Phase 16.2 当前为 `PASS / FROZEN`。

Phase 16.3 已冻结设计并拆为三个顺序工作包。16.3A / B 为 `PASS / FROZEN`。16.3C 已把 `/learning` 接到正式 Orchestrator 与 IndexedDB Repository，并新增服务端 Diagnosis Application Boundary、多日事实记录及内部复核；正式资源池包含独立冻结的 `training / retest / transfer / observation / diagnosis` 资源，编排层只按能力和任务角色精确匹配，不改写 Frozen Version；工程模拟 `10 / 10 PASS`、Application Boundary Controlled Live Smoke 与 Lightweight Human Demo `4 / 4 PASS`，浏览器草稿恢复和无效作答闸门通过。正式入口在提交前预检 Diagnosis Runtime；服务端优先使用环境变量，并允许本地单学生运行从受控 macOS Keychain 读取 Provider Key。下一任务资源缺口表示“需要补充符合条件的正式任务”，不表示系统正在后台准备；资源补齐后只重新执行匹配，不重复调用 Diagnosis 或写入正式结果。当前为 `ENGINEERING + HUMAN DEMO PASS / NATURAL-DAY ACCEPTANCE PENDING (0 / 5)`；浏览器不得持有 Provider Key，Provider 未配置不得伪装成可无限重试的临时失败，Provider 失败不得回退到 mock Diagnosis。

详细文档入口：[Phase 16](../education/phase/phase16.md)、[Phase 16.1](../education/phase/phase16_1.md)、[Phase 16.2](../education/phase/phase16_2.md)、[Phase 16.3](../education/phase/phase16_3.md)。

### Phase 17：学习资源覆盖扩展

Phase 17 的目标不是扩充题目数量，而是建立以 Material Cluster 为组织基础、以能力观测为目标、能够被正式 Runtime 消费和验证的第一套学习资源体系。阶段在既有 Phase 16 资源准入与匹配边界上建立 `Material -> Observation Dimension -> Ability Action -> Question Resource` 的材料能力观测基础。Material 是正式内容、语境和来源权威；Frozen Resource 必须引用确定的 Material Version，历史 Response、Diagnosis 与 Evidence 保留执行时版本和内容哈希，版本缺失、错位或 Anchor 失效必须阻断。17.1 Coverage Runtime 与 Dashboard 人工验收已通过；17.2 已完成 Material Observation、最小生产工作台、Prompt v1.4 / Generator Contract v1.2 辅助首稿生成工程闭环和 Batch A 8 道正式资源，Assisted Draft Generation 为 `38 / 38 PASS`，但三轮真实 Provider 生成质量验收仍为 `PENDING`。17.3 Work Package A 正式资源串联为 `17 / 17 PASS`，Work Package B Controlled DeepSeek Live 为 `3 / 3 PASS`；Batch A `/learning` 单轮 Demo 已证明正式资源、真实 Diagnosis、Evidence、学生反馈和刷新幂等成立，下一任务缺少兼容资源时安全阻断。17.4A 已建立本机 Shared Store、Local API、Repository Adapter、显式基线初始化和基本备份，专项 `10 / 10 PASS`，标准浏览器基线切换与全新基线质量初始化已完成；A 写 B 读、B 发布 A 读、旧 Revision `409` 和服务重启持久化已在受控双端人工检查中通过；Codex 内置浏览器与隔离用户目录的独立 Google Chrome 又完成双向写入、刷新读取和临时数据清理，独立浏览器内核一致性门已关闭。Shared Store API 目前由本机 Vite 服务提供，仍属于单机封闭 Beta 基础设施；17.4B 再完成复杂迁移报告、冲突治理、历史快照和自动恢复。17.5A 已建立绑定 Draft Revision 与当前 Validation 的 Question Quality Assessment、七项确定性检查、Revision 失效规则和不可变 Repository，专项 `12 / 12 PASS`；17.5B 已完成审核页质量摘要、Warning 展示、Human Review / Freeze 当前 Assessment 消费门与专项 `9 / 9 PASS`；17.5C1 独立语义评估 `18 / 18 PASS`，17.5C2 质量持久化与 Frozen Trace `17 / 17 PASS`，17.5C3A 批次质量摘要 `13 / 13 PASS`，17.5C3B 十素材校准 Runtime `16 / 16 PASS`。固定真实十篇材料的采集、运行、人工观察与签署仍未完成，因此 17.5 整体仍为 `PENDING`。质量评估不自动审核或冻结，也不替代 16.2 正式资源匹配质量门。当前产品定位为“已通过真实单轮学习链路验收、具备正式资源发布前质量治理和本机共享持久化基础的单学生封闭 Beta”；下一主任务是真实十素材校准，随后再扩展资源生态、连续 Session 和学生感知验收。仍不得提前宣称完整 24—28 道资源包、多轮路径、资源使用后自优化闭环或 Phase 17 最终 PASS。Observation Dimension 暂不进入 Evidence、Profile 或正式 Coverage denominator；完整 Material 治理体系不在 17.3 范围内。

详细文档入口：[Phase 17](../education/phase/phase17.md)、[Phase 17.1](../education/phase/phase17_1.md)、[Phase 17.2](../education/phase/phase17_2.md)、[Phase 17.2 First Formal Resource Pack Production Blueprint](../education/phase/phase17_2_first_resource_pack_blueprint.md)、[Phase 17.3](../education/phase/phase17_3.md)、[Phase 17.4](../education/phase/phase17_4.md)、[Phase 17.5](../education/phase/phase17_5.md)。

## 七、当前重要边界

1. 无效回答不进入 Diagnosis，不生成 weakness Evidence。
2. Diagnosis 能力错位或结构非法时进入 blocked / review，不强行改写。
3. 同一正式执行结果不能因刷新、恢复或重试重复生成 Evidence。
4. 页面不直接读写持久化实现，统一通过 Repository 边界。
5. TaskResource 是可复用资源，ConcreteLearningTask 是某一轮的执行实例。
6. NextStep 只描述流程动作，不替代 NextLearningStrategy 的教育决策。
7. Evidence 冲突不能靠简单平均或只取最后一次结果解决。
8. 提示后完成是有效观察，但不等同独立完成。
9. 延迟复测到期不等于能力下降，也不等于自动开始复测。
10. Phase 14 的质量与冲突上下文不能静默替换 Existing Phase 8 legacy 语义。
11. Shadow AI 结果不 Commit、不生成 Evidence、不更新 Profile。
12. `questionable` 的离线质量结果需要人工复核，不能自动回流。
13. Prompt v4 通过质量验证不等于已经静默成为所有正式 Provider 调用的默认 Prompt。
14. Controlled Feedback 只能表达上游已确认事实，不能新增 Diagnosis、Evidence 或长期能力结论。
15. StructuredQuestionDraft 不是正式资源，只有审核有效的 FrozenQuestionResource 可以进入正式匹配。
16. FrozenQuestionResource 不可静默修改；修订必须生成新版本，旧版本只有在新版本正式冻结后才可 supersede。
17. 资源准入通过不等于匹配成功，匹配成功也不等于已经证明教学有效。

## 八、尚未完成或尚未产品化

当前尚未证明或尚未完成的主要能力：

- Prompt v4 后续版本切换、回滚和真实错误样本的持续质量回归；
- Phase 15 后续真实使用错误样本回收与版本化质量回归；
- Existing Phase 8 对 Quality / Conflict Context 的正式消费升级；
- Phase 16.3 单学生 5—7 个自然日真实学习运行；
- 学生真实使用页面的 PC / 平板体验校准，以及内部工具与验收入口的统一集合；
- 结构化题目录入工作台的高频生产 UX、模板和批量导入；
- 正式题库的权限、版权治理、云同步和多人协作；
- 多学生、账号、云端持久化与跨设备恢复；
- 长期多周期 Evidence 与 Retention 趋势；
- 家长报告、成长曲线和家长端；
- AI Coach 正式介入策略；
- 真实教学效果和长期能力提升验证。

这些限制不否定当前 Runtime 已成立的能力，也不能被当前 Debug 或 Demo 结果替代证明。

## 九、文档入口

| 想了解什么 | 阅读入口 |
| --- | --- |
| 产品负责人控制层、产品级验收和当前优先顺序 | [Product Owner Control Table](../product/PRODUCT_CONTROL_TABLE.md) |
| 当前系统如何运转 | 本文档 |
| Runtime 对象如何传递 | [Learning Runtime Overview](LEARNING_RUNTIME_OVERVIEW.md) |
| 最小闭环开发原则 | [Growth Loop Overview](../education/phase/GROWTH_LOOP_OVERVIEW.md) |
| 当前阶段文档总索引 | [Education README](../education/README.md) |
| Phase 16 当前目标与边界 | [Phase 16](../education/phase/phase16.md) |
| Phase 16.1 题目准入与审核 | [Phase 16.1](../education/phase/phase16_1.md) |
| Phase 16.2 资源匹配质量 | [Phase 16.2](../education/phase/phase16_2.md) |
| Phase 16.3 真实学习运行 | [Phase 16.3](../education/phase/phase16_3.md) |
| Phase 17 学习资源覆盖扩展 | [Phase 17](../education/phase/phase17.md) |
| Phase 17.1 资源覆盖契约 | [Phase 17.1](../education/phase/phase17_1.md) |
| Phase 17.2 材料观测设计与首批正式资源包 | [Phase 17.2](../education/phase/phase17_2.md) |
| Phase 17.3 正式资源运行集成与来源保持 | [Phase 17.3](../education/phase/phase17_3.md) |
| Phase 17.4 本机共享正式资源持久化 | [Phase 17.4](../education/phase/phase17_4.md) |
| Phase 17.5 题目生成质量评估 | [Phase 17.5](../education/phase/phase17_5.md) |
| 结构化运行时错误契约 | [补强与验收记录](../education/phase/reports/structured_runtime_error_contract_2026-07-26.md) |
| Phase 16.3C 轻量人工验收 | [验收报告](../education/phase/reports/phase16_3c_demo_acceptance_2026-07-21.md) |
| Phase 16.3 Product / Demo 作用域隔离 | [验收报告](../education/phase/reports/phase16_3_product_demo_scope_isolation_debug_2026-07-21.md) |
| Phase 1–16.2 组合式 Runtime 回归 | [集成回归记录](../education/phase/reports/phase1_16_2_integrated_runtime_regression_2026-07-20.md) |
| 某个 Phase 的规则与验收 | 对应 `docs/education/phase/phase*.md` |
| PC / 平板学生体验原则 | [PC Learning Workspace UX Calibration](../product/PC_LEARNING_WORKSPACE_UX_CALIBRATION.md) |
| 单学生产品页面与入口收敛 | [Product Interface Consolidation](../product/STUDENT_PRODUCT_INTERFACE_CONSOLIDATION.md) |
| 学生学习叙事校准 | [Student Learning Narrative Calibration](../product/STUDENT_LEARNING_NARRATIVE_CALIBRATION.md) |
| 产品负责人控制表 | [Product Owner Control Table](../product/PRODUCT_CONTROL_TABLE.md) |

推荐阅读顺序：

```text
SYSTEM_MAP
-> LEARNING_RUNTIME_OVERVIEW
-> 当前 Phase 总纲
-> 当前子 Phase 文档
-> 对应 Model / Runtime / Acceptance 文档
```

## 十、维护规则

后续更新 `SYSTEM_MAP` 时遵循以下规则：

1. 只记录最新状态，不保留阶段状态变更流水账；
2. 每个 Phase 只保留一句能力说明、核心关系、当前状态和权威链接；
3. 不复制 Schema 字段、Debug Case、指标公式和实现文件清单；
4. 跨模块不变量可以保留，模块内部规则移回权威文档；
5. 新增内容前先判断它属于地图、Phase、Model、Runtime 还是 Acceptance；
6. 删除重复内容前，先确认对应权威文档已经承载该信息；
7. Phase 状态变化时同步状态表，但不在本文档复制完整验收报告。

一句话维护原则：

> `SYSTEM_MAP` 说明系统由什么组成、模块如何连接、目前走到哪里；具体模块如何判断、如何实现、如何验收，由下级权威文档负责。
