# 产品运行可靠性 WP-R0：运行基线、Reason Code 与只读审计工程实施及 Debug 验收文档

英文名称：Product Runtime Reliability WP-R0 Baseline, Reason Code and Read-only Audit Engineering and Debug Plan

对应主契约：`product_runtime_reliability_and_real_trial_reentry_v1`

阶段版本：`product_runtime_reliability_wp_r0_v1`

状态：`WP-R0 ENGINEERING COMPLETE / DEBUG ACCEPTED / READ-ONLY VERIFIED / WP-R1 AUTHORIZED`

日期：2026-08-25

关联文档：

- [产品运行可靠性与真实 Trial 重新准入契约](./PRODUCT_RUNTIME_RELIABILITY_AND_REAL_TRIAL_REENTRY_CONTRACT.md)
- [产品复杂度收口总契约](./PRODUCT_COMPLEXITY_CONVERGENCE_CONTRACT.md)
- [真实 Trial Window 启动与运行验收契约](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_REAL_TRIAL_WINDOW_OPERATION_AND_ACCEPTANCE_CONTRACT.md)
- [真实 Trial 激活签署与执行记录](../education/phase/reports/product_complexity_convergence_real_trial_activation_signoff_2026-08-25.md)
- [WP-R0 基线、Debug 与浏览器只读验收记录](../education/phase/reports/product_runtime_reliability_wp_r0_baseline_debug_browser_acceptance_2026-08-25.md)

## 一、阶段定位

WP-R0 是运行可靠性收口的第一工程工作包，只回答以下问题：

1. 当前运行实例由哪些依赖组成；
2. 哪些事实可以证明 Runtime、Formal Store、AI Provider、Learning 与 Trial 的当前状态；
3. 运行故障应使用哪些稳定 Reason Code；
4. 当前正式资源、构建、策略和 Trial 身份基线是什么；
5. 后续 WP-R1—WP-R6 如何在不依赖固定题量和历史假设的前提下验收；
6. 审计前后如何证明正式数据零写入。

阶段输入：

```text
现有代码与 Git 身份
+ 当前 Shared Formal Resource Store
+ 当前 Learning / Workbench 路由
+ 当前 Trial Launch Record 与上位契约
+ 既有 Debug、Build 与浏览器证据
```

阶段输出：

```text
版本化 Runtime Baseline Audit Schema
+ Runtime Dependency Inventory
+ 冻结的 Reason Code Registry
+ 动态正式资源基线读取器
+ 运行身份输入审计
+ 零写入快照与 Digest
+ 机器可读审计报告
+ 人工基线报告
```

WP-R0 不实现启动器、不增加 `/__runtime/health`、不修改普通页面、不重新激活 Trial。完成后的状态只能提升为：

```text
WP-R0 ENGINEERING COMPLETE
DEBUG ACCEPTED
READ-ONLY VERIFIED
WP-R1 AUTHORIZED
```

不得提升为：

```text
RUNTIME READY
REAL TRIAL RE-ENTRY APPROVED
REAL TRIAL ACTIVE
```

## 二、贯穿性验收原则

WP-R0 必须同时证明：

> 当前运行事实可以被稳定、可解释、只读地审计，并且审计本身不改变任何正式资源、学习事实、学生证据或真实 Trial 分母。

具体要求：

1. 所有审计规则必须为纯函数或只读 Adapter；
2. 正式资源数量从执行时 Shared Formal Resource Store 动态读取；
3. 当前 `24 / 81 / 81` 只作为基线证据，不得写入长期断言；
4. Runtime 不可达、Store 不可读、无任务、AI 未配置和 Trial 身份错位必须是不同事实；
5. Reason Code 只能描述运行问题，不形成学生能力或题目质量结论；
6. Trial 身份审计只能报告 aligned / mismatch / insufficient，不执行激活或关闭写入；
7. 浏览器检查只读取可见状态、结构化日志和接口结果；
8. 旧主链和正式数据在审计前后保持相同 Digest；
9. 未知状态保守输出 `insufficient_evidence`，不得猜测为 ready；
10. 审计失败不得进入 Learning 主链或普通页面。

## 三、绝对禁止的修改与写入

WP-R0 不得修改：

- Material、Material Version、正文和来源状态；
- Observation Plan、TrainingTask、TaskGroupProgressionPlan；
- Question Candidate、Draft、Validation、Review、Adoption 和 Publication；
- Frozen Resource、Registry Head、Quality Trace 和 Observation Link；
- Learning Session、Round、Queue、Attempt、Checkpoint 和 Session Snapshot；
- Diagnosis、Feedback、Hint、Revision、Targeted、Retest 和 Transfer；
- Evidence、Progression Assessment、Student Profile 和 Growth Memory；
- Calibration Attempt、Calibration Event、Projection 和真实分母；
- Trial Window、Launch Record、Preflight Report、Activation State 和 Activation Audit；
- Feature Flag、Registry、Observation Policy 和 Decision Policy；
- Workbench、Learning 和普通用户路由的展示行为。

禁止调用：

- initialize / replace / command / restore backup；
- save / submit / adopt / publish / govern / repair / migrate；
- start Session / submit Answer / retry Provider；
- activate / deactivate / invalidate Trial；
- 清理浏览器存储、删除本地文件或终止进程。

允许的命令只能是：

- 文件与进程只读检查；
- GET 类边界探测；
- 纯函数审计；
- In-memory Fixture 验收；
- Production Build；
- 不会写正式事实的浏览器只读走查。

## 四、权威事实与证据优先级

### 4.1 事实优先级

同一状态出现冲突时，按以下顺序解释：

```text
当前实际运行探测
→ 当前正式 Store / Repository 事实
→ 当前 Git 与构建事实
→ 当前版本化策略和 Registry
→ 最新执行报告
→ 设计文档声明
```

规则：

- 浏览器旧页面仍显示内容，不证明 Runtime 正在运行；
- 文档写有 `REAL TRIAL ACTIVE`，不证明当前构建仍符合该激活身份；
- 自动化 Fixture 通过，不证明当前真实 Store 可读；
- Build 通过，不证明当前端口或 Runtime 已启动；
- Store 中存在 81 道题，不证明当前浏览器能够读取这些题；
- 页面显示“无任务”，必须由正式任务可用性事实支持，不能用读取失败代替。

### 4.2 当前基线证据

WP-R0 实施时应读取并保存当前执行值，初始已知证据为：

| 事实 | 当前已知值 | 权威来源 |
| --- | --- | --- |
| Git HEAD | `4d016c6` | Git |
| Shared Store Revision | `1963` | Shared Formal Resource Store |
| 活动材料 | `24` | 动态正式资源基线 |
| Current Head | `81` | Active Registry |
| Learning 可消费 | `81` | 正式资源准入投影 |
| 最新质量 | `65 ready / 16 guidance / 0 blocked` | 最新质量审计 |
| 录入端 | 工程回归通过 | Workbench State Debug |
| Learning | 工程回归通过，当前实例不可连接 | Unified Entry Debug + 实际探测 |
| Production Build | PASS，存在既有性能提示 | Vite Build |
| Trial Launch Commit | `119a019...` | 既有 Launch Record |
| 当前 Trial 身份 | 需要重新准入 | 当前 Git 与 Launch Record 比较 |

表中数量不是测试常量。审计报告必须同时记录 `observedAt` 和来源。

## 五、Runtime 依赖清单

### 5.1 依赖分类

WP-R0 必须建立 `RuntimeDependencyInventory`，至少覆盖：

| 依赖 | 角色 | 核心性 | 当前检查方式 |
| --- | --- | --- | --- |
| Node Runtime | 启动 Vite 与本地 Boundary | 核心 | 可执行路径与版本只读检查 |
| 项目依赖 | React、Vite 与本地模块 | 核心 | 文件和模块存在性检查 |
| `5174` 端口 | 当前本地 Runtime 入口 | 核心 | TCP Listen 与 HTTP 探测 |
| Vite Runtime | 前端与本地 Boundary 宿主 | 核心 | 页面与结构化 Boundary 探测 |
| Shared Formal Resource Store | 正式材料和题目权威来源 | 核心 | 只读 Snapshot 与状态读取 |
| Shared Formal Resource Boundary | 浏览器正式资源入口 | 核心 | GET 探测 |
| AI Provider 配置 | 正式诊断和生成 | 条件核心 | 仅检查配置状态，不读取值 |
| Browser Persistence | Session、Attempt 与恢复 | 核心 | 仅通过既有只读投影检查 |
| Trial Observation Repository | 真实观察旁路 | 非核心 | 只读模式和身份检查 |

### 5.2 依赖状态

```ts
type RuntimeDependencyStatus =
  | 'ready'
  | 'degraded'
  | 'blocked'
  | 'not_configured'
  | 'not_running'
  | 'not_checked'
  | 'insufficient_evidence';
```

硬规则：

- `not_checked` 不得投射为 `ready`；
- 非核心 Trial 依赖失败不得把 Learning 标记为 blocked；
- AI 配置是否阻断取决于当前路径是否需要实时 Provider；
- 端口有监听但正式边界不可用，Runtime 不能标记为 ready；
- Store 文件可读但浏览器 Boundary 不可用，正式数据健康与产品运行健康必须分别披露。

## 六、Reason Code Registry

### 6.1 Registry 目的

Reason Code Registry 是后续 WP-R1 健康接口和 WP-R2 页面投射的共同输入。它只定义稳定语义，不在 WP-R0 改写用户文案。

推荐 Schema：

```ts
type ProductRuntimeReasonDefinition = {
  registryVersion: 'product_runtime_reason_registry_v1';
  code: ProductRuntimeReasonCode;
  domain: 'runtime' | 'formal_store' | 'task' | 'session' | 'submission' | 'ai' | 'trial' | 'audit';
  severity: 'information' | 'degraded' | 'blocked';
  coreLearningImpact: 'none' | 'conditional' | 'blocked';
  retryability: 'not_applicable' | 'retryable' | 'restart_required' | 'reentry_required';
  dataPreservation: 'not_started' | 'preserved' | 'unknown_requires_check';
  defaultUserProjectionKey?: string;
  internalDescription: string;
};
```

### 6.2 冻结 Reason Code

| Code | Domain | 严重度 | 核心学习影响 | 恢复语义 |
| --- | --- | --- | --- | --- |
| `runtime_unreachable` | runtime | blocked | blocked | 启动 Runtime 后重试 |
| `runtime_health_timeout` | runtime | blocked | blocked | 检查 Runtime 后重试 |
| `runtime_port_conflict` | runtime | blocked | blocked | 人工处理端口冲突 |
| `runtime_identity_insufficient` | runtime | degraded | none | 补齐身份，不阻断普通学习 |
| `formal_store_unreadable` | formal_store | blocked | blocked | 修复读取或显式恢复 |
| `formal_store_uninitialized` | formal_store | blocked | blocked | 按正式初始化流程处理 |
| `formal_resource_boundary_unavailable` | formal_store | blocked | blocked | 恢复 Runtime Boundary |
| `formal_resource_baseline_inconsistent` | formal_store | blocked | blocked | 停止新 Session 并复核身份 |
| `no_learning_task_available` | task | information | none | 业务空状态，不机械重试 |
| `task_identity_mismatch` | task | blocked | blocked | 重新读取正式任务 |
| `learning_session_recovery_required` | session | information | none | 继续现有 Session |
| `learning_session_identity_mismatch` | session | blocked | blocked | 进入内部恢复检查 |
| `submission_recovery_required` | submission | information | none | 从 Checkpoint 继续 |
| `submission_identity_mismatch` | submission | blocked | blocked | 阻断重复正式提交 |
| `ai_provider_not_configured` | ai | degraded | conditional | 配置后重试相关动作 |
| `ai_provider_unreachable` | ai | degraded | conditional | 保留正式输入并重试 |
| `ai_provider_status_not_checked` | ai | information | conditional | 不猜测 Provider 可用 |
| `trial_identity_mismatch` | trial | degraded | none | effectiveMode 回落 off，重新准入 |
| `trial_reentry_required` | trial | information | none | 完成 WP-R3—R4 |
| `trial_observation_unavailable` | trial | degraded | none | Learning fail-open |
| `audit_evidence_incomplete` | audit | degraded | none | 报告 insufficient_evidence |
| `audit_zero_write_violation` | audit | blocked | blocked | 停止 WP-R0 并调查写入 |

### 6.3 Reason Code 约束

- Code 只允许小写蛇形命名；
- 相同语义不得创建同义 Code；
- Code 不包含材料、学生、题目或版本具体身份；
- 自由文本不能参与状态聚合；
- `severity` 与 `coreLearningImpact` 分开判断；
- Trial 问题不得映射为普通 Learning blocked；
- `no_learning_task_available` 不是错误；
- 未知 Code 只能投射为 `audit_evidence_incomplete`，不得显示内部原文给学生；
- Registry 变化必须升级版本并触发后续身份复核。

## 七、动态正式资源基线

### 7.1 基线对象

推荐冻结：

```ts
type DynamicFormalResourceBaseline = {
  schemaVersion: 'dynamic_formal_resource_baseline_v1';
  observedAt: string;
  storeInitialized: boolean;
  storeRevision: number;
  storeUpdatedAt: string;
  activeMaterialCount: number;
  coreReadingMaterialCount: number;
  targetedExcerptMaterialCount: number;
  currentPlanCount: number;
  currentTaskCount: number;
  activeObservationLinkCount: number;
  activeRegistryEntryCount: number;
  currentFormalVersionCount: number;
  frozenQualityTraceCount: number;
  learningConsumableQuestionCount: number;
  latestQuality: {
    ready: number;
    guided: number;
    blocked: number;
  };
  responseFormatBreakdown: Record<string, number>;
  difficultyBreakdown: Record<string, number>;
  issueCodes: string[];
  baselineDigest: string;
};
```

### 7.2 动态守恒规则

必须验证：

```text
Current Task
= Active Registry Head
= Current Formal Version
= Active Observation Link
= Frozen Quality Trace
= Learning Consumable Question
```

如业务允许某类对象存在合法差异，必须由版本化策略明确解释，不得在审计器中静默忽略。

禁止：

- `activeMaterialCount === 12`；
- `currentTaskCount === 46`；
- `currentTaskCount === 81`；
- 根据文档数量代替当前 Store；
- 因新增合法材料导致测试失败；
- 为通过测试修改正式数据数量。

允许：

- 比较执行前后同一动态基线的数量守恒；
- 对当前执行值生成证据报告；
- 用 Fixture 明确构造 0、1、多材料和不一致场景。

## 八、运行身份输入审计

WP-R0 只审计构成 Product Runtime Identity 的输入，不生成最终 Build Identity，也不改变 Trial 状态。

### 8.1 输入项目

- 当前 Git Commit；
- Worktree clean / dirty；
- 当前源码集合可读取性；
- 当前构建产物是否存在；
- 当前 Build Version 来源；
- Registry Version / Hash；
- Observation Policy Version / Hash；
- Decision Policy Version / Hash；
- Shared Store Revision；
- 现有 Launch Record 中的 Git / Build / Hash；
- 当前与 Launch Record 的一致性结论。

### 8.2 审计结论

```ts
type RuntimeIdentityInputAuditStatus =
  | 'aligned'
  | 'mismatch'
  | 'insufficient_evidence'
  | 'not_applicable';
```

当前已知应输出：

```text
Git Commit: mismatch
Build Version uniqueness: insufficient_evidence
Trial re-entry: required
Learning allowed: true
Observation effective mode recommendation: off
```

“推荐 off”只是只读结论，WP-R0 不执行状态写入。

## 九、零写入快照与 Digest

### 9.1 快照范围

WP-R0 运行前后至少比较：

- Shared Store Revision；
- Material / Plan / Task / Draft / Version / Registry / Link / Quality Trace 数量与 Digest；
- Learning Session 数量与 Digest；
- Attempt / Persistence Record 数量与 Digest；
- Diagnosis / Evidence / Profile 数量与 Digest；
- Calibration Attempt / Event / Projection 数量与 Digest；
- Trial Window / Event / Snapshot / Proposal / Activation 数量与 Digest；
- 当前浏览器活动学习身份的只读投影。

### 9.2 Digest 规则

- 对象排序后再计算稳定 Digest；
- 排除明确的审计运行时间，但不得排除业务 `updatedAt`；
- 同一事实不同读取顺序得到相同 Digest；
- 未知对象版本必须进入 Digest，不得被丢弃；
- 审计报告自身不进入正式事实 Digest；
- 浏览器只读检查不得通过刷新制造业务写入。

### 9.3 零写入失败

任一正式 Digest 或计数发生未授权变化时：

```text
WP-R0 = FAILED
Reason Code = audit_zero_write_violation
停止进入 WP-R1
保留前后证据
不得自动回滚或删除变化
```

## 十、审计 Schema

### 10.1 主报告

```ts
type ProductRuntimeBaselineAudit = {
  schemaVersion: 'product_runtime_baseline_audit_v1';
  auditId: string;
  startedAt: string;
  completedAt: string;
  mode: 'read_only';
  git: {
    commit: string;
    worktreeState: 'clean' | 'dirty';
  };
  dependencies: RuntimeDependencyInventoryItem[];
  formalResourceBaseline: DynamicFormalResourceBaseline;
  identityInputAudit: RuntimeIdentityInputAudit;
  routeAudits: RuntimeRouteAudit[];
  reasonCodes: ProductRuntimeReasonCode[];
  zeroWriteComparison: ZeroWriteComparison;
  findings: ProductRuntimeBaselineFinding[];
  status: 'passed' | 'passed_with_findings' | 'failed';
  reportDigest: string;
};
```

### 10.2 依赖项

```ts
type RuntimeDependencyInventoryItem = {
  dependencyId: string;
  role: string;
  requiredFor: Array<'learning_read' | 'learning_submit' | 'workbench_read' | 'workbench_ai' | 'trial_observation'>;
  status: RuntimeDependencyStatus;
  reasonCode?: ProductRuntimeReasonCode;
  evidenceCodes: string[];
  checkedAt: string;
};
```

### 10.3 路由审计

```ts
type RuntimeRouteAudit = {
  routeId: 'learning' | 'workbench' | 'internal';
  url: string;
  reachable: boolean;
  visibleState: string;
  runtimeBoundaryReachable: boolean;
  formalResourceBoundaryReachable: boolean;
  userProjectionKey?: string;
  reasonCodes: ProductRuntimeReasonCode[];
  evidenceCodes: string[];
};
```

### 10.4 Finding

```ts
type ProductRuntimeBaselineFinding = {
  findingId: string;
  code:
    | 'runtime_not_running'
    | 'runtime_state_projection_ambiguous'
    | 'fixed_baseline_assertion'
    | 'trial_build_identity_stale'
    | 'build_identity_not_content_addressed'
    | 'audit_contract_gap'
    | 'dependency_status_unknown';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  evidenceCodes: string[];
  explanation: string;
  authorizedNextWorkPackage: 'WP-R1' | 'WP-R2' | 'WP-R3' | 'WP-R4' | 'WP-R5' | 'WP-R6';
};
```

Finding 只授权后续工作包，不在 WP-R0 自动修复。

## 十一、当前应记录的已知 Finding

WP-R0 首次运行至少应验证而不是硬编码以下已知问题：

| Finding | 当前证据 | 去向 |
| --- | --- | --- |
| `runtime_not_running` | `5174` 当前不可连接 | WP-R1 |
| `runtime_state_projection_ambiguous` | Learning 将 Runtime 不可达投射为正式任务读取失败 | WP-R2 |
| `trial_build_identity_stale` | Launch Commit `119a019...` 与 HEAD `4d016c6` 不一致 | WP-R3 / WP-R4 |
| `build_identity_not_content_addressed` | Build Version 为长期固定常量 | WP-R3 |
| `fixed_baseline_assertion` | 两个来源治理测试仍断言活动材料为 12 | WP-R6 |
| `dependency_status_unknown` | 当前 AI Provider 运行可达性未形成统一只读状态 | WP-R1 |

若执行时事实已变化，报告必须输出新的当前结果，不得为了复现文档结论伪造 Finding。

## 十二、工程拆分

### WP-R0-A：Schema 与 Reason Registry

- 建立 Runtime Baseline Audit Schema；
- 建立 Runtime Dependency Status；
- 建立 Reason Code Registry 和 Guard；
- 建立未知版本、未知 Code 和非法组合测试；
- 所有代码保持纯函数。

### WP-R0-B：动态正式资源与身份输入 Adapter

- 复用现有 Shared Formal Resource Store 只读接口；
- 复用现有 Question Optimization Baseline；
- 建立动态数量守恒检查；
- 读取 Git、Build、Registry 和 Policy 当前输入；
- 不生成、持久化或激活最终 Runtime Identity。

### WP-R0-C：零写入快照与报告器

- 建立稳定排序和 Digest；
- 输出机器可读 JSON；
- 输出人工 Markdown；
- 对 Findings 分级并映射后续 WP；
- 报告器写入仅限开发报告目录，不进入正式 Store。

### WP-R0-D：Debug 与真实浏览器只读走查

- 执行 Schema、Reason Code、动态基线和零写入测试；
- 读取当前 Learning、Workbench 和 Internal 路由；
- 只读探测 Runtime Boundary；
- 不点击提交、开始、发布、恢复或激活按钮；
- 比较浏览器走查前后正式 Digest。

### WP-R0-E：基线签署与 WP-R1 授权

- 生成版本化 Baseline Report；
- 披露当前实际运行、数据、构建和 Trial 状态；
- 记录未解决 P0 / P1；
- 只授权 WP-R1，不把 WP-R0 写成运行已修复。

## 十三、自动化 Debug 验收矩阵

冻结 `R0-C01—R0-C32`：

| ID | 验收项 | 通过标准 |
| --- | --- | --- |
| R0-C01 | Audit Schema | 合法 `product_runtime_baseline_audit_v1` 通过 Guard |
| R0-C02 | 未知 Schema | 未知版本被拒绝，不进入主链 |
| R0-C03 | 只读模式 | `mode` 只能为 `read_only` |
| R0-C04 | 依赖状态 | 七种状态均可验证且未知状态被拒绝 |
| R0-C05 | Reason Registry | Code 唯一、字段完整、版本稳定 |
| R0-C06 | Reason 命名 | 非蛇形、小写或同义重复被拒绝 |
| R0-C07 | Runtime 不可达 | 映射 `runtime_unreachable`，不误报 Store 损坏 |
| R0-C08 | Runtime 超时 | 映射 `runtime_health_timeout` |
| R0-C09 | Store 不可读 | 映射 `formal_store_unreadable`，不误报无任务 |
| R0-C10 | 无任务 | 映射 information，不标记 Runtime blocked |
| R0-C11 | AI 未配置 | 映射 conditional impact，不输出密钥 |
| R0-C12 | Trial 错位 | 映射 degraded / reentry_required，不阻断 Learning |
| R0-C13 | 动态材料基线 | 从当前 Store 读取，不断言固定 12 / 24 |
| R0-C14 | 动态题目基线 | 从当前 Registry 读取，不断言固定 46 / 81 |
| R0-C15 | 数量守恒 | Task / Registry / Version / Link / Trace / Consumable 一致 |
| R0-C16 | 不一致基线 | 输出明确 issue，不自动修复数据 |
| R0-C17 | Response Format | Breakdown 总数等于 Current Head |
| R0-C18 | Difficulty | Breakdown 总数等于 Current Head |
| R0-C19 | Quality | ready + guided + blocked 等于 Current Head |
| R0-C20 | Baseline Digest | 同事实不同顺序得到相同 Digest |
| R0-C21 | Git Commit | 当前 Commit 可只读获取 |
| R0-C22 | Dirty Worktree | 准确披露，不修改工作树 |
| R0-C23 | Build 来源 | 固定常量被识别为身份不足而非通过 |
| R0-C24 | Launch 对比 | Commit 不一致得到 mismatch / reentry_required |
| R0-C25 | 未知 Launch | 输出 insufficient_evidence，不猜测 Trial 有效 |
| R0-C26 | Finding 路由 | 每个 Finding 只映射被授权的后续 WP |
| R0-C27 | 前后 Store | Revision、数量和 Digest 不变 |
| R0-C28 | 前后 Learning | Session / Attempt / Diagnosis / Evidence / Profile 不变 |
| R0-C29 | 前后 Calibration | Attempt / Event / Projection 与真实分母不变 |
| R0-C30 | 前后 Trial | Window / Event / Snapshot / Proposal / Activation 不变 |
| R0-C31 | 报告一致性 | 汇总、逐项 Finding、Reason Code 与证据一致 |
| R0-C32 | 幂等 | 连续运行两次得到相同事实 Digest，只有审计时间不同 |

自动化最低门槛：`32 / 32 PASS`。

## 十四、真实浏览器只读验收矩阵

冻结 `R0-B01—R0-B12`：

| ID | 场景 | 通过标准 |
| --- | --- | --- |
| R0-B01 | 列出当前标签页 | 只识别目标路由，不新建重复页面 |
| R0-B02 | Learning 当前状态 | 记录实际可见状态与当前 URL |
| R0-B03 | Runtime 不可达 | 页面状态、Boundary 探测与 Reason Code 一致 |
| R0-B04 | Workbench 当前状态 | 只读记录，不生成、优化、采用或发布 |
| R0-B05 | Internal 当前状态 | 只读取既有内部投影，不激活 Trial |
| R0-B06 | 控制台错误 | 错误分类进入内部证据，不直接作为用户文案 |
| R0-B07 | 页面与 Boundary 区分 | 旧页面可见不被误判为 Runtime ready |
| R0-B08 | 无任务 Fixture | 与 Runtime / Store 故障明确区分 |
| R0-B09 | Trial 状态 | 只读披露 requested / effective 与身份限制 |
| R0-B10 | 敏感信息 | 页面、日志和报告不包含 API Key 或学生正文 |
| R0-B11 | 零操作 | 不点击开始、提交、发布、恢复、删除或激活 |
| R0-B12 | 前后不可变性 | 正式资源、学习事实和真实分母 Digest 零变化 |

浏览器最低门槛：`12 / 12 PASS`。

若当前 Runtime 未运行，R0-B02—B07 应以该真实状态完成验收；WP-R0 不为了获得绿色页面而启动服务。启动能力属于 WP-R1。

## 十五、旧主链回归

WP-R0 至少回归：

- Question Optimization Baseline Audit；
- Current Question Generation Quality Audit；
- Formal Resource Latest Quality Admission；
- Material Corpus Maintenance Dry-run；
- Resource Coverage；
- Material Resource Workbench State；
- Unified Learning Entry；
- Learning Session Task Queue；
- Phase 16.3 Day 0 Integration；
- Product Complexity Convergence Stage 4；
- Real Trial Preflight；
- Production Build。

审计脚本若因历史固定数量断言失败，应登记 `fixed_baseline_assertion`，不得通过修改正式 Store 使旧断言重新成立。

## 十六、建议工程文件与命令

工程实现时建议增加：

```text
src/ai/schemas/productRuntimeBaselineAudit.schema.ts
src/ai/services/productRuntimeBaselineAuditService.ts
src/ai/services/productRuntimeZeroWriteSnapshotService.ts
src/ai/agents/productRuntimeBaselineAuditAgent.ts
src/ai/tests/runProductRuntimeReliabilityWPR0Debug.ts
src/pages/ProductRuntimeReliabilityWPR0Acceptance.jsx
```

建议命令：

```json
{
  "audit:product-runtime-reliability-wp-r0":
    "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runProductRuntimeReliabilityWPR0Debug.ts --report",
  "debug:product-runtime-reliability-wp-r0":
    "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runProductRuntimeReliabilityWPR0Debug.ts"
}
```

建议内部验收路由：

```text
#/internal/acceptance/product-runtime-reliability-wp-r0
```

内部页面只读取审计结果，不提供修复、启动或激活按钮。

## 十七、报告产物

WP-R0 工程完成后输出：

```text
docs/education/phase/reports/
product_runtime_reliability_wp_r0_baseline_debug_browser_acceptance_YYYY-MM-DD.md
```

报告至少包含：

1. Git Commit 与 Worktree State；
2. 审计 Schema 和 Reason Registry 版本；
3. Runtime Dependency Inventory；
4. 动态正式资源基线与 Digest；
5. 运行身份输入对比；
6. Learning、Workbench 和 Internal 当前路由状态；
7. R0-C01—C32 结果；
8. R0-B01—B12 结果；
9. 旧主链回归和 Build 结果；
10. 五类禁止写入与 Trial 状态写入计数；
11. 当前 P0 / P1 / P2 Finding；
12. WP-R1 精确授权范围；
13. 明确声明运行问题尚未在 WP-R0 修复；
14. 明确声明真实 Trial 尚未重新准入。

## 十八、完成门槛

只有同时满足以下条件，WP-R0 才可完成：

1. Runtime Baseline Audit Schema 冻结；
2. Reason Code Registry 冻结且无同义冲突；
3. Runtime Dependency Inventory 覆盖全部核心和条件依赖；
4. 动态正式资源基线不依赖历史固定数量；
5. Git、Build、Registry、Policy 和 Launch Record 输入均可只读审计；
6. 当前 Trial 错位能够输出 `reentry_required`，但不执行状态写入；
7. 零写入快照覆盖正式资源、学习、校准和 Trial；
8. R0-C01—R0-C32 为 `32 / 32 PASS`；
9. R0-B01—R0-B12 为 `12 / 12 PASS`；
10. 旧主链专项回归与 Production Build 通过；
11. 正式资源、Attempt、Evidence、Profile、真实校准分母和 Trial 状态未授权写入均为 0；
12. 机器可读与人工报告一致；
13. 所有 Finding 只映射到后续授权工作包；
14. 没有把 Runtime 未运行写成已修复；
15. 没有把 WP-R0 完成写成真实 Trial 已重新准入。

完成后允许状态：

```text
WP-R0 ENGINEERING COMPLETE
DEBUG ACCEPTED
READ-ONLY VERIFIED
WP-R1 AUTHORIZED
```

## 十九、进入 WP-R1 的精确边界

WP-R1 只允许基于 WP-R0 冻结事实实现：

- 统一启动器；
- Runtime 依赖预检；
- 固定端口与已运行实例判断；
- 只读 `/__runtime/health`；
- ready / degraded / blocked 聚合；
- 启动超时与明确终态；
- 密钥只显示配置状态；
- Internal Health 只读投影所需 API。

WP-R1 仍不得：

- 修改 Learning / Workbench 普通页面文案，该工作属于 WP-R2；
- 生成最终 Product Runtime Identity，该工作属于 WP-R3；
- 激活或重新准入 Trial，该工作属于 WP-R4；
- 提交真实答案或形成正式事件链，该工作属于 WP-R5；
- 修复旧固定断言和性能问题，该工作属于 WP-R6；
- 新增 Training Model 能力。

## 二十、冻结结论

`product_runtime_reliability_wp_r0_v1` 冻结以下事实：

1. WP-R0 是只读基线，不是运行修复；
2. 当前实际运行事实优先于文档状态；
3. 浏览器旧页面可见不等于 Runtime 仍在运行；
4. Runtime、Store、任务、Session、AI 和 Trial 必须分别审计；
5. Reason Code 只描述运行状态，不形成教育结论；
6. 当前 `24 / 81 / 81` 只作为动态基线证据；
7. 测试不得继续硬编码历史材料或题目数量；
8. Trial Launch Commit 与当前 Git 不一致必须报告重新准入；
9. WP-R0 不修改 Trial requested / effective Mode；
10. 审计前后正式资源、学习、校准和 Trial 事实必须零变化；
11. 未知状态输出 insufficient_evidence，不猜测 ready；
12. WP-R0 只授权 WP-R1，不提前实现后续工作包；
13. WP-R0 完成不等于 Runtime 已稳定；
14. WP-R0 完成不等于真实 Trial 已重新准入；
15. 本阶段不得新增产品功能或重构正式主链。

本文档已于 2026-08-25 达到 `WP-R0 ENGINEERING COMPLETE / DEBUG ACCEPTED / READ-ONLY VERIFIED / WP-R1 AUTHORIZED`。工程结果为 `R0-C 32 / 32 PASS`、`R0-B 12 / 12 PASS`、零写入验证通过、旧主链回归与 Production Build 通过。当前 Runtime 未运行、运行构建身份不足、Trial 身份错位和历史固定基线断言均作为后续工作包输入保留；本结论不表示 Runtime 已修复，也不表示真实 Trial 已重新准入。
