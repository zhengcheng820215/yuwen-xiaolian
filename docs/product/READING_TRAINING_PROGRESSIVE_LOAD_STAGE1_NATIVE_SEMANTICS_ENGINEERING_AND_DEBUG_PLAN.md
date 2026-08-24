# 阅读训练递进负担模型阶段 1：原生负担语义工程实施与 Debug 验收计划

英文名称：Reading Training Progressive Load Stage 1 Native Semantics Engineering and Debug Plan

状态：`IMPLEMENTED / DEBUG ACCEPTED`

上位契约：`reading_training_progressive_load_policy_v2`

阶段版本：`reading_training_progressive_load_stage1_v1`

更新日期：2026-08-21

工程验收报告：
[`reading_training_progressive_load_stage1_engineering_debug_acceptance_2026-08-21.md`](../education/phase/reports/reading_training_progressive_load_stage1_engineering_debug_acceptance_2026-08-21.md)

## 一、阶段目标

阶段 1 将阶段 0 的历史 `legacy_projection` 升级为新规划链中的原生、版本化负担语义，使以下三层表达同一训练意图：

```text
MaterialObservationPlanningCandidate
→ ObservationTaskPlan（当前工程中的 TrainingTask）
→ QuestionCandidate
```

阶段 1 解决的是“语义从哪里产生、由谁拥有、如何继承、如何判断漂移”。它不负责：

- 重新设计完整题组顺序；
- 调整 Prompt 生成策略；
- 启用题组级发布门禁；
- 修改 Learning 调度或学生界面；
- 形成新的 Diagnosis、Evidence 或 Student Ability Profile 结论；
- 回填或覆盖历史 Frozen Resource。

阶段 1 完成后只能声明“新 Planning / Candidate 已具备原生负担语义”，不能声明新的递进训练策略已经在 Learning 生效。

### 1.1 贯穿性双重验收

阶段 1 必须执行上位契约的共同验收原则：**每个阶段都必须证明旧主链零回归，并且新语义只在该阶段允许的边界内生效。**

因此，阶段 1 不能只证明 `TaskLoadSemantics` 可以生成，还必须同时证明：

1. 旧 Material → Plan → Task → Candidate → Adopt → Revision → Publish → Learning 主链及单选、开放文本、Revision、Targeted、Retest / Transfer 关键回归保持通过；
2. 新语义只在新 PlanningCandidate、TrainingTask、QuestionCandidate 和 Verification 内产生、继承与校验；
3. 它尚未改变题组规划策略、Prompt 内容、正式 Admission Gate、Learning 排序、Diagnosis、Evidence、Student Ability Profile 或历史 Frozen Resource；
4. 旧主链回归结果、授权生效面、禁止生效面与关键集合前后摘要进入阶段 1 执行报告。

## 二、不变的主链和人工边界

阶段 1 不重建：

`Material → Observation Plan → TrainingTask → QuestionCandidate → Adopt → Revision → Publish → Learning`

同时保持：

1. 人只负责“采用并发布 / 不采用并重新优化”；
2. 负担语义由系统规划和校验，不增加字段级人工编辑；
3. 未采用 Candidate 不进入正式资源；
4. Frozen Resource、Registry 和历史 Session 不原地修改；
5. 负担等级描述任务，不进入学生能力画像；
6. 阶段 0 Finding 仍是只读治理依据，不转成新的人工审核步骤。

## 三、正式 Schema

### 3.1 版本常量

```ts
const READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION =
  'reading_training_progressive_load_policy_v2';

const TASK_LOAD_SEMANTICS_SCHEMA_VERSION =
  'reading_task_load_semantics_v1';

const TASK_LOAD_SEMANTICS_VERIFICATION_VERSION =
  'reading_task_load_semantics_verification_v1';
```

### 3.2 TaskLoadSemantics

```ts
type CanonicalReadingAction = CanonicalTextResponseAction;

type ReadingResponsibility =
  | 'basic_understanding'
  | 'text_evidence'
  | 'relation_explanation'
  | 'inference_integration'
  | 'expression_organization';

type TaskLoadSemantics = {
  schemaVersion: 'reading_task_load_semantics_v1';
  policyVersion: 'reading_training_progressive_load_policy_v2';

  observationThreadId: string;
  sequenceRole:
    | 'foundation_entry'
    | 'bridge'
    | 'development'
    | 'integration'
    | 'independent_validation';

  primaryAction: CanonicalReadingAction;
  supportingAction?: CanonicalReadingAction;
  responsibilities: ReadingResponsibility[];

  textResponseLoadProfile?: TextResponseLoadProfile;

  derivationSource: 'planned' | 'recomputed' | 'legacy_projection';
  confidence: 'high' | 'medium' | 'low';
};
```

字段规则：

1. `observationThreadId` 是比较相邻负担表现的稳定线程身份。新规划任务必填；历史投影无法可靠确定时不得伪造。
2. `primaryAction` 必须且只能有一个；`supportingAction` 最多一个，并且必须服务于主要动作。
3. `responsibilities` 去重并按统一顺序保存，不得把题面中的每个动词机械转换为责任。
4. `textResponseLoadProfile` 只用于 `short_text / long_text`；`single_choice` 必须省略该字段。
5. `sequenceRole = independent_validation` 只用于 Retest / Transfer 等独立验证角色，不表示难度最高。
6. `derivationSource = planned` 表示来自新规划；`legacy_projection` 只能用于历史兼容；`recomputed` 只用于校验结果，不得静默覆盖规划值。
7. `confidence` 描述语义来源可信度，不描述题目质量或学生能力。

第一版 `CanonicalReadingAction` 直接复用已经冻结的 `CanonicalTextResponseAction` 枚举；命名上的上位别名只表达它同时适用于单选和文本任务，不创建第二套动作代码。`ReadingResponsibility` 同样是唯一责任枚举，规划、校验与审计必须共同引用，不能复制出名称相近但取值不同的局部类型。

### 3.3 Observation Thread 身份

`observationThreadId` 必须满足：

- 同一训练目标的基础辨认、证据定位、关系解释和综合任务可以共享一个线程；
- 不同人物、不同证据对象或不同评分目标不得为了形成梯度强行放入同一线程；
- successor TrainingTask 沿用其被替代任务的线程身份；
- Retest / Transfer 在验证同一能力动作时引用原线程身份，同时由 `taskRole` 保持证据隔离；
- Targeted Micro-training 引用触发 Gap 对应的线程；无法确定时创建独立线程，不冒充核心题组的相邻层级。

线程 ID 不是 Ability ID。一个 Ability 可以存在多个观察线程，一个题组也可以合法包含多个线程。

### 3.4 根对象兼容策略

阶段 1 采用“版本化子对象 + 根对象可选扩展”的兼容方式：

- `MaterialObservationPlan.trainingModelPolicyVersion` 是新 Plan 的条件必填判别器；
- `ObservationTaskPlan.taskLoadSemantics`、`MaterialObservationPlanningCandidate.taskLoadSemantics` 和 `QuestionCandidate.taskLoadSemantics` 在 TypeScript / Persistence 结构上保持可选；
- 一旦上游对象声明 v2 Policy，对应子对象即由 Guard 变为必填；
- 历史根对象仍按原 Schema Version 读取，不因新增可选字段执行整库迁移；
- `TaskLoadSemantics.schemaVersion` 独立承担新增语义的版本演进。

阶段 1 不通过修改日期、ID 前缀或数据是否“看起来完整”来猜测新旧对象。

## 四、三层语义所有权

### 4.1 MaterialObservationPlanningCandidate：提出语义

新增可选字段：

```ts
taskLoadSemantics?: TaskLoadSemantics;
```

当 `MaterialObservationDraftGeneratorResult` 声明 `trainingModelPolicyVersion = reading_training_progressive_load_policy_v2` 时，该结果中的可采用 Candidate 必须具备该字段。

PlanningCandidate 负责提出：

- 观察线程；
- 主要与支撑动作；
- 作答形式对应的共同责任；
- 文本题负担画像；
- 当前任务在题组中的角色。

现阶段仍可由现有 `textResponseLoadPlanning.intent / trace` 兼容映射，但映射结果必须通过统一 Schema Guard，且不能反向修改旧字段。

### 4.2 ObservationTaskPlan / TrainingTask：权威来源

分别新增字段：

```ts
type MaterialObservationPlan = {
  trainingModelPolicyVersion?: 'reading_training_progressive_load_policy_v2';
};

type ObservationTaskPlan = {
  taskLoadSemantics?: TaskLoadSemantics;
};
```

规则：

1. 新 Plan 采用 PlanningCandidate 后，完整复制 `TaskLoadSemantics`；
2. `trainingModelPolicyVersion = v2` 的 Plan，其所有未取消任务必须具备原生语义；
3. Task 成为 QuestionCandidate 的负担语义唯一权威来源；
4. 单题重新生成、优化和异常纠错不得修改 TrainingTask 的负担语义；
5. 若需要改变主要动作、观察线程或序列角色，必须回到任务规划形成新的 Plan / Task Revision；
6. 不得使用 QuestionCandidate 反向覆盖 ObservationTaskPlan。

为了兼容历史 Plan，字段在存储结构上保持可选；必填性由 `trainingModelPolicyVersion` 判定，不能用创建日期或标题推断。

### 4.3 QuestionCandidate：继承语义

新增字段：

```ts
taskLoadSemantics?: TaskLoadSemantics;
taskLoadSemanticsHash?: string;
taskLoadSemanticsVerification?: TaskLoadSemanticsVerification;
```

并在 `CandidateGenerationContext` 增加：

```ts
trainingModelPolicyVersion?: 'reading_training_progressive_load_policy_v2';
trainingTaskLoadSemanticsHash?: string;
```

规则：

1. v2 Candidate 必须完整复制 TrainingTask 语义；
2. `taskLoadSemanticsHash` 使用规范化结构计算，只覆盖稳定教学语义和来源身份，不包含 `confidence`、Verification、时间戳或运行状态；
3. Candidate 生成、重新生成、优化后，语义 Hash 必须继续等于 TrainingTask Hash；
4. Question 内容可以被重新生成，但不得自行改变线程、主要动作或序列角色；
5. Candidate Analyzer 只输出 Verification，不得以重算结果静默替换规划语义；
6. 历史 TrainingTask 生成 Candidate 时可携带 `legacy_projection`，但不得标记为 `planned`。

## 五、语义验证对象

```ts
type RecomputedTaskLoadContentProjection = {
  primaryAction: CanonicalReadingAction;
  supportingAction?: CanonicalReadingAction;
  responsibilities: ReadingResponsibility[];
  textResponseLoadProfile?: TextResponseLoadProfile;
  confidence: 'high' | 'medium' | 'low';
};

type TaskLoadSemanticsVerification = {
  schemaVersion: 'reading_task_load_semantics_verification_v1';
  policyVersion: 'reading_training_progressive_load_policy_v2';
  trainingTaskId: string;
  candidateId?: string;
  plannedSemanticsHash: string;
  recomputedContentProjection?: RecomputedTaskLoadContentProjection;
  status: 'matched' | 'advisory' | 'mismatched' | 'insufficient_input';
  findings: Array<{
    code:
      | 'semantics_missing'
      | 'semantics_hash_mismatch'
      | 'response_format_incompatible'
      | 'primary_action_drift'
      | 'supporting_action_overflow'
      | 'text_load_exceeds_plan'
      | 'observation_thread_mismatch'
      | 'legacy_projection_only';
    severity: 'info' | 'warning' | 'error';
    evidencePaths: string[];
    explanation: string;
  }>;
};
```

内容 Analyzer 只能重算题面能够证明的动作、责任和文本负担，不能重算或创造 `observationThreadId`、`sequenceRole` 与 `derivationSource`。这些规划身份通过 Task / Candidate Hash 一致性验证。

阶段 1 的处理边界：

- `matched`：允许进入现有 Candidate 流程；
- `advisory`：记录偏差，沿用现有质量机制，不增加人工步骤；
- `mismatched`：v2 新 Candidate 不得标记 ready，应在生成层隔离或重新生成；
- `insufficient_input`：历史对象保守降级，不把缺字段误判成学生或题目能力问题。

阶段 1 不启用新的题组级发布阻断。正式 Admission Gate 和题组梯度门禁属于阶段 2。

## 六、作答形式映射

### 6.1 Single Choice

单选仍是完整 `QuestionCandidate.responseFormat`，不是嵌入文本题的小题。

- 常规基础辨认：通常为 `foundation_entry`；
- 承担局部辨析且已具有前置理解：可为 `bridge`；
- Retest / Transfer：为 `independent_validation`；
- 不设置 `textResponseLoadProfile`；
- 干扰项质量、正确答案身份和 Diagnosis 继续遵循单选专项契约；
- 不因“需要入口”而强行生成没有高质量干扰项的单选。

### 6.2 Short / Long Text

文本题继续复用 `TextResponseLoadProfile v1.1`：

| Text Load | 默认 Sequence Role |
| --- | --- |
| `entry_short` | `foundation_entry` |
| `focused_short` | `bridge` |
| `developing` | `development` |
| `integrated` | `integration` |

这是默认映射，不是永久一一绑定。若 Task Role 或正式规划理由要求不同序列角色，必须记录结构化理由；不能只改显示顺序标签。

## 七、与现有对象的兼容映射

### 7.1 现有 textResponseLoadPlanning

阶段 1 保留：

- `MaterialObservationPlanningCandidate.textResponseLoadPlanning`
- `QuestionCandidate.textResponseLoadPlanning`
- `ReadingOpenResponseLoadGateAssessment`

它们继续承担开放文本题生成意图、生成轨迹和既有负担检查。`TaskLoadSemantics` 是跨作答形式、跨 TrainingTask / Candidate 的上位语义，不删除这些对象。

兼容方向固定为：

```text
现有 textResponseLoadPlanning
→ 构建或校验 TaskLoadSemantics.textResponseLoadProfile
→ 不允许 TaskLoadSemantics 反向篡改历史生成轨迹
```

### 7.2 阶段 0 legacy_projection

- 历史 Plan、Task、Candidate 和 Frozen Resource 保持原样；
- 读取时可以调用阶段 0 投影器；
- 兼容投影不持久化到旧对象；
- 新 Plan 不得使用 `legacy_projection` 逃避原生必填规则；
- 由历史 Task 发起 successor Candidate 时，Candidate 明确保留 `legacy_projection` 来源，直到上游 Task 被正式重新规划。

## 八、哈希、复制和不可变性

### 8.1 规范化 Hash

`TaskLoadSemanticsHash` 至少覆盖：

- Schema / Policy Version；
- observationThreadId；
- sequenceRole；
- primaryAction / supportingAction；
- responsibilities；
- textResponseLoadProfile；
- derivationSource。

数组先去重并按契约顺序规范化；对象键稳定排序；不得包含 `confidence`、时间戳、Candidate ID、运行状态或 Verification。

### 8.2 复制规则

- 从 PlanningCandidate 到 TrainingTask：深复制；
- 从 TrainingTask 到 QuestionCandidate：深复制；
- Repository 读写：深复制；
- 返回给 UI：只读投影或深复制；
- 任一层修改对象引用不得影响上游或同批其他 Candidate。

## 九、失败、降级与恢复

| 场景 | 处理 |
| --- | --- |
| 新 v2 PlanningCandidate 缺语义 | 隔离该候选并记录结构错误，不写 Plan |
| v2 Plan 有未取消任务缺语义 | Plan Validation 失败，不进入采用 |
| Candidate 与 Task Hash 不同 | Candidate 不进入 ready，允许系统重新生成 |
| Candidate 内容负担高于规划 | 记录 mismatch，由生成层重试；不修改 Task |
| 历史 Task 无原生语义 | 使用只读 legacy projection，保守标注来源 |
| 历史字段不足 | `insufficient_input`，不抛出破坏性迁移错误 |
| Repository 读取旧 Candidate | 保持旧对象可读，不补写字段 |
| 重试或幂等恢复 | 相同命令必须得到相同语义 Hash，不重复创建语义身份 |

错误不得以页面顶部隐藏提示的方式新增人工处理流程。若未来投射到工作台，必须沿用现有 Candidate 卡片内错误与近场反馈规则。

## 十、工程工作包

### WP1：Schema 与 Guard

- 新建 `readingTaskLoadSemantics.schema.ts`；
- 定义 Schema、常量、Guard、规范化与 Hash；
- 复用阶段 0 枚举，避免第二套定义；
- 为 PlanningCandidate、ObservationTaskPlan、QuestionCandidate 增加兼容字段。

### WP2：PlanningCandidate → TrainingTask

- 从现有规划结果构建原生语义；
- 新 Plan 写入 `trainingModelPolicyVersion`；
- 采用时深复制语义；
- Plan Validation 执行 v2 条件必填检查；
- 单选和文本题均覆盖。

### WP3：TrainingTask → QuestionCandidate

- Candidate Context 携带 Policy Version 与 Task Hash；
- 生成、重新生成、优化、异常纠错继承相同语义；
- Repository Clone / Persistence 保留字段；
- 历史 Candidate 继续兼容读取。

### WP4：Verification 与写入隔离

- 使用现有 Analyzer 重算候选内容负担；
- 输出 Verification，不覆盖 Task 语义；
- 新 v2 mismatch 候选不进入 ready；
- 旧对象保守降级；
- 验证审计不修改 Frozen、Registry、Learning 或 Evidence。

### WP5：Debug、回归和执行报告

- 执行专项矩阵；
- 回归单选、开放文本、Candidate、任务规划和发布主链；
- 执行生产构建；
- 记录真实新规划样本，不对历史 81 道题执行写回。

## 十一、Debug 验收矩阵

### 11.1 Schema 与所有权

| 编号 | 验收项 |
| --- | --- |
| S1-01 | 原生 TaskLoadSemantics 通过 Guard |
| S1-02 | 未知 Policy / Schema Version 被拒绝 |
| S1-03 | 非法 Sequence Role / Responsibility 被拒绝 |
| S1-04 | 缺少 observationThreadId 的 planned 语义被拒绝 |
| S1-05 | 数组形式或多个 supportingAction / primaryAction 被 Guard 拒绝 |
| S1-06 | 单选携带 textResponseLoadProfile 被拒绝 |
| S1-07 | 文本题负担画像继续符合 v1.1 Guard |
| S1-08 | Hash 对等价规范化输入稳定 |
| S1-09 | 核心字段变化必然改变 Hash |
| S1-10 | Verification 不参与语义 Hash |

### 11.2 PlanningCandidate 与 TrainingTask

| 编号 | 验收项 |
| --- | --- |
| S1-11 | 新文本 PlanningCandidate 生成 planned 语义 |
| S1-12 | 新单选 PlanningCandidate 生成共同语义且无文本画像 |
| S1-13 | PlanningCandidate 采用后 TrainingTask 深复制语义 |
| S1-14 | 修改 Candidate 引用不影响 TrainingTask |
| S1-15 | v2 Plan 任一活动任务缺语义即 Validation 失败 |
| S1-16 | cancelled Task 不触发 v2 必填失败 |
| S1-17 | 历史 Plan 无 Policy Version 仍可读取 |
| S1-18 | successor Task 保留 observationThreadId |
| S1-19 | 不同观察目标不能共享错误线程身份 |
| S1-20 | Targeted Task 引用 Gap 线程或创建独立线程 |

### 11.3 QuestionCandidate 继承与 Verification

| 编号 | 验收项 |
| --- | --- |
| S1-21 | 新 Candidate 的语义与 Task Hash 一致 |
| S1-22 | regenerate 保留语义和线程身份 |
| S1-23 | optimize 保留语义和线程身份 |
| S1-24 | exception correction 不得修改语义 |
| S1-25 | responseFormat 不兼容形成 mismatch |
| S1-26 | primaryAction 漂移形成 mismatch |
| S1-27 | 文本实际负担高于规划形成 mismatch |
| S1-28 | 允许的轻微估计差异形成 advisory 而非静默覆盖 |
| S1-29 | 历史 Task 生成 Candidate 明确标为 legacy_projection |
| S1-30 | Repository round-trip 保留语义且不共享引用 |

### 11.4 不可变性、幂等与回归

| 编号 | 验收项 |
| --- | --- |
| S1-31 | 相同生成命令得到相同语义 Hash |
| S1-32 | 命令重试不创建新的 observationThreadId |
| S1-33 | 阶段 1 不修改历史 Frozen / Registry / Link |
| S1-34 | 阶段 1 不修改 Learning Session / Attempt |
| S1-35 | 阶段 1 不修改 Diagnosis / Evidence / Student Profile |
| S1-36 | 阶段 0 24/24 回归继续通过 |
| S1-37 | 开放文本负担阶段 1—4 回归通过 |
| S1-38 | 单选阶段 1—4 回归通过 |
| S1-39 | Candidate Workflow 与 Task Planning 回归通过 |
| S1-40 | 生产构建通过 |

### 11.5 跨阶段双证据门

`S1-01—S1-40` 全部通过后，仍必须形成以下两份可复核证据，阶段 1 才能完成：

| 证据 | 最低内容 |
| --- | --- |
| 旧主链零回归清单 | 回归命令、用例数量、结果、失败处置，以及 Material → Learning 关键路径结论 |
| 阶段 1 边界清单 | 允许生效的对象与字段、禁止生效的下游模块、关键 Store / Frozen / Learning 摘要前后比较 |

专项测试通过但缺少任一清单时，状态只能是 `IMPLEMENTED / ACCEPTANCE INCOMPLETE`，不得进入阶段 2。

## 十二、完成定义

阶段 1 只有同时满足以下条件才算完成：

1. `TaskLoadSemantics`、Verification、Guard、规范化和 Hash 已实现；
2. 新 PlanningCandidate、TrainingTask、QuestionCandidate 三层语义同源；
3. v2 新对象缺字段或语义漂移会在生成 / 规划层隔离；
4. 历史对象继续可读，未发生批量迁移或写回；
5. S1-01—S1-40 全部通过；
6. 阶段 0、开放文本、单选、Candidate 和构建回归通过；
7. 执行报告明确“原生语义已完成，但题组 Planner / Prompt / Gate / Learning 尚未启用”。
8. 旧主链零回归清单与阶段 1 边界清单均已完成且无未解释差异。

## 十三、进入阶段 2 的门槛

只有阶段 1 完成后，阶段 2 才可以：

- 让 Planner 规划 `TaskGroupProgressionPlan`；
- 让 Prompt 消费原生负担语义；
- 判断相邻任务增加了哪些责任；
- 增加题组级无理由跳跃 Gate；
- 将正式顺序理由传递至后续发布对象。

阶段 2 仍不得直接把负担层级写入学生能力画像；Learning、Diagnosis 与 Evidence 消费属于阶段 3。

## 十四、实施结果

阶段 1 已于 2026-08-21 完成工程开发与 Debug 验收：

- `TaskLoadSemantics`、规范化、稳定 Hash、Guard 与 Verification 已实现；
- PlanningCandidate → TrainingTask → QuestionCandidate 已保持同源语义并采用深复制；
- regenerate、optimize、exception correction 与 Repository round-trip 不改变任务线程身份；
- 历史 Task 继续通过 `legacy_projection` 兼容，不回填 Frozen Resource；
- `S1-01—S1-40` 为 `40 / 40 PASS`；
- 统一资源生产 P0–P7 为 `26 / 26 SUITES PASS`，正式 Learning 入口为 `17 / 17 PASS`，Production Build PASS；
- 旧主链零回归清单与阶段边界清单已归档至工程验收报告。

本阶段没有启用阶段 2 的题组 Planner、Question Prompt、题组级 Admission Gate，也没有让 Learning、Diagnosis、Evidence 或 Student Profile 消费新语义。
