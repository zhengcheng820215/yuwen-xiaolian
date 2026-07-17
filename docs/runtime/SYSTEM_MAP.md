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
   AbilityEvidence[]
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
| ResponseValidityResult | 判断回答是否具有最低限度的可观察表现。 |
| TaskExecutionResult | 作为任务执行层与 Diagnosis 层之间的正式交接对象。 |
| DiagnosisResult | 描述一次作答中的状态、表现、问题和根因假设。 |

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

当前准确状态：

> 单学生、单浏览器、本地持久化的连续学习基础已经成立；Evidence 质量与自适应约束链已经冻结；真实 LLM 已能够安全进入 Diagnosis Runtime。Phase 15 已通过并冻结：真实 Diagnosis 质量基线、受控反馈表达、模板回退与普通 Live 限权均已形成正式验收记录。

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

Phase 15.1 已证明真实 Provider 可以安全进入 Runtime；Phase 15.2 已完成 Prompt v4 质量验证和 Policy v2.1 正式启用；Phase 15.3 已完成 24 / 24 个确定性 Debug Case、DeepSeek Live 12 / 12 和脱敏人工抽检 12 / 12，只把已确认事实转化为学生可读表达，越权或 Provider 失败时保留模板基线。Phase 15 当前为 `PASS / FROZEN`。

详细文档入口：[Phase 15](../education/phase/phase15.md)、[Phase 15.1](../education/phase/phase15_1.md)、[Phase 15.2](../education/phase/phase15_2.md)、[Phase 15.3](../education/phase/phase15_3.md)。

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

## 八、尚未完成或尚未产品化

当前尚未证明或尚未完成的主要能力：

- Phase 15.2 Root Cause 失败归因、必要的 Policy 或 Prompt 单项校准；
- Phase 15 后续真实使用错误样本回收与版本化质量回归；
- Existing Phase 8 对 Quality / Conflict Context 的正式消费升级；
- 真实题库的批量导入、版本、权限和云同步；
- 多学生、账号、云端持久化与跨设备恢复；
- 长期多周期 Evidence 与 Retention 趋势；
- 家长报告、成长曲线和家长端；
- AI Coach 正式介入策略；
- 真实教学效果和长期能力提升验证。

这些限制不否定当前 Runtime 已成立的能力，也不能被当前 Debug 或 Demo 结果替代证明。

## 九、文档入口

| 想了解什么 | 阅读入口 |
| --- | --- |
| 当前系统如何运转 | 本文档 |
| Runtime 对象如何传递 | [Learning Runtime Overview](LEARNING_RUNTIME_OVERVIEW.md) |
| 最小闭环开发原则 | [Growth Loop Overview](../education/phase/GROWTH_LOOP_OVERVIEW.md) |
| 当前阶段文档总索引 | [Education README](../education/README.md) |
| 某个 Phase 的规则与验收 | 对应 `docs/education/phase/phase*.md` |
| PC / 平板学生体验原则 | [PC Learning Workspace UX Calibration](../product/PC_LEARNING_WORKSPACE_UX_CALIBRATION.md) |

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
