# 产品运行可靠性 WP-R3：Product Runtime Identity 与 Trial 自动失效工程实施及 Debug 验收文档

英文名称：Product Runtime Reliability WP-R3 Runtime Identity and Trial Automatic Invalidation Engineering and Debug Plan

对应总契约：`product_runtime_reliability_and_real_trial_reentry_v1`

阶段版本：`product_runtime_reliability_wp_r3_v1`

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / BROWSER ACCEPTED / WP-R4 AUTHORIZED`

日期：2026-08-26

工程基线：`b7cb67b`（WP-R0—R2 完成）+ `629de2f`（运行边界补齐）

关联文档：

- [产品运行可靠性与真实 Trial 重新准入契约](./PRODUCT_RUNTIME_RELIABILITY_AND_REAL_TRIAL_REENTRY_CONTRACT.md)
- [WP-R0 运行基线、Reason Code 与只读审计工程实施及 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R0_BASELINE_ENGINEERING_AND_DEBUG_PLAN.md)
- [WP-R1 统一启动器与 Runtime Health 工程实施及 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R1_LAUNCHER_AND_HEALTH_ENGINEERING_AND_DEBUG_PLAN.md)
- [WP-R2 Learning / Workbench 故障分类与恢复投射工程实施及 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R2_FAILURE_CLASSIFICATION_AND_RECOVERY_PROJECTION_ENGINEERING_AND_DEBUG_PLAN.md)
- [真实 Trial Window 启动与运行验收契约](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_REAL_TRIAL_WINDOW_OPERATION_AND_ACCEPTANCE_CONTRACT.md)
- [真实 Trial 启动前工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_REAL_TRIAL_PREFLIGHT_ENGINEERING_AND_DEBUG_PLAN.md)

## 一、文档目的

WP-R3 将“当前运行的究竟是哪一份产品”从固定版本字符串升级为可复算、可比较、内容寻址的 Product Runtime Identity，并在当前运行身份无法证明与 Trial 激活身份一致时，使 Trial 自动、安全、幂等地回落 `off`。

WP-R3 只回答四个问题：

1. 当前源码、构建、正式资源和可执行策略共同形成什么运行身份；
2. 该身份是否可被确定性复算；
3. 当前非 `off` Trial 是否仍绑定同一运行身份；
4. 身份缺失、不可验证或不一致时，如何停止真实 Observation 而不阻断 Learning。

WP-R3 不重新激活 Trial，不创建新 Trial Window，不批准新的 Launch Record，不执行真实学习烟测，也不改变 Material → Plan → Task → Candidate → Publish → Learning 主链。

## 二、阶段输入、输出与完成语义

### 2.1 输入

- WP-R1 已提供统一启动器和只读 Runtime Health；
- WP-R2 已提供 Learning / Workbench 故障分类和恢复投射；
- 当前 Trial Launch Record 仅含 `gitCommit` 与固定 `buildVersion`；
- 当前 Activation State 仅含 `buildVersion`、Registry / Policy Hash 与 requested / effective Mode；
- 当前旧 Trial 身份不能证明与当前产品内容一致。

### 2.2 输出

WP-R3 必须交付：

- `ProductRuntimeIdentity` Schema；
- 可审计的内容哈希输入清单；
- 确定性身份生成器和校验器；
- 当前身份与 Trial 身份绑定的比较结果；
- Trial 自动失效决策和幂等持久化；
- 历史 Launch / Activation 的只读兼容；
- Health / Internal 的只读身份投影；
- 单元 Debug、零写入验收、浏览器矩阵与回归证据。

### 2.3 完成状态

只有全部验收通过后，文档状态才可更新为：

```text
WP-R3 ENGINEERING COMPLETE
DEBUG ACCEPTED
IDENTITY REPRODUCIBLE
TRIAL INVALIDATION ACCEPTED
WP-R4 AUTHORIZED
```

WP-R3 完成不表示真实 Trial 已重新准入。任何从 `off` 进入 `real_trial` 的动作仍属于 WP-R4。

## 三、范围与非目标

### 3.1 本阶段范围

- 冻结 Product Runtime Identity 的稳定 Schema；
- 冻结 SHA-256 内容寻址和规范化策略；
- 生成当前身份文件并由 Runtime 只读加载；
- 判断身份 `aligned / mismatch / missing / invalid / legacy_unverifiable`；
- 非 `off` Trial 在身份不满足时自动失效；
- 保留旧 Window、Launch、Observation 和 Audit；
- 确保 Learning 在 Trial 失效时继续运行；
- 确保身份审计本身零业务写入。

### 3.2 非目标

WP-R3 禁止：

- 通过 Query、页面按钮或环境变量重新开启 `real_trial`；
- 为旧 Launch Record 回填当前 Hash；
- 把旧 Observation 重新标记为当前运行身份；
- 修改正式资源正文、题目、Candidate、Revision 或 Frozen Resource；
- 创建真实 Attempt、Evidence、Profile 或 Calibration 分母；
- 修改 AI Provider 业务行为、Prompt 或 Training Model；
- 将 Git commit、固定 `buildVersion` 或构建时间单独当作 Runtime Identity；
- 将无法读取身份误判为身份一致。

## 四、核心原则

1. **内容决定身份**：相同规范化内容必须得到相同 Identity；实质内容变化必须得到不同 Identity。
2. **证据不参与身份**：时间、机器、绝对路径、端口和 Git 展示信息只用于审计，不能制造身份变化。
3. **密钥永不入 Hash**：API Key、Token、学生答案和个人信息不得进入 Manifest 或日志。
4. **保守失效**：不能证明一致等同于不允许真实 Observation，不等同于产品不可学习。
5. **单向安全**：WP-R3 可以使 Trial 回落 `off`，不能使其重新激活。
6. **历史不可伪造**：旧记录可读、可解释，但不得用当前身份反向补造过去身份。
7. **计算先只读，提交最小写入**：身份生成、比较和浏览器验收零业务写入；自动失效只允许 Trial Owner 的最小状态写入。
8. **幂等**：同一失效事实重复执行不得产生重复状态迁移或重复 Audit。
9. **旧主链零回归**：新身份语义只在 Runtime / Trial 边界生效。

## 五、Owner 与事实边界

| 事实 | Owner | WP-R3 权限 |
| --- | --- | --- |
| 当前源码与构建内容 | Runtime Identity Builder | 读取、规范化、计算 Hash |
| Current Frozen Resource 身份 | Formal Resource Owner | 只读投影 |
| Registry / 可执行策略 | 对应 Registry / Policy Owner | 只读投影 |
| Product Runtime Identity | Runtime Identity Owner | 生成不可变 Envelope |
| Trial requested / effective Mode | Trial Activation Owner | 仅允许自动失效写入 |
| Trial Launch Record | Trial Launch Owner | 只读，不修改旧记录 |
| Trial Observation | Observation Owner | 身份不一致时停止接收，不改旧事件 |
| Learning Session / Attempt / Evidence | Learning Owner | 不写入、不阻断 |

Runtime Identity 不成为 Formal Resource、Learning 或 Trial 的第二事实来源。它只引用各 Owner 的稳定身份摘要。

## 六、Runtime Identity Schema 冻结

### 6.1 版本常量

```ts
export const PRODUCT_RUNTIME_IDENTITY_VERSION =
  'product_runtime_identity_v1' as const;

export const PRODUCT_RUNTIME_IDENTITY_CANONICALIZATION_VERSION =
  'product_runtime_identity_c14n_v1' as const;

export const PRODUCT_RUNTIME_IDENTITY_HASH_ALGORITHM = 'sha256' as const;
```

### 6.2 内容输入

```ts
type ProductRuntimeIdentityInputs = {
  applicationContentDigest: `sha256:${string}`;
  dependencyLockDigest: `sha256:${string}`;
  buildConfigurationDigest: `sha256:${string}`;
  buildArtifactManifestDigest: `sha256:${string}`;
  formalResourceSnapshotDigest: `sha256:${string}`;
  executablePolicyBundleDigest: `sha256:${string}`;
  trialPolicyBundleDigest: `sha256:${string}`;
  providerBoundaryDigest: `sha256:${string}`;
};
```

### 6.3 审计证据

```ts
type ProductRuntimeIdentityEvidence = {
  gitCommit?: string;
  worktreeState: 'clean' | 'dirty' | 'unknown';
  sourceFileCount: number;
  artifactFileCount: number;
  formalStoreRevision?: number;
  formalMaterialCount?: number;
  formalQuestionCount?: number;
  generatedAt: string;
};
```

### 6.4 完整 Envelope

```ts
type ProductRuntimeIdentity = {
  runtimeIdentityVersion: typeof PRODUCT_RUNTIME_IDENTITY_VERSION;
  productId: 'chinese_ability_growth_system_local_runtime';
  canonicalizationVersion:
    typeof PRODUCT_RUNTIME_IDENTITY_CANONICALIZATION_VERSION;
  hashAlgorithm: typeof PRODUCT_RUNTIME_IDENTITY_HASH_ALGORITHM;
  identityInputs: ProductRuntimeIdentityInputs;
  runtimeIdentityDigest: `sha256:${string}`;
  evidence: ProductRuntimeIdentityEvidence;
};
```

### 6.5 Digest 计算边界

`runtimeIdentityDigest` 只能按以下对象计算：

```ts
stableSerialize({
  runtimeIdentityVersion,
  productId,
  canonicalizationVersion,
  hashAlgorithm,
  identityInputs,
})
```

以下字段明确不参与最终 Digest：

- `generatedAt`；
- `gitCommit`；
- `worktreeState`；
- 文件数量和正式资源数量；
- Store Revision；
- 机器名、用户目录、绝对路径；
- Host、端口、PID；
- API Key、Token；
- Trial 当前 Mode；
- Session、Round、Attempt、Evidence；
- 日志和报告。

`gitCommit` 是可追溯证据，不是内容身份。相同内容位于不同 commit 时允许形成相同 Runtime Identity；相同 commit 下未提交内容不同必须形成不同内容 Digest，并因 `worktreeState = dirty` 不具备真实 Trial 准入资格。

## 七、内容哈希输入冻结

### 7.1 通用规范化

所有输入遵循 `product_runtime_identity_c14n_v1`：

- 编码统一为 UTF-8；
- 文本换行统一为 LF；
- Unicode 文本统一为 NFC；
- 相对路径统一为 POSIX `/`，不得写入绝对路径；
- 文件路径按 Unicode code point 升序；
- JSON 对象键递归升序，数组保持业务顺序；
- Hash 使用 SHA-256，小写十六进制，格式为 `sha256:<64 hex>`；
- 文件 Manifest 的每项为 `relativePath + NUL + fileDigest`；
- 空目录、文件权限、mtime、ctime、inode 不参与 Hash；
- 二进制文件按原始字节 Hash，不进行文本规范化。

### 7.2 Application Content

`applicationContentDigest` 必须覆盖：

- `src/**` 中进入 Product Runtime 的源码；
- `scripts/start-product-runtime.mjs`；
- Vite / TypeScript / 构建入口配置；
- `package.json` 中运行和构建相关字段。

必须排除：

- `src/**/tests/**` 和只读验收 Fixture；
- `docs/**`；
- `.git/**`；
- `node_modules/**`；
- `dist/**`；
- 临时文件、日志、截图和测试报告。

若某个测试或 Internal Acceptance 模块被正式入口导入并进入 Production Bundle，则它不再属于排除项，必须由 Artifact Manifest 捕获。

### 7.3 Dependency Lock

`dependencyLockDigest` 必须覆盖当前包管理器的唯一权威 Lockfile。不得把本地缓存、安装路径或 `node_modules` 内容纳入 Hash。

### 7.4 Build Configuration

`buildConfigurationDigest` 覆盖影响产物语义的配置和值：

- Production mode；
- Base path；
- Feature / contract version 常量；
- 安全的 Provider model / endpoint contract identifier；
- 影响 Tree Shaking、转译和资源装载的配置。

不包含 API Key、机器路径、端口、时间和 PID。

### 7.5 Build Artifact Manifest

`buildArtifactManifestDigest` 从 Production Build 产物生成：

- 覆盖运行时会加载的 HTML、JS、CSS 和静态数据；
- 路径和文件 Digest 排序后形成 Manifest；
- 排除 Source Map（未发布时）、临时分析报告和 Runtime Identity Envelope 自身；
- 禁止把 Identity Envelope 嵌入其自身 Hash 输入，避免循环 Hash。

建议身份文件固定写入：

```text
dist/.runtime/product-runtime-identity.json
```

该文件由启动器只读加载，但从 Artifact Manifest Digest 中排除。

### 7.6 Formal Resource Snapshot

`formalResourceSnapshotDigest` 只覆盖运行时实际可消费的 Current Frozen Resource 投影，至少包含：

- Material / Material Version 稳定身份；
- Resource / Resource Version 稳定身份；
- Question / Question Revision 稳定身份；
- Question Content Hash；
- `responseFormat`；
- Frozen / Published 状态；
- Learning 可消费顺序和必要运行 Schema Version。

Canonical Entry 必须按稳定身份排序。以下内容不进入输入：

- 未采用 Candidate；
- 已被 successor 替代且不再正式消费的旧头部；
- Workbench UI 展开状态；
- 发布提示、编辑草稿和临时错误；
- Store Revision 本身；
- 学生答案和学习记录。

Store Revision 和数量仅写入 `evidence`。无内容变化的 Revision 增长不得改变 Runtime Identity。

### 7.7 Executable Policy Bundle

`executablePolicyBundleDigest` 只覆盖运行时真正执行的 Schema、Planner、Admission、Ordering、Learning、Diagnosis、Revision、Targeted Micro-training、Retest / Transfer 策略版本及其实现摘要。

产品说明文档、阶段报告和 Markdown 文案不直接进入 Hash。若文档规则改变但可执行策略未升级，工程不得声称 Runtime Identity 已反映该规则；应先升级对应代码版本常量或实现。

### 7.8 Trial Policy Bundle

`trialPolicyBundleDigest` 至少覆盖：

- Observation Policy Version；
- Decision Policy Version；
- Source Registry Version；
- Source Policy Snapshot Hash；
- Owner Adapter Version；
- Admission / denominator policy version。

### 7.9 Provider Boundary

`providerBoundaryDigest` 覆盖安全、非敏感的运行边界：

- Provider ID；
- Model identifier；
- Adapter / protocol version；
- Prompt policy version；
- 结构化输出 Schema version。

API Key、Authorization Header、请求内容、学生回答和模型原始响应禁止进入。

## 八、身份有效性与比较结果

### 8.1 结构化状态

```ts
type ProductRuntimeIdentityStatus =
  | 'available'
  | 'missing'
  | 'invalid'
  | 'dirty';

type TrialRuntimeIdentityAlignment =
  | 'aligned'
  | 'mismatch'
  | 'missing'
  | 'invalid'
  | 'dirty'
  | 'legacy_unverifiable';
```

### 8.2 校验规则

Identity 只有同时满足以下条件才为 `available`：

- Schema、版本、Hash 格式完整；
- 八个输入 Digest 全部存在；
- 重新计算的 `runtimeIdentityDigest` 与 Envelope 一致；
- Artifact Manifest 可以从当前 Production Build 复算；
- 当前运行读取的正式资源摘要与身份一致；
- `worktreeState = clean`。

本地 Learning 可以在 `dirty / missing / invalid` 下继续运行；真实 Trial 不可以。

### 8.3 比较规则

- 当前身份与 Launch Identity Binding 完全相同 → `aligned`；
- 两边均有效但 Digest 不同 → `mismatch`；
- 当前身份文件不存在 → `missing`；
- 当前身份结构或复算失败 → `invalid`；
- 当前 Worktree 为 dirty → `dirty`；
- 历史 Launch 没有 `runtimeIdentityDigest` → `legacy_unverifiable`。

固定 `buildVersion` 相同不能把任何非 `aligned` 状态提升为 `aligned`。

## 九、Trial Identity Binding 冻结

WP-R3 冻结以下新绑定 Schema，实际创建新绑定属于 WP-R4：

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

约束：

- Binding 创建后不可变；
- 一个 Launch Record 最多绑定一个 Runtime Identity；
- 不能为历史 Launch Record 事后补建 Binding；
- WP-R3 只读取 Binding；
- WP-R4 必须在新 Preflight 通过后与新 Launch Record 同时创建 Binding；
- Binding 不替代 Launch Record、Window、Registry 或 Policy Owner。

## 十、Trial 自动失效规则冻结

### 10.1 触发条件

当 `effectiveMode !== 'off'` 且出现任一条件时，必须自动失效：

- 当前 Runtime Identity `missing`；
- Identity Schema 或复算结果 `invalid`；
- Worktree 为 `dirty`；
- Launch 没有 Identity Binding，属于 `legacy_unverifiable`；
- 当前与绑定 Digest `mismatch`；
- 比较过程异常，无法证明 `aligned`；
- 当前 Frozen Resource、Executable Policy、Trial Policy 或 Provider Boundary 与身份不一致。

### 10.2 状态迁移

自动失效只允许：

```text
real_trial / isolated_acceptance
  → requestedMode 保留原值
  → effectiveMode = off
  → deactivatedAt = now
  → invalidatedRuntimeIdentityDigest = current digest（若可得）
  → reasonCodes = 稳定失效原因
```

保留 `requestedMode` 用于说明原操作意图和“需要重新准入”，但它不能自动恢复 `effectiveMode`。

### 10.3 稳定 Reason Code

```text
runtime_identity_missing
runtime_identity_invalid
runtime_identity_dirty
runtime_identity_mismatch
legacy_launch_identity_unverifiable
runtime_identity_compare_failed
trial_runtime_identity_binding_missing
trial_runtime_identity_invalidated
```

普通 Learning 不展示以上内部术语。Internal Health 可以显示结构化 Code 与摘要。

### 10.4 幂等与并发

- 已为同一 `launchRecordId + previousEffectiveMode + reason + currentDigest` 失效时，重复执行不得重复写 Audit；
- 使用当前 Activation State 的版本或 CAS 语义提交；
- 并发重新读取发现已 `off` 时直接返回成功；
- 不覆盖更新后形成的新 Launch / Binding；
- 写入失败时，当前进程内投影仍强制 `effectiveMode = off`，Observation fail-open 停止采集并报告内部故障；
- 不允许因为失效写入失败而继续进入真实分母。

### 10.5 不触发身份变化的事实

以下变化不触发自动失效：

- 端口、PID、机器名和启动时间；
- Health 检查时间；
- AI 临时可达 / 不可达；
- Session、Round、Attempt、Evidence 或 Profile 增长；
- Observation 采集成功或失败；
- 报告、截图和不参与运行的文档更新；
- 无内容变化的 Store Revision 增长。

## 十一、Activation State 兼容升级

WP-R3 工程应新增 v2，而不是静默修改 v1：

```ts
type ConvergenceObservationActivationStateV2 = {
  activationStateVersion:
    'product_complexity_convergence_stage4_activation_state_v2';
  activationStateId: 'product-complexity-convergence-stage4-current';
  requestedMode: 'off' | 'isolated_acceptance' | 'real_trial';
  effectiveMode: 'off' | 'isolated_acceptance' | 'real_trial';
  trialWindowId?: string;
  launchRecordId?: string;
  runtimeIdentityBindingId?: string;
  activatedRuntimeIdentityDigest?: `sha256:${string}`;
  invalidatedRuntimeIdentityDigest?: `sha256:${string}`;
  registrySnapshotHash?: string;
  policySnapshotHash?: string;
  buildVersion?: string;
  activatedAt?: string;
  deactivatedAt?: string;
  invalidatedAt?: string;
  reasonCodes: string[];
  updatedAt: string;
};
```

Activation Audit v2 增加 `invalidated` action，并可记录两个 Runtime Digest，但不得记录输入文件列表、正文或敏感配置。

## 十二、历史兼容冻结

### 12.1 Launch Record v1

- 原样读取、原样保留；
- `gitCommit + buildVersion` 只作历史证据；
- 缺少 Runtime Identity Binding 时判为 `legacy_unverifiable`；
- 若其 Activation 已 `off`，保持 `off` 且不产生新 Audit；
- 若其 Activation 非 `off`，执行一次自动失效；
- 禁止用当前 Runtime Identity 回填旧 Launch。

### 12.2 Activation State v1

- Reader 必须兼容 v1；
- v1 的 `off` 状态可只读投射为 v2 语义，不要求立即写迁移；
- v1 的非 `off` 状态必须安全失效后才可保存为 v2；
- 不得仅因 `buildVersion` 相等继续真实 Trial；
- 未知版本、损坏状态和缺少字段统一 fail-safe 为 effective `off`。

### 12.3 历史 Observation

- 不删除、不重写、不补 Runtime Identity；
- 保持原 Window / Launch / Build 归属；
- 不进入重新准入后新 Window 的真实分母；
- 查询层可标记 `legacy_runtime_identity_unverifiable`；
- 禁止把旧事件重新计为新构建产生。

### 12.4 Health 兼容

- 现有 `buildIdentity` 字段保留一个兼容周期，但值改为 Runtime Identity Digest；
- `buildIdentityContentAddressed` 由有效 Schema 和复算结果派生，不再信任环境变量声明；
- 新增 `runtimeIdentityVersion`、`runtimeIdentityStatus`、`trial.identityAlignment`；
- 普通 Learning 只消费可用性，不暴露内部 Hash；
- Internal Health 只显示缩短摘要，不显示输入文件列表和绝对路径。

## 十三、零写入边界冻结

### 13.1 只读阶段

以下动作必须全部零写入：

- 计算和校验 Runtime Identity；
- 读取 Identity Envelope；
- 复算 Artifact / Formal / Policy Digest；
- 比较 Current Identity 与 Launch Binding；
- GET `/__runtime/health`；
- Internal 页面展示；
- Debug Audit 与浏览器验收。

零写入域：

```text
Formal Resource = 0
Student Session = 0
Student Attempt = 0
Diagnosis / Evidence = 0
Profile = 0
Calibration / Real Denominator = 0
Trial Window / Launch / Binding = 0
Trial Observation = 0
```

生成 Production Build 和 `dist/.runtime/product-runtime-identity.json` 属于构建产物写入，不属于产品数据写入；只允许在显式 build / identity generation 命令中发生。

### 13.2 自动失效提交阶段

自动失效是 WP-R3 唯一允许的运行数据写入：

- 更新一条当前 Activation State；
- 追加至多一条 `invalidated` Activation Audit；
- 不修改 Window、Launch、Binding 或 Observation；
- 不触发 Formal、Session、Attempt、Evidence、Profile、Calibration 写入；
- 同一失效事实重试时新增写入为 0。

因此“零写入”验收分为两套：

1. `audit / compare` 模式：所有产品数据域均为 0；
2. `apply invalidation` 模式：仅 Activation State = 1、Activation Audit ≤ 1，其余域均为 0。

不得以自动失效为名清理、关闭或重建任何其他业务事实。

## 十四、工程模块与文件边界

建议新增：

```text
src/ai/schemas/productRuntimeIdentity.schema.ts
src/ai/services/productRuntimeIdentityService.ts
src/ai/services/productRuntimeTrialIdentityService.ts
src/server/productRuntimeIdentityBoundary.ts
src/api/productRuntimeReliabilityWPR3BrowserAcceptance.ts
src/pages/ProductRuntimeReliabilityWPR3Acceptance.jsx
src/ai/tests/runProductRuntimeReliabilityWPR3Debug.ts
src/ai/tests/runProductRuntimeReliabilityWPR3BrowserMatrixDebug.ts
scripts/generate-product-runtime-identity.mjs
```

允许窄范围修改：

```text
src/ai/schemas/productRuntimeHealth.schema.ts
src/ai/services/productRuntimeHealthService.ts
src/server/productRuntimeHealthBoundary.ts
src/ai/schemas/productComplexityConvergenceTrialPreflight.schema.ts
src/ai/services/productComplexityConvergenceTrialPreflightService.ts
src/ai/repositories/productComplexityConvergenceObservationRepository.ts
src/App.jsx
package.json
```

禁止为 WP-R3 大范围修改 Learning、Workbench、正式资源生产或教育判断模块。

## 十五、分阶段实施顺序

### WP-R3-A：Schema 与规范化器

- 实现 Identity / Binding / Activation v2 Schema；
- 实现 stable serialize、SHA-256 和 Manifest；
- 验证循环 Hash、密钥、绝对路径和非确定字段被排除。

### WP-R3-B：内容输入适配

- 构建 Application、Lock、Build Config、Artifact Manifest Digest；
- 从 Formal Owner 生成 Current Frozen Resource Digest；
- 从 Executable Policy、Trial Policy、Provider Boundary 生成 Digest；
- 输出不可变 Identity Envelope。

### WP-R3-C：比较与自动失效

- 加载当前 Identity 和 Binding；
- 处理 aligned / mismatch / legacy / missing / invalid / dirty；
- 实现只读决策和显式最小失效提交；
- Observation 入口在任何非 aligned 状态下 fail-open 停止采集。

### WP-R3-D：Health 与 Internal 投影

- Health 从真实 Identity 加载结果派生；
- Internal 显示版本、短 Hash、alignment 和 Reason Code；
- Learning / Workbench 不显示内部身份术语；
- 不提供激活入口。

### WP-R3-E：Debug、回归与浏览器验收

- 执行 R3-C、R3-B 全矩阵；
- 执行 WP-R0—R2 回归；
- 验证 Production Build 和身份复算；
- 记录零写入与自动失效最小写入证据；
- 只有全部通过才授权 WP-R4。

## 十六、Debug Case 矩阵 R3-C01—R3-C40

| ID | 场景 | 预期 |
| --- | --- | --- |
| R3-C01 | 同一输入重复生成 | Runtime Digest 完全一致 |
| R3-C02 | 文件读取顺序变化 | Digest 不变 |
| R3-C03 | CRLF / LF 差异 | Digest 不变 |
| R3-C04 | Unicode 等价形式 | NFC 后 Digest 不变 |
| R3-C05 | mtime / 权限变化 | Digest 不变 |
| R3-C06 | Git commit 不同、内容相同 | Digest 不变，证据不同 |
| R3-C07 | 源码实质变化 | Application 与 Runtime Digest 变化 |
| R3-C08 | Lockfile 变化 | Dependency 与 Runtime Digest 变化 |
| R3-C09 | Build Config 变化 | Config 与 Runtime Digest 变化 |
| R3-C10 | Production Artifact 变化 | Artifact 与 Runtime Digest 变化 |
| R3-C11 | Candidate 草稿变化 | Formal / Runtime Digest 不变 |
| R3-C12 | Current Frozen Question 变化 | Formal / Runtime Digest 变化 |
| R3-C13 | 仅 Store Revision 增长 | Runtime Digest 不变 |
| R3-C14 | Executable Policy 变化 | Policy / Runtime Digest 变化 |
| R3-C15 | 仅 Markdown 文档变化 | Runtime Digest 不变 |
| R3-C16 | Trial Policy 变化 | Trial Policy / Runtime Digest 变化 |
| R3-C17 | Provider Model / Adapter 变化 | Provider / Runtime Digest 变化 |
| R3-C18 | API Key 变化 | Runtime Digest 不变且不泄漏 |
| R3-C19 | Identity Envelope 自身变化 | Artifact Digest 不循环 |
| R3-C20 | Envelope 缺字段 | `invalid` |
| R3-C21 | Envelope Digest 篡改 | `invalid` |
| R3-C22 | Identity 文件缺失 | `missing` |
| R3-C23 | Dirty Worktree | `dirty`，Learning 可用，Trial 不可用 |
| R3-C24 | 当前与 Binding 相同 | `aligned` |
| R3-C25 | 当前与 Binding 不同 | `mismatch` |
| R3-C26 | Launch v1 无 Binding | `legacy_unverifiable` |
| R3-C27 | requested off + mismatch | 保持 off，零 Trial 写入 |
| R3-C28 | real_trial + mismatch | effective off，requested 保留 |
| R3-C29 | isolated + invalid | effective off，requested 保留 |
| R3-C30 | 比较异常 | fail-safe off，Learning 继续 |
| R3-C31 | 自动失效首次提交 | State 1、Audit 1 |
| R3-C32 | 同一事实重复失效 | 新增 State / Audit 均为 0 |
| R3-C33 | 并发时已被关闭 | 不覆盖，不重复 Audit |
| R3-C34 | 并发时出现新 Launch | 不覆盖新状态 |
| R3-C35 | 失效持久化失败 | Observation 0，Learning 继续，内部告警 |
| R3-C36 | 历史 Observation | 内容、数量和归属不变 |
| R3-C37 | Formal / Attempt / Evidence / Profile | 未授权写入均为 0 |
| R3-C38 | Health 重复 GET | 全域写入为 0 |
| R3-C39 | 身份再次变回旧 Digest | 不自动重新激活 |
| R3-C40 | Activation 未知版本 | effective off，Learning 继续 |

全部 Case 必须通过，不接受“多数通过”。

## 十七、真实浏览器矩阵 R3-B01—R3-B16

| ID | 操作 | 验收 |
| --- | --- | --- |
| R3-B01 | 启动当前 Production Runtime | Health 返回真实 Identity 状态 |
| R3-B02 | 重复刷新 Health | Digest 稳定、零写入 |
| R3-B03 | 打开 Internal | 显示版本与短 Hash，不泄漏路径 |
| R3-B04 | 打开 Learning | 身份未准入不阻断入口 |
| R3-B05 | 打开 Workbench | 不出现 Trial 内部术语 |
| R3-B06 | 当前身份缺失 | Internal 显示 missing，Learning 可用 |
| R3-B07 | 当前身份损坏 | Internal 显示 invalid，Learning 可用 |
| R3-B08 | Dirty Worktree | Trial off，普通产品仍可用 |
| R3-B09 | 旧 Launch v1 | 自动判 legacy，不冒充 aligned |
| R3-B10 | 模拟 Digest mismatch | effective off |
| R3-B11 | 失效后刷新 | 状态稳定，不重复 Audit |
| R3-B12 | 失效后继续 Learning | 学习流程不被 Trial 错误拦截 |
| R3-B13 | 失效期间完成学习操作 | 不进入真实 Observation 分母 |
| R3-B14 | 回到 Internal | 可解释显示重新准入要求 |
| R3-B15 | Query / 页面动作尝试开启 Trial | 无效，仍为 off |
| R3-B16 | 恢复原内容重新启动 | 不自动激活，明确进入 WP-R4 |

浏览器验收页必须标记“隔离验收，不写正式数据”，不得调用激活、保存正式资源或学习提交接口。

## 十八、回归与命令

建议新增：

```json
{
  "debug:product-runtime-reliability-wp-r3":
    "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runProductRuntimeReliabilityWPR3Debug.ts",
  "debug:product-runtime-reliability-wp-r3-browser-matrix":
    "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runProductRuntimeReliabilityWPR3BrowserMatrixDebug.ts",
  "build:product-runtime-identity":
    "node scripts/generate-product-runtime-identity.mjs"
}
```

最低验收命令：

```bash
npm run debug:product-runtime-reliability-wp-r3
npm run debug:product-runtime-reliability-wp-r3-browser-matrix
npm run debug:product-runtime-reliability-wp-r0
npm run debug:product-runtime-reliability-wp-r1
npm run debug:product-runtime-reliability-wp-r1-launcher
npm run debug:product-runtime-reliability-wp-r2
npm run debug:product-runtime-reliability-wp-r2-browser-matrix
npm run build
npm run build:product-runtime-identity
```

还必须回归现有正式资源、Learning 主链、并发提交、Revision、Targeted Micro-training、Retest / Transfer、Trial Preflight 和 Observation 的当前测试集合。若测试脚本名称变化，以 `package.json` 中现行命令为准，并在执行报告记录真实命令。

## 十九、故障诊断与恢复

| 故障 | 内部结果 | Learning | Trial | 恢复 |
| --- | --- | --- | --- | --- |
| Identity 文件缺失 | missing | 继续 | off | 重新 Production Build + 生成身份 |
| Envelope 损坏 | invalid | 继续 | off | 删除无效产物后重新构建，不改业务数据 |
| Formal Digest 不一致 | mismatch | 继续读取 Owner 事实 | off | 确认正式 Store 与身份构建来源 |
| Policy Digest 不一致 | mismatch | 继续 | off | 重新构建并进入 WP-R4 |
| Dirty Worktree | dirty | 本地继续 | off | 提交或清理边界后重新构建 |
| 历史 Launch 无 Binding | legacy | 继续 | off | 保留历史，WP-R4 新建 Launch |
| 自动失效写入失败 | internal failure | 继续 | 进程内 off，Observation 0 | 修复 Repository 后幂等重试 |

普通页面只说明当前功能是否可用和可执行动作；不要求学生或录入用户理解 Hash、Binding、Registry 或 Launch Record。

## 二十、回滚策略

WP-R3 必须可独立回滚，但回滚不得恢复旧 Trial：

- 可移除 Identity 生成器、Health 新字段和 Internal 验收页；
- 可回退 Activation v2 Reader / Writer，但必须把 Trial 保持 `off`；
- 已写入的 `invalidated` Audit 保留；
- 不删除 Identity Envelope 对应的历史构建证据；
- 不修改 Window、Launch、Observation 或正式资源；
- 回滚后必须再次证明 Learning 可用和真实 Observation 为 0。

## 二十一、完成定义

WP-R3 只有同时满足以下条件才可完成：

1. Runtime Identity Schema、Canonicalization 和 Hash 输入全部实现；
2. 同内容复算稳定，实质变化必然改变身份；
3. 密钥、路径、时间和学生内容不进入 Hash；
4. Current Frozen Resource 与可执行策略被真实纳入身份；
5. 固定 Build Version 不再承担身份判断；
6. 历史 Launch / Activation / Observation 完整保留；
7. 旧非 off Trial 自动、幂等回落 off；
8. 身份不一致时真实 Observation 为 0；
9. Learning / Workbench 保持可用；
10. 只读阶段全域零写入；
11. 失效阶段只有允许的 Trial 最小写入；
12. R3-C01—R3-C40 全部通过；
13. R3-B01—R3-B16 全部通过；
14. WP-R0—R2 和旧主链零回归；
15. Production Build 通过；
16. 执行报告记录真实 Commit、Runtime Digest、测试结果和遗留问题；
17. 不存在 Trial 自动重新激活路径；
18. 只授权 WP-R4，不提前授权真实 Trial。

## 二十二、冻结声明

`product_runtime_reliability_wp_r3_v1` 冻结以下事实：

1. Product Runtime Identity 是内容寻址身份，不是固定标签；
2. Git commit、buildVersion 和时间只作证据，不单独决定身份；
3. Identity 必须覆盖应用、依赖、构建、产物、正式资源、可执行策略、Trial 策略和 Provider 边界；
4. Hash 输入规范化使用 SHA-256 与 `product_runtime_identity_c14n_v1`；
5. Identity Envelope 自身不进入 Artifact Digest；
6. Store Revision、文档、日志、端口和学生事实不进入身份；
7. API Key 与学生内容禁止进入 Hash、Health 和 Internal 页面；
8. 无法证明 aligned 时真实 Trial 必须回落 off；
9. requestedMode 可以保留原意图，但 effectiveMode 必须 off；
10. 自动失效是单向、幂等、最小写入操作；
11. 身份失效不阻断 Learning；
12. 旧 Launch 无 Binding 时属于 legacy_unverifiable；
13. 禁止为旧 Launch 回填当前身份；
14. 历史 Observation 不删除、不重写、不进入新分母；
15. 审计和比较全域零写入；
16. 失效提交仅允许 Activation State 与单条 Audit 写入；
17. WP-R3 不创建 Window、Launch 或 Binding；
18. WP-R3 不重新激活 Trial；
19. WP-R3 不修改 Training Model 或正式资源主链；
20. 每个阶段必须证明旧主链零回归，新语义只在本阶段边界内生效。

本文档现已达到 `ENGINEERING COMPLETE / DEBUG ACCEPTED / BROWSER ACCEPTED / WP-R4 AUTHORIZED`。WP-R3-A → WP-R3-E 已按序完成，R3-C01—R3-C40 与 R3-B01—R3-B16 全部通过，Production Build 通过，旧主链回归通过。当前生成身份为 dirty，因此真实 Trial 继续保持 off；本状态只授权进入 WP-R4 重新准入，不恢复旧 Trial，也不把现有 Launch Record 解释为当前 Runtime 已获真实 Trial 准入。
