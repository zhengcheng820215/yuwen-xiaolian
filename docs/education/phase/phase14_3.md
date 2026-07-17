# Phase 14.3：Adaptive Task Constraints 最小闭环（受控自适应任务约束）

设计状态：ACCEPTED
工程状态：PASS
专项 Debug：26 / 26 PASS
Production Build：PASS

Phase 14 总体集成冻结：PASS / FROZEN（Case 27：16 / 16 PASS）

## 工程验收记录

Phase 14.3 已完成：

- `adaptiveTaskConstraints.schema.ts`；
- `adaptiveTaskContextAdapter.ts`；
- `adaptiveTaskConstraintsAgent.ts`；
- `strategyConstraintAlignmentAgent.ts`；
- `adaptiveTaskRequestEnvelopeAgent.ts`；
- Existing `taskFulfillmentRequestAgent.ts` 的 Adaptive 结构化入口；
- `runAdaptiveTaskConstraintsDebug.ts`；
- `debug:adaptive-task-constraints`。

验收结果：

- Phase 14.3 专项 Debug：26 / 26 PASS；
- Phase 14.1 回归：17 / 17 PASS；
- Phase 14.2 回归：25 / 25 PASS；
- Existing Phase 8.3 / 8.4 回归：PASS；
- Phase 9.3、Phase 12 基础集成、Phase 13.3 回归：PASS；
- Production Build：PASS。

本记录证明 Phase 14.3 结构化约束 Runtime 成立。Phase 14 总体集成 Case 27 也已完成：有效但使用提示的作答正常回流 Evidence，并由 Phase 14.1 重新评估为 `low / limited`；占位回答在进入 Diagnosis 前阻断，不生成正式 Evidence。两条分支均未反向修改旧 Constraints。

## 一、阶段目标

Phase 14.3 只解决一个核心问题：

```text
在 Existing NextLearningStrategy 已经决定下一步学习方向后，
系统能否根据当前 Evidence 质量与冲突状态，
把下一任务需要满足的难度、材料、提示和观察条件表达为受控约束？
```

一句话定义：

> 在不改写 Existing NextLearningStrategy、不直接生成题目、不旁路 TaskRequest / TaskFulfillment 的前提下，把当前有效 EvidenceQualityAssessment 与 EvidenceConflictAssessment 转换为可校验、可追溯的 AdaptiveTaskConstraints。

Phase 14.3 不重新判断学生能力，不生成新的 Evidence，不更新 Profile，也不创建第二套学习策略。

## 二、阶段背景

Phase 14.1 已经完成：

```text
Formal AbilityEvidence
+ Formal Runtime Context
-> EvidenceQualityAssessment
```

它能够区分提示依赖、任务新颖度、即时与延迟观察、Diagnosis 可靠性和追溯完整性。

Phase 14.2 已经完成：

```text
AbilityEvidence[]
+ Current EvidenceQualityAssessment[]
+ Formal Comparison Context[]
-> EvidenceConflictAssessment
-> EvaluationContextEnvelope
```

它能够区分方向一致、条件差异可解释、未解决冲突、证据不足和需要复核。

但上述结果仍没有说明下一任务应该满足哪些观察条件。例如：

- 学生在有提示时表现较好，下一次是否应减少提示；
- 原题表现较好、迁移任务较弱，下一次是否应更换材料；
- 证据方向冲突，下一次是否应安排区分性观察；
- 当前只有一个有效观察，下一次是否应保持难度继续收集 Evidence；
- Strategy 已经要求降低难度时，Constraints 是否会错误升级难度。

Phase 14.3 为这些问题建立最小结构化约束。

## 三、阶段定位

Phase 14.3 位于 Existing Strategy 与 Task Request / Fulfillment 之间：

```text
Existing GrowthMemory / Profile
-> Existing NextLearningStrategy
-> Existing StrategyValidationResult
+ Current EvidenceQualityAssessment[]
+ EvidenceConflictAssessment
+ CurrentLearningContext
-> AdaptiveTaskContextSnapshot
-> AdaptiveTaskConstraints
-> StrategyConstraintAlignmentResult
-> Existing TaskRequest
-> AdaptiveTaskRequestEnvelope
-> Existing TaskFulfillmentRequest
-> TaskResource Matching / Task Generation Request
```

职责关系：

```text
NextLearningStrategy
= 决定下一步教育方向

AdaptiveTaskConstraints
= 在该方向内具体化观察条件

TaskRequest
= 形成正式任务请求

TaskFulfillment
= 匹配或请求真正的任务资源
```

Phase 14.3 不允许 Constraints 反向修改 Strategy。

## 四、最小链路

```text
Validated NextLearningStrategy
+ CurrentLearningContext
+ Current EvidenceQualityAssessment[]
+ EvidenceConflictAssessment
↓
Identity / Version / Traceability Validation
↓
AdaptiveTaskContextSnapshot Derivation
↓
Strategy Authority Check
↓
Constraint Derivation
↓
AdaptiveTaskConstraints
↓
Strategy / Constraints Alignment Validation
├─ aligned
│  ↓
│  Existing TaskRequest Agent
│  ↓
│  AdaptiveTaskRequestEnvelope
│  ↓
│  Existing TaskFulfillment Request Agent
│  ↓
│  TaskResource Matching / TaskGenerationRequest
│
├─ strategy_mismatch
│  ↓
│  regenerate_strategy
│
├─ review_required
│  ↓
│  human_review
│
└─ blocked
   ↓
   不生成正式 TaskRequest
```

本阶段到 Constraints 被 Existing TaskFulfillment 正确消费为止，不执行学生作答、Diagnosis 或 Evidence 回流。

## 五、输入

建议输入：

```ts
type AdaptiveTaskConstraintsInput = {
  strategy: NextLearningStrategy;
  strategyValidationResult: StrategyValidationResult;
  currentLearningContext: CurrentLearningContext;
  adaptiveTaskContext: AdaptiveTaskContextSnapshot;

  qualityAssessments: EvidenceQualityAssessment[];
  conflictAssessment: EvidenceConflictAssessment;

  generatedAt: string;
  timezone: string;
};
```

输入规则：

1. `strategy` 必须来自 Existing Phase 8 `NextLearningStrategyAgent`；
2. `strategyValidationResult` 必须来自 Existing `StrategyValidationAgent`；
3. Strategy Validation 未允许 `create_task_request` 时，不得生成可执行 Constraints；
4. `qualityAssessments` 只能使用 Phase 14.1 的当前有效版本；
5. `conflictAssessment` 必须来自 Phase 14.2 且 validation passed；
6. `AdaptiveTaskContextSnapshot` 必须从 Existing `CurrentLearningContext` 与正式任务 / 材料历史派生，不得替代或重定义 Existing Context；
7. Snapshot 的 `sourceLearningContextId` 必须等于输入 `currentLearningContext.contextId`；
8. studentId 与 targetAbilityId 必须在 Strategy、Context Snapshot、Quality Assessment 和 Conflict Assessment 间一致；
9. Conflict Assessment 引用的当前 Quality Assessment ID 必须能够在输入中唯一找到；
10. Strategy 的 Evidence Links 与 Conflict Assessment 的 Evidence Links 必须有正式交集；
11. 无交集时阻断，不得假设两者描述同一批学习事实；
12. 调用方不得直接传入 difficultyDirection、materialNovelty、hintPolicy 或 targetEvidenceQuality；
13. Agent 必须根据正式 Strategy、Context Snapshot、Quality 和 Conflict 状态派生 Constraints；
14. 输入顺序不得影响 Constraints ID 与最终约束。

### AdaptiveTaskContextSnapshot

Phase 14.3 不修改 Existing `CurrentLearningContext` Schema，而是建立只供任务约束使用的正式快照：

```ts
type AdaptiveTaskContextSnapshot = {
  contextId: string;
  studentId: string;
  targetAbilityId: string;

  currentDifficultyLevel?: string;
  recentTaskIds: string[];
  recentMaterialIds: string[];
  allowedTaskRoles: RecommendedTaskRole[];
  allowedHintPolicies: AdaptiveHintPolicy[];

  sourceLearningContextId: string;
  activeSessionId?: string;
  timezone: string;

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

权威顺序必须是：

```text
NextLearningStrategy
> AdaptiveTaskContextSnapshot
> AdaptiveTaskConstraints
```

Snapshot 可以基于当前运行条件阻断某类任务或提示方式，但不能修改 Strategy 已确认的 target ability、action、task role 或 validation goal。无法从正式 Context 与历史中确认的字段不得猜测；关键字段缺失时进入 `blocked` 或 `review_required`。

## 六、AdaptiveTaskConstraints Model

建议新增：

```ts
type AdaptiveLearningIntent =
  | 'foundation'
  | 'consolidation'
  | 'independent_validation'
  | 'delayed_validation'
  | 'transfer_validation'
  | 'diagnostic_observation'
  | 'discriminating_observation';

type AdaptiveObservationTarget =
  | 'strengthen_foundation'
  | 'recheck_weakness'
  | 'verify_independence'
  | 'verify_retention'
  | 'verify_transfer'
  | 'resolve_direction_conflict'
  | 'collect_comparable_evidence';

type AdaptiveDifficultyDirection =
  | 'decrease'
  | 'maintain'
  | 'increase';

type AdaptiveMaterialNovelty =
  | 'same_context'
  | 'similar_context'
  | 'new_context';

type AdaptiveHintPolicy =
  | 'allow_guidance'
  | 'limited_hint'
  | 'no_hint';

type AdaptiveTargetEvidenceQuality =
  | 'medium'
  | 'high';

type AdaptiveConstraintCode =
  | 'task_role'
  | 'target_ability'
  | 'difficulty'
  | 'material_novelty'
  | 'hint_policy'
  | 'exclude_task'
  | 'exclude_material'
  | 'required_capability';

type AdaptiveConstraintRule = {
  code: AdaptiveConstraintCode;
  operator: 'eq' | 'in' | 'exclude' | 'required';
  value: string | string[] | boolean;
  source: 'strategy' | 'quality' | 'conflict';
};

type PreExecutionQualityConditions = {
  requireNovelMaterial: boolean;
  requireKnownDifficulty: boolean;
  requireAbilityAlignment: boolean;
  requiredHintPolicy: AdaptiveHintPolicy;
  requireTraceability: boolean;
};

type AdaptiveTaskConstraints = {
  constraintsId: string;
  studentId: string;
  targetAbilityId: string;

  sourceStrategyId: string;
  sourceStrategyAction: NextLearningAction;
  sourceStrategyTaskRole: RecommendedTaskRole;
  sourceValidationGoal: string;

  sourceConflictAssessmentId: string;
  sourceQualityAssessmentIds: string[];
  sourceEvidenceIds: string[];
  sourceObservationUnitIds: string[];

  learningIntent: AdaptiveLearningIntent;
  observationTarget: AdaptiveObservationTarget;
  recommendedTaskRole: RecommendedTaskRole;
  difficultyDirection: AdaptiveDifficultyDirection;
  materialNovelty: AdaptiveMaterialNovelty;
  hintPolicy: AdaptiveHintPolicy;
  targetEvidenceQuality: AdaptiveTargetEvidenceQuality;
  preExecutionQualityConditions: PreExecutionQualityConditions;

  requiredCapabilities: string[];
  hardConstraints: AdaptiveConstraintRule[];
  softPreferences: AdaptiveConstraintRule[];

  reasons: string[];
  limitations: string[];

  schemaVersion: 'adaptive_task_constraints_v1';
  policyVersion: 'adaptive_task_constraints_policy_v1';
  generatedAt: string;

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

### 字段职责

`learningIntent`：

说明本次任务为什么存在，不替代 Strategy action。

`observationTarget`：

说明下一任务希望减少哪一种不确定性，不表示学生能力状态。

`recommendedTaskRole`：

必须复制并服从 Strategy 已确认的 `recommendedTaskRole`，不得由 Constraints 自行切换。

`difficultyDirection`：

只描述相对当前正式任务基线的方向，不是绝对题目难度。

`materialNovelty`：

描述下一任务所需材料关系；不同题目文字不自动等于 `new_context`。

`hintPolicy`：

描述任务允许的支持条件，不表示学生一定独立完成。

`targetEvidenceQuality`：

表示任务设计希望获得的观察质量，不保证执行后一定生成对应质量的 Evidence。

`preExecutionQualityConditions`：

只描述 TaskFulfillment 在执行前能够校验的任务设计条件。学生是否有效作答、是否实际独立完成、Diagnosis 是否可靠以及最终 Evidence 是否达到 high，必须在任务执行后由 Existing Runtime 与 Phase 14.1 重新判断。

`hardConstraints / softPreferences`：

是 Existing TaskFulfillment 的正式结构化输入。`code / operator / value` 组合必须通过受控校验，不能使用任意自然语言 code，也不能由 TaskFulfillment 解析 `reasons` 或字符串摘要恢复约束。

`requiredCapabilities`：

用于兼容 Existing TaskFulfillment 的能力声明，必须从结构化 Rule 确定性派生，不得成为与 `hardConstraints` 并列的第二权威来源。

### 任务设计条件不等于执行结果

Phase 14.3 只能保证：

- 任务目标能力与 Strategy 对齐；
- 材料关系、难度和提示政策满足正式约束；
- Task / Material / Strategy 来源可追溯；
- TaskFulfillment 没有静默放宽硬约束。

Phase 14.3 不能保证：

- 学生一定提交有效回答；
- 学生实际未使用提示；
- Diagnosis 一定可靠或对齐；
- 最终 AbilityEvidence 一定达到 `targetEvidenceQuality`。

新任务执行后的 Evidence 必须由 Phase 14.1 重新评估。实际质量未达到目标不等于 Phase 14.3 Runtime 失败，也不得反向修改旧 Constraints。

## 七、Strategy 是唯一教育方向来源

Phase 14.3 必须遵循：

```text
Strategy action / task role / target ability / validation goal
> Adaptive Constraints
```

正式规则：

1. targetAbilityId 只能来自 Strategy；
2. recommendedTaskRole 只能复制 Strategy；
3. Constraints 不能把 training 改为 retest、transfer 或 diagnosis；
4. Constraints 不能把 collect_more_evidence 改为 transfer_test；
5. Constraints 不能把 human_review 转换为普通任务；
6. Constraints 不能改写 validationGoal；
7. Quality 与 Conflict 只决定如何在 Strategy 范围内观察；
8. 若 Conflict 推荐动作与 Strategy 冲突，应输出 `regenerate_strategy`，不得修补 Strategy；
9. Strategy 本身非法时，应先由 Existing Strategy Validation 阻断；
10. Phase 14.3 不创建新的 NextLearningAction。

## 八、现有 Strategy 与 Constraints 的最小映射

### continue_training

```text
role                 = training
learningIntent       = consolidation / foundation
difficultyDirection  = maintain
materialNovelty      = similar_context
hintPolicy           = allow_guidance / limited_hint
```

若高质量 weakness 持续存在，可偏向 `foundation`；若已有 growth 但仍依赖提示，可偏向 `consolidation + limited_hint`。

### lower_difficulty_training

```text
role                 = training
learningIntent       = foundation
difficultyDirection  = decrease
materialNovelty      = same_context / similar_context
hintPolicy           = allow_guidance
```

Constraints 不得将其改为 maintain 或 increase 后再掩盖 Strategy 的降低难度意图。

### independent_retest

```text
role                 = retest
learningIntent       = independent_validation
difficultyDirection  = maintain
materialNovelty      = similar_context / new_context
hintPolicy           = no_hint
targetQuality        = high
```

### transfer_test

```text
role                 = transfer
learningIntent       = transfer_validation
difficultyDirection  = maintain
materialNovelty      = new_context
hintPolicy           = no_hint / limited_hint
targetQuality        = high
```

`transfer_test` 表示更换情境验证迁移，不等于提高题目难度。

### diagnostic_verification

```text
role                 = diagnosis
learningIntent       = diagnostic_observation
difficultyDirection  = maintain
materialNovelty      = similar_context
hintPolicy           = limited_hint / no_hint
```

### collect_more_evidence

```text
role                 = observation / diagnosis
learningIntent       = discriminating_observation
difficultyDirection  = maintain
materialNovelty      = similar_context / new_context
hintPolicy           = limited_hint / no_hint
```

### maintenance_validation

```text
role                 = retest / transfer
learningIntent       = delayed_validation
difficultyDirection  = maintain
materialNovelty      = similar_context / new_context
hintPolicy           = no_hint
targetQuality        = high
```

### switch_ability

Strategy 已经确定新的 targetAbilityId 后，Constraints 只能围绕该新能力生成 foundation 或 diagnostic constraints，不能自行选择另一能力。

### human_review

```text
canCreateTaskRequest = false
nextStep             = review_required
```

不得生成普通 TaskRequest。

## 九、难度规则

难度变化必须以 Strategy 为上限。

第一版规则：

1. `lower_difficulty_training` 必须输出 `decrease`；
2. `continue_training` 默认 `maintain`；
3. `independent_retest` 默认 `maintain`；
4. `transfer_test` 默认 `maintain`，新材料不等于更高难度；
5. `diagnostic_verification` 和 `collect_more_evidence` 默认 `maintain`；
6. Evidence 方向一致不能自动输出 `increase`；
7. 连续 high-quality positive 也不能绕过 Strategy 直接增加难度；
8. 当前 `NextLearningAction` 没有明确的 increase-difficulty action，因此 MVP 中 `increase` 是保留枚举，默认不得输出；
9. 未来只有 Strategy 明确新增并通过校验的升级动作，才允许 `increase`；
10. 难度未知时不得推断 increase 或 decrease。

## 十、材料新颖度规则

`materialNovelty` 必须服务于 Strategy 的 validationGoal：

1. `transfer_test` 必须要求 `new_context`；
2. `independent_retest` 至少要求 `similar_context`，需要验证迁移时才要求 `new_context`；
3. `continue_training` 默认 `similar_context`，避免只重复原题；
4. `lower_difficulty_training` 可以使用 `same_context` 或 `similar_context`；
5. unresolved conflict 可以要求 `new_context`，但只在 Strategy 为 observation / diagnosis 且 validationGoal 支持区分性观察时成立；
6. 材料关系必须由 TaskResource / TaskFulfillment 的正式字段验证；
7. 文本不同、taskId 不同或标题不同不能单独证明新情境；
8. TaskFulfillment 找不到满足材料要求的资源时，应进入 `no_match / TaskGenerationRequest`，不得放宽硬约束后静默匹配旧题。

## 十一、提示策略规则

提示调整的目的，是获得更清楚的独立性观察，而不是惩罚学生。

正式规则：

1. 高提示依赖 positive / growth 可以生成 `limited_hint`，但不能直接宣称学生已独立；
2. independent_retest 默认 `no_hint`；
3. maintenance validation 默认 `no_hint`；
4. transfer validation 优先 `no_hint`，Context 明确允许时可 `limited_hint`；
5. foundation training 可以 `allow_guidance`；
6. 提示依赖差异导致 explainable mixed 时，下一观察优先固定其他条件并减少提示；
7. hintPolicy 只约束任务支持条件，不决定 Evidence Type；
8. 学生实际使用提示的事实仍由 TaskExecutionResult 记录；
9. 页面是否展示提示入口属于后续体验层，不由 Constraints 直接控制 UI；
10. CurrentLearningContext 不允许某类任务时，不得借助 hintPolicy 绕过。

## 十二、Conflict Status 到观察目标的映射

### aligned_positive_evidence

可以支持：

- Strategy 已要求 transfer 时，生成 `verify_transfer`；
- Strategy 已要求 maintenance 时，生成 `verify_retention`；
- Strategy 要求继续训练时，保持当前难度并减少不必要提示。

不能自动支持：

- 提高难度；
- 切换能力；
- stable mastery 结论。

### aligned_weakness_evidence

可以支持：

- `strengthen_foundation`；
- `recheck_weakness`；
- Strategy 已要求降低难度时输出 decrease；
- 保持能力与任务角色不变。

### explainable_mixed_evidence

下一任务应尽量只改变一个关键条件：

- 提示差异明显：保持材料和难度，减少提示；
- 材料差异明显：保持难度和提示，选择可验证的新材料；
- 难度差异明显：保持材料和提示，使用 comparable difficulty；
- 时间差异明显：交给 maintenance / delayed validation Strategy；
- 不能把“存在差异”写成已经证明的因果关系。

### unresolved_conflict

只能在 Strategy 已经是 collect_more_evidence 或 diagnostic_verification 时生成：

```text
learningIntent      = discriminating_observation
observationTarget   = resolve_direction_conflict
difficultyDirection = maintain
```

若 Strategy 仍要求普通训练、迁移或切换能力，应输出 `regenerate_strategy`。

### insufficient_comparable_evidence

只能生成收集更多可比较 Evidence 的约束：

- 不提高难度；
- 不切换能力；
- 不宣称稳定；
- 优先补足缺失的材料、提示、难度或时间事实；
- Strategy 不支持 observation / diagnosis 时进入 regenerate_strategy。

### review_required

必须阻断：

```text
canCreateTaskRequest = false
nextStep = review_required
```

## 十三、StrategyConstraintAlignmentResult

建议新增：

```ts
type StrategyConstraintAlignmentStatus =
  | 'aligned'
  | 'strategy_mismatch'
  | 'review_required'
  | 'blocked';

type StrategyConstraintAlignmentNextStep =
  | 'create_task_request'
  | 'regenerate_strategy'
  | 'review_required'
  | 'blocked';

type StrategyConstraintAlignmentResult = {
  alignmentId: string;
  strategyId: string;
  constraintsId: string;
  studentId: string;
  targetAbilityId: string;

  status: StrategyConstraintAlignmentStatus;
  nextStep: StrategyConstraintAlignmentNextStep;
  canCreateTaskRequest: boolean;

  checks: {
    identityAligned: boolean;
    strategyValidationPassed: boolean;
    actionRoleAligned: boolean;
    learningIntentAligned: boolean;
    difficultyAligned: boolean;
    materialAligned: boolean;
    hintPolicyAllowed: boolean;
    validationGoalPreserved: boolean;
    sourceTraceable: boolean;
    assessmentsCurrent: boolean;
  };

  issues: string[];
  warnings: string[];
  validatedAt: string;
};
```

### Alignment 规则

1. 任一身份字段错位时 `blocked`；
2. Strategy Validation 不通过时沿用其 nextStep；
3. action / role 不兼容时 `regenerate_strategy`；
4. Constraints role 与 Strategy role 不同必须阻断；
5. Constraints targetAbilityId 与 Strategy 不同必须阻断；
6. Constraints 不得改写 validationGoal；
7. lower difficulty Strategy 对应 maintain / increase 时阻断；
8. transfer Strategy 未要求 new context 时阻断；
9. independent retest 允许 guidance 时阻断；
10. Conflict review_required 时进入 review；
11. Quality Assessment 版本分叉或缺失时进入 review；
12. unresolved conflict 与普通训练 / transfer Strategy 不一致时 regenerate；
13. warnings 不得自动转换成 passed；
14. 所有 checks 必须由 Validator 重新计算，不能信任调用方。

## 十四、与 TaskRequest 的接入方式

Phase 14.3 不重新定义 `TaskRequest` Schema。

既有 `TaskRequest` 已包含：

```ts
constraints: string[];
```

`TaskRequest.constraints` 只保留兼容摘要，不是 Adaptive Constraints 的正式权威来源。

建议新增正式交接对象：

```ts
type AdaptiveTaskRequestEnvelope = {
  taskRequest: TaskRequest;
  adaptiveConstraints: AdaptiveTaskConstraints;
  alignmentResult: StrategyConstraintAlignmentResult;
  constraintsId: string;
  canEnterTaskFulfillment: boolean;

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

正式接入顺序：

```text
Validated Strategy
+ StrategyConstraintAlignmentResult(aligned)
+ AdaptiveTaskConstraints
-> Existing TaskRequest Agent
-> TaskRequest
-> AdaptiveTaskRequestEnvelope
-> Existing TaskFulfillment
```

规则：

1. 不使用 Adaptive 路径时，Existing TaskRequest 与 TaskFulfillment 保持 legacy 行为；
2. Adaptive 路径必须同时提供 aligned 的 Alignment Result 与 validation passed 的 Constraints；
3. TaskRequest 只创建一次，不先创建再原地修改；
4. `AdaptiveTaskConstraints` 是结构化约束的唯一权威来源；
5. `TaskRequest.constraints` 仅可保留 constraintsId 与确定性可读摘要；
6. 不能从 `TaskRequest.constraints` 或自然语言摘要反向重建结构化对象；
7. TaskRequest 的 source strategy、student、ability、role、action 和 validationGoal 保持原值；
8. Envelope 必须重新校验 `constraintsId`、Strategy ID、studentId、abilityId 与 task role 的关联；
9. Alignment 未通过时 taskRequest 与 Envelope 均不得进入 TaskFulfillment；
10. 不要求或伪造当前 `TaskRequest` Schema 中不存在的 `constraintsId` 字段。

## 十五、与 TaskFulfillment 的接入方式

TaskFulfillment 应继续消费 Envelope 中的结构化 Constraints，而不是依赖脆弱的字符串解析。

建议 Adaptive 路径输入：

```ts
type AdaptiveTaskFulfillmentInput = {
  adaptiveTaskRequestEnvelope: AdaptiveTaskRequestEnvelope;
  recentTaskIds?: string[];
  createdAt?: string;
};
```

结构化映射：

```text
difficultyDirection
-> difficultyRange

materialNovelty
-> contentType / structured material rules

hintPolicy
-> requiredCapabilities / structured hint rules

observationTarget
-> validation capabilities / validation tags
```

规则：

1. Envelope validation 或 Alignment 未通过时不创建 Fulfillment Request；
2. `decrease` 映射到 lower difficulty range；
3. `maintain` 映射到 same preferred difficulty；
4. MVP 不允许 `increase`；
5. `new_context` 必须排除 recentTaskIds 和已确认相同材料；
6. `no_hint` 必须形成独立作答能力要求；
7. `limited_hint` 与 `allow_guidance` 不得被错误序列化为 no hint；
8. TaskResource 不满足硬约束时不得被选中；
9. no match 时保留 Constraints 进入 TaskGenerationRequest；
10. TaskFulfillment 不重新解释 Conflict Status；
11. TaskFulfillment 只消费受控 `AdaptiveConstraintRule`，不得解析 `reasons` 或 `TaskRequest.constraints`；
12. Context Snapshot 不允许某个 task role 或 hint policy 时，必须阻断并要求 `regenerate_strategy`，不得修改 Strategy 后继续；
13. Fulfillment 只能证明执行前设计条件满足，不能承诺执行后的 Evidence 质量。

## 十六、稳定 ID、版本与幂等规则

`constraintsId` 至少基于以下事实生成：

```text
studentId
+ targetAbilityId
+ sourceStrategyId
+ sourceConflictAssessmentId
+ sorted current Quality Assessment IDs
+ learningIntent
+ observationTarget
+ taskRole
+ difficultyDirection
+ materialNovelty
+ hintPolicy
+ adaptiveTaskContext.contextId
+ sorted structured constraint rules
+ policyVersion
```

正式规则：

1. 输入数组顺序变化不改变 ID；
2. 相同输入重复执行得到相同 Constraints；
3. Strategy ID 变化必须生成新 Constraints ID；
4. Conflict Assessment ID 变化必须重新派生 Constraints；
5. 任一当前 Quality Assessment 被新版 supersede 后必须生成新 Constraints；
6. 历史 Constraints 不覆盖，必要时由上层保存版本关系；
7. Constraints 不得修改旧 TaskRequest；
8. 重试 TaskFulfillment 不得重新生成另一套随机 Constraints。

## 十七、失败与阻断规则

以下情况必须阻断：

1. Strategy Validation 未通过；
2. Strategy action / role 不兼容；
3. Strategy、Context、Quality 或 Conflict 身份错位；
4. Conflict validation 未通过；
5. Conflict status = review_required；
6. 当前 Quality Assessment 无法唯一解析；
7. Conflict 引用的 Assessment 不在当前输入中；
8. Strategy Evidence 与 Conflict Evidence 完全无交集；
9. Constraints 改变 targetAbilityId；
10. Constraints 改变 recommendedTaskRole；
11. Constraints 改写 validationGoal；
12. Constraints 越权输出 increase；
13. lower difficulty Strategy 被映射为 maintain / increase；
14. transfer Strategy 未要求新 Context；
15. Context Snapshot validation 不通过或与 Existing Context 不可追溯；
16. Strategy role 不在 Context Snapshot 的 allowedTaskRoles 中；
17. 派生 hintPolicy 不在 Context Snapshot 的 allowedHintPolicies 中；
18. AdaptiveTaskRequestEnvelope 与 TaskRequest / Constraints / Alignment 身份错位；
15. independent retest 允许普通 guidance；
16. Alignment Result 与 Constraints / Strategy ID 不一致；
17. TaskFulfillment 输入丢失 Constraints 追溯；
18. Runtime 试图根据 Constraint 直接生成能力结论。

以下情况不是 Runtime FAIL，但应保守处理：

- TaskResource 无匹配：进入 no match / generation request；
- 证据不足：collect more comparable evidence；
- unresolved conflict：安排区分性观察或 regenerate strategy；
- 允许提示的训练任务：目标质量通常为 medium；
- 相同能力继续训练：不表示系统没有自适应；
- Constraints 目标质量未在执行后实现：由新 Evidence 重新观察。

## 十八、建议新增文件

```text
src/ai/schemas/adaptiveTaskConstraints.schema.ts
src/ai/agents/adaptiveTaskContextAdapter.ts
src/ai/agents/adaptiveTaskConstraintsAgent.ts
src/ai/agents/strategyConstraintAlignmentAgent.ts
src/ai/agents/adaptiveTaskRequestEnvelopeAgent.ts
src/ai/tests/runAdaptiveTaskConstraintsDebug.ts
```

建议只对既有 Fulfillment 接口做最小兼容扩展：

```text
src/ai/agents/taskFulfillmentRequestAgent.ts
```

新增命令：

```text
debug:adaptive-task-constraints
```

不新增第二套 Strategy Agent、TaskRequest Schema 或 TaskFulfillment Runtime。

## 十九、Debug 流程

1. 准备正式 NextLearningStrategy；
2. 调用 Existing Strategy Validation；
3. 从 Existing CurrentLearningContext 与正式历史派生 AdaptiveTaskContextSnapshot；
4. 准备 Phase 14.1 Quality Assessment 历史；
5. 解析每条 Evidence 当前唯一 Assessment；
6. 准备 Phase 14.2 Conflict Assessment；
7. 校验 identity、version、evidence links 与 observation units；
8. 派生 learningIntent 与 observationTarget；
9. 派生 difficulty、material、hint 与 pre-execution quality conditions；
10. 生成结构化 AdaptiveTaskConstraints；
11. 调用 StrategyConstraintAlignmentAgent；
12. aligned 时调用 Existing TaskRequest Agent；
13. 验证 TaskRequest 保留 Strategy 原始字段；
14. 生成并校验 AdaptiveTaskRequestEnvelope；
15. 调用 Existing TaskFulfillment Request Agent；
16. 验证 Envelope 中的结构化 Constraints 被正确映射；
17. 验证 blocked / review / regenerate 分支不生成正式 handoff；
18. 重复执行并验证稳定 ID；
19. 输出 PASS / FAIL。

## 二十、Debug Report

至少展示：

```text
Student ID
Target Ability
Strategy ID
Strategy Action / Task Role / Validation Goal
Strategy Validation Result

Current Quality Assessment IDs
Conflict Assessment ID / Status / Recommendation
Adaptive Context ID / Source Context ID
Allowed Task Roles / Hint Policies

Constraints ID
Learning Intent
Observation Target
Difficulty Direction
Material Novelty
Hint Policy
Target Evidence Quality
Pre-execution Quality Conditions
Required Capabilities
Structured Hard Constraints
Structured Soft Preferences

Alignment Status
Alignment Checks
Alignment Issues / Warnings
Can Create TaskRequest

TaskRequest ID / Role / Action / Constraints
Adaptive TaskRequest Envelope ID / Validation
TaskFulfillment Request difficulty / content / capabilities

PASS / FAIL
```

## 二十一、最小 Debug Case

### Case 1：持续 high-quality weakness + continue training

预期：

- consolidation / foundation；
- maintain difficulty；
- similar context；
- limited hint 或 guidance；
- 不切换能力。

### Case 2：lower difficulty Strategy

预期：

- difficultyDirection = decrease；
- role 保持 training；
- 不允许 Constraints 改回 maintain 或 increase。

### Case 3：提示依赖 positive + independent retest

预期：

- verify independence；
- no hint；
- maintain difficulty；
- target Evidence quality = high。

### Case 4：aligned positive + transfer Strategy

预期：

- transfer validation；
- new context；
- maintain difficulty；
- 不自动 increase。

### Case 5：maintenance validation

预期：

- delayed validation；
- no hint；
- similar / new context；
- 不形成 retained 结论。

### Case 6：unresolved conflict + collect more Evidence

预期：

- discriminating observation；
- resolve direction conflict；
- maintain difficulty；
- TaskRequest role 仍为 observation / diagnosis。

### Case 7：unresolved conflict + transfer Strategy

预期：

- strategy_mismatch；
- regenerate_strategy；
- 不生成 TaskRequest。

### Case 8：提示差异导致 explainable mixed

预期：

- 保持材料与难度；
- 减少提示；
- 不把提示差异宣称为已证明因果。

### Case 9：材料差异导致 explainable mixed

预期：

- 固定提示和难度；
- 使用正式可验证材料关系；
- observation target 指向 transfer / comparison。

### Case 10：insufficient comparable Evidence

预期：

- collect comparable Evidence；
- 不 increase；
- 不 switch ability；
- Strategy 不支持 observation 时 regenerate。

### Case 11：Conflict review_required

预期：

- review_required；
- 不生成 Constraints handoff；
- 不生成 TaskRequest。

### Case 12：Strategy action / role 不一致

预期：

- Existing Strategy Validation 失败；
- regenerate_strategy；
- Constraints 不修复 Strategy。

### Case 13：studentId 或 abilityId 错位

预期：

- blocked；
- 不混合不同学生或能力的 Assessment。

### Case 14：Quality Assessment 分叉版本

预期：

- review_required；
- 不默认选择较新的 assessedAt。

### Case 15：Conflict Assessment 引用旧 Quality Assessment

预期：

- assessmentsCurrent = false；
- review_required；
- 不使用过期约束。

### Case 16：Strategy Evidence 与 Conflict Evidence 无交集

预期：

- sourceTraceable = false；
- blocked。

### Case 17：Constraints 尝试提高难度

当前 Strategy 没有明确 increase action。

预期：

- difficultyAligned = false；
- blocked / regenerate_strategy。

### Case 18：transfer Strategy 未要求新材料

预期：

- materialAligned = false；
- 不进入 TaskFulfillment。

### Case 19：independent retest 允许普通 guidance

预期：

- hintPolicyAllowed = false；
- 阻断。

### Case 20：TaskRequest 正式字段保持不变

预期：

- studentId、ability、action、role、validationGoal 与 Strategy 一致；
- 只增加 approved Constraints；
- TaskRequest 只创建一次。

### Case 21：TaskFulfillment 结构化映射

预期：

- difficulty、material、hint、observation target 正确进入 Fulfillment；
- 不依赖自然语言反向解析。

### Case 22：资源不满足硬约束

预期：

- no match；
- 不静默选择相似但不满足约束的资源；
- Constraints 可进入 TaskGenerationRequest。

### Case 23：相同输入重复运行

预期：

- constraintsId 稳定；
- alignmentId 稳定；
- 不重复创建不同约束。

### Case 24：输入数组顺序变化

预期：

- Constraints 内容、ID 和 Alignment 结果一致。

### Case 25：human review Strategy

预期：

- review_required；
- 不生成普通任务。

### Case 26：Context 与 Strategy 冲突

Strategy role = transfer，但 `AdaptiveTaskContextSnapshot.allowedTaskRoles` 不包含 transfer。

预期：

- blocked / regenerate_strategy；
- 不修改 Strategy role；
- 不生成 AdaptiveTaskRequestEnvelope；
- 不进入 TaskFulfillment。

### Phase 14 集成 Case 27：目标质量未在执行后达成

本 Case 不属于 Phase 14.3 纯约束 Debug，纳入 Phase 14 总体冻结集成验收：

```text
Constraints targetEvidenceQuality = high
-> 任务成功生成
-> 实际执行
├─ 使用提示但 Response 有效
│  -> 生成新 Evidence
│  -> Phase 14.1 重新评估
└─ Response 无效
   -> 不生成正式 Evidence
   -> 不进入质量升级或 Existing Phase 8 更新
```

预期：

- 旧 AdaptiveTaskConstraints 不被反向修改；
- 最终 Evidence 不被强行标记为 high；
- 未达到目标质量不等于 Phase 14.3 Runtime 失败；
- 后续 Strategy 只消费新的正式质量评估结果。

实际结果：

- `debug:phase14-integration`：16 / 16 PASS；
- 三次提示后的有效作答：`qualityLevel = low`、`evaluationEligibility = limited`；
- 占位回答：`blocked_invalid_execution`、正式 Evidence 数量为 0；
- 重复回流保持稳定 Evidence ID；
- Constraints 序列化快照前后一致，未发生反向修改。

## 二十二、验收标准

Phase 14.3 通过条件：

1. 已定义 AdaptiveTaskConstraints Schema；
2. 已定义 StrategyConstraintAlignmentResult Schema；
3. 已实现 AdaptiveTaskConstraintsAgent；
4. 已实现 StrategyConstraintAlignmentAgent；
5. 能消费 Existing NextLearningStrategy；
6. 能消费 Existing StrategyValidationResult；
7. 能消费 CurrentLearningContext；
8. 能从 Existing Context 与正式历史派生 AdaptiveTaskContextSnapshot；
9. Snapshot 不重新定义 Existing CurrentLearningContext；
10. 能解析当前唯一 EvidenceQualityAssessment；
11. 能消费 validation passed 的 EvidenceConflictAssessment；
12. studentId 与 targetAbilityId 全链一致；
13. Strategy Evidence 与 Conflict Evidence 可追溯；
14. Constraints 不修改 Strategy action；
15. Constraints 不修改 Strategy role；
16. Constraints 不修改 targetAbilityId；
17. Constraints 不改写 validationGoal；
18. 支持 foundation；
19. 支持 consolidation；
20. 支持 independent validation；
21. 支持 delayed validation；
22. 支持 transfer validation；
23. 支持 diagnostic observation；
24. 支持 discriminating observation；
25. 支持 decrease difficulty；
26. 支持 maintain difficulty；
27. MVP 不越权输出 increase；
28. 支持 same / similar / new context；
29. 支持 guidance / limited hint / no hint；
30. targetEvidenceQuality 不被解释为实际 Evidence 结果；
31. aligned positive 不自动提高难度；
32. aligned weakness 不自动降低难度，除非 Strategy 已授权；
33. explainable mixed 能针对主要差异生成受控观察条件；
34. unresolved conflict 能生成区分性观察或要求 regenerate strategy；
35. insufficient comparable Evidence 不形成升级约束；
36. review_required 阻断 TaskRequest；
37. Strategy Validation 失败时不生成可执行 Constraints；
38. Assessment 分叉或缺失时阻断；
39. 旧 Assessment 不进入正式约束；
40. Constraints ID 稳定且可重复运行；
41. 输入顺序不影响输出；
42. hard / soft constraints 使用受控 AdaptiveConstraintRule；
43. code / operator / value 组合可确定性校验；
44. requiredCapabilities 从结构化规则派生，不成为第二权威来源；
45. targetEvidenceQuality 与 preExecutionQualityConditions 明确分离；
46. Existing TaskRequest Schema 不被重新定义；
47. TaskRequest 只创建一次；
48. TaskRequest.constraints 仅作为兼容摘要；
49. AdaptiveTaskConstraints 是结构化约束唯一权威来源；
50. 已定义并校验 AdaptiveTaskRequestEnvelope；
51. TaskFulfillment 从 Envelope 结构化消费 Constraints；
52. 不通过自然语言字符串重建结构化 Constraints；
53. 不满足硬约束的资源不会被选中；
54. no match 可保留约束进入 generation request；
55. Context 与 Strategy 冲突时阻断，不修改 Strategy；
56. Fulfillment 不承诺执行后 Evidence 质量；
57. 不重新执行 Evaluation；
58. 不更新 StudentAbilityProfile；
59. 不生成新的 AbilityEvidence；
60. Debug 覆盖至少 26 个专项 Case；
61. Phase 14 集成验收覆盖目标质量未达成 Case；
62. Debug 输出 PASS；
63. Phase 14.2 与 Phase 14.1 回归通过；
64. Existing Phase 8.3 / 8.4 回归通过；
65. Phase 9、Phase 12、Phase 13 关键回归通过；
66. Production Build 通过。

## 二十三、本阶段不做

Phase 14.3 不做：

- 不重新定义 NextLearningStrategy；
- 不新增第二套 Strategy Agent；
- 不重新定义 TaskRequest Schema；
- 不重新定义 TaskFulfillment Runtime；
- 不直接选择 TaskResource；
- 不直接拼题或生成题目正文；
- 不修改 AbilityEvidence；
- 不修改 EvidenceQualityAssessment；
- 不重新协调 Evidence Conflict；
- 不重新执行 Existing Phase 8 Evaluation；
- 不生成 EvaluationResult；
- 不生成 ProfileUpdateDecision；
- 不更新 StudentAbilityProfile；
- 不生成 GrowthMemoryRecord；
- 不处理 StudentResponse；
- 不调用 Diagnosis Runtime；
- 不生成新的 Evidence；
- 不实现复杂题目难度标定；
- 不做机器学习推荐模型；
- 不做无限自动出题；
- 不做 UI；
- 不证明任务策略具有真实教学效果。

## 二十四、与 Phase 14 总体冻结的关系

Phase 14.3 完成后，Phase 14 才具备总体冻结评估条件。

冻结前至少确认：

1. Phase 14.1 Runtime PASS；
2. Phase 14.2 Runtime PASS；
3. Phase 14.3 Runtime PASS；
4. Quality、Conflict 与 Constraints 的版本和 ID 追溯闭合；
5. Existing Strategy 仍是教育方向唯一来源；
6. Constraints 冲突时会阻断，不会改写 Strategy；
7. Existing TaskRequest / TaskFulfillment 能消费 approved Constraints；
8. 新任务执行后仍通过 Phase 9 生成新的正式 AbilityEvidence；
9. 执行后 Evidence 由 Phase 14.1 重新评估，不沿用 targetEvidenceQuality；
10. 未达到目标质量不会修改旧 Constraints，也不会被误判为约束 Runtime 失败；
11. Existing Phase 8、9、12、13 回归通过；
12. Production Build 通过。

## 二十五、阶段完成定义

Phase 14.3 完成时，应能证明：

```text
Existing NextLearningStrategy
+ AdaptiveTaskContextSnapshot
+ Current Evidence Quality
+ Evidence Conflict Context
-> AdaptiveTaskConstraints
-> Alignment Validation
-> Existing TaskRequest
-> AdaptiveTaskRequestEnvelope
-> Existing TaskFulfillment
```

并且：

```text
Constraints 能具体化任务条件，
但不能改写教育策略；

任务可以改变材料、提示和受控难度，
但不会因为一次正向表现自动升级；

冲突或不足可以触发更有区分度的观察，
但不会被强行解释成能力结论。
```

完成后的准确能力是：

> 系统能够在 Existing NextLearningStrategy 的正式边界内，根据当前 Evidence 质量与冲突状态生成可追溯、可校验的任务约束，并通过既有 TaskRequest 与 TaskFulfillment 调整下一任务的观察条件，而不创建第二套策略、评估或画像更新链路。

Phase 14 正式冻结结论：

> 系统能够根据正式任务、作答、提示、时间和追溯事实评估 Evidence 的判断价值，协调多条 Evidence 的方向关系，并在 Existing Strategy 的边界内生成受控任务约束；任务执行后，系统会依据真实表现重新评估 Evidence 质量，而不会把目标质量当成实际结果。
