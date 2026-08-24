# 阅读训练递进负担模型阶段 2：Planner、Prompt 与题组级 Gate 工程实施与 Debug 验收计划

英文名称：Reading Training Progressive Load Stage 2 Planner, Prompt and Group Gate Engineering and Debug Plan

状态：`IMPLEMENTED / DEBUG ACCEPTED`

上位契约：`reading_training_progressive_load_policy_v2`

前置阶段：`reading_training_progressive_load_stage1_v1 / IMPLEMENTED / DEBUG ACCEPTED`

阶段版本：`reading_training_progressive_load_stage2_v1`

更新日期：2026-08-21

## 一、阶段目标

阶段 2 将阶段 1 已建立的单任务原生负担语义，升级为可执行、可解释且可校验的题组规划：

```text
Material / Observation Intent
→ Task Planning Seeds
→ TaskGroupProgressionPlan
→ Question Prompt Realization
→ Candidate Semantics Verification
→ Task Group Progression Gate
→ 既有 Adopt / Revision / Publish 主链
```

本阶段解决四个问题：

1. Planner 不再只排列若干任务，而是明确题组策略、正式顺序、相邻过渡和新增责任；
2. Question Prompt 消费权威任务语义和题组位置，不再自行决定梯度；
3. 单题生成结果与任务计划继续执行阶段 1 Verification；
4. 题组级 Gate 检查身份、顺序、过渡理由和重复观察价值，阻止无理由的高负担跳跃。

阶段 2 不负责：

- 修改 Learning 调度、学生界面或当前 Session 顺序；
- 根据学生作答定位失稳层级；
- 生成新的 Diagnosis、Evidence 或 Student Ability Profile 结论；
- 批量覆盖历史 Frozen Resource；
- 自动重排已经发布的正式题目；
- 为形成漂亮梯度机械增加任务或题型；
- 让用户编辑负担等级、责任或过渡理由。

阶段 2 完成后只能声明“新题组能够按有理由的坡度完成规划、生成和发布前校验”，不能声明 Learning 已经使用负担层级解释学生能力。

### 1.1 贯穿性双重验收

阶段 2 必须继续证明：**旧主链零回归，并且新语义只在本阶段允许的边界内生效。**

因此阶段完成报告必须同时包含：

1. Material → Plan → Task → Candidate → Adopt → Revision → Publish → Learning 主链，以及 Single Choice、Open Response、Revision、Targeted Micro-training、Retest / Transfer 回归结果；
2. Planner、Prompt、Candidate Verification 与题组 Gate 的授权生效清单；
3. Learning、Diagnosis、Evidence、Student Profile 和历史 Frozen Resource 的禁止生效清单；
4. 正式集合、Registry、Learning Session / Attempt 和关键 Store 的前后摘要；
5. 对任何失败的归因：阶段 2 引入、既有问题或环境问题，不得用局部专项通过替代零回归证明。

## 二、系统原则与不可突破边界

### 2.1 规划坡度，不规划模板

推荐观察坡度仍为：

`基础理解单选 → entry_short → focused_short → developing → integrated`

但 Planner 只保证“不出现无理由的负担跳跃”，不要求：

- 每组必须出现全部五个层级；
- 每组必须包含单选；
- 每组必须包含 `entry_short`；
- 每个层级只能出现一次；
- 所有题组使用相同任务数量；
- 仅按题型或字数判断难度。

合法题组可以是：

```text
single_choice → focused_short → developing → integrated
entry_short → developing
focused_short → integrated（存在材料与训练目标支持的正式理由）
integrated → focused_short（holistic_first，先保留独立整体判断）
training → retest / transfer（role_driven）
```

不合法的是：系统无法说明为什么增加多个责任，却仍把高负担任务直接安排在低负担任务之后，或以“题目更难”作为唯一理由。

### 2.2 观察线程边界

题组顺序与可比较梯度不是同一概念：

- 同一 `observationThreadId` 的相邻任务可以用于描述责任递进；
- 不同观察线程可以出现在同一题组，但必须标为 `cross_thread`，不得伪装成同一能力坡度；
- 跨线程排序只表达教学流程，不支持未来直接推断失稳点；
- Retest / Transfer 可引用原观察线程，但必须通过 taskRole 保持证据隔离；
- Targeted Excerpt 通常只有一个具体动作，不要求形成完整题组坡度。

### 2.3 人工边界

用户仍只执行：

- 采用并发布；
- 不采用并重新优化。

系统不得新增“人工填写过渡理由”“人工选择负担等级”“人工确认每项责任”等步骤。题组 Gate 的提示必须转成可理解的方案级结论，不向用户暴露内部 Schema 或错误码。

## 三、版本与兼容策略

```ts
const TASK_GROUP_PROGRESSION_PLAN_SCHEMA_VERSION =
  'task_group_progression_plan_v1';

const READING_TASK_GROUP_PROGRESSION_GATE_VERSION =
  'reading_task_group_progression_gate_v1';

const READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION =
  'reading-training-progressive-load-stage2-v1';
```

兼容规则：

1. `reading_training_progressive_load_policy_v2` 继续作为上位 Policy，不创建第二套 Training Model Policy；
2. `training_task_sequence_planning_v2` 保留为旧 UI、标签和 Learning 的兼容投影，不再作为阶段 2 权威规划来源；
3. `reading_open_response_load_gate_v1` 继续负责既有单题开放文本负担质量和历史题组兼容校验；
4. 新 `reading_task_group_progression_gate_v1` 只用于声明 Stage 2 Rule 的新题组；
5. 同一候选发布准备态只能选择一套权威题组 Gate，不允许新旧 Gate 分别给出互相矛盾的用户提示；
6. 历史 Plan、Candidate、Frozen Resource 和 Learning 数据不因缺少阶段 2 字段失效；
7. 阶段 2 新 Plan 必须完整，不能降级为“缺字段但继续发布”。

## 四、阶段 2 中间规划对象

为了让 Prompt 真正消费计划，而不是在生成完整题目后反推计划，阶段 2 在现有 Draft Generator 内增加一个非业务聚合的短生命周期对象：

```ts
type ReadingTaskPlanningSeed = {
  planningTaskKey: string;
  observationDimension: ObservationDimension;
  observationObject: string;
  materialAnchor: MaterialAnchor;
  primaryAbilityId: PrimaryAbilityId;
  taskRole: 'training' | 'retest' | 'transfer';
  responseFormat: QuestionResponseFormat;
  loadIntent: {
    primaryAction: CanonicalReadingAction;
    supportingAction?: CanonicalReadingAction;
    responsibilities: ReadingResponsibility[];
    textResponseLoadProfile?: TextResponseLoadProfile;
  };
};
```

规则：

1. Seed 只表达“观察什么、在哪里观察、要求完成什么动作、预期承担什么负担”；
2. Seed 不包含最终 questionStem、options、Rubric、答案或学生提示；
3. Seed 不提前填写最终 `sequenceRole` 或 `observationThreadId`；二者必须由组级 Planner 在比较全部 Seed 后统一确定，避免“先生成 Task Semantics，再用它反推顺序”的循环；
4. Planner 输出每个 Seed 的最终 `TaskLoadSemantics` 及 Hash，随后由 PlanningCandidate、TrainingTask 和 QuestionCandidate 按阶段 1 规则继承；
5. `planningTaskKey` 在 Seed、PlanningCandidate、TrainingTask 和 Progression Plan 中保持稳定；
6. Seed 不写入正式 Repository，不构成新的 Material → Plan 主链节点；
7. 未通过材料支持和去重检查的 Seed 不进入题组 Planner；
8. Prompt 不能新增未在 Seed 中声明的任务。

如果工程评估确认现有 `MaterialObservationPlanningCandidate` 可以在不生成题面时安全复用，则允许将 Seed 实现为内部投影，但不得让完整题面反向决定权威负担语义。

Planner 的原子输出为：

```ts
type TaskGroupProgressionPlanningResult = {
  plannedTasks: Array<{
    planningTaskKey: string;
    taskLoadSemantics: TaskLoadSemantics;
    taskLoadSemanticsHash: string;
  }>;
  progressionPlan: TaskGroupProgressionPlan;
};
```

`TaskLoadSemantics` 与 Progression Plan 必须在同一次确定性规划中形成并共同计算身份；不允许先持久化其中一半。

## 五、TaskGroupProgressionPlan 正式 Schema

### 5.1 题组计划

```ts
type TaskGroupProgressionPlan = {
  schemaVersion: 'task_group_progression_plan_v1';
  policyVersion: 'reading_training_progressive_load_policy_v2';
  stageRuleVersion: 'reading-training-progressive-load-stage2-v1';

  materialVersionId: string;
  observationPlanRevisionId: string;
  strategy: 'entry_first' | 'holistic_first' | 'role_driven';
  reasonCode:
    | 'default_foundation_entry'
    | 'holistic_judgment_required'
    | 'independent_expression_baseline'
    | 'retest_after_training'
    | 'transfer_in_new_context'
    | 'no_qualified_foundation_task';

  orderedTasks: Array<{
    planningTaskKey: string;
    taskLoadSemanticsHash: string;
    sequenceRank: number;
  }>;

  accessibleEntryTaskKeys: string[];
  protectedHigherOrderTaskKeys: string[];
  transitions: TaskGroupProgressionTransition[];
  exceptionReason?: string;

  planHash: string;
  derivationSource: 'planned' | 'legacy_projection';
};
```

### 5.2 相邻过渡

```ts
type TaskGroupProgressionTransition = {
  transitionId: string;
  fromPlanningTaskKey: string;
  toPlanningTaskKey: string;
  threadRelation: 'same_thread' | 'cross_thread';
  transitionKind:
    | 'progressive'
    | 'bridge'
    | 'legitimate_skip'
    | 'cross_thread'
    | 'independent_validation';
  addedResponsibilities: ReadingResponsibility[];
  retainedResponsibilities: ReadingResponsibility[];
  loadDirection: 'same' | 'increase' | 'decrease' | 'independent';
  rationaleCode:
    | 'adjacent_responsibility_growth'
    | 'foundation_already_observed'
    | 'material_does_not_support_bridge'
    | 'holistic_judgment_before_local_cue'
    | 'preserve_independent_expression_baseline'
    | 'switch_observation_thread'
    | 'retest_after_training'
    | 'transfer_in_new_context';
  rationale: string;
};
```

### 5.3 Schema 不变量

1. `orderedTasks` 中 Task Key 唯一，`sequenceRank` 从 1 连续递增；
2. `transitions.length = max(orderedTasks.length - 1, 0)`；
3. 每个 Transition 必须连接严格相邻的两个 Task；
4. Task Hash 必须等于阶段 1 规范化 Hash；
5. `same_thread` 必须具有相同 `observationThreadId`；
6. `cross_thread` 不得使用 `progressive` 冒充同线递进；
7. `addedResponsibilities` 由相邻 Task 原生语义确定，不由 LLM 自由填写；
8. `legitimate_skip` 必须具有非空 `exceptionReason` 或结构化 rationale；
9. `entry_first` 不要求必须存在单选，但首项不能是无理由的 `integration`；
10. `holistic_first` 只能搭配整体判断或独立表达基线原因；
11. `role_driven` 只能搭配 Retest / Transfer，且不得伪装成初次训练入口；
12. 单任务组和 Targeted Excerpt 可以没有 Transition；
13. `planHash` 不包含时间戳、运行状态或提示文案。

### 5.4 业务对象挂载点

阶段 2 使用条件可选字段保持历史兼容：

```ts
type MaterialObservationDraftGeneratorResult = {
  progressionStageRuleVersion?: 'reading-training-progressive-load-stage2-v1';
  taskGroupProgressionPlan?: TaskGroupProgressionPlan;
};

type MaterialObservationPlanningCandidate = {
  planningTaskKey?: string;
  taskGroupProgressionPlanHash?: string;
};

type MaterialObservationPlan = {
  progressionStageRuleVersion?: 'reading-training-progressive-load-stage2-v1';
  taskGroupProgressionPlan?: TaskGroupProgressionPlan;
};

type ObservationTaskPlan = {
  planningTaskKey?: string;
  taskGroupProgressionPlanHash?: string;
};

type QuestionCandidate = {
  planningTaskKey?: string;
  taskGroupProgressionPlanHash?: string;
  taskGroupProgressionGateAssessment?: ReadingTaskGroupProgressionGateAssessment;
};
```

一旦根对象声明 Stage 2 Rule Version，上述对应字段由 Guard 转为必填。历史对象保持可选；不得通过创建日期、标题或字段“看起来完整”推断版本。

## 六、Planner 设计

### 6.1 输入

Planner 只读取：

- Material Version 与结构化段落；
- 已通过材料支持检查的 Task Planning Seeds；
- 每个 Seed 的结构化 `loadIntent`；
- 当前题组既有正式任务与不可替换的高阶观察；
- 生成意图：首次规划、补充、整组替代或单题优化；
- taskRole、Targeted Metadata 和 Retest / Transfer 依赖；
- 既有去重与 Observation Inventory。

Planner 不读取学生能力画像，不根据某个学生“预计做不好”降低题目负担。

### 6.2 决策顺序

Planner 必须按以下顺序决策：

```text
材料与训练目标支持
→ 观察对象和线程划分
→ 每项任务的主要动作与责任
→ 合法入口是否存在
→ 相邻任务增加了什么责任
→ 是否需要受控例外
→ 正式排序
→ 去重与高阶观察保护
```

不得从“需要五层梯度”或“需要两道单选”反推任务。

### 6.3 默认策略

`entry_first` 是常规 Training 默认策略：

- 优先把 1—2 个低负担基础理解任务置于较高负担文本任务之前；
- 入口可以是 `single_choice`，也可以是 `entry_short / focused_short`；
- 无高质量单选时不得为入口强行生成单选；
- 首个文本任务应尽早出现，不能把所有单选机械堆在文本任务之前；
- 已存在可用基础入口时，不为凑层级新增同义任务。

### 6.4 受控例外

允许两类非默认顺序：

1. `holistic_first`：当前训练目标要求学生先形成整体判断，或必须保留不受局部提示影响的首次独立表达；
2. `role_driven`：Retest / Transfer 服从训练之后的时间和角色依赖。

例外必须具备结构化 reasonCode、与任务角色一致，并进入 Gate 校验。自由文本理由只能补充说明，不能绕过结构化规则。

### 6.5 补充、替代和优化

- 补充生成只规划新 Candidate 与现有正式任务组成的“预计结果题组”，不重排已发布任务；
- 整组替代可以为新方案规划完整顺序，但只有采用后才形成新 Plan Revision；
- 单题优化必须保留该任务的 `planningTaskKey`、线程和组内位置；若确需改变主要动作或位置，应回到整组规划；
- 已发布高阶观察受保护，不能为了让梯度更整齐而删除；
- Candidate 被拒绝后，Planner 必须基于剩余集合重新计算计划和 Hash，不能保留悬空 Transition。

## 七、Prompt 接入规则

### 7.1 两步式生成边界

阶段 2 在同一 Draft Generator 内采用：

```text
Pass A：规划 Task Seeds 与 TaskGroupProgressionPlan
Pass B：按每个 Seed 和组内位置生成完整 Question Candidate
```

这是 Agent 内部两步实现，不增加用户步骤，不新建正式业务主链。

### 7.2 Prompt 权威输入

每个 Question Prompt 必须接收：

- 当前 Seed；
- 当前 `TaskLoadSemantics` 及 Hash；
- `TaskGroupProgressionPlan.planHash`；
- sequenceRank；
- 前后相邻 Transition 的结构化摘要；
- Material Anchor 与已有题去重上下文；
- responseFormat 对应的质量规则。

### 7.3 Prompt 禁止事项

Prompt 不得：

- 修改 observationThreadId、sequenceRole 或 primaryAction；
- 增加第二个以上支撑动作；
- 把 `focused_short` 扩写成 integrated；
- 为满足过渡理由增加题干隐性要求；
- 通过提高最低字数制造难度；
- 把内部 recommendedMin / recommendedMax 显示给学生；
- 将多证据整合或开放分析机械改成选择题；
- 自行调整组内顺序；
- 生成计划中不存在的新任务；
- 以“帮助形成梯度”为由重复观察对象、证据范围和评分目标。

### 7.4 输出回执

Candidate Generation Context 必须回显：

```ts
{
  trainingModelPolicyVersion: 'reading_training_progressive_load_policy_v2';
  trainingTaskLoadSemanticsHash: string;
  taskGroupProgressionPlanHash: string;
  planningTaskKey: string;
  sequenceRank: number;
}
```

缺失或与权威 Plan 不一致时，Candidate 进入隔离，不得标为 ready。

## 八、单题质量与题组质量的职责分离

### 8.1 单题层

继续由现有模块负责：

- 题干—Rubric 对齐；
- 材料依据是否充分；
- 单选干扰项质量；
- responseFormat 结构完整性；
- 开放文本复合动作和输入负担；
- 阶段 1 Task / Candidate 语义一致性。

### 8.2 题组层

新 Gate 只负责：

- Plan 身份和 Hash 是否仍为当前版本；
- Candidate 集合是否等于被评估的预计结果题组；
- Task 顺序是否与权威 Plan 一致；
- 相邻同线程任务是否存在无理由责任跳跃；
- 受控例外是否与策略、角色和内容一致；
- 是否重复观察同一对象、证据范围和评分目标；
- 高阶观察是否被不当挤压或丢失。

Gate 不以单选数量、题量或“缺少某个等级”作为阻断理由。

## 九、ReadingTaskGroupProgressionGateAssessment

```ts
type ReadingTaskGroupProgressionGateAssessment = {
  schemaVersion: 'reading_task_group_progression_gate_v1';
  policyVersion: 'reading_training_progressive_load_policy_v2';
  stageRuleVersion: 'reading-training-progressive-load-stage2-v1';
  materialVersionId: string;
  observationPlanRevisionId: string;
  progressionPlanHash: string;
  projectedGroupSnapshotHash: string;
  orderedSubjectIdentities: Array<{
    planningTaskKey: string;
    trainingTaskId?: string;
    subjectId: string;
    taskLoadSemanticsHash: string;
    contentHash: string;
    sequenceRank: number;
  }>;
  decision: 'pass' | 'pass_with_advisory' | 'blocked' | 'insufficient_input';
  blockerCodes: ReadingTaskGroupProgressionBlockerCode[];
  advisoryCodes: ReadingTaskGroupProgressionAdvisoryCode[];
  assessedAt: string;
};
```

### 9.1 Blocker

```ts
type ReadingTaskGroupProgressionBlockerCode =
  | 'progression_plan_missing_or_stale'
  | 'ordered_task_identity_mismatch'
  | 'task_semantics_hash_mismatch'
  | 'candidate_plan_context_mismatch'
  | 'unexplained_responsibility_jump'
  | 'invalid_strategy_exception'
  | 'duplicate_observation_value'
  | 'protected_higher_order_observation_missing';
```

### 9.2 Advisory

```ts
type ReadingTaskGroupProgressionAdvisoryCode =
  | 'accessible_entry_underfilled'
  | 'single_step_bridge_absent'
  | 'cross_thread_sequence_not_comparable'
  | 'load_direction_decreases'
  | 'higher_order_coverage_thin'
  | 'legacy_peer_context';
```

### 9.3 阻断精度

`unexplained_responsibility_jump` 只有同时满足以下条件才可阻断：

1. 两项任务属于同一观察线程；
2. 两项任务都有原生、当前且 Hash 一致的语义；
3. 后项一次增加多个核心责任，或从基础入口直接进入 integration；
4. 不存在合法 `holistic_first / role_driven / legitimate_skip` 理由；
5. 不是 Targeted Excerpt 的独立单任务；
6. 不是因为切换观察对象而产生的合法跨线程排序。

仅“没有 entry_short”“单选不足两道”或“没有出现全部等级”不得形成 blocker。

## 十、发布准备态与用户反馈

### 10.1 单一准备态

新 Candidate 的最终准备态必须聚合：

- 单题结构与质量；
- 阶段 1 TaskLoadSemantics Verification；
- 阶段 2 Group Progression Gate；
- 既有身份、Revision 和正式发布条件。

同一 Snapshot 下，页面不得先显示“可以发布”，点击后再因已知的同一题组梯度问题阻断。若题组或 Candidate 内容变化，应标为 stale 并先自动重算。

### 10.2 用户可见表达

- `pass`：显示“可以发布”；
- `pass_with_advisory`：仍可采用，必要时显示一条简洁质量提醒；
- `blocked`：在当前操作附近说明“当前方案的任务顺序或训练跨度需要重新生成”；
- `insufficient_input`：保持候选，不进入发布，自动重试规划或提示重新生成。

用户不需要理解 `TaskLoadSemanticsHash`、Transition 或内部错误码。

## 十一、历史资源与正式数据兼容

1. 历史 Frozen Resource、Registry、Link、Session、Attempt、Diagnosis 和 Evidence 均不写回；
2. 历史 Plan 没有 Progression Plan 时继续使用现有 sequence tags 和 `legacy_projection`；
3. 历史 Candidate 不因缺少 Stage 2 Rule Version 被新 Gate 阻断；
4. 新 Stage 2 Candidate 不能借历史兼容路径绕过新 Gate；
5. 确需治理历史题组时，只生成 successor Candidate / Plan Revision；
6. 阶段 2 可以随新正式版本冻结 Progression Metadata，但 Learning 在阶段 3 前仍只消费既有顺序投影；
7. 阶段 2 同步输出现有 `sequence-strategy / sequence-reason / sequence-rank / sequence-prelude` 兼容标签，确保旧 Learning 零回归；
8. 不允许通过重排 Registry 或活动版本来模拟 Stage 2 生效。

## 十二、Targeted、Revision、Retest / Transfer 边界

### 12.1 Targeted Micro-training

- 单个 Targeted Excerpt 不要求形成完整坡度；
- 它可持有独立单任务 Progression Plan，也可按规则标记 not_applicable；
- 不因缺少入口或高阶题形成 blocker；
- 仍必须避免与触发核心题使用相同证据和答案泄露。

### 12.2 Revision

- Revision 保留原 `planningTaskKey`、TaskLoadSemantics Hash 和组内位置；
- Revision 只比较同一题目的反馈后改进；
- Revision 不重新规划题组，也不能作为独立梯度层级；
- Revision 表现不替代阶段 3 的 Retest / Transfer 独立验证。

### 12.3 Retest / Transfer

- 使用 `role_driven`；
- 过渡为 `independent_validation`，不按普通难度升降判断；
- 可以引用原 observationThreadId，但保留独立材料、任务角色和 Evidence 身份；
- 阶段 2 只保证规划和生成合法，不改变 Learning 何时调度它们。

## 十三、工程工作包

### WP2.1 Schema 与稳定身份

- 新增 Planning Seed、TaskGroupProgressionPlan、Transition 和 Gate Schema；
- 实现 Guard、规范化、深复制和稳定 Hash；
- 为 Plan / Task / Candidate 增加条件可选字段；
- 阶段 Rule Version 声明后字段转为必填。

### WP2.2 两步式 Planner

- 从候选意图形成 Task Seeds；
- 划分 observationThread；
- 生成最终 TaskLoadSemantics、正式顺序和 Transition；
- 支持 entry_first、holistic_first、role_driven；
- 处理补充、整组替代、单题优化和 Candidate 减员重算。

### WP2.3 Prompt Realization

- Prompt 消费权威 Seed、Task Semantics Hash 和 Progression Plan Hash；
- 输出生成回执；
- 生成后执行阶段 1 Verification；
- 只修复内容实现，不允许 Prompt 修改计划。

### WP2.4 题组级 Gate

- 对预计结果题组计算 Snapshot；
- 校验身份、顺序、Transition、重复价值和高阶观察保护；
- 聚合单题与题组准备态；
- 防止“显示可发布、点击后因已知问题阻断”。

### WP2.5 Persistence 与兼容投影

- Plan Revision 持久化 Progression Plan；
- Candidate、Task 和正式资源保留 Plan Hash / planningTaskKey；
- 同步旧 sequence tags；
- Repository round-trip 保持深复制和稳定 Hash；
- 历史对象继续可读且不回填。

### WP2.6 工作台投影

- 不增加人工编辑步骤；
- 只显示方案级顺序结论、必要提醒和就近错误；
- blocked / stale / publishing 与操作按钮互斥；
- 不把内部负担等级展示为学生能力判断。

## 十四、Debug 验收矩阵 S2-01—S2-48

### 14.1 Schema、Guard 与 Hash

| 编号 | 验收项 |
| --- | --- |
| S2-01 | 合法 Task Planning Seed 通过 Guard |
| S2-02 | Seed 缺合法 loadIntent 或存在复合主要动作被拒绝 |
| S2-03 | 合法 TaskGroupProgressionPlan 通过 Guard |
| S2-04 | orderedTasks 重复或 rank 不连续被拒绝 |
| S2-05 | Transition 数量与相邻身份不一致被拒绝 |
| S2-06 | same_thread 实际线程不一致被拒绝 |
| S2-07 | cross_thread 不得声明 progressive |
| S2-08 | 不同输入顺序规范化后 Plan Hash 稳定 |
| S2-09 | Task Semantics Hash 或顺序变化会改变 Plan Hash |
| S2-10 | 时间戳、提示文案和运行状态不进入 Plan Hash |

### 14.2 Planner

| 编号 | 验收项 |
| --- | --- |
| S2-11 | 常规题组优先形成可进入的低负担开端 |
| S2-12 | 无高质量单选时允许文本入口且不机械补题 |
| S2-13 | 不要求 entry_short 或全部负担等级出现 |
| S2-14 | 同线程相邻任务正确计算新增责任 |
| S2-15 | 跨线程任务标为 cross_thread 且不可比较 |
| S2-16 | holistic_first 仅接受两个受控原因 |
| S2-17 | role_driven 仅用于 Retest / Transfer |
| S2-18 | Targeted 单任务不强建完整梯度 |
| S2-19 | 补充生成不重排既有已发布任务 |
| S2-20 | Candidate 被移除后重算顺序、Transition 和 Hash |

### 14.3 Prompt 与 Candidate 实现

| 编号 | 验收项 |
| --- | --- |
| S2-21 | Prompt 收到 Seed、Task Hash、Plan Hash 和 rank |
| S2-22 | Prompt 不自行改变 primaryAction / sequenceRole |
| S2-23 | Prompt 不把低负担任务扩成复合高负担题 |
| S2-24 | Prompt 不以最低字数制造负担 |
| S2-25 | Candidate 回显 planningTaskKey 与两个 Hash |
| S2-26 | Candidate 缺 Plan 回执不能进入 ready |
| S2-27 | Candidate Plan Hash 不一致形成隔离 |
| S2-28 | 阶段 1 Verification mismatch 继续阻断 |
| S2-29 | regenerate / optimize 保持组内位置和 Plan 身份 |
| S2-30 | 需要改变动作或位置时必须回到整组规划 |

### 14.4 Group Gate 与准备态

| 编号 | 验收项 |
| --- | --- |
| S2-31 | 合法渐进题组 Gate pass |
| S2-32 | 缺少某个负担等级不形成 blocker |
| S2-33 | 单选不足推荐数量不形成 blocker |
| S2-34 | 同线程基础入口直达 integration 且无理由时 blocked |
| S2-35 | 合法 legitimate_skip 不被误阻断 |
| S2-36 | 跨线程切换只形成不可比较提醒 |
| S2-37 | 重复观察对象、证据范围和评分目标时 blocked |
| S2-38 | 受保护高阶观察丢失时 blocked |
| S2-39 | Snapshot 变化后旧 Assessment 变 stale |
| S2-40 | 同一 Snapshot 不出现 ready 后再被同一已知问题阻断 |

### 14.5 兼容、不可变与跨阶段边界

| 编号 | 验收项 |
| --- | --- |
| S2-41 | 历史 Plan / Candidate 无 Stage 2 字段仍可读 |
| S2-42 | 历史 Frozen / Registry / Link 零写入 |
| S2-43 | 新正式版本同步旧 sequence tags 保持 Learning 兼容 |
| S2-44 | Learning 顺序、Session、Attempt 未消费新 Plan |
| S2-45 | Diagnosis / Evidence / Student Profile 未读取负担层级 |
| S2-46 | Single Choice、Open Response、Revision、Targeted、Retest / Transfer 回归通过 |
| S2-47 | Material → Publish → Learning 旧主链与生产构建通过 |
| S2-48 | 旧主链零回归清单和阶段 2 边界清单完整归档 |

## 十五、真实浏览器验收边界

工程 Debug 通过后至少验证：

1. 常规题组生成后，工作台顺序符合 Progression Plan；
2. 合法 holistic_first 不被 UI 自动改回单选优先；
3. 补充 Candidate 不重排已发布题；
4. 重新生成后 Plan 与 Candidate 一起更新，不保留旧 Transition；
5. 题组 blocked 时错误出现在当前操作附近；
6. stale 时不同时显示“正在发布”和“采用并发布”；
7. pass_with_advisory 不制造新的人工审核步骤；
8. 发布后的 Learning 继续按既有兼容顺序正常消费；
9. 历史材料和历史 Session 可继续恢复；
10. 页面不显示工程验证面板或内部错误码。

浏览器验收使用隔离数据或可恢复测试方案，不得为了验证 Gate 写入或覆盖用户现有 Frozen Resource。

## 十六、风险与控制

| 风险 | 控制 |
| --- | --- |
| 两步式生成增加调用量和失败面 | Seed / Plan 幂等缓存；Pass B 可按失败 Candidate 局部重试 |
| 新旧顺序机制产生双重权威 | Progression Plan 为新对象权威；旧 sequence planning 只做兼容投影 |
| Gate 误把软目标变成配额 | Blocker 不包含题型数量或缺层级；加入负向测试 |
| 跨线程顺序被错误用于能力归因 | Transition 明确 threadRelation；阶段 2 禁止 Diagnosis 消费 |
| 补充生成重排正式题 | 预计结果题组锁定现有 rank，新 Candidate 只追加或进入明确空位 |
| Candidate 页面先 ready 后阻断 | 准备态绑定 Candidate + Plan + Group Snapshot 三重 Hash |
| 历史正式资源被新 Gate 拦截 | Stage Rule 条件启用；历史对象继续走兼容路径 |
| Prompt 反向改变计划 | Generation Receipt + Stage 1 Verification + Group Gate 三层校验 |

## 十七、完成定义

阶段 2 只有同时满足以下条件才算完成：

1. Planning Seed、TaskGroupProgressionPlan、Transition、Group Gate Schema 和稳定 Hash 已实现；
2. Planner 能形成有理由的题组顺序，但不机械补齐等级或题型；
3. Prompt 消费权威计划并回显身份，不能自行改变梯度；
4. 单题 Verification 和题组 Gate 职责分离且最终准备态唯一；
5. 新 Plan / Candidate / Formal Metadata 可持久化并保持 Repository round-trip；
6. 历史对象继续兼容，Frozen / Registry / Link 不被批量修改；
7. `S2-01—S2-48` 全部通过；
8. 真实浏览器边界验收通过；
9. 旧主链零回归清单与阶段 2 边界清单完整；
10. 执行报告明确“题组规划与发布前 Gate 已完成，但 Learning、Diagnosis、Evidence 尚未消费新语义”。

## 十八、进入阶段 3 的门槛

只有阶段 2 完成后，阶段 3 才可以：

- 在 Frozen Resource / Learning Projection 中读取权威 Progression Metadata；
- 让 Learning 按正式 Progression Plan 恢复和推进题组；
- 记录学生在哪个同线程负担层级开始失稳；
- 将题目负担过高与学生能力不足分开解释；
- 让 Diagnosis / Evidence 在严格身份和相邻层级条件下消费表现差异。

即使进入阶段 3，也不得把一次高负担题失败直接写成长期能力结论；Revision、Targeted、Retest 和 Transfer 的证据身份仍必须隔离。

## 十九、实施与验收结果

阶段 2 已于 2026-08-24 完成工程落地：

1. 真实生成边界启用 `Seed → Plan → Realization` 两步式生成；Pass A 不生成题面，Pass B 必须回显 `planningTaskKey / taskLoadSemanticsHash / taskGroupProgressionPlanHash / sequenceRank`；
2. Planner、稳定 Hash、Transition、Candidate Verification、题组 Gate、工作台持久化与兼容顺序投影均已接通；
3. 缺回执、错序、Seed 漂移、计划上下文不一致和无理由同线程跨级均停留在候选层，不写入正式资源；
4. 阶段 2 专项 `S2-01—S2-48` 为 `48 / 48 PASS`，Draft Generator（含真实两步式脚本联调）为 `45 / 45 PASS`；
5. 旧 Material → Plan → Task → Candidate → Adopt → Revision → Publish → Learning 主链保持兼容；Learning、Diagnosis、Evidence、Student Profile 和历史 Frozen Resource 未提前消费阶段 2 新语义；
6. 工程验收记录见：
   [`reading_training_progressive_load_stage2_engineering_debug_acceptance_2026-08-24.md`](../education/phase/reports/reading_training_progressive_load_stage2_engineering_debug_acceptance_2026-08-24.md)。
