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

## 五、当前 Phase 目标

当前产品正处于 Phase 8。

Phase 8 的核心目标是：

```text
建立长期评估与学习记忆层。
```

当前最重要的不是：

- 扩展题库。
- 美化 UI。
- 做排行榜。
- 做复杂奖励系统。
- 直接宣布学生能力提升。

当前最重要的是：

- 多条 Evidence 如何被评估。
- 什么时候允许更新学生画像。
- 一次改善、持续改善和稳定提升如何区分。
- 如何让系统跨 Session 理解学生状态。
- 如何把 Growth Memory 转化为经过校验的下一步学习策略。

## 六、下一步

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

后续可以再评估 Phase 8.5 或 Phase 9：

```text
TaskRequest Fulfillment
-> 真实任务资源管理
-> 真实学习任务执行
-> New AbilityEvidence
```

## 七、尚未实现的能力

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
