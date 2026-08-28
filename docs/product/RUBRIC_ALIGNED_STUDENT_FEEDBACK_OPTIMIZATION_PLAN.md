# 评分要点对齐的学生反馈优化方案

**English Name:** Rubric-aligned Student Feedback Optimization Plan

**Status:** STAGE 3 ENGINEERING COMPLETE / AUTOMATED DEBUG VERIFIED / BROWSER ACCEPTANCE PENDING

**Version:** v0.7

**Date:** 2026-08-27

阶段 1 工程边界已冻结，详见：[Rubric 对齐反馈阶段 1：确定性 Projection 工程实施与 Debug 验收文档](./RUBRIC_ALIGNED_FEEDBACK_STAGE1_DETERMINISTIC_PROJECTION_ENGINEERING_AND_DEBUG_PLAN.md)。

阶段 2 最小接口、披露边界与回退策略已冻结，详见：[Rubric 对齐反馈阶段 2：Grounding 与 Action Plan 最小接入工程实施与 Debug 验收文档](./RUBRIC_ALIGNED_FEEDBACK_STAGE2_GROUNDING_ACTION_PLAN_INTEGRATION_ENGINEERING_AND_DEBUG_PLAN.md)。

阶段 2 工程已通过 `RG2-01—RG2-30`、旧主链回归和 production build 验收，详见：[阶段 2 工程与 Debug 验收报告](../education/phase/reports/rubric_aligned_feedback_stage2_engineering_debug_acceptance_2026-08-27.md)。

阶段 3 Narrative 接口、学生页面投射、原子回退开关和浏览器验收边界已冻结，详见：[Rubric 对齐反馈阶段 3：Narrative 与学生页面投射工程实施与 Debug 验收文档](./RUBRIC_ALIGNED_FEEDBACK_STAGE3_NARRATIVE_AND_STUDENT_SURFACE_PROJECTION_ENGINEERING_AND_DEBUG_PLAN.md)。

## 一、方案目标

本方案用于把正式题目中已经冻结且质量较高的 `Rubric`，稳定地投射为与学生本次回答相匹配的反馈。

目标不是把“评分要点”原样展示给学生，也不是建立一套新的反馈答案库，而是让反馈能够明确回答：

1. 学生已经完成了哪个具体评分观察点；
2. 当前还缺少哪个关键观察点或观察点内部的哪一层关系；
3. 下一步应执行什么思考动作；
4. 为什么这个动作能够帮助完成当前题目。

核心原则冻结为：

> Rubric 负责定义“观察什么、如何判断、允许怎样表达”；正式 Diagnosis 负责判断“本次回答实际覆盖了什么”；Feedback Action Plan 负责把两者的差异转换为“已做到、还缺什么、下一步如何补齐”。

## 二、问题判断

当前部分题目的评分要点已经同时包含：

- 明确的观察对象；
- 材料事实或文本关系；
- 需要形成的解释或结论；
- 可接受的同义表达。

这些信息比通用反馈模板更接近题目的真实训练目标。如果反馈没有消费这些结构化信息，就容易退化为：

- “再结合材料分析”；
- “说明具体内容和你的想法有什么关系”；
- “还需要进一步理解”；
- 只复述题干，不指出学生答案的真实断点。

因此，本问题不是需要逐题重新撰写反馈，而是需要补齐一条统一的运行时投射链路。

## 三、架构边界

### 3.1 保持不变

以下现有主链保持不变：

```text
Material
→ Observation Plan
→ TrainingTask
→ QuestionCandidate
→ Adopt
→ Frozen Resource
→ Learning
→ Diagnosis
→ Evidence
```

不新建平行 Rubric，不修改历史 Frozen Resource，不允许反馈 Runtime 反向改写正式题目。

### 3.2 本次新增的连接

```text
Frozen Question Rubric
+ Task Requirement Coverage
+ Formal Diagnosis Result
+ Student Response（只读）
↓
Rubric Feedback Projection
↓
StudentFeedbackGrounding
↓
StudentFeedbackActionPlan
↓
Student Learning Narrative
```

`Rubric Feedback Projection` 是确定性的运行时派生对象。第一版不持久化为新的教育事实，不进入 Student Profile，也不替代 Ability Evidence。

完整 Rubric 与学生可见反馈之间必须增加最小必要信息投射，不允许 Narrative Agent 直接消费完整答案信息：

```text
完整 Frozen Rubric（系统内部可见）
↓
Rubric Feedback Projection（系统内部可见）
↓ 最小必要信息裁剪
Student-visible Feedback Grounding（Narrative Agent 可见）
↓
Student Learning Narrative（学生可见）
```

权限原则冻结为：

> Projection 可以知道完整 Rubric，但学生反馈只获得完成当前教学动作所需的最小信息。系统知道得多，学生看到得少。

### 3.3 明确不做

- 不按 Rubric `weight` 计算学生分数；
- 不把未命中某个 Rubric Item 自动归因为能力不足；
- 不把 `acceptedSignals`、Calibration Answer 或完整参考答案直接展示给学生；
- 不允许 Narrative Agent 自行补造材料依据、学生观点或人物结论；
- 不允许 Narrative Agent 直接读取 Calibration Answer、完整 Rubric 描述、完整 `acceptedSignals` 或未被选择的其他评分项；
- 不因反馈优化批量覆盖现有正式资源；
- 不把一次反馈支持下的修订表现写成独立掌握结论。

## 四、统一语义模型

建议新增只读运行时类型：

```ts
export type RubricFeedbackCoverageStatus =
  | 'achieved'
  | 'partially_achieved'
  | 'missing'
  | 'not_assessable';

export type RubricFeedbackObservedGap =
  | 'conclusion_without_evidence'
  | 'evidence_without_explanation'
  | 'partial_required_aspects'
  | 'scope_misaligned'
  | 'expression_not_organized';

export type RubricFeedbackProjectionItem = {
  rubricItemId: string;
  requirementId?: string;
  importance: 'critical' | 'important' | 'supporting';
  coverageStatus: RubricFeedbackCoverageStatus;

  // 只引用已经核验的学生回答片段，不复制推测内容。
  studentEvidenceRefs: string[];

  // 说明该评分项与本题要求的关系，来自 Frozen Rubric。
  taskRelation: string;

  // 当前可观察断点，不承担新的根因判断。
  observedGap?: RubricFeedbackObservedGap;

  // 学生下一步可执行的一个思考动作。
  nextThinkingAction?: string;

  sourceLinks: {
    questionVersionId: string;
    rubricVersion?: string;
    diagnosisId?: string;
    responseId?: string;
  };
};

export type StudentVisibleFeedbackGrounding = {
  groundingVersion: 'student_visible_feedback_grounding_v1';
  acknowledgedStudentAction?: string;
  primaryObservedGap?: RubricFeedbackObservedGap;
  safeClueLocator?: string;
  nextThinkingAction?: string;
  feedbackDepth: 'result_only' | 'thinking_prompt' | 'scaffold';
  sourceProjectionId: string;
};

export type RubricFeedbackProjection = {
  projectionVersion: 'rubric_feedback_projection_v1';
  projectionId: string;
  questionVersionId: string;
  rubricVersion?: string;
  primaryItemId?: string;
  items: RubricFeedbackProjectionItem[];
  projectionStatus: 'ready' | 'limited' | 'not_assessable';
};
```

### 4.1 选择主要反馈项

学生端一次只聚焦一个主要缺口。Primary Item 的目标不是寻找最严重、权重最高或缺失最多的评分项，而是选择当前证据最充分、对完成任务最有教学价值，并且能够通过一次明确行动得到改善的主要断点。

选择顺序冻结为：

```text
Formal Diagnosis / Requirement Coverage 已确认
↓
可以通过一次明确行动改善
↓
属于学生当前最先失稳的必要步骤
↓
修复后能够推动当前题目继续完成
↓
最后才以 required / critical / importance 处理并列项
```

评分结构中的最高权重与教学上当前最值得处理的问题不必相同。`weight` 不得直接决定 Primary Item。

如果多个评分项共同构成同一条不可拆分关系，可以合并为一个反馈目标；不得把多个独立缺口同时堆给学生。

### 4.2 覆盖状态边界

- `achieved`：正式 Diagnosis 能引用学生答案证明该观察点已经成立；
- `partially_achieved`：身份一致的 Requirement Coverage 或 Formal Diagnosis 已经确认学生触及观察对象，但缺少必要依据、解释关系、必要方面或表达组织；
- `missing`：当前有效回答没有完成 required / critical 观察动作；
- `not_assessable`：回答无效、身份不一致、Diagnosis 未形成或证据不足，禁止猜测。

“未出现关键词”不能单独把评分项判定为 `missing`。语义等价表达必须继续遵循 `AnswerAcceptance` 与正式 Diagnosis。

`Rubric Feedback Projection` 没有重新判断 `partially_achieved` 的权限。它只能转换、排序和投射已经形成的 Requirement Coverage / Formal Diagnosis 结论；输入没有明确支持时必须使用 `not_assessable` 或 `limited`，不得通过重新阅读学生答案建立第二套 Diagnosis。

`observedGap` 只描述本次可观察断点，不是长期能力标签，也不进入 Student Profile。其来源必须能够回到 Requirement Coverage 或 Formal Diagnosis：

- `conclusion_without_evidence`：已有结论，缺少正式要求的文本依据；
- `evidence_without_explanation`：已有依据，缺少依据与判断之间的解释；
- `partial_required_aspects`：多个必要方面只完成其中一部分；
- `scope_misaligned`：已经回应题目，但对象或限定范围偏离；
- `expression_not_organized`：理解与必要内容已经成立，但当前表达未形成可判断组织。

## 五、反馈生成规则

### 5.1 学生已经做到

肯定必须同时满足：

- 能引用学生实际回答；
- 能对应一个正式 Rubric Item；
- 能说明该回答为什么对完成题目有帮助。

禁止输出无依据的“理解得很好”“已经掌握”。

### 5.2 还需要补充

反馈必须指出评分项内部的具体断点，例如：

- 已有结论，但没有文本事实；
- 已找出事实，但没有解释事实与结论的关系；
- 已解释局部信息，但没有回应题目的限定对象；
- 已覆盖一个方面，但遗漏题目要求的另一个必要方面。

不得只说“答案不完整”“需要深入分析”。

### 5.3 下一步动作

默认只给一个思考动作，并满足：

- 指向当前主要缺口；
- 能回到题目对象、材料线索或关系判断；
- 不给出完整结论；
- 不把答案拆成可机械抄写的步骤清单。

只有学生经过首次反馈仍无法组织表达、且 Runtime 已记录提示升级状态时，才允许提供不含完整答案的句式支架。

### 5.4 可接受表达的使用

`acceptedSignals` 与可接受表达用于：

- 判断学生是否使用了语义等价表达；
- 避免把非标准措辞误判为错误；
- 帮助生成与学生原话一致的反馈语言。

它们默认不作为学生可见答案列表。反馈应优先引用学生自己的表达；只有提交完成后的解释确有必要时，才能以概念释义方式呈现部分同义表达，且不得变成可复制的标准答案。

### 5.5 最小必要信息投射

生成 `StudentVisibleFeedbackGrounding` 时必须主动移除：

- Calibration Answer；
- 完整 Rubric 描述；
- 完整 `acceptedSignals`；
- 正确结论与全部文本依据的完整组合；
- 非 Primary Item 的其他评分项；
- 内部权重、能力 ID、Diagnosis Code 与置信度。

学生可见 Grounding 只保留：

- 从学生原回答核验出的一个已完成动作；
- 一个主要可观察断点；
- 一个不会直接暴露答案的材料定位线索；
- 一个可执行思考动作；
- 当前允许的反馈深度。

不得把完整 Rubric 改写成第二人称后作为反馈。以下输出属于答案泄露，应被质量门禁阻断：

```text
你应该指出母亲虽然病重，仍然照顾“我”，从而表现出她的隐忍、无私和对子女的深爱。
```

首次反馈应引导学生重新建立关键连接，而不是把“观察对象—依据—关系—结论”全部替学生组装完成。

## 六、题型差异

### 6.1 文本作答

文本题允许基于 Rubric 区分：

- 结论；
- 文本依据；
- 依据与结论之间的解释关系；
- 多要点覆盖；
- 表达组织。

反馈应聚焦学生当前最先失稳的一层，不因高阶 Rubric 未覆盖就否定已经成立的基础观察。

### 6.2 单项选择

单选题反馈不得套用文本题的“补充依据、解释关系、重新组织答案”要求，除非该任务明确包含后续文本作答契约。

单选题应依据：

- `selectedOptionId`；
- `correctOptionIds`；
- 对应选项的 `distractorRationale`；
- 当前 Rubric 观察目标；

生成以下类型的反馈：

- 选择正确：说明本次辨认成立，不扩写成长篇答案；
- 选择错误：指出该选项对应的典型误读，并给出一个重新核对线索；
- 无法判断：明确状态限制，不伪造解释。

单选题反馈链路冻结为：

```text
selectedOptionId
→ option identity
→ distractorRationale
→ 典型误读
→ 一个重新核对动作
```

它不得进入文本题的 Rubric 补全链路，也不得要求学生在已经完成单选交互后补写一段文本答案。

### 6.3 Retest / Transfer

Retest 与 Transfer 可以显示结果反馈，但不得提供即时完整修复路径，也不开放反馈后修订。Rubric Projection 只用于解释本次独立表现，不降低独立性要求。

## 七、示例

### 7.1 正式评分要点

```text
评分项：病情与照顾行为的反差
说明：联系母亲病重与仍然照顾“我”的反差，说明她隐忍、无私并深爱孩子。
可接受表达：自己病重、忍受病痛、仍照顾我、隐忍、无私、爱孩子。
```

### 7.2 学生只写“母亲很爱孩子”

```text
已经做到
你已经判断出母亲深爱孩子，回应了人物情感这一层。

先补这一点
答案还没有说明这个判断来自母亲的哪种处境和行为。

下一步这样想
对照“自己病重”和“仍然照顾我”这两个信息，想一想这种反差为什么能表现她对孩子的爱。
```

### 7.3 学生已经写出反差但未解释品质

```text
已经做到
你找到了母亲病重却仍然照顾“我”的反差，这是本题的关键依据。

先补这一点
还需要说明这种把自己的痛苦藏起来、优先照顾孩子的行为表现了什么。
```

### 7.4 完整覆盖

```text
已经做到
你既指出了母亲病重却仍照顾“我”的反差，也说明了这种行为表现出她的隐忍、无私和对孩子的深爱。
```

完整覆盖时不机械追加“下一步训练”，也不为了保持固定版式制造虚假缺口。

## 八、质量门禁

每条学生可见反馈必须通过以下校验：

1. 所有肯定均能回到 `StudentResponse`；
2. 所有缺口均能回到 Formal Diagnosis 与 Rubric Item；
3. 反馈对象与题干对象一致；
4. 文本题与单选题反馈契约不串用；
5. 一次只投射一个主要缺口；
6. 不展示内部 ID、Rubric 权重、Diagnosis 术语或能力标签；
7. 不直接泄露 Calibration Answer；
8. `not_assessable` 不生成具体缺口；
9. Rubric 身份、题目版本、Diagnosis 和 Response 身份必须一致；
10. Narrative 不得添加 Projection 中不存在的事实。
11. `partially_achieved` 必须有 Requirement Coverage 或 Formal Diagnosis 的明确来源；
12. Narrative Agent 输入中不得包含完整 Rubric、完整 `acceptedSignals` 或 Calibration Answer；
13. Primary Item 必须能够通过一次学生行动改善，不能只因权重最高而入选；
14. 单选反馈必须来自选项身份与 `distractorRationale`，不得进入文本补全链路。

以下任一情况必须安全降级：

- Rubric 缺失或版本不一致；
- Formal Diagnosis 未形成；
- Student Response 无效；
- Question / Response / Diagnosis 身份错位；
- 多个 critical 缺口无法可靠确定优先级；
- Rubric 本身与题干要求矛盾。

安全降级只说明当前无法形成针对性反馈，不得退回空洞模板。

## 九、历史资源兼容与治理

### 9.1 历史正式题

- 现有 Frozen Resource 保持只读；
- 首先执行 Rubric 反馈准备度审计；
- Rubric 完整且身份一致的题目可以直接使用新投射；
- Rubric 不完整但仍可安全反馈的题目保持兼容模式；
- Rubric 与题干冲突的题目形成 Finding，经 successor Candidate 治理；
- 不因新反馈契约批量重新发布全部题目。

### 9.2 审计 Finding

建议新增：

- `rubric_feedback_ready`；
- `rubric_feedback_limited`；
- `rubric_requirement_misaligned`；
- `rubric_missing_accepted_signals`；
- `rubric_feedback_identity_mismatch`；
- `single_choice_feedback_contract_mismatch`。

静态审计只判断反馈准备度，不模拟学生答案，不生成虚构 Diagnosis。

## 十、分阶段工程方案

### 阶段 0：契约与只读审计

- 冻结 `RubricFeedbackProjection v1`；
- 扩展全部正式题提示与反馈批量审计；
- 输出 Rubric 反馈准备度基线；
- 证明 Shared Store 零写入。

执行状态：`COMPLETED`（2026-08-27）。已冻结 `RubricFeedbackProjection v1` 与 `StudentVisibleFeedbackGrounding v1`，批量审计升级至 `formal_question_hint_feedback_batch_audit_v2`。当前 81 道正式题静态准备度为 `ready 81 / limited 0 / blocked 0`，Shared Store revision `1963` 在审计前后保持不变。该结论仅代表正式题具备静态投射条件，不代表系统已经判断任何学生回答的 Rubric 覆盖情况，也不改变学生端反馈。

### 阶段 1：确定性投射层

- 从 Rubric、Requirement Coverage 与 Formal Diagnosis 派生 Projection；
- 建立身份一致性、可行动性优先项选择和 `partially_achieved` 来源门禁；
- 不改变现有 Narrative 展示；
- 对照旧链验证 Diagnosis / Evidence 零回归。

### 阶段 2：Feedback Action Plan 接入

- `StudentFeedbackGrounding` 消费 Projection；
- 增加 `StudentVisibleFeedbackGrounding` 最小必要信息裁剪；
- 生成“已做到、主要缺口、下一步动作”；
- 单选与文本反馈分流；
- 保留现有 Revision 资格与一次修订边界。

工程边界已于 2026-08-27 冻结：Action Plan 只允许接收裁剪后的 `StudentVisibleFeedbackGrounding`，不得接收完整 Projection / Rubric；本阶段采用 optional adapter 和旧链回退，不修改 Learning 页面。

### 阶段 3：Learning 展示与批量回归

- 学生端按实际状态显示必要反馈块；
- 完整覆盖时不制造缺口；
- 验证连续题组、Revision、Retest、Transfer；
- 对全部正式题执行静态审计与代表性动态样例回归。

工程边界已于 2026-08-28 冻结：继续复用 `StudentLearningNarrativeProjection v1` 与现有 Learning 反馈区；Narrative 只允许接收带完整身份校验的最小 Grounding 与 Action Plan；新旧路径必须按完整来源原子选择，禁止逐字段混拼。阶段 3 采用 `legacy / shadow / student_visible` 三态开关，完成 `RG3-01—RG3-36` 和 `B3-01—B3-16` 前不得默认全量启用学生可见新路径。

### 阶段 4：真实 Trial 校准

工程与验收边界已于 2026-08-28 冻结，详见 [阶段 4：真实 Trial 校准与 Debug 验收文档](./RUBRIC_ALIGNED_FEEDBACK_STAGE4_REAL_TRIAL_CALIBRATION_AND_DEBUG_ACCEPTANCE_PLAN.md)。当前状态为 `DESIGN FROZEN / ENGINEERING READY / REAL TRIAL NOT ACTIVATED`，默认反馈模式继续保持 `shadow`。

只观察：

- 反馈是否准确对应学生原答案；
- 学生是否能理解并执行下一步动作；
- 修订后同一主要缺口是否减少；
- 是否出现答案泄露、错误肯定或题型串用；
- `limited / not_assessable` 的真实发生率。

真实 Trial 数据只用于校准反馈策略，不直接修改长期能力状态。

## 十一、Debug 与验收矩阵

至少覆盖：

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| RF-01 | 文本题完整覆盖 critical Rubric | 只肯定真实完成内容，不制造缺口 |
| RF-02 | 有结论、无依据 | 肯定结论方向，聚焦补充依据 |
| RF-03 | 有依据、无关系解释 | 肯定依据，聚焦解释连接 |
| RF-04 | 使用非标准同义表达 | 通过 AnswerAcceptance 正确识别 |
| RF-05 | 无效作答 | 不生成虚假肯定或具体缺口 |
| RF-06 | Formal Diagnosis 不可用 | 安全降级，不回退通用模板 |
| RF-07 | Rubric 与题目版本错位 | 阻断针对性投射 |
| RF-08 | 两个独立 critical 缺口 | 只选最优先的一个 |
| RF-09 | 单选正确 | 简洁确认辨认成立 |
| RF-10 | 单选错误 | 使用对应 distractor rationale，不要求写文本答案 |
| RF-11 | Retest / Transfer 失误 | 不开放即时修订或泄露完整路径 |
| RF-12 | Revision 改善 | 只比较首次主要缺口，不覆盖 Initial Evidence |
| RF-13 | 反馈 Narrative 自行增加事实 | 质量门禁阻断 |
| RF-14 | 历史 Rubric 信息有限 | 兼容投射或明确 limited |
| RF-15 | 批量审计重复运行 | 结果确定且 Shared Store 零写入 |
| RF-16 | 旧主链回归 | Publish、Learning、Diagnosis、Evidence 行为不变 |
| RF-17 | 最高权重项不可通过一次行动改善 | 选择更可执行且能推动任务的已确认断点 |
| RF-18 | Projection 输入没有 partial 覆盖结论 | 不自行推断，返回 limited / not_assessable |
| RF-19 | Narrative Agent 尝试读取完整 Rubric | 输入裁剪或权限门禁阻断 |
| RF-20 | 完整 Rubric 可直接拼成答案 | 学生可见 Grounding 仅保留线索与思考动作 |
| RF-21 | 单选错误且文本 Rubric 存在 | 只走 distractor 反馈，不要求文本补全 |
| RF-22 | 两个 critical 项中只有一个可立即改善 | 可改善项成为 Primary Item |

每个阶段必须证明旧主链零回归，并且新语义只在该阶段允许的边界内生效。

## 十二、完成定义

本优化达到工程验收的最低条件为：

1. 学生反馈能够追溯到具体 Rubric Item、Formal Diagnosis 和 Student Response；
2. 反馈不再依赖脱离题目和学生答案的通用兜底文案；
3. 文本题与单选题使用各自正确的反馈契约；
4. 完整作答不制造“下一步改进”；
5. 部分作答能够准确区分“结论、依据、关系解释和多要点覆盖”；
6. 历史 Frozen Resource 保持不变；
7. Revision、Retest、Transfer、Evidence 与 Student Profile 边界无回归；
8. 全部正式题审计与代表性真实浏览器回归通过。
9. Primary Item 由“证据成立 + 一次可改善 + 教学推动价值”决定，而不是由最高权重直接决定；
10. `partially_achieved` 不产生第二套 Diagnosis；
11. Narrative Agent 只能消费最小必要的学生可见 Grounding；
12. Rubric 的完整知识不会被改写成标准答案模板展示给学生。

## 十三、工程开发准入评估

### 13.1 已具备的现有基础

代码核对确认现有系统已经具备以下可复用节点：

- `TaskRequirementCoverage` 已表达 `covered / partially_covered / missing / insufficient_to_judge`；
- Formal Diagnosis Commit 已提供正式诊断身份与 Rubric 匹配结果；
- `StudentFeedbackGrounding` 已承担反馈事实的只读来源绑定；
- `StudentFeedbackActionPlan` 已表达肯定、主要缺口、思考问题、操作和披露门禁；
- `controlledFeedbackExpressionAgent` 已存在学生可见 Narrative 的校验插入点；
- `singleChoiceDiagnosisAgent` 与 `distractorRationales` 已支持单选独立诊断来源；
- Revision、Evidence Return 与 Learning Round 已有身份和阶段边界。

因此，本方案不要求重建 Diagnosis、Evidence 或 Learning 主链，核心开发是新增确定性 Projection、最小信息裁剪和现有 Feedback Adapter 接入。

### 13.2 工程准入结论

本方案已经具备进入工程开发的必要条件：

- Schema 输入、输出与身份字段明确；
- Primary Item 选择目标和并列规则明确；
- `partially_achieved` 的唯一合法来源明确；
- 完整 Rubric 与 Narrative Agent 之间的权限边界明确；
- 文本题、单选题、Revision、Retest / Transfer 的分流明确；
- 历史资源兼容、失败降级和零写入边界明确；
- 阶段 0—4 和 RF-01—RF-22 验收范围明确。

结论：阶段 0、阶段 1、阶段 2 已完成并通过零写入与旧主链回归验收。阶段 3 已完成 Narrative 接口、身份 Guard、原子来源选择、Learning 运行时接入和 `RG3-01—RG3-36` 自动化验收；默认模式保持 `shadow`。在 `B3-01—B3-16` 真实浏览器签署完成前，不得切换默认 `student_visible`，也不得声明学生可见新反馈已经正式验收。

### 13.3 开发期间不得突破的边界

1. 阶段 1 只建立 Projection，不改变学生可见反馈；
2. 阶段 2 才允许 Action Plan 消费最小化 Grounding；
3. 阶段 3 才改变 Learning 展示，并必须保留旧链回退开关；
4. 每阶段均需证明 Publish、Diagnosis、Evidence、Revision 和历史 Frozen Resource 零回归；
5. 任何需要修改正式 Rubric 的问题均转为审计 Finding 与 successor Candidate，不在反馈 Runtime 内修补。

## 十四、关联文档

- [题目元数据模型](../education/QUESTION_METADATA_MODEL.md)
- [反馈行动转换模型](../education/FEEDBACK_ACTION_MODEL.md)
- [Learning Gap 模型](../education/LEARNING_GAP_MODEL.md)
- [AI Coach 模型](../education/AI_COACH_MODEL.md)
- [全部正式题提示与反馈批量审计契约](./FORMAL_QUESTION_HINT_AND_FEEDBACK_BATCH_AUDIT_CONTRACT.md)
- [Learning 反馈后修订契约](./LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md)
- [反馈观察对象投射收口工程与 Debug 验收文档](./FEEDBACK_OBSERVATION_TARGET_PROJECTION_CONVERGENCE_ENGINEERING_DEBUG_ACCEPTANCE.md)
- [Rubric 对齐反馈阶段 0 只读审计报告](../education/phase/reports/rubric_aligned_feedback_stage0_readonly_audit_2026-08-27.md)
- [Rubric 对齐反馈阶段 1：确定性 Projection 工程实施与 Debug 验收文档](./RUBRIC_ALIGNED_FEEDBACK_STAGE1_DETERMINISTIC_PROJECTION_ENGINEERING_AND_DEBUG_PLAN.md)
- [Rubric 对齐反馈阶段 2：Grounding 与 Action Plan 最小接入工程实施与 Debug 验收文档](./RUBRIC_ALIGNED_FEEDBACK_STAGE2_GROUNDING_ACTION_PLAN_INTEGRATION_ENGINEERING_AND_DEBUG_PLAN.md)
- [Rubric 对齐反馈阶段 3：Narrative 与学生页面投射工程实施与 Debug 验收文档](./RUBRIC_ALIGNED_FEEDBACK_STAGE3_NARRATIVE_AND_STUDENT_SURFACE_PROJECTION_ENGINEERING_AND_DEBUG_PLAN.md)
- [Rubric 对齐反馈阶段 3 工程与自动化 Debug 验收报告](../education/phase/reports/rubric_aligned_feedback_stage3_engineering_debug_acceptance_2026-08-28.md)
