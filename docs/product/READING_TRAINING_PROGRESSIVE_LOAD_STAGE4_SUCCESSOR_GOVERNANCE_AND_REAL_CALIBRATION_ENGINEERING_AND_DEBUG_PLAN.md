# 阅读训练递进负担阶段 4 历史资源 Successor 治理与真实校准工程实施及 Debug 验收清单

英文名称：Reading Training Progressive Load Stage 4 Successor Governance and Real-calibration Engineering Plan

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED / REAL CALIBRATION NOT STARTED`

文档版本：`reading_training_progressive_load_stage4_engineering_plan_v1`

输出日期：`2026-08-24`

上位契约：[阅读训练递进负担模型契约](./READING_TRAINING_PROGRESSIVE_LOAD_MODEL_CONTRACT.md)

前置阶段：[阶段 3 Learning、Diagnosis 与 Evidence 工程实施及 Debug 验收清单](./READING_TRAINING_PROGRESSIVE_LOAD_STAGE3_LEARNING_DIAGNOSIS_EVIDENCE_ENGINEERING_AND_DEBUG_PLAN.md)

阶段 3 浏览器验收：[阶段 3 全量真实浏览器联调验收](../education/phase/reports/reading_training_progressive_load_stage3_full_browser_acceptance_2026-08-24.md)

真实数据边界：[真实 Learning 数据采集与观察契约](./REAL_LEARNING_DATA_COLLECTION_AND_OBSERVATION_CONTRACT.md)

## 一、阶段定位

阶段 4 是阅读训练递进负担模型的**受控治理与真实校准阶段**。它不再扩展一条新的题目生产或学习主链，而是把阶段 0—3 已经形成的审计、原生负担语义、题组坡度、Learning Context、失稳评估和 Evidence Admission 用于两项工作：

1. 只选择高风险历史正式题组，通过既有 Candidate → Adopt → Revision → Publish 链生成后继版本；
2. 采集绑定真实 Question Version 与 Attempt 身份的 Learning 事实，判断递进坡度是否在真实使用中降低入口负担、保持高阶观察，并帮助解释学生从哪一层开始失稳。

阶段 4 不是：

- 批量重写历史题库；
- 自动降低所有题目难度；
- 根据一次失败自动修改题目；
- 用负担等级替代学生能力诊断；
- 用少量样本宣称教育效果成立；
- 新增人工审核人、审核意见或字段编辑流程。

产品操作继续保持：

```text
采用并发布
或
不采用并重新优化
```

阶段状态必须分开表述：

```text
ENGINEERING COMPLETE
≠ FULL BROWSER ACCEPTED
≠ PILOT DATA SUFFICIENT
≠ REAL CALIBRATION COMPLETE
≠ EDUCATIONAL EFFECT PROVEN
```

## 二、贯穿验收原则

继续冻结：

> 每个阶段都必须证明旧主链零回归，并且新语义只在该阶段允许的边界内生效。

阶段 4 必须额外证明：

1. 历史 Frozen Resource 不原地修改、删除或补字段；
2. 未采用 Candidate 不进入 Registry、Learning 或正式统计；
3. 已开始 Session 继续消费启动时冻结的 Question Version 与 Progression Context；
4. 新 Session 只能消费已发布 successor；
5. 真实 Learning 事件失败不能阻断作答、Diagnosis、反馈、修订或下一题；
6. 负担事实、题目治理风险和学生能力 Evidence 三者保持隔离；
7. 阈值变化只影响未来决策，不回写历史 Assessment、Evidence 或 Profile；
8. Fixture、Demo、隔离浏览器数据永远不进入真实校准分母。

## 三、进入条件与当前基线

阶段 4 的工程进入条件已经满足：

- 阶段 0：`24 / 24 PASS`，只读审计无正式写入；
- 阶段 1：`40 / 40 PASS`，原生 `TaskLoadSemantics` 与稳定 Hash 成立；
- 阶段 2：`48 / 48 PASS`，Planner、Prompt 与题组 Gate 成立；
- 阶段 3：`59 / 59 PASS`；
- 阶段 3 浏览器矩阵：`B3-01—B3-16` 为 `16 / 16 PASS`；
- Learning Session Queue：`21 / 21 PASS`；
- Phase 16.3 Real Learning Chain：`17 / 17 PASS`；
- Production Build：PASS。

阶段 0 当前只读基线显示：

| 项目 | 当前只读事实 |
| --- | ---: |
| 活动核心阅读材料 | 12 |
| 活动 Targeted Excerpt | 12 |
| 活动正式题 | 81 |
| 可完整投影题 | 80 |
| 部分投影题 | 1 |
| 可形成完整可追踪坡度的核心题组 | 10 |
| 部分可追踪核心题组 | 2 |

这些数字只是 `2026-08-24` 的只读基线，不得写死为运行门禁。阶段 4 每次运行必须重新生成带 `sourceDigest`、`auditDigest`、策略版本与 Registry Head 的基线快照。

## 四、阶段边界

### 4.1 允许生效

- 读取阶段 0 版本化审计结果和阶段 3 的受约束真实观察；
- 建立高风险历史题组的治理 Case；
- 调用既有生成器生成完整 successor Candidate；
- 复用阶段 1—3 的语义一致性、单题质量和题组坡度门禁；
- 用户采用后创建新的 Revision、Frozen Question Version、Registry Link 和正式 Progression Artifact；
- 新 Session 消费 successor，旧 Session 继续消费冻结 predecessor；
- 记录追加式、版本绑定的真实 Learning 校准事件；
- 形成只读版本级、题组级校准投影；
- 在样本不足时输出事实和限制，不输出稳定结论；
- 通过版本化 Threshold Policy 调整未来治理或 Admission 建议。

### 4.2 禁止生效

- 原地修改、覆盖、删除或重新编号历史 Frozen Resource；
- 批量自动生成、自动采用或自动发布 successor；
- 因审计 Finding 自动撤回当前正式题；
- 为补齐负担等级、单选比例或题量机械生成题目；
- 让 Prompt 绕过 Observation Plan 自行决定题组坡度；
- 将 `loadLevel`、作答时间、提示使用或一次失败写成学生能力标签；
- 把 Revision 或 Targeted 支持下的成功当成独立掌握；
- 跨 Question Version 合并样本后输出单版本结论；
- 把同一学生的重复 Attempt 当成相互独立的多学生样本；
- 自动回写历史 Diagnosis、Evidence、Admission 或 Student Profile；
- 在正常产品页面展示 Governance Case、Plan Hash、Load Code、Admission 或校准内部状态机。

### 4.3 不在本阶段解决

- 多租户、学校级运营和跨设备账号体系；
- 云端实验分流平台；
- 自动 Prompt 自学习或在线强化；
- 新的人工审核角色；
- 人工逐字段改题；
- 无限制反馈后修改；
- 人群级因果教育效果证明。

## 五、治理对象与优先级

### 5.1 治理对象

阶段 4 的治理单位是**正式题组中的具体 Question Lineage / Version**，不是整篇 Material，也不是整个题库。

只有满足以下任一条件时，题目才可进入治理候选池：

1. 阶段 0 出现 `projection_incomplete`、`unexplained_responsibility_jump`、`duplicate_observation_scope` 或可确认的入口过载；
2. 阶段 3 在身份完整且可比较的真实样本中反复形成 `task_load_risk`；
3. 题组入口直接叠加多项责任，导致坡度断裂；
4. 题干、Rubric、Answer Acceptance、responseFormat 或正式负担语义发生确定性错位；
5. 同一题组出现实质重复观察，挤压必要的高阶文本任务；
6. 正式 successor 已存在但 Registry、Plan Artifact 或 Learning 消费身份不一致。

以下事实不能单独触发治理：

- 一名学生的一次失败；
- 单次作答时间较长；
- 单选题数量少于推荐区间；
- 某个负担等级没有出现；
- 用户主观觉得题目“看起来难”；
- 为了让统计图更完整而补样本。

### 5.2 优先级

治理优先级按以下顺序确定：

1. 正式身份或消费一致性错误；
2. 入口高负担且缺少低负担观察入口；
3. 无理由跨级或多个核心责任叠加；
4. 题目设计风险被多个可比较 Attempt 重复观察；
5. 重复观察价值或局部顺序问题；
6. 只影响文案清晰度、不影响训练意图的问题。

同级时优先处理对后续 Diagnosis、Targeted、Retest / Transfer 解释影响更大的题。

### 5.3 批次边界

- 每批最多 `3—5` 道历史正式题；
- 每道 Lineage 同一时间最多一个活动 successor Candidate；
- 每批采用发布后必须先跑零回归和新旧 Session 消费验证；
- 当前批次存在 blocked / stale / identity conflict 时不得启动下一批；
- 不足 `3` 道时允许只治理 `1—2` 道，不得为凑批次强行生成；
- 已发布题量不因治理无限累积：Registry 只让活动 Head 进入新 Session，predecessor 作为历史版本保留，不作为新的活动任务重复消费。

## 六、复用既有治理主链

阶段 4 不新建第二套治理、审核或发布对象。优先复用现有 `ExistingQuestionGovernanceCase`、Question Candidate Workbench、Adoption Gateway、Revision、Admission 和 Registry 版本链。

递进负担只作为现有治理 Case 的版本化上下文：

```ts
type ProgressiveLoadGovernanceContext = {
  schemaVersion: 'progressive_load_governance_context_v1';
  policyVersion: 'reading_training_progressive_load_policy_v2';
  baselineAuditVersion: string;
  sourceDigest: string;
  auditDigest: string;
  sourceResourceVersionId: string;
  sourceProgressionPlanHash?: string;
  sourceTaskLoadSemanticsHash?: string;
  findingCodes: ProgressiveLoadGovernanceFindingCode[];
  targetOutcome:
    | 'restore_accessible_entry'
    | 'remove_unexplained_jump'
    | 'reduce_composite_responsibility'
    | 'remove_duplicate_observation'
    | 'repair_identity_consistency';
};
```

不得仅因新增该上下文而改变现有 Case 的用户交互。用户仍只看到完整方案以及“采用并发布 / 重新优化”。

## 七、Successor Candidate 契约

### 7.1 必须继承

后继 Candidate 必须继承或明确重建：

- Material / Material Version；
- Observation Plan / Revision；
- TrainingTask 与 `planningTaskKey`；
- Question Lineage 与 predecessor identity；
- `TaskLoadSemantics` 与 Hash；
- `TaskGroupProgressionPlan` 与 Plan Hash；
- responseFormat、Rubric、Answer Acceptance；
- taskRole；
- Replacement / Registry Link 身份。

### 7.2 允许变化

- 题干措辞；
- 合法证据范围；
- 主要动作与支撑动作的拆分，但必须触发整组重规划；
- responseFormat，但只有 Observation Plan 与 TrainingTask 同步变化且不破坏题组高阶观察时允许；
- sequenceRank 与 Transition，但必须形成新的 Plan Hash；
- Rubric 与 Answer Acceptance，但必须与新题干一致。

### 7.3 禁止变化

- 静默改变主要训练目标；
- 只改 Candidate、不更新 Task / Plan 身份；
- 让新题与题组已有任务实质重复；
- 删除受保护的高阶文本观察；
- 以选择题替代本应观察概括、证据组织、推理或表达的任务；
- 沿用旧 Plan Hash 表达已经变化的坡度。

### 7.4 发布前门禁

发布必须同时通过：

1. Candidate 单题质量；
2. Task / Candidate 负担语义一致性；
3. 题组坡度与 Transition 合法性；
4. Observation Value 去重；
5. predecessor / successor 身份一致性；
6. Registry Head 未漂移；
7. 新旧 Session 消费边界可证明；
8. 没有要求用户补填审核人或人工意见。

## 八、真实 Learning 校准事件

### 8.1 事件定位

真实校准使用追加式事件，不直接修改业务事实：

```ts
type ProgressiveLoadCalibrationEvent = {
  schemaVersion: 'progressive_load_calibration_event_v1';
  eventId: string;
  eventType:
    | 'task_presented'
    | 'valid_response_submitted'
    | 'invalid_response_rejected'
    | 'hint_opened'
    | 'revision_offered'
    | 'revision_submitted'
    | 'task_completed'
    | 'task_abandoned'
    | 'next_task_entered'
    | 'session_resumed';
  studentId: string;
  learningSessionId: string;
  learningRoundId: string;
  learningTaskAttemptId: string;
  resourceVersionId: string;
  materialVersionId: string;
  progressionPlanHash?: string;
  taskLoadSemanticsHash?: string;
  observationThreadId?: string;
  sequenceRank?: number;
  supportMode:
    | 'initial_independent'
    | 'hint_supported'
    | 'feedback_revision'
    | 'targeted_training'
    | 'retest_independent'
    | 'transfer_independent';
  occurredAt: string;
  source: 'real_learning';
};
```

事件不得保存不必要的完整学生答案副本。答案、Diagnosis 与 Evidence 继续由现有正式对象持有，事件只保存稳定引用和必要过程事实。

### 8.2 真实样本资格

只有同时满足以下条件的 Attempt 才进入真实校准分母：

- `source = real_learning`；
- 使用真实产品 student / session / round / attempt 身份；
- resourceVersionId 是提交当时 Session 冻结版本；
- 事件序列通过完整性检查；
- 作答通过既有输入有效性门禁；
- 不属于 Fixture、Demo、Internal Acceptance、脚本回放或人工伪造；
- 没有重复提交或 Outbox 重放造成的重复计数；
- supportMode 被正确区分。

Revision、Hint、Targeted 可进入过程统计，但不得与 `initial_independent` 合并证明独立掌握。Retest / Transfer 必须作为独立验证层统计。

### 8.3 事件失败边界

- 正式 Answer、Diagnosis、Feedback、Revision 与下一题继续是主链；
- 校准事件通过 Outbox / checkpoint 异步补写；
- 事件写入失败只形成完整性问题，不把已完成题回滚为未完成；
- 重试必须幂等，不制造第二个 Attempt 或第二份 Evidence；
- 无法补齐身份时该样本退出校准分母，但正式学习记录仍保留。

## 九、校准投影与指标

### 9.1 投影单位

校准投影必须分别按以下维度生成：

- Question Version；
- Task Group Progression Plan Hash；
- Material Version；
- sequenceRank；
- supportMode；
- responseFormat；
- observationThreadId。

不得跨 Question Version 直接合并后输出“该题已经校准”。跨版本只能作为并列对照，并明确样本不等价。

### 9.2 第一版指标

```text
presentedCount
validInitialAttemptCount
invalidResponseCount
completedCount
abandonedCount
hintOpenedCount
revisionOfferedCount
revisionSubmittedCount
revisionResolvedCount
nextTaskEnteredCount
sessionResumeCount
medianActiveResponseTime
transitionCompletionRate
stageBreakpointDistribution
taskLoadRiskCount
identityIntegrityFailureCount
```

派生指标至少包括：

- 有效首答率；
- 完成率与中断率；
- 提示使用率；
- 修订接受率与修订解决率；
- 相邻 Transition 完成率；
- 各负担层开始失稳的分布；
- `task_load_risk` 占比；
- 身份完整率。

这些指标解释产品使用与题目负担，不直接生成 Student Ability Profile。

### 9.3 样本状态

```ts
type ProgressiveLoadCalibrationStatus =
  | 'awaiting_data'
  | 'collecting'
  | 'insufficient_sample'
  | 'review_ready'
  | 'calibrated'
  | 'integrity_blocked';
```

- `awaiting_data`：没有合格真实样本；
- `collecting`：已有样本但未达到试运行复核门槛；
- `insufficient_sample`：样本存在，但数量、身份多样性或完整性不足；
- `review_ready`：达到当前试运行门槛，可进行治理复核，不代表统计稳定；
- `calibrated`：经过版本化规则、完整性审计和人工产品决策后确认当前门禁适用；
- `integrity_blocked`：事件或身份链不完整，禁止输出结论。

## 十、试运行阈值与统计边界

第一版可以将 `30` 份合格 Attempt 设为当前试运行的**复核触发阈值**，但必须冻结在版本化策略中：

```ts
type ProgressiveLoadCalibrationThresholdPolicy = {
  schemaVersion: 'progressive_load_calibration_threshold_policy_v1';
  policyVersion: string;
  reviewReadyValidAttemptCount: number;
  minimumDistinctLearnerCount?: number;
  integrityRateFloor: number;
  effectiveFrom: string;
};
```

边界如下：

1. `30` 是当前产品治理门槛，不是永久统计标准；
2. 同一学生的 30 次 Attempt 不等于 30 名独立学生；
3. 单学生试用可观察稳定性、恢复、提示、修订和个体内坡度差异，但不能推断人群效果；
4. 样本达到 30 只允许进入 `review_ready`，不自动进入 `calibrated`；
5. 阈值调整必须生成新 Policy Version，只影响未来投影；
6. 历史投影必须保留当时阈值版本，禁止静默重解释；
7. 样本不足时显示事实数量和限制，不显示“已稳定”“能力提升”或“教育效果有效”。

## 十一、题目负担与学生能力隔离

阶段 4 不改变阶段 3 的归因顺序：

```text
先验证 Question / Plan / Context 身份
→ 再判断题目负担风险
→ 再判断当前单题表现
→ 再判断相邻层级是否可比较
→ 最后由 Evidence Admission 决定是否进入长期能力链
```

必须保持：

- 题组入口失败且题目存在过载风险时，优先形成治理风险；
- 学生完成低层任务、在新增单一责任后稳定失误，才允许形成 provisional breakpoint；
- 单次 provisional 默认 hold；
- Revision / Hint / Targeted 成功只证明支持下改善；
- Retest / Transfer 才能提供独立保持或迁移证据；
- `loadLevel` 永不进入 Student Ability Profile；
- 表达较弱不能倒推出基础理解未成立。

## 十二、版本消费、回滚与删除边界

### 12.1 发布后消费

- 已开始 Session：继续使用冻结 predecessor；
- 新 Session：消费 Registry Head 指向的 successor；
- 恢复中的 Attempt：恢复原 resourceVersionId 和 Context Snapshot；
- 新旧版本的 Learning 事件和校准投影分别累计；
- successor 发布不得让 predecessor 的历史 Evidence 失效。

### 12.2 回滚

若 successor 出现身份、质量或运行风险：

- 可把 Registry Head 恢复到上一可用 Frozen Version；
- 回滚不删除 successor，也不重写其历史 Attempt；
- 已开始消费 successor 的 Session 继续按冻结身份完成或进入明确的安全中断；
- 回滚必须记录版本、原因、操作时间和影响范围；
- 回滚后重新发布必须形成新的治理动作，不复用 stale Candidate。

### 12.3 删除

正式题不提供物理删除。可用：

- `superseded`：已有后继版本；
- `inactive`：不再进入新 Session；
- Registry Head 切换；
- Material 停用。

这些操作防止活动题无限累积，同时保留历史 Session、Evidence 与审计可追踪性。

## 十三、Work Package 与实施顺序

### WP4-A：治理基线与 Case 选择

1. 重新运行阶段 0 只读审计；
2. 冻结当前 Registry、Source Digest、Audit Digest；
3. 读取阶段 3 合格真实观察，但不形成自动治理决定；
4. 建立版本化治理上下文；
5. 输出最多 `3—5` 道首批高风险题；
6. 验证其他正式题与 Learning 数据零写入。

### WP4-B：Successor 生成、采用与发布

1. 将 Finding 转译为生成约束；
2. 复用 Planner / Prompt 生成 Candidate；
3. 运行单题与题组 Gate；
4. 用户执行采用或重新优化；
5. 创建不可变 successor Version 与新 Artifact；
6. 更新 Registry Head；
7. 验证旧 Session / 新 Session 消费边界；
8. 支持批次暂停与版本回滚。

### WP4-C：真实事件与完整性闭环

1. 定义校准事件 Schema 与幂等键；
2. 接入 Learning 关键节点；
3. 通过 Outbox / checkpoint 持久化；
4. 建立事件完整性审计；
5. 将隔离数据、重放数据和身份冲突样本排除在分母外；
6. 验证事件失败不阻断学习主链。

### WP4-D：投影、阈值与内部观察

1. 建立 Question Version / Plan Hash 级投影；
2. 冻结试运行 Threshold Policy；
3. 输出 `awaiting_data → collecting → insufficient_sample → review_ready` 状态；
4. 建立 Internal Review，只显示事实、限制和版本身份；
5. 阈值调整只生成新版本，不回写历史；
6. 正常学生页面继续只显示自然反馈和训练进度。

### WP4-E：Debug、浏览器联调与试用准备

1. 完成 `S4-01—S4-64`；
2. 完成旧主链零回归矩阵；
3. 完成 `B4-01—B4-16`；
4. 验证正式数据前后快照；
5. 输出工程验收报告；
6. 在工程验收完成后才进入真实使用期数据收集。

实施顺序固定为：

```text
WP4-A → WP4-B → WP4-C → WP4-D → WP4-E
```

不得先接入真实事件再补身份契约，也不得先批量治理再补回滚能力。

## 十四、自动化 Debug 矩阵

### 14.1 Governance 与基线（S4-01—S4-12）

| Case | 验收点 |
| --- | --- |
| S4-01 | 合法 ProgressiveLoadGovernanceContext 通过 Guard |
| S4-02 | 缺 sourceResourceVersionId 被拒绝 |
| S4-03 | Source / Audit Digest 变化生成新治理身份 |
| S4-04 | 相同基线重放返回同一 Case |
| S4-05 | Registry Head 变化使旧 Case stale |
| S4-06 | 单次学生失败不能单独创建自动治理决定 |
| S4-07 | 确定性身份错误可进入最高优先级 |
| S4-08 | 每批最多 3—5 道，少于 3 道允许成立 |
| S4-09 | retain 不生成 Candidate |
| S4-10 | 未选中题目零写入 |
| S4-11 | 阶段 0 审计重放稳定 |
| S4-12 | 正式基线前后快照一致 |

### 14.2 Successor 与发布（S4-13—S4-28）

| Case | 验收点 |
| --- | --- |
| S4-13 | successor 继承 Material / Observation / Task / Lineage 身份 |
| S4-14 | 主要动作变化触发整组重规划 |
| S4-15 | Plan 变化生成新 Plan Hash |
| S4-16 | 沿用旧 Hash 的漂移 Candidate 被阻断 |
| S4-17 | 单题质量、语义一致性与题组 Gate 全部通过才 ready |
| S4-18 | 重复观察价值被阻断 |
| S4-19 | 受保护高阶观察丢失被阻断 |
| S4-20 | 单选不能静默替代高阶文本任务 |
| S4-21 | 相同采用命令幂等 |
| S4-22 | 未采用 Candidate 不进入 Registry |
| S4-23 | 发布形成新不可变 Frozen Version |
| S4-24 | predecessor 保持可追踪且不进入新 Session |
| S4-25 | 已开始 Session 继续消费 predecessor |
| S4-26 | 新 Session 消费 successor |
| S4-27 | 回滚切换 Head 但不删除任何版本 |
| S4-28 | stale Candidate 不可继续采用 |

### 14.3 真实事件与完整性（S4-29—S4-44）

| Case | 验收点 |
| --- | --- |
| S4-29 | 合法真实 Learning 事件通过 Guard |
| S4-30 | Fixture / Demo / Internal Acceptance 被排除 |
| S4-31 | 缺 Attempt / Resource Version 身份被排除 |
| S4-32 | 事件幂等键阻止重复计数 |
| S4-33 | Outbox 重放不制造第二份样本 |
| S4-34 | 事件失败不回滚正式 Answer / Diagnosis |
| S4-35 | 恢复后可补写相同事件 |
| S4-36 | Invalid Response 不进入有效首答分母 |
| S4-37 | Hint 与 Revision 保留支持身份 |
| S4-38 | Targeted 不覆盖首次独立表现 |
| S4-39 | Retest / Transfer 保持独立验证身份 |
| S4-40 | Question Version 不一致禁止合并 |
| S4-41 | 同一学生重复 Attempt 不伪装成多学生 |
| S4-42 | 事件不复制完整学生答案 |
| S4-43 | 完整性失败形成 issue 并退出分母 |
| S4-44 | 正式学习主链在事件仓库不可用时继续完成 |

### 14.4 投影、阈值与归因（S4-45—S4-56）

| Case | 验收点 |
| --- | --- |
| S4-45 | 空样本为 awaiting_data |
| S4-46 | 少量样本为 collecting / insufficient_sample |
| S4-47 | 达到试运行数量只进入 review_ready |
| S4-48 | 30 被识别为版本化试运行阈值而非永久标准 |
| S4-49 | Distinct Learner 不足时保留限制 |
| S4-50 | 阈值新版本不回写历史投影 |
| S4-51 | Question Version 分开统计 |
| S4-52 | Plan Hash 分开统计 |
| S4-53 | task_load_risk 不进入 Student Profile |
| S4-54 | 单次 provisional Evidence 默认 hold |
| S4-55 | Revision 成功不自动证明独立掌握 |
| S4-56 | 独立 Retest / Transfer 可提供后续佐证 |

### 14.5 零回归与产品投射（S4-57—S4-64）

| Case | 验收点 |
| --- | --- |
| S4-57 | Material → Plan → Task → Candidate 主链不变 |
| S4-58 | Adopt → Revision → Publish 唯一决策链不变 |
| S4-59 | Single Choice 学习与反馈不回归 |
| S4-60 | Revision 一次修订边界不回归 |
| S4-61 | Targeted / Retest / Transfer 调度不回归 |
| S4-62 | Learning Persistence / Queue / Evidence 不回归 |
| S4-63 | 正常学生页面无治理与校准内部字段 |
| S4-64 | Production Build 通过且正式数据快照一致 |

## 十五、真实浏览器联调矩阵

浏览器联调采用隔离治理数据和只读正式数据，冻结 `B4-01—B4-16`：

| Case | 场景 |
| --- | --- |
| B4-01 | 只读基线展示当前高风险 Case，不修改正式题 |
| B4-02 | 单个 Case 生成完整 successor Candidate |
| B4-03 | 用户操作只有采用并发布 / 重新优化 |
| B4-04 | blocked / stale 在当前卡片原位说明原因 |
| B4-05 | publishing 时只保留一个不可重复点击的进行中按钮 |
| B4-06 | 发布后 predecessor 与 successor 版本链可追踪 |
| B4-07 | 已打开 Session 继续消费 predecessor |
| B4-08 | 新 Session 消费 successor 与新 Plan |
| B4-09 | 页面刷新不重复发布或重复更新 Registry |
| B4-10 | 回滚后新 Session 恢复上一可用 Head |
| B4-11 | 真实事件失败不阻断提交、反馈与下一题 |
| B4-12 | Outbox 恢复后补写且不重复计数 |
| B4-13 | 校准投影区分 awaiting / insufficient / review_ready |
| B4-14 | 隔离验收数据不进入真实分母 |
| B4-15 | Internal Review 可追踪版本、Plan、事件完整性与限制 |
| B4-16 | 正常录入端和 Learning 端无测试面板、内部状态码或新增人工步骤 |

联调报告必须列出正式资源、Student Attempt、Student Profile 与真实校准分母的写入数量。若使用隔离 Fixture，必须全部为 `0`。

## 十六、真实使用期校准方案

工程与浏览器验收完成后，真实使用按以下顺序进行：

1. 先保留当前单学生封闭试用；
2. 只启用一小批 successor，不同时更换大量题目；
3. 每次学习记录版本身份、有效首答、提示、修订、完成、退出和下一题进入；
4. 每周检查事件完整性、题组入口完成率、Transition 中断和 task-load-risk；
5. 样本不足只记录趋势，不调整永久阈值；
6. 达到当前试运行复核门槛后，由产品决策是否保留、回滚或继续收集；
7. 进入 2—3 人远程试用后，单独观察 distinct learner 差异，不与单学生重复 Attempt 混为一体；
8. 只有 Retest / Transfer 和跨时间独立表现支持时，才讨论能力保持与迁移。

## 十七、阶段完成门槛

### 17.1 工程完成

只有同时满足以下条件，才能标记 `ENGINEERING COMPLETE / DEBUG ACCEPTED`：

1. Governance Context、Calibration Event、Projection 与 Threshold Policy Schema 完成；
2. successor 治理复用现有主链；
3. 新旧 Session 消费边界成立；
4. 真实事件追加、幂等、恢复和完整性审计成立；
5. `S4-01—S4-64` 全部通过；
6. 旧主链零回归；
7. Production Build 通过；
8. 正式数据前后快照符合授权范围。

### 17.2 浏览器完成

只有 `B4-01—B4-16` 全部通过，才能增加 `FULL BROWSER ACCEPTED`。

### 17.3 试用准备完成

只有真实事件身份、Outbox、完整性审计、内部观察与停止条件全部可用，才能增加 `PILOT DATA COLLECTION READY`。

### 17.4 真实校准完成

只有版本级样本达到当时策略门槛、身份完整、限制充分披露，并经过产品复核后，才能对具体 Question Version 标记 `calibrated`。阶段整体不得因少数题达到阈值而宣称全部资源完成校准。

### 17.5 教育效果

本阶段不以工程验收或版本校准直接宣称教育效果。教育效果至少需要跨时间 Retest / Transfer、完整 Evidence 链和更充分的真实使用样本。

## 十八、停止与回滚条件

出现以下任一情况时暂停治理或真实校准：

- Registry / Version / Plan / Attempt 身份不一致；
- 校准事件完整率低于当前策略下限；
- successor 造成新 Session 无法消费；
- 入口负担降低但高阶观察被破坏；
- 题组重复观察增加；
- 正常学生页面出现内部工程术语；
- 事件写入阻断主学习链；
- 同一题连续两次生成仍无法通过 Gate；
- 样本来源无法区分真实、Fixture 或重放；
- 用户明确不采用或要求暂停。

停止时保持当前可用 Frozen Version；必要时回滚 Registry Head，不删除任何历史版本或 Learning 事实。

## 十九、工程交付物

阶段 4 工程完成时至少应交付：

- 本契约；
- Schema 与 Guard；
- 治理 Case 适配器与 Repository；
- Successor Candidate / Adoption / Publish 复用接线；
- Calibration Event Ledger / Outbox；
- 完整性审计与校准投影；
- 版本化 Threshold Policy；
- Internal Review；
- `S4-01—S4-64` Debug Runner；
- `B4-01—B4-16` 浏览器验收入口；
- 工程与 Debug 验收报告；
- 全量浏览器联调报告；
- 真实试用观察模板。

## 二十、最终冻结结论

阶段 4 的核心不是把历史题“全部改得更简单”，而是建立以下受控闭环：

```text
只读审计与真实观察发现高风险题组
→ 小批次生成 successor Candidate
→ 用户采用或重新优化
→ 发布不可变新版本，旧 Session 不漂移
→ 新 Session 产生版本绑定的真实过程事实
→ 先审计完整性，再形成版本级校准投影
→ 证据不足继续收集，风险成立则治理或回滚
```

阶段 4 保持题目负担、学生表现和长期能力三者的边界。它允许系统逐步验证“从低负担理解进入、逐步增加责任”的训练模型是否在真实使用中成立，但不允许从少量失败、单次修订或试运行阈值反推出学生能力不足或教育效果已经证明。

## 二十一、工程实现与 Debug 验收结果

2026-08-24 已按 `WP4-A → WP4-B → WP4-C → WP4-D → WP4-E` 完成阶段 4 工程开发：

1. 新增 `ProgressiveLoadGovernanceContext`、真实校准事件、Outbox、Threshold Policy 与版本级 Projection Schema / Guard；
2. 高风险历史题治理只建立版本化旁路上下文，并复用既有 `ExistingQuestionGovernanceCase → QuestionCandidate → Adopt → Revision → Publish`，没有建立第二条发布链；
3. successor 发布后保留 predecessor，新旧 Session 分别冻结原版本与读取 Registry Head；
4. Phase 16.3 Learning 在既有 Observation 成功后旁路派生校准事件，事件写入失败进入 Outbox 或安全丢弃，不回滚作答、Diagnosis、反馈、修订和下一题；
5. 有效首答、无效提交、提示打开、反馈修订、任务完成和进入下一题保留各自事件语义；展示、提交和完成始终携带同一 `responseFormat`，避免同一题被错误拆分投影；
6. Fixture、Demo、Debug、Internal Acceptance 与 isolated source 不进入真实分母；事件不复制答案正文；
7. Internal Review 只展示 Version、Plan、支持模式、样本量、完整性和限制，不形成学生能力结论；
8. 当前 `30` 份仍只是 `progressive_load_calibration_trial_policy_v1` 的版本化试运行复核门槛，达到后仅进入 `review_ready`，不得自动标记教育效果成立。

验收结果：

| 验收项 | 结果 |
| --- | --- |
| 阶段 4 自动化矩阵 S4-01—S4-64 | `64 / 64 PASS` |
| 隔离浏览器验收运行时 B4-01—B4-16 | `16 / 16 PASS` |
| 阶段 0 / 1 / 2 / 3 | `24 / 24`、`40 / 40`、`48 / 48`、`59 / 59 PASS` |
| Learning Session Queue | `21 / 21 PASS` |
| Phase 16.3 Real Learning Chain | `17 / 17 PASS` |
| 开放文本负担阶段 4 | `56 / 56 PASS` |
| 单项选择阶段 4 | `13 / 13 PASS` |
| Targeted Micro-training 阶段 4 | `51 / 51 PASS` |
| Production Build | PASS |

当前结论严格限定为：工程完成、自动化 Debug 通过，且 `B4-01—B4-16` 已在真实应用内浏览器中完成人工联调签署，状态可增加 `FULL BROWSER ACCEPTED`。联调使用隔离内存数据，正式资源、Student Attempt、Student Profile 与真实校准分母写入均为 `0`。目前没有产生满足门槛的真实 Learning 样本，因此不得增加 `PILOT DATA SUFFICIENT`、`REAL CALIBRATION COMPLETE` 或 `EDUCATIONAL EFFECT PROVEN`。

工程验收记录见：[阶段 4 工程与 Debug 验收报告](../education/phase/reports/reading_training_progressive_load_stage4_engineering_debug_acceptance_2026-08-24.md)。

浏览器签署记录见：[阶段 4 全量真实浏览器联调验收](../education/phase/reports/reading_training_progressive_load_stage4_full_browser_acceptance_2026-08-24.md)。
