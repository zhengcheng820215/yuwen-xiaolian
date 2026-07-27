# Phase 17.2：材料观测设计与首批正式资源包

英文名称：Material Observation Design and First Frozen Resource Pack

设计状态：ACCEPTED

工程状态：17.2A / 17.2B RUNTIME + MINIMAL PRODUCTION WORKSPACE ENGINEERING PASS；17.2C MANIFEST / DIVERSITY RUNTIME FOUNDATION PASS；ASSISTED DRAFT GENERATION 38 / 38 PASS；BATCH A CONTENT IMPLEMENTED + CONTROLLED FORMALIZATION 14 / 14 PASS + OWNER REVIEW / FREEZE / REGISTRY / ACTIVE LINK 8 / 8 PASS；《潼关》MATERIAL CLUSTER CALIBRATION 12 / 12 PASS；PHASE 17.3 MINIMUM ENTRY GATE OPEN

所属总纲：[Phase 17：学习资源覆盖扩展与基于材料的能力观测基础](./phase17.md)

前置状态：Phase 17.1 `ENGINEERING + HUMAN DEMO PASS`；Coverage Dashboard 轻量人工 Demo 已完成 `8 / 8 PASS`，Phase 17.2 工程开发的 Dashboard 前置条件已满足。Phase 17.1 IndexedDB Smoke 仍为独立待验项。

当前工程验收记录：[Phase 17.2 Material Observation Engineering Debug Acceptance](./reports/phase17_2_material_observation_engineering_debug_acceptance_2026-07-22.md)、[Phase 17.2 Minimal Resource Production Workspace Debug Acceptance](./reports/phase17_2_minimal_resource_production_workspace_debug_acceptance_2026-07-22.md)。核心 Contract `26 / 26 PASS`，最小生产工作台专项 Debug `13 / 13 PASS`；PC `1280 × 720` 与平板横屏 `1024 × 768` 页面级布局 Smoke 通过。确定性测试使用合成夹具，不属于正式资源，不计入首批 24—28 道 Frozen Resource Pack。

2026-07-23 范围校准：早期工程验收报告保留当时的 `26—28` 道与逐能力 TaskRole 配额表述作为历史快照；当前正式生产政策已收敛为 `24—28` 道、整体 Ability 分布和最少纵向学习链，不再要求每项 Ability 机械补齐 Training / Retest / Transfer。

首批真实内容生产采用独立的只读规划文档：[Phase 17.2 First Formal Resource Pack Production Blueprint](./phase17_2_first_resource_pack_blueprint.md)。该蓝图定义三层产出、Batch A/B/C、答案 Fixture 与 Runtime Verified 派生规则，不新增正式 Schema 或 Repository。

Batch A 当前已实现两篇项目原创 Material、8 道内容完整资源、1 条 Training -> Retest、1 条 Training -> Transfer 和 16 组答案 Fixture；隔离正式 Repository 的 Review / Freeze / Registry / Link / Runtime Query 为 `14 / 14 PASS`。2026-07-23 浏览器工作台已完成 8 道题负责人审核与逐题 Freeze，`Frozen Version = 8`、Registry 一致、材料生产工作台 `正式关联 = 8`，8 道资源均可由正式工作台查询；额外存在的未命名空 Draft 不属于 Batch A，不计入正式资源。Phase 17.3 最小入口门已开放，但完整 24—28 道资源包仍属于 Phase 17.2 最终产品验收范围。记录见 [Batch A 受控正式化验收](./reports/phase17_2_batch_a_controlled_formalization_2026-07-23.md)。

2026-07-23 新增《潼关》Material Cluster 校准：同一公版诗歌材料下建立 6 个 Training Observation Task，分别观察 extraction、comprehension、summarization、analysis、inference 与 expression；工作台现已支持单段 / 段落范围 / 全文 Anchor、plan-local Observation Focus、内容级 Rubric / Answer Acceptance、Supporting Ability 与审核校准答案。专项 Debug `12 / 12 PASS`，浏览器载入和展开审查 Smoke 通过。该 Plan 仍为 `pending_review`，不得计入正式 Frozen Resource Pack。记录见 [《潼关》Material Cluster 校准](./reports/phase17_2_tongguan_material_cluster_calibration_2026-07-23.md)。

2026-07-24 Assisted Draft Generation 校准至 Prompt v1.4 / Generator Contract v1.2：内容人员可以提交完整 Material，由真实 Provider 生成 3—6 个结构化 Observation Planning Candidate；系统逐候选校验 Ability、Dimension、Anchor、Rubric、Answer Acceptance、校准答案、重复 Observation 和安全边界。Prompt 现在按 Runtime 的确定性分段规则向 Provider 提供带编号自然段、段落总数、完整合法枚举、题型与作答形式映射及输出前自检要求，不再要求模型猜测 Contract。Supporting Ability 默认留空，Rubric 只能引用候选已经声明的能力；能力错位修复会收到明确允许集合，且不得通过新增辅助能力强行放行。首次有效 JSON 若因结构拒绝导致整批不足，剩余一次 Provider 预算只修复失败候选，已通过候选原样保留；修复输出失败时回退第一轮结果。重复 Observation、材料不支持和无法安全推断的问题不进入自动修复。再次生成仍按 `new_observation_candidate`、`alternate_question_for_existing_observation`、`likely_duplicate` 或 `unsupported_by_material` 分类，只有新 Observation 可以导入并增加候选 Coverage。导入只形成可编辑首稿，不直接写 Repository，不自动 Review、Freeze、更新 Registry 或建立 Retest / Transfer。Provider 失败提示已区分账户余额不足与上游临时异常，并显示实际自动尝试次数及对应操作。专项 Debug 更新为 `38 / 38 PASS`，工作台状态 `5 / 5 PASS`、资源生产 `13 / 13 PASS`、Production Build 通过。记录见 [辅助首稿生成工程验收](./reports/phase17_2_assisted_draft_generation_engineering_2026-07-23.md)。

### 辅助首稿生成边界

```text
Material
-> Material Observation Draft Generator
-> 3—6 Observation Planning Candidate
-> Deterministic Candidate Validation
-> Human Import / Edit
-> Existing Plan Review / Draft / Freeze / Registry
```

该能力用于降低从零录题成本，不建立第二套正式资源链：

1. AI 负责结构化首稿，人工负责题目是否值得存在、Primary Ability、Observation、Rubric、Acceptance 与发布决定；
2. `evidencePotential` 只描述题目设计的观察潜力，不是学生执行后的 Evidence Quality；
3. Candidate 不得包含正式状态、正式资源 ID 或已发布语义；
4. 单个坏候选可以隔离拒绝，但不足 3 个合法独立候选时整批不可导入；
5. 生成失败不得污染现有 Material、Plan、Draft、Frozen Resource 或 Registry；
6. 受控 Live 质量验收只判断候选可用性，不改变既有 Phase 16.1 正式准入权威。
7. 默认生成模式只负责发现新 Observation；同一 Observation 的不同问法不增加 Coverage；
8. 再次生成必须比较已有 Observation / Question Inventory；疑似重复、替代题和材料不支持项不得随新 Observation 批量导入；
9. Retest、Transfer 和跨材料等价 Observation 继续由正式资源关系设计处理，不混入“再次生成”按钮。
10. Provider 必须获得与 Validator 相同的段落编号和合法枚举；结构拒绝导致整批不足时只允许一次候选级定向修复，不重新生成或覆盖合格候选。
11. 定向修复只处理 Contract 字段错误；重复、无材料依据、虚构内容和教育语义越界继续阻断。

### AI 候选高拒绝率问题与当前结论

真实使用曾出现 AI 已成功返回候选，但多个候选因 Anchor 超出材料段落、字段枚举不合法或末端结构缺失而被整题拒绝。复核确认其中一部分不是教育设计错误，而是 Provider 没有获得与 Validator 完全一致的输入协议：Prompt 要求段落号，却未提供 Runtime 的真实编号；Schema 严格限制题型、作答形式和 Anchor 类型，Prompt 却未完整暴露合法值；有效 JSON 进入结构校验后也没有候选级修复机会。

当前已完成：

1. Prompt v1.3 使用 Runtime 同源分段结果，逐段提供编号及总段落数；
2. 完整暴露关键枚举和题型 / 作答形式映射；
3. 结构拒绝导致整批不足时，使用剩余一次 Provider 预算定向修复失败候选；
4. 合格候选保持不变，修复失败时回退并保留第一轮结果；
5. Validation 记录失败 issue count，页面显示请求修复、恢复和仍未通过数量；
6. 重复、材料不支持、虚构内容和教育语义越界不进入自动修复。

当前状态为 `ENGINEERING PASS / CONTROLLED LIVE EFFECTIVENESS PENDING`。确定性 Debug 已证明修复机制和安全边界成立，但尚未用优化后的真实 Provider 连续生成证明结构合格率达到目标。后续使用同一已知材料执行 3 轮受控生成，按总候选、首轮结构通过、自动修复、最终可导入、正确阻断和人工轻改可用数统计；建议结构合格率目标为 `>= 85%`、人工轻量修改后可用率为 `>= 60%`。未完成该验收前，不宣称“不合格候选问题已经完全解决”。

工作台采用 Observation-first 的人工审核顺序：

```text
Observation Focus
-> Ability Action / Material Anchor
-> Question Entry
-> Rubric / Answer Acceptance / Calibration
```

Question 在正式 Contract 中仍保留独立题型、作答形式、难度和正式版本；工作台面向内容人员使用“训练任务、评价标准、提交审核、正式发布”等产品语言，不直接暴露不必要的内部对象名称。页面同时展示 Primary Ability 与 Material Dimension 的轻量候选覆盖；只有生成 AI 初稿后，才以 `生成初稿 -> 编辑确认 -> 提交审核 -> 逐题审核 -> 正式发布` 表达当前发布位置。该展示只帮助内容人员判断候选和流程状态，不建立新的 Coverage Contract，也不改变 Question Resource 的执行与版本权威。

2026-07-23 完成素材生产工作台轻量 UX 校准：

1. 顶栏内容最大宽度使用 `1360px`，主体内容最大宽度使用 `1200px`，并保持 PC / Tablet 响应式收缩；
2. 学习材料、训练任务、审核与正式化改为纵向生产顺序，不再把长材料与复杂任务编辑器压入双栏；
3. 明确区分“选择已有素材”和“录入新素材”，保存新素材后返回已有素材模式；
4. 校准案例和 Batch A 保留为受控示例资源入口，以绿色表示最近一次成功使用的资源组；
5. 选择态、焦点态和当前数量统一使用绿色语义；操作成功使用短时 Toast，不使用长期占位横幅；
6. AI 区域改用“生成训练任务初稿、编辑确认、提交审核、逐题审核、正式发布”等可理解文案；
7. 删除重复标题、低信息说明与非必要分割线，刷新、版本和任务数量均提供明确反馈。

本次 UX 校准只调整页面结构、展示状态和操作反馈，不修改 Material、Observation Plan、Question Draft、Review、Freeze、Registry 或 Observation Link 的正式职责。

2026-07-24 完成工作台状态语义校准：

1. 当前计划只展示每个 Observation Task 对应的最新 Draft，历史版本继续保留追溯但不重复进入当前计数；
2. “正式发布”只有在全部当前任务均已 Freeze 且 active Observation Link 完整时才成立；
3. 工作台以当前选中的 Material Version 为范围展示“待审核题目”和“已发布练习”；未选择 Material 时不展示题目状态和下游生产模块，全局资源库存不在本工作台承担；
4. 人工编辑或导入 AI 初稿后，切换素材、录入模式或受控示例包前必须明确确认是否放弃未保存修改；
5. 状态选择器专项 Debug `5 / 5 PASS`，原生产工作台 `13 / 13 PASS`、辅助首稿生成 `38 / 38 PASS` 与 Production Build 均保持通过。

本次修复只校准当前工作区的只读选择、计数和交互保护，不删除历史 Draft，不改写 Formal Resource，也不改变 Review、Freeze、Registry 或 Link Contract。

### 训练任务版本保留规则

2026-07-24 明确材料训练任务的修改与版本保留语义：

1. 内容人员返回编辑区修改已保存的训练任务并再次保存时，系统创建递增的新 Plan Revision，不覆盖或删除当前版本；
2. 新版本通过 `parentPlanId` 记录来源版本，旧版本继续保留，用于追溯题目来源、审核过程和前后修改；
3. 新版本创建后仍需重新完成训练任务审核；未通过审核前，不替代已经审核或正在正式链路中使用的版本；
4. 当前实现没有自动删除、自动归档或按数量清理旧 Plan Revision 的机制；
5. 后续若增加历史版本归档，默认只在工作台弱化或折叠旧版本；已经关联 Question Draft、Frozen Resource、审核记录或 Observation Link 的版本不得物理删除；
6. 面向内容人员的提示统一表达为：“返回编辑区修改并保存后，系统会保留当前版本，并创建一个新的待审核版本。”不得使用可能被理解为覆盖保存的含糊文案。

该规则只明确现有版本链与产品表达，不新增 Schema、Repository 或版本治理后台。

## 一、阶段目标

Phase 17.2 只解决一个核心问题：

> 如何先从正式 Material 中识别有价值的观察对象，再把 Observation Dimension 与既有 Ability Action、TaskRole 和 Difficulty 组合为可审核的任务计划，最终通过 Phase 16.1 建设第一批 24—28 道 Frozen Question Resource？

正式链路：

```text
Phase 17.1 Resource Coverage Gap
-> Material Cluster Plan
-> Material Intake / Version
-> Material Structure / Source Anchors
-> Material Observation Plan
-> Observation Task Plan
-> Structured Question Draft
-> Phase 16.1 Validation / Human Review / Freeze
-> Resource Observation Link
-> Registry Current Head
-> Resource Pack Manifest
-> Coverage Report Recalculation
-> Observation Diversity View
```

Phase 17.2 完成后，系统应能够：

1. 为首批 Material Version 建立版本化、可复核的观测设计；
2. 明确每项任务观察材料的什么侧面、要求学生完成什么能力动作；
3. 防止同一能力被大量同质题目制造虚假覆盖；
4. 防止为了填满矩阵而生成材料不支持的低价值任务；
5. 将 Task Plan 转换为 Phase 16.1 可消费的 Question Draft，而不绕过正式准入；
6. 将 Frozen Resource Version 与原始 Observation Task Plan 建立不可变追溯；
7. 建设首批 24—28 道审核有效、Registry current 的正式资源；
8. 形成首批 Resource Pack Manifest 和 Observation Diversity View；
9. 为 Phase 17.3 提供可执行资源和正式追溯输入。

## 二、一句话定义

> Phase 17.2 先设计“材料可以观察什么、学生需要如何处理”，再把高价值观测任务交给 Phase 16.1 生成正式题目资源，而不是先写题目、再补能力标签。

## 三、教育模型关系

Phase 17.2 正式采用四层关系：

```text
Material
-> Observation Dimension
-> Ability Action
-> Question Resource
```

### 3.1 Material

Material 提供统一的事实、语境和内容世界。

Phase 17.2 不把 Material 解释为题目容器。Material Version 需要成为观测设计的稳定内容基线，任何 Plan、Anchor 和 Question Draft 都必须引用明确版本。

### 3.2 Observation Dimension

Observation Dimension 回答：

> 当前任务从材料的哪个侧面观察学生表现？

Phase 17.2 V1 使用受控一级集合：

```ts
type ObservationDimension =
  | 'fact'
  | 'character'
  | 'plot'
  | 'causality'
  | 'structure'
  | 'language'
  | 'theme';
```

建议解释：

| Dimension | 主要观察对象 | 不应混淆为 |
| --- | --- | --- |
| `fact` | 明示人物、事件、时间、地点、行为和信息节点 | 对信息的分析方法 |
| `character` | 人物动作、语言、心理、形象和关系 | 所有记叙文任务 |
| `plot` | 事件发展、变化、转折、冲突和结果 | 篇章组织结构 |
| `causality` | 原因、结果、条件和因果关系 | 一般时间先后关系 |
| `structure` | 段落功能、照应、铺垫、线索和篇章组织 | 事件内容本身 |
| `language` | 关键词句、修辞、描写和表达效果 | 任何需要阅读文字的任务 |
| `theme` | 情感、态度、主旨和价值表达 | 只要题目涉及人物感受 |

一级维度的定义由 Phase 17.2 Contract 管理。内容人员不得临时新增 `emotion / detail / rhetoric_effect` 等一级 Dimension。

### 3.3 Observation Focus

`observationFocus` 表达某个 Dimension 下更具体的观察重点，例如：

- `character_psychology`；
- `character_action`；
- `event_cause`；
- `structural_foreshadowing`；
- `implicit_meaning`。

V1 中 Focus 是 Plan-local 的设计元数据，不是全局 taxonomy，也不是 Coverage denominator、TaskRequest 硬约束或 Profile 维度。

Focus 必须使用结构化对象，不能只保存自由文本标签：

```ts
type ObservationFocus = {
  focusCode: string;
  displayName: string;
  definition: string;
  scope: 'plan_local';
};
```

上述四个字段构成 V1 冻结边界。Phase 17.2 不继续为 Focus 增加父子关系、同义词、重要度、难度、优先级、聚类、全局 Registry、Profile 映射或 Evidence 权重。Focus 只帮助内容人员说明“本题具体观察什么”，不得自行成长为第二套能力或知识体系。

### 3.4 Ability Action

Ability Action 继续复用现有 `PrimaryAbilityId`：

```text
extraction
comprehension
summarization
analysis
inference
expression
```

Phase 17.2 不创建第二套 Ability 枚举。

Observation Dimension 描述“观察什么”，Ability Action 描述“学生如何处理”。例如：

```text
character × extraction
character × analysis
character × inference

causality × comprehension
causality × analysis
causality × inference
```

这些组合不是强弱等级，也不构成必须填满的矩阵。

### 3.5 TaskRole

TaskRole 回答：

> 为什么现在需要这次观察？

继续复用：

- `training`；
- `retest`；
- `transfer`；
- `diagnosis`；
- `observation`。

TaskRole 不能由题目文案推断，也不能为了满足 Pack 配额静默改写。

## 四、正式输入与输出

### 4.1 输入

Phase 17.2 只消费：

- Phase 17.1 `ResourceCoverageReport` 与结构化 Gap；
- Phase 16.1 `QuestionMaterialVersion`；
- Phase 16.1 Question Draft / Validation / Review / Freeze Application Boundary；
- 当前 `ResourceRegistryEntry[]`；
- 当前 `FrozenQuestionResourceVersion[]`；
- 受控 Observation Dimension Contract；
- 首批 Resource Pack 建设政策；
- 人工内容审核结果。

Phase 17.2 不消费 StudentResponse、DiagnosisResult、AbilityEvidence、Profile 或 GrowthMemory 来反向改写材料和题目。

### 4.2 输出

Phase 17.2 输出：

- `MaterialStructureSnapshot[]`；
- `MaterialSourceAnchor[]`；
- `MaterialObservationPlan[]`；
- `ObservationTaskPlan[]`；
- Phase 16.1 `StructuredQuestionDraft[]`；
- Phase 16.1 生成的 `FrozenQuestionResourceVersion[]`；
- `ResourceObservationLink[]`；
- `FirstFrozenResourcePackManifest`；
- `ObservationDiversityView`；
- 更新后的 Phase 17.1 Coverage Report。

这些对象职责不同：Plan 是内容设计事实；Frozen Resource 是正式执行资源；Manifest 是 Pack 快照；Diversity View 是派生审查视图。

### 4.3 V1 正式对象白名单

Phase 17.2 V1 只允许新增或正式使用以下对象：

- `MaterialStructureSnapshot`；
- `MaterialSourceAnchor`；
- `MaterialObservationPlan`；
- `ObservationTaskPlan`；
- Existing `StructuredQuestionDraft`；
- Existing `FrozenQuestionResourceVersion`；
- `ResourceObservationLink`；
- `FirstFrozenResourcePackManifest`。

`ObservationDiversityView` 是只读派生结果，不是新的正式写入对象。页面筛选、批量编辑状态、临时生产进度和操作提示使用 ViewModel 或 Application 层临时状态，不得升级为新的领域对象。

Phase 17.2 不再新增 `DimensionPlan / FocusPlan / SequencePlan / ObservationReviewPlan / ResourcePackBuildPlan` 或其他 Candidate、Decision、Snapshot。新增正式对象必须同时满足：已经出现真实生产阻断、现有对象无法准确表达、普通 ViewModel 无法解决、缺少该对象将阻止首批资源安全生产；任一条件不满足即不新增。

## 五、Material Structure 与 Source Anchor

### 5.1 V1 不建设复杂文本知识图谱

Phase 17.2 只需要稳定定位 Task Plan 所依据的材料内容，不建立完整实体图谱、语义图谱或自动篇章解析系统。

建议最小结构：

```ts
type MaterialStructureSnapshot = {
  materialStructureSnapshotId: string;
  materialId: string;
  materialVersionId: string;
  paragraphCount: number;
  paragraphHashes: string[];
  contentHash: string;
  createdAt: string;
};

type MaterialSourceAnchor = {
  sourceAnchorId: string;
  materialId: string;
  materialVersionId: string;
  anchorType: 'paragraph' | 'paragraph_range' | 'full_text';
  startParagraph?: number;
  endParagraph?: number;
  excerpt?: string;
  contentHash: string;
};
```

### 5.2 Anchor 规则

1. 段落编号基于当前 Material Version 的确定性规范化结果；
2. Anchor 必须引用一个正式存在的 Material Version；
3. `excerpt` 只用于人工识别，不能替代完整 Material 内容；
4. Material Version 改变后必须生成新 Structure Snapshot；
5. 旧 Plan 保留历史追溯，但不得静默指向新版本段落；
6. Anchor 失效时 Plan 进入 `revision_required`，不能继续生成新 Draft；
7. V1 不依赖 LLM 自动识别段落功能才能工作。

## 六、Material Observation Plan Contract

### 6.1 Plan Schema

```ts
type MaterialObservationPlanStatus =
  | 'draft'
  | 'pending_review'
  | 'revision_required'
  | 'reviewed'
  | 'superseded'
  | 'rejected';

type DimensionReview = {
  dimension: ObservationDimension;
  decision: 'selected' | 'not_suitable' | 'not_reviewed';
  reason: string;
  sourceAnchorIds: string[];
};

type MaterialObservationPlan = {
  materialObservationPlanId: string;
  materialId: string;
  materialVersionId: string;
  materialStructureSnapshotId: string;

  revision: number;
  status: MaterialObservationPlanStatus;
  dimensionReviews: DimensionReview[];
  taskPlans: ObservationTaskPlan[];

  reviewerId?: string;
  reviewNote?: string;
  reviewedAt?: string;
  parentPlanId?: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 'material_observation_plan_v1';
};
```

### 6.2 Dimension Review

Plan 必须覆盖七个一级 Dimension 的审查状态，但不要求全部 `selected`。

目的不是填满矩阵，而是区分：

- 已确认适合本材料；
- 已确认不适合；
- 尚未审查。

`not_suitable` 是合法结果，不形成 Coverage Gap。只有首批 Pack Policy 明确要求但尚未观察的 Dimension，才可以形成资源规划提醒。

### 6.3 Plan Review Gate

Plan 进入 `reviewed` 前至少确认：

1. Material 身份与版本有效；
2. Structure Snapshot 与 Material 内容一致；
3. selected Dimension 有材料事实或位置支持；
4. 每个 Task Plan 只有一个 primaryDimension；
5. Ability Action 与题目预期认知活动一致；
6. TaskRole 使用理由成立；
7. 同一材料下任务之间具有真实差异，不只是改写题干；
8. 没有为了填矩阵创建材料不支持的任务；
9. Source Anchor 没有泄露为学生端标准答案；
10. 版权和来源说明满足 Phase 16.1 要求。

未 `reviewed` 的 Plan 可以保存和修订，但不能批量创建正式 Question Draft。

## 七、Observation Task Plan Contract

### 7.1 Schema

```ts
type ObservationTaskPlanStatus =
  | 'planned'
  | 'draft_linked'
  | 'frozen_linked'
  | 'revision_required'
  | 'cancelled';

type ObservationTaskPlan = {
  observationTaskPlanId: string;
  materialObservationPlanId: string;
  materialId: string;
  materialVersionId: string;

  primaryDimension: ObservationDimension;
  observationFocus?: ObservationFocus;
  abilityId: PrimaryAbilityId;
  taskRole: RecommendedTaskRole;
  difficulty: QuestionResourceDifficulty;

  sourceAnchorIds: string[];
  observationGoal: string;
  expectedStudentAction: string;
  designReason: string;

  intendedComparisonGroupId?: string;
  materialRelationIntent?: 'same_context' | 'similar_context' | 'new_context';

  linkedDraftId?: string;
  linkedResourceId?: string;
  status: ObservationTaskPlanStatus;
};
```

### 7.2 一项任务只能有一个主要观测目标

每个 Task Plan 必须有：

- 一个 `primaryDimension`；
- 一个主要 `abilityId`；
- 一个 `taskRole`；
- 一个受控 `difficulty`。

可以在 Question Resource 中继续保留 supporting ability，但 supporting ability 不增加 Primary Coverage，也不能让一题同时满足多个 Pack 配额。

### 7.3 相同 Dimension 与不同 Ability

同一 `character` Dimension 可以建立 extraction、analysis、inference 等任务，但必须分别证明：

- 学生需要完成的认知动作不同；
- Question Stem 不只是换一个动词；
- Rubric 观察点不同；
- Answer Requirement 与能力动作一致。

### 7.4 相同 Ability 与不同 Dimension

同一 inference Ability 可以来自 character、causality、structure、language 或 theme。

Observation Diversity View 应显示这种分布，避免三道人物心理题被误读为广泛推理覆盖。

### 7.5 Retest 与 Transfer 只是设计意图

`materialRelationIntent` 和 `intendedComparisonGroupId` 用于内容设计与审核，不证明运行时关系已经成立。

- Retest 实际可比性仍由 Phase 13 / Phase 14 正式事实校验；
- Transfer 实际新材料关系仍由 Phase 16.2 针对具体 TaskRequest 校验；
- Resource Pack 中标记为 transfer 的资源，不保证对所有学生和所有基线都是新 Context。

## 八、Question Draft Adapter

### 8.1 Adapter 职责

```text
Reviewed MaterialObservationPlan
+ ObservationTaskPlan
+ Material Version
-> QuestionDraftCandidate
-> Existing Phase 16.1 StructuredQuestionDraft
```

Adapter 只负责确定性映射和预填，不负责：

- 自动补写教育目标；
- 自动生成最终 Rubric；
- 自动批准 Review；
- 自动 Freeze；
- 修改 Frozen Resource；
- 让 AI Draft 直接进入 Registry。

### 8.2 映射要求

至少映射：

| Observation Task Plan | Phase 16.1 Draft |
| --- | --- |
| materialVersionId | materialVersionId |
| abilityId | abilityMetadata.abilityId |
| taskRole | abilityMetadata.taskRole |
| difficulty | abilityMetadata.difficulty |
| observationGoal | Rubric 设计上下文，不直接复制为学生文案 |
| sourceAnchorIds | 内部追溯引用，不直接展示给学生 |

Question Stem、AnswerAcceptance、Rubric 和 minimumAnswerRequirement 必须由内容人员完成或复核。

### 8.3 AI 辅助边界

AI 可以：

- 根据 reviewed Plan 生成 Question Draft 候选；
- 建议题干、Rubric 和合理异表述；
- 检查任务之间是否过度同质；
- 标记可能的 Dimension / Ability 错位。

AI 不可以：

- 创建 reviewed Plan；
- 把 `not_suitable` Dimension 改成 selected；
- 自动 Review 或 Freeze；
- 自动把参考答案关键词变成 Rubric 唯一标准；
- 根据题量缺口制造材料不支持的任务。

## 九、Resource Observation Link

### 9.1 为什么使用独立 Link

Phase 16.1 `FrozenQuestionResourceVersion` 已冻结并完成回归。Phase 17.2 不应为了加入 Observation Dimension 静默改变历史 Frozen Resource 语义。

因此 V1 使用独立、不可变的追溯对象：

```ts
type ResourceObservationLink = {
  resourceObservationLinkId: string;
  materialObservationPlanId: string;
  observationTaskPlanId: string;

  resourceId: string;
  resourceVersionId: string;
  materialId: string;
  materialVersionId: string;

  primaryDimension: ObservationDimension;
  abilityId: PrimaryAbilityId;
  taskRole: RecommendedTaskRole;
  difficulty: QuestionResourceDifficulty;

  status: 'active' | 'superseded' | 'invalid';
  linkedAt: string;
  schemaVersion: 'resource_observation_link_v1';
};
```

### 9.2 Link Gate

Link 只有在以下条件全部满足时才能为 `active`：

1. Observation Plan 为 reviewed；
2. Task Plan 属于该 Plan；
3. Frozen Resource 的 resourceId / versionId 可读取；
4. Resource materialId / materialVersionId 与 Plan 一致；
5. Resource primary ability、taskRole、difficulty 与 Task Plan 一致；
6. Registry current head 指向该 Resource Version；
7. Review 与 Validation 可追溯。

任何身份错位均进入 `invalid / review_required`，不得自动修改 Resource 或 Plan。

### 9.3 Version 规则

- Frozen Resource 新版本必须生成新 Link；
- 旧 Link 保持历史追溯并标记 superseded；
- Material Version 变化必须生成新 Plan 或 Plan Revision；
- Link 不允许从旧 Resource Version 静默移动到新版本；
- Link 缺失不影响旧 Runtime 对 Frozen Resource 的基本读取，但该资源不能计入 Observation Diversity 的正式已追溯数量。

## 十、首批 Resource Pack 建设政策

### 10.1 规模

首批目标：24—28 道当前审核有效、Registry current 的 Frozen Resource。24 道达到质量与链路要求即可冻结，不为补足上限继续扩题。

能力分布按整个 Pack 统计：

| Ability | 建议数量 | 说明 |
| --- | ---: | --- |
| `extraction` | 3—4 | 覆盖明确事实与必要条件提取 |
| `comprehension` | 4—5 | 覆盖句意、行为含义与语境理解 |
| `summarization` | 4—5 | 覆盖事件、段意或要点整合 |
| `analysis` | 4—5 | 覆盖人物、结构、语言或关系分析 |
| `inference` | 4—5 | 覆盖人物、因果、结构或主题推断 |
| `expression` | 3—4 | 覆盖观点、依据与表达组织 |

上述区间是首批资源平衡目标，不是允许生成低价值题目的硬配额。单项超出上限应显示偏斜提醒；低于下限应显示正式资源缺口。

TaskRole 不再按每项 Ability 机械配齐。首批 Pack 至少形成：

- 2 条完整的 `Training -> Retest` 资源链；
- 2 条完整的 `Training -> Transfer` 资源链；
- 1 条由 Existing Strategy 驱动、经过两个或以上 Ability Action 的跨能力连续学习路径。

前两类资源链要求目标 Ability 一致且材料 Context 独立；Retest 的正式可比性和 Transfer 的正式新颖性仍由既有 Runtime 校验。跨能力路径不写入 Pack 的固定发题顺序，只在 Phase 17.3 中作为集成验收场景。

### 10.2 Material 规模

- 4 个核心 Material Cluster，加 1—2 个具有独立内容语境的新材料 Cluster，总计 5—6 个；
- 每个 Material 通常形成 3—6 道任务；
- 不要求每篇材料覆盖六项 Ability；
- 不要求七个 Observation Dimension 全部出现；
- Pack 需要展示 Dimension 分布和单一 Dimension 集中风险。

“用于 Retest / Transfer 的新材料 Cluster”只描述首批建设用途，不是 Material Cluster 的永久类型。TaskRole 始终属于具体 Question Resource。

### 10.3 Difficulty

- Training 优先覆盖 `basic + intermediate`；
- Retest / Transfer 首批以 `intermediate` 为主；
- `advanced` 可以保持 Gap；
- 不得为完成 difficulty 配额静默改变题目真实复杂度。
- 工作台中的“适用学段”当前只作为辅助生成 Prompt 的参考条件，不进入正式匹配、Coverage、Evidence 或 Profile，也不代表系统已经建立初一、初二、初三的难度常模；
- 后续 Question 能力匹配机制可以在独立设计中增加“Ability × Grade / Difficulty Calibration”，但在正式 Contract、资源标注协议和真实样本校准完成前，不得把 `gradeRange` 当作确定性难度依据。

### 10.4 QuestionType 与 ResponseFormat

首批产品端可执行 Pack 以当前已验收链路为主：

- `open_short_answer`；
- `reading_comprehension`；
- `short_text / long_text`。

选择、判断和填空可以建设为资源侧 Draft，但在对应学生端与 Diagnosis / Feedback 链完成专项验收前，不计入产品端 executable coverage。

### 10.5 资源完整性

首批 Pack 中每道正式资源必须具备：

- 合法来源和必要版权说明；
- Material Version 与 Observation Plan 追溯；
- 一个 primary Observation Dimension；
- 一个 primary Ability；
- 明确 TaskRole 与 Difficulty；
- 完整 AnswerAcceptance；
- 至少一个有效 Rubric Item；
- minimumAnswerRequirement；
- Phase 16.1 Validation PASS；
- Human Review approve；
- Frozen Version；
- Registry current head；
- active ResourceObservationLink。

### 10.6 三层产出与分批冻结

首批资源生产不只统计题量，必须同时成立：

1. 单题正式性：每道题完整通过 Material -> Observation -> Draft -> Rubric / Answer Acceptance -> Review -> Freeze -> Registry -> Link -> Runtime Query；
2. 资源链可运行：Retest、Transfer 与跨 Ability 路径必须在录入前规划，不能生产后临时拼接；
3. 整体覆盖不失衡：同时审查 Ability、Material Cluster、Observation Dimension、TaskRole 与 Response Form。

执行分为：

- Batch A：约 8 道核心链验证资源；
- Batch B：8—10 道能力覆盖扩展资源；
- Batch C：8—10 道依据正式 Coverage 修正偏斜与边界问题的资源。

Batch A 未完成正式 Runtime 消费验证前，不批量进入 Batch B。边界验证优先采用“正式题目 + 多种学生答案 Fixture”，Fixture 不属于 Frozen Resource，不计入题量。

批次、规划链和验收细则以 [首批正式资源包生产蓝图](./phase17_2_first_resource_pack_blueprint.md) 为准。蓝图中的 `planningChainKey` 不是正式 `chainId`，不得进入 Runtime 权威判断。

## 十一、Resource Pack Manifest

```ts
type FirstFrozenResourcePackManifest = {
  resourcePackId: string;
  resourcePackVersion: string;
  coverageReportIdBefore: string;
  coverageReportIdAfter: string;

  materialObservationPlanIds: string[];
  materialVersionIds: string[];
  resourceVersionIds: string[];
  resourceObservationLinkIds: string[];

  abilityBreakdown: Record<PrimaryAbilityId, number>;
  taskRoleBreakdown: Record<RecommendedTaskRole, number>;
  difficultyBreakdown: Record<QuestionResourceDifficulty, number>;
  observationDimensionBreakdown: Record<ObservationDimension, number>;

  limitations: string[];
  frozenAt: string;
  schemaVersion: 'first_frozen_resource_pack_v1';
};
```

Manifest 是首批 Pack 的不可变验收快照，不是新的 Resource Registry，也不决定 TaskFulfillment。

Manifest 更新必须创建新版本，不能覆盖已参与 LearningRound 的历史资源清单。

## 十二、轻量 Observation Dimension Breakdown

### 12.1 定位

Observation Diversity View 只回答：

> 某项 Ability 当前来自哪些 Observation Dimension，是否过度集中于单一观察面？

现有 Runtime 可以保留下列只读结构，用于确定性计算和 Debug：

```ts
type AbilityObservationDiversity = {
  abilityId: PrimaryAbilityId;
  executableResourceCount: number;
  linkedResourceCount: number;
  dimensionBreakdown: Partial<Record<ObservationDimension, number>>;
  materialClusterCount: number;
  diversityStatus: 'diverse' | 'limited' | 'single_dimension' | 'insufficient';
  limitations: string[];
};

type ObservationDiversityView = {
  resourcePackId: string;
  registrySnapshotId: string;
  abilities: AbilityObservationDiversity[];
  generatedAt: string;
};
```

第一版产品展示只需要：

```text
Inference
- Character: 6
- Language: 1
- Theme: 0

提示：当前推理资源主要集中在人物维度。
```

页面不需要展示完整状态对象、全部 limitations 或独立 Dashboard。`materialClusterCount / diversityStatus / limitations` 可以保留为内部只读校验结果，但本阶段不继续发展趋势分析、综合评分、自动补题建议或面向学生的 Diversity 产品能力。

### 12.2 非权威边界

Observation Diversity View：

- 不修改 Phase 17.1 Coverage Cell；
- 不把 `single_dimension` 自动变成 Coverage `gap`；
- 不进入 Student Profile；
- 不改变 Evidence 权重；
- 不替代 Phase 16.2 Resource Matching；
- 不因 Dimension 数量多就宣称题目质量高。

它只为内容建设与人工审核揭示偏斜。

因此，Phase 17.2 对 Diversity 的产品目标是“能够看出某项 Ability 是否过度集中在单一 Dimension”，不是建设一套新的资源分析系统。

## 十三、Application 与 Repository 边界

推荐关系：

```text
Minimal Material Resource Production Workspace
-> MaterialObservationApplicationService
-> MaterialObservationPlanRepository
+ QuestionResourceAdmissionRepository (read-only lookup)

Reviewed Plan
-> ObservationTaskDraftAdapter
-> Existing Phase 16.1 Draft Application Service

Frozen Resource
-> ResourceObservationLinkApplicationService
-> ResourceObservationLinkRepository
```

规则：

1. 页面不得直接写 IndexedDB Store；
2. Plan Repository 不保存 Frozen Resource；
3. Question Resource Repository 不保存未审核 Plan；
4. Link Repository 不成为 Resource Registry；
5. Workspace 不实现第二套 Validation / Review / Freeze；
6. Coverage Report 仍由 Phase 17.1 基于 Registry 生成；
7. Diversity View 只消费 current Registry、active Link 与 Pack Manifest；
8. 任一 Plan 或 Link 失败不得修改 Frozen Resource；
9. 页面不得通过自由文本标签决定 Ability 或 TaskRole；
10. Debug 使用内存 Adapter，浏览器使用统一 Repository Adapter。

第一版只允许一个最小资源生产入口，不分别建设 Material Workspace、Observation Workspace、Pack Workspace、Manifest Workspace 或 Diversity Dashboard。Coverage、Manifest、Link 与 Dimension Breakdown 只作为该入口中的辅助状态或跳转结果。

## 十四、三个内部工作包

Phase 17.2 不拆成新 Phase 编号，但工程建议按以下顺序推进。

### 17.2A：Observation Planning Runtime

实现：

- Dimension Contract；
- Material Structure / Anchor；
- MaterialObservationPlan；
- ObservationTaskPlan；
- Validator、Review 与版本状态；
- Plan Repository；
- 最小资源生产工作台。

### 17.2B：Question Draft and Traceability Integration

实现：

- Task Plan -> StructuredQuestionDraft Adapter；
- Existing Phase 16.1 Application Boundary 集成；
- ResourceObservationLink；
- Frozen Version / Registry identity Gate；
- 新版本与旧 Link 追溯。

### 17.2C：First Resource Pack Construction

完成：

- 4 个核心 Material Cluster 和 1—2 个独立新材料 Cluster；
- 24—28 道 Frozen Resource；
- 2 条 `Training -> Retest` 与 2 条 `Training -> Transfer` 资源链；
- 1 条由正式 Strategy 驱动的跨能力连续学习验收路径；
- Resource Pack Manifest；
- Coverage Recalculation；
- Observation Diversity View；
- 内容与浏览器人工验收。

## 十五、确定性执行顺序

```text
1. Load Phase 17.1 Coverage Report
2. Select Priority Gaps
3. Create / validate Material Versions
4. Derive Material Structure Snapshots and Anchors
5. Create Material Observation Plans
6. Human Review Plans
7. Create Observation Task Plans
8. Build Question Draft Candidates
9. Execute Existing Phase 16.1 Validation / Review / Freeze
10. Create Resource Observation Links
11. Verify Registry Current Heads
12. Build Resource Pack Manifest
13. Recalculate Phase 17.1 Coverage Report
14. Build Observation Diversity View
15. Human Content and Browser Acceptance
```

不得跳过第 6、9 或 11 步。

## 十六、核心 Debug Cases

### Observation Plan

**Case 1：合法 Plan**

正式 Material Version、Structure Snapshot、完整 Dimension Review 和 Task Plan 通过校验。

**Case 2：非法一级 Dimension**

`emotion` 等未注册值被阻断，不自动归并到 character 或 theme。

**Case 3：Material Version 缺失**

Plan 进入 blocked / validation_failed，不创建临时 Material。

**Case 4：Source Anchor 错位**

Anchor 的 materialVersionId 或 contentHash 不匹配时阻断 Review。

**Case 5：selected Dimension 无材料依据**

没有合法 Source Anchor 或设计理由时不得 reviewed。

**Case 6：not_suitable 合法留空**

材料不适合 structure 时可以明确留空，不形成错误或虚假 Task Plan。

**Case 7：一个 Task 多个 primaryDimension**

校验失败，不允许一题同时增加多个 Dimension 计数。

**Case 8：Ability 未注册**

自由能力标签被阻断，不创建新 Ability。

**Case 9：同 Dimension 不同 Ability**

任务目标和 Rubric 确实不同则允许；只更换 abilityId 则进入 review。

**Case 10：同 Ability 不同 Dimension**

正式记录分布差异，不合并为同一 Observation Focus。

**Case 11：矩阵未填满**

Plan 仍可通过，不要求 7 × 6 完整组合。

**Case 12：Plan 重复提交幂等**

相同 revision 与内容复用同一正式 Review 结果，不创建重复 Plan。

**Case 13：Material 新版本**

旧 Plan 保持追溯，新版本必须复核 Anchor，不静默迁移。

**Case 14：reviewed Plan 不可原地改写**

修改 Dimension、Ability、Role 或 Anchor 必须创建新 revision。

### Draft、Freeze 与 Link

**Case 15：Task Plan 只创建 Draft**

Adapter 不自动 Review、Freeze 或更新 Registry。

**Case 16：Rubric 与 Ability 错位**

继续由 Existing Phase 16.1 Validation 阻断，不在 Adapter 中放宽。

**Case 17：Link 身份闭合**

Plan、Task Plan、Material、Frozen Version 与 Registry current head 全部一致才生成 active Link。

**Case 18：Frozen Resource 新版本**

创建新 Link，旧 Link superseded；历史 Round 保持旧引用。

**Case 19：非 current 资源**

不能进入 Pack Manifest 或 Diversity 当前数量。

**Case 20：Link 缺失**

资源仍保留 Registry 事实，但不计入已追溯 Observation Diversity。

**Case 21：Transfer 设计意图不是运行事实**

Plan 标记 new_context 不得绕过 Phase 16.2 材料关系校验。

**Case 22：Retest 设计意图不是可比性事实**

Plan comparisonGroup 不得直接生成 comparable 结论。

### Pack 与安全

**Case 23：Pack 范围与学习链报告**

总量、整体 Ability 分布或纵向学习链不足时输出明确缺口；不要求逐能力补齐所有 TaskRole，也不用错位资源凑数量。

**Case 24：Dimension 偏斜**

Inference 全部来自 character 时输出 `single_dimension`，Primary Coverage 状态保持原解释。

**Case 25：Plan 不生成 Evidence**

Plan、Draft 或 Frozen Resource 创建均不得产生 AbilityEvidence、ProfileUpdateDecision 或 GrowthMemory。

**Case 26：无效操作无污染**

Plan Review、Draft Adapter 或 Link Gate 失败时，不修改 Frozen Resource、Registry 或已有 Manifest。

## 十七、人工内容验收

自动 Debug 不能证明题目具有教育价值。首批 Pack 必须进行人工内容验收。

每道题至少检查：

1. primaryDimension 是否真由材料支持；
2. abilityId 是否对应学生实际需要完成的动作；
3. TaskRole 是否合理；
4. 难度是否与任务复杂度一致；
5. 题干是否明确且不泄露答案；
6. Rubric 是否能区分完成、部分完成和关键缺口；
7. 合理异表述是否被接受；
8. Source Anchor 是否准确；
9. 同材料任务是否过度重复；
10. 学生端反馈是否可以基于该 Rubric 形成具体、可理解的点评。

至少抽取以下交叉关系进行人工联调：

- character × extraction；
- character × inference；
- causality × comprehension / inference；
- structure × analysis；
- language × comprehension；
- theme × expression。

上述示例不是强制每篇材料都具备，而是验证 Dimension 与 Ability 的区分能够被人理解。

## 十八、最小资源生产工作台验收

第一版 Workspace 的目标是完成首批资源生产，不是建设永久运营后台或通用 CMS。

工作台的产品职责固定为五项：完成录入、发现缺失字段、预览待正式化对象、交接人工审核与 Freeze、定位阻断错误。它不建设独立于 Existing Question Intake 的第二套审核系统，也不因后台交互仍可优化而延长 Phase 17.2。

2026-07-24 增加材料生产到题目审核的批次交接模式：材料工作台不再为同一份 Plan 内容设置“编辑确认 → 训练任务审核 → 查看待审核题目”的页面内逐步切换。训练任务摘要下直接提供“返回修改”和“进入审核发布环节”两个动作；审核入口携带当前 `MaterialObservationPlan` 与 Material Version 上下文进入独立的“题目审核与发布平台”。该页面只投影当前 Plan 最新的一组 Question Draft，并隐藏新建题目、全库正式资源历史与清空 Demo 等无关入口。该调整只使用现有 `observation_plan:*`、`observation_task:*` 标签完成范围过滤，继续复用 Phase 16.1 的校验、人工审核与 Freeze 链，不新增 Schema、Repository 或第二套正式化流程。直接访问题目录入工作台时，原有通用模式保持不变。

### 2026-07-24 工作台流程与表达校准记录

本轮校准将材料生产页从“展示内部对象和阶段状态”收敛为“完成任务生产并交接审核”的内容工作台：

1. AI 生成区、训练任务编辑区、当前任务覆盖与发布确认区使用一致的白色工作区、内边距、字号和圆角；辅助说明不小于 12px，普通正文不小于 14px；
2. 能力、训练方向、任务用途、难度和范围等受控信息优先通过标签、分段按钮或下拉选择完成；必须手填的字段提供可直接理解的中文标题和示例；
3. AI 候选统计统一展示“生成、可导入、替代题、疑似重复、素材不支持”，有数据使用激活状态，无数据弱化；拒绝信息同时说明原因、合法范围和可执行操作，不向内容人员展示内部错误码；
4. 已生成候选、已有任务和 Coverage 信息去重展示，Observation、Rubric、Answer Acceptance、Freeze 等内部术语在操作界面翻译为“训练方向、评分标准、可接受的作答、发布状态”等内容语言；
5. 训练任务摘要只保留题目、目标能力、任务用途及可展开的评分依据，避免在编辑区、确认区和发布前检查区重复整段内容；
6. 材料页不再模拟审核页的逐步流程，也不显示没有独立操作的阶段标签；任务摘要下直接并列提供“返回修改”和“进入审核发布环节”；
7. “返回修改”只滚动回当前编辑区，不覆盖当前版本；修改并再次保存时保留旧版本，并创建新的待审核版本；
8. “进入审核发布环节”必须携带当前 Plan 与 Material Version 上下文，只把当前批次最新 Question Draft 交给题目审核页；
9. 逐题“审核通过、退回修改、不采用”只在题目审核与发布平台执行；材料页不得复制第二套逐题审核和 Freeze 控件；
10. 页面级验收确认旧“审核训练任务”按钮和内部阶段切换已移除，“返回修改 / 进入审核发布环节”直接可用，审核链接保留正式批次上下文；Production Build 与工作台状态回归 `5 / 5 PASS`。

这次校准只调整页面组织、中文表达和既有审核链路的交接方式，不改变 Plan、Question Draft、Review、Freeze、Registry 或 Observation Link 的权威边界。

题目审核与发布平台的页面规范与“素材资源录入平台”保持一致：顶栏内容最大宽度使用 `1360px`，主体内容最大宽度使用 `1200px`，同时采用白色吸顶顶栏、浅灰页面背景、白色工作区、6px 圆角和绿色主操作；审核批次采用“题目导航 + 当前题目内容与评分标准 + 审核操作”的结构。该规范只作用于带 Plan 上下文进入的审核模式，通用题目录入工作台保持原有入口和功能。

### 2026-07-24 题目审核与发布平台校准记录

题目审核与发布平台继续复用 Phase 16.1 的 Draft、Validation、Review、Freeze 与 Version 事实，但页面只向内容审核人员暴露可理解、可执行的产品语言：

1. 当前批次只显示“本批题目、待处理、审核通过、已发布”四项统计；待处理使用黄色，审核通过和已发布使用绿色；
2. 状态优先级固定为 `已发布 > 审核通过 > 待审核 > 草稿`；已经发布的题目不得继续显示为“审核通过”，顶部统计不得将同一道题同时计入审核通过与已发布；
3. 审核操作按依赖关系递增出现：先“保存并检查题目”，检查通过后出现“提交题目审核”，提交后出现“通过、退回修改、不采用”，审核通过后出现“发布为正式题目”；
4. 当前可执行步骤使用绿色编号、标题与主按钮；尚不可执行的动作不提前展示，已完成步骤使用浅绿色摘要；
5. “退回修改”表示保留题目并允许修改后重新提交；“不采用”表示停止本次发布、保留审核记录，需要继续使用时基于原内容创建修订稿；
6. “草稿、待审核、退回修改、审核通过、不采用、已发布”等状态标签统一使用 `14px`，页面不显示 `Draft`、`Freeze`、`frozen`、Registry ID 等内部表达；
7. 发布成功后保持在当前审核流程并直接显示“已发布”，不得自动切换到学生预览；
8. 正式资源内部 ID 默认隐藏；只有同一资源存在两个及以上版本时才显示“版本历史”，并使用“第 N 版、已发布”等中文表达；
9. 题目导航显示“题目一 / 题目二 / 题目三”、实际题干、能力标签和当前状态；发布状态根据 Frozen Version 事实计算，不只读取 Draft Review 状态；
10. “保存修改”只保存当前草稿，不自动提交或发布；已有正式版本继续生效，修改后必须重新检查并提交审核。

这次校准只改变信息层级、状态投影、操作显隐和产品文案，不改变 Question Draft、Validation、Review、Frozen Resource、Registry 或 Version History 的权威事实与不可变边界。

固定主流程：

```text
选择或录入已校对 Material
-> 自动分段并生成 Structure Snapshot
-> 在原文中选择 Source Anchor
-> 为同一材料建立 3—6 个 Observation Task Plan
-> 自动形成 Phase 16.1 Draft 基础数据
-> 集中校验并原地修复
-> 批量提交人工审核
-> 逐题确认 Freeze
-> 自动建立 ResourceObservationLink
```

第一版只需支持：

- 选择 Material Version；
- 阅读材料正文与段落编号；
- 在原文中直接建立 Source Anchor；
- 审查七个一级 Dimension；
- 在同一材料下批量建立、编辑和复核 3—6 个 Observation Task Plan；
- 自动继承 Material、Anchor、Dimension、Ability、TaskRole、Difficulty 与追溯 ID；
- 生成 Phase 16.1 Draft，并集中显示校验问题；
- 逐题预览 Question、Rubric、AnswerAcceptance、最低作答要求与正式化状态；
- 校验失败时原地修复，单题失败不阻断同批其他 Draft；
- 跳转 Existing Question Intake Workspace；
- 查看 Frozen Resource 与 Observation Link 状态；
- 查看 Pack 范围、纵向学习链和 Ability × Dimension Breakdown。

系统自动负责：

- Material 身份、版本与段落结构；
- Anchor 位置、内容哈希与追溯 ID；
- Plan、Task、Draft 与 Link 的确定性身份；
- 受控枚举和基础元数据继承；
- Freeze 后的 Observation Link；
- Coverage 与 Dimension Breakdown 重算。

内容人员只负责：

- 判断材料是否适合；
- 确定观测目标和能力动作；
- 编写与修改题干、Rubric 和 AnswerAcceptance；
- 判断 TaskRole、Difficulty 与任务差异是否合理；
- 完成人工审核与逐题 Freeze 确认。

页面不得：

- 自动冻结资源；
- 直接编辑 Frozen Resource；
- 展示学生 Profile 或 Evidence；
- 用一个覆盖百分比隐藏 Material 和 Dimension 分布；
- 将自由文本 Focus 当作正式标签；
- 在前端自行判断 Plan 是否 reviewed。

页面还不得要求内容人员理解 Repository、Manifest 内部字段或 Runtime ID，也不得把批量提交解释为批量自动审核或自动 Freeze。

## 十九、验收标准

### 19.1 Contract 验收

- Observation Dimension V1 定义与边界冻结；
- `plot / structure`、`fact / causality`、`character / theme` 具有可审查区分；
- MaterialObservationPlan、ObservationTaskPlan、SourceAnchor 与 ResourceObservationLink Schema 冻结；
- Ability、TaskRole、Difficulty 复用 Existing Contract；
- Plan、Draft、Frozen Resource、Link 和 Manifest 职责明确。

### 19.2 工程验收

- 26 个 Deterministic Debug Cases 全部通过；
- Existing Phase 16.1 Admission 回归通过；
- Phase 17.1 Coverage 回归保持 `22 / 22 PASS`；
- Invalid Plan / Link 对 Resource Repository 零污染；
- 相同输入重复执行保持稳定 ID 与幂等；
- Production Build PASS；
- 本阶段不要求调用 DeepSeek Live Provider。

### 19.3 Resource Pack 验收

- 形成 24—28 道 Registry current Frozen Resource；
- 形成 4 个核心 Material Cluster 和 1—2 个独立新材料 Cluster，总计 5—6 个；
- 六项 Ability 在整个 Pack 层面达到 10.1 的受控分布，不要求逐能力补齐三种 TaskRole；
- 至少形成 2 条 `Training -> Retest` 和 2 条 `Training -> Transfer` 资源链；
- 至少形成 1 条由正式 Strategy 驱动的跨能力连续学习路径；
- 首批 Pack 中 100% Material Version 具有 reviewed Observation Plan；
- 首批 Pack 中 100% Resource Version 具有 active Observation Link；
- 100% 具有来源、Rubric、AnswerAcceptance、Review、Version 和 Registry 追溯；
- 不使用能力、角色、难度或 Material 错位资源凑配额。

### 19.4 Observation Quality 验收

- 每个 Task Plan 只有一个 primaryDimension 和 primaryAbility；
- Source Anchor 与 Material Version 一致；
- 同 Dimension 不同 Ability 的任务具有真实认知动作差异；
- 同 Ability 的 Dimension 分布可以查询；
- 单一 Dimension 集中时显示限制；
- 材料不支持的组合允许留空；
- Observation Diversity 不改写 Phase 17.1 Coverage 状态；
- Observation Metadata 不直接生成 Evidence 或 Profile 结论。

### 19.5 人工与浏览器验收

- 代表性任务完成内容审核；
- 最小资源生产工作台的 PC / Tablet 轻量操作通过；
- Plan -> Draft -> Review -> Freeze -> Link 路径人工验收通过；
- Pack Manifest 与 Registry current head 一致；
- Coverage Recalculation 与 Dashboard 一致；
- 页面不暴露不相关学生数据或 Runtime 内部教育结论。

### 19.6 资源生产效率验收

- 工作台遵循“可选择则不手填”的交互原则：受控枚举、固定数量、能力、方向、角色、难度与类型优先使用标签、分段按钮或下拉选择，不要求内容人员记忆并输入内部代码；
- 只有材料正文、题目、学生动作、设计说明、评分要点和答案样例等开放内容允许自由填写；所有开放输入必须提供与当前字段匹配的中文示例或格式提示；
- 工作台辅助说明和标签字号不得低于 `12px`，普通正文不得低于 `14px`，前端源码不再使用低于 `12px` 的显式字号；
- 同一区域内并列展示多个数量时，统一使用“名称（数量）”格式，例如“生成（4）· 可导入（3）· 疑似重复（0）”；不混用“名称 4”“4 个名称”或单位前置等统计版式；
- 页面标签使用产品语言，正式 Schema、内部 ID 与 Runtime 语义继续由 Adapter 和 Application Service 维护，不得为了简化页面而放宽正式 Contract；
- 一篇已经校对的 Material 应在 15—30 分钟内形成 3—6 道可审核 Draft；
- Material、Anchor 与基础元数据无需在同一材料的多道题中重复填写；
- 内容人员在一个主生产入口和 Existing Question Intake 审核入口内完成任务，不在多个独立 Workspace 之间往返；
- 校验错误能够定位到具体题目和字段，并允许原地修复；
- 枚举或范围校验失败时，页面必须同时展示“模型实际填写值、当前允许值或有效范围、用户当前可执行的操作”；不得只显示“超出范围”或“不在允许范围”等无法执行的结论；
- 不改变教育语义的受控字段别名可由 Adapter 确定性归一；涉及不存在段落、题意变化或教育判断的错误不得自动猜测修复，必须隔离并引导重新生成；
- 生产工作台按“生成、编辑、审核与发布”三个主要区域组织，使用统一白色容器、响应式内边距和克制圆角；不得通过重复标题、重复状态或大面积边框增加无效层级；
- AI 生成区、训练任务编辑区与审核区的动作名称必须一致：`AI 生成训练任务 -> 保存训练任务 -> 提交审核 -> 审核题目 -> 发布任务`；完成后使用“已生成、已保存、已提交、已审核、已发布”说明结果；
- 正常状态不重复展示可由按钮状态或顶部版本标签推断的信息；结构校验失败时，问题与可执行操作必须紧邻被阻断的主按钮；
- 审核区默认外显正式题目，Ability 与 TaskRole 使用辅助标签；Anchor、作答要求、设计说明、Rubric 与答案示例按需展开，不完整复制上方编辑区；
- 单版本只显示只读版本状态，多版本才提供版本选择；`未提交审核` 等状态使用独立标签，不以内部状态码或技术对象名面向内容人员；
- 长题目和开放文本输入必须支持自适应高度；工作台头部在长页面滚动时保持可见，桌面与平板不得产生横向溢出；
- 单题失败不污染 Material、其他 Draft、Frozen Resource、Registry 或 Manifest；
- 批量提交可以提高审核准备效率，但每道资源仍需正式人工确认后才能 Freeze；
- Freeze 后 Link 与覆盖重算自动完成，不要求人工复制内部 ID；
- 实际生产过程中记录每篇材料耗时、重复填写项、主要失败原因和页面跳转次数，作为是否继续优化 Workspace 的依据。

## 二十、Phase 17.2 停止与冻结条件

满足以下条件后，Phase 17.2 必须停止扩展并立即进入冻结与 Phase 17.3：

1. 形成 4 个核心 Material Cluster 和 1—2 个独立新材料 Cluster，总计 5—6 个；
2. 形成 24—28 道 Registry current Frozen Resource；
3. 100% Material Version 具有 reviewed Material Observation Plan；
4. 100% Pack Resource 具有 active ResourceObservationLink；
5. 来源、Rubric、AnswerAcceptance、Review、Version 与 Registry 追溯完整；
6. 代表性 Dimension × Ability 内容审核完成；
7. 最小资源生产工作台达到 19.6 的效率与错误恢复要求；
8. Plan -> Draft -> Review -> Freeze -> Link 浏览器验收通过；
9. Coverage、Manifest 与 Dimension Breakdown 和 Registry current head 一致；
10. Debug、回归、IndexedDB Smoke 与 Production Build 通过。

达到上述条件后，不得因为 Workspace 还能更美观、Manifest 还能增加字段、Focus 还能形成 taxonomy、Diversity 还能建设完整 Dashboard、OCR 或 AI 自动出题尚未加入而延长 Phase 17.2。

工作台后续只在真实资源生产出现阻断时修复：无法录入、无法定位缺失字段、无法预览正式候选、无法交接审核/Freeze、无法定位错误。纯视觉美化、通用 CMS 能力、更多管理视图和新增辅助对象均不属于冻结前任务。

资源质量优先于数量。若为了达到 24 道必须使用能力、角色、难度或材料错位资源，则不得冻结；应保留明确 Gap，而不是降低标准。达到 24 道且纵向链路、整体能力分布和追溯要求成立后即可冻结，不得为了接近 28 道继续扩题。

## 二十一、明确实现了什么

Phase 17.2 完成后，系统将第一次具备：

1. 基于 Material Version 的正式观测设计；
2. 受控一级 Observation Dimension；
3. Dimension × Ability × TaskRole 的任务规划；
4. 材料位置与任务设计的版本追溯；
5. Plan 到 Existing Phase 16.1 Draft 的受控适配；
6. Frozen Resource Version 到 Observation Plan 的不可变 Link；
7. 第一批 24—28 道正式资源包；
8. Ability × Observation Dimension 的资源偏斜审查；
9. Phase 17.3 可以直接消费的正式 Registry 与 Pack Manifest。

## 二十二、明确不能做什么

Phase 17.2 不能：

- 证明学生已掌握某个 Observation Dimension；
- 将 Dimension 直接写入 Profile 或 GrowthMemory；
- 改变 Evidence 权重；
- 根据资源标签生成 AbilityEvidence；
- 把 observationFocus 作为 TaskRequest 隐藏硬约束；
- 绕过 Phase 16.1 Validation / Review / Freeze；
- 绕过 Phase 16.2 Resource Matching；
- 自动判定 Retest 可比或 Transfer 新颖；
- 自动冻结 AI 生成题目；
- 要求每篇材料填满 Dimension × Ability 矩阵；
- 建设大规模题库、复杂知识图谱或自动题目难度模型；
- 建设通用 CMS、长期内容运营后台或多角色权限系统；
- 为 Material、Observation、Pack、Manifest 与 Diversity 分别建设独立复杂 Workspace；
- 将 Observation Focus 扩展为全局 taxonomy；
- 继续新增不满足 V1 对象准入条件的 Plan、Candidate、Decision 或 Snapshot；
- 建设独立完整的 Observation Diversity Dashboard；
- 代替 Phase 17.3 真实 Runtime 集成；
- 代替 Phase 16.3C 的 5—7 个自然日真实运行。

## 二十三、失败与阻断规则

以下情况阻断 Plan Review：

- Material Version 或 Structure Snapshot 缺失；
- Source Anchor 错位；
- 一级 Dimension 非法；
- selected Dimension 无材料依据；
- Ability、TaskRole 或 Difficulty 未注册；
- 一项 Task Plan 存在多个主要 Dimension；
- Material Version 已变化但 Plan 未复核。

以下情况阻断 active ResourceObservationLink：

- Plan 未 reviewed；
- Frozen Resource 不存在或非 current；
- Resource 与 Task Plan 身份错位；
- Material Version 不一致；
- Review / Validation 不可追溯。

阻断后：

```text
preserve Plan / Draft / Frozen facts
-> status = revision_required / invalid / review_required
-> do not mutate Registry
-> do not create Manifest entry
-> do not create Evidence
```

## 二十四、完成声明

Phase 17.2 完成后可以宣称：

> 系统能够先基于正式材料建立受控、可审核的观测设计，再将 Observation Dimension、Ability Action 与 TaskRole 转化为 Phase 16.1 可冻结的 Question Resource；首批 24—28 道正式资源具有完整材料、观测计划、Rubric、Review、Version、Registry 和 Observation Link 追溯，并形成足以验证 Training、Retest、Transfer 与跨能力连续学习的最小资源生态。

仍不能宣称：

- Observation Dimension 已成为正式 Profile 维度；
- 某项 Ability 已在所有 Dimension 中稳定；
- 资源设计标签已经构成学生 Evidence；
- Retest 可比性或 Transfer 新颖性已对所有运行成立；
- Phase 17.3、Phase 17 或自然日验收已经完成。

## 二十五、首批正式资源生产前置条件

Phase 17.2 Runtime 工程基础已经通过。开始首批 4 个核心 Material Cluster、1—2 个独立新材料 Cluster 与 24—28 道正式资源生产前应满足：

1. Phase 17.1 Coverage Dashboard 轻量人工 Demo PASS；
2. Observation Dimension V1 的七项定义完成产品与教育评审；
3. 确认使用独立 `ResourceObservationLink`，不静默修改历史 Frozen Resource；
4. 确认首批 Material 来源、版权和人工审核责任；
5. 确认 24—28 道是受控范围：达到 24 道且关键链路成立即可停止，不得为了达到上限降低质量或继续扩题；
6. 在正式录入前冻结 [首批正式资源包生产蓝图](./phase17_2_first_resource_pack_blueprint.md) 的 Batch A 规划行，能够解释每道题的 Observation、Ability、TaskRole、规划链和 Strategy 请求理由。
## 2026-07-26 审核交接幂等修复

素材资源录入平台到题目审核平台的真实交接已完成专项修复：

- Observation Plan 预览校验与提交审核复用同一 Revision 的 Validation；
- 点击“确认训练任务并进入题目审核”可正常进入逐题审核页面；
- Question Resource Admission Debug 更新为 `23 / 23 PASS`；
- Material Observation Debug 更新为 `27 / 27 PASS`；
- Material Resource Production 回归保持 `13 / 13 PASS`。

完整记录见：
[Phase 17 训练任务到题目审核交接修复记录](./reports/phase17_review_handoff_idempotency_fix_2026-07-26.md)

## 2026-07-27 素材先行与当前素材范围控制

素材资源录入平台已从全局库存统计改为素材先行的单素材工作流：

```text
选择已有素材 / 保存新素材
-> 建立 Current Material Context
-> 展示该素材的待审核题目与已发布练习
-> 解锁 AI 生成、训练任务编辑、覆盖检查和审核发布
```

正式产品规则如下：

1. 页面初次进入时不得自动选中第一篇素材，内容人员必须明确选择已有素材或录入新素材；
2. 未选择素材时，只展示素材选择、素材录入入口和操作提示，不展示 AI 生成、训练任务编辑、覆盖检查或审核发布模块；
3. 选择素材后，待审核数量、已发布数量及其展开明细必须按当前 `materialVersionId` 过滤，不得混入其他素材；
4. 切换素材时关闭上一素材的展开明细，避免旧上下文残留；
5. 全局材料、题目和发布库存仍可由 Repository 计算，但不在素材录入平台作为主要操作入口；未来应由独立资源总览或 Coverage Dashboard 承担；
6. 当前素材、待审核题目、已发布练习和删除或停用操作使用同一响应式状态行；数量右侧使用三角标展开明细，透明背景且不依赖分割线表达层级；
7. 新素材录入期间只展示素材表单；保存并成为当前素材后，才进入后续资源生产流程。
8. 素材入口明确拆分为“已有素材”“录入新素材”“已停用素材”三个并列模式；停用素材是独立的低频管理模式，不附着在已有素材内容区；
9. 进入“已停用素材”时只显示停用列表与逐条“重新启用”操作，不建立 Current Material Context，也不显示 AI 生成、训练任务编辑、覆盖检查或审核发布模块；
10. 已经进入训练任务或题目链的素材只能停用，停用后保留材料、训练任务、题目与历史来源关系；重新启用只把对应 Material Version 恢复为 active，不重建或覆盖历史对象；
11. 只有不存在 Observation Plan、Anchor、Question Draft 或 Frozen Version 依赖的未使用素材才允许直接删除。

本次调整不修改 Material、Observation Plan、Question Draft、Review、Freeze、Registry、Observation Link 或 Learning Runtime 的正式语义，只收紧工作台的上下文范围和模块可见性。

验收结果：

- 未选择素材：下游生产模块不可见，操作提示可见；
- 选择《散步》或“站台上的蓝布包”：数量与明细只属于当前素材；
- 录入新素材：保存前仅显示素材表单，保存并选中后才显示后续模块；
- 已停用素材：两条停用记录分别显示独立“重新启用”操作，恢复后回到已有素材库存，历史训练与题目记录保持不变；
- 当前素材范围专项 Debug `9 / 9 PASS`；
- Production Build `PASS`，保留既有非阻断 Bundle Warning。
