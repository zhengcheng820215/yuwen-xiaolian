# Phase 14.1：Evidence Quality Assessment 最小闭环（证据质量评估）

## 一、阶段目标

Phase 14.1 只解决一个核心问题：

```text
一条正式 AbilityEvidence 在当前任务、作答、提示、时间和诊断上下文中，
对长期能力判断的价值有多高？
```

一句话定义：

> 根据正式 Runtime 对象派生 Evidence 质量事实，并生成与 Evidence 方向分离、可追溯、可复核的 EvidenceQualityAssessment。

Phase 14.1 不协调多条冲突 Evidence，不更新 StudentAbilityProfile，不生成下一任务。

Phase 14.1 也不直接调用 Existing Phase 8 Evaluation。它只输出供 Phase 14.2 和后续 `EvaluationContextAdapter` 消费的质量 Assessment。

## 二、阶段背景

Existing Phase 8 已经能够消费 `AbilityEvidence[]` 并生成：

```text
EvaluationResult
-> ProfileUpdateDecision
-> GrowthMemoryRecord
```

但当前 Evidence 主要包含：

- 方向：`weakness / positive / growth / insufficient`；
- 来源：`diagnosis / training / retest`；
- confidence；
- observation / rootCause；
- taskId / diagnosisId。

这些字段不足以独立说明：

- 学生是否在没有提示时完成；
- 是否为原题重复、相似题或新材料迁移；
- 是否属于即时观察或延迟观察；
- 作答是否有效；
- Diagnosis 是否与目标能力对齐；
- Evidence 是否具有完整追溯链；
- 当前任务难度是否适合比较。

Phase 14.1 不把这些字段硬塞回 `AbilityEvidence`，而是通过正式上下文生成独立质量 Assessment。

## 三、最小链路

```text
AbilityEvidence
+ ConcreteLearningTask
+ TaskExecutionResult
+ TaskEvidenceReturnResult / DiagnosisResult
+ optional Retention Context
+ Evaluation Time
↓
Identity / Traceability Validation
↓
EvidenceQualityFacts Derivation
↓
EvidenceQualityAssessment
```

该链路只评估 Evidence 的观察条件，不重新判断答案正确性，也不改变 Evidence 方向。

## 四、输入

建议输入：

```ts
type EvidenceQualityAssessmentInput = {
  studentId: string;
  targetAbilityId: string;

  abilityEvidence: AbilityEvidence;
  concreteLearningTask: ConcreteLearningTask;
  taskExecutionResult: TaskExecutionResult;
  taskEvidenceReturnResult: TaskEvidenceReturnResult;

  retentionContext?: {
    delayedRetestPlanId?: string;
    baselineTaskId?: string;
    materialRelation?:
      | 'same_material'
      | 'similar_material'
      | 'new_material'
      | 'unknown';
    difficultyRelation?:
      | 'lower'
      | 'comparable'
      | 'higher'
      | 'unknown';
  };

  assessedAt: string;
  timezone: string;
};
```

输入必须优先使用既有正式 Schema。

不得为了 Phase 14.1 复制 `AbilityEvidence`、`ConcreteLearningTask`、`TaskExecutionResult`、`DiagnosisResult` 或 `RetentionComparisonFacts` 模型。

## 五、输入可信边界

调用方提供的是正式来源对象，不是最终质量结论。

Agent 必须重新核验：

- `studentId` 一致；
- Evidence ability 与 `targetAbilityId` 一致；
- Evidence taskId 与 ConcreteLearningTask 一致；
- executionSessionId、responseId、diagnosisId 可追溯；
- TaskExecutionResult 允许进入 Diagnosis；
- TaskEvidenceReturnResult 已生成正式 Evidence；
- Evidence ID 出现在正式回流结果中；
- Diagnosis mainAbility 与目标能力一致；
- 提示信息来自正式 StudentResponse / TaskExecutionResult；
- 时间顺序合法；
- Retention Context 与正式计划、任务或比较结果一致。

调用方不得直接决定：

- `qualityLevel`；
- `independentPerformance`；
- `hintDependency`；
- `taskNovelty`；
- `timingType`；
- `diagnosisReliable`；
- `evaluationEligibility`。

若调用方额外提供这些字段，Agent 也必须忽略或重新计算。

## 六、输出

建议输出：

```ts
type EvidenceQualityLevel =
  | 'low'
  | 'medium'
  | 'high'
  | 'insufficient';

type EvidenceEvaluationEligibility =
  | 'eligible'
  | 'limited'
  | 'blocked'
  | 'review_required';

type EvidenceQualityFacts = {
  responseValid: boolean;
  taskAbilityAligned: boolean;
  diagnosisAligned: boolean;
  traceabilityComplete: boolean;

  independentPerformance: boolean;
  usedHint: boolean;
  hintCount: number;
  hintDependency:
    | 'none'
    | 'low'
    | 'medium'
    | 'high'
    | 'unknown';

  taskNovelty:
    | 'same'
    | 'similar'
    | 'transfer'
    | 'unknown';

  timingType:
    | 'immediate'
    | 'delayed'
    | 'unknown';

  taskRole:
    | 'training'
    | 'retest'
    | 'transfer'
    | 'diagnosis'
    | 'observation';

  difficultyRelation:
    | 'lower'
    | 'comparable'
    | 'higher'
    | 'unknown';

  diagnosisReliable: boolean;
};

type EvidenceQualityAssessment = {
  assessmentId: string;
  evidenceId: string;
  studentId: string;
  abilityId: string;
  observationUnitId: string;
  contextFingerprint: string;
  policyVersion: string;
  supersedesAssessmentId?: string;
  evidenceType:
    | 'weakness'
    | 'positive'
    | 'growth'
    | 'insufficient';

  qualityLevel: EvidenceQualityLevel;
  evaluationEligibility: EvidenceEvaluationEligibility;
  facts: EvidenceQualityFacts;

  qualityReasons: string[];
  limitations: string[];

  sourceLinks: {
    taskId: string;
    executionSessionId: string;
    responseId: string;
    diagnosisResultId: string;
    taskEvidenceReturnId: string;
    delayedRetestPlanId?: string;
  };

  schemaVersion: 'evidence_quality_assessment_v1';
  assessedAt: string;

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

`taskEvidenceReturnId` 必须直接引用既有 `TaskEvidenceReturnResult.returnId`，不得为 Phase 14.1 重新生成另一套 Evidence Return 标识。

`evidenceType` 只复制正式 `AbilityEvidence.evidenceType`，EvidenceQualityAgent 不得修改它。

`observationUnitId` 必须根据正式 `studentId + taskId + executionSessionId + responseId` 派生，用于识别同一次作答产生的关联 Evidence。

`contextFingerprint` 必须根据正式来源对象 ID、Schema Version 与影响质量判断的关键上下文确定性生成，不能由调用方自由指定。

`policyVersion` 标识本次质量分级规则版本。Assessment 是不可变派生对象；上下文或政策变化时新增 Assessment，不覆盖旧记录。

## 七、质量等级语义

### high

表示 Evidence 的观察条件较完整，能够较可靠地进入后续 Evidence 协调和 Existing Phase 8 Evaluation。

典型条件：

- 作答有效；
- 任务与能力对齐；
- Diagnosis 合法且对齐；
- 追溯链完整；
- 无提示独立完成；
- 任务具有可确认的新颖性或延迟性；
- 难度关系可比较。

`high` 可以对应 positive，也可以对应 weakness。

### medium

表示 Evidence 有效且可用于判断，但存在有限限制。

典型情况：

- 少量提示后完成；
- 即时复测但无提示；
- 相似材料中的有效表现；
- 任务有效但新颖性或难度关系有限；
- Diagnosis 可靠，但观察条件不是最强。

### low

表示 Evidence 仍然记录了有效表现，但独立性、区分度或可比性较弱。

典型情况：

- 多次提示后完成；
- 原题或高度相似题即时重复；
- 难度明显较低；
- 观察条件有限但尚未达到阻断标准。

`low` Evidence 不得被删除，也不得被解释为失败。

### insufficient

表示无法形成可靠质量判断，或 Evidence 本身不具备进入长期协调的基本条件。

典型情况：

- 作答无效；
- Evidence type 为 insufficient；
- 任务能力不对齐；
- Diagnosis 非法或明显错位；
- 核心 ID 不一致；
- 正式追溯链缺失；
- 必要上下文缺失且无法安全派生。

## 八、Evaluation Eligibility 规则

### eligible

质量为 high 或具备完整判断条件的 medium，可进入后续 Evidence 协调。

### limited

Evidence 有效但质量较低或存在明确限制，可保留和参考，但不得单独支持稳定能力结论。

### blocked

存在身份错位、无效作答、非法 Diagnosis、追溯断裂等硬错误，不得进入正式 Evidence 协调。

### review_required

数据基本完整，但关键事实相互矛盾或无法自动确认，需要人工或后续 Runtime 复核。

Phase 14.1 的 eligibility 只表示是否可进入后续 Evidence 解释，不是 Profile 更新许可。

## 九、质量派生顺序

Agent 应按以下顺序处理：

1. 校验输入对象结构；
2. 校验 studentId、abilityId 和 taskId；
3. 校验 executionSessionId、responseId、diagnosisId 和 evidenceId 追溯；
4. 校验 Response Validity；
5. 校验 Diagnosis 与任务能力对齐；
6. 从正式执行结果派生提示依赖；
7. 从正式任务比较事实派生任务新颖性和难度关系；
8. 从正式时间、Session 或 DelayedRetestPlan 派生 timingType；
9. 生成 EvidenceQualityFacts；
10. 先执行硬阻断规则；
11. 再根据限制条件生成 qualityLevel；
12. 生成 evaluationEligibility；
13. 输出质量原因、限制和 validation issues。

不得先计算分数再用分数覆盖硬阻断规则。

## 十、第一版质量规则

第一版不使用 0—100 权重模型。

建议使用确定性分级规则：

```text
Hard invalid / identity mismatch / traceability broken
-> insufficient + blocked

Valid + aligned + traceable + no hint + confirmed transfer/delayed context
-> high + eligible

Valid + aligned + traceable + independent immediate/similar context
-> medium + eligible

Valid + aligned + traceable + limited hint or limited comparability
-> medium + limited

Valid + aligned + traceable + high hint dependency / same task immediate repeat
-> low + limited

Context conflict without hard invalidation
-> insufficient or low + review_required
```

当多个规则同时匹配时，应优先采用更保守的质量等级，并在 `limitations` 中说明原因。

## 十一、提示依赖规则

提示依赖至少应参考：

- `usedHint`；
- `hintCount`；
- 是否在提示前已有有效回答；
- 提示是否直接给出关键答案；
- 提示后是否仍由学生完成核心能力动作。

第一版如果无法识别提示内容强度，可以仅根据正式 `usedHint / hintCount` 形成保守分级，并记录限制。

正式边界：

```text
无提示完成
-> 可支持 independentPerformance

使用提示后完成
-> 仍可形成有效 Evidence
-> 不得标记为完全独立表现
```

## 十二、任务新颖性规则

`taskNovelty` 不得通过题目字符串是否不同判断。

至少应参考：

- source task / resource ID；
- reading material ID；
- `materialRelation`；
- taskRole；
- targetAbilityId；
- validationGoal；
- difficultyRelation；
- Rubric 或评分依据是否仍然对齐。

无法确认时必须输出 `unknown`，不得自动标记为 `transfer`。

## 十三、时间类型规则

`timingType = delayed` 至少需要以下来源之一：

- 正式 `DelayedRetestPlan`；
- 可追溯的 baseline Evidence 时间与 delayed Evidence 时间；
- 合法 Session History 与明确时间规则。

仅根据 `source = retest` 不能证明是 delayed。

无法确认正式时间关系时输出 `unknown`。

## 十四、Diagnosis 可靠性边界

`diagnosisReliable` 第一版至少要求：

- DiagnosisResult Schema valid；
- mainAbility 与任务目标能力一致；
- studentId、taskId、responseId 可追溯；
- normalize 未标记 invalid；
- TaskEvidenceReturnResult validation passed；
- AbilityEvidence 确实由该 Diagnosis 生成。

模型 confidence 较高不能覆盖身份错位、Schema 非法或能力不对齐。

## 十五、幂等与追溯规则

1. 同一 Evidence ID、contextFingerprint、policyVersion 应生成稳定 Assessment ID；
2. 重复调用不得产生多份相互独立的质量权重；
3. Assessment 必须保留 taskId、executionSessionId、responseId、diagnosisResultId 和 taskEvidenceReturnId；
4. 上下文或质量政策发生正式变化时，应生成新 assessmentId，并通过 `supersedesAssessmentId` 保留替代关系；
5. 不得通过复制 Evidence 并更换 ID 增加判断权重；
6. 不同 Evidence ID 如果来自同一 observationUnitId，不得在 Phase 14.2 中作为多次独立观察累加；
7. validation 未通过的 Assessment 不得进入 Phase 14.2；
8. 旧 Assessment 不删除，但正式消费只使用替代链末端、validation passed 的唯一当前版本；
9. 无法定位唯一当前版本时进入 review_required，不得默认选取最新时间或默认 medium。

### 当前有效 Assessment 选择规则

对于同一 Evidence：

```text
Assessment v1
↓ superseded by
Assessment v2
↓ superseded by
Assessment v3
```

正式消费只使用 `v3`。

如果出现分叉替代链、循环引用、多个末端版本或 policyVersion 无法识别，必须进入 `review_required`。

Phase 14.1 不需要建设复杂 Assessment Repository，但 Schema、Agent 输出和 Debug 必须证明版本链可以被确定性解析。

## 十六、失败与复核分支

### blocked

以下情况应阻断：

- studentId 不一致；
- taskId 不一致；
- executionSessionId 或 responseId 不可追溯；
- Response 无效；
- Diagnosis Schema 非法；
- AbilityEvidence 不属于本次 Evidence Return；
- Evidence ability 与 targetAbilityId 明显不一致。

### review_required

以下情况应进入复核：

- taskRole 声称 transfer，但材料关系无法确认；
- usedHint 与 hintCount 事实冲突；
- timingType 声称 delayed，但缺少正式时间来源；
- Diagnosis 通过 Schema，但能力对齐存在歧义；
- 难度关系未知且会影响质量级别；
- 正式对象完整，但来源事实之间互相矛盾。

## 十七、Debug 最小流程

```text
1. 准备正式 AbilityEvidence
2. 准备 ConcreteLearningTask
3. 准备 TaskExecutionResult
4. 准备 TaskEvidenceReturnResult
5. 可选准备 Retention Context
6. 调用 EvidenceQualityAssessmentAgent
7. 重新派生 EvidenceQualityFacts
8. 生成 EvidenceQualityAssessment
9. 校验质量与 Evidence 方向分离
10. 校验身份、追溯、幂等和失败分支
11. 输出 PASS / FAIL
```

## 十八、Debug Report

Debug Report 至少展示：

- Case ID；
- Evidence ID；
- Student ID；
- Ability ID；
- Evidence Type；
- Task Role；
- Response Valid；
- Ability Aligned；
- Diagnosis Aligned；
- Traceability Complete；
- Used Hint / Hint Count；
- Hint Dependency；
- Task Novelty；
- Timing Type；
- Difficulty Relation；
- Quality Level；
- Evaluation Eligibility；
- Quality Reasons；
- Limitations；
- Observation Unit ID；
- Context Fingerprint；
- Policy Version；
- Supersedes Assessment ID；
- Validation Issues；
- PASS / FAIL。

## 十九、最小 Debug Case

### Case 1：无提示延迟迁移 positive

```text
有效回答
+ 新材料
+ 延迟复测
+ 无提示
+ Diagnosis 对齐
-> high / eligible
```

### Case 2：多提示即时原题 positive

```text
有效回答
+ 原题重复
+ 即时
+ 多次提示
-> low / limited
```

不能支持稳定掌握判断。

### Case 3：无提示延迟迁移 weakness

```text
有效回答
+ 新材料
+ 延迟复测
+ 无提示
+ Evidence = weakness
-> high / eligible
```

证明 high quality 不等于 positive。

### Case 4：少量提示、相似材料 growth

```text
有效回答
+ 相似材料
+ 少量提示
-> medium / limited
```

### Case 5：简短但有效回答

回答较短，但表达了可观察表现并通过 Response Validity。

预期：不得仅因字数少判为 insufficient。

### Case 6：无效回答

```text
ResponseValidity = invalid
-> insufficient / blocked
```

### Case 7：Diagnosis 能力不对齐

```text
Diagnosis mainAbility != targetAbilityId
-> insufficient / blocked 或 review_required
```

不得形成高质量判断。

### Case 8：追溯 ID 错位

taskId、executionSessionId、responseId 或 diagnosisId 任一错位。

预期：阻断，不进入 Phase 14.2。

### Case 9：调用方伪造独立完成

正式 TaskExecutionResult 显示使用提示，但调用方附加 `independentPerformance = true`。

预期：Agent 忽略伪造字段，重新计算为非独立表现。

### Case 10：调用方伪造迁移状态

材料关系为 unknown 或 same，但调用方声明 transfer。

预期：不得生成 transfer quality bonus，进入 limited 或 review_required。

### Case 11：缺少上下文

Evidence 合法，但无法获得正式 TaskExecutionResult 或任务比较事实。

预期：`insufficient` 或保守 `low`，不得输出 high。

### Case 12：重复 Evidence

同一 Evidence 和同一正式上下文重复执行两次。

预期：Assessment ID 稳定，不增加判断权重。

### Case 13：Evidence type = insufficient

预期：qualityLevel = insufficient，不参与方向判断。

### Case 14：高 confidence 但 Schema 非法

预期：confidence 不得覆盖硬错误，结果 blocked。

### Case 15：上下文补齐后生成新版 Assessment

同一 Evidence 首次缺少材料关系，随后补齐正式 TaskResource、提示记录和追溯事实。

预期：

- Evidence 本身不变；
- 生成新的 contextFingerprint 与 assessmentId；
- 新 Assessment 通过 `supersedesAssessmentId` 指向旧版本；
- 旧版本保留但不再作为当前有效版本。

### Case 16：同一 Response 产生多个关联 Evidence

多个不同 Evidence ID 来源于同一 taskId、executionSessionId 和 responseId。

预期：

- 每条 Evidence 可以生成独立 Quality Assessment；
- Assessment 具有相同 observationUnitId；
- 后续协调只能视为一次独立观察。

### Case 17：Assessment 版本链冲突

同一 Evidence 出现两个互不替代的当前 Assessment。

预期：无法选择唯一当前版本，进入 review_required。

## 二十、验收标准

Phase 14.1 通过条件：

1. 已定义 `EvidenceQualityFacts`；
2. 已定义 `EvidenceQualityAssessment`；
3. Agent 能消费正式 AbilityEvidence 和 Runtime 上下文；
4. 质量事实由 Agent 派生，不信任调用方结论；
5. 支持 `high / medium / low / insufficient`；
6. 支持 `eligible / limited / blocked / review_required`；
7. Evidence 质量与 Evidence 方向分离；
8. high-quality weakness 能被正确识别；
9. low-quality positive 不会被解释为稳定掌握；
10. 提示依赖不会被解释为无效或独立掌握；
11. taskNovelty 不依赖题目字符串差异判断；
12. timingType 不只依赖 source = retest；
13. Diagnosis confidence 不能覆盖 Schema 或身份错误；
14. 缺少正式上下文时不会强行输出 high；
15. 身份和追溯错误会阻断；
16. 重复 Evidence 保持幂等；
17. Assessment 包含 contextFingerprint、policyVersion 和 observationUnitId；
18. 上下文变化生成不可变新版本，并保留 supersedes 关系；
19. 正式消费只能解析到唯一当前有效 Assessment；
20. 同一 Response 的多个 Evidence 不会被误认为多次独立观察；
21. validation 未通过的结果不能进入 Phase 14.2；
22. 不修改 AbilityEvidence Schema；
23. 不直接更新 StudentAbilityProfile；
24. 不生成 EvaluationResult、ProfileUpdateDecision 或 GrowthMemoryRecord；
25. Debug 覆盖至少 17 个 Case；
26. Debug 输出 PASS；
27. Phase 13.3、Phase 9.3 和 Phase 12 Integration 回归通过；
28. Production Build 通过。

## 二十一、本阶段不做

Phase 14.1 不做：

- 不协调多条冲突 Evidence；
- 不生成 EvidenceConflictAssessment；
- 不生成 AdaptiveTaskConstraints；
- 不修改 Evidence 方向；
- 不重新调用 Diagnosis Runtime；
- 不更新 StudentAbilityProfile；
- 不执行 Existing Phase 8 Evaluation；
- 不生成下一任务；
- 不计算 0—100 复杂权重；
- 不使用机器学习质量模型；
- 不做 UI；
- 不接家长端；
- 不证明教学效果。

## 二十二、阶段完成定义

Phase 14.1 完成时，应能证明：

```text
相同方向的 AbilityEvidence
在不同提示、时间、材料、任务和诊断条件下
可以形成不同但可解释的 Evidence Quality；

高质量不等于正向，
低质量不等于失败，
缺少正式事实时不会强行形成高价值判断。
```

完成后的准确能力是：

> 系统能够根据正式任务执行与诊断事实，为单条 AbilityEvidence 生成可追溯、与方向分离的质量评估，为后续冲突协调提供可靠输入。

## 二十三、工程实现与验收记录

验收日期：2026-07-17

验收结论：PASS

已完成：

- `src/ai/schemas/evidenceQualityAssessment.schema.ts`
- `src/ai/agents/evidenceQualityAssessmentAgent.ts`
- `src/ai/tests/runEvidenceQualityAssessmentDebug.ts`
- `debug:evidence-quality-assessment`

专项 Debug 结果：

- 17 个 Evidence Quality Case 全部通过；
- 能区分质量等级与 Evidence 方向；
- 能从正式 Runtime 对象派生提示依赖、任务新颖度、时间关系、诊断可靠性与追溯完整性；
- 调用方伪造独立完成、迁移关系或高 confidence 时不会绕过校验；
- 同一上下文重复执行保持幂等；
- 上下文补齐后生成不可变新版 Assessment；
- 同一 Response 的多条 Evidence 共享 observationUnitId；
- Assessment 分叉时进入 `review_required`。

回归结果：

- Phase 13.3 Retention Evaluation：18 / 18 PASS；
- Phase 9.3 Task Evidence Return：PASS；
- Phase 12 Integrated Acceptance：9 / 9 PASS；
- Production Build：PASS。

当前边界：

- 本阶段只完成单条 Evidence 的质量评估；
- Phase 14.2 冲突证据协调已完成并通过 25 / 25 Debug 验收；
- 尚未实现 Phase 14.3 自适应任务约束；
- 不更新 StudentAbilityProfile，不执行 Existing Phase 8 Evaluation；
- 不证明真实教学效果或长期能力提升。
