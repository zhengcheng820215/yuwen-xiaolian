# 产品运行可靠性 WP-R1：统一启动器与 Runtime Health 工程实施及 Debug 验收文档

英文名称：Product Runtime Reliability WP-R1 Launcher and Runtime Health Engineering and Debug Plan

对应主契约：`product_runtime_reliability_and_real_trial_reentry_v1`

阶段版本：`product_runtime_reliability_wp_r1_v1`

状态：`WP-R1 ENGINEERING COMPLETE / DEBUG ACCEPTED / RUNTIME LAUNCH ACCEPTED / HEALTH READ-ONLY VERIFIED / WP-R2 AND WP-R3 AUTHORIZED`

日期：2026-08-25

关联文档：

- [产品运行可靠性与真实 Trial 重新准入契约](./PRODUCT_RUNTIME_RELIABILITY_AND_REAL_TRIAL_REENTRY_CONTRACT.md)
- [WP-R0 运行基线、Reason Code 与只读审计文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R0_BASELINE_ENGINEERING_AND_DEBUG_PLAN.md)
- [WP-R0 基线、Debug 与浏览器只读验收记录](../education/phase/reports/product_runtime_reliability_wp_r0_baseline_debug_browser_acceptance_2026-08-25.md)
- [WP-R1 启动器、Health、Debug 与浏览器验收记录](../education/phase/reports/product_runtime_reliability_wp_r1_launcher_health_debug_browser_acceptance_2026-08-25.md)
- [真实 Trial Window 启动与运行验收契约](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_REAL_TRIAL_WINDOW_OPERATION_AND_ACCEPTANCE_CONTRACT.md)

## 一、阶段定位

WP-R1 解决一个明确问题：

> 用户如何通过一个项目内统一命令可靠启动本地产品，并通过一个只读接口判断当前 Runtime、正式资源、AI 配置、Learning 能力和 Trial 旁路的真实状态。

WP-R1 输入：

```text
WP-R0 Runtime Baseline
+ product_runtime_reason_registry_v1
+ 当前 Vite :5174 配置
+ Shared Formal Resource Store
+ 当前 AI 配置状态
+ 当前 Trial requested / effective 输入
```

WP-R1 输出：

```text
统一启动器
+ 启动前依赖检查
+ 固定端口与已运行实例识别
+ product_runtime_health_v1
+ GET /__runtime/health
+ ready / degraded / blocked 聚合
+ 启动明确终态
+ Internal Health 只读投影
+ 自动化、启动器集成和浏览器验收记录
```

WP-R1 不修改 Learning / Workbench 普通页面的故障文案，不生成最终 Product Runtime Identity，不激活 Trial，不执行真实作答，也不修复历史固定数量断言。

完成后的最高状态只能是：

```text
WP-R1 ENGINEERING COMPLETE
DEBUG ACCEPTED
RUNTIME LAUNCH ACCEPTED
HEALTH READ-ONLY VERIFIED
WP-R2 AND WP-R3 AUTHORIZED
```

不得写成：

```text
REAL TRIAL RE-ENTRY APPROVED
REAL TRIAL ACTIVE
EDUCATIONAL EFFECT VERIFIED
```

## 二、WP-R0 前置事实

WP-R1 以以下已经验收的事实为前置条件：

| 事实 | WP-R0 结果 |
| --- | --- |
| R0-C01—R0-C32 | `32 / 32 PASS` |
| R0-B01—R0-B12 | `12 / 12 PASS` |
| Shared Store | initialized，revision `1963` |
| 动态正式资源 | 24 篇材料、81 道 Current Head、81 道可消费 |
| 零写入 | Formal / Attempt / Evidence / Profile / Calibration / Trial 全部为 0 |
| 当前 Runtime | `not_running` |
| 当前 Build Identity | fixed / insufficient |
| 当前 Trial | mismatch / reentry_required / effective mode 应保持 off |

上述 `24 / 81` 是实施时观测值，不得成为 WP-R1 长期断言。

## 三、范围与非目标

### 3.1 本工作包允许

- 新增统一启动命令；
- 检查 Node Runtime、项目依赖、5174 端口和正式资源可读性；
- 使用当前 `process.execPath` 启动项目内 Vite；
- 新增 GET-only `/__runtime/health`；
- 动态读取正式资源数量、Revision 和一致性；
- 只判断 AI 凭证是否存在且非空；
- 只读投射当前 Trial 输入，不修改 requested / effective mode；
- 增加 Internal Health 页面和内部验收路由；
- 增加 Fixture、Launcher Integration、真实浏览器和 Build 验收。

### 3.2 本工作包禁止

- 静默切换到 5175 或其他端口；
- 自动终止、替换或清理未知进程；
- 输出 API Key、Token 或其片段；
- 调用 AI Provider 验证凭证；
- 生成内容寻址的最终构建身份；
- 修改 Learning / Workbench 普通用户文案；
- 创建或提交 Session、Attempt、Diagnosis、Evidence、Profile 或校准事件；
- 激活、关闭或重建 Trial Window；
- 初始化、替换、修复或迁移 Shared Formal Resource Store；
- 删除浏览器数据、备份或本地正式文件；
- 重构现有 Material → Publish → Learning 主链。

## 四、工程架构与单一 Owner

```text
scripts/start-product-runtime.mjs
  ├─ Preflight Adapter
  │   ├─ process.execPath / Node version
  │   ├─ node_modules / Vite entry
  │   ├─ Shared Store read-only preflight
  │   └─ :5174 probe
  ├─ Existing Instance Classifier
  │   └─ GET /__runtime/health
  └─ Child Runtime Owner
      └─ Vite --host 127.0.0.1 --port 5174 --strictPort

Vite Runtime
  └─ GET /__runtime/health
      └─ ProductRuntimeHealthService
          ├─ SharedFormalResourceStore.read()
          ├─ dynamic formal baseline
          ├─ AI configured boolean
          └─ Trial read-only input
```

责任边界：

- 启动器只拥有“本次启动过程”，不拥有业务数据；
- Health Service 只做状态聚合，不建立新的正式事实库；
- Shared Formal Resource Store 继续是正式资源唯一 Owner；
- AI 配置来源仍是进程环境；Health 只输出布尔状态；
- Trial 状态继续来自既有 Trial Owner；Health 不执行回落或激活；
- Internal 页面只消费 Health，不成为健康状态 Owner。

## 五、统一启动器契约

### 5.1 标准命令

冻结项目命令：

```json
{
  "runtime:check": "node scripts/start-product-runtime.mjs --check",
  "runtime:start": "node scripts/start-product-runtime.mjs"
}
```

`runtime:check` 仅检查，不启动子进程。`runtime:start` 使用当前 `process.execPath` 启动 Vite，禁止依赖用户手工拼接 Node 路径。

`runtime:check` 的 `CHECK_READY` 只表示“依赖、端口与受控 AI 可用性验证满足启动前检查”，不表示 Runtime 已经运行；AI Key 已配置但尚未形成受控可用性证据时返回 `CHECK_DEGRADED / ai_provider_status_not_checked`。若发现健康的同项目实例则返回 `ALREADY_RUNNING`，若发现冲突或依赖问题则返回对应 blocked 终态。

本地启动器只绑定 `127.0.0.1`。`0.0.0.0`、局域网共享和远程访问不属于本契约，必须由后续独立部署方案显式授权。

### 5.2 启动输入

```ts
type ProductRuntimeLauncherOptions = {
  projectRoot: string;
  host: '127.0.0.1';
  port: 5174;
  strictPort: true;
  healthUrl: 'http://127.0.0.1:5174/__runtime/health';
  startupTimeoutMs: 20_000;
  pollIntervalMs: 250;
  mode: 'check_only' | 'start';
};
```

生产命令不允许通过普通参数改变端口、关闭 `strictPort` 或跳过正式资源检查。测试可通过依赖注入替换 Clock、Probe 和 Spawn Adapter，但不得改变生产默认值。

### 5.3 启动状态机

```text
IDLE
  → PREFLIGHT
  → PORT_PROBE
      ├─ healthy same-product instance → ALREADY_RUNNING
      ├─ occupied unknown/unhealthy     → BLOCKED_PORT_CONFLICT
      └─ free                           → SPAWNING
  → WAITING_FOR_HEALTH
      ├─ health ready/degraded → READY
      ├─ child exits            → BLOCKED_CHILD_EXITED
      └─ timeout                → BLOCKED_HEALTH_TIMEOUT
```

`READY` 表示 Runtime 已启动且 Health 返回可消费终态。Health 为 `degraded` 时允许启动器返回 READY，但必须同时输出 degraded Reason Code；Health 为 `blocked` 时启动器不得返回 READY。

### 5.4 启动终态 Schema

```ts
type ProductRuntimeLaunchStatus =
  | 'READY'
  | 'ALREADY_RUNNING'
  | 'CHECK_READY'
  | 'CHECK_DEGRADED'
  | 'BLOCKED_RUNTIME_MISSING'
  | 'BLOCKED_DEPENDENCY_MISSING'
  | 'BLOCKED_PORT_CONFLICT'
  | 'BLOCKED_FORMAL_STORE_UNREADABLE'
  | 'BLOCKED_CHILD_EXITED'
  | 'BLOCKED_HEALTH_TIMEOUT';

type ProductRuntimeLaunchResult = {
  schemaVersion: 'product_runtime_launch_result_v1';
  status: ProductRuntimeLaunchStatus;
  exitCode: 0 | 1;
  ownsChildProcess: boolean;
  childPid?: number;
  health?: ProductRuntimeHealth;
  reasonCodes: ProductRuntimeReasonCode[];
  urls: {
    learning: 'http://localhost:5174/#/learning';
    workbench: 'http://localhost:5174/#/material-resource-workbench';
    internalHealth: 'http://localhost:5174/#/internal/runtime-health';
    healthApi: 'http://127.0.0.1:5174/__runtime/health';
  };
};
```

退出码规则：`READY`、`ALREADY_RUNNING`、`CHECK_READY` 和 `CHECK_DEGRADED` 为 0；所有 `BLOCKED_*` 为 1。`CHECK_DEGRADED` 仅用于非核心依赖缺失但仍可启动的情况，并必须携带对应 Reason Code。

普通控制台不得输出本地绝对用户目录。内部 Debug 可记录相对文件名和不含密钥的错误码。

## 六、端口与进程安全契约

### 6.1 5174 分类算法

1. 对 `127.0.0.1:5174` 执行短时 TCP / HTTP 探测；
2. 无监听时才能进入 Spawn；
3. 有监听时请求 `/__runtime/health`，单次超时不超过 1,500ms；
4. 返回合法 `product_runtime_health_v1` 且 `instance.productId` 匹配时，判定本项目实例；
5. 同项目实例为 ready / degraded 时返回 `ALREADY_RUNNING`；
6. Schema 不合法、Product ID 不符、请求超时或 Health blocked 时返回 `BLOCKED_PORT_CONFLICT`；
7. 任何冲突均不得自动执行 kill、taskkill、Stop-Process 或端口切换。

### 6.2 进程所有权

- 生产启动器只记录自己 Spawn 的 PID；
- `ownsChildProcess=false` 时绝不允许终止进程；
- 集成测试清理只能终止本次测试 Spawn 且仍可验证为同一 PID 的子进程；
- Ctrl+C 仅向本次启动器拥有的 Child 转发结束信号；
- 不创建全局 PID 文件作为第二套运行事实；
- 进程退出不修改正式数据。

## 七、Runtime Health Schema

### 7.1 版本与实例标记

```ts
const PRODUCT_RUNTIME_HEALTH_VERSION = 'product_runtime_health_v1';
const PRODUCT_RUNTIME_ID = 'chinese_ability_growth_system_local_runtime';
```

`PRODUCT_RUNTIME_ID` 只用于辨认端口上的本项目实例，不是 WP-R3 的内容寻址 Build Identity。

### 7.2 健康响应

```ts
type ProductRuntimeHealth = {
  schemaVersion: 'product_runtime_health_v1';
  checkedAt: string;
  overallStatus: 'ready' | 'degraded' | 'blocked';
  instance: {
    productId: 'chinese_ability_growth_system_local_runtime';
    port: 5174;
    runtimeStatus: 'ready';
    buildIdentityStatus: 'insufficient' | 'available';
    buildIdentity?: string;
    reasonCodes: ProductRuntimeReasonCode[];
  };
  formalResourceStore: {
    status: 'ready' | 'blocked';
    initialized: boolean;
    revision?: number;
    activeMaterialCount?: number;
    currentQuestionCount?: number;
    learningConsumableQuestionCount?: number;
    baselineDigest?: string;
    reasonCodes: ProductRuntimeReasonCode[];
  };
  aiProvider: {
    providerId: 'deepseek';
    status: 'configured' | 'not_configured' | 'not_checked';
    verificationLevel: 'configuration_only' | 'live_verified';
    availabilityVerified: boolean;
    trialEligible: boolean;
    reasonCodes: ProductRuntimeReasonCode[];
  };
  learning: {
    status: 'ready' | 'degraded' | 'blocked';
    canReadFormalTasks: boolean;
    canStartRealLearning: boolean;
    canSubmitForDiagnosis: boolean;
    reasonCodes: ProductRuntimeReasonCode[];
  };
  trial: {
    requestedMode: 'off' | 'isolated_acceptance' | 'real_trial';
    effectiveMode: 'off' | 'isolated_acceptance' | 'real_trial';
    identityStatus: 'aligned' | 'mismatch' | 'insufficient_evidence';
    observationFailOpen: true;
    reasonCodes: ProductRuntimeReasonCode[];
  };
  summaryReasonCodes: ProductRuntimeReasonCode[];
  factDigest: string;
};
```

`factDigest` 只覆盖健康事实并排除 `checkedAt`；相同事实在不同检查时间必须得到相同 Digest。

### 7.3 Build Identity 临时规则

WP-R1 不提前实现 WP-R3：

- 当前固定 Build Version 可作为调试标签，但 `buildIdentityStatus` 必须为 `insufficient`；
- Health 必须包含 `runtime_identity_insufficient`；
- 固定字符串不得用于证明 Trial aligned；
- WP-R3 实现内容寻址身份后才允许 `available`。

## 八、健康聚合规则

### 8.1 Formal Store

| 状态 | 投射 |
| --- | --- |
| `read()` 抛错或 JSON 不可解析 | blocked / `formal_store_unreadable` |
| snapshot 未初始化 | blocked / `formal_store_uninitialized` |
| Registry / Version / Link / Trace / Consumable 不守恒 | blocked / `formal_resource_baseline_inconsistent` |
| 动态基线一致 | ready |

Health 只能读 Store。禁止调用 initialize、replace、restore、command、repair 或 migration。

### 8.2 AI Provider

| 环境事实 | 投射 |
| --- | --- |
| Key 缺失或空白 | `not_configured` / `ai_provider_not_configured` |
| Key 非空、未完成实时验证 | `configured`，`verificationLevel=configuration_only`，`availabilityVerified=false`，`trialEligible=false` |
| 已由受控真实调用验证 | `configured`，`verificationLevel=live_verified`，`availabilityVerified=true`，`trialEligible=true` |
| 本次未执行配置检查 | `not_checked` / `ai_provider_status_not_checked` |

WP-R1 不调用 Provider，因此不得输出 `unreachable`；该状态需由真实 Provider Boundary 的后续运行证据形成。

`canStartRealLearning` 与 `canSubmitForDiagnosis` 表示当前配置门禁允许发起操作，不证明外部 Provider 必然成功。真实 Trial 是否允许采集必须单独读取 `trialEligible`，不得由上述 capability 反推。

`PRODUCT_AI_PROVIDER_AVAILABILITY_VERIFIED=true` 只允许由受控 Provider 预检在成功后注入，不能由“Key 非空”自动推导，也不能作为普通用户手工绕过 Trial 门禁的开关。WP-R1 只消费该证据，不负责执行远端探测。

### 8.3 Learning 能力

| Formal Store | AI | Learning |
| --- | --- | --- |
| blocked | 任意 | blocked；三个 capability 均 false |
| ready | not_configured | degraded；可读 true，真实开始和诊断提交 false |
| ready | configured | ready；三个 capability true，但不表示 Provider 已完成真实调用 |
| ready | not_checked | degraded；可读 true，真实开始和诊断提交 false |

`no_learning_task_available` 是业务空状态，不改变 Runtime Health；WP-R1 不负责普通页面空状态文案。

### 8.4 Trial

- requested / effective 从既有只读输入读取；
- WP-R0 已确认身份 mismatch 时，Health 必须投射 effective `off` 或明确 mismatch；
- Trial mismatch 只使 overall degraded，不得阻断 Learning；
- Trial 为 off 且身份 aligned 时不构成故障；
- Trial Repository 不可读时 `trial_observation_unavailable`，Learning 继续 fail-open；
- Health 绝不调用 activate、deactivate、invalidate 或 append observation。

### 8.5 Overall

聚合优先级：

```text
任一核心 blocked → blocked
否则任一核心或非核心 degraded → degraded
否则 → ready
```

核心依赖为 Runtime、Formal Store 和当前 Learning 所需 AI 配置。Trial mismatch、Build Identity insufficient 和 Trial Observation unavailable 只产生 degraded。

## 九、HTTP Boundary 契约

### 9.1 路由

```text
GET /__runtime/health
```

### 9.2 HTTP 语义

| 条件 | HTTP | Body |
| --- | ---: | --- |
| overall ready | 200 | 合法 Health JSON |
| overall degraded | 200 | 合法 Health JSON + Reason Code |
| overall blocked | 503 | 合法 Health JSON + blocked 原因 |
| 非 GET | 405 | `{ code: 'method_not_allowed' }` |
| 未预期内部错误 | 503 | 最小 blocked Health，不包含堆栈或路径 |

固定 Header：

```text
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
X-Content-Type-Options: nosniff
```

### 9.3 禁止暴露

- API Key、长度、前后缀或 Hash；
- Material、Question、Rubric 或学生答案正文；
- Provider 原始请求或响应；
- 本地绝对路径；
- PID、完整环境变量和堆栈；
- 可重建学生内容的错误上下文。

## 十、Internal Health 页面

建议内部路由：

```text
#/internal/runtime-health
#/internal/acceptance/product-runtime-reliability-wp-r1
```

页面仅显示：

- overall status；
- Runtime、Formal Store、AI、Learning、Trial 分域状态；
- 动态数量、Revision 和不含内容的 Digest；
- Reason Code；
- checkedAt；
- 四个明确入口 URL。

页面不得提供：

- 启动、停止或杀进程按钮；
- 初始化、修复或恢复 Store；
- AI Key 输入框；
- Trial 激活按钮；
- 开始学习、提交答案或发布题目动作。

## 十一、失败与恢复语义

| 故障 | 启动器终态 | 数据语义 | 后续动作 |
| --- | --- | --- | --- |
| Node / Vite 缺失 | BLOCKED_RUNTIME_MISSING / DEPENDENCY_MISSING | 未开始、零写入 | 修复依赖后重试 |
| 5174 健康同项目实例 | ALREADY_RUNNING | 不 Spawn 第二实例 | 使用现有入口 |
| 5174 未知进程 | BLOCKED_PORT_CONFLICT | 不终止进程 | 用户自行处理冲突 |
| Store 不可读 | BLOCKED_FORMAL_STORE_UNREADABLE | 不初始化、不覆盖 | 进入既有显式恢复流程 |
| Child 提前退出 | BLOCKED_CHILD_EXITED | 保持已有数据 | 查看内部错误码后重试 |
| Health 超时 | BLOCKED_HEALTH_TIMEOUT | 不永久等待 | 检查 Runtime 后重试 |
| AI 未配置 | READY + degraded Health | 正式资源可读，真实 AI 路径禁用 | 配置后重启 |
| Trial mismatch | READY + degraded Health | Learning fail-open，Observation off | 进入 WP-R3—R4 |

启动失败必须明确回答：发生了什么、是否启动了子进程、现在可做什么。普通页面文案调整仍属于 WP-R2。

## 十二、零写入与安全证明

WP-R1 必须在 Health 前后比较：

```ts
type ProductRuntimeHealthZeroWriteComparison = {
  formalResourceRevisionBefore: number;
  formalResourceRevisionAfter: number;
  formalResourceDigestBefore: string;
  formalResourceDigestAfter: string;
  attemptWriteCount: 0;
  evidenceWriteCount: 0;
  profileWriteCount: 0;
  realCalibrationDenominatorWriteCount: 0;
  trialStateWriteCount: 0;
  verified: boolean;
};
```

启动 Runtime 本身不算业务写入。Vite 缓存和构建产物不属于正式事实，但不得写入 Shared Store、浏览器学习库或 Trial Repository。

## 十三、工程工作分解

### WP-R1-A：Schema 与纯函数聚合

- 冻结 `product_runtime_health_v1`；
- 冻结 `product_runtime_launch_result_v1`；
- 实现 Schema Guard；
- 实现 Formal / AI / Learning / Trial 聚合；
- 复用 WP-R0 Reason Registry。

### WP-R1-B：只读 Health Adapter 与 Boundary

- 读取 Shared Store；
- 动态生成正式资源基线；
- 读取 AI configured boolean；
- 读取 Trial 输入；
- 新增 GET-only Boundary；
- 在 Vite `configureServer` 中注册。

### WP-R1-C：统一启动器

- 项目根定位；
- `process.execPath` 与 Vite entry 检查；
- 5174 分类；
- Spawn 与 Health 等待；
- 明确终态和入口地址；
- Ctrl+C 仅处理自有子进程。

### WP-R1-D：Internal Health 与浏览器验收

- 只读 Internal 页面；
- Internal Hub 入口；
- Browser Acceptance API；
- 页面、接口、敏感信息和零操作验收。

### WP-R1-E：回归与完成记录

- 自动化、Launcher Integration、浏览器矩阵；
- WP-R0 与核心主链回归；
- Production Build；
- 零写入报告；
- 只授权 WP-R2 与 WP-R3。

## 十四、建议工程文件

```text
scripts/start-product-runtime.mjs
src/ai/schemas/productRuntimeHealth.schema.ts
src/ai/services/productRuntimeHealthService.ts
src/server/productRuntimeHealthBoundary.ts
src/api/productRuntimeReliabilityWPR1BrowserAcceptance.ts
src/pages/ProductRuntimeHealth.jsx
src/pages/ProductRuntimeReliabilityWPR1Acceptance.jsx
src/ai/tests/runProductRuntimeReliabilityWPR1Debug.ts
src/ai/tests/runProductRuntimeReliabilityWPR1LauncherIntegrationDebug.ts
src/ai/tests/runProductRuntimeReliabilityWPR1BrowserMatrixDebug.ts
```

允许按现有目录规范合并少量文件，但 Schema、聚合、Boundary 和 Launcher 的职责不得混在一个不可测试脚本中。

## 十五、自动化 Debug 验收矩阵

冻结 `R1-C01—R1-C36`：

| ID | 验收项 | 通过标准 |
| --- | --- | --- |
| R1-C01 | Health Schema | 合法 `product_runtime_health_v1` 通过 Guard |
| R1-C02 | 未知 Schema | 未知版本拒绝 |
| R1-C03 | Launch Schema | 合法 `product_runtime_launch_result_v1` 通过 Guard |
| R1-C04 | Product ID | 仅稳定实例标记通过，不冒充 Build Identity |
| R1-C05 | 固定端口 | 生产端口严格为 5174 |
| R1-C06 | Runtime Ready | Boundary 内 Runtime 投射 ready |
| R1-C07 | Store Ready | 当前动态基线一致时 ready |
| R1-C08 | Store Unreadable | blocked + `formal_store_unreadable` |
| R1-C09 | Store Uninitialized | blocked + `formal_store_uninitialized` |
| R1-C10 | Store Inconsistent | blocked + `formal_resource_baseline_inconsistent` |
| R1-C11 | 动态材料数 | 不断言固定 12 / 24 |
| R1-C12 | 动态题量 | 不断言固定 46 / 81 |
| R1-C13 | AI Missing | not_configured，不输出 Key |
| R1-C14 | AI Configured | 区分 configuration_only / live_verified；未验证不进入 Trial，但不反向阻断普通本地 Learning |
| R1-C15 | AI Not Checked | 保守 degraded，不猜测 ready |
| R1-C16 | Learning Read | Store ready 时可读正式任务 |
| R1-C17 | Learning AI Gate | AI missing 时真实开始和诊断提交为 false |
| R1-C18 | Learning Ready | Store 与所需配置就绪时 ready |
| R1-C19 | Trial Off | aligned + off 不构成故障 |
| R1-C20 | Trial Mismatch | degraded + reentry_required，不阻断 Learning |
| R1-C21 | Trial Fail-open | Observation unavailable 不阻断核心 Learning |
| R1-C22 | Overall Blocked | 任一核心 blocked 时 blocked |
| R1-C23 | Overall Degraded | 无核心 blocked 且存在 degraded 时 degraded |
| R1-C24 | Overall Ready | 全部当前核心依赖通过时 ready |
| R1-C25 | Reason 去重 | summary Reason Code 唯一且稳定排序 |
| R1-C26 | Build Identity | 当前固定标签必须显示 insufficient |
| R1-C27 | GET Ready HTTP | ready 返回 200 |
| R1-C28 | GET Degraded HTTP | degraded 返回 200 |
| R1-C29 | GET Blocked HTTP | blocked 返回 503 且仍为合法 Schema |
| R1-C30 | 非 GET | 返回 405，不执行读取之外动作 |
| R1-C31 | Cache Header | `no-store` 与 `nosniff` 完整 |
| R1-C32 | 敏感信息 | 响应不含 Key、正文、答案、路径和堆栈 |
| R1-C33 | Health 幂等 | 同事实不同 checkedAt 的事实 Digest 一致 |
| R1-C34 | Formal 零写入 | Health 前后 Revision 与 Digest 不变 |
| R1-C35 | 其他零写入 | Attempt / Evidence / Profile / Calibration / Trial 为 0 |
| R1-C36 | 异常收敛 | 未预期错误得到最小 blocked Health，不泄露内部信息 |

最低门槛：`36 / 36 PASS`。

## 十六、启动器集成验收矩阵

冻结 `R1-L01—R1-L14`：

| ID | 场景 | 通过标准 |
| --- | --- | --- |
| R1-L01 | 项目根 | 从脚本位置稳定解析，不依赖当前工作目录 |
| R1-L02 | Node Runtime | 使用 `process.execPath`，不依赖 PATH 中的 node |
| R1-L03 | Vite Entry | 缺失时早失败，不 Spawn |
| R1-L04 | Check-only | 完成预检但不 Spawn |
| R1-L05 | 端口空闲 | 只 Spawn 一个 Vite 子进程 |
| R1-L06 | Strict Port | 参数固定 `--port 5174 --strictPort` |
| R1-L07 | 健康同项目实例 | 返回 ALREADY_RUNNING，不 Spawn 第二实例 |
| R1-L08 | 未知端口占用 | BLOCKED_PORT_CONFLICT，不终止进程 |
| R1-L09 | 不健康同项目实例 | 阻断，不以旧页面判定 ready |
| R1-L10 | Ready 等待 | 轮询至 ready / degraded 终态后返回 |
| R1-L11 | Child 提前退出 | BLOCKED_CHILD_EXITED，保留退出证据码 |
| R1-L12 | Health 超时 | 20 秒内收敛 BLOCKED_HEALTH_TIMEOUT |
| R1-L13 | URL 输出 | 四个 URL 准确且不含本地路径 |
| R1-L14 | 清理所有权 | 测试只清理自己 Spawn 的 PID，未知进程零操作 |

Fixture Adapter 必须覆盖冲突与超时；真实集成只在 5174 空闲时启动，并只停止本次测试拥有的子进程。最低门槛：`14 / 14 PASS`。

## 十七、真实浏览器验收矩阵

冻结 `R1-B01—R1-B14`：

| ID | 场景 | 通过标准 |
| --- | --- | --- |
| R1-B01 | 统一启动 | 使用标准命令启动到明确终态 |
| R1-B02 | Health API | 浏览器 GET 返回合法 Schema |
| R1-B03 | Internal Health | 页面显示 overall 与五个分域状态 |
| R1-B04 | Learning URL | 统一输出地址可访问 |
| R1-B05 | Workbench URL | 统一输出地址可访问 |
| R1-B06 | 正式资源 | Revision、材料数和题数与 Store 动态一致 |
| R1-B07 | AI 未配置 | 显示 not_configured，不显示 Key 或长度 |
| R1-B08 | Trial 错位 | 显示 mismatch / off，不激活 Trial |
| R1-B09 | 重复启动 | 第二次返回 ALREADY_RUNNING，无重复实例 |
| R1-B10 | 页面与 Health | 旧页面可见不替代 Health 判定 |
| R1-B11 | Refresh | Internal Health 刷新只重新 GET，不写数据 |
| R1-B12 | 普通页面边界 | 本轮未修改 Learning / Workbench 故障文案 |
| R1-B13 | 敏感信息 | DOM、Network Response 和 Console 无 Key、正文、答案、绝对路径 |
| R1-B14 | 前后不可变 | Formal / Learning / Calibration / Trial Digest 零变化 |

真实浏览器最低门槛：`14 / 14 PASS`。

## 十八、回归矩阵

WP-R1 至少回归：

- WP-R0 `32 / 32`；
- WP-R0 Browser Matrix `12 / 12`；
- Shared Formal Resource Persistence；
- Structured Runtime Error；
- Formal Resource Latest Quality Admission；
- Resource Coverage；
- Material Resource Workbench State；
- Unified Learning Entry；
- Learning Session Task Queue；
- Phase 16.3 Day 0 Integration；
- Product Complexity Convergence Stage 4；
- Real Trial Preflight；
- Production Build。

历史固定 `12` 条材料断言继续登记 `fixed_baseline_assertion`，不得通过修改正式 Store 获得绿色。

## 十九、工程命令

工程完成后 `package.json` 应提供：

```json
{
  "runtime:check": "node scripts/start-product-runtime.mjs --check",
  "runtime:start": "node scripts/start-product-runtime.mjs",
  "debug:product-runtime-reliability-wp-r1": "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runProductRuntimeReliabilityWPR1Debug.ts",
  "debug:product-runtime-reliability-wp-r1-launcher": "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runProductRuntimeReliabilityWPR1LauncherIntegrationDebug.ts",
  "debug:product-runtime-reliability-wp-r1-browser-matrix": "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runProductRuntimeReliabilityWPR1BrowserMatrixDebug.ts"
}
```

## 二十、Debug 执行顺序

1. Schema Guard 与纯函数状态聚合；
2. Store / AI / Trial Fixture Adapter；
3. GET-only Health Boundary；
4. Launcher Preflight 与端口分类 Fixture；
5. Launcher 子进程集成；
6. 当前正式 Store 只读 Health；
7. Internal Health 页面；
8. 真实浏览器矩阵；
9. WP-R0 与核心主链回归；
10. Production Build；
11. 零写入和执行报告。

任一步出现正式数据变化、未知进程被终止、密钥泄露或 Trial 状态写入，立即停止 WP-R1。

## 二十一、报告产物

工程完成后输出：

```text
docs/education/phase/reports/
product_runtime_reliability_wp_r1_launcher_health_debug_browser_acceptance_YYYY-MM-DD.md
```

报告至少包含：

1. Git 与 Worktree；
2. Schema、Reason Registry 和 Product ID；
3. 统一启动终态；
4. 5174 端口分类；
5. Health 完整分域摘要；
6. 当前动态正式资源基线；
7. AI 仅配置状态；
8. Trial requested / effective / identity；
9. R1-C、R1-L 和 R1-B 结果；
10. 核心回归与 Build；
11. 零写入证明；
12. 已知 P0 / P1 / P2；
13. 回滚方式；
14. WP-R2 与 WP-R3 精确授权；
15. 明确声明 Trial 未重新准入。

## 二十二、回滚契约

WP-R1 必须可独立回滚：

- 删除启动器脚本和新增 package scripts；
- 从 Vite 移除 `/__runtime/health` 注册；
- 移除新增 Schema、Service、Boundary、Internal 页面和验收文件；
- 保留 WP-R0 Schema、Reason Registry、审计报告和正式数据；
- 不回滚 Shared Store Revision；
- 不删除任何 Learning、Calibration 或 Trial 历史；
- 不通过终止未知 5174 进程执行回滚。

## 二十三、完成门槛

WP-R1 只有同时满足以下条件才可完成：

1. 单一 `runtime:start` 可重复使用；
2. 启动器使用当前 Node Runtime 且不要求手工路径；
3. 5174 空闲、同项目实例和未知进程三种状态均准确处理；
4. 不静默换端口、不终止未知进程；
5. `/__runtime/health` 为 GET-only 且无副作用；
6. Health Schema、实例标记和 Reason Code 稳定；
7. ready / degraded / blocked 聚合符合本契约；
8. Store 基线动态读取且数量守恒；
9. AI 只披露配置状态，不调用 Provider、不泄露 Key；
10. Trial 只读且 mismatch 不阻断 Learning；
11. 当前固定 Build Version 明确标记 insufficient；
12. 启动超时在 20 秒内收敛；
13. R1-C01—R1-C36 为 `36 / 36 PASS`；
14. R1-L01—R1-L14 为 `14 / 14 PASS`；
15. R1-B01—R1-B14 为 `14 / 14 PASS`；
16. WP-R0 和核心主链回归通过；
17. Production Build 通过；
18. Formal / Attempt / Evidence / Profile / Calibration / Trial 未授权写入均为 0；
19. 生成执行报告；
20. 未提前实现 WP-R2—WP-R6。

## 二十四、进入后续工作包的边界

### 24.1 WP-R2 授权

WP-R2 只允许基于 Health 与 Reason Code 实现：

- Learning / Workbench 普通故障分类；
- “发生了什么、内容是否保留、下一步动作”的用户投射；
- Runtime、Store、无任务、Session 恢复和 AI 故障区分；
- 普通页面隐藏内部术语。

### 24.2 WP-R3 授权

WP-R3 只允许实现：

- 内容寻址 Product Runtime Identity；
- Git、源码、产物、Registry 与 Policy 绑定；
- 代码变化后的 Trial 自动失效；
- Health 中 `buildIdentityStatus=available` 的正式来源。

WP-R1 完成仍不授权 WP-R4 Trial 重新激活，也不授权 WP-R5 真实学习烟测。

## 二十五、冻结结论

`product_runtime_reliability_wp_r1_v1` 冻结以下事实：

1. 统一启动器是唯一推荐本地启动入口；
2. 标准端口固定 5174，禁止静默换端口；
3. 健康同项目实例复用，未知进程只阻断不终止；
4. “进程已创建”不等于 Runtime ready；
5. Health 必须到达 ready、degraded 或 blocked 明确终态；
6. Health 是只读投影，不是第二套正式事实；
7. Formal Store、AI、Learning 和 Trial 分域判断；
8. 当前材料与题量动态读取，不硬编码 24 / 81；
9. AI 配置存在不等于已验证 Provider 可达；
10. Trial mismatch 不阻断核心 Learning，但 Observation 必须 off；
11. 固定 Build Version 继续标记 identity insufficient；
12. Internal Health 不提供修复、启动、提交或激活动作；
13. 启动和 Health 不写正式资源或学习事实；
14. WP-R1 不修改普通页面文案；
15. WP-R1 完成只授权 WP-R2 与 WP-R3，不代表真实 Trial 已重新准入。

本文档已于 2026-08-25 达到 `WP-R1 ENGINEERING COMPLETE / DEBUG ACCEPTED / RUNTIME LAUNCH ACCEPTED / HEALTH READ-ONLY VERIFIED / WP-R2 AND WP-R3 AUTHORIZED`。工程结果为 `R1-C 36 / 36 PASS`、`R1-L 14 / 14 PASS`、`R1-B 14 / 14 PASS`，真实启动为 `READY`，重复启动为 `ALREADY_RUNNING`，核心回归、Production Build 和零写入验证均通过。当前 Health 为 degraded，准确披露 AI 未配置、构建身份不足和 Trial 重新准入要求；该状态不影响 WP-R1 完成，也不得解释为真实 Trial 已重新准入。
