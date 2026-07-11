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

## 二、核心 Agent

| Agent | 输入 | 输出 | 作用 |
| --- | --- | --- | --- |
| QuestionMetadataAgent | question、referenceAnswer | QuestionMetadata | 自动判断题目考察的能力和评价方式。 |
| DiagnosisAgent | question、referenceAnswer、studentAnswer、questionMetadata | DiagnosisResult | 完成本地 mock 诊断，用于早期最小链路验证。 |
| RealAIDiagnosisRuntime | question、referenceAnswer、studentAnswer、questionMetadata、previousEvidence | DiagnosisResult、AbilityEvidence、updatedEvidence、EvidenceSummary、StudentAbilityProfile | 当前组合 Runtime：构建 Prompt、调用或模拟 AI、生成证据并串起画像更新，用于验证完整数据链。 |
| AbilityEvidenceExtractor | DiagnosisResult、studentId、taskId、diagnosisId | AbilityEvidence | 把诊断结果转换为可长期累计的能力证据。 |
| StudentAbilityProfileAgent | EvidenceSummary、TopWeakness、AbilityEvidence[] | StudentAbilityProfile | 当前最小实现中根据累计证据生成学生能力画像；长期应消费 EvaluationResult 和 ProfileUpdateDecision。 |
| PersonalizedNextTaskAgent | StudentAbilityProfile、TopWeakness、EvidenceSummary、updatedEvidence | PersonalizedNextTask | 根据画像、证据状态和候选薄弱点生成下一次任务候选。 |
| PersonalizedTaskExecutionAgent | PersonalizedNextTask、studentAnswer、updatedEvidence、StudentAbilityProfile | PersonalizedTaskExecutionSummary、newAbilityEvidence、updatedEvidence、updatedStudentAbilityProfile | 学生完成个性化任务后，将答案重新送回诊断 Runtime，并在当前实现中更新证据和画像。 |
| LearningSessionAgent | 多条 PersonalizedTaskExecutionSummary | LearningSessionMemory | 把多次任务执行汇总成一个学习 Session，记录本轮表现变化和下一步建议。 |
| RetestTaskAgent | LearningSessionMemory | RetestTask | 当 Session 建议复测时，生成一题新情境复测任务。 |
| RetestExecutionAgent | RetestTask、studentRetestAnswer、previousEvidence | RetestExecutionResult | 学生完成复测后生成 retest evidence，并把结果交给后续 Evaluation 与 Profile 更新链路。 |

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
4. AbilityEvidenceExtractor 把诊断结果变成一条 AbilityEvidence。
5. 系统把新证据和历史证据合并，形成 updatedEvidence。
6. EvidenceSummary 按能力汇总 updatedEvidence。
7. StudentAbilityProfileAgent 在当前最小实现中根据 EvidenceSummary 生成学生能力画像。
8. PersonalizedNextTaskAgent 根据画像、证据状态和候选薄弱能力生成下一题任务候选。
9. 学生完成训练任务后，PersonalizedTaskExecutionAgent 把答案重新送入诊断链路。
10. 多次任务执行后，LearningSessionAgent 生成 LearningSessionMemory。
11. 如果 Session 建议复测，RetestTaskAgent 生成新情境复测题。
12. 学生完成复测后，RetestExecutionAgent 生成 RetestExecutionResult，并把复测证据交给后续 Evaluation 与 Profile 更新链路。

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
-> 再次更新画像
```

这说明产品已经具备一个最小可运行的学习 Runtime 骨架。

它当前证明的是数据链路成立，而不是证明真实学习效果已经稳定成立。真实学习效果还需要依赖后续更多真实题、真实学生作答、复测结果和长期记录来验证。
