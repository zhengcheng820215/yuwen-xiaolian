# 产品复杂度收口阶段 4：真实 Trial Window 启动前工程实施与 Debug 验收文档

英文名称：Product Complexity Convergence Stage 4 Real Trial Window Preflight Engineering and Debug Plan

阶段契约版本：`product_complexity_convergence_stage4_real_trial_preflight_v1`

启动记录版本：`product_complexity_convergence_stage4_trial_launch_v1`

观察策略版本：`product_complexity_convergence_stage4_observation_policy_v1`

决策策略版本：`product_complexity_convergence_stage4_decision_policy_v1`

状态：`DESIGN FROZEN / ENGINEERING READY / PREFLIGHT IMPLEMENTATION REQUIRED / REAL TRIAL NOT STARTED`

日期：2026-08-25

关联文档：

- [产品复杂度收口总契约](./PRODUCT_COMPLEXITY_CONVERGENCE_CONTRACT.md)
- [阶段 4 稳定试用与退役决策工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_STABLE_TRIAL_AND_RETIREMENT_ENGINEERING_AND_DEBUG_PLAN.md)
- [阶段 4 真实 Trial Window 启动与运行验收契约](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_REAL_TRIAL_WINDOW_OPERATION_AND_ACCEPTANCE_CONTRACT.md)
- [阶段 4 工程、Debug 与浏览器验收报告](../education/phase/reports/product_complexity_convergence_stage4_engineering_debug_browser_acceptance_2026-08-25.md)

## 一、阶段定位

本阶段位于“阶段 4 隔离观察工程已验收”和“真实 Trial Window 正式启动”之间，只负责完成真实启动所必需的生产接线、显式激活控制和启动前验证。

本阶段不是新的产品功能阶段，不增加学生任务，不改变训练调度，也不直接开始真实试用。

阶段输入：

```text
已通过隔离验收的 Observation Schema / Repository / Aggregate
+ 已冻结的真实 Trial Window 运行契约
+ 既有正式 Owner Facts
```

阶段输出：

```text
正式 Owner Fact Adapter
+ 版本化 Source Registry
+ 显式 Observation Mode Controller
+ Launch Record / Preflight Report
+ 启动前自动化和真实浏览器验收
→ RTW-S01—RTW-S18 可执行
```

本阶段完成后的状态只能提升为：

```text
ACTIVATION PREFLIGHT PASSED / APPROVED TO ACTIVATE
```

不得自动提升为：

```text
REAL TRIAL ACTIVE
```

核心原则：

> 先证明正式事实能够被安全、准确、可审计地观察，再由单独的显式操作启动真实窗口；任何接线、配置或观察故障都必须关闭观察而不是阻断学习。

## 二、贯穿验收原则

本阶段必须继续证明：

> 旧主链零回归，并且新语义只在真实 Trial Window 启动前接线、预检和内部控制边界内生效。

具体要求：

1. `Material → Plan → Task → Candidate → Adopt → Revision → Publish → Learning` 主链不变；
2. Frozen Resource、Registry、题组顺序与 Session Snapshot 不变；
3. Attempt、Diagnosis、Evidence、Profile 与 Calibration 的正式写入者不变；
4. Observation 不得成为 Scheduler、Gate、Diagnosis、Evidence Admission 或 Profile Update 的输入；
5. Observation 失败、关闭或不可用时 Learning 必须继续；
6. 默认模式始终为 `off`；
7. 配置缺失、记录不一致、应用重启和未知版本均回落为 `off`；
8. 隔离验收数据不得进入真实分母；
9. 启动前测试不得写入正式资源、Attempt、Evidence、Profile 或真实校准分母；
10. 不从页面、DOM、学生答案或自由文本反推观察事实；
11. 不为增加样本放宽 Revision、Targeted、Retest 或 Transfer 的原生触发条件；
12. 工程通过不等于真实教育效果已验证。

## 三、当前基线与已确认缺口

### 3.1 已具备的工程能力

当前已经具备：

- Observation Event / Trial Window / Aggregate Snapshot / Decision Proposal Schema；
- `off / isolated_acceptance / real_trial` 模式语义；
- Event 身份、Hash、Schema、来源和真实分母准入校验；
- IndexedDB 与 In-Memory Observation Repository；
- Append-only Event、可重建 Snapshot 和只读 Proposal；
- Window 单向生命周期；
- 写入失败不阻断 Learning 的 fail-open 语义；
- 隔离 Debug 与 B4-01—B4-20 浏览器验收能力。

### 3.2 尚未形成的真实启动闭环

当前仍需补齐：

1. 八项能力到正式 Owner Fact 的生产 Adapter；
2. Adapter 在 Owner 正式提交完成后的唯一调用位置；
3. 版本化 Source Registry 与来源 Schema 白名单；
4. 不依赖 Query、DOM 或普通页面按钮的显式激活控制；
5. Launch Record、Preflight Report 与 Activation Audit；
6. 应用启动时的安全恢复与配置一致性检查；
7. `off → isolated_acceptance → off` 的生产接线烟测；
8. `RTW-S01—RTW-S18` 的自动化、浏览器与人工签署证据。

因此当前只能保持：

```text
observationMode = off
trialWindow.status = draft 或不存在
```

## 四、本阶段范围

### 4.1 必须完成

- 定义并实现正式 Owner Fact Adapter；
- 定义并实现 Source Registry；
- 定义并实现 Observation Activation Controller；
- 定义并持久化 Launch Record、Preflight Report 和 Activation Audit；
- 建立启动前内部控制页或等价受控入口；
- 建立生产接线隔离烟测；
- 建立自动化 Debug、真实浏览器矩阵和人工签署清单；
- 输出最终 Preflight 验收报告。

### 4.2 明确不做

- 不激活真实 Trial Window；
- 不观察真实学生事件；
- 不生成真实 Aggregate 或能力去留 Proposal；
- 不改变任何能力的原生触发策略；
- 不增加新的学生页面、提示、按钮或学习步骤；
- 不迁移或补写历史正式事件；
- 不补造缺失样本；
- 不建立第二套业务事实或新的学习 Outbox；
- 不自动关闭、删除或退役能力。

## 五、总体工程结构

```text
正式 Owner 完成既有业务提交
  ↓
Owner Fact Adapter（只读取结构化结果）
  ↓
Source Registry / Schema / Identity 校验
  ↓
Activation Controller
  ├─ off：零 Observation 写入
  ├─ isolated_acceptance：只写隔离来源，永不进入真实分母
  └─ real_trial：仅 active Window + 已批准 Launch Record 可用
  ↓
recordConvergenceObservation（失败不阻断 Learning）
  ↓
独立 Observation Repository
```

工程依赖方向必须单向：

```text
正式 Owner Fact → Observation
```

禁止反向依赖：

```text
Observation → Owner Decision / Learning / Evidence / Profile
```

## 六、正式 Owner Fact Adapter

### 6.1 Adapter 统一契约

建议冻结：

```ts
type ConvergenceObservationOwnerAdapter<TSource> = {
  capability: ComplexityConvergenceCapability;
  adapterVersion: string;
  sourceSchemaVersions: string[];
  adapt(input: TSource): ConvergenceObservationSourceFact[];
};
```

规则：

- Adapter 只接受 Owner 的结构化正式输出；
- Adapter 不执行 Owner 决策；
- Adapter 不修改输入对象；
- Adapter 可以返回零条事件，零条是合法结果；
- 一个 Owner 事实产生多生命周期观察时，每条事件必须有稳定身份；
- 不允许用页面是否显示、按钮是否点击或文案关键词作为事实依据；
- 不允许把学生答案、材料正文、题目正文或模型自由文本放入 Source Fact；
- 未知 Source Schema 必须排除，不得猜测兼容。

### 6.2 八项能力来源

| 能力 | 正式事实权威 | 必须观察 | 禁止观察 |
| --- | --- | --- | --- |
| Revision | Eligibility / Revision Attempt / Revision Evaluation | 合格、触发、完成、结果 Code | 首答与修订正文 |
| Targeted Micro-training | Assignment / Targeted Attempt / Targeted Result | 匹配、插入、完成、Gap 结果 | 片段正文与学生答案 |
| Retest | Retest Decision / Attempt / Evidence | 机会、独立完成、保持结果 | 通过 Observation 安排 Retest |
| Transfer | Transfer Decision / Attempt / Evidence | 机会、独立完成、迁移结果 | 通过 Observation 安排 Transfer |
| Successor Governance | Governance Case / Revision Chain | 风险、处置、恢复 | 改写 Frozen Resource |
| Calibration Review | Calibration Event / Integrity / Review | 样本状态、完整性、复核结果 | 修改正式题或 Profile |
| Feedback Projection | Stage 3 Projection / Runtime Action | 投射、回退、动作是否执行 | 反馈自由文本 |
| CoreAbilitySummary | Profile / Stage 3 Read Model | 可投射、查看或证据不足 | 新增能力结论 |

### 6.3 接线位置

Adapter 只能在以下时点被调用：

```text
Owner 正式提交已成功
+ Owner 身份已冻结
+ 结果 Code 已形成
→ 尝试记录 Observation
```

禁止在以下时点调用：

- Owner 提交前；
- 页面渲染时；
- 组件 mount 或 refresh 时；
- 尚未提交的草稿变化时；
- 为补回观察失败而重放正式业务写入时。

同一正式事实重复到达时，Observation Repository 必须通过稳定 `eventId` 幂等去重。

## 七、Source Registry

### 7.1 Registry Entry

建议冻结：

```ts
type ConvergenceObservationSourceRegistryEntry = {
  registryEntryVersion: 'product_complexity_convergence_stage4_source_registry_entry_v1';
  capability: ComplexityConvergenceCapability;
  ownerDomain: string;
  ownerFactType: string;
  ownerSchemaVersions: string[];
  adapterVersion: string;
  expectedBenefitCode: ComplexityConvergenceExpectedBenefitCode;
  allowedLifecycleStages: ComplexityConvergenceLifecycleStage[];
  allowedOutcomeCodes: ComplexityConvergenceObservedOutcomeCode[];
  requiredIdentityFields: string[];
  enabledForIsolatedAcceptance: boolean;
  enabledForRealTrial: boolean;
};
```

### 7.2 Registry Snapshot

每次启动前生成不可变：

```ts
type ConvergenceObservationSourceRegistrySnapshot = {
  sourceRegistryVersion: string;
  entries: ConvergenceObservationSourceRegistryEntry[];
  sourcePolicySnapshotHash: string;
  generatedAt: string;
};
```

规则：

- Registry Version 和 Hash 必须写入 Trial Window 与 Launch Record；
- Window 激活后不得原地修改 Registry；
- Adapter 与 Registry 不一致时 Observation 回落为 `off`；
- 某项能力未完成生产接线时，`enabledForRealTrial` 必须为 `false`；
- 不允许用“代码存在”替代 Registry 的显式登记。

## 八、显式激活控制

### 8.1 激活状态

模式仍保持三态：

```ts
type ComplexityConvergenceStage4ObservationMode =
  | 'off'
  | 'isolated_acceptance'
  | 'real_trial';
```

但生产解析不得只接受任意字符串。最终有效模式必须由以下事实共同决定：

```text
请求模式
+ 当前构建允许模式
+ active Trial Window
+ approved Launch Record
+ Registry / Policy / Schema Hash 一致
+ 当前时间位于 Window
→ effectiveObservationMode
```

任一条件缺失：

```text
effectiveObservationMode = off
learningAllowed = true
```

### 8.2 Activation Controller

建议冻结：

```ts
type ConvergenceObservationActivationState = {
  activationStateVersion: 'product_complexity_convergence_stage4_activation_state_v1';
  requestedMode: ComplexityConvergenceStage4ObservationMode;
  effectiveMode: ComplexityConvergenceStage4ObservationMode;
  trialWindowId?: string;
  launchRecordId?: string;
  registrySnapshotHash?: string;
  policySnapshotHash?: string;
  buildVersion?: string;
  activatedAt?: string;
  deactivatedAt?: string;
  reasonCodes: string[];
};
```

硬规则：

- 默认 `requestedMode = off`、`effectiveMode = off`；
- Query 参数不得开启 `real_trial`；
- localStorage 普通键不得单独开启 `real_trial`；
- 普通 Workbench 或 Learning 页面不得提供激活按钮；
- 应用重启后只有完整一致的激活记录才能恢复 `real_trial`；
- 激活记录损坏、未知版本或窗口终态时立即回到 `off`；
- `real_trial → off` 必须随时可执行；
- `off → real_trial` 必须经过预检批准与单独确认；
- 激活和关闭只影响 Observation，不影响学习主链。

### 8.3 内部控制入口

允许建立一个内部、只读优先的启动前控制页，职责仅为：

- 查看当前有效模式；
- 查看 draft Window；
- 查看 Registry 和策略快照；
- 执行隔离验收；
- 查看 RTW-S01—S18 结果；
- 生成 Launch Record 草案；
- 在全部通过后呈现“批准激活”条件。

页面不得：

- 修改正式学习事实；
- 人工制造 Owner Fact；
- 伪造真实学生事件；
- 自动激活 `real_trial`；
- 在测试未通过时提供绕过入口。

## 九、启动记录、预检报告与激活审计

### 9.1 Launch Record

沿用运行契约的：

```ts
type RealTrialWindowLaunchRecord = {
  launchRecordVersion: 'product_complexity_convergence_stage4_trial_launch_v1';
  trialWindowId: string;
  status: 'approved_to_activate' | 'activation_cancelled';
  gitCommit: string;
  buildVersion: string;
  startsAt: string;
  plannedEndsAt: string;
  timezone: string;
  participatingStudentIds: string[];
  observationPolicyVersion: string;
  decisionPolicyVersion: string;
  sourceRegistryVersion: string;
  sourcePolicySnapshotHash: string;
  enabledCapabilityModes: Record<ComplexityConvergenceCapability, string>;
  preflightCheckIds: string[];
  unresolvedIssues: string[];
  recordedAt: string;
};
```

补充规则：

- `unresolvedIssues` 非空不得标记 `approved_to_activate`；
- Launch Record 一经批准不可原地修改；
- 取消后不得复用，必须创建新记录；
- Launch Record 不保存学生姓名或学习内容。

### 9.2 Preflight Report

建议新增：

```ts
type RealTrialWindowPreflightReport = {
  reportVersion: 'product_complexity_convergence_stage4_preflight_report_v1';
  reportId: string;
  trialWindowId: string;
  gitCommit: string;
  buildVersion: string;
  startedAt: string;
  completedAt: string;
  checkResults: Array<{
    checkId: string;
    status: 'passed' | 'failed' | 'not_run';
    evidenceCodes: string[];
    issueCodes: string[];
  }>;
  formalResourceWriteCount: number;
  attemptWriteCount: number;
  evidenceWriteCount: number;
  profileWriteCount: number;
  realDenominatorWriteCount: number;
  eligibleForActivation: boolean;
};
```

`eligibleForActivation = true` 仅在：

- RTW-S01—S18 全部通过；
- 五类禁止写入计数全部为 0；
- 无未解决 P0 / P1；
- 所有拟启用能力均有正式 Adapter 和 Registry Entry。

### 9.3 Activation Audit

建议新增 Append-only 审计：

```ts
type ConvergenceObservationActivationAudit = {
  auditVersion: 'product_complexity_convergence_stage4_activation_audit_v1';
  auditId: string;
  action: 'requested' | 'approved' | 'activated' | 'deactivated' | 'rejected' | 'recovered_off';
  requestedMode: ComplexityConvergenceStage4ObservationMode;
  effectiveMode: ComplexityConvergenceStage4ObservationMode;
  trialWindowId?: string;
  launchRecordId?: string;
  reasonCodes: string[];
  occurredAt: string;
};
```

审计不记录操作者姓名、学生内容或自由文本意见。

## 十、持久化与迁移兼容

### 10.1 Repository 扩展

Observation Repository 建议增加独立 Store：

- `source-registry-snapshots`；
- `preflight-reports`；
- `launch-records`；
- `activation-states`；
- `activation-audits`。

不得与正式资源、Attempt、Evidence 或 Profile 共用 Store。

### 10.2 IndexedDB 升级

升级规则：

- 只增加 Store，不重写既有 Window、Event、Snapshot 或 Proposal；
- 旧数据库升级后若没有 Activation State，默认 `off`；
- 未知记录版本不得自动迁移为有效激活；
- 升级失败时 Learning 继续，Observation 保持 `off`；
- 旧隔离验收数据继续保留原 `dataOrigin`，不得进入真实分母；
- 不批量回填 Launch Record 或真实观察事件。

### 10.3 幂等与终态

- Registry Snapshot 以版本与 Hash 确认身份；
- Preflight Report 同一 `reportId` 内容冲突必须阻断；
- Launch Record 批准或取消后为终态；
- Activation Audit 仅追加；
- Window 的 `closed / invalidated` 不可恢复；
- 重复 Adapter 调用必须生成相同 Event ID。

## 十一、运行故障与恢复边界

### 11.1 Fail-open Learning

下列故障均不得阻断学习：

- Registry 读取失败；
- Activation State 读取失败；
- Adapter 抛错；
- Observation Repository 写入失败；
- Event 冲突；
- Snapshot 重建失败。

统一结果：

```text
learningAllowed = true
observationRecorded = false
effectiveObservationMode = off 或保持安全状态
runtimeIssueCode 已记录
```

### 11.2 不允许自动补写

为了保护真实分母，本阶段不建立“从正式业务库批量回放 Observation”的机制。

若真实 Window 运行中发生观察丢失：

- 保留正式学习结果；
- 记录完整性问题；
- 根据严重度暂停或使 Window 失效；
- 不通过历史扫描补造事件。

### 11.3 安全关闭

必须提供单一关闭动作：

```text
requestedMode = off
→ effectiveMode = off
→ 写入 deactivated Audit
→ Learning 不受影响
```

关闭不得删除已经存在的 Observation Event。

## 十二、工程任务拆分

### P0：必须完成后才可预检

#### PF-01 Source Registry Schema 与校验

- 增加 Entry / Snapshot Schema；
- 校验八项能力、Schema、Outcome、Lifecycle 和身份字段；
- 生成稳定 Hash。

#### PF-02 八项正式 Owner Fact Adapter

- 每项能力建立独立 Adapter；
- 明确正式调用点；
- 完成零条、多条、重复、未知版本和非法身份测试。

#### PF-03 Activation Controller

- 实现安全模式解析；
- 实现 `off / isolated_acceptance / real_trial` 条件门禁；
- 实现重启恢复与不一致回落；
- 禁止 Query 与普通页面直接激活。

#### PF-04 Launch / Preflight / Audit Schema

- 实现不可变 Launch Record；
- 实现 Preflight Report；
- 实现 Append-only Activation Audit。

#### PF-05 Repository 与迁移

- 升级 IndexedDB；
- 新增独立 Store；
- 验证旧记录零重写和升级失败安全回落。

#### PF-06 生产接线隔离烟测

- 在正式调用点运行 `isolated_acceptance`；
- 证明事件来源、身份、生命周期和 Outcome 映射；
- 证明真实分母为 0；
- 烟测后恢复 `off`。

### P1：启动前必须完成

#### PF-07 内部预检入口

- 展示模式、Window、Registry 和检查结果；
- 不展示学生答案或学习内容；
- 不进入普通产品导航；
- 不提供绕过按钮。

#### PF-08 自动化 Debug 矩阵

- Schema、Adapter、Registry、Controller、Repository、恢复和隐私检查；
- 旧主链专项回归；
- Production Build。

#### PF-09 真实浏览器预检矩阵

- 刷新、跨标签、IndexedDB 升级、失败恢复、默认关闭；
- 普通 Workbench / Learning 零新增入口；
- 页面与控制台无未处理错误。

#### PF-10 RTW-S01—S18 人工签署

- 由验收人核对自动化与浏览器证据；
- 生成不可变 Preflight Report；
- 所有检查通过后才允许生成 Launch Record。

### P2：不得阻断首轮但必须登记

- 独立导出运行报告；
- 多人远程权限控制；
- 外部监控与告警平台；
- 更长期的维护成本自动采集。

P2 不得被包装成首轮单学生本地 Trial 的启动必需条件。

## 十三、自动化 Debug 验收矩阵

建议新增 `PF-C01—PF-C56`：

| 编号 | 验收项 |
| --- | --- |
| PF-C01 | Source Registry Entry Schema 完整 |
| PF-C02 | Registry Snapshot Hash 稳定 |
| PF-C03 | 未知 Registry Version 被阻断 |
| PF-C04 | Adapter Version 与 Registry 对齐 |
| PF-C05 | 未登记能力不能进入 real_trial |
| PF-C06 | Revision Adapter 使用正式身份 |
| PF-C07 | Targeted Adapter 使用正式身份 |
| PF-C08 | Retest Adapter 使用正式身份 |
| PF-C09 | Transfer Adapter 使用正式身份 |
| PF-C10 | Successor Adapter 使用正式身份 |
| PF-C11 | Calibration Adapter 使用正式身份 |
| PF-C12 | Feedback Projection Adapter 使用正式身份 |
| PF-C13 | CoreAbilitySummary Adapter 使用正式身份 |
| PF-C14 | Adapter 不读取学生答案正文 |
| PF-C15 | Adapter 不读取页面或 DOM 状态 |
| PF-C16 | 未知 Owner Schema 返回排除结果 |
| PF-C17 | 同一 Owner Fact 产生稳定 Event ID |
| PF-C18 | 重复 Owner Fact 幂等去重 |
| PF-C19 | 冲突 Owner Fact 被识别 |
| PF-C20 | 默认 requestedMode 为 off |
| PF-C21 | 默认 effectiveMode 为 off |
| PF-C22 | Query 参数不能开启 real_trial |
| PF-C23 | 缺少 active Window 时回落 off |
| PF-C24 | 缺少批准 Launch Record 时回落 off |
| PF-C25 | Registry Hash 不一致时回落 off |
| PF-C26 | Policy Hash 不一致时回落 off |
| PF-C27 | Build Version 不一致时回落 off |
| PF-C28 | Window 时间范围外回落 off |
| PF-C29 | 终态 Window 不能进入 real_trial |
| PF-C30 | 应用重启缺少完整激活记录时回落 off |
| PF-C31 | isolated_acceptance 永不进入真实分母 |
| PF-C32 | off 模式零 Observation 写入 |
| PF-C33 | real_trial 只有完整门禁后才生效 |
| PF-C34 | Adapter 失败不阻断 Learning |
| PF-C35 | Repository 失败不阻断 Learning |
| PF-C36 | Observation 身份冲突不修改正式事实 |
| PF-C37 | Launch Record Schema 完整 |
| PF-C38 | unresolvedIssues 非空不能批准 |
| PF-C39 | 已取消 Launch Record 不可复用 |
| PF-C40 | Preflight Report Schema 完整 |
| PF-C41 | 未完成检查时 eligibleForActivation=false |
| PF-C42 | 五类禁止写入非零时不能批准 |
| PF-C43 | Activation Audit 仅追加 |
| PF-C44 | IndexedDB 升级只增加 Store |
| PF-C45 | 旧 Window / Event / Snapshot / Proposal 零重写 |
| PF-C46 | 未知持久化版本安全回落 off |
| PF-C47 | 隔离烟测后恢复 off |
| PF-C48 | 隔离烟测真实分母写入为 0 |
| PF-C49 | 正式资源写入为 0 |
| PF-C50 | Attempt 写入为 0 |
| PF-C51 | Evidence 写入为 0 |
| PF-C52 | Profile 写入为 0 |
| PF-C53 | 真实校准分母写入为 0 |
| PF-C54 | Stage 0—4 旧主链专项回归通过 |
| PF-C55 | Learning 主链专项回归通过 |
| PF-C56 | Production Build 通过 |

自动化最低门槛：`56 / 56 PASS`。

## 十四、真实浏览器 Debug 验收矩阵

建议新增 `PF-B01—PF-B20`：

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| PF-B01 | 首次打开应用 | Observation 为 off |
| PF-B02 | 普通 Learning 页面 | 无 Trial 或激活入口 |
| PF-B03 | 普通 Workbench 页面 | 无 Trial 或激活入口 |
| PF-B04 | 打开内部预检页 | 只显示结构化检查状态 |
| PF-B05 | 缺少 draft Window | 不允许生成批准记录 |
| PF-B06 | Registry 不完整 | 显示阻断且保持 off |
| PF-B07 | 执行 isolated_acceptance | 正式 Learning 可继续 |
| PF-B08 | 隔离事件产生 | 标记为排除来源 |
| PF-B09 | 隔离烟测结束 | 自动或显式恢复 off |
| PF-B10 | 页面刷新 | off 状态稳定恢复 |
| PF-B11 | 跨标签打开 | 不产生模式漂移 |
| PF-B12 | IndexedDB 升级 | 旧观察记录仍可读取 |
| PF-B13 | Registry Store 故障 | Learning 正常、Observation 关闭 |
| PF-B14 | Observation Store 故障 | Learning 正常、显示内部故障码 |
| PF-B15 | Query 注入 real_trial | 无效，仍为 off |
| PF-B16 | 非参与学生模拟事件 | 被排除且不进真实分母 |
| PF-B17 | 检查全部通过 | 可生成 Launch Record 草案 |
| PF-B18 | 存在未解决问题 | 不可批准激活 |
| PF-B19 | 控制台与页面检查 | 无未处理错误、无内容泄漏 |
| PF-B20 | 回到正常 Learning | 主链与阶段 3 行为不变 |

浏览器最低门槛：`20 / 20 PASS`。

## 十五、RTW-S01—RTW-S18 启动门槛映射

| 启动检查 | 工程证据 |
| --- | --- |
| RTW-S01 工程基线通过 | PF-C54—C56 |
| RTW-S02 默认模式 off | PF-C20—C21、PF-B01 |
| RTW-S03 无未解决 P0 / P1 | Preflight Report |
| RTW-S04 单学生身份冻结 | Launch Record + 身份验证测试 |
| RTW-S05 Session / Attempt 身份对齐 | PF-C06—C13、隔离事件抽查 |
| RTW-S06 时间范围 14—28 日 | Window Schema 校验 |
| RTW-S07 策略版本冻结 | PF-C25—C26 |
| RTW-S08 Registry / Source Hash 冻结 | PF-C01—C05 |
| RTW-S09 能力模式冻结 | Launch Record 校验 |
| RTW-S10 Repository 可写可读可重建 | Stage 4 基线 + PF-C44—C46 |
| RTW-S11 幂等与冲突检测 | PF-C17—C19 |
| RTW-S12 Observation 故障不阻断 Learning | PF-C34—C36、PF-B13—B14 |
| RTW-S13 隐私字段零写入 | PF-C14—C15、PF-B19 |
| RTW-S14 off→isolated→off 通过 | PF-C31—C32、PF-C47—C48、PF-B07—B10 |
| RTW-S15 五类正式写入为 0 | PF-C49—C53 |
| RTW-S16 Launch Record 完整且无未决问题 | PF-C37—C42、PF-B17—B18 |
| RTW-S17 正式 Owner Adapter 全部完成 | PF-C06—C16 |
| RTW-S18 显式激活控制与安全恢复完成 | PF-C20—C33、PF-B10—B15 |

启动最低门槛：`18 / 18 PASS`。

## 十六、Debug 执行顺序

必须按以下顺序执行：

```text
1. Schema / Registry 单元测试
2. 八项 Owner Adapter 单元测试
3. Activation Controller 单元测试
4. Repository / IndexedDB 迁移测试
5. Launch / Preflight / Audit 测试
6. In-Memory 隔离端到端测试
7. 生产接线 isolated_acceptance 烟测
8. Stage 0—4 旧主链专项回归
9. Learning 主链专项回归
10. Production Build
11. PF-B01—PF-B20 真实浏览器联调
12. RTW-S01—RTW-S18 人工签署
13. 生成 Preflight Report
14. 保持 observationMode = off
```

任一步失败：

- 后续“批准激活”步骤停止；
- Learning 和 Workbench 继续使用原主链；
- Observation 保持或恢复 `off`；
- 不生成 `approved_to_activate` Launch Record。

## 十七、测试命令与报告产物

工程实现时建议增加：

```json
{
  "debug:product-complexity-convergence-stage4-real-trial-preflight":
    "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runProductComplexityConvergenceStage4RealTrialPreflightDebug.ts",
  "debug:product-complexity-convergence-stage4-real-trial-preflight-browser-matrix":
    "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runProductComplexityConvergenceStage4RealTrialPreflightBrowserMatrixDebug.ts"
}
```

最终报告建议输出到：

```text
docs/education/phase/reports/
product_complexity_convergence_stage4_real_trial_preflight_engineering_debug_browser_acceptance_YYYY-MM-DD.md
```

报告必须包含：

- Git Commit、构建版本和时间；
- PF-C01—C56 结果；
- PF-B01—B20 结果；
- RTW-S01—S18 结果；
- 五类禁止写入计数；
- 隔离来源事件数与真实分母写入数；
- 未解决 P0 / P1；
- 当前 requested / effective mode；
- 是否允许生成 `approved_to_activate` Launch Record；
- 明确声明真实 Trial 尚未启动。

## 十八、完成定义

本阶段只有同时满足以下条件才算完成：

1. 八项正式 Owner Fact Adapter 全部接线；
2. Source Registry 与快照 Hash 可重建；
3. Activation Controller 默认关闭且可安全恢复；
4. Launch Record、Preflight Report 与 Activation Audit 可持久化；
5. IndexedDB 升级不改写旧观察事实；
6. PF-C01—PF-C56 为 `56 / 56 PASS`；
7. PF-B01—PF-B20 为 `20 / 20 PASS`；
8. RTW-S01—RTW-S18 为 `18 / 18 PASS`；
9. 正式资源、Attempt、Evidence、Profile 和真实校准分母写入均为 0；
10. 隔离烟测后 Observation Mode 恢复为 `off`；
11. 旧主链专项回归与 Production Build 通过；
12. 形成不可变 Preflight Report；
13. 没有未解决 P0 / P1；
14. 真实 Trial Window 仍未激活。

完成后状态可更新为：

```text
PREFLIGHT ENGINEERING COMPLETE
DEBUG ACCEPTED
FULL BROWSER ACCEPTED
RTW-S01—RTW-S18 PASSED
APPROVED TO ACTIVATE
REAL TRIAL NOT STARTED
```

## 十九、启动交接边界

本阶段完成后，下一任务不是继续开发功能，而是依据真实运行契约执行一次独立、显式的启动操作：

```text
确认 Preflight Report
→ 保存 approved_to_activate Launch Record
→ 将 draft Window 转为 active
→ 显式切换 effectiveMode = real_trial
→ 验证第一条真实事实
→ 记录 REAL TRIAL ACTIVE
```

只有到最后一步成功，才能宣告真实 Trial Window 已启动。

若用户决定暂缓试用：

- 保持 `off`；
- 保留预检报告；
- 不产生真实分母；
- 构建、Registry 或策略发生变化后必须重新执行受影响的预检项。

## 二十、冻结结论

本文档冻结启动前工程的范围、Schema、接线原则、激活控制、迁移边界和验收矩阵。

最终原则：

> 启动前工程的成功标准不是“能够写入观察数据”，而是“只有在完整批准条件下才能写入真实观察数据；其余所有状态都安全关闭，且永远不影响学生完成学习”。

当前状态保持：

```text
DESIGN FROZEN
PREFLIGHT ENGINEERING COMPLETE
DEBUG ACCEPTED
FULL BROWSER ACCEPTED
OBSERVATION MODE = off
OPERATIONAL SIGNATURE PENDING
REAL TRIAL NOT STARTED
```

工程验收事实见：

[产品复杂度收口阶段 4 真实 Trial 启动前工程、Debug 与浏览器验收报告](../education/phase/reports/product_complexity_convergence_stage4_real_trial_preflight_engineering_debug_browser_acceptance_2026-08-25.md)。

说明：`RTW-S01—RTW-S18` 的工程门禁已完成隔离验证；真实参与学生、正式时间窗、不可变 Preflight Report 与 `approved_to_activate` Launch Record 仍须在后续独立启动操作中显式签署，本文档不会自动生成或代填这些生产事实。
