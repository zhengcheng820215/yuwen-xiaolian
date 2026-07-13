# 系统地图（System Map）

本文档是给人看的系统地图。

它不定义 Schema，不记录 TypeScript 细节，也不替代 Phase 文档。

它只回答：

```text
这个产品现在如何运转？
当前做到哪里？
下一步要做什么？
还有哪些能力没有实现？
```

当文档数量继续增长时，优先从本文档理解系统，再进入具体模型、Runtime 或 Phase 文档。

## 一、产品主线

产品目标不是让学生刷更多题，而是帮助学生建立能力。

当前主线：

```text
发现薄弱点
-> 制定训练计划
-> 执行训练任务
-> 复测或迁移验证
-> 生成新证据
-> 更新学生能力画像
-> 决定下一步任务
```

一句话概括：

```text
发现问题 -> 解决问题 -> 验证是否改善 -> 形成成长记忆
```

## 二、当前总链路

当前系统正在向下面这条长期链路收敛：

```text
Question
+ Student Answer
+ Question Metadata
↓
DiagnosisResult
↓
AbilityEvidence[]
↓
├─ EvidenceSummary / WeaknessRanking
│  └─ 提供候选薄弱点和行动方向
│
└─ EvaluationResult
   ↓
   ProfileUpdateDecision
   ↓
   StudentAbilityProfile
↓
GrowthMemoryRecord
↓
GrowthMemorySummary
↓
NextLearningStrategy
↓
StrategyValidationResult
├─ valid -> TaskRequest
└─ invalid -> blocked / review / regenerate
↓
PersonalizedNextTask / Task Generator
↓
New Student Answer
↓
New AbilityEvidence
↓
进入下一轮评估与学习
```

这里有一个重要边界：

```text
EvidenceSummary / WeaknessRanking
与
EvaluationResult

并不是严格的上下游关系。
```

它们都消费 `AbilityEvidence[]`，但回答的问题不同：

| 模块 | 主要回答 |
| --- | --- |
| EvidenceSummary / WeaknessRanking | 当前哪些能力或问题值得优先关注，候选行动方向是什么。 |
| EvaluationResult | 当前证据是否充分、是否冲突，以及最多允许形成多强的长期结论。 |

因此不能理解为：

```text
WeaknessRanking
-> 直接决定 EvaluationResult
```

更准确地说：

```text
AbilityEvidence[]
同时进入候选行动判断和长期状态评估。
```

需要特别记住：

```text
AbilityEvidence 不能直接改变 StudentAbilityProfile。

每条 Evidence 都可以被记录，
但不是每条 Evidence 都足以改变长期能力状态。

长期画像更新必须经过：
EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

换句话说：

```text
记录 Evidence
≠
更新长期能力状态
```

Evidence 只有经过 `EvaluationResult` 评估，并形成 `ProfileUpdateDecision` 后，才可能影响 `StudentAbilityProfile`。

## 三、核心对象一句话

| 对象 | 一句话作用 |
| --- | --- |
| Question | 提供一次可观察能力表现的任务。 |
| QuestionMetadata | 说明题目要观察什么能力、用什么 Rubric 和规则评价。 |
| StudentAnswer | 学生在某个任务中的实际作答。 |
| DiagnosisResult | 记录一次作答中的答案状态、可观察表现、问题表现和根因假设。 |
| AbilityEvidence | 把一次表现沉淀为可累计、可追溯的能力证据。 |
| EvidenceSummary | 按能力汇总 Evidence，看薄弱、正向、成长和证据不足的分布。 |
| WeaknessRanking | 基于当前有效 Evidence 生成候选薄弱点排序。 |
| EvaluationResult | 判断多条 Evidence 是否足以支持改善信号或状态判断。 |
| ProfileUpdateDecision | 决定学生画像是否以及如何更新。 |
| StudentAbilityProfile | 保存学生当前能力状态、主要薄弱点、改善信号和待验证方向。 |
| GrowthMemoryRecord | 记录一次 Evaluation、ProfileUpdateDecision 和画像前后变化事件。 |
| GrowthMemoryStore | 保存并查询 GrowthMemoryRecord。 |
| GrowthMemorySummary | 汇总近期成长记忆轨迹，不重新生成能力评价结论。 |
| NextLearningStrategy | 基于成长记忆、画像和当前情境决定下一步学习动作。 |
| StrategyValidationResult | 校验学习策略是否具备进入任务请求的条件。 |
| TaskRequest | 把合法策略转换为下游任务模块可消费的任务请求。 |
| TrainingPlan | 把候选薄弱点转成阶段训练安排。 |
| PersonalizedNextTask | 基于画像、证据状态和当前阶段决定下一步训练、复测或迁移任务。 |
| LearningSession | 记录一次学习过程中的作答、反馈、训练、复测和证据变化。 |

## 四、当前已完成到哪里

### Phase 1-3

已完成从诊断到训练计划，再到训练执行和复测证据的最小闭环。

核心能力：

```text
Diagnosis
-> AbilityEvidence
-> TopWeakness
-> TrainingPlan
-> TrainingEvidence / RetestEvidence
```

### Phase 4

已完成学生能力画像最小版本。

核心能力：

```text
AbilityEvidence
-> StudentAbilityProfile
```

同时已开始验证真实 AI Diagnosis Runtime。

### Phase 5-7

已完成 Beta Learning Flow 的最小链路。

核心能力：

```text
LearningEntry
-> PersonalizedTraining
-> Retest
-> BetaSessionResult
```

系统已经能演示一次从学习入口到复测反馈的完整体验。

### Phase 8.1

已完成 Evidence 到 Profile 之间的评估与决策层。

核心能力：

```text
AbilityEvidence[]
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

验收状态：

```text
Debug  PASS
Build  PASS
Demo   PASS
```

Phase 8.1 的意义：

```text
学生画像不再由 Evidence 直接触发更新，
而是必须经过 EvaluationResult 和 ProfileUpdateDecision。
```

### Phase 8.2

已完成 Growth Memory 最小闭环。

核心能力：

```text
EvaluationResult
+ ProfileUpdateDecision
+ beforeProfile
+ afterProfile
-> GrowthMemoryRecord
-> GrowthMemoryStore
-> GrowthMemorySummary
```

验收状态：

```text
Debug  PASS
Build  PASS
Demo   PASS
```

Phase 8.2 的意义：

```text
评估结果、画像更新决策及其前后状态，
已经能够被记录、查询、回放，
并形成最小成长记忆摘要。
```

### Phase 8.3

已完成 Next Learning Strategy 最小闭环。

核心能力：

```text
GrowthMemorySummary
+ StudentAbilityProfile
+ CurrentLearningContext
-> NextLearningStrategy
-> StrategyValidationResult
├─ valid -> TaskRequest
└─ invalid -> blocked / review / regenerate
```

验收状态：

```text
Debug  PASS
Build  PASS
Demo   PASS
```

Phase 8.3 的意义：

```text
系统开始把成长记忆转化为经过校验的下一步学习策略，
但仍不负责生成具体题目。
```

## 五、当前进度位置

当前产品已完成 Phase 10 的 Learning Round Orchestration 最小闭环。

Phase 8-10 已经分别完成三层关键能力：

```text
Phase 8：长期评估、成长记忆与下一步策略
Phase 9：真实任务执行与证据回流
Phase 10：学习回合编排
```

也就是说，系统已经从“单个 Runtime 节点可运行”，推进到：

```text
GrowthMemorySummary
-> NextLearningStrategy
-> TaskRequest / Task Fulfillment
-> ConcreteLearningTask
-> TaskExecutionResult
-> AbilityEvidence
-> EvaluationResult
-> ProfileUpdateDecision
-> GrowthMemoryRecord
-> LearningRoundResult
```

当前阶段不再只是 Phase 8 的记忆层建设。

当前更准确的位置是：

```text
Runtime Beta 已成型，
下一步应从 Debug Runtime 收敛到可试用学习体验。
```

当前最重要的不是：

- 继续扩展大型题库；
- 美化 UI；
- 做排行榜；
- 做复杂奖励系统；
- 直接宣布学生能力提升。

当前最重要的是：

- 将 LearningRound 转化为一个孩子可以完成的最小学习页面；
- 保持无效作答、诊断失败、能力不一致等闸门；
- 保证本轮学习结果能够稳定回流 GrowthMemory；
- 让下一轮学习仍由 Phase 8.3 的 NextLearningStrategy 决定；
- 避免 Orchestrator 直接生成教育结论或补造缺失数据。

## 六、Phase 8-10 完成脉络

Phase 8.4 已完成 Task Request Fulfillment 最小工程闭环。

Phase 8.4 的目标：

```text
把经过校验的 TaskRequest
转化为具体任务生成或任务资源匹配请求。
```

也就是从：

```text
TaskRequest
```

逐步演进为：

```text
Task Resource Matching
或
Concrete Learning Task Draft
```

Phase 8.4 不应一次性做完整题库系统。

它只需要证明：

```text
系统能够消费 TaskRequest，
选择或生成一个最小可执行学习任务草案，
并保留它来自哪个策略与验证目标。
```

Phase 8.4 会拆成三个最小闭环：

```text
8.4.1 TaskRequest -> TaskFulfillmentRequest
8.4.2 TaskFulfillmentRequest + mock resources -> TaskResourceMatchResult
8.4.3 matched -> ExecutableLearningTask / no_match -> TaskGenerationRequest
```

当前验收状态：

```text
Debug  PASS
Build  PASS
Demo   PASS
```

Phase 8.4 已完成 Debug、Build 和 Demo 人工验收。

后续主线进入 Phase 9：

```text
TaskRequest Fulfillment
-> ConcreteLearningTask
-> TaskExecutionSession
-> StudentResponse
-> ResponseValidityResult
-> TaskExecutionResult
-> New AbilityEvidence
```

Phase 9 的目标不是一次性做完整题库或正式学习产品，而是验证：

```text
真实任务执行结果能否经过有效性判断，
进入 Diagnosis / AbilityEvidence，
并重新接入 Existing Phase 8 Runtime。
```

### Phase 9.1

Phase 9.1 已完成任务实例化最小工程闭环。

核心能力：

```text
ExecutableLearningTask / TaskGenerationRequest
-> ConcreteLearningTask
-> TaskReadinessValidation
```

验收状态：

```text
Debug  PASS
Build  PASS
Demo   Not Required
```

Phase 9.1 的意义：

```text
系统已经能够把 Phase 8.4 的任务落地结果，
转化为学生下一阶段可执行的 ConcreteLearningTask，
并通过 TaskReadinessValidation 判断是否可以进入任务执行。
```

### Phase 9.2

Phase 9.2 已完成任务执行与作答有效性最小工程闭环。

```text
ConcreteLearningTask
-> TaskExecutionSession
-> StudentResponse
-> ResponseValidityResult
-> TaskExecutionResult
```

验收状态：

```text
Debug  PASS
Build  PASS
Demo   Not Required
```

Phase 9.2 的意义：

```text
系统已经能够接收学生对 Ready ConcreteLearningTask 的真实作答，
并在进入 Diagnosis Runtime 前判断本次作答是否有效。
```

### Phase 9.3

Phase 9.3 已完成执行结果回流最小工程闭环。

```text
Valid TaskExecutionResult
+ ConcreteLearningTask
-> DiagnosisResult
-> AbilityEvidence
-> Existing Phase 8 Runtime
```

验收状态：

```text
Debug  PASS
Build  PASS
Demo   Not Required
```

Phase 9.3 已补齐以下四类分支：

```text
blocked_invalid_execution
diagnosis_failed
review_required
evidence_returned
```

Phase 9.3 的意义：

```text
系统已经能够把经过有效性校验的真实任务作答，
安全接入 Diagnosis Runtime，
生成可追溯 AbilityEvidence，
并复用 Existing Phase 8 Runtime 形成 EvaluationResult、
ProfileUpdateDecision 和 GrowthMemoryRecord。
```

## 七、Phase 10：Learning Round Orchestration

Phase 10 文档已建立：

```text
docs/education/phase/phase10.md
docs/education/phase/phase10_1.md
docs/education/phase/phase10_2.md
docs/education/phase/phase10_3.md
docs/education/phase/phase10_acceptance_report.md
```

Phase 10 的目标：

```text
把 Phase 8 的策略链和 Phase 9 的任务执行链
编排成一次可连续运行、可结束、可产生下一步结果的真实学习回合。
```

Phase 10 拆为三个最小闭环：

```text
Phase 10.1 Learning Round Start
Phase 10.2 Learning Round Execution
Phase 10.3 Learning Round Completion
```

### Phase 10.1

Phase 10.1 已完成学习回合启动最小工程闭环。

```text
StudentAbilityProfile
+ GrowthMemorySummary
+ CurrentLearningContext
-> NextLearningStrategy
-> TaskRequest
-> TaskFulfillment
-> ConcreteLearningTask
-> LearningRoundStartResult
```

验收状态：

```text
Debug  PASS
Build  PASS
Demo   PASS
```

Phase 10.1 已覆盖以下分支：

```text
ready_for_execution
blocked
review_required
```

Phase 10.1 的意义：

```text
系统已经能够从当前学生画像、成长记忆和学习上下文出发，
生成本轮学习策略，
完成任务请求与任务履约，
并准备好可执行的 ConcreteLearningTask。
```

后续主线进入 Phase 10.2：

```text
LearningRoundStartResult
+ StudentResponse
-> LearningRoundExecutionResult
```

### Phase 10.2

Phase 10.2 已完成学习回合执行最小工程闭环。

```text
LearningRoundStartResult
+ StudentResponse
-> TaskExecutionSession
-> ResponseValidityResult
-> TaskExecutionResult
-> LearningRoundExecutionResult
```

验收状态：

```text
Debug  PASS
Build  PASS
Demo   PASS
```

Phase 10.2 已覆盖以下分支：

```text
evidence_return_ready
retry_required
blocked
review_required
abandoned
```

Phase 10.2 的意义：

```text
系统已经能够消费一轮 ready_for_execution 的启动结果，
接收学生作答，
判断本次作答是否有效，
并明确是否允许进入 Phase 10.3 的 Evidence 回流。
```

后续主线进入 Phase 10.3：

```text
LearningRoundExecutionResult
+ ConcreteLearningTask
-> TaskEvidenceReturnResult
-> Updated GrowthMemory
-> LearningRoundResult
```

Phase 10.3 已完成工程实现与 Debug 验收。

### Phase 10.3

Phase 10.3 已完成学习回合完成最小工程闭环。

```text
LearningRoundExecutionResult
+ ConcreteLearningTask
-> TaskEvidenceReturnResult
-> LearningRoundResult
```

验收状态：

```text
Debug  PASS
Build  PASS
Demo   PASS
```

Phase 10.3 已覆盖以下分支：

```text
completed
retry_required
blocked
review_required
abandoned
```

Phase 10.3 的意义：

```text
系统已经能够消费一轮 evidence_return_ready 的执行结果，
通过 Phase 9.3 完成 Evidence 回流，
并把本轮结果映射为 LearningRoundResult。
```

Phase 10.3 已验证：

```text
GrowthMemoryRecord
-> GrowthMemorySummary
-> 下一轮 Phase 8.3 输入
```

Phase 10 三段最小闭环已经全部完成 Debug / Build 验收。

### Learning Round 状态语义

Phase 10 的状态必须区分流程完成、作答质量和长期能力结论：

```text
作答有效 != 答案正确
本轮流程完成 != 答案正确
Evidence 回流 != 能力提升
```

`作答有效` 只表示答案具备最低可分析内容，可以进入 Diagnosis。

`本轮流程完成` 只表示 Learning Round 已经完成运行链路，并完成必要结构化处理。

答案即使不正确，只要包含可分析内容，也可以生成 weakness evidence。

无效答案、空答案、纯数字、占位回答或过短关键词回答，不应进入 Diagnosis，也不应进入 Evidence 回流。

长期能力结论仍必须由 Evaluation 基于多条 AbilityEvidence 判断。

Phase 10 之后，下一步主线不应继续只堆叠底层 Runtime。

更合理的方向是：

```text
LearningRound Runtime
-> 最小学生学习页面
-> 学生完成一轮真实学习
-> 本轮反馈与下一步动作展示
```

目标是把当前已经成立的 Runtime 闭环收敛成可试用产品体验。

## 八、尚未实现的能力

以下能力尚未完成，后续应分阶段实现。

### 长期学习记忆

- 多 Session 历史。
- 跨天证据累计。
- 延迟复测。
- 长期保持性观察。

### 更强评估能力

- Evidence 质量权重。
- 提示依赖对证据价值的影响。
- 迁移任务证据。
- 冲突证据处理策略。
- 稳定提升的证据门槛。

### 任务与题库能力

- 真实题库资源管理。
- 迁移任务自动生成。
- 复测任务自动匹配。
- 任务难度递进。

### 表达与陪伴能力

- 真实 LLM 反馈表达层。
- 学生可读反馈优化。
- 家长可读阶段报告。
- AI Coach 介入策略运行化。

### 数据与产品化能力

- Evidence Store 持久化。
- Student Profile 持久化。
- 多学生支持。
- 成长报告。
- 成长曲线。
- 家长端视图。

## 八、阅读建议

如果只想理解当前系统，阅读顺序是：

```text
SYSTEM_MAP
-> PRODUCT
-> LEARNING_RUNTIME_OVERVIEW
-> AGENT_PROTOCOL
-> GROWTH_LOOP_OVERVIEW
```

如果要开发某个 Phase，再进入：

```text
docs/education/phase/
```

如果要修改底层教育语义，再进入：

```text
ABILITY_MODEL
QUESTION_MODEL
DIAGNOSIS_MODEL
ABILITY_EVIDENCE_CONTRACT
EVALUATION_MODEL
STUDENT_PROFILE_MODEL
```

最终原则：

```text
SYSTEM_MAP 负责让人不迷路。
具体模型文档负责定义语义。
Runtime 文档负责定义协作边界。
Phase 文档负责记录历史完成情况。
```
