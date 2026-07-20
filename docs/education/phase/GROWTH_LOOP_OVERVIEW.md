# 成长闭环总览（Growth Loop Overview）

## 文档定位

本文档记录当前产品从工程基础到连续成长闭环的阶段脉络。

它不是某一个 Phase 的验收报告，而是用于回答：

```text
系统现在如何从诊断，走向训练，再走向持续理解学生？
```

当前主线是：

```text
诊断题目与学生答案
-> 生成能力证据
-> 聚合薄弱点
-> 制定训练计划
-> 执行训练与复测
-> 更新能力画像
-> 推荐下一次任务
```

## 产品目标

产品目标不是做一个单纯刷题工具，而是辅助学生在初中语文学习中持续发现能力薄弱点，并围绕薄弱点制定可验证的提升方案。

核心闭环是：

```text
发现问题 -> 制定方案 -> 执行训练 -> 验证改善 -> 沉淀成长记忆
```

完成这条链路后，系统才从“AI 诊断工具”进入“AI 学习陪伴系统”的雏形。

## Minimal Loop Principle

本系统采用最小闭环驱动开发。

任何复杂能力都必须拆解为可独立运行、可独立验收的最小闭环。

每个最小闭环只解决一个核心问题，并且必须明确：

- 输入是什么
- 输出是什么
- 处理什么
- 不处理什么
- 如何 Debug
- 如何验收

复杂系统不是一次性设计完整，而是由一组边界清晰的最小闭环逐步连接起来。

只要每个闭环足够单一，即使整体 Runtime 逐渐复杂，系统仍然可以保持可理解、可调试、可维护。

本项目的核心原则是：

> 模块可以复杂，但边界必须简单。
> 代码可以复杂，但输入输出必须清楚。
> AI 可以复杂，但输出必须进入结构化 Schema。
> Runtime 可以变长，但每一步都必须可 Debug。

能力提升判断必须遵守底层约束：

> “能力提升”不是 AI 输出的描述字段，而是一个需要经过时间、多次表现和独立复测才能成立的状态。

因此，Growth Runtime 可以记录改善迹象和复测表现，但不能仅凭单次作答、单次训练或单次 AI 评价宣布能力已经提升。

## Current Growth Loop Decomposition

当前系统不是由一个大 Agent 完成全部能力，而是拆分为多个最小闭环：

1. Question Metadata Loop

```text
Question -> QuestionMetadata -> Metadata Validator
```

2. Diagnosis Evidence Loop

```text
DiagnosisResult -> AbilityEvidence -> EvidenceSummary
```

3. Student Profile Loop

```text
updatedEvidence -> StudentAbilityProfile
```

这是当前最小实现中的画像重算链路。长期标准协议中，Evidence 不应直接改变长期画像状态，而应先进入 Evaluation：

```text
AbilityEvidence -> EvaluationResult -> ProfileUpdateDecision -> StudentAbilityProfile
```

4. Personalized Task Loop

```text
StudentAbilityProfile + TopWeakness -> PersonalizedNextTask
```

5. Task Execution Loop

```text
PersonalizedNextTask + StudentAnswer -> DiagnosisRuntime -> newAbilityEvidence
```

6. Learning Session Loop

```text
PersonalizedTaskExecutionSummary x 3 -> LearningSessionMemory
```

7. Retest Loop

```text
LearningSessionMemory -> RetestTask -> RetestEvidence
```

每个闭环都可以单独运行、单独 Debug、单独验收。

多个闭环通过结构化数据连接，最终组成完整的 Growth Runtime。

## 阶段脉络

| Phase | 阶段定位 | 核心产物 | 验收入口 |
| --- | --- | --- | --- |
| Phase 1.0 | 工程与产品基础能力基线 | 前端工程、基础页面、AI 模块组织、Debug 能力 | `pnpm run build` |
| Phase 2.1 | Question Metadata Pattern Library v1 | 题型元数据识别与规则库 | `pnpm run debug:question-metadata` |
| Phase 2.2 | Question Metadata 验收与冻结 | Phase 2 元数据能力冻结记录 | `pnpm run debug:question-metadata` |
| Phase 3.1 | Ability Evidence Foundation | Diagnosis -> Ability Evidence -> Top Weakness | `pnpm run debug:ability-evidence` |
| Phase 3.2 | 阶段训练计划生成 | Top Weakness -> 3 天训练计划 | `pnpm run debug:training-plan` |
| Phase 3.3 | 训练执行与复测证据 | Training Evidence / Retest Evidence / Evidence Update | `pnpm run debug:training-evidence` |
| Phase 4.1 | Student Ability Profile | Evidence -> Student Ability Profile -> Next Training Direction | `pnpm run debug:student-profile` |
| Phase 4.2 | Real AI Diagnosis / Evidence Runtime | 真实 AI 诊断 Runtime 与 Evidence 链路 | `pnpm run debug:real-ai-diagnosis` |
| Phase 4.3 | Live AI Diagnosis Quality Evaluation | 真实 AI 诊断质量评估与人工复核门槛 | `pnpm run debug:live-ai-evaluation` |
| Phase 5.1 | Personalized Next Task | Student Ability Profile -> 下一次个性化任务 -> Evidence 更新 | `pnpm run debug:personalized-next-task` |
| Phase 5.2 | Personalized Task Execution Evidence | PersonalizedTask -> Student Answer -> 同能力 Evidence 更新 -> 下一步决策 | `pnpm run debug:personalized-task-execution` |
| Phase 5.3 | Learning Session Memory | 多次 Task Execution -> LearningSessionMemory -> Session Outcome | `pnpm run debug:learning-session` |
| Phase 6.1 | Retest Task Generation | LearningSessionMemory -> RetestTask | `pnpm run debug:retest-task` |
| Phase 6.2 | Retest Execution Evidence | RetestTask + Student Answer -> Retest Evidence -> Profile Update | `pnpm run debug:retest-execution` |
| Phase 6.3 | Ability Change Evaluation | Before / Training / Retest Evidence -> AbilityChangeEvaluation -> Next Decision | `pnpm run debug:ability-change-evaluation` |
| Phase 6 Summary | Retest / Evaluation Runtime 冻结 | Phase 6 复测与能力变化判断冻结记录 | `docs/education/phase/phase6_summary.md` |
| Phase 7.1 | Student Learning Entry | Start Learning -> First Question Diagnosis -> Initial Session State | `pnpm run debug:learning-entry` |
| Phase 7.2 | Personalized Training Flow | LearningEntryResult -> Personalized Training -> Evidence 回流 | `pnpm run debug:personalized-training-flow` |
| Phase 7.3 | Retest & Session Result Flow | PersonalizedTrainingFlowResult -> Retest -> Beta Session Result | `pnpm run debug:beta-learning-session-result` |
| Phase 7 Summary | Beta Learning Flow 冻结 | Phase 7 单次 Beta 学习闭环验收记录 | `docs/education/phase/phase7_summary.md` |
| Phase 8.1 | EvaluationResult / ProfileUpdateDecision | AbilityEvidence[] -> EvaluationResult -> ProfileUpdateDecision -> StudentAbilityProfile | `pnpm run debug:phase8-1` |
| Phase 8.2 | Growth Memory 最小闭环 | EvaluationResult + ProfileUpdateDecision + Profile 前后状态 -> GrowthMemoryRecord -> GrowthMemorySummary | `docs/education/phase/phase8_2.md` |
| Phase 8.3 | Next Learning Strategy 最小闭环 | GrowthMemorySummary + StudentAbilityProfile + CurrentLearningContext -> NextLearningStrategy -> StrategyValidationResult -> TaskRequest | `docs/education/phase/phase8_3.md` |
| Phase 8.4 | Task Request Fulfillment 最小闭环 | TaskRequest -> TaskFulfillmentRequest -> TaskResourceMatchResult -> ExecutableLearningTask / TaskGenerationRequest | `pnpm run debug:phase8-4` |
| Phase 9 | 真实任务执行与证据回流规划 | ExecutableLearningTask / TaskGenerationRequest -> ConcreteLearningTask -> StudentResponse -> AbilityEvidence -> Existing Phase 8 Runtime | `docs/education/phase/phase9.md` |
| Phase 9.1 | 任务实例化最小闭环 | ExecutableLearningTask / TaskGenerationRequest -> ConcreteLearningTask -> TaskReadinessValidation | `pnpm run debug:phase9-1` |
| Phase 9.2 | 任务执行与作答有效性最小闭环 | Ready ConcreteLearningTask -> TaskExecutionSession -> StudentResponse -> ResponseValidityResult -> TaskExecutionResult | `pnpm run debug:phase9-2` |
| Phase 9.3 | 执行结果回流最小闭环 | Valid TaskExecutionResult + ConcreteLearningTask -> DiagnosisResult -> AbilityEvidence -> Existing Phase 8 Runtime | `pnpm run debug:phase9-3` |
| Phase 10 | Learning Round Orchestration | Phase 8 策略链 + Phase 9 执行链 -> LearningRoundResult | `docs/education/phase/phase10.md` |
| Phase 10.1 | Learning Round Start | Profile + GrowthMemory + Context -> ConcreteLearningTask -> LearningRoundStartResult | `pnpm run debug:phase10-1` |
| Phase 10.2 | Learning Round Execution | LearningRoundStartResult + StudentResponse -> LearningRoundExecutionResult | `pnpm run debug:phase10-2` |
| Phase 10.3 | Learning Round Completion | LearningRoundExecutionResult -> TaskEvidenceReturnResult -> LearningRoundResult | `pnpm run debug:phase10-3` |
| Phase 11 | Student Learning Experience | LearningRound Runtime -> 学生可试用学习体验 | `docs/education/phase/phase11.md` |
| Phase 11.1 | Student Learning Entry | LearningRoundStartResult / ConcreteLearningTask -> StudentLearningEntryState | `pnpm run debug:student-learning-entry` |

## 当前核心链路

当前已实现链路：

```text
Question Metadata
-> Diagnosis Result
-> Ability Evidence
-> Evidence Summary
-> Top Weakness
-> Training Plan
-> Training Execution
-> Training Evidence
-> Retest Evidence
-> Student Ability Profile
-> Personalized Next Task
-> Personalized Task Execution Evidence
-> Learning Session Memory
-> Retest Task
-> Retest Execution Evidence
-> Ability Change Evaluation
-> Beta Learning Session Result
-> Evaluation Result
-> Profile Update Decision
-> Profile Decision Execution
-> Growth Memory
-> Next Learning Strategy
-> Task Fulfillment
-> Concrete Learning Task
-> Learning Round Start
-> Learning Round Execution
-> Learning Round Completion
-> Student Learning Experience
-> Student Learning Entry
```

长期标准协议应逐步收敛为：

```text
DiagnosisResult
-> AbilityEvidence
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
-> PersonalizedNextTask
```

其中 `AbilityChangeEvaluation` 是 Phase 6 / Phase 7 的早期实现名称，长期语义应收敛到 `EvaluationResult` 与 `ProfileUpdateDecision`。

因此，本总览中的历史 Phase 链路仍然有效，但不表示单条 Evidence 可以直接确认长期能力状态变化。

## Demo 演示入口

当前 Demo 只用于验证最小闭环，不代表正式产品 UI。

```text
/#/diagnosis-demo
/#/training-plan-demo
/#/training-evidence-demo
/#/student-profile-demo
/#/personalized-next-task-demo
/#/personalized-task-execution-demo
/#/beta-learning-entry-demo
/#/beta-personalized-training-demo
/#/beta-session-result-demo
/#/phase81-evaluation-demo
```

## 当前边界

当前阶段重点是打通可验证的能力成长链路。

暂不追求：

- 完整题库。
- 数据库持久化。
- 家长端。
- 长期成长曲线。
- 奖励系统。
- 正式课程体系。
- 完整商业化 UI。

## 文档组织原则

- 单个 Phase 文档记录该阶段目标、输入、输出、链路、验收标准和边界。
- Acceptance Report 只记录已经执行过的验收结果。
- 本总览只记录阶段脉络，不替代具体 Phase 文档。
- 命令口径统一使用 `pnpm run ...`。

## 当前结论

当前 `phase` 目录已经形成较清晰的产品演进链路：

```text
工程基础
-> 题目理解
-> 能力证据
-> 训练计划
-> 训练验证
-> 学生画像
-> 真实 AI 质量评估
-> 下一次个性化任务
-> 任务执行回流
-> 学习 Session 记忆
-> 复测验证
-> Beta 学习闭环
-> Evaluation / Profile Decision 层
```

Phase 7 已经证明单次 Beta Learning Flow 可以成立：

```text
开始学习
-> 第一题诊断
-> 个性化训练
-> 复测验证
-> 本轮学习结果
```

Phase 7 冻结后，不建议继续堆叠新的单次流程 Demo；后续应转向更高层问题，例如多次 Session 后的成长记忆、阶段报告或正式产品 Runtime 收敛。

Phase 8.1 已经补上长期标准协议中的关键中间层：

```text
AbilityEvidence[]
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

它的意义是：每条 Evidence 都可以被记录，但不是每条 Evidence 都足以改变长期能力状态。学生画像不应直接重新解释 Evidence，而应先经过 EvaluationResult 判断证据是否充分、是否冲突，再由 ProfileUpdateDecision 决定是否追加证据、更新置信度、请求复测或改变画像状态。

Phase 8.1 当前已完成 Debug、Build 和 Demo 验收，可作为后续 Phase 8.2 继续接入多 Session 成长记忆、阶段评估或正式 Runtime 收敛的基础。

后续新增 Phase 时，应继续围绕“证据是否能进入成长记忆、下一步动作是否可验证”这两个问题展开。

## Phase 10 Demo 验收补充

Phase 10 已完成 Learning Round Demo 人工验收。

已验收四类关键分支：

- 正常学习回合：策略、任务、学生作答、Evidence 回流和下一步动作可以串成一轮完整学习回合。
- 无效作答阻断：空答案、纯数字、占位回答或过短关键词回答不会进入 Evidence 回流。
- 启动阶段阻断：上游条件不足时不会强行生成任务。
- 诊断失败复核：Diagnosis 异常时进入人工复核，不自动生成长期结论。

本阶段同时确认状态语义：

```text
作答有效 != 答案正确
本轮流程完成 != 答案正确
Evidence 回流 != 能力提升
```

Phase 10 当前可视为 Runtime Beta 闭环成立：

```text
GrowthMemorySummary
-> NextLearningStrategy
-> TaskRequest / Task Fulfillment
-> ConcreteLearningTask
-> StudentResponse
-> TaskExecutionResult
-> TaskEvidenceReturnResult
-> LearningRoundResult
```

Phase 10 之后，下一步主线应从底层 Runtime 收敛到最小可试用学习体验。

## Phase 11 体验层规划补充

Phase 11 已进入文档规划阶段。

Phase 11 的目标不是新增能力判断模型，而是把已经成立的 LearningRound Runtime 转化为学生可以实际完成的一轮最小学习体验。

核心方向：

```text
LearningRound Runtime
-> 学生学习入口
-> 真实任务展示
-> 学生作答
-> 学生可读反馈
-> 本轮结束状态
-> 下一步入口
```

Phase 11.1 已完成学生学习入口最小工程闭环：

```text
LearningRoundStartResult
或
ConcreteLearningTask
↓
StudentLearningEntryState
↓
学生进入可作答状态
```

Phase 11.1 特别强调：

- 任务 ready 不等于答案可提交；
- `canAnswer` 与 `canSubmit` 必须分离；
- 作答要求必须保持结构化数组；
- 学生端不得暴露 Runtime 原始字段、Prompt、Evidence、Profile 或内部追溯 ID；
- 开发者调试区必须与学生主体验区隔离。

Phase 11.1 当前验收状态：

```text
Debug  PASS
Build  PASS
Demo   PASS
Status Frozen
```

Phase 11.2 已完成文档输出，进入学生作答后的反馈层规划：

```text
LearningRoundExecutionResult
或
TaskExecutionResult
或
TaskEvidenceReturnResult
或
LearningRoundResult
↓
StudentFeedbackAdapter
↓
StudentLearningFeedback
```

Phase 11.2 的核心边界：

- 只把 Runtime 状态翻译为学生可理解反馈；
- 不重新诊断；
- 不重新生成 Evidence；
- 不更新 GrowthMemory；
- 不替代 NextLearningStrategy；
- 不把单次提交描述为长期能力结论；
- 多个 Runtime Result 同时存在时，优先使用链路中最靠后的正式结果；
- 过程反馈与正式结果反馈必须分离；
- 正向反馈必须来自可靠 Runtime 依据，不能由展示层凭空生成。

Phase 11.2 当前验收状态：

```text
Debug  PASS
Build  PASS
Demo   PASS
Status Frozen
```

Phase 11.3 已完成文档输出，进入本轮学习结束页规划：

```text
LearningRoundResult
+
StudentLearningFeedback
↓
StudentRoundSummaryAdapter
↓
StudentRoundSummary
```

Phase 11.3 的核心边界：

- 只把本轮最终结果转换为学生结束页；
- 不重新诊断；
- 不重新生成 Evidence；
- 不更新 GrowthMemory；
- 不替代 NextLearningStrategy；
- 不把“本轮完成”描述为“答对、掌握或能力提升”；
- `LearningRoundResult` 决定最终流程状态；
- `StudentLearningFeedback` 只提供学生可读表现内容；
- 多输入状态冲突时必须保守处理；
- `learningRoundId` / `studentId` 不一致时必须阻断，避免跨轮反馈串线。

Phase 11.3 当前状态：

```text
Docs   READY
Debug  PASS
Build  PASS
Demo   PASS
Status Frozen
```

Phase 11 当前总体验收状态：

```text
Phase 11.1  PASS
Phase 11.2  PASS
Phase 11.3  PASS
Phase 11    Frozen
```

Phase 11 完成后，系统状态应从：

```text
Runtime Beta 成立
```

推进到：

```text
Student Experience Alpha 成立
```

## Phase 12：单学生可持续学习基础

Phase 12 已完成总纲和 Phase 12.1 工程最小闭环。

Phase 12 的目标是让 Phase 11 已经成立的一轮学生体验，具备可持续使用基础：

```text
学习结果能保存；
真实题目能进入 Runtime；
上一轮结果能驱动下一轮学习。
```

Phase 12 拆分为三个最小闭环：

```text
Phase 12.1  学习回合持久化与恢复
Phase 12.2  真实题目输入与任务准备
Phase 12.3  连续多轮学习运行
```

Phase 12.1 当前已实现链路：

```text
LearningRoundResult
+
StudentResponse
+
StudentLearningFeedback
+
StudentRoundSummary
+
GrowthMemoryRecord / GrowthMemorySummary
↓
LearningPersistenceRecord
↓
Local Persistence Store
↓
RestoredLearningState
```

Phase 12.1 已完成：

- `LearningPersistenceRecord`；
- `RestoredLearningState`；
- `LearningPersistenceRepository`；
- `InMemoryLearningPersistenceRepository`；
- `IndexedDBLearningPersistenceRepository`；
- `LearningPersistenceAgent`；
- `debug:learning-persistence`。

Phase 12 持久化边界：

- `localStorage` 只保存少量入口和恢复指针；
- 正式学习记录优先通过 IndexedDB / Repository 保存；
- 页面不得直接读写存储实现；
- 恢复不得重复提交、重复 Diagnosis、重复 Evidence 或重复 Profile 更新；
- 数据版本不兼容时必须阻断恢复。

Phase 12.1 当前状态：

```text
Docs   READY
Debug  PASS
Build  PASS
Demo   PASS
```

Phase 12.2 当前规划链路：

```text
Raw Question Input
↓
TaskResourceDraft
↓
Resource Validation
↓
TaskResource
↓
Phase 8 TaskFulfillment
↓
ConcreteLearningTask
```

Phase 12.2 当前边界：

- Draft 可以保存，但正式 `TaskResource` 必须通过完整性校验；
- `resourceId` 由系统生成，外部编号只能作为 `externalResourceId`；
- `questionType` 使用受控集合；
- 空 `rubric` 不算有效评价依据；
- 真实题目必须通过 `TaskFulfillment` 生成 `ConcreteLearningTask`；
- 不得重新定义 `QuestionMetadata`。

Phase 12.2 当前状态：

```text
Docs   READY
Debug  PASS
Build  PASS
Demo   PASS
Phase  PASS
```

Phase 12.2 已于 2026-07-14 完成轻量 Demo 验收，真实题目能够完成 Draft 保存、正式资源校验，并通过既有 `TaskFulfillment` 生成 `ConcreteLearningTask`。缺少评价依据、必要阅读材料或可追溯来源的数据会被阻断，不会作为正式任务资源进入学生学习链路。

Phase 12.3 已完成文档、工程实现、Debug、Build 与轻量 Demo 验收，当前链路：

```text
Round 1 正式结果
↓
Persistence Save / Restore
↓
GrowthMemorySummary
↓
NextLearningStrategy
↓
Round 2 TaskRequest / ConcreteLearningTask
↓
Round 2 正式结果
↓
Round 3 或正常结束
```

Phase 12.3 的核心验收不是连续展示多道固定题，而是证明上一轮保存后的正式 `GrowthMemory` 与 `StudentAbilityProfile` 能生成下一轮策略和任务，并保留完整轮次追溯关系。

Phase 12.3 已明确以下连续运行安全边界：

- `status` 描述运行结果，`endReason` 描述结束原因；
- 达到 `maxRounds` 不代表能力目标已经完成；
- `transitionType` 只能由正式 `NextLearningStrategy` / `TaskRequest` 映射；
- 回合完成但保存失败时，只重试 Persistence，不重复 Diagnosis、Evidence、Profile Update 或 GrowthMemory；
- 保存并恢复成功之前不得启动下一轮。

Phase 12.3 当前状态：

```text
Docs   READY
Debug  PASS
Build  PASS
Demo   PASS
Phase  PASS
```

Phase 12.3 Debug 已覆盖正常三轮、同能力正式衔接、无效作答阻断、任务资源不足、保存恢复后继续、恢复身份错误、Diagnosis 能力错位和持久化失败重试共 8 类场景，结果为 `8/8 PASS`。

Phase 12.3 已于 2026-07-14 完成轻量 Demo 人工验收。Demo 证明三轮固定、同能力、不同情境的任务能够完成草稿恢复、正式结果保存、上一轮状态驱动下一轮以及计划轮数结束；重新开始仍使用相同三题，不代表题库轮换、随机选题或真实教学效果已经成立。

Phase 12 三个最小闭环已全部通过，当前具备总体验收与冻结条件。

Phase 12 基础全链路集成验收已于 2026-07-14 通过。Phase 12.2 与 Phase 12.3 现在使用同一 `TaskResourceRepository` 边界；两道正式阅读资源经 12.2 校验写入 Repository 后，由 12.3 查询、排除已用资源并交给既有 TaskFulfillment。正常双轮、重复保存、重复恢复、重复响应、无效作答、保存失败、资源不足、身份错配和 Diagnosis 能力错位共 9 类集成 Case 全部通过。

## Phase 13：跨 Session 学习与延迟复测基础

Phase 13 将 Phase 12 已成立的单次连续学习扩展到多个 Session 和不同时间点：

```text
LearningRoundResult[]
-> LearningSessionRecord
-> 跨 Session History
-> DelayedRetestPlan
-> 新的 delayed AbilityEvidence
-> Existing Phase 8 Runtime（一次）
-> RetentionEvaluationResult
```

Phase 13 拆为三个最小闭环：

```text
Phase 13.1  Learning Session History
Phase 13.2  Delayed Retest Scheduling
Phase 13.3  Retention Evaluation
```

### Phase 13.1 当前状态

Phase 13.1 Runtime 已通过，能够把多个正式 LearningRound 归入 `LearningSessionRecord`，隔离损坏或版本不兼容的记录，并按学生、能力和时间查询正式 Session History。

```text
Debug          15 / 15 PASS
Runtime        PASS
Browser Smoke  12 / 12 PASS
```

IndexedDB 已通过真实页面刷新和新 Repository 恢复验收；损坏版本不会参与正式历史，未完成 Session、索引查询、幂等保存与清空行为均成立。

### Phase 13.2 当前状态

Phase 13.2 Runtime 已通过。系统能够根据合法 Session History、GrowthMemory、Evidence 时间和明确策略生成可追溯、可去重的 `DelayedRetestPlan`。

```text
Debug    13 / 13 PASS
Runtime  PASS
```

Evidence 变旧只表示需要重新观察，不代表能力自动下降。计划到期也不自动拼题或启动复测，仍须进入 TaskRequest、TaskFulfillment 和正式 LearningRound。`cancelled` 计划允许生成带替代关系的新计划，`completed` 计划不会被自动重开。

### Phase 13.3 当前状态与边界

Phase 13.3 Runtime 已通过，18 / 18 Debug、相关冻结回归与 Production Build 均通过。

它采用两条职责清楚的并行关系：

```text
Delayed AbilityEvidence
-> Existing Phase 8 Runtime（只执行一次）
-> EvaluationResult / ProfileUpdateDecision / GrowthMemoryRecord

Baseline Evidence + Delayed Evidence
-> RetentionComparisonFacts
-> RetentionComparabilityResult
-> RetentionEvaluationResult
-> 关联并解释上述正式结果
```

`RetentionEvaluationResult` 比较和解释 Evidence，但不生产 Evidence，也不再次执行正式能力更新。可比性状态必须由 Agent 根据正式事实派生，调用方不能直接指定；`positive` 与 `growth` 也不被默认解释为高低等级。

Phase 13.1、13.2、13.3 与 Browser Persistence Smoke 均通过，Phase 13 总体状态为 `PASS / Frozen`。跨标签页原子唯一性仍是已知边界，不属于当前单学生、单标签页 MVP 的已验证能力。

Phase 13 产品声明：

> 系统能够在单学生、单浏览器本地环境下，跨 Session 保存和恢复正式学习历史，根据 Evidence 时间生成可追溯的延迟复测计划，并在复测后形成克制、可比较的保持性观察，同时验证延迟 Evidence 已完整进入既有 Evaluation、ProfileUpdateDecision 与 GrowthMemory 链路。

这里的“完整进入”指延迟 Evidence 的正式追溯关联已经通过验收，不表示延迟计划已在真实自然日内自动完成任务准备与复测执行。

## Phase 14：Evidence 质量与冲突协调基础

Phase 14 在 Phase 13 的长期 Evidence 序列之上增加质量解释与冲突协调：

```text
AbilityEvidence
+ Formal Runtime Context
-> EvidenceQualityAssessment
-> EvidenceConflictAssessment
-> EvaluationContextEnvelope
-> Evaluation Runtime Capability Negotiation
```

### Phase 14.1 当前状态

Phase 14.1 Runtime 已通过，17 / 17 Debug、相关回归与 Production Build 均通过。

它能够区分：

- 无提示与提示依赖；
- 原题、相似任务与迁移任务；
- 即时与延迟观察；
- 有效、受限、阻断与需要复核的 Evidence；
- Evidence 方向和 Evidence 质量。

质量高不等于能力高，质量低也不等于学生失败。质量只说明这条 Evidence 在当前正式上下文中有多值得用于后续判断。

### Phase 14.2 当前状态

Phase 14.2 Runtime 已通过，25 / 25 Debug、Phase 14.1 / 13.3 / 9.3 / 12 回归与 Production Build 均通过。

它建立了以下最小闭环：

```text
AbilityEvidence[]
+ Current EvidenceQualityAssessment[]
+ Formal Comparison Context[]
-> Observation Unit Deduplication
-> EvidenceConflictAssessment
-> EvaluationContextEnvelope
```

同一 Response 产生的多条 Evidence 不会被当作多次独立观察；低质量 Evidence 不会被删除；`growth` 与 `positive` 的原始语义会继续保留。存在条件差异也不会自动被解释为“可解释混合”，解释强度不足时仍输出证据不足或未解决冲突。

当前 Existing Phase 8 尚未声明 Phase 14 所需的 Quality / Conflict Capability，因此正式 quality-aware handoff 默认阻断。该边界证明协调层已经成立，但不表示旧 Evaluation 已经消费质量保护。

Phase 14.3 文档已明确：Strategy 是教育方向唯一来源，Context Snapshot 只能限制执行条件；AdaptiveTaskConstraints 是结构化约束唯一来源，并通过 Envelope 交给 TaskFulfillment。任务设计可以追求 high-quality Evidence，但不能预先承诺学生作答、Diagnosis 或最终 Evidence 一定达到该质量。

Phase 14 当前状态：

```text
Phase 14.1  PASS
Phase 14.2  PASS
Phase 14.3  26 / 26 DEBUG PASS / RUNTIME PASS
Integration 16 / 16 PASS
Phase 14    PASS / FROZEN
```

Phase 14 集成 Case 27 已验证任务目标质量与实际 Evidence 质量分离：提示后有效作答仍可回流 Evidence，但会被重新评估为 `low / limited`；无效作答不生成正式 Evidence。Constraints 不因执行结果被反向改写，未达到目标质量也不属于约束 Runtime 失败。

Phase 14 正式冻结结论：系统能够根据正式任务、作答、提示、时间和追溯事实评估 Evidence 的判断价值，协调多条 Evidence 的方向关系，并在 Existing Strategy 的边界内生成受控任务约束；任务执行后，系统会依据真实表现重新评估 Evidence 质量，而不会把目标质量当成实际结果。

## Phase 15：真实 AI Diagnosis 与受控表达基础

Phase 15 已把现有 mock 为主的 Diagnosis 链扩展为可配置、可追溯、可审查的真实 LLM Runtime 基础：

```text
Valid TaskExecutionResult
-> Real LLM Provider Adapter
-> Raw Output
-> Structure / Identity / Boundary Gate
-> Formal DiagnosisResult Candidate
-> commitFormalDiagnosis()
-> Committed Formal DiagnosisResult
-> Existing Evidence Return
-> Phase 14 Evidence Quality Assessment
```

Phase 15.1 建立真实模型运行基础并已冻结。确定性 Debug 为 22 / 22 PASS，DeepSeek `deepseek-v4-flash` Live Smoke 为 4 / 4 PASS。Phase 15.2 已完成 Prompt v4 质量验证、Root Cause 归因、Policy v2.1 校准、负责人确认和正式启用回归；正式验收 15 / 15 PASS。Phase 15.3 已完成受控学生反馈表达与安全回退验收。

正式 Diagnosis 使用 Candidate -> Commit 事务边界：同一 requestId 只能原子提交一份正式结果，页面刷新、Provider Retry 或 Evidence Return Retry 都不能生成第二份 Formal Diagnosis。结构 Repair 只允许版本化白名单内的非语义修复，不能修改 `mainAbility`、`answerStatus`、`rootCause`、引用或 Evidence 方向。

Phase 15.2 第一版冻结 30–50 条版本化人工评估样本，并公开各质量指标的有效分母。Phase 15.3 将 `StructuredFeedbackFacts` 与 `ActionableSuggestions` 分开，表达层只能转述可追溯事实和受控建议，不能新增教育结论。

当前状态：

```text
Phase 15 Design            ACCEPTED
Phase 15.1 Engineering     PASS / FROZEN
Deterministic Debug        22 / 22 PASS
Real Provider Live Smoke   4 / 4 PASS
Phase 15.2 Design          ACCEPTED
Phase 15.2 Engineering     PASS / FROZEN
Phase 15.2 Real Batch      COMPLETED
Prompt v3 Calibrated Base  COMPLETED / THRESHOLDS NOT MET
Prompt v3 Quality          NOT PASSED
Prompt v4 Engineering      PASS
Prompt v4 Deterministic    15 / 15 PASS
Prompt v4 Specialty Slice  30 / 30 CALLS / PASS
Prompt v4 Full Batch       108 / 108 RUNS / COMPLETED
Prompt v4 + Policy v2.1    QUALITY GATE PASS
Root Cause Attribution     32 RUNS / INITIAL PASS
Policy v2.1 Calibration    90 / 93 / ALL GUARDS PASS
Policy v2.1 Dry Run        93 / 93 / 9 GUARDS PASS
Policy v2.1 Activation     YES / 15 / 15 PASS
Owner Confirmation        PASS
Phase 15.2 Freeze          PASS / FROZEN
Phase 15.3 Deterministic   24 / 24 PASS
Phase 15.3 Real Provider   12 / 12 PASS
Phase 15.3 Safety          2 / 2 PASS
Phase 15.3 Human Review    12 / 12 ACCEPTED
Phase 15.3 Freeze          PASS / FROZEN
Phase 15 Integration Debug 11 / 11 PASS
Phase 15 Overall Freeze    PASS / FROZEN
```

该阶段继续遵守最小闭环原则：模型原始输出不是正式 Diagnosis，模型 confidence 不是 Evidence 质量，表达层也不能新增教育结论。

Phase 15.1 Live Smoke 采用三条真实调用加一条受控失败 Gate：正常 Live、Shadow、Prompt Injection 验证真实 Provider 链路，能力错位或非法结构验证安全阻断。Smoke 不执行 Evidence 或 Profile 更新，只验证 `canEnterEvidenceReturn`。

当前冻结表示三个 Runtime、专项质量验收和确定性整链集成均已成立。`Formal Commit -> Evidence Return -> Phase 8 -> Phase 14.1 -> Controlled Feedback` 已通过 `11 / 11` 独立 Debug 验收。Prompt v4 成为所有正式 Provider 调用的默认 Prompt 仍须通过版本化配置显式切换；真实外部 Provider 贯穿完整产品主链的受控试跑仍未执行，不能由 Scripted Provider 集成结果替代。

## Phase 16：结构化内容与真实学习运行基础

Phase 16 把已经冻结的策略、任务执行、真实 Diagnosis 和跨 Session Runtime 接到可审核、可版本追溯的正式题目资源，并继续验证资源匹配与真实多日运行：

```text
Structured Question Draft
-> Validation / Human Review
-> Frozen Question Resource
-> Resource Matching Quality
-> Executable Learning Task
-> Real Student Answer / Real Diagnosis
-> Evidence / Evaluation / GrowthMemory
-> Delayed Retest / Next Strategy
-> Next Reviewed Resource
```

Phase 16.1 已完成资源准入最小闭环。题目必须先保存为 Draft，通过内容、AnswerAcceptance、Rubric、Ability、TaskRole 和版本关系校验，再经过人工审核才能冻结；Frozen Resource 不可静默修改，修订必须生成新版本，ResourceRegistry 只指向唯一当前冻结版本。

当前状态：

```text
Phase 16 Design             ACCEPTED / IN PROGRESS
Phase 16.1A Runtime         22 / 22 PASS
Phase 16.1B Workbench       HUMAN DEMO PASS
Phase 16.1 Overall          PASS
Phase 16.1 Workbench UX     FOLLOW-UP REQUIRED
Phase 16.2 Design           ACCEPTED / FROZEN
Phase 16.2A Engineering     PASS (12 / 12)
Phase 16.2B Engineering     PASS (16 / 16)
Phase 16.2 Demo             HUMAN ACCEPTANCE PASS (8 / 8)
Phase 16.1 -> 16.2 Smoke    PASS (5 / 5)
Phase 16.1 -> 16.2 Demo     HUMAN INTEGRATION PASS (4 / 4)
Phase 16.2 Overall          PASS / FROZEN
Phase 16.3                  NOT STARTED
```

Phase 16.1 PASS 只证明正式题目能够完成录入、校验、审核、冻结、修订和版本追溯，不表示同能力标签资源就适合当前 TaskRequest。Phase 16.2 必须继续验证能力、角色、难度、新颖度、近期重复、Rubric 和版本状态，形成可解释的 `matched / partial_match / no_match / review_required` 分支。

Phase 16.2A 已建立正式候选资格 Gate：只允许 Registry 当前指向、审核与校验可追溯、primary ability、task role、核心难度和 Rubric 均合格的 Frozen Version 形成 eligible `AvailableTaskResource` 视图。Draft、supporting-only ability、superseded、retired、Registry 冲突和 Envelope 错位会被隔离或阻断。该 Checkpoint 不处理上下文新颖度、近期重复、提示策略或最终资源选择，因此不等于 Phase 16.2 已冻结。

Phase 16.2B 已完成上下文匹配质量 Gate：复用 Existing TaskFulfillment 后继续校验材料关系、近期重复、排除条件、提示策略、required capabilities、soft preferences 和 Registry 二次确认，并稳定形成 `matched / partial_match / no_match / review_required`。工程 Debug 为 `16 / 16 PASS`，16.2A + 16.2B 联合连续运行 30 次全部通过且完整输出哈希一致；轻量 Match Review Demo 已完成 `8 / 8` Case 人工验收，并通过 PC / 平板布局检查。随后 Phase 16.1 -> 16.2 Repository Integration Debug 取得 `5 / 5 PASS`，人工联调 Demo 取得 `4 / 4 PASS`，验证 Freeze、版本切换、Registry 二次阻断、能力错位拒绝、Resource Gap 和幂等交接。Phase 16.2 当前为 `PASS / FROZEN`。

Phase 16.3 将进一步验证单学生使用真实题目和真实 AI 连续运行 5—7 个自然日。验收重点不是每天都成功，而是刷新、重复提交、Provider 失败、复测缺席、资源 superseded 或人工复核发生时，正式 Evidence、Profile 和 GrowthMemory 不被污染，学习可以恢复并继续。
