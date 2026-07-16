# Phase 13.3：Retention Evaluation 最小闭环（保持性评估）

## 一、阶段目标

Phase 13.3 只解决一个核心问题：

```text
学生在延迟复测中的新表现，
与原有基线表现相比，
是否形成了可比较、可追溯、措辞克制的保持性观察？
```

一句话定义：

> 比较正式基线 Evidence 与延迟复测 Evidence，由 Agent 派生可比性并生成 RetentionEvaluationResult，再安全关联延迟 Evidence 已有的 Phase 8 正式结果。

Phase 13.3 不重新诊断学生答案，不生成复测题，不复制 Evidence，也不创建第二条 Profile 更新链路。

## 二、阶段背景

Phase 13.1 已完成：

```text
LearningRoundResult[]
-> LearningSessionRecord[]
-> LearningSessionHistoryResult
```

Phase 13.2 已完成：

```text
GrowthMemorySummary
+ Session History
+ Evidence createdAt
+ Current Time
-> DelayedRetestCandidate
-> DelayedRetestPlan
```

既有 Phase 9 / 10 Runtime 已经能够完成：

```text
ConcreteLearningTask
-> TaskExecutionResult
-> DiagnosisResult
-> AbilityEvidence
-> Existing Phase 8 Runtime
```

因此 Phase 13.3 不需要重新实现题目执行或 Evidence 回流。

它需要补上的能力是：

```text
原来的基线表现
+ 延迟后的新表现
+ 两次任务是否可比较
-> 保持性观察
```

## 三、与 Phase 6.3 的区别

Phase 6.3 `AbilityChangeEvaluation` 主要比较：

```text
训练前
+ 训练中
+ 即时复测后
```

它回答的是：

```text
训练后是否出现了可解释变化？
```

Phase 13.3 主要比较：

```text
原始训练 / 即时复测基线
+ 跨时间延迟复测
```

它回答的是：

```text
经过一段时间后，相关表现是否再次出现？
```

Phase 13.3 不替换 Phase 6.3，也不把 `AbilityChangeEvaluation` 改名复用。

## 四、核心边界

### 1. 保持性观察不等于长期掌握

```text
Retention status = retained
```

只表示：

```text
在本次具备可比性的延迟复测中，
学生再次出现了与基线方向一致的表现。
```

不能推导为：

- 已经永久掌握；
- 以后不会退步；
- 所有同类任务都能稳定完成；
- 长期教学效果已经成立。

### 2. 一次延迟复测失败不等于能力退化

当基线为 positive / growth，而延迟复测为 weakness 时，只能输出：

```text
declined_observation
```

含义是：

```text
本次延迟复测表现低于基线方向，
需要再次观察或继续训练。
```

不得输出：

- 能力已经下降；
- 学生发生退步；
- 之前的学习没有效果；
- Profile 应立即降级。

### 3. 流程完成不等于表现可比较

即使延迟复测已经完成并产生 Evidence，也必须继续检查：

- 是否为同一目标能力；
- 是否为新的正式 Evidence；
- 是否使用新材料；
- 是否使用提示；
- 难度是否具备最低可比性；
- 学生作答是否有效；
- Diagnosis 是否与任务目标对齐；
- Evidence 是否能追溯到正式 Plan、Task、Execution 和 Diagnosis。

### 4. RetentionEvaluationResult 不是 AbilityEvidence

`RetentionEvaluationResult` 是对正式 Evidence 的派生观察，不是新的原始行为证据。

Phase 13.3 禁止：

- 把旧 Evidence 复制一份并改成 retention Evidence；
- 根据 retention status 再生成一条重复 AbilityEvidence；
- 把 `retained` 直接映射为 `positive`；
- 把 `declined_observation` 直接映射为 `weakness`。

Existing Phase 8 Runtime 继续消费原始、正式的 `AbilityEvidence[]`。

### 5. RetentionEvaluationResult 不重新进入 Phase 8

当前 Phase 9.3 的 `TaskEvidenceReturnResult` 在成功回流时已经包含：

- `EvaluationResult`；
- `ProfileUpdateDecision`；
- `GrowthMemoryRecord`。

因此 Phase 13.3 第一版必须遵循：

```text
如果延迟复测 Evidence 已经通过 Phase 9.3 进入 Phase 8
-> 复用已有 Evaluation / Decision / GrowthMemory ID
-> 不再次调用 Profile Executor
-> 不再次写入 GrowthMemory
```

只有未来出现“只生成 Evidence、尚未进入 Phase 8”的正式分支时，才允许由 Orchestrator 将原始 `AbilityEvidence` handoff 给 Existing Phase 8 Runtime 一次。

`RetentionEvaluationResult` 本身永远不是 Phase 8 输入，也不参与该次 ProfileUpdateDecision。

如果无法确认 Evidence 是否已经处理，必须进入 `review_required`，不得猜测后继续。

## 五、最小链路

Phase 13.3 的逻辑链路：

```text
DelayedRetestPlan
+ Baseline AbilityEvidence
+ Delayed Retest TaskEvidenceReturnResult
+ Formal Comparison Sources
↓
Identity / Traceability Validation
↓
RetentionComparisonFacts
↓
Comparability Derivation
├─ comparable
│  ↓
│  RetentionComparabilityResult
│  ↓
│  RetentionEvaluationResult
│  ↓
│  Link Existing Phase 8 Runtime Result
│
├─ limited
│  ↓
│  Conservative Retention Observation
│  ↓
│  independent_retest / collect_more_evidence
│
├─ not_comparable
│  ↓
│  insufficient_evidence
│
└─ review_required
   ↓
   不形成正式保持性结论
```

当前工程的安全执行顺序为：

```text
Delayed Retest StudentResponse
-> TaskEvidenceReturnResult
-> new AbilityEvidence
-> Existing Phase 8 Runtime（只执行一次）
-> RetentionEvaluationResult
-> 关联并复用既有 Evaluation / Decision / GrowthMemory
```

关键要求是：同一份延迟复测 Evidence 只能触发一次正式 Phase 8 回流；RetentionEvaluationResult 只比较和解释 Evidence，不生产 Evidence，也不再次执行正式能力更新。

## 六、输入

建议定义：

```ts
type RetentionEvaluationInput = {
  studentId: string;
  targetAbilityId: string;

  delayedRetestPlan: DelayedRetestPlan;

  baselineEvidence: AbilityEvidence[];
  baselineTask: ConcreteLearningTask;
  delayedTask: ConcreteLearningTask;
  delayedTaskExecutionResult: TaskExecutionResult;
  delayedTaskEvidenceReturnResult: TaskEvidenceReturnResult;

  taskComparisonSource: {
    materialRelation: RetentionMaterialRelation;
    difficultyRelation: RetentionDifficultyRelation;
    source: 'task_fulfillment' | 'comparison_adapter';
  };

  evaluatedAt: string;
  timezone: string;
};
```

### 输入前置条件

1. `DelayedRetestPlan.status` 必须为 `available` 或 `completed`；
2. `DelayedRetestPlan.studentId` 必须等于输入 `studentId`；
3. `DelayedRetestPlan.targetAbilityId` 必须等于输入 `targetAbilityId`；
4. `baselineEvidenceId` 必须能在 `baselineEvidence` 中找到；
5. 基线 Evidence 必须为 `growth` 或 `positive`；
6. 基线 Evidence 必须属于同一 student 和 ability；
7. `TaskEvidenceReturnResult.status` 必须为 `evidence_returned`；
8. 延迟 Evidence 必须来自该 `TaskEvidenceReturnResult.abilityEvidence`；
9. 延迟复测语境必须由 `ConcreteLearningTask.taskRole = retest / transfer` 和完整 Trace Link 证明；
10. 延迟 Evidence 必须与基线 Evidence ID 不同；
11. 延迟 Evidence 时间不得早于基线 Evidence；
12. 延迟 Evidence 必须能追溯到 Task、Execution、Response 与 Diagnosis；
13. `evaluatedAt` 必须由调用方注入；
14. `materialRelation` 与 `difficultyRelation` 必须来自正式任务准备结果或明确的比较适配器；
15. 输入对象缺失或身份冲突时，不得通过默认值继续评估；
16. 调用方不得直接提供 `comparabilityStatus`、`comparisonReasons` 或 `validation.passed` 作为可信结论。

## 七、Retention Comparison Model

Phase 13.3 将比较信息拆为两层：

```text
Formal Runtime Objects / Task Comparison Source
↓
RetentionComparisonFacts
↓
RetentionComparabilityResult
```

`RetentionComparisonFacts` 是 Agent 从正式对象中读取并规范化的事实快照。

`RetentionComparabilityResult` 是 Agent 根据事实重新计算的派生判断。调用方不能直接指定最终可比性。

建议结构：

```ts
type RetentionMaterialRelation =
  | 'same_material'
  | 'similar_material'
  | 'new_material'
  | 'unknown';

type RetentionDifficultyRelation =
  | 'lower'
  | 'comparable'
  | 'higher'
  | 'unknown';

type RetentionComparabilityStatus =
  | 'comparable'
  | 'limited'
  | 'not_comparable'
  | 'review_required';

type RetentionComparisonFacts = {
  contextId: string;
  planId: string;
  studentId: string;
  targetAbilityId: string;

  baselineTaskId: string;
  delayedTaskId: string;
  delayedExecutionSessionId: string;
  delayedResponseId: string;
  delayedDiagnosisResultId: string;

  delayedTaskRole: 'retest' | 'transfer';
  materialRelation: RetentionMaterialRelation;
  difficultyRelation: RetentionDifficultyRelation;

  responseValid: boolean;
  diagnosisAligned: boolean;
  traceabilityComplete: boolean;

  usedHint: boolean;
  hintCount: number;

  baselineAt: string;
  delayedEvidenceAt: string;
  elapsedDays: number;
  comparedAt: string;
};

type RetentionComparabilityResult = {
  status: RetentionComparabilityStatus;
  reasons: string[];
  limitations: string[];

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

### Facts 数据来源与派生规则

Facts 只能来自正式对象，并由 Agent 重新计算或核验：

| Facts 字段 | 正式来源 |
| --- | --- |
| `planId` | `DelayedRetestPlan.planId` |
| `baselineTaskId` | 基线 `AbilityEvidence.taskId` |
| `delayedTaskId` | `TaskEvidenceReturnResult.taskId` |
| `executionSessionId` | `TaskEvidenceReturnResult.executionSessionId` |
| `responseId` | `TaskEvidenceReturnResult.responseId` |
| `diagnosisResultId` | `TaskEvidenceReturnResult.diagnosisResultId` |
| `taskRole` | `ConcreteLearningTask.taskRole` |
| `responseValid` | 根据 `TaskExecutionResult.responseValidity` 重新计算 |
| `diagnosisAligned` | 根据 Task、Diagnosis、Evidence ability 与正式 validation 重新核验 |
| `traceabilityComplete` | 根据 Plan / Task / Execution / Response / Diagnosis / Evidence ID 链重新核验 |
| `usedHint / hintCount` | `TaskEvidenceReturnResult.supportContext` |
| `baselineAt` | 基线 Evidence `createdAt` |
| `delayedEvidenceAt` | 延迟 Evidence `createdAt` |
| `elapsedDays` | Agent 根据 baselineAt 与 delayedEvidenceAt 计算 |
| `comparedAt` | 规范化后的输入 `evaluatedAt` |

`materialRelation` 和 `difficultyRelation` 必须由任务准备或明确的比较适配器提供，不得仅根据两个 `taskId` 是否不同自行猜测。

即使调用方或旧 Mock 附带 `comparabilityStatus`、`comparisonReasons`、`traceabilityComplete`、`diagnosisAligned`、`responseValid` 或 `elapsedDays`，Agent 也不得直接信任这些派生字段，必须根据正式来源对象重新计算或核验。

### AbilityEvidence.source 兼容规则

现有 Schema 与 Runtime 允许两种复测 Evidence 表达方式：

```text
专用 Retest Execution 路径
-> AbilityEvidence.source = retest

Phase 9.3 TaskEvidenceReturn
+ ConcreteLearningTask.taskRole = retest / transfer
-> AbilityEvidence.source = diagnosis
```

因此 Phase 13.3 不得只凭 `AbilityEvidence.source` 判断是否属于延迟复测。

第一版正式规则为：

```text
source = retest
或
source = diagnosis
+ taskRole = retest / transfer
+ TaskEvidenceTraceLink 完整
+ Plan / Task / Ability 对齐
```

两种路径都可以形成延迟复测 Evidence。`source = diagnosis` 时必须依赖任务角色和完整追溯证明复测语境，不能把普通诊断 Evidence 误当作延迟复测。

Phase 13.3 不为此修改 AbilityEvidence Schema，也不在生成后篡改 `source`。

## 八、可比性规则

### comparable

最小条件：

- student 一致；
- target ability 一致；
- 延迟任务角色为 `retest` 或 `transfer`；
- 作答有效；
- Diagnosis 与任务目标对齐；
- Traceability 完整；
- 使用新材料；
- 难度为 comparable；
- 未使用提示；
- 延迟 Evidence 时间合法；
- Plan 与基线 Evidence 对齐。

### limited

结构和身份均合法，但存在会降低判断强度的因素，例如：

- 使用提示；
- 难度比基线低；
- 材料相似但不能确认完全独立；
- 只有一条有效延迟 Evidence；
- 延迟间隔刚达到最低阈值。

`limited` 可以形成克制观察，但不得支持“稳定保持”或强 Profile 更新。

### not_comparable

例如：

- `materialRelation = unknown`；
- `difficultyRelation = unknown`；
- 延迟 Evidence 为 `insufficient`；
- 缺少基线 taskId；
- 延迟任务无法确认是复测或迁移任务。

输出应为 `insufficient_evidence`，不形成正向或负向保持结论。

### review_required

例如：

- studentId 不一致；
- ability 不一致；
- Plan baseline 与输入 Evidence 不一致；
- 使用了与 Plan `requireNewMaterial = true` 冲突的原材料；
- Response 无效但仍生成正式 Evidence；
- Diagnosis 未对齐却生成 Evidence；
- Trace Link 不完整；
- Evidence 时间顺序错误；
- Schema 版本不支持；
- 无法确认 Phase 8 是否已经执行，存在重复更新风险。

`review_required` 不得进入正式 Profile 更新。

## 九、RetentionEvaluationResult

建议定义：

```ts
type RetentionEvaluationStatus =
  | 'retained'
  | 'partially_retained'
  | 'performance_fluctuated'
  | 'declined_observation'
  | 'insufficient_evidence'
  | 'review_required';

type RetentionEvaluationFollowUp =
  | 'continue_observation'
  | 'independent_retest'
  | 'continue_training'
  | 'collect_more_evidence'
  | 'human_review';

type ExistingPhase8ResultLink = {
  mode: 'reuse_existing' | 'blocked';

  evidenceIds: string[];

  evaluationResultId?: string;
  profileUpdateDecisionId?: string;
  growthMemoryRecordId?: string;

  idempotencyKey: string;
  reason: string;
};

type RetentionEvaluationResult = {
  retentionEvaluationId: string;
  studentId: string;
  targetAbilityId: string;
  planId: string;

  baselineEvidenceIds: string[];
  delayedEvidenceIds: string[];

  comparisonFacts: RetentionComparisonFacts;
  comparability: RetentionComparabilityResult;

  status: RetentionEvaluationStatus;
  observations: string[];
  limitations: string[];
  confidence: number;

  followUp: RetentionEvaluationFollowUp;
  followUpReason: string;

  existingPhase8ResultLink: ExistingPhase8ResultLink;

  schemaVersion: 'retention_evaluation_v1';
  createdAt: string;

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

## 十、状态定义

### retained

表示：

- 基线 Evidence 为 growth / positive；
- 延迟复测 Evidence 为 growth / positive；
- 可比性为 comparable；
- 未使用提示；
- Evidence 方向一致；
- 任务与诊断追溯完整。

`retained` 只表示本次延迟复测观察与基线方向一致，不表示长期稳定掌握。

`positive` 与 `growth` 是不同证据语义，不构成默认高低等级。只要基线和延迟 Evidence 都属于 `positive / growth`，可比性为 `comparable`，未使用提示且不存在明确表现缺口，即可输出 `retained`。

### partially_retained

表示延迟复测中仍出现相关正向或改善表现，但判断条件有限。

典型情况：

- 使用提示后完成；
- 任务难度略低；
- 材料相似但独立性有限；
- 追溯完整但比较强度有限；
- 正向表现中仍存在可从正式 Evidence detail / reason 追溯的明确缺口。

当使用提示时，`partially_retained` 不得作为独立保持证据直接更新 Profile，应优先安排无提示复测。

### performance_fluctuated

表示同一次或近期延迟复测 Evidence 中同时存在方向冲突：

- positive / growth 与 weakness 并存；
- 多次延迟复测结果不一致；
- 相近时间的可比任务表现波动明显。

该状态说明“表现有波动”，不说明能力已经下降。

### declined_observation

表示：

- 基线为 growth / positive；
- 延迟复测为 weakness；
- 比较条件为 comparable；
- 作答有效；
- Diagnosis 对齐；
- 未使用提示。

该状态必须附带限制：

> 这是一次延迟复测中的较弱表现，只能作为需要继续观察的信号，不能单独证明能力退化。

### insufficient_evidence

表示：

- 延迟 Evidence 缺失；
- 延迟 Evidence 为 insufficient；
- 任务可比性无法确认；
- 材料或难度关系未知；
- 缺少最低追溯信息但不存在身份冲突；
- 当前只有流程完成事实，没有可观察表现。

### review_required

表示输入结构、身份、追溯、时间或执行状态存在冲突。

它不是学生表现结论，也不能被展示为学生能力问题。

## 十一、状态判断优先级

判断顺序必须固定：

```text
1. Schema / Identity / Traceability 冲突
   -> review_required

2. ResponseValidity / Diagnosis Alignment 失败
   -> review_required 或 insufficient_evidence

3. Agent 派生的可比性不足
   -> insufficient_evidence

4. 使用提示或难度降低
   -> partially_retained（保守观察）

5. 延迟 Evidence 方向冲突
   -> performance_fluctuated

6. 基线 positive/growth + 延迟 weakness
   -> declined_observation

7. 基线 positive/growth + 延迟 positive/growth
   -> comparable 且无明确限制：retained
   -> 存在提示、难度、材料独立性或表现完整度限制：partially_retained
```

不得先根据 evidenceType 得出结论，再跳过可比性检查。

## 十二、Evidence 使用规则

### 基线 Evidence

基线必须：

- ID 等于 `DelayedRetestPlan.baselineEvidenceId`；
- ID 包含在 `DelayedRetestPlan.sourceEvidenceIds`；
- evidenceType 为 growth 或 positive；
- studentId 和 ability 对齐；
- createdAt 合法；
- taskId 非空；
- 能追溯到正式 Session。

### 延迟 Evidence

延迟 Evidence 必须：

- 来自新的 StudentResponse；
- 来自新的 executionSessionId；
- `source = retest`，或由 `source = diagnosis + taskRole = retest / transfer + 完整 Trace Link` 证明复测语境；
- studentId 和 ability 对齐；
- taskId 等于延迟复测任务 ID；
- diagnosisId 等于正式 DiagnosisResult ID；
- createdAt 不早于基线；
- ID 不等于任何基线 Evidence ID；
- 能在 `TaskEvidenceReturnResult.evidenceTraceLinks` 中找到完整追溯链。

### insufficient 的处理

`insufficient` 是正式 Evidence 类型，但不参与强弱或保持方向判断。

它可以进入 Existing Evaluation 用于记录证据不足，但不得被转换为：

- retained；
- declined_observation；
- performance_fluctuated。

## 十三、提示依赖规则

`usedHint = true` 时：

- 可以记录学生在支持条件下完成了任务；
- `status` 最高只能为 `partially_retained`；
- `comparability.status = limited`；
- 必须在 `limitations` 中记录提示依赖；
- 不得表达为独立保持；
- 不得因为回答正确就直接更新为 stable_positive；
- 建议 `followUp = independent_retest`。

第一版 Existing Evaluation 尚不能直接消费完整提示依赖上下文，因此提示后结果不得通过 13.3 触发新的强 Profile 更新。

## 十四、材料与难度规则

### 新材料

Phase 13.2 第一版要求：

```text
requireNewMaterial = true
```

因此 13.3 必须确认：

```text
materialRelation = new_material
```

如果实际使用原题或同一材料：

```text
materialRelation = same_material
-> review_required
```

不得因为 `taskId` 不同就自动判断为新材料。

### 难度

第一版不需要复杂难度模型，但必须保留明确关系：

- `comparable`：可进行主要保持性比较；
- `lower`：只能形成 limited / partially_retained；
- `higher`：出现 weakness 时不能直接解释为下降；
- `unknown`：进入 insufficient_evidence。

## 十五、时间规则

1. `evaluatedAt` 必须由调用方传入；
2. 基线 Evidence 时间必须早于延迟 Evidence；
3. 延迟 Evidence 原则上不得早于 `plannedRetestAt`；
4. 如果提前执行，不能作为本计划的正式延迟复测结果；
5. `elapsedDays` 使用 UTC 时间差计算；
6. `timezone` 只用于展示和日历解释；
7. 相同输入必须产生稳定的 elapsedDays 与结果 ID；
8. 读取历史或刷新页面不得改变 Evidence 时间。

## 十六、Existing Phase 8 Runtime 结果关联规则

### 当前 MVP：reuse_existing

当 `TaskEvidenceReturnResult` 已包含：

- `evaluationResult`；
- `profileUpdateDecision`；
- `growthMemoryRecord`；

Phase 13.3 必须输出：

```text
existingPhase8ResultLink.mode = reuse_existing
```

并记录对应 ID。

不得：

- 再次调用 `evaluateAbilityEvidence`；
- 再次调用 `decideProfileUpdate`；
- 再次调用 `applyProfileUpdateDecision`；
- 再次创建 GrowthMemoryRecord。

### 未来兼容：原始 Evidence Handoff

如果未来存在“仅生成正式延迟 Evidence，但尚未进入 Phase 8”的受控分支：

```text
Orchestrator
-> 原始 delayed AbilityEvidence
-> Existing Phase 8 Runtime（一次）
```

该动作属于 Orchestrator 的 Evidence 回流职责，不属于 `RetentionEvaluationResult` 的状态，也不以 RetentionResult 作为输入。Phase 13.3 MVP 不实现该分支。

### 不确定状态：blocked

如果无法确认是否已经回流：

```text
existingPhase8ResultLink.mode = blocked
status = review_required
```

宁可停止，也不得造成重复 Profile 更新或重复 GrowthMemory。

## 十七、幂等规则

建议稳定 ID：

```text
retentionEvaluationId
= studentId
+ targetAbilityId
+ planId
+ baselineEvidenceIds
+ delayedEvidenceIds
+ schemaVersion
```

`idempotencyKey` 使用同一组正式来源字段生成。

重复运行时必须：

- 返回相同 `retentionEvaluationId`；
- 返回相同 `idempotencyKey`；
- 不生成新的 AbilityEvidence；
- 不重复执行 Evaluation；
- 不重复执行 ProfileUpdateDecision；
- 不重复写入 GrowthMemory；
- 不改变原始 Evidence 时间；
- 不把旧计划重新设为 pending 或 available。

## 十八、失败与阻断规则

以下情况必须进入 `review_required`：

- Plan Schema 非法；
- Plan 与 baseline Evidence 不一致；
- studentId 不一致；
- targetAbilityId 不一致；
- delayed Evidence 既不是 `source = retest`，也无法通过 taskRole 与完整 Trace Link 证明复测语境；
- ResponseValidity 无效但生成了正式能力 Evidence；
- Diagnosis 未对齐但生成了 Evidence；
- Trace Link 缺失；
- delayed Evidence ID 与 baseline 相同；
- 时间顺序冲突；
- 使用同一材料违反 Plan；
- Existing Phase 8 是否已执行无法确认；
- Existing Evaluation / Decision / GrowthMemory 的 student 或 ability 不一致。

以下情况输出 `insufficient_evidence`：

- 延迟 Evidence 缺失；
- 延迟 Evidence 只有 insufficient；
- 难度关系未知；
- 材料关系未知；
- 有效观察数量不足；
- 当前事实不足以形成方向判断，但没有结构冲突。

`insufficient_evidence` 是合法业务结果，不等于 Runtime FAIL。

## 十九、建议新增文件

```text
src/ai/schemas/retentionEvaluation.schema.ts
src/ai/agents/retentionEvaluationAgent.ts
src/ai/tests/runRetentionEvaluationDebug.ts
```

新增命令：

```text
npm run debug:retention-evaluation
```

第一版只做纯 Runtime，不接 UI、不接通知、不修改 Phase 8 已冻结 Schema。

## 二十、Debug 最小流程

```text
1. 准备 Phase 13.2 DelayedRetestPlan
2. 准备正式 baseline Evidence
3. 准备延迟复测 ConcreteLearningTask
4. 准备有效 StudentResponse / TaskExecutionResult
5. 准备成功 TaskEvidenceReturnResult
6. 读取新的正式延迟复测 AbilityEvidence
7. 从正式对象派生 RetentionComparisonFacts
8. 重新计算 RetentionComparabilityResult
9. 生成 RetentionEvaluationResult
10. 关联或阻断 Existing Phase 8 正式结果
11. 验证幂等
12. 输出 PASS / FAIL
```

## 二十一、Debug Report

Debug 至少展示：

- Student ID；
- Target Ability；
- Plan ID / Status；
- Baseline Evidence ID / Type / Time / Task ID；
- Delayed Evidence ID / Type / Time / Task ID；
- Delayed Task Role；
- Material Relation；
- Difficulty Relation；
- Response Validity；
- Diagnosis Alignment；
- Traceability；
- Used Hint / Hint Count；
- Elapsed Days；
- Agent-derived Comparability Status；
- Retention Status；
- Comparison Facts / Observations；
- Limitations；
- Confidence；
- Follow Up；
- Existing Phase 8 Result Link Mode；
- EvaluationResult ID；
- ProfileUpdateDecision ID；
- GrowthMemoryRecord ID；
- Validation Issues；
- PASS / FAIL。

## 二十二、最小 Debug Cases

### Case 1：可比、无提示、延迟 positive / growth

```text
baseline = growth / positive
delayed = growth / positive
material = new
difficulty = comparable
usedHint = false
-> retained
```

### Case 2：基线 positive，延迟 growth

```text
material = new
difficulty = comparable
usedHint = false
无明确表现缺口
-> retained
-> 不表达长期掌握
```

### Case 3：延迟 Evidence 方向冲突

```text
delayed = positive + weakness
-> performance_fluctuated
```

### Case 4：基线 positive / growth，延迟 weakness

```text
-> declined_observation
-> 不输出能力已经下降
```

### Case 5：延迟 Evidence 为 insufficient

```text
-> insufficient_evidence
```

### Case 6：缺少延迟 Evidence

```text
-> insufficient_evidence
-> 不生成替代 Evidence
```

### Case 7：studentId 不一致

```text
-> review_required
```

### Case 8：ability 不一致

```text
-> review_required
```

### Case 9：使用同一材料

```text
Plan.requireNewMaterial = true
materialRelation = same_material
-> review_required
```

### Case 10：使用提示后完成

```text
usedHint = true
delayed = positive
-> partially_retained
-> comparability = limited
-> followUp = independent_retest
```

### Case 11：Response 无效或 Diagnosis 未对齐

```text
-> review_required
-> 不形成保持性结论
```

### Case 12：Evidence 时间顺序错误

```text
delayed.createdAt < baseline.createdAt
-> review_required
```

### Case 13：重复执行

```text
相同 plan + baseline + delayed Evidence
-> 相同 retentionEvaluationId
-> 不重复调用 Phase 8
```

### Case 14：Phase 9.3 已完成正式回流

```text
TaskEvidenceReturnResult 已含 Evaluation / Decision / GrowthMemory
-> mode = reuse_existing
-> 复用原 ID
-> 不产生第二份正式结果
```

### Case 15：调用方伪造可比性状态

```text
materialRelation = unknown
difficultyRelation = unknown
旧 Mock 附带 comparabilityStatus = comparable
-> Agent 忽略调用方派生结论
-> 重新计算 comparability = not_comparable
-> insufficient_evidence
```

### Case 16：Phase 8 正式结果身份错位

```text
EvaluationResult.studentId / abilityId
与 delayed Evidence 不一致
-> existingPhase8ResultLink.mode = blocked
-> review_required
-> 不复用错误正式结果
```

## 二十三、验收标准

Phase 13.3 通过条件：

1. 已定义 `RetentionComparisonFacts` Schema；
2. 已定义 `RetentionComparabilityResult` Schema；
3. 已定义 `RetentionEvaluationResult` Schema；
4. 已实现 RetentionEvaluationAgent；
5. 能消费 Phase 13.2 `DelayedRetestPlan`；
6. 能定位唯一 baseline Evidence；
7. 能消费新的复测 AbilityEvidence，并兼容现有 `source = retest` 与受控的 `source = diagnosis + retest / transfer taskRole` 两条正式路径；
8. 能验证 delayed Evidence 来自正式 TaskEvidenceReturnResult；
9. 能校验 studentId 与 targetAbilityId；
10. 能校验 Plan、Task、Execution、Response、Diagnosis 与 Evidence 追溯关系；
11. 能从正式对象重新计算 ResponseValidity、Diagnosis Alignment 与 Traceability；
12. 能根据正式时间重新计算 elapsedDays；
13. 能检查新材料要求；
14. 能检查难度可比性；
15. 不信任调用方提供的 comparabilityStatus、comparisonReasons 或 validation；
16. 能保留 usedHint / hintCount；
17. 使用提示时不会输出独立保持结论；
18. positive 与 growth 不被默认解释为高低等级；
19. 能输出 retained；
20. 能输出 partially_retained；
21. 能输出 performance_fluctuated；
22. 能输出 declined_observation；
23. 能输出 insufficient_evidence；
24. 能输出 review_required；
25. declined_observation 不会被表述为能力已经下降；
26. RetentionEvaluationResult 不会被伪装成新 AbilityEvidence 或 Phase 8 输入；
27. 同一输入重复执行得到相同 ID；
28. 不重复执行 Phase 8 Evaluation；
29. 不重复执行 ProfileUpdateDecision；
30. 不重复写入 GrowthMemory；
31. 已处理结果能够关联原 Evaluation / Decision / GrowthMemory ID；
32. Existing Phase 8 正式结果身份错位时进入 review_required；
33. 无法确认回流状态时进入 review_required；
34. Debug 至少覆盖 16 个 Case；
35. Debug 输出 PASS；
36. Phase 13.2、Phase 13.1 与 Phase 12 回归通过；
37. Production Build 通过。

## 二十四、本阶段不做

Phase 13.3 不做：

- 不生成 DelayedRetestPlan；
- 不生成 TaskRequest；
- 不匹配题目；
- 不创建 ConcreteLearningTask；
- 不处理新的学生输入；
- 不调用 Diagnosis Runtime；
- 不复制 AbilityEvidence；
- 不修改 AbilityEvidence Schema；
- 不修改 DiagnosisResult Schema；
- 不重写 EvaluationAgent；
- 不创建第二套 ProfileUpdateDecision；
- 不直接修改 StudentAbilityProfile 字段；
- 不重复创建 GrowthMemory；
- 不做复杂统计显著性分析；
- 不做遗忘曲线预测；
- 不生成长期掌握结论；
- 不接通知系统；
- 不接云端数据库；
- 不做正式 UI。

## 二十五、与 Existing Phase 8 Runtime 的关系

Phase 13.3 新增的核心能力只有：

```text
比较基线 Evidence 与延迟复测 Evidence
-> 形成结构化保持性观察
```

以下能力继续由 Existing Phase 8 提供：

```text
AbilityEvidence[]
-> EvaluationResult
-> ProfileUpdateDecision
-> Profile Executor
-> GrowthMemoryRecord
```

Phase 13.3 不根据 retention status 自行修改 Profile。

当前成功的 Phase 9.3 回流结果应被关联，避免同一 delayed Evidence 被正式处理两次。RetentionEvaluationResult 只解释这些结果，不参与其生成。

## 二十六、Phase 13 冻结条件

Phase 13.3 完成后，Phase 13 可以进入总体冻结评估。

冻结前至少确认：

1. Phase 13.1 Runtime PASS；
2. Phase 13.2 Runtime PASS；
3. Phase 13.3 Runtime PASS；
4. Session History 输入可信；
5. DelayedRetestPlan 可追溯且幂等；
6. 延迟复测产生新的正式 Evidence；
7. 保持性比较具备可比性闸门；
8. 一次较弱表现不会被表述为能力退化；
9. Existing Phase 8 正式回流不会重复执行；
10. Phase 12 集成回归和 Production Build 继续通过。

Phase 13.1 IndexedDB Browser Persistence Smoke Test 如果仍未运行，必须继续保留为明确待验项，不得在 Phase 13 冻结记录中误写为 PASS。

## 二十七、完成定义

Phase 13.3 完成时，应能证明：

```text
正式基线 Evidence
+ 新的延迟复测 Evidence
+ Agent 派生的比较事实与可比性结果
可以生成结构化、克制、可追溯的保持性观察；

保持性观察能够区分：
保持、部分保持、表现波动、一次较弱观察、证据不足和需要复核；

同一份延迟 Evidence 不会重复触发 Evaluation、Profile 更新或 GrowthMemory 写入。
```

完成后的准确能力是：

> 系统能够在跨 Session 的延迟复测后，基于正式 Evidence 和可比性条件形成保持性观察，并安全关联已有 Evaluation、ProfileUpdateDecision 与 GrowthMemory 结果。

它仍不证明学生已经长期掌握能力，也不证明一次复测中的较弱表现代表真实退步。

## 二十八、工程验收记录

验收日期：2026-07-16

验收结论：PASS
通过类型：Retention Evaluation 最小 Runtime 闭环通过

本阶段已完成：

- `src/ai/schemas/retentionEvaluation.schema.ts`；
- `src/ai/agents/retentionEvaluationAgent.ts`；
- `src/ai/tests/runRetentionEvaluationDebug.ts`；
- `pnpm run debug:retention-evaluation`。

验收结果：

```text
Phase 13.3 Debug             16 / 16 PASS
Phase 13.1 Regression        15 / 15 PASS
Phase 13.2 Regression        12 / 12 PASS
Phase 9.3 Evidence Return    PASS
Phase 12 Integration          9 / 9 PASS
Production Build             PASS
```

已验证：

1. Agent 从正式 Plan、Task、Execution、Diagnosis 和 Evidence 派生比较事实，不信任调用方伪造的可比性结论；
2. 可区分 `retained`、`partially_retained`、`performance_fluctuated`、`declined_observation`、`insufficient_evidence` 与 `review_required`；
3. `positive` 与 `growth` 不按固定高低等级解释；
4. 使用提示、材料关系、难度关系、作答有效性、Diagnosis 对齐与追溯完整性均进入可比性闸门；
5. 身份、能力、时间和 Existing Phase 8 正式结果错位会进入复核；
6. `RetentionEvaluationResult` 不生成新的 AbilityEvidence，也不再次执行 Evaluation、Profile Update 或 GrowthMemory 写入；
7. 已由 Phase 9.3 完成回流的 delayed Evidence 只关联已有正式结果；
8. 相同输入重复执行会得到稳定 ID 和稳定关联键。

当前边界保持不变：Phase 13.1 IndexedDB Browser Persistence Smoke Test 仍为 `PENDING`。因此 Phase 13.3 可以冻结，但 Phase 13 总体冻结仍需等待该浏览器验收完成。
