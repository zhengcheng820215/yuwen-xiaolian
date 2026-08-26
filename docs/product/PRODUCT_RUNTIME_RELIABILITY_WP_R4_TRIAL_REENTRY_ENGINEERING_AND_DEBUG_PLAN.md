# 产品运行可靠性 WP-R4：Trial 重新准入工程实施与 Debug 验收文档

英文名称：Product Runtime Reliability WP-R4 Trial Re-entry Engineering and Debug Plan

对应总契约：`product_runtime_reliability_and_real_trial_reentry_v1`

阶段版本：`product_runtime_reliability_wp_r4_v1`

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / BROWSER ACCEPTED / REAL TRIAL REMAINS OFF / WP-R5 AUTHORIZED`

日期：2026-08-26

工程基线：`7cc4a30`（WP-R3 Runtime Identity、Trial 自动失效与验收已提交）

关联文档：

- [产品运行可靠性与真实 Trial 重新准入契约](./PRODUCT_RUNTIME_RELIABILITY_AND_REAL_TRIAL_REENTRY_CONTRACT.md)
- [WP-R3 Product Runtime Identity 与 Trial 自动失效工程实施及 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R3_RUNTIME_IDENTITY_AND_TRIAL_INVALIDATION_ENGINEERING_AND_DEBUG_PLAN.md)
- [真实 Trial Window 启动与运行验收契约](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_REAL_TRIAL_WINDOW_OPERATION_AND_ACCEPTANCE_CONTRACT.md)
- [真实 Trial 准入激活执行规程](./PRODUCT_RUNTIME_RELIABILITY_REAL_TRIAL_ADMISSION_ACTIVATION_RUNBOOK.md)
- [真实 Trial 启动前工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_REAL_TRIAL_PREFLIGHT_ENGINEERING_AND_DEBUG_PLAN.md)
- [WP-R3 Runtime Identity、Trial 自动失效与浏览器验收记录](../education/phase/reports/product_runtime_reliability_wp_r3_runtime_identity_debug_browser_acceptance_2026-08-26.md)
- [WP-R4 Trial 重新准入工程、Debug 与浏览器验收记录](../education/phase/reports/product_runtime_reliability_wp_r4_trial_reentry_debug_browser_acceptance_2026-08-26.md)

## 一、文档目的

WP-R4 将 WP-R3 已建立的内容寻址 Runtime Identity 转化为一次新的、可证明身份一致的真实 Trial 准入事实。

本阶段冻结以下工程边界：

1. 当前 Runtime 通过哪些检查后才可生成新的 Re-entry Preflight；
2. 新 Trial Window、Preflight Report、Launch Record 与 Identity Binding 如何保持一一对应；
3. 哪些条件全部满足时才允许显式激活 `real_trial`；
4. 任何检查、持久化或激活失败时如何保持 `effectiveMode = off`；
5. 哪些步骤必须全域零写入，哪些步骤只允许写入有限 Trial 控制事实；
6. 如何兼容旧 Window、旧 Preflight、旧 Launch、旧 Activation 和旧 Observation；
7. 如何证明 WP-R4 没有提前执行 WP-R5 的真实学习烟测，也没有改变旧主链。

WP-R4 的完成语义仅为：

```text
当前运行构建具备一套新的、身份绑定的 Trial 准入记录，
并可在一次显式操作中安全进入 real_trial。
```

WP-R4 完成不等于：

- 已完成真实学习烟测；
- 已形成新的真实 Observation；
- 已验证教育效果；
- 旧 Trial 已恢复；
- 当前工作树的任意变化仍继续被准入。

## 二、阶段输入、输出与完成状态

### 2.1 前置输入

进入 WP-R4 工程开发前必须同时满足：

- WP-R0—R3 工程、Debug 与浏览器验收均通过；
- 当前 Runtime Identity Schema 为 `product_runtime_identity_v1`；
- Runtime Identity 可从真实 Production Artifact 复算；
- Trial 自动失效已生效，当前 `effectiveMode = off`；
- 历史 Launch 无 Binding 时只读投射为 `legacy_unverifiable`；
- Learning 与 Workbench 在 Trial `off` 时仍可正常运行；
- 不存在阻断 WP-R4 的未解决 P0 / P1；
- 当前工作树在正式准入构建时必须为 `clean`。

若当前 Runtime Identity 为 `dirty / missing / invalid / mismatch`，只能执行 WP-R4 工程与隔离验收，不能创建真实准入包。

### 2.2 阶段输出

WP-R4 应交付：

- Re-entry Preflight v2 Schema、校验器与构建器；
- Launch Record v2 Schema、校验器与构建器；
- WP-R3 已冻结的 Identity Binding v1 的创建能力；
- 原子 Re-entry Approval Bundle Repository 能力；
- 显式激活命令与原子激活提交；
- 激活失败、身份漂移、过期和并发冲突的 fail-safe 处理；
- Internal Health / Acceptance 的只读投射；
- Debug Case、真实浏览器矩阵、零写入证据与旧主链回归报告。

### 2.3 阶段完成状态

只有工程和验收全部通过后，本文档状态才可更新为：

```text
ENGINEERING COMPLETE
DEBUG ACCEPTED
BROWSER ACCEPTED
REAL TRIAL RE-ENTRY READY
WP-R5 AUTHORIZED
```

若仅完成文档冻结，状态保持：

```text
DESIGN FROZEN / ENGINEERING READY / REAL TRIAL REMAINS OFF
```

### 2.4 本次工程验收结果

2026-08-26 已完成本文件冻结的 Schema、Preflight、Approval Bundle、显式激活、失败回退、Repository、Internal Acceptance 与回归工程：

- `R4-C01—R4-C48`：`48 / 48 PASS`；
- `R4-B01—R4-B18`：`18 / 18 PASS`；
- WP-R0—R3、原 Stage 4 Preflight、Learning、Workbench 与 Formal Resource 回归全部通过；
- Production Build 与 `git diff --check` 通过；
- 真实浏览器只读验收页显示 `18 / 18 全部通过`，当前 Trial 为 `关闭`；
- 验收过程没有保存真实准入包、没有激活 Trial，也没有创建真实 Observation 或学生事实。

当前工作树包含 WP-R4 尚未提交的工程改动，因此 Runtime Identity 应判定为 `dirty / not eligible`。本次只授权进入 WP-R5 的准备环节；只有在提交后以 clean Production Artifact 重新执行 Preflight 并显式确认，才允许创建真实准入包和激活新的 Trial Window。

## 三、范围与非目标

### 3.1 本阶段范围

- 生成当前 clean Production Runtime Identity；
- 只读执行 Re-entry Preflight；
- 构建新的 Trial Window 草案；
- 构建不可变 Preflight Report v2；
- 构建不可变 Launch Record v2；
- 创建不可变 Runtime Identity Binding v1；
- 原子保存准入包；
- 显式激活当前准入包；
- 激活后立即复读并确认状态；
- 失败时保持或恢复 Trial `off`；
- 继续复用 WP-R3 自动失效能力。

### 3.2 非目标

WP-R4 不负责：

- 重新激活旧 Window、旧 Launch 或旧 Binding；
- 为旧 Launch 事后补建 Binding；
- 修改 Product Runtime Identity 的八项输入；
- 修改 Formal Resource、Registry Head 或 Question 内容；
- 创建、恢复或推进学生 Learning Session；
- 提交真实学生回答；
- 制造测试 Observation 或真实校准分母；
- 执行完整真实学习烟测；
- 分析真实 Trial 收益；
- 将工程测试数据计入真实教育效果。

完整真实学习烟测与最小事件链属于 WP-R5。

## 四、核心不变量

WP-R4 冻结以下不变量：

1. **重新准入只针对当前 Runtime**：当前 Identity 与任何准入事实不完全一致时不得激活。
2. **旧 Trial 不恢复**：重新准入必须创建新 Window、新 Preflight、新 Launch 和新 Binding。
3. **先证明、后写入**：Preflight 计算和失败结论全域零写入。
4. **准入包成组提交**：Window、Report、Launch、Binding 不允许部分成功后被视为可激活。
5. **激活必须显式**：保存准入包不自动把 `requestedMode / effectiveMode` 改为 `real_trial`。
6. **激活提交原子化**：Window 激活、Activation State 和 Activation Audit 必须同成同败。
7. **任何不确定性都回落 off**：不能证明 aligned 等同不允许采集，不等同 Learning 不可用。
8. **Learning 始终 fail-open**：Trial 准入或观察失败不阻断正式学习。
9. **不制造真实数据**：WP-R4 的 Debug、浏览器验收和激活确认均不得伪造 Owner Fact。
10. **每个阶段证明旧主链零回归**：新语义只在 WP-R4 的 Trial 控制边界内生效。

### 4.1 旧活动 Trial 的操作收口

若 Internal 状态复读发现旧 `real_trial` 仍保留在浏览器持久化控制面，而当前 Runtime Health 已将其判为 `legacy_unverifiable / trial_reentry_required`，必须先通过既有失效服务使控制状态回落 `off`，并将仍为 `active` 的旧 Window 状态推进为 `invalidated`，再执行新 Preflight。Internal 状态页可以提供“关闭旧 Trial，准备重新准入”这一单向安全操作。旧状态关闭后，同一 Internal 页面可以承载 R4 v2 真实操作入口，但必须严格分离：当前事实计算 R4-P01—R4-P24、原子保存 Approval Bundle、操作者勾选确认、显式激活。普通产品页面、旧 v1 激活函数和全通过 Fixture 均不得提供或替代该入口。关闭操作与重新准入都不得删除或覆盖旧 Window、Launch、Binding、Audit 或 Observation。

## 五、Owner 与事实边界

| 正式事实 | 唯一 Owner | WP-R4 权限 |
| --- | --- | --- |
| Product Runtime Identity | Runtime Identity Builder | 只读复算与引用 |
| Formal Resource Snapshot | Formal Resource Store / Registry | 只读 |
| Source Registry Snapshot | Convergence Registry Owner | 只读 |
| Trial Window | Trial Window Owner | 新建一条；禁止复用旧 Window |
| Re-entry Preflight Report | Runtime Re-entry Preflight Owner | 新建一条不可变记录 |
| Launch Record | Trial Launch Owner | 新建一条不可变记录 |
| Runtime Identity Binding | Trial Runtime Identity Binding Owner | 与新 Launch 一一绑定新建 |
| Activation State | Trial Activation Owner | 显式激活时更新当前状态 |
| Activation Audit | Trial Activation Audit Owner | 激活或拒绝时追加一条 |
| Observation Event | Formal Owner Fact Adapter | WP-R4 禁止制造 |
| Learning Session / Attempt / Evidence / Profile | 既有 Learning Owner | 零写入 |

不得在 Preflight、Launch 或 Binding 中复制学生答案、材料正文、题目正文、模型自由文本或密钥。

## 六、重新准入状态机

```text
effectiveMode = off
  → compute_preflight（全域零写入）
  → ineligible：保持 off，结束
  → eligible：等待显式“保存准入包”
  → commit approval bundle
      → 失败：保持 off，无可激活准入包
      → 成功：Window = draft，Trial 仍 off
  → explicit activate
      → 重新读取 Runtime / Report / Launch / Binding / Window
      → 任一不一致：保持 off，写入不得发生
      → 全部一致：原子写 Window active + Activation State real_trial + Audit activated
  → reread confirmation
      → 不一致：立即执行 WP-R3 自动失效，回落 off
      → 一致：WP-R4 完成，等待 WP-R5 真实学习烟测
```

禁止以下捷径：

```text
旧 Launch + 新 Identity → 激活
旧 Window + 新 Binding → 激活
eligible Preflight → 自动激活
仅 buildVersion 相同 → 激活
先激活 State、后补 Binding → 激活
Activation State 写成功但 Audit 失败 → 视为成功
```

## 七、版本常量冻结

WP-R4 工程新增：

```ts
export const PRODUCT_RUNTIME_RELIABILITY_WP_R4_PREFLIGHT_POLICY_VERSION =
  'product_runtime_reliability_wp_r4_preflight_policy_v1' as const;

export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_PREFLIGHT_REPORT_V2_VERSION =
  'product_complexity_convergence_stage4_preflight_report_v2' as const;

export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_LAUNCH_RECORD_V2_VERSION =
  'product_complexity_convergence_stage4_trial_launch_v2' as const;

export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_AUDIT_V3_VERSION =
  'product_complexity_convergence_stage4_activation_audit_v3' as const;
```

继续复用：

```ts
product_runtime_identity_v1
real_trial_runtime_identity_binding_v1
product_complexity_convergence_stage4_activation_state_v2
```

旧 v1 / v2 Reader 必须保留；不得原地改变历史 Schema 语义。

## 八、新 Re-entry Preflight 冻结

### 8.1 Preflight v2 Schema

```ts
type RealTrialReentryPreflightReportV2 = {
  reportVersion: 'product_complexity_convergence_stage4_preflight_report_v2';
  preflightPolicyVersion: 'product_runtime_reliability_wp_r4_preflight_policy_v1';
  reportId: string;
  trialWindowId: string;
  plannedLaunchRecordId: string;
  plannedRuntimeIdentityBindingId: string;

  runtimeIdentityVersion: 'product_runtime_identity_v1';
  runtimeIdentityDigest: `sha256:${string}`;
  formalResourceSnapshotDigest: `sha256:${string}`;
  executablePolicyBundleDigest: `sha256:${string}`;
  trialPolicyBundleDigest: `sha256:${string}`;
  providerBoundaryDigest: `sha256:${string}`;

  gitCommit: string;
  worktreeState: 'clean';
  buildVersion: string;
  sourceRegistryVersion: string;
  sourcePolicySnapshotHash: string;
  observationPolicyVersion: string;
  decisionPolicyVersion: string;

  startedAt: string;
  completedAt: string;
  expiresAt: string;
  checkResults: RealTrialReentryPreflightCheckResult[];

  formalResourceWriteCount: 0;
  sessionWriteCount: 0;
  attemptWriteCount: 0;
  evidenceWriteCount: 0;
  profileWriteCount: 0;
  realDenominatorWriteCount: 0;
  trialObservationWriteCount: 0;
  trialControlWriteCount: 0;

  eligibleForActivation: boolean;
  issueCodes: string[];
};
```

`trialControlWriteCount = 0` 描述的是 Preflight 计算期间；报告随后作为准入包的一部分显式保存，不改变该审计事实。

### 8.2 Preflight 有效期

- 默认最大有效期为 30 分钟；
- 实际值由版本化 Preflight Policy 计算，不能由页面自由输入；
- 跨 Runtime 重启不自动失效，但必须重新复算当前 Identity；
- Identity Digest、Formal Digest、Policy Digest、Provider Boundary 或 Window 草案变化时立即失效；
- 到达 `expiresAt` 后不得激活，必须重新执行 Preflight；
- 过期报告保持只读，不更新为新时间。

### 8.3 Check ID 冻结 R4-P01—R4-P24

| ID | 检查项 | 通过条件 |
| --- | --- | --- |
| R4-P01 | Runtime Health | 当前 Runtime `ready` |
| R4-P02 | Runtime Identity 存在 | Identity Envelope 可读取 |
| R4-P03 | Runtime Identity 结构 | Schema 与 Digest 复算通过 |
| R4-P04 | Clean Build | `worktreeState = clean` |
| R4-P05 | Artifact Identity | 当前 Production Artifact 与身份一致 |
| R4-P06 | Formal Snapshot | Current Frozen Resource Digest 一致 |
| R4-P07 | Formal Store | Store 可读且 Current Head 完整 |
| R4-P08 | Executable Policy | 执行策略 Digest 一致 |
| R4-P09 | Trial Policy | Trial 策略 Digest 一致 |
| R4-P10 | Provider Boundary | Provider 边界 Digest 一致 |
| R4-P11 | Provider Readiness | 真实 Provider 配置可用且不泄漏密钥 |
| R4-P12 | Source Registry | Registry Version / Hash 与 Identity 一致 |
| R4-P13 | Owner Schema | 真实观察 Owner 清单完整且版本受支持 |
| R4-P14 | Observation Policy | Version / Hash 与 Trial Policy 一致 |
| R4-P15 | Decision Policy | Version / Hash 与 Trial Policy 一致 |
| R4-P16 | Learning 核心回归 | 指定自动化回归证据全部通过 |
| R4-P17 | Workbench 核心回归 | 指定自动化回归证据全部通过 |
| R4-P18 | Trial 当前状态 | 当前 requested / effective 均为 `off` |
| R4-P19 | 新 Window 身份 | Window ID 未使用，时间和学生范围有效 |
| R4-P20 | 历史隔离 | 不复用旧 Window / Launch / Binding / 分母 |
| R4-P21 | 当前活动冲突 | 不存在另一个 active Window |
| R4-P22 | 未解决风险 | P0 / P1 均为 0 |
| R4-P23 | 零写入审计 | 八类受保护写入计数均为 0 |
| R4-P24 | 时间与完整性 | 检查完整、未过期、无重复 ID |

任一 Check 为 `failed / not_run` 时：

- `eligibleForActivation = false`；
- 不保存准入包；
- 不改变 Activation State；
- 不创建 Window、Launch 或 Binding；
- Learning 继续运行。

### 8.4 Preflight 与 WP-R5 边界

R4-P16 / R4-P17 只消费已声明的自动化回归证据，不创建真实 Session 或 Attempt。完整真实学习烟测仍属于 WP-R5，不能为了让 WP-R4 通过而提前制造真实学习事实。

## 九、新 Launch Record 冻结

### 9.1 Launch Record v2

```ts
type RealTrialWindowLaunchRecordV2 = {
  launchRecordVersion: 'product_complexity_convergence_stage4_trial_launch_v2';
  launchRecordId: string;
  trialWindowId: string;
  status: 'approved_to_activate';

  preflightReportId: string;
  runtimeIdentityBindingId: string;
  runtimeIdentityDigest: `sha256:${string}`;

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
  enabledCapabilityModes: Record<string, string>;

  preflightCheckIds: string[];
  unresolvedIssues: [];
  recordedAt: string;
};
```

### 9.2 Launch 约束

- 只接受 v2 Preflight；
- `preflightCheckIds` 必须精确包含 R4-P01—R4-P24；
- `runtimeIdentityDigest` 必须与 Preflight 和 Binding 完全相同；
- `preflightReportId / runtimeIdentityBindingId` 必须真实存在且互相指向同一 Window；
- `unresolvedIssues` 必须为空；
- Launch 创建后不可修改；
- Launch `approved_to_activate` 只表示准入包完整，不表示已经激活；
- 一个 Launch 最多发生一次成功激活；
- 过期、被拒绝或身份漂移的 Launch 永不复用。

## 十、Identity Binding 创建冻结

WP-R4 复用 WP-R3 已冻结的：

```ts
type RealTrialRuntimeIdentityBinding = {
  bindingVersion: 'real_trial_runtime_identity_binding_v1';
  bindingId: string;
  launchRecordId: string;
  trialWindowId: string;
  runtimeIdentityVersion: 'product_runtime_identity_v1';
  runtimeIdentityDigest: `sha256:${string}`;
  formalResourceSnapshotDigest: `sha256:${string}`;
  executablePolicyBundleDigest: `sha256:${string}`;
  trialPolicyBundleDigest: `sha256:${string}`;
  boundAt: string;
};
```

创建规则：

- Binding ID 由 `trialWindowId + launchRecordId + runtimeIdentityDigest` 稳定派生；
- Binding 必须与 Launch 在同一准入包事务中创建；
- Binding 创建前必须复算当前 Identity；
- Binding 创建后不可修改、不可替换、不可补写；
- 同一 Launch 对应 0 或 1 个 Binding；只有 1 个才可激活；
- 同一 Binding 不能被第二个 Launch 或 Window 引用；
- Binding 不保存绝对路径、环境变量值、密钥或学生事实。

## 十一、Re-entry Approval Bundle 原子提交

### 11.1 Bundle 内容

```ts
type RealTrialReentryApprovalBundle = {
  trialWindow: ComplexityConvergenceTrialWindow; // status = draft
  preflightReport: RealTrialReentryPreflightReportV2;
  launchRecord: RealTrialWindowLaunchRecordV2;
  runtimeIdentityBinding: RealTrialRuntimeIdentityBinding;
};
```

### 11.2 Repository 命令

WP-R4 必须增加一个应用层原子命令，禁止页面顺序调用四个现有 `save*` 方法拼装事实：

```ts
commitRealTrialReentryApprovalBundle(bundle): Promise<{
  status: 'committed' | 'duplicate';
  trialWindowId: string;
  preflightReportId: string;
  launchRecordId: string;
  runtimeIdentityBindingId: string;
}>;
```

事务约束：

- 四个对象在同一事务中校验、写入并提交；
- 任一对象冲突、缺失或写入失败时全部不提交；
- 相同完整 Bundle 重试返回 `duplicate`，新增写入为 0；
- 相同 ID 但内容不同必须返回冲突，不覆盖旧事实；
- Bundle 提交后 Trial 仍为 `off`；
- 不允许通过直接 Repository 写入绕过应用层命令进入正式准入。

IndexedDB 实现必须使用覆盖相关 Object Store 的单一 readwrite transaction；In-memory 实现必须先完整校验再一次性替换内存快照。

## 十二、激活条件冻结

显式激活 `real_trial` 前必须重新读取并同时证明：

1. 当前 Activation State 的 `effectiveMode = off`；
2. 当前 Runtime Health 为 `ready`；
3. 当前 Runtime Identity 存在、有效且为 `clean`；
4. 当前 Runtime Identity Digest 与 Preflight、Launch、Binding 完全一致；
5. Formal、Executable Policy、Trial Policy 三项组件 Digest 与 Binding 完全一致；
6. Provider Boundary 与 Preflight 一致，Provider 当前具备真实调用条件；
7. Preflight v2 全部 24 项通过、`eligibleForActivation = true` 且未过期；
8. Launch v2 为 `approved_to_activate`，且 unresolvedIssues 为空；
9. Window 为新建 `draft`，当前时间落在批准时间范围；
10. Window、Preflight、Launch、Binding 的 ID 和参与学生范围一致；
11. Registry / Observation Policy / Decision Policy 与当前 Runtime 一致；
12. 不存在另一个 active Window 或更新后的 Activation；
13. 自 Preflight 完成后受保护数据域没有未授权写入；
14. 操作者执行了明确的激活命令；
15. 激活前 Observation / Real Denominator 仍为 0。

页面出现“可以激活”只表示以上条件当前成立；真正激活仍需一次明确操作。不得在页面加载、Health 刷新、Bundle 保存或 Runtime 启动时自动激活。

## 十三、原子激活提交

### 13.1 激活结果

成功激活必须在同一事务内：

1. 将新 Window 从 `draft` 迁移为 `active`，其他身份字段不变；
2. 保存 Activation State v2：
   - `requestedMode = real_trial`；
   - `effectiveMode = real_trial`；
   - `trialWindowId / launchRecordId / runtimeIdentityBindingId` 完整；
   - `activatedRuntimeIdentityDigest` 等于当前 Identity；
   - `activatedAt / updatedAt` 为同一提交时间；
   - `reasonCodes = ['real_trial_reentry_approved']`；
3. 追加 Activation Audit v3 `activated` 事实，包含 Window、Launch、Binding 与 Runtime Digest。

### 13.2 激活应用层命令

```ts
activateRealTrialReentry(input): Promise<{
  status: 'activated' | 'already_activated' | 'rejected';
  effectiveMode: 'off' | 'real_trial';
  reasonCodes: string[];
}>;
```

- 全部条件通过才进入事务；
- 同一 Bundle 重复激活返回 `already_activated`，新增写入为 0；
- 不同 Bundle 并发时只允许一个成功；
- State 与 Audit 任一写入失败，Window 不得变为 active；
- 成功后必须重新读取三项事实并复核；
- 复核失败立即调用 WP-R3 自动失效，真实 Observation 保持 0。

## 十四、稳定 Reason Code

WP-R4 新增以下内部 Code：

```text
trial_reentry_preflight_incomplete
trial_reentry_preflight_failed
trial_reentry_preflight_expired
trial_reentry_runtime_not_ready
trial_reentry_runtime_identity_not_clean
trial_reentry_runtime_identity_changed
trial_reentry_formal_snapshot_changed
trial_reentry_policy_changed
trial_reentry_provider_unavailable
trial_reentry_window_conflict
trial_reentry_window_invalid
trial_reentry_launch_invalid
trial_reentry_binding_invalid
trial_reentry_bundle_conflict
trial_reentry_bundle_commit_failed
trial_reentry_activation_conflict
trial_reentry_activation_commit_failed
trial_reentry_activation_confirmation_failed
trial_reentry_zero_write_violation
trial_reentry_approved
```

普通 Learning / Workbench 不展示这些内部术语。Internal 页面必须同时给出：发生阶段、当前是否 off、允许的恢复动作。

## 十五、失败回滚与恢复冻结

| 失败点 | 必须结果 | 恢复动作 |
| --- | --- | --- |
| Identity missing / dirty / invalid | 全域零写入，保持 off | 生成 clean Production Identity 后重跑 |
| Preflight 任一项失败 | 全域零写入，保持 off | 修复原因并新建 Preflight |
| Preflight 过期 | 不激活、不改旧报告 | 新建 Preflight |
| Bundle 校验冲突 | 四项均不提交 | 使用新 ID 或修复输入 |
| Bundle 事务失败 | 不存在可激活的部分 Bundle | 重试同一完整 Bundle |
| Bundle 已保存后 Identity 变化 | Bundle 只读保留，保持 off | 创建全新的准入包 |
| 激活前并发冲突 | 激活事务零写入 | 重新读取当前 Activation |
| 激活事务任一步失败 | Window 保持 draft，State 保持 off，无 activated Audit | 重试或新建准入包 |
| 激活后确认失败 | WP-R3 自动失效到 off | 查明原因并重新准入 |
| Provider 临时不可用 | Learning 可继续，Trial 不激活或失效 | Provider 恢复后重新 Preflight |
| Internal 页面失败 | 不影响 Learning，不改变 Trial | 修复只读投射 |

禁止以“回滚”为名：

- 删除旧 Window、Launch、Binding、Audit 或 Observation；
- 把旧 Window 改回 active；
- 修改旧 Runtime Digest；
- 清空 Learning 数据；
- 覆盖 Formal Registry；
- 把失败期间事件补计入新分母。

## 十六、零写入边界冻结

### 16.1 A 类：只读 Preflight

以下动作必须全域零写入：

- 生成和校验 Runtime Identity；
- 构建 Window 草案；
- 执行 R4-P01—R4-P24；
- 构建但不保存 Preflight / Launch / Binding；
- 页面预览、Internal Health 和 Debug Audit；
- 任一失败或过期分支。

写入计数必须为：

```text
Formal Resource = 0
Trial Control = 0
Student Session = 0
Student Attempt = 0
Diagnosis / Evidence = 0
Profile = 0
Calibration / Real Denominator = 0
Trial Observation = 0
```

### 16.2 B 类：显式保存准入包

只允许一次原子事务写入：

```text
Trial Window draft = 1
Preflight Report v2 = 1
Launch Record v2 = 1
Runtime Identity Binding v1 = 1
```

其余数据域全部为 0。幂等重试的新增写入全部为 0。

### 16.3 C 类：显式激活

只允许一次原子事务写入：

```text
Trial Window draft → active = 1
Activation State v2 = 1
Activation Audit v3 activated = 1
```

其余数据域全部为 0，尤其：

```text
Observation Event = 0
Real Denominator = 0
Session / Attempt / Evidence / Profile = 0
```

第一条真实 Observation 必须等待 WP-R5 中实际发生的真实 Owner Fact。

## 十七、历史兼容策略

### 17.1 旧 Preflight v1

- 原样读取和展示历史证据；
- 不能用于 WP-R4 激活；
- 不回填 Runtime Digest；
- 不更新为 eligible。

### 17.2 旧 Launch v1

- 原样保留；
- 无 Binding 时继续为 `legacy_unverifiable`；
- 即使 gitCommit / buildVersion 相同也不能复用；
- 不修改 status，不补 v2 字段。

### 17.3 旧 Window

- closed / invalidated 状态保持；
- active 但身份不可验证时由 WP-R3 失效，不能恢复；
- 新准入必须使用新 trialWindowId；
- 旧分母不合并进新 Window。

### 17.4 Activation State / Audit

- Reader 继续支持 Activation State v1 / v2 与 Audit v1 / v2；
- 只有带有效 Binding 和 Runtime Digest 的 v2 State 可以成为 WP-R4 `real_trial`；
- Audit v3 只用于新激活或新拒绝事实；
- 不迁移、不重写旧 Audit。

## 十八、工程文件与模块边界

建议新增：

```text
src/ai/schemas/productRuntimeTrialReentry.schema.ts
src/ai/services/productRuntimeTrialReentryPreflightService.ts
src/ai/services/productRuntimeTrialReentryService.ts
src/ai/tests/runProductRuntimeReliabilityWPR4Debug.ts
src/ai/tests/runProductRuntimeReliabilityWPR4BrowserMatrixDebug.ts
src/api/productRuntimeReliabilityWPR4BrowserAcceptance.ts
src/pages/ProductRuntimeReliabilityWPR4Acceptance.jsx
docs/education/phase/reports/product_runtime_reliability_wp_r4_trial_reentry_debug_browser_acceptance_2026-08-26.md
```

建议修改：

```text
src/ai/schemas/productComplexityConvergenceTrialPreflight.schema.ts
src/ai/repositories/productComplexityConvergenceObservationRepository.ts
src/ai/repositories/inMemoryProductComplexityConvergenceObservationRepository.ts
src/ai/repositories/indexedDBProductComplexityConvergenceObservationRepository.ts
src/ai/services/productComplexityConvergenceTrialPreflightService.ts
src/ai/services/productRuntimeTrialIdentityService.ts
src/ai/services/productRuntimeHealthService.ts
src/server/productRuntimeHealthBoundary.ts
src/App.jsx
src/pages/InternalAcceptanceHub.jsx
package.json
```

不得修改 Material → Plan → Task → Candidate → Publish → Learning 的领域 Schema 与主链服务。

## 十九、分阶段工程顺序

### WP-R4-A：Schema 与 Reader 兼容

- 新增 Preflight v2、Launch v2、Audit v3；
- 复用 Binding v1、Activation State v2；
- 完成稳定校验和旧版本 Reader。

### WP-R4-B：Preflight 与零写入审计

- 实现 R4-P01—R4-P24；
- 实现 30 分钟版本化有效期；
- 证明失败分支全域零写入。

### WP-R4-C：Approval Bundle 原子提交

- Repository 增加 Bundle 事务；
- 完成幂等、冲突和并发保护；
- 保证保存后 Trial 仍为 off。

### WP-R4-D：显式激活与回滚

- 实现激活前重新校验；
- 实现 Window / State / Audit 原子提交；
- 实现复读确认和 WP-R3 自动失效衔接。

### WP-R4-E：Health 与 Internal 投射

- 展示当前 Runtime、Preflight、Launch、Binding、Window 与 Activation 对齐状态；
- 普通页面只展示可用性和恢复动作；
- 不暴露绝对路径、密钥和学生内容。

### WP-R4-F：Debug、回归与真实浏览器验收

- 完成 R4-C01—R4-C48；
- 完成 R4-B01—R4-B18；
- 完成 Production Build 与旧主链回归；
- 输出验收报告；
- 只在全部通过后授权 WP-R5。

## 二十、Debug Case 矩阵 R4-C01—R4-C48

| ID | Case | 通过标准 |
| --- | --- | --- |
| R4-C01 | Preflight v2 正常结构 | 校验通过 |
| R4-C02 | Preflight 未知版本 | 阻断 |
| R4-C03 | Runtime Identity 缺失 | ineligible、零写入 |
| R4-C04 | Runtime Identity invalid | ineligible、零写入 |
| R4-C05 | Runtime Identity dirty | ineligible、零写入 |
| R4-C06 | Artifact Digest 不一致 | ineligible、零写入 |
| R4-C07 | Formal Digest 不一致 | ineligible、零写入 |
| R4-C08 | Executable Policy 不一致 | ineligible、零写入 |
| R4-C09 | Trial Policy 不一致 | ineligible、零写入 |
| R4-C10 | Provider Boundary 不一致 | ineligible、零写入 |
| R4-C11 | Provider 不可用 | ineligible，Learning 不阻断 |
| R4-C12 | Formal Store 不可读 | ineligible，不误报无任务 |
| R4-C13 | Registry 不完整 | ineligible |
| R4-C14 | Owner Schema 不受支持 | ineligible |
| R4-C15 | 自动化回归证据缺失 | ineligible |
| R4-C16 | Activation 非 off | ineligible |
| R4-C17 | Window ID 已存在 | 冲突阻断 |
| R4-C18 | 另有 active Window | 冲突阻断 |
| R4-C19 | P0 / P1 未解决 | ineligible |
| R4-C20 | Preflight 写入计数非 0 | ineligible |
| R4-C21 | 24 项全部通过 | eligible |
| R4-C22 | Preflight 过期 | 激活阻断 |
| R4-C23 | Preflight 后 Identity 变化 | 激活阻断 |
| R4-C24 | Launch v2 正常结构 | 校验通过 |
| R4-C25 | Launch 引用 v1 Preflight | 阻断 |
| R4-C26 | Launch unresolvedIssues 非空 | 阻断 |
| R4-C27 | Launch / Window 不一致 | 阻断 |
| R4-C28 | Launch / Binding 不一致 | 阻断 |
| R4-C29 | Binding 正常结构 | 校验通过 |
| R4-C30 | 一个 Launch 两个 Binding | 冲突阻断 |
| R4-C31 | Binding Digest 被篡改 | 阻断 |
| R4-C32 | 完整 Bundle 提交 | 四项一次成功，仍 off |
| R4-C33 | 相同 Bundle 重试 | duplicate，零新增写入 |
| R4-C34 | 同 ID 不同内容 | 冲突且不覆盖 |
| R4-C35 | Bundle 第一步写入失败 | 四项均不可见 |
| R4-C36 | Bundle 中间写入失败 | 四项均不可见 |
| R4-C37 | 激活条件全部满足 | 可进入事务 |
| R4-C38 | 激活缺少明确命令 | 保持 off |
| R4-C39 | 激活时 Identity 改变 | 零写入、保持 off |
| R4-C40 | 激活事务成功 | Window / State / Audit 一致 |
| R4-C41 | State 写入失败 | Window draft、无 Audit、off |
| R4-C42 | Audit 写入失败 | Window draft、State off |
| R4-C43 | 并发激活同一 Bundle | 一次成功、一次 already_activated |
| R4-C44 | 并发激活不同 Bundle | 仅一个成功 |
| R4-C45 | 激活后复读不一致 | WP-R3 失效到 off |
| R4-C46 | 历史 v1 Launch | 只读、不可激活 |
| R4-C47 | 全流程受保护数据域 | 未授权写入为 0 |
| R4-C48 | WP-R0—R3 与旧主链回归 | 全部通过 |

## 二十一、真实浏览器矩阵 R4-B01—R4-B18

| ID | 浏览器场景 | 通过标准 |
| --- | --- | --- |
| R4-B01 | Internal WP-R4 页面打开 | 显示当前 off 和阶段说明 |
| R4-B02 | Runtime Identity dirty | 不显示可激活 |
| R4-B03 | Runtime Identity clean | 可执行 Preflight，不自动写入 |
| R4-B04 | Preflight 运行中 | 单一明确状态，不重复触发 |
| R4-B05 | Preflight 失败 | 原位显示原因与恢复动作 |
| R4-B06 | Preflight eligible | 显示保存准入包，不自动激活 |
| R4-B07 | 保存准入包 | 显示四项身份摘要，Trial 仍 off |
| R4-B08 | 重复保存 | 不新增记录 |
| R4-B09 | Bundle 冲突 | 明确阻断，不隐藏在页面顶部 |
| R4-B10 | Preflight 过期 | 激活按钮失效并要求重跑 |
| R4-B11 | Identity 变化 | 激活入口立即撤销 |
| R4-B12 | 显式激活成功 | 状态显示 real_trial 与 Binding 摘要 |
| R4-B13 | 激活重复点击 | 不重复 State / Audit |
| R4-B14 | 激活失败 | 原位反馈，保持 off |
| R4-B15 | 激活后刷新 | 恢复同一 Window / Launch / Binding |
| R4-B16 | Learning 页面 | 正常可用，不显示内部 Hash |
| R4-B17 | Workbench 页面 | 正常可用，不展示 Trial 工程控件 |
| R4-B18 | Observation 计数 | 激活完成时仍为 0 |

浏览器矩阵只能在隔离验收或显式授权的真实准入环境运行，不得为了通过 Case 制造真实学生作答。

## 二十二、工程命令与回归要求

WP-R4 工程应新增：

```json
{
  "debug:product-runtime-reliability-wp-r4": "...",
  "debug:product-runtime-reliability-wp-r4-browser-matrix": "..."
}
```

最低执行集合：

```text
WP-R4 Debug R4-C01—R4-C48
WP-R4 Browser Matrix R4-B01—R4-B18
WP-R3 Debug / Browser Matrix
Stage 4 Real Trial Preflight regression
WP-R0 / WP-R1 / WP-R2 regressions
Learning core regression
Workbench core regression
Formal Resource integrity regression
Production Build
git diff --check
```

测试报告必须记录真实命令、退出码、Runtime Identity Digest、写入计数和残余风险。不得用文档中的预期数量冒充实际执行结果。

## 二十三、旧主链零回归

WP-R4 必须证明以下事实不变：

- Material → Plan → Task → Candidate → Publish → Learning 主链不变；
- Current Frozen Resource 身份和数量守恒；
- 已开始 Session 的资源快照不变；
- Answer、Diagnosis、Feedback、Revision 正式事实不变；
- Single Choice、Targeted Micro-training、Retest / Transfer 行为不变；
- Trial `off` 时 Learning 仍正常运行；
- Observation 失败继续 fail-open；
- 普通学生与录入页面不增加 Preflight、Launch、Binding 等工程步骤。

## 二十四、完成定义

WP-R4 只有同时满足以下条件才算完成：

1. Preflight v2、Launch v2、Audit v3 与旧 Reader 兼容；
2. 当前 clean Runtime Identity 可被完整复算；
3. R4-P01—R4-P24 全部由结构化证据驱动；
4. Preflight 失败和过期全域零写入；
5. 新 Window / Report / Launch / Binding 成组原子提交；
6. 保存准入包后 Trial 仍保持 off；
7. 显式激活前重新验证全部身份与时间条件；
8. Window / State / Audit 原子激活；
9. 激活失败、并发和复读失败均安全保持或回落 off；
10. 旧 Window / Launch / Binding / Observation 不修改、不复用、不合并；
11. 激活完成时真实 Observation 与真实分母仍为 0；
12. R4-C01—R4-C48 全部通过；
13. R4-B01—R4-B18 全部通过；
14. WP-R0—R3 与旧主链零回归；
15. Production Build 与 `git diff --check` 通过；
16. 验收报告披露 Runtime Digest、准入包 ID、写入计数和残余风险；
17. 仅授权 WP-R5，不宣称真实学习烟测或教育效果完成。

## 二十五、冻结声明

本文档冻结以下事实：

1. WP-R4 是新的 Trial 准入，不是旧 Trial 恢复；
2. Re-entry Preflight 必须绑定当前完整 Runtime Identity；
3. 新 Window、Preflight、Launch 和 Binding 必须成组一致；
4. Preflight 只读阶段全域零写入；
5. 保存准入包不自动激活；
6. 激活必须显式并在提交前重新校验；
7. 激活写入仅限 Window、Activation State 和 Activation Audit；
8. 任一不确定性都保持或回落 off；
9. Learning 不因 Trial 准入失败而阻断；
10. WP-R4 不创建真实 Observation，不执行 WP-R5 烟测；
11. 历史事实不回填、不覆盖、不复用；
12. 每个工程阶段必须证明旧主链零回归，新语义只在该阶段允许的边界内生效。

本文档已经达到 `ENGINEERING COMPLETE / DEBUG ACCEPTED / BROWSER ACCEPTED / REAL TRIAL REMAINS OFF / WP-R5 AUTHORIZED`。WP-R4 工程边界已经完成；真实重新准入必须在最终 clean Production Artifact 上依照《真实 Trial 准入激活执行规程》重新执行 R4-P01—R4-P24、保存新准入包并显式激活。不得把本阶段工程验收解释为 Trial 已激活或真实学习烟测已经完成。
