# 产品复杂度收口阶段 4：稳定试用与退役决策工程实施与 Debug 验收文档

英文名称：Product Complexity Convergence Stage 4 Stable Trial and Retirement Decision Engineering and Debug Plan

阶段契约版本：`product_complexity_convergence_stage4_stable_trial_retirement_v1`

观察策略版本：`product_complexity_convergence_stage4_observation_policy_v1`

决策策略版本：`product_complexity_convergence_stage4_decision_policy_v1`

对应总契约：`product_complexity_convergence_v1`

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED / ISOLATED OBSERVATION READY / ACTIVATION PREFLIGHT REQUIRED / REAL TRIAL NOT STARTED`

日期：2026-08-25

关联文档：

- [产品复杂度收口总契约](./PRODUCT_COMPLEXITY_CONVERGENCE_CONTRACT.md)
- [阶段 2 条件触发策略收口工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_CONDITIONAL_POLICY_ENGINEERING_AND_DEBUG_PLAN.md)
- [阶段 3 反馈与 Profile 投射收口工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_FEEDBACK_PROFILE_PROJECTION_ENGINEERING_AND_DEBUG_PLAN.md)
- [Learning 反馈后一次修订契约](./LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md)
- [Targeted Micro-training 材料与调度契约](./TARGETED_MICRO_TRAINING_MATERIAL_AND_SCHEDULING_CONTRACT.md)
- [阶段 4 真实 Trial Window 启动与运行验收契约](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_REAL_TRIAL_WINDOW_OPERATION_AND_ACCEPTANCE_CONTRACT.md)
- [阶段 4 真实 Trial Window 启动前工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_REAL_TRIAL_PREFLIGHT_ENGINEERING_AND_DEBUG_PLAN.md)

## 一、阶段定位

阶段 4 是 `product_complexity_convergence_v1` 的稳定试用、真实价值观察和能力去留决策阶段。

本阶段不再增加 Training Model 能力，也不重新设计任何学习流程。它只回答三个问题：

1. 已有条件能力在真实使用中是否实际触发；
2. 触发后是否带来与其 `expectedBenefitCode` 一致的可观察收益；
3. 该收益是否值得继续承担运行、恢复、兼容和维护成本。

本阶段的核心输出不是新的学生任务，而是：

```text
既有正式事实
→ 真实数据准入
→ 只读观察事件
→ 版本化聚合快照
→ 内部能力决策提案
→ 保留 / 优化 / 默认关闭候选 / 退役候选
```

阶段 4 不自动执行删除，也不以观察结果直接改变当前 Session。任何默认关闭或退役动作都必须在独立的版本化变更中执行。

核心原则：

> 用真实使用证据决定复杂能力是否值得继续存在；没有足够样本时保持诚实，不用 Fixture、单次成功或工程完成度制造能力价值。

## 二、贯穿全部阶段的验收原则

阶段 4 必须同时证明：

> 旧主链零回归，并且新语义只在阶段 4 允许的真实观察、内部聚合和退役提案边界内生效。

具体要求：

1. `Material → Plan → Task → Candidate → Adopt → Revision → Publish → Learning` 主链不变；
2. Frozen Resource、Registry Version、Session Snapshot 与题组顺序不变；
3. Attempt、Diagnosis、Evidence、Profile 与 Calibration 的正式写入者不变；
4. 阶段 4 观察事实不得成为 Scheduler、Gate、Diagnosis、Evidence Admission 或 Profile Update 的输入；
5. 观察记录失败不得回滚或阻断学生已完成的学习；
6. Internal Acceptance、Fixture、Demo、Debug、浏览器矩阵和迁移数据不得进入真实分母；
7. 任何能力决策只作用于未来策略版本，不改变已开始 Session；
8. 默认关闭或退役不得删除历史 Frozen Resource、Attempt、Evidence 或解释能力；
9. 普通页面不新增观察、样本、收益、维护成本或退役术语；
10. 每一项结论必须披露时间窗口、真实样本量、数据完整性和适用边界；
11. 每个阶段都必须证明旧主链零回归，并且新语义只在该阶段允许的边界内生效；
12. Production Build 与旧主链专项回归必须通过。

## 三、本阶段绝对禁止的修改

阶段 4 不得修改：

- Material、Material Version、Observation Plan 与 TrainingTask；
- QuestionCandidate、Question Revision、Admission、Frozen Resource 与 Registry；
- TaskGroupProgressionPlan、Load Profile、Sequence Role 与正式题组顺序；
- Student Response、Attempt、Diagnosis 与 Requirement Coverage；
- Evidence Admission、Evidence Confidence 与 StudentAbilityProfile；
- Revision、Targeted、Retest、Transfer 的身份、次数、证据隔离和原生 Owner Decision；
- Outbox、幂等键、恢复身份和现有 Calibration 分母；
- 阶段 1 普通页面白名单；
- 阶段 2 `legacy / shadow / enforced` 的 Owner Authority；
- 阶段 3 Feedback 与 CoreAbilitySummary 的只读投射边界。

禁止以“观察真实价值”为理由：

- 自动安排 Revision、Targeted、Retest 或 Transfer；
- 为增加样本而放宽触发门槛；
- 把反馈支持下改善写成独立掌握；
- 把 Targeted 成功直接写入长期 Profile；
- 用 Retest 或 Transfer 的缺失记录学生能力不足；
- 用页面浏览量证明教育效果；
- 让观察失败成为 Learning 错误；
- 直接根据低频率删除运行代码；
- 批量补写历史观察事件；
- 将自由文本说明作为统计键或自动决策依据。

## 四、阶段 4 观察对象

阶段 4 只观察总契约已经批准的能力：

```ts
type ComplexityConvergenceCapability =
  | 'revision'
  | 'targeted_micro_training'
  | 'retest'
  | 'transfer'
  | 'successor_governance'
  | 'calibration_review'
  | 'feedback_projection'
  | 'core_ability_summary';
```

其中：

- Revision、Targeted、Retest、Transfer 继续由阶段 2 Owner 决策；
- Successor Governance 与 Calibration Review 继续使用既有治理事实；
- Feedback Projection 与 CoreAbilitySummary 继续使用阶段 3 只读投射；
- 阶段 4 只读取这些能力已经产生的正式事实和投射结果；
- 未触发能力也是合法观察结果，不得为了完整矩阵而制造触发。

## 五、事实权威与输入矩阵

| 观察对象 | 事实权威 | 阶段 4 允许读取 | 阶段 4 禁止改写 |
| --- | --- | --- | --- |
| Revision | Revision Eligibility / Attempt / Evaluation | 是否合格、是否触发、是否完成、结果 | 首答、Revision 次数、评价结果 |
| Targeted | Targeted Assignment / Attempt / Result | 是否匹配、是否插入、是否完成、Gap 结果 | 正式序列、资源身份、Targeted 结果 |
| Retest | Retest Decision / Attempt / Evidence | 是否安排、是否独立完成、保持结果 | Retest 条件与 Evidence |
| Transfer | Transfer Decision / Attempt / Evidence | 是否安排、是否独立迁移 | Transfer 条件与 Evidence |
| Successor Governance | Governance Case / Revision Chain | 风险类型、处理状态、是否恢复 | Frozen Resource 与 Registry |
| Calibration Review | Calibration Event / Integrity / Review | 样本状态、完整性、人工复核结果 | 正式题与 Profile |
| Feedback Projection | Stage 3 Projection / Runtime Action | 是否形成、是否回退、后续动作 | Diagnosis 与正式反馈 |
| CoreAbilitySummary | StudentAbilityProfile / Stage 3 Read Model | 是否可安全投射、是否查看 | Profile 与能力状态 |

阶段 4 不从页面文案、学生答案正文、模型自由文本或 UI DOM 反向构造事实。

## 六、真实数据准入

### 6.1 数据来源

只有同时满足以下条件的记录才可进入真实试用分母：

```text
dataOrigin = real_learning
+ runtimeScope = product
+ studentIdentityAligned = true
+ sessionIdentityAligned = true
+ sourceFactValidated = true
+ observedAt 位于冻结试用窗口
+ 非 Internal / Fixture / Demo / Debug / Browser Acceptance
```

### 6.2 来源类型

```ts
type ConvergenceObservationDataOrigin =
  | 'real_learning'
  | 'internal_acceptance'
  | 'fixture'
  | 'demo'
  | 'debug'
  | 'browser_acceptance'
  | 'legacy_unobserved';
```

除 `real_learning` 外，其余来源只能进入排除统计，不能进入：

- 触发率分母；
- 完成率分母；
- 收益实现率分母；
- 中断率分母；
- 默认关闭或退役判断；
- 真实教育效果描述。

### 6.3 历史数据

阶段 4 启用前产生的历史事实统一视为 `legacy_unobserved`：

- 可以用于验证兼容读取；
- 可以用于检查身份和完整性；
- 不补写为真实观察事件；
- 不进入阶段 4 真实分母；
- 不因缺少阶段 4 字段而阻断历史 Session 恢复。

## 七、观察 Schema

### 7.1 观察事件

```ts
type ComplexityConvergenceObservationEvent = {
  schemaVersion: 'product_complexity_convergence_stage4_observation_event_v1';
  observationPolicyVersion: 'product_complexity_convergence_stage4_observation_policy_v1';

  eventId: string;
  eventHash: string;
  persistenceRole: 'append_only_observation';

  capability: ComplexityConvergenceCapability;
  expectedBenefitCode:
    | 'resolve_revision_gap'
    | 'isolate_atomic_gap'
    | 'verify_independent_retention'
    | 'verify_transfer'
    | 'repair_resource_risk'
    | 'review_calibration_evidence'
    | 'clarify_primary_feedback_focus'
    | 'summarize_stable_profile';

  studentId: string;
  learningSessionId?: string;
  learningRoundId?: string;
  learningTaskAttemptId?: string;

  sourceDecisionId?: string;
  sourceResultId?: string;
  sourceEvidenceIds: string[];
  sourceSchemaVersions: string[];

  dataOrigin: ConvergenceObservationDataOrigin;
  lifecycleStage:
    | 'eligible'
    | 'not_triggered'
    | 'triggered'
    | 'completed'
    | 'interrupted'
    | 'fallback'
    | 'follow_up_observed';
  outcomeCode: ComplexityConvergenceObservedOutcomeCode;

  occurredAt: string;
  trialWindowId: string;

  validation: {
    passed: boolean;
    identityAligned: boolean;
    sourceFactValidated: boolean;
    dataOriginAdmitted: boolean;
    noStudentContentStored: boolean;
    issues: string[];
  };
};
```

### 7.2 观察结果 Code

```ts
type ComplexityConvergenceObservedOutcomeCode =
  | 'eligible_not_triggered'
  | 'triggered_pending'
  | 'completed_without_outcome'
  | 'revision_gap_resolved_supported'
  | 'revision_gap_partially_resolved_supported'
  | 'revision_gap_unresolved'
  | 'targeted_gap_resolved_supported'
  | 'targeted_gap_unresolved'
  | 'retest_independent_retained'
  | 'retest_independent_not_retained'
  | 'transfer_independent_succeeded'
  | 'transfer_independent_not_succeeded'
  | 'resource_risk_repaired'
  | 'resource_risk_unresolved'
  | 'calibration_review_completed'
  | 'feedback_action_followed'
  | 'feedback_projection_fallback'
  | 'profile_summary_available'
  | 'profile_summary_insufficient_evidence'
  | 'runtime_interrupted'
  | 'integrity_blocked'
  | 'observation_unavailable';
```

这些 Code 只描述可追溯结果，不直接等同于长期学生能力或教育效果。

### 7.3 结构化收益 Code

总契约中的六类 `expectedBenefitCode` 保持不变。阶段 4 为阶段 3 投射增加两个观察专用 Code：

```ts
type Stage4ProjectionBenefitCode =
  | 'clarify_primary_feedback_focus'
  | 'summarize_stable_profile';
```

这两个 Code 只用于阶段 4 内部聚合，不写回阶段 2 条件能力决策。若未来需要进入跨阶段统一策略，必须升级总契约版本。

`expectedBenefitDescription` 可以作为内部说明展示，但不得用于分组、阈值、决策或统计聚合。

## 八、稳定身份、隐私与存储边界

### 8.1 稳定身份

`eventId` 必须由以下事实确定：

```text
capability
+ lifecycleStage
+ sourceDecisionId / sourceResultId
+ studentId
+ learningSessionId / learningRoundId / learningTaskAttemptId
+ observationPolicyVersion
```

相同来源事实重复消费只能得到同一个 `eventId`。`eventHash` 只用于完整性检查，不进入普通页面。

### 8.2 禁止存储内容

观察事件不得存储：

- 学生回答正文；
- Revision 前后全文；
- 材料正文；
- 题目全文；
- 模型原始输出；
- 页面自由文本反馈；
- 人工备注中的学生敏感内容。

观察只保存身份引用、结构化 Code、时间和验证状态。

### 8.3 存储角色

阶段 4 可以建立独立 Append-only Observation Repository，但必须满足：

- 它不是新的业务事实权威；
- Scheduler、Gate、Diagnosis、Evidence、Profile 不读取它；
- 删除该 Repository 后核心学习链仍可完整运行；
- 可从仍然存在的正式源事实重建聚合，但不得反向批量补造历史真实事件；
- 写入失败只形成内部观察缺口，不改变学习结果。

## 九、试用窗口 Schema

```ts
type ComplexityConvergenceTrialWindow = {
  schemaVersion: 'product_complexity_convergence_stage4_trial_window_v1';
  trialWindowId: string;
  observationPolicyVersion: string;
  decisionPolicyVersion: string;
  status: 'draft' | 'active' | 'closed' | 'invalidated';
  startsAt: string;
  plannedEndsAt: string;
  closedAt?: string;
  participatingStudentIds: string[];
  enabledCapabilityModes: Record<ComplexityConvergenceCapability, string>;
  sourceRegistryVersion: string;
  sourcePolicySnapshotHash: string;
  invalidationReasons: string[];
};
```

规则：

1. 一个窗口原则上持续 14—28 个自然日；
2. 时间达到 14 日不代表样本充分；
3. Window 激活时冻结 Registry 与策略快照；
4. 中途 Feature Flag 变化不改写窗口事实，应关闭旧窗口并创建新窗口；
5. 身份污染、错误数据来源或大范围服务中断时允许将窗口标记为 `invalidated`；
6. 无效窗口不得用于能力去留决策。

## 十、指标与分母

### 10.1 基础计数

每项能力至少聚合：

```ts
type ComplexityConvergenceCapabilityAggregate = {
  capability: ComplexityConvergenceCapability;
  expectedBenefitCode: string;
  eligibleCount: number;
  notTriggeredCount: number;
  triggeredCount: number;
  completedCount: number;
  interruptedCount: number;
  fallbackCount: number;
  benefitObservedCount: number;
  benefitNotObservedCount: number;
  integrityBlockedCount: number;
  recoveryCount: number;
  distinctSessionCount: number;
  distinctActiveDayCount: number;
  firstObservedAt?: string;
  lastObservedAt?: string;
};
```

### 10.2 比率口径

```text
triggerRate = triggeredCount / eligibleCount
completionRate = completedCount / triggeredCount
interruptionRate = interruptedCount / triggeredCount
fallbackRate = fallbackCount / eligibleCount
benefitObservedRate = benefitObservedCount / completedCount
integrityBlockedRate = integrityBlockedCount / eligibleCount
```

规则：

- 分母为 0 时结果为 `not_available`，不得显示 0%；
- 比率必须同时显示分子、分母和时间窗口；
- 不同 `observationPolicyVersion` 不得直接合并；
- 不同 `expectedBenefitCode` 不得只按能力名合并；
- Revision / Targeted 的即时改善只能称为“支持下改善”；
- Retest / Transfer 才允许观察独立保持或迁移；
- Profile Summary 查看率不等于能力改善；
- Feedback 的后续动作完成只能作为理解代理指标，不得直接称为“一次理解率”。

## 十一、样本充分性

### 11.1 V1 试运行门槛

```ts
type ComplexityConvergenceSampleStatus =
  | 'no_opportunity'
  | 'collecting'
  | 'insufficient_sample'
  | 'review_ready'
  | 'integrity_blocked';
```

V1 的 `review_ready` 是产品治理门槛，不是统计学稳定性声明。至少同时满足：

- Window 持续不少于 14 个自然日；
- `distinctActiveDayCount >= 6`；
- 该能力 `eligibleCount >= 10`；
- 判断触发后收益时 `completedCount >= 5`；
- 身份完整性通过；
- 非真实来源计数未进入分母；
- 没有未解决的大范围观测缺失。

未达到门槛时只能输出：

- 继续收集；
- 当前无触发机会；
- 样本不足；
- 完整性阻断。

不得输出“有效”“无效”“应删除”等结论。

### 11.2 单学生试用边界

单学生 2—4 周试用可以验证：

- 流程是否稳定；
- 能力是否实际触发；
- 触发后是否完成；
- 是否出现中断、回退和冲突；
- 是否存在与预期收益一致的个体趋势。

不能据此证明：

- 对所有学生普遍有效；
- 统计区分度稳定；
- 某能力已经形成普遍教育效果；
- 能力应该永久删除。

## 十二、各能力收益观察边界

### 12.1 Revision

允许观察：资格、触发、完成、Revision Evaluation、反馈支持下改善和后续独立 Retest。

禁止把 Revision Improved 直接记为独立掌握。

### 12.2 Targeted Micro-training

允许观察：匹配成功、完成、原子 Gap 是否在微训练中改善、是否按规则返回正式序列。

Targeted 成功只证明支持下重新执行；是否保持必须由后续独立任务验证。

### 12.3 Retest

允许观察：是否脱离提示独立完成相同核心动作。Retest 是保持证据，不是新的主训练入口。

### 12.4 Transfer

允许观察：已有相对稳定独立证据后，是否在新材料或情境中完成同一核心动作。没有先行稳定证据的 Transfer 不进入有效收益分母。

### 12.5 Successor Governance

允许观察：正式风险是否通过 successor Candidate 修复、旧版本是否继续可解释、Registry 是否正确切换。不得以治理完成数量证明学生收益。

### 12.6 Calibration Review

允许观察：真实样本是否达到当前策略门槛、身份完整性是否通过、复核是否完成。不得由阶段 4 自动调整正式题或 Profile。

### 12.7 Feedback Projection

允许观察：是否成功形成单焦点投射、是否回退 Legacy、学生是否能够继续或执行一次真实下一步动作。

“继续”或“开始 Revision”只是行为代理，不足以单独证明学生理解了反馈。

### 12.8 CoreAbilitySummary

允许观察：是否具有足够正式 Profile 证据、是否能够安全投射、是否被查看。没有实际普通页面消费时应记录 `no_opportunity`，不得为了取得数据强行增加入口。

## 十三、维护成本

维护成本只使用结构化运行事实：

- 身份错位次数；
- Integrity Block 次数；
- Outbox / Observation 恢复次数；
- 重复事件冲突；
- Fallback 次数；
- 页面中断次数；
- 人工恢复次数；
- 策略回退次数；
- 兼容路径异常次数。

开发工时、主观抱怨和自由文本备注可以作为内部背景，但不得作为自动决策键。

维护成本分级：

```ts
type ComplexityConvergenceMaintenanceBand =
  | 'low'
  | 'moderate'
  | 'high'
  | 'not_available';
```

分级算法必须版本化，并同时展示构成计数，禁止只输出不可解释的总分。

## 十四、能力决策提案

### 14.1 提案类型

```ts
type ComplexityConvergenceCapabilityDecision =
  | 'retain_core'
  | 'retain_conditional'
  | 'optimize_policy'
  | 'default_disable_candidate'
  | 'deprecation_candidate'
  | 'insufficient_evidence';
```

### 14.2 提案 Schema

```ts
type ComplexityConvergenceDecisionProposal = {
  schemaVersion: 'product_complexity_convergence_stage4_decision_proposal_v1';
  decisionPolicyVersion: 'product_complexity_convergence_stage4_decision_policy_v1';
  proposalId: string;
  capability: ComplexityConvergenceCapability;
  trialWindowId: string;
  expectedBenefitCode: string;
  sampleStatus: ComplexityConvergenceSampleStatus;
  aggregateSnapshotId: string;
  maintenanceBand: ComplexityConvergenceMaintenanceBand;
  proposedDecision: ComplexityConvergenceCapabilityDecision;
  decisionReasonCodes: ComplexityConvergenceDecisionReasonCode[];
  limitations: string[];
  generatedAt: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'superseded';
};
```

### 14.3 决策理由 Code

```ts
type ComplexityConvergenceDecisionReasonCode =
  | 'high_frequency_clear_benefit'
  | 'low_frequency_critical_benefit'
  | 'high_frequency_limited_benefit'
  | 'low_frequency_limited_benefit'
  | 'low_frequency_no_observed_benefit_high_maintenance'
  | 'sample_insufficient'
  | 'no_trigger_opportunity'
  | 'data_integrity_blocked'
  | 'benefit_requires_independent_validation'
  | 'maintenance_cost_unavailable';
```

### 14.4 决策映射

| 真实表现 | 提案 |
| --- | --- |
| 高频 + 明显收益 | `retain_core` 或 `retain_conditional` |
| 低频 + 关键价值 | `retain_conditional` |
| 高频 + 收益有限 | `optimize_policy` |
| 低频 + 收益有限 | `default_disable_candidate` |
| 低频 + 无观察收益 + 高维护 | `deprecation_candidate` |
| 样本不足、无机会或完整性异常 | `insufficient_evidence` |

规则：

1. Decision Agent 只能生成提案，不能直接切换 Feature Flag 或删除代码；
2. `deprecation_candidate` 不等于 deprecated；
3. Revision / Targeted 只有支持下收益而无独立验证时，不能直接升级为 `retain_core`；
4. `sampleStatus !== review_ready` 时只能生成 `insufficient_evidence`；
5. 同一 Window、能力、Benefit Code 与策略版本只能存在一个有效提案；
6. 自由文本 limitations 只解释边界，不参与自动决策；
7. 接受提案属于 Internal Governance，不增加普通用户人工步骤。

## 十五、默认关闭与退役执行边界

阶段 4 允许产生默认关闭或退役候选，但实际执行必须拆分为后续显式任务。

### 15.1 默认关闭

默认关闭必须：

- 新建策略版本；
- 仅影响未来 Session；
- 保留显式回退开关；
- 证明核心学习链可以独立完成；
- 保留历史 Session Snapshot 的旧策略解释；
- 完成旧主链和历史恢复回归。

### 15.2 退役流程

退役只能按以下顺序推进：

```text
保留但隐藏
→ 默认关闭
→ 兼容观察
→ deprecated
→ 停止新写入
→ 历史只读
→ 最后删除运行代码
```

任何一步失败都必须停止推进并保留前一稳定状态。

### 15.3 不允许自动退役的能力

总契约 A 类核心能力不得通过阶段 4 自动进入退役：

- Material 与正式资源；
- 训练任务规划；
- 单选与开放文本作答；
- 合理题组递进；
- Learning Session / Round / Attempt；
- 首次独立回答；
- 当前题 Diagnosis 与基础反馈；
- Persistence、幂等、恢复、Outbox 与基础 Evidence。

## 十六、Internal 页面投射

阶段 4 只新增 Internal 页面，不修改普通录入端和 Learning 页面。

Internal 页面允许展示：

- 当前 Trial Window 与冻结策略版本；
- 每项能力的机会、触发、完成、中断、回退和收益计数；
- 分子 / 分母 / 比率；
- 样本充分性；
- 数据来源排除计数；
- 完整性问题；
- 维护成本构成；
- 决策提案、Reason Code 与限制；
- 导出只读验收快照。

Internal 页面不得：

- 展示学生答案正文；
- 直接修改正式 Profile；
- 直接修改 Frozen Resource；
- 一键删除能力代码；
- 将 Fixture 切换为真实数据；
- 以颜色或百分比分级暗示统计确定性；
- 把 `insufficient_evidence` 显示成失败。

## 十七、失败、恢复、幂等与跨标签

### 17.1 观察失败

- Observation 写入失败不阻断 Learning；
- 失败只进入内部观察完整性状态；
- 重读正式事实时允许按稳定 `eventId` 补回窗口内缺失事件；
- 不允许以失败重试制造第二条事件；
- 不允许修改原始正式事实以适配观察 Schema。

### 17.2 聚合失败

- Aggregate 是可重建只读投影；
- 聚合失败不得修改 Observation Event；
- 部分聚合不得生成能力去留提案；
- 重建后相同输入必须得到相同 Snapshot ID 与计数。

### 17.3 提案失败

- Decision Proposal 失败不影响正式能力运行；
- 相同 Aggregate 与策略版本重试得到同一个 Proposal ID；
- 接受或拒绝提案必须幂等；
- 跨标签并发接受只能形成一个最终状态；
- 已接受提案不得被旧标签页静默覆盖。

## 十八、兼容与迁移

### 18.1 现有产品数据

- 不迁移 Material、Frozen Resource、Registry、Attempt、Evidence 或 Profile；
- 不回写阶段 0—3 的历史 Projection；
- 不补造阶段 4 启用前的真实观察；
- 旧 Session 继续按其冻结策略恢复；
- 没有阶段 4 数据时产品行为与阶段 3 完全一致。

### 18.2 Schema 兼容

- 未知 Schema Version 进入 `integrity_blocked`，不猜测字段；
- 未知 Outcome Code 不进入收益分母；
- 新增 Capability、Benefit Code 或 Outcome Code 必须升级策略版本；
- 聚合必须保留来源 Schema Version 分布；
- 删除阶段 4 Repository 后不影响核心产品数据恢复。

### 18.3 Feature Flag

建议冻结：

```ts
type ComplexityConvergenceStage4ObservationMode =
  | 'off'
  | 'isolated_acceptance'
  | 'real_trial';
```

- 生产开发完成后默认 `off`；
- 浏览器与自动化验收使用 `isolated_acceptance`；
- 只有 Trial Window 已激活且数据准入检查通过时才可使用 `real_trial`；
- Flag 只控制观察，不改变能力 Owner Decision；
- 关闭 Flag 后 Learning 继续正常运行。

## 十九、工程实施顺序

### WP4-01：Schema、Validator 与稳定身份

实现：

- Observation Event；
- Trial Window；
- Aggregate Snapshot；
- Decision Proposal；
- Data Origin Gate；
- 稳定 Event / Snapshot / Proposal Identity。

验收：Schema 非法值、身份错位、来源污染、未知版本和正文泄漏均被拒绝。

### WP4-02：既有事实 Adapter

分别实现 Revision、Targeted、Retest、Transfer、Successor、Calibration、Feedback Projection 与 CoreAbilitySummary 的只读 Adapter。

验收：Adapter 不改变 Owner Decision，不写正式事实，不从自由文本推断 Outcome。

### WP4-03：Append-only Observation Repository

实现 In-memory 与 IndexedDB Repository、稳定去重、查询和完整性审计。

验收：重复消费、刷新、恢复和跨标签不产生重复事件；Repository 失败不阻断 Learning。

### WP4-04：Aggregate 与 Sample Sufficiency

实现版本化聚合、排除来源、分母保护、样本状态和可重建 Snapshot。

验收：0 分母、不足样本、污染数据、跨版本数据和无机会均诚实显示。

### WP4-05：Decision Proposal

实现结构化决策提案和 Internal 接受 / 拒绝 / Supersede 边界。

验收：提案不自动切换 Flag、不删除代码，不对不足样本生成价值结论。

### WP4-06：Internal Observation 页面

实现 Trial Window、能力聚合、完整性、维护成本与提案的只读投射。

验收：普通页面零变化，无学生正文和伪精确结论。

### WP4-07：全链 Debug、浏览器联调与回归

完成 C4、B4、旧主链、Production Build 和数据零污染验收，并输出工程验收报告。

## 二十、自动化 Debug 矩阵

### 20.1 Schema 与身份

| 编号 | 验收项 |
| --- | --- |
| C4-01 | Observation Event Schema 完整 |
| C4-02 | Trial Window Schema 完整 |
| C4-03 | Aggregate Snapshot Schema 完整 |
| C4-04 | Decision Proposal Schema 完整 |
| C4-05 | 相同来源事实得到相同 Event ID |
| C4-06 | 相同事件集合得到相同 Snapshot ID |
| C4-07 | 相同 Snapshot 与策略得到相同 Proposal ID |
| C4-08 | 身份错位被完整性门禁拒绝 |

### 20.2 数据准入

| 编号 | 验收项 |
| --- | --- |
| C4-09 | real_learning 合法事实进入真实分母 |
| C4-10 | Internal Acceptance 被排除 |
| C4-11 | Fixture / Demo / Debug 被排除 |
| C4-12 | Browser Acceptance 被排除 |
| C4-13 | legacy_unobserved 不补写真实事件 |
| C4-14 | Window 外数据不进入聚合 |
| C4-15 | 未知 Schema Version 被阻断 |
| C4-16 | 学生答案和材料正文不会写入 Event |

### 20.3 能力 Adapter

| 编号 | 验收项 |
| --- | --- |
| C4-17 | Revision 映射支持下改善，不写独立掌握 |
| C4-18 | Targeted 映射原子 Gap 结果，不覆盖首答 |
| C4-19 | Retest 映射独立保持 |
| C4-20 | Transfer 映射独立迁移 |
| C4-21 | Successor 只映射资源风险修复 |
| C4-22 | Calibration 只映射内部复核事实 |
| C4-23 | Feedback Projection 映射形成 / 回退 / 后续动作 |
| C4-24 | CoreAbilitySummary 无消费机会时不制造触发 |

### 20.4 Repository 与恢复

| 编号 | 验收项 |
| --- | --- |
| C4-25 | 重复写入保持单一事件 |
| C4-26 | 刷新后事件身份稳定 |
| C4-27 | 跨标签并发不重复 |
| C4-28 | Repository 失败不阻断 Learning |
| C4-29 | 缺失观察可由窗口内正式事实安全补回 |
| C4-30 | 补回不修改正式事实 |
| C4-31 | 删除 Aggregate 后可重建一致 Snapshot |
| C4-32 | Observation 不被 Scheduler / Gate / Profile 读取 |

### 20.5 聚合与样本

| 编号 | 验收项 |
| --- | --- |
| C4-33 | Trigger Rate 分母为 eligibleCount |
| C4-34 | Completion Rate 分母为 triggeredCount |
| C4-35 | Benefit Rate 分母为 completedCount |
| C4-36 | 分母为 0 返回 not_available |
| C4-37 | 比率同时保留分子和分母 |
| C4-38 | 不同策略版本不静默合并 |
| C4-39 | 时间达到 14 日但样本不足仍不 Ready |
| C4-40 | 完整性问题优先投射 integrity_blocked |

### 20.6 决策提案

| 编号 | 验收项 |
| --- | --- |
| C4-41 | 高频明确收益映射保留提案 |
| C4-42 | 低频关键价值映射条件保留 |
| C4-43 | 高频有限收益映射策略优化 |
| C4-44 | 低频有限收益映射默认关闭候选 |
| C4-45 | 低频无收益高维护映射退役候选 |
| C4-46 | 样本不足只能输出 insufficient_evidence |
| C4-47 | 支持下改善无独立验证不升级为核心 |
| C4-48 | 自由文本不参与自动决策 |

### 20.7 关闭、退役与兼容

| 编号 | 验收项 |
| --- | --- |
| C4-49 | 提案不自动修改 Feature Flag |
| C4-50 | 提案不自动删除代码或停止写入 |
| C4-51 | 默认关闭只影响未来 Session |
| C4-52 | 历史 Snapshot 保留旧策略解释 |
| C4-53 | 历史 Frozen Resource 正常消费 |
| C4-54 | 历史 Attempt / Evidence / Profile 不变 |
| C4-55 | Stage 4 Flag off 时行为等同 Stage 3 |
| C4-56 | Observation Repository 可删除而核心链不受影响 |

### 20.8 投射与零回归

| 编号 | 验收项 |
| --- | --- |
| C4-57 | Internal 页面不显示学生正文 |
| C4-58 | Internal 页面区分趋势与正式结论 |
| C4-59 | 普通录入端零新增阶段 4 文案 |
| C4-60 | 普通 Learning 零新增阶段 4 文案 |
| C4-61 | Trial Window Snapshot 冻结后不可静默改写 |
| C4-62 | Proposal 接受 / 拒绝幂等 |
| C4-63 | 正式资源与学习事实 Digest 零变化 |
| C4-64 | 真实分母只包含准入的 real_learning 事件 |

阶段 4 自动化最低门槛：`64 / 64 PASS`。

## 二十一、真实浏览器验收矩阵

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| B4-01 | Stage 4 Flag off | Learning 与阶段 3 完全一致 |
| B4-02 | Internal 验收模式 | 隔离 Fixture 可运行但真实分母为 0 |
| B4-03 | 激活 Trial Window | 显示时间、策略、Registry 与参与范围 |
| B4-04 | Revision 真实观察 | 显示机会、触发、完成与支持下结果 |
| B4-05 | Targeted 真实观察 | 显示匹配、完成、返回正式序列和 Gap 结果 |
| B4-06 | Retest 真实观察 | 独立保持与支持下改善明确分离 |
| B4-07 | Transfer 真实观察 | 无先行稳定证据时不进入有效分母 |
| B4-08 | Feedback Projection | 显示形成、Fallback 和动作代理，不宣称理解率 |
| B4-09 | Profile Summary 无消费 | 显示 no_opportunity，不制造低频失败 |
| B4-10 | 排除数据 | Internal / Fixture / Debug 数量可见且不进真实分母 |
| B4-11 | 0 分母 | 显示暂无数据，不显示 0% |
| B4-12 | 时间足够样本不足 | 显示样本不足，不生成去留结论 |
| B4-13 | 完整性阻断 | 显示身份问题与修复入口，不污染其他能力 |
| B4-14 | Decision Proposal | 显示结构化决定、原因和限制 |
| B4-15 | 默认关闭候选 | 不直接切换 Flag，明确需要后续版本化任务 |
| B4-16 | 退役候选 | 不提供删除按钮，显示七步退役路径 |
| B4-17 | 刷新与重复打开 | Window、Snapshot、Proposal 身份稳定 |
| B4-18 | 跨标签并发 | 不重复 Event，不覆盖较新 Proposal 状态 |
| B4-19 | 普通录入端 / Learning | 无阶段 4 内部术语和新增操作 |
| B4-20 | Observation 写入失败 | Learning 正常完成，Internal 显示观察缺口 |

阶段 4 浏览器最低门槛：`20 / 20 PASS`。

浏览器验收必须使用隔离来源，并明确显示：

```text
Formal Resource Writes = 0
Student Attempt Writes = 0
Evidence Writes = 0
Student Profile Writes = 0
Real Trial Denominator Writes = 0
```

## 二十二、旧主链强制回归

至少回归：

- Product Complexity Convergence Stage 0—3；
- Material Resource Production P0—P7；
- Candidate Adoption / Publication / Recovery；
- Learning Queue、连续题组、题号和完成边界；
- Controlled Feedback、Student Thinking 与 Feedback Action；
- Single Choice Stage 1—4；
- Reading Open Response Input Load Stage 1—4；
- Reading Training Progressive Load Stage 0—4；
- Learning Feedback Revision Stage 1—4；
- Targeted Micro-training Stage 1—4；
- Delayed Retest、Retest Execution 与 Transfer；
- Phase 16.3 Real Learning Chain、Unified Entry 与恢复；
- Evidence Admission、Profile Update 与 Calibration；
- IndexedDB、Outbox、重复提交、刷新和跨标签恢复；
- Production Build。

零回归快照至少比较：

- Formal Resource / Registry Digest；
- Session / Queue / Current Question Digest；
- Initial / Revision / Targeted / Retest / Transfer Attempt Digest；
- Diagnosis / Requirement Coverage Digest；
- Evidence / Profile / Calibration Digest；
- 阶段 2 Owner / Effective Decision Digest；
- 阶段 3 Feedback / Profile Projection Digest；
- Command 调用次数；
- Outbox Pending / Completed Identity。

## 二十三、工程完成定义

阶段 4 隔离观察工程实现只有同时满足以下条件，才可标记 `ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED / ISOLATED OBSERVATION READY`：

1. Observation Event、Trial Window、Aggregate 与 Decision Proposal Schema 完成；
2. 八类能力 Adapter 只读映射现有事实；
3. Data Origin Gate 严格排除非真实来源；
4. Event / Snapshot / Proposal 身份稳定且跨标签幂等；
5. Observation Repository 失败不阻断 Learning；
6. 聚合明确分子、分母、时间窗口和策略版本；
7. 0 分母、无机会、样本不足和完整性阻断诚实展示；
8. Revision / Targeted 支持下收益与 Retest / Transfer 独立表现分离；
9. Decision Agent 只生成提案，不自动切换 Flag 或删除能力；
10. Internal 页面不显示学生正文，不改变普通页面；
11. `C4-01—C4-64` 为 `64 / 64 PASS`；
12. `B4-01—B4-20` 为 `20 / 20 PASS`；
13. 旧主链专项回归与 Production Build 通过；
14. Formal Resource、Attempt、Evidence、Profile 与真实试用分母在验收中零写入；
15. 验收报告区分工程完成、真实试用准备完成与真实教育效果；
16. 未提前执行生产能力默认关闭、deprecated 或代码删除。

## 二十四、真实试用完成定义

工程完成后才允许按照[真实 Trial Window 启动与运行验收契约](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_REAL_TRIAL_WINDOW_OPERATION_AND_ACCEPTANCE_CONTRACT.md)完成启动前检查、显式激活、中途巡检和受控关闭。真实试用完成必须另行输出运行报告，并满足：

1. Window 实际持续 14—28 日，或明确说明提前失效原因；
2. 披露参与学生、活跃天数、Session 数和各能力机会数；
3. 披露排除来源与完整性问题；
4. 每项能力分别给出 Sample Status；
5. 只有 `review_ready` 能力可以生成非 `insufficient_evidence` 提案；
6. 支持下改善与独立保持 / 迁移分开报告；
7. 不以单学生趋势外推普遍教育效果；
8. 默认关闭或退役仍需独立版本化执行任务；
9. 真实运行报告不得混入自动化或浏览器验收数据；
10. 没有足够证据时结论必须是“保留但不扩展，继续观察”。

## 二十五、进入后续任务的边界

阶段 4 之后不存在默认的“阶段 5 新功能开发”。后续只允许根据真实提案进入以下之一：

- 保留现状并继续使用；
- 针对高频有限收益能力优化既有策略；
- 为低频有限收益能力建立默认关闭版本；
- 为低频无收益高维护能力启动退役流程；
- 样本不足时继续观察，但不扩展功能。

任何新 Training Model 能力必须单独立项，不得借阶段 4 验收顺带加入。

## 二十六、冻结声明

`product_complexity_convergence_stage4_stable_trial_retirement_v1` 冻结以下事实：

1. 阶段 4 是稳定试用与能力去留治理，不是新的学习调度系统；
2. 观察事件是可删除的审计事实，不是新的学生能力或资源事实；
3. 只有准入的 `real_learning` 数据进入真实分母；
4. 2—4 周是观察窗口，不是自动有效性证明；
5. V1 样本门槛是产品治理门槛，不是统计学稳定性标准；
6. Revision / Targeted 的支持下改善不能替代 Retest / Transfer 独立证据；
7. Decision Agent 只能生成内部提案；
8. 默认关闭与退役必须在后续版本化任务中显式执行；
9. 历史正式事实和解释能力必须保留；
10. 没有足够真实证据时保留但不扩展；
11. 普通用户页面不增加阶段 4 状态或操作；
12. 每个阶段必须证明旧主链零回归，新语义只在本阶段授权边界内生效。

阶段 4 工程已经完成：`C4-01—C4-64` 为 `64 / 64 PASS`，`B4-01—B4-20` 为 `20 / 20 PASS`，阶段 0—3 与 Revision、Targeted、Reading Progression、Learning Queue 旧主链专项回归为 `295 / 295 PASS`，Production Build PASS。浏览器验收中正式资源、Attempt、Evidence、Profile 与真实试用分母写入均为 `0`。验收事实见[阶段 4 工程、Debug 与浏览器验收报告](../education/phase/reports/product_complexity_convergence_stage4_engineering_debug_browser_acceptance_2026-08-25.md)。

当前达到的是 `ISOLATED OBSERVATION READY`，真实启动仍须完成生产 Owner Fact Adapter、显式激活控制和 `RTW-S01—RTW-S18` 预检。真实 Trial Window 尚未启动；工程验收通过不等于真实试用已经完成，也不等于教育效果已被证明。
