# 针对性短片段微训练阶段 4：受控启用与真实校准契约

英文名称：Targeted Micro-training Stage 4 Controlled Enablement and Real Calibration Contract

状态：`ENGINEERING + CONTROLLED BROWSER PASS / REAL CALIBRATION PENDING`  
文档版本：`targeted_micro_training_stage4_controlled_calibration_v1.1`  
日期：`2026-08-20`

当前已完成受控资源包、启用策略、运行事件、完整性审计、校准投影、内部控制工程及 `B4-01—B4-16` 全量受控浏览器联调。真实学生观察尚未完成，本文中的教育效果与继续启用标准仍是待验证契约，不是已经得到证明的结论。

## 一、阶段目标

阶段 4 不再扩展微训练 Schema、Gap 类别或题目数量。它只回答四个问题：

1. 已审查的短片段资源能否安全进入受控正式 Registry；
2. `核心题 → 微训练 → 返回核心题组` 能否在真实浏览器和中断条件下稳定运行；
3. 运行事件和后续独立表现能否形成身份完整、分母明确的校准样本；
4. 单学生真实使用是否支持继续受控启用、调整资源，或暂停该能力。

目标链路为：

```text
受控资源包导入
→ 显式验证开关
→ 正式核心题形成唯一具体动作缺口
→ 精确匹配并呈现一项微训练
→ 独立 Attempt / Diagnosis / Evidence
→ 返回冻结核心游标
→ 后续独立 Core / Retest / Transfer 观察
→ 形成版本化校准结论
→ 继续受控启用、调整资源或暂停
```

阶段 4 通过不等于普遍教育效果已经得到证明。单学生、小样本结果只能支持当前版本、当前资源包和当前使用者范围内的试运行决策。

## 二、必须继承的冻结边界

阶段 4 必须直接复用，不重新定义：

- 首批四类 `TargetedGapReasonCode`；
- `TargetedMicroTrainingTriggerDecision / Request / Assignment`；
- 确定性 Request 与 Assignment 身份；
- `targeted_excerpt` Material、Frozen Resource Version 和 Active Registry Link；
- 固定核心 `LearningSessionTaskQueue` 与 Session Overlay；
- 单核心题最多一项、单 Session 最多完成两项；
- Revision 优先且与微训练互斥；
- 微训练自身不触发微训练；
- 核心首次表现、Revision、微训练和后续验证的 Attempt / Evidence 隔离；
- 人工只负责采用或不采用，不增加人工改题或额外审核步骤。

阶段 4 不允许借“真实校准”改变上述结构，也不允许直接修改既有 Frozen Version。

## 三、阶段 4 总原则

1. **先安全，再观察效果。** 完整浏览器链和恢复门禁未通过前，不进入真实学生使用。
2. **先受控导入，再显式启用。** 不自动把隔离资源包写入活动 Registry，不默认全量开启。
3. **即时完成不是效果结论。** `Immediate Resolution` 只描述当前支持条件下的任务完成。
4. **后续独立表现才可验证变化。** Same-gap Recurrence、Retest 和 Transfer 必须来自不依赖刚才答案的后续任务。
5. **分母必须冻结。** 每个指标必须记录策略版本、资源包版本、观察窗口、资格规则和排除原因。
6. **无匹配是正常结果。** 不以近似 Ability、错误 Gap 或重复证据补齐 Match Rate。
7. **失败不污染学习主线。** 采集或校准失败不阻断核心学习，调度失败必须安全返回。
8. **不自动调参。** 指标只能形成治理建议，不能直接改变 Prompt、阈值、资源版本或触发策略。
9. **可随时停用且不丢历史。** 停用调度不得删除已经形成的 Attempt、Diagnosis、Evidence 或校准事实。
10. **小样本诚实。** 单学生重复作答不是多个独立学习者样本，阶段结果不得外推到其他学生。

## 四、受控资源导入与回滚

### 4.1 导入清单

阶段 2 隔离资源包只有形成版本化清单后才能进入阶段 4：

```ts
type TargetedMicroTrainingControlledPackManifest = {
  packId: string;
  packVersion: string;
  materialVersionIds: string[];
  resourceVersionIds: string[];
  registryResourceIds: string[];
  gapCoverage: Record<TargetedGapReasonCode, number>;
  manifestHash: string;
  reviewedAt: string;
  importedAt?: string;
  status: 'prepared' | 'imported' | 'paused' | 'rolled_back';
};
```

导入前必须验证：

- Material 为活动 `targeted_excerpt` 且元数据完整；
- Resource 为当前 Frozen Version；
- Registry Link 为 Active 且与 Frozen Head 一致；
- Ability、Gap、Role 和 Material Version 身份一致；
- 四类 Gap 的受控资源覆盖满足清单声明；
- 同一逻辑资源没有覆盖当前正式核心题；
- Manifest 重复执行时保持幂等。

### 4.2 隔离范围

受控导入必须使用明确 `packId / packVersion`。不得把资源包身份藏在标签文本中，也不得修改当前核心材料和题目的版本身份。

第一轮只允许固定产品学生身份与显式验证开关消费。其他入口继续按默认关闭处理。

### 4.3 回滚规则

回滚只停止后续匹配，不删除历史事实：

- 将本资源包活动 Link 暂停或恢复导入前 Registry Head；
- Pending 且尚未呈现的 Assignment 标记 `unavailable`；
- 已经 `in_progress` 的 Frozen Version 若仍可读取，允许完成；无法读取则安全返回核心题组；
- 已完成 Attempt / Diagnosis / Evidence、事件和校准 Episode 永久保留原版本身份；
- 回滚命令必须幂等并生成审计记录。

完整回滚后允许重新导入同一不可变资源包，以支持恢复演练和重复联调；重新导入不得跳过完整性校验。若题干、Rubric、观察链或正文发生变化，必须使用新的 Pack Version 及新的不可变资源身份，旧版本继续保留审计记录，不允许静默覆盖。

## 五、启用状态机

```ts
type TargetedMicroTrainingEnablementMode =
  | 'disabled'
  | 'isolated_verify'
  | 'controlled_single_learner'
  | 'paused';
```

| 模式 | 允许范围 | 说明 |
| --- | --- | --- |
| `disabled` | 无动态调度 | 正式默认值 |
| `isolated_verify` | 隔离身份、受控资源、工程联调 | 不计入真实效果样本 |
| `controlled_single_learner` | 固定产品学生、受控资源包 | 进入真实观察窗口 |
| `paused` | 不创建新 Assignment | 保留历史并允许恢复安全返回 |

阶段 4 不提供“全量启用”状态。扩大到 2–3 名远程使用者属于后续独立放量决策。

模式切换必须保存：操作者、原因、前后模式、策略版本、资源包版本和时间。页面参数只允许进入 `isolated_verify`，不得把正式产品模式静默切到 `controlled_single_learner`。

## 六、校准对象与身份

### 6.1 校准 Episode

```ts
type TargetedMicroTrainingCalibrationEpisode = {
  episodeId: string;
  policyVersion: string;
  packId: string;
  packVersion: string;
  studentId: string;
  learningSessionId: string;
  sourceLearningRoundId: string;
  sourceAttemptId: string;
  decisionId: string;
  requestId?: string;
  assignmentId?: string;
  targetedAttemptId?: string;
  sourceResourceVersionId: string;
  targetedResourceVersionId?: string;
  abilityId?: string;
  gapReasonCode?: TargetedGapReasonCode;
  triggerOutcome: string;
  assignmentOutcome?: 'completed' | 'skipped' | 'unavailable';
  coreReturnOutcome?: 'resumed' | 'session_completed' | 'interrupted';
  openedAt: string;
  closedAt?: string;
};
```

`episodeId` 必须由稳定来源身份确定性生成。刷新、重复提交、Outbox 补写和跨标签操作不得产生第二个 Episode。

### 6.2 后续独立观察

```ts
type TargetedMicroTrainingFollowUpObservation = {
  observationId: string;
  episodeId: string;
  followUpAttemptId: string;
  followUpRole: 'core_training' | 'retest' | 'transfer';
  abilityId: string;
  gapReasonCode: TargetedGapReasonCode;
  independence: 'qualified' | 'not_independent' | 'insufficient_to_judge';
  result: 'gap_recurred' | 'gap_not_observed' | 'insufficient_to_judge';
  observedAt: string;
};
```

只有同时满足以下条件才能成为 `qualified`：

- Follow-up 使用不同 Resource Version；
- 不复用微训练答案或具体提示；
- 证据情境不同，或同篇时 Anchor 明确不同；
- Ability 和 Gap 比较关系可解释；
- Student Response 有效且正式 Diagnosis 已持久化；
- Follow-up 不是微训练自身，也不是来源题的 Revision。

## 七、事件与完整性

阶段 4 将阶段 3 事件正式接入可恢复 Ledger / Outbox：

```text
targeted_trigger_evaluated
targeted_no_match
targeted_assignment_created
targeted_assignment_presented
targeted_assignment_completed
targeted_assignment_skipped
targeted_assignment_unavailable
targeted_core_queue_resumed
targeted_follow_up_observed
```

事件只保存稳定身份、状态、策略版本、资源包版本和时间；不复制完整答案、材料全文或反馈全文。

完整性至少满足：

```text
每个 Trigger Decision = 1 个 targeted_trigger_evaluated

eligible Decision
= no_match
+ created Assignment

presented Assignment
= completed
+ unavailable after presentation
+ still in_progress

terminal Assignment
→ exactly one core return outcome
```

`skipped` 只允许发生在尚未开始作答的 Pending Assignment。事件写入失败进入 Outbox，不阻断学习主链；补写必须复用原 `eventId`。

## 八、指标与分母

所有指标必须绑定 `policyVersion + packVersion + observationWindow`，并同时展示分子、分母和排除数。

| 指标 | 分子 / 分母 | 解释边界 |
| --- | --- | --- |
| Trigger Rate | `eligible Decision / 可评估核心 Training Attempt` | 不含 Revision、微训练来源、无效回答和身份错位 |
| Match Rate | `created Assignment / eligible Decision` | `no_match` 反映资源覆盖，不是学生失败 |
| Start Rate | `in_progress Assignment / presented Assignment` | 观察学生是否接受进入微训练 |
| Completion Rate | `completed Assignment / in_progress Assignment` | 不等于缺口改善 |
| Skip Rate | `skipped Assignment / presented Pending Assignment` | 观察干预接受度 |
| Unavailable Rate | `unavailable Assignment / created Assignment` | 工程与资源稳定性指标 |
| Core Return Rate | `resumed 或 session_completed / terminal Assignment` | 必须接近完整闭环，不允许卡死 |
| Immediate Resolution | `当前微训练目标要求达成 / 有效 completed targeted Attempt` | 只描述当前支持条件 |
| Follow-up Coverage | `具有 qualified Follow-up / completed Episode` | 覆盖不足时不得计算效果方向 |
| Same-gap Recurrence | `gap_recurred / 可判断 qualified Follow-up` | 排除 insufficient_to_judge |
| Retest / Transfer Result | 按 Role 分别报告 | 不与核心题或即时训练混成一个百分比 |
| Session Exit | 微训练呈现后未正常返回的 Session / presented Assignment 所在 Session | 需结合中断与技术错误解释 |

不得把未触发学生、无匹配 Episode 或 `insufficient_to_judge` 偷换到有利分母中；不得把同一学生重复作答解释为多个独立学习者。

## 九、真实观察窗口与决策门槛

### 9.1 工程与真实效果分开验收

阶段 4 工程通过要求完整浏览器链、事件完整性、指标投影和回滚成立，不要求达到教育效果样本量。

真实单学生首轮观察建议持续至少 `5–7` 个自然日。以下数量是产品治理门槛，不是统计学稳定性标准：

- 运行安全初步判断：至少 `5` 次真实 presented Assignment，来自至少 `3` 个 Session；
- 初步教育方向观察：至少 `8` 个 completed Episode，其中至少 `6` 个具有可判断的 qualified Follow-up；
- 若观察期结束仍不足，状态只能是 `INSUFFICIENT DATA`，不得补造样本或降低独立性条件。

单学生结果不得用于宣称群体有效。后续扩展到 2–3 人时必须保留 Learner 分层，不把重复 Attempt 当作独立学生。

### 9.2 允许的结论

阶段 4 只允许形成：

- 运行安全、可恢复或需要暂停；
- 资源覆盖充分、存在空白或匹配偏斜；
- 学生愿意完成、经常跳过或明显增加退出；
- 后续同类缺口出现较少、无明确变化、反而增加或数据不足；
- 建议维持、收紧、调整资源或暂停。

禁止形成“能力已提升”“方法对所有学生有效”或“已精准证明教育效果”等结论。

## 十、暂停与回滚条件

发生任一硬故障时立即切换为 `paused`：

- 核心队列被插入、删除、重排或分母改变；
- 重复 Assignment、重复 targeted Attempt 或身份串线；
- Revision 与微训练同时成为竞争主操作；
- 答案、正确选项或评分结论泄露；
- terminal Assignment 无法返回核心题组；
- 错误 Material / Resource Version 被消费；
- 停用后仍继续创建新 Assignment。

以下情况进入人工复核，不自动停用全部能力：

- Match Rate 低：优先检查资源覆盖，不放宽精确匹配；
- Skip / Exit 偏高：检查时机、文案和 Session 负担；
- Immediate Resolution 高但 Recurrence 未下降：检查提示依赖、任务新颖度和迁移难度；
- 某一 Gap 的资源或结果显著偏斜：按 Gap 分层，不用总体平均掩盖。

## 十一、阶段状态语义

阶段 4 只能使用以下状态：

- `DESIGN READY / ENGINEERING NOT STARTED`；
- `ENGINEERING + CONTROLLED BROWSER PASS / REAL CALIBRATION PENDING`；
- `CONTROLLED SINGLE-LEARNER CALIBRATION PASS / GENERALIZATION NOT PROVEN`；
- `INSUFFICIENT DATA / OBSERVATION EXTENDED`；
- `PAUSED / REVIEW REQUIRED`。

不得只写“阶段 4 PASS”而省略真实数据与外推边界。

## 十二、明确不做

阶段 4 不做：

- 扩展 Gap Reason Code；
- 扩大短片段题库规模；
- 自动改 Prompt、Rubric、Answer Acceptance 或 Frozen Version；
- 用即时微训练结果更新长期 Ability Profile；
- 用同一题 Revision 或同一短片段重答证明迁移；
- 为提高 Match Rate 放宽 Ability、Gap、Role 或来源门禁；
- 增加教师或学生人工校准表单；
- 默认开放给多个学生或远程网络用户；
- 把工程 Debug、浏览器 Demo 或小样本正确率写成教育效果证明。

## 十三、相关文档

- [针对性短片段微训练材料与调度契约](./TARGETED_MICRO_TRAINING_MATERIAL_AND_SCHEDULING_CONTRACT.md)
- [阶段 3：Learning 条件调度工程实施与验收清单](./TARGETED_MICRO_TRAINING_STAGE3_LEARNING_SCHEDULING_ENGINEERING_PLAN.md)
- [阶段 3 工程与 Debug 验收](../education/phase/reports/targeted_micro_training_stage3_engineering_debug_acceptance_2026-08-20.md)
- [阶段 4 工程实施与验收清单](./TARGETED_MICRO_TRAINING_STAGE4_ENGINEERING_AND_ACCEPTANCE_PLAN.md)
- [真实 Learning 数据采集与观察契约](./REAL_LEARNING_DATA_COLLECTION_AND_OBSERVATION_CONTRACT.md)
- [AI 训练任务、题目采用与真实作答校准契约](./AI_QUESTION_ADOPTION_AND_EMPIRICAL_CALIBRATION_CONTRACT.md)
- [学习反馈修订观察、审计与指标契约](./LEARNING_FEEDBACK_REVISION_OBSERVATION_AND_AUDIT_CONTRACT.md)
- [训练模型](../education/TRAINING_MODEL.md)
