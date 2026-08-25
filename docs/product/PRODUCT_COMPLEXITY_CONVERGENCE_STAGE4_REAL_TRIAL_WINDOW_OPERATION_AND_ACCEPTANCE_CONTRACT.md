# 产品复杂度收口阶段 4：真实 Trial Window 启动与运行验收契约

英文名称：Product Complexity Convergence Stage 4 Real Trial Window Operation and Acceptance Contract

契约版本：`product_complexity_convergence_stage4_real_trial_window_operation_v1`

观察策略版本：`product_complexity_convergence_stage4_observation_policy_v1`

决策策略版本：`product_complexity_convergence_stage4_decision_policy_v1`

状态：`DESIGN FROZEN / ACTIVATION PREFLIGHT REQUIRED / REAL TRIAL NOT STARTED`

日期：2026-08-25

关联文档：

- [产品复杂度收口总契约](./PRODUCT_COMPLEXITY_CONVERGENCE_CONTRACT.md)
- [阶段 4 稳定试用与退役决策工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_STABLE_TRIAL_AND_RETIREMENT_ENGINEERING_AND_DEBUG_PLAN.md)
- [阶段 4 真实 Trial Window 启动前工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_REAL_TRIAL_PREFLIGHT_ENGINEERING_AND_DEBUG_PLAN.md)
- [阶段 4 工程、Debug 与浏览器验收报告](../education/phase/reports/product_complexity_convergence_stage4_engineering_debug_browser_acceptance_2026-08-25.md)

## 一、文档目的

本契约冻结阶段 4 真实 Trial Window 的：

1. 启动条件；
2. 观察范围；
3. 真实数据准入；
4. 中途巡检；
5. 中断、恢复与失效条件；
6. 受控结束与样本判定；
7. 运行报告和后续决策边界。

本契约不是新的工程开发阶段，也不增加 Training Model、学习任务、调度状态或学生操作。它只规定如何安全运行已经通过工程验收的阶段 4 观察能力。

核心原则：

> 真实试用用于观察既有复杂能力在正常学习中的实际机会、触发、完成、收益代理和维护成本；观察不得驱动当次学习，也不得为了增加样本改变能力触发条件。

## 二、状态边界

### 2.1 工程状态与运行状态分离

当前工程状态：

```text
ENGINEERING COMPLETE
DEBUG ACCEPTED
FULL BROWSER ACCEPTED
ISOLATED OBSERVATION READY
ACTIVATION PREFLIGHT REQUIRED
```

当前运行状态：

```text
REAL TRIAL NOT STARTED
```

只有完成本契约的启动前验收并显式激活 Window 后，运行状态才允许变为：

```text
REAL TRIAL ACTIVE
```

工程完成、页面可用或存在 Observation Repository 均不等于真实试用已启动。

### 2.2 窗口生命周期

```text
draft
  → active
    → closed
    → invalidated
  → invalidated
```

规则：

- `draft` 只保存拟定范围，不接收真实分母；
- `active` 是唯一允许准入真实事件的状态；
- `closed` 表示窗口正常结束，状态不可回退；
- `invalidated` 表示窗口存在不可接受的完整性问题，不得用于能力去留结论；
- 已关闭或已失效 Window 不得重新激活；
- 需要继续观察时必须创建新的 `trialWindowId`。

## 三、启动前置条件

真实 Trial Window 只有同时满足以下条件才可启动。

### 3.1 工程基线

- 阶段 4 隔离观察工程状态为 `ISOLATED OBSERVATION READY`；
- 启动前工程已经按照预检文档完成，并达到 `ACTIVATION PREFLIGHT PASSED`；
- `C4-01—C4-64` 为 `64 / 64 PASS`；
- `B4-01—B4-20` 为 `20 / 20 PASS`；
- 旧主链专项回归与 Production Build 通过；
- Observation 默认模式仍为 `off`；
- 没有未处理的 P0 / P1 主链故障；
- 启动记录保存明确的 Git Commit、构建版本和部署时间。

### 3.2 参与范围

- 使用稳定的内部学生身份，不在运行文档中保存学生姓名；
- `participatingStudentIds` 使用产品正式身份 ID；
- 学生身份、Session 身份和 Attempt 身份可以稳定对齐；
- 初始封闭试用默认只允许一个学生；
- 扩大参与人数必须创建新 Window，不在活动窗口中追加参与者；
- 未列入参与范围的事件必须被排除。

### 3.3 时间范围

- 计划持续 `14—28` 个自然日；
- `startsAt` 和 `plannedEndsAt` 使用 ISO 时间并冻结时区口径；
- `plannedEndsAt - startsAt` 不得小于 14 日或大于 28 日；
- 14 日只是最早复核时间，不代表样本充分；
- 不允许回填 `startsAt` 之前的历史事件。

### 3.4 策略与资源快照

Window 激活前必须冻结：

- `observationPolicyVersion`；
- `decisionPolicyVersion`；
- `sourceRegistryVersion`；
- `sourcePolicySnapshotHash`；
- 八项能力的 `enabledCapabilityModes`；
- 正式数据源 Schema Version 清单；
- 当前 Feature Flag 与阶段 2 Owner Decision 快照。

Window 激活后不得原地修改上述事实。Registry、策略、Schema 或能力模式发生实质变化时，应关闭旧窗口并创建新窗口。

### 3.5 存储与恢复

- Observation Repository 可正常写入、读取和重建 Aggregate；
- 相同来源事实重复写入保持相同 `eventId`；
- 冲突身份能够被识别而不是静默覆盖；
- 观察仓库不可用时 Learning 仍可正常完成；
- 删除 Observation Repository 不影响正式资源、Attempt、Evidence 或 Profile；
- 启动前完成一次 `off → isolated_acceptance → off` 隔离烟测，真实分母写入必须为 0。

### 3.6 隐私与内容边界

Observation Event 不得保存：

- 学生答案正文或修订答案；
- Material 正文；
- Question 正文；
- 模型原始输出；
- 自由文本反馈；
- 可用于重建学生内容的组合字段。

只允许保存身份引用、结构化 Code、策略版本、时间和验证状态。

### 3.7 生产来源接线与激活控制

- 每项拟观察能力都必须有明确的正式 Owner Fact Adapter；
- Adapter 必须从 Owner 的结构化输出读取，不得从页面、DOM 或自由文本反推；
- Adapter 必须在 `off` 模式下证明零 Observation 写入；
- Adapter 必须在隔离模式下证明身份、生命周期和 Outcome Code 映射正确；
- 必须提供唯一、显式、可审计的 Observation Mode 切换路径；
- 应用重启、恢复或配置缺失时必须安全回到 `off`，不得默认进入 `real_trial`；
- 未完成生产来源接线或激活控制验收时，Window 只能保持 `draft`。

## 四、启动记录

每个真实 Window 必须建立一份不可变启动记录，至少包含：

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

规则：

- `unresolvedIssues` 非空时不得激活；
- 启动记录不保存学生姓名和学习内容；
- 启动记录是运行审计，不是新的业务事实；
- 启动批准只允许开启观察，不批准改变能力触发策略。

## 五、启动操作顺序

必须按以下顺序执行：

```text
1. 保持 observation mode = off
2. 创建 draft Trial Window
3. 冻结参与范围、策略、Registry、Schema 与构建版本
4. 完成 RTW-S01—RTW-S18 启动前验收
5. 保存启动记录
6. 将 Window 从 draft 转为 active
7. 显式将 observation mode 切换为 real_trial
8. 读取 Window 与首条事件，确认身份、来源和分母准入正确
9. 记录 REAL TRIAL ACTIVE
```

禁止：

- 先开启 `real_trial` 再补 Window；
- 使用 `isolated_acceptance` 数据作为首批真实数据；
- 从浏览器页面手工制造触发；
- 通过放宽 Owner Decision 增加样本；
- 激活失败后复用半完成 Window；
- 在学生正在提交答案时切换策略或窗口。

## 六、观察范围

### 6.1 允许观察的能力

| 能力 | 观察对象 | 允许的收益表达 | 禁止推断 |
| --- | --- | --- | --- |
| Revision | 合格、触发、完成、支持下修订结果 | 支持下 Gap 改善 | 独立掌握 |
| Targeted Micro-training | 匹配、插入、完成、原子 Gap 结果 | 支持下原子缺口改善 | 长期能力提升 |
| Retest | 安排、独立完成、保持结果 | 独立保持 | 普遍迁移 |
| Transfer | 安排、独立完成、迁移结果 | 独立迁移 | 总体能力已稳定 |
| Successor Governance | 风险、处理、恢复 | 资源风险修复 | 学生能力变化 |
| Calibration Review | 样本、完整性、复核 | 校准证据已复核 | 教育效果 |
| Feedback Projection | 形成、回退、后续动作 | 后续动作代理 | 学生已理解 |
| CoreAbilitySummary | 安全投射、消费机会 | 稳定 Profile 可投射 | 新能力结论 |

### 6.2 生命周期事件

只观察既有正式事实自然产生的：

```text
eligible
not_triggered
triggered
completed
interrupted
fallback
follow_up_observed
```

一个事件必须引用 `sourceDecisionId` 或 `sourceResultId`，并带有来源 Schema Version。未知来源版本不得猜测适配。

### 6.3 不在观察范围内

- 题目文本质量重新评价；
- 学生答案语义重判；
- 新 Diagnosis、Evidence 或 Profile 计算；
- 页面停留时间作为教育收益；
- 为观察而新增 Revision、Targeted、Retest 或 Transfer；
- 未触发能力的负面能力结论；
- 工程验收完成度作为产品收益。

## 七、真实数据准入

只有同时满足以下条件的 Event 才可进入真实分母：

```text
dataOrigin = real_learning
runtimeScope = product
studentIdentityAligned = true
sessionIdentityAligned = true
sourceFactValidated = true
studentId ∈ participatingStudentIds
occurredAt ∈ [startsAt, plannedEndsAt]
trialWindow.status = active
observationPolicyVersion 与 Window 一致
sourceSchemaVersion 已批准
```

以下来源只能进入排除统计：

- `internal_acceptance`；
- `fixture`；
- `demo`；
- `debug`；
- `browser_acceptance`；
- `legacy_unobserved`。

任何非真实来源进入真实分母都属于完整性事故。

## 八、中途巡检

巡检只验证运行稳定性和数据完整性，不提前形成能力去留结论。

### 8.1 每个活跃学习日检查

- Learning 是否正常完成；
- Observation 失败是否影响学生流程；
- Window 是否仍为 `active`；
- 当前模式是否仍为 `real_trial`；
- 新事件是否全部位于 Window 内；
- 学生、Session、Round、Attempt 身份是否对齐；
- 数据来源是否为 `real_learning / product`；
- 是否出现事件 ID 冲突；
- 是否出现学生正文或自由文本泄漏；
- 排除来源是否误入真实分母；
- Observation 写入缺口是否可由窗口内正式事实恢复。

没有学习行为的自然日记录为“无活跃日”，不得制造事件。

### 8.2 每 3—4 个活跃日检查

- 各能力 `eligible / triggered / completed` 计数；
- `notTriggered / interrupted / fallback` 计数；
- `distinctSessionCount` 和 `distinctActiveDayCount`；
- 来源 Schema Version 分布；
- Aggregate 是否可以从 Event 重建为相同 Snapshot；
- 维护成本事实是否完整；
- 是否发生 Registry、策略或 Feature Flag 漂移；
- 当前样本状态是否仍是诚实的 `collecting / no_opportunity / insufficient_sample / integrity_blocked`。

### 8.3 第 7—10 个自然日中期检查

中期检查只回答：

1. 是否可以安全继续运行；
2. 是否存在大面积观察缺口；
3. 是否需要关闭或失效当前 Window；
4. 是否有能力完全没有自然机会。

中期检查不得：

- 输出“能力有效 / 无效”；
- 生成默认关闭或退役执行命令；
- 因低频而放宽触发条件；
- 因学生表现改变题组；
- 把支持下改善升级为独立掌握。

### 8.4 第 14 日及之后

第 14 日后可以计算 `sampleStatus`，但每项能力独立判断：

```text
Window ≥ 14 日
distinctActiveDayCount ≥ 6
eligibleCount ≥ 10
completedCount ≥ 5
身份和来源完整性通过
无未解决的大范围观察缺口
```

满足以上条件才可成为 `review_ready`。时间达标但样本不足仍是 `insufficient_sample`。

## 九、巡检问题分级

### 9.1 P0：立即停止观察并失效窗口

- Observation 影响或阻断 Learning；
- 学生答案、Material、Question 或模型原文进入观察仓库；
- 跨学生身份污染；
- 非真实来源已经进入真实分母且无法无歧义隔离；
- Window、策略或 Registry 被静默改写；
- Aggregate 参与 Scheduler、Gate、Diagnosis、Evidence 或 Profile 决策。

处理顺序：

```text
observation mode → off
保留正式 Learning
Window → invalidated
记录 invalidationReasons
停止生成能力去留提案
```

### 9.2 P1：暂停并判断关闭或失效

- Observation Repository 连续不可用超过 24 小时且期间存在真实学习；
- 已知正式机会中超过 20% 无法形成可恢复观察；
- 来源 Schema 变化但 Adapter 尚未验收；
- Feature Flag、Owner Decision 或 Registry 在窗口中途改变；
- 大量事件出现身份不一致或冲突。

P1 不得通过修改历史事件继续原 Window。若语义边界发生变化，应关闭旧窗口并创建新窗口。

### 9.3 P2：记录并继续

- 单次可恢复写入失败；
- 幂等重复写入；
- 零分母；
- 某项能力自然无机会；
- 样本不足；
- 可重建 Aggregate 暂时不可用。

P2 不得被投射为学生失败或产品失败。

## 十、恢复边界

允许恢复：

- 使用稳定 `eventId` 补回 Window 内、来源事实仍存在且身份完全一致的缺失事件；
- 删除并重建 Aggregate Snapshot；
- 对相同 Proposal ID 幂等重试；
- Observation 模式关闭后继续正常 Learning。

禁止恢复：

- 补造 Window 启动前的历史事件；
- 根据页面文案或学生答案反推观察事件；
- 修改正式事实以适配观察 Schema；
- 将未知 Schema 猜测为当前版本；
- 在失效 Window 中继续写入；
- 把 Internal Acceptance 复制成 `real_learning`。

恢复行为必须记录恢复数量和原因，计入维护成本。

## 十一、结束条件

### 11.1 正常关闭

满足以下任一条件可正常关闭：

- 到达 `plannedEndsAt`；
- 已运行至少 14 日，参与者退出或后续无法继续，但完整性仍成立；
- 需要切换 Registry、策略、Feature Flag 或参与范围；
- 已达到预定运行目标且继续运行没有新增治理价值。

正常关闭不等于样本充分。

### 11.2 提前失效

出现 P0 或无法修复的 P1 时必须 `invalidated`。失效窗口：

- 保留审计事实；
- 不生成非 `insufficient_evidence` 的能力结论；
- 不与后续 Window 合并；
- 必须披露失效原因和受影响时间段。

### 11.3 结束操作顺序

```text
1. 停止新的真实 Observation 准入：mode → off
2. 等待已开始 Learning 的正式主链完成
3. 确认最后事件与正式事实对齐
4. 将 Window 转为 closed 或 invalidated
5. 冻结 closedAt 和 invalidationReasons
6. 重建最终 Aggregate Snapshot
7. 执行完整性审计
8. 逐能力计算 sampleStatus
9. 只为 review_ready 能力生成 Decision Proposal
10. 输出真实运行报告
```

禁止先生成结论再关闭 Window。

## 十二、结束验收标准

### 12.1 Window 级验收

- Window 状态为 `closed` 或 `invalidated`；
- `startsAt / plannedEndsAt / closedAt` 完整；
- Git、构建、Registry、策略和能力模式快照可追溯；
- 参与范围未发生静默变化；
- 所有排除来源有明确计数；
- Event、Snapshot、Proposal 身份可重建；
- Observation 没有改变任何正式学习事实。

### 12.2 能力级验收

每项能力独立披露：

- `eligibleCount`；
- `notTriggeredCount`；
- `triggeredCount`；
- `completedCount`；
- `interruptedCount`；
- `fallbackCount`；
- `benefitObservedCount`；
- `benefitNotObservedCount`；
- `distinctSessionCount`；
- `distinctActiveDayCount`；
- 分子、分母和比率；
- `sampleStatus`；
- 维护成本 Band；
- 完整性问题和适用限制。

### 12.3 决策边界

| 样本状态 | 允许输出 |
| --- | --- |
| `no_opportunity` | 当前无自然机会，保留但不扩展 |
| `collecting` | 继续收集 |
| `insufficient_sample` | 样本不足，不形成去留结论 |
| `integrity_blocked` | 完整性阻断，不形成去留结论 |
| `review_ready` | 可生成结构化内部 Decision Proposal |

即使 `review_ready`，Proposal 仍不能自动：

- 修改 Feature Flag；
- 停止业务事实写入；
- 删除代码；
- 删除历史资源或 Evidence；
- 改变已开始 Session；
- 对外宣称普遍教育效果。

## 十三、真实运行报告

真实运行报告必须与工程验收报告分开，至少包含：

1. Window 身份、起止时间和实际运行天数；
2. Git、构建、Registry、观察策略和决策策略版本；
3. 参与学生数、活跃天数和 Session 数；
4. 数据来源准入与排除计数；
5. 身份、Schema、恢复和完整性问题；
6. 八项能力的完整计数和比率；
7. 每项能力的 `sampleStatus`；
8. Revision / Targeted 支持下改善与 Retest / Transfer 独立表现分离；
9. 维护成本事实与 Band；
10. Decision Proposal、Reason Code 和限制；
11. 单学生试用边界；
12. 后续仅允许的版本化动作。

报告不得混入 Fixture、Demo、Debug、Browser Acceptance 或历史补造数据。

## 十四、单学生试用解释边界

单学生 14—28 日 Window 可以验证：

- 观察链是否稳定；
- 能力是否有自然触发机会；
- 触发后能否完成；
- 是否存在支持下改善或独立保持 / 迁移的个体趋势；
- 维护和恢复成本是否过高。

不能证明：

- 能力对所有学生普遍有效；
- 统计区分度稳定；
- 低频能力无价值；
- 未触发等于学生能力不足；
- 一次成功等于长期掌握；
- 工程稳定等于教育效果成立。

## 十五、运行验收矩阵

### 15.1 启动前 RTW-S01—RTW-S18

| ID | 验收项 | 通过标准 |
| --- | --- | --- |
| RTW-S01 | 工程基线 | 阶段 4 工程、Debug、浏览器和 Build 已通过 |
| RTW-S02 | 模式默认关闭 | 启动前为 `off` |
| RTW-S03 | Draft Window | 身份唯一且 Schema 完整 |
| RTW-S04 | 时间范围 | 14—28 日，时区明确 |
| RTW-S05 | 参与范围 | ID 稳定、范围冻结 |
| RTW-S06 | Registry 快照 | 版本与 Hash 可追溯 |
| RTW-S07 | 策略快照 | Observation / Decision Policy 冻结 |
| RTW-S08 | 能力模式 | 八项能力模式完整，且不启用新能力 |
| RTW-S09 | 来源 Schema | 批准版本清单完整 |
| RTW-S10 | 身份对齐 | Student / Session / Attempt 可验证 |
| RTW-S11 | 内容隔离 | Event 不含学生或材料正文 |
| RTW-S12 | Repository | 幂等、冲突、重建通过 |
| RTW-S13 | Fail-open | 观察失败不阻断 Learning |
| RTW-S14 | 隔离烟测 | 真实分母写入为 0 |
| RTW-S15 | 启动记录 | Git、Build、Window 与检查项完整 |
| RTW-S16 | 未解决问题 | 必须为空 |
| RTW-S17 | 正式来源 Adapter | 八类拟观察能力均从结构化 Owner Fact 只读接线 |
| RTW-S18 | 激活控制 | 唯一显式切换路径，失败或重启安全回到 `off` |

启动最低门槛：`18 / 18 PASS`。

### 15.2 运行中 RTW-R01—RTW-R16

| ID | 验收项 | 通过标准 |
| --- | --- | --- |
| RTW-R01 | Learning 主链 | 无观察引发的阻断或状态变化 |
| RTW-R02 | Active Window | 只有活动窗口准入 |
| RTW-R03 | Real Origin | 真实分母仅含 `real_learning / product` |
| RTW-R04 | 参与身份 | 非参与学生全部排除 |
| RTW-R05 | Window 时间 | 窗口外事件全部排除 |
| RTW-R06 | Schema 版本 | 未知版本完整性阻断 |
| RTW-R07 | 幂等 | 重复事实不重复计数 |
| RTW-R08 | 冲突 | 同 ID 不同 Hash 不静默覆盖 |
| RTW-R09 | 内容保护 | 无学生、题目或材料正文 |
| RTW-R10 | 排除统计 | Fixture / Debug / Browser 单独计数 |
| RTW-R11 | Aggregate 重建 | 相同事件得到相同 Snapshot |
| RTW-R12 | 零分母 | 显示 `not_available` |
| RTW-R13 | 样本状态 | 不提前投射有效 / 无效 |
| RTW-R14 | 恢复记录 | 恢复数量和原因完整 |
| RTW-R15 | 策略漂移 | 无静默 Registry / Policy / Flag 变化 |
| RTW-R16 | 中期结论 | 只决定继续、关闭或失效 |

### 15.3 结束时 RTW-E01—RTW-E16

| ID | 验收项 | 通过标准 |
| --- | --- | --- |
| RTW-E01 | 停止准入 | 先将 mode 设为 `off` |
| RTW-E02 | 主链完成 | 已开始 Learning 正常结束 |
| RTW-E03 | Window 终态 | `closed` 或 `invalidated` |
| RTW-E04 | 终态防回退 | 不能重新激活 |
| RTW-E05 | 最终 Snapshot | 可重建且身份稳定 |
| RTW-E06 | 来源计数 | 准入和排除分开披露 |
| RTW-E07 | 完整性审计 | 问题和受影响范围完整 |
| RTW-E08 | 样本判定 | 八项能力分别判断 |
| RTW-E09 | 支持 / 独立分离 | Revision / Targeted 不冒充 Retest / Transfer |
| RTW-E10 | 维护成本 | Band 有事实依据 |
| RTW-E11 | 提案门禁 | 非 `review_ready` 只能不足证据 |
| RTW-E12 | 非自动执行 | 无 Flag 切换、停止写入或删除 |
| RTW-E13 | 历史兼容 | Frozen / Attempt / Evidence / Profile 不变 |
| RTW-E14 | 真实报告 | 与工程验收报告分离 |
| RTW-E15 | 单学生限制 | 明确不外推普遍效果 |
| RTW-E16 | 后续边界 | 只形成显式版本化任务 |

## 十六、真实试用完成定义

只有同时满足以下条件，才可把运行状态标记为 `REAL TRIAL COMPLETED`：

1. 启动前 `RTW-S01—RTW-S18` 为 `18 / 18 PASS`；
2. Window 正常激活并有明确启动记录；
3. 运行巡检记录覆盖所有活跃学习日，`RTW-R01—RTW-R16` 无未解决失败；
4. 中期检查完成；
5. Window 已受控关闭或明确失效；
6. `RTW-E01—RTW-E16` 为 `16 / 16 PASS`；
7. 最终 Snapshot、完整性审计和真实运行报告完成；
8. 每项能力独立披露样本状态；
9. 没有用非真实来源替代真实样本；
10. 没有提前执行默认关闭、退役或代码删除。

`REAL TRIAL COMPLETED` 仍不等于 `EDUCATIONAL EFFECT PROVEN`。

## 十七、后续任务边界

真实试用结束后只允许进入以下任务之一：

- 样本不足：保持现状并继续真实使用；
- 高频有限收益：建立既有策略优化任务；
- 低频有限收益：建立默认关闭候选版本；
- 低频无收益且高维护：建立退役候选评审；
- 明确收益：保留能力，但不因此扩展新功能；
- 完整性阻断：修复观察链后创建新 Window。

任何默认关闭或退役都必须有独立契约、迁移、兼容、回滚和浏览器验收，不得在本 Window 中直接执行。

## 十八、冻结声明

`product_complexity_convergence_stage4_real_trial_window_operation_v1` 冻结以下事实：

1. 真实试用必须显式启动，工程就绪不等于自动启动；
2. 一个 Window 原则上持续 14—28 日；
3. 观察不能影响 Learning 或既有能力 Owner Decision；
4. 只有活动窗口内准入的 `real_learning / product` 进入真实分母；
5. 参与范围、Registry、策略、能力模式和来源 Schema 在激活时冻结；
6. 中途实质变化必须关闭旧 Window 并创建新 Window；
7. 巡检只判断运行完整性，不提前判断能力价值；
8. 样本状态按能力分别判断；
9. 14 日只是最早复核时间，不是有效性证明；
10. Revision / Targeted 支持下改善与 Retest / Transfer 独立证据必须分离；
11. Observation 失败不得阻断 Learning；
12. 默认关闭和退役只形成提案，不能自动执行；
13. 单学生结果不能外推普遍教育效果；
14. 真实运行报告必须与工程验收报告分开；
15. 真实试用完成不等于教育效果已证明。

本文档已经达到 `DESIGN FROZEN / ACTIVATION PREFLIGHT REQUIRED`。在 `RTW-S01—RTW-S18` 全部通过并形成真实启动记录前，Observation Mode 必须保持 `off`，当前运行状态继续为 `REAL TRIAL NOT STARTED`。
