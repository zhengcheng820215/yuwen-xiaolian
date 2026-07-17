# Phase 16：结构化内容与真实学习运行基础（Structured Content and Real Learning Operation Foundation）

设计状态：ACCEPTED

工程状态：IN PROGRESS（Phase 16.1A PASS；Phase 16.1B、16.2、16.3 未开始）

## 一、阶段定位

Phase 15 已经证明：

```text
Valid Student Answer
-> Real LLM Diagnosis
-> Formal Diagnosis Commit
-> Existing Evidence Runtime
-> Evidence Quality Assessment
-> Controlled Student Feedback
```

系统已经能够受控调用真实 LLM，对真实作答形成可验证的 Diagnosis，并将正式结果接入既有 Evidence、Evaluation、ProfileUpdateDecision、GrowthMemory 与反馈链路。

但当前学习运行仍主要依赖少量 mock 或预置任务资源，尚未系统回答：

```text
真实题目如何通过结构化录入、校验和人工审核进入系统？
系统如何证明某项资源适合当前 TaskRequest，而不只是 abilityId 相同？
正式资源、真实 AI 与跨 Session 记忆能否支持连续多个自然日的学习？
异常发生时，正式事实是否仍然保持可恢复、可追溯且不被污染？
```

Phase 16 不新增第二套题目模型、任务匹配、Diagnosis、Evidence、Evaluation、Profile 或 GrowthMemory 链路。

Phase 16 的任务是：

1. 建立真实题目资源的结构化准入、审核、冻结和版本治理基础；
2. 提供一个无需修改工程代码即可完成录入、校验、审核、冻结和预览的最小入口；
3. 验证正式资源与 TaskRequest 的匹配质量，并保留可解释的匹配依据；
4. 让单学生使用真实资源连续运行 5—7 个自然日，并对学习链路进行人工复核；
5. 验证资源、Provider、复测和人工复核异常不会污染正式状态。

## 二、一句话定义

> 让真实题目能够经过结构化录入、校验、人工审核和版本冻结进入现有学习 Runtime，并支持单学生连续多日、可恢复、可追溯、可人工复核的真实学习运行。

## 三、与既有模型和 Phase 的承接关系

### Question Model / Question Metadata Model

Phase 16.1 必须复用既有题目与 Metadata 语义，包括：

- 题目是能力观察载体，不是长期能力结论；
- 每道任务必须具有明确的主要观察目标；
- AnswerAcceptance 只定义答案接受边界；
- Rubric 只定义本题如何观察表现；
- Question Metadata 提供运行契约，不直接生成 Diagnosis；
- 题目来源、审核状态和版本必须可追溯。

Phase 16 不在 Phase 文档中重新定义完整 Question Metadata Schema。具体字段仍以核心模型和工程 Contract 为准。

### Phase 8.4

Phase 8.4 已建立：

```text
Validated TaskRequest
-> TaskFulfillmentRequest
-> TaskResourceMatchResult
-> ExecutableLearningTask / TaskGenerationRequest
```

Phase 16.2 必须扩展并验证这条既有匹配链，不得创建第二套资源匹配 Runtime。

### Phase 13

Phase 13 已建立单学生、本地环境下的跨 Session 历史保存、恢复、延迟复测计划和保持性观察。

Phase 16.3 必须复用这些能力完成真实多日运行，不重新建设 Persistence、Delayed Retest 或 Growth Memory。

### Phase 14

Phase 14 已建立 Evidence 质量、冲突协调和受控自适应约束。

Phase 16.2 与 16.3 必须继续遵守：目标质量不等于实际表现质量，资源匹配成功也不代表任务教学有效。

### Phase 15

Phase 15 已建立真实 LLM Diagnosis、Formal Diagnosis Commit 和受控学生反馈。

Phase 16.3 使用该正式链路处理真实题目上的学生作答，不允许因 Provider 失败静默回退到 mock Diagnosis 并形成正式 Evidence。

## 四、Phase 16 只回答的问题

Phase 16 回答：

1. 一道真实题目能否经过结构化 Draft、校验和人工审核成为正式资源？
2. 正式资源的身份、来源、版本和审核状态能否完整追溯？
3. 系统能否解释为什么某项资源满足当前 TaskRequest？
4. 匹配失败、部分匹配或资源异常时，系统能否明确阻断或形成资源缺口？
5. 单学生能否使用真实题目连续运行 5—7 个自然日？
6. 页面刷新、跨日恢复、延迟复测、重复提交和人工复核能否保持正式事实一致？

Phase 16 不回答：

- 学生是否已经长期掌握某项能力；
- 5—7 天学习是否已经证明教学有效；
- 题目难度是否已经可以由系统自动学习和动态校准；
- AI 是否可以不经人工审核批量生成正式题目；
- 是否已经具备大型题库、多人账号或正式内容运营平台；
- 是否已经完成复杂推荐排序或多 Session 自动教学编排。

## 五、三个最小闭环

### Phase 16.1：结构化题目录入与审核（Structured Question Intake and Review）

核心问题：

> 真实题目如何通过正式资源准入，而不是被直接复制进 Runtime？

最小链路：

```text
Raw Question Input
-> Structured Question Draft
-> Metadata / Rubric / Identity Validation
├─ failed
│  -> validation_failed
└─ passed
   -> pending_review
   -> Human Review
   ├─ rejected / revision_required
   └─ reviewed
      -> Frozen Question Resource
```

第一版至少支持：

- 选择；
- 判断；
- 填空；
- 开放简答；
- 阅读理解。

正式资源至少能够区分：

- QuestionSource；
- Material；
- QuestionStem；
- ResponseFormat；
- AnswerAcceptance；
- Rubric；
- AbilityMetadata；
- ResourceReview；
- ResourceVersion；
- ResourceRegistry。

资源生命周期：

```text
raw
-> drafted
-> validation_failed / pending_review
-> reviewed
-> frozen
-> superseded / retired
```

阶段底线：

1. `AnswerAcceptance` 只决定哪些答案形式可以被接受，不形成能力结论；
2. `Rubric` 描述本题如何观察表现，不预写固定 Diagnosis；
3. AI 可以协助生成 Draft，但不能自动把 Draft 冻结为正式资源；
4. `frozen` 资源不可静默原地修改，任何正式变更必须产生新版本；
5. 历史 Evidence 必须继续引用其产生时使用的资源版本；
6. 同一 Material 可以关联多个 Task，但每个 Task 必须具有独立身份、目标能力、任务角色、Rubric、答案接受规则和难度；
7. 开放题可以没有唯一标准答案，但必须具有明确 Rubric、最低作答要求和诊断边界。

第一版以文本录入为主。截图、OCR 或 AI 辅助抽取只作为 Draft 输入增强，不得阻塞 Phase 16.1，也不得绕过人工审核。

Phase 16.1 内部拆分为两个工程工作包，但不新增 Phase 层级：

```text
16.1A 资源准入 Runtime
Raw Input
-> Draft
-> Validation
-> Review
-> Freeze
-> Version

16.1B 最小录入工作台
Human Input
-> Draft Editing
-> Validation Feedback
-> Review Action
-> Frozen Resource Preview
```

最小录入工作台是 Phase 16.1 的必需验收入口，不是可选展示页。它至少支持新建 Draft、录入或选择 Material、配置题干和评价结构、查看校验结果、提交审核、执行审核决策、冻结资源、创建新版本，以及分别预览学生端题目形态和审核所需完整结构。

工作台必须消费 16.1A 的正式 Validator、Review、Freeze 和 Version Runtime，不得在页面中复制或放宽另一套业务规则。Draft 至少需要支持本地保存和刷新恢复；Frozen Resource 只能查看，编辑必须创建新版本。

### Phase 16.2：资源 Metadata 与匹配质量（Resource Metadata and Matching Quality）

核心问题：

> 系统如何证明正式资源适合当前学习请求，而不是只因为能力标签相同就放行？

最小链路：

```text
Validated TaskRequest
+ Reviewed Frozen Resources
+ Recent Task History
-> Existing Task Fulfillment
-> TaskResourceMatchResult
-> ResourceMatchQualityEvaluation
├─ matched / accepted
│  -> ExecutableLearningTask
├─ partial_match
│  -> blocked / review / resource gap
├─ no_match
│  -> Structured Resource Gap
└─ review_required
   -> Human Review
```

匹配质量至少检查：

- 能力是否匹配；
- 任务角色是否匹配；
- 难度是否适配；
- 材料新颖度是否满足；
- 是否避免近期重复；
- Rubric 是否支持当前 validationGoal；
- 资源审核状态和版本是否有效。

匹配分支必须保持稳定：

- `matched`：所有关键硬约束满足，可以进入正式执行；
- `partial_match`：存在未满足条件，第一版默认不自动执行；
- `no_match`：没有可用资源，形成结构化资源缺口；
- `review_required`：Metadata 冲突、版本异常、Rubric 不足或其他可信度问题需要复核。

底层约束：

```text
partial_match != 可以勉强执行
review_required != no_match
matched != 已证明教学有效
```

资源匹配必须保留“为什么成功、为什么失败、哪些条件未满足”的依据，不得只保存最终 `resourceId`。

### Phase 16.3：真实多日学习运行（Real Multi-day Learning Operation）

核心问题：

> 单学生能否使用真实题目连续运行多个自然日，并在异常发生后保持事实不污染且可以继续学习？

最小周期：5—7 个自然日。

最小链路：

```text
Reviewed Frozen Question Resource
-> ExecutableLearningTask
-> Real Student Answer
-> Real Diagnosis / Formal Commit
-> AbilityEvidence
-> Evaluation / ProfileUpdateDecision
-> GrowthMemory
-> Delayed Retest / Next Strategy
-> Next Reviewed Resource
-> Next Learning Session
```

至少验证：

- Day 1 正常学习并保存历史；
- Day 2 读取既有 Profile、GrowthMemory 和 Session 历史；
- 后续按计划进入延迟复测；
- 新 Evidence 完整进入既有 Evaluation 与 ProfileUpdateDecision；
- 下一任务消费正式冻结资源；
- 学习链路可以被人工回放和复核。

至少覆盖以下异常：

- 当前没有匹配资源；
- Provider 临时失败；
- Diagnosis 进入 `review_required`；
- 延迟复测到期但学生未完成；
- 正在引用的资源后来被 `superseded`；
- 页面刷新或浏览器重启后恢复；
- 同一任务重复提交；
- 人工判定某条 Diagnosis 不应继续消费。

16.3 PASS 的关键不是每天都没有错误，而是：

> 异常发生后，系统仍能保持正式事实不污染、身份不重复、状态可恢复，并允许下一次学习继续运行。

## 六、人工复核贯穿方式

人工复核不是 Phase 16.3 才增加的最后模块，而是贯穿三个子阶段：

| 子阶段 | 人工复核对象 | 主要目的 |
| --- | --- | --- |
| Phase 16.1 | 题目、Material、Metadata、Rubric、AnswerAcceptance、版本 | 决定资源是否允许冻结 |
| Phase 16.2 | 匹配理由、约束满足情况、partial / no_match / review 分支 | 验证资源是否适合当前请求 |
| Phase 16.3 | Diagnosis、Evidence、Evaluation、ProfileUpdateDecision、恢复记录 | 防止错误事实进入长期状态 |

第一版只要求具备明确的人工检查入口、结构化记录和阻断能力，不要求建设完整审核后台。

## 七、身份与版本原则

至少需要稳定区分：

- `materialId`：共同阅读材料或内容载体；
- `taskId`：学生实际完成的独立任务；
- `resourceId`：资源的长期身份；
- `resourceVersionId`：某次冻结的具体版本；
- `reviewId`：资源审核记录；
- `sessionId`：一次学习 Session；
- `executionSessionId`：一次具体任务执行；
- `evidenceId`：一次正式能力证据。

Phase 16.1 还需要维护 `ResourceRegistry` 作为正式资源目录。Version History 保存完整历史事实，Registry 只指向每个 `resourceId` 当前唯一可用的 Frozen Version，并为 Phase 16.2 提供轻量查询入口。

```text
ResourceVersion History = 完整版本历史
ResourceRegistry = 当前正式资源目录
currentFrozenVersionId = 当前唯一正式 Head
```

Registry 必须能够由 Frozen Version History 重建，不得替代或覆盖版本历史。

任何正式 Diagnosis、Evidence、Evaluation 或 GrowthMemory 必须能够回溯到当时执行的任务与冻结资源版本。

同一 Material 不等于同一 Task；同一 Task 的新版本也不等于可以静默覆盖旧版本。

## 八、当前实现与长期方向

### 当前最小实现

- 单学生；
- 单浏览器本地环境；
- 小批量真实题目；
- 文本优先录入；
- 人工审核为主；
- 明确规则与结构化校验；
- 复用现有 TaskFulfillment；
- 5—7 天真实学习运行；
- Debug 时间模拟与真实自然日试用并行；
- 人工抽检匹配和教育结论。

### 长期演进方向

- 正式题库数据库；
- 批量导入与 OCR；
- 内容审核后台；
- 多人协作审核；
- 资源权限和版权治理；
- 题目使用统计；
- 难度动态校准；
- 推荐排序学习；
- 多学生长期验证；
- 云端同步与跨设备恢复。

长期方向不属于 Phase 16 的最低实现范围。

## 九、共同安全原则

### 1. Draft Is Not Formal Resource

AI、OCR 或人工初步录入产生的 Draft 不能直接被 TaskFulfillment 消费。

### 2. Frozen Resource Is Immutable

冻结资源只能通过新版本演进，不得静默覆盖。

### 3. Acceptance Is Not Diagnosis

答案接受规则不能替代 Rubric、Diagnosis 或 Evidence Evaluation。

### 4. Rubric Is Not Student Fact

Rubric 中的候选观察项不能被预先写成某个学生的能力缺口。

### 5. Match Is Not Learning Effect

匹配成功只表示资源满足当前执行约束，不证明训练有效或能力提升。

### 6. Human Review Cannot Rewrite History Silently

人工复核可以阻断、退回、生成新版本或形成纠正记录，但不能无记录地修改已经进入正式链路的历史对象。

### 7. Failure Must Not Pollute Formal State

Provider、资源匹配、复测、页面恢复或人工复核失败时，不得生成未经确认的正式 Evidence 或画像变化。

## 十、Phase 16 总体验收标准

Phase 16 完成时至少证明：

1. 一批真实题目能够完成 Draft、校验、人工审核和冻结；
2. Frozen Question Resource 具有稳定身份、来源、版本和审核记录；
3. Material、Task 与 Resource Version 身份不会混淆；
4. ResourceRegistry 在任意时刻只指向一个 Current Frozen Version，并可由 Version History 重建；
5. AnswerAcceptance、Rubric 与 Diagnosis 的职责边界保持成立；
6. 无需修改工程代码即可通过最小录入工作台完成 Draft、校验、审核、冻结、新版本创建、Student Preview 和 Review Preview；
7. 工作台与资源准入 Runtime 使用同一套正式规则，页面不能绕过校验或审核直接冻结资源；
8. Draft 可以本地保存和刷新恢复，Frozen Resource 不能直接编辑；
9. 正式 TaskRequest 只消费审核有效的资源；
10. 资源匹配同时考虑能力、角色、难度、新颖度、重复控制、Rubric 和审核状态；
11. `matched`、`partial_match`、`no_match` 与 `review_required` 分支稳定；
12. 只有满足全部关键约束的 `matched` 资源可以形成 ExecutableLearningTask；
13. 匹配理由和未满足条件可以追溯；
14. 单学生能够使用真实题目连续运行 5—7 个自然日；
15. 跨日 Session、Profile、GrowthMemory 和延迟复测可以保存与恢复；
16. 新 Evidence 完整进入既有 Evaluation、ProfileUpdateDecision 和 GrowthMemory；
17. 页面刷新、重复提交、Provider 失败、资源失效和复测缺席不会污染正式状态；
18. 三个子阶段均具备相应人工复核记录；
19. Existing Phase 8、13、14、15 冻结回归通过；
20. Production Build 通过。

## 十一、三个子阶段完成定义

### Phase 16.1 完成定义

> 至少一批真实题目能够通过结构化 Draft、Metadata / Rubric 校验和人工审核，形成不可静默修改且可版本追溯的 Frozen Question Resource；ResourceRegistry 始终提供唯一当前正式版本；使用者无需修改工程代码即可通过最小录入工作台完成录入、校验、审核、冻结、新版本创建、Student Preview 和 Review Preview。

### Phase 16.2 完成定义

> 正式 TaskRequest 能够从审核资源中获得可解释的 matched、partial_match、no_match 或 review_required 结果，只有满足全部关键约束的资源才能形成 ExecutableLearningTask。

### Phase 16.3 完成定义

> 单学生能够使用真实题目连续运行 5—7 个自然日，学习记录、Evidence、复测、策略和下一任务均可恢复、追溯与人工复核，异常不会污染正式状态。

## 十二、本阶段不做

Phase 16 不做：

- 不建设大型正式题库；
- 不建设完整内容运营后台；
- 不让 AI 自动冻结正式题目；
- 不做复杂 OCR 工作流；
- 不做自动批量生成并发布题目；
- 不做复杂题目推荐排序算法；
- 不做题目难度自动学习或动态校准；
- 不做多学生账号和权限系统；
- 不做正式家长报告；
- 不做多 Session 全自动教学编排；
- 不证明真实教学长期有效；
- 不修改冻结的 DiagnosisResult、AbilityEvidence、EvaluationResult 或 StudentAbilityProfile 核心语义。

## 十三、建议开发顺序

```text
Phase 16 总纲冻结
-> Phase 16.1 子阶段文档
-> Phase 16.1A Resource Admission Runtime / Debug
-> Phase 16.1B Minimum Intake Workbench / Human Acceptance
-> Phase 16.2 子阶段文档
-> Resource Matching Quality Debug
-> Match Review Demo / Acceptance
-> Phase 16.3 子阶段文档
-> Deterministic Multi-day Simulation
-> 5—7 个自然日真实试用
-> Human Review / Regression / Build
-> Phase 16 Acceptance / Freeze
```

工程实现应直接依赖三个子阶段文档；本总纲只负责统一目标、边界、承接关系和最终验收口径。

## 十四、阶段完成后的准确产品能力

Phase 16 完成后，系统可以宣称：

> 单学生、真实题目、真实 AI、跨天记忆和受控自适应已经能够组成连续、可恢复、可追溯、可人工复核的学习过程。

系统仍不能宣称：

- 已经证明学生能力长期提升；
- 已经具备大规模题库和内容运营能力；
- 已经可以取消人工质量审核；
- 已经形成多学生正式商业产品；
- 已经完成云端部署和跨设备同步。

Phase 16 的核心价值不是增加题目数量，而是让真实内容能够以受控、可审核、可解释的方式进入真实学习运行。
