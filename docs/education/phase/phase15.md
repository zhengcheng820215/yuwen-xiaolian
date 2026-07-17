# Phase 15：真实 AI Diagnosis 与受控表达基础（Live AI Diagnosis and Controlled Feedback Foundation）

设计状态：ACCEPTED
工程状态：PASS / FROZEN（Phase 15.1、15.2、15.3 均已通过并冻结）

## 一、阶段定位

Phase 14 已经证明：

```text
Formal Runtime Facts
-> EvidenceQualityAssessment
-> EvidenceConflictAssessment
-> AdaptiveTaskConstraints
-> Existing TaskFulfillment
```

系统能够根据任务、作答、提示、时间与追溯事实解释 Evidence 的判断价值，并生成不越过 Existing Strategy 的受控任务约束。

但当前端到端学习链仍大量使用 mock Diagnosis。现有 `realAIDiagnosisAgent`、Prompt Builder、Normalize 与 Live AI Evaluation 已建立最小结构，但尚未形成可配置、可审查、可回退、可用于正式 Evidence 回流的真实模型运行基础。

Phase 15 不新增第二套 Diagnosis、Evidence、Evaluation 或 Profile 更新链路。

Phase 15 的任务是：

1. 加固并真实化现有 Diagnosis Runtime；
2. 验证真实 LLM Diagnosis 的工程可靠性与教育边界；
3. 将已经确认的结构化事实转化为学生可读反馈，同时防止表达层新增教育结论。

## 二、一句话定义

> 将现有 mock Diagnosis 替换为可验证、可回退、可审查的真实 LLM Runtime，并在不新增教育结论的前提下，把结构化结果转化为学生可读反馈。

## 三、与既有 Phase 的承接关系

### Phase 4.2

Phase 4.2 已建立：

- Real AI Diagnosis Prompt Builder；
- JSON-only 输出要求；
- Normalize；
- Schema Validation；
- Evidence Safety Gate；
- Live AI Quality Evaluation 最小门槛。

Phase 15 必须复用并加固这些能力，不得重新创建一套不兼容 Prompt、Normalize 或 Diagnosis Schema。

### Phase 9.2 / 9.3

Phase 9.2 已建立作答有效性闸门，Phase 9.3 已建立正式 Evidence 回流：

```text
TaskExecutionResult.canEnterDiagnosisRuntime = true
+ ConcreteLearningTask
-> DiagnosisResult
-> AbilityEvidence
-> Existing Phase 8 Runtime
```

Phase 15 的真实 LLM 调用必须位于有效性闸门之后。空答案、占位回答、复制题干和高确定性无关回答不得进入真实 Diagnosis，也不得生成 weakness Evidence。

### Phase 11

Phase 11 已建立学生可读反馈 Adapter。Phase 15.3 只能为该展示层提供经过验证的表达结果，不得绕过现有学生反馈状态和页面安全边界。

### Phase 14

真实 LLM 生成的新 Evidence 仍必须进入 Phase 14.1 重新评估质量。模型置信度高不等于 Evidence 质量高，目标质量也不等于实际表现质量。

## 四、核心问题

Phase 15 只回答三个问题：

1. 系统能否稳定调用真实模型，并获得合法、可追溯的结构化 Diagnosis？
2. 真实 LLM Diagnosis 是否准确理解学生答案，并遵守教育与 Evidence 安全边界？
3. 已确认的 Diagnosis、Evidence 与学生原文能否被转化为具体、自然、可行动且不越权的学生反馈？

Phase 15 不回答：

- 学生是否已经长期掌握某项能力；
- 某个模型是否在所有语文题型上都正确；
- AI 是否可以自动生成无限题目；
- 自适应策略是否已经证明教学有效；
- 是否可以取消人工质量抽检；
- 是否已经具备正式多学生商业产品能力。

## 五、三个最小闭环

### Phase 15.1：Real LLM Runtime Foundation

核心问题：

> 系统能否稳定调用真实模型，并将原始输出安全转换为合法结构化结果？

最小链路：

```text
Valid TaskExecutionResult
+ ConcreteLearningTask
+ Versioned Prompt / Model Config
-> Provider Adapter
-> Raw Model Output
-> Parse / Schema / Identity Validation
├─ passed
│  -> Validated DiagnosisResult Candidate
│  -> commitFormalDiagnosis()
│  -> Committed Formal DiagnosisResult
├─ repairable
│  -> Bounded Structural Repair / Retry
└─ failed / unsafe
   -> blocked / review_required
```

本阶段只证明真实模型可以安全进入 Runtime，不证明 Diagnosis 的教育质量已经稳定。

Phase 15.1 验收必须同时包含：

- 可重复运行的 Provider Contract / Failure Branch Debug；
- 使用真实凭据、不会进入普通 CI 的 Live Provider Smoke Test。

Live Smoke 保持最小规模：正常 Live、Shadow 与 Prompt Injection 使用真实 Provider；能力错位或非法结构使用受控 Provider 验证 Gate。不得要求真实模型稳定制造错误输出，也不得在 Phase 15.1 Smoke 中实际创建 Evidence 或更新 Profile。

Phase 15 的正式 Diagnosis Contract 不绑定模型厂商。当前 Phase 15.1 Live Smoke 默认使用 DeepSeek Chat Completions Adapter，并保留其他 Provider Adapter；切换 Provider 不得改变 Schema、Identity、Boundary 或 Formal Commit 规则。

只有 Fake Adapter Debug 通过，不能宣称真实模型调用基础已经成立。

### Phase 15.2：Real Diagnosis Validation

核心问题：

> 真实 LLM Diagnosis 是否准确理解学生答案，并满足正式 Diagnosis 与 Evidence 边界？

最小链路：

```text
Versioned Real Answer Evaluation Set
+ Human Expected Boundaries
+ Repeated Live Diagnosis Runs
-> DiagnosisQualityEvaluation
-> Acceptance / Review / Block
```

重点验证 mainAbility、answerStatus、rootCause、引用真实性、Evidence 依据、无效回答安全和多次运行的关键语义稳定性。

第一版先冻结 30–50 条版本化、脱敏评估样本，并为每个样本记录人工允许范围、必须识别事实和禁止结论。真实 Provider 默认以 Shadow 模式对可诊断样本运行约 3 次；无效作答优先验证 Existing Validity Gate，受控 Boundary Stress 不进入正式 Runtime。任何 Critical Hallucination、虚构引用、材料事实虚构或长期能力越权都阻断本阶段冻结。

Dataset v1 只作为首版工程与教育边界基线，不代表全题型产品信心。报告必须同时提供 Run-level Accuracy 与 Sample-level Acceptance，并区分 Raw Schema、Post-repair Schema 和 Formal Candidate Schema；只有 100% Schema Valid 的 Formal Candidate 可以进入教育质量评估。

Prompt v3 与 Prompt v4 的全量 Shadow 和 Full Calibrated Baseline 均已完成。v4 保留 v3 不变，通过显式 Prompt Registry 选择；专项 Slice 30 / 30 次真实调用达到预注册门槛，全量执行 108 / 108 个逻辑 Run、93 / 93 次 Provider 调用与 15 次 Validity Gate 阻断，Provider 失败与重试均为 0。Root Cause 归因显示 32 个失败 Run 中 Prompt 主责任 3、Policy 6、Evaluator 23；Policy v2.1 离线校准达到 90 / 93，并通过全部防过拟合约束。负责人已确认 29 / 3 / 61 三组结论；完整 Evaluator Activation Dry Run 9 项约束通过，正式启用回归 15 / 15 PASS，质量分布为 accepted 79、questionable 6、unacceptable 8、critical 0。Phase 15.2 已通过并冻结，下一步进入 Phase 15.3。

### Phase 15.3：Controlled Feedback Expression

核心问题：

> 如何把正式结构化结果转化为学生能理解、能行动且不会被误导的反馈？

最小链路：

```text
Formal DiagnosisResult
+ AbilityEvidence
+ StudentResponse
-> StructuredFeedbackFacts
   + ActionableSuggestions
-> Deterministic Feedback Template
-> Baseline StudentLearningFeedback
-> Optional Controlled LLM Expression
-> Quote / Attribution / Boundary Validation
├─ passed
│  -> Enhanced StudentLearningFeedback
└─ skipped / failed
   -> Keep Baseline StudentLearningFeedback
```

确定性模板是默认可靠基线，LLM 只作为可关闭的表达增强层。表达层只表达已有事实，不生成新的 Diagnosis、Evidence 或长期能力结论；普通 Live 未经过逐样本人工 Annotation 时只能获得 restricted feedback。

Phase 15.3 已完成工程与质量验收：24 / 24 个确定性 Debug Case、DeepSeek Prompt v1.1 Live 12 / 12、Controlled Safety 2 / 2、脱敏人工抽检 12 / 12、关键冻结回归与 Production Build 均通过。Phase 15.3 与 Phase 15 当前均为 `PASS / FROZEN`。

## 六、完整核心链路

```text
ConcreteLearningTask
+ Valid TaskExecutionResult
↓
Real LLM Diagnosis Request
↓
Provider Adapter
↓
Raw Model Output
↓
Schema / Identity / Semantic Boundary Validation
├─ passed
│  ↓
│  Validated DiagnosisResult Candidate
│  ↓
│  commitFormalDiagnosis()
│  ↓
│  Committed Formal DiagnosisResult
│  ↓
│  Existing Phase 9.3 Evidence Return
│  ↓
│  AbilityEvidence
│  ↓
│  Existing Phase 8 Runtime
│  ↓
│  Phase 14 Evidence Quality Assessment
│
├─ repairable
│  ↓
│  Bounded Structural Repair / Retry
│
└─ failed / unsafe
   ↓
   blocked / review_required
   ↓
   no formal Evidence
```

学生反馈是独立展示链：

```text
Committed Formal DiagnosisResult
+ AbilityEvidence
+ StudentResponse
↓
StructuredFeedbackFacts
+ ActionableSuggestions
↓
Controlled Expression
↓
Attribution Validation
↓
StudentLearningFeedback
```

## 七、共同核心对象

Phase 15 建议新增或正式化以下外围对象，但不修改冻结的 `DiagnosisResult`：

### 1. DiagnosisProviderConfigSnapshot

记录本次运行使用的 provider、model、参数、Prompt 版本和配置版本，不保存 API Key。

### 2. DiagnosisRunRecord

记录 requestId、运行模式、状态、重试次数、耗时、token、成本、错误分类、原始输出引用和验证结果。

### 3. RealDiagnosisRuntimeResult

保存 Validated Candidate、Committed Diagnosis 或阻断结果，并关联唯一 DiagnosisRunRecord 与 FormalDiagnosisCommit。

### 4. FormalDiagnosisCommit

记录 Candidate 是否已经不可逆地提交为正式 Diagnosis。它必须保存 requestId、runId、formalDiagnosisId、提交状态与提交时间，并对同一 requestId 提供唯一提交约束。

Formal Diagnosis Repository 必须以 requestId 建立唯一约束，并提供原子 `create-if-absent` 或等价提交语义。应用层先查再写不能被当作正式唯一性保证。

建议状态：

```text
candidate
committed
blocked
review_required
```

### 5. DiagnosisQualityEvaluation

保存真实 Diagnosis 与人工预期边界之间的评估结果，不直接修改 DiagnosisResult。

### 6. StructuredFeedbackFacts

保存可用于学生表达的已确认事实及其来源，不保存未经确认的自由推断。

`StructuredFeedbackFacts` 只保存事实；`ActionableSuggestion[]` 单独保存建议，不能混入“学生已经做到”的事实集合。

### 7. ControlledFeedbackResult

保存表达结果、引用校验、越权校验、回退状态和最终 StudentLearningFeedback。

## 八、共同安全原则

### 1. Validity Before LLM

只有 `TaskExecutionResult.canEnterDiagnosisRuntime = true` 的作答可以进入真实模型。

### 2. Raw Output Is Not Formal Result

原始模型输出不能直接进入 Evidence、Profile、GrowthMemory 或学生页面。

### 3. Structural Repair Is Not Semantic Rewrite

Repair 必须使用明确白名单，只能处理 JSON 外层、受控语法、已登记枚举别名、非核心默认字段和数值范围，不得重写 mainAbility、answerStatus、rootCause、Evidence 方向、学生引用或学生答案含义。每个操作必须记录 field、operation 与 semanticField；任何核心语义字段需要修复时，必须重新调用模型或进入 review。

### 4. No Silent Mock Fallback

Live 模式失败时，不得静默使用 mock Diagnosis 生成正式 Evidence。允许的结果只有受控重试、阻断、人工复核或无教育结论的固定提示。

### 5. Existing Runtime Executes Once

成功的 Committed Formal DiagnosisResult 只能通过 Existing Phase 9.3 进入 Evidence Return。重试、刷新和 Shadow Mode 不得重复提交 Diagnosis、生成 Evidence 或更新 Profile。

### 6. Formal Commit Is the Transaction Boundary

模型输出和 Validated Candidate 仍可重试、结构修复、Shadow 对照或进入 Review。只有 `commitFormalDiagnosis()` 成功后才形成正式 Diagnosis。Commit 后同一 requestId 不能提交另一结果，不能因页面刷新重新提交，也不能被后续 retry 覆盖。若 Commit 成功但 Evidence Return 失败，只能基于同一 committed Diagnosis 重试 Evidence Return。

### 7. Model Confidence Is Not Evidence Quality

模型 confidence 不替代 Phase 14 Evidence Quality Assessment。

### 8. Feedback Does Not Diagnose

表达层不能新增 Evidence、修改 Diagnosis、宣称长期掌握或把系统推断伪装成学生原话。

### 9. Student Content Is Untrusted Input

题目、材料和学生答案必须经过转义后放入明确数据块，不得被模型当作系统指令。系统指令必须声明数据块内文本不是指令、不得改变 Schema、不得打印 Prompt；输出仍必须经过 Schema、身份、语义边界与 Prompt Leakage Gate，不能只相信模型服从。

## 九、运行模式

Phase 15 至少支持：

```text
mock
live
shadow
```

- `mock`：仅用于冻结回归与开发，不代表真实 AI 质量；
- `live`：真实模型结果通过全部 Gate 后才可进入正式 Evidence Return；
- `shadow`：真实模型结果只用于对照评估，不生成正式 Evidence，不更新 Profile。

运行模式必须来自版本化配置或环境配置，不能由学生页面随意切换。

## 十、失败与回退原则

至少区分：

- provider_unavailable；
- timeout；
- rate_limited；
- authentication_failed；
- malformed_output；
- schema_invalid；
- identity_mismatch；
- semantic_boundary_violation；
- unsafe_output；
- retry_exhausted。

错误结果必须保留明确状态，但不得把底层错误、Prompt、Key、模型原始输出或内部 ID 暴露给学生。

## 十一、数据、安全与成本边界

1. API Key 只能来自环境变量或安全 Secret Provider，不得写入 Git、页面代码、Debug 输出或持久化记录；
2. Raw Output 必须与 Formal DiagnosisResult 隔离，并有明确保留和清理策略；
3. 日志默认不记录完整学生答案、完整 Profile 或 Prompt；
4. Token、耗时和成本记录不得携带学生敏感内容；
5. 每次运行必须保留 studentId、taskId、executionSessionId、responseId、requestId 和 promptVersion 的追溯关系；
6. Provider 切换不得改变正式 Diagnosis Contract；
7. 同一正式 requestId 的重试必须保持幂等，不能产生多份正式 Evidence。

## 十二、Phase 15.2 人工评估集与分母协议

Phase 15.2 开始前必须冻结一个版本化评估集。第一版至少 30–50 条，且不能只用容易判断的完整正确答案。

至少覆盖：

- 有效完整回答；
- 部分正确回答；
- 答案过于简略但仍有可观察表现；
- 引用正确但解释错误；
- 判断正确但缺少依据；
- 无效回答；
- 答非所问；
- 复制题干；
- Prompt Injection 文本；
- 开放性合理异表述；
- 主要能力类型之间容易混淆的回答。

评估集必须记录：

- datasetVersion；
- 样本总数；
- 各能力类型样本数；
- 有效、无效、边界和注入样本数；
- 每个指标的 eligible denominator；
- 每个样本的重复运行次数；
- Human Annotation Guide 版本；
- 评估时间与 provider / model / promptVersion。

人工预期不要求唯一文字答案，应采用：

```text
acceptable
questionable
unacceptable
critical_violation
```

`rootCause` 不做 exact match，应判断是否与学生答案相关、是否有正式依据、是否解释本次表现、是否越权推断长期能力。

所有比例必须同时报告 `通过数 / eligible denominator`。无效或不适用样本不能为了提高比例被静默移出分母；若某指标只适用于部分样本，必须公开其纳入规则。

## 十三、Phase 15.3 反馈事实与建议协议

建议将事实和建议拆开：

```ts
type StructuredFeedbackFacts = {
  studentQuotes: {
    text: string;
    start?: number;
    end?: number;
    sourceType: 'student_exact_quote';
  }[];

  diagnosisFacts: {
    text: string;
    sourceType: 'diagnosis_confirmed_fact';
    sourceLinks: string[];
  }[];

  evidenceFacts: {
    text: string;
    sourceType: 'evidence_confirmed_fact';
    sourceLinks: string[];
  }[];
};

type ActionableSuggestion = {
  text: string;
  sourceType: 'actionable_suggestion';
  sourceLinks: string[];
};
```

表达边界：

- 只有 `student_exact_quote` 可以使用“你写出了……”；
- `diagnosis_confirmed_fact` 使用“你的回答表达了 / 体现了……”；
- `evidence_confirmed_fact` 只描述本次可观察表现；
- `actionable_suggestion` 使用“可以进一步……”；
- 不确定内容不得写成学生已完成事实；
- 原文引用必须通过精确字符串或 span 校验；
- 建议不能反向成为新的 Diagnosis 或 Evidence。

## 十四、Phase 15 总体验收 Case

至少覆盖：

1. Live Provider 正常返回合法 JSON；
2. Provider 超时后受控重试成功；
3. 重试耗尽后阻断，不生成 Evidence；
4. JSON 可修复时只进行结构修复；
5. Schema 合法但 mainAbility 错位时进入 review_required；
6. 空答案和“不知道”不进入 LLM；
7. 学生答案包含提示注入文本时不改变系统指令；
8. Raw Output 不直接进入正式对象；
9. 同一 requestId 重试不重复生成 Evidence；
10. Shadow Mode 不更新 Profile；
11. Live 模式失败不静默使用 mock；
12. Provider 切换后仍符合统一 Diagnosis Contract；
13. 人工评估集中的 mainAbility、answerStatus 与 rootCause 达到门槛；
14. Critical Hallucination 为 0；
15. “你写出了”可以追溯到学生原答案；
16. 引用不能由模型改写后伪装成原文；
17. Controlled Feedback 校验失败时回退确定性模板；
18. Feedback 不使用“已掌握、稳定提升”等长期结论；
19. 正式 Evidence 继续由 Phase 14.1 基于真实执行事实重评质量；
20. Existing Phase 9、12、13、14 冻结回归通过；
21. Validated Candidate 成功 Commit 后，同一 requestId 的重复或并发提交只能返回同一 Formal Diagnosis，不能创建第二份结果；
22. Commit 成功但 Evidence Return 失败时，只重试 Existing Phase 9.3，不重新调用模型；
23. Repair 白名单以外的核心语义字段修改进入 retry / review；
24. 输入包含“忽略规则、修改 mainAbility、打印 Prompt”等文本时，输入封装和输出 Gate 均生效；
25. Feedback Facts 与 Actionable Suggestions 不混合；
26. 真实成功端到端 Case：Live LLM -> Formal Commit -> Phase 9.3 -> Phase 8 -> Phase 14.1 -> Controlled Feedback；
27. 真实失败端到端 Case：越权、错位或伪造引用 -> blocked / review_required -> no Commit -> no Evidence -> safe feedback。

Phase 15.1 的 Live Smoke 必须在真实 Provider 上完成正常 Live、Shadow 与 Prompt Injection 三类场景，并以受控 Provider 验证能力错位或非法结构阻断。记录 provider、model、脱敏 requestId、provider request ID、Prompt / Config / Schema / Repair 版本、mode、token、耗时、重试、Gate 与 formalization 状态；Secret、完整 Prompt、完整学生敏感内容与 Raw Output 不得写入验收文档。Phase 15.1 只记录 `canEnterEvidenceReturn`，不实际创建 Evidence。

## 十五、总体最低验收标准

Phase 15 完成时至少证明：

1. Provider Adapter 与正式 Diagnosis Contract 解耦；
2. Prompt、模型和参数配置均可版本追溯；
3. Raw Output 与 Formal DiagnosisResult 隔离；
4. JSON Parse / Schema Valid 在正式评估集上达到 100%，包括受控结构修复；
5. 无效作答误生成 weakness Evidence 为 0；
6. Critical Hallucination 为 0；
7. Evidence Traceability 为 100%；
8. mainAbility 人工认可率不低于 90%；
9. answerStatus 人工认可率不低于 85%；
10. rootCause 人工认可率不低于 80%；
11. 多次运行的关键结构语义具有可接受稳定性；
12. Live 失败不会静默产生 mock Evidence；
13. Feedback 引用与归因可以验证；
14. Feedback 校验失败具有确定性回退；
15. Existing Evidence、Evaluation、Profile 与 GrowthMemory 链不被复制；
16. Production Build 通过；
17. Formal Diagnosis Repository 通过 requestId 原子唯一约束保证最多存在一个 committed Formal Diagnosis；
18. committed Diagnosis 不会被后续 Retry 覆盖；
19. Phase 15.2 冻结 30–50 条版本化样本并公开各指标有效分母；
20. 人工评价使用 acceptable / questionable / unacceptable / critical_violation；
21. Feedback 的事实、引用与建议来源可追溯；
22. 真实成功与真实失败端到端集成 Case 均通过。

以上比例门槛用于 Phase 15 最小正式评估集。样本分布、人工标注规则和评估版本必须同时冻结，否则单独比例不能作为验收依据。

## 十六、本阶段不做

Phase 15 不做：

- 不做 LLM 自动无限出题；
- 不做大型题库建设；
- 不做复杂多模型路由算法；
- 不做模型自动微调；
- 不做新的能力模型；
- 不修改冻结的 DiagnosisResult Schema；
- 不修改 AbilityEvidence 方向语义；
- 不创建第二套 Evaluation 或 Profile 更新链；
- 不做家长端报告；
- 不做多学生账号系统；
- 不证明真实教学效果或长期能力提升。

## 十七、阶段完成定义

Phase 15 完成时，应能证明：

```text
真实模型可以安全进入现有学习 Runtime；
模型输出只有通过结构、身份、语义和安全校验后才能成为正式 DiagnosisResult；
正式 Diagnosis 只通过既有 Evidence Return 链产生 Evidence；
学生反馈只表达可追溯的已确认事实；
模型失败、输出越权或引用不实，系统能够阻断、复核或安全回退。
```

完成后的准确产品能力是：

> 系统能够以可配置、可追溯、可审查的方式调用真实 LLM，将通过安全校验的结构化 Diagnosis 接入 Existing Evidence Runtime，并把已确认事实转化为学生可理解的受控反馈，而不让模型直接决定长期能力状态。

阶段通过语义必须保持分离：

```text
Phase 15.1 PASS
= 真实模型可以被安全调用、校验和正式提交
!= Diagnosis 教育判断已经正确

Phase 15.2 PASS
= 真实 Diagnosis 达到当前冻结评估集的最低质量门槛
!= 所有题型和学生表达都已稳定

Phase 15.3 PASS
= 已确认事实能够被可靠表达并安全回退
!= 表达流畅可以反向证明 Diagnosis 正确
```
