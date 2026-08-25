# 产品运行可靠性 WP-R2：Learning / Workbench 故障分类与恢复投射工程实施及 Debug 验收文档

英文名称：Product Runtime Reliability WP-R2 Failure Classification and Recovery Projection Engineering and Debug Plan

对应主契约：`product_runtime_reliability_and_real_trial_reentry_v1`

阶段版本：`product_runtime_reliability_wp_r2_v1`

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / BROWSER ACCEPTED / WP-R2 COMPLETE`

日期：2026-08-25

关联文档：

- [产品运行可靠性与真实 Trial 重新准入契约](./PRODUCT_RUNTIME_RELIABILITY_AND_REAL_TRIAL_REENTRY_CONTRACT.md)
- [WP-R0 运行基线、Reason Code 与只读审计文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R0_BASELINE_ENGINEERING_AND_DEBUG_PLAN.md)
- [WP-R1 统一启动器与 Runtime Health 文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R1_LAUNCHER_AND_HEALTH_ENGINEERING_AND_DEBUG_PLAN.md)
- [WP-R1 启动器、Health、Debug 与浏览器验收记录](../education/phase/reports/product_runtime_reliability_wp_r1_launcher_health_debug_browser_acceptance_2026-08-25.md)
- [学生产品界面收口契约](./STUDENT_PRODUCT_INTERFACE_CONSOLIDATION.md)

## 一、阶段定位

WP-R2 只解决普通用户面对运行故障时的产品表达和恢复路径：

> 系统必须准确区分 Runtime、正式资源、无任务、Session、Submission 和 AI 故障，并告诉用户发生了什么、已有内容是否保留、现在可以做什么。

WP-R2 输入：

```text
product_runtime_health_v1
+ product_runtime_reason_registry_v1
+ Learning Session / Attempt / Checkpoint / Draft Owner Fact
+ Workbench 当前操作与已提交事实
+ Unified Learning Entry 与 Live Learning 现有状态
```

WP-R2 输出：

```text
product_runtime_user_projection_v1
+ Health Client 与外部不可达分类
+ Learning Entry 恢复投射
+ Live Learning 提交恢复投射
+ Workbench 操作级故障投射
+ 普通页面文案与单一主操作
+ Internal 可追踪、普通页面去内部术语
+ 自动化和真实浏览器验收记录
```

完成后的最高状态：

```text
WP-R2 ENGINEERING COMPLETE
DEBUG ACCEPTED
LEARNING RECOVERY PROJECTION ACCEPTED
WORKBENCH RECOVERY PROJECTION ACCEPTED
WP-R5 PARTIAL PREREQUISITE SATISFIED
```

WP-R2 不生成 Product Runtime Identity，不修改 Trial，不执行重新准入，不制造真实学习事件，也不改变教育判断。

## 二、WP-R1 前置事实

| 前置事实 | 当前结果 |
| --- | --- |
| R1-C01—R1-C36 | `36 / 36 PASS` |
| R1-L01—R1-L14 | `14 / 14 PASS` |
| R1-B01—R1-B14 | `14 / 14 PASS` |
| Runtime | 可由统一启动器进入 READY |
| 重复启动 | ALREADY_RUNNING，不创建第二实例 |
| Health | GET-only，ready / degraded / blocked 可解释 |
| Formal Store | ready，revision 1963，24 / 81 / 81 动态一致 |
| AI | 当前启动实例 not_configured |
| Trial | mismatch / effective off / Learning fail-open |

WP-R2 必须消费 Health 和 Owner Fact，不得复制另一套运行状态或学习事实。

## 三、范围与非目标

### 3.1 允许实施

- 新增浏览器端 Health Client；
- 将 Health fetch failure 区分为 unreachable、timeout、invalid response；
- 将冻结 Reason Code 转换为版本化普通用户投射；
- 调整 Unified Learning Entry 的错误页、空状态和恢复动作；
- 调整 Live Learning 的开始、提交、诊断与反馈恢复投射；
- 调整 Workbench 的读取、AI 生成、采用、发布和安全重试投射；
- 复用现有 Session、Attempt、Checkpoint、草稿和发布 Owner Fact判断内容保留状态；
- 在 Internal 日志中保留 Reason Code 和 Error Reference；
- 增加 Fixture、浏览器矩阵和零写入验收。

### 3.2 禁止实施

- 修改 `/__runtime/health` 的 Owner 语义；
- 自动启动或停止 Runtime；
- 在普通页面显示 Reason Code、Store Revision、Registry、Hash、PID、Command ID 或内部阶段；
- 根据错误字符串猜测 Attempt、草稿或发布是否成功；
- 自动重复提交答案、生成、采用或发布；
- 创建第二个 Session、Attempt、Checkpoint 或 Workbench 事务状态；
- 修改正式资源、题目、评分标准或难度；
- 修改 Product Runtime Identity；
- 激活、关闭或重建 Trial；
- 把 Trial mismatch 显示给学生或普通录入用户；
- 新增 Training Model 能力。

## 四、核心产品原则

### 4.1 三段式恢复信息

每个普通故障投射必须分别回答：

1. `situationText`：发生了什么；
2. `preservationText`：已有内容是否保留；
3. `primaryAction`：现在可以做什么。

没有 Owner Fact 时，`preservationText` 必须表达“尚未确认”，不得宣称“已经保存”或“不会丢失”。

### 4.2 一个意图只有一个主操作

- Runtime / Store 读取失败：`重新尝试`；
- Session 已存在：`继续学习`；
- Submission 已提交待处理：`继续处理`；
- AI 配置缺失：`返回学习入口`或无主操作；
- 无任务：无机械重试；
- Workbench 可安全重试：`重新尝试当前操作`。

同一投射不得同时出现两个同等级主按钮。辅助返回动作只能使用次要样式。

### 4.3 检查是系统能力，决策才是用户任务

Health、Revision、Checkpoint 和幂等校验由系统执行。用户不管理端口、Revision、事务、Registry 或恢复阶段。

### 4.4 恢复工作而不是恢复事务界面

刷新后应回到当前工作对象：当前 Session、当前题、当前答案草稿或当前 Workbench Task。不得让用户选择内部事务版本。

## 五、版本化投射 Schema

### 5.1 Schema

```ts
const PRODUCT_RUNTIME_USER_PROJECTION_VERSION =
  'product_runtime_user_projection_v1';

type ProductRuntimeUserSurface =
  | 'learning_entry'
  | 'learning_workspace'
  | 'workbench';

type ProductRuntimeUserProjectionState =
  | 'ready'
  | 'runtime_unavailable'
  | 'formal_resource_unavailable'
  | 'no_task'
  | 'ai_configuration_required'
  | 'ai_temporarily_unavailable'
  | 'session_recoverable'
  | 'submission_recoverable'
  | 'identity_conflict'
  | 'operation_retryable'
  | 'operation_blocked';

type ProductRuntimeContentState =
  | 'not_started'
  | 'draft_preserved'
  | 'progress_preserved'
  | 'answer_submitted'
  | 'published_preserved'
  | 'unknown_requires_check';

type ProductRuntimeUserAction = {
  actionId:
    | 'retry_health'
    | 'retry_read'
    | 'continue_learning'
    | 'continue_processing'
    | 'retry_current_operation'
    | 'return_to_entry'
    | 'none';
  label: string;
  emphasis: 'primary' | 'none';
  idempotencyRequired: boolean;
};

type ProductRuntimeUserProjection = {
  schemaVersion: 'product_runtime_user_projection_v1';
  surface: ProductRuntimeUserSurface;
  state: ProductRuntimeUserProjectionState;
  tone: 'neutral' | 'information' | 'recoverable' | 'blocked';
  title: string;
  situationText: string;
  contentState: ProductRuntimeContentState;
  preservationText: string;
  primaryAction: ProductRuntimeUserAction;
  secondaryAction?: {
    actionId: 'return_to_entry';
    label: '返回学习入口' | '返回工作台';
    emphasis: 'secondary';
  };
  internal: {
    reasonCodes: ProductRuntimeReasonCode[];
    errorRef?: string;
    healthFactDigest?: string;
  };
  projectionDigest: string;
};
```

`internal` 只供日志、Debug 和 Internal 页面使用。普通页面组件不得渲染 `internal`。

### 5.2 投射上下文

```ts
type ProductRuntimeProjectionContext = {
  surface: ProductRuntimeUserSurface;
  operation?:
    | 'load_entry'
    | 'start_learning'
    | 'load_task'
    | 'submit_answer'
    | 'resume_diagnosis'
    | 'workbench_read'
    | 'workbench_generate'
    | 'workbench_adopt'
    | 'workbench_publish';
  health?: ProductRuntimeHealth;
  healthReadState: 'available' | 'unreachable' | 'timeout' | 'invalid';
  reasonCodes?: ProductRuntimeReasonCode[];
  ownerFacts: {
    hasActiveSession: boolean | 'unknown';
    hasDraft: boolean | 'unknown';
    attemptCommitted: boolean | 'unknown';
    checkpointPhase?: string;
    publishedResourceCommitted: boolean | 'unknown';
    currentWorkbenchObjectPresent: boolean | 'unknown';
  };
  taskAvailability?:
    | 'available'
    | 'no_formal_resource'
    | 'no_eligible_match'
    | 'already_used'
    | 'stale_session';
  runtimeError?: StructuredRuntimeError;
};
```

所有 preservation 结论必须来自 `ownerFacts`，Health 不拥有草稿或 Attempt 是否保存的结论。

## 六、Health Client 契约

建议新增：

```text
src/api/productRuntimeHealthClient.ts
```

接口：

```ts
type ProductRuntimeHealthReadResult =
  | { state: 'available'; health: ProductRuntimeHealth }
  | { state: 'unreachable'; reasonCode: 'runtime_unreachable' }
  | { state: 'timeout'; reasonCode: 'runtime_health_timeout' }
  | { state: 'invalid'; reasonCode: 'audit_evidence_incomplete' };

readProductRuntimeHealth(options?: {
  timeoutMs?: 1500;
}): Promise<ProductRuntimeHealthReadResult>;
```

规则：

- 只允许 GET `/__runtime/health`；
- 默认超时 1,500ms；
- 不自动循环重试；
- HTTP 503 但 Body 为合法 blocked Health 时仍返回 available；
- Fetch 失败映射 unreachable；
- Abort 映射 timeout；
- Schema 不合法映射 invalid；
- 不缓存 ready 代替当前事实；
- 不输出 Response Body、堆栈或本地路径给普通页面。

## 七、分类优先级

同一时刻存在多个事实时按以下优先级投射：

```text
1. Submission / Session identity conflict
2. Formal Store unreadable / inconsistent
3. Runtime unreachable / Health timeout
4. Submission recoverable
5. Session recoverable
6. 当前动作所需 AI unavailable
7. no task
8. ready
```

补充规则：

- Trial mismatch、Trial off、Build Identity insufficient 不进入普通页面；
- Runtime 不可达时，若本地 Owner Fact 明确存在草稿或已提交 Attempt，仍应准确展示保留状态；
- `no_task` 只有在 Runtime 和 Formal Store 可读后才能成立；
- AI 故障只阻断依赖 AI 的开始、生成或诊断动作，不阻断正式资源只读浏览；
- Workbench 单卡片错误不得无条件提升为全局工作台 blocked。

## 八、Reason Code 到普通投射矩阵

| Reason Code | Surface | 普通状态 | 内容说明 | 主操作 |
| --- | --- | --- | --- | --- |
| `runtime_unreachable` | Learning Entry | runtime_unavailable | 按 Owner Fact 显示草稿/进度/未知 | 重新尝试 |
| `runtime_health_timeout` | Learning Entry | runtime_unavailable | 不猜测 Store 损坏 | 重新尝试 |
| `formal_store_unreadable` | Learning Entry | formal_resource_unavailable | 不创建新 Session | 重新尝试 |
| `formal_store_uninitialized` | Learning Entry | formal_resource_unavailable | 尚未开始新学习 | 重新尝试 |
| `formal_resource_boundary_unavailable` | Learning Entry | formal_resource_unavailable | 已有本地内容按事实披露 | 重新尝试 |
| `formal_resource_baseline_inconsistent` | Learning Entry | identity_conflict | 停止新 Session，不自动修复 | 返回学习入口 |
| `no_learning_task_available` | Learning Entry | no_task | 服务正常，当前无合适任务 | none |
| `task_identity_mismatch` | Learning | identity_conflict | 已有进度保留，当前题不继续提交 | 返回学习入口 |
| `learning_session_recovery_required` | Learning Entry | session_recoverable | 上次进度已保留 | 继续学习 |
| `learning_session_identity_mismatch` | Learning | identity_conflict | 不创建第二 Session | 返回学习入口 |
| `submission_recovery_required` | Workspace | submission_recoverable | 回答已提交，不重复形成 Attempt | 继续处理 |
| `submission_identity_mismatch` | Workspace | identity_conflict | 已提交事实保留，阻断重复提交 | 返回学习入口 |
| `ai_provider_not_configured` | Learning | ai_configuration_required | 草稿/Attempt 按 Owner Fact说明 | 返回学习入口或 none |
| `ai_provider_unreachable` | Learning | ai_temporarily_unavailable | 已提交则显示已保留 | 继续处理或重新尝试 |
| `ai_provider_status_not_checked` | Learning | operation_blocked | 不猜测 AI ready | 重新尝试检查 |
| `trial_identity_mismatch` | 普通页面 | 不投射 | Internal only | 不影响普通动作 |
| `trial_reentry_required` | 普通页面 | 不投射 | Internal only | 不影响普通动作 |
| `trial_observation_unavailable` | 普通页面 | 不投射 | Learning fail-open | 不影响普通动作 |

Workbench 使用同一语义，但标题、动作和 preservation 必须针对当前录入对象。

## 九、Learning Entry 投射契约

### 9.1 加载顺序

```text
读取 Runtime Health
→ 读取本地 Session / Persistence / Checkpoint Owner Fact
→ Runtime 与 Formal Store 分类
→ 读取正式任务可用性
→ 生成 Unified Entry 状态
→ 生成普通用户投射
```

读取可以并行，但投射必须按上述事实优先级决策。Health 失败不得清理本地 Session 或草稿。

### 9.2 页面状态

| 状态 | 标题 | Situation | Preservation | 主操作 |
| --- | --- | --- | --- | --- |
| Runtime 不可达 | 学习服务尚未启动 | 启动服务后可以继续 | 有草稿则“上次输入已保留”；未知则“不更改现有记录” | 重新尝试 |
| Formal Store 不可读 | 正式学习任务暂时无法读取 | 当前不能开始新任务 | 不创建新 Session | 重新尝试 |
| 无任务 | 当前暂时没有可开始的学习任务 | 服务与资源读取正常 | 现有学习记录不受影响 | none |
| Session 可恢复 | 可以继续上次学习 | 找到未完成学习 | 进度已经保留 | 继续学习 |
| AI 未配置 | 当前学习反馈服务尚未配置 | 可查看任务，但不能开始需要反馈的新学习 | 不创建新 Attempt | 返回学习入口或 none |
| Ready | 可以开始 / 可以继续 | 沿用现有产品文案 | 沿用 Owner Fact | 现有主操作 |

### 9.3 当前错误文案修正目标

现有通用投射：

```text
暂时无法打开学习入口
正式任务暂时无法读取，请重新尝试。
```

不得继续覆盖所有失败。WP-R2 后必须至少区分：

- 学习服务尚未启动；
- 正式资源不可读；
- 学习状态读取失败但本地记录明确保留；
- 当前无可用任务；
- AI 服务未配置；
- 现有 Session 或 Submission 可恢复。

## 十、Live Learning 与提交恢复契约

### 10.1 提交前

- 输入校验失败：答案仍可编辑，不形成 Attempt，不显示“已提交”；
- AI 未配置且当前提交必需 AI：Provider 调用前阻断，保留输入草稿；
- Runtime / Boundary 不可达：不得把按钮切换成永久“处理中”；
- 快速重复点击只接受一次主操作。

### 10.2 Attempt 已提交后

只有 `attemptCommitted=true` 才允许显示：

```text
回答已经提交，正在继续处理。
```

行为：

- 主操作为 `继续处理`；
- 使用同一 Attempt / Operation / Checkpoint；
- 不再次创建 Attempt；
- AI 恢复后从 Checkpoint 继续；
- 刷新后仍得到相同投射；
- 诊断或反馈旁路失败不得回退成空白答题框。

### 10.3 仅草稿存在

只有 `hasDraft=true` 且 Attempt 未提交时显示：

```text
上次输入的答案草稿已经保留。
```

主操作为 `继续学习`，进入原 Session 和原题。不得显示“回答已经提交”。

### 10.4 身份冲突

Task、Session 或 Submission 身份不一致时：

- 阻断重复正式提交；
- 保留现有 Owner Fact；
- 普通页面显示“当前学习需要重新打开确认”；
- 主操作返回学习入口；
- Internal 记录具体 identity Reason Code；
- 不在普通页面展示 ID、版本或 Revision。

## 十一、Workbench 投射契约

### 11.1 操作级依赖

| 操作 | Runtime | Formal Store | AI |
| --- | --- | --- | --- |
| 查看当前卡片 | required | required | not required |
| 本地编辑未提交字段 | 页面已加载即可 | 写入时 required | not required |
| AI 生成 / 优化 | required | read required | required |
| 采用候选 | required | write required | not required |
| 发布 | required | write required | not required |

AI 未配置不能把整个 Workbench 标记为不可用，只阻断生成和优化动作。

### 11.2 普通状态词汇

Workbench 只允许展示：

```text
可以生成
正在生成
可以发布
正在发布
已发布
可以安全重试
当前服务未启动
AI 服务未配置
```

允许对当前操作增加简短 preservation：

- `当前编辑内容已经保留`；
- `候选已经保留，可以重新尝试采用`；
- `发布结果已确认，无需重复发布`；
- `本次操作尚未完成，现有正式数据没有变化`。

### 11.3 禁止的普通文案

普通 Workbench 不得展示：

```text
Revision
Command ID
Registry Head
Quality Trace
Gate
checkpoint phase
shared_resource_revision_conflict
Provider 原始错误
英文内部异常消息
```

这些事实只进入 Internal 日志或 Error Reference。

### 11.4 发布与并发

- 已发布 Owner Fact 优先于旧 UI `待处理`；
- 冲突后先重新读取当前事实，再决定“已完成”或“可以安全重试”；
- 不自动重复采用或发布；
- 当前浏览器内正式写入继续复用既有串行队列；
- WP-R2 只改变投射，不改变 WP-C0—C4 已验收的并发语义。

## 十二、普通组件边界

建议新增纯展示组件：

```text
src/components/runtime/ProductRuntimeRecoveryNotice.jsx
```

输入必须为已去内部字段的 View Model：

```ts
type ProductRuntimeRecoveryNoticeView = {
  tone: 'neutral' | 'information' | 'recoverable' | 'blocked';
  title: string;
  situationText: string;
  preservationText: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
};
```

组件不得接收 raw Error、Health Response、Reason Code Registry 或 Owner Repository。

## 十三、动作与幂等契约

| Action | 行为 | 幂等要求 |
| --- | --- | --- |
| retry_health | 重新 GET Health 一次 | 不写业务数据 |
| retry_read | 重新读取当前 Owner Fact | 不创建新 Session / Attempt |
| continue_learning | 打开已有 Session / Round | 不创建第二 Session |
| continue_processing | 从现有 Checkpoint 恢复 | 不创建第二 Attempt |
| retry_current_operation | 复用既有安全重试契约 | Command / Operation 幂等 |
| return_to_entry | 返回当前产品入口 | 不改变 Owner Fact |
| none | 不提供机械动作 | 无写入 |

所有按钮在运行中禁用，完成或失败后恢复可操作终态。禁止无限自动重试。

## 十四、Internal 追踪与隐私

Internal 日志可以保存：

- Reason Code；
- Health Fact Digest；
- Error Reference；
- Surface 和 Operation；
- Content State；
- 是否允许安全重试。

不得保存：

- API Key；
- 学生答案正文；
- Material / Question 全文；
- Provider 原始输出；
- 本地绝对路径；
- UI 输入框完整内容。

普通页面的 DOM、可访问文本和浏览器 Console 不得出现内部 Reason Code 或 Error Reference。

## 十五、零写入边界

纯投射与只读浏览器验收必须证明：

```text
Formal Resource writes = 0
Session writes = 0
Attempt writes = 0
Diagnosis writes = 0
Evidence writes = 0
Profile writes = 0
Real Calibration Denominator writes = 0
Trial State writes = 0
```

用户显式执行“继续处理”或“重新尝试当前操作”时，可以调用既有正式幂等命令；这些写入属于原 Owner，不属于投射服务。验收 Fixture 不得把该类操作写入真实数据。

## 十六、工程工作分解

### WP-R2-A：Schema、分类器与 Presentation

- 冻结 Projection Schema；
- 实现 Context → Projection 纯函数；
- 实现 internal → ordinary View 映射；
- 冻结文案和主操作唯一性。

### WP-R2-B：Health Client 与 Learning Entry

- 实现 GET-only Health Client；
- 区分 unreachable / timeout / invalid / blocked；
- 接入 Unified Learning Entry；
- 修复“Runtime 未启动 = 正式任务读取失败”的混淆；
- 接入 Session / Draft Owner Fact。

### WP-R2-C：Live Learning 提交恢复

- 接入 Attempt / Checkpoint Owner Fact；
- 区分草稿、已提交待处理和身份冲突；
- 冻结继续处理幂等；
- Provider 前门禁 AI 未配置状态。

### WP-R2-D：Workbench 操作投射

- 接入读取、生成、采用、发布的依赖分类；
- 复用 Structured Runtime Error 和现有并发恢复；
- 隐藏内部错误和事务字段；
- 保持任务卡片局部恢复，不全局阻断。

### WP-R2-E：浏览器、回归与完成记录

- 自动化分类矩阵；
- Learning / Workbench Fixture 浏览器矩阵；
- 当前 Runtime 真实浏览器验收；
- 零写入、核心回归和 Build；
- 完成报告。

## 十七、建议工程文件

```text
src/ai/schemas/productRuntimeUserProjection.schema.ts
src/ai/services/productRuntimeRecoveryProjectionService.ts
src/api/productRuntimeHealthClient.ts
src/ui/productRuntimeRecoveryPresentation.ts
src/components/runtime/ProductRuntimeRecoveryNotice.jsx
src/api/productRuntimeReliabilityWPR2BrowserAcceptance.ts
src/pages/ProductRuntimeReliabilityWPR2Acceptance.jsx
src/ai/tests/runProductRuntimeReliabilityWPR2Debug.ts
src/ai/tests/runProductRuntimeReliabilityWPR2BrowserMatrixDebug.ts
```

预计修改：

```text
src/pages/UnifiedLearningEntry.jsx
src/pages/Phase163LiveLearningWorkspace.jsx
src/pages/MaterialResourceProductionWorkbench.jsx
src/api/unifiedLearningEntry.ts
src/ui/productComplexityConvergencePresentation.ts
src/App.jsx
src/pages/InternalAcceptanceHub.jsx
package.json
```

不得为了减少文件数量把 Health 请求、Owner 读取、分类决策和 JSX 文案全部塞入页面组件。

## 十八、自动化 Debug 验收矩阵

冻结 `R2-C01—R2-C40`：

| ID | 验收项 | 通过标准 |
| --- | --- | --- |
| R2-C01 | Projection Schema | 合法 v1 通过 Guard |
| R2-C02 | 未知 Schema | 未知版本拒绝 |
| R2-C03 | Surface | 仅 Learning Entry / Workspace / Workbench |
| R2-C04 | 主操作唯一 | 每个投射最多一个 primary |
| R2-C05 | 三段信息 | Situation、Preservation、Action 完整 |
| R2-C06 | Internal 隔离 | Ordinary View 不含 internal |
| R2-C07 | Health ready | 不制造故障投射 |
| R2-C08 | Runtime unreachable | runtime_unavailable，不误报 Store |
| R2-C09 | Health timeout | runtime_unavailable，允许单次重试 |
| R2-C10 | Health invalid | 保守 operation_blocked，不猜测 ready |
| R2-C11 | Store unreadable | formal_resource_unavailable |
| R2-C12 | Store uninitialized | 不创建新 Session |
| R2-C13 | Baseline inconsistent | formal_resource_unavailable，不自动修复 |
| R2-C14 | No task | no_task，不显示服务失败 |
| R2-C15 | No task precedence | Runtime / Store 正常后才允许成立 |
| R2-C16 | Session recoverable | 继续学习，不创建第二 Session |
| R2-C17 | Session mismatch | 阻断重复 Session，返回入口 |
| R2-C18 | Draft preserved | 只显示草稿已保留，不显示已提交 |
| R2-C19 | Attempt committed | 显示回答已提交 |
| R2-C20 | Submission recoverable | 继续处理，复用 Checkpoint |
| R2-C21 | Submission mismatch | 阻断重复提交，保留 Owner Fact |
| R2-C22 | AI missing before start | Provider 前阻断，不创建 Attempt |
| R2-C23 | AI unavailable before submit | 输入仍可编辑或按草稿事实保留 |
| R2-C24 | AI failure after Attempt | 显示已提交，继续处理 |
| R2-C25 | AI unchecked | 不猜测可提交 |
| R2-C26 | Trial mismatch | Ordinary 投射完全忽略 |
| R2-C27 | Trial unavailable | Learning fail-open |
| R2-C28 | Build identity insufficient | Ordinary 不显示内部身份问题 |
| R2-C29 | Workbench read failure | 当前服务未启动或资源不可读 |
| R2-C30 | Workbench AI gate | 只阻断生成 / 优化 |
| R2-C31 | Workbench adopt retry | 候选保留，可安全重试 |
| R2-C32 | Workbench publish confirmed | Owner 已发布则显示已发布 |
| R2-C33 | Workbench publish retry | 未提交则不假报成功 |
| R2-C34 | Structured Error | Error Category 映射稳定 |
| R2-C35 | English error | 普通 View 不含英文异常原文 |
| R2-C36 | Internal term filter | Revision / Registry / Command / Gate 不进入 View |
| R2-C37 | 快速重复点击 | 同一主操作只执行一次 |
| R2-C38 | Projection 幂等 | 同事实得到同投射 Digest |
| R2-C39 | 零写入 | 纯投射八类写入均为 0 |
| R2-C40 | 未知事实 | preservation=unknown，不伪造已保存 |

自动化最低门槛：`40 / 40 PASS`。

## 十九、真实浏览器验收矩阵

冻结 `R2-B01—R2-B18`：

| ID | 场景 | 通过标准 |
| --- | --- | --- |
| R2-B01 | Runtime 正常 | Learning Entry 正常显示可开始 / 可继续 |
| R2-B02 | Runtime 不可达 Fixture | 明确“学习服务尚未启动” |
| R2-B03 | Store blocked Fixture | 明确正式资源暂时不可读 |
| R2-B04 | No task Fixture | 显示暂无任务，不显示错误或重试 |
| R2-B05 | Draft Fixture | 显示草稿已保留，只出现继续学习主操作 |
| R2-B06 | Session Fixture | 刷新后继续同一 Session |
| R2-B07 | Submission Fixture | 显示回答已提交，只出现继续处理主操作 |
| R2-B08 | Submission 重复点击 | Attempt 不增加 |
| R2-B09 | AI 未配置 Entry | 不允许开始需要 AI 的新学习 |
| R2-B10 | AI 未配置 Workspace | 草稿保留，不形成 Attempt |
| R2-B11 | AI 暂时失败 | 已提交回答不回退为空白输入 |
| R2-B12 | Trial mismatch | 学生页面无 Trial、Identity 或 Reason Code |
| R2-B13 | Workbench 浏览 | AI 缺失不阻断查看与本地编辑 |
| R2-B14 | Workbench 生成 | 显示 AI 服务未配置，不泄露 Provider 错误 |
| R2-B15 | Workbench 发布恢复 | 已发布 / 可安全重试与 Owner Fact 一致 |
| R2-B16 | 内部术语 | Learning / Workbench DOM 与 Console 无内部术语 |
| R2-B17 | PC / Tablet | 主要状态、preservation 和主操作均可见 |
| R2-B18 | 前后不可变 | Fixture 浏览器验收八类真实写入均为 0 |

浏览器最低门槛：`18 / 18 PASS`。

真实 Runtime 不能为了制造故障而停止未知服务。不可达、Store 损坏、身份冲突和 Provider 失败使用隔离 Fixture；当前真实 Runtime 只执行只读和安全 UI 验收。

## 二十、回归矩阵

WP-R2 至少回归：

- WP-R0 Debug 与 Browser Matrix；
- WP-R1 Debug、Launcher 与 Browser Matrix；
- Structured Runtime Error；
- Question Workbench Presentation State；
- Material Resource Workbench State；
- Unified Learning Entry；
- Learning Session Task Queue；
- Phase 16.3 Diagnosis Boundary；
- Phase 16.3 Day 0 Integration；
- Learning Feedback Presentation；
- Product Complexity Convergence Stage 1；
- Product Complexity Convergence Stage 4；
- Real Trial Preflight；
- Production Build。

## 二十一、工程命令

工程完成后建议增加：

```json
{
  "debug:product-runtime-reliability-wp-r2":
    "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runProductRuntimeReliabilityWPR2Debug.ts",
  "debug:product-runtime-reliability-wp-r2-browser-matrix":
    "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runProductRuntimeReliabilityWPR2BrowserMatrixDebug.ts"
}
```

建议 Internal 验收路由：

```text
#/internal/acceptance/product-runtime-reliability-wp-r2
```

## 二十二、Debug 执行顺序

1. Schema 与纯函数 Projection；
2. Health Client 四种读取结果；
3. Learning Entry Fixture；
4. Session / Draft / Submission Owner Fact Fixture；
5. Live Learning AI 门禁与继续处理；
6. Workbench 读取 / 生成 / 采用 / 发布 Fixture；
7. Internal Term Filter；
8. R2-C 40 项；
9. R2-B 18 项；
10. 当前 Runtime 真实浏览器只读走查；
11. 核心回归和 Production Build；
12. 零写入和完成报告。

任一步出现重复 Attempt、第二 Session、自动发布、Trial 写入、正文泄露或普通页面显示内部术语，立即停止 WP-R2。

## 二十三、报告产物

工程完成后输出：

```text
docs/education/phase/reports/
product_runtime_reliability_wp_r2_failure_recovery_debug_browser_acceptance_YYYY-MM-DD.md
```

报告至少包含：

1. Git 与 Worktree；
2. Projection Schema 与文案版本；
3. Reason → Projection 映射；
4. Learning Entry 场景结果；
5. Draft / Session / Submission preservation 结果；
6. Workbench 操作场景结果；
7. Internal Term Filter；
8. R2-C 与 R2-B；
9. 核心回归和 Build；
10. 八类零写入；
11. 已知遗留和后续路由；
12. 明确声明 Trial 未重新准入。

## 二十四、回滚契约

WP-R2 必须可独立回滚：

- 移除 Projection Schema、Service、Health Client 和 Recovery Notice；
- 恢复 Unified Entry、Workspace 和 Workbench 的上一个普通投射；
- 移除 WP-R2 Internal Acceptance；
- 保留 WP-R0 Reason Registry 与 WP-R1 Launcher / Health；
- 不回滚 Store Revision；
- 不删除 Session、Attempt、Checkpoint、Evidence、Profile 或 Trial 历史；
- 不通过清理浏览器存储完成回滚。

## 二十五、完成门槛

WP-R2 只有同时满足以下条件才可完成：

1. Projection Schema 冻结；
2. Health Client 准确区分 available / unreachable / timeout / invalid；
3. Runtime、Store、无任务、Session、Submission 和 AI 独立分类；
4. 所有普通故障包含 Situation、Preservation 和单一主操作；
5. preservation 只来自 Owner Fact；
6. Runtime 未启动不再伪装成正式任务读取失败；
7. no task 不再伪装成服务故障；
8. 草稿与已提交 Attempt 文案不混淆；
9. Submission 恢复不重复创建 Attempt；
10. Session 恢复不创建第二 Session；
11. AI 故障只阻断依赖 AI 的动作；
12. Workbench 局部错误不全局阻断；
13. 已发布和可安全重试与 Owner Fact 一致；
14. Trial / Identity / Reason Code 不进入普通页面；
15. R2-C01—R2-C40 为 `40 / 40 PASS`；
16. R2-B01—R2-B18 为 `18 / 18 PASS`；
17. 核心回归通过；
18. Production Build 通过；
19. 八类未授权写入均为 0；
20. 执行报告完成；
21. 未提前实现 WP-R3—WP-R6。

## 二十六、后续工作包边界

WP-R2 完成后：

- WP-R3 继续独立实现内容寻址 Product Runtime Identity 和 Trial 自动失效；
- WP-R4 必须等待 WP-R3，通过重新准入后才能激活 Trial；
- WP-R5 只有在 WP-R2 与 WP-R4 均完成后，才能执行完整真实学习烟测；
- WP-R6 继续负责历史固定断言、性能提示和最终收口。

WP-R2 本身不授权真实 Trial，不授权制造真实 Attempt 作为验收数据。

## 二十七、冻结结论

`product_runtime_reliability_wp_r2_v1` 冻结以下事实：

1. Runtime、Store、无任务、Session、Submission、AI 和 Trial 是不同状态；
2. 普通故障必须回答发生了什么、内容是否保留、下一步动作；
3. 内容保留结论只能来自 Owner Fact；
4. 一个用户意图只对应一个主操作；
5. Runtime 不可达不得伪装成正式资源或无任务；
6. no task 是业务空状态，不提供机械重试；
7. 草稿存在不等于 Attempt 已提交；
8. Attempt 已提交后恢复不得重复提交；
9. Session 恢复不得创建第二 Session；
10. AI 故障只影响需要 AI 的动作；
11. Trial 失败对普通 Learning fail-open 且不展示；
12. Workbench 故障保持操作级局部恢复；
13. 已发布状态必须服从正式 Owner Fact；
14. 内部代码、身份、Revision 和事务阶段不进入普通页面；
15. 投射服务只读，不建立第二事实 Owner；
16. WP-R2 完成不表示 Trial 已重新准入，也不表示教育效果成立。

## 二十八、2026-08-25 工程执行结果

| 验收域 | 结果 |
| --- | --- |
| R2-C01—R2-C40 | `40 / 40 PASS` |
| R2-B01—R2-B18 自动化矩阵 | `18 / 18 PASS` |
| R2-B01—R2-B18 真实浏览器 | `18 / 18 PASS`，正式资源 Revision `1963` |
| WP-R0 / WP-R1 回归 | `32 / 32`、`12 / 12`、`36 / 36`、`14 / 14` |
| 核心专项回归 | `15 / 15` 个脚本通过 |
| Production Build | `PASS` |
| 八类未授权写入 | Formal、Session、Attempt、Evidence、Profile、Calibration、Trial、Workbench 均为 `0` |

已实现：

- 版本化 `product_runtime_user_projection_v1`、稳定 Projection Digest 与 Schema Guard；
- GET-only Health Client，区分 available / unreachable / timeout / invalid；
- Runtime、正式资源、无任务、Session、Submission、AI 与操作失败分类器；
- 三段式普通用户 Recovery Notice 和内部字段隔离；
- Unified Learning Entry 与 Live Learning 的健康门禁、Session / Submission 恢复；
- Workbench 普通错误文案净化，保留既有 AI 操作级门禁；
- 单飞动作工具，快速重复点击只共享一次正式调用；
- Internal R2 验收路由和只读浏览器矩阵。

当前真实 Runtime 的 AI 状态仍为 `not_configured`，因此新建或提交需要 AI 的操作被准确门禁；已有 Session 可继续打开。Trial 仍为 fail-open / effective off，WP-R2 没有重新准入 Trial，也没有生成真实学习事件。

本文档现已达到 `ENGINEERING COMPLETE / DEBUG ACCEPTED / BROWSER ACCEPTED / WP-R2 COMPLETE`。后续按主契约进入 WP-R3；不得将 WP-R2 完成解释为 Trial 已重新准入或教育效果已成立。
