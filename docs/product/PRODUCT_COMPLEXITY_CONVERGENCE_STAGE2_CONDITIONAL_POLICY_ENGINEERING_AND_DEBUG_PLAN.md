# 产品复杂度收口阶段 2：条件触发策略收口工程实施与 Debug 验收文档

英文名称：Product Complexity Convergence Stage 2 Conditional Capability Policy Engineering and Debug Plan
阶段契约版本：`product_complexity_convergence_stage2_conditional_policy_v1`
对应总契约：`product_complexity_convergence_v1`
状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED`
日期：2026-08-24

关联文档：

- [产品复杂度收口总契约](./PRODUCT_COMPLEXITY_CONVERGENCE_CONTRACT.md)
- [阶段 0 只读复杂度审计工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_READ_ONLY_AUDIT_ENGINEERING_AND_DEBUG_PLAN.md)
- [阶段 1 页面投射与默认展示收口工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE1_SURFACE_PROJECTION_ENGINEERING_AND_DEBUG_PLAN.md)
- [阶段 2 工程、Debug 与浏览器验收报告](../education/phase/reports/product_complexity_convergence_stage2_engineering_debug_browser_acceptance_2026-08-24.md)
- [Learning 反馈后一次修订契约](./LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md)
- [Targeted Micro-training 素材与调度契约](./TARGETED_MICRO_TRAINING_MATERIAL_AND_SCHEDULING_CONTRACT.md)

## 一、阶段定位

阶段 2 只收敛四类条件能力的触发策略：

- Revision；
- Targeted Micro-training；
- Retest；
- Transfer。

本阶段解决的不是“增加更多自适应功能”，而是让现有条件能力具备一致、可解释、可退出、可恢复、可审计的进入边界。

阶段 2 必须把以下原则落实为工程事实：

> 条件能力只有在存在明确问题、明确收益、明确触发条件和明确退出条件时才允许运行；不触发是正常结果，核心学习链始终能够独立完成。

阶段 2 不是新的 Learning Orchestrator，不建立第二套条件能力状态机，也不修改反馈生成、Diagnosis、Evidence、Profile 或 Training Model。

## 二、贯穿全部阶段的验收原则

阶段 2 必须同时证明：

> 旧主链零回归，并且新语义只在阶段 2 允许的条件能力策略边界内生效。

具体要求：

1. `Material → Plan → Task → Candidate → Adopt → Revision → Publish → Learning` 主链不变；
2. Frozen Resource、Registry Head 与 Version Chain 不变；
3. Revision、Targeted、Retest、Transfer 的既有领域对象继续承担各自事实权威；
4. 统一策略层不得成为新的任务、Attempt、Evidence 或 Profile 来源；
5. shadow audit 只比较，不改变正式行为；
6. 正式启用时按单项能力逐步切换，不允许四类能力一次性整体切换；
7. 未启用能力继续完全执行旧策略；
8. 已开始的旧 Session、旧 Revision、旧 Targeted Assignment、旧 Retest Plan 与旧 Transfer Task 不被中途改写；
9. 新策略失败时不得阻断核心题组、丢失学生回答或制造递归干预；
10. 普通页面继续只消费阶段 1 的用户投射，不显示本阶段内部代码；
11. Internal / Fixture / Shadow 记录不得进入正式资源、Attempt、Evidence、Profile 或真实校准分母；
12. Production Build 与旧主链专项回归必须通过。

## 三、本阶段绝对禁止的修改

阶段 2 不得修改：

- Material、Material Version、段落与正文身份；
- Observation Plan、TrainingTask、QuestionCandidate 和 Load Semantics；
- Question Prompt、题目质量评估、Admission 与 Publication；
- Frozen Resource 和历史正式题；
- 题组正式顺序、当前题号和 Session Snapshot 的既有语义；
- 首次独立回答、Revision、Targeted、Retest、Transfer 的证据身份；
- Diagnosis 内容与主要缺口生成；
- 学生反馈、Hint 与 Revision Evaluation 的表达策略；
- Evidence Admission、Progression Assessment 与 Student Profile；
- Outbox、幂等键和恢复身份的既有含义；
- 阶段 1 普通页面白名单与内部术语隐藏规则。

禁止以“统一策略”为理由：

- 重建 Learning Queue；
- 把四类条件能力合并成一个通用任务对象；
- 把一次条件能力结果写成学生长期能力结论；
- 把 Revision 改成第二次首次作答；
- 把 Targeted 失败递归成新的 Targeted；
- 把 Retest 或 Transfer 当作普通训练题自动追加；
- 使用自由文本作为触发、退出、聚合或效果判断依据；
- 追溯回写历史记录以补齐新字段；
- 在策略不确定时阻断核心学习链。

## 四、架构边界：统一判定封套，不统一领域状态机

### 4.1 既有能力继续拥有事实权威

| 条件能力 | 既有事实权威 | 阶段 2 的作用 |
| --- | --- | --- |
| Revision | `LearningFeedbackRevisionOfferSnapshot`、`FeedbackGuidedRevision` | 统一表达触发 / 不触发理由、收益、退出和限次 |
| Targeted | `TargetedMicroTrainingTriggerDecision`、Request、Assignment、Session Overlay | 统一表达原子 Gap、匹配失败、限次、回到核心序列 |
| Retest | `DelayedRetestCandidate`、`DelayedRetestPlan`、Task Request | 统一表达何时到期、独立验证收益和延期原因 |
| Transfer | `NextLearningStrategy`、Strategy Validation、Task Request | 统一表达稳定基础、新情境要求和不安排原因 |

本阶段新增的统一对象只能是**判定封套和审计投影**，不能成为第五套任务状态。

### 4.2 三种决策视图

每次策略评估同时保留：

1. `ownerDecision`：既有能力真实产生的原生决策；
2. `convergedDecision`：阶段 2 统一策略计算的建议决策；
3. `effectiveDecision`：本次运行真正执行的决策。

规则如下：

- `shadow` 模式：`effectiveDecision = ownerDecision`；
- `enforced` 模式：仅对已单独启用的能力允许 `effectiveDecision = convergedDecision`；
- 未启用能力始终执行 `ownerDecision`；
- shadow 不一致只产生内部审计结果，不改变按钮、队列、命令或写入；
- 不得同时存在两个 `effectiveDecision`。

### 4.3 单一事实来源

统一判定封套必须引用既有对象，不复制其完整内容：

- 只保存稳定 ID、版本、结构化原因与校验结果；
- 不复制学生答案、完整反馈、完整 Diagnosis 或题目正文；
- 原生对象发生变化后必须重新评估，旧封套不得静默覆盖；
- 封套不参与 Evidence Admission 和 Profile 计算；
- 封套丢失时，历史原生事实仍可独立恢复。

## 五、Schema 冻结

### 5.1 版本常量

```ts
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_SCHEMA_VERSION =
  'product_complexity_convergence_stage2_conditional_policy_v1' as const;

export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_POLICY_VERSION =
  'product_complexity_convergence_stage2_policy_v1' as const;
```

Schema Version 描述结构；Policy Version 描述触发规则。二者必须独立升级。

### 5.2 条件能力与运行模式

```ts
export type ConvergenceConditionalCapability =
  | 'revision'
  | 'targeted'
  | 'retest'
  | 'transfer';

export type ConvergenceConditionalPolicyMode =
  | 'shadow'
  | 'enforced';

export type ConvergenceConditionalDecisionOutcome =
  | 'trigger'
  | 'no_action'
  | 'defer'
  | 'blocked';
```

语义：

- `trigger`：本次满足条件，可以进入该能力；
- `no_action`：本次无需进入，核心链继续；
- `defer`：当前不进入，但保留未来重新评估条件；
- `blocked`：输入身份、事实完整性或防循环边界不成立，不得创建新条件动作。

`blocked` 只阻止新增条件动作，不得阻止核心学习链。

### 5.3 结构化收益码

```ts
export type ConvergenceConditionalExpectedBenefitCode =
  | 'resolve_revision_gap'
  | 'isolate_atomic_gap'
  | 'verify_independent_retention'
  | 'verify_transfer';
```

冻结映射：

| 能力 | `expectedBenefitCode` |
| --- | --- |
| Revision | `resolve_revision_gap` |
| Targeted | `isolate_atomic_gap` |
| Retest | `verify_independent_retention` |
| Transfer | `verify_transfer` |

`expectedBenefitDescription` 可以保留为内部可读说明，但不得参与：

- 条件判断；
- 统计聚合；
- 效果比较；
- 退出决策；
- UI 可用性判断。

### 5.4 原因码

```ts
export type ConvergenceConditionalReasonCode =
  // Revision
  | 'revision_actionable_gap'
  | 'revision_no_actionable_gap'
  | 'revision_not_needed'
  | 'revision_already_used'
  | 'revision_role_ineligible'
  // Targeted
  | 'targeted_atomic_gap_confirmed'
  | 'targeted_gap_not_atomic'
  | 'targeted_resource_unavailable'
  | 'targeted_limit_reached'
  | 'targeted_session_unsuitable'
  | 'targeted_intervention_conflict'
  // Retest
  | 'retest_due'
  | 'retest_not_due'
  | 'retest_evidence_insufficient'
  | 'retest_already_scheduled'
  | 'retest_resource_unavailable'
  // Transfer
  | 'transfer_stable_basis_ready'
  | 'transfer_foundation_not_stable'
  | 'transfer_new_context_unavailable'
  | 'transfer_already_scheduled'
  // Shared safety
  | 'source_fact_missing'
  | 'identity_mismatch'
  | 'policy_input_invalid'
  | 'recursive_chain_blocked'
  | 'legacy_unobserved';
```

约束：

- 每个决策必须且只能有一个主 `reasonCode`；
- 其他补充原因进入 `secondaryReasonCodes`；
- 结构化原因码不得由显示文案反向解析；
- 新增原因码必须升级 Policy Version 并提供兼容映射；
- 原生系统已有更细原因码时，使用 `ownerReasonCode` 原样引用，不删除原信息。

### 5.5 退出、回退与防循环

```ts
export type ConvergenceConditionalExitConditionCode =
  | 'revision_submitted_or_declined'
  | 'targeted_completed_skipped_or_unavailable'
  | 'retest_completed_cancelled_or_rescheduled'
  | 'transfer_completed_cancelled_or_superseded';

export type ConvergenceConditionalFallbackCode =
  | 'continue_core_queue'
  | 'preserve_active_owner_flow'
  | 'wait_until_due'
  | 'keep_existing_schedule';

export type ConvergenceConditionalLoopGuard = {
  scopeKey: string;
  currentDepth: number;
  maximumDepth: number;
  usageCount: number;
  usageLimit: number;
  passed: boolean;
};
```

统一硬边界：

- Revision：同一首次 Attempt 最多一次；
- Targeted：同一核心 Gap、同一 Round 最多一次，递归深度必须为 `0`；
- Retest：同一验证目标不得重复创建未完成计划；
- Transfer：同一验证目标不得重复创建未完成任务；
- 已激活流程发生策略读取失败时，使用 `preserve_active_owner_flow`，不得遗弃原流程；
- 尚未激活的条件能力发生策略失败时，不新增条件动作并继续核心链。

### 5.6 权威引用与统一判定封套

```ts
export type ConvergenceConditionalSourceFactRef = {
  factType:
    | 'attempt'
    | 'diagnosis'
    | 'feedback'
    | 'revision_evaluation'
    | 'targeted_gap'
    | 'ability_evidence'
    | 'growth_memory'
    | 'retest_candidate'
    | 'retest_plan'
    | 'next_learning_strategy';
  factId: string;
  factSchemaVersion?: string;
};

export type ConvergenceConditionalOwnerDecisionRef = {
  ownerType:
    | 'revision_offer_snapshot'
    | 'targeted_trigger_decision'
    | 'delayed_retest_candidate'
    | 'next_learning_strategy';
  ownerId: string;
  ownerPolicyVersion: string;
  ownerOutcome: string;
  ownerMappedOutcome: ConvergenceConditionalDecisionOutcome;
  ownerReasonCode?: string;
};

export type ConvergenceConditionalPolicyDecision = {
  schemaVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_SCHEMA_VERSION;
  policyVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_POLICY_VERSION;
  decisionId: string;
  decisionHash: string;
  persistenceRole: 'audit_projection';
  mode: ConvergenceConditionalPolicyMode;
  capability: ConvergenceConditionalCapability;
  studentId: string;
  learningSessionId?: string;
  learningRoundId?: string;
  sourceAttemptId?: string;
  sourceResourceVersionId?: string;
  sourceFactRefs: ConvergenceConditionalSourceFactRef[];
  sourceEvidenceIds: string[];
  ownerDecision: ConvergenceConditionalOwnerDecisionRef;
  convergedOutcome: ConvergenceConditionalDecisionOutcome;
  effectiveOutcome: ConvergenceConditionalDecisionOutcome;
  reasonCode: ConvergenceConditionalReasonCode;
  secondaryReasonCodes: ConvergenceConditionalReasonCode[];
  expectedBenefitCode?: ConvergenceConditionalExpectedBenefitCode;
  expectedBenefitDescription?: string;
  exitConditionCode?: ConvergenceConditionalExitConditionCode;
  fallbackCode: ConvergenceConditionalFallbackCode;
  loopGuard: ConvergenceConditionalLoopGuard;
  evaluatedAt: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

结构约束：

1. `trigger` 必须有 `expectedBenefitCode`、`exitConditionCode`、有效 Source Ref 和通过的 Loop Guard；
2. `no_action`、`defer`、`blocked` 不得伪造已触发入口；
3. `shadow` 模式下 `effectiveOutcome` 必须映射自 `ownerDecision`；
4. `enforced` 模式只允许对已启用能力执行收口策略；
5. `sourceFactRefs` 至少包含一个真实既有事实；`sourceEvidenceIds` 只允许引用已经存在的 Evidence；
6. Revision / Targeted 尚未形成正式 Evidence 时允许 `sourceEvidenceIds = []`，但不得伪造 Evidence ID；
7. `decisionId` 和 `decisionHash` 必须确定性生成；
8. 相同输入、相同 Owner Version、相同 Policy Version 必须得到相同决策；
9. 封套不得保存学生答案、完整 Diagnosis、完整反馈或正文；
10. 封套是审计投影，不是能力生命周期实体。

### 5.7 一致性比较

```ts
export type ConvergenceConditionalDecisionAlignment =
  | 'aligned'
  | 'behavior_divergence'
  | 'reason_divergence'
  | 'insufficient_legacy_fact'
  | 'not_compared';

export type ConvergenceConditionalPolicyAuditResult = {
  decisionId: string;
  capability: ConvergenceConditionalCapability;
  alignment: ConvergenceConditionalDecisionAlignment;
  ownerOutcome: string;
  convergedOutcome: ConvergenceConditionalDecisionOutcome;
  effectiveOutcome: ConvergenceConditionalDecisionOutcome;
  behaviorChanged: boolean;
  protectedWriteCount: 0;
  issues: string[];
};
```

shadow 模式中 `behaviorChanged` 必须恒为 `false`。

## 六、策略边界冻结

### 6.1 Revision

仅当以下事实同时成立时允许 `trigger`：

- 当前回答已有正式 Feedback 与可引用 Diagnosis；
- 存在一个明确、可修订的主要缺口；
- 学生可在当前题内根据反馈完成一次修订；
- 当前 Task Role 允许修订；
- 当前首次 Attempt 尚未使用 Revision；
- 修订不会覆盖首次独立回答。

下列情况必须 `no_action`：

- 回答已满足主要要求；
- 只有泛化建议，没有可执行主要缺口；
- 当前题为 Retest / Transfer；
- 当前 Attempt 已修订；
- 修订只会要求重做整题而无独立学习收益。

退出后必须进入当前题完成态或下一题，不得再次提供第二次 Revision。

### 6.2 Targeted Micro-training

仅当以下事实同时成立时允许 `trigger`：

- Gap 已被确认为一次小任务可以重新执行的具体动作；
- Gap、Ability、Task Role、资源身份与证据范围匹配；
- 新任务不同时重复原题的观察对象、证据范围和评分目标；
- 存在正式可消费的 Targeted Resource；
- Session 插入额度未耗尽；
- 当前没有 Revision 或其他 Targeted 正在运行；
- 完成、跳过或不可用后可以确定性返回原核心序列。

下列情况必须 `no_action`：

- Gap 过于宏观；
- 只能得到与原题实质重复的任务；
- 无正式匹配资源；
- 已达到限次；
- 会造成递归训练；
- 当前 Session 已不适合插入。

Targeted 失败不得生成第二个 Targeted，也不得改变首次独立表现。

### 6.3 Retest

仅当以下事实同时成立时允许 `trigger`：

- 已存在需要独立保持验证的先前表现；
- 到达版本化时间条件或明确验证窗口；
- 任务不依赖当前反馈、提示或 Targeted 内容；
- 存在身份匹配的正式 Retest Resource；
- 没有同一验证目标的未完成计划。

未到时间必须 `defer`；证据不足、资源不可用或身份不匹配必须 `no_action` 或 `blocked`，但不得阻断当前学习。

Retest 结果继续由原有 Evidence 规则解释，不因本策略触发而自动视为保持成立。

### 6.4 Transfer

仅当以下事实同时成立时允许 `trigger`：

- 同一核心能力已有相对稳定、身份一致的独立证据；
- 当前需要验证新材料或新情境中的迁移；
- 新任务满足 Transfer 的材料关系与任务角色约束；
- 存在正式可消费的 Transfer Resource；
- 没有同一验证目标的未完成任务。

基础尚未稳定、仍依赖反馈支持或缺少新情境时必须 `no_action`。Transfer 不得作为普通 Training 的别名，不得因为题库中存在 Transfer 资源就自动安排。

## 七、条件能力之间的冲突与顺序

阶段 2 不建立通用编排器，只冻结冲突边界：

1. 同一当前 Attempt 不得同时激活 Revision 与 Targeted；
2. Revision 必须先完成、放弃或明确不触发，Targeted 才允许基于最终 Gap 评估；
3. Targeted 是 Session Overlay，完成后必须回到核心队列；
4. Retest 与 Transfer 是独立正式任务，不嵌套在 Revision 或 Targeted 内；
5. Targeted 完成不自动创建 Retest；Retest / Transfer 由原有策略边界在后续独立评估；
6. Revision 支持下改善不能直接满足 Transfer 的稳定基础；
7. 同一验证目标存在未完成 Retest / Transfer 时不得重复创建；
8. 冲突无法安全消解时选择 `no_action`，继续核心学习链。

优先级只用于消除同一时刻的冲突，不表示固定学习流程，也不要求四类能力依次出现。

## 八、Shadow Audit 与逐项启用

### 8.1 Shadow 阶段

Shadow 必须：

- 同时运行 Owner Decision 与 Converged Decision；
- 执行结果仍以 Owner Decision 为准；
- 记录行为结果和原因是否一致；
- 统计 `trigger / no_action / defer / blocked`；
- 对缺失旧事实标记 `insufficient_legacy_fact`；
- 不改变页面、队列、按钮、命令或写入；
- 不进入真实教育效果分母。

Shadow 不允许：

- 以新策略替换正式结果；
- 补写历史决策；
- 通过页面提示诱导用户执行新能力；
- 把差异直接视为旧策略错误。

### 8.2 启用顺序

固定启用顺序：

1. Revision；
2. Targeted；
3. Retest；
4. Transfer。

每项能力必须独立具备 Feature Flag：

```ts
type ConvergenceConditionalCapabilityFlags = {
  revision: 'legacy' | 'shadow' | 'enforced';
  targeted: 'legacy' | 'shadow' | 'enforced';
  retest: 'legacy' | 'shadow' | 'enforced';
  transfer: 'legacy' | 'shadow' | 'enforced';
};
```

规则：

- 默认值全部为 `legacy`；
- 开发完成后先进入 `shadow`；
- 前一能力通过专项、旧主链和浏览器验收后，下一能力才可启用；
- 任一能力可独立退回 `legacy`，不要求数据回滚；
- Flag 必须在 Session 开始时冻结，禁止同一 Session 中途切换语义。

## 九、迁移与历史兼容冻结

### 9.1 不做批量迁移

历史数据执行以下规则：

- 不回写 `ConvergenceConditionalPolicyDecision`；
- 不修改历史 Revision Offer、Targeted Decision、Retest Plan 或 Transfer Strategy；
- 不修改 Frozen Resource；
- 不重新计算历史 Trigger；
- 不把缺少阶段 2 封套视为数据损坏。

### 9.2 Legacy 读取

兼容读取规则：

- 没有阶段 2 封套时，直接执行既有 Owner Decision；
- 需要只读审计时投射为 `legacy_unobserved`；
- `legacy_unobserved` 不得进入触发率、收益率或失败率分母；
- 已开始旧 Session 固定使用其启动时策略；
- 已激活旧条件流程继续由原 Owner 恢复和完成；
- 旧记录缺少结构化原因时保留原始 Reason，不推断伪造新 Code。

### 9.3 新旧版本并存

- 新决策必须保存 Schema Version、Policy Version 与 Owner Policy Version；
- 同一 Session 中同一能力只能执行一个 Policy Version；
- 新 Policy 不得静默重解释旧决策；
- Policy 升级必须提供原因码与收益码兼容映射；
- 决策 Hash 必须包含 Owner Decision Identity、Policy Version 和稳定输入摘要。

### 9.4 回滚

回滚只允许：

- 将单项能力 Flag 从 `enforced` 切回 `legacy`；
- 保留已生成的审计封套；
- 停止新的 Converged Decision 生效；
- 让已激活流程由原 Owner 安全完成。

回滚不得：

- 删除历史审计事实；
- 回滚学生回答或 Attempt；
- 修改 Evidence / Profile；
- 恢复旧页面内部术语；
- 取消已完成的正式 Retest / Transfer。

### 9.5 审计存储兼容

阶段 2 的统一封套使用独立、追加式、非权威审计仓：

```text
database: yuwen-xiaolian-product-complexity-convergence-stage2
version: 1
store: conditional-policy-audit-decisions
keyPath: decisionId
```

约束：

- 不升级、不复用正式资源、Learning Collection、Revision、Targeted 或 Progression 数据库；
- 正式运行仍只读取各能力原生 Owner Repository；
- 审计仓不得成为 Scheduler、Queue、Evidence、Profile 或 UI 的输入；
- IndexedDB 不可用或审计写入失败时，记录可恢复内部问题并继续 Owner Flow；
- 测试使用 In-memory Repository，浏览器验收使用隔离数据库名；
- 清理审计仓不得删除任何正式学习事实；
- 将来退役统一审计能力时，可以停止写入该仓而无需迁移领域数据。

## 十、失败与恢复边界

| 失败位置 | 尚未激活条件能力 | 已激活条件能力 |
| --- | --- | --- |
| Policy 输入缺失 | 不触发，继续核心链 | 保留 Owner Flow |
| Shadow 计算失败 | 仅记录内部失败 | 正式行为不变 |
| 审计写入失败 | 不阻断用户 | 不回滚已完成操作 |
| Resource Match 失败 | 不触发 / 延后 | 返回 Owner 的 unavailable / no-match 恢复 |
| 身份不一致 | 阻止新增条件动作 | 保留当前已确认事实，停止错误推进 |
| 重复点击 | 返回既有幂等结果 | 不创建第二事实 |
| 刷新 / 跨标签 | 按 Session 固定版本恢复 | 恢复同一个 Owner Identity |

普通用户只看到阶段 1 已冻结的本地提示和恢复入口，不显示 Policy、Hash、Identity、Owner、Shadow 或 Code。

## 十一、建议工程结构

建议新增：

```text
src/ai/schemas/productComplexityConvergenceConditionalPolicy.schema.ts
src/ai/agents/productComplexityConvergenceConditionalPolicyAgent.ts
src/ai/agents/productComplexityConvergenceConditionalPolicyOwnerAdapters.ts
src/ai/services/productComplexityConvergenceConditionalPolicyService.ts
src/ai/services/productComplexityConvergenceConditionalSessionPolicyService.ts
src/ai/repositories/productComplexityConvergenceConditionalPolicyAuditRepository.ts
src/ai/repositories/inMemoryProductComplexityConvergenceConditionalPolicyAuditRepository.ts
src/ai/repositories/indexedDBProductComplexityConvergenceConditionalPolicyAuditRepository.ts
src/ai/tests/runProductComplexityConvergenceStage2Debug.ts
src/api/productComplexityConvergenceStage2BrowserAcceptance.ts
src/pages/ProductComplexityConvergenceStage2BrowserAcceptance.jsx
```

建议职责：

- Schema：类型、枚举、Validator、稳定 ID / Hash；
- Agent：纯函数计算 Converged Decision；
- Service：读取原生 Owner Decision、选择 Mode、形成 Effective Decision 与 Alignment；
- Adapter：按能力将原生决策映射成统一封套，不复制原生状态机；
- Audit Repository：只追加轻量审计投影，不作为 Runtime 输入；
- UI：继续消费阶段 1 Presentation，不直接读取阶段 2 Schema。

不得建立：

- `UniversalConditionalTask`；
- `UniversalInterventionStateMachine`；
- 与 Learning Queue 平行的新队列；
- 与 Evidence / Profile 平行的新写入链；
- 由 UI 本地推断的策略状态。

## 十二、分阶段工程包

### WP2-01：Schema 与 Owner Adapter

完成：

- 版本常量；
- 四类 Capability、Outcome、Reason、Benefit、Exit、Fallback、Loop Guard；
- Validator、稳定 ID 与 Hash；
- 四类原生 Owner Decision Adapter；
- Legacy 映射。

本包不得改变正式行为。

### WP2-02：Shadow Policy Agent

完成：

- 四类纯函数 Policy；
- Owner / Converged / Effective 三视图；
- Alignment 与只读报告；
- Shadow 失败不阻断；
- 保护快照零写验证。

### WP2-03：Revision 单项启用

完成：

- Revision Flag；
- 一次修订、角色限制、无动作与退出；
- 旧 Revision 专项零回归；
- 浏览器一次修订闭环。

### WP2-04：Targeted 单项启用

完成：

- Targeted Flag；
- 原子 Gap、资源匹配、Session 限次与防递归；
- 完成 / 跳过 / 不可用后返回核心队列；
- Targeted Stage 1—4 零回归。

### WP2-05：Retest 单项启用

完成：

- Retest Flag；
- 到期 / 未到期 / 已安排 / 资源不可用；
- 独立验证身份；
- Delayed Retest 与 Retest Execution 零回归。

### WP2-06：Transfer 单项启用

完成：

- Transfer Flag；
- 稳定基础、新情境、身份匹配和重复计划保护；
- 与普通 Training、Revision、Targeted、Retest 的身份隔离；
- Next Strategy 与 Formal Resource Match 零回归。

### WP2-07：全链收口

完成：

- C2 全量专项；
- B2 全量真实浏览器联调；
- 跨标签、刷新、重复点击、恢复；
- 旧主链与 Production Build；
- 工程与 Debug 验收报告。

## 十三、自动化 Debug 验收矩阵

### 13.1 Schema 与确定性

| 编号 | 验收项 |
| --- | --- |
| C2-01 | Schema / Policy Version 独立且固定 |
| C2-02 | 四类 Capability 之外的值被拒绝 |
| C2-03 | Outcome、Reason、Benefit、Exit 与 Fallback 非法值被拒绝 |
| C2-04 | `trigger` 缺少收益、退出或 Source Ref 时校验失败 |
| C2-05 | shadow 的 Effective Outcome 必须来自 Owner Decision |
| C2-06 | 相同输入产生相同 Decision ID 与 Hash |
| C2-07 | Owner Version 或 Policy Version 变化产生新 Hash |
| C2-08 | 封套不包含答案、正文、完整 Diagnosis 或完整 Feedback |

### 13.2 Revision

| 编号 | 验收项 |
| --- | --- |
| C2-09 | 明确可修订 Gap 允许一次 Revision |
| C2-10 | 无明确 Gap 时合法 no-action |
| C2-11 | 已使用 Revision 后不再次触发 |
| C2-12 | Retest / Transfer 不触发 Revision |
| C2-13 | Revision 改善保持 feedback-supported，不覆盖首答 |
| C2-14 | 放弃 Revision 后核心队列继续 |

### 13.3 Targeted

| 编号 | 验收项 |
| --- | --- |
| C2-15 | 原子 Gap 与正式资源匹配时允许 Targeted |
| C2-16 | 宏观 Gap 不触发 Targeted |
| C2-17 | 无匹配资源时不阻断核心队列 |
| C2-18 | 同 Gap 同 Round 最多一次 |
| C2-19 | Targeted 失败不递归生成 Targeted |
| C2-20 | 完成、跳过、不可用均恢复正确核心题号 |

### 13.4 Retest 与 Transfer

| 编号 | 验收项 |
| --- | --- |
| C2-21 | Retest 到期且证据充分时允许安排 |
| C2-22 | Retest 未到期时 defer，不提前创建任务 |
| C2-23 | 相同 Retest 目标不重复安排 |
| C2-24 | Retest 资源不可用不阻断当前学习 |
| C2-25 | Transfer 仅在稳定独立基础上允许 |
| C2-26 | Feedback-supported 表现不能单独满足 Transfer 基础 |
| C2-27 | Transfer 必须使用新情境且身份匹配 |
| C2-28 | 相同 Transfer 目标不重复安排 |

### 13.5 冲突、Shadow 与逐项启用

| 编号 | 验收项 |
| --- | --- |
| C2-29 | Revision 活跃时 Targeted 不并发激活 |
| C2-30 | Targeted 完成不自动创建 Retest / Transfer |
| C2-31 | Shadow 差异只记录，行为和写入均不变 |
| C2-32 | `behaviorChanged` 在 Shadow 中恒为 false |
| C2-33 | 单项 Enforced 不影响其他三项 Legacy 行为 |
| C2-34 | Session 中途修改 Flag 不改变已冻结策略 |
| C2-35 | 策略故障时未激活能力安全 no-action |
| C2-36 | 策略故障时已激活流程由 Owner 恢复 |

### 13.6 兼容、幂等与零回归

| 编号 | 验收项 |
| --- | --- |
| C2-37 | 历史无封套记录继续执行旧策略 |
| C2-38 | `legacy_unobserved` 不进入效果分母 |
| C2-39 | 重复评估、重复点击和 Outbox 重放不创建重复事实 |
| C2-40 | Formal Resource / Registry / Attempt / Evidence / Profile / Calibration 保护摘要零意外变化 |

阶段 2 专项最低门槛：`40 / 40 PASS`。

## 十四、真实浏览器验收矩阵

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| B2-01 | 四项全部 Legacy | 用户流程与阶段 1 完全一致 |
| B2-02 | 四项全部 Shadow | 页面、队列、写入与 Legacy 完全一致 |
| B2-03 | Revision 触发 | 只出现一次学生可理解的修订入口 |
| B2-04 | Revision 不触发 | 页面没有占位、解释或跳过说明 |
| B2-05 | Revision 放弃 | 直接进入真实下一题 |
| B2-06 | Targeted 触发 | 完成后回到准确核心题号 |
| B2-07 | Targeted 无匹配 | 不显示内部错误且核心队列继续 |
| B2-08 | Targeted 刷新恢复 | Assignment 与返回位置不重复、不丢失 |
| B2-09 | Retest 未到期 | 当前页面不出现入口 |
| B2-10 | Retest 到期 | 只作为正式当前题出现，不显示工程角色 |
| B2-11 | Transfer 基础不足 | 不出现入口，不影响正常训练 |
| B2-12 | Transfer 条件满足 | 以正式当前题消费，不显示工程角色 |
| B2-13 | 条件动作失败 | 错误在当前操作附近，说明数据保留与下一步 |
| B2-14 | 重复点击 / 慢响应 | 只有一个有效动作与一个领域结果 |
| B2-15 | 刷新 / 跨标签 | 同一 Session Policy 与 Owner Identity 保持 |
| B2-16 | 单项回滚 Legacy | 已激活流程安全完成，新流程停止采用新策略 |
| B2-17 | 完整核心题组无条件能力 | 可连续完成并正常结束 |
| B2-18 | 普通页面术语审查 | 不出现 Policy、Owner、Shadow、Reason Code、Hash 或 Identity |

阶段 2 浏览器最低门槛：`18 / 18 PASS`。

## 十五、旧主链强制回归

至少回归：

- Product Complexity Convergence Stage 0 / Stage 1；
- Material Resource Production P0—P7；
- Question Candidate Adoption / Publication / Recovery；
- Learning Queue 与连续题组；
- Single Choice Stage 1—4；
- Reading Open Response Input Load Stage 1—4；
- Reading Training Progressive Load Stage 0—4；
- Learning Feedback Revision Stage 1—4；
- Targeted Micro-training Stage 1—4；
- Retest Task / Delayed Retest Scheduling / Retest Execution；
- Next Learning Strategy / Adaptive Task Constraints；
- Phase 16.3 Real Learning Chain；
- Formal Resource Source Resolver；
- IndexedDB、Outbox、重复提交、刷新和跨标签恢复；
- Production Build。

零回归快照至少比较：

- Formal Resource Digest；
- Registry Digest；
- Store Revision；
- Session / Queue Digest；
- Attempt Digest；
- Evidence Digest；
- Profile Digest；
- Calibration Digest；
- 当前题号与题组总数；
- 命令调用次数；
- Outbox Pending / Completed Identity。

## 十六、完成定义

阶段 2 只有同时满足以下条件才可标记 `ENGINEERING COMPLETE / DEBUG ACCEPTED`：

1. 统一 Schema、Validator、稳定 ID 和 Hash 已完成；
2. 四类原生 Owner Decision 均能无损映射；
3. Shadow Audit 能记录触发、不触发、延期和阻断；
4. Shadow 不改变任何正式行为和保护写入；
5. Revision、Targeted、Retest、Transfer 已按顺序逐项验收，未整体强开；
6. 每类能力都有明确收益、退出、Fallback 与防循环边界；
7. 不触发时核心学习链可完整结束；
8. 历史无封套记录和已开始旧 Session 保持兼容；
9. 普通页面未泄露内部策略术语；
10. `C2-01—C2-40` 为 `40 / 40 PASS`；
11. `B2-01—B2-18` 为 `18 / 18 PASS`；
12. 全部旧主链专项回归与 Production Build 通过；
13. 正式资源、Attempt、Evidence、Profile 与真实校准分母没有非预期写入；
14. 验收报告明确区分 Shadow、Fixture、浏览器验收和真实使用；
15. 未把阶段 3 的反馈生成或 Profile 投射提前实现。

### 16.1 实施与验收事实（2026-08-24）

- `WP2-01—WP2-07` 已完成；
- `C2-01—C2-40`：`40 / 40 PASS`；
- `B2-01—B2-18`：`18 / 18 PASS`；
- 旧主链专项回归：`353 / 353 PASS`；
- Production Build：`PASS`；
- 浏览器刷新后验收结果可恢复，控制台 `error / warn = 0`；
- 浏览器隔离验收中的 Formal Resource / Attempt / Evidence / Profile / 真实校准分母写入为 `0 / 0 / 0 / 0 / 0`；
- 四项能力的生产默认值仍全部为 `legacy`；本阶段交付的是可逐项切换的运行边界，不等于已将四项能力一次性切换为 `enforced`；
- Shadow / Enforced 的后续生产启用仍须遵循单项能力、Session 冻结、真实观察和独立回滚边界。

完整证据见：[阶段 2 工程、Debug 与浏览器验收报告](../education/phase/reports/product_complexity_convergence_stage2_engineering_debug_browser_acceptance_2026-08-24.md)。

## 十七、进入阶段 3 的边界

阶段 2 完成后，阶段 3 才允许处理：

- 从多个已存在的 Diagnosis 缺口中选择一个主要反馈焦点；
- 收敛学生反馈的结构与表达；
- 降低模板化、空洞化和内部解释负担；
- 对既有 CoreAbilitySummary / Profile 进行只读、低负担投射；
- 用真实表现验证页面是否帮助学生理解下一步。

阶段 3 仍不得：

- 建立第二套 Diagnosis、Evidence 或 Profile 写入链；
- 用展示文案反向改变领域事实；
- 把 Revision / Targeted / Retest / Transfer 的触发率当作教育效果；
- 提前执行阶段 4 的能力退役决策。

## 十八、冻结声明

本阶段冻结以下结论：

1. 阶段 2 是条件策略收口，不是第五套调度系统；
2. 统一对象是判定封套和审计投影，不是统一任务状态机；
3. 原生 Owner Decision 继续承担领域事实权威；
4. expectedBenefit 必须使用结构化 Code，自由文本不得参与判断；
5. 不触发是正常且可解释的决策；
6. Shadow 必须先于 Enforced，Enforced 必须逐项能力启用；
7. 条件能力失败不得阻断核心链；
8. 历史数据不回写，旧 Session 不改变中途语义；
9. 普通用户不需要理解任何条件策略工程身份；
10. 每个阶段必须证明旧主链零回归，新语义只在本阶段授权边界内生效。

阶段 2 已达到 `ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED`。该结论只覆盖条件策略 Schema、Owner Adapter、Shadow / Enforced 运行边界、独立审计与验收能力；生产默认仍为 Legacy，且不宣称真实教育收益已经完成验证。
