# 系统地图（System Map）

本文档是系统的总导航，不是 Schema、实现说明或验收日志。

它只回答五个问题：

1. 产品的核心学习链路是什么；
2. 关键对象分别负责什么；
3. 模块之间有哪些权威关系；
4. 当前各 Phase 处于什么状态；
5. 详细规则应去哪里查阅。

字段、算法、Debug Case、指标分母和验收过程，以对应 Phase、Model、Runtime 与 Acceptance 文档为准。

## 零、当前事实层（2026-08-29）

本节只保存当前导航事实；历史 Phase 数量和验收状态不得覆盖本节。

| 主题 | 当前事实 | 权威来源 |
| --- | --- | --- |
| 学生入口 | `/learning` 是唯一学生产品入口 | [WP0A 角色对齐决策](../product/STUDENT_SINGLE_ENTRY_FORMAL_READING_AND_KNOWLEDGE_PRACTICE_ALIGNMENT_DECISION_WP0A.md) |
| 正式题库 | 24 篇材料、81 道 Current；63 道核心阅读、18 道条件微训练 | 正式资源只读基线与 [核心阅读新会话准入报告](../education/phase/reports/core_reading_new_session_admission_boundary_fix_2026-08-28.md) |
| 轻量知识题 | 27 道历史迁移 + 7 道 WP5 审核补充；19 approved、15 draft；3 个批准变式组、6 条有向 Link | [WP5 工程验收报告](../product/KNOWLEDGE_PRACTICE_PHASE1_WP5_ENGINEERING_ACCEPTANCE_REPORT.md) |
| 知识练习工程 | WP1—WP6 + WP7A Engineering PASS；WP7B D1—D12已确认、Engineering Acceptance已授权未开始 | [WP7B 工程实施文档](../product/KNOWLEDGE_PRACTICE_PHASE1_WP7B_FULL_CHAIN_REGRESSION_AND_PRODUCT_ACCEPTANCE_PLAN.md) |
| Trial | 历史报告包含激活、失效、重新准入和新窗口样本；当前终态必须以现场 Runtime Identity、Window 与 Activation State 的最新签署为准 | [运行可靠性与重新准入契约](../product/PRODUCT_RUNTIME_RELIABILITY_AND_REAL_TRIAL_REENTRY_CONTRACT.md) |

当前资源口径必须区分：库存 `81`、普通核心池 `63`、条件微训练池 `18` 和学生当下被调度的下一任务。不得把轻量知识题的 `19 approved` 表述为全项目题量。

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

学生产品入口关系：

```text
/learning（唯一学生入口）
├─ 正式阅读与能力训练
│  └─ Formal Resource → Learning → Diagnosis / Evidence → Retest / Transfer
└─ 基础知识巩固（knowledge_practice 辅助任务家族）
   └─ Knowledge Question → PracticeSession → 本轮反馈 / 短期巩固
```

两类任务共享学生入口、身份与产品表达，但第一阶段继续隔离 Session、Store、判题器和结论层级。知识练习事实不得未经新契约写入正式 Evidence、Profile 或 Trial 教育效果分母。

正式内容进入链：

```text
StructuredQuestionDraft
↓
ResourceValidationResult
↓
QuestionQualityAssessment
├─ 有提醒且需要改写 -> AI 题干建议 -> 人工采用 -> 新 Draft Revision -> 重新校验与评估
└─ 当前结果可进入审核
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

真实使用中的 Session / Round、核心过程事件、校准 Attempt、后续家长观察与多使用者边界，统一遵循[真实 Learning 数据采集与观察契约](../product/REAL_LEARNING_DATA_COLLECTION_AND_OBSERVATION_CONTRACT.md)。当前复用固定产品学生身份，五事件最小链、完成轮次后的自动校准接续、失败恢复和内部完整性报告均已完成；家长报告和多使用者后置。该契约继续区分工程能力、真实运行数据与群体校准结论，不得把自动化验收误报为真实样本已经充足。

五事件字段、稳定身份、IndexedDB Repository、Outbox 补写、Attempt 投影、开放题评分和 P3 一致性公式由[真实 Learning 最小采集工程契约](../product/REAL_LEARNING_MINIMUM_COLLECTION_ENGINEERING_CONTRACT.md)冻结。`WP0—WP7` 已完成代码、自动化与浏览器验收，当前可以进入固定单学生的真实 Learning 受控运行；单学生单轮数据仍不得伪造 `totalScore` 或高低组区分度。

Training 首次反馈后的一次修订由[Learning 反馈后修订契约](../product/LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md)定义。该能力保持 Initial Response 与 Revised Response 分离、每题一个 LearningTaskAttempt、Revision 不新增题目校准 Attempt，并禁止在 Retest、Transfer、Maintenance 和 Formal Assessment 中提供即时修订。阶段 1–4 已完成 Schema、稳定身份、IndexedDB v4、草稿恢复、独立提交、Revision Evaluation、feedback-supported Evidence、受控 Profile / Growth Memory、扩展事件、Outbox 恢复、完整性审计和内部指标，且通过端到端联调。提交态只确认修订已独立保存；只有 Formal Evaluation 完成后才表述改善结果，真实教育效果仍需 Retest / Transfer 校准。

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

### 8. 基于 Revision 的质量评估失效

```text
正式对象 Revision N
+ Assessment N
↓
质量相关字段发生修改
↓
正式对象 Revision N + 1
↓
Assessment N 只保留用于历史追溯
↓
基于 Revision N + 1 重新评估
```

任何会改变正式质量判断输入的编辑，都必须使相关 Assessment 失效。旧结果不能继续代表新内容，也不能被 Review、Freeze、Registry 或正式 Runtime 当作当前依据。

当前规则适用于 Question 的题干、Rubric、Answer Acceptance、Difficulty、Ability Mapping、Material 关联与其他持久化内容；Material Observation 修改同样必须形成新 Plan Revision，并使依赖旧 Observation 或 Anchor 的下游质量判断进入重新确认。审核备注、界面展开状态等不改变正式对象的操作不触发失效。

失效不等于删除：旧 Revision 与旧 Assessment 继续保留用于审计；已经发布的版本不被覆盖，修改必须通过新 Revision 重新检查、审核和发布。

草稿保存采用业务内容签名判断，不以按钮点击次数作为 Revision 依据。签名只包含会进入 `StructuredQuestionDraft` 的正式字段，不包含展开状态、焦点或提示条等界面状态。当前表单与最近一次成功保存的签名一致时，保存动作必须禁用；字段发生有效变化后才允许保存。保存期间必须阻止重复提交，保存成功后重新建立基线签名。该规则用于避免同一内容反复写入相同 Revision 语义，但不等于 Freeze；草稿仍可继续编辑，正式资源只在审核通过并发布时冻结。

Shared Formal Resource Store 的 Revision 竞争与业务对象 Revision 冲突必须分开处理。服务返回 `SHARED_RESOURCE_REVISION_CONFLICT` 时，客户端基于最新共享快照使用指数退避和随机抖动重放同一受控 Mutation，最多 6 次；该恢复仅适用于 Shared Store 乐观并发写入，不得绕过 Draft、Assessment、Human Review、Freeze 或 Formal Resource 的 `expectedRevision` 校验。重试耗尽统一归一化为可安全重试的 `SHARED_STORE_REVISION_CONFLICT`，首层页面只显示中文恢复说明，技术码按需展开，并禁止从错误文本中生成虚假对象 ID。

### 9. Runtime 与学生展示

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
| TargetedMicroTrainingTriggerDecision | 记录某次正式核心表现是否具备一次针对性短片段训练资格；无资格与无匹配均是正常终止。 |
| TargetedMicroTrainingRequest / Assignment | 以正式 Gap 与 Ability 精确请求一项微训练，并冻结资源身份和返回核心题组的游标。 |
| TargetedMicroTrainingSessionOverlay | 在不改写核心任务队列的前提下保存当前微训练、返回位置和 Session 限额状态。 |
| Phase163MultiDayRunState | 保存多自然日运行事实、恢复、复测和异常演练状态。 |

### 内容资源准入

| 对象 | 作用 |
| --- | --- |
| StructuredQuestionDraft | 保存尚未成为正式资源的可编辑题目草稿。 |
| ResourceValidationResult | 校验题目内容、评价依据、能力、角色与版本关系。 |
| QuestionQualityAssessment | 评估当前 Draft Revision 的材料支持、观察价值、区分潜力与内部一致性，只提供审核建议。 |
| QuestionStemOptimizationResult | 保存一次仅针对题干文字的临时 AI 建议；人工采用后仍需形成新 Draft Revision 并重新校验与评估。 |
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
| StudentLearningPresentation | 将已通过校验的叙事按“为什么练、发生了什么、怎么办、动态调整时为什么变化”分阶段组织；固定题组顺序导航不展示继续原因；不持久化，不参与正式判断。 |

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
| 17.5 | Question Generation Quality Assessment | 17.5A RULE V2 14 / 14 PASS；REVIEW STEM OPTIMIZATION 8 / 8 PASS；17.5B 11 / 11 PASS；17.5C1 18 / 18 PASS；17.5C2 22 / 22 PASS / WORKBENCH FORMAL CHAIN INTEGRATED；17.5C3A 13 / 13 PASS；17.5C3B CALIBRATION RUNTIME 16 / 16 PASS / REAL TEN-MATERIAL CALIBRATION PENDING | [Phase 17.5](../education/phase/phase17_5.md) |

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

Phase 17 的目标不是扩充题目数量，而是建立以 Material Cluster 为组织基础、以能力观测为目标、能够被正式 Runtime 消费和验证的第一套学习资源体系。阶段在既有 Phase 16 资源准入与匹配边界上建立 `Material -> Observation Dimension -> Ability Action -> Question Resource` 的材料能力观测基础。Material 是正式内容、语境和来源权威；Frozen Resource 必须引用确定的 Material Version，历史 Response、Diagnosis 与 Evidence 保留执行时版本和内容哈希，版本缺失、错位或 Anchor 失效必须阻断。17.1 Coverage Runtime 与 Dashboard 人工验收已通过；17.2 已完成 Material Observation、最小生产工作台、Prompt v1.4 / Generator Contract v1.2 辅助首稿生成工程闭环和 Batch A 8 道正式资源，Assisted Draft Generation 为 `38 / 38 PASS`，但三轮真实 Provider 生成质量验收仍为 `PENDING`。17.3 Work Package A 正式资源串联为 `17 / 17 PASS`，Work Package B Controlled DeepSeek Live 为 `3 / 3 PASS`；Batch A `/learning` 单轮 Demo 已证明正式资源、真实 Diagnosis、Evidence、学生反馈和刷新幂等成立，下一任务缺少兼容资源时安全阻断。17.4A 已建立本机 Shared Store、Local API、Repository Adapter、显式基线初始化和基本备份，专项 `10 / 10 PASS`，标准浏览器基线切换与全新基线质量初始化已完成；A 写 B 读、B 发布 A 读、旧 Revision `409` 和服务重启持久化已在受控双端人工检查中通过；Codex 内置浏览器与隔离用户目录的独立 Google Chrome又完成双向写入、刷新读取和临时数据清理，独立浏览器内核一致性门已关闭。Shared Store API 目前由本机 Vite 服务提供，仍属于单机封闭 Beta 基础设施；17.4B 再完成复杂迁移报告、冲突治理、历史快照和自动恢复。17.5A 已建立绑定 Draft Revision 与当前 Validation 的 Question Quality Assessment、七项确定性检查、Revision 失效规则和不可变 Repository，材料依据规则 v2 专项 `14 / 14 PASS`；审核平台增加只改题干的受控 AI 建议，专项 `8 / 8 PASS`，采用建议后旧 Assessment 失效，必须保存并重新检查；17.5B 已完成审核页质量摘要、Warning 展示与专项 `11 / 11 PASS`；17.5C1 独立语义评估 `18 / 18 PASS`，17.5C2 质量持久化与 Frozen Trace `22 / 22 PASS`，正式 Workbench 已接入完整质量 Bundle、Human Review 身份绑定和 Frozen Trace 原子主链；17.5C3A 批次质量摘要 `13 / 13 PASS`，17.5C3B 十素材校准 Runtime `16 / 16 PASS`。固定真实十篇材料的采集、运行、人工观察与签署仍未完成，因此 17.5 整体仍为 `PENDING`。质量评估和题干建议都不自动审核或冻结，也不替代 16.2 正式资源匹配质量门。当前产品定位为“已通过真实单轮学习链路验收、具备正式资源发布前质量治理和本机共享持久化基础的单学生封闭 Beta”；下一主任务是真实十素材校准，随后再扩展资源生态、连续 Session 和学生感知验收。仍不得提前宣称完整 24—28 道资源包、多轮路径、资源使用后自优化闭环或 Phase 17 最终 PASS。Observation Dimension 暂不进入 Evidence、Profile 或正式 Coverage denominator；完整 Material 治理体系不在 17.3 范围内。

素材资源录入平台采用 Material-scoped Workspace：顶部以“已有素材 / 录入新素材 / 已停用素材”三个模式区分使用、创建与生命周期管理。用户明确选择或保存 active Material Version 后，系统才建立当前素材上下文，并只投影该素材的只读正文、待审核资源、发布未完成题目、已发布练习及后续生成、编辑、审核入口；未选择素材或进入停用素材管理模式时，下游生产模块保持隐藏。训练任务卡首层只保留来源、审核状态及固定顺序“能力目标、题目、学生任务、观察目标”，其中能力目标定义训练内容，学生任务定义作答动作，观察目标定义可验证表现；详细评分、答案示例和设计依据按需展开。当前主流程不再提供独立“题目详情”入口；已发布任务通过卡片内“查看正式资源”展开只读身份、版本和来源追溯，旧 `task-detail` 深链仅保留只读兼容。“提交题目审核”只复核版本、任务数量、能力覆盖、训练方向、材料范围和结构检查，不重复渲染完整题目列表。只读正文默认提供有限段落预览，并通过唯一入口展开或收起全文，不与训练任务编辑区重复渲染。切换素材必须同时切换统计、正文预览与明细上下文。Material Version 支持 `active -> retired -> active` 的可逆状态流转，停用保留既有训练、题目和来源关系；只有完全无依赖的未使用素材可以删除。跨素材全局库存属于资源总览或 Coverage Dashboard，不属于单素材生产工作台。

训练任务的覆盖范围与检查结果统一收敛到单一“训练任务检查”板块：首层只展示是否可进入审核、任务总数、可审核数、需调整数，以及能力和训练方向摘要；存在问题时再展开质量提醒与定位入口。覆盖摘要不再作为独立卡片重复占用页面层级，合并仅调整信息架构，不改变校验口径、问题定位或提交流程。

素材资源录入平台的最新界面校准见 [素材资源录入平台 UX 校准记录](../product/MATERIAL_WORKBENCH_UX_CALIBRATION_2026-07-30.md)。当前素材信息、正文预览、训练任务标题、资源统计和任务检查按工作对象重新分组；平台顶栏、刷新入口、AI 操作、候选对照表、辅助文案与 `24px / 16px / 8px` 间距规则已经统一。该校准只调整页面呈现，不改变 Material、Plan、Draft、Assessment、Review、Freeze 或 Registry 的正式数据与状态边界。

Material 已保存但尚未生成 Material Observation Plan 是合法的生产空状态，不等于存在待修改训练任务。该状态下任务集合必须为 `0`，只提供 AI 规划入口；不得用表单占位项驱动任务统计、Validation、Assessment、问题定位或审核门禁。训练任务检查只消费 AI 生成并被采用的真实任务，或从有效 Plan 恢复的任务。空任务集合不能保存任务组、创建 Plan Revision 或进入题目审核。

同一 Material Observation Plan 内的题号绑定 Observation Task 的计划顺序，并通过 `observationTaskPlanId` 在 Question Draft、审核状态与 Frozen Resource 之间保持稳定。待审核与已发布明细只按状态过滤，并按统一题号升序展示，不建立各自独立的编号序列；状态迁移不得改变题号。因此单个状态列表可以出现“题目一、题目三”这类不连续编号，它表达的是同一素材完整题目序列中的真实位置。

题目质量检查采用“证据边界清晰”规则，而不是固定句式或段落号规则。题干只要能让学生明确应从什么材料范围寻找、组织和引用依据即可：可以指向具体段落、场景、原句或关键词，可以明确要求综合全文，也可以允许自主选取指定数量和类型的文本证据。只有笼统写“结合材料”且未说明局部、全文或取证方式时才产生提醒；完全脱离材料时仍建议修订。界面中的参考写法只用于说明规则，不是必须照抄的模板。

Material Observation Plan 是训练任务主要能力、任务用途和难度的唯一计划来源：能力目标使用 `taskPlans[].abilityId`，任务用途使用 `taskPlans[].taskRole`，难度使用 `taskPlans[].difficulty`；进入 Question Draft 后分别映射到 `abilityMetadata.abilityId`、`abilityMetadata.taskRole` 和 `abilityMetadata.difficulty`。题目审核平台只沿用并核对计划值，不建立第二套可独立漂移的训练设置。发布未完成题目的修订以 Observation Task 和稳定修订根为身份边界，同一题目重复进入修复流程时复用当前有效修订稿，发布前必须重新通过计划一致性检查。质量提醒的“定位修改”只能指向当前模式中真实存在且可编辑的字段，并在目标缺失时显式反馈，不得静默失败。

Phase 17 录入端的能力目标、具体训练点、题目、学生任务与观察目标统一遵循 [Authoring Field Contract v1](../product/AUTHORING_FIELD_CONTRACT.md)。该契约是素材资源录入平台、题目审核发布平台、AI 输出、保存适配、质量检查和问题定位的共同解释源：题目只负责学生“回答什么”，学生任务负责“如何作答”，观察目标负责“检查什么表现”；评分标准再定义完成水平。字段注册表、往返保存、Assessment 失效、定位修改、AI 局部重写与旧数据适配的 P0 / P1 / P2 自动化回归已经通过；真实任务浏览器验收与十素材校准仍为 `PENDING`。

Phase 17 的录入、题目人工审核与发布正式化遵循 [Authoring, Review and Publication Responsibility Contract](../product/AUTHORING_REVIEW_PUBLICATION_RESPONSIBILITY_CONTRACT.md)：录入端负责发现问题、修改内容和提交前检查；审核端在 `pending_review` 后只读查看最终内容、学生预览与录入检查摘要，并对必须确认的 Warning 作出接受或退回决定；发布过程只验证当前 Revision、Assessment、Human Review 与正式化写入的一致性。`ReviewWarningDecision` 绑定 `draftId + draftRevision + assessmentId + warningCode`，未决提醒阻止审核通过。P1 已补齐提交人、审核人、提交时间、撤回与重提事件以及按资源聚合的审核时间线；`pending_review` 可以安全撤回为录入状态，但撤回只改变流程状态并追加审计事件，不创建内容 Revision。审核内容页默认只显示关联材料标题和范围，全文按需展开。审核通过后的 Revision 不可原地修改；发布部分失败只重试缺失写入，不回滚审核或增加正式版本。

审核页的检查记录完整性现在也是统一硬门禁：当前 Revision 缺少有效 Validation、Assessment Bundle 或当前规则版本结果时，待确认事项不可接受、审核通过不可执行，只能退回录入端重新检查。`退回录入修改` 是审核者的质量裁决；`撤回至录入端` 是提交者在形成审核决定前的低频治理操作，位于“更多操作”，两者均不直接创建内容 Revision。状态投影按对象分层：组级显示“训练计划已确认”，任务卡显示“自动检查通过 / 待调整 / 已纳入当前计划”，题目显示“待人工审核 / 审核通过”，正式资源显示“已发布”。首层版本使用“第 N 版”，内部 Revision 与 ID 仅进入追溯视图。

题目批次统计继续复用同一份展示状态投影，并按题目唯一归入 `待处理`、`待人工审核`、
`审核通过（待发布）`、`已发布` 四个互斥状态桶。`本批题目（N）` 只作为总量基准，
四个状态桶之和必须等于 `N`；当同一道题同时存在 Draft、Review 与 Formal Resource 信号时，
按 `已发布 > 审核通过（待发布） > 待人工审核 > 待处理` 的优先级去重归类，不得直接累加
底层记录数量。

退回后的恢复链路继续沿用同一题目的 `materialVersionId + planId + draftId`：确认退回后直接打开被退回题目的录入状态，按结构化 `issueType` 定位题目、训练目标、难度或评分标准，并显示“待修改 → 修改待保存 → 已保存待重新检查 → 可重新提交”的进度。退回本身不创建 Draft，实际保存才形成受控的新 Revision；重新提交只追加同一资源根的提交事件，不得批量生成兄弟题目。具体规则见职责边界契约第十九章与题目审核工作流契约第十八章。

“提交题目人工审核”已经收敛为可恢复的阶段化命令：训练计划提交、训练计划确认和待审核题目创建分别返回完成结果；中途失败时页面说明已完成阶段，重试从持久化状态继续，不重复提交计划、确认计划或创建 Draft。素材录入页的创建操作同时完成交互规范收口：无素材上下文时默认进入“素材录入”，带 `materialVersionId` 的返回或深链仍恢复对应“已有素材”；模式顺序为“素材录入 / 已有素材 / 停用素材”，保存与清空是同组的主次操作，输入聚焦统一使用不改变尺寸的 `1px` 蓝色边框与 `2px / 30%` 蓝色透明外投影。按钮、链接、可点击摘要、文本输入、选择控件和禁用控件分别使用与操作语义一致的指针反馈，纯展示区域不伪装成入口。颜色和控件语义以 [Product Color Semantics](../product/PRODUCT_COLOR_SEMANTICS.md) 为准。

当前素材选择属于可恢复的页面导航状态，不属于 Material、Observation Plan 或其他正式资源事实。页面恢复优先级固定为 `URL materialVersionId / planId > 当前组件内选择 > sessionStorage 会话记忆 > 无选择`：审核页返回和显式深链始终以 URL 为准；同一浏览器标签页内切换“素材录入 / 已有素材 / 停用素材”只改变可见模式，不销毁最后选中的 active Material；离开工作台后再返回且 URL 未携带素材上下文时，可以恢复本次浏览器会话最后确认的素材与有效计划。恢复前必须用最新 active Material 与对应 Plan 清单校验记录；素材已删除、已停用、版本不存在或计划不再属于该素材时，清除失效部分并回到无选择状态或该素材的当前有效计划。`sessionStorage` 不保存素材正文、未保存表单、训练任务编辑缓冲、候选任务或正式审核状态，关闭浏览器会话后也不承担长期恢复职责。

训练任务规划遵循 [Single Training Task Regeneration Contract](../product/SINGLE_TRAINING_TASK_REGENERATION_CONTRACT.md) 与 [Training Task Group AI Planning Contract](../product/TRAINING_TASK_GROUP_AI_PLANNING_CONTRACT.md)。单任务重生成、补充候选与整组替代候选均先进入 Candidate Session，人工采用只更新编辑缓冲区；同一轮修改只维护一个可变工作草稿，反复保存或连续采用候选不堆叠 Revision。只有提交题目审核才冻结一个不可变 Plan Revision；从不可变版本开始下一轮实质修改时才创建新的工作草稿。自动化回归已覆盖三轮连续候选采用后仅保留一个 Revision，真实浏览器闭环仍待验收。

题目资源工作台采用稳定页面身份：同一批次内选择草稿、待人工审核、审核通过待发布或已发布题目，页面标题始终为“题目资源工作台”。生命周期状态只在当前题目的局部标题、状态标签和可用动作中呈现；不得因切换处理对象而把同一路由伪装成“题目修改与提交”“题目发布平台”或“已发布题目”等不同页面。

当前真实训练任务数为 `0` 时，整组 AI 生成在产品层属于首次规划，不属于整组替代：页面只展示首批候选的采用或放弃，不展示空任务组的保留、比较或替换动作。底层可以复用整组候选算法，但首次采用仍只更新编辑缓冲区；已有真实任务后才进入整组替代比较语义。

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
18. AI 编辑建议的候选预检查不等于正式质量评估；只有保存后的新 Revision 才能重新生成可用于审核与发布的 Assessment。

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
| Learning 与资源生产平台的共享 UX 基础及分离边界 | [Cross-platform UX Foundation](../product/CROSS_PLATFORM_UX_FOUNDATION.md) |
| 素材录入、审核与发布平台体验规范 | [Resource Production Workbench UX Standard](../product/RESOURCE_PRODUCTION_WORKBENCH_UX_STANDARD.md) |
| 单学生产品页面与入口收敛 | [Product Interface Consolidation](../product/STUDENT_PRODUCT_INTERFACE_CONSOLIDATION.md) |
| 学生学习叙事校准 | [Student Learning Narrative Calibration](../product/STUDENT_LEARNING_NARRATIVE_CALIBRATION.md) |
| 针对性短片段微训练调度与校准 | [阶段 3 工程实施与验收清单](../product/TARGETED_MICRO_TRAINING_STAGE3_LEARNING_SCHEDULING_ENGINEERING_PLAN.md) · [阶段 3 工程与 Debug 验收](../education/phase/reports/targeted_micro_training_stage3_engineering_debug_acceptance_2026-08-20.md) · [阶段 4 受控启用与真实校准契约](../product/TARGETED_MICRO_TRAINING_STAGE4_CONTROLLED_CALIBRATION_CONTRACT.md) · [阶段 4 工程实施与验收清单](../product/TARGETED_MICRO_TRAINING_STAGE4_ENGINEERING_AND_ACCEPTANCE_PLAN.md) · [阶段 4 工程与 Debug 验收](../education/phase/reports/targeted_micro_training_stage4_engineering_debug_acceptance_2026-08-20.md) |
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
