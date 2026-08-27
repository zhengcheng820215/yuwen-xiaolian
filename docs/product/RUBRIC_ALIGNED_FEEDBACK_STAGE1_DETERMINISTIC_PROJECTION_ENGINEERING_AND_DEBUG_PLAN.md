# Rubric 对齐反馈阶段 1：确定性 Projection 工程实施与 Debug 验收文档

英文名称：Rubric-aligned Feedback Stage 1 Deterministic Projection Engineering and Debug Plan

状态：`IMPLEMENTED / DEBUG ACCEPTED`

上位契约：`rubric_feedback_projection_v1`

阶段版本：`rubric_aligned_feedback_stage1_v1`

更新日期：2026-08-27

阶段 0 基线：[`rubric_aligned_feedback_stage0_readonly_audit_2026-08-27.md`](../education/phase/reports/rubric_aligned_feedback_stage0_readonly_audit_2026-08-27.md)

阶段 1 验收：[`rubric_aligned_feedback_stage1_engineering_debug_acceptance_2026-08-27.md`](../education/phase/reports/rubric_aligned_feedback_stage1_engineering_debug_acceptance_2026-08-27.md)

## 一、阶段目标

阶段 1 在不改变学生端反馈的前提下，建立一个确定性、可追溯、只读的 Rubric Projection 层：

```text
Frozen Question / Rubric
+ Formal Diagnosis Commit
+ TaskRequirementCoverage
+ Student Response Identity
↓
RubricFeedbackProjection v1
```

它只负责把已经形成的正式判断映射为统一 Projection，不重新阅读学生答案建立新结论，不生成学生可见文案，也不修改 Diagnosis、Evidence 或正式资源。

阶段 1 完成后只能声明：

> 系统能够在身份一致、正式诊断充分的条件下，稳定投射每个 Rubric Item 的本次覆盖状态，并选择一个已被正式证据支持、一次行动可改善的主要断点。

不能声明：

- 新反馈已经展示给学生；
- Rubric 已经替代现有 Feedback Action Plan；
- 学生能力状态已经变化；
- 所有历史题都必须产生 `ready` Projection；
- 单选题已经进入文本 Rubric 反馈链。

### 1.1 贯穿性双重验收

阶段 1 必须证明：

1. Publish、Learning、Diagnosis、Evidence、Revision、Retest、Transfer 与历史 Frozen Resource 零回归；
2. 新语义只存在于只读 Projection 构建结果和 Debug / Audit 输出中；
3. `StudentFeedbackGrounding`、`StudentFeedbackActionPlan`、Narrative Agent 与 Learning 页面尚未消费 Projection；
4. Projection 构建失败不能回退到关键词匹配、自由文本猜测或通用反馈模板；
5. 每次构建可重复、结果确定，并且不写入 Shared Store、Attempt、Diagnosis、Evidence、Revision 或 Student Profile。

## 二、保持不变的主链与责任边界

阶段 1 不重建：

```text
Material → Plan → TrainingTask → QuestionCandidate
→ Adopt → Revision → Publish → Learning
→ Response → Formal Diagnosis → Evidence
```

责任继续分离：

| 对象 | 责任 | 阶段 1 禁止承担的责任 |
| --- | --- | --- |
| Frozen Rubric | 定义观察对象、任务关系和可接受表达 | 判断本次学生是否完成 |
| Formal Diagnosis / Requirement Coverage | 判断本次学生回答实际覆盖情况 | 生成学生反馈 Narrative |
| Rubric Projection | 绑定、转换、排序正式结论 | 重新诊断、推断长期能力 |
| Feedback Action Plan | 后续把主要断点转换为行动 | 阶段 1 不接入 |
| Narrative / Learning | 后续展示学生可理解反馈 | 阶段 1 不改变 |

核心边界：

> Projection 可以知道完整 Rubric，但它没有重新判断学生答案的权限。阶段 1 只投射正式链已经知道的内容。

## 三、工程所有权与文件边界

阶段 1 建议新增：

```text
src/ai/agents/rubricFeedbackProjectionAgent.ts
src/ai/tests/runRubricAlignedFeedbackStage1Debug.ts
```

继续复用：

```text
src/ai/schemas/rubricFeedbackProjection.schema.ts
src/ai/schemas/studentLearningFeedback.schema.ts
src/ai/schemas/diagnosisRunRecord.schema.ts
src/ai/schemas/questionResourceAdmission.schema.ts
```

阶段 1 不允许修改：

- `studentFeedbackGroundingAgent` 的运行时输入；
- `studentFeedbackActionPlanAgent` 的运行时选择逻辑；
- `studentLearningNarrativeAgent` 与受控 Narrative Prompt；
- Learning 页面展示与按钮；
- Formal Diagnosis Commit、Evidence Return 和 Profile 写入策略；
- Frozen Question Resource、Registry Head 与历史 Session。

如果开发需要触碰上述禁止面，必须停止并把变更转入阶段 2 或阶段 3 文档，不能扩大阶段 1 授权。

## 四、确定性构建输入

阶段 1 新增内部构建输入，不作为新的持久化业务对象：

```ts
type RubricFeedbackProjectionBuildInput = {
  projectionContext: {
    questionVersionId: string;
    rubricVersion?: string;
    taskId: string;
    learningRoundId: string;
    executionSessionId: string;
    responseId: string;
    formalDiagnosisId: string;
  };

  responseFormat: 'short_text' | 'long_text' | 'single_choice' | 'boolean';
  taskRole: 'training' | 'retest' | 'transfer' | 'diagnosis' | 'observation';
  rubric: QuestionResourceRubricItem[];

  formalDiagnosisCommit: FormalDiagnosisCommit;
  diagnosisRunRecord: DiagnosisRunRecord;
  requirementCoverage: TaskRequirementCoverage[];
  primaryGapRequirementId?: string;

  // 只保存已被正式链核验的回答片段引用，不复制整份学生答案。
  verifiedStudentEvidenceRefs: Record<string, string[]>;

  // 可选的显式 Rubric ↔ Requirement 绑定；不得使用模糊文本匹配补造绑定。
  rubricRequirementBindings?: Array<{
    rubricItemId: string;
    requirementId: string;
    bindingSource: 'frozen_contract' | 'formal_diagnosis';
  }>;
};
```

### 4.1 必要输入条件

文本题进入 Projection 必须同时满足：

1. `formalDiagnosisCommit.status = committed`；
2. `formalDiagnosisId` 与 Commit 一致；
3. `diagnosisRunRecord` 的 Task、Execution Session、Response、Request、Run 与 Formal Diagnosis Commit 属于同一次正式运行；Question Version 与 Learning Round 由上游正式任务上下文绑定；
4. Rubric Item ID 完整且唯一；
5. Requirement Coverage 来源是 `formal_diagnosis / rubric / task_requirement` 中的正式来源；
6. Rubric Item 与 Requirement 具有明确 ID 绑定，或 Formal Diagnosis 已直接提供 Rubric Item 的匹配结果；
7. 学生证据只能引用已核验片段，不得由 Projection 从完整答案中自行抽取。

缺少任一关键身份时，不得部分构建看似完整的 Projection。

### 4.2 禁止的隐式绑定

阶段 1 禁止使用以下方式把 Rubric Item 与 Requirement 拼接起来：

- 比较名称相似度；
- 在 `description / gapMessage / studentMessage` 中寻找关键词；
- 根据数组位置默认一一对应；
- 使用 Ability ID 相同推断两者是同一观察点；
- 让 LLM 根据语义自行选择对应项；
- 因为某项权重最高而默认绑定当前主要缺口。

没有显式、可追溯绑定时，输出 `limited` 或 `not_assessable`，不得猜测。

## 五、构建结果与失败降级

建议 Agent 输出一个非持久化结果封装：

```ts
type RubricFeedbackProjectionBuildResult = {
  stageVersion: 'rubric_aligned_feedback_stage1_v1';
  outcome:
    | 'projected'
    | 'limited'
    | 'not_assessable'
    | 'single_choice_passthrough';
  projection?: RubricFeedbackProjection;
  issues: Array<{
    code: RubricFeedbackProjectionIssueCode;
    severity: 'info' | 'warning' | 'error';
    evidencePaths: string[];
  }>;
};
```

第一版 Issue Code 冻结为：

```ts
type RubricFeedbackProjectionIssueCode =
  | 'single_choice_uses_independent_feedback_contract'
  | 'formal_diagnosis_not_committed'
  | 'question_identity_mismatch'
  | 'diagnosis_identity_mismatch'
  | 'response_identity_missing'
  | 'rubric_identity_invalid'
  | 'rubric_requirement_binding_missing'
  | 'coverage_source_not_formal'
  | 'coverage_evidence_missing'
  | 'coverage_gap_not_structured'
  | 'primary_gap_not_actionable'
  | 'multiple_primary_candidates_ambiguous'
  | 'projection_validation_failed';
```

处理规则：

- `projected`：身份、绑定和覆盖结论完整，Projection 通过 Schema Guard；
- `limited`：正式信息存在，但部分 Rubric Item 无法安全映射；可以保留可证明的 Item，不得补齐猜测项；
- `not_assessable`：正式诊断未形成、身份错位、回答无效或关键证据不足；不选择 Primary Item；
- `single_choice_passthrough`：单选不构建文本 Rubric Projection，转交既有单选反馈链；
- 所有失败均返回结构化结果，不抛出导致 Learning 中断的业务异常，也不生成通用兜底反馈。

## 六、Rubric Item 覆盖状态映射

Projection 只消费正式 `TaskRequirementCoverage` 和 Formal Diagnosis，不自行判断学生答案。

| 正式输入 | Projection 状态 | 附加条件 |
| --- | --- | --- |
| `covered` | `achieved` | 必须存在已核验 `studentEvidenceRefs` |
| `partially_covered` | `partially_achieved` | 必须有 Formal Diagnosis 身份、结构化 Gap 和学生证据 |
| `missing` | `missing` | 必须有 Formal Diagnosis 身份与结构化 Gap |
| `insufficient_to_judge` | `not_assessable` | 不得生成 Gap 或下一步动作 |

### 6.1 保守映射规则

1. `covered` 但没有学生证据引用时，不得输出 `achieved`，该 Item 进入 `not_assessable` 并形成 Finding；
2. `partially_covered` 没有正式 Diagnosis 身份时，不得输出 `partially_achieved`；
3. `missing` 不等于“没有命中 acceptedSignals”，只能来自正式 Coverage；
4. `insufficient_to_judge` 不得被权重、关键词或题型默认值提升为具体缺口；
5. AnswerAcceptance 与同义表达识别已经由 Formal Diagnosis 负责，Projection 不再运行第二遍语义匹配；
6. 一个 Rubric Item 绑定多个 Requirement 时，只要存在 `insufficient_to_judge` 或互相矛盾的状态，不能静默合并为更确定的结论；应进入 `limited`。

## 七、Observed Gap 的唯一映射

阶段 1 只允许从结构化 Requirement Type、Coverage Status 和 Gap Reason Code 映射 `observedGap`：

| 正式条件 | `observedGap` |
| --- | --- |
| 结论已覆盖，`text_evidence` 缺失或部分覆盖，Reason 为 `missing_text_evidence` | `conclusion_without_evidence` |
| 文本依据已覆盖，`reasoning_relation` 缺失或部分覆盖，Reason 为 `missing_reasoning_relation` | `evidence_without_explanation` |
| 必要 Requirement 只完成一部分，Reason 为 `incomplete_task_requirement` | `partial_required_aspects` |
| `expression` 部分覆盖且正式 Diagnosis 明确是组织问题 | `expression_not_organized` |
| 正式 Diagnosis 具有明确范围错位结构码 | `scope_misaligned` |

当前已有 Gap Reason 不能可靠证明 `scope_misaligned` 时，阶段 1 不得从 `gapMessage` 自由文本推断该状态，应返回 `limited / not_assessable`。`conclusion_inconsistent` 也不能自动等同于范围错位。

禁止：

- 解析 `gapMessage` 生成新的 Gap Code；
- 把 Ability 名称转换成 Gap；
- 把所有不完整回答统一映射成 `partial_required_aspects`；
- 把表达不流畅自动解释为学生表达能力不足。

Observed Gap 只描述本题本次作答的可观察断点，不进入 Student Profile。

## 八、Primary Item 确定性选择

Primary Item 的目标不是找到权重最高、错误最严重或缺失最多的评分项，而是找到：

> 当前最值得处理、正式证据已经成立，并且通过一次明确行动能够改善的主要断点。

### 8.1 候选资格

只有同时满足以下条件的 Item 才能成为 Primary：

1. `coverageStatus` 为 `partially_achieved` 或 `missing`；
2. 具有正式 `diagnosisId`；
3. 具有结构化 `observedGap`；
4. 对应 required / critical 任务责任，或 Formal Diagnosis 已明确将其设为 Primary Gap；
5. 可以通过一次思考动作推进，不需要同时解决多个独立问题；
6. 不属于 Retest / Transfer 中禁止即时披露的完整解题路径。

### 8.2 选择顺序

选择顺序冻结为：

```text
Formal Diagnosis 已给出 primaryGapRequirementId 且候选合法
↓
当前最先失稳的必要 Requirement（使用冻结任务顺序，不按文案顺序猜测）
↓
一次行动可改善且修复后能推动题目继续完成
↓
partially_achieved 优先于同层级完全 missing 的后续责任
↓
最后才使用 required / critical / importance 处理完全并列项
↓
稳定 ID 排序只用于结果确定性，不用于制造教学优先级
```

`weight` 不得参与 Primary Item 决策。

当多个独立候选无法依据正式 Primary Gap 或冻结 Requirement 顺序消除歧义时：

- 不随机选择；
- 不同时投射多个主要缺口；
- 返回 `limited` 和 `multiple_primary_candidates_ambiguous`；
- 等待后续契约补足，不让 Projection 成为新的诊断者。

### 8.3 下一步动作边界

阶段 1 的 `nextThinkingAction` 是内部确定性动作，不是最终学生文案。它只能描述一个动作，例如：

- 定位一条支持当前判断的文本依据；
- 说明已找到依据与当前判断之间的关系；
- 补齐同一 Requirement 中尚未完成的一个必要方面；
- 重新核对题干限定的对象或范围；
- 按题目要求组织已有观点与依据。

它不得包含完整答案、全部 acceptedSignals、标准结论或可直接复制的答案模板。阶段 2 才负责进一步裁剪成学生可见 Grounding。

## 九、题型与 Task Role 分流

### 9.1 单项选择

`responseFormat = single_choice` 时：

- 输出 `single_choice_passthrough`；
- 不创建文本 Rubric Projection；
- 不选择 Primary Rubric Item；
- 不生成“补文本依据、解释依据与结论关系”等文本动作；
- 后续继续使用 `selectedOption → distractor rationale → 典型误读 → 重新核对动作`。

### 9.2 Training / Observation

可构建完整只读 Projection，但阶段 1 不提供 Revision Offer，也不改变学生端反馈。

### 9.3 Retest / Transfer

可以构建只读 Projection用于内部验证，但：

- 不改变独立作答属性；
- 不开放即时修订；
- `nextThinkingAction` 不得携带完整解题路径；
- Projection 不进入 Student Profile；
- 后续是否展示任何信息由阶段 2、3 的披露策略决定。

### 9.4 Boolean 与历史格式

第一版不强制接入。缺少明确的独立反馈契约时返回 `limited / not_assessable`，不得套用文本题或单选题逻辑。

## 十、确定性与身份规则

### 10.1 Projection ID

`projectionId` 必须由规范化稳定输入计算，不使用时间戳或随机数：

```text
projectionVersion
+ questionVersionId
+ rubricVersion（若有）
+ formalDiagnosisId
+ responseId
+ normalized item coverage summary
→ projectionId
```

相同输入必须生成相同 Projection ID 和完全相同的 Item 顺序。

### 10.2 Item 顺序

Projection Item 默认沿用 Frozen Rubric 顺序。该顺序只用于可重复输出，不等同于 Primary 优先级。

### 10.3 身份失败

以下任一情况必须拒绝 `ready`：

- Question Version 与正式运行上下文不一致；
- Formal Diagnosis Commit 不是 `committed`；
- `formalDiagnosisId / responseId / taskId / learningRoundId` 无法形成同一次运行绑定；
- Rubric Version 或 Rubric Item 身份错位；
- successor Question 与旧 Diagnosis 混用；
- Revision Response 与 Initial Diagnosis 混用；
- Retest / Transfer 使用 Training Response 身份。

阶段 1 不负责修复身份，只输出结构化 Issue。

## 十一、零写入与历史兼容

### 11.1 零写入

Projection Agent 必须是纯函数或等价的只读服务：

- 不写 Shared Formal Resource Store；
- 不写 Formal Diagnosis Repository；
- 不创建 AbilityEvidence；
- 不写 Learning Event、Growth Memory 或 Student Profile；
- 不修改 StudentResponse；
- 不创建 Revision Goal；
- 不修改 Frozen Resource 或 Registry Head。

### 11.2 历史资源

- 历史正式题不批量迁移、不重新发布；
- Rubric 与 Requirement 映射充分时可以形成 Projection；
- 映射不足时安全返回 `limited`；
- 不因历史题 `limited` 阻断现有 Learning；
- 真正存在 Rubric / 题干冲突时，由批量审计形成 Finding，再通过 successor Candidate 治理。

## 十二、Debug 验收矩阵

### 12.1 Schema、身份与映射

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| RP1-01 | committed Diagnosis + 完整身份 | 允许构建 |
| RP1-02 | Diagnosis 未 committed | `not_assessable` |
| RP1-03 | Question Version 错位 | 拒绝 ready |
| RP1-04 | Response 身份缺失 | 拒绝 ready |
| RP1-05 | Rubric Item ID 重复 | 拒绝 ready |
| RP1-06 | Rubric ↔ Requirement 无显式绑定 | `limited`，不模糊匹配 |
| RP1-07 | 相同输入重复执行 | Projection 完全相同 |
| RP1-08 | 审计前后 Store Snapshot | revision 与数据完全一致 |

### 12.2 覆盖状态

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| RP1-09 | covered + 已核验回答片段 | `achieved` |
| RP1-10 | covered 但无证据引用 | `not_assessable / limited` |
| RP1-11 | partially_covered + Formal Diagnosis | `partially_achieved` |
| RP1-12 | partial 没有 Diagnosis 身份 | 禁止构建 partial |
| RP1-13 | missing + 正式 Gap | `missing` |
| RP1-14 | insufficient_to_judge | `not_assessable`，无 Gap |
| RP1-15 | 同义表达已由 Diagnosis 接受 | 不重新按关键词否定 |
| RP1-16 | `gapMessage` 看似范围错位但无结构码 | 不推断 `scope_misaligned` |

### 12.3 Primary Item

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| RP1-17 | Formal Primary Gap 合法 | 直接采用对应 Item |
| RP1-18 | 最高权重项不可一次改善 | 不因权重选择它 |
| RP1-19 | 一项 partial、一项后续 missing | 选择当前可推进的 partial |
| RP1-20 | 两项独立缺口且无明确优先关系 | `limited`，不随机选择 |
| RP1-21 | Primary 指向 achieved | Schema Guard 拒绝 |
| RP1-22 | 一个 Gap 需要同时解决两个独立动作 | 不作为单一 Primary |

### 12.4 题型、角色和边界

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| RP1-23 | 单选正确或错误 | `single_choice_passthrough` |
| RP1-24 | 单选同时带文本 Rubric | 仍不进入文本 Projection |
| RP1-25 | Retest / Transfer | 只读 Projection，不开放 Revision |
| RP1-26 | Initial / Revised 身份混用 | 拒绝 ready |
| RP1-27 | Projection 构建失败 | 不影响现有反馈主链继续运行 |
| RP1-28 | StudentFeedbackGrounding / Narrative | 阶段 1 前后输入输出不变 |
| RP1-29 | Diagnosis / Evidence / Profile | 阶段 1 前后不变 |
| RP1-30 | Frozen Resource / Registry | 阶段 1 前后不变 |

## 十三、旧主链回归范围

阶段 1 至少重跑：

- Formal Question Hint / Feedback Batch Audit；
- Student Feedback Grounding；
- Student Feedback Action Plan；
- Learning Feedback Presentation；
- Single Choice Diagnosis；
- Learning Feedback Revision Stage 1—4；
- Diagnosis → Evidence Return 关键身份回归；
- Production Build。

回归报告必须记录：

1. 新增 Debug 的通过数量；
2. 旧链各测试集结果；
3. Shared Store revision 前后值；
4. 学生可见页面是否完全未改变；
5. 新代码实际生效面与禁止生效面。

## 十四、工程实施顺序

### Step 1：输入 Guard 与确定性 Binding

- 建立 Build Input / Result 类型；
- 校验 Formal Diagnosis Commit 和运行身份；
- 建立显式 Rubric ↔ Requirement Binding；
- 禁止模糊匹配。

### Step 2：覆盖状态投射

- 实现四态映射；
- 建立 Observed Gap 白名单映射；
- 对信息不足使用 `limited / not_assessable`。

### Step 3：Primary Item

- 优先消费正式 `primaryGapRequirementId`；
- 建立可行动性和必要步骤排序；
- 阻止 `weight` 决策与多缺口堆叠。

### Step 4：题型与角色分流

- 单选 passthrough；
- Retest / Transfer 只读与披露边界；
- 历史格式安全降级。

### Step 5：Debug、零写入和回归

- 完成 RP1-01—RP1-30；
- 证明确定性与零写入；
- 重跑旧反馈主链；
- 输出阶段 1 工程验收报告。

## 十五、完成定义

阶段 1 只有同时满足以下条件才能标记 `ENGINEERING ACCEPTED`：

1. Projection 构建完全依赖正式 Diagnosis、Requirement Coverage 与显式身份；
2. 四态映射和 Observed Gap 映射可重复、可解释；
3. `partially_achieved` 没有第二套 Diagnosis 来源；
4. Primary Item 不由 Rubric 权重直接决定；
5. 多候选歧义时安全降级，不随机选择或堆叠缺口；
6. 单选使用 passthrough，不套用文本题 Rubric 反馈；
7. 相同输入产生相同 Projection ID 与相同输出；
8. Projection Schema Guard、身份 Guard 和零写入验证通过；
9. StudentFeedbackGrounding、Action Plan、Narrative 和 Learning 页面未消费新 Projection；
10. Diagnosis、Evidence、Revision、Retest、Transfer 与 Student Profile 无变化；
11. Frozen Resource、Registry Head 和历史 Session 无写入；
12. RP1-01—RP1-30 与旧主链回归全部通过。

## 十六、阶段 2 准入条件

只有阶段 1 验收完成后，阶段 2 才可以：

- 让 `StudentFeedbackGrounding` 消费 Projection；
- 从完整 Projection 裁剪 `StudentVisibleFeedbackGrounding`；
- 生成“已做到、主要缺口、下一步动作”；
- 接入单选与文本反馈的运行时分流；
- 保留 Revision 资格和披露深度控制。

阶段 2 仍不得直接修改 Learning 页面布局；学生端展示变化属于阶段 3。

## 十七、关联文档

- [评分要点对齐的学生反馈优化方案](./RUBRIC_ALIGNED_STUDENT_FEEDBACK_OPTIMIZATION_PLAN.md)
- [反馈行动转换模型](../education/FEEDBACK_ACTION_MODEL.md)
- [全部正式题提示与反馈批量审计契约](./FORMAL_QUESTION_HINT_AND_FEEDBACK_BATCH_AUDIT_CONTRACT.md)
- [Learning 反馈后修订契约](./LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md)
- [Rubric 对齐反馈阶段 0 只读审计报告](../education/phase/reports/rubric_aligned_feedback_stage0_readonly_audit_2026-08-27.md)
