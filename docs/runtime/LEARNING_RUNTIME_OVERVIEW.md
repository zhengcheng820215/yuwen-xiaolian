# 学习运行时总览（Learning Runtime Overview）

本文档用产品视角说明当前学习 Runtime 的数据流。

它不解释代码实现，也不讨论页面交互，只回答一个问题：

学生做完一道题之后，系统如何一步步把作答变成能力证据、学生画像、下一步任务、学习 Session 和复测结果。

## 一、核心数据对象

| 数据对象 | 一句话作用 |
| --- | --- |
| QuestionMetadata | 描述一道题在系统里要考察什么能力、用什么方式评价、按哪些要点评估。 |
| DiagnosisResult | 描述学生这次作答的诊断结果，包括作答状态、可观察表现、问题表现、根因假设以及候选后续行动。 |
| AbilityEvidence | 把一次诊断结果沉淀成一条可累计的能力证据。 |
| EvidenceSummary | 按能力汇总多条 AbilityEvidence，看每项能力有多少薄弱、正向、成长或证据不足记录。 |
| EvaluationResult | 基于多条 AbilityEvidence 判断当前证据能支持什么能力状态或改善信号。 |
| ProfileUpdateDecision | 描述是否追加证据、更新置信度、请求复测、更新状态或保持观察。 |
| StudentAbilityProfile | 保存学生当前长期能力画像，说明主要薄弱能力、能力状态和下一步建议。 |
| PersonalizedNextTask | 基于学生画像、证据状态、候选薄弱点和当前学习阶段生成下一次个性化任务。 |
| PersonalizedTaskExecutionSummary | 记录一次个性化任务执行后的结果摘要，包括作答、诊断、证据更新和下一步决策。 |
| LearningSessionMemory | 把多次个性化任务执行合并成一次学习 Session 记忆。 |
| RetestTask | 基于 LearningSessionMemory 生成一题复测任务，用来验证能力是否能迁移。 |
| RetestExecutionResult | 记录复测执行后的诊断结果、复测证据和后续评估输入。 |
| TaskResource | 保存一份经过校验、可追溯并可重复匹配的正式题目资源。 |
| ConcreteLearningTask | 把匹配到的 TaskResource 实例化为学生当前回合可以完成的具体任务。 |
| TaskExecutionResult | 记录学生对具体任务的真实提交，以及该提交是否可以进入 Diagnosis Runtime。 |
| LearningRoundResult | 汇总一次学习回合从任务准备、作答到证据回流的正式运行结果。 |
| PersistedLearningRound | 保存可恢复的正式回合结果、草稿、反馈和成长记忆，防止刷新后丢失或重复执行。 |
| ContinuousLearningRunResult | 汇总多轮连续学习的资源、策略、证据、持久化和轮次追溯结果。 |
| LearningSessionRecord | 把一个或多个正式 LearningRound 归入一次可跨天查询的学习活动历史。 |
| LearningSessionHistoryResult | 返回通过校验的正式 Session 历史，并隔离损坏、版本不兼容或身份冲突记录。 |
| DelayedRetestPlan | 根据正式历史、Evidence 时间和明确策略记录一项有来源的待复测事项。 |
| RetentionComparisonFacts | 从 Plan、Task、Execution、Diagnosis 和 Evidence 中规范化两次表现的正式比较事实。 |
| RetentionComparabilityResult | 由 Agent 根据正式事实判断两次表现是否可比、受限、不可比或需要复核。 |
| RetentionEvaluationResult | 比较基线与延迟 Evidence，形成克制的保持性观察并关联已有 Phase 8 正式结果。 |
| StructuredQuestionDraft | 保存可编辑但尚未具备正式资源资格的题目草稿。 |
| ResourceValidationResult | 校验内容、评价依据、能力、任务角色和版本关系。 |
| ResourceReviewDecision | 保存人工审核动作、理由和身份。 |
| FrozenQuestionResource | 保存审核通过且不可静默修改的正式题目版本。 |
| ResourceRegistry | 维护唯一当前冻结版本和完整版本历史。 |

## 二、核心 Agent

| Agent | 输入 | 输出 | 作用 |
| --- | --- | --- | --- |
| QuestionMetadataAgent | question、referenceAnswer | QuestionMetadata | 自动判断题目考察的能力和评价方式。 |
| DiagnosisAgent | question、referenceAnswer、studentAnswer、questionMetadata | DiagnosisResult | 完成本地 mock 诊断，用于早期最小链路验证。 |
| RealAIDiagnosisRuntime | question、referenceAnswer、studentAnswer、questionMetadata、previousEvidence | DiagnosisResult、AbilityEvidence、updatedEvidence、EvidenceSummary、StudentAbilityProfile | 当前组合 Runtime：构建 Prompt、调用或模拟 AI、生成证据并串起画像更新，用于验证完整数据链。 |
| StudentThinkingAnalysisAgent | StudentResponse、Diagnosis Result、TaskRequirementCoverage | StudentThinkingAnalysis | 只读整理当前答案中已完成的思考动作与可观察连接断点，不确认内在 Root Cause。 |
| StudentFeedbackGroundingAgent | StudentLearningFeedback、TaskRequirementCoverage | StudentFeedbackGrounding | 将已完成点、唯一主要 Gap 和来源链接绑定到正式反馈事实。 |
| StudentFeedbackActionPlanAgent | StudentResponse、StudentThinkingAnalysis、Learning Gap | StudentFeedbackActionPlan | 把专业判断转换为思考问题和受控支架；结论偏差时比较学生原判断与正式材料线索。 |
| StudentLearningNarrativeAgent | StudentFeedbackActionPlan、正式反馈与学习上下文 | StudentLearningNarrativeProjection | 只读生成学生可理解的反馈表达，不修改 Diagnosis、Evidence 或 Profile。 |
| AbilityEvidenceExtractor | DiagnosisResult、studentId、taskId、diagnosisId | AbilityEvidence | 把诊断结果转换为可长期累计的能力证据。 |
| StudentAbilityProfileAgent | EvidenceSummary、TopWeakness、AbilityEvidence[] | StudentAbilityProfile | 当前最小实现中根据累计证据生成学生能力画像；长期应消费 EvaluationResult 和 ProfileUpdateDecision。 |
| PersonalizedNextTaskAgent | StudentAbilityProfile、TopWeakness、EvidenceSummary、updatedEvidence | PersonalizedNextTask | 根据画像、证据状态和候选薄弱点生成下一次任务候选。 |
| PersonalizedTaskExecutionAgent | PersonalizedNextTask、studentAnswer、updatedEvidence、StudentAbilityProfile | PersonalizedTaskExecutionSummary、newAbilityEvidence、updatedEvidence、updatedStudentAbilityProfile | 学生完成个性化任务后，将答案重新送回诊断 Runtime，并在当前实现中更新证据和画像。 |
| LearningSessionAgent | 多条 PersonalizedTaskExecutionSummary | LearningSessionMemory | 把多次任务执行汇总成一个学习 Session，记录本轮表现变化和下一步建议。 |
| RetestTaskAgent | LearningSessionMemory | RetestTask | 当 Session 建议复测时，生成一题新情境复测任务。 |
| RetestExecutionAgent | RetestTask、studentRetestAnswer、previousEvidence | RetestExecutionResult | 学生完成复测后生成 retest evidence，并把结果交给后续 Evaluation 与 Profile 更新链路。 |
| TaskResourcePreparationAgent | 人工录入题目、评价依据和来源信息 | TaskResource、resource validation | 把真实题目整理为可被任务匹配链消费的正式资源。 |
| TaskExecutionAgent | ConcreteLearningTask、StudentResponse | TaskExecutionResult | 接收真实作答并判断是否值得进入诊断，不负责解释能力。 |
| LearningRoundOrchestrator | GrowthMemory、Profile、TaskResource、StudentResponse | LearningRoundResult | 复用策略、任务、执行、诊断和证据模块，完成一轮学习编排。 |
| LearningPersistenceRepository | 正式回合结果、草稿、反馈和恢复指针 | 可恢复的学习记录 | 隔离页面与存储实现，并保证恢复不会重复回流 Evidence。 |
| ContinuousLearningRunAgent | 已恢复的正式状态、共享 TaskResourceRepository | ContinuousLearningRunResult | 让上一轮保存结果成为下一轮策略和任务的真实输入。 |
| LearningSessionHistoryAgent | 正式 LearningRound 历史、查询条件 | LearningSessionRecord、LearningSessionHistoryResult | 建立和查询跨 Session 学习事实，不重新解释能力。 |
| DelayedRetestSchedulingAgent | Session History、GrowthMemory、Evidence 时间、当前时间 | DelayedRetestCandidate、DelayedRetestPlan | 使用确定性规则安排延迟复测事项，不生成题目或能力结论。 |
| RetentionEvaluationAgent | DelayedRetestPlan、基线与延迟 Evidence、正式任务执行对象 | RetentionComparisonFacts、RetentionComparabilityResult、RetentionEvaluationResult | 重新核验比较事实并生成保持性观察，只关联已有正式回流结果。 |
| QuestionResourceAdmissionAgent | StructuredQuestionDraft、ResourceValidationResult、ResourceReviewDecision、ResourceRegistry | FrozenQuestionResource、ResourceVersion、更新后的 ResourceRegistry | 管理题目草稿、校验、审核、冻结和修订状态机，不允许页面绕过正式准入规则。 |
| QuestionResourceAdmissionRepository | Draft、Review、Frozen Resource、Version、Registry | 可恢复的资源准入记录 | 隔离工作台与 IndexedDB / In-memory 存储，并保持资源身份和版本追溯。 |

## 三、完整数据流

当前 Runtime 可以理解为一条连续的学习链路：

```text
Question + StudentAnswer
-> QuestionMetadata
-> DiagnosisResult
-> AbilityEvidence
-> EvidenceSummary
-> StudentAbilityProfile
-> PersonalizedNextTask
-> PersonalizedTaskExecutionSummary
-> LearningSessionMemory
-> RetestTask
-> RetestExecutionResult
```

更具体地说：

1. 学生提交题目和答案。
2. QuestionMetadataAgent 先理解这道题要观察什么能力。
3. DiagnosisAgent 或 RealAIDiagnosisRuntime 诊断学生这次答案表现。
4. 学生反馈支线以 StudentResponse 和已校验 Coverage 形成 StudentThinkingAnalysis、Learning Gap、Feedback Action Plan 与 Narrative；该支线不修改正式诊断。
5. AbilityEvidenceExtractor 把诊断结果变成一条 AbilityEvidence。
6. 系统把新证据和历史证据合并，形成 updatedEvidence。
7. EvidenceSummary 按能力汇总 updatedEvidence。
8. StudentAbilityProfileAgent 在当前最小实现中根据 EvidenceSummary 生成学生能力画像。
9. PersonalizedNextTaskAgent 根据画像、证据状态和候选薄弱能力生成下一题任务候选。
10. 学生完成训练任务后，PersonalizedTaskExecutionAgent 把答案重新送入诊断链路。
11. 多次任务执行后，LearningSessionAgent 生成 LearningSessionMemory。
12. 如果 Session 建议复测，RetestTaskAgent 生成新情境复测题。
13. 学生完成复测后，RetestExecutionAgent 生成 RetestExecutionResult，并把复测证据交给后续 Evaluation 与 Profile 更新链路。

Phase 9 到 Phase 12 又把这条能力链放入真实任务与连续运行环境：

```text
TaskResourceRepository
-> TaskResource
-> ConcreteLearningTask
-> StudentResponse
-> TaskExecutionResult
-> DiagnosisResult
-> AbilityEvidence
-> Evaluation / ProfileUpdateDecision / GrowthMemory
-> PersistedLearningRound
-> restore
-> NextLearningStrategy
-> next TaskResource
```

这里最重要的约束是：Phase 12.2 负责把真实题目写入共享资源仓库，Phase 12.3 只查询同一个仓库。连续运行层不得在内部临时造一份固定题目绕过 TaskFulfillment。

Phase 13 把连续学习扩展到跨 Session 和不同时间点：

```text
LearningRoundResult[]
-> LearningSessionRecord / Session History
-> DelayedRetestPlan
-> TaskRequest / TaskFulfillment / Delayed LearningRound
-> new delayed AbilityEvidence
```

延迟 Evidence 与保持性观察使用两条职责不同的链路：

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

`RetentionEvaluationResult` 不是 AbilityEvidence，也不是 Phase 8 输入。它只比较和解释正式 Evidence；可比性必须由 Agent 根据正式来源对象派生，不能由调用方直接指定。

Phase 14.1 和 Phase 14.2 在正式 Evidence 进入质量感知 Evaluation 之前增加两层解释：

```text
AbilityEvidence
+ Formal Task / Execution / Diagnosis / Timing Context
-> EvidenceQualityAssessment

AbilityEvidence[]
+ Current EvidenceQualityAssessment[]
+ Formal Comparison Context[]
-> EvidenceConflictAssessment
-> EvaluationContextEnvelope
-> Evaluation Runtime Capability Negotiation
```

`EvidenceQualityAssessment` 说明一条 Evidence 的观察条件是否可靠，不改变其正向、成长、弱项或不足方向。`EvidenceConflictAssessment` 说明多条独立观察之间是一致、可解释地混合、未解决冲突、证据不足还是需要复核。

当前 Existing Phase 8 仍使用 legacy Runtime Contract。只有 Runtime 明确声明支持所需 Quality / Conflict Capability 时，`EvaluationContextEnvelope` 才允许 quality-aware handoff；不兼容时会阻断，不会静默替换旧语义。

## 四、当前实现与长期标准协议

当前 Runtime 记录的是工程已经跑通的数据骨架。

为了验证完整链路，部分 Runtime 在 Phase 4 到 Phase 6 中采用了组合实现。例如 RealAIDiagnosisRuntime 当前可能同时串起：

```text
DiagnosisResult
-> AbilityEvidence
-> EvidenceSummary
-> StudentAbilityProfile
```

这属于当前最小闭环的工程实现，不代表长期 Agent 职责边界。

长期标准协议应收敛为：

```text
DiagnosisResult
-> AbilityEvidence
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
-> PersonalizedNextTask
```

也就是说：

- Diagnosis 只负责本次作答诊断和候选后续行动；
- AbilityEvidenceExtractor 负责把诊断结果转成正式 AbilityEvidence；
- Evaluation Runtime 负责判断多条 Evidence 能支持什么结论；
- Profile Runtime 只执行合法的 ProfileUpdateDecision；
- PersonalizedNextTask 负责决定下一次任务是训练、复测、迁移验证、补充作答还是继续观察。

每条 Evidence 都可以被记录，但不一定改变能力等级、能力状态或成长趋势。

Phase 列记录模块首次建立时的工程阶段，不代表当前产品所处阶段。

## 五、关键理解

### 1. 题目不是终点

题目的作用是触发一次能力观察。

系统真正沉淀的不是“做过哪道题”，而是：

- 学生在哪项能力上有表现；
- 这次表现是薄弱、正向、成长，还是证据不足；
- 这条证据能否推动下一步训练或复测。

### 2. DiagnosisResult 是一次判断

DiagnosisResult 只代表本次作答的诊断结果。

它回答：

- 这次主要观察哪项能力；
- 学生答案满足到什么程度；
- 问题可能出在哪里；
- 候选后续行动是什么。

DiagnosisResult 可以提出训练、复测、补充作答、继续诊断或观察等候选方向，但不直接决定最终训练任务。

### 3. AbilityEvidence 是长期 Runtime 的燃料

AbilityEvidence 是系统能够长期理解学生的关键数据。

每次诊断、训练或复测都可以产生新的 AbilityEvidence。多条 Evidence 累积后，系统才有能力判断学生的长期变化。

Runtime 底层约束：

```text
“能力提升”不是 AI 输出的描述字段，
而是一个需要经过时间、多次表现和独立复测才能成立的状态。
```

因此，DiagnosisResult、AbilityEvidence、EvaluationResult、ProfileUpdateDecision 和后续 StageReport 都只能在证据充分时逐步提高判断强度。

单次结果只能表达：

- 本次表现满足要求；
- 出现改善迹象；
- 本次复测优于训练前；
- 仍需继续观察。

不能仅凭单次结果直接表达：

- 能力已经提升；
- 能力已经掌握；
- 薄弱点已经解决。

### 4. StudentAbilityProfile 不是考试成绩

StudentAbilityProfile 不是分数，也不是一次判断。

当前最小实现中，Profile Agent 可以根据 EvidenceSummary 和 TopWeakness 生成画像。

长期协议中，画像更新必须消费 EvaluationResult 和 ProfileUpdateDecision。

StudentAbilityProfile 用来回答：

- 当前最需要优先关注的能力是什么；
- 哪些能力仍然薄弱；
- 哪些能力出现改善信号；
- 下一步应该继续训练、复测，还是切换能力。

### 5. PersonalizedNextTask 不是随机出题

PersonalizedNextTask 必须参考 StudentAbilityProfile 和 TopWeakness，但不能只依赖这两个对象。

它说明：

- 这次任务训练什么能力；
- 为什么现在训练这个能力；
- 任务和哪些历史 Evidence 有关；
- 学生作答后应该观察什么。

长期输入还应包括 EvaluationResult、当前成长需求、证据是否充分、根因是否得到支持、最近训练历史、提示依赖、复测或迁移需求以及可用任务资源。

TopWeakness 不等于下一步必然训练该能力。下一步也可能是补充作答、诊断验证、独立复测、迁移任务或继续观察。

### 6. LearningSessionMemory 把多次任务串起来

一次任务只能说明一次表现。

LearningSessionMemory 把多次任务执行放在一起，判断一轮训练后是否出现：

- 没有明显改善；
- 早期改善信号；
- 本轮多次表现优于起点；
- 需要复测验证；
- 可以切换能力。

LearningSessionMemory 可以记录本 Session 内的变化模式，但不能独立确认长期能力提升。

Session 内持续改善不等于长期能力已经提升。

### 7. Retest 是迁移验证

复测不是重复原题。

RetestTask 应该使用新文本、新情境或新表达方式，验证学生是否能把训练中的能力迁移到新的任务里。

RetestExecutionResult 可以产生高价值复测证据，但一次复测不应直接升级长期画像。

长期链路应是：

```text
RetestExecutionResult
-> Retest Evidence
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

## 六、模块总表

| 模块 | 输入 | 输出 | 作用 | 所属 Phase |
| --- | --- | --- | --- | --- |
| QuestionMetadataAgent | question、referenceAnswer | QuestionMetadata | 自动生成题目元数据，让 Diagnosis 不再重新解释题目。 | Phase 2 |
| Metadata Validator | QuestionMetadata | validation result | 检查 Metadata 是否字段完整、模式合理。 | Phase 2 |
| DiagnosisAgent | question、referenceAnswer、studentAnswer、questionMetadata | DiagnosisResult | 验证最小诊断链路。 | Phase 1 / Phase 2 |
| RealAIDiagnosisRuntime | question、referenceAnswer、studentAnswer、previousEvidence | DiagnosisResult、newAbilityEvidence、updatedEvidence、StudentAbilityProfile | 将真实或 mock AI 诊断接入当前组合 Runtime；长期应拆分为 Diagnosis、Evidence、Evaluation 和 Profile 更新链路。 | Phase 4.2 |
| Live AI Evaluation | Live AI samples | Evaluation Report | 评估真实 AI 诊断质量是否可接受。 | Phase 4.3 |
| AbilityEvidenceExtractor | DiagnosisResult | AbilityEvidence | 把一次诊断转成可累计证据。 | Phase 3.1 |
| Evidence Summary / Weakness Ranking | AbilityEvidence[] | EvidenceSummary、TopWeakness | 汇总证据并排序候选薄弱能力。 | Phase 3.1 |
| StudentAbilityProfileAgent | EvidenceSummary、TopWeakness、AbilityEvidence[] | StudentAbilityProfile | 当前最小实现中生成学生能力画像；长期应消费 EvaluationResult 和 ProfileUpdateDecision。 | Phase 4.1 |
| PersonalizedNextTaskAgent | StudentAbilityProfile、TopWeakness、EvidenceSummary、updatedEvidence | PersonalizedNextTask | 生成下一次个性化任务候选。 | Phase 5.1 |
| PersonalizedTaskExecutionAgent | PersonalizedNextTask、studentAnswer、updatedEvidence | PersonalizedTaskExecutionSummary、updatedStudentAbilityProfile | 执行任务后回流诊断，并在当前组合实现中更新证据和画像。 | Phase 5.2 |
| LearningSessionAgent | PersonalizedTaskExecutionSummary[] | LearningSessionMemory | 汇总多次任务执行，形成学习 Session 记忆和本轮变化信号。 | Phase 5.3 |
| RetestTaskAgent | LearningSessionMemory | RetestTask | 在需要复测时生成新情境复测任务。 | Phase 6.1 |
| RetestExecutionAgent | RetestTask、studentRetestAnswer、previousEvidence | RetestExecutionResult | 执行复测，生成 retest evidence，并交给 Evaluation 与 Profile 更新链路。 | Phase 6.2 |
| AbilityChangeEvaluationAgent | beforeEvidence、trainingEvidence、retestEvidence | AbilityChangeEvaluation | 早期能力变化判断对象，用于比较训练前、训练中和复测证据；长期语义应收敛到 EvaluationResult。 | Phase 6.3 |
| LearningEntryAgent | question、studentAnswer、questionMetadata | LearningEntryResult | 生成 Beta 学习入口结果，让学生从第一题诊断进入学习流程。 | Phase 7.1 |
| PersonalizedTrainingFlowAgent | LearningEntryResult、studentTrainingAnswer | PersonalizedTrainingFlowResult | 消费入口诊断结果，生成并执行一次个性化训练流程。 | Phase 7.2 |
| BetaLearningSessionResultAgent | PersonalizedTrainingFlowResult、studentRetestAnswer | BetaLearningSessionResult | 串起训练、复测和本轮学习结果反馈，形成单次 Beta 学习闭环。 | Phase 7.3 |
| EvaluationAgent | AbilityEvidence[] | EvaluationResult | 判断多条证据是否充分、是否冲突，以及最多能支持多强的能力状态或改善信号。 | Phase 8.1.1 |
| ProfileUpdateDecisionAgent | EvaluationResult、currentProfile | ProfileUpdateDecision | 根据 EvaluationResult 生成画像更新决策，避免 Profile 直接重新解释 Evidence。 | Phase 8.1.2 |
| ProfileUpdateExecutor | StudentAbilityProfile、ProfileUpdateDecision | StudentAbilityProfile | 只执行合法的 ProfileUpdateDecision，完成受约束的画像更新。 | Phase 8.1.3 |
| TaskResourcePreparationAgent | 真实题目草稿 | TaskResource、ResourceValidation | 校验并保存正式题目资源，评价依据不足时只保留草稿。 | Phase 12.2 |
| TaskResourceRepository | TaskResource、能力与题型查询条件 | 可匹配的 TaskResource[] | 为题目录入和连续学习提供同一个资源读写边界；浏览器使用 IndexedDB，Debug 使用内存适配器。 | Phase 12.2 / 12.3 |
| LearningPersistenceRepository | 学习回合正式结果与恢复请求 | PersistedLearningRound | 保存和恢复回合，按正式 ID 保证幂等，避免重复 Diagnosis、Evidence 和 Profile 更新。 | Phase 12.1 |
| ContinuousLearningRunAgent | 恢复后的 GrowthMemory / Profile、TaskResourceRepository、学生作答 | ContinuousLearningRunResult | 让上一轮正式结果驱动下一轮策略，并从共享仓库获取不同的真实题目。 | Phase 12.3 |
| LearningSessionHistoryAgent / Repository | LearningRoundResult[]、student / ability / time 查询 | LearningSessionRecord、LearningSessionHistoryResult | 保存和查询跨 Session 学习事实，并隔离无效历史。 | Phase 13.1 |
| DelayedRetestSchedulingAgent | Session History、GrowthMemory、Evidence 时间、当前时间 | DelayedRetestCandidate、DelayedRetestPlan | 生成有来源、有理由、可去重的待复测事项。 | Phase 13.2 |
| RetentionEvaluationAgent | Plan、正式 Task / Execution / Evidence、已有 Phase 8 结果 | RetentionComparisonFacts、RetentionComparabilityResult、RetentionEvaluationResult | 比较基线和延迟表现，关联而不重复执行正式能力回流。 | Phase 13.3 |
| EvidenceQualityAssessmentAgent | AbilityEvidence、正式 Task / Execution / Evidence Return、Retention Context | EvidenceQualityAssessment | 从提示、材料、时间、Diagnosis 与追溯事实中派生单条 Evidence 的质量和 Eligibility。 | Phase 14.1 |
| EvidenceComparisonContextAdapter | AbilityEvidence、Quality Assessment、ConcreteLearningTask、TaskExecutionResult | EvidenceComparisonContext | 从正式任务与执行事实补足材料、时间窗口和重复执行关系。 | Phase 14.2 |
| EvidenceConflictAssessmentAgent | AbilityEvidence[]、当前 Quality Assessment[]、Comparison Context[] | EvidenceConflictAssessment | 按 observation unit 去重，协调同向、混合、冲突、不足与复核状态。 | Phase 14.2 |
| EvaluationContextAdapter | raw Evidence、Conflict Assessment、Runtime Contract | EvaluationContextEnvelope | 保留 raw / primary / supporting Evidence，并在能力兼容时准备 quality-aware Evaluation 输入。 | Phase 14.2 |
| AdaptiveTaskConstraintsAgent | NextLearningStrategy、Quality / Conflict Context、AdaptiveTaskContextSnapshot | AdaptiveTaskConstraints | 在既有策略方向内生成难度、材料、提示和任务角色约束。 | Phase 14.3 |
| DiagnosisProviderAdapter | 版本化 Provider 配置、正式任务与有效作答 | Raw Model Output、Provider Run Metadata | 调用真实 Provider，不直接生成正式 Diagnosis 或 Evidence。 | Phase 15.1 |
| RealLLMRuntimeFoundationAgent | Raw Output、身份与 Schema 边界、Formal Commit Repository | RealDiagnosisRuntimeResult、FormalDiagnosisCommit | 校验 Candidate，并以原子提交边界形成唯一正式 Diagnosis。 | Phase 15.1 |
| DiagnosisQualityEvaluationAgent | Frozen Dataset、Diagnosis Candidate、人工边界与质量策略 | DiagnosisQualityEvaluation | 生成 accepted、questionable、unacceptable 或 critical_violation 质量结果。 | Phase 15.2 |
| ControlledFeedbackExpressionAgent | Committed Diagnosis、AbilityEvidence、StructuredFeedbackFacts、ActionableSuggestions | ControlledFeedbackResult | 只表达已确认事实；校验失败或 Provider 失败时保留确定性模板。 | Phase 15.3 |

### Phase 12 基础集成边界

浏览器端以 IndexedDB 保存正式题目资源和学习回合；自动化 Debug 使用相同 Repository Contract 的内存适配器。页面只调用应用服务，不直接读写 IndexedDB。

恢复代表读取已经保存的正式结果，不代表重新执行本轮。相同 `learningRoundId`、`responseId`、Evidence ID 或正式执行结果不得因刷新、恢复或重试而重复写入。

当前基础集成使用两道同属「推理」但阅读文本不同的正式 TaskResource，验证：

```text
Round 1 正式结果保存
-> 恢复 GrowthMemory / Profile
-> 生成 Round 2 Strategy / TaskRequest
-> 查询另一道正式 TaskResource
-> 完成 Round 2
```

### Phase 13 跨 Session 边界

Phase 13.1、13.2、13.3 Runtime 均已通过；Phase 13.1 Browser Smoke 为 12 / 12 PASS，Phase 13.2 为 13 / 13 PASS，Phase 13.3 为 18 / 18 PASS，相关回归与 Production Build 通过。Phase 13 总体已冻结。

Session History 只记录发生过什么；Delayed Retest Scheduling 只决定何时需要新的观察；Retention Evaluation 只比较和解释正式 Evidence。三者都不能因为 Session 结束、Evidence 变旧或一次延迟复测较弱，就直接生成长期能力结论。

### Phase 14 质量与冲突边界

Phase 14.1、14.2 与 14.3 Runtime 均已通过，专项 Debug 分别为 17 / 17、25 / 25 和 26 / 26；执行后 Evidence 质量重评集成 Case 27 为 16 / 16 PASS，相关回归与 Production Build 通过。Phase 14 总体状态为 `PASS / FROZEN`。

Evidence 质量不等于学生能力等级；Conflict Status 不等于 Profile 状态；Observation Unit 代表一次真实观察，不等于 Evidence ID 数量。低质量或同质 Evidence 会被保留为上下文，但不能通过数量堆叠形成稳定结论。

当前 Existing Phase 8 未声明质量与冲突能力，因此 quality-aware handoff 默认阻断。现阶段已经证明的是质量解释、冲突协调和能力协商边界，不是正式 Profile 已经按 Phase 14 语义更新。

Phase 14.3 已通过 `AdaptiveTaskContextSnapshot`、受控 `AdaptiveConstraintRule` 与 `AdaptiveTaskRequestEnvelope` 把约束交给 Existing TaskFulfillment，不扩写 Existing CurrentLearningContext，也不把 `TaskRequest.constraints` 字符串摘要当作正式协议。执行后的 Evidence 质量必须由 Phase 14.1 重新判断。

集成验证进一步确认：任务约束可以把目标质量设为 high，但三次提示后的真实表现只形成 `low / limited` Assessment；占位回答不会产生正式 Evidence。目标质量是观察目标，不是对学生表现的预判或承诺。

Phase 14 正式冻结结论：系统能够根据正式任务、作答、提示、时间和追溯事实评估 Evidence 的判断价值，协调多条 Evidence 的方向关系，并在 Existing Strategy 的边界内生成受控任务约束；任务执行后，系统会依据真实表现重新评估 Evidence 质量，而不会把目标质量当成实际结果。

### Phase 15 真实 AI Runtime 与受控表达边界

Phase 15.1、15.2 与 15.3 均已通过并冻结。当前已具备 DeepSeek Chat Completions 与 OpenAI Responses Provider Adapter、版本化配置、运行记录、Raw Output 隔离、有限重试、失败阻断、Formal Diagnosis 原子提交、真实 Diagnosis 质量评估和受控学生反馈。Phase 15.1 确定性 Debug 为 22 / 22、真实 Provider Smoke 为 4 / 4；Phase 15.2 正式验收为 15 / 15；Phase 15.3 确定性 Debug 为 24 / 24，真实表达为 12 / 12。

正式职责顺序：

```text
TaskExecution Validity Gate
-> Versioned Real LLM Call
-> Formal Diagnosis Candidate Validation
-> commitFormalDiagnosis()
-> Committed Formal DiagnosisResult
-> Existing Phase 9.3 Evidence Return
-> Existing Phase 8 Runtime
-> Phase 14 Evidence Quality Assessment
```

Phase 15 不重定义 DiagnosisResult，不让 Provider Adapter 直接生成 Evidence，也不在 Live 失败时静默回退 mock 形成正式结果。候选结果可以重试和审查，只有通过 Repository 原子提交后才成为正式 Diagnosis；同一 requestId 不能因刷新、重试或回流失败产生第二份正式结果。

Phase 15.1 的真实联调保持最小规模：正常 Live、Shadow 和 Prompt Injection 使用真实 Provider，能力错位或非法结构使用受控 Provider 验证阻断。联调只确认正式结果是否具备进入 Existing Evidence Return 的资格，不在本阶段直接创建 Evidence。

结构 Repair 只允许修复白名单内的非语义问题，任何 `mainAbility`、`answerStatus`、`rootCause`、引用或 Evidence 方向的修改都必须重新调用模型或进入复核。Phase 15.2 使用版本化冻结 Dataset 与 93 个 Candidate 建立明确分母；Phase 15.3 的 Controlled Feedback 把可追溯事实和行动建议分开，不由表达层新增教育结论。

Phase 15.2 已完成 Prompt v3 基线、Prompt v4 工程实现、真实专项 Slice、v4 Full Calibrated Baseline、Root Cause Failure Attribution、Policy v2.1 校准、完整 Evaluator Activation Dry Run、负责人确认和正式启用回归。Policy v2.1 的 Root Cause 接受为 90 / 93，正式质量分布为 accepted 79、questionable 6、unacceptable 8、critical 0；15 / 15 正式验收通过。正式质量 Evaluator 默认使用 Policy v2.1，旧 Policy v2 仅保留历史复现入口。Prompt v4 已完成质量验证，但 Provider 默认 Prompt 的后续切换仍必须通过版本化配置显式执行。

Phase 15.3 已完成受控反馈表达工程与质量验收：确定性模板是默认可靠能力，可选 LLM 只能选择已验证的安全表达；普通 Live 反馈保持 restricted 权限，合法 Fact ID 不能掩盖语义扩大，越权、Schema 非法或 Provider 失败时保留模板。确定性 Debug 为 24 / 24 PASS，DeepSeek Prompt v1.1 Live 为 12 / 12 PASS，Controlled Safety 为 2 / 2 PASS，12 条脱敏反馈人工抽检全部接受。Phase 15.3 与 Phase 15 当前均为 `PASS / FROZEN`。

### Phase 16 结构化内容与真实学习运行边界

Phase 16.1 已把早期 TaskResource Preparation 扩展为正式资源准入状态机：

```text
StructuredQuestionDraft
-> ResourceValidationResult
-> ResourceReviewDecision
-> FrozenQuestionResource
-> ResourceVersion / ResourceRegistry
```

Draft 可以保存和修订，但不能被正式 TaskFulfillment 消费。只有通过结构化校验和人工审核的 FrozenQuestionResource 才具备正式匹配资格；冻结版本不可静默修改，修订必须生成新 Draft 和新版本。工作台通过 QuestionResourceAdmissionAgent 与 Repository 执行同一套规则，页面不能直接把草稿提升为正式资源。

Phase 16.1A 确定性 Debug 为 `22 / 22 PASS`，16.1B 最小录入工作台已通过人工 Demo 验收。Phase 16.2A 为 `12 / 12 PASS`，证明正式资源必须先通过 Registry current、审核校验追溯、primary ability、task role、核心难度和 Rubric Gate；Phase 16.2B 为 `16 / 16 PASS`，进一步复用 Existing TaskFulfillment并形成 `matched / partial_match / no_match / review_required` 正式分流。轻量 Match Review Demo、16.1 -> 16.2 人工联调、单对象 E2E 与受控 DeepSeek Provider Smoke 均已通过；Phase 16.2 当前为 `PASS / FROZEN`。

Phase 16.3 设计已接受并按三个顺序工作包推进。16.3A / B 为 `PASS / FROZEN`。16.3C 已完成工程预演：正式 `/learning`、服务端 Diagnosis Application Boundary、IndexedDB Checkpoint / Persistence / Session / Multi-day Repository、无效作答前置 Gate 与内部多日复核已接通；`training / retest / transfer / observation / diagnosis` 使用各自正式 Frozen Resource，资源缺失时明确阻断。此时学生端必须说明“需要补充符合条件的正式任务”，不得暗示后台正在自动准备；资源补齐后仅重新执行资源匹配，不重新调用 Diagnosis，也不重复生成 Evidence 或更新 Profile。Simulation `10 / 10 PASS`、Application Boundary Controlled Live Smoke `PASS`、Lightweight Demo 人工 Case `4 / 4 PASS`，浏览器草稿刷新恢复通过。当前仍为 `ENGINEERING + HUMAN DEMO PASS / NATURAL-DAY ACCEPTANCE PENDING (0 / 5)`；入口和模拟验收不替代 5—7 个自然日运行。

2026-07-21 已补齐 Product / Demo 数据作用域隔离：正式 `/learning` 使用 `student-local-primary-v1`，Phase 16.3 Demo 使用独立验收身份；正式资源在进入本轮时绑定产品学生，Demo Operation、Session、Round 和持久化记录不能进入正式入口或自然日统计。验收清理改为按 Demo 学生清理，不再全库清理 Operation。专项 Debug `9 / 9 PASS`，不调用真实网络 Provider，不删除旧 Demo 数据。

当前启用边界：Prompt v4 已通过质量验证，但成为所有正式 Provider 调用的默认 Prompt 仍须通过版本化配置显式切换。`Formal Commit -> Phase 9.3 -> Phase 8 -> Phase 14.1 -> Controlled Feedback` 已通过 `11 / 11` 确定性独立整链 Debug；受控真实 Provider 单对象 Smoke、正式浏览器入口、Application Boundary Live Smoke 与持久化恢复已经成立，但 5—7 个自然日运行尚未完成。

## 七、当前 Runtime 的一句话总结

当前系统已经从“学生做一道题”扩展为：

```text
做题
-> 诊断
-> 证据
-> 画像
-> 个性化任务
-> 任务执行
-> Session 记忆
-> 复测
-> Evaluation 评估
-> Profile Update Decision
-> 受约束地更新画像
-> 跨 Session History
-> 延迟复测计划
-> 保持性观察
-> Evidence 质量分级
-> 冲突证据协调
-> Evaluation 能力协商
```

这说明产品已经具备一个最小可运行的学习 Runtime 骨架。

它当前证明的是数据链路成立，而不是证明真实学习效果已经稳定成立。真实学习效果还需要依赖后续更多真实题、真实学生作答、复测结果和长期记录来验证。
