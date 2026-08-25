# 产品复杂度收口真实 Trial 激活签署与执行记录

日期：2026-08-25

时区：`Asia/Shanghai`

执行类型：单学生、本地、封闭、只观察 Trial

文档状态：`REAL TRIAL ACTIVATED / BROWSER VERIFIED / OBSERVATION RUNNING`

## 1. 激活结论边界

本次操作只把产品复杂度收口能力从 `off` 显式切换到 `real_trial` 观察模式，不开启任何自动产品决策，不修改正式资源、学生作答、Evidence、Profile 或真实校准分母。

必须同时保持：

1. Learning 主链 fail-open，观察失败不得阻断学习；
2. 八项能力全部使用 `observe_only`；
3. 不在激活时制造模拟学生事件；
4. 第一条 Observation 只能来自激活后真实 Learning Owner Fact；
5. 页面不增加 Trial、能力实验或激活入口；
6. 任何身份、时间窗、Registry、Policy、Build 或 Preflight 不一致都自动回落 `off`。

## 2. 冻结的 Trial 身份

| 字段 | 冻结值 |
| --- | --- |
| Trial Window ID | `product-complexity-convergence-real-trial-20260825-v1` |
| 参与学生 | `student-local-primary-v1` |
| 开始时间 | `2026-08-25T04:45:14.000Z` |
| 计划结束时间 | `2026-09-15T04:45:14.000Z` |
| 观察周期 | 21 天 |
| Git Commit | `119a019da59e7835bd01fbacf2604b5a9b687e34` |
| Build Version | `product-complexity-convergence-preflight-build-v1` |
| 工作树状态 | 非洁净；本次本地 Trial 构建包含尚未提交的阶段 4 与启动前工程改动 |
| 激活前工作树内容指纹 | `d9d4634c2fb611cb6e6f18d39311bac6a5d5ff2aecf5fca35be763eb5ae6a203` |
| 激活时运行源码指纹 | `14125882a782edd4489414f2e4c3bb26c03ce634f84897a91720d81643ef520b` |
| Registry | 运行时读取不可变 Source Registry Snapshot |
| Observation Policy | 运行时读取冻结版本 |
| Decision Policy | 运行时读取冻结版本 |

工作树非洁净事实不会被写成“已提交版本”。本 Trial 仅在当前本地构建中运行；后续提交或构建发生变化时，Activation Controller 必须重新校验并在不匹配时回落 `off`。

## 3. RTW-S01—RTW-S18 操作签署

本次不可变 Preflight Report 必须包含 `RTW-S01—RTW-S18` 全部通过结果。统一证据来源为：

- `PF-C01—PF-C56`：`56 / 56 PASS`；
- `PF-B01—PF-B20`：`20 / 20 PASS`；
- 阶段 0—4、Unified Learning 与 Day 0 回归全部通过；
- Production Build 通过；
- 五类禁止写入计数均为 `0`；
- 普通 Learning 与 Workbench 不提供激活入口；
- 激活前 requested / effective mode 均为 `off`；
- 无未解决 P0 / P1。

只有上述证据仍成立，才允许生成：

1. 不可变 `RealTrialWindowPreflightReport`；
2. `approved_to_activate` Launch Record；
3. `active` Trial Window；
4. `requestedMode = real_trial` 的 Activation State。

## 4. 执行顺序

```text
初始化默认 Registry 与 off 状态
→ 保存 draft Trial Window
→ 保存 RTW-S01—RTW-S18 Preflight Report
→ 保存 approved_to_activate Launch Record
→ 将 Window 从 draft 转为 active
→ 解析并持久化 real_trial Activation
→ 重新读取并验证 effectiveMode = real_trial
→ 打开普通 Learning，确认主链可用且无 Trial UI
```

任何步骤失败时：

```text
显式写回 off
→ 追加 Activation Audit
→ 保留失败码
→ 不阻断 Learning
```

## 5. 激活后允许的观察范围

八项能力只记录版本化、结构化 Owner Fact：

- Revision；
- Targeted Micro-training；
- Retest；
- Transfer；
- Resource Risk Repair；
- Calibration Review；
- Feedback Projection；
- Profile Summary。

Observation 不保存学生答案、修订正文、题目正文、材料正文或模型自由文本。只有参与学生、真实 Learning、产品运行域、身份对齐、时间窗内、Source Fact 校验通过的事件才能进入真实 Trial 分母。

## 6. 激活后即时验收

| 验收项 | 预期 | 执行结果 |
| --- | --- | --- |
| requestedMode | `real_trial` | 通过 |
| effectiveMode | `real_trial` | 通过 |
| Trial Window | `active` | 通过 |
| Launch Record | `approved_to_activate` | 通过 |
| Preflight | `eligibleForActivation = true` | 通过；`RTW-S01—RTW-S18` 全部 passed |
| 注册能力 | 8 项 | 通过 |
| 启用能力 | 8 项 `observe_only` | 通过 |
| Learning | 可正常打开 | 通过；现有题组可继续 |
| Trial UI | 普通页面无入口、无实验文案 | 通过 |
| 激活时真实事件 | `0`，不得伪造 | 通过；Observation Event 为 0 |
| 控制台错误 | `0` | 通过 |

## 7. 结束与回退条件

发生以下任一情况立即关闭观察：

- Learning 被观察逻辑阻断；
- 身份、Registry、Policy、Build 或 Window 不一致；
- 学生内容进入 Observation；
- 正式资源、Attempt、Evidence、Profile 或真实校准分母被激活流程写入；
- 出现未解决 P0 / P1；
- 超出计划结束时间。

关闭后必须保持正式学习记录不丢失，并将模式恢复为 `off`。

## 8. 执行结果

真实浏览器已于 `2026-08-25T04:50:10.386Z` 完成本地 IndexedDB 激活写入并重新读取：

- Activation Result：`activated = true`；
- requested / effective：`real_trial / real_trial`；
- Reason Code：`real_trial_activation_approved`；
- Registry Hash：`2e9d6acf`；
- Activation Audit：2 条；
- Observation Event：0 条；
- 学生内容写入 Observation：否；
- 普通 Learning 页面：可用；
- 普通 Learning Trial 文案：无；
- 浏览器控制台 error / warn：0；
- 临时本地执行页已删除，产品与内部页面均不提供激活按钮。

激活后工程回归：`PF-C01—PF-C56` 56/56、Unified Learning 27/27、Day 0 Integration 15/15、Production Build 全部通过。当前可以开始真实使用；第一条 Observation 必须等待参与学生真实完成对应 Learning 生命周期，不以测试事件代替。
