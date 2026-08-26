# 产品运行可靠性与真实 Trial 重新准入契约

英文名称：Product Runtime Reliability and Real Trial Re-entry Contract

契约版本：`product_runtime_reliability_and_real_trial_reentry_v1`

状态：`DESIGN BASELINE / WP-R0—R4 ENGINEERING COMPLETE / REAL TRIAL REMAINS OFF / WP-R5 AUTHORIZED`

日期：2026-08-25

关联文档：

- [WP-R0 运行基线、Reason Code 与只读审计工程实施及 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R0_BASELINE_ENGINEERING_AND_DEBUG_PLAN.md)
- [WP-R1 统一启动器与 Runtime Health 工程实施及 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R1_LAUNCHER_AND_HEALTH_ENGINEERING_AND_DEBUG_PLAN.md)
- [WP-R2 Learning / Workbench 故障分类与恢复投射工程实施及 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R2_FAILURE_CLASSIFICATION_AND_RECOVERY_PROJECTION_ENGINEERING_AND_DEBUG_PLAN.md)
- [WP-R3 Product Runtime Identity 与 Trial 自动失效工程实施及 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R3_RUNTIME_IDENTITY_AND_TRIAL_INVALIDATION_ENGINEERING_AND_DEBUG_PLAN.md)
- [WP-R4 Trial 重新准入工程实施与 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R4_TRIAL_REENTRY_ENGINEERING_AND_DEBUG_PLAN.md)
- [WP-R3 Runtime Identity、Trial 自动失效与浏览器验收记录](../education/phase/reports/product_runtime_reliability_wp_r3_runtime_identity_debug_browser_acceptance_2026-08-26.md)
- [WP-R0 基线、Debug 与浏览器只读验收记录](../education/phase/reports/product_runtime_reliability_wp_r0_baseline_debug_browser_acceptance_2026-08-25.md)
- [WP-R1 启动器、Health、Debug 与浏览器验收记录](../education/phase/reports/product_runtime_reliability_wp_r1_launcher_health_debug_browser_acceptance_2026-08-25.md)
- [产品复杂度收口总契约](./PRODUCT_COMPLEXITY_CONVERGENCE_CONTRACT.md)
- [真实 Trial Window 启动与运行验收契约](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_REAL_TRIAL_WINDOW_OPERATION_AND_ACCEPTANCE_CONTRACT.md)
- [真实 Trial 启动前工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_REAL_TRIAL_PREFLIGHT_ENGINEERING_AND_DEBUG_PLAN.md)
- [学生产品界面收口契约](./STUDENT_PRODUCT_INTERFACE_CONSOLIDATION.md)
- [正式资源生产契约图](./FORMAL_RESOURCE_PRODUCTION_CONTRACT_MAP.md)
- [真实 Trial 激活签署与执行记录](../education/phase/reports/product_complexity_convergence_real_trial_activation_signoff_2026-08-25.md)

## 一、文档目的

本契约冻结产品从“工程能力已经具备”进入“本地真实 Learning 可以稳定运行”所需的运行边界，统一规定：

1. 本地服务启动与停止；
2. 运行依赖和健康状态；
3. Learning、录入工作台、正式资源服务与 AI 服务之间的可用性关系；
4. 普通用户错误提示与内部错误分类；
5. Git、构建、源码、Registry 与策略身份；
6. 代码变化后的真实 Trial 自动失效与重新准入；
7. 完整真实学习烟测；
8. 最小学习采集链；
9. 失败恢复、回滚、隐私和禁止写入边界；
10. 后续工程工作包和统一完成定义。

本契约不重新设计 Material、Plan、Task、Candidate、Publish 或 Learning，也不新增 Training Model 能力。它解决的是：

> 产品已经具备完整能力时，如何确保服务能够被可靠启动、故障能够被准确识别、真实运行身份能够被证明、一次真实学习能够被完整验证。

## 二、当前基线与问题声明

### 2.1 当前工程与数据基线

截至 2026-08-25，本地权威基线为：

- Git HEAD：`4d016c6`；
- Shared Formal Resource Store Revision：`1963`；
- 活动材料：`24`，其中核心阅读材料 `12`、Targeted Excerpt `12`；
- Current Head：`81`；
- Active Registry / Active Observation Link / Frozen Quality Trace / Learning 可消费：`81 / 81 / 81 / 81`；
- 最新质量准入：`ready 65 / ready_with_guidance 16 / blocked 0`；
- Product Complexity Convergence Stage 4：`64 / 64 PASS`；
- Real Trial Preflight：`56 / 56 PASS`；
- Unified Learning Entry：`27 / 27 PASS`；
- Phase 16.3 Day 0 Integration：`15 / 15 PASS`；
- Learning Session Task Queue：`21 / 21 PASS`；
- Material Resource Workbench State：`25 / 25 PASS`；
- Production Build：`PASS`，保留既有 Chunk Size 与混合静态、动态导入提示。

上述事实证明核心业务链和测试链已经具备工程基础，但不自动证明当前本地运行实例可用。

### 2.2 当前运行问题

当前浏览器 Learning 入口实际投射为：

```text
暂时无法打开学习入口
正式任务暂时无法读取，请重新尝试。
```

已确认现场原因是本地 `5174` 服务没有处于可连接状态，正式资源边界无法读取。该问题不表示 Shared Formal Resource Store 损坏，但说明：

1. 产品缺少统一、可验证的启动入口；
2. 页面未把“运行服务未启动”和“正式资源数据读取失败”充分区分；
3. 自动化通过与当前实例可运行之间仍缺少运行验收层；
4. 真实 Learning 开始前缺少一次统一健康检查。

### 2.3 当前 Trial 身份问题

现有真实 Trial 激活记录冻结于：

- Git Commit：`119a019da59e7835bd01fbacf2604b5a9b687e34`；
- Build Version：`product-complexity-convergence-preflight-build-v1`；
- 激活时运行源码指纹：`14125882a782edd4489414f2e4c3bb26c03ce634f84897a91720d81643ef520b`。

当前 Git HEAD 已变化为 `4d016c6`，而运行时代码仍使用固定 Build Version 字符串。根据真实 Trial 上位契约，源码、构建、Registry 或策略发生实质变化时，旧 Window 不得继续无条件接收真实分母。

因此本契约冻结：

> 当前代码重新进入真实 Trial 前，必须重新生成可验证的运行身份、重新执行 Preflight，并形成新的重新准入记录。旧激活记录只能解释原构建，不自动批准当前构建。

## 三、范围与非目标

### 3.1 本轮范围

本轮只允许建设：

- 本地统一启动器；
- 只读运行健康接口；
- 启动前依赖检查；
- Learning 与 Workbench 的故障分类和恢复投射；
- 运行身份生成与验证；
- Trial 重新准入控制；
- 完整真实学习烟测；
- 最小事件链验收；
- 内部只读运行状态页；
- 旧固定基线测试收口；
- 相应 Debug、浏览器验收和最终执行记录。

### 3.2 本轮非目标

本轮禁止借机执行：

- 新增学习能力；
- 重构 Material → Publish → Learning 主链；
- 建立第二套正式资源服务；
- 建立第二套 Session、Attempt、Diagnosis、Evidence 或 Profile；
- 批量改写 Frozen Resource；
- 为获得样本放宽 Revision、Targeted、Retest 或 Transfer 触发条件；
- 自动调整学生能力或正式题质量结论；
- 将本地单人运行直接扩展为多用户系统；
- 将 Debug、Fixture、Demo 或 Browser Acceptance 事件写入真实分母；
- 以运行优化为名删除历史事实或降低身份校验标准。

## 四、核心原则

### 4.1 工程通过不等于运行可用

测试、Build 和浏览器验收是准入证据，不是当前实例可用性的替代品。真实学习开始前必须重新确认实际运行健康。

### 4.2 一个正式事实只有一个 Owner

- 正式资源由 Shared Formal Resource Store 负责；
- 学习会话由 Learning Session Repository 负责；
- 作答由 Attempt / Persistence 链负责；
- 诊断由正式 Diagnosis Owner 负责；
- Evidence 与 Profile 继续使用既有正式链；
- Trial Observation 只读观察 Owner Fact，不成为业务事实来源。

健康检查和运行状态页不得建立新的写入 Owner。

### 4.3 启动失败必须早失败

端口、运行时、资源文件、正式资源边界或必要配置不满足时，应在进入真实学习前给出明确结论，不允许学生完成作答后才暴露基础服务缺失。

### 4.4 错误必须回答三个问题

普通用户错误投射至少说明：

1. 当前发生了什么；
2. 已完成内容是否保留；
3. 现在可以执行什么操作。

内部错误码保留在日志和 Internal 页面，不直接作为学生文案。

### 4.5 运行身份必须来自实际构建

固定字符串不能单独证明运行身份。当前构建必须能够与 Git Commit、源码指纹、Registry 和策略快照建立一致关系。

### 4.6 观察失败不得阻断学习

Trial、Telemetry、Aggregate 或内部状态页失败时，Learning 主链继续 fail-open。正式资源服务、Session 或正式提交失败时必须 fail-closed，并保留已完成事实。

### 4.7 恢复工作，不让用户管理事务

用户只看到重试、继续、恢复当前学习或返回入口。Revision、Command ID、Outbox、Registry、Store Revision 和内部恢复阶段不进入普通界面。

## 五、运行拓扑与责任边界

当前本地产品的最小运行拓扑冻结为：

```text
统一启动器
  ↓
Vite Runtime :5174
  ├─ Learning / Workbench 前端
  ├─ Shared Formal Resource Boundary
  ├─ Diagnosis Boundary
  ├─ Question / Rubric / Quality Boundary
  └─ Runtime Health Boundary

浏览器本地持久化
  ├─ Learning Session
  ├─ Learning Persistence / Attempt
  ├─ Operation Checkpoint
  └─ Trial Observation（与正式事实隔离）

文件正式资源
  └─ .local-data/formal-resource-store.json
```

本轮不拆分独立后端服务，但必须明确：

- `5174` 进程既承载前端，也承载当前本地 Runtime Boundary；
- 只打开旧浏览器页面不代表 Runtime 仍在运行；
- Vite HMR 连接失败不能单独作为正式资源不可用结论；
- Shared Formal Resource Boundary 必须通过实际请求验证；
- AI Provider 可用性与正式资源可读性必须分别判断。

## 六、统一启动契约

### 6.1 启动入口

工程实现应提供一个项目内、可版本化的统一启动命令。用户不需要手工拼接 Node 路径、Vite 参数、端口和环境变量。

启动器职责仅限：

1. 解析项目根目录；
2. 检查受支持的 Node Runtime；
3. 检查依赖是否存在；
4. 检查 `5174` 端口；
5. 检查正式资源文件可读；
6. 检查必要环境配置，但不输出密钥；
7. 启动当前项目的 Vite Runtime；
8. 等待健康接口达到可用终态；
9. 输出 Learning、Workbench 和 Internal Health 的明确地址。

### 6.2 端口规则

- 产品本地标准端口保持 `5174`；
- 默认只监听 `127.0.0.1`，不得因本地启动而自动向局域网暴露产品；
- 未来远程试用必须通过独立网络部署契约显式开放，不复用本地启动器的默认安全边界；
- 标准启动不得静默切换到其他端口；
- 端口已被本项目健康实例占用时，返回“已经运行”及入口地址；
- 端口被未知或不健康进程占用时，启动失败并提示处理方式；
- 启动器不得擅自终止未知进程；
- 任何终止、替换或清理进程的动作必须由用户显式执行。

### 6.3 配置规则

- `DEEPSEEK_API_KEY` 或等价 Provider 凭证只检查“存在且非空”，不得输出具体内容；
- AI Provider 未配置时，必须区分“只读浏览/非 AI 功能可用”和“正式诊断或生成不可用”；
- 正式资源读取不依赖 AI Provider；
- Learning 是否允许开始由当前任务的正式依赖决定，不能因为未使用到的 AI 功能缺失而误阻断整个入口；
- 开始会产生 AI Diagnosis 的真实学习前，必须明确 AI Provider 可用或提供准确阻断说明。
- “凭证已配置”只允许表示操作具备尝试条件，不等于 Provider 已完成实时可达性验证；
- 真实 Trial 准入必须额外满足 `availabilityVerified=true` 与 `trialEligible=true`，不得以 `configuration_only` 代替。

### 6.4 启动终态

启动器只能输出以下终态之一：

```text
READY
ALREADY_RUNNING
BLOCKED_RUNTIME_MISSING
BLOCKED_DEPENDENCY_MISSING
BLOCKED_PORT_CONFLICT
BLOCKED_FORMAL_STORE_UNREADABLE
BLOCKED_HEALTH_TIMEOUT
```

禁止以“命令已经执行”代替服务已就绪。

## 七、运行健康模型

### 7.1 健康接口

工程实现应增加只读接口：

```text
GET /__runtime/health
```

接口不得修改文件、浏览器存储、正式资源、Attempt、Evidence、Profile 或 Trial Observation。

### 7.2 健康响应

推荐冻结以下最小投影：

```ts
type ProductRuntimeHealth = {
  schemaVersion: 'product_runtime_health_v1';
  checkedAt: string;
  overallStatus: 'ready' | 'degraded' | 'blocked';
  runtime: {
    status: 'ready' | 'blocked';
    port: 5174;
    buildIdentity: string;
  };
  formalResourceStore: {
    status: 'ready' | 'blocked';
    revision?: number;
    activeMaterialCount?: number;
    currentQuestionCount?: number;
    learningConsumableQuestionCount?: number;
    reasonCode?: string;
  };
  aiProvider: {
    status: 'configured' | 'not_configured' | 'unreachable' | 'not_checked';
    providerId?: string;
    reasonCode?: string;
  };
  learning: {
    status: 'ready' | 'degraded' | 'blocked';
    reasonCode?: string;
  };
  trial: {
    requestedMode: 'off' | 'isolated_acceptance' | 'real_trial';
    effectiveMode: 'off' | 'isolated_acceptance' | 'real_trial';
    identityAligned: boolean;
    reasonCode?: string;
  };
};
```

### 7.3 状态聚合

`overallStatus` 规则：

- `blocked`：Runtime 或 Shared Formal Resource Store 不可用；
- `degraded`：核心只读入口可用，但 AI Provider、Trial 或非核心能力不可用；
- `ready`：核心 Learning 所需运行依赖均通过；
- Trial 为 `off` 本身不是产品故障；
- 没有可匹配任务属于业务空状态，不等于 Runtime 不健康；
- AI Provider 未配置是否阻断 Learning，应依据当前学习路径是否需要实时 AI，而不是统一判定。

### 7.4 数据暴露边界

健康接口只允许输出：

- 状态；
- 版本；
- 数量；
- Hash 或不含内容的身份摘要；
- 结构化 Reason Code；
- 检查时间。

禁止输出：

- API Key；
- 学生答案；
- Material 或 Question 正文；
- 模型原始输出；
- 本地绝对用户目录；
- 可重建学生内容的调试上下文。

## 八、故障分类与普通页面投射

### 8.1 内部故障分类

内部 Reason Code 至少覆盖：

| 分类 | Reason Code | 含义 |
| --- | --- | --- |
| Runtime | `runtime_unreachable` | 本地 Runtime 未运行或不可连接 |
| Runtime | `runtime_health_timeout` | Runtime 已连接但健康检查超时 |
| Formal Store | `formal_store_unreadable` | 正式资源文件不能读取或解析 |
| Formal Store | `formal_store_uninitialized` | 正式资源库尚未初始化 |
| Formal Store | `formal_resource_boundary_unavailable` | 正式资源边界不可用 |
| Task | `no_learning_task_available` | 当前没有可匹配任务 |
| Task | `task_identity_mismatch` | 任务与正式版本身份不一致 |
| Session | `learning_session_recovery_required` | 存在可恢复的活动学习 |
| Submission | `submission_recovery_required` | 正式提交处于可恢复阶段 |
| AI | `ai_provider_not_configured` | 当前所需 AI Provider 未配置 |
| AI | `ai_provider_unreachable` | Provider 已配置但不可访问 |
| Trial | `trial_identity_mismatch` | Trial 与当前构建身份不一致 |
| Trial | `trial_observation_unavailable` | 观察旁路不可用，不阻断学习 |

### 8.2 Learning 普通投射

| 内部状态 | 学生页面说明 | 主要动作 | 已完成内容 |
| --- | --- | --- | --- |
| Runtime 不可达 | 学习服务尚未启动，请启动后重试 | `重新尝试` | 明确说明本地草稿是否保留 |
| 正式资源不可读 | 正式学习任务暂时无法读取 | `重新尝试` | 不创建新 Session |
| 无匹配任务 | 当前暂时没有可开始的学习任务 | 无或返回入口 | 不误报服务失败 |
| AI 未配置 | 当前学习反馈服务尚未配置 | 返回或配置后重试 | 已提交事实不得丢失 |
| AI 暂时失败 | 回答已经保留，反馈暂时未完成 | `继续处理` | 明确回答已经保留 |
| Session 可恢复 | 上次学习进度已经保留 | `继续学习` | 不创建第二个活动 Session |
| Submission 可恢复 | 回答已经提交，正在继续处理 | `继续处理` | 不允许重复形成 Attempt |
| Trial 失效 | 普通页面不展示 Trial 故障 | 正常学习 | Observation 安全回落 `off` |

### 8.3 Workbench 普通投射

Workbench 继续只展示用户可执行状态：

- 可以生成；
- 正在生成；
- 可以发布；
- 正在发布；
- 已发布；
- 可以安全重试；
- 当前服务未启动；
- AI 服务未配置。

不得直接展示 Store Revision、Command ID、Registry、Hash、Gate 或内部并发阶段。

## 九、运行身份契约

### 9.1 身份组成

每次可进入真实 Trial 的运行构建必须冻结：

```ts
type ProductRuntimeIdentity = {
  schemaVersion: 'product_runtime_identity_v1';
  gitCommit: string;
  worktreeState: 'clean' | 'dirty';
  sourceFingerprint: string;
  buildVersion: string;
  buildArtifactFingerprint: string;
  registryVersion: string;
  registryHash: string;
  observationPolicyVersion: string;
  observationPolicyHash: string;
  decisionPolicyVersion: string;
  decisionPolicyHash: string;
  formalStoreRevision: number;
  generatedAt: string;
};
```

### 9.2 Build Version 规则

- Build Version 必须由工程生成，不能仅使用长期不变的手工常量；
- 至少能够唯一关联 Git Commit 和构建产物指纹；
- Dirty Worktree 可以用于隔离验收，但不得被描述为已提交生产版本；
- Dirty Worktree 如需进入封闭真实 Trial，必须冻结源码指纹并在任何变化时失效；
- 同一 Build Version 不得对应两个不同源码或构建产物；
- Build Identity 生成不得写入正式教育事实。

### 9.3 身份变化规则

以下任一项变化时，活动 Trial 必须安全回落 `off`：

- Git Commit；
- Source Fingerprint；
- Build Artifact Fingerprint；
- Registry Hash；
- Observation Policy Hash；
- Decision Policy Hash；
- 已批准的 Owner Schema 清单；
- 影响真实学习或 Observation 语义的 Feature Flag。

Formal Store Revision 自然增加时，不机械使 Trial 失效，但必须满足：

- 新资源仍通过正式准入；
- Session Snapshot 不被中途替换；
- 观察 Registry 与 Owner Schema 未改变；
- 变化被记录在运行巡检中。

若资源变化改变题目质量策略、匹配语义或观察口径，应关闭旧 Window 并重新准入。

## 十、真实 Trial 重新准入

### 10.1 重新准入触发条件

出现以下任一事实时必须重新准入：

- 当前 Git Commit 与 Launch Record 不一致；
- Build Identity 无法证明与当前产物一致；
- 服务曾以未知源码或未知工作树运行；
- Registry、Policy 或 Owner Schema 发生变化；
- 存在未解决 P0 / P1；
- 旧 Window 已关闭、失效或超出时间范围；
- 无法证明当前 Observation Event 属于同一运行身份。

### 10.2 重新准入顺序

```text
1. requestedMode → off
2. 验证 Learning 核心主链仍可独立运行
3. 生成当前 ProductRuntimeIdentity
4. 执行正式资源、Session、提交、反馈与采集回归
5. 执行完整真实学习烟测
6. 保存不可变 Re-entry Preflight Report
7. 保存 approved_to_activate Launch Record
8. 创建新的 Trial Window 或按上位契约确认旧 Window 不可复用
9. 显式激活 real_trial
10. 重新读取并确认 effectiveMode = real_trial
11. 第一条 Observation 等待真实 Owner Fact，不制造测试事件
```

### 10.3 旧事件边界

- 旧 Window 事件保持只读；
- 不把旧事件重新标记为当前构建事件；
- 无法证明构建身份的事件不得进入新的真实分母；
- 新旧 Window 不静默合并；
- 报告必须分别披露每个 Window 的运行身份和样本状态。

## 十一、完整真实学习烟测

### 11.1 烟测目的

真实烟测验证当前实例和真实正式资源，不以 Fixture、内存 Repository 或 Demo Resource 替代。

### 11.2 最小链路

```text
Runtime Health = ready
→ 读取 Shared Formal Resource Store
→ 进入 Unified Learning Entry
→ 匹配 Current Frozen Resource
→ 创建或恢复唯一活动 Session
→ 创建 Round 与固定任务队列
→ question_presented
→ 提交有效回答
→ answer_submitted
→ diagnosis_completed
→ feedback_presented
→ 下一题或 learning_round_completed
→ 刷新页面并验证恢复
```

### 11.3 必须检查的失败分支

- 空回答；
- 字数不足；
- 大段复制材料；
- 只复制原文片段；
- 明显语义无关输入；
- 重复提交；
- AI Provider 暂时失败；
- 正式资源在开始前变化；
- 已开始 Session 绑定旧版本；
- 页面刷新；
- Observation Repository 失败。

### 11.4 烟测数据边界

工程烟测不得进入真实 Trial 分母。使用真实学生执行正式烟测时，只有在新的 Trial Window 已完成重新准入后，才允许把自然产生的 Owner Fact作为真实事件。

禁止为了验收制造虚假的学生能力改善、Evidence 或 Profile。

## 十二、最小采集链验收

### 12.1 必需事件

真实 Learning 最小采集链保持为：

```text
question_presented
answer_submitted
diagnosis_completed
feedback_presented
learning_round_completed
```

### 12.2 事件身份

每个事件必须能够稳定关联：

- `studentId`；
- `learningSessionId`；
- `learningRoundId`；
- `taskId`；
- `resourceId`；
- `resourceVersionId`；
- `attemptId`，仅在相应生命周期存在时；
- `eventId`；
- `occurredAt`；
- Schema Version；
- Data Origin 与 Runtime Scope。

### 12.3 顺序与幂等

- 重复页面呈现不能形成不可解释的重复分母；
- 重复提交不得形成第二个正式 Attempt；
- Diagnosis 重试复用原正式输入；
- Feedback 必须引用已完成 Diagnosis；
- Round Completed 必须引用该 Round 的正式完成事实；
- 允许恢复缺失旁路事件，但不得补造正式事实；
- `answer_submitted` 到 `AnonymousQuestionCalibrationAttempt` 的转换保持幂等并披露转换失败。

## 十三、内部运行状态页

本轮允许新增一个只读 Internal 页面，用于展示：

- 当前 Product Runtime Health；
- Product Runtime Identity；
- Shared Store Revision 和正式数量；
- 当前 Learning Session / Round 的结构化状态；
- 最近一次正式操作阶段；
- 最小事件链数量与缺口；
- AI Provider 配置状态和结构化失败类型；
- Trial requested / effective Mode；
- Window、Registry、Policy 与 Build 是否一致；
- 最近可恢复错误数量；
- 最近 P0 / P1 状态。

页面不得：

- 激活 Trial；
- 修改 Feature Flag；
- 编辑正式资源；
- 删除或重放正式 Attempt；
- 展示学生答案、材料正文、题目正文或模型原始输出；
- 以绿色状态替代真实烟测证据。

## 十四、失败恢复与回滚

### 14.1 Runtime 失败

- Runtime 未启动时不创建 Session；
- 启动超时后保持现有浏览器数据不变；
- 重启后重新执行 Health，再允许继续；
- 不通过清除浏览器存储解决普通启动问题。

### 14.2 正式资源失败

- 读取失败不返回空资源成功态；
- 解析失败不得自动重建或覆盖正式库；
- 备份恢复继续使用现有正式恢复契约；
- 恢复动作必须显式、可审计，并与普通重试区分。

### 14.3 AI Provider 失败

- Provider 前输入门禁继续生效；
- 已保存的回答不重复形成 Attempt；
- 不生成 Mock Diagnosis、Mock Evidence 或虚假反馈；
- 恢复后从正式 Checkpoint 继续；
- Provider 错误不得泄漏 API Key 或原始敏感响应。

### 14.4 Trial 失败

- Trial 身份不一致时立即 effectiveMode → `off`；
- Learning 继续运行；
- 不删除旧 Observation；
- 不把失效期间事件补入真实分母；
- 修复后重新执行 Preflight，创建新的准入记录。

### 14.5 工程回滚

每个运行可靠性工作包必须可独立回滚。回滚不得：

- 回滚正式资源版本；
- 删除 Attempt、Evidence 或 Profile；
- 修改已开始 Session 的资源快照；
- 复用已经失效的 Trial Window；
- 将旧 Build Identity 冒充当前构建。

## 十五、隐私与安全边界

- 启动日志不得输出 API Key；
- Health 与 Internal 页面不得输出学生答案；
- 错误栈只允许在内部开发日志出现；
- 普通页面只展示可行动说明；
- 运行身份 Hash 不包含密钥或学生内容；
- Observation 继续禁止保存材料、题目、答案和模型自由文本；
- 本轮不新增网络上传、账号、远程日志或外部监控；
- 引入任何远程监控必须另立数据、权限、保留期和用户授权契约。

## 十六、验收总线

### 16.1 启动与健康 RH-A01—RH-A12

| ID | 验收项 | 通过标准 |
| --- | --- | --- |
| RH-A01 | 统一启动入口 | 单一项目命令可以启动当前 Runtime |
| RH-A02 | 项目根目录 | 从受支持入口启动时解析到同一工作区 |
| RH-A03 | Node Runtime | 缺失时早失败并给出明确说明 |
| RH-A04 | 端口空闲 | 正常启动到固定 `5174` |
| RH-A05 | 已运行实例 | 健康实例返回 `ALREADY_RUNNING` |
| RH-A06 | 未知端口占用 | 不终止未知进程，返回明确阻断 |
| RH-A07 | 正式资源检查 | 返回执行时真实 Revision、材料数、当前题数与可消费题数 |
| RH-A08 | 密钥保护 | 只显示配置状态，不显示值 |
| RH-A09 | Health 只读 | 五类正式写入计数均为 0 |
| RH-A10 | 健康聚合 | ready / degraded / blocked 语义稳定 |
| RH-A11 | 启动超时 | 收敛到明确终态，不永久等待 |
| RH-A12 | 重复启动 | 幂等且不创建第二个 Runtime |

数量验收必须从执行时权威基线读取；表中的 `24 / 81 / 81` 是当前基线证据，不得写成长期硬编码断言。

### 16.2 故障与恢复 RH-F01—RH-F12

| ID | 验收项 | 通过标准 |
| --- | --- | --- |
| RH-F01 | Runtime 不可达 | Learning 明确说明服务未启动 |
| RH-F02 | Store 不可读 | 不误报无任务，不创建 Session |
| RH-F03 | 无匹配任务 | 不误报服务失败 |
| RH-F04 | AI 未配置 | 准确说明影响范围 |
| RH-F05 | AI 暂时失败 | 已提交回答保留，可继续处理 |
| RH-F06 | Session 恢复 | 不创建第二个活动 Session |
| RH-F07 | Submission 恢复 | 不重复形成 Attempt |
| RH-F08 | Trial 身份失效 | Observation 关闭，Learning 不阻断 |
| RH-F09 | 普通错误文案 | 不暴露内部状态码和技术栈 |
| RH-F10 | 内部诊断 | Reason Code、阶段和恢复出口完整 |
| RH-F11 | 页面刷新 | 当前正式进度可恢复 |
| RH-F12 | 数据安全 | 故障和恢复不修改历史正式事实 |

### 16.3 运行身份与重新准入 RH-I01—RH-I14

| ID | 验收项 | 通过标准 |
| --- | --- | --- |
| RH-I01 | Git Identity | 当前 Commit 可追溯 |
| RH-I02 | Dirty State | 不冒充 Clean Build |
| RH-I03 | Source Fingerprint | 同源码稳定、源码变化必变 |
| RH-I04 | Artifact Fingerprint | 同产物稳定、产物变化必变 |
| RH-I05 | Build Version | 不再是无法区分源码的长期常量 |
| RH-I06 | Registry Identity | Version 与 Hash 一致 |
| RH-I07 | Policy Identity | Observation / Decision Hash 一致 |
| RH-I08 | Commit 变化 | 旧 Trial 自动回落 `off` |
| RH-I09 | Source 变化 | 旧 Trial 自动回落 `off` |
| RH-I10 | Registry / Policy 变化 | 旧 Trial 自动回落 `off` |
| RH-I11 | 旧事件隔离 | 不重新标记为新构建事件 |
| RH-I12 | Preflight | 当前构建全部检查通过 |
| RH-I13 | Launch Record | 身份完整且 unresolvedIssues 为空 |
| RH-I14 | 第一条事件 | 来自重新准入后的真实 Owner Fact |

### 16.4 真实学习烟测 RH-L01—RH-L16

| ID | 验收项 | 通过标准 |
| --- | --- | --- |
| RH-L01 | Unified Entry | 实际正式入口可打开 |
| RH-L02 | Formal Match | 匹配 Current Frozen Resource |
| RH-L03 | Session | 只形成一个活动 Session |
| RH-L04 | Queue | 固定任务队列可追溯 |
| RH-L05 | Presented | 形成可解释呈现事实 |
| RH-L06 | Valid Answer | 有效回答进入正式提交 |
| RH-L07 | Invalid Answer | Provider 前阻断且不形成 Evidence |
| RH-L08 | Attempt Idempotency | 重复提交不重复形成 Attempt |
| RH-L09 | Diagnosis | 正式 Diagnosis 完成并可恢复 |
| RH-L10 | Feedback | 引用同一主要缺口 |
| RH-L11 | Next Task | 下一条 Session Frozen Resource 实际匹配并通过执行门禁后，才投射继续入口；仅有队列位置不得视为可进入 |
| RH-L12 | Round Complete | 完成事实只形成一次 |
| RH-L13 | Refresh Recovery | 刷新后恢复准确状态 |
| RH-L14 | Observation Fail-open | 旁路失败不阻断 Learning |
| RH-L15 | Event Chain | 五项最小事件身份一致、顺序完整 |
| RH-L16 | Forbidden Writes | 烟测未授权事实写入为 0 |
| RH-L17 | Terminal Exit | 已完成结果但无可执行下一题、修订或恢复动作时，返回入口必须安全收口当前 Session，入口不得再次恢复到同一反馈页 |

## 十七、工程工作包边界

后续工程文档应按以下工作包拆分，每个工作包独立开发、Debug 和验收：

| 工作包 | 目标 | 前置条件 |
| --- | --- | --- |
| WP-R0 | 运行基线、Reason Code 与只读审计冻结，详见 [WP-R0 工程与 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R0_BASELINE_ENGINEERING_AND_DEBUG_PLAN.md) | 本主契约完成 |
| WP-R1 | 统一启动器与 Runtime Health | WP-R0 通过 |
| WP-R2 | Learning / Workbench 故障分类与恢复投射 | WP-R1 通过 |
| WP-R3 | Product Runtime Identity 与 Trial 自动失效 | WP-R1 通过 |
| WP-R4 | Trial Re-entry Preflight 与重新激活，详见 [WP-R4 工程与 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R4_TRIAL_REENTRY_ENGINEERING_AND_DEBUG_PLAN.md) | WP-R3 通过 |
| WP-R5 | 完整真实学习烟测与最小事件链验收，详见 [WP-R5 工程与 Debug 验收文档](./PRODUCT_RUNTIME_RELIABILITY_WP_R5_REAL_LEARNING_SMOKE_ENGINEERING_AND_DEBUG_PLAN.md) | WP-R2、WP-R4 通过 |
| WP-R6 | 旧固定基线测试、性能提示与最终浏览器验收收口 | WP-R5 通过 |

本主契约只冻结工作包边界。每个工作包的文件清单、接口签名、测试 Case、Debug 命令、浏览器矩阵、回滚和完成记录必须在独立工程文档中补齐。

## 十八、完成定义

只有同时满足以下条件，才能把本轮状态更新为：

```text
ENGINEERING COMPLETE
DEBUG ACCEPTED
FULL BROWSER ACCEPTED
REAL TRIAL RE-ENTRY APPROVED
```

完成条件：

1. 统一启动入口可重复使用；
2. Runtime Health 准确区分 ready / degraded / blocked；
3. Learning 不再把 Runtime 未启动误投射为普通正式资源读取失败；
4. AI Provider、正式资源、业务无任务和 Trial 状态相互独立；
5. Product Runtime Identity 与当前源码、构建、Registry 和策略一致；
6. 当前代码变化能够使旧 Trial 安全回落 `off`；
7. 重新准入 Preflight 与 Launch Record 完成；
8. 执行时全部 Current Frozen Resource 保持身份、数量守恒和质量零回归；`24 / 81 / 81` 仅作为 2026-08-25 基线证据；
9. 完整真实学习烟测通过；
10. 五项最小事件链身份、顺序和幂等通过；
11. Observation 失败不阻断 Learning；
12. 正式资源、Attempt、Evidence、Profile 和真实校准分母没有未授权写入；
13. Production Build 通过；
14. 浏览器验收覆盖 Learning、Workbench 和 Internal Health；
15. 最终执行报告披露当前运行身份、遗留问题和真实 Trial 状态。

完成工程验收不等于教育效果成立。只有重新准入后的真实 Learning 数据才能进入后续效果判断。

## 十九、冻结声明

`product_runtime_reliability_and_real_trial_reentry_v1` 冻结以下事实：

1. 工程测试通过不等于当前实例可以运行；
2. 当前本地产品必须通过统一启动器和 Health 证明就绪；
3. Runtime、Formal Store、AI Provider、业务无任务和 Trial 必须分别判断；
4. Health 是只读投影，不建立第二套事实来源；
5. 普通错误必须说明发生了什么、内容是否保留和下一步动作；
6. 固定 Build Version 字符串不能单独证明当前运行身份；
7. Git、源码、产物、Registry 或策略实质变化时旧 Trial 必须安全回落 `off`；
8. 旧 Trial 事件不得被重新标记为当前构建事件；
9. 重新进入真实 Trial 必须重新执行 Preflight 并形成不可变 Launch Record；
10. 第一条真实 Observation 必须来自重新准入后的真实 Owner Fact；
11. Observation 失败不得阻断 Learning；
12. Runtime 或正式资源失败不得被伪装为业务无任务；
13. AI Provider 失败不得生成 Mock Diagnosis、Evidence 或反馈；
14. 重启和恢复不得要求用户管理内部事务状态；
15. 当前 `24 / 81 / 81` 是基线证据，不是长期硬编码数量；
16. 本轮不新增 Training Model 功能，不重构正式主链；
17. 本轮完成只表示真实运行重新准入，不表示教育效果已经证明。

本文档当前达到 `DESIGN BASELINE / WP-R0—R4 ENGINEERING COMPLETE / REAL TRIAL REMAINS OFF / WP-R5 DESIGN FROZEN`。WP-R0 已完成只读基线，WP-R1 已完成统一启动器、固定端口保护、GET-only Runtime Health、动态正式资源投射和 Internal Health，WP-R2 已完成 Learning / Workbench 故障分类、内容保留表达、单一恢复动作和普通页面内部字段隔离，WP-R3 已完成内容寻址 Runtime Identity、Launch Binding 读取契约、旧非 off Trial 自动失效、Health/Internal 投射和零写入验收，WP-R4 已完成新 Preflight、Launch Record、Identity Binding、原子 Approval Bundle、显式激活、失败回滚、零写入边界与浏览器只读验收。WP-R5 的真实学习烟测边界已经在独立工程文档中冻结；必须先提交该文档，再以最终 clean Production Artifact 重新生成 Runtime Identity、执行 R4-P01—R4-P24、保存新准入包并显式激活。第一条事件仍必须等待真实学生自然操作，不得由工程脚本制造。
