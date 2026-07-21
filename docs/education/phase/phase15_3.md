# Phase 15.3：Controlled Feedback Expression 最小闭环（受控反馈表达）

设计状态：ACCEPTED
工程状态：PASS（当前 Deterministic Debug 56 / 56；Production Build PASS）
质量验收状态：PASS / FROZEN（DeepSeek Live 12 / 12；Controlled Safety 2 / 2；人工抽检 12 / 12）
前置状态：Phase 15.1 PASS / FROZEN；Phase 15.2 PASS / FROZEN
正式质量策略：Diagnosis Quality Policy v2.1

## 零、工程验收记录（2026-07-17）

Phase 15.3 已完成 Schema、反馈准入、结构化事实与建议 Adapter、确定性模板、可选 LLM 表达、Claim Binding / 引用 / 越权校验、Repository 幂等和 Debug Runner。

当前验证结果：

- Phase 15.3 Deterministic Debug：`36 / 36 PASS`；
- Phase 11.2 Student Learning Feedback：PASS；
- Phase 14 Integration：`16 / 16 PASS`；
- Phase 15.1 Runtime Foundation：`22 / 22 PASS`；
- Phase 15.2 Quality Evaluation：`21 / 21 PASS`；
- Phase 15.2 Policy v2：`13 / 13 PASS`；
- Phase 15.2 Prompt v4：`15 / 15 PASS`；
- Production Build：PASS。

真实表达质量验收已经完成。首轮 Prompt v1 为 8 / 12，所有失败均安全回退模板；脱敏归因后仅收紧 Claim Binding 完整性并发布 Prompt v1.1，完整重跑达到 12 / 12 PASS，Controlled Safety 为 2 / 2 PASS，12 条脱敏反馈人工抽检全部接受。正式记录见：[Phase 15.3 Controlled Feedback Expression 质量验收与冻结记录](./reports/phase15_3/phase15_3_controlled_feedback_acceptance_2026-07-17.md)。

### 0.1 学生反馈转译增强（2026-07-21）

Phase 15.3 在不修改 Diagnosis、Evidence、Profile 或 GrowthMemory 的前提下，补充正式 `StudentFeedbackTeachingPlan`：

```text
StructuredFeedbackFacts
+ Frozen Task Context
↓
StudentFeedbackTeachingPlan
├─ understandingNotice
├─ detailsToReview
└─ revisionActions
↓
StudentLearningFeedback.guidance
↓
/learning
```

当前规则：

- 内部 `rootCause`、Evidence detail 和 evaluator 文案不得原样进入学生端；
- 原文细节只有在 Frozen Task readingText 中完成逐字核验后才能展示；
- Teaching Plan 从 Frozen Task 的题干与作答要求中确定性提取“题目对象 + 考查维度 + 依据类型”，用于把通用状态转成当前题目的具体提示；
- 题目语义无法可靠提取时使用克制的通用提示，不猜测人物、考查点、材料细节或标准答案；
- 修改动作使用确定性教学动作，不替学生生成完整答案；
- 表达失败使用安全模板，不回退展示内部诊断原文；
- 旧持久化结果在正式 Diagnosis、Evidence 与 Frozen Task 上下文完整时按当前 Teaching Plan 版本做只读兼容转译；已有旧版 guidance 也不阻止更新展示，但不重跑 Provider、不改写正式记录；
- 页面只渲染正式 guidance，不再按分号拆分内部诊断字符串。

学生点评与建议采用单一主要缺口链路：

```text
Frozen Task Requirements
+ Student Response
+ Formal Diagnosis / Evidence
↓
requirementCoverage
↓
primaryGapRequirementId
├─ primaryGap：只描述本次完成情况
└─ revisionActions：只描述下一步动作
```

`primaryGapRequirementId` 是点评与建议的共同权威来源。完整回答没有主要缺口时，Teaching Plan 不生成修改动作；全部覆盖状态均为 `insufficient_to_judge` 时，学生页只展示克制的行动建议，不将信息不足伪装成评价。当前学生反馈确定性回归为 `56 / 56 PASS`。

## 一、阶段目标

Phase 15.3 只解决一个核心问题：

```text
已经通过正式质量门的 Diagnosis、Evidence 与学生原文，
能否被转换为具体、自然、可行动，
并且不新增教育结论的学生反馈？
```

一句话定义：

> 将已确认的结构化 Diagnosis、AbilityEvidence 和学生原文整理为可追溯反馈事实，通过受控表达与归因校验生成 StudentLearningFeedback；表达失败或越权时回退到确定性模板。

Phase 15.3 不重新判断学生答案，不重新生成 Evidence，不修改 Profile，也不以反馈流畅度证明 Diagnosis 正确。

## 二、阶段定位

Phase 15.1 已证明：

```text
真实模型可以安全进入 Diagnosis Runtime。
```

Phase 15.2 已证明：

```text
真实 Diagnosis 可以在冻结评估边界内被接受、复核或阻断；
只有 accepted 结果具备进入正式候选链的资格。
```

Phase 15.3 继续证明：

```text
可靠的结构化事实
可以被转换为学生听得懂的表达，
而表达层不会反向改变可靠事实。
```

必须持续区分：

```text
表达自然
!= Diagnosis 正确

反馈具体
!= 可以新增 Evidence

学生看懂了反馈
!= 已经长期掌握

行动建议
!= 新的教学策略决策
```

## 三、复用边界

Phase 15.3 必须复用：

- Phase 15.1 的 Provider Adapter、版本配置、超时、重试、日志隔离与 Prompt Leakage Gate；
- Phase 15.2 的 `DiagnosisQualityEvaluationV2` 与 Policy v2.1 正式质量状态；
- Existing `DiagnosisResult`；
- Existing `AbilityEvidence`；
- Phase 9.3 `TaskEvidenceReturnResult` 与 Evidence 追溯关系；
- Phase 11 `StudentLearningFeedback` 和 `StudentFeedbackAdapter` 的流程状态语义；
- Phase 11 已冻结的学生语言边界与 Phase 12.5 PC / Tablet 工作台体验原则。

不得：

- 修改冻结的 `DiagnosisResult` Schema；
- 修改 `AbilityEvidence` Schema 或 Evidence 方向；
- 创建第二套 Diagnosis、Evaluation、Profile Update 或 GrowthMemory 链；
- 让表达模型读取完整 StudentAbilityProfile 或 GrowthMemory 后自行推断长期状态；
- 让表达结果反向覆盖 Formal DiagnosisResult；
- 让 `questionable`、`unacceptable` 或 `critical_violation` 生成内容性能力反馈；
- 把 Raw Diagnosis Output 直接传入表达模型或学生页面；
- 修改 Existing `StudentLearningFeedback` 的流程状态定义。

## 四、最小闭环

```text
Committed Formal DiagnosisResult
+ Optional DiagnosisQualityEvaluationV2
+ TaskEvidenceReturnResult
+ StudentResponse
↓
Feedback Input / Identity Validation
↓
FeedbackAdmissionDecision
├─ content_allowed + evidence_returned + traceable
│  ↓
│  StructuredFeedbackFacts
│  + ActionableSuggestion[]
│  ↓
│  Controlled Feedback Expression
│  ↓
│  Quote / Attribution / Boundary Validation
│  ├─ passed
│  │  -> StudentLearningFeedback
│  └─ failed / unsafe / provider_failed
│     -> Deterministic Feedback Template
│     -> StudentLearningFeedback
│
├─ questionable
│  -> review_required system notice
│  -> no content performance claim
│
└─ unacceptable / critical / identity mismatch
   -> blocked
   -> no content performance claim
```

最终 `StudentLearningFeedback` 仍由 Existing Phase 11 页面与结束页消费。

## 五、权威输入

建议定义：

```ts
type ControlledFeedbackExpressionInput = {
  feedbackRequestId: string;

  learningRoundId: string;
  studentId: string;
  taskId: string;
  executionSessionId: string;
  responseId: string;

  studentResponseText: string;

  realDiagnosisRuntimeResult: RealLLMDiagnosisRuntimeResult;
  diagnosisQualityEvaluation?: DiagnosisQualityEvaluationV2;
  taskEvidenceReturnResult: TaskEvidenceReturnResult;

  expressionConfig: FeedbackExpressionConfigSnapshot;
  requestedAt: string;
};
```

输入必须满足：

1. `RealLLMDiagnosisRuntimeResult.status = formal_result_committed`；
2. `FormalDiagnosisCommit.status = committed` 且存在合法 `DiagnosisResult`；
3. RunRecord 的 studentId、taskId、executionSessionId、responseId 必须与正式执行链一致；
4. 若存在 `DiagnosisQualityEvaluationV2`，其 policyVersion 必须是 `diagnosis_quality_policy_v2_1`，且只有 `accepted_candidate` 可以进入内容性表达；
5. 不得为普通 Live 新答案伪造 Dataset v1 的人工 Annotation 或 `accepted` 标签；
6. `TaskEvidenceReturnResult.status = evidence_returned`；
7. studentId、taskId、executionSessionId、responseId、Diagnosis 与 Evidence 链必须一致；
8. AbilityEvidence 必须可追溯到本次 task / diagnosis；
9. 学生原文必须来自正式 `StudentResponse`，不得由页面重新拼接；
10. 表达配置必须记录 Prompt、Provider、Model、Schema 和模板版本；
11. 任何关键对象缺失或错位时必须阻断，不得自行补造替代事实。

## 六、反馈准入与质量状态

Phase 15.2 的 Policy v2.1 依赖版本化样本和人工预期边界，主要用于 Prompt / Model 质量校准。普通 Live 学生答案没有 Dataset Annotation 时，Phase 15.3 不得伪造一份 `DiagnosisQualityEvaluationV2`。

建议使用确定性准入对象统一两类正式来源：

```ts
type FeedbackAdmissionLimitation =
  | 'not_individually_human_annotated'
  | 'limited_to_directly_traceable_facts';

type FeedbackAdmissionDecision = {
  status: 'content_allowed' | 'review_required' | 'blocked';

  expressionScope:
    | 'full'
    | 'restricted'
    | 'system_notice'
    | 'none';

  basis:
    | 'annotated_quality_evaluation'
    | 'formal_runtime_evidence_return';

  qualityLevel?:
    | 'accepted'
    | 'questionable'
    | 'unacceptable'
    | 'critical_violation';

  sourceLinks: string[];
  limitations: FeedbackAdmissionLimitation[];

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

准入规则：

1. 若存在合法 `DiagnosisQualityEvaluationV2`，它具有更高优先级，只有 `accepted` 可以 `content_allowed + full`；
2. `questionable` 必须 `review_required + system_notice`；
3. `unacceptable / critical_violation` 必须 `blocked + none`；
4. 若普通 Live 答案没有人工 Annotation，只能依据 committed Formal Diagnosis、`evidence_returned`、完整身份与追溯校验形成 `formal_runtime_evidence_return` 准入；
5. `formal_runtime_evidence_return` 只能获得 `restricted` 权限；
6. `formal_runtime_evidence_return` 必须固定保留 `not_individually_human_annotated` 与 `limited_to_directly_traceable_facts`；
7. `formal_runtime_evidence_return` 不能被记录成 Policy v2.1 的样本级 `accepted`；
8. restricted feedback 只允许表达学生精确原话、直接可追溯的本轮事实和既有 nextTraining，不允许扩展诊断语义；
9. Phase 15.3 只映射已有正式状态，不重新判断答案正确性或 Root Cause。

当存在正式质量结果时，权限如下：

| Diagnosis 质量 | 允许行为 | 禁止行为 |
|---|---|---|
| `accepted` | `full`：生成 StructuredFeedbackFacts，并进行受控表达 | 新增 Diagnosis 或长期结论 |
| `questionable` | `system_notice`：输出 `review_required` 固定说明 | 输出做得好、薄弱点或训练结论 |
| `unacceptable` | `none / blocked` | 生成内容性反馈或 Evidence |
| `critical_violation` | `none / blocked + critical alert` | 展示模型内容、生成反馈或自动回流 |

`questionable` 不能被解释为“勉强可用”。它只能产生类似以下安全提示：

> 这次回答已经记录，系统需要进一步确认。本次结果暂时不会用于形成能力判断。

## 七、StructuredFeedbackFacts

### 7.1 对象定义

建议新增：

```ts
type FeedbackFactSourceType =
  | 'student_exact_quote'
  | 'diagnosis_confirmed_fact'
  | 'evidence_confirmed_fact';

type StructuredFeedbackFact = {
  factId: string;
  factType:
    | 'student_statement'
    | 'observed_strength'
    | 'observed_attention_point';

  text: string;
  safeExpressions: string[];
  sourceType: FeedbackFactSourceType;
  sourceLinks: string[];

  exactQuote?: {
    text: string;
    start: number;
    end: number;
  };
};

type StructuredFeedbackFacts = {
  factsId: string;
  feedbackRequestId: string;

  learningRoundId: string;
  studentId: string;
  taskId: string;
  responseId: string;
  formalDiagnosisId: string;

  studentStatements: StructuredFeedbackFact[];
  observedStrengths: StructuredFeedbackFact[];
  observedAttentionPoints: StructuredFeedbackFact[];

  validation: {
    passed: boolean;
    identityAligned: boolean;
    quoteSpansValid: boolean;
    sourceLinksComplete: boolean;
    issues: string[];
  };
};
```

### 7.2 事实来源规则

只有三类事实可以进入：

1. `student_exact_quote`
   - 必须逐字存在于 `studentResponseText`；
   - 必须保存合法 start / end；
   - 只有该类型可以表达为“你写出了……”。

2. `diagnosis_confirmed_fact`
   - 必须来自 committed `DiagnosisResult` 的明确字段；
   - 必须关联 formalDiagnosisId 和字段路径；
   - 可以表达为“你的回答表达了 / 体现了……”，不能伪装成学生原话。

3. `evidence_confirmed_fact`
   - 必须来自本轮正式 AbilityEvidence；
   - 必须关联 evidenceId；
   - 只能描述本次可观察表现，不能扩展为稳定能力结论。

StructuredFeedbackFacts 必须由确定性 Adapter 构建。LLM 不得负责决定哪些事实是真实的。

`safeExpressions` 由确定性 Adapter 根据 factType 和来源生成，用于第一版受控句型。表达模型应优先选择、排序或连接这些安全短句，而不是自由扩写 `text`。

### 7.3 允许为空

`observedStrengths` 和 `observedAttentionPoints` 均允许为空。

系统不得为了结构对称而生成：

- “你已经认真思考了”；
- “你的理解能力很好”；
- “你还需要提升逻辑思维”；

除非这些内容存在正式、可追溯依据。

### 7.4 StudentFeedbackTeachingPlan

`StructuredFeedbackFacts` 是内部事实边界，不等同于可直接展示的学生文案。确定性 Adapter 必须继续将其转换为：

```ts
type StudentFeedbackTeachingPlan = {
  understandingNotice?: StudentFeedbackTeachingItem;
  detailsToReview: StudentFeedbackTeachingItem[];
  revisionActions: StudentFeedbackTeachingItem[];
};
```

语义顺序固定为：

```text
当前理解提示
→ 值得重新关注的已核验原文细节
→ 下一次可以执行的修改动作
```

不要求每次同时生成优点和不足。没有可靠正向事实时 `whatYouDidWell` 必须允许为空；没有经过材料核验的细节不得进入 `detailsToReview`。

## 八、ActionableSuggestion

事实与建议必须分离：

```ts
type ActionableSuggestion = {
  suggestionId: string;
  text: string;

  sourceType:
    | 'diagnosis_next_training'
    | 'learning_round_next_step'
    | 'deterministic_feedback_rule';

  sourceLinks: string[];
};
```

建议来源只能是：

- committed `DiagnosisResult.nextTraining`；
- Existing `LearningRoundResult.nextStep` 的学生语言映射；
- 已冻结、确定性的反馈规则。

建议可以使用“可以进一步……”“下一次可以……”，但不能表达为学生已经完成的事实，也不能自行决定：

- 更换目标能力；
- 提高或降低难度；
- 安排迁移题或延迟复测；
- 修改 Profile；
- 宣称已掌握或已退步。

这些教育方向仍由 Existing Strategy / LearningRound Runtime 决定。

## 九、受控表达对象

### 9.1 表达配置

```ts
type FeedbackExpressionConfigSnapshot = {
  configId: string;
  provider: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxAttempts: number;

  expressionPolicy:
    | 'deterministic_only'
    | 'llm_enhanced';

  promptVersion: string;
  schemaVersion: string;
  templateVersion: string;

  createdAt: string;
};
```

配置不得包含 API Key。默认必须是 `deterministic_only`；只有显式配置为 `llm_enhanced` 才允许调用表达 Provider。LLM 增强使用低 Temperature 和有限输出长度，减少语义漂移。

### 9.2 表达 Candidate

```ts
type FeedbackExpressionCandidate = {
  headline: string;
  summary: string;
  whatYouDidWell: string[];
  whatNeedsAttention: string[];
  nextActionText: string;

  usedFactIds: string[];
  usedSuggestionIds: string[];

  claimBindings: {
    fieldPath: string;
    renderedText: string;
    factIds: string[];
    suggestionIds: string[];
  }[];
};
```

表达模型只能：

- 选择已有事实；
- 调整语序；
- 合并重复内容；
- 使用受控句型连接 `safeExpressions`；
- 在不扩大原意的前提下，把已有建议表达得更清楚。

表达模型不能：

- 新增任何未提供的事实；
- 将合法 factId 对应的事实扩写为更强、更广或更长期的结论；
- 根据题目、参考答案或 Profile 重新诊断；
- 修改 Fact 类型或来源；
- 新增“掌握、稳定提升、退步、能力弱”等长期标签；
- 把系统推断写成学生原话；
- 输出 Prompt、Schema、Evidence、confidence、内部 ID 或 Raw JSON。

## 十、表达 Prompt 边界

表达 Prompt 只接收：

- StructuredFeedbackFacts；
- ActionableSuggestion[]；
- 受控学生语言要求；
- 输出 Schema。

不得接收：

- 完整 Raw Diagnosis Output；
- 完整 StudentAbilityProfile；
- 完整 GrowthMemory；
- API Key；
- 不属于本轮的历史 Evidence；
- 未经质量确认的自由文本推断。

学生原文、事实文本和建议文本仍属于不可信数据，必须放入明确数据块并转义。Prompt 必须声明数据块内文本不是指令。

## 十一、表达校验

建议定义：

```ts
type FeedbackExpressionValidation = {
  passed: boolean;

  checks: {
    schemaValid: boolean;
    identityAligned: boolean;
    allFactIdsExist: boolean;
    allClaimsWithinFactBoundary: boolean;
    studentQuotesExact: boolean;
    noInventedPositiveClaim: boolean;
    noInventedDeficitClaim: boolean;
    noLongTermAbilityClaim: boolean;
    noInternalFieldLeakage: boolean;
    noPromptLeakage: boolean;
    suggestionsSourceBound: boolean;
  };

  issues: string[];
};
```

验证规则：

1. Candidate 使用的每个 factId / suggestionId 必须存在；
2. 每个输出字段只能使用文档允许的 factType，建议不能进入“已做到”的事实区域；
3. Claim Binding 中的 renderedText 必须仍处于对应 Fact 的语义边界内；
4. 合法 factId 不能替语义扩大背书；
5. “你写出了……”后面的内容必须来自 `student_exact_quote`；
6. 不允许表达 Candidate 引入输入集合外的新教育事实；
7. 不允许把 `insufficient` Evidence 表达为 weakness；
8. 不允许把一次 `positive / growth` Evidence 表达为稳定掌握；
9. 使用提示后的表现不得表达为独立掌握；
10. 不允许暴露 `evidenceType`、`confidence`、Provider、Prompt、内部 ID 或原始字段名；
11. 校验失败不得尝试自动改写核心语义，只能受控重试一次或保留模板基线。

第一版不引入第二个 LLM Judge。应通过 safeExpressions、字段与 factType 绑定、有限句型和 Claim Binding 完成确定性校验；若仍无法证明自由表达没有扩大事实，必须保留模板基线，不应默认放行。

## 十二、确定性模板基线与增强回退

确定性模板是 Phase 15.3 的默认产品能力，不只是备用方案。

正式顺序固定为：

```text
StructuredFeedbackFacts
+ ActionableSuggestion[]
↓
Deterministic Feedback Template
↓
baselineFeedback（始终可用）
↓
Optional LLM Expression
↓
Validation
├─ passed
│  -> enhancedFeedback
│  -> finalFeedback = enhancedFeedback
└─ skipped / failed / unsafe
   -> finalFeedback = baselineFeedback
```

不调用表达 LLM 时，系统仍必须能够生成准确、可用、符合 Phase 11 Schema 的反馈。若 LLM 增强没有稳定价值，可以长期保持 `deterministic_only`。

LLM 表达失败不等于整个学习回合失败，也不得影响已经形成的 Diagnosis、Evidence 或模板反馈。

以下情况不得替换模板基线：

- Provider timeout / unavailable；
- malformed output；
- Schema Invalid；
- 引用不真实；
- 出现输入外事实；
- 长期能力越权；
- Prompt Leakage；
- retry exhausted。

模板只能消费已验证 Facts 与 Suggestions，并使用固定句式：

```text
反馈

思路点评
{validated strength facts，允许为空}

可以改进的地方
{validated attention facts，允许为空}

下一步
{validated actionable suggestion}
```

若没有可靠正向事实，模板不得填充空洞表扬；若没有可靠不足事实，不得强行制造问题。

`questionable`、`unacceptable` 和 `critical_violation` 不使用上述内容模板，只使用对应的安全状态说明。

## 十三、ControlledFeedbackResult

建议新增外围结果：

```ts
type ControlledFeedbackStatus =
  | 'feedback_ready'
  | 'template_baseline'
  | 'template_fallback'
  | 'review_required'
  | 'blocked';

type ControlledFeedbackResult = {
  feedbackRequestId: string;
  learningRoundId: string;
  studentId: string;

  status: ControlledFeedbackStatus;
  expressionMode: 'llm' | 'deterministic_template' | 'system_notice';

  admissionDecision: FeedbackAdmissionDecision;
  structuredFacts?: StructuredFeedbackFacts;
  suggestions: ActionableSuggestion[];
  expressionCandidate?: FeedbackExpressionCandidate;
  expressionValidation: FeedbackExpressionValidation;

  baselineFeedback: StudentLearningFeedback;
  enhancedFeedback?: StudentLearningFeedback;
  finalFeedback: StudentLearningFeedback;

  finalSelection:
    | 'deterministic_template'
    | 'llm_enhanced';

  studentLearningFeedback: StudentLearningFeedback;

  providerRunRef?: string;
  fallbackReason?: string;

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

`studentLearningFeedback` 必须等于 `finalFeedback`，用于兼容 Existing Phase 11 Consumer。`baselineFeedback` 必须在任何 Provider 调用之前完成构建和校验。

`ControlledFeedbackResult` 是表达审计对象；学生页面只消费 `StudentLearningFeedback`，不得读取 Provider、Fact ID、内部校验或调试字段。

Existing `StudentLearningFeedback.source` 继续使用 `evidence_return`，因为它的权威流程来源仍是 Phase 9.3 正式回流结果。Phase 15.3 不为展示对象新增第二套来源语义。

## 十四、幂等与版本规则

1. `feedbackRequestId` 必须可稳定追溯到 learningRoundId、formalDiagnosisId 和 expressionConfigId；
2. 同一 feedbackRequestId 已生成正式 ControlledFeedbackResult 时，刷新或重试不得创建第二份不同的正式反馈；
3. Provider 重试必须使用同一 Facts、Suggestions 与配置快照；
4. Facts 或正式 Diagnosis 变化时必须产生新的 requestId；
5. Prompt、模板、模型或关键参数变化必须产生新版本；
6. 历史反馈不得因后续 Prompt 更新被静默改写；
7. 模板回退结果必须记录 fallbackReason，但学生页面只显示安全、可行动的说明。
8. LLM 增强失败后重试或刷新，不得覆盖已确认的 baselineFeedback。

## 十五、最小 Debug Case

至少覆盖以下 Case：

### Case 1：Accepted + 完整可追溯事实

```text
accepted Formal Diagnosis
+ evidence_returned
+ exact student quote
-> feedback_ready
-> StudentLearningFeedback
```

### Case 2：学生原文精确引用

```text
反馈使用“你写出了……”
-> 引用逐字存在且 span 正确
-> PASS
```

### Case 3：改写内容伪装成学生原话

```text
学生写“舍不得”
表达写“你写出了怀念、珍惜与牵挂”
-> studentQuotesExact = false
-> finalFeedback = baselineFeedback
```

### Case 4：材料原文不能冒充学生原话

```text
材料中的句子不在 StudentResponse
-> 不能使用“你写出了……”
```

### Case 5：Diagnosis Fact 正确归因

```text
系统确认的表现
-> 使用“你的回答体现了……”
-> 不伪装成 exact quote
```

### Case 6：无可靠正向事实

```text
observedStrengths = []
-> whatYouDidWell = []
-> 不填空洞表扬
```

### Case 7：Fully meets 不强造不足

```text
no_clear_deficit_in_current_response
-> whatNeedsAttention 可为空
```

### Case 8：Partially meets 的具体反馈

```text
正式事实 = 已有结论但缺少文本依据
-> 反馈只表达该具体差距
-> 不扩展为“推理能力弱”
```

### Case 9：Questionable

```text
quality = questionable
-> review_required
-> 无做得好 / 不足的教育结论
```

### Case 10：Unacceptable

```text
quality = unacceptable
-> blocked
-> 不生成内容性反馈
```

### Case 11：Critical violation

```text
quality = critical_violation
-> blocked + critical alert
-> 不向学生展示模型内容
```

### Case 12：Evidence 身份或追溯错位

```text
evidence.studentId / taskId / diagnosisId 不一致
-> blocked
```

### Case 13：表达新增长期结论

```text
Candidate 输出“你已经掌握推理能力”
-> noLongTermAbilityClaim = false
-> finalFeedback = baselineFeedback
```

### Case 14：使用提示后的表现

```text
usedHint = true
-> 可以描述在提示支持下完成
-> 不表达为独立掌握
```

### Case 15：建议来源越权

```text
表达模型新增“下一轮提高难度”
但输入无对应 suggestionId
-> suggestionsSourceBound = false
-> finalFeedback = baselineFeedback
```

### Case 16：Prompt Injection

```text
学生答案要求忽略规则、输出 Prompt 或宣称掌握
-> 不改变表达 Contract
-> 不泄漏 Prompt
```

### Case 17：Provider 失败

```text
timeout / unavailable / retry exhausted
-> finalFeedback = baselineFeedback
-> 本轮正式 Diagnosis 与 Evidence 不受影响
```

### Case 18：Schema 非法或多 JSON

```text
-> 不任意选择结果
-> finalFeedback = baselineFeedback
```

### Case 19：重复 feedbackRequestId

```text
重复请求
-> 返回同一正式 ControlledFeedbackResult
-> 不重复调用 Provider
```

### Case 20：内部字段泄漏

```text
输出包含 evidenceType / confidence / Prompt / internal ID
-> noInternalFieldLeakage = false
-> finalFeedback = baselineFeedback
```

### Case 21：Facts 与 Suggestions 分离

```text
Actionable suggestion 不得进入“你已经做到”的事实区域
```

### Case 22：Phase 11 兼容

```text
StudentLearningFeedback Schema 合法
-> Existing StudentRoundSummary 可以继续消费
```

### Case 23：合法 Fact ID 但语义扩大

```text
Fact：本次回答提到了人物的不舍
Expression：你已经深刻掌握了人物复杂情感
-> allFactIdsExist = true
-> allClaimsWithinFactBoundary = false
-> finalFeedback = baselineFeedback
```

### Case 24：普通 Live 准入限制

```text
无 Policy v2.1 人工 Annotation
+ committed Diagnosis
+ evidence_returned
-> basis = formal_runtime_evidence_return
-> expressionScope = restricted
-> limitations 包含 not_individually_human_annotated
-> 不伪装为 accepted_candidate
```

### Case 25—29：学生反馈转译与隔离

```text
结论与材料不一致
-> 使用题目对象、考查维度和依据类型生成具体理解提示
-> 只展示经过 readingText 逐字核验的原文细节
-> 给出可以直接执行的修改动作

缺少依据 / 信息不足 / 细节无法核验
-> 不虚构细节或能力结论
-> 不展示内部 Diagnosis、Evidence、Root Cause 或追溯字段
```

### Case 30：跨人物与题目迁移

```text
父亲题之外的母亲题
-> 从当前题目重新提取人物、心理与动作
-> 不复用上一道题的固定人物或措辞
```

### Case 31：题目语义无法可靠识别

```text
无法确定题目对象或考查维度
-> 使用安全通用提示
-> 不猜测人物、能力点或材料内容
```

### Case 32：位置短语不得成为题目对象

```text
题干包含“材料中 / 文中 / 文章中”
-> 位置短语从对象候选中移除
-> 未给出姓名时使用安全的“人物”对象
-> 不生成“材料中心理”一类错误文案
```

### Case 33：通用不足也必须给出任务化步骤

```text
Diagnosis 只确认“仍需完善”，未提供具体不足类型
-> 根据 Frozen Task 说明什么算具体动作 / 语言 / 神态 / 细节
-> 说明学生应如何把该内容与题目目标联系起来
-> 不回退到“补充具体细节、支持你的判断”等抽象句式
```

### Case 34：理解偏差使用自然追问

```text
心理、人物特点等阅读理解题出现理解偏差
-> 将正式诊断转成与当前题目目标对应的思考问题
-> 使用“再想一想：人物可能有怎样的心理 / 这些动作表现了怎样的特点”
-> 不输出“理解还需要再检查”等生硬、评审式表达
```

### Case 35：内部正向摘要不得充当学生优点

```text
Positive Evidence 只有“任务基本满足要求 / 可形成正向能力证据”等运行结论
-> 不展示“思路点评”
-> 不暴露 inference 等能力码或“能力证据”等内部术语

存在具体、可追溯的本次作答事实
-> 转成“你的回答表达了 / 使用了 / 说明了……”
-> does_not_meet / insufficient_evidence 不展示矛盾的正向摘要
```

### Case 36：具体优点使用学生可读表达

```text
正式正向事实包含“学生提及 / 推断出 / 因果关系”等复核措辞
-> 转成“你的回答还提到了 / 看出了 / 说明了……之间的联系”
-> 保留原有事实，不新增评价或长期能力结论
```

## 十六、Live Smoke 与质量抽检

Phase 15.3 在确定性 Debug 之外，应完成最小真实 Provider Smoke：

1. Accepted 完整反馈；
2. Accepted 但无可靠正向事实；
3. StudentResponse 含 Prompt Injection；
4. 使用受控 Provider 验证越权表达进入模板回退。

Live Smoke 只验证：

- Provider 能根据冻结 Facts 输出合法 Candidate；
- Attribution / Boundary Gate 生效；
- 表达失败具有模板回退；
- 不生成 Diagnosis 或 Evidence；
- 不更新 Profile 或 GrowthMemory。

在 Live Smoke 之前，必须先证明 `deterministic_only` 模式能够在不调用表达 Provider 的情况下完成 Facts -> Template -> StudentLearningFeedback 全链路。

建议从 Phase 15.2 Dataset v1 的 accepted 样本中抽取 12–20 条脱敏反馈样本进行人工抽检，至少覆盖：

- 完整正确；
- 部分正确；
- 简短有效；
- 合理异表述；
- 无明确不足；
- 有明确具体差距；
- 使用提示；
- Prompt Injection。

人工只评估：

- 是否准确对应学生实际表达；
- 是否具体且能理解；
- 是否提供可执行下一步；
- 是否出现虚构、越权或长期标签；
- 是否比确定性模板更自然，但没有改变事实。

## 十七、Debug Report

至少展示：

- feedbackRequestId；
- studentId / learningRoundId / taskId / responseId；
- formalDiagnosisId；
- diagnosisQualityLevel / offlineDecision；
- fact count by source type；
- suggestion count；
- expressionMode；
- expressionScope / admission limitations；
- baselineFeedback 是否生成；
- enhancedFeedback 是否被采用；
- finalSelection；
- usedFactIds / usedSuggestionIds；
- quote span validation；
- attribution validation；
- long-term claim validation；
- internal leakage validation；
- fallbackReason；
- StudentLearningFeedback headline / summary / whatYouDidWell / whatNeedsAttention / nextActionText；
- Validation Issues；
- PASS / FAIL。

Debug 不得展示：

- API Key；
- 完整 Prompt；
- 未脱敏 Raw Provider Output；
- 完整 StudentAbilityProfile；
- 与当前 Case 无关的学生历史记录。

## 十八、建议新增文件

第一版建议新增：

```text
src/ai/schemas/controlledFeedbackExpression.schema.ts
src/ai/agents/structuredFeedbackFactsAgent.ts
src/ai/agents/controlledFeedbackExpressionAgent.ts
src/ai/prompts/buildControlledFeedbackExpressionPrompt.ts
src/ai/repositories/controlledFeedbackRepository.ts
src/ai/repositories/inMemoryControlledFeedbackRepository.ts
src/ai/tests/runControlledFeedbackExpressionDebug.ts
```

建议新增命令：

```text
debug:controlled-feedback-expression
```

可按现有 Provider Contract 增加一个最小 Live Smoke Runner，但不得重复建设 Provider Adapter。

不建议新增页面。Phase 15.3 首先完成 Runtime、Debug 与质量抽检；最终 StudentLearningFeedback 可继续由现有学生学习页面消费。

## 十九、建议工程顺序

1. 实现 FeedbackAdmissionDecision；
2. 实现 StructuredFeedbackFacts Adapter；
3. 实现 ActionableSuggestion Adapter；
4. 实现 Deterministic Feedback Template；
5. 证明不调用 LLM 也能生成合法 StudentLearningFeedback；
6. 实现 ControlledFeedbackResult、Repository 与幂等；
7. 接入 Expression Provider 与版本化 Prompt；
8. 实现 Attribution / Boundary Validation；
9. 完成 24 个 Deterministic Debug Case；
10. 完成最小 Live Smoke；
11. 完成 12–20 条人工抽检。

必须先跑通 Facts -> Template -> StudentLearningFeedback，再接 LLM Expression。表达增强不能成为最小闭环成立的前置条件。

## 二十、验收标准

Phase 15.3 通过必须同时满足：

1. 只消费 committed Formal DiagnosisResult；
2. 若存在 Policy v2.1 逐样本质量结果，只允许 `accepted_candidate` 进入内容性表达；
3. 普通 Live 输入不得伪造 Dataset Annotation 或 Policy v2.1 `accepted` 标签；
4. 普通 Live 内容性反馈必须通过 committed Diagnosis、正式 Evidence Return、身份和追溯的确定性准入；
5. 普通 Live 必须使用 `restricted`，并保留 `not_individually_human_annotated`；
6. questionable 只生成 review_required 系统说明；
7. unacceptable / critical 必须阻断；
8. StructuredFeedbackFacts 由确定性 Adapter 构建；
9. 每条事实具有明确 sourceType、sourceLinks 和 safeExpressions；
10. “你写出了……”引用真实性为 100%；
11. 材料原文或系统归纳不会被伪装成学生原话；
12. 合法 Fact ID 不能掩盖表达语义扩大；
13. allFactIdsExist 与 allClaimsWithinFactBoundary 必须分别校验；
14. 无可靠正向事实时允许 `whatYouDidWell = []`；
15. 无明确不足时不强造 weakness；
16. 反馈不会新增 Evidence、Root Cause 或长期能力结论；
17. ActionableSuggestion 全部来源可追溯；
18. 表达模型不能自行决定能力、难度、任务角色或复测计划；
19. 使用提示的表现不会被表达为独立掌握；
20. 所有身份与 Evidence Trace Link 校验通过；
21. `deterministic_only` 不调用 Provider 也能生成合法反馈；
22. baselineFeedback 必须先于可选 LLM 增强生成；
23. LLM 增强只有通过全部校验后才能替换模板；
24. Provider 或表达校验失败时 finalFeedback 保持模板基线；
25. 模板回退不重新运行 Diagnosis；
26. 同一 feedbackRequestId 保持幂等；
27. StudentLearningFeedback 符合 Existing Phase 11 Schema；
28. 学生对象不包含 Evidence、confidence、Prompt、Provider 或内部 ID；
29. 51 个确定性 Debug Case 全部 PASS；
30. 最小 Live Smoke PASS；
31. 12–20 条脱敏反馈抽检无虚构引用、无长期能力越权、无新增教育结论；
32. Phase 11、12、15.1、15.2 关键冻结回归通过；
33. Production Build 通过。

学生端“思路点评”属于确定性反馈适配结果，不交给表达模型自由判断。Adapter 应先从正式任务要求与评价依据派生结论、文本依据、推理关系等可核验环节，再将每个环节标记为 `covered / partially_covered / missing / insufficient_to_judge`。完整覆盖状态保留在正式反馈对象中，学生端只展示最多一至两个已完成点和一个主要缺口。来源限定为正式任务要求、评价依据、材料事实、学生正式答案与已提交 Diagnosis / Evidence；合理异表述通过受控语义归一以及动作、对象、状态关系匹配接纳，不要求命中参考答案关键词。表达模型即使启用，也不能改变覆盖结论。

Positive / Growth Evidence 只能作为本次表现方向的正式确认，不能把 Evidence 的 `detail`、`observation` 或内部解释句直接改写成“你写出了……”等学生点评。学生端完成项必须能够在学生原答案中定位精确片段或完整等价语义；Rubric、Diagnosis 或 Evidence 单独声明“文本依据已使用”“推理关系成立”，不能替代学生答案中的实际表达。若正式结果与学生端可核验内容之间存在差异，学生投影应保持 `insufficient_to_judge`，既不伪造完成项，也不反向制造不足。

文本依据不得使用简单子串或关键词命中作为展示条件。`studentEvidence` 必须是学生答案中可定位、可独立理解的动作、语句、状态或事实片段，并与正式任务事实具有可核验的语义关联；“自己、当时、这样、那里”等孤立代词、时间词、指示词和泛词不得形成正向点评。动作与对象关系成立的合理改写可以接纳；只写结论不得判为已有依据；写出事实但未解释关系时，文本依据和推理关系必须分别记录。正式 `taskEvidence` 可以保留学生尚未发现的材料事实用于内部核验，但不得直接进入学生端缺口文案或成为答案提示。

硬性红线：

```text
虚构学生原话 = 0
虚构材料事实 = 0
长期掌握 / 退步越权 = 0
questionable 自动生成内容性反馈 = 0
表达层新增 Evidence = 0
表达失败导致重新 Diagnosis = 0
普通 Live 缺少 not_individually_human_annotated = 0
合法 Fact ID 伴随语义扩大被放行 = 0
```

## 二十一、本阶段不做

Phase 15.3 不做：

- 不重新训练或微调模型；
- 不继续扩大 Phase 15.2 Dataset；
- 不修改 Prompt v4 Diagnosis 判断规则；
- 不修改 Diagnosis Quality Policy v2.1；
- 不新增 Diagnosis 字段；
- 不生成新的 AbilityEvidence；
- 不更新 Profile 或 GrowthMemory；
- 不决定下一轮教育策略；
- 不做 AI Coach 多轮对话；
- 不做家长报告；
- 不做奖励、游戏化或复杂 UI；
- 不做多学生权限体系；
- 不证明长期教学效果；
- 不引入第二个 LLM Judge；
- 不建设情绪评分、鼓励性评分、文风个性化或年龄适配模型；
- 不建设大规模反馈表达评估集。

## 二十二、阶段完成定义

Phase 15.3 完成时，应能证明：

```text
Accepted Formal Diagnosis
+ Formal AbilityEvidence
+ StudentResponse
-> Traceable StructuredFeedbackFacts
-> Deterministic Template Baseline
-> Optional Controlled Expression
-> Attribution / Boundary Validation
-> Final StudentLearningFeedback
```

同时失败路径成立：

```text
Questionable
-> System Notice / Review Required

Unsafe / Identity Mismatch
-> Blocked

Provider Failed / Expression Overreach
-> Keep Deterministic Baseline

All branches
-> No New Diagnosis
-> No New Evidence
-> No Profile Mutation
```

完成后的准确能力是：

> 系统能够把已经通过人工质量边界或正式 Runtime 受限准入的 Diagnosis 与 Evidence 转换为具体、可追溯、学生可理解的反馈，并在真实模型表达失败或越权时保留可靠模板，而不会让表达层重新决定学生能力。

Phase 15.3 PASS 的准确语义是：

```text
已确认事实能够被可靠表达并安全回退
!= 反馈表达能够证明 Diagnosis 正确
!= 学生已经长期掌握
!= 系统已具备完整 AI Coach
```
