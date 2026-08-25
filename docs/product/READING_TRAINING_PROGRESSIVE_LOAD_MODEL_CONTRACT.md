# 阅读训练递进负担模型契约

英文名称：Reading Training Progressive Load Model Contract

状态：`V2 ACTIVE / STAGE 0-4 ENGINEERING COMPLETE / STAGE 4 DEBUG ACCEPTED / FULL BROWSER ACCEPTED / REAL CALIBRATION NOT STARTED`

契约版本：`reading_training_progressive_load_policy_v2`

更新日期：2026-08-24

## 一、系统级原则

阅读训练默认从低负担理解进入，逐步增加证据、关系、推理和表达责任；系统通过学生在不同负担层级中的表现差异识别薄弱点，而不是先给予高负荷任务，再从失败结果反推学生能力不足。

该原则是 Training Model 的兼容式核心升级，不只是 Prompt 或题目措辞优化。它不改变：

- `Material → Observation Plan → TrainingTask → QuestionCandidate → Adopt → Revision → Publish → Learning` 主链；
- Frozen Resource、Registry、Learning Session 与 Evidence 的不可变事实边界；
- 人只负责采用或不采用 AI 方案的决策原则；
- Single Choice、Revision、Targeted Micro-training、Retest 与 Transfer 的既有职责。

### 1.1 贯穿所有阶段的验收原则

**每个阶段都必须证明旧主链零回归，并且新语义只在该阶段允许的边界内生效。**

该原则是阶段完成和进入下一阶段的共同前置条件，不得被专项测试通过或生产构建成功替代。每个阶段的工程与 Debug 报告必须同时提供两类证据：

1. **旧主链零回归证据**：现有 Material → Plan → Task → Candidate → Adopt → Revision → Publish → Learning 主链，以及 Single Choice、Revision、Targeted Micro-training、Retest / Transfer 的既有关键回归继续通过；历史正式资源和既有 Learning 消费保持兼容。
2. **阶段边界证据**：明确列出本阶段允许读取、计算、持久化和投射的新语义，并通过负向测试或前后快照证明它没有提前进入后续阶段负责的 Planner、Prompt、Admission Gate、Learning、Diagnosis、Evidence、Student Ability Profile 或历史 Frozen Resource。

若任一类证据缺失或失败，则该阶段不得标记完成，也不得以“后续阶段会处理”为由进入下一阶段。阶段报告必须记录：旧主链回归集合、授权生效面、禁止生效面、关键状态前后摘要和已知兼容限制。

## 二、训练坡度而非固定模板

推荐的观察坡度为：

`基础理解单选 → entry_short → focused_short → developing → integrated`

这不是题型配额，也不要求每个题组出现全部等级。系统只要求：

1. 不出现没有正式理由的负担跳跃；
2. 每次增加负担时能解释新增了哪一项责任；
3. 不把同一观察对象、证据范围和评分目标换一种问法重复训练；
4. `holistic_first`、`retest`、`transfer` 等角色驱动场景可以调整顺序，但必须保留理由；
5. 不能为了形成漂亮梯度而机械补题。

## 三、统一负担语义

### 3.1 TaskLoadSemantics

规划态、候选态、正式态和 Learning 投影应逐步统一到以下语义。阶段 0 只允许生成只读兼容投影，不写回业务对象。

```ts
type TaskLoadSemantics = {
  policyVersion: 'reading_training_progressive_load_policy_v2';
  sequenceRole:
    | 'foundation_entry'
    | 'bridge'
    | 'development'
    | 'integration'
    | 'independent_validation';
  primaryAction: CanonicalReadingAction;
  supportingAction?: CanonicalReadingAction;
  textLoadLevel?:
    | 'entry_short'
    | 'focused_short'
    | 'developing'
    | 'integrated';
  derivationSource: 'planned' | 'recomputed' | 'legacy_projection';
  confidence: 'high' | 'medium' | 'low';
};
```

负担语义描述题目属性，不进入学生能力画像。`loadLevel = developing` 不代表学生只能完成 developing 题。

### 3.2 TaskGroupProgressionPlan

题组需要能够表达顺序与相邻过渡理由：

```ts
type TaskGroupProgressionPlan = {
  schemaVersion: 'task_group_progression_plan_v1';
  policyVersion: 'reading_training_progressive_load_policy_v2';
  strategy: 'entry_first' | 'holistic_first' | 'role_driven';
  orderedTasks: Array<{
    planningTaskKey: string;
    taskLoadSemanticsHash: string;
    sequenceRank: number;
  }>;
  transitions: Array<{
    fromPlanningTaskKey: string;
    toPlanningTaskKey: string;
    threadRelation: 'same_thread' | 'cross_thread';
    addedResponsibilities: ReadingResponsibility[];
    loadDirection: 'same' | 'increase' | 'decrease' | 'independent';
    rationale: string;
  }>;
  exceptionReason?: string;
  planHash: string;
};
```

阶段 0 不写入正式计划，只审计现有题组能否可靠派生这些信息。阶段 2 的完整字段、Planning Seed、Transition 枚举和条件必填规则以阶段 2 工程契约为准。

## 四、五类可解释失稳层级

系统最终应能够区分：

1. 基础理解未成立；
2. 已理解但缺少文本依据；
3. 有依据但不能说明关系；
4. 推理或综合分析不足；
5. 理解已经形成，但表达组织不足。

这五类是诊断解释目标，不是由一道题直接生成的学生标签。只有在同一观察链具有足够的相邻负担层级、任务身份一致且 Evidence 隔离成立时，才允许推断失稳位置。

## 五、各层职责与升级边界

| 模块 | 阶段 0 | 后续核心升级 |
| --- | --- | --- |
| Observation Plan | 只读检查动作与证据范围是否可派生 | 原生声明主要动作、支撑动作和观察线程 |
| TrainingTask | 兼容投影 | 持有统一 `TaskLoadSemantics` |
| QuestionCandidate | 复用现有负担分析 | 继承并校验规划语义，不自行漂移 |
| Planner | 审计现有排序 | 规划具有理由的题组坡度 |
| Prompt | 不修改 | 消费规划语义生成题目，不自行决定梯度 |
| Quality Assessment | 复用单题质量结果 | 增加语义一致性检查 |
| Admission Gate | 保持现状 | 增加题组级无理由跳跃门禁 |
| Task Group Ordering | 审计 Learning 实际顺序 | 以正式 Progression Plan 为主，兼容旧标签 |
| Learning | 不修改 Session | 保留并消费任务负担语义 |
| Diagnosis / Evidence | 不产生新结论 | 区分任务负担、学生表现和可推断边界 |
| Revision | 保持首次表现隔离 | 比较同一任务修订增益，不替代独立验证 |
| Targeted Micro-training | 作为单独小任务审计 | 按具体 Gap 匹配局部动作，不强凑完整梯度 |
| Retest / Transfer | 视为合法顺序例外 | 用于独立保持与迁移验证 |

## 六、历史正式资源兼容

1. 现有 Frozen Resource 不批量覆盖、不原地补字段；
2. 阶段 0 只生成 `legacy_projection`，并记录来源、完整性和置信度；
3. 无法可靠投影时必须标为 `low` 或 `not_assessable`，不得伪造完整语义；
4. 现有题先只读审计；确需治理时生成 successor Candidate；
5. 新模型不能改变历史 Session、Attempt、Diagnosis 或 Evidence；
6. 兼容投影是迁移桥梁，不是永久正式来源。

## 七、归因边界

单题失败不能直接等于学生能力不足。正式诊断至少要检查：

- 任务负担语义是否完整；
- 题目是否存在复合动作或证据范围过载；
- 同一观察线程是否存在较低负担表现作为参照；
- 当前表现来自首次独立作答、反馈修订，还是 Retest / Transfer；
- 题目身份、版本与 Evidence 是否一致。

若题目本身负担过高或跨线程不可比较，系统只记录题目治理风险，不形成新的学生能力结论。

## 八、阶段划分

1. **阶段 0：契约升级与只读审计。** 冻结语义、实现兼容投影、审计历史题组，不改正式数据。
2. **阶段 1：Planning 与 Candidate 原生语义。** Observation Plan / TrainingTask / Candidate 同源表达负担。
3. **阶段 2：Planner、Prompt 与题组级 Gate。** 从“若干任务”升级为“有理由的递进题组”。
4. **阶段 3：Learning、Diagnosis 与 Evidence 消费。** 保留负担层级并建立受约束的失稳解释。
5. **阶段 4：历史资源 successor 治理与真实校准。** 只治理高风险题组，并以真实 Learning 数据验证。

以上每一阶段均受第 1.1 节双重验收约束；“专项能力已实现”不等于“阶段已完成”。

阶段 0 的工程与验收边界见：
[`READING_TRAINING_PROGRESSIVE_LOAD_STAGE0_CONTRACT_AND_READ_ONLY_AUDIT_PLAN.md`](./READING_TRAINING_PROGRESSIVE_LOAD_STAGE0_CONTRACT_AND_READ_ONLY_AUDIT_PLAN.md)

阶段 1 的原生语义、兼容迁移和 Debug 边界见：
[`READING_TRAINING_PROGRESSIVE_LOAD_STAGE1_NATIVE_SEMANTICS_ENGINEERING_AND_DEBUG_PLAN.md`](./READING_TRAINING_PROGRESSIVE_LOAD_STAGE1_NATIVE_SEMANTICS_ENGINEERING_AND_DEBUG_PLAN.md)

阶段 1 已完成 `40 / 40` 专项 Debug、`26 / 26` 统一资源生产套件、`17 / 17` 正式 Learning 入口回归和生产构建；旧主链零回归及授权边界证据见：
[`reading_training_progressive_load_stage1_engineering_debug_acceptance_2026-08-21.md`](../education/phase/reports/reading_training_progressive_load_stage1_engineering_debug_acceptance_2026-08-21.md)

阶段 2 的 Planner、Prompt、题组级 Gate、兼容方式和 `S2-01—S2-48` 验收边界见：
[`READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_PLANNER_PROMPT_GROUP_GATE_ENGINEERING_AND_DEBUG_PLAN.md`](./READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_PLANNER_PROMPT_GROUP_GATE_ENGINEERING_AND_DEBUG_PLAN.md)

阶段 2 已完成工程与 Debug 验收，状态为 `IMPLEMENTED / DEBUG ACCEPTED`；执行证据见：
[`reading_training_progressive_load_stage2_engineering_debug_acceptance_2026-08-24.md`](../education/phase/reports/reading_training_progressive_load_stage2_engineering_debug_acceptance_2026-08-24.md)。

阶段 3 的 Learning 上下文冻结、负担表现观察、受约束失稳归因、Evidence Admission、兼容迁移以及 `S3-01—S3-56` / `B3-01—B3-16` 验收边界见：
[`READING_TRAINING_PROGRESSIVE_LOAD_STAGE3_LEARNING_DIAGNOSIS_EVIDENCE_ENGINEERING_AND_DEBUG_PLAN.md`](./READING_TRAINING_PROGRESSIVE_LOAD_STAGE3_LEARNING_DIAGNOSIS_EVIDENCE_ENGINEERING_AND_DEBUG_PLAN.md)。

当前阶段 3 状态为 `IMPLEMENTED / DEBUG ACCEPTED / FULL BROWSER ACCEPTED / REAL CALIBRATION PENDING`。专项 Debug、关键旧主链回归、Production Build 与 `B3-01—B3-16` 全量真实浏览器联调均已通过；联调使用隔离内存 Fixture，不写正式资源、学生作答或能力画像，因此仍不得表述为真实教育效果已经验证。验收记录见[阶段 3 全量真实浏览器联调](../education/phase/reports/reading_training_progressive_load_stage3_full_browser_acceptance_2026-08-24.md)。

阶段 4 的历史资源 successor 治理、真实 Learning 校准事件、版本级投影、试运行阈值、回滚边界和 `S4-01—S4-64` / `B4-01—B4-16` 验收要求见：
[`READING_TRAINING_PROGRESSIVE_LOAD_STAGE4_SUCCESSOR_GOVERNANCE_AND_REAL_CALIBRATION_ENGINEERING_AND_DEBUG_PLAN.md`](./READING_TRAINING_PROGRESSIVE_LOAD_STAGE4_SUCCESSOR_GOVERNANCE_AND_REAL_CALIBRATION_ENGINEERING_AND_DEBUG_PLAN.md)。

当前阶段 4 状态为 `ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED / REAL CALIBRATION NOT STARTED`。`S4-01—S4-64` 为 `64 / 64 PASS`，`B4-01—B4-16` 已在真实应用内浏览器中完成 `16 / 16 PASS` 人工签署，阶段 0—3 与 Learning 主链零回归、Production Build 通过。浏览器联调使用隔离内存数据，正式资源、Student Attempt、Student Profile 与真实校准分母写入均为 `0`；该状态不等于真实样本充分、真实校准完成或教育效果证明。验收记录见[阶段 4 全量真实浏览器联调](../education/phase/reports/reading_training_progressive_load_stage4_full_browser_acceptance_2026-08-24.md)。

## 九、2026-08-25 当前正式题递进负担复审处置

当前 `24` 个活动题组、`81` 道 Current Head 的只读复审结果为：`80` 道负担投影完整，`1` 道单选因正式发布投影遗漏 `choiceInteraction` 而处于 `partial`；该单题必须通过 successor 治理修复。核心阅读题组中 `10 / 12` 可直接形成可追踪递进投影，《猫》《天上的街市》因既有正式题的跨线程比较或断点证据不足保留为部分可解释；targeted excerpt 的职责是一次小范围缺口训练，不要求形成完整核心题组坡度。

本轮出现的 `unexplained_responsibility_jump` 统一按 advisory 处理：

1. 它表示相邻任务的证据、关系、推理或表达责任出现明显上升，但当前版本尚无足够正式理由解释该跃迁；
2. 它不自动阻断 Current Head、Learning 或真实试用，也不得直接形成“学生能力不足”的 Diagnosis；
3. 若任务角色、Observation Plan 或材料结构已经给出合理理由，可记录处置理由后保留现状；
4. 只有真实 Learning 在对应层级重复失稳，且能够通过 successor 增加独立观察价值时，才治理任务顺序、证据范围或主要动作；
5. 不要求每个题组出现全部 `entry_short / focused_short / developing / integrated`，也不得为消除告警机械补题；
6. successor 治理必须保持 Material → Plan → Task → Candidate → Publish → Learning 主链与历史 Session 身份不变。

因此，本轮工程治理只修复确定的发布投影与题干—Rubric 阻断；其余梯度提示进入真实 Trial Window 的观察清单，不进行无样本批量重写。
