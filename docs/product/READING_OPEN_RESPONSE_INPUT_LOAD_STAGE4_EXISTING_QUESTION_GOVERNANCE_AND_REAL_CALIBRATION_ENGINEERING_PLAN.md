# 阅读开放文本题输入负担阶段 4 既有题治理与真实校准工程实施及 Debug 验收清单

英文名称：Reading Open-response Input-load Stage 4 Existing-question Governance and Real-calibration Engineering Plan

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED / FORMAL GOVERNANCE CLOSURE APPLIED / REAL CALIBRATION PENDING`

文档版本：`reading_open_response_input_load_stage4_engineering_plan_v1`

输出日期：`2026-08-21`

上位契约：[阅读开放文本题难度梯度与输入负担优化契约](./READING_OPEN_RESPONSE_DIFFICULTY_AND_INPUT_LOAD_OPTIMIZATION_CONTRACT.md)

前置阶段：[阶段 3 质量门禁、题组顺序与发布一致性工程实施及 Debug 验收清单](./READING_OPEN_RESPONSE_INPUT_LOAD_STAGE3_QUALITY_GATE_AND_SEQUENCE_ENGINEERING_PLAN.md)

真实数据边界：[真实 Learning 数据采集与观察契约](./REAL_LEARNING_DATA_COLLECTION_AND_OBSERVATION_CONTRACT.md)

采用发布边界：[AI 训练任务、题目采用与真实作答校准契约](./AI_QUESTION_ADOPTION_AND_EMPIRICAL_CALIBRATION_CONTRACT.md)

## 一、阶段目标

阶段 4 把阶段 1 的只读基线审计结果、阶段 2 的生成规划与阶段 3 的发布门禁用于两项受控工作：

1. 对确有负担问题的既有正式开放文本题逐题生成后继 Candidate；
2. 在真实 Learning 中观察完成、无效输入、提示、修订和后续独立表现，校准推荐长度与门禁阈值。

阶段 4 不重建题库，不增加人工改题或审核步骤，也不允许自动覆盖正式版本。

唯一生产决策继续保持：

```text
采用并发布
或
不采用并重新优化
```

工程完成与真实校准必须分别表述：

```text
ENGINEERING COMPLETE
≠ REAL CALIBRATION COMPLETE
≠ EDUCATIONAL EFFECT PROVEN
```

2026-08-21 正式题治理已按本计划完成受控收口。系统没有批量重写既有题库，只对《春》和《女娲造人》各形成并发布一个后继版本；12 个核心阅读题组按 Learning 实际消费顺序复审后，阅读入口缺失与无理由负担跳跃均为 `0`。完整事实见：[阅读开放文本题正式题治理收口报告](../education/phase/reports/reading_open_response_formal_question_governance_closure_2026-08-21.md)。

同日继续按 `3—5` 道小批次边界完成高风险治理第一批：仅替换《狼》《猫》《秋天的怀念》3 道 `regenerate` 正式题的活动继任版本，活动题量与质量轨迹仍为 `81`，`regenerate` 已降为 `0`。完整事实见：[阅读开放文本题高风险正式题治理第一批报告](../education/phase/reports/reading_open_response_formal_question_high_risk_governance_batch1_2026-08-21.md)。

第二批已按小批次原则完成《皇帝的新装》《猫》《天上的街市》各 1 道 `composite_core_actions` 正式题治理，三个后继版本均通过题组去重、只读演练和全链路回归。实施边界见：[正式题第二批聚焦治理实施与 Debug 验收计划](./READING_OPEN_RESPONSE_FORMAL_QUESTION_FOCUSED_GOVERNANCE_BATCH2_PLAN.md)，结果见：[正式题第二批聚焦治理报告](../education/phase/reports/reading_open_response_formal_question_focused_governance_batch2_2026-08-21.md)。

## 二、当前基线与进入条件

阶段 1 执行时基线为：

| 项目 | 数量 |
| --- | ---: |
| 活动材料 | 24 |
| 活动正式题 | 79 |
| 开放文本题 | 62 |
| 单项选择题 | 17 |
| retain | 21 |
| copy_or_length_adjustment | 11 |
| decompose_or_refocus | 27 |
| regenerate | 3 |

上述数字是带策略版本、Source Digest 与 Audit Digest 的执行时快照，不是永久常量。阶段 4 启动时必须重新生成只读治理清单，并记录当时的正式版本身份；不得把旧数量写死为运行时门禁。

阶段 4 进入条件已经满足：

- 阶段 1 `28 / 28 PASS`，正式题审计零写入；
- 阶段 2 `40 / 40 PASS`，Planner、Prompt 与长度策略已冻结；
- 阶段 3 `48 / 48 PASS`，ready / advisory / blocked / stale / publishing / published 浏览器状态验收通过；
- Candidate → Adopt → Revision → Publish 主链保持唯一；
- Learning Session Task Queue 与 History 回归通过；
- 正式资源、活动 Session 和 Student Ability Profile 未被阶段 1—3 测试修改。

## 三、阶段边界

### 3.1 本阶段允许

- 从版本化审计结果创建只读治理 Case；
- 按优先级逐题生成完整后继 Candidate；
- 对 Candidate 复用阶段 3 单题与题组门禁；
- 用户采用后形成新的 Revision 与 Frozen Question Version；
- 新 Session 消费新的活动版本，已打开 Session 继续使用启动时冻结版本；
- 记录绑定真实 `resourceVersionId` 的最小过程事实；
- 对真实有效样本形成版本级校准投影；
- 在样本不足时显示事实数量，不输出伪稳定结论。

### 3.2 本阶段禁止

- 原地编辑、删除或覆盖 Frozen Question Version；
- 一键批量采用或整批自动发布；
- 因审计 Finding 自动撤回当前正式题；
- 要求用户填写审核人、审核意见或逐字段修题；
- 为形成漂亮梯度机械补齐每个 `loadLevel`；
- 把 `recommendedMin / recommendedMax` 显示给学生；
- 把 `loadLevel`、作答时间或一次失败写入 Student Ability Profile；
- 用 Demo、Fixture、浏览器隔离数据制造真实校准样本；
- 跨 Question Version 合并样本；
- 在少量或单学生样本下宣称统计稳定、能力提升或教育效果已证明。

### 3.3 不在本阶段解决

- 多学生账号与跨设备同步；
- 云端集中统计与学校级运营；
- 新的人工审核角色；
- 第二次或无限次反馈后修订；
- 自动修改 Prompt、Rubric 或 Answer Acceptance；
- 基于单次异常自动生成并发布替代题。

## 四、治理优先级与批次规则

### 4.1 优先级

治理顺序按确定性风险与学生负担排序：

1. `regenerate`：证据范围不足、题干与 Rubric 或 responseFormat 根本不一致；
2. `decompose_or_refocus`：多个独立核心动作、对象或关系负担过载、隐藏 Required Rubric；
3. `copy_or_length_adjustment`：题意成立，仅需文案、最低字数或提示负担收敛；
4. `retain`：保持当前正式版本，不为完成指标而制造 Candidate。

同级时优先处理：

- 位于题组入口且形成无理由高负担跳跃的题；
- 在 Learning 中已经出现明确无效输入或高主动退出的题；
- 与其他任务重复观察同一对象、证据范围和评分目标的题；
- 影响后续 Targeted、Retest 或 Transfer 匹配的题。

### 4.2 批次大小

第一版每批最多治理 `3—5` 道题，并且：

- 同一时刻每道正式题最多有一个活动治理 Candidate；
- 每批发布后先运行完整回归与新 Session 消费检查，再开启下一批；
- 批次失败只回滚本批新版本，不回滚既有正式版本或其他材料；
- 未采用 Candidate 不进入 Registry、Observation Link 或 Learning；
- 不以“本批数量不足”为由强行生成低价值替代题。

### 4.3 停止条件

出现以下任一条件时暂停该题或该批治理：

- 当前正式版本身份与审计快照不一致；
- 新 Candidate 无法通过阶段 3 blocker；
- 为降低负担必须牺牲 Observation Plan 的主要能力或高阶观察；
- 新题与题组现有任务形成实质重复；
- 新版本发布后 Learning 消费身份不一致；
- 同一问题连续两次重新生成仍无法形成合格 Candidate；
- 真实数据完整性审计失败；
- 用户明确不采用。

暂停不等于删除题目。系统保留当前活动正式版本，并将 Case 标记为等待重新规划或更多证据。

## 五、治理 Case 契约

### 5.1 定位

阶段 4 可以建立 `ExistingQuestionGovernanceCase`，但它只能是版本化审计结果的旁路索引，不是第二套题目、审核或发布对象。

最小字段：

```text
governanceCaseId
questionLineageId
sourceResourceVersionId
materialVersionId
observationTaskPlanId
baselineAuditVersion
sourceDigest
auditDigest
disposition
findingCodes
priority
status
activeCandidateId?
successorResourceVersionId?
createdAt
updatedAt
schemaVersion
```

`status` 只允许：

```text
queued
candidate_ready
blocked
adopted
published
rejected
deferred
stale
```

这些状态只用于治理跟踪，不得投射成新的人工步骤。用户仍只看到完整 Candidate 以及“采用并发布 / 重新优化”。

### 5.2 稳定身份与幂等

`governanceCaseId` 至少由以下身份确定：

```text
questionLineageId
+ sourceResourceVersionId
+ baselineAuditVersion
+ auditDigest
```

相同审计快照重复创建必须返回同一 Case；正式版本变化后旧 Case 进入 `stale`，不得继续采用。

### 5.3 Finding 到生成约束

Finding 只能转译为生成约束，不能直接改写正式题：

| Finding | 生成约束 |
| --- | --- |
| composite_core_actions | 保留一个主要动作，必要时将其余动作移出本题 |
| hidden_rubric_requirement | Required Rubric 不得超出题干显式要求 |
| evidence_scope_insufficient | 缩小问题范围或扩大合法证据范围，但不得伪造材料依据 |
| object_scope_overloaded | 聚焦一个主要对象或明确对象之间的单一关系 |
| relation_load_overloaded | 保留一个主要关系，避免同时要求多层结构与情感推断 |
| response_format_load_mismatch | 调整 responseFormat 或题目负担，保持主要训练目标 |
| minimum_length_overweighted | 降低最低要求；内部推荐区间不进入学生界面 |
| minimum_length_under_supports_rubric | 收敛 Rubric 或调整内部作答形式，不机械提高学生字数门槛 |

## 六、后继 Candidate 与发布规则

### 6.1 必须保持的身份

后继 Candidate 必须绑定：

- 原 `questionLineageId`；
- 当前活动 `sourceResourceVersionId`；
- `materialVersionId` 与 `observationTaskPlanId`；
- 阶段 2 Planner intent、generation trace 与 Prompt 版本；
- 阶段 3 单题和题组 Assessment；
- 触发治理的 Case 与 Finding；
- 明确的 predecessor Frozen Version。

### 6.2 允许变化

只有满足治理目标的字段允许变化：

- 题干表达；
- responseFormat；
- 作答要求与最低约束；
- Rubric、Answer Acceptance 与提示；
- 题组 `sequenceRank`；
- 证据范围，但必须仍由当前材料支持。

主要能力、观察对象或任务角色发生变化时，不再视为同题优化；必须回到 Observation Plan 重新规划，不能挂在原 Case 下静默替换。

### 6.3 发布行为

```text
Candidate ready
→ 用户采用并发布
→ adoption_completed
→ validation
→ assessment
→ publication
→ new Frozen Question Version
→ Registry / Observation Link 原子更新
```

- 任何阶段失败都保留已完成阶段结果并允许幂等恢复；
- 内容 blocker 返回重新优化；
- 技术中断返回继续发布；
- 只有 `publication_completed` 才显示“已发布”；
- 旧 Frozen Version 永久保留且可追溯；
- 活动 Session 继续消费启动时冻结版本；
- 新 Session 只消费 Registry 当前活动版本。

## 七、真实 Learning 校准契约

### 7.1 最小事实

阶段 4 复用现有五事件闭环：

```text
question_presented
→ answer_submitted
→ diagnosis_completed
→ feedback_presented
→ learning_round_completed
```

为校准输入负担，允许增加版本化、最小必要的过程事实：

```text
presentedAt
firstInputAt?
submittedAt?
completedAt?
lastActivityAt?
hintOpened
responseValidity
revisionOffered
revisionSubmitted
taskExitReason?
timingPolicyVersion
```

不得记录逐键内容、鼠标轨迹、剪贴板、其他页面或推断情绪。

### 7.2 有效样本资格

只有同时满足以下条件的产品记录可以进入题目版本级校准：

- 使用正式产品学生身份；
- 绑定实际消费的 Material 与 Frozen Question Version；
- `answer_submitted`、Diagnosis、正式评分和 `learning_round_completed` 完整；
- Response Validity 允许进入 Diagnosis；
- 事件身份与 Learning Session / Round / Attempt 一致；
- 不属于 Demo、Fixture、隔离浏览器或开发验证；
- 未被标记为大量成人代答；
- 同一 Attempt 没有重复投影。

无效或未完成提交可以用于流程完整性审计，但不得进入题目质量样本分母。

### 7.3 版本级指标

每个 `resourceVersionId` 至少形成以下事实指标：

- 展示次数；
- 有效提交数；
- 完成数与完成率；
- 无效输入数；
- 主动退出数；
- 提示打开数与提示打开率；
- `does_not_meet / partially_meets / meets` 分布；
- 首次输入前时间、有效作答时间与完成时间的中位数；
- Revision 提供数、提交数和改善类型；
- 后续无提示 Retest / Transfer 中同类具体缺口是否再次出现。

指标只能说明真实行为和结果分布，不能单独证明题目质量或学生能力。

### 7.4 样本状态

继续沿用版本化状态：

```text
awaiting_data
→ insufficient_sample
→ calibrated
```

- `calibrated` 只表示达到当前试运行策略的初步计算门槛；
- 当前 `30` 份阈值是产品治理试运行阈值，不是永久统计学标准；
- 单学生重复作答不得冒充独立学生样本；
- 不同 Question Version 的数据不得合并；
- 样本不足时只显示样本数和事实，不显示伪百分比或稳定性结论；
- 阈值、分母和排除规则必须记录策略版本。

### 7.5 允许形成的治理信号

真实数据可以提出：

- 题干可能不清；
- 证据范围可能不足；
- 最低要求或 responseFormat 可能不匹配；
- 提示使用率异常；
- 进入负担可能过高；
- Revision 后仍反复出现同一具体缺口。

治理信号只能创建新的 Case 或后继 Candidate 建议，不能自动修改、撤回或发布题目。

## 八、工作包

### WP4.1 基线快照与 Case Repository

- 冻结阶段 4 启动时的 Source Digest、Audit Digest 和活动版本身份；
- 建立 Case Schema、Guard 与幂等 Repository；
- 支持 priority、status、Candidate 与 successor Version 追踪；
- 正式版本变化时确定性投影为 stale；
- 不复制题目正文形成第二套正式数据。

### WP4.2 治理队列与批次规划

- 按 `regenerate → decompose_or_refocus → copy_or_length_adjustment` 排序；
- 默认跳过 retain；
- 每批限制 `3—5` 道；
- 同题只允许一个活动 Candidate；
- 支持 deferred、rejected 和批次暂停；
- 不提供批量采用或批量发布。

### WP4.3 后继 Candidate 生成

- 将 Finding 转译为 Planner / Prompt 约束；
- 保留原主要能力、观察对象和任务角色；
- 生成完整题干、Rubric、Answer Acceptance、提示与 responseFormat；
- 最多执行一次受控修复；
- 两次失败后停止自动重试并进入 deferred；
- 保存治理 Case、规则版本和 generation trace。

### WP4.4 阶段 3 门禁复用与发布接续

- 复用单题、题组 Assessment 和 readiness；
- 检查 Candidate、Draft、题组快照和 predecessor Version 身份；
- advisory 不增加人工确认；
- blocker / stale 在当前卡附近提供恢复入口；
- 采用发布使用现有幂等阶段结果；
- 发布成功后原位显示新版本，旧错误清除。

### WP4.5 Learning 版本消费与过程事实

- 新 Session 消费 Registry 当前版本；
- 活动 Session 保持启动时冻结版本；
- 扩展最小输入负担过程事实和 `timingPolicyVersion`；
- 采集失败不阻断学习主链，进入既有 Outbox 恢复；
- 学生界面不显示内部 `loadLevel` 与推荐长度区间；
- 不因单次高负担题失败降低学生能力等级。

### WP4.6 校准投影与完整性审计

- 建立版本级有效样本资格检查；
- 去重同一 Attempt；
- 计算完成、无效输入、提示、修订和时间指标；
- 将 Retest / Transfer 保持结果与即时 Revision 分开；
- 输出排除原因和分母来源；
- Demo / Fixture / Product 数据严格隔离。

### WP4.7 内部观察页与停止控制

- 按 Material、Question Lineage 与 Version 展示治理 Case；
- 分开显示工程状态、样本状态和教育结论边界；
- 支持暂停某题、某批或整个阶段 4 治理；
- 显示当前活动版本和 predecessor；
- 不提供人工改题表单；
- 不把 `calibrated` 翻译为“质量已验证”。

### WP4.8 工程收口与真实观察启动

- 完成专项 Debug、关键回归、生产构建与真实浏览器验收；
- 归档工程验收报告；
- 固定首批治理清单与回滚点；
- 在工程验收后单独启动真实使用观察；
- 工程完成时仍保持 `REAL CALIBRATION PENDING`，直到真实样本满足约定观察条件。

## 九、专项 Debug 矩阵

阶段 4 专项最低验收为 `56 / 56`。

### 9.1 Case 与快照：S4-01—S4-10

| 编号 | 验收项 | 预期 |
| --- | --- | --- |
| S4-01 | 相同审计快照重复创建 Case | 返回同一身份 |
| S4-02 | 不同 Question Version | 不合并 Case |
| S4-03 | 正式版本变化 | 旧 Case stale |
| S4-04 | retain 题 | 默认不创建活动 Candidate |
| S4-05 | regenerate 题 | 优先级最高 |
| S4-06 | Finding 白名单 | 非法 Finding 被拒绝 |
| S4-07 | 缺少 source/audit digest | Case 被拒绝 |
| S4-08 | 同题已有活动 Candidate | 不重复生成 |
| S4-09 | Case 只保存引用 | 不复制正式题为新资源 |
| S4-10 | 重复命令 | 幂等 |

### 9.2 批次与生成：S4-11—S4-22

| 编号 | 验收项 | 预期 |
| --- | --- | --- |
| S4-11 | 批次超过 5 道 | 被拒绝或收敛 |
| S4-12 | 批次只含 retain | 不生成无意义 Candidate |
| S4-13 | Finding 转译 | 进入 Planner / Prompt 约束 |
| S4-14 | 主要能力变化 | 回到 Observation Plan，不静默替换 |
| S4-15 | 三个独立核心动作 | 不产生 Candidate |
| S4-16 | hidden Rubric | 题干与 Required Rubric 对齐 |
| S4-17 | 证据范围不足 | 缩小问题或合法扩大范围 |
| S4-18 | 最低要求过重 | 学生门槛收敛 |
| S4-19 | responseFormat 错配 | 形成一致完整方案 |
| S4-20 | 一次受控修复成功 | 只产生一个可采用 Candidate |
| S4-21 | 两次连续失败 | deferred，不无限重试 |
| S4-22 | 未采用 Candidate | 正式资源零写入 |

### 9.3 门禁与发布：S4-23—S4-34

| 编号 | 验收项 | 预期 |
| --- | --- | --- |
| S4-23 | ready Candidate | 允许采用并发布 |
| S4-24 | advisory-only Candidate | 仍可发布，无人工确认 |
| S4-25 | blocker Candidate | 只允许重新优化 |
| S4-26 | stale Candidate | 只允许重新检查 |
| S4-27 | publishing | 不重复显示可点击发布按钮 |
| S4-28 | 发布重试 | 不制造第二 Revision |
| S4-29 | 发布成功 | 新 Frozen Version 与 Registry 原子一致 |
| S4-30 | predecessor | 旧版本保留可追溯 |
| S4-31 | Observation Link | 指向新活动版本且身份一致 |
| S4-32 | 发布中断 | 保留阶段结果并可恢复 |
| S4-33 | 活动 Session | 不被新版本改写 |
| S4-34 | 新 Session | 消费新活动版本 |

### 9.4 Learning 与校准：S4-35—S4-48

| 编号 | 验收项 | 预期 |
| --- | --- | --- |
| S4-35 | 正式五事件完整 | 可形成待校准 Attempt |
| S4-36 | 未完成 Round | 不进入有效分母 |
| S4-37 | 无效答案 | 不进入题目质量样本 |
| S4-38 | Demo / Fixture | 与 Product 严格隔离 |
| S4-39 | 重复投影 | 同一 Attempt 只计一次 |
| S4-40 | 不同 Version | 样本不合并 |
| S4-41 | 首次输入时间 | 由事件事实计算 |
| S4-42 | 无活动暂停 | 按 timingPolicyVersion 处理 |
| S4-43 | 提示打开 | 只记录布尔事实，不推断能力 |
| S4-44 | Revision | 与首次独立表现分开 |
| S4-45 | Retest / Transfer | 与即时修订分开验证保持 |
| S4-46 | 样本不足 | 只显示事实数量 |
| S4-47 | 30 份阈值 | 记录策略版本，不宣称统计稳定 |
| S4-48 | Student Ability Profile | 不写入 loadLevel 或题目负担结论 |

### 9.5 状态恢复与零污染：S4-49—S4-56

| 编号 | 验收项 | 预期 |
| --- | --- | --- |
| S4-49 | Case Repository 重载 | 状态可恢复 |
| S4-50 | Candidate adoption receipt 重载 | 不重复采用 |
| S4-51 | Outbox 补写 | 事件幂等恢复 |
| S4-52 | Registry 冲突 | 进入显式重试，不覆盖他人版本 |
| S4-53 | 批次暂停 | 当前正式题继续可消费 |
| S4-54 | 回滚新版本 | predecessor 可恢复且历史不丢失 |
| S4-55 | 自动化与浏览器验收 | 不写入正式学生样本 |
| S4-56 | 完整性报告 | 能区分工程数据、真实数据与排除数据 |

## 十、真实浏览器验收矩阵

自动化通过后执行以下 `B4-01—B4-16`：

| 编号 | 浏览器路径 | 必须结果 |
| --- | --- | --- |
| B4-01 | 治理列表读取当前快照 | 只显示当前快照中的待治理题，`retain` 默认不要求处理 |
| B4-02 | 打开 `regenerate` Case | 能看到原题、问题摘要和完整后继 Candidate |
| B4-03 | 候选决策入口 | 只有“采用并发布 / 重新优化”，无字段编辑与审核人入口 |
| B4-04 | `blocked / stale` | 状态在当前卡片就近出现，并给出重新优化或重新审计的恢复方向 |
| B4-05 | `advisory` | 不阻断发布，也不产生二次确认 |
| B4-06 | `publishing` | 当前卡片只有一个不可重复触发的发布运行态按钮 |
| B4-07 | 发布成功 | 原位显示新版本，旧正式版本仍可追溯 |
| B4-08 | 发布前已打开的 Learning Session | 继续使用启动时冻结的旧版本 |
| B4-09 | 发布后新建 Learning Session | 消费新版本，并正确展示 `responseFormat`、题干和提示 |
| B4-10 | 刷新、退出、恢复和重复提交 | 恢复同一 Attempt，不制造重复 Attempt |
| B4-11 | 内部校准观察 | 能区分 `awaiting_data / insufficient_sample / calibrated` |
| B4-12 | Demo / Fixture / 隔离浏览器记录 | 不进入真实校准分母 |
| B4-13 | 页面底部触发错误 | 错误在当前操作区域就近可见，不要求滚动到顶部 |
| B4-14 | 暂停治理批次 | 现有正式 Learning 与已冻结 Session 不受影响 |
| B4-15 | 过程事实写入失败 | 不阻断 Learning 主链，并保留可补写或完整性问题事实 |
| B4-16 | 页面刷新后恢复 | 治理身份、版本级校准状态和完整性边界保持一致 |

浏览器工程验收应优先使用隔离 Repository 或开发验证模式。只有明确使用正式产品身份、真实作答并通过资格检查的数据，才允许进入真实观察；工程验收本身不得计入真实样本。

## 十一、回归基线

阶段 4 工程完成后至少运行：

```bash
pnpm run debug:reading-open-response-load-stage4
pnpm run debug:reading-open-response-load-stage3
pnpm run debug:reading-open-response-load-stage2
pnpm run debug:reading-open-response-load-stage1
pnpm run debug:question-candidate-workflow
pnpm run debug:question-candidate-workbench-p4
pnpm run debug:question-workbench-command-e2e
pnpm run debug:task-publication-orchestration
pnpm run debug:reading-single-choice-stage4
pnpm run debug:targeted-micro-training-stage4
pnpm run debug:learning-feedback-revision-stage4
pnpm run debug:learning-session-task-queue
pnpm run debug:learning-session-history
pnpm run build
```

如果实际 package script 名称不同，工程报告必须记录使用的真实命令，不得用不存在的计划命令宣称通过。

构建提示与失败必须分开记录；既有 chunk 大小提示不等于本阶段失败，但不得隐藏。

## 十二、完成状态与验收门

### 12.1 工程完成

只有同时满足以下条件，才能标记 `ENGINEERING COMPLETE / DEBUG ACCEPTED`：

- [x] WP4.1—WP4.8 工程实现已落地；
- [x] S4-01—S4-56 全部通过；
- [x] 阶段 1—3 继续通过；
- [x] Candidate、发布、单选、Targeted、Revision 与 Learning 回归通过；
- [x] 生产构建退出码为 0；
- [x] B4-01—B4-16 真实浏览器矩阵全部通过；
- [x] 正式资源版本迁移只通过后继 Candidate 完成；
- [x] 活动 Session 版本冻结与新 Session 当前版本消费均通过；
- [x] Demo / Fixture / Product 数据隔离通过；
- [x] 工程与 Debug 验收报告已归档。

2026-08-21 工程实施结果：工程代码、`56 / 56` 专项 Debug、关键回归、生产构建及 `B4-01—B4-16` 全量真实应用内浏览器矩阵已通过；刷新恢复后仍为 `16 / 16 PASS`，控制台无新增错误。验收运行范围固定为 `debug`，不进入真实校准样本。

### 12.2 真实校准启动

工程完成后才允许标记 `REAL OBSERVATION ACTIVE`，并且必须：

- 使用真实产品身份进入正式 `/learning`；
- 记录观察开始时间、策略版本和当前 Git/build 身份；
- 先进行单学生、小批题目观察；
- 保留原始版本与后继版本的独立样本；
- 定期运行完整性审计；
- 发现身份、事件或分母异常时立即暂停投影。

### 12.3 真实校准完成

不得仅因代码、Fixture 或浏览器路径通过而标记完成。第一轮至少需要：

- 预先定义的观察周期已结束；
- 有效真实 Attempt 达到当前策略要求；
- 指标分母与排除项可审计；
- 同一 Question Version 内数据一致；
- Revision 与后续独立 Retest / Transfer 分开解释；
- 结论使用“观察到”“可能”“需要继续验证”，不使用“已经证明能力提升”。

在单学生试用阶段，即使某题达到 `30` 次有效作答，也只能形成产品治理初步信号，不能外推到群体统计结论。

## 十三、回滚点

阶段 4 至少保留以下回滚能力：

- 停止创建新治理 Case；
- 暂停某批 Candidate 生成；
- 关闭真实校准投影但不阻断 Learning；
- 将 Registry 活动版本恢复到 predecessor；
- 保留已产生的历史 Version、Attempt、事件和审计记录；
- 重放 Outbox 时保持幂等；
- 不因回滚删除真实学生回答或历史 Diagnosis。

回滚不得通过原地编辑旧 Frozen Version 实现。

## 十四、交付物

阶段 4 工程至少交付：

1. `ExistingQuestionGovernanceCase` Schema、Guard 与 Repository；
2. 版本化治理队列与批次规划服务；
3. Finding 到 Candidate 约束适配；
4. 阶段 3 readiness 与现有发布主链接入；
5. Learning 输入负担过程事实与策略版本；
6. 版本级校准投影与完整性报告；
7. 内部观察与暂停控制界面；
8. S4-01—S4-56 专项 Debug；
9. 真实浏览器验收记录；
10. 工程与 Debug 验收报告；
11. 真实观察启动记录与后续校准报告模板。

## 十五、冻结结论

阶段 4 不是把全部既有题重新生成一次，而是建立一个受控闭环：

```text
版本化审计
→ 少量高风险题
→ 完整后继 Candidate
→ 同源质量门禁
→ 用户一次采用并发布
→ 新 Session 真实消费
→ 版本绑定的真实观察
→ 只形成下一轮治理信号
```

产品原则保持不变：

```text
系统负责分析、生成、检查、发布恢复和数据归纳；
人只负责采用，或不采用并重新优化；
真实数据负责校准规则，但不自动替代人的采用决定。
```

当前已完成阶段 4 工程实现、专项 Debug、关键回归、生产构建和 `B4-01—B4-16` 全量真实浏览器验收。工程验收门已关闭，下一步只进入真实使用观察；当前仍必须保持 `REAL CALIBRATION PENDING`，不得宣称统计稳定或教育效果已被证明。
