# 阅读训练递进负担模型阶段 3：Learning、Diagnosis 与 Evidence 消费工程及 Debug 验收计划

英文名称：Reading Training Progressive Load Stage 3 — Learning, Diagnosis and Evidence Consumption Engineering Plan

状态：`IMPLEMENTED / AUTOMATED DEBUG ACCEPTED / BROWSER MATRIX PENDING`

阶段版本：`reading_training_progressive_load_stage3_v1`

前置阶段：`reading_training_progressive_load_stage2_v1 / IMPLEMENTED / DEBUG ACCEPTED`

更新日期：2026-08-24

## 一、阶段结论

阶段 3 可以进入工程开发。

阶段 3 不是重新生成题目，也不是重建 Learning、Diagnosis 或 Evidence 主链；它是在阶段 2 已冻结的题组计划、任务负担语义和稳定身份之上，增加一层只读消费与受约束归因：

```text
Frozen Resource + immutable Progression Artifact
→ Learning Progression Context Snapshot
→ Initial Independent Attempt
→ Formal Diagnosis
→ Progression Performance Observation
→ Instability Attribution Assessment
→ Evidence Admission Decision
→ existing Evidence / Evaluation / Profile pipeline
```

阶段 3 必须实现两个结果：

1. Learning 按正式题组计划执行和恢复，不再只依赖历史顺序标签；
2. 系统只在身份一致、同一观察线程、相邻负担可比较且证据角色合格时解释“学生从哪一层开始失稳”，并将题目负担风险与学生能力不足分开。

阶段 3 仍然不得把一次高负担题失败直接写成长期能力结论，也不得把负担等级写入 Student Ability Profile。

## 二、核心原则

阶段 3 冻结以下原则：

> 阅读训练默认从低负担理解进入，逐步增加证据、关系、推理和表达责任；系统通过学生在不同负担层级中的表现差异识别薄弱点，而不是先给予高负荷任务，再从失败结果反推学生能力不足。

同时继续执行贯穿所有阶段的验收原则：

> 每个阶段都必须证明旧主链零回归，并且新语义只在该阶段允许的边界内生效。

具体约束为：

1. 负担语义是任务属性，不是学生能力标签；
2. 题组坡度只要求不存在无理由跳跃，不要求每个等级都出现；
3. 不同观察线程的先后表现不得用于推断同一能力失稳点；
4. Revision、Targeted、Retest、Transfer 的证据身份继续隔离；
5. 学生端只看到自然的题目、反馈和下一步，不显示内部 Load Level、Plan Hash、Thread ID 或归因代码；
6. 历史正式资源缺少阶段 2 原生语义时保持可学习，但默认不进入失稳边界推断；
7. 新语义不得改写历史 Session、Attempt、Diagnosis、Evidence 或 Frozen Resource。

## 三、本阶段授权边界

### 3.1 允许实施

阶段 3 允许：

1. 为新 Frozen Resource 增加可选、不可变的 Progression Metadata 引用；
2. 以 `planHash` 为内容地址保存不可变题组 Progression Artifact；
3. Learning 优先按原生 Progression Plan 解析题组顺序；
4. 在任务开始时冻结 `LearningProgressionContextSnapshot`，并随 Attempt 持久化；
5. 从正式 Diagnosis 和作答事实生成 `ProgressionPerformanceObservation`；
6. 在同一观察线程内比较合格的相邻任务表现；
7. 生成 `ProgressionInstabilityAssessment`，区分学生失稳、任务负担风险和不可判断；
8. 在现有 Evidence 写入与 Profile 更新前增加 `ProgressionEvidenceAdmissionDecision`；
9. 让 Revision、Targeted、Retest、Transfer 显式携带支持身份，但不改变其既有业务步骤；
10. 为历史资源提供只读 `legacy_projection` 排序兼容路径。

### 3.2 明确禁止

阶段 3 禁止：

1. 批量覆盖或原地补写历史 Frozen Resource；
2. 依据单题失败直接形成长期 weakness Evidence；
3. 依据 `loadLevel` 直接降低 Student Ability Profile；
4. 把 Revision 后改善当作独立掌握；
5. 把 Targeted Micro-training 表现当作原任务独立重测；
6. 仅因题型相同、能力标签相同或材料相同就建立可比较关系；
7. 跨 observation thread 推断失稳位置；
8. 为形成漂亮梯度而改变正式题顺序、补题或删除任务；
9. 把 `legacy_projection` 的低置信语义升级为能力结论；
10. 向学生增加人工确认负担等级、归因判断或 Evidence 的步骤；
11. 在阶段 3 执行历史题 successor 治理或真实效果校准；这些属于阶段 4。

## 四、现状差距与改造判断

阶段 2 已完成 Planner、两步 Prompt、Candidate 身份回执、题组 Gate 和兼容顺序标签，但当前运行链仍存在四个缺口：

1. `FrozenQuestionResourceVersion` 尚未原生持有稳定的 Progression 引用；Learning 主要读取 `sequence-*` 标签；
2. Learning 启动和恢复没有冻结任务负担上下文，未来若重新解析当前资源，可能污染历史 Attempt；
3. `DiagnosisResult` 只描述当前题表现，没有判断当前表现是否适合参与相邻层级比较；
4. `AbilityEvidence` 可直接进入 Evaluation / Profile 链，尚缺“任务负担风险优先于学生能力归因”的准入门。

因此阶段 3 属于 Training Model 的运行消费升级，不是 Prompt 优化。改造应采用**新增不可变 Artifact + Attempt 旁路上下文 + Evidence 前置门禁**，而不是扩写现有 Diagnosis 文案或重做 AbilityEvidence Schema。

## 五、正式 Progression 权威与历史兼容

### 5.1 FormalTaskProgressionMetadata

新正式题版本可选携带以下原生引用：

```ts
type FormalTaskProgressionMetadata = {
  schemaVersion: 'formal_task_progression_metadata_v1';
  policyVersion: 'reading_training_progressive_load_policy_v2';
  stageRuleVersion: 'reading-training-progressive-load-stage2-v1';
  materialVersionId: string;
  observationPlanRevisionId: string;
  planningTaskKey: string;
  taskGroupProgressionPlanHash: string;
  sequenceRank: number;
  taskLoadSemantics: TaskLoadSemantics;
  taskLoadSemanticsHash: string;
};
```

该对象是 Frozen Version 的可选、不可变内容。新阶段 2 Candidate 只有在以下条件全部成立时才允许随新正式版本冻结：

- Candidate 的四项计划回执完整；
- Task Semantics Verification 为 `matched` 或受控 `advisory`；
- Group Gate 为 `pass` 或 `pass_with_advisory`；
- Candidate、TrainingTask、Plan 和 Frozen Version 身份完全一致。

历史 Frozen Version 没有该字段时仍合法，不进行回写。

### 5.2 FormalTaskGroupProgressionArtifact

题组计划作为独立、不可变、内容寻址 Artifact 保存：

```ts
type FormalTaskGroupProgressionArtifact = {
  schemaVersion: 'formal_task_group_progression_artifact_v1';
  planHash: string;
  materialVersionId: string;
  observationPlanRevisionId: string;
  progressionPlan: TaskGroupProgressionPlan;
  sourceCandidateIds: string[];
  createdAt: string;
};
```

规则：

1. `planHash` 相同的 Artifact 必须幂等；
2. 同一 `planHash` 内容不同必须拒绝；
3. Artifact 不记录学生状态和运行态字段；
4. 题组分批发布时，Learning 只装配当前 Registry 可见的已发布成员，并保持计划中的相对顺序；
5. 尚未发布的 planning task 只形成内部 advisory，不阻断已发布题消费；
6. Artifact 缺失、Hash 不一致或成员身份冲突时回退兼容排序，并将比较资格设为 `not_comparable`。

### 5.3 权威优先级

正式 Learning 解析顺序必须为：

```text
完整 FormalTaskProgressionMetadata + 匹配的 Formal Artifact
→ native_authority

历史 sequence tags + Stage 0 兼容投影
→ legacy_projection（仅排序，不归因）

两者均不可用
→ existing stable order（仅执行，不归因）
```

不得混用原生 Plan 的部分字段与旧标签拼装“半原生”比较上下文。

## 六、Learning Progression Context

### 6.1 LearningProgressionContextSnapshot

任务被选中并开始执行时，应冻结以下上下文：

```ts
type LearningProgressionContextSnapshot = {
  schemaVersion: 'learning_progression_context_v1';
  policyVersion: 'reading_training_progressive_load_policy_v2';
  studentId: string;
  learningSessionId: string;
  learningRoundId: string;
  learningTaskAttemptId: string;
  resourceVersionId: string;
  materialVersionId: string;
  authoritySource: 'native_authority' | 'legacy_projection' | 'none';
  taskGroupProgressionPlanHash?: string;
  planningTaskKey?: string;
  sequenceRank?: number;
  taskLoadSemantics?: TaskLoadSemantics;
  taskLoadSemanticsHash?: string;
  predecessor?: {
    resourceVersionId: string;
    planningTaskKey: string;
    sequenceRank: number;
    transitionId: string;
    threadRelation: 'same_thread' | 'cross_thread';
    addedResponsibilities: ReadingLoadResponsibility[];
    loadDirection: 'same' | 'increase' | 'decrease' | 'independent';
  };
  comparisonEligibility: 'eligible' | 'ordering_only' | 'not_comparable';
  comparisonLimitations: string[];
  snapshotHash: string;
  capturedAt: string;
};
```

### 6.2 冻结规则

1. Snapshot 在 `question_presented` / Attempt 创建边界生成一次；
2. 保存草稿、刷新页面、恢复 Session 和重新打开浏览器必须复用同一 Snapshot；
3. 发布新 successor、Registry 改指或 Plan 变化不得修改已开始 Attempt 的 Snapshot；
4. Snapshot Hash 不包含展示文案、倒计时和其他运行态字段；
5. Snapshot 身份必须绑定 student、session、round、attempt、resource version；
6. 缺少原生权威时允许学习继续，但 `comparisonEligibility` 只能是 `ordering_only` 或 `not_comparable`。

### 6.3 Learning 排序与恢复

阶段 3 将现有 Scheduler 升级为：

1. 对同一 Plan 的正式题优先使用 `sequenceRank`；
2. 不同 Plan、不同材料或不同 observation thread 不进行全局负担排序；
3. `holistic_first` 和 `role_driven` 原样执行，不被重新排成 entry first；
4. Retest / Transfer 的 `independent_validation` 保留策略调度位置，不参与当前 Training 题组相邻负担推断；
5. 已完成题、当前题和下一题的选择基于冻结的 active resource set；
6. 恢复时不得因为 Registry 更新而跳题、重复题或改变总题数；
7. 原生 Plan 不完整时回退现有 `learning_task_sequence_scheduler_v3` 行为，并记录限制。

## 七、Progression Performance Observation

### 7.1 事实对象

每次可诊断的正式作答形成一条独立观察事实：

```ts
type ProgressionPerformanceObservation = {
  schemaVersion: 'progression_performance_observation_v1';
  observationId: string;
  studentId: string;
  learningSessionId: string;
  learningRoundId: string;
  learningTaskAttemptId: string;
  resourceVersionId: string;
  materialVersionId: string;
  responseId: string;
  formalDiagnosisId: string;
  progressionContextSnapshotHash: string;
  observationThreadId?: string;
  taskGroupProgressionPlanHash?: string;
  sequenceRank?: number;
  responsibilities: ReadingLoadResponsibility[];
  outcome: 'meets' | 'partially_meets' | 'does_not_meet' | 'invalid';
  requiredRubricItemCount: number;
  matchedRequiredRubricItemCount: number;
  supportMode:
    | 'independent_initial'
    | 'hint_supported_initial'
    | 'feedback_revision'
    | 'targeted_training'
    | 'retest_independent'
    | 'transfer_independent';
  comparisonEligibility: 'eligible' | 'hold' | 'excluded';
  exclusionReasons: string[];
  observedAt: string;
};
```

### 7.2 观察事实不等于能力结论

`ProgressionPerformanceObservation` 只回答：

- 学生完成了哪一道正式题；
- 当时任务承担哪些责任；
- 作答在 Rubric 上完成到什么程度；
- 是否使用提示或反馈支持；
- 是否具有相邻层级比较资格。

它不得直接回答“学生能力是什么水平”，也不得直接更新 Profile。

## 八、失稳归因模型

### 8.1 五类解释边界

阶段 3 使用以下稳定代码表达可解释失稳位置：

```ts
type ReadingInstabilityLayer =
  | 'basic_understanding_not_established'
  | 'text_evidence_not_established'
  | 'relation_explanation_not_established'
  | 'inference_integration_not_established'
  | 'expression_organization_not_established';
```

它们分别对应：

1. 基础理解未成立；
2. 已理解但缺少文本依据；
3. 有依据但不能说明关系；
4. 推理或综合分析不足；
5. 理解已经形成，但表达组织不足。

### 8.2 ProgressionInstabilityAssessment

```ts
type ProgressionInstabilityAssessment = {
  schemaVersion: 'progression_instability_assessment_v1';
  policyVersion: 'reading_training_progressive_load_policy_v2';
  assessmentId: string;
  studentId: string;
  observationThreadId?: string;
  taskGroupProgressionPlanHash?: string;
  comparedObservationIds: string[];
  status:
    | 'not_assessable'
    | 'no_instability_observed'
    | 'provisional_boundary'
    | 'corroborated_boundary'
    | 'task_load_risk';
  instabilityLayer?: ReadingInstabilityLayer;
  attribution:
    | 'student_performance_hypothesis'
    | 'task_load_risk_only'
    | 'insufficient_comparable_evidence'
    | 'no_negative_attribution';
  confidence: 'low' | 'medium' | 'high';
  basis: Array<{
    lowerObservationId?: string;
    higherObservationId: string;
    retainedResponsibilities: ReadingLoadResponsibility[];
    addedResponsibilities: ReadingLoadResponsibility[];
    interpretation: string;
  }>;
  limitations: string[];
  assessedAt: string;
};
```

### 8.3 可比较前置条件

只有同时满足以下条件，才允许形成 `provisional_boundary`：

1. 同一 student；
2. 同一 `observationThreadId`；
3. 同一原生 `taskGroupProgressionPlanHash`；
4. 两条观察均绑定有效 Snapshot 和 Formal Diagnosis；
5. Transition 为 `same_thread` 且方向为 `increase` 或受控 `same`；
6. 较低负担任务至少达到 `meets` 或稳定 `partially_meets`；
7. 较高负担任务出现与新增责任相符的缺口；
8. 两条观察均为 `independent_initial`，或符合单独规定的独立 Retest / Transfer 验证；
9. 题目没有 unresolved quality blocker、身份冲突或复合负担高风险；
10. Anchor、能力、观察对象与评分目标具有真实连续性。

以下任一情况必须 `not_assessable` 或 `task_load_risk`：

- 跨线程；
- legacy projection；
- 使用提示后完成；
- Revision 或 Targeted 支持下完成；
- 只有高负担失败，没有较低负担参照；
- 题目本身存在无理由跨级或复合动作过载；
- 任务、响应、Diagnosis、Evidence 身份不一致；
- 低负担题失败后直接跳到更高负担题。

### 8.4 临时边界与长期结论

同一题组的一对相邻观察最多形成 `provisional_boundary`，只用于当前训练解释和下一步任务选择。只有满足以下任一条件才可成为 `corroborated_boundary`：

1. 另一道独立正式任务在同一责任边界出现一致表现；
2. 到期 Retest 在无提示条件下复现；
3. Transfer 在新材料中复现同一新增责任缺口。

即使达到 `corroborated_boundary`，进入 Student Profile 仍须经过现有 Evidence Evaluation 和 ProfileUpdateDecision，不得由 Progression Agent 直接写 Profile。

## 九、Diagnosis 与 Evidence 的兼容式接入

### 9.1 Diagnosis 保持题目级职责

现有 `DiagnosisResult` 继续回答当前题的：

- 作答是否满足题目要求；
- 命中和缺失哪些 Rubric；
- 表面问题和可能原因；
- 当前题的训练建议。

阶段 3 不要求 Diagnosis Provider直接输出 Load Level 或 Instability Layer。这样可以避免：

1. Prompt 把任务负担误写成学生能力；
2. 单次模型输出越权形成长期归因；
3. 旧 Diagnosis Schema 和正式历史记录被批量迁移。

阶段 3 在 Formal Diagnosis 提交之后，以确定性 Adapter 读取 Diagnosis、Snapshot、Transition 和相邻观察，形成旁路 `ProgressionInstabilityAssessment`。

### 9.2 ProgressionEvidenceContext

为保持 `AbilityEvidence` 向后兼容，阶段 3 优先新增可链接旁路上下文，而不是把大量阶段字段塞入 Evidence 本体：

```ts
type ProgressionEvidenceContext = {
  schemaVersion: 'progression_evidence_context_v1';
  evidenceId: string;
  studentId: string;
  taskId: string;
  learningTaskAttemptId: string;
  responseId: string;
  diagnosisId: string;
  progressionContextSnapshotHash: string;
  progressionObservationId: string;
  instabilityAssessmentId?: string;
  supportMode: ProgressionPerformanceObservation['supportMode'];
  inferenceScope:
    | 'task_only'
    | 'current_group_provisional'
    | 'cross_task_corroborated'
    | 'independent_validation';
  createdAt: string;
};
```

### 9.3 ProgressionEvidenceAdmissionDecision

```ts
type ProgressionEvidenceAdmissionDecision = {
  schemaVersion: 'progression_evidence_admission_v1';
  decisionId: string;
  evidenceId: string;
  decision:
    | 'admit_existing_evidence'
    | 'admit_as_insufficient_only'
    | 'hold_for_more_evidence'
    | 'exclude_from_profile_evaluation';
  reasonCodes: Array<
    | 'identity_aligned'
    | 'independent_attempt'
    | 'provisional_boundary_only'
    | 'feedback_supported'
    | 'targeted_support_context'
    | 'task_load_risk'
    | 'cross_thread_not_comparable'
    | 'legacy_projection_only'
    | 'missing_lower_load_reference'
    | 'retest_or_transfer_corroborated'
    | 'identity_mismatch'
  >;
  allowProfileEvaluation: boolean;
  decidedAt: string;
};
```

门禁规则：

1. `task_load_risk` 必须优先于学生 weakness 归因；
2. 单一 `provisional_boundary` 默认 `hold_for_more_evidence`，可以服务当前反馈，但不能直接进入长期画像；
3. 独立基础题失败可以保留题目级 Evidence，但不能仅凭 Load Level 推断宏观能力等级；
4. Revision 的改善只允许形成 `growth + feedback_supported`，不得替代独立 Evidence；
5. Targeted 表现用于判断干预是否完成，不直接覆盖首次作答；
6. Retest / Transfer 只有身份完整、无提示且任务独立时可提升推断强度；
7. `allowProfileEvaluation = false` 时，现有 Evaluation / Profile Runtime 必须安全跳过，但原始 Diagnosis 和 Observation 仍保留；
8. Admission Decision 必须幂等，并与 evidenceId、attemptId、diagnosisId 绑定。

## 十、不同任务角色的消费规则

### 10.1 Single Choice

1. 高质量基础理解单选可作为 `foundation_entry`；
2. 错误选项必须继续通过 distractor rationale 表达典型偏差；
3. 单选失败可以提示基础理解尚未稳定，但若题目质量或选项身份有问题，只记录 task load / quality risk；
4. 单选与后续文本题只有在同一 observation thread、Plan Transition 为同线程递进且观察对象连续时才可比较；
5. 不得仅因“单选在前、文本题在后”自动推断层级关系。

### 10.2 Revision

1. Initial Response 与 Revised Response 保持独立不可变；
2. Progression Observation 的首次边界以 `independent_initial` 为准；
3. Revision Evaluation 可以说明学生在反馈支持下补齐了什么；
4. Revision 不改变首次失稳事实，不产生新的独立 Attempt；
5. Revision 后是否真正掌握由后续 Retest / Transfer 验证。

### 10.3 Targeted Micro-training

1. Targeted 继续按具体 Gap Reason Code 匹配局部动作；
2. 单个 Targeted 任务不强建完整 Progression Plan；
3. Targeted Observation 的 `supportMode` 固定为 `targeted_training`；
4. Targeted 成功可以关闭当前干预步骤，但不能静默覆盖初始 weakness Evidence；
5. 若后续要形成独立掌握结论，必须安排 Retest 或 Transfer。

### 10.4 Retest / Transfer

1. 两者使用 `sequenceRole = independent_validation`；
2. 它们是正常顺序例外，不重新排入 Training 题组坡度；
3. Retest 验证保持，Transfer 验证新情境迁移；
4. 只有无提示、独立作答、身份完整时可以成为 corroboration；
5. Retest / Transfer 失败不得反向修改历史 Progression Assessment，只生成新的 Evidence Context 和新评估。

## 十一、学生端与内部端投射

### 11.1 学生端

学生端允许展示：

- 当前题与题组进度；
- 与当前作答直接相关的具体反馈；
- 简短、可执行的下一步；
- Revision、下一题、Targeted、Retest 或 Transfer 的自然入口。

学生端禁止展示：

- `entry_short / focused_short / developing / integrated`；
- observation thread、plan hash、semantics hash、comparison eligibility；
- “在第几层失稳”“Evidence admission 被 hold”等内部表述；
- 把 provisional hypothesis 写成确定性能力标签。

推荐表达：

```text
你已经找到主要意思；下一步要把判断对应到文中的具体依据。
```

不推荐表达：

```text
你在 text_evidence 层开始失稳，当前 Evidence 暂不准入 Profile。
```

### 11.2 内部复核

内部复核页可以显示：

- Progression Authority 来源；
- Plan、Task、Attempt、Diagnosis、Evidence 身份链；
- 相邻观察、Added Responsibilities 和归因状态；
- Admission Decision 及限制；
- 历史兼容和 task load risk。

内部字段不得出现在正常 Learning 页面，也不得设置可直接修改归因结论的人工输入框。

## 十二、状态、幂等和失败恢复

### 12.1 状态顺序

阶段 3 保留现有提交与诊断状态，只增加旁路阶段事实：

```text
attempt persisted
→ diagnosis committed
→ progression observation persisted
→ instability assessment persisted or marked not_assessable
→ evidence admission decided
→ existing evidence/evaluation/profile flow continues or safely holds
```

这些状态不投射为新的学生操作步骤。

### 12.2 幂等键

建议冻结以下幂等身份：

- Progression Context：`attemptId + resourceVersionId + planHash-or-none`；
- Performance Observation：`attemptId + responseId + diagnosisId + contextHash`；
- Instability Assessment：`studentId + observationThreadId + orderedObservationIds + policyVersion`；
- Evidence Context：`evidenceId + observationId`；
- Admission Decision：`evidenceId + assessmentId-or-none + policyVersion`。

### 12.3 失败恢复

1. Diagnosis 成功、Progression Observation 失败：保留正式 Diagnosis，重试旁路，不重复调用 Provider；
2. Observation 成功、Assessment 失败：保留 Observation，标记 `pending_retry`，不生成能力结论；
3. Assessment 成功、Evidence Admission 失败：保留 Assessment，现有 Evidence 暂不进入 Profile；
4. 页面刷新：从 Outbox / Repository 恢复，不重复创建 Observation 或 Evidence；
5. Artifact 临时不可读：允许题目继续完成，Snapshot 标记 `not_comparable`；
6. 身份冲突：阻断归因，不阻断已完成作答的保存；
7. 重试成功后不得改变原始 Attempt、Response 和 Diagnosis ID。

## 十三、Repository 与迁移策略

### 13.1 新增 Repository

建议新增：

- `FormalTaskGroupProgressionArtifactRepository`；
- `LearningProgressionContextRepository`；
- `ProgressionPerformanceObservationRepository`；
- `ProgressionInstabilityAssessmentRepository`；
- `ProgressionEvidenceContextRepository`；
- `ProgressionEvidenceAdmissionRepository`。

所有 Repository 先提供 InMemory 和 IndexedDB 实现，并保持 structured clone、upsert 幂等和按 student / session / thread 查询能力。

### 13.2 Schema 迁移

1. `FrozenQuestionResourceVersion.progressionMetadata?` 为可选追加字段；
2. `ConcreteLearningTask.progressionContextSnapshot?` 为可选追加字段；
3. `LearningPersistenceRecord.progressionContextSnapshot?` 为可选追加字段；
4. `TaskEvidenceReturnResult.progressionEvidenceContext?` 与 `progressionEvidenceAdmissionDecision?` 为可选追加字段；
5. 旧对象 Guard 必须继续通过；
6. IndexedDB 升级只增加 Store / Index，不重写旧记录；
7. 旧记录读取后不得自动持久化 legacy projection；
8. Migration 失败必须保留旧数据库并使 Learning 回退旧链。

### 13.3 历史资源策略

历史资源分三类：

| 类型 | Learning 排序 | 失稳归因 |
| --- | --- | --- |
| 原生 Metadata + Artifact 完整 | 按权威 Plan | 允许受控比较 |
| legacy projection 完整或部分 | 按兼容 Scheduler | 不形成失稳边界 |
| 无法投影 | 维持现有稳定顺序 | 不可比较 |

历史正式题确需进入阶段 3 归因时，必须在阶段 4 通过 successor Candidate 形成新 Frozen Version；不得原地补字段。

## 十四、工程包与建议文件

### 14.1 Schema

建议新增：

- `src/ai/schemas/formalTaskProgressionMetadata.schema.ts`
- `src/ai/schemas/learningProgressionContext.schema.ts`
- `src/ai/schemas/progressionPerformanceObservation.schema.ts`
- `src/ai/schemas/progressionInstabilityAssessment.schema.ts`
- `src/ai/schemas/progressionEvidenceAdmission.schema.ts`

建议兼容式扩展：

- `questionResourceAdmission.schema.ts`
- `concreteLearningTask.schema.ts`
- `learningPersistence.schema.ts`
- `taskEvidenceReturn.schema.ts`

### 14.2 Agent / Service

建议新增：

- `formalTaskProgressionProjectionAgent.ts`
- `learningProgressionContextResolver.ts`
- `progressionPerformanceObservationAgent.ts`
- `progressionInstabilityAssessmentAgent.ts`
- `progressionEvidenceAdmissionAgent.ts`
- `learningProgressionContextService.ts`

建议修改：

- `learningTaskSequenceScheduler.ts`
- `formalResourceRuntimeIntegrationAgent.ts`
- Learning Round / Phase 16.3 正式入口编排
- Learning Observation Outbox 与完整性审计
- Evidence Return 与 Profile Update 前置门禁

### 14.3 前端

正常 `/learning` 只需：

- 保持连续题组进度与恢复；
- 使用新的正式顺序，但不显示内部层级；
- 将受控归因转成简短反馈和下一步。

内部验收可增加隔离页或现有 Internal Review 投影，用于检查身份链、比较资格与归因边界。隔离验收入口不得出现在产品导航。

## 十五、实施顺序

阶段 3 工程按以下顺序执行：

### 15.1 Work Package A：正式元数据与上下文冻结

1. 新增 Formal Progression Metadata 和 Artifact Schema；
2. 接通新 Candidate 发布时的不可变 Artifact / Metadata；
3. 建立 native / legacy / none 权威解析；
4. 在 ConcreteTask 和 Learning Persistence 冻结 Snapshot；
5. 验证刷新、恢复和 Registry 更新不改变 Attempt 上下文。

### 15.2 Work Package B：Learning 顺序消费

1. Scheduler 原生读取 Progression Plan；
2. 保持 holistic first、role driven 和 partial publication；
3. 旧资源回退 v3 Scheduler；
4. 修复题组总数、下一题、断点恢复和跨标签一致性；
5. 不改题面、不重排不同 Plan。

### 15.3 Work Package C：表现观察与归因

1. Formal Diagnosis 后生成 Performance Observation；
2. 建立相邻同线程比较；
3. 输出五类 provisional boundary；
4. 对 task load risk、跨线程和历史投影安全降级；
5. 证明一次失败不能形成长期结论。

### 15.4 Work Package D：Evidence 门禁与恢复

1. 建立 Evidence Context 和 Admission Decision；
2. 接入现有 Evaluation / Profile 前置边界；
3. 接通 Revision、Targeted、Retest、Transfer 身份；
4. 完成 Outbox、IndexedDB、幂等和失败恢复；
5. 完成真实浏览器联调与旧主链回归。

Work Package 必须按 A → B → C → D 执行。B 不得在 A 的 Snapshot 身份未稳定时提前完成；D 不得在 C 的 not-assessable 和 task-load-risk 分支未完整时接入 Profile。

## 十六、专项 Debug 验收矩阵

阶段 3 建议冻结 `S3-01—S3-56`：

### 16.1 Formal Metadata 与 Artifact

| Case | 验收 |
| --- | --- |
| S3-01 | 合法 FormalTaskProgressionMetadata 通过 Guard |
| S3-02 | Task Semantics Hash 不一致被拒绝 |
| S3-03 | Plan Hash 缺失或空值被拒绝 |
| S3-04 | 合法 Formal Progression Artifact 通过 Guard |
| S3-05 | 同 Plan Hash 不同内容产生冲突而非覆盖 |
| S3-06 | Artifact 持久化 round-trip 保持稳定 |
| S3-07 | 新 Candidate 发布后 Frozen Metadata 与 Candidate 身份一致 |
| S3-08 | 历史 Frozen 缺 Metadata 继续通过旧 Guard |
| S3-09 | 不批量修改历史 Frozen / Registry / Link |
| S3-10 | 分批发布题组只装配当前 active 成员并保持相对顺序 |

### 16.2 Learning Context 与排序

| Case | 验收 |
| --- | --- |
| S3-11 | 原生 Metadata + Artifact 被解析为 native authority |
| S3-12 | 历史标签只形成 legacy ordering projection |
| S3-13 | Metadata / Artifact 冲突回退且不可比较 |
| S3-14 | Snapshot 绑定 student / session / round / attempt / resource version |
| S3-15 | Snapshot Hash 对相同输入稳定 |
| S3-16 | Registry successor 不改变已开始 Attempt Snapshot |
| S3-17 | 刷新恢复不重新计算当前题上下文 |
| S3-18 | 原生 Plan 按 sequenceRank 推进 |
| S3-19 | holistic_first 不被改排为 entry_first |
| S3-20 | role_driven Retest / Transfer 保持独立调度 |
| S3-21 | 不同 Plan 不按负担等级全局混排 |
| S3-22 | 缺原生 Plan 时旧 Scheduler 行为零回归 |

### 16.3 Performance Observation

| Case | 验收 |
| --- | --- |
| S3-23 | 合法 Initial Attempt 形成一条 Observation |
| S3-24 | 同一 Attempt / Response / Diagnosis 重放保持幂等 |
| S3-25 | 无效作答不进入可比较集合 |
| S3-26 | usedHint 正确映射为 hint_supported_initial |
| S3-27 | Revision 正确映射为 feedback_revision |
| S3-28 | Targeted 正确映射为 targeted_training |
| S3-29 | Retest / Transfer 正确标记 independent validation 身份 |
| S3-30 | Diagnosis 身份不一致时 Observation 被排除 |

### 16.4 Instability Assessment

| Case | 验收 |
| --- | --- |
| S3-31 | 同线程低层成功、高层失败形成 provisional boundary |
| S3-32 | 基础理解失败映射到 basic_understanding_not_established |
| S3-33 | 新增文本依据责任失败映射到 text_evidence_not_established |
| S3-34 | 新增关系说明责任失败映射到 relation_explanation_not_established |
| S3-35 | 新增推理整合责任失败映射到 inference_integration_not_established |
| S3-36 | 证据和推理满足但组织不足映射到 expression_organization_not_established |
| S3-37 | 两题均满足时为 no_instability_observed |
| S3-38 | 跨线程比较为 not_assessable |
| S3-39 | legacy projection 为 not_assessable |
| S3-40 | 缺少低层参照不能由高层失败反推能力不足 |
| S3-41 | 无理由复合负担跳跃优先输出 task_load_risk |
| S3-42 | Revision 改善不把 provisional boundary 自动改成掌握 |
| S3-43 | 独立 Retest / Transfer 可形成 corroborated boundary |
| S3-44 | 不同学生、版本、Plan 或 Attempt 的观察不可拼接 |

### 16.5 Evidence Admission 与长期状态

| Case | 验收 |
| --- | --- |
| S3-45 | task_load_risk Evidence 不进入 Profile Evaluation |
| S3-46 | 单一 provisional boundary 默认 hold_for_more_evidence |
| S3-47 | feedback-supported Revision 只形成 growth / supported 语义 |
| S3-48 | Targeted 成功不覆盖首次 Evidence |
| S3-49 | 独立验证形成的 corroboration 可进入既有 Evaluation |
| S3-50 | Admission Decision 重放幂等 |
| S3-51 | Admission 失败不丢失 Diagnosis 和 Observation |
| S3-52 | Student Profile 不出现 loadLevel 或 sequenceRole |

### 16.6 边界与产品投射

| Case | 验收 |
| --- | --- |
| S3-53 | `/learning` 不暴露内部 Plan / Hash / Load / Thread 字段 |
| S3-54 | 学生反馈不把 provisional hypothesis 写成确定结论 |
| S3-55 | 阶段 3 不生成 successor Candidate 或修改历史正式题 |
| S3-56 | 阶段 3 契约、旧主链和授权边界验收完整 |

全部 `S3-01—S3-56` 通过只是阶段 3 专项完成条件之一，不能替代旧主链回归和真实浏览器验收。

## 十七、旧主链零回归矩阵

阶段 3 完成前至少复跑：

1. 阶段 1 原生负担语义；
2. 阶段 2 Planner / Prompt / Group Gate；
3. Material Observation Draft Generator 两步式联调；
4. Question Candidate Workflow；
5. Question Workbench Command E2E；
6. Material Resource Production Commands；
7. Unified Resource Production P0–P7；
8. Formal Resource Runtime Integration；
9. Learning Session Queue；
10. Phase 16.3 正式 Learning 入口；
11. Single Choice Learning / Diagnosis；
12. Feedback Guided Revision Stage 1–4；
13. Targeted Micro-training Stage 1–4；
14. Retest / Transfer；
15. Learning Persistence / Outbox / Collection Integrity；
16. Evidence Evaluation / Profile Update Decision；
17. Production Build。

必须额外证明：

- 旧资源仍能开始、提交、诊断、反馈、继续下一题和恢复；
- 新 Evidence 门禁只拦截新负担归因，不误拦既有合法 Evidence；
- 阶段 2 发布状态仍只有一个权威准备态；
- 阶段 3 不增加录入端人工审查或学生端人工确认步骤；
- 正式资源、学生作答和历史证据没有被测试覆盖。

## 十八、真实浏览器联调矩阵

浏览器联调采用隔离数据或只读正式数据，建议冻结 `B3-01—B3-16`：

| Case | 场景 |
| --- | --- |
| B3-01 | 原生 Plan 题组按计划顺序进入 Learning |
| B3-02 | 第一题刷新后保持当前题和总题数 |
| B3-03 | 中途刷新恢复相同 Snapshot 和下一题 |
| B3-04 | 题组分批发布时只消费已发布成员 |
| B3-05 | 历史题组继续使用兼容顺序 |
| B3-06 | holistic_first 题组保持正式例外顺序 |
| B3-07 | 基础单选到文本题连续完成 |
| B3-08 | Initial Attempt 失败后形成自然反馈，不暴露内部归因 |
| B3-09 | Revision 后继续下一题，不替代首次表现 |
| B3-10 | Targeted 插入后可返回正式题组 |
| B3-11 | Retest / Transfer 不被错误插入 Training 坡度 |
| B3-12 | Artifact 暂时不可读时学习继续且安全降级 |
| B3-13 | Diagnosis 成功、旁路失败时刷新可恢复 |
| B3-14 | 下一题按钮与实际题号、总题数一致 |
| B3-15 | Internal Review 可追踪上下文和 Admission 决策 |
| B3-16 | 正常产品页面无隔离测试面板和内部错误码 |

浏览器联调报告必须说明测试是否写入正式数据。若使用隔离 Fixture，不得将结果表述为真实教育效果验证。

## 十九、阶段 3 完成门槛

只有同时满足以下条件，阶段 3 才能标记 `IMPLEMENTED / DEBUG ACCEPTED`：

1. Formal Progression Metadata 和 Artifact 不可变、幂等并可持久化；
2. Learning Context 在 Attempt 开始时冻结，刷新和恢复不漂移；
3. 原生 Plan 顺序优先，历史资源兼容路径保持；
4. Performance Observation 与 Diagnosis 身份完整；
5. 同线程相邻比较、跨线程禁止比较和 task-load-risk 分流成立；
6. 五类失稳边界均有正向与负向测试；
7. Revision、Targeted、Retest、Transfer 证据身份隔离成立；
8. Evidence Admission 在 Profile 前生效，单次 provisional 不直接进入长期画像；
9. `S3-01—S3-56` 全部通过；
10. `B3-01—B3-16` 全部通过；
11. 旧主链零回归矩阵全部通过；
12. Production Build 通过；
13. 正式历史数据前后快照一致；
14. 执行报告清楚列出允许生效面、禁止生效面和真实校准尚未完成。

## 二十、进入阶段 4 的门槛

阶段 3 完成后，阶段 4 才可以：

1. 依据只读审计和真实 Learning 观察选择高风险历史题组；
2. 通过 successor Candidate 治理历史 Frozen Resource；
3. 运行真实学生校准，观察不同负担层的完成率、用时、提示使用和失稳分布；
4. 调整归因阈值，但不回写历史 Assessment；
5. 评估是否扩大单选、Targeted、Retest 或 Transfer 的训练密度。

阶段 4 仍不得以题量、单选比例或负担等级覆盖率代替教育效果；真实数据不足时必须保留“不足以判断”。

## 二十一、主要风险与防护

| 风险 | 防护 |
| --- | --- |
| 把任务难误判成学生弱 | task-load-risk 优先分流，Evidence Admission 前置 |
| 重新读取当前 Registry 污染历史 Attempt | 开始作答时冻结 Context Snapshot |
| 不同能力题被错误拼接 | observationThreadId + Plan Hash + Transition 三重约束 |
| 单次失败形成长期标签 | provisional 默认 hold，独立验证后才可提升 |
| Revision 被当成独立掌握 | supportMode 固定 feedback_revision |
| Targeted 覆盖首次表现 | 独立 Observation / Evidence Context，不覆盖 Initial |
| 历史资源被强行迁移 | optional schema + legacy ordering only + successor 治理 |
| 学生看到内部工程术语 | 学生投射白名单，内部字段仅 Internal Review |
| 旁路失败阻断答题保存 | Diagnosis 与 Attempt 先提交，归因链可恢复重试 |
| 新 Gate 误伤旧 Evidence | 只对携带阶段 3 Context 的新归因生效，旧链保持兼容 |

## 二十二、最终冻结结论

阶段 3 的正确落地不是让系统多输出一个“难度等级”，而是建立以下可验证能力：

```text
题目负担有正式身份
→ Learning 按该身份执行并冻结当时上下文
→ Diagnosis 只判断当前题表现
→ Progression Assessment 判断是否具备层级归因资格
→ Evidence Admission 决定能否进入长期能力链
```

这使系统能够解释“学生在哪一项新增责任上开始失稳”，同时避免把题目设计风险、提示支持下的表现或跨线程差异误写成学生能力不足。

阶段 3 工程已按 Work Package A → B → C → D 完成实现，并完成自动化专项验收、关键旧链回归、Production Build 与 `B3-01—B3-16` 全量真实浏览器联调，状态提升为 `IMPLEMENTED / DEBUG ACCEPTED / FULL BROWSER ACCEPTED / REAL CALIBRATION PENDING`。浏览器联调使用隔离内存 Fixture，不写正式资源、学生作答或能力画像；该结果只证明工程闭环，不证明教育效果。验收记录见[阶段 3 全量真实浏览器联调](../education/phase/reports/reading_training_progressive_load_stage3_full_browser_acceptance_2026-08-24.md)。

## 二十三、2026-08-24 工程实施记录

本轮已完成：

1. 新发布资源冻结 `FormalTaskProgressionMetadata`，并以 `planHash` 持久化不可变 `FormalTaskGroupProgressionArtifact`；历史 Frozen Resource 不回写；
2. Learning Session Queue 和正式 Scheduler 可读取 Artifact，并在同一 Plan 内按正式 `sequenceRank` 排序；历史题继续走兼容路径；
3. Learning 在当前轮任务准备时冻结 `LearningProgressionContextSnapshot`，绑定 student、session、round、attempt、resource version，并随 Concrete Task / Persistence 保存；
4. 正式 Diagnosis 后生成 `ProgressionPerformanceObservation`，观察事实补齐 session、round、attempt、resource 和 material 身份；
5. 失稳评估只比较同 student、同 session、同 Plan、同 observation thread、匹配 predecessor resource 的相邻观察；
6. Revision、Targeted、Retest、Transfer 支持身份已进入运行边界，Targeted 不作为独立掌握，Retest / Transfer 保留独立验证语义；
7. `ProgressionEvidenceAdmissionDecision` 已接到现有 Evaluation / Profile 之前；被 hold 或排除时保留 Diagnosis、Evidence 和旁路事实，但不更新长期 Profile；
8. 旁路对象按 Context → Observation → Assessment → Evidence Context → Admission 顺序持久化；失败可从 checkpoint 重试，不重新执行 Diagnosis 或制造第二份 Evidence；
9. 学生端继续使用白名单投射，不展示 Plan Hash、Thread、Load、Admission 等内部字段。

自动化结果：

- 阶段 3 专项：`59/59 PASS`（`S3-01—S3-56` + 3 条运行回归）；
- 阶段 0：`24/24 PASS`；
- 阶段 1：`40/40 PASS`；
- 阶段 2：`48/48 PASS`；
- Learning Session Queue：`21/21 PASS`；
- Phase 16.3 Real Learning Chain：`17/17 PASS`；
- Training Task Sequence Planning：`20/20 PASS`；
- Learning Persistence、Training Evidence：通过；
- Production Build：通过，仅保留既有 bundle size / dynamic import 提示。

浏览器联调结果：

- `B3-01—B3-16`：`16/16 PASS`；
- 验收报告刷新恢复：PASS；
- 正式 `/learning` 只读恢复：原题组保持“已完成 1 题、当前第 2 题”，进入后为第 `2/4` 题；
- 正式资源、Student Attempt、Student Profile 写入：`0`。

当前未宣称完成的项目：

- 真实学生教育效果校准；
- 阶段 4 的历史题 successor 治理与阈值调整。
