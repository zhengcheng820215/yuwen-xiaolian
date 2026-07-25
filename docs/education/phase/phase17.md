# Phase 17：学习资源覆盖扩展与基于材料的能力观测基础

英文定位：Learning Resource Coverage Expansion and Material-grounded Ability Observation Foundation

设计状态：ACCEPTED

工程状态：IN PROGRESS（17.1 ENGINEERING + HUMAN DEMO PASS / INDEXEDDB SMOKE PENDING；17.2 RUNTIME + MINIMAL PRODUCTION WORKSPACE ENGINEERING PASS、ASSISTED DRAFT GENERATION 38 / 38 PASS、CONTROLLED LIVE EFFECTIVENESS PENDING、BATCH A 8 / 8 FORMALIZED；17.3 WORK PACKAGE A 17 / 17 PASS、CONTROLLED LIVE 3 / 3 PASS、BATCH A `/learning` SINGLE-ROUND DEMO PASS；17.4A ENGINEERING + AUTOMATED DEBUG 9 / 9 PASS、STANDARD-BROWSER BASELINE CUTOVER PASS / DUAL-BROWSER HUMAN CHECK PENDING；17.4B PLANNED / P2；17.5A ENGINEERING + AUTOMATED DEBUG 12 / 12 PASS，17.5B REVIEW CONSUMPTION + AUTOMATED DEBUG 9 / 9 PASS，17.5C PENDING / P1）

前置状态：Phase 16.1 与 Phase 16.2 已完成；Phase 16.3A / B 已冻结，Phase 16.3C 工程与轻量人工验收已通过，5—7 个自然日真实运行仍为 `PENDING (0 / 5)`。

## 一、阶段定位

Phase 16 已经证明：

```text
Structured Question Draft
-> Validation / Human Review
-> Frozen Question Resource
-> Resource Registry
-> Resource Matching Quality Gate
-> Executable Learning Task
-> Real Learning Runtime
```

系统已经具备正式资源准入、版本冻结、可解释匹配和真实学习运行基础。

但当前正式资源数量和覆盖仍然有限。当 `NextLearningStrategy` 形成新的 `TaskRequest` 时，系统可能因为缺少对应能力、任务角色、难度或材料关系的正式资源而阻断。此时短板不是 Runtime 无法运行，而是缺少能够被 Runtime 安全消费的资源生态。

Phase 17 不建设大型题库，也不追求资源总量。

Phase 17 的任务是：

1. 以 Material Cluster 组织材料选择、任务设计和覆盖规划；
2. 建立 Material -> Observation Dimension -> Ability Action -> Question Resource 的设计关系；
3. 定义“资源覆盖成立”的正式标准；
4. 建立第一批覆盖核心能力、材料观测维度与主要任务角色的小型 Frozen Resource Pack；
5. 让 Runtime 能够依据正式 Registry 识别覆盖、薄弱覆盖和资源缺口；
6. 验证上一轮正式结果能够在多个能力与任务角色下匹配到下一道真实资源；
7. 用真实资源建设反向检验能力边界、观测维度、Rubric 质量和任务角色区分。

## 二、一句话定义

> 以 Material 作为语境载体，以 Observation Dimension 定义观察对象，以 Ability Action 定义学生需要完成的认知活动，再由 Frozen Question Resource 将观测目标转化为可审核、可匹配、可执行的任务入口。

Phase 17 的核心目标声明：

> Phase 17 的目标不是扩充题目数量，而是建立以 Material Cluster 为组织基础、以能力观测为目标、能够被正式 Runtime 消费和验证的第一套学习资源体系。

因此，题目数量只能作为资源包规模记录，不能单独构成阶段完成条件。只有材料组织、观测目标、正式准入、Registry 追溯、Runtime 匹配和真实执行验证同时成立，Phase 17 才能完成。

## 三、与既有 Phase 的承接关系

### Phase 8 / Phase 14

`NextLearningStrategy` 仍然是教育方向来源，`AdaptiveTaskConstraints` 仍然是结构化约束来源。

Phase 17 不根据现有题目反向修改 Strategy，也不为了提高资源命中率静默降低能力、任务角色、难度、材料或提示约束。

### Phase 16.1

Phase 17 的每一道正式资源必须继续经过：

```text
Draft
-> Validation
-> Human Review
-> Frozen Version
-> Resource Registry Current Head
```

Phase 17 不建立第二套题目录入、审核、冻结或版本协议。

### Phase 16.2

Phase 17.3 必须复用 Existing Resource Matching Quality Runtime。

资源覆盖报告只说明“当前资源池是否具备满足条件的候选资源”，不能绕过 16.2 的 Eligibility、Quality Gate 和四类正式结果：

- `matched`；
- `partial_match`；
- `no_match`；
- `review_required`。

### Phase 16.3

Phase 17 首批资源将成为真实多日运行的正式内容基础。

Phase 17 可以在 Phase 16.3C 自然日验收开始前完成资源建设与接入，但不能替代 5—7 个自然日真实运行验收。自然日验收仍应基于同一稳定构建和同一冻结资源基线开始计时。

## 四、Phase 17 只回答的问题

Phase 17 回答：

1. 当前正式资源来自哪些 Material Cluster，并覆盖了哪些能力、任务角色、难度和作答形式？
2. 哪些覆盖已经可执行，哪些只是数量存在但不能被 Runtime 消费？
3. 第一批 24—28 道资源如何形成足以驱动连续学习的最小资源生态？
4. Retest 和 Transfer 是否具有必要的材料关系和独立观察价值？
5. 找不到合适资源时，系统能否形成明确缺口，而不是使用能力错位资源凑匹配？
6. 新资源进入 Registry 后，覆盖报告和匹配结果能否稳定更新？
7. 同一材料能够提供哪些有价值的观测维度，同一维度可以承载哪些不同能力动作？
8. 同一能力是否过度集中在单一观测维度，形成“题量充足但观察面单一”的虚假覆盖？

Phase 17 不回答：

- 学生是否因这批资源获得长期能力提升；
- 资源数量是否足以支持大规模商业化使用；
- 题目难度是否已经完成统计标定；
- 是否已经具备自动出题、无限内容生成或自动冻结能力；
- 是否已经支持完整题库运营、版权协作和多人权限；
- 是否已经证明所有结构化题型在正式学生端完成端到端验收；
- Observation Dimension 是否已经可以直接更新 Profile 或形成长期能力结论。

## 五、阶段闭环与当前顺序

```text
Phase 17.1 Resource Coverage Contract
↓
Phase 17.2 First Frozen Resource Pack
↓
Phase 17.3 Runtime Coverage Integration
↓
Phase 17.4A Shared Store Cutover
↓
Phase 17.5 Question Generation Quality Assessment
↓
Phase 17.2 Batch B / C Resource Production
↓
Phase 17 Acceptance / Freeze

Phase 17.4B Migration and Recovery Hardening
-> P2 非阻塞增强
```

Phase 17.5 是对 17.2 题目生成能力的质量增强，不是第二套资源模型。它复用现有 Question Metadata，在 Draft Contract Validation 与 Human Review 之间增加绑定 Draft Revision 的独立质量评估；它不替代 16.2 的正式资源匹配质量门。

各子阶段具有明确依赖，其中 17.4B 是不阻塞资源生产的后续增强：

- 17.1 先定义什么叫覆盖，防止只追求题目数量；
- 17.2 以 Material Cluster 为生产单位，先建立 Material Observation Plan，再按正式覆盖缺口建设首批资源；
- 17.3 证明资源能够被真实 Strategy、TaskRequest 和 TaskFulfillment 消费，并验证观测维度引用在正式执行链中保持可追溯。
- 17.4A 先把正式资源事实从浏览器私有 IndexedDB 迁移到本机 Shared Store，经统一 Local API 和 Repository Boundary 读写；完成双浏览器一致读取、受控基线导入与基本备份后，即可恢复规模化录题。
- 17.4B 在稳定录入恢复后，再补齐复杂迁移报告、冲突分析、历史快照、自动备份与恢复能力；该工作包不阻塞 17.4A 通过后的正常资源生产。
- 17.5 在继续生产 Batch B / C 前评估结构合法 Draft 的材料支持、观察清晰度、区分潜力和审核价值，减少低价值候选进入人工审核。

## 六、Material First 与权威数据关系

### 6.1 三种基本单位

Phase 17 正式采用 Material First，但必须区分三种不同职责：

| 单位 | 正式职责 |
| --- | --- |
| Material Cluster | 内容规划、材料关系、资源生产与覆盖聚合的一级单位 |
| Frozen Question Resource | 校验、审核、版本冻结、Registry 和 TaskFulfillment 匹配的最小正式资源单位 |
| ConcreteLearningTask | 某一 LearningRound 中供学生执行的任务实例 |

因此，Phase 17 的长期内容链是：

```text
Material Cluster
-> Passage / Material Version
-> Material Observation Plan
-> Frozen Question Resources
-> Concrete Learning Tasks
-> Student Responses
-> Ability Evidence
```

Material Cluster 成为一级内容对象，不表示 Evidence 可以由 Material 直接产生，也不表示 Phase 17 可以绕过 Question Resource 的 Review、Version、Rubric 和 Registry Contract。

### 6.2 内容生产与正式覆盖

内容生产采用：

```text
Coverage Objective
-> Material Cluster Plan
-> Material Intake / Review
-> Material Structure / Source Anchors
-> Material Observation Plan
-> Observation Task Plan
-> Question Resource Drafts
-> Validation / Human Review / Freeze
```

正式覆盖仍然采用：

Phase 17 必须保持以下权威顺序：

```text
Resource Registry Current Frozen Versions
↓
Resource Coverage Report
↓
Resource Coverage Dashboard
```

其中：

- `Resource Registry` 是正式资源事实来源；
- `Resource Coverage Report` 是基于 Registry Snapshot 的确定性派生结果；
- `Resource Coverage Dashboard` 只是 Report 的可视化投影；
- `RESOURCE_COVERAGE_MATRIX.md` 只定义覆盖政策、建设计划和验收标准，不是运行时数据源；
- 页面和匹配 Runtime 不得读取 Markdown 或手工统计结果决定正式任务。

### 6.3 四层观测关系

Phase 17 正式采用以下教育设计关系：

```text
Material / Material Version
-> Observation Dimension
-> Ability Action
-> Question Resource
-> Student Response
-> Diagnosis / Evidence / Profile
```

四层职责必须分开：

| 层级 | 回答的问题 | Phase 17 职责 |
| --- | --- | --- |
| Material | 学生面对什么事实、语境和内容世界 | 提供版本化、可追溯的内容载体 |
| Observation Dimension | 从材料的哪个侧面进行观察 | 标记事实、人物、情节、因果、结构、语言或主题等观察对象 |
| Ability Action | 学生需要如何处理这些内容 | 继续使用 extraction、comprehension、summarization、analysis、inference、expression |
| Question Resource | 如何把观测目标转化为可作答入口 | 通过题干、Rubric、AnswerAcceptance、taskRole 与 difficulty 形成正式任务资源 |

QuestionType 只是呈现和交互形式，不是教育目标，也不得替代 Observation Dimension 或 Ability Action。

### 6.4 Material Observation Plan

Phase 17.2 在 Question Draft 之前引入材料观测设计对象。建议最小结构：

```ts
type ObservationDimension =
  | 'fact'
  | 'character'
  | 'plot'
  | 'causality'
  | 'structure'
  | 'language'
  | 'theme';

type ObservationTaskPlan = {
  observationTaskPlanId: string;
  materialId: string;
  materialVersionId: string;

  primaryDimension: ObservationDimension;
  observationFocus?: {
    focusCode: string;
    displayName: string;
    definition: string;
    scope: 'plan_local';
  };
  abilityId: PrimaryAbilityId;
  taskRole: RecommendedTaskRole;
  difficulty: QuestionResourceDifficulty;

  sourceAnchorIds: string[];
  designReason: string;
};

type MaterialObservationPlan = {
  materialObservationPlanId: string;
  materialId: string;
  materialVersionId: string;
  status: 'draft' | 'reviewed' | 'superseded';
  selectedDimensions: ObservationDimension[];
  taskPlans: ObservationTaskPlan[];
  reviewedAt?: string;
};
```

字段与状态以 [Phase 17.2](./phase17_2.md) 的正式设计为准。

边界：

1. `primaryDimension` 是受控一级维度；每个 Task Plan 只能有一个主要维度；
2. `observationFocus` 用于描述人物心理、动作原因、言外之意等更具体观察重点，但 Phase 17 第一版不将其作为 Coverage denominator 或正式匹配硬约束；
3. Plan 必须绑定 `materialVersionId` 和材料位置引用，材料版本变化后必须复核，不得继续静默使用旧锚点；
4. Plan 是内容设计和 Review 输入，不是 Frozen Question Resource，也不能直接进入 TaskFulfillment；
5. 只有经过 Phase 16.1 Validation、Human Review 和 Freeze 的 Question Resource 才能进入 Registry 与正式 Coverage；
6. 材料维度或任务计划本身不能生成 Diagnosis、Evidence 或 Profile Update。

### 6.5 非机械填充原则

同一材料理论上可以组合多个 Observation Dimension 与 Ability Action，但 Phase 17 禁止为了矩阵完整机械生成任务。

应先识别材料真正具有教育价值的观测维度，再为这些维度选择合适的能力动作。每个 Material Cluster 建议形成 3—6 道任务；数量不是硬性覆盖门槛，材料不支持的组合必须保留为空，而不是用低价值问题填满。

资源矩阵的作用是检查覆盖与偏斜，不是要求每篇材料完成：

```text
7 Observation Dimensions
x 6 Ability Actions
```

任何组合只有在材料事实、题目要求、Rubric 和 AnswerAcceptance 均成立时才能进入 Draft。

## 七、覆盖矩阵

### 7.1 Material Cluster 维度

Coverage 必须同时回答：

- 当前有多少道可执行 Question Resource；
- 这些资源来自多少个 Material Cluster；
- 能够形成多少个可验证的独立观察 Context；
- 各 Material Cluster 实际承载了哪些能力与任务角色。

例如，`inference` 有 20 道资源，但全部来自同一篇材料，不能被解释为广泛覆盖。Dashboard 至少应同时显示：

```text
Inference
- executableResourceCount: 20
- materialClusterCount: 1
- independentContextCount: 1
```

同一 Material Cluster 可以设计多个能力任务，但不得为了提高覆盖数字强制一篇材料覆盖所有能力。每个任务都必须由材料内容、题目要求和 Rubric 支持。

### 7.2 能力维度

首批矩阵沿用当前受控能力集合：

| abilityId | 学生可读名称 |
| --- | --- |
| `extraction` | 信息提取 |
| `comprehension` | 理解 |
| `summarization` | 概括 |
| `analysis` | 分析 |
| `inference` | 推理 |
| `expression` | 表达 |

Phase 17 不在资源建设阶段新增能力 ID。若资源审核持续暴露能力边界重叠，应形成能力模型复核事项，不得由内容人员临时创造新标签。

### 7.3 任务角色

正式矩阵保留当前五种任务角色：

| taskRole | Phase 17 定位 |
| --- | --- |
| `training` | 建立与巩固当前能力动作 |
| `retest` | 在可比较条件下重新观察 |
| `transfer` | 在新材料或新情境中验证迁移 |
| `diagnosis` | 补充区分性诊断观察 |
| `observation` | 收集当前证据不足的正式观察 |

首批资源包优先完成 `training / retest / transfer`。`diagnosis / observation` 只为优先能力补充少量资源，但 Dashboard 必须继续显示其覆盖缺口，不能从正式矩阵中删除。

### 7.4 难度与作答形式

难度沿用：

- `basic`；
- `intermediate`；
- `advanced`。

首批资源以 `basic / intermediate` 为主。`advanced` 未覆盖时必须明确显示为 Gap，不能因为第一批资源未规划就被视为已满足。

当前正式准入 Contract 支持：

- `multiple_choice`；
- `true_false`；
- `fill_blank`；
- `open_short_answer`；
- `reading_comprehension`。

但资源 Schema 支持不等于学生产品链已经完成验收。Phase 17 首批正式 Pack 以已证明可被当前学生端、Validity、Diagnosis、Evidence 和 Feedback 链消费的 `open_short_answer / reading_comprehension` 为主。

选择、判断和填空只有在对应学生端渲染、提交、有效性校验、Diagnosis / Evaluation 与反馈链完成专项验收后，才可以计入“产品端可执行覆盖”。

### 7.5 非笛卡尔积原则

完整组合为：

```text
6 abilities
x 5 task roles
x 3 difficulties
x 5 structured question types
```

Phase 17 第一版不要求填满全部组合，也不得把“矩阵存在”理解为要生成所有组合。

第一版只建设经过教育判断的最小必要单元，并为每个未覆盖单元保留明确状态：

- `covered`：有足够的当前可执行资源；
- `thin`：有资源，但数量、独立材料或难度不足；
- `gap`：没有满足条件的当前资源；
- `blocked`：存在资源，但因审核、版本、Rubric、题型链路或匹配条件无法使用；
- `not_planned`：当前版本明确不建设，但不得计入已覆盖。

### 7.6 Observation Dimension 的规划与覆盖边界

同一 Ability 下可能存在不同的真实观察重点。例如 `inference` 可以包含人物心理、动作原因、情节推断、言外之意等不同观察方向。

Phase 17.2 使用受控一级 `ObservationDimension` 建立 Material Observation Plan，并通过 `observationFocus` 保留更具体的设计意图。但 Phase 17.1 已通过的 Primary Cell 继续保持：

```text
abilityId + taskRole
```

Observation Dimension 在 Phase 17 中形成独立的多样性与偏斜视图，但不改变 `covered / thin / gap / blocked / not_planned` 的正式状态分母，也不静默替换 Existing Resource Matching Contract。

第一批 Frozen Resource Pack 完成后，应根据真实资源、审核争议和执行结果评估是否在后续 Phase 建立正式的：

```text
Ability
-> Observation Dimension
-> TaskRole
-> Difficulty
-> Material Context
```

不能由内容人员临时创建一级 Observation Dimension，也不能在 Phase 17 中以自由文本 `observationFocus` 影响 TaskFulfillment、Evidence 权重或 Profile 更新。

Coverage Dashboard 可以增加非权威的观测多样性视图，例如：

```text
Inference
- character: 4
- causality: 2
- structure: 0
- language: 0
```

该视图只能揭示资源偏斜。即使 `inference` 题目数量达到 Policy 门槛，如果全部集中在 `character`，系统也只能说 Primary Coverage 达标、Observation Diversity 受限，不能宣称推理能力观察已经广泛覆盖。

## 八、正式覆盖定义

一条资源只有同时满足以下条件，才可计入正式可执行覆盖：

1. Registry 指向当前版本；
2. 当前版本为审核有效的 `frozen / active` 资源；
3. resource、version、material、ability 与 taskRole 身份一致；
4. 主要能力、任务角色和难度使用当前受控值；
5. Rubric、AnswerAcceptance、来源和必要追溯字段完整；
6. 未被 `superseded / retired`；
7. 可以被 Phase 16.2 Candidate Adapter 与 Core Eligibility 消费；
8. 对应作答形式已被当前正式学生链路接受，或被明确标记为仅资源侧覆盖；
9. 不存在阻断执行的 Review 或质量限制。

因此：

```text
Raw Question Count
!= Frozen Resource Count
!= Current Executable Coverage
!= Independent Observation Coverage
```

## 九、材料独立性与可比性

同一材料下的多道题可以覆盖不同能力，但不能自动形成多个独立比较情境。

Phase 17 至少保留：

- `materialId`；
- `materialClusterId`；
- `taskRole`；
- `difficulty`；
- `responseFormat`；
- 与基线任务的材料关系；
- 是否属于重复执行或同质观察。

规则：

1. `training` 可以在同一材料内安排多个不同能力任务，但每题必须有独立 Rubric 和主要能力；
2. `retest` 应保持目标能力和核心任务要求可比较，但不得只是原题重复或旧 Evidence 换时间戳；
3. `transfer` 必须使用新的材料情境或可验证的新 Context，不得只改变题干措辞；
4. 无法证明材料独立时，默认视为同质限制，不增加独立 Context 数；
5. 多题共享材料不等于多篇材料，也不等于多次独立观察。

## 十、Phase 17.1：资源覆盖契约

核心问题：

> 系统如何用一致、可追溯的方式回答“当前资源池能支持哪些学习请求”？

最小链路：

```text
Resource Registry Snapshot
+ Current Frozen Resource Versions
+ Product-executable Question Type Capabilities
↓
Coverage Eligibility Derivation
↓
Resource Coverage Report
↓
Coverage Dashboard / Resource Gap List
```

17.1 负责：

- 定义 Coverage Cell、Coverage Status 与 Resource Gap；
- 基于 Registry current head 计算资源覆盖；
- 区分可执行资源数、Material Cluster 数和独立观察 Context 数；
- 按 ability、taskRole、difficulty、questionType 和 materialCluster 查询；
- 展示覆盖、薄弱覆盖、阻断和缺口原因；
- 保证相同 Registry Snapshot 得到稳定结果；
- 输出第一批资源建设清单。

建议的最小派生对象：

```ts
type ResourceCoverageCell = {
  key: {
    abilityId: string;
    taskRole: string;
  };

  status: 'covered' | 'thin' | 'gap' | 'blocked' | 'not_planned';
  currentExecutableResourceIds: string[];
  materialClusterIds: string[];
  executableResourceCount: number;
  materialClusterCount: number;
  independentContextCount: number;
  difficultyBreakdown: Record<string, number>;
  questionTypeBreakdown: Record<string, number>;
  responseFormatBreakdown: Record<string, number>;
  limitations: string[];
};

type ResourceCoverageReport = {
  reportId: string;
  registrySnapshotId: string;
  generatedAt: string;
  cells: ResourceCoverageCell[];
  gapCodes: string[];
};
```

字段以工程实现的正式 Schema 为准；文档不要求页面直接消费原始 Registry。

Phase 17.1 的详细 Contract 已进一步明确：Primary Cell Key 为 `abilityId + taskRole`，Difficulty、QuestionType、ResponseFormat 与 Material Cluster 作为 Breakdown，避免重新制造完整笛卡尔积。详见 [Phase 17.1](./phase17_1.md)。

17.1 不负责：

- 创建或冻结资源；
- 修改 Strategy；
- 自动放宽 TaskRequest；
- 计算学生能力；
- 把手工 Matrix 当作正式覆盖事实。

## 十一、Phase 17.2：首批 Frozen Resource Pack

核心问题：

> 如何用一批规模可控、质量可审查的正式资源覆盖核心学习流程？

详细 Contract：[Phase 17.2：材料观测设计与首批正式资源包](./phase17_2.md)。真实内容生产按 [首批正式资源包生产蓝图](./phase17_2_first_resource_pack_blueprint.md) 分 Batch A/B/C 执行；蓝图只管理生产计划和人工验收，不新增 Runtime Schema。

首批范围冻结为 24—28 道当前 Frozen Resource。能力数量按整个 Pack 统计，不要求每个 Material Cluster 覆盖六项能力，也不要求每项能力机械配置完整的 Training / Retest / Transfer 组合。

| 能力 | 建议正式题量 | 最小意图 |
| --- | ---: | --- |
| 信息提取 | 3—4 | 覆盖明确事实与必要条件提取 |
| 理解 | 4—5 | 覆盖句意、行为含义与语境理解 |
| 概括 | 4—5 | 覆盖事件、段意或要点整合 |
| 分析 | 4—5 | 覆盖人物、结构、语言或关系分析 |
| 推理 | 4—5 | 覆盖人物、因果、结构或主题推断 |
| 表达 | 3—4 | 覆盖观点、依据与表达组织 |

首批使用 4 个核心 Material Cluster，并补充 1—2 个具有独立内容语境的新材料 Cluster，用于形成 Retest / Transfer 所需的新观察 Context，总计 5—6 个 Material Cluster。这里的“用于 Transfer”只是首批建设用途，不是 Material Cluster 的永久类型；TaskRole 仍属于具体 Frozen Question Resource。

每个材料通常形成 3—6 个由内容真实支持、目标明确的任务。材料可覆盖记叙、成长、写景、议论或校园生活等内容，但主题数量不是验收指标，也不要求每篇材料机械覆盖六项能力。

首批 Pack 至少形成：

- 2 条完整的 `Training -> Retest` 资源链；
- 2 条完整的 `Training -> Transfer` 资源链；
- 1 条由正式 Strategy 驱动、经过两个或以上 Ability Action 的跨能力连续学习路径。

纵向资源链必须保持能力对齐并使用可验证的独立材料关系。跨能力路径是 Phase 17.3 的集成验收场景，不得由页面或 Resource Pack 写死为固定发题顺序。

首批 Pack 的质量优先于数量。每项资源必须具备：

- 可追溯来源与版权使用说明；
- 当前受控 primary ability；
- 明确 taskRole 与 difficulty；
- 完整 AnswerAcceptance 与 Rubric；
- 对开放题合理异表述的接受边界；
- 与材料事实一致的评价依据；
- 人工 Review 记录；
- Frozen Version 与 Registry Current Head；
- 可解释的材料关系和重复关系。

建设链路：

```text
Coverage Objective / Gap
-> Material Cluster Plan
-> Material Intake / Review
-> Material Structure / Source Anchors
-> Material Observation Plan
-> Observation Task Plan
-> Structured Question Draft
-> Metadata / Rubric Validation
-> Human Review
-> Frozen Version
-> Registry Current Head
-> Coverage Report Recalculation
```

首批 Pack 不只统计 Question Resource 数量，还必须能够回答：

- 每篇材料选择了哪些主要观测维度；
- 每个维度承载了哪些 Ability Action；
- 每道 Question Resource 对应哪个 Observation Task Plan；
- 同一 Ability 是否全部集中在一个 Observation Dimension；
- 哪些理论组合因材料不适合而被主动留空。

同一 Observation Dimension 可以承载不同 Ability，例如 `character` 可以分别形成 extraction、comprehension、summarization、analysis、inference 与 expression 任务；同一 Ability 也应尽可能通过不同 Dimension 观察，例如 inference 可以来自 character、causality、structure、language 或 theme。上述关系用于资源设计和偏斜审查，不代表每种组合都必须存在。

17.2 不允许：

- 为填矩阵而生成教育目标模糊的题目；
- 一篇材料轻微改写后冒充多个 Transfer Context；
- 用参考答案关键词替代 Rubric；
- 未审核 AI Draft 自动冻结；
- 原地修改 Frozen Resource；
- 用尚未完成产品端验收的题型提高可执行覆盖数字；
- 通过参考答案关键词机械推断 Observation Dimension；
- 为一篇材料机械创建完整的 Dimension × Ability 矩阵；
- 将未复核的 `observationFocus` 写成正式 Evidence 结论；
- 材料版本变化后继续引用旧段落锚点或旧 Observation Plan。

### 17.2 可选效率扩展：PDF / OCR Material Intake

PDF / OCR 可以作为首批资源生产的效率增强，但不是 Phase 17.2 冻结的硬条件。手工 Material Intake 仍必须能够独立完成首批资源包。

受控链路应为：

```text
PDF Source
-> OCR Raw Result
-> Material Draft
-> Human Text Correction
-> Source / Page / Rights Traceability
-> Material Structure / Source Anchors
-> Material Observation Plan
-> Observation Task Plan
-> Question Resource Drafts
-> Phase 16.1 Validation / Review / Freeze
```

规则：

1. OCR Raw Result 不是正式 Material，也不是 Frozen Resource；
2. OCR 置信度不能替代人工文本校对；
3. 必须保留 PDF 来源、页码和必要的文本位置追溯；
4. 乱码、漏段、错别字和标点错误必须在生成正式 Task Draft 前处理；
5. AI 可以基于已校对 Material 生成 Question Draft，但不能自动通过 Review 或 Freeze；
6. PDF / OCR 失败不得阻塞手工录入，也不得成为 Runtime 的备用取题路径。

## 十二、Phase 17.3：Runtime 覆盖集成

独立工程文档：[Phase 17.3：正式资源运行集成与来源保持](./phase17_3.md)

当前状态：`ENGINEERING + CONTROLLED LIVE + SINGLE-ROUND DEMO PASS / FULL RESOURCE PACK AND CONTINUOUS LEARNING PENDING`。Phase 17.2 Batch A 已提供 8 道 Human Reviewed、Frozen、Registered、Linked 且可正式查询的真实资源；Work Package A 确定性正式资源串联为 `17 / 17 PASS`，Work Package B Controlled DeepSeek Live 为 `3 / 3 PASS`，Batch A `/learning` 单轮人工 Demo 已通过。Phase 17.3 最终产品 PASS 仍须等待完整 24—28 道首批正式资源包、连续 Session 与学生感知验收。

核心问题：

> 第一批正式资源能否被上一轮结果驱动的真实学习请求稳定匹配和执行？

正式链路：

```text
Formal Round Result
-> Existing Evaluation / Profile Decision / GrowthMemory
-> NextLearningStrategy
-> AdaptiveTaskConstraints
-> TaskRequest
-> Coverage Preflight
-> Phase 16.2 Resource Matching Quality
├─ matched
│  -> ExecutableLearningTask
│  -> Next LearningRound
└─ partial / no_match / review_required
   -> Structured Resource Gap
   -> blocked / review workflow
```

17.3 必须证明：

1. 六项能力都能由正式 TaskRequest 查询到对应资源或明确 Gap；
2. `training / retest / transfer` 不会被相互替代；
3. Transfer 请求不会使用同一 Material Cluster 的普通 Training 题凑匹配；
4. Retest 请求不会复用原题冒充新 Evidence；
5. difficulty 不满足时不会静默提高或降低；
6. 资源补齐后只重新执行覆盖与匹配，不重复运行上一轮 Diagnosis；
7. 下一轮使用的 resourceId、versionId、materialId 与 Registry Snapshot 可追溯；
8. 刷新、恢复和重复提交不会创建第二个正式任务或重复写入 Evidence；
9. Coverage Dashboard 与实际 Match Result 使用同一 Registry 事实来源；
10. 资源匹配成功只表示任务可执行，不预先保证实际 Evidence 质量；
11. Question Resource 可以追溯到其 Material Observation Plan、primaryDimension 与 Ability Action；
12. 观测维度引用在 Resource -> Task 的传递中不丢失、不被页面改写；
13. Observation Dimension 不绕过 Answer Validity、Diagnosis 和 Evidence Return 直接生成学生结论；
14. Existing Strategy / TaskRequest 未明确支持维度约束时，Resource Matching 不得把 observationFocus 当作隐藏硬条件。

Phase 17.3 第一版只验证观测元数据的来源与传递，不要求修改 AbilityEvidence、Profile 或 GrowthMemory 的权威 Schema。若需要形成：

```text
Ability: inference
+ Observation Dimension: character
```

这样的正式双坐标 Evidence，必须在后续阶段单独冻结 taxonomy、版本迁移、Evaluation 消费与 Profile 聚合规则，不能在资源接入时顺带完成。

## 十三、第一版 Dashboard

Phase 17.1 可提供一个轻量内部 Dashboard，供内容建设和验收使用。

第一版至少展示：

- 六项能力；
- 五种任务角色；
- basic / intermediate / advanced；
- 当前可执行资源数；
- Material Cluster 数；
- 独立 Context 数；
- Coverage Status；
- 主要 Gap Code；
- Registry Snapshot 与生成时间。

Dashboard 不负责：

- 学生成绩展示；
- 题目推荐；
- 自动冻结资源；
- 用颜色代替缺口原因；
- 修改 Registry；
- 把资源数量宣称为教学质量。

Dashboard 应支持从 Material Cluster 查看其 Question Resources 与能力覆盖，也应支持从 Ability 反查其来源 Material Clusters。题目数、材料数和独立 Context 数必须分别展示，不得合并为单一“覆盖率”。

## 十四、核心 Debug Cases

### 17.1 Coverage Contract

**Case 1：只统计 Registry Current Head**

旧 Frozen Version 与 current version 同时存在时，只统计当前有效版本。

**Case 2：无效资源不得进入覆盖**

Draft、pending review、rejected、superseded、retired 或 Rubric 不完整资源不得计入正式覆盖。

**Case 3：同一材料不抬高独立 Context**

同一 Material Cluster 下多道题可以增加 `executableResourceCount`，但不能无条件增加 `materialClusterCount` 或 `independentContextCount`。

**Case 4：同一 Snapshot 结果稳定**

输入顺序变化不得改变 Coverage Report 的语义结果。

**Case 5：产品端未验收题型**

资源侧已有选择题，但学生端链路未完成验收时，不得计入产品端可执行覆盖。

**Case 6：Gap 原因可追溯**

没有 Transfer 资源时输出明确 role / material gap，不得仅显示“资源不足”。

### 17.2 First Frozen Resource Pack

**Case 7：Material First 生产计划**

资源建设先形成 Material Cluster Plan 和 Observation Task Plan，再生成 Question Draft；不得用一组无材料关系的散题替代材料规划。

**Case 8：六项能力整体覆盖**

六项能力均达到首批 Pack 的整体建议区间；不以逐能力 TaskRole 配额制造虚假覆盖。

**Case 9：Retest 可比较但不重复**

至少两项能力形成 Training 与 Retest 的正式资源链；两端保持能力对齐、使用独立材料且不重复原题。运行时可比性仍由 Phase 13 / 14 校验。

**Case 10：Transfer 使用新材料 Context**

至少两项能力形成 Training 与 Transfer 的正式资源链；Transfer Resource 与基线 Training 的 `materialClusterId` 不同。

**Case 11：能力边界审核**

若理解、概括、分析或推理标签难以区分，资源进入 Review，不为满足矩阵强行冻结。

**Case 12：合理异表述**

Rubric 接受符合材料事实与任务要求的等价表达，不以参考答案关键词作为唯一标准。

**Case 13：Frozen Version 不可原地改写**

修订资源生成新版本，历史 Round 仍引用原版本。

**Case 14：OCR Draft 隔离**

OCR 文本未经人工校对、来源追溯和 Phase 16.1 Review 时，不得进入 Registry 或正式覆盖。

**Case 14A：同一维度承载不同能力**

同一 Material 的 `character` 维度可以设计 extraction 与 inference 任务，但两道题必须具有不同的能力动作、题目要求和 Rubric，不能只更换 abilityId。

**Case 14B：同一能力分布于不同维度**

多道 inference 资源分别来自 character 与 causality 时，Observation Diversity 正确增加；全部来自 character 时不得宣称推理观察面已经广泛覆盖。

**Case 14C：不机械填充矩阵**

材料不支持 structure 观察时允许保留为空，不得为完成矩阵生成低价值任务。

**Case 14D：材料版本与锚点一致**

Material Version 更新后，旧 Observation Plan 进入 superseded 或 review，不得继续静默引用旧段落位置。

**Case 14E：Plan 不直接产生 Evidence**

Material Observation Plan 与 Question Draft 建立成功，但未完成正式作答和 Diagnosis 时，不生成 AbilityEvidence 或 Profile Update。

### 17.3 Runtime Integration

**Case 15：Training 精确匹配**

Strategy 请求 Training 时，只放行满足能力、角色、难度和 Registry 状态的正式资源。

**Case 16：能力错位阻断**

资源数量不足时，不使用其他 ability 的题目凑匹配。

**Case 17：角色错位阻断**

Transfer 缺失时，不使用普通 Training 资源冒充 Transfer。

**Case 18：资源补齐后恢复**

新增并冻结满足条件的资源后，重新匹配成功；不重复调用上一轮 Diagnosis，不重复写 Evidence。

**Case 19：下一轮真实驱动**

Round 1 正式结果形成 Strategy 与 TaskRequest，Round 2 使用对应 Frozen Resource，而不是固定 Demo 任务。

**Case 20：重复与刷新幂等**

恢复页面或重复进入下一轮时，复用同一正式任务身份，不重复生成 ConcreteLearningTask。

**Case 21：Registry 更新一致性**

新版本成为 current head 后，Dashboard 与 Match Result 同时切换到新版本，旧 Round 追溯不变。

**Case 22：真实执行后重新评估质量**

资源满足高质量观察条件，不代表实际 Evidence 自动为 high；执行后仍由 Phase 14.1 依据真实表现评估。

## 十五、阶段验收标准

### Phase 17.1

- Coverage Report 只基于同一 Registry Snapshot 的正式记录；
- 无效、旧版和不可执行资源不进入正式覆盖；
- Dashboard 与 Report 一致；
- ability、taskRole、difficulty、questionType 与 materialCluster 可查询；
- `executableResourceCount`、`materialClusterCount` 与 `independentContextCount` 分别计算；
- Gap 具有确定性原因码；
- 相同输入重复运行结果稳定；
- 相关 Debug、Repository Contract 与 Production Build 通过。

### Phase 17.2

- 首批形成 24—28 道当前审核有效 Frozen Resource；
- 形成 4 个核心 Material Cluster 和 1—2 个独立新材料 Cluster，总计 5—6 个；
- 六项能力在整个 Pack 层面达到受控分布目标，不要求逐能力补齐三种 TaskRole；
- 至少形成 2 条 `Training -> Retest` 和 2 条 `Training -> Transfer` 资源链；
- 至少形成 1 条由正式 Strategy 驱动的跨能力连续学习路径；
- Transfer 具备新 Material Cluster；
- Retest 保持能力对齐、不重复原题，正式可比性仍由运行时校验；
- 100% 具有来源、Rubric、AnswerAcceptance、Review、Version 和 Registry 追溯；
- Dashboard 可以从 Material Cluster 查看 Question Resources，也可以从 Ability 反查来源 Material Clusters；
- advanced 和未完成学生端验收的题型继续被明确记录为 Gap，不虚报覆盖；
- 首批 Pack 中 100% Material Version 具有可追溯的 Material Observation Plan；
- 首批 Pack 中 100% Frozen Question Resource 可追溯到一个主要 Observation Dimension、一个 Ability Action 和一个 TaskRole；
- 每个 Observation Task Plan 具有材料来源锚点、设计理由和版本身份；
- Dashboard 或 Review Report 可以展示 Ability × Observation Dimension 分布，但该分布不修改 Phase 17.1 Primary Coverage Status；
- 同一 Ability 集中于单一 Observation Dimension 时必须显示多样性限制，不得用题量掩盖；
- 材料不支持的组合允许留空，不以笛卡尔积完整度作为验收目标。

### Phase 17.3

- 代表性 Strategy / TaskRequest 能获得正确 `matched` 或明确资源缺口；
- ability、taskRole、difficulty 和材料关系错位时 100% 阻断；
- 资源缺口补齐后可以恢复匹配，不重跑上一轮正式 Diagnosis；
- 至少完成覆盖六项能力和三种主要任务角色的确定性集成验收；
- 至少完成两到三轮由正式结果驱动的真实资源连续学习验收；
- 刷新、恢复和重复提交保持任务、Diagnosis、Evidence 与 Profile Update 幂等；
- 学生端不暴露 Registry、Gap Code、Resource Version 或匹配内部字段；
- Debug、浏览器 Smoke、轻量人工验收与 Production Build 通过；
- Resource -> ConcreteLearningTask 保留可追溯的 Observation Plan 引用；
- 未经正式 Answer Validity 与 Diagnosis，不因 Dimension Metadata 产生 Evidence；
- Evidence / Profile 双坐标尚未正式启用时，Dimension 不参与长期能力更新或稳定性结论。

## 十六、明确不做

Phase 17 第一版不做：

- 大规模题库；
- 100 道以上批量内容生产目标；
- 复杂批量导入与多人内容协作；
- 自动冻结 AI 生成题目；
- 自动学习题目难度；
- 统计推荐算法；
- 完整版权管理平台；
- 家长端、成长曲线或多学生运营；
- 为覆盖矩阵新增大量题型 Schema；
- 把自由文本 observationFocus 接入正式匹配；
- 让 Observation Dimension 直接成为 Evidence 权重、Profile 等级或长期能力结论；
- 在 Phase 17 内完成 Ability × Observation Dimension 的正式画像聚合；
- 把 PDF / OCR 建设设为首批资源包冻结的前置条件；
- 为提高命中率放宽能力或任务角色约束。

## 十七、推荐工程顺序

1. 冻结 Coverage Contract 与状态语义；
2. 实现 Registry Snapshot -> Coverage Report；
3. 建立轻量 Coverage Dashboard；
4. 输出第一批资源 Gap List；
5. 建立 4 个核心 Material Cluster Plan 和 1—2 个独立新材料 Plan；
6. 完成 Material Intake、校对、来源、版权与 Material Structure 追溯；
7. 为每个 Material Version 建立并复核 Material Observation Plan；
8. 从高价值 Dimension × Ability 组合生成 Observation Task Plan；
9. 完成 Phase 17.4A 真实共享基线切换与双浏览器一致性确认；
10. 完成 Phase 17.5，并使用固定 10 篇材料校准生成质量、审核效率和 Ability / Difficulty 分布；
11. 按计划生产、审核并冻结 24—28 道资源；
12. 回算 Primary Coverage Report 与 Observation Diversity View；
13. 执行 Strategy -> TaskRequest -> Match 集成；
14. 验证 Observation Plan 引用在 Resource -> Task 中保持可追溯；
15. 运行连续两到三轮真实资源链；
16. 完成浏览器人工验收与阶段记录；
17. 固定资源基线后开始 Phase 16.3C 5—7 个自然日真实运行。

## 十八、完成后的准确能力声明

Phase 17 完成后可以宣称：

> 系统已经以 Material Cluster 组织第一批正式内容，以 Observation Dimension 描述材料观察对象，以 Ability Action 描述学生需要完成的认知活动，并形成覆盖六项核心能力与主要学习任务角色的 Frozen Resource Pack；系统能够分别识别题目数量、材料宽度、独立观察 Context、观测维度偏斜和资源缺口，并让上一轮正式结果通过 Existing Strategy、TaskRequest 与 Resource Matching 选择下一道审核有效的真实任务。

Phase 17 完成后仍不能宣称：

- 已建成大型题库；
- 所有题型都已在学生产品端稳定运行；
- 难度已经完成统计标定；
- 资源覆盖已经证明教学效果；
- 可以支持多人、云端或长期商业化内容运营；
- 单学生 5—7 个自然日验收已自动完成；
- Observation Dimension 已经成为正式 Profile 维度或能够证明跨维度能力稳定。

## 十九、当前产品定位与下一执行顺序

当前准确定位为：

> 已通过真实单轮学习链路验收、具备封闭 Beta 基础的单学生教育系统。

这表示系统已经证明一条正式资源可以进入真实学习入口，经过真实 Diagnosis、Evidence 和学生反馈，并在刷新时保持幂等；它不表示资源生态、多轮连续学习或自然日稳定性已经完成。

下一阶段严格按以下顺序推进：

1. **资源生态扩展**：继续完成 Phase 17.2 Batch B / C，形成 4 个核心 Material Cluster、1—2 个独立 Transfer Cluster 和 24—28 道正式资源，补齐两条 Training -> Retest、两条 Training -> Transfer 与一条跨能力路径；
2. **连续 Session 验证**：由 Profile、GrowthMemory、Strategy 和正式资源共同驱动下一任务，先完成 3 个受控 Session，再以冻结构建开始 5—7 个自然日运行；
3. **学生感知验收**：使用 6—10 组真实学习记录验证学生是否能说清系统注意到了什么、自己完成了什么、当前先改哪里以及为什么继续下一任务。

在资源生态不足时，不继续围绕同一道样例题打磨链路，也不使用能力或任务角色错位的资源凑成连续学习。

## 二十、产品意义

Phase 16 证明了学习机器能够安全接收、匹配和执行正式题目。

Phase 17 将进一步证明：

```text
正式资源不是孤立样例
+
材料与任务形成可追溯的内容组织
+
资源池能够覆盖主要学习请求
+
缺口能够被看见和补齐
+
下一轮不再依赖固定 Demo 任务
```

这时产品才第一次拥有可持续运行所需的最小内容基础：不是资源很多，而是资源与能力、任务角色、难度、材料关系和 Runtime 条件之间建立了可执行的覆盖关系。

同时，Phase 17 将建立 `Material-grounded Ability Observation Foundation`：材料是语境载体，维度决定观察什么，能力决定学生如何处理，题目负责把观测目标转化为正式执行入口。该基础能够揭示资源观察面的偏斜，但在后续正式 Evidence Contract 建立前，不把资源设计标签直接解释为学生能力事实。
