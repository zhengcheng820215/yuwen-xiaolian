# Phase 14：证据质量与受控自适应基础（Evidence Quality and Controlled Adaptation Foundation）

## 一、阶段定位

Phase 13 已经证明：

```text
Learning Session History
-> DelayedRetestPlan
-> Delayed AbilityEvidence
-> Existing Phase 8 Runtime
-> RetentionEvaluationResult
```

系统能够跨 Session 保存正式学习历史，根据 Evidence 时间生成延迟复测计划，并比较基线 Evidence 与延迟 Evidence。

但现有 Evaluation 主要根据 Evidence 数量、方向、来源和有限的复测事实进行判断，尚未系统回答：

```text
一条 Evidence 的判断价值有多高？
多条 Evidence 方向不一致时应如何协调？
下一道任务应如何改变难度、材料和提示条件？
```

Phase 14 不增加新的 Diagnosis Runtime，也不创建第二套 Profile 更新链路。

Phase 14 的任务是为已有 Evidence 增加结构化质量解释，为冲突证据提供克制的协调结果，并把这些结果转换为受控的任务约束，继续交给 Existing Phase 8 Strategy 和 TaskFulfillment 链路执行。

## 二、一句话定义

Phase 14 是证据质量理解与受控自适应基础。

它验证：

```text
正式 Evidence 的价值可以根据任务、提示、时间、作答和诊断事实分级；
方向不同的 Evidence 可以在不覆盖历史的前提下形成协调结论；
质量与冲突结论可以约束下一任务的目的、难度、材料和提示条件。
```

## 三、与 Phase 13、Phase 8 的承接关系

### Phase 13

Phase 13 回答：

```text
不同时间发生了什么？
是否完成了延迟复测？
基线与延迟表现是否形成可比较观察？
```

Phase 14 回答：

```text
这些 Evidence 的判断价值是否相同？
方向不一致能否由任务条件解释？
下一次观察应改变什么条件？
```

### Phase 8

Existing Phase 8 继续拥有以下正式职责：

```text
AbilityEvidence
-> EvaluationResult
-> ProfileUpdateDecision
-> Profile Executor
-> GrowthMemoryRecord
-> NextLearningStrategy
```

Phase 14 不重新定义、不复制、不旁路上述链路。

Phase 14 输出的是质量 Assessment、冲突 Assessment 和任务 Constraints。正式 Profile 是否更新，仍必须由 Existing Phase 8 的 `ProfileUpdateDecision` 决定。

当前工程进度：

- Phase 14.1 Evidence Quality Assessment：PASS；
- Phase 14.2 Evidence Conflict Coordination：PASS；
- Phase 14.3 Adaptive Task Constraints：26 / 26 Debug PASS / RUNTIME PASS；
- Phase 14 执行后质量重评集成 Case 27：16 / 16 PASS；
- Phase 14 总体集成冻结：PASS / FROZEN（2026-07-17）。

## 四、核心问题

Phase 14 只回答三个核心问题：

1. 一条 Evidence 在当前正式上下文中的判断价值有多高？
2. 同一能力下的多条 Evidence 是否一致、可解释地混合、真实冲突或仍然不足？
3. 下一道任务应如何调整任务角色、难度、材料新颖度和提示策略？

Phase 14 不回答：

- 学生是否已经长期掌握某项能力；
- 某一种自适应策略是否已经证明教学有效；
- AI 是否可以无限自动出题；
- 一次高质量 Evidence 是否足以形成长期结论；
- 多学生统计模型应如何训练；
- 页面应如何向学生解释全部内部质量判断。

## 五、三个最小闭环

### Phase 14.1：Evidence Quality Assessment

核心问题：

> 一条 Evidence 对长期能力判断的价值有多高？

最小链路：

```text
AbilityEvidence
+ TaskExecutionResult
+ ConcreteLearningTask
+ Diagnosis / Evidence Return Result
+ Retention / Timing Context
↓
EvidenceQualityFacts
↓
EvidenceQualityAssessment
```

Phase 14.1 只评估 Evidence 的判断条件，不改变 Evidence 方向，不更新 Profile。

### Phase 14.2：Evidence Conflict Coordination

核心问题：

> 同一能力出现不同方向 Evidence 时，系统怎样保持谨慎？

最小链路：

```text
AbilityEvidence[]
+ EvidenceQualityAssessment[]
↓
EvidenceConflictAssessment
↓
EvaluationContextAdapter
↓
Existing Phase 8 Evaluation Runtime
```

Phase 14.2 不删除低质量 Evidence，不只取最后一次结果，也不直接输出能力结论或 Profile 更新决定。`EvaluationContextAdapter` 只负责解析当前有效 Assessment、整理 Eligibility 与冲突上下文，不生成 `EvaluationResult`。

### Phase 14.3：Adaptive Task Constraints

核心问题：

> 根据 Evidence 质量和冲突状态，下一任务应改变哪些可控条件？

最小链路：

```text
Existing NextLearningStrategy
+ EvidenceQualityAssessment[]
+ EvidenceConflictAssessment
↓
AdaptiveTaskConstraints
↓
Strategy / Constraints Alignment Validation
↓
TaskRequest
↓
TaskFulfillment
```

Phase 14.3 只生成结构化任务约束，不直接拼题，不直接选择页面内容，也不绕过 Strategy Validation 或 TaskFulfillment。Constraints 只能具体化既有 Strategy，不能生成与 Strategy 目标相反的任务。

## 六、完整目标链路

```text
Formal AbilityEvidence[]
+ Formal Runtime Context
↓
Phase 14.1 EvidenceQualityAssessment[]
↓
Phase 14.2 EvidenceConflictAssessment
↓
EvaluationContextAdapter
↓
Evaluation Runtime Capability Negotiation
├─ supported
│  ↓
│  Existing Phase 8 Evaluation Runtime（只执行一次）
│  ↓
│  EvaluationResult
│  ↓
│  ProfileUpdateDecision
│  ↓
│  GrowthMemoryRecord / GrowthMemorySummary
│  ↓
│  Existing NextLearningStrategy
│  + Quality / Conflict Context
│  ↓
│  Phase 14.3 AdaptiveTaskConstraints
│  ↓
│  Strategy / Constraints Alignment Validation
│  ↓
│  TaskRequest
│  ↓
│  TaskFulfillment
│  ↓
│  TaskResource / ConcreteLearningTask
│  ↓
│  StudentResponse
│  ↓
│  新的 AbilityEvidence
│
└─ unsupported
   ↓
   blocked / collect more Evidence / discriminating observation
```

该链路中只有 Existing Phase 8 可以产生正式 `EvaluationResult` 与 `ProfileUpdateDecision`。

正式执行顺序必须满足：

1. Phase 14.1 先为单条 Evidence 生成当前有效质量 Assessment；
2. Phase 14.2 再协调同一能力下的独立观察；
3. `EvaluationContextAdapter` 同时保留 raw Evidence、去重后的主要输入和 supporting context；
4. Adapter 根据 Conflict Status 派生所需 Evaluation capabilities；
5. 只有当前 Runtime 明确支持全部 capabilities 时，才允许 quality-aware handoff；
6. Existing Phase 8 Evaluation 在兼容链路中只执行一次；
7. Existing Phase 8 完成正式 Evaluation、Profile Decision 与 GrowthMemory；
8. Existing NextLearningStrategy 形成教育策略；
9. Phase 14.3 只在该 Strategy 范围内生成任务约束；
10. Strategy 与 Constraints 对齐后才允许创建 TaskRequest。

## 七、核心数据对象

Phase 14 计划新增三个关键对象：

```text
EvidenceQualityAssessment
EvidenceConflictAssessment
AdaptiveTaskConstraints
```

### EvidenceQualityAssessment

表示一条正式 Evidence 在已知任务与执行上下文中的判断价值。

它不表示学生能力高低。

### EvidenceConflictAssessment

表示同一学生、同一能力下多条 Evidence 的方向关系、可解释差异和剩余冲突。

它不替代 `EvaluationResult`。

### AdaptiveTaskConstraints

表示下一任务为了获得更有区分度 Evidence，应满足的任务目的、难度、材料和提示条件。

它不替代 `NextLearningStrategy`、`TaskRequest` 或 `TaskFulfillmentRequest`。

### EvaluationContextAdapter

`EvaluationContextAdapter` 是 Phase 14.2 与 Existing Phase 8 之间的单向适配边界。

它只负责：

- 选择每条 Evidence 当前唯一有效的 Quality Assessment；
- 按 observation unit 整理独立观察；
- 通过正式任务、材料、执行与时间事实派生 comparison context；
- 标记 eligible、limited、blocked 和 review_required Evidence；
- 同时保留 raw Evidence、主要 Evaluation Evidence 和 supporting context；
- 每个 eligible 的纯方向 observation unit 最多选择一条确定性代表 Evidence 进入主要 Evaluation 输入；
- 把同一 observation unit 的其余 Evidence、limited Evidence 和 insufficient Evidence 保留为 supporting context；
- 传递 EvidenceConflictAssessment；
- 显式区分 legacy full evidence 与 quality-aware primary evidence 模式；
- 根据 Conflict Status 派生所需 Evaluation capabilities，并校验当前 Runtime Contract；
- 保留全部正式 Evidence ID 与 Assessment ID。

它不负责判断能力是否稳定、改善或下降，也不直接生成 EvaluationResult。代表 Evidence 不得静默替换 Existing Phase 8 的原始输入语义；Runtime 不支持所需能力时，quality-aware handoff 必须阻断。

## 八、质量与方向分离原则

Evidence 方向与 Evidence 质量必须分离：

```text
Evidence direction
= weakness / positive / growth / insufficient

Evidence quality
= high / medium / low / insufficient
```

正式规则：

1. `high-quality positive` 表示正向表现的观察条件可靠；
2. `high-quality weakness` 表示薄弱表现的观察条件可靠；
3. `low-quality positive` 仍是正向表现，但不足以支持稳定结论；
4. `low-quality weakness` 不能被静默删除，但应限制其判断影响；
5. `insufficient` Evidence 不参与强弱方向比较；
6. Evidence 质量高不等于学生能力高；
7. Evidence 质量低不等于本次表现失败。

### Assessment 版本与观察单元

`AbilityEvidence` 保持不可变，但它的质量解释可以随着正式上下文补齐而产生新版本。

每个 `EvidenceQualityAssessment` 必须保留：

```text
contextFingerprint
policyVersion
observationUnitId
supersedesAssessmentId（可选）
```

正式规则：

1. 新 Assessment 通过 `supersedesAssessmentId` 替代旧版本，旧版本保留但不再参与正式协调；
2. 正式消费只使用同一 Evidence 替代链末端、validation passed 的唯一当前版本；
3. 无法定位唯一当前版本时进入 review_required，不得默认使用 medium；
4. `observationUnitId` 必须根据正式 student、task、execution 和 response 事实派生；
5. 不同 Evidence ID 如果来自同一 Response 或 TaskExecution，只能算一个独立观察单元；
6. 同一 observation unit 中的 Evidence 可以全部保留，但不得重复增加协调权重；
7. 不同 observation unit 如果来自高度同质的任务、材料和观察时间窗口，也不得被无限累加为多次高区分度观察；
8. Phase 14.2 必须保留同质性限制，并在需要时安排更换材料、延迟观察或迁移验证。

## 九、正式事实派生原则

Phase 14 不信任调用方直接指定的派生结论。

以下结论必须由 Agent 根据正式 Runtime 对象重新派生或核验：

- 作答是否有效；
- 任务能力是否对齐；
- 是否独立完成；
- 提示依赖程度；
- 原题、相似题或迁移题关系；
- 即时或延迟观察；
- Diagnosis 是否合法并与任务对齐；
- Evidence 是否具备完整追溯链；
- 任务难度关系是否可比较。

调用方可以提供正式来源对象或事实快照，但不能通过传入 `qualityLevel = high`、`independentPerformance = true` 等派生字段绕过 Agent。

## 十、提示、迁移和延迟规则

### 提示依赖

```text
使用提示
≠ 作答失败
≠ Evidence 无效
≠ 独立掌握
```

提示次数、提示强度和提示内容应作为 Evidence 独立性限制保存。

### 迁移任务

任务被称为迁移任务前，至少必须确认：

- 目标能力一致；
- 材料或情境具有真实新颖性；
- 核心评价依据仍然有效；
- 难度没有明显失控；
- 作答有效；
- Diagnosis 与目标能力对齐。

题目文字不同，不足以自动证明发生迁移。

### 延迟观察

延迟 Evidence 的时间关系必须来自正式时间戳、Session History 或 DelayedRetestPlan。

Evidence 时间较晚只表示观察发生在更远时间点，不自动表示质量更高，也不自动表示能力保持或退化。

## 十一、冲突协调原则

Phase 14.2 必须区分：

```text
aligned_positive_evidence
aligned_weakness_evidence
explainable_mixed_evidence
unresolved_conflict
insufficient_comparable_evidence
review_required
```

建议语义：

- `aligned_positive_evidence`：至少两个独立、可比较 observation unit 主要呈正向，且没有不可解释的反向 Evidence；
- `aligned_weakness_evidence`：至少两个独立、可比较 observation unit 主要呈薄弱，且没有不可解释的正向 Evidence；
- `explainable_mixed_evidence`：方向不同，且正式条件差异达到足够的协调解释强度；
- `unresolved_conflict`：可比较、质量较高的独立观察仍指向相反方向；
- `insufficient_comparable_evidence`：只有 0–1 个独立可比较观察，或有效、对齐的 Evidence 不足。
- `review_required`：身份、版本、追溯、Comparison Context 或 Runtime Contract 存在不安全问题。

存在条件差异不等于足以解释方向差异。Phase 14.2 必须记录 Difference Factor，并区分 `strong / plausible / insufficient`；至少一个 strong 或两个方向一致的 plausible Factor，才允许进入 `explainable_mixed_evidence`。

这些状态只描述当前纳入比较的 Evidence 方向关系，不表示 StudentAbilityProfile 的正式状态。

Phase 14.2 的处理顺序必须是：

```text
解析当前有效 Assessment
-> 按 observationUnitId 去重和聚类
-> 从正式 Runtime 事实派生 Comparison Context
-> 识别高度同质的任务、材料和观察窗口
-> 过滤 insufficient 方向判断
-> 按质量、提示、难度、材料、时间和任务角色分组
-> 判断 Difference Factor 的解释强度
-> 输出 EvidenceConflictAssessment
```

冲突 Evidence 不得被简单平均，也不得只保留最后一条。low-quality Evidence 必须保留其限制和来源，但不得与 high-quality Evidence 等量参与协调。

## 十二、与 Existing Phase 8 的边界

Phase 14 可以：

- 为 Evidence 生成质量 Assessment；
- 解释同一能力下的 Evidence 关系；
- 建议继续观察、区分性复测或人工复核；
- 为 `NextLearningStrategy` 和任务请求生成结构化约束；
- 向 Existing Phase 8 提供受控的质量上下文。

质量上下文进入 Existing Phase 8 前必须完成 Runtime Capability Negotiation。当前 Runtime 若未声明支持 `quality_context`、`conflict_context`、`limited_evidence` 或 `do_not_resolve_conflict_automatically` 中的所需能力，就不得仅附带上下文字段后继续执行。

旧 Phase 8 可以继续使用 `legacy_full_evidence` 保持原有语义，但该模式不得被宣称为已经应用 Phase 14 的 Observation Unit 去重、质量限制或冲突保护。

Phase 14 不可以：

- 直接修改 `AbilityEvidence` 的方向；
- 直接修改 `StudentAbilityProfile`；
- 创建第二套 `EvaluationResult`；
- 输出能力稳定、能力下降或能力已经改善等正式结论；
- 直接执行 Profile Update；
- 直接生成 `GrowthMemoryRecord`；
- 直接生成题目；
- 静默把代表 Evidence 集合替换为 Existing Phase 8 的原始 Evidence 输入；
- 伪造或默认当前 Evaluation Runtime 已支持 Conflict Context；
- 绕过 Strategy Validation、TaskRequest 或 TaskFulfillment。

## 十三、受控任务自适应边界

`AdaptiveTaskConstraints` 建议至少表达：

```ts
type AdaptiveConstraintRule = {
  code:
    | 'task_role'
    | 'target_ability'
    | 'difficulty'
    | 'material_novelty'
    | 'hint_policy'
    | 'exclude_task'
    | 'exclude_material'
    | 'required_capability';
  operator: 'eq' | 'in' | 'exclude' | 'required';
  value: string | string[] | boolean;
  source: 'strategy' | 'quality' | 'conflict';
};

type AdaptiveTaskConstraints = {
  constraintsId: string;
  studentId: string;
  targetAbilityId: string;

  learningIntent:
    | 'foundation'
    | 'consolidation'
    | 'independent_validation'
    | 'delayed_validation'
    | 'transfer_validation';

  observationTarget:
    | 'verify_independence'
    | 'resolve_direction_conflict'
    | 'verify_transfer'
    | 'verify_retention'
    | 'recheck_weakness'
    | 'strengthen_foundation';

  recommendedTaskRole:
    | 'training'
    | 'retest'
    | 'transfer'
    | 'diagnosis'
    | 'observation';

  difficultyDirection:
    | 'decrease'
    | 'maintain'
    | 'increase';

  materialNovelty:
    | 'same_context'
    | 'similar_context'
    | 'new_context';

  hintPolicy:
    | 'allow_guidance'
    | 'limited_hint'
    | 'no_hint';

  targetEvidenceQuality:
    | 'medium'
    | 'high';

  preExecutionQualityConditions: {
    requireNovelMaterial: boolean;
    requireKnownDifficulty: boolean;
    requireAbilityAlignment: boolean;
    requiredHintPolicy:
      | 'allow_guidance'
      | 'limited_hint'
      | 'no_hint';
    requireTraceability: boolean;
  };

  hardConstraints: AdaptiveConstraintRule[];
  softPreferences: AdaptiveConstraintRule[];

  evidenceQualityAssessmentIds: string[];
  evidenceConflictAssessmentId: string;
  sourceStrategyId: string;
  reasons: string[];
  limitations: string[];
};
```

`learningIntent` 是教学意图，必须映射到既有 `recommendedTaskRole`，不得形成与现有任务角色不兼容的第二套执行协议。

`targetEvidenceQuality` 表示任务设计希望满足的观察条件，不保证学生完成后一定产生对应质量的 Evidence。

`preExecutionQualityConditions` 只描述 TaskFulfillment 在执行前能够保证的任务设计条件。学生是否有效作答、是否实际独立完成、Diagnosis 是否可靠以及最终 Evidence 是否达到目标质量，必须在执行后由 Existing Runtime 与 Phase 14.1 重新判断。

`hardConstraints / softPreferences` 必须使用受控结构化 Rule。TaskFulfillment 不得解析自然语言摘要恢复约束，也不得把 `reasons` 当作正式执行协议。

`observationTarget` 表示下一任务希望消除的主要不确定性，不是能力结论，也不能覆盖 Existing NextLearningStrategy 的 action、targetAbilityId、recommendedTaskRole 或 validationGoal。

Strategy / Constraints Alignment Validation 至少检查：

- studentId 与 targetAbilityId 一致；
- Constraints 的 recommendedTaskRole 与 Strategy 允许的任务角色一致；
- learningIntent 与 Strategy action 不冲突；
- difficultyDirection 不越过 Strategy 的安全边界；
- materialNovelty 与 validationGoal 一致；
- hintPolicy 不违背由 Existing CurrentLearningContext 与正式历史派生的 AdaptiveTaskContextSnapshot；
- sourceStrategyId 可追溯；
- 质量与冲突 Assessment 均为当前有效版本。

发生冲突时必须阻断 TaskRequest，并进入 `regenerate_strategy` 或 `review_required`，不得让 Constraints 反向改写 Strategy。

Phase 14.3 不扩写 Existing `CurrentLearningContext` Schema。它通过 `AdaptiveTaskContextSnapshot` 固化当前难度、最近任务 / 材料、允许的 task role 与 hint policy；Context 只能限制执行条件，不能改变 Strategy 的教育方向。权威顺序为：

```text
NextLearningStrategy
> AdaptiveTaskContextSnapshot
> AdaptiveTaskConstraints
```

Existing `TaskRequest.constraints` 只保留兼容摘要，`AdaptiveTaskConstraints` 才是正式结构化约束来源。Adaptive 路径必须通过 `AdaptiveTaskRequestEnvelope` 同时传递 TaskRequest、Constraints 与 Alignment Result；TaskFulfillment 不得从摘要字符串重建完整约束。

## 十四、最小验收场景

Phase 14 总体验收至少覆盖：

1. 无提示、延迟、新材料迁移成功；
2. 多提示、即时、原题成功；
3. 无提示迁移失败，形成 high-quality weakness；
4. 即时表现较好、延迟表现较弱；
5. 原题表现较好、迁移任务表现较弱；
6. 简单题表现较好、较难题表现较弱；
7. high-quality weakness 与 low-quality positive 并存；
8. 两条可比较 high-quality Evidence 方向相反；
9. Evidence 上下文缺失；
10. Diagnosis 与任务能力不对齐；
11. 调用方伪造独立完成或迁移状态；
12. 重复 Evidence 输入不增加判断权重；
13. 冲突状态生成区分性任务约束；
14. 连续独立迁移正向 Evidence 生成提高难度或降低优先级的候选约束；
15. 所有任务约束继续进入 Existing TaskRequest / TaskFulfillment；
16. 同一 Response 产生多个 Evidence ID，但只形成一个独立 observation unit；
17. 同一 Evidence 的新版 Assessment supersede 旧版，正式协调只消费当前版本；
18. Constraints 与 Strategy 冲突时阻断，不生成 TaskRequest；
19. 无法定位唯一当前 Quality Assessment 时进入 insufficient 或 review_required，不默认按 medium 继续；
20. 多个 Response 虽然 ID 不同，但任务、材料和观察窗口高度同质时，不被无限累加为多次强证据；
21. 条件存在差异但解释强度不足时，不自动输出 explainable mixed；
22. raw Evidence、主要代表 Evidence 和 supporting context 可以完整核对；
23. Current Phase 8 不支持 Conflict Context 时，unresolved conflict handoff 被阻断；
24. 同一 Observation Unit 的 growth 与 positive 均保留原始语义，但不会重复增加观察次数；
25. Context 不允许 Strategy 指定的 role 或 hint policy 时阻断，不修改 Strategy 后继续；
26. TaskFulfillment 通过 AdaptiveTaskRequestEnvelope 消费结构化 Rule，不从 TaskRequest.constraints 摘要反向解析；
27. targetEvidenceQuality 未在真实执行后达成时，由 Phase 14.1 重新评估新 Evidence，不修改旧 Constraints，也不将其判为 Phase 14.3 Runtime 失败。

## 十五、Phase 14 总体验收标准

Phase 14 完成时，应能证明：

1. Evidence 质量可以由正式 Runtime 事实派生；
2. 质量等级与 Evidence 方向完全分离；
3. 提示依赖不会被错误解释为失败或独立掌握；
4. 迁移、延迟和难度关系不会仅凭文本或调用方声明确认；
5. 缺少上下文的 Evidence 不会被强行判为高质量；
6. 重复 Evidence 不会重复增加判断价值；
7. 多条 Evidence 不会只按最后一次结果覆盖历史；
8. 可解释的方向差异与真实冲突能够区分；
9. 冲突时允许暂不更新、继续观察或人工复核；
10. Phase 14 不创建第二套 Profile 更新链路；
11. Existing Phase 8 Evaluation 在完整链路中只执行一次；
12. Assessment 支持不可变版本追溯，正式消费只使用唯一当前版本；
13. 同一 Response 或 TaskExecution 的关联 Evidence 不会被视为多次独立观察；
14. 0–1 个独立可比较观察不会被声明为方向一致；
15. 高度同质的观察不会被无限累加为多次高区分度 Evidence；
16. independentContextCount 只基于可验证的 Comparison Context 差异增加；
17. 存在条件差异不会自动被解释为表现变化原因；
18. Adapter 同时保留 raw Evidence、主要代表 Evidence 和 supporting context；
19. legacy 模式不会被误认为已经应用 Phase 14 质量保护；
20. Runtime 不支持所需 capabilities 时 quality-aware handoff 会阻断；
21. AdaptiveTaskConstraints 能映射到既有 Strategy / TaskRequest / TaskFulfillment；
22. Constraints 与 Strategy 冲突时会阻断；
23. Adaptive Constraints 使用受控结构化 Rule，而不是自然语言执行协议；
24. Existing CurrentLearningContext 不被重定义，AdaptiveTaskContextSnapshot 可追溯；
25. targetEvidenceQuality 与执行前可保证条件明确分离；
26. AdaptiveTaskRequestEnvelope 是 Adaptive 路径进入 TaskFulfillment 的正式交接对象；
27. 执行后的实际 Evidence 质量由 Phase 14.1 重新判断；
28. Debug 可重复运行；
29. Existing Phase 8、Phase 9、Phase 12、Phase 13 回归通过；
30. Production Build 通过。

## 十六、本阶段不做

Phase 14 不做：

- 不做机器学习权重模型；
- 不做自动训练权重；
- 不做全量知识图谱；
- 不做大规模题目难度标定；
- 不做正式推荐算法；
- 不做无限自动出题；
- 不做完整 AI Coach；
- 不做家长端；
- 不做成长曲线；
- 不做多学生统计；
- 不证明长期教学效果；
- 不修改 DiagnosisResult Schema；
- 不直接修改 AbilityEvidence Schema。

## 十七、阶段完成定义

Phase 14 完成时，系统应能证明：

```text
同一方向的表现可以因为提示、时间、材料和任务条件不同而具有不同判断价值；
方向不同的 Evidence 可以被保守协调而不覆盖历史；
质量与冲突结果只有在 Runtime 能力兼容时，才可以通过既有评估、策略和任务链改变下一次观察条件。
```

完成后的准确产品能力是：

> 系统能够根据正式任务、作答、提示、时间与追溯事实，为 AbilityEvidence 生成可版本追踪的质量解释；能够区分方向一致、条件差异可解释、真实冲突和证据不足；并在不创建第二套 Evaluation 或画像更新链路的前提下，将这些结果转换为与既有学习策略一致的任务约束。

这不表示自适应策略已经具备长期教学有效性，也不表示学生能力已经稳定提升。

## 十八、总体集成验收与冻结记录

冻结日期：2026-07-17
验收结论：PASS / FROZEN
通过性质：Evidence Quality、Conflict Coordination 与 Adaptive Task Constraints 最小闭环及执行后质量重评集成通过。

正式冻结结论：

> 系统能够根据正式任务、作答、提示、时间和追溯事实评估 Evidence 的判断价值，协调多条 Evidence 的方向关系，并在 Existing Strategy 的边界内生成受控任务约束；任务执行后，系统会依据真实表现重新评估 Evidence 质量，而不会把目标质量当成实际结果。

本次总体集成验收补充验证 Case 27：

```text
AdaptiveTaskConstraints.targetEvidenceQuality = high
-> 正式 TaskExecution
├─ 有效作答但使用 3 次提示
│  -> AbilityEvidence 正常回流
│  -> Existing Phase 8 Runtime 只通过既有 Phase 9.3 链路执行
│  -> Phase 14.1 重新评估为 low / limited
│
└─ 占位回答“不知道”
   -> submitted_invalid
   -> blocked_invalid_execution
   -> 不生成正式 AbilityEvidence
   -> 不触发 Evaluation / ProfileUpdateDecision / GrowthMemoryRecord
```

验收结果：

- `debug:phase14-integration`：16 / 16 PASS；
- Phase 14.1：17 / 17 PASS；
- Phase 14.2：25 / 25 PASS；
- Phase 14.3：26 / 26 PASS；
- Phase 9.3、Phase 12 Integrated Acceptance、Phase 13.3 回归：PASS；
- Production Build：PASS。

本次验证证明：

1. `targetEvidenceQuality` 是任务观察目标，不是执行结果承诺；
2. 执行后的实际质量必须由 Phase 14.1 基于正式事实重新评估；
3. 实际质量未达到目标不会反向修改旧 `AdaptiveTaskConstraints`；
4. 使用提示的有效作答仍可形成 Evidence，但独立性与质量受到限制；
5. 无效作答不会为了完成质量评估而伪造 Evidence；
6. 质量评估不会重复执行或旁路 Existing Phase 8 正式更新链路；
7. 相同输入保持稳定 Evidence 身份，可由正式去重边界消费。

冻结后仍保留以下边界：

- Existing Phase 8 当前仍保留 legacy Evaluation Contract；未声明 Conflict Context 能力时，quality-aware handoff 继续阻断；
- 本阶段不证明自适应任务具有真实教学效果；
- 本阶段不证明学生能力已经长期提升；
- 本阶段不证明真实 AI Diagnosis 在全部任务上稳定可靠；
- Vite Production Build 仍存在既有的大 chunk 警告，不影响本次 Runtime 验收。
