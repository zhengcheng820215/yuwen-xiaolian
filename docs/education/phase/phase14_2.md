# Phase 14.2：Evidence Conflict Coordination 最小闭环（冲突证据协调）

设计状态：ACCEPTED
工程状态：PASS

## 一、阶段目标

Phase 14.2 只解决一个核心问题：

```text
同一学生、同一能力下出现多条方向和质量不同的 AbilityEvidence 时，
系统能否先识别独立观察、解释条件差异，再形成克制且可追溯的冲突协调结果？
```

一句话定义：

> 解析每条 Evidence 当前唯一有效的 EvidenceQualityAssessment，按 observationUnitId 去重并识别同质观察，在不覆盖历史、不直接更新画像的前提下生成 EvidenceConflictAssessment 和 Existing Phase 8 的受控输入上下文。

Phase 14.2 不重新判断学生答案，不修改 Evidence 方向，不生成 `EvaluationResult`，不生成 `ProfileUpdateDecision`，也不更新 `StudentAbilityProfile`。

## 二、阶段背景

Phase 14.1 已经能够为单条正式 `AbilityEvidence` 生成：

```text
EvidenceQualityAssessment
```

它能够说明：

- 该 Evidence 的方向是什么；
- 观察条件的质量是 `high / medium / low / insufficient`；
- 是否允许进入后续解释；
- 是否独立完成；
- 是否使用提示；
- 是否为原题、相似任务或迁移任务；
- 是否为即时或延迟观察；
- Diagnosis、身份和追溯链是否可靠；
- 多条 Evidence 是否来自同一个 observation unit。

但单条质量判断仍不能回答：

- 多条正向 Evidence 是否真的来自多个独立观察；
- 正向与弱项 Evidence 的差异能否由提示、难度、材料或时间解释；
- 两条高质量反向 Evidence 是否构成真实冲突；
- 同一 Response 产生的多个 Evidence 是否被重复计数；
- 多个高度同质的任务是否被错误累计为稳定结论；
- 哪些 Evidence 可以作为 Existing Phase 8 的主要输入，哪些只能作为限制信息保留。

Phase 14.2 用独立的冲突协调对象回答这些问题。

## 三、阶段定位

Phase 14.2 位于：

```text
Phase 14.1 Evidence Quality Assessment
↓
Phase 14.2 Evidence Conflict Coordination
↓
EvaluationContextAdapter
↓
Existing Phase 8 Evaluation Runtime
```

它是 Evidence 质量解释与 Existing Phase 8 正式能力判断之间的协调层。

它可以描述：

- 当前观察主要同向；
- 当前方向差异可以由条件变化解释；
- 当前存在尚未解决的真实冲突；
- 当前可比较观察不足；
- 当前数据需要人工复核。

它不能描述：

- 学生能力已经稳定；
- 学生能力已经下降；
- 学生已经掌握；
- StudentAbilityProfile 应直接改成什么状态；
- 下一题必须具体生成什么内容。

## 四、最小链路

```text
AbilityEvidence[]
+ EvidenceQualityAssessment[]
↓
Identity / Ability Validation
↓
Current Assessment Resolution
↓
Observation Unit Deduplication
↓
Formal Comparison Context Derivation
↓
Eligibility Classification
↓
Homogeneity Clustering
↓
Direction Difference Strength Evaluation
↓
EvidenceConflictAssessment
↓
EvaluationContextAdapter
↓
Evaluation Runtime Capability Negotiation
↓
EvaluationContextEnvelope
```

本阶段到 `EvaluationContextEnvelope` 为止。

Phase 14.2 Debug 必须验证该 Envelope 是否具备进入 Existing Phase 8 的条件。只有当前 Runtime 明确支持所需质量与冲突能力时，才允许 quality-aware handoff。

本阶段不得创建第二套 Evaluation Agent，也不得为了验收重复执行 Existing Phase 8。旧 Runtime 可以继续保留原有 full Evidence 行为，但不得被静默标记为已经应用 Phase 14 质量保护。

## 五、输入

建议输入：

```ts
type EvidenceConflictCoordinationInput = {
  studentId: string;
  targetAbilityId: string;

  abilityEvidence: AbilityEvidence[];
  qualityAssessments: EvidenceQualityAssessment[];
  comparisonContexts: EvidenceComparisonContext[];

  coordinatedAt: string;
  timezone: string;
};
```

输入规则：

1. `abilityEvidence` 必须是正式、不可变的 Ability Evidence；
2. `qualityAssessments` 必须来自 Phase 14.1；
3. `comparisonContexts` 必须由正式 TaskResource、TaskFulfillment、ConcreteLearningTask、TaskExecutionResult 和时间事实适配产生；
4. 同一 Evidence 可以存在多个历史 Assessment，但只能解析到一个当前有效版本；
5. 调用方不得直接传入 conflict status、dominant direction、independentContextCount 或 recommendation；
6. Agent 必须根据正式 Evidence、当前有效 Assessment 和 Comparison Context 自行派生协调结果；
7. 只协调 `evidence.ability === targetAbilityId` 的 Evidence；
8. studentId、abilityId、evidenceId、observationUnitId 或 Comparison Context 追溯关系错位时必须阻断；
9. 输入数组顺序不得影响协调结果与稳定 ID；
10. 无法证明 Context 独立时默认归入同质限制，不得默认视为独立。

## 六、EvidenceConflictAssessment Model

建议新增：

```ts
type EvidenceConflictStatus =
  | 'aligned_positive_evidence'
  | 'aligned_weakness_evidence'
  | 'explainable_mixed_evidence'
  | 'unresolved_conflict'
  | 'insufficient_comparable_evidence'
  | 'review_required';

type EvidenceCoordinationRecommendation =
  | 'proceed_to_evaluation'
  | 'proceed_with_limitations'
  | 'collect_more_evidence'
  | 'request_discriminating_observation'
  | 'human_review';

type EvidenceConflictAssessment = {
  conflictAssessmentId: string;
  studentId: string;
  abilityId: string;

  status: EvidenceConflictStatus;
  recommendation: EvidenceCoordinationRecommendation;

  observationUnits: EvidenceObservationUnitSummary[];

  observationUnitCount: number;
  comparableObservationUnitCount: number;
  independentContextCount: number;

  directionSummary: {
    positiveUnitCount: number;
    weaknessUnitCount: number;
    mixedUnitCount: number;
    insufficientUnitCount: number;
  };

  eligibleEvidenceIds: string[];
  limitedEvidenceIds: string[];
  blockedEvidenceIds: string[];
  reviewRequiredEvidenceIds: string[];

  currentQualityAssessmentIds: string[];
  supersededQualityAssessmentIds: string[];

  comparisonFacts: string[];
  differenceFactors: EvidenceDifferenceFactor[];
  conflictFactors: string[];
  limitations: string[];

  evidenceLinks: string[];
  schemaVersion: 'evidence_conflict_assessment_v1';
  policyVersion: 'evidence_conflict_policy_v1';
  coordinatedAt: string;

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

### 字段职责

`status`：

描述当前纳入协调的独立观察之间是什么关系，不表示正式能力状态。

`recommendation`：

描述下一步如何处理 Evidence，不替代 `EvaluationResult.nextAction` 或 `NextLearningStrategy`。

`observationUnits`：

记录去重后的独立观察。一个 observation unit 可以关联多个 Evidence，但只能增加一次独立观察计数。

`eligible / limited / blocked / reviewRequiredEvidenceIds`：

保留每条正式 Evidence 在协调阶段的处置位置，不删除任何历史 Evidence。

`comparisonFacts`：

记录本次协调实际使用的可追溯事实。

`differenceFactors`：

记录观察条件之间实际存在的差异，以及这些差异是否足以支持“条件相关的混合表现”。它不证明因果关系。

`conflictFactors`：

记录哪些独立、可比较观察仍然指向相反方向。

`limitations`：

记录证据不足、同质性过高、提示依赖或上下文缺失等限制。

## 七、EvidenceObservationUnitSummary Model

建议新增：

```ts
type EvidenceObservationDirection =
  | 'positive_signal'
  | 'weakness_signal'
  | 'mixed_signal'
  | 'insufficient_signal';

type EvidenceObservationUnitSummary = {
  observationUnitId: string;
  studentId: string;
  abilityId: string;

  direction: EvidenceObservationDirection;
  evidenceIds: string[];
  qualityAssessmentIds: string[];

  effectiveQualityLevel:
    | 'high'
    | 'medium'
    | 'low'
    | 'insufficient';

  effectiveEligibility:
    | 'eligible'
    | 'limited'
    | 'blocked'
    | 'review_required';

  taskIds: string[];
  responseIds: string[];
  taskRoles: string[];

  comparisonClusterId: string;
  limitations: string[];
};
```

正式规则：

1. 相同 `observationUnitId` 的 Evidence 必须聚合为一个 Observation Unit；
2. 一个 Unit 中只有 `positive / growth` 时，方向为 `positive_signal`；
3. 一个 Unit 中只有 `weakness` 时，方向为 `weakness_signal`；
4. 同一个 Unit 同时存在正向和 weakness 时，方向为 `mixed_signal`；
5. 只有 `insufficient` 时，方向为 `insufficient_signal`；
6. `growth` 必须保留为改善信号，不能被改写为稳定 positive；
7. 同一 Unit 中多个 Assessment 的 Eligibility 不一致时采用更保守结果；
8. 同一 Unit 中存在 `blocked` 或 `review_required` 且无法解释时，整个 Unit 不得升级为 eligible；
9. Unit 内 Evidence 数量不增加独立观察权重；
10. Unit Summary 只做聚合，不修改原始 Evidence。

### EvidenceComparisonContext

Observation Unit 只表示一次真实执行，不能单独证明观察环境独立。

建议新增：

```ts
type EvidenceComparisonContext = {
  comparisonContextId: string;
  observationUnitId: string;
  studentId: string;
  abilityId: string;

  taskId: string;
  sourceTaskId?: string;
  executionSessionId: string;
  responseId: string;

  materialIdentity?: string;
  taskRole: string;
  taskNovelty: 'same' | 'similar' | 'transfer' | 'unknown';
  timingType: 'immediate' | 'delayed' | 'unknown';
  difficultyRelation: 'lower' | 'comparable' | 'higher' | 'unknown';
  hintDependency: 'none' | 'low' | 'medium' | 'high' | 'unknown';

  observedAt: string;
  observationWindowId: string;
  repeatedExecutionOf?: string;

  source: 'formal_runtime_adapter';
  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

`materialIdentity` 必须来自可追溯的 `sourceTaskId / TaskResource.resourceId`，或由正式阅读材料内容生成稳定 fingerprint。它不能只根据题目标题、自然语言相似度或调用方声明生成。

当前 `EvidenceQualityAssessment.sourceLinks` 不直接保存 TaskResource ID，因此 Phase 14.2 必须通过正式 Comparison Context Adapter 补足材料身份，不得把 `taskId 不同` 自动解释为材料不同。

### 三层概念

```text
Observation Unit
= 一次 TaskExecution 产生的一组 Evidence

Comparison Context
= 任务、材料、时间窗口、难度和支持条件构成的观察环境

Independent Context
= Comparison Context 可验证地不同，且不存在明确重复执行关系
```

最小独立 Context 条件：

```text
observationUnitId 不同
+ responseId 不同
+ executionSessionId 不同
+ comparisonClusterId 不同
+ 不属于同一 repeated execution
+ 正式材料或时间环境差异可验证
→ 可以增加 independentContextCount
```

任何一项关键独立事实未知时，应记录同质性限制。无法证明独立时默认不增加 `independentContextCount`。

## 八、当前有效 Assessment 解析规则

每条 Evidence 必须调用 Phase 14.1 已有的：

```ts
resolveCurrentEvidenceQualityAssessment(evidenceId, assessments)
```

正式规则：

1. 只使用替代链末端、Schema 合法、validation passed 的唯一当前 Assessment；
2. 旧 Assessment 保留在历史中，但不能参与当前方向协调；
3. 同一 Evidence 找不到当前 Assessment 时不得默认 quality = medium；
4. 同一 Evidence 存在两个当前版本时进入 `review_required`；
5. Assessment 存在循环、断链、重复 ID 或错误 supersedes 关系时进入 `review_required`；
6. Assessment.evidenceType 必须与正式 AbilityEvidence.evidenceType 一致；
7. Assessment.studentId、abilityId、evidenceId 必须与正式 Evidence 一致；
8. 不同 policyVersion 不得静默混合；
9. 无法解析唯一当前版本的 Evidence 必须进入 reviewRequiredEvidenceIds；
10. 任何旧版本都不得重复增加 Observation Unit 数量。

## 九、Eligibility 处置规则

Phase 14.2 必须保留四类 Eligibility：

### eligible

- 可以进入主要方向协调；
- 可以构成 comparable observation unit；
- 可以作为 Existing Phase 8 的主要 Evidence 输入候选；
- 仍不能单独证明长期能力状态。

### limited

- Evidence 和 Assessment 继续完整保留；
- 可以解释方向差异和形成 limitations；
- 不能单独满足“至少两个独立可比较观察”的门槛；
- 在当前 MVP 中不作为主要 Evidence 数量增加 Phase 8 sufficiency；
- 后续质量感知 Evaluation 可以把它作为受限上下文消费，但不得与 eligible Evidence 等量处理。

### blocked

- 不进入方向计数；
- 不进入 Existing Phase 8 的主要 Evidence 输入；
- 必须保留 blocked 原因和 Evidence ID；
- blocked 不表示该 Evidence 被删除。

### review_required

- 表示身份、追溯、版本或正式事实存在不安全问题；
- 不得继续自动协调；
- 不得进入 Existing Phase 8；
- 必须保留供 Debug 或人工复核。

## 十、独立观察与去重规则

Phase 14.2 不按 Evidence ID 数量直接判断观察次数。

正式处理顺序：

```text
Evidence ID Deduplication
↓
Current Assessment Resolution
↓
observationUnitId Grouping
↓
Observation Unit Direction Derivation
↓
Formal Comparison Context Validation
↓
Comparison Cluster Derivation
↓
Independent Comparable Unit Counting
```

必须满足：

1. 重复输入同一 Evidence ID 不增加计数；
2. 同一 Response 产生多个 Evidence ID，只形成一个 observation unit；
3. 同一 TaskExecution 产生多个关联 Evidence，不得被解释为多次独立完成；
4. 同一 Evidence 的历史 Assessment 不增加计数；
5. 不同 responseId 不自动表示观察条件独立；
6. 同一 taskId、同一 materialIdentity、同一 delayedRetestPlanId 或明显重复执行的观察必须归入同质组；
7. 不同 responseId 或 executionSessionId 只证明发生了不同执行，不自动证明 Context 独立；
8. 只有 Comparison Context 可验证不同且不存在重复执行关系时，才增加 independentContextCount；
9. 多个高度同质 Observation Unit 不得无限增加方向一致性；
10. observationUnitId、Evidence ID 和 Assessment ID 的排序不得影响稳定结果 ID；
11. 至少两个 eligible 且独立可比较的 Observation Unit，才能形成 aligned status；
12. 只有 0–1 个独立可比较 Observation Unit 时必须输出 `insufficient_comparable_evidence`。

## 十一、同质性处理规则

Phase 14.2 第一版不建设复杂相似度模型。

建议根据正式 Assessment 和 EvidenceComparisonContext 派生 `comparisonClusterId`，至少考虑：

- targetAbilityId；
- taskRole；
- taskNovelty；
- timingType；
- difficultyRelation；
- hintDependency；
- materialIdentity；
- taskId、repeatedExecutionOf 或 delayedRetestPlanId；
- Evidence occurredAt 所属观察时间窗口。

处理规则：

1. 完全相同 taskId 或 materialIdentity 的重复观察优先视为同质；
2. 同一 delayedRetestPlan 下的重复结果不得视为多个独立延迟复测；
3. 标记了 `repeatedExecutionOf` 的 Context 必须归入被重复对象所在 Cluster；
4. 同一时间窗口、相同任务角色、相同材料身份和相同提示条件的 Observation Unit 应记录同质性限制；
5. 无法证明材料独立时，不得宣称已经形成多材料迁移稳定性；
6. 高度同质 Observation 可以保留，但不能无限提高 aligned 结论强度；
7. 第一版可以采用确定性规则和 policyVersion，不使用模型相似度；
8. 同质性规则变化时必须升级 policyVersion，不得静默改变旧结果含义；
9. Context Adapter 校验未通过时不得增加 independentContextCount。

## 十二、方向协调规则

### aligned_positive_evidence

最小条件：

- 至少两个 eligible 的独立可比较 Observation Unit；
- 主要方向为 `positive_signal`；
- 没有 eligible 的 `weakness_signal`；
- 没有未解决的 mixed unit；
- 至少两个独立 comparison context；
- validation passed。

说明：

`positive_signal` 可以包含 positive 或 growth，但必须保留二者原始数量与语义。

该状态只表示当前可比较观察主要指向正向，不表示能力已经稳定或已经掌握。

### aligned_weakness_evidence

最小条件：

- 至少两个 eligible 的独立可比较 Observation Unit；
- 主要方向为 `weakness_signal`；
- 没有 eligible 的正向 Observation Unit；
- 没有未解决的 mixed unit；
- 至少两个独立 comparison context；
- validation passed。

该状态只表示当前可靠观察持续暴露同类问题，不表示永久能力标签。

### explainable_mixed_evidence

适用情况：

- 正向与 weakness Evidence 同时存在；
- 正式条件差异与表现方向之间具有足够的协调解释强度；
- 至少存在一个 `strong` Difference Factor，或至少两个方向一致的 `plausible` Difference Factor；
- Difference Factor 来自提示、任务难度、材料新颖性、即时/延迟、任务角色或独立性差异；
- 不存在两个条件高度可比较、质量相近且方向相反的高价值观察。

示例：

```text
即时原题 + 多次提示 + positive
延迟新材料 + 无提示 + weakness
```

这表示当前条件差异足以阻止系统把两次表现当作直接冲突，例如训练情境中可以完成，但独立保持或迁移仍不足。

它不能被简单平均为“中等能力”，也不能把 Difference Factor 表述为已经证明的因果关系。

### unresolved_conflict

最小条件：

- 至少两个 eligible 的独立可比较 Observation Unit；
- 质量相近；
- 提示、难度、材料、时间和任务角色没有达到足够的协调解释强度；
- 一个或多个 Unit 指向 positive，另一个或多个 Unit 指向 weakness。

输出后应优先：

- 请求区分性观察；
- 安排更可比较的复测；
- 保持当前 Profile 状态；
- 必要时人工复核。

Phase 14.2 本身不执行这些动作。

### insufficient_comparable_evidence

适用情况：

- 只有 0–1 个 eligible 独立观察；
- 只有 limited Evidence；
- 大多数 Evidence 为 insufficient；
- Observation Unit 高度同质；
- 正式上下文不足以比较；
- 方向事实存在，但不足以形成 aligned 或 conflict。

输出后只能建议继续收集 Evidence，不能更新长期状态。

### review_required

适用情况：

- studentId 或 abilityId 错位；
- Assessment 版本链无法解析；
- Evidence 与 Assessment 的 evidenceType 不一致；
- observationUnitId 或正式追溯关系冲突；
- policyVersion 不兼容；
- 输入存在无法安全协调的数据问题。

该状态必须阻断自动 Evaluation handoff。

## 十三、可解释差异规则

方向不同只有在存在正式事实时才能进行协调解释。

建议新增：

```ts
type EvidenceDifferenceFactor = {
  factor:
    | 'hint'
    | 'difficulty'
    | 'material'
    | 'timing'
    | 'task_role'
    | 'independence';

  observedDifference: boolean;

  explanatoryStrength:
    | 'strong'
    | 'plausible'
    | 'insufficient';

  relatedObservationUnitIds: string[];
  reason: string;
};
```

`explanatoryStrength` 只表示该条件差异是否足以支持“不能直接比较两次表现”，不表示已经证明学生表现变化由该因素造成。

可观察因素包括：

1. `hintDependency` 明显不同；
2. 一个任务为 same / similar，另一个为 transfer；
3. 一个观察为 immediate，另一个为 delayed；
4. `difficultyRelation` 不同；
5. taskRole 不同；
6. 一个 Observation Unit 的 eligibility 为 limited；
7. 一个观察独立完成，另一个依赖提示；
8. 一个观察缺少可比材料事实。

### Strength 判断

`strong`：

- 差异来自正式、完整、可追溯的 Comparison Context；
- 条件变化方向与表现差异一致；
- 例如有提示、原题或较低难度时 positive，而无提示、迁移或较高难度时 weakness；
- 其他关键比较条件没有明显反向事实。

`plausible`：

- 条件差异真实存在；
- 但仍有一个或多个比较维度未知；
- 该因素可以限制直接比较，但不足以单独解释方向差异。

`insufficient`：

- 只观察到表面差异；
- 条件变化方向与表现差异不一致；
- 或缺少正式材料、难度、时间、提示或身份事实；
- 不能用于生成 `explainable_mixed_evidence`。

### 状态门槛

```text
至少一个 strong Difference Factor
或
至少两个方向一致的 plausible Difference Factor
→ 可以进入 explainable_mixed_evidence

只有 observed difference，但解释强度不足
+ 其他条件已确认可比较
→ unresolved_conflict

只有 observed difference，但关键可比条件未知
→ insufficient_comparable_evidence
```

不能作为解释依据：

- Evidence 文案更长；
- confidence 单独更高；
- Evidence 创建时间更晚；
- 调用方声明“这是迁移”；
- 只因为一条是 growth、一条是 positive；
- 只因为最后一次表现不同。

Agent 必须输出每个 Difference Factor 的来源 Observation Unit 和 reason，不得只输出“存在时间差异”等无来源结论。

## 十四、高质量与低质量 Evidence 的关系

Phase 14.2 不做数值加权平均。

正式规则：

1. high-quality positive 与 low-quality weakness 并存，不自动得到 mixed average；
2. high-quality weakness 与 low-quality positive 并存，应保留正向信号，但主要限制来自可靠 weakness；
3. low-quality Evidence 不得被删除；
4. low-quality Evidence 不得与 high-quality Evidence 等量满足一致性门槛；
5. 两条方向相反的 high-quality eligible Evidence 优先进入 unresolved conflict；
6. medium-quality eligible Evidence 可以参与比较，但必须保留 limitations；
7. limited Evidence 只能帮助解释条件差异，不能单独推翻 eligible Evidence；
8. qualityLevel 不改变 evidenceType；
9. confidence 不替代 qualityLevel；
10. Phase 14.2 不输出 0–100 权重分数。

## 十五、EvaluationContextAdapter

建议新增：

```ts
type EvaluationInputMode =
  | 'legacy_full_evidence'
  | 'quality_aware_primary_evidence';

type EvaluationCapability =
  | 'quality_context'
  | 'conflict_context'
  | 'limited_evidence'
  | 'do_not_resolve_conflict_automatically';

type EvaluationRuntimeContract = {
  runtimeId: string;
  runtimeVersion: string;
  supportedCapabilities: EvaluationCapability[];
  source: 'registered_runtime_contract';
  validation: {
    passed: boolean;
    issues: string[];
  };
};

type EvaluationContextEnvelope = {
  adapterResultId: string;
  studentId: string;
  targetAbilityId: string;

  rawEvidence: AbilityEvidence[];

  primaryEvaluationEvidence: AbilityEvidence[];
  supportingContextEvidence: AbilityEvidence[];

  observationUnits: EvidenceObservationUnitSummary[];
  conflictAssessment: EvidenceConflictAssessment;

  blockedEvidenceIds: string[];
  reviewRequiredEvidenceIds: string[];

  qualityAssessmentIds: string[];
  observationUnitIds: string[];

  evaluationInputMode: EvaluationInputMode;
  requiredEvaluationCapabilities: EvaluationCapability[];
  supportedEvaluationCapabilities: EvaluationCapability[];
  supportedByCurrentEvaluationRuntime: boolean;
  qualityProtectionApplied: boolean;

  limitations: string[];
  canEnterExistingEvaluation: boolean;

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

建议 Adapter 输入：

```ts
type EvaluationContextAdapterInput = {
  rawEvidence: AbilityEvidence[];
  conflictAssessment: EvidenceConflictAssessment;
  currentQualityAssessments: EvidenceQualityAssessment[];
  runtimeContract: EvaluationRuntimeContract;
};
```

`runtimeContract` 必须来自代码注册表、版本化配置或正式 Runtime 握手，不得由普通业务调用方临时声明 `supportedByCurrentEvaluationRuntime = true`。

### Adapter 规则

1. `rawEvidence` 保存本次输入中去重后的全部正式 target-ability Evidence；
2. rawEvidence 包含 eligible、limited、insufficient、blocked 和 review_required Evidence，任何正式 Evidence 都不得因 Adapter 选择而消失；
3. `primaryEvaluationEvidence` 只来自当前 Assessment 为 eligible 的纯方向 Observation Unit；
4. 每个 Observation Unit 最多选择一条确定性代表 Evidence 进入 `primaryEvaluationEvidence`；
5. 代表 Evidence 只用于 quality-aware 模式下避免旧 Phase 8 按条数重复统计，不表示该 Evidence 比同 Unit 其他 Evidence 更真实；
6. weakness unit 选择一条 weakness Evidence；positive unit 同时存在 growth 和 positive 时可以选择更克制的 growth，但两种语义必须继续保留在 raw/supporting context；
7. mixed unit 不直接选择主要 Evidence，必须留在冲突或受限上下文中；
8. 同一 observation unit 的其余 Evidence、limited Evidence 和 insufficient Evidence 完整保留在 `supportingContextEvidence`；
9. 代表 Evidence 必须按稳定 Evidence ID 和版本化 policy 确定，不能依赖输入数组顺序；
10. `rawEvidence` 必须等于 primary、supporting、blocked 和 review 集合的可追溯并集；
11. blocked 与 review_required Evidence 不进入主要 Evaluation 输入；
12. 所有 Evidence ID 必须继续保留在 Conflict Assessment 的 evidenceLinks 中；
13. `legacy_full_evidence` 保持 Existing Phase 8 原有输入语义，但 `qualityProtectionApplied = false`；
14. `quality_aware_primary_evidence` 只有在 Runtime 支持全部 required capabilities 时才可启用；
15. Adapter 必须根据 Conflict Status 派生 required capabilities，不信任调用方声明；
16. status = review_required 时 `canEnterExistingEvaluation = false`；
17. status = insufficient_comparable_evidence 时，只有满足质量感知能力和主要 Evidence 安全条件才可 handoff；
18. status = unresolved_conflict 时，只有 Runtime 支持 conflict context 和禁止自动解决冲突能力时才可 handoff；
19. 能力不兼容时不得仅附带 conflict context 后继续调用旧 Evaluation；
20. Adapter 不生成 `EvaluationResult`；
21. Adapter 不修改 `EvaluationResult` Schema；
22. Existing Phase 8 在完整链路中只能执行一次；
23. Phase 8 的质量感知接入应采用向后兼容的可选上下文或正式 wrapper，不复制 Evaluation Agent；
24. 旧 Runtime 可以继续在 Phase 14 编排之外使用 legacy 输入，但不得宣称已经应用 Observation Unit 去重或冲突保护。

### Runtime 能力协商

建议按 Conflict Status 派生最低能力：

| Conflict Status | Required Capabilities |
|---|---|
| `aligned_positive_evidence` | `quality_context` |
| `aligned_weakness_evidence` | `quality_context` |
| `explainable_mixed_evidence` | `quality_context`, `conflict_context`, `limited_evidence` |
| `unresolved_conflict` | `quality_context`, `conflict_context`, `do_not_resolve_conflict_automatically` |
| `insufficient_comparable_evidence` | `quality_context`, `limited_evidence` |
| `review_required` | 不允许自动 handoff |

当前 Existing Phase 8 `evaluationAgent` 只消费原始 `AbilityEvidence[]`，尚未通过上述质量与冲突能力契约。因此在完成向后兼容集成与对应回归前：

```text
supportedByCurrentEvaluationRuntime = false
qualityProtectionApplied = false
```

Phase 14.2 可以完成 Assessment、Envelope 和能力协商，但不能通过一个布尔默认值假设旧 Runtime 已经支持 Conflict Context。

### Status 与 Recommendation 映射

第一版建议采用带能力协商的确定性映射：

| Conflict Status | Recommendation | Evaluation Handoff |
|---|---|---|
| `aligned_positive_evidence` | `proceed_to_evaluation` | Runtime 支持 quality context 时允许 |
| `aligned_weakness_evidence` | `proceed_to_evaluation` | Runtime 支持 quality context 时允许 |
| `explainable_mixed_evidence` | `proceed_with_limitations` | Runtime 支持 quality、conflict 和 limited context 时允许 |
| `unresolved_conflict` | `request_discriminating_observation` | 只有 Runtime 支持冲突保护时允许，否则阻断 |
| `insufficient_comparable_evidence` | `collect_more_evidence` | Runtime 支持 quality/limited context 且主要 Evidence 安全时允许 |
| `review_required` | `human_review` | 阻断 |

该映射只决定协调与交接方式，不直接决定 Phase 8 的 `nextAction`，也不生成下一任务。

## 十六、与 Existing Phase 8 的边界

准确链路是：

```text
AbilityEvidence[]
+ Current EvidenceQualityAssessment[]
↓
EvidenceConflictAssessment
↓
EvaluationContextEnvelope
↓
Evaluation Runtime Capability Negotiation
├─ supported
│  ↓
│  Existing Phase 8 Evaluation（一次）
│  ↓
│  EvaluationResult
│  ↓
│  ProfileUpdateDecision
│  ↓
│  GrowthMemoryRecord
│
└─ unsupported
   ↓
   blocked / collect more Evidence / discriminating observation
```

Phase 14.2 允许：

- 整理 Evidence Eligibility；
- 识别当前有效质量 Assessment；
- 聚合 Observation Unit；
- 输出冲突关系与限制；
- 准备 Existing Phase 8 的受控输入；
- 校验当前 Runtime 是否具备所需质量与冲突能力。

Phase 14.2 不允许：

- 根据 Conflict Assessment 直接修改 Profile；
- 输出 `update_profile` 等正式 Profile action；
- 自己生成新的 AbilityEvidence；
- 创建第二套 `EvaluationResult`；
- 直接生成 `ProfileUpdateDecision`；
- 直接生成 `GrowthMemoryRecord`；
- 在 Adapter 中判断 stable、improving 或 weak；
- 假设旧 Phase 8 能理解它未声明支持的 Conflict Context；
- 为了接入质量上下文重复运行 Existing Phase 8。

## 十七、稳定 ID 与幂等规则

`conflictAssessmentId` 应由以下稳定事实派生：

- studentId；
- targetAbilityId；
- 当前 Assessment ID 的排序集合；
- observationUnitId 的排序集合；
- comparisonContextId / comparisonClusterId 的排序集合；
- Difference Factor 的规范化事实；
- conflict policyVersion。

正式规则：

1. 输入顺序变化不改变结果 ID；
2. 重复输入同一 Evidence 不改变结果；
3. 同一 Assessment 历史版本不重复参与；
4. 当前 Assessment 发生正式 supersede 后，应生成新的 conflictAssessmentId；
5. policyVersion 变化后应生成新的协调结果；
6. 相同正式输入重复执行必须得到相同 status、recommendation 和 ID；
7. Runtime capability 变化不改变 Conflict Assessment，但应生成新的 adapterResultId；
8. adapterResultId 必须包含 Runtime ID、Runtime Version、Input Mode 和 Capability 集合；
9. 不使用随机数或当前数组顺序生成正式 ID。

## 十八、失败与阻断规则

以下情况必须进入 `review_required` 并阻断 Adapter：

1. studentId 不一致；
2. abilityId 不一致；
3. Evidence 与 Assessment 的 evidenceId 不一致；
4. Evidence 与 Assessment 的 evidenceType 不一致；
5. 无法解析唯一当前 Assessment；
6. Assessment supersedes 链循环或分叉；
7. observationUnitId 缺失或冲突；
8. Assessment policyVersion 不受支持；
9. quality Assessment validation 未通过但被标记为 eligible；
10. 同一 Evidence 被两个不兼容的当前 Assessment 同时解释；
11. 正式时间或追溯信息明显矛盾；
12. Adapter 中的 Evidence 集合与 Conflict Assessment 不一致；
13. Comparison Context 身份错位或来源校验失败；
14. Runtime capability contract 来源非法或 validation 未通过；
15. quality-aware 模式缺少所需 Runtime capabilities。

以下情况不是 Runtime FAIL：

- 只有一条有效观察；
- 只有 limited Evidence；
- Evidence 方向不同但可解释；
- 两条高质量 Evidence 真实冲突；
- 当前需要继续观察；
- 当前缺少迁移或延迟 Evidence；
- 当前 Existing Phase 8 尚未支持 quality/conflict context。

这些情况应输出结构化 status 和 limitations，而不是抛出错误或伪造结论。

## 十九、建议新增文件

```text
src/ai/schemas/evidenceConflictAssessment.schema.ts
src/ai/agents/evidenceConflictAssessmentAgent.ts
src/ai/agents/evidenceComparisonContextAdapter.ts
src/ai/agents/evaluationContextAdapter.ts
src/ai/tests/runEvidenceConflictAssessmentDebug.ts
```

新增脚本：

```text
debug:evidence-conflict-assessment
```

不新增第二套：

- AbilityEvidence Schema；
- EvidenceQualityAssessment Schema；
- EvaluationResult Schema；
- ProfileUpdateDecision Schema；
- GrowthMemory Schema。

## 二十、Debug 流程

```text
1. 准备同一 studentId、targetAbilityId 的正式 AbilityEvidence[]
2. 准备 Phase 14.1 生成的 Quality Assessment 历史
3. 为每条 Evidence 解析唯一当前 Assessment
4. 按 observationUnitId 聚合
5. 从正式 Runtime 对象生成并校验 EvidenceComparisonContext
6. 派生 Observation Unit 方向
7. 分类 eligible / limited / blocked / review_required
8. 识别同质 Observation Cluster
9. 计算独立可比较 Observation Unit 数量
10. 派生 EvidenceDifferenceFactor 与解释强度
11. 生成 EvidenceConflictAssessment
12. 读取已注册 EvaluationRuntimeContract
13. 生成 EvaluationContextEnvelope 并完成能力协商
14. 校验 raw / primary / supporting Evidence 完整性
15. 校验稳定 ID、Evidence Links 与 Adapter 一致性
16. 输出 PASS / FAIL
```

Debug Report 至少展示：

- Student ID；
- Target Ability；
- Input Evidence IDs；
- Current Quality Assessment IDs；
- Superseded Assessment IDs；
- Observation Unit IDs；
- Comparison Context IDs；
- Comparison Cluster IDs；
- Independent Context Count；
- Eligible / Limited / Blocked / Review Evidence IDs；
- Positive / Weakness / Mixed / Insufficient Unit Count；
- Comparable Observation Unit Count；
- Conflict Status；
- Difference Factors / Explanatory Strength；
- Conflict Factors；
- Recommendation；
- Evaluation Input Mode；
- Required / Supported Evaluation Capabilities；
- qualityProtectionApplied；
- Adapter canEnterExistingEvaluation；
- Validation Issues；
- PASS / FAIL。

## 二十一、最小 Debug Case

### Case 1：两个独立 high-quality positive

预期：

- `aligned_positive_evidence`；
- recommendation = proceed_to_evaluation；
- 至少两个 comparable observation unit。

### Case 2：两个独立 high-quality weakness

预期：

- `aligned_weakness_evidence`；
- 不输出永久 weak 标签；
- 可以进入 Existing Phase 8。

### Case 3：high-quality weakness + low-quality positive

低质量正向来自多提示即时原题。

预期：

- `explainable_mixed_evidence`；
- low-quality positive 保留在 limited context；
- 不与 high-quality weakness 等量平均。

### Case 4：即时 positive + 延迟 weakness

材料、难度、提示和目标能力均已完成正式对齐，延迟关系来自 DelayedRetestPlan。

预期：

- `explainable_mixed_evidence`；
- Difference Factor 包含 timing，explanatoryStrength 达到 strong；
- 不宣称能力下降。

### Case 5：原题 positive + 新材料迁移 weakness

材料身份、目标能力、难度和提示条件均可追溯。

预期：

- `explainable_mixed_evidence`；
- 说明原题表现未迁移；
- 不删除原题 positive。

### Case 6：较低难度 positive + 较高难度 weakness

两个任务的难度关系已由正式任务上下文确认，其他关键条件不存在反向事实。

预期：

- `explainable_mixed_evidence`；
- 记录 difficulty difference；
- 不简单判断冲突。

### Case 7：两个条件可比较的 high-quality 反向 Evidence

预期：

- `unresolved_conflict`；
- recommendation = request_discriminating_observation；
- 不直接更新 Profile。

### Case 8：只有一个 eligible Observation Unit

预期：

- `insufficient_comparable_evidence`；
- recommendation = collect_more_evidence。

### Case 9：只有 limited Evidence

预期：

- `insufficient_comparable_evidence`；
- limited Evidence 保留；
- 不满足 Phase 8 主要 Evidence 门槛。

### Case 10：blocked / review_required Evidence

预期：

- 不参与方向计数；
- Evidence ID 仍然可追溯；
- review_required 输入阻断 Adapter。

### Case 11：insufficient Evidence

预期：

- 不参与正向或 weakness 方向；
- 进入 insufficientUnitCount 或 limitations。

### Case 12：重复 Evidence ID

预期：

- 只计算一次；
- conflictAssessmentId 保持稳定。

### Case 13：同一 Response 产生多个 Evidence ID

预期：

- 共享同一 observationUnitId；
- 只形成一个独立观察；
- Evidence 仍全部保留。

### Case 14：同一 Evidence 有 superseded Assessment

预期：

- 只使用当前版本；
- 旧版本不参与协调；
- superseded ID 被记录。

### Case 15：Assessment 版本分叉

预期：

- status = review_required；
- canEnterExistingEvaluation = false。

### Case 16：studentId / abilityId 错位

预期：

- review_required；
- 不输出自动方向协调结论。

### Case 17：多个不同 Response 但观察高度同质

预期：

- 保留全部 Observation Unit；
- independentContextCount 不无限增加；
- 不因数量堆叠直接形成 aligned。

### Case 18：Evidence 与 Assessment evidenceType 不一致

预期：

- review_required；
- 阻断 Adapter。

### Case 19：输入顺序变化与重复执行

预期：

- conflictAssessmentId 稳定；
- status、recommendation 和计数一致。

### Case 20：合法 Conflict Assessment 生成 Adapter Envelope

预期：

- rawEvidence 保留全部正式 Evidence；
- 每个 eligible 纯方向 Observation Unit 最多一条代表 Evidence 进入 primaryEvaluationEvidence；
- limited、insufficient 和同 Unit 的非代表 Evidence 进入 supportingContextEvidence；
- blocked Evidence 不进入主要 Evaluation；
- raw / primary / supporting / blocked / review 集合可完整核对；
- Adapter 不生成 EvaluationResult。

### Case 21：支持冲突能力的 Runtime 接收 unresolved conflict

预期：

- Runtime contract 明确支持全部 required capabilities；
- canEnterExistingEvaluation = true；
- evaluationInputMode = quality_aware_primary_evidence；
- qualityProtectionApplied = true；
- conflict context 完整保留；
- 不在 Adapter 中生成 Profile action。

### Case 22：review_required 阻断 handoff

预期：

- canEnterExistingEvaluation = false；
- 不执行 Existing Phase 8。

### Case 23：存在条件差异，但不足以解释方向冲突

即时 positive 与延迟 weakness 并存，但材料、难度和支持条件未知。

预期：

- timing difference 被记录；
- explanatoryStrength = insufficient 或 plausible；
- 不自动输出 explainable_mixed_evidence；
- 关键可比条件未知时输出 insufficient_comparable_evidence；
- 若其他条件已确认可比但解释仍不足，则输出 unresolved_conflict。

### Case 24：Current Phase 8 不支持 Conflict Context

status = unresolved_conflict，但 Runtime contract 未声明 conflict protection。

预期：

- supportedByCurrentEvaluationRuntime = false；
- qualityProtectionApplied = false；
- canEnterExistingEvaluation = false；
- recommendation = request_discriminating_observation；
- 不把 Conflict Context 仅作为附加字段交给旧 Evaluation。

### Case 25：同一 Unit 同时包含 growth 与 positive

预期：

- Unit direction = positive_signal；
- growth 和 positive 均保留在 rawEvidence；
- 最多一条进入 primaryEvaluationEvidence；
- 另一条进入 supportingContextEvidence；
- 原始语义不会因代表选择而消失；
- Observation Unit 只计数一次。

## 二十二、验收标准

Phase 14.2 通过条件：

1. 已定义 `EvidenceConflictAssessment` Schema；
2. 已定义 `EvidenceObservationUnitSummary`；
3. 已定义 `EvidenceComparisonContext`；
4. 已定义 `EvidenceDifferenceFactor`；
5. 已定义版本化 `EvaluationRuntimeContract` 与 Capability；
6. 已实现 EvidenceConflictAssessmentAgent；
7. 已实现 EvidenceComparisonContextAdapter；
8. 已实现 EvaluationContextAdapter；
9. 能解析每条 Evidence 当前唯一有效 Assessment；
10. 历史 Assessment 不会重复参与；
11. 同一 observationUnitId 的多个 Evidence 只算一个独立观察；
12. Observation Unit、Comparison Context 和 Independent Context 的语义明确分离；
13. independentContextCount 只基于可验证差异增加；
14. 不同 responseId 不会被自动解释为独立 Context；
15. 重复 Evidence ID 不增加计数；
16. 高度同质 Observation 不会无限累加；
17. 支持 `aligned_positive_evidence`；
18. 支持 `aligned_weakness_evidence`；
19. 支持 `explainable_mixed_evidence`；
20. 支持 `unresolved_conflict`；
21. 支持 `insufficient_comparable_evidence`；
22. 支持 `review_required`；
23. 0–1 个独立可比较观察不会输出 aligned；
24. growth 与 positive 的原始语义被保留；
25. high-quality weakness 不会被 low-quality positive 静默覆盖；
26. low-quality Evidence 不会被删除；
27. blocked / review_required Evidence 不进入主要 Evaluation 输入；
28. 条件差异必须来自正式 Comparison Context；
29. 存在条件差异不会自动输出 explainable_mixed；
30. Difference Factor 能区分 strong / plausible / insufficient；
31. 两条可比较的高质量反向 Evidence 能进入 unresolved conflict；
32. conflict status 不被解释为 Profile 状态；
33. recommendation 不替代 EvaluationNextAction 或 NextLearningStrategy；
34. Envelope 同时保留 raw、primary 和 supporting Evidence；
35. 每个 observation unit 最多一条代表 Evidence 进入主要 Evaluation 输入；
36. 代表选择不会让同 Unit 其他 Evidence 从 raw/supporting context 消失；
37. Adapter 显式区分 legacy 与 quality-aware 输入模式；
38. Adapter 能派生 required Evaluation capabilities；
39. Runtime Capability 来源受控且经过校验；
40. Runtime 不支持 required capabilities 时 quality-aware handoff 被阻断；
41. unresolved conflict 不会被交给不支持 Conflict Context 的旧 Phase 8；
42. legacy 模式不会被宣称为已应用 Phase 14 质量保护；
43. Adapter 不生成 EvaluationResult；
44. Existing Phase 8 在兼容链路中只执行一次；
45. 输入顺序变化不影响稳定结果；
46. Debug 覆盖至少 25 个 Case；
47. Debug 输出 PASS；
48. Phase 14.1 Debug 回归通过；
49. Phase 13.3、Phase 9.3 和 Phase 12 Integration 回归通过；
50. Production Build 通过。

## 二十三、本阶段不做

Phase 14.2 不做：

- 不修改 AbilityEvidence；
- 不重新生成 EvidenceQualityAssessment；
- 不重新调用 Diagnosis Runtime；
- 不计算学生能力分数；
- 不直接更新 StudentAbilityProfile；
- 不生成 EvaluationResult；
- 不生成 ProfileUpdateDecision；
- 不生成 GrowthMemoryRecord；
- 不生成 NextLearningStrategy；
- 不生成 AdaptiveTaskConstraints；
- 不生成 TaskRequest；
- 不静默改变 Existing Phase 8 的原始 Evidence 输入语义；
- 不伪造 Evaluation Runtime Capability；
- 不做复杂数值权重；
- 不做机器学习冲突模型；
- 不做 UI；
- 不证明教学效果或长期提升。

## 二十四、阶段完成定义

Phase 14.2 完成时，应能证明：

```text
多条 AbilityEvidence 不再只按数量或最后一次结果解释；
同一作答不会因多个 Evidence ID 被重复计权；
低质量 Evidence 不会被删除，也不会与高质量 Evidence 等量处理；
条件差异可解释的混合表现与真正未解决的方向冲突能够被区分；
不安全数据会阻断，而不是被默认修复为 medium；
协调结果只有在 Runtime 能力兼容时，才可以通过受控 Adapter 进入 Existing Phase 8。
```

完成后的准确能力是：

> 系统能够为同一能力下的多条 Evidence 建立独立观察关系，区分方向一致、条件差异可解释、真实冲突、可比较证据不足和需要复核；能够同时保留原始 Evidence 与去重后的主要 Evaluation 输入，并在 Runtime 明确支持所需质量和冲突能力时，为 Existing Phase 8 准备可追溯的质量上下文。

## 二十五、工程实现与验收记录

验收日期：2026-07-17

验收结论：PASS

已完成：

- `src/ai/schemas/evidenceConflictAssessment.schema.ts`
- `src/ai/agents/evidenceComparisonContextAdapter.ts`
- `src/ai/agents/evidenceConflictAssessmentAgent.ts`
- `src/ai/agents/evaluationContextAdapter.ts`
- `src/ai/tests/runEvidenceConflictAssessmentDebug.ts`
- `debug:evidence-conflict-assessment`

专项 Debug 结果：

- 25 个 Evidence Conflict Coordination Case 全部通过；
- 支持 aligned positive、aligned weakness、explainable mixed、unresolved conflict、insufficient comparable 和 review required；
- 同一 observation unit 的多条 Evidence 只增加一次观察计数；
- 多个高度同质观察不会被错误视为多个独立 Context；
- Assessment 历史版本可解析，分叉版本会进入复核；
- 条件存在差异但解释力不足时，不会自动输出 explainable mixed；
- raw Evidence、primary Evidence 与 supporting Evidence 均被保留；
- 同一 Unit 的 `growth` 与 `positive` 原始语义不会因代表选择而消失；
- Runtime Capability 协商能够阻止旧 Phase 8 静默消费 unsupported conflict context；
- 输入顺序变化与重复 Evidence 不影响稳定结果。

回归结果：

- Phase 14.1 Evidence Quality Assessment：17 / 17 PASS；
- Phase 13.3 Retention Evaluation：18 / 18 PASS；
- Phase 9.3 Task Evidence Return：PASS；
- Phase 12 Integrated Acceptance：9 / 9 PASS；
- Production Build：PASS。

当前边界：

- Existing Phase 8 当前合同仍是 legacy 模式，未声明 Phase 14 质量与冲突能力；
- 因此实际 quality-aware handoff 默认被阻断，不会伪装为已应用质量保护；
- 本阶段只生成协调结果和受控 Envelope，不执行 Existing Phase 8，不更新 Profile；
- 尚未实现 Phase 14.3 Adaptive Task Constraints；
- 不证明真实教学效果或长期能力提升。
