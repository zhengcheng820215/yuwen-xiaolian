# Phase 17.1：资源覆盖契约（Resource Coverage Contract）

设计状态：ACCEPTED

工程状态：ENGINEERING + HUMAN DEMO PASS（22 / 22；Dashboard 8 / 8 PASS；IndexedDB Smoke PENDING）

所属总纲：[Phase 17：学习资源覆盖扩展](./phase17.md)

后续阶段：[Phase 17.2：材料观测设计与首批正式资源包](./phase17_2.md)

## 一、阶段目标

Phase 17.1 只回答一个问题：

> 系统如何基于当前 Registry 中审核有效的 Frozen Question Resource，确定性地说明“现有资源可以支持哪些学习请求，还缺少什么”？

本阶段建立覆盖事实的统一派生边界：

```text
QuestionResourceAdmissionRepository
-> Registry Current Frozen Versions
-> Coverage Eligibility
-> Material Cluster Aggregation
-> Coverage Policy Evaluation
-> Resource Coverage Report
-> Read-only Coverage Dashboard
```

Phase 17.1 完成后，系统应能够：

1. 区分原始题目数量、当前 Frozen Resource、产品端可执行资源和独立观察 Context；
2. 按 Ability、TaskRole、Difficulty、QuestionType 与 Material Cluster 查询覆盖；
3. 输出 `covered / thin / gap / blocked / not_planned`；
4. 明确每个缺口的正式原因；
5. 保证同一 Registry、Policy 与 Product Capability 输入得到相同结果；
6. 为 Phase 17.2 生成首批 Material Cluster 与 Question Resource 建设清单；
7. 为 Phase 17.3 提供覆盖预检，但不替代正式 Resource Matching。

## 二、一句话定义

> Phase 17.1 将当前正式资源 Registry 转换为可复现、可追溯、按 Material Cluster 聚合的覆盖报告，并以只读方式呈现资源覆盖与缺口。

## 三、阶段输入与输出

### 3.1 正式输入

Phase 17.1 只消费：

- `ResourceRegistryEntry[]`；
- Registry current head 对应的 `FrozenQuestionResourceVersion[]`；
- 必要的 `ResourceValidationResult / ResourceReviewDecision` 追溯；
- `QuestionMaterialVersion[]`；
- 当前 `CoveragePolicy`；
- 当前 `ProductExecutableCapabilitySnapshot`。

上述资源事实必须通过 `QuestionResourceAdmissionRepository` 或正式 Application Service 读取。页面不得直接查询 IndexedDB Store 或自行拼装覆盖。

Phase 17.1 不消费：

- StudentResponse；
- DiagnosisResult；
- AbilityEvidence；
- Student Profile；
- GrowthMemory；
- NextLearningStrategy 的具体学生决策；
- 页面手工录入的覆盖数字。

### 3.2 正式输出

Phase 17.1 输出：

- `ResourceRegistrySnapshot`；
- `MaterialClusterCoverageView[]`；
- `ResourceCoverageCell[]`；
- `ResourceCoverageGap[]`；
- `RejectedCoverageRecord[]`；
- `ResourceCoverageReport`；
- 只读 Dashboard View Model。

这些输出是派生事实，不是新的题目资源，也不能反向修改 Registry。

## 四、Material First 的 V1 边界

### 4.1 Material Cluster 的定位

Material Cluster 是内容规划与覆盖聚合的一级单位，Frozen Question Resource 仍然是审核、版本冻结、Registry 和 TaskFulfillment 的正式资源单位。

```text
Material Cluster
-> QuestionMaterialVersion
-> Frozen Question Resources
-> Concrete Learning Tasks
```

Phase 17.1 不建立完整 Material Repository、Material Review Runtime 或新的 Frozen Material Contract。

### 4.2 当前工程适配规则

现有 Phase 16.1 Contract 已包含：

- `QuestionMaterialVersion.materialId`；
- `QuestionMaterialVersion.materialVersionId`；
- `FrozenQuestionResourceVersion.materialId`；
- `FrozenQuestionResourceVersion.materialVersionId`；
- `FrozenQuestionResourceVersion.materialSnapshot`。

但当前尚无独立的 `materialClusterId` 正式字段。

因此 Phase 17.1 V1 使用以下确定性规则：

```text
materialClusterId = materialId
```

含义：

1. 同一 `materialId` 的不同 Material Version 属于同一 Material Cluster；
2. 同一 Material 下多道 Question Resource 只增加资源数，不增加 Material Cluster 数；
3. 不同 `materialId` 默认是不同 Cluster；
4. V1 不允许通过标题相似、文本相似或人工备注把多个 `materialId` 静默合并；
5. 缺少 `materialId / materialVersionId` 的资源可以保留在 Registry，但不能计入 Material-first 正式覆盖；
6. 后续若建立独立 Material Cluster Contract，必须通过版本化 Adapter 迁移，不能改变历史 Report 的解释。

### 4.3 独立 Context

`materialClusterCount` 不等于 `independentContextCount`。

V1 采用保守且确定的计算规则：

```text
同一 Primary Cell 内
independentContextCount
= 通过 Eligibility 的 distinct materialClusterId 数量
```

同一 Material Cluster 最多贡献 1 个潜在独立 Context。V1 不因同一材料下题目数量、题型变化或 Material Version 增加而提高该数量。

若后续出现正式重复关系或同质限制 Metadata，应先通过版本化 Policy / Adapter 扣除对应 Cluster；不得靠标题相似度或页面人工判断改变数量。

Phase 17.1 只能说明资源池的潜在独立 Context，不证明某个具体学生已经形成独立 Evidence。实际 Evidence 独立性仍由学习执行和 Phase 14 判断。

### 4.4 MaterialClusterCoverageView

```ts
type MaterialClusterCoverageView = {
  materialClusterId: string;
  materialId: string;
  currentMaterialVersionIds: string[];
  currentExecutableResourceIds: string[];
  abilityIds: PrimaryAbilityId[];
  taskRoles: RecommendedTaskRole[];
  limitations: string[];
};
```

该对象是覆盖聚合视图，不是新的 Frozen Material，也不允许被 TaskFulfillment 当作 Question Resource 使用。

## 五、Primary Cell 与 Breakdown

### 5.1 Primary Coverage Cell

为避免重新制造完整笛卡尔积，Phase 17.1 使用：

```text
Primary Cell Key
= abilityId + taskRole
```

Difficulty、QuestionType、ResponseFormat 和 Material Cluster 作为 Cell 内的 Breakdown，而不是强制生成所有组合的独立正式 Cell。

建议 Contract：

```ts
type ResourceCoverageCellKey = {
  abilityId: PrimaryAbilityId;
  taskRole: RecommendedTaskRole;
};

type ResourceCoverageCell = {
  key: ResourceCoverageCellKey;
  status: 'covered' | 'thin' | 'gap' | 'blocked' | 'not_planned';

  currentExecutableResourceIds: string[];
  resourceVersionIds: string[];
  materialClusterIds: string[];

  executableResourceCount: number;
  materialClusterCount: number;
  independentContextCount: number;

  difficultyBreakdown: Record<QuestionResourceDifficulty, number>;
  questionTypeBreakdown: Record<StructuredQuestionType, number>;
  responseFormatBreakdown: Record<QuestionResponseFormat, number>;

  limitations: string[];
  gapIds: string[];
};
```

### 5.2 Breakdown 的含义

Breakdown 用于回答：

- 该能力和任务角色下是否只有 basic 题；
- 是否全部依赖同一种题型；
- 是否全部来自同一材料；
- 是否缺少产品端可执行作答形式；
- 是否达到 CoveragePolicy 要求的材料宽度。

Breakdown 不直接参与学生能力判断，也不能自动推导题目难度质量。

### 5.3 Observation Dimension

Phase 17.1 不新增 Observation Dimension 字段作为 Primary Cell Key。

Phase 17 总目标已经升级为 `Material-grounded Ability Observation Foundation`，但该升级不改变 Phase 17.1 已通过的 Coverage Contract。17.1 继续只回答当前正式资源能否支持 `abilityId + taskRole` 请求；Material Observation Plan 与 Observation Diversity View 由 17.2 建立，17.3 只验证其正式来源和传递。

Rubric 中的能力动作可以被保留用于人工审查，但未经正式 taxonomy 冻结前：

- 不进入 Coverage denominator；
- 不影响 covered / thin；
- 不进入 TaskFulfillment；
- 不允许由自由文本标签拆分或合并 Ability。

后续 17.2 可以使用受控一级 Observation Dimension 形成独立规划和偏斜视图，但不得回写或重解释既有 Phase 17.1 Report。若未来需要把 Dimension 纳入正式 Coverage denominator，必须发布新的 Policy / Schema Version，并保留 V1 Report 的原始解释。

## 六、Coverage Policy

### 6.1 Policy 是覆盖状态的唯一规则来源

Coverage Agent 不得把阈值散落在页面或多个函数中。

建议最小对象：

```ts
type CoveragePolicyTarget = {
  abilityId: PrimaryAbilityId;
  taskRole: RecommendedTaskRole;
  planned: boolean;

  minimumExecutableResourceCount: number;
  minimumMaterialClusterCount: number;
  minimumIndependentContextCount: number;

  requiredDifficulties: QuestionResourceDifficulty[];
  allowedQuestionTypes: StructuredQuestionType[];
};

type ResourceCoveragePolicy = {
  policyId: string;
  policyVersion: string;
  schemaVersion: string;
  targets: CoveragePolicyTarget[];
  createdAt: string;
};
```

### 6.2 Phase 17 首批默认目标

Phase 17.1 Contract 支持版本化 Policy；首批 Policy 建议采用：

| taskRole | 规划范围 | 最小可执行资源 | 最小 Material Cluster | 说明 |
| --- | --- | ---: | ---: | --- |
| `training` | 六项能力 | 2 | 2 | 避免同一材料形成虚假充分覆盖 |
| `retest` | 六项能力 | 1 | 1 | 只表示资源池有复测候选，不预先证明与某次基线可比 |
| `transfer` | 六项能力 | 1 | 1 | 只表示有 Transfer 候选，实际新材料关系由 16.2 针对请求验证 |
| `diagnosis` | Policy 指定的优先能力 | 1 | 1 | 未规划能力为 `not_planned` |
| `observation` | Policy 指定的优先能力 | 1 | 1 | 未规划能力为 `not_planned` |

`requiredDifficulties` 和 `allowedQuestionTypes` 必须由具体 Policy 声明，不能从现有资源分布反向生成目标。

### 6.3 状态派生顺序

每个 Primary Cell 按以下顺序确定状态：

1. Policy 未规划该 Cell：`not_planned`；
2. 没有正式可执行资源，但存在被审核、版本、材料或产品能力阻断的候选：`blocked`；
3. 没有任何正式可执行资源，也没有可识别候选：`gap`；
4. 有可执行资源，但资源数、Material Cluster、独立 Context 或 required difficulty 未达标：`thin`；
5. 所有 Policy 门槛均满足：`covered`。

被拒绝或阻断的资源不得为了使 Cell 达标而计入正式数量。

## 七、Product Executable Capability

### 7.1 Schema 支持不等于产品链可执行

当前资源 Schema 支持五种题型，但学生正式产品链尚未对所有题型完成同等强度验收。

Phase 17.1 必须消费版本化能力快照：

```ts
type ProductExecutableCapabilityStatus =
  | 'accepted'
  | 'resource_only'
  | 'blocked';

type ProductExecutableCapabilitySnapshot = {
  capabilitySnapshotId: string;
  capabilityVersion: string;
  questionTypes: Record<StructuredQuestionType, ProductExecutableCapabilityStatus>;
  responseFormats: Record<QuestionResponseFormat, ProductExecutableCapabilityStatus>;
  createdAt: string;
};
```

V1 默认政策：

- `open_short_answer / reading_comprehension` 及其已验收文本作答格式可以标记为 `accepted`；
- `multiple_choice / true_false / fill_blank` 在学生端专项链路验收前只能是 `resource_only` 或 `blocked`；
- 状态必须来自配置或正式 Capability Snapshot，不能通过 Schema 中存在枚举值自动推断为 `accepted`。

### 7.2 计数规则

- `accepted`：可以进入产品端可执行覆盖；
- `resource_only`：可以进入资源侧统计，但不增加 `executableResourceCount`；
- `blocked`：进入阻断记录，不进入正式覆盖。

QuestionType 与 ResponseFormat 必须同时被接受。

## 八、Registry Snapshot

### 8.1 Snapshot 内容

`ResourceRegistrySnapshot` 至少包含：

```ts
type ResourceRegistrySnapshot = {
  registrySnapshotId: string;
  registrySchemaVersion: string;
  policyId: string;
  capabilitySnapshotId: string;

  registryEntryIds: string[];
  currentResourceVersionIds: string[];
  materialVersionIds: string[];

  contentHash: string;
  capturedAt: string;
};
```

### 8.2 稳定性规则

1. 输入在计算前按稳定 ID 排序；
2. `contentHash` 不包含 `capturedAt / generatedAt`；
3. 同一 Registry、Policy 与 Capability Snapshot 必须生成相同 `contentHash`；
4. Registry current head、Policy 或 Capability 发生变化时必须生成新 Snapshot；
5. Snapshot 不允许静默修复缺失 Version 或身份错位；
6. 无法解析的记录进入 `RejectedCoverageRecord`；
7. `latest report` 只能指向完整生成成功的 Report。

## 九、Coverage Eligibility

资源只有全部通过以下 Gate，才可以计入产品端正式覆盖：

1. Registry status 为 `active`；
2. `currentFrozenVersionId` 存在；
3. current version 可读取；
4. version status 为 `frozen`；
5. Registry 与 Version 的 resourceId、abilityId、taskRole、difficulty 一致；
6. Validation 与 Review 可追溯且审核结果有效；
7. Rubric 与 minimum answer requirement 完整；
8. Material 身份与 Material Version 可追溯；
9. QuestionType 与 ResponseFormat 在当前 Capability Snapshot 中为 `accepted`；
10. 不存在 Phase 16.2 Candidate Adapter 无法消费的结构问题。

Eligibility 通过只表示资源可以参与 Coverage 与后续 Matching，不表示：

- 它一定适合某个具体 TaskRequest；
- 它与某个 Retest 基线一定可比；
- 它对某个学生一定是新材料；
- 它最终一定产生 high-quality Evidence。

## 十、Gap 与拒绝记录

### 10.1 Gap Code

建议第一版受控原因码：

```ts
type ResourceCoverageGapCode =
  | 'no_current_frozen_resource'
  | 'insufficient_executable_resources'
  | 'insufficient_material_clusters'
  | 'insufficient_independent_contexts'
  | 'missing_required_difficulty'
  | 'question_type_not_product_executable'
  | 'response_format_not_product_executable'
  | 'missing_material_identity'
  | 'missing_rubric_or_answer_requirement'
  | 'review_or_validation_untraceable'
  | 'resource_not_frozen_active'
  | 'question_type_not_allowed_by_policy'
  | 'registry_current_version_missing'
  | 'registry_version_identity_mismatch'
  | 'registry_consistency_failed'
  | 'unsupported_ability'
  | 'unsupported_task_role'
  | 'unsupported_difficulty'
  | 'policy_target_not_configured';
```

### 10.2 ResourceCoverageGap

```ts
type ResourceCoverageGap = {
  gapId: string;
  cellKey: ResourceCoverageCellKey;
  code: ResourceCoverageGapCode;
  severity: 'info' | 'warning' | 'blocking';
  affectedResourceIds: string[];
  materialClusterIds: string[];
  reason: string;
  recommendedActionCode:
    | 'add_resource'
    | 'add_material_cluster'
    | 'repair_resource_metadata'
    | 'complete_review_or_freeze'
    | 'enable_product_capability'
    | 'repair_registry'
    | 'review_policy';
};
```

`recommendedActionCode` 是受控资源治理动作，不得修改 Strategy 或替学生生成任务。学生端不得看到该内部原因码。

### 10.3 RejectedCoverageRecord

损坏、错位、版本不兼容或身份不完整的记录必须进入 `RejectedCoverageRecord[]`，不得进入 Cell 数量、Summary 或 Gap 已满足判断。

不得静默补齐 materialId、abilityId、taskRole、difficulty、Review 或 Frozen Version。

建议最小对象：

```ts
type RejectedCoverageRecord = {
  rejectedRecordId: string;
  resourceId?: string;
  resourceVersionId?: string;
  registryEntryId?: string;
  issueCodes: ResourceCoverageGapCode[];
  rejectedAt: string;
};
```

## 十一、Resource Coverage Report

建议最小输出：

```ts
type ResourceCoverageReport = {
  reportId: string;
  reportVersion: string;
  schemaVersion: string;

  registrySnapshot: ResourceRegistrySnapshot;
  policyId: string;
  capabilitySnapshotId: string;

  materialClusters: MaterialClusterCoverageView[];
  cells: ResourceCoverageCell[];
  gaps: ResourceCoverageGap[];
  rejectedRecords: RejectedCoverageRecord[];

  summary: {
    coveredCellCount: number;
    thinCellCount: number;
    gapCellCount: number;
    blockedCellCount: number;
    notPlannedCellCount: number;
    executableResourceCount: number;
    materialClusterCount: number;
    independentContextCount: number;
  };

  generatedAt: string;
};

type ResourceCoverageGenerationResult =
  | {
      status: 'complete';
      report: ResourceCoverageReport;
      issues: string[];
    }
  | {
      status: 'blocked';
      issues: string[];
    };
```

`reportId` 应由 Snapshot、Policy 与 Report Schema 稳定派生。`generatedAt` 不参与语义身份。

报告必须能够回答：

- 从 Ability 查看来源 Material Cluster；
- 从 Material Cluster 查看 Question Resources 与 Ability；
- 从 Cell 查看具体 Gap；
- 从拒绝记录追溯异常资源；
- 当前结果使用哪个 Registry、Policy 与 Capability Snapshot。

## 十二、Application 与 Repository 边界

推荐关系：

```text
Coverage Dashboard
↓
ResourceCoverageApplicationService
↓
QuestionResourceAdmissionRepository (read-only use)
+ CoveragePolicyProvider
+ ProductExecutableCapabilityProvider
↓
ResourceCoverageAgent
↓
ResourceCoverageReport
```

规则：

1. Dashboard 只调用 Application Service；
2. 页面不得直接读取 IndexedDB 或 Registry Store；
3. Coverage Agent 不获得 Registry 写权限；
4. Report 可以按需重新计算；
5. 如需保存历史 Report，应使用独立 `ResourceCoverageReportRepository`，不能写回 Question Resource Repository；
6. Report Repository 只保存派生快照，不成为覆盖事实来源；
7. Debug 使用内存 Adapter；浏览器可以复用现有 IndexedDB Question Resource Repository；
8. 任何 Report 生成失败都不能修改正式资源。

## 十三、确定性执行顺序

```text
1. Load CoveragePolicy
2. Load ProductExecutableCapabilitySnapshot
3. Read and sort Registry Entries
4. Validate Registry Consistency
5. Resolve Current Frozen Versions
6. Resolve Material Versions
7. Build Material Cluster Views
8. Run Coverage Eligibility
9. Group by abilityId + taskRole
10. Build Difficulty / QuestionType / ResponseFormat Breakdowns
11. Apply CoveragePolicy
12. Build Gap and Rejected Records
13. Derive stable Snapshot / Report IDs
14. Return Report and Dashboard View Model
```

任何阶段遇到单条损坏记录时，应隔离该记录并进入 rejected；若 Registry Snapshot 整体无法形成可信边界，则整个 Report 进入 `blocked`，不得发布残缺的 latest report。

## 十四、第一版 Dashboard

Dashboard 是内部资源建设和验收工具，不是学生页面。

第一版至少展示：

- 当前 Policy 与 Snapshot；
- Ability × TaskRole 主矩阵；
- `covered / thin / gap / blocked / not_planned`；
- executable resource、Material Cluster、independent Context 三类数量；
- Difficulty、QuestionType 和 ResponseFormat Breakdown；
- Material Cluster -> Questions -> Ability；
- Ability -> Material Clusters -> Questions；
- Gap Code 与推荐资源动作；
- Rejected Record 数量与内部追溯入口。

Dashboard 不允许：

- 创建、修改、审核或冻结题目；
- 修改 Policy；
- 修改 Registry；
- 执行 TaskFulfillment；
- 展示学生 Profile、Evidence 或 Diagnosis；
- 用一个百分比隐藏实际资源、材料和 Context 分布。

## 十五、实现了什么

Phase 17.1 工程完成后，系统将第一次正式具备：

1. Registry current head 的覆盖快照；
2. Material-first 覆盖聚合；
3. Ability × TaskRole 主矩阵；
4. Difficulty、QuestionType、ResponseFormat 分布；
5. 产品端可执行资源与资源侧资源的区分；
6. 题目数量、材料宽度和独立 Context 的分离；
7. 确定性 Coverage Status；
8. 结构化 Gap 与 Rejected Record；
9. 首批资源建设清单；
10. 只读 Coverage Dashboard。

## 十六、明确不能做什么

Phase 17.1 不能：

- 创建 Material、Question Draft 或 Frozen Resource；
- 自动审核或冻结资源；
- 修改 Resource Registry；
- 把 Material Cluster 直接转换成 Evidence；
- 为了达到 covered 修改 ability、taskRole 或 difficulty；
- 把 Schema 支持题型当成产品端可执行题型；
- 证明 Retest 与某个具体基线可比；
- 证明 Transfer 对某个学生是新材料；
- 保证 TaskFulfillment 一定 matched；
- 修改 NextLearningStrategy；
- 判断学生能力、保持性或长期提升；
- 自动建立 Observation Dimension taxonomy；
- 把 Material Observation Plan 或 observationFocus 计入 V1 Coverage denominator；
- 让 Observation Dimension 直接影响 Evidence、Profile 或 GrowthMemory；
- 执行 PDF / OCR；
- 替代 Phase 17.2 的内容建设；
- 替代 Phase 17.3 的真实 Runtime 集成；
- 替代 Phase 16.3C 的 5—7 个自然日验收。

## 十七、核心 Debug Cases

**Case 1：只统计 Registry current head**

同一 resource 存在多个 Frozen Version，只有 Registry 当前版本进入覆盖。

**Case 2：旧版本保持追溯但不进入当前数量**

superseded version 仍可查询，但不增加 current executable count。

**Case 3：Registry current version 缺失**

进入 rejected / blocked，不静默改用上一版本。

**Case 4：Registry 与 Version 身份错位**

ability、taskRole、difficulty 或 resourceId 任一错位，资源不进入正式覆盖。

**Case 5：Review 或 Rubric 不完整**

资源进入阻断记录，不计入 executable count。

**Case 6：Material 身份缺失**

资源不进入 Material-first 正式覆盖，也不创建临时 materialId。

**Case 7：同一材料多道题**

资源数增加，Material Cluster 数保持 1；无法证明独立时 Context 数保持 1。

**Case 8：同一材料多个版本**

同一 materialId 的多个 version 聚合为一个 Material Cluster，只统计 current resource 所引用版本。

**Case 9：不同材料独立 Context**

身份和重复关系通过时，materialClusterCount 与 independentContextCount 正确增加。

**Case 10：产品端未验收题型**

选择题资源为 Frozen，但 Capability 为 `resource_only`，不得增加 executable count。

**Case 11：QuestionType 已接受但 ResponseFormat 未接受**

资源仍不得进入产品端可执行覆盖。

**Case 12：Primary Cell 不生成笛卡尔积**

主 Cell 只按 abilityId + taskRole 建立，其他维度进入 Breakdown。

**Case 13：未规划 Cell**

Policy 未规划的 diagnosis / observation Cell 输出 `not_planned`，不误报 gap。

**Case 14：有候选但全部被阻断**

Cell 输出 `blocked`，并列出正式阻断原因。

**Case 15：有资源但未达阈值**

Cell 输出 `thin`，不提前宣称 covered。

**Case 16：资源数足够但材料不足**

Training 有 2 道题但都来自同一 Material Cluster，仍为 `thin`。

**Case 17：覆盖成立**

资源数、材料数、Context、Difficulty 和产品能力均满足 Policy 时输出 `covered`。

**Case 18：输入顺序变化**

相同输入不同顺序生成相同 contentHash、Cell 和 Gap 语义。

**Case 19：Policy 变化**

Registry 不变但 Policy Version 变化时生成新 Report，不覆盖旧解释。

**Case 20：Capability Snapshot 变化**

题型完成产品端验收后重新计算覆盖，旧 Report 保持可追溯。

**Case 21：Dashboard 与 Report 一致**

Dashboard 数量、状态和 Gap 与正式 Report 完全一致，页面不自行重算。

**Case 22：生成失败无污染**

Report 生成失败时 Registry、Frozen Version、Review 和 Material 均无写入。

## 十八、验收标准

### 18.1 Contract 验收

- Schema、Policy、Capability Snapshot、Gap Code 和状态优先级已冻结；
- Primary Cell 明确为 `abilityId + taskRole`；
- Material Cluster V1 明确使用 `materialId` 聚合；
- Report 与 Snapshot 的版本字段完整；
- 页面、Application Service、Agent 与 Repository 边界明确。

### 18.2 数据安全验收

- 非 current、损坏、错位、旧版本和不可执行资源 100% 不进入正式数量；
- rejectedRecords 不参与 Cell、Summary 或“Gap 已满足”的任何正式判断；
- 缺失 Material 身份不被静默修复；
- Coverage 生成过程对 Registry 为只读；
- 同一输入重复执行结果稳定；
- Policy 或 Capability 变化产生新 Report，不覆盖旧 Report 语义。

### 18.3 功能验收

- 六项 Ability 与五种 TaskRole 均可查询；
- planned 与 not_planned 正确区分；
- 题目数、Material Cluster 数、独立 Context 数分别输出；
- Difficulty、QuestionType、ResponseFormat Breakdown 正确；
- 从 Ability 可以追溯到 Material 与 Resource；
- 从 Material 可以追溯到 Ability 与 Resource；
- 每个 thin / gap / blocked Cell 有明确原因；
- 可以输出 Phase 17.2 首批资源建设清单。

### 18.4 工程验收

- 22 个 Deterministic Debug Cases 全部通过：`22 / 22 PASS`；
- Question Resource Admission Repository 关键回归：`22 / 22 PASS`；
- Phase 16.2A Candidate / Eligibility 关键回归：`12 / 12 PASS`；
- Phase 16.2B Resource Match Quality 关键回归：`16 / 16 PASS`；
- Coverage 结果重复运行哈希稳定：`PASS`；
- Application Service 通过 Repository 只读装载正式资源：`PASS`；
- Production Build：`PASS`；
- 浏览器 IndexedDB 读取与刷新重算 Smoke：`PENDING`；
- Dashboard 工程接入与 PC / 平板浏览器预检：`PASS`；
- Dashboard 轻量人工验收：`8 / 8 PASS`；
- 本阶段不要求调用 DeepSeek Live Provider。

工程与 Debug 详细记录：[Phase 17.1 Resource Coverage Engineering Debug Acceptance](./reports/phase17_1_resource_coverage_engineering_debug_acceptance_2026-07-22.md)。

Dashboard 接入与浏览器预检记录：[Phase 17.1 Resource Coverage Dashboard Demo Preflight](./reports/phase17_1_resource_coverage_dashboard_demo_preflight_2026-07-22.md)。

Dashboard 轻量人工验收记录：[Phase 17.1 Resource Coverage Dashboard Demo Acceptance](./reports/phase17_1_resource_coverage_dashboard_demo_acceptance_2026-07-22.md)。

## 十九、失败与阻断规则

以下情况不得发布正式 latest Report：

- Registry 整体一致性校验失败且无法隔离；
- CoveragePolicy 非法或版本缺失；
- Capability Snapshot 非法或版本缺失；
- contentHash 无法稳定生成；
- Cell 状态出现无法解释的分叉；
- Report Summary 与 Cells 不一致。

单条资源损坏但可以安全隔离时：

```text
invalid resource
-> RejectedCoverageRecord
-> affected Cell blocked / thin / gap
-> Report remains traceable
```

不得为了生成完整 Dashboard 而拼装残缺资源。

## 二十、完成声明

Phase 17.1 当前工程与 Debug 验收通过后可以宣称：

> 系统能够基于同一 Registry、CoveragePolicy 和 Product Capability Snapshot，确定性生成 Material-first 的正式资源覆盖报告，分别识别可执行题目数量、Material Cluster、独立 Context、覆盖状态和资源缺口，并通过只读 Dashboard 支持后续资源建设。

当前 `ResourceCoverageDashboardViewModel` 与 `#/resource-coverage-dashboard-demo` 已建立，负责人浏览器轻量人工验收为 `8 / 8 PASS`。浏览器 IndexedDB 读取与刷新重算 Smoke 仍未执行，因此 Phase 17.1 当前准确状态为 `ENGINEERING + HUMAN DEMO PASS / INDEXEDDB SMOKE PENDING`，尚不标记为 `PASS / FROZEN`。

仍不能宣称：

- 已经建设首批 26—28 道 Frozen Resource；
- 所有六项能力都已达到 covered；
- 下一轮一定能匹配到正式任务；
- 已经证明 Retest 可比性或 Transfer 新颖性；
- 资源覆盖已经带来教学效果；
- Phase 17、Phase 16.3C 或自然日验收已经完成。
