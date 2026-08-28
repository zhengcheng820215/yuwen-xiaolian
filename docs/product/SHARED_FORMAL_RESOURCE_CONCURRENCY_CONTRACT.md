# 共享正式资源并发与写入恢复契约

英文名称：Shared Formal Resource Concurrency and Write Recovery Contract

状态：ACTIVE ENGINEERING CONTRACT / WP-C0–C7 COMPLETE
文档版本：`shared_formal_resource_concurrency_contract_v1.2`
更新日期：2026-08-28

## 一、目的

本文规定单人录入平台对共享正式资源执行写入时的串行化、乐观并发、冲突重试、多标签页协调、幂等恢复、用户状态和工程验收边界。

本文解决的具体问题是：正式资源当前以整份共享快照执行 `read -> mutate -> replace(expectedRevision)`。一次“采用并发布”会依次写入 Draft、Validation、Quality Assessment、Review、Frozen Version、Registry 和 Observation Link；当同一页面、多个标签页或多个异步阶段同时基于旧 Revision 写入时，服务端会正确返回 Revision Conflict，但过短的客户端重试窗口可能让本可恢复的操作提前失败。

本文不降低正式资源不可变性，不把多个领域对象合并成一条不可追溯记录，也不以重试掩盖数据结构错误、身份冲突或业务门禁失败。

## 二、适用范围与非目标

### 2.1 适用范围

- 素材、Observation Plan、Question Draft、Validation、Assessment、Review、Frozen Version、Registry、Observation Link 等共享正式资源写入；
- 单页连续发布、快速重复点击、同一浏览器多标签页操作；
- `SHARED_RESOURCE_REVISION_CONFLICT` 的自动恢复；
- 发布编排中断后的幂等接续；
- 从整库 Replace 向服务端原子命令迁移期间的兼容边界。

### 2.2 非目标

- 不声明多人协作、跨设备协同或云端规模化并发已经成立；
- 不允许客户端静默覆盖服务端最新 Revision；
- 不重试 Validation Failed、身份不一致、不可变记录冲突等业务错误；
- 不因增加锁或队列而新增人工确认步骤；
- 不把技术排队状态伪装成新的业务里程碑。

## 三、现状基线与目标状态

### 3.1 当前实现基线

当前共享资源客户端在发生 Revision Conflict 时最多尝试 6 次，退避以约 20ms 起步、240ms 封顶。该实现能保证冲突时不覆盖数据，但总恢复窗口不足以稳定覆盖连续正式写入或多标签页竞争。

Phase 17.2 中记载的“最多 6 次”属于当时工程事实和历史验收基线，不是本文目标实现的长期参数。

### 3.2 目标状态

目标状态分为四层：

1. 同一页面的正式写入按用户命令串行执行；
2. 共享资源客户端的每次 Compare-and-Swap 写入拥有统一安全队列和有界重试；
3. 同一浏览器的多个标签页通过 Web Locks 协调，并通过 BroadcastChannel 感知 Revision 更新；
4. 长期将高频整库 Replace 迁移为服务端原子业务命令。

前 3 层是当前单人产品可靠性 P0；第 4 层是后续 P1 架构演进。

## 四、强制一致性原则

1. **一个用户意图只执行一个活动写命令**：同一页面同一时刻只允许一个正式资源写命令进入执行态。
2. **冲突必须重新读取**：Revision Conflict 后必须绕过读取缓存并获取最新快照，禁止继续提交旧数据。
3. **重试必须重新应用 Mutation**：每次重试都在最新快照克隆上重新执行确定性 Mutation，不得复用上一次产生的整库结果。
4. **非冲突错误不得盲目重试**：结构错误、业务门禁、不可变冲突、身份错位和权限错误必须立即返回对应恢复动作。
5. **领域写入保持幂等**：相同 idempotency key 的重试不得重复创建 Draft、Validation、Assessment、Review、Frozen Version、Registry 或 Link。
6. **已完成阶段不回滚**：发布编排中断后保留已经落盘且可验证的阶段结果，从第一个未完成阶段接续。
7. **成功必须通过发布后置条件**：只有正式任务身份、Frozen Version、Registry、active Observation Link 和正式读取全部成立，页面才显示发布成功。
8. **锁只协调执行，不改变业务状态**：排队、等待锁和冲突重试是运行状态，不进入领域生命周期，不增加 Revision 或审核记录。
9. **排队闭包不是权威状态**：命令进入 FIFO 时可以保留目标身份和展示快照，但任何可能已被前序命令改变的 Plan、Draft、Review 或 Publication 状态，必须在命令取得执行权后按稳定 ID 重新读取；不得使用点击时捕获的 `selectedPlan.status` 决定正式状态迁移。
10. **幂等回执不得复制业务载荷**：Command Receipt 只能保存固定长度的命令摘要、命令身份和提交 Revision，不得把完整 Patch、材料正文或整份集合序列化进 `fingerprint`。历史完整指纹在读取时必须等价转换为摘要；转换不得改变命令幂等语义、正式资源 Revision 或领域对象。
11. **大快照读取必须有韧性但不得降低写入约束**：普通只读请求使用独立于写入的读取预算；只有明确的读取超时允许自动重试一次。存在同一运行实例内最近一次有效快照时，重试仍超时可短时回退该快照并继续展示。Mutation 的无缓存权威读取、正式写入和发布后置检查不得使用过期快照，也不得因读取回退而显示写入成功。

### 4.1 正式资源读取韧性边界

当前正式资源磁盘快照约 10.9MB，HTTP 紧凑响应约 7.9MB。正常读取通常低于 200ms，但开发冷启动、HMR、主线程忙碌或并发只读请求可能偶发超过原 3 秒预算。读取韧性参数冻结如下：

- 普通只读总预算：8 秒，最多分为 2 次各 4 秒的尝试；
- 只在 `SHARED_STORE_TIMEOUT` / “共享资源服务读取超时”时自动重试 1 次；
- HTTP 非 2xx、结构校验失败、身份不一致及服务不可用不得作为超时重试；
- 同一 `fetcher + endpoint` 的并发普通读取继续合并为一个 Pending Request；
- 已存在最近一次有效缓存时，两次读取均超时后允许短时回退该缓存；缓存回退只保证页面连续展示，不构成最新 Revision 证明；
- `bypassCache=true` 的权威读取保持 3 秒单次预算、无自动重试、无缓存回退；
- POST、Atomic Command、Replace、Initialize 继续使用 3 秒单次请求预算，并受既有 Mutation 8 秒总恢复窗口约束；
- 超时和缓存回退不得创建 Revision、Receipt、Session、Attempt、Evidence、Profile、Calibration 或 Trial 写入。
- Unified Learning Entry 的“正式任务”阶段预算为 9 秒、入口总预算为 10 秒，必须覆盖共享读取总预算；其他 IndexedDB / LocalStorage 阶段继续保持原 4 秒边界。

该机制只处理瞬时读取抖动，不替代后续按 Learning / Workbench 消费范围提供轻量投影接口的架构演进。

## 五、写入协调模型

### 5.1 页面命令队列

所有可能写入共享正式资源的页面命令必须进入一个 FIFO `FormalResourceCommandQueue`。队列至少覆盖：

- 保存或确认 Observation Plan；
- 采用 QuestionCandidate；
- 保存或校验 Draft；
- 持久化 Quality Assessment Bundle；
- 写入 Review Decision；
- Freeze、Registry 切换与 Observation Link；
- 发布恢复及正式关系修复。

同一“采用并发布”编排从首次正式写入开始取得命令租约，直到以下任一条件才释放：

- 端到端发布后置条件通过；
- 到达可恢复的明确中断点；
- 遇到不可重试错误。

Provider 生成或其他尚未产生正式写入的计算应尽量在租约外完成；一旦正式写入开始，命令不得与另一个正式化命令交错。

只读快照、候选预览和不写共享库的 UI 操作不进入写队列，但读取结果不得被用于绕过命令执行时的最新 Revision 校验。

可能等待前序任务完成的“采用并发布”命令必须在真正执行时重新加载当前 `materialObservationPlanId`。状态续接规则冻结为：

- 最新状态为 `reviewed`：Plan 前置阶段视为已完成，直接继续 Candidate 采用与发布；
- 最新状态为 `pending_review`：只执行批准，不重复提交；
- 最新状态为 `draft / revision_required`：执行一次提交，并消费提交返回状态决定是否批准；
- Plan 不存在、身份已切换或已进入不兼容 Revision：结构化阻断并要求刷新，不得跨版本继续；
- 领域层对 `submit(reviewed)` 的拒绝继续保留，上层不得以放宽状态机代替权威重读。

前序命令完成后，后发命令不得仅依赖 React State 异步刷新。队列项至少以 `materialVersionId + materialObservationPlanId + observationTaskPlanId + candidateId` 标识目标；完整页面对象只可用于展示，不能作为执行时权威事实。

### 5.2 客户端 Mutation 安全队列

`LocalApiFormalResourceClient.mutate` 必须作为第二层安全网，共享同一执行上下文中的单一写队列。即使上层遗漏命令协调，也不得让两个 `read -> replace` 在同一客户端实例族中并行竞争。

嵌套调用必须复用当前租约，禁止同一命令等待自己造成死锁。队列失败不得阻塞后续命令；每个任务完成或失败后都必须释放队首。

### 5.3 多标签页 Web Lock

支持 Web Locks API 时，正式写命令必须请求同源独占锁：

```text
lock name: formal-resource-store-write
mode: exclusive
```

锁等待期间不得提前读取并缓存待写快照。取得锁后必须重新读取权威 Revision，再执行 Mutation。

锁等待应支持取消和页面卸载释放。浏览器不支持 Web Locks 时，系统降级为服务端乐观锁与有界重试，不得因此关闭正式写入保护。

### 5.4 BroadcastChannel Revision 通知

同源标签页使用 `formal-resource-store-events` Channel 广播最小事件：

```text
{
  type: "formal_resource_revision_updated",
  revision: number,
  occurredAt: ISO-8601 string
}
```

事件不携带正式资源内容。其他标签页收到更高 Revision 后必须失效读取缓存，并在没有本地未完成命令时刷新工作台；有活动命令时只记录“需要重新读取”，不得中断或覆盖当前恢复流程。

## 六、Revision Conflict 重试算法

### 6.1 可重试条件

只有服务端明确返回以下事实时进入自动重试：

- HTTP `409`；
- error code 为 `SHARED_RESOURCE_REVISION_CONFLICT`；
- 请求尚未产生不可判定的网络提交结果，或后续可通过幂等读取确认。

超时、连接中断和未知 5xx 必须先按命令幂等键或发布后置条件确认是否已经成功，再决定重试，禁止直接重复创建领域对象。

### 6.2 参数规范

- 总尝试次数：最多 8 次（首次执行计入）；
- 退避基线：`100ms, 200ms, 400ms, 800ms, 1600ms, 2000ms, 2000ms`；
- 每次增加 `0–100ms` 随机抖动；
- 单个 Mutation 自动恢复总时限：8 秒；
- 每次冲突后立即失效对应 endpoint 的读取缓存；
- 下一次尝试必须执行无缓存权威读取；
- 成功后更新本地缓存并广播最新 Revision。

达到次数或时限上限时返回结构化 `SHARED_STORE_REVISION_CONFLICT`，`recoverability=retry_safe`。不得无限重试，也不得通过提高超时掩盖持续写入风暴。

### 6.3 公平性与防抖

- 页面命令按进入顺序执行，不允许后到的批量任务长期抢占单题发布；
- 同一按钮快速重复点击复用已有 Promise，不新增队列项；
- 相同 command key / idempotency key 在完成前只能存在一个活动实例；
- 队列长度变化不得触发额外领域写入。

## 七、用户可见状态与文案

| 运行状态 | 用户文案 | 交互要求 |
| --- | --- | --- |
| `queued` | 等待上一项操作完成… | 当前按钮进入加载态，不允许重复入队 |
| `lock_waiting` | 正在等待共享数据写入… | 不显示为错误，可取消尚未开始的命令 |
| `executing` | 正在保存 / 检查 / 发布… | 使用当前业务阶段文案 |
| `conflict_retrying` | 检测到数据更新，正在自动接续… | 自动恢复期间不要求用户刷新或再次点击 |
| `recovered` | 操作已接续完成 | 通过权威快照和后置条件后显示成功 |
| `conflict_exhausted` | 共享数据有更新，本次操作尚未完成。请继续发布。 | 保留已完成阶段，提供唯一安全恢复动作 |
| `read_timeout` | 共享资源读取超时，已完成步骤不会丢失。请继续发布。 | 使用 `SHARED_STORE_TIMEOUT` 和 `retry_safe`，不得降级为需要人工检查的未知错误 |
| `service_unavailable` | 共享资源服务暂时不可用，正式写入未完成。 | 不伪装成冲突，不显示发布成功 |
| `semantic_state_reloaded` | 训练计划状态已经更新，正在继续发布… | 自动跳过已完成 Plan 阶段，不显示红色错误 |
| `semantic_state_changed_incompatibly` | 当前训练计划已经更新，请刷新后重试。已有内容不会丢失。 | 阻断跨 Revision 续接，不暴露英文领域异常 |

短暂 Revision Conflict 在自动恢复期间不得直接显示红色错误。只有重试耗尽、服务不可用或业务门禁失败后，页面才进入需要用户处理的状态。

## 八、幂等与中断恢复

### 8.1 身份要求

每个可恢复命令必须包含稳定身份：

- command name；
- target object id；
- expected object Revision（适用时）；
- idempotency key；
- workflow / stage identity（多阶段发布适用时）。

随机时间戳不得单独作为重试身份。重试前必须先查询目标阶段是否已经完成。

### 8.2 发布阶段恢复

```text
Candidate Adopt
-> Draft Validation
-> Deterministic / Semantic Assessment
-> Review Decision
-> Frozen Version
-> Registry Current Version
-> Active Observation Link
-> Formal Resolver Read
```

每次恢复从权威共享快照计算第一个未完成阶段。已经存在且内容一致的不可变记录直接复用；存在相同身份但内容不一致时返回不可变冲突，不得覆盖。

Frozen Version 已存在但 Link 缺失时，进入 Publication Recovery，只补齐 Registry / Link 并重新执行正式读取后置检查，不创建新 Frozen Version。

## 九、服务端原子命令演进

整库 Replace 在单人、小规模本地运行中继续作为兼容边界，但不作为长期高并发接口。目标服务端命令至少包括：

```text
POST /formal-resource-commands/save-plan
POST /formal-resource-commands/save-draft
POST /formal-resource-commands/save-validation
POST /formal-resource-commands/save-quality-bundle
POST /formal-resource-commands/record-review
POST /formal-resource-commands/commit-publication
POST /formal-resource-commands/recover-publication
```

每条命令由服务端在写队列中读取最新状态、校验对象 Revision、应用领域 Mutation 并原子提交。响应必须返回最新 store Revision、命令结果和幂等回执。

迁移期间客户端不得同时对同一业务对象混用原子命令与整库 Replace。命令能力应按 endpoint / capability 明确协商，不能通过请求失败后静默切换写入模型。

## 十、可观察性

工程日志至少记录：

- command key、target id、workflow stage；
- queue wait duration、lock wait duration；
- expected / actual Revision；
- attempt number、backoff duration、final outcome；
- 是否复用幂等结果；
- postcondition failure code。

日志不得记录材料全文、学生答案、Provider Key 或完整共享快照。前台默认不展示内部 Revision、endpoint 和堆栈。

建议指标：冲突率、自动恢复率、重试耗尽率、P50/P95 排队时间、P95 发布总时长、重复正式对象数、孤立 Frozen Version 数。

## 十一、验收矩阵

### 11.1 自动化验收

1. 同页面两个写命令同时发起时严格按 FIFO 执行；
2. 同一命令快速双击只执行一次；
3. 前 1–7 次返回 Revision Conflict、后续成功时最终无数据丢失；
4. 第 8 次仍冲突时有界失败并保留可恢复状态；
5. 每次冲突后读取最新 Revision，不命中旧缓存；
6. 非 Revision Conflict 不进入重试循环；
7. 队首失败后下一命令仍能执行；
8. 两标签页同时发布时 Web Lock 串行，或降级路径通过乐观锁恢复；
9. BroadcastChannel 只广播 Revision 元数据并使其他标签页缓存失效；
10. 发布中任一阶段中断后重试不重复创建领域对象；
11. Frozen Version 存在但 Link 缺失时只补 Link；
12. 端到端后置条件未通过时不显示成功、不计入已发布。

### 11.2 浏览器验收

- 连续发布至少 3 道题，不出现短暂冲突红字；
- 两个录入标签页同时点击正式写操作，后发标签页显示等待并最终完成；
- 等待、自动接续、耗尽恢复三类文案符合第七节；
- 刷新后任务状态、全局统计和 Learning 可消费数量一致；
- 浏览器不支持 Web Locks 的受控场景仍可安全完成或明确有界失败。

### 11.3 完成定义

只有同时满足以下条件，才能把 P0 标记为完成：

- 页面命令队列、Mutation 安全队列、Web Lock 和缓存失效均落地；
- 有界重试参数与结构化错误符合本文；
- 幂等与发布后置条件测试全部通过；
- 双标签页人工验收通过；
- 没有新增重复 Draft、Assessment、Review、Frozen Version 或 Link；
- 文档、实现、测试和用户文案一致。

## 十二、实施工作包

| 工作包 | 内容 | 优先级 | 交付状态 |
| --- | --- | --- | --- |
| WP-C0 | 页面正式写命令队列、重复命令合并、运行状态投影 | P0 | 已完成（2026-08-13） |
| WP-C1 | Mutation 串行安全队列、无缓存冲突重读、8次/8秒有界退避 | P0 | 已完成（2026-08-13） |
| WP-C2 | Web Locks、BroadcastChannel、降级路径 | P0 | 已完成（2026-08-13） |
| WP-C3 | 并发、幂等、中断恢复、双标签页测试与人工验收 | P0 | 已完成（2026-08-13） |
| WP-C4 | 服务端原子命令与整库 Replace 分阶段退出 | P1 | 已完成（2026-08-13） |
| WP-C5 | 排队命令执行前权威业务状态重载、已完成阶段续接与中文错误投影 | P0 | 已完成（2026-08-14） |
| WP-C6 | Plan 续接结构化结果、统一发布入口、页面反馈与可观测事件 | P1 | 已完成（2026-08-14） |
| WP-C7 | 大快照只读预算、单次超时重试、有效缓存回退和读写边界回归 | P0 | 已完成（2026-08-28） |

各工作包应独立开发和 Debug；前一工作包验收通过后再把下一层能力作为正式依赖。WP-C0 至 WP-C3 全部完成前，不得宣称多标签页并发可靠性已经工程验收。

### 12.1 WP-C0 实现证据

- 页面级 `FormalResourceCommandQueue` 对正式写命令执行 FIFO 串行化；
- 相同 command key 在未完成期间复用同一 Promise，不重复执行；
- “采纳并发布”编排从第一次正式写入到成功或明确中断始终占有同一队列执行权；
- 后发任务投影“等待上一项操作完成…”状态，当前任务及排队任务均禁止重复操作；
- 队首失败会释放执行权，后续命令继续运行；
- 专项命令 `pnpm run debug:formal-resource-command-queue` 已通过 5/5；
- WP-C0 不修改 Revision Conflict 重试参数，不提前实现 WP-C1。

### 12.2 WP-C1 实现证据

- 同一 `fetcher + endpoint` 的 `LocalApiFormalResourceClient` 实例共享 Mutation FIFO 安全队列；
- 队首成功或失败后均释放执行权，后续 Mutation 可以继续运行；
- 每次 Mutation 尝试均绕过读缓存读取权威快照，冲突后失效缓存并在最新克隆上重新应用 Mutation；
- 仅 `SHARED_RESOURCE_REVISION_CONFLICT` 进入恢复循环，其他服务或业务错误立即失败；
- 重试参数落实为最多 8 次、总恢复窗口 8 秒、`100/200/400/800/1600/2000/2000ms` 退避及 `0–100ms` 抖动；
- 耗尽后返回结构化 `SHARED_STORE_REVISION_CONFLICT`，`recoverability=retry_safe`；
- `pnpm run debug:shared-formal-resource-mutation-queue` 已通过 10/10；真实本地共享存储回归已通过 14/14；
- WP-C1 不引入 Web Locks 或 BroadcastChannel，不提前实现 WP-C2。

### 12.3 WP-C2 实现证据

- 浏览器正式写入在 `formal-resource-store-write` 同源独占 Web Lock 内执行，锁覆盖完整 Mutation 重试过程；
- 等待锁期间不读取待写快照，取得锁后由 WP-C1 无缓存读取权威 Revision；页面卸载通过 AbortSignal 取消尚未取得的锁请求；
- 成功写入后通过 `formal-resource-store-events` 广播最小 Revision 事件，不携带正式资源内容；
- 其他标签页收到更高 Revision 后立即失效读取缓存：空闲工作台自动刷新，有活动命令时延迟到队列清空后刷新；
- 不支持 Web Locks 或 BroadcastChannel 时保留 WP-C1 乐观锁与有界重试保护，不关闭正式写入；
- `pnpm run debug:shared-formal-resource-cross-tab` 已通过 12/12；
- 浏览器原生 Smoke 已通过 4/4：Web Locks 可用、独占顺序正确、BroadcastChannel 可用、Revision 事件可达；
- WP-C2 不宣称并发与中断恢复矩阵已经完成，完整双标签页业务验收属于 WP-C3。

### 12.4 WP-C3 验收证据

- 统一入口 `pnpm run accept:shared-formal-resource-concurrency-wp-c3` 已通过 9/9 测试套件，覆盖第 11.1 节 12/12 自动化要求；
- 明确验证前 7 次冲突后第 8 次成功，以及第 8 次仍冲突时有界失败；
- Candidate 采用、质量检查、Review、Freeze、Registry 与 Link 的重复和中断恢复测试通过；
- Frozen Version 存在但 Link 缺失的恢复只复用正式版本并补齐关系；
- 双标签页实测后发标签等待约 796ms 后取得锁，并成功接收 Revision 965；
- 等待锁、冲突自动接续、接续完成和冲突耗尽均有契约一致的运行状态与用户文案；
- 完整验收报告见 [WP-C3 共享正式资源并发可靠性验收报告](../education/phase/reports/shared_formal_resource_concurrency_wp_c3_acceptance_2026-08-13.md)；
- P0 完成不代表多人协作、跨设备分布式事务或 WP-C4 服务端原子命令已经完成。

### 12.5 WP-C4 实现与验收证据

- 服务端声明 `atomicCollectionPatch=1.0`，领域 Mutation 改为提交变化集合而非完整共享快照；
- 服务端在单一写队列中完成权威读取、Revision 校验、Patch 应用、全库校验与一次原子提交；
- command receipt 持久化并在服务重启后继续提供幂等保护，同一 ID 不同内容被阻断；
- command receipt 的 `fingerprint` 使用固定长度加密摘要；历史完整命令字符串允许在内存校验时兼容压缩，并在下一次正式提交中随快照原子持久化，避免回执随集合 Patch 重复放大共享文件；
- 同一请求已经取得快照时，响应状态必须从该快照派生，不得为生成 `status` 再读取、解析和校验一次整库；
- 客户端只在 capability 明确存在时使用新命令，命令失败禁止静默回退；旧服务未声明能力时保留受 WP-C0～C3 保护的兼容 Replace；
- `initialize`、备份恢复和旧服务兼容仍保留整库边界，高频领域 Mutation 已退出整库传输；
- `pnpm run debug:shared-formal-resource-atomic-command-wp-c4` 已通过 12/12；
- 验收报告见 [WP-C4 共享正式资源原子命令验收报告](../education/phase/reports/shared_formal_resource_atomic_command_wp_c4_acceptance_2026-08-13.md)。

### 12.6 WP-C5 实现与验收证据

- 采用发布命令取得页面级串行队列执行权后，按稳定 `materialObservationPlanId` 绕过缓存重读权威 Observation Plan，不再把点击时捕获的页面状态作为提交依据；
- 权威状态为 `reviewed` 时跳过 Plan 提交和审批并继续后续发布，状态为 `pending_review` 时只执行审批，状态为 `draft / revision_required` 时只执行尚未完成的提交与审批阶段；
- 提交或审批发生竞争错误后立即重读权威状态；若另一命令已经完成目标阶段则安全续接，否则保留结构化失败；
- Plan 缺失、身份不一致或进入不可续接状态时，以中文业务错误阻断并要求刷新，不向用户暴露底层英文状态机异常；
- 领域层 `submit(reviewed)` 等非法转换继续保持严格失败，幂等续接只在应用命令编排层实现，没有放宽领域不变量；
- Material Resource Production Commands 已通过 `13/13`，Formal Resource Command Queue 已通过 `5/5`，最终集成已通过 `26/26`；
- Material Question Review Submission 已通过 `6/6`，Material Resource Workbench State 已通过 `20/20`，Question Candidate Workbench P4 已通过 `16/16`，生产构建通过；
- 验收报告见 [WP-C5 权威业务状态重载与续接验收报告](../education/phase/reports/shared_formal_resource_semantic_state_reload_wp_c5_acceptance_2026-08-14.md)。

### 12.7 WP-C6 P1 工程契约与验收矩阵

WP-C6 不增加新的领域状态，不放宽 Plan 状态机，也不持久化页面运行态。它把 WP-C5 的安全续接从内部实现提升为所有发布入口共同消费的结构化应用契约。

工程契约冻结如下：

1. `confirmTrainingPlanForTaskProduction` 返回结构化续接结果，至少包含权威初始状态、最终状态、续接代码、已完成阶段和本次可观测事件；调用方不得解析提示字符串判断业务结果；
2. 续接代码至少区分“状态未变化且已确认”“执行提交/审批”“执行前状态已变化”“竞争后恢复”；
3. Plan 缺失或状态不可续接必须抛出结构化错误，固定错误码、操作名、对象 ID 与 `reload_required` 恢复语义；不得依赖英文领域异常映射；
4. Candidate 采用发布和既有任务继续发布都必须调用同一续接命令，即使页面快照显示 `reviewed` 也不得绕过执行时权威读取；
5. 页面收到“执行前状态已变化”或“竞争后恢复”时，在当前任务卡投影“训练计划状态已同步，正在继续发布…”，随后继续原用户意图，不增加确认步骤；
6. 不可续接时页面刷新权威快照、保留 Candidate 与已完成阶段，并展示结构化中文错误和唯一刷新恢复语义；
7. 可观测事件只记录 Plan ID、页面状态、权威状态、阶段与结果代码，不记录材料正文、题目正文或用户密钥；
8. 同一用户意图中的状态重载与页面投影不得创建 Plan Revision、Review、Question Revision、Formal Resource 或 Registry Entry。

验收矩阵：

| 编号 | 场景 | 预期结果 | 层级 |
| --- | --- | --- | --- |
| P1-01 | 页面与权威状态均为 `reviewed` | 返回 `already_reviewed`，无提交、无审批 | 命令 |
| P1-02 | 页面 `draft`，权威 `reviewed` | 返回 `semantic_state_reloaded`，跳过 Plan 阶段 | 命令 |
| P1-03 | 权威 `draft` | 提交、审批各一次，返回完成阶段事件 | 命令 |
| P1-04 | 权威 `pending_review` | 只审批一次 | 命令 |
| P1-05 | 提交竞争后权威 `reviewed` | 返回 `race_recovered`，不暴露原始异常 | 命令 |
| P1-06 | 审批竞争后权威 `reviewed` | 返回 `race_recovered`，继续发布 | 命令 |
| P1-07 | Plan 缺失 | 结构化错误、中文提示、`reload_required` | 命令 / 页面 |
| P1-08 | Plan 为不可续接状态 | 固定结构化错误码，不执行发布 | 命令 / 页面 |
| P1-09 | 页面显示 `reviewed` 的 Candidate 采用入口 | 仍调用权威续接器 | 页面集成 |
| P1-10 | 既有任务继续发布入口 | 与 Candidate 入口复用同一续接器 | 页面集成 |
| P1-11 | 状态变化或竞争恢复 | 当前任务卡显示同步反馈后继续成功 | 页面 Smoke |
| P1-12 | 重复点击或同 Plan 连续发布 | Plan 阶段不重复写，题目身份不串卡 | 队列 / 集成 |
| P1-13 | 回归与生产构建 | P0、发布主链、工作台状态和构建全部通过 | 全量回归 |

完成标准：P1-01 至 P1-13 均有自动化、静态集成约束或浏览器证据；无真实数据破坏、无英文状态机错误、无新增人工步骤，方可把 WP-C6 标记为完成。

实现与验收证据：

- 续接命令现返回 `already_reviewed / submitted_and_approved / approved / semantic_state_reloaded / race_recovered` 五类结构化结果，并携带最小阶段事件；
- Plan 缺失或不可续接统一返回 `MATERIAL_OBSERVATION_PLAN_STATE_CHANGED`、`reload_required` 和稳定对象 ID；
- Candidate 采用发布与既有任务继续发布均无条件调用同一权威续接器；任务卡支持结构化续接代码和错误恢复信息投影；
- 命令专项 `16/16 PASS`，Candidate Workbench P6 静态集成约束通过，结构化错误 `9/9 PASS`，队列 `5/5 PASS`；
- Candidate P4 `16/16 PASS`、Material Question Review Submission `6/6 PASS`、Material Resource Workbench State `20/20 PASS`、最终集成 `26/26 suites PASS`、生产构建通过；
- 浏览器命令 Smoke `4/4 PASS`；正式工作台只读核验成功加载 `42/42` 已发布资源和任务卡，没有执行真实发布或修改正式数据；
- 完整验收报告见 [WP-C6 Plan 续接结构化交互与可观测性验收报告](../education/phase/reports/shared_formal_resource_plan_continuation_wp_c6_acceptance_2026-08-14.md)。

### 12.8 WP-C7 读取韧性验收边界

- 普通读取在第一次超时、第二次成功时对调用方透明恢复；
- 两次均超时且存在过期有效缓存时返回缓存，不向 Learning 投射红色错误；
- 两次均超时且不存在缓存时有界失败，继续使用 `SHARED_STORE_TIMEOUT / retry_safe`；
- 并发普通读取仍只发起一组重试序列，不按调用方数量放大请求；
- 权威无缓存读取与所有写请求保持原 3 秒严格边界，禁止缓存回退；
- 真实 10.9MB 快照接口连续读取返回 `200`，并记录响应大小和耗时作为诊断证据；
- Unified Learning Entry Debug、Mutation Queue、Structured Runtime Error 和生产构建全部通过；
- 完整验收记录见 [WP-C7 共享正式资源读取韧性验收报告](../education/phase/reports/shared_formal_resource_read_resilience_2026-08-28.md)。

## 十三、与其他契约的关系

- 用户主流程与发布成功投影以 [统一资源生产工作台契约](./UNIFIED_RESOURCE_PRODUCTION_WORKBENCH_CONTRACT.md) 为准；
- 正式版本不可覆盖规则以 [正式资源不可变性契约](./FORMAL_RESOURCE_IMMUTABILITY_CONTRACT.md) 为准；
- Candidate 采用与发布阶段幂等以 [AI 资源生成与优化工作流契约](./AI_RESOURCE_GENERATION_AND_OPTIMIZATION_WORKFLOW_CONTRACT.md) 为准；
- Revision、Review、Freeze 和 Publication 恢复以 [题目审核与发布工作流契约](./QUESTION_REVIEW_AND_PUBLICATION_WORKFLOW_CONTRACT.md) 为准；
- 本文是共享写入协调、冲突恢复和多标签页并发问题的权威工程契约。
