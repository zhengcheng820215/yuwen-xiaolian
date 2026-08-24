# 阅读开放文本题输入负担阶段 3 质量门禁、题组顺序与发布一致性工程实施及 Debug 验收清单

英文名称：Reading Open-response Input-load Stage 3 Quality Gate, Sequence and Publication Consistency Engineering Plan

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED`

契约版本：`reading_open_response_input_load_stage3_v1.0`

更新日期：2026-08-21

上位契约：[阅读开放文本题难度梯度与输入负担优化契约](./READING_OPEN_RESPONSE_DIFFICULTY_AND_INPUT_LOAD_OPTIMIZATION_CONTRACT.md)

前置工程：[阶段 2 Planner、Prompt 与长度策略工程实施及 Debug 验收清单](./READING_OPEN_RESPONSE_INPUT_LOAD_STAGE2_PLANNER_PROMPT_AND_LENGTH_ENGINEERING_PLAN.md)

前置证据：[阶段 2 工程与 Debug 验收报告](../education/phase/reports/reading_open_response_input_load_stage2_engineering_debug_acceptance_2026-08-21.md)

工程证据：[阶段 3 工程与 Debug 验收报告](../education/phase/reports/reading_open_response_input_load_stage3_engineering_debug_acceptance_2026-08-21.md)

## 一、阶段目标

阶段 3 把阶段 1 已冻结的负担画像和阶段 2 已验证的生成追踪，接入新题 Candidate 的质量门禁、题组有效顺序校验和发布前一致性检查。

本阶段要解决的不是“再增加一轮人工审核”，而是确保：

1. 高复合、证据不足、题干与 Rubric 不一致或最低要求明显错配的新 Candidate 不会显示为“可以发布”；
2. 常规题组不会从低负担入口无理由跳到高综合负担，也不会为了形成漂亮梯度机械补齐全部等级；
3. 页面一旦显示“可以发布”并允许执行“采用并发布”，同一不可变 Candidate、Revision 和题组快照不得在点击后又被相同业务规则阻断；
4. 非阻断性质量提醒只作为系统治理证据，不新增“需要确认”、审核人、审核意见或忽略风险入口；
5. 既有 Frozen Resource、活动 Learning Session 和 Student Ability Profile 保持不变。

阶段 3 完成后，用户仍只负责一次产品决策：

```text
采用并发布
或
不采用并重新优化
```

内部可以保留采用、校验、评估和发布阶段结果，但不得把它们投射成新的人工步骤。

## 二、非目标与禁止事项

本阶段明确不做：

- 不批量重写、重排或覆盖既有正式题；
- 不修改活动 Learning Session 的资源版本或任务队列；
- 不把 `loadLevel`、推荐长度或门禁结果写入 Student Ability Profile；
- 不要求每组必须包含 `entry_short / focused_short / developing / integrated`；
- 不要求每组必须存在单选；
- 不以“还缺某个负担等级”为理由生成新题；
- 不为负担提醒新增人工确认、审核意见、审核人或风险豁免步骤；
- 不复制一套平行的 Question Quality、Review 或 Publication 工作流；
- 不将发布时网络、超时或共享资源故障误写成题目质量失败；
- 不在学生端展示内部长度带、负担等级、阻断码或工程术语。

## 三、权威边界与复用原则

### 3.1 既有权威对象

阶段 3 必须复用：

- `QuestionCandidate → Adopt → QuestionDraftRevision → Validation → Assessment → Review → Freeze → Publication` 主链；
- `QuestionQualityAssessment` 和 `questionQualityReviewGate` 的现有质量证据与时效校验；
- `trainingTaskSequencePlanner_v2` 的 `entry_first / holistic_first / role_driven` 顺序策略和原因；
- 阶段 1 的 `TextResponseLoadProfile`；
- 阶段 2 的 Planner intent、生成追踪、复算结果和一次受控修复证据。

阶段 3 只增加负担门禁证据和发布就绪投影，不创建第二套候选、审核或正式资源对象。

### 3.2 门禁与提醒必须分离

负担结果分为：

| 结果 | 语义 | 产品动作 |
| --- | --- | --- |
| `pass` | 满足负担与顺序契约 | 可以采用并发布 |
| `pass_with_advisory` | 存在可校准事项，但不影响当前采用 | 仍可采用并发布，不要求确认 |
| `blocked` | 存在确定性契约冲突 | 不显示“可以发布”，引导重新优化 |

阶段 3 的 advisory 不得写入必须由 `acceptedWarningCodes` 逐条确认的人工审核队列。它可以进入质量轨迹、展开详情或后台报告，但不得形成第二次人工决策。

### 3.3 新旧资源边界

- 阶段 2 之后新生成且携带完整生成追踪的 Candidate，适用全部阶段 3 门禁；
- 缺少阶段 2 追踪的新 Candidate 不得进入可采用列表；
- 既有 Frozen Resource 不因缺少新追踪而失效，也不被追溯阻断；
- 既有题治理只允许在阶段 4 通过后继 Candidate 进行，不允许原地修补。

## 四、核心发布不变量

### 4.1 “可发布”与真正可发布必须同源

页面状态与发布命令必须消费同一份就绪投影：

```text
canPublish =
  existingContractValidationPassed
  AND singleQuestionLoadGatePassed
  AND taskGroupLoadGatePassed
  AND candidateOrRevisionFingerprintIsCurrent
  AND groupSnapshotFingerprintIsCurrent
  AND existingPublicationPrerequisitesPassed
```

其中 `pass_with_advisory` 视为 passed；`blocked` 或 `stale` 均不得投射为“可以发布”。

禁止页面先根据一套宽松规则显示“可以发布”，点击后再由另一套更严格的业务规则返回负担质量错误。

### 4.2 点击后的允许失败类型

当页面已基于当前指纹显示“可以发布”时，点击“采用并发布”后：

- 不允许再出现同一 Candidate、Revision 和题组快照下的负担业务阻断；
- 允许出现网络、共享资源、超时或服务不可用等运行时失败；
- 允许因内容、Revision 或题组顺序实际变化产生 `stale`；
- `stale` 必须重新评估并提供可恢复重试，不得使用笼统质量错误；
- 运行时失败不得回写为负担不合格，也不得污染当前正式题组。

### 4.3 已发布状态优先

只要正式发布已经成功：

- 任务状态必须以已发布为准；
- 不得继续显示旧 Candidate 的“可以发布”、待处理提醒或负担错误；
- 后续质量评估只能生成新的后继 Candidate，不能把错误挂到已发布版本上。

## 五、阶段 3 数据契约

### 5.1 版本常量

建议冻结：

```ts
READING_OPEN_RESPONSE_LOAD_GATE_VERSION =
  'reading_open_response_load_gate_v1'
```

门禁规则变更必须升级版本；旧 Assessment 不得被新规则静默解释。

### 5.2 单题负担门禁 Assessment

```ts
type ReadingOpenResponseLoadGateDecision =
  | 'pass'
  | 'pass_with_advisory'
  | 'blocked';

type ReadingOpenResponseLoadGateAssessment = {
  assessmentId: string;
  subject: {
    kind: 'candidate' | 'draft_revision';
    subjectId: string;
    revision?: number;
    contentHash: string;
  };
  materialVersionId: string;
  trainingTaskId: string;
  responseFormat: 'short_text' | 'long_text';
  generationPlanningVersion?: string;
  inputLoadRuleVersion: string;
  gateRuleVersion: typeof READING_OPEN_RESPONSE_LOAD_GATE_VERSION;
  recomputedLoadProfile: TextResponseLoadProfile;
  decision: ReadingOpenResponseLoadGateDecision;
  blockerCodes: ReadingOpenResponseLoadBlockerCode[];
  advisoryCodes: ReadingOpenResponseLoadAdvisoryCode[];
  evidencePaths: string[];
  assessedAt: string;
};
```

约束：

- `short_text / long_text` 才进入本单题门禁；
- `single_choice` 保持其既有选项、答案身份和干扰项质量门禁，不伪造文本负担画像；
- Draft Revision 必须基于采用后的当前不可变内容重新评估；
- Assessment 的 `contentHash`、Revision、规则版本或题组上下文任一不一致即为 stale；
- 门禁不得通过展示字段反推或修改题目内容。

### 5.3 题组负担门禁 Assessment

```ts
type ReadingTaskGroupLoadGateAssessment = {
  assessmentId: string;
  materialVersionId: string;
  observationPlanRevisionId: string;
  orderedSubjectIdentities: Array<{
    trainingTaskId: string;
    subjectId: string;
    subjectRevision?: number;
    responseFormat: string;
    loadLevel?: TextResponseLoadLevel;
    taskRole: 'training' | 'retest' | 'transfer';
  }>;
  groupSnapshotHash: string;
  sequencePlanningVersion: string;
  sequenceStrategy: 'entry_first' | 'holistic_first' | 'role_driven';
  sequenceReasonCode: string;
  decision: ReadingOpenResponseLoadGateDecision;
  blockerCodes: ReadingTaskGroupLoadBlockerCode[];
  advisoryCodes: ReadingTaskGroupLoadAdvisoryCode[];
  effectiveLoadSequence: Array<TextResponseLoadLevel | 'single_choice'>;
  retainedHigherOrderObservationIds: string[];
  assessedAt: string;
  gateRuleVersion: typeof READING_OPEN_RESPONSE_LOAD_GATE_VERSION;
};
```

题组 Assessment 必须使用最终展示和发布顺序，不能只审查生成返回顺序。

### 5.4 发布就绪投影

发布就绪是派生投影，不是新的领域工作流状态：

```ts
type ReadingOpenResponsePublicationReadiness = {
  subjectIdentity: string;
  contentFingerprint: string;
  groupSnapshotFingerprint: string;
  singleGateAssessmentId?: string;
  groupGateAssessmentId: string;
  status: 'ready' | 'blocked' | 'stale';
  canPublish: boolean;
  blockerCodes: string[];
  advisoryCodes: string[];
};
```

禁止增加：

```ts
reviewerId
reviewNotes
acceptedLoadWarningCodes
manualOverride
confirmedByHuman
```

负担门禁不存在人工越权放行；不合格内容应重新优化。

## 六、单题阻断规则

### 6.1 阻断码

第一版固定以下阻断码：

| 阻断码 | 触发条件 | 处理 |
| --- | --- | --- |
| `planning_trace_missing_or_stale` | 新 Candidate 缺少阶段 2 生成追踪，或追踪与当前内容不一致 | 不进入可采用列表，重新生成 |
| `composite_core_actions` | 题目包含三个或以上彼此独立的核心认知动作 | 拆题或缩减动作 |
| `required_rubric_not_in_stem` | Rubric 要求的核心观察点未在题干中表达 | 重写题干或 Rubric |
| `material_evidence_insufficient` | 指定材料范围不能支持题目要求 | 缩小要求或扩大合法证据范围 |
| `response_format_load_mismatch` | `short_text` 实际要求跨段、多对象或多关系综合 | 改为 `long_text` 或拆题 |
| `minimum_requirement_overweighted` | 最低字数或要求显著高于完成动作所需 | 降低内部建议或重写任务 |
| `hint_creates_hidden_task` | 提示新增题干未要求的评分动作或第二任务 | 收紧提示 |
| `load_identity_mismatch` | Planner intent、生成追踪、复算画像和当前题目身份不一致 | 重新生成，不静默修复身份 |

### 6.2 非阻断提醒码

第一版固定以下 advisory：

| 提醒码 | 含义 |
| --- | --- |
| `related_actions_near_boundary` | 两个相关动作接近当前负担等级上界 |
| `length_band_boundary` | 推荐长度位于相邻带边界，需要真实数据校准 |
| `developing_entry_with_foundation` | 首道文本题为 `developing`，但前置基础入口有效 |
| `answer_acceptance_needs_calibration` | 存在多个合理解释，需要在真实作答中校准接受边界 |
| `higher_order_coverage_thin` | 题组仅保留一项高阶文本观察，当前可用但需持续观察 |

这些提醒不得改变 `canPublish`，也不得要求用户确认。

### 6.3 明确不是问题的情况

以下情况不能独立触发阻断或提醒：

- 题组没有覆盖全部四个 `loadLevel`；
- 题组没有 `entry_short`，但已有合格单选或 `focused_short` 入口；
- 题组只有一项高阶文本题，但它足以承担当前 Observation Plan；
- 文本答案预计较短；
- 学生过去在相似题上表现较弱；
- 题目未显示推荐字数。

## 七、题组顺序硬校验

### 7.1 可接受的基础入口

满足下列任一条件即可形成常规题组的可访问入口：

- 观察价值合格的 `single_choice`；
- `entry_short`；
- `focused_short`；
- 具备正式例外原因的高阶起始任务。

`no_qualified_single_choice` 不代表题组失败；只要存在合格文本入口即可通过。

### 7.2 默认负担兼容性

| 相邻关系 | 默认结论 | 说明 |
| --- | --- | --- |
| `single_choice → entry_short / focused_short / developing` | 通过 | 基础理解进入文本观察 |
| `entry_short → focused_short / developing` | 通过 | 合理递进 |
| `focused_short → developing` | 通过 | 合理递进 |
| `focused_short → integrated` | 提醒 | 允许缺少中间等级，但需记录跨度 |
| `developing → integrated` | 通过 | 合理递进 |
| 同级或降低负担 | 通过 | 仍需检查重复观察价值 |
| `single_choice / entry_short → integrated` | 阻断 | 除非存在正式顺序例外 |
| 无基础入口且首道文本题为 `integrated` | 阻断 | 除非存在正式顺序例外 |

梯度只要求题组不存在无理由的负担跳跃，不要求每个负担等级都出现。

### 7.3 正式顺序例外

只允许复用现有 Planner 可解释原因：

| 策略 | 原因码 | 允许场景 |
| --- | --- | --- |
| `holistic_first` | `holistic_judgment_required` | 训练目标要求先形成整体判断 |
| `holistic_first` | `independent_expression_baseline` | 需要先观察无提示的独立表达基线 |
| `role_driven` | `retest_after_training` | 单选承担 Retest 或题组为复测 |
| `role_driven` | `transfer_in_new_context` | 单选或文本任务承担 Transfer |

例外必须绑定 Observation Plan 和 task role；仅写“教学需要”或“顺序可调整”无效。

### 7.4 题组阻断码

| 阻断码 | 触发条件 |
| --- | --- |
| `missing_accessible_entry` | 常规训练组没有低负担入口且无有效例外 |
| `unexplained_entry_to_integrated_jump` | 相邻任务发生无理由的大幅跳跃 |
| `required_higher_order_observation_missing` | Observation Plan 要求高阶文本观察，但题组被简化后已缺失 |
| `duplicate_observation_value` | 任务实质重复观察同一对象、证据和评分目标 |
| `sequence_identity_mismatch` | 最终题组顺序与已评估快照或 Planner 身份不一致 |
| `sequence_exception_missing_or_invalid` | 高阶起始或角色驱动顺序没有合法原因 |

### 7.5 特殊题组边界

- `targeted_excerpt` 的单任务组按专项微训练契约审查，不因缺少完整梯度阻断；
- Retest / Transfer 按 role-driven 顺序审查，不能仅因角色不同跳过观察价值去重；
- 单选与文本题即使格式不同，只要同时重复对象、证据和评分目标，仍视为重复；
- 低负担化不得删除 Observation Plan 明确要求的高阶观察。

## 八、接入现有质量与发布链

### 8.1 Candidate 阶段

新 Candidate 生成完成后依次执行：

```text
结构校验
→ 阶段 2 生成追踪校验
→ 单题负担门禁
→ 候选题组负担门禁
→ 可采用投影
```

任一 blocker 存在时：

- Candidate 可以保留为失败证据；
- 不进入可采用 Candidate 列表；
- 当前正式题组不变；
- 用户获得“重新生成 / 重新优化”动作；
- 不要求用户理解或确认内部阻断码。

### 8.2 Adopt 后 Draft 阶段

采用后创建 Draft Revision 时：

- 使用采用内容重新计算 `contentHash`；
- 复用相同规则重新评估；
- 若内容和上下文未变，结论必须与 Candidate 阶段一致；
- Candidate 与 Draft Assessment 必须能通过来源身份关联；
- 不允许采用时静默改写题干、Rubric、长度或负担等级。

### 8.3 Quality Assessment 集成

实现优先采用组合而不是替换：

- 现有 `QuestionQualityAssessment` 继续承担材料依据、观察清晰度、区分度、难度、Rubric 和范围检查；
- 新负担 Assessment 作为 Assessment Bundle 的独立组成部分；
- blocker 汇总到 publication readiness；
- advisory 保留为治理证据，不进入逐条人工确认；
- `questionQualityReviewGate` 不得为负担 advisory 抛出 `REVIEW_WARNING_DECISION_REQUIRED`。

### 8.4 发布前检查

发布命令只做：

1. 读取当前 Revision 和题组快照；
2. 校验 readiness 使用的内容与组快照指纹仍然有效；
3. 若有效，复用已通过 Assessment，不运行另一套业务规则；
4. 若 stale，重新评估并返回明确可恢复状态；
5. 若发布成功，清理旧 Candidate 错误投影并以正式状态为准。

## 九、工作台产品投影

### 9.1 允许状态

| 内部结果 | 任务卡状态 | 主操作 |
| --- | --- | --- |
| `ready` | 可以发布 | 采用并发布 |
| `ready + advisory` | 可以发布 | 采用并发布 |
| `blocked` | 需要重新优化 | 重新生成题目 |
| `stale` | 正在重新检查 / 可重试 | 重新检查 |
| 正在发布 | 正在发布 | 按钮禁用，不同时显示可点击“采用并发布” |
| 已发布 | 已发布 | 不再显示旧 Candidate 主操作 |

### 9.2 文案边界

- 不显示“需要确认”来表达确定性质量问题；
- 不显示“可以发布”同时列出会在发布时阻断的负担问题；
- 不把 advisory 命名为“质量问题”；
- blocker 的用户文案说明应重新优化什么，不暴露工程码；
- 错误反馈应在当前任务卡或操作附近出现，不能只出现在长页面顶部；
- 内部长度、`loadLevel` 和 Assessment 版本不进入学生端。

## 十、工程工作包

### WP3.1 Schema 与规则版本

已新增：

- `src/ai/schemas/readingOpenResponseLoadGate.schema.ts`

完成：

- 单题与题组 Assessment 类型守卫；
- blocker / advisory 常量；
- 指纹和版本字段；
- clone、validate 和 stale 判定。

### WP3.2 单题负担门禁

已新增：

- `src/ai/agents/readingOpenResponseLoadQualityGate.ts`

复用阶段 1 分析器和阶段 2 生成追踪，实现确定性 blocker / advisory 判定。

### WP3.3 题组顺序门禁

已新增：

- `src/ai/agents/readingTaskGroupLoadQualityGate.ts`

复用 `trainingTaskSequencePlanner_v2`，只校验最终有效顺序、例外原因、重复观察和高阶观察保留。

### WP3.4 质量 Bundle 集成

已通过组合式 readiness 与既有质量链完成接入：

- `src/ai/agents/questionQualityAssessmentAgent.ts`
- `src/ai/agents/questionQualityReviewGate.ts`
- 相关 Assessment repository / schema adapter

要求：

- 不破坏现有 Assessment 身份；
- 负担 blocker 进入 readiness；
- 负担 advisory 不进入人工确认；
- 规则版本变化后旧 Assessment 明确 stale。

### WP3.5 发布就绪一致性

已完成：

- `src/ai/agents/questionResourceAdmissionAgent.ts`
- 采用并发布应用服务；
- 正式资源发布前置校验。

要求：

- UI 与发布消费同一 readiness；
- content / revision / group snapshot 指纹一致；
- 重试幂等；
- 发布成功状态优先；
- 运行时失败与质量失败分离。

### WP3.6 工作台投影

已完成：

- `src/pages/taskProductionState.ts`
- `src/pages/MaterialResourceProductionWorkbench.jsx`

要求：

- 不新增人工审核步骤；
- blocked 不显示“可以发布”；
- publishing 不同时显示可点击发布动作；
- 错误在当前卡附近可见；
- advisory 默认不干扰主决策。

### WP3.7 专项测试与报告

已新增：

- `src/ai/tests/runReadingOpenResponseInputLoadStage3Debug.ts`
- `debug:reading-open-response-load-stage3` package script；
- `docs/education/phase/reports/reading_open_response_input_load_stage3_engineering_debug_acceptance_2026-08-21.md`。

## 十一、Debug 验收矩阵

阶段 3 专项最低验收为 `48 / 48`。

### A. Schema 与单题门禁（P3-01—P3-12）

| 编号 | 验收项 | 预期 |
| --- | --- | --- |
| P3-01 | 单题 Assessment 完整值通过 guard | 通过 |
| P3-02 | 缺少指纹、版本或决定被 guard 拒绝 | 拒绝 |
| P3-03 | 新 Candidate 缺少或使用过期阶段 2 追踪 | blocked |
| P3-04 | 既有 Frozen Resource 缺少新追踪 | 不追溯阻断 |
| P3-05 | 三个独立核心动作 | blocked |
| P3-06 | Rubric 存在题干未要求的核心动作 | blocked |
| P3-07 | 材料范围不足以支持任务 | blocked |
| P3-08 | `short_text` 实际要求多段、多对象综合 | blocked |
| P3-09 | 最低要求显著高于动作所需 | blocked |
| P3-10 | 提示新增隐藏任务 | blocked |
| P3-11 | 相邻长度带或答案接受边界 | advisory，不阻断 |
| P3-12 | 推荐长度、负担等级不进入学生字段 | 零泄漏 |

### B. 题组顺序与观察价值（P3-13—P3-24）

| 编号 | 验收项 | 预期 |
| --- | --- | --- |
| P3-13 | `single_choice → focused_short` | 通过 |
| P3-14 | `entry_short → developing` 且缺少 focused | 通过 |
| P3-15 | 题组未覆盖全部四级 | 不阻断、不补题 |
| P3-16 | 无基础入口且首题为 integrated | blocked |
| P3-17 | `single_choice → integrated` 无例外 | blocked |
| P3-18 | `focused_short → integrated` | advisory，可通过 |
| P3-19 | `developing → integrated` | 通过 |
| P3-20 | 先整体判断的正式例外 | 通过 |
| P3-21 | 先独立表达的正式例外 | 通过 |
| P3-22 | Retest / Transfer role-driven 顺序 | 通过 |
| P3-23 | 无高质量单选但存在合格文本入口 | 通过 |
| P3-24 | 不同题型重复对象、证据和评分目标 | blocked |

### C. 发布一致性与恢复（P3-25—P3-36）

| 编号 | 验收项 | 预期 |
| --- | --- | --- |
| P3-25 | Observation Plan 要求高阶观察但题组已删除 | blocked |
| P3-26 | targeted_excerpt 单题组缺少完整梯度 | 不误阻断 |
| P3-27 | 相同输入生成相同 content / group fingerprint | 确定性一致 |
| P3-28 | 题组顺序变化后旧 Assessment | stale |
| P3-29 | Revision 或内容变化后旧 Assessment | stale |
| P3-30 | Candidate 与采用后未变 Draft 的门禁结论 | 一致 |
| P3-31 | 页面 ready 后点击发布，同指纹业务检查 | 不再阻断 |
| P3-32 | blocker 存在 | `canPublish=false` |
| P3-33 | 只有 advisory | `canPublish=true` |
| P3-34 | readiness 不含人工确认字段 | 通过 |
| P3-35 | 同一发布命令失败后重试 | 幂等、不重复正式版本 |
| P3-36 | 对正式资源库运行专项审计 | 零内容写入 |

### D. 产品投影与全链回归（P3-37—P3-48）

| 编号 | 验收项 | 预期 |
| --- | --- | --- |
| P3-37 | 工作台负担门禁不新增“需要确认” | 通过 |
| P3-38 | blocked Candidate 的主操作 | 重新生成 / 优化 |
| P3-39 | 卡片底部操作失败 | 当前卡附近可见，不依赖回到页首 |
| P3-40 | publishing 状态 | 不同时显示可点击发布按钮 |
| P3-41 | 已发布状态 | 清除旧 Candidate 状态和错误 |
| P3-42 | 阅读单选 Stage 1—4 | 全部回归通过 |
| P3-43 | Question Candidate 主链 | 回归通过 |
| P3-44 | Targeted Micro-training Stage 1—4 | 全部回归通过 |
| P3-45 | Learning Session Task Queue | 回归通过 |
| P3-46 | 阶段 1 `28 / 28`、阶段 2 `40 / 40` | 继续通过 |
| P3-47 | 生产构建 | 退出码 0 |
| P3-48 | 工程报告记录版本、命令、退出码、残余风险和回滚点 | 完整 |

## 十二、真实浏览器冒烟

自动化通过后至少验证：

1. 合格文本 Candidate 显示“可以发布”，点击后不出现负担业务阻断；
2. 只有 advisory 的 Candidate 仍可直接采用并发布，不出现确认入口；
3. blocker Candidate 不显示“可以发布”，只允许重新优化；
4. 发布过程中按钮进入唯一 loading 状态；
5. 发布成功后任务原位显示已发布，旧提醒消失；
6. 题组顺序变化造成 stale 时，可重新检查和重试；
7. 页面底部触发的错误在当前卡附近可见；
8. 已打开的 Learning Session 不被新版本或顺序修改。

浏览器验收必须使用隔离 Candidate / Draft 或测试仓，不得为验收覆盖现有正式题。

阶段 3 首次工程验收曾使用仅在开发环境、显式携带 `stage3LoadGateVerify=1` 时出现的隔离状态面板。该临时面板不调用保存、采用或发布接口，验收期间正式数据写入为零。

该临时面板已在验收完成后从正式工作台移除。工作台不得再根据查询参数展示模拟 Candidate、模拟状态按钮或无真实业务含义的“采用并发布”操作；旧 `stage3LoadGateVerify` 参数在开发环境进入工作台时会被清理。后续发布状态投影由阶段 3 自动化 Debug、B4 隔离浏览器矩阵和真实 Candidate 主链共同验收，不再复用正式工作台界面承载测试控件。

`2026-08-21` 真实浏览器结果：

- ready：显示“可以发布”和唯一“采用并发布”主操作；
- advisory：保持“可以发布”，只显示非阻断提醒，不出现“需要确认”；
- blocked：显示“需要重新优化”，错误位于当前卡片，且不显示发布主操作；
- stale：显示“需要重新检查”，错误位于当前卡片并提供重新检查入口；
- publishing：只显示不可重复触发的“正在发布”；
- published：原位显示“已发布”，旧发布动作和错误均已清除；
- 页面运行日志无 error，正式材料、题目和 Learning 数据未变化。

## 十三、回归命令基线

阶段 3 工程完成后至少运行：

```bash
npm run debug:reading-open-response-load-stage3
npm run debug:reading-open-response-load-stage2
npm run debug:reading-open-response-load-stage1
npm run debug:reading-single-choice-stage1
npm run debug:reading-single-choice-stage2
npm run debug:reading-single-choice-stage3
npm run debug:reading-single-choice-stage4
npm run debug:question-candidate-workflow
npm run debug:targeted-micro-training-stage1
npm run debug:targeted-micro-training-stage2
npm run debug:targeted-micro-training-stage3
npm run debug:targeted-micro-training-stage4
npm run debug:learning-session-task-queue
npm run build
```

如果仓库使用工作区绑定 Node，验收报告必须记录实际 Node 路径、版本、命令和退出码。

## 十四、阶段完成条件

只有同时满足以下条件，阶段 3 才可标记 `ENGINEERING COMPLETE / DEBUG ACCEPTED`：

- [x] WP3.1—WP3.7 全部完成；
- [x] P3-01—P3-48 全部通过；
- [x] 阶段 1 `28 / 28`、阶段 2 `40 / 40` 继续通过；
- [x] 单选、Candidate、Targeted 和 Learning 队列回归通过；
- [x] ready 状态与发布业务规则使用同一 Assessment 和指纹；
- [x] blocker 不显示“可以发布”；
- [x] advisory 不新增人工确认；
- [x] publishing / published 状态没有旧动作和错误残留；
- [x] 正式资源、活动 Session 和 Student Ability Profile 零写入；
- [x] 真实浏览器冒烟全部通过；
- [x] 阶段 3 工程验收报告已归档。

## 十五、阶段 4 进入门

进入既有题治理与真实校准前必须证明：

- 新 Candidate 的负担门禁能稳定拦截确定性问题；
- 题组顺序不会因机械层级配额改变 Observation Plan；
- “可以发布”与实际发布不存在业务规则矛盾；
- 非阻断提醒不增加人工干扰；
- 既有正式题审计保持只读；
- 真实 Learning 数据仍以 Evidence、Diagnosis、Retest / Transfer 解释能力，不使用 `loadLevel` 直接推断学生能力。

阶段 4 才允许：

- 对基线审计发现的高风险正式题逐题生成后继 Candidate；
- 以采用并发布方式形成新正式版本；
- 收集完成率、停顿、无效输入、修订率和后续独立表现；
- 基于真实数据校准推荐长度、负担边界和 advisory 阈值。

## 十六、冻结结论

阶段 3 的核心不是增加更多审核，而是把阶段 1、2 已验证的规则收敛为同源、确定、可恢复的发布前质量判断。

最终必须保持：

```text
系统负责生成、校验、解释和恢复；
人只负责采用并发布，或不采用并重新优化。
```

当前工程实施、`48 / 48` 自动化 Debug、关键主链回归、生产构建和隔离真实浏览器状态转换均已完成。阶段 3 已达到 `ENGINEERING COMPLETE / DEBUG ACCEPTED`；后续可以进入既有题批量治理与真实 Learning 校准，但不得把隔离验收面板或模拟状态当作真实教育效果证据。
