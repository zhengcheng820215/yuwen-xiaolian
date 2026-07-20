# Phase 16.2：资源 Metadata 与匹配质量（Resource Metadata and Matching Quality）

设计状态：ACCEPTED / FROZEN

工程状态：16.2A `PASS`；16.2B `PASS`；Phase 16.2 Overall `PASS / FROZEN`

2026-07-20 Checkpoint：

- `ReviewedResourceMatchCandidateAdapter`、`CoreResourceEligibilityAgent` 和共享 `Resource Match Quality` Schema 已实现；
- 已复用 Phase 16.1 `QuestionResourceAdmissionRepository` 读取 Registry、Frozen Version、Validation 和 Review；
- 12 个 16.2A Deterministic Cases 全部通过；
- Phase 16.1 回归 `22 / 22 PASS`；
- Phase 14.3 回归 `26 / 26 PASS`；
- Production Build PASS；
- 16.2B 14 个 Deterministic Cases 与 2 个 A -> B Integration Cases 全部通过；
- 16.2A + 16.2B 联合连续运行 30 次全部通过，完整输出哈希一致；
- Phase 8.4、Phase 14.3、Phase 16.1 关键回归与 Production Build 通过；
- Phase 16.2 轻量 Match Review Demo 已完成 `8 / 8` Case 人工验收，PC 与平板布局检查通过；
- Phase 16.1 -> 16.2 Repository Integration Debug 已完成 `5 / 5 PASS`，连续运行 20 次完整输出哈希一致；
- Phase 16.1 -> 16.2 人工联调 Demo 已完成 `4 / 4 PASS`；Case 1、2 正常放行，Case 3 安全阻断，Case 4 拒绝能力错位资源；
- Phase 16.2 Overall 已满足 Unified Acceptance，状态冻结为 `PASS / FROZEN`。

## 一、阶段目标

Phase 16.2 只回答一个问题：

> 系统如何证明一个已审核的正式题目资源适合当前 TaskRequest，而不是只因为能力标签相同就放行？

本阶段消费 Phase 16.1 形成的 `FrozenQuestionResourceVersion`、`ResourceRegistryEntry` 和正式 TaskRequest / Adaptive Constraints，复用 Existing TaskFulfillment，增加可解释、可阻断、可复核的资源匹配质量 Gate。

最小目标是证明：

1. 只有 Registry 当前指向的审核有效 Frozen Version 才能参与正式匹配；
2. TaskRequest、TaskFulfillmentRequest、AdaptiveTaskConstraints 与资源身份可以完整对齐；
3. 匹配会检查能力、任务角色、难度、材料新颖度、近期重复、Rubric、提示支持和版本状态；
4. 系统能稳定输出 `matched`、`partial_match`、`no_match` 或 `review_required`；
5. 只有满足全部关键硬约束的 `matched` 资源才能形成 `ExecutableLearningTask`；
6. 匹配成功与失败都能解释原因；
7. 找不到资源时形成结构化资源缺口，不静默放宽约束，也不临时伪造正式题目。

一句话定义：

> Phase 16.2 将审核有效的正式题目资源与当前学习请求进行可解释匹配，并以资源身份、版本、教育约束和可执行性作为正式放行条件。

## 二、与既有 Phase 的关系

### Phase 8.4

Phase 8.4 已建立：

```text
TaskRequest
-> TaskFulfillmentRequest
-> AvailableTaskResource[]
-> TaskResourceMatchResult
-> ExecutableLearningTask / TaskGenerationRequest
```

Phase 16.2 不重写 TaskRequest、TaskFulfillmentRequest、TaskResourceMatchResult 或 ExecutableLearningTask。

Phase 16.2 增加的是：

- 将 16.1 Frozen Resource 安全适配为 Existing TaskFulfillment 可消费的候选资源；
- 对 Existing Match Result 进行正式质量核验；
- 补充 `review_required` 与结构化资源缺口；
- 防止 Existing `matched` 在版本、Rubric、新颖度或 Adaptive Constraints 不满足时直接执行。

### Phase 14.3

Phase 14.3 已明确：

- `NextLearningStrategy` 是教育方向唯一来源；
- `AdaptiveTaskConstraints` 是结构化约束唯一来源；
- `TaskRequest.constraints` 只保留兼容摘要，不是完整约束来源；
- TaskFulfillment 找不到满足硬约束的资源时，不得静默降低要求。

因此 Phase 16.2 必须消费正式 `AdaptiveTaskRequestEnvelope`，不能从自然语言约束摘要中反向猜测完整规则。

### Phase 16.1

Phase 16.1 已建立：

```text
StructuredQuestionDraft
-> ResourceValidationResult
-> ResourceReviewDecision
-> FrozenQuestionResourceVersion
-> ResourceRegistryEntry
```

Phase 16.2 只消费正式 Frozen Version，不消费 Draft、pending review、revision required 或 rejected 资源。

### Phase 16.3

Phase 16.2 输出的 accepted match 将成为 Phase 16.3 真实多日学习运行的任务来源。

如果 Phase 16.2 不能稳定阻断错误资源，Phase 16.3 的真实学习结果不具备可信输入基础。

## 三、两个内部工作包

Phase 16.2 不新增更细的正式 Phase 文档，内部拆为两个有依赖顺序的工程工作包。

```text
Phase 16.2A Core Resource Eligibility
↓
Phase 16.2B Context-sensitive Match Quality
↓
Phase 16.2 Unified Acceptance / Freeze
```

### Phase 16.2A：正式资源候选与核心资格校验

核心问题：

> 哪些 Frozen Resource 有资格进入 Existing TaskFulfillment？

最小链路：

```text
AdaptiveTaskRequestEnvelope
+ TaskFulfillmentRequest
+ ResourceRegistry Snapshot
+ Frozen Resource Versions
↓
Identity / Version / Review Validation
↓
Reviewed Resource Candidate Adapter
↓
Core Resource Eligibility
↓
Eligible AvailableTaskResource View
```

16.2A 负责：

- Envelope、TaskRequest、Constraints 和 FulfillmentRequest 身份一致性；
- Registry current version；
- Frozen / active 状态；
- Validation / Review 可追溯；
- primary ability；
- task role；
- difficulty；
- Rubric 是否足以支持 Diagnosis 和 validationGoal；
- Draft、superseded、retired 和身份冲突资源隔离；
- 形成可供 Existing TaskFulfillment 使用的 eligible candidate view。

16.2A 输出内部交接对象：

```ts
type CoreResourceEligibilityStatus =
  | 'eligible'
  | 'no_eligible_resource'
  | 'review_required'
  | 'blocked';

type CoreResourceCandidateEvaluation = {
  candidateEvaluationId: string;
  candidateId: string;
  resourceId: string;
  resourceVersionId: string;
  status: 'eligible' | 'rejected' | 'review_required';
  checks: {
    identityAligned: boolean;
    registryCurrentVersion: boolean;
    resourceFrozenAndActive: boolean;
    reviewAndValidationTraceable: boolean;
    targetAbilityAligned: boolean;
    taskRoleAligned: boolean;
    difficultyAllowed: boolean;
    rubricSupportsValidationGoal: boolean;
  };
  reasons: string[];
  issues: string[];
};

type CoreResourceEligibilityResult = {
  eligibilityResultId: string;
  taskRequestId: string;
  fulfillmentRequestId: string;
  constraintsId: string;
  status: CoreResourceEligibilityStatus;
  candidates: ReviewedResourceMatchCandidate[];
  candidateEvaluations: CoreResourceCandidateEvaluation[];
  eligibleCandidateIds: string[];
  rejectedCandidateIds: string[];
  reviewRequiredCandidateIds: string[];
  issues: string[];
  canEnterExistingTaskFulfillment: boolean;
  policyVersion: string;
  evaluatedAt: string;
};
```

`CoreResourceEligibilityResult` 只用于 16.2A 与 16.2B 的内部工程交接，不替代最终 `ResourceMatchQualityEvaluation`。

16.2A PASS 表示核心候选资格链成立，是内部 Checkpoint；不表示 Phase 16.2 已完成，也不能单独进入 Phase 16.3。

当前 v1 实现使用受控难度映射：`basic -> lower`、`intermediate -> same`、`advanced -> higher`，仅用于 16.2A 的核心范围校验。资源相对当前学生状态的更细难度解释、材料新颖度、提示策略和上下文适配仍属于 16.2B，不得从该映射推断教学难度已经完整标定。

### Phase 16.2B：上下文匹配质量与正式分流

核心问题：

> 在具备正式资格的候选资源中，哪一道真正满足当前学习请求？

最小链路：

```text
CoreResourceEligibilityResult
+ Eligible Candidate View
+ Recent Task / Material History
+ AdaptiveTaskConstraints
↓
Existing TaskFulfillment
↓
TaskResourceMatchResult
↓
Context-sensitive Quality Gate
↓
ResourceMatchQualityEvaluation
↓
ExecutableLearningTask / StructuredResourceGap / Human Review
```

16.2B 负责：

- material novelty；
- recent task / material duplication；
- exclude task / material；
- hint policy；
- required capabilities；
- pre-execution quality conditions；
- soft preferences；
- 稳定 tie-breaker；
- selection reasons 与 limitations；
- `matched / partial_match / no_match / review_required`；
- StructuredResourceGap；
- ExecutableLearningTask 完整追溯；
- 创建任务前 Registry 二次校验。

2026-07-20 Engineering Checkpoint：上述 Runtime 已完成实现，14 个 16.2B Cases 和 2 个集成 Cases 为 `16 / 16 PASS`。`matched` 可以形成带 resource/version/constraints/quality evaluation 追溯的质量放行任务；`partial_match`、`no_match` 和 `review_required` 均不会自动生成未经审核的新题或教育状态。

只有 16.2A、16.2B、全量 Debug、Demo、回归和 Build 全部通过，才能记录 Phase 16.2 `PASS / FROZEN`。

### 拆分边界

```text
16.2A PASS
!= Phase 16.2 PASS

CoreResourceEligibilityResult
!= ResourceMatchQualityEvaluation

eligible candidate
!= matched resource
```

两个工作包共享一套正式资源身份、同一 ResourceMatchQuality Schema 和同一最终验收，不得各自建立相互冲突的匹配状态或第二套 TaskFulfillment。

## 四、最小功能闭环

```text
AdaptiveTaskRequestEnvelope
+ TaskFulfillmentRequest
+ Reviewed Frozen Resource Pool
+ ResourceRegistry Snapshot
+ Recent Task / Material History
↓
Phase 16.2A Core Eligibility
↓
Eligible Resource Candidate View
↓
Phase 16.2B
↓
Existing TaskFulfillment
↓
TaskResourceMatchResult
↓
ResourceMatchQualityEvaluation
├─ matched
│  ↓
│  AcceptedResourceMatch
│  ↓
│  ExecutableLearningTask
│
├─ partial_match
│  ↓
│  blocked / human_review / resource_gap
│
├─ no_match
│  ↓
│  StructuredResourceGap
│
└─ review_required
   ↓
   Human Review
```

底层关系：

```text
resource admission passed
!= resource matched

same ability
!= suitable task

partial_match
!= executable with warnings

matched
!= teaching effect proven
```

## 五、本阶段输入

Phase 16.2 的正式输入至少包括：

```ts
type ResourceMatchQualityInput = {
  adaptiveRequestEnvelope: AdaptiveTaskRequestEnvelope;
  fulfillmentRequest: TaskFulfillmentRequest;

  registryEntries: ResourceRegistryEntry[];
  frozenVersions: FrozenQuestionResourceVersion[];

  recentHistory: ResourceMatchRecentHistory;
  evaluatedAt: string;
};
```

### AdaptiveTaskRequestEnvelope

必须满足：

- `canEnterTaskFulfillment = true`；
- Envelope validation passed；
- TaskRequest 与 Constraints 的 studentId、abilityId、taskRole、strategyId 一致；
- `constraintsId` 与正式 AdaptiveTaskConstraints 一致；
- Strategy / Constraints alignment 已通过。

不允许 16.2 自行修改 Strategy、targetAbility、taskRole 或 validationGoal。

### TaskFulfillmentRequest

必须从同一正式 TaskRequest 转换而来，并满足：

- `sourceTaskRequestId` 一致；
- studentId 一致；
- targetAbilityId 一致；
- taskRole 一致；
- validationGoal 未被改写；
- requiredCapabilities 与结构化 Constraints 可追溯对应。

### Frozen Resource Pool

资源池只包含或可追溯到：

- `FrozenQuestionResourceVersion`；
- 对应 `ResourceRegistryEntry`；
- 对应 Validation / Review 身份；
- Material Snapshot 或可验证 Material 身份；
- Ability Metadata、Rubric、MinimumAnswerRequirement 与 Source。

### Recent History

```ts
type ResourceMatchRecentHistory = {
  studentId: string;
  recentTaskIds: string[];
  recentResourceIds: string[];
  recentResourceVersionIds: string[];
  recentMaterialIds: string[];
  recentExecutionSessionIds: string[];
  historyWindowStartedAt?: string;
  historyWindowEndedAt: string;
};
```

Recent History 只描述正式发生过的任务和材料，不重新判断学生能力。

无法证明某项资源未重复时，不得默认把它视为新材料。

## 六、权威来源

Phase 16.2 必须保持以下权威关系：

| 信息 | 唯一权威来源 |
| --- | --- |
| 教育方向 | NextLearningStrategy |
| target ability / task role / validation goal | TaskRequest + AdaptiveTaskRequestEnvelope |
| 结构化任务约束 | AdaptiveTaskConstraints |
| 当前正式资源版本 | ResourceRegistryEntry.currentFrozenVersionId |
| 题目内容与 Rubric | FrozenQuestionResourceVersion |
| 近期重复事实 | ResourceMatchRecentHistory |
| Existing 初步匹配结果 | TaskResourceMatchResult |
| 最终能否执行 | ResourceMatchQualityEvaluation |

`TaskRequest.constraints: string[]`、页面显示文本、资源标题或标签都不能成为第二权威来源。

## 七、资源候选适配

Existing TaskFulfillment 当前消费 `AvailableTaskResource`。

Phase 16.2 应通过确定性 Adapter 把审核有效的 Frozen Version 转换为候选视图，不修改正式 Frozen Resource：

```ts
type ReviewedResourceMatchCandidate = {
  candidateId: string;

  resourceId: string;
  resourceVersionId: string;
  taskId: string;
  materialId?: string;
  materialVersionId?: string;

  taskRole: RecommendedTaskRole;
  targetAbilityId: string;
  supportingAbilityIds: string[];
  difficulty: QuestionResourceDifficulty;
  questionType: StructuredQuestionType;
  responseFormat: QuestionResponseFormat;

  capabilities: string[];
  validationGoalTags: string[];
  resourceTags: string[];

  sourceValidationId: string;
  sourceReviewId: string;
  registryStatus: ResourceRegistryStatus;
  frozenStatus: FrozenQuestionResourceStatus;

  traceability: {
    registryEntryFound: boolean;
    currentVersionAligned: boolean;
    validationTraceable: boolean;
    reviewTraceable: boolean;
    materialTraceable: boolean;
  };
};
```

Adapter 规则：

1. Adapter 不创建新的教育 Metadata；
2. difficulty、ability、taskRole 必须来自 Frozen Version / Registry；
3. capabilities 与 validationGoalTags 必须由 Rubric 和受控 Metadata 确定性映射；
4. 无法可靠映射的字段不得根据标题或题干自由推断；
5. Adapter 输出不是新的正式资源，只是匹配视图；
6. 同一资源版本和规则版本应产生稳定 candidateId；
7. Draft、superseded、retired 或非 Registry current version 不得成为 eligible candidate。

## 八、核心输出对象

### 1. ResourceConstraintCheck

```ts
type ResourceMatchCheckCode =
  | 'identity'
  | 'registry_current_version'
  | 'frozen_active_status'
  | 'review_validation_traceability'
  | 'target_ability'
  | 'task_role'
  | 'difficulty'
  | 'material_novelty'
  | 'recent_duplication'
  | 'rubric_validation_goal'
  | 'required_capability'
  | 'hint_policy';

type ResourceConstraintCheck = {
  code: AdaptiveConstraintCode | ResourceMatchCheckCode;
  kind: 'hard_constraint' | 'soft_preference' | 'safety_gate';
  passed: boolean;
  expected: string | string[] | boolean;
  actual?: string | string[] | boolean;
  source: 'strategy' | 'quality' | 'conflict' | 'registry' | 'resource' | 'history';
  reason: string;
};
```

### 2. ResourceCandidateMatchEvaluation

```ts
type ResourceCandidateMatchStatus =
  | 'eligible_match'
  | 'partial_match'
  | 'rejected'
  | 'review_required';

type ResourceCandidateMatchEvaluation = {
  candidateEvaluationId: string;
  candidateId: string;

  resourceId: string;
  resourceVersionId: string;
  taskId: string;
  materialId?: string;

  status: ResourceCandidateMatchStatus;

  checks: {
    identityAligned: boolean;
    registryCurrentVersion: boolean;
    resourceFrozenAndActive: boolean;
    reviewAndValidationTraceable: boolean;
    targetAbilityAligned: boolean;
    taskRoleAligned: boolean;
    difficultyAllowed: boolean;
    materialNoveltySatisfied: boolean;
    recentDuplicationAvoided: boolean;
    rubricSupportsValidationGoal: boolean;
    requiredCapabilitiesSatisfied: boolean;
    hintPolicySupported: boolean;
  };

  constraintChecks: ResourceConstraintCheck[];
  satisfiedConstraints: string[];
  unmetHardConstraints: string[];
  unmetSoftPreferences: string[];
  reasons: string[];
  limitations: string[];

  canBeSelected: boolean;
};
```

### 3. StructuredResourceGap

```ts
type StructuredResourceGap = {
  resourceGapId: string;
  studentId: string;
  taskRequestId: string;
  fulfillmentRequestId: string;
  constraintsId: string;
  targetAbilityId: string;
  taskRole: RecommendedTaskRole;
  validationGoal: string;

  missingConditions: string[];
  rejectedResourceVersionIds: string[];
  partialCandidateVersionIds: string[];
  reviewRequiredVersionIds: string[];

  nextAction:
    | 'prepare_resource'
    | 'revise_resource_metadata'
    | 'human_review'
    | 'regenerate_strategy'
    | 'stop';

  createdAt: string;
};
```

StructuredResourceGap 是内容供给缺口，不是学生能力结论，也不自动触发 LLM 出题。

### 4. ResourceMatchQualityEvaluation

```ts
type ResourceMatchQualityStatus =
  | 'matched'
  | 'partial_match'
  | 'no_match'
  | 'review_required';

type ResourceMatchQualityEvaluation = {
  evaluationId: string;

  studentId: string;
  strategyId: string;
  taskRequestId: string;
  fulfillmentRequestId: string;
  adaptiveEnvelopeId: string;
  constraintsId: string;

  targetAbilityId: string;
  taskRole: RecommendedTaskRole;
  validationGoal: string;

  fulfillmentInvoked: boolean;
  existingMatchResult?: TaskResourceMatchResult;
  candidateEvaluations: ResourceCandidateMatchEvaluation[];

  status: ResourceMatchQualityStatus;

  selectedResourceId?: string;
  selectedResourceVersionId?: string;
  selectedTaskId?: string;
  selectedMaterialId?: string;

  selectionReasons: string[];
  unmetConstraints: string[];
  unmetPreferences: string[];
  issues: string[];
  limitations: string[];

  resourceGap?: StructuredResourceGap;

  canCreateExecutableTask: boolean;
  nextStep:
    | 'create_executable_task'
    | 'prepare_resource'
    | 'human_review'
    | 'regenerate_strategy'
    | 'stop';

  policyVersion: string;
  evaluatedAt: string;

  validation: {
    passed: boolean;
    issues: string[];
  };
};

type ResourceMatchQualityResult = {
  status: 'completed' | 'blocked';
  coreEligibility: CoreResourceEligibilityResult;
  evaluation: ResourceMatchQualityEvaluation | null;
  issues: string[];
};
```

分支规则：

- Core status = `eligible`：调用 Existing TaskFulfillment，再生成最终 Quality Evaluation；
- Core status = `no_eligible_resource`：不调用 Existing TaskFulfillment，直接形成 `no_match` 与 StructuredResourceGap；
- Core status = `review_required`：不调用 Existing TaskFulfillment，形成最终 `review_required`；
- Core status = `blocked`：不生成正式 Quality Evaluation，外层 Result 返回 `blocked`。

不得为了填充 `existingMatchResult` 而伪造 Existing TaskFulfillment 已运行。

## 九、匹配维度

### 1. 身份与版本

必须检查：

- Registry Entry 存在；
- `currentFrozenVersionId = resourceVersionId`；
- Frozen Version status = `frozen`；
- Registry status = `active`；
- Validation / Review 身份完整；
- Resource、Version、Task、Material ID 不错位；
- sourceDraftId、reviewId、validationId 可追溯；
- 同一 resourceId 不存在两个 current frozen version。

版本或 Registry 关系不可信时进入 `review_required`，不得降级为普通 no match。

### 2. 目标能力

`FrozenQuestionResourceVersion.abilityMetadata.abilityId` 必须与 `TaskRequest.targetAbilityId` 一致。

supporting ability 相同不能替代 primary target ability 对齐。

### 3. Task Role

资源 `abilityMetadata.taskRole` 必须与正式 TaskRequest / Constraints 推荐角色一致。

例如：

- training 资源不能直接替代 independent retest；
- retest 资源不能因能力相同被当作普通 training；
- transfer 必须满足材料与情境变化要求；
- diagnosis / observation 不得伪装为已确定的训练任务。

### 4. Difficulty

difficulty 必须使用受控枚举和确定性映射，不比较自然语言。

规则：

- `decrease` 只能选择当前基线以下或明确 lower 的资源；
- `maintain` 选择同一难度范围；
- `increase` 只有 Strategy 和 Constraints 明确允许时才可选择更高难度；
- requireKnownDifficulty = true 时，难度未知直接阻断；
- 不得因为没有匹配资源自动提高或降低难度。

### 5. Material Novelty

`same_context / similar_context / new_context` 必须基于可验证 Material 身份和受控 Metadata。

最低规则：

- new_context：materialId 不得出现在 recentMaterialIds；
- exclude_material：命中排除列表即拒绝；
- same_context：必须能追溯到允许复用的同一 Material；
- similar_context：必须有正式相似关系或受控分类支持，不能只因标题相似推断；
- 无 materialId 且任务要求材料新颖度时进入 `review_required` 或 `partial_match`，不能默认新材料。

### 6. 近期重复

至少检查：

- taskId；
- resourceId；
- resourceVersionId；
- materialId；
- executionSessionId。

同一题新建版本不自动等于新任务；只有内容变化和版本关系足以支持时，才可以重新参与匹配。

### 7. Rubric 与 Validation Goal

匹配 Agent 不重新编写 Rubric，也不重新解释学生能力。

必须检查：

- Rubric 至少有一个与 target ability 对齐的 critical / required item；
- Rubric 的 observable requirement 能支持 validationGoal；
- independent / transfer / delayed validation 所需条件没有被 Rubric 缺口破坏；
- MinimumAnswerRequirement 与 responseFormat 相容；
- Rubric 不是空对象或只有展示文本。

若 Rubric 存在但无法支持当前 validationGoal，应进入 `partial_match` 或 `review_required`，不得判 matched。

### 8. Hint Policy 与 Capabilities

任务准备只能证明“任务设计支持某种提示策略”，不能保证学生实际无提示完成。

例如：

- no_hint 任务不得依赖必需提示才能理解题意；
- limited_hint 需要受控提示能力；
- requiredCapabilities 必须全部由资源或执行器正式支持；
- 执行后的 usedHint / hintCount 仍由 Phase 14.1 重新评估 Evidence 质量。

## 十、硬约束与软偏好

### Safety Gate

以下条件属于不可放宽的安全 Gate：

- 身份一致；
- Registry current version；
- Frozen / active 状态；
- Validation / Review 可追溯；
- target ability 对齐；
- task role 对齐；
- Adaptive Envelope 合法；
- excluded task / material 未命中；
- Rubric 足以支持 Diagnosis 和 validationGoal。

任一失败都不能生成 ExecutableLearningTask。

### Hard Constraint

`AdaptiveTaskConstraints.hardConstraints` 必须逐条确定性执行。

任一 hard constraint 不满足：

- candidate 不可被选中；
- 若存在接近资源，可进入 `partial_match`；
- 若没有最低对齐候选，进入 `no_match`；
- 不得静默转为 soft preference。

### Soft Preference

soft preference 不满足时，第一版默认：

- 记录 unmet preference；
- 输出 `partial_match`；
- 不自动执行；
- 由人工复核或补充资源处理。

Phase 16.2 第一版不实现“偏好打分后自动选择较差候选”。

## 十一、四类结果的确定性定义

### matched

只有同时满足以下条件才输出：

1. 输入与身份校验通过；
2. Registry 和版本状态可信；
3. Existing TaskFulfillment 为 matched；
4. selectedTaskId 可追溯到同一 candidate；
5. 全部 safety gate 通过；
6. 全部 hard constraints 通过；
7. 第一版全部 active soft preferences 通过；
8. 全部 requiredCapabilities 通过；
9. preExecutionQualityConditions 通过；
10. 无影响最终选择的 review_required 问题；
11. 只有一个确定性最终选择。

`matched -> canCreateExecutableTask = true`。

### partial_match

满足以下特征：

- 资源身份、版本、能力和角色基本有效；
- 存在至少一个正式候选；
- 但一个或多个 hard condition / soft preference / pre-execution condition 未满足；
- 当前事实足以解释差距，不需要先修复身份或版本异常。

`partial_match -> canCreateExecutableTask = false`。

### no_match

满足以下特征：

- 输入和资源池本身可信；
- 没有任何候选达到最低能力与角色对齐条件；
- 或所有候选都被明确约束排除；
- 不存在需要人工确认的身份、版本或 Metadata 冲突。

必须生成 `StructuredResourceGap`。

### review_required

以下情况进入 review：

- Registry 指向不存在的版本；
- 同一 resourceId 出现多个 current frozen version；
- Validation / Review 身份错位；
- Resource Metadata 自相矛盾；
- material novelty 无法可靠判断；
- Rubric 是否支持 validationGoal 无法确定；
- Existing Match selectedTaskId 与质量候选不一致；
- 多个候选在确定性规则下无法唯一选择；
- 关键输入版本不兼容。

`review_required` 不是 `no_match`，不得自动生成 TaskGenerationRequest 或 ExecutableLearningTask。

候选级与整体级 review 必须区分：

- 单个候选存在可隔离问题，且另一个候选完整满足全部条件时，可隔离问题候选并继续选择合法候选；
- Registry 全局一致性失败、Existing selected candidate 需要复核、或问题会影响最终候选唯一性时，整体结果必须是 `review_required`；
- 被隔离候选及其原因必须保留在 candidateEvaluations 和 issues 中，不能静默忽略。

## 十二、候选选择规则

Phase 16.2 第一版不做复杂推荐排序。

选择顺序必须是确定性的：

1. 先过滤所有不具备正式资格的资源；
2. 再执行 safety gate；
3. 再执行 hard constraints；
4. 再执行 required capabilities 和 pre-execution conditions；
5. 最后比较 soft preferences；
6. 若多个候选完全等价，使用稳定 tie-breaker；
7. tie-breaker 至少基于 resourceVersionId / taskId 的稳定排序，不使用输入数组顺序；
8. 任何排序都不能越过 hard constraint。

输入数组顺序变化不得改变最终结果。

## 十三、与 Existing TaskFulfillment 的接入方式

推荐执行顺序：

```text
Frozen Resources + Registry
-> Reviewed Candidate Adapter
-> Eligible AvailableTaskResource View
-> Existing TaskFulfillment
-> Existing TaskResourceMatchResult
-> Resource Match Quality Gate
-> Accepted Match or Blocked Branch
```

接入规则：

1. Existing TaskFulfillment 继续负责现有请求标准化和初步资源匹配；
2. Phase 16.2 不修改 Existing TaskResourceMatchResult 的冻结语义；
3. `ResourceMatchQualityEvaluation` 是正式执行前的最终质量 Gate；
4. Existing `matched` 不自动等于 Phase 16.2 `matched`；
5. selectedTaskId 必须映射到 accepted selectedResourceVersionId；
6. 最终 ExecutableLearningTask 必须保留 resourceId、resourceVersionId、taskId、materialId、TaskRequest 和 Constraints 的追溯关系；
7. Existing no_match 可以形成 StructuredResourceGap，但不自动触发真实 LLM 出题；
8. Existing partial_match 不得被 Phase 16.2 升级为 matched，除非全部正式条件实际通过且原结果错误进入 review；第一版默认进入 review，不自动纠正。

## 十四、ExecutableLearningTask 放行要求

创建任务前必须确认：

```text
qualityEvaluation.status = matched
qualityEvaluation.canCreateExecutableTask = true
qualityEvaluation.validation.passed = true
selected resource version remains current and frozen
```

ExecutableLearningTask 至少保留：

- sourceTaskId；
- sourceTaskRequestId；
- sourceFulfillmentRequestId；
- sourceStrategyId；
- resourceId；
- resourceVersionId；
- materialId / materialVersionId（如有）；
- constraintsId；
- resourceMatchQualityEvaluationId；
- limitations。

如果 Existing ExecutableLearningTask Schema 暂无这些顶层字段，可以通过版本化 Trace Envelope 保留，不应把追溯信息压缩成不可解析的自然语言。

## 十五、稳定 ID 与幂等

至少保证：

- 相同正式输入重复运行产生同一 evaluationId；
- input array 顺序变化不改变 evaluationId 和 selected version；
- 同一 resourceId 的新 version 必须产生新的 candidateId；
- superseded version 不得因缓存再次进入候选；
- 同一 quality evaluation 不重复创建多个 ExecutableLearningTask；
- 页面刷新不得改变匹配事实；
- Registry 在匹配后、任务创建前发生变化时必须重新校验；
- 历史 evaluation 不被新版本静默覆盖。

evaluationId 至少基于：

```text
taskRequestId
+ fulfillmentRequestId
+ constraintsId
+ registry snapshot identity
+ candidate resourceVersionIds
+ recent history identity
+ policyVersion
```

## 十六、人工复核边界

Human Review 可以：

- 确认 Metadata 是否足以判断；
- 退回资源修订；
- 标记资源当前不适合该 validationGoal；
- 纠正错误的相似材料关系；
- 请求补充 Rubric 或匹配 Metadata；
- 形成新的 Review Decision 或资源版本。

Human Review 不可以：

- 静默修改 Frozen Version；
- 绕过 hard constraint 强行放行；
- 把 partial_match 直接改写成 matched 而不留下正式依据；
- 修改 Student Profile 或 Evidence；
- 把“资源不足”解释成“学生能力不足”。

## 十七、失败与防御分支

以下情况必须阻断：

1. Adaptive Envelope 非法；
2. TaskRequest / FulfillmentRequest ID 错位；
3. studentId、abilityId、taskRole 或 validationGoal 不一致；
4. Constraints ID 不一致；
5. Registry Entry 缺失或不一致；
6. Frozen Version 非 current；
7. Resource status 为 superseded / retired；
8. Validation / Review 不可追溯；
9. Draft 混入正式资源池；
10. Rubric 不支持目标能力或 validationGoal；
11. hard constraint 未满足；
12. material novelty 无法证明；
13. 命中 recent task / material exclusion；
14. Existing selectedTaskId 无法映射到 Frozen Version；
15. 多个 current version 或重复身份冲突；
16. 输出 Schema 非法；
17. 匹配后 Registry 发生变化；
18. review_required 仍尝试创建 ExecutableLearningTask。

失败时不得：

- 自动改写 Strategy；
- 自动降低质量目标；
- 自动切换目标能力；
- 自动放宽材料新颖度；
- 生成未经审核的新题；
- 生成 AbilityEvidence；
- 修改 Profile 或 GrowthMemory。

## 十八、建议新增工程文件

```text
src/ai/schemas/resourceMatchQuality.schema.ts
src/ai/agents/reviewedResourceCandidateAdapter.ts
src/ai/agents/coreResourceEligibilityAgent.ts
src/ai/agents/resourceMatchQualityAgent.ts
src/ai/tests/runCoreResourceEligibilityDebug.ts
src/ai/tests/runResourceMatchQualityDebug.ts
```

可选轻量 Demo：

```text
src/api/resourceMatchQualityDemo.ts
src/pages/ResourceMatchQualityDemo.jsx
```

新增命令：

```text
pnpm run debug:core-resource-eligibility
pnpm run debug:resource-match-quality
```

Phase 16.2 不新建第二套资源 Repository，优先复用 Phase 16.1 `QuestionResourceAdmissionRepository` 查询 Registry 与 Frozen Versions。

## 十九、Debug 最小流程

### 16.2A Debug 流程

1. 准备合法 AdaptiveTaskRequestEnvelope；
2. 生成或读取 TaskFulfillmentRequest；
3. 从 Phase 16.1 Repository 查询 Registry 与 Frozen Versions；
4. 校验 Envelope、Request、Constraints 和资源身份；
5. 生成 ReviewedResourceMatchCandidate[]；
6. 过滤 Draft、superseded、retired 和 non-current 资源；
7. 校验 ability、taskRole、difficulty 和 Rubric；
8. 生成 CoreResourceCandidateEvaluation[]；
9. 生成 CoreResourceEligibilityResult；
10. 验证 canEnterExistingTaskFulfillment；
11. 重复运行检查稳定 ID；
12. 输出 16.2A PASS / FAIL。

### 16.2B Debug 流程

1. 消费通过的 CoreResourceEligibilityResult；
2. 准备 Recent Task / Material History；
3. 调用 Existing TaskFulfillment；
4. 读取 TaskResourceMatchResult；
5. 检查 material novelty、重复、hint policy、capabilities 和 soft preferences；
6. 生成 ResourceCandidateMatchEvaluation[]；
7. 生成 ResourceMatchQualityEvaluation；
8. matched 时创建或验证 ExecutableLearningTask；
9. partial / no match 时生成 StructuredResourceGap；
10. review_required 时验证阻断；
11. 创建任务前重新校验 Registry；
12. 重复运行检查最终 ID 与幂等；
13. 回归全部 16.2A Cases；
14. 输出 16.2B / Phase 16.2 PASS / FAIL。

## 二十、Debug Report

至少输出：

```text
Resource Match Quality Debug Report

Request:
- strategyId
- taskRequestId
- fulfillmentRequestId
- adaptiveEnvelopeId
- constraintsId
- studentId
- targetAbilityId
- taskRole
- validationGoal

Resource Pool:
- registryEntryCount
- frozenVersionCount
- eligibleCandidateCount
- excludedVersionIds
- recentTaskIds
- recentMaterialIds

Core Eligibility:
- eligibilityResultId
- status
- eligibleCandidateIds
- rejectedCandidateIds
- reviewRequiredCandidateIds
- canEnterExistingTaskFulfillment
- issues

Existing Match:
- status
- matchedTaskIds
- selectedTaskId
- unmetConstraints
- unmetPreferences

Quality Evaluation:
- evaluationId
- status
- selectedResourceId
- selectedResourceVersionId
- selectedTaskId
- selectedMaterialId
- satisfiedConstraints
- unmetHardConstraints
- unmetSoftPreferences
- selectionReasons
- limitations
- canCreateExecutableTask
- nextStep

Resource Gap:
- missingConditions
- partialCandidateVersionIds
- reviewRequiredVersionIds
- nextAction

Validation:
- passed
- issues
- executableTaskCreated
- idempotent
- PASS / FAIL
```

## 二十一、最小 Debug Case

### 16.2A Core Eligibility Cases

#### Case A1：合法 current frozen resource

- Envelope、Registry、Review、Validation、ability、role、difficulty 和 Rubric 全部通过；
- candidate status = eligible；
- canEnterExistingTaskFulfillment = true；
- 不提前输出最终 matched。

#### Case A2：能力相同但 Task Role 错误

- ability 对齐；
- training 请求只有 retest 资源；
- candidate rejected；
- 不进入 Existing TaskFulfillment。

#### Case A3：能力只存在于 supporting ability

- primary ability 不一致；
- 不得把 supporting ability 当作 target ability；
- candidate rejected。

#### Case A4：难度不满足核心范围

- Strategy 要求 maintain；
- 资源为不允许的更高难度；
- 不得静默提高难度；
- candidate rejected。

#### Case A5：Rubric 不支持 validationGoal

- ability 标签相同；
- Rubric 缺少必要可观察项；
- rejected / review_required；
- 不进入 Existing TaskFulfillment。

#### Case A6：Draft 混入资源池

- Draft 被隔离；
- 不得适配为 AvailableTaskResource。

#### Case A7：superseded version

- Registry current 指向 v2；
- 资源池包含 v1 superseded；
- v1 不参与匹配。

#### Case A8：retired resource

- Registry 或 Version retired；
- 不参与正式匹配。

#### Case A9：Registry 指向不存在版本

- Core status = review_required；
- 不降级为 no eligible resource。

#### Case A10：两个 current frozen version

- Registry / Repository 一致性失败；
- Core status = review_required。

#### Case A11：Review / Validation 身份错位

- reviewId 或 validationId 不属于该版本；
- candidate review_required；
- 不进入 eligible view。

#### Case A12：Adaptive Envelope 错位

- constraintsId / strategyId / studentId 任一不一致；
- Core status = blocked；
- 不生成候选，不调用 Existing TaskFulfillment。

### 16.2B Context-sensitive Match Cases

#### Case B1：全部约束匹配

- 消费 16.2A eligible result；
- novelty、history、capability、hint 和 preference 全部通过；
- Existing Match = matched；
- Quality = matched；
- 可以创建 ExecutableLearningTask。

#### Case B2：new context 命中近期材料

- materialId 在 recentMaterialIds；
- material novelty hard constraint 失败；
- partial_match / no_match；
- 不得执行。

#### Case B3：exclude task 命中

- taskId 在排除列表；
- candidate rejected；
- 不得放宽约束。

#### Case B4：soft preference 未满足

- safety gate 和 hard constraints 通过；
- soft preference 未满足；
- 第一版输出 partial_match；
- 不自动执行。

#### Case B5：无候选资源

- Core 输入可信但没有可用上下文候选；
- no_match；
- 生成 StructuredResourceGap。

#### Case B6：Existing matched 但质量 Gate 失败

- Existing selectedTaskId 命中；
- 上下文约束或正式追溯不满足；
- Phase 16.2 不得输出 matched。

#### Case B7：Existing selectedTaskId 无法映射

- review_required；
- 不创建任务。

#### Case B8：多个完全等价候选

- 使用稳定 tie-breaker；
- 输入顺序变化不改变选择。

#### Case B9：同一输入重复运行

- evaluationId 稳定；
- selected version 稳定；
- 不重复创建 ExecutableLearningTask。

#### Case B10：匹配后 Registry 改变

- selected version 在任务创建前被 supersede；
- 重新校验失败；
- 阻断执行。

#### Case B11：materialId 缺失但要求新材料

- 不得默认认定 new context；
- partial_match / review_required。

#### Case B12：相似材料关系无法证明

- 标题相似但无正式 Metadata；
- 不得自行推断 similar_context；
- review_required。

#### Case B13：required capability 缺失

- 资源不支持正式要求；
- 不得 matched。

#### Case B14：匹配成功不影响教育状态

- matched 后未发生学生作答；
- 不生成 Diagnosis、Evidence、ProfileUpdateDecision 或 GrowthMemory。

### Phase 16.2 Integration Cases

#### Case I1：完整 A -> B 正常路径

- Frozen Resource 先通过 16.2A；
- 同一 candidate view 进入 Existing TaskFulfillment；
- 16.2B 输出唯一 matched；
- ExecutableLearningTask 保留完整资源版本追溯。

#### Case I2：任务执行后实际质量不达目标

- Constraints targetEvidenceQuality = high；
- 任务设计匹配成功；
- 学生实际使用提示或回答无效；
- Phase 14.1 根据真实执行重新评估；
- 不反向修改旧 Eligibility 或 Match Evaluation。

最终验收至少覆盖 `12` 个 16.2A Case、`14` 个 16.2B Case 和 `2` 个集成 Case。实现可使用表驱动测试，但不得用减少 Case 的方式省略身份、版本、Rubric、上下文和幂等边界。

## 二十二、轻量 Demo 验收

Phase 16.2 建议接入独立开发者 / 内容审核 Demo，不直接放入学生主体验区。

页面最小展示：

1. 当前 TaskRequest 摘要；
2. target ability、task role、difficulty、material novelty、hint policy；
3. 可参与匹配的 Frozen Resources；
4. 每个候选满足与未满足的条件；
5. 最终 matched / partial / no match / review required；
6. matched 时的 Student Task Preview；
7. no match 时的结构化资源缺口；
8. 独立开发者折叠信息。

人工 Demo 至少验证：

- 完全匹配；
- 能力相同但角色不匹配；
- new context 避免近期材料；
- superseded version 被排除；
- Rubric 不足阻断；
- no match 形成资源缺口；
- review_required 不生成任务；
- 页面不需要阅读 Raw JSON 才能理解匹配原因。

2026-07-20 Demo Acceptance：`PASS`

- 独立路由：`/#/resource-matching-quality-demo`；
- 8 个可切换 Case 全部显示“符合预期”；
- 正式资源匹配：16.2A `eligible`、16.2B `matched`、ExecutableLearningTask 成功放行；
- 近期任务重复：`partial_match`，不生成可执行任务；
- primary ability 错位：`no_match`，supporting ability 不替代 primary ability；
- task role 错位：`no_match`，不静默改写 Strategy 或资源角色；
- required capability 缺失：`partial_match`，不放宽硬约束；
- Registry 指向异常：`review_required`，不猜测使用旧版本；
- retired resource：`no_match`，不重新进入执行链；
- 匹配后 Registry 切换版本：匹配结果不被继续使用，任务创建阶段再次校验并阻断；
- 页面主区域能够直接理解 TaskRequest、核心资格、上下文匹配、放行或阻断原因，Raw Runtime 仅存在于开发者折叠区；
- 1366 x 768 PC 与 820 x 1180 平板视口无页面级横向溢出、文字裁切或控件重叠；
- 页面运行无 Console Error；Production Build PASS。

该 Demo 是开发者 / 内容审核验收入口，不是学生主体验页。验收通过证明匹配分支、解释和阻断行为可被人工理解，不证明匹配策略具有长期教学效果。

### Phase 16.1 -> 16.2 Integration Debug

2026-07-20 Integration Smoke：`5 / 5 PASS`

1. Phase 16.1 Repository 创建、校验、审核并冻结的正式资源可被 16.2A / 16.2B 直接消费；
2. 新 Frozen Version 原子替换 Registry head，旧版本转为 superseded 且不再进入 eligible pool；
3. 匹配完成后 Registry 再次变化时，ExecutableLearningTask 创建会阻断旧选择；
4. 正式资源与 TaskRequest 不匹配时形成 StructuredResourceGap，不生成任务；
5. 重复 Freeze、Snapshot 和 Match Evaluation 保持幂等，不产生重复版本或变化的正式 ID。

首次联调发现并修正一项真实版本交接偏差：历史 superseded 版本不应使用 Registry 当前 head 的 latest Review / Validation ID 进行自身追溯校验；当前版本继续要求与 Registry latest IDs 对齐，历史版本使用自身冻结记录中的 Review / Validation 链完成追溯，并因 non-current / superseded 状态被确定性拒绝。修正后 Phase 16.1 `22 / 22`、16.2A `12 / 12`、16.2B `16 / 16`、14.3 `26 / 26` 和 Production Build 全部通过。

### Phase 16.1 -> 16.2 人工联调入口

2026-07-20 已在 `/#/resource-matching-quality-demo` 增加“16.1 -> 16.2 联调”模式。该入口不使用展示层拼装的替代 Snapshot，而是在浏览器运行时内依次执行 Material / Draft 创建、Validation、Review、Freeze、Repository Snapshot、16.2A Eligibility、16.2B Match Quality 和 Executable Task Gate。

入口覆盖：

1. 正式资源完整交接并生成学生题目预览；
2. v2 冻结后 v1 superseded，仅 Registry 当前版本可执行；
3. 匹配后 Registry 变化，旧选择在任务创建前被阻断；
4. 正式资源与目标能力不匹配，形成 Resource Gap 且不展示学生任务。

浏览器自动 Smoke 为 `4 / 4 PASS`，PC `1280 x 800` 与平板 `1024 x 768` 无页面级横向溢出，Console Error 为 `0`，Production Build PASS。

2026-07-20 人工联调验收：`PASS`

- Case 1 正式资源完整交接：正常放行；
- Case 2 正式版本切换：仅 v2 正常放行；
- Case 3 Registry 变化：原匹配结果因当前正式版本变化被安全阻断；
- Case 4 无合适正式资源：主要能力错位候选被拒绝，形成 Resource Gap，不创建学生任务。

人工验收同时确认主区域能够直接展示“当前任务需要 / 候选资源能力 / 核心校验结论 / 候选资源处理 / 最终任务 / 下一步”，无需依赖 Raw JSON 即可证明系统没有使用能力错位资源凑匹配。

学生端不得展示：

- 内部 resource / version / constraints ID；
- Registry 一致性错误；
- Raw Match JSON；
- Rubric 内部结构；
- 开发者错误栈。

## 二十三、验收标准

### Phase 16.2A Checkpoint

16.2A 内部 Checkpoint 至少满足：

1. 能消费正式 AdaptiveTaskRequestEnvelope 与 TaskFulfillmentRequest；
2. 能校验 Request、Constraints、Registry 与 Frozen Version 身份；
3. Draft、superseded、retired 和 non-current version 被隔离；
4. 能生成 ReviewedResourceMatchCandidate；
5. 能生成 CoreResourceCandidateEvaluation；
6. 能生成 CoreResourceEligibilityResult；
7. primary ability、task role、difficulty 与 Rubric Gate 生效；
8. eligible candidate view 可被 Existing TaskFulfillment 消费；
9. review_required / blocked 不进入 Existing TaskFulfillment；
10. 相同输入产生稳定 eligibilityResultId；
11. 12 个 16.2A Cases 全部 PASS；
12. Phase 16.1 和 Phase 14.3 关键回归通过。

16.2A Checkpoint 只能标记为 `PASS / NOT FROZEN`，不能修改 Phase 16.2 Overall 状态，也不能单独进入 Phase 16.3。

### Phase 16.2 Unified Acceptance

Phase 16.2 PASS 必须满足：

1. 能消费正式 AdaptiveTaskRequestEnvelope；
2. 能校验 TaskRequest、FulfillmentRequest 和 Constraints 身份；
3. 能从 Phase 16.1 Repository 查询 Registry 与 Frozen Versions；
4. Draft 不进入正式资源候选；
5. superseded / retired / non-current version 不进入 eligible pool；
6. 能生成 ReviewedResourceMatchCandidate；
7. Candidate Metadata 不依赖自由文本猜测；
8. 能复用 Existing TaskFulfillment；
9. Existing Match Result 不被重定义；
10. 能生成 ResourceCandidateMatchEvaluation；
11. 能生成 ResourceMatchQualityEvaluation；
12. 能稳定输出 matched / partial_match / no_match / review_required；
13. matched 必须满足全部 safety gate；
14. matched 必须满足全部 hard constraints；
15. matched 必须满足 requiredCapabilities；
16. matched 必须有唯一、可追溯 selected resource version；
17. partial_match 不自动生成 ExecutableLearningTask；
18. no_match 生成 StructuredResourceGap；
19. review_required 不自动生成任务或生成请求；
20. target ability 必须与资源 primary ability 对齐；
21. task role 必须对齐；
22. difficulty 规则可确定性执行；
23. material novelty 可以由正式身份验证；
24. recent task / material exclusion 生效；
25. Rubric 足以支持 validationGoal；
26. hint policy 与 capability 条件被检查；
27. 不静默放宽 AdaptiveTaskConstraints；
28. 不修改 NextLearningStrategy；
29. 不修改 FrozenQuestionResource；
30. ExecutableLearningTask 保留完整资源版本追溯；
31. 相同输入重复运行保持幂等；
32. 输入数组顺序变化不影响结果；
33. Registry 变化可在执行前阻断旧选择；
34. 匹配过程不生成 Diagnosis 或 Evidence；
35. Debug 至少覆盖 12 个 16.2A Case、14 个 16.2B Case 和 2 个集成 Case；
36. Debug 输出 PASS；
37. Phase 8.4、14.3、16.1 关键回归通过；
38. Production Build 通过；
39. 轻量 Demo 人工验收通过；
40. 文档和 SYSTEM_MAP 同步。

## 二十四、本阶段不做

Phase 16.2 不做：

- 不重定义 NextLearningStrategy；
- 不重定义 TaskRequest；
- 不重定义 AdaptiveTaskConstraints；
- 不重写 Existing TaskFulfillment；
- 不修改 Frozen Resource 内容；
- 不让 Draft 进入正式匹配；
- 不做复杂推荐排序；
- 不做机器学习匹配模型；
- 不做题目难度自动校准；
- 不做资源使用效果统计；
- 不做自动 LLM 出题与发布；
- 不做批量题库导入；
- 不做教师权限系统；
- 不做多人审核；
- 不做云端题库；
- 不生成 Diagnosis；
- 不生成 AbilityEvidence；
- 不更新 Student Profile；
- 不执行 5—7 天真实学习；
- 不证明匹配资源具有教学效果。

## 二十五、建议工程顺序

```text
Phase 16.2A
1. 冻结共享 Schema、内部交接对象和状态语义
2. 实现 Reviewed Resource Candidate Adapter
3. 实现输入身份和 Registry Snapshot 校验
4. 实现 ability / role / difficulty / rubric Core Gate
5. 实现 CoreResourceEligibilityResult
6. 完成 12 个 16.2A Deterministic Cases
7. 回归 Phase 16.1 / 14.3
8. 记录 16.2A PASS / NOT FROZEN Checkpoint

Phase 16.2B
9. 接入 Existing TaskFulfillment
10. 实现 material / history / hint / capability / preference checks
11. 实现 ResourceMatchQualityAgent 与 StructuredResourceGap
12. 实现稳定选择、Registry 二次校验与最终幂等
13. 完成 14 个 16.2B Cases 和 2 个集成 Cases
14. 统一回归全部 16.2A Cases
15. 回归 Phase 8.4 / 14.3 / 16.1
16. 接入轻量 Match Review Demo
17. 人工验收与 Production Build
18. 记录 Phase 16.2 PASS / FROZEN
```

## 二十六、阶段完成后的准确能力

Phase 16.2 完成后，系统可以宣称：

> 正式 TaskRequest 能够从审核有效的当前 Frozen Resources 中获得可解释、可追溯、可阻断的资源匹配结果；只有满足身份、版本、能力、任务角色、难度、材料新颖度、近期重复、Rubric 和 Adaptive Constraints 的资源，才能形成可执行学习任务。

不能宣称：

- 已经证明匹配策略具有教学效果；
- 已具备大型题库；
- 已能自动生成缺失题目；
- 已完成真实多日学习验证；
- 已具备复杂推荐算法；
- 已具备教师内容运营后台。

Phase 16.2 的最终交接对象是：

```text
ResourceMatchQualityEvaluation
+ Accepted Frozen Resource Version
+ ExecutableLearningTask / StructuredResourceGap
```

Phase 16.3 将继续消费这些正式结果，验证真实题目、真实 AI、跨日恢复、延迟复测和下一任务能否连续运行 5—7 个自然日。
