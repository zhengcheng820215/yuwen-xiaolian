# 知识练习可用产品第一阶段执行清单

状态：`ACTIVE / WP1–WP6 + WP7A + WP7B ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING (0 / 5)`

版本：`knowledge_practice_usable_product_phase1_execution_v1.0`

日期：`2026-08-29`

上位方案：[`KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md`](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md)

入口与资源角色决策：[`STUDENT_SINGLE_ENTRY_FORMAL_READING_AND_KNOWLEDGE_PRACTICE_ALIGNMENT_DECISION_WP0A.md`](./STUDENT_SINGLE_ENTRY_FORMAL_READING_AND_KNOWLEDGE_PRACTICE_ALIGNMENT_DECISION_WP0A.md)

## 一、使用规则

本文只跟踪第一阶段 `WP1—WP4 → WP7A → WP5 → WP6 → WP7B` 的实施、测试、验收证据、阻塞项和已知限制，不重新定义产品规则。

状态统一使用：

| 状态 | 含义 |
| --- | --- |
| `PENDING` | 尚未开始 |
| `IN PROGRESS` | 正在实施，尚未满足完成条件 |
| `ENGINEERING PASS` | 代码和自动化验收通过 |
| `PRODUCT ACCEPTANCE PENDING` | 工程通过，等待真实学生验收 |
| `PRODUCT ACCEPTANCE PASS` | 真实学生受控验收通过 |
| `BLOCKED` | 存在明确阻塞，必须记录原因和解除条件 |

规则：

- 每个时刻最多一个工作包处于 `IN PROGRESS`；
- 工作包只有在代码、测试和人工验收证据齐全时才能标记 `ENGINEERING PASS`；
- 不使用笼统的“已完成”代替分层状态；
- 代码路径、测试命令和验收结果必须填写真实证据；
- Product Acceptance 和 Live 不因自动化测试通过而自动升级。

## 二、固定决策摘要

| 决策 | 已确认口径 |
| --- | --- |
| 内容范围 | 七年级上册 |
| 专项题量 | 默认 5 道 |
| 综合题量 | 默认 10 道 |
| 学生唯一入口 | `/learning` |
| 知识练习角色 | `/learning` 内的 `knowledge_practice` 轻量辅助任务家族 |
| 正式题库 | 81 道正式题保持 Resource / Learning 契约，不并入轻量 Store |
| 轻量题量 | 100 道仅为内容建设目标，由覆盖、重复率和枯竭率校准 |
| 填空判定 | 严格答案与显式 `acceptedAnswers` |
| 恢复范围 | 本机、本浏览器 |
| 结果指标 | 首次正确率，不展示“得分” |
| 事实边界 | 知识练习不直接生成正式 Evidence / Profile |
| 实施顺序 | `WP7A → WP5 → WP6 → WP7B` |
| 真实学生验收 | 产品负责人组织至少 5 次受控试用 |

## 三、总进度

| 工作包 | 名称 | 状态 | 依赖 | 工程证据 | 产品证据 |
| --- | --- | --- | --- | --- | --- |
| WP1 | 数据契约与基线迁移 | `ENGINEERING PASS` | 无 | [迁移与工程验收报告](./KNOWLEDGE_PRACTICE_PHASE1_WP1_MIGRATION_REPORT.md) | 不适用 |
| WP2 | 练习会话与选题 | `ENGINEERING PASS` | WP1 | [WP2工程验收报告](./KNOWLEDGE_PRACTICE_PHASE1_WP2_ENGINEERING_ACCEPTANCE_REPORT.md) | 不适用 |
| WP3 | 判题、响应与逐题反馈 | `ENGINEERING PASS` | WP1、WP2 | [WP3工程验收报告](./KNOWLEDGE_PRACTICE_PHASE1_WP3_ENGINEERING_ACCEPTANCE_REPORT.md) | 不适用 |
| WP4 | 持久化与恢复 | `ENGINEERING PASS` | WP2、WP3 | [WP4工程实施文档](./KNOWLEDGE_PRACTICE_PHASE1_WP4_LOCAL_PERSISTENCE_AND_RECOVERY_PLAN.md) | [WP4工程验收报告](./KNOWLEDGE_PRACTICE_PHASE1_WP4_ENGINEERING_ACCEPTANCE_REPORT.md) |
| WP0A | 入口与资源角色对齐 | `DECISION CONFIRMED` | 审计完成 | [WP0A决策](./STUDENT_SINGLE_ENTRY_FORMAL_READING_AND_KNOWLEDGE_PRACTICE_ALIGNMENT_DECISION_WP0A.md) | 产品负责人 D1—D8 已确认 |
| WP7A | 唯一入口最小整合 | `ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING` | WP0A、WP1—WP4 | [WP7A工程验收报告](./KNOWLEDGE_PRACTICE_PHASE1_WP7A_ENGINEERING_ACCEPTANCE_REPORT.md) | 真实学生验收待 WP7B |
| WP5 | 错题即时巩固 | `ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING` | WP7A Engineering PASS | [WP5工程验收报告](./KNOWLEDGE_PRACTICE_PHASE1_WP5_ENGINEERING_ACCEPTANCE_REPORT.md) | 真实学生验收待 WP7B |
| WP6 | 结果摘要与下一步推荐 | `ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING` | WP5 | [WP6工程验收报告](./KNOWLEDGE_PRACTICE_PHASE1_WP6_ENGINEERING_ACCEPTANCE_REPORT.md) | 真实学生验收待 WP7B |
| WP7B | 全链回归与产品验收 | `ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING (0 / 5)` | WP5、WP6 | [WP7B工程验收报告](./KNOWLEDGE_PRACTICE_PHASE1_WP7B_ENGINEERING_ACCEPTANCE_REPORT.md) | 至少5次受控真实学生试用待产品负责人组织 |

当前阶段状态：`WP1–WP6 + WP7A + WP7B ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING (0 / 5)`

## 四、WP1：数据契约与基线迁移

状态：`ENGINEERING PASS`

工程实施文档：[`KNOWLEDGE_PRACTICE_PHASE1_WP1_DATA_CONTRACT_AND_MIGRATION_PLAN.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP1_DATA_CONTRACT_AND_MIGRATION_PLAN.md)

目标：建立唯一的轻量知识题领域契约，把现有题目迁移为可校验、可版本化、可生成针对性反馈的数据。

### 4.1 实施项

- [x] 建立 `QuestionType`、`DifficultyLevel`、`Question` 类型。
- [x] 建立旧中文字段到新领域字段的兼容映射。
- [x] 页面不再使用选项字符串首字符作为选项身份。
- [x] 为单选和判断题建立稳定 `optionId`。
- [x] 增加 `acceptedAnswers`、`answerAnalysis`、`misconceptionByAnswer`、`solutionSteps`。
- [x] 增加 `variantGroupId`、`contentStatus`、`contentVersion`。
- [x] 建立 Question Repository，页面不再直接导入原始 JSON。
- [x] 建立题目结构校验器。
- [x] 建立可重复运行的数据校验命令。
- [x] 迁移现有 27 道题并输出内容缺口报告。
- [x] 将七年级上册以外或范围不清的题标记为非首批可用状态。
- [x] 确认首批学生可用题均为 `approved`。

### 4.2 自动化测试

- [x] 重复 ID 被阻断。
- [x] 非法题型和难度被阻断。
- [x] 选项 ID 重复被阻断。
- [x] 正确答案不在选项中被阻断。
- [x] 填空题缺少可接受答案被阻断。
- [x] `retired` 和 `draft` 题不会进入学生可用列表。
- [x] 旧数据兼容映射结果稳定。

### 4.3 内容验收

- [x] 每道首批题题干无明显歧义。
- [x] 每道首批题答案边界明确。
- [x] 每个错误选项有独立解释或明确降级说明。
- [x] 错因提示不输出长期人格或能力标签。
- [x] 当前没有批准的变式关系，未创建未经核对的 `variantGroupId`。

### 4.4 完成门禁

- [x] 现有学生可用题全部通过结构校验。
- [x] 学生页面不再依赖旧字段判题。
- [x] 数据校验失败能够阻断相关构建或检查命令。
- [x] 已记录未补齐的内容缺口，且未将缺口题错误标记为 `approved`。

工程证据：[WP1迁移与工程验收报告](./KNOWLEDGE_PRACTICE_PHASE1_WP1_MIGRATION_REPORT.md)；自动化 `47 / 47 PASS`；数据门禁 `0 error / 0 warning`；Vite build PASS；本地浏览器主链 PASS。

已知限制：WP1 验收时为 12 道 approved 且无批准变式组；WP5 后当前为 19 道 approved、3 个批准变式组。连续使用覆盖仍未通过产品验收，100 道仅为内容建设参考。

## 五、WP2：练习会话与选题

状态：`ENGINEERING PASS`

工程实施文档：[`KNOWLEDGE_PRACTICE_PHASE1_WP2_SESSION_AND_SELECTION_PLAN.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP2_SESSION_AND_SELECTION_PLAN.md)

目标：建立刷新后稳定、会话内不重复、近期优先去重的专项与综合练习组。

### 5.1 实施项

- [x] 建立 `PracticeSession`、`PracticeQueueItem` 和基础状态机。
- [x] 建立稳定 Session ID 和 seed。
- [x] 实现可复现的 seed 洗牌。
- [x] 实现专项默认 5 题选取。
- [x] 实现综合默认 10 题选取。
- [x] 实现分类覆盖上限和至少 3 类目标。
- [x] 实现同一变式组基础题最多 1 道。
- [x] 实现最近两个完成会话的题目降权。
- [x] 实现候选不足时的逐级放宽。
- [x] 实现题目不足时返回实际数量，不重复凑数。
- [x] 会话创建后冻结基础题集合和顺序。

### 5.2 自动化测试

- [x] 专项候选充足时恰好返回 5 道且分类一致。
- [x] 专项不足 5 道时返回实际题数且无重复。
- [x] 综合候选充足时返回 10 道并覆盖至少 3 类。
- [x] 单分类不超过基础题集合 40%，候选不足时合理降级。
- [x] 基础题集合中 `variantGroupId` 不重复。
- [x] 同 seed 结果完全一致。
- [x] 不同新会话 seed 可以产生合理轮换。
- [x] 最近题目在候选充足时被降权。
- [x] `draft` 和 `retired` 题永不被选中。

### 5.3 浏览器验收

- [x] 专项入口显示本组实际题量和预计时长；候选充足时固定 5 题。
- [x] 综合入口显示 10 题、预计时长和覆盖说明。
- [x] 题目不足时页面显示实际题数。
- [x] 同一挂载会话普通重渲染后题目与顺序不变；刷新恢复归 WP4。

### 5.4 完成门禁

- [x] 选题逻辑为可独立测试的纯函数。
- [x] 页面不直接进行随机、切片或题目排重。
- [x] 所有 WP2 自动化测试通过。

工程证据：[WP2工程验收报告](./KNOWLEDGE_PRACTICE_PHASE1_WP2_ENGINEERING_ACCEPTANCE_REPORT.md)；WP2自动化 `47 / 47 PASS`；WP1回归 `47 / 47 PASS`；数据门禁 `0 error / 0 warning`；Vite build PASS；浏览器专项、综合、结果与再练主链 PASS；控制台 `0 error / 0 warning`。

已知限制：WP2 验收时为 12 道 approved 且无已审核 variantGroup；WP5 后当前为 19 道 approved、3 个批准变式组。仍无难度 3 题，连续使用重复率尚未通过产品验收。

## 六、WP3：判题、响应与逐题反馈

状态：`ENGINEERING PASS`

工程实施文档：[`KNOWLEDGE_PRACTICE_PHASE1_WP3_RESPONSE_EVALUATION_AND_FEEDBACK_PLAN.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP3_RESPONSE_EVALUATION_AND_FEEDBACK_PLAN.md)

目标：让每次作答产生幂等记录，并给出与当前选择对应、可执行但不过度诊断的反馈。

### 6.1 实施项

- [x] 建立 `PracticeResponse` 契约。
- [x] 实现单选与判断的 optionId 精确判题。
- [x] 实现填空严格答案和 `acceptedAnswers` 判题。
- [x] 实现填空规范化规则。
- [x] 阻止空白、纯标点和非法选项提交。
- [x] 提交后原子保存 Response 并锁定当前题。
- [x] 实现重复提交幂等。
- [x] 建立 `buildAnswerFeedback` 纯逻辑。
- [x] 答错反馈对应学生所选答案。
- [x] 答对反馈突出关键依据并保持简洁。
- [x] 展示 1—3 个可执行解题步骤。
- [x] 缺少独立选项解析时执行明确降级，不临时编造错因。
- [x] 拆分题卡、答案输入、反馈和底部动作组件。

### 6.2 自动化测试

- [x] 单选正确和错误判定准确。
- [x] 判断题正确和错误判定准确。
- [x] 填空首尾空白正确规范化。
- [x] 显式等价答案可以匹配。
- [x] 模糊相似但未声明的答案不被误判正确。
- [x] 重复提交只生成一条 Response。
- [x] Response 保存题目内容版本。
- [x] 每个错误选项映射正确反馈。
- [x] 无选项解析时使用通用降级。
- [x] 反馈不出现“已掌握”“能力提升”等禁止结论。

### 6.3 浏览器验收

- [x] 提交前下一题按钮不可用。
- [x] 提交中不可重复点击。
- [x] 提交后选项锁定。
- [x] 不自动跳过反馈。
- [x] 红绿颜色之外仍有文字结果。
- [x] 手机和 PC 下反馈均完整可读。

### 6.4 完成门禁

- [x] 三类题型主链通过。
- [x] 逐题反馈能回答“我为什么错、正确依据是什么、下次怎么做”。
- [x] 页面不生成推测性长期诊断。
- [x] WP3 自动化与浏览器验收通过。

工程证据：[WP3工程验收报告](./KNOWLEDGE_PRACTICE_PHASE1_WP3_ENGINEERING_ACCEPTANCE_REPORT.md)；WP3自动化 `49 / 49 PASS`；WP2回归 `47 / 47 PASS`；WP1回归 `47 / 47 PASS`；数据门禁 `0 error / 0 warning`；Vite build PASS；浏览器三题型、错项反馈、错题、结果、键盘与手机宽度验收PASS；控制台 `0 error / 0 warning`。

已知限制：Attempt暂存内存，刷新恢复归WP4；变式巩固归WP5；最终结果摘要归WP6；81道正式阅读题保持独立Learning契约，统一入口归WP7。

## 七、WP4：持久化与恢复

状态：`ENGINEERING PASS`

工程实施文档：[`KNOWLEDGE_PRACTICE_PHASE1_WP4_LOCAL_PERSISTENCE_AND_RECOVERY_PLAN.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP4_LOCAL_PERSISTENCE_AND_RECOVERY_PLAN.md)

目标：保证本机、本浏览器中断后可以稳定恢复，不因损坏数据导致产品白屏。

### 7.1 实施项

- [x] 建立 `LocalPracticeRepository` 单一写入边界。
- [x] 定义带 `schemaVersion` 的持久化根对象。
- [x] 会话创建后立即保存。
- [x] 每次答案提交后立即保存。
- [x] 当前题推进后立即保存。
- [x] Queue 变化由完整 Attempt 立即保存（WP5 插题逻辑仍归 WP5）。
- [x] 完成和放弃状态立即保存。
- [x] 入口检测未完成会话。
- [x] 提供“继续上次练习”。
- [x] 提供“放弃并新建”，且需要显式操作。
- [x] 完成会话生成并保存不可变结果摘要。
- [x] 实现数据读取校验、迁移和损坏隔离。
- [x] 存储写入失败时提供不阻断当前作答的明确提示。
- [x] 页面说明第一阶段仅支持本机本浏览器保存。

### 7.2 自动化测试

- [x] 第 2 题完成后恢复到第 3 题。
- [x] 已答题恢复后保持答案、结果和锁定。
- [x] 已完成会话不会恢复为 active。
- [x] active 会话不会被新会话静默覆盖。
- [x] 放弃会话进入 `abandoned` 终态。
- [x] 损坏 JSON 不造成应用崩溃。
- [x] 可迁移旧 schema 正确升级。
- [x] 结果页刷新后读取同一不可变摘要。

### 7.3 浏览器验收

- [x] 答题过程中刷新并成功恢复。
- [x] 在反馈展示状态刷新并成功恢复。
- [x] 离开页面后重新进入并继续。
- [x] 放弃后创建新 Session ID。
- [x] 界面明确说明清理浏览器数据后无法恢复。

### 7.4 完成门禁

- [x] 页面不直接调用 `localStorage`。
- [x] 正常、旧版本和损坏数据三条恢复路径均通过。
- [x] 本地保存边界在界面中清晰可见。

工程证据：[WP4工程验收报告](./KNOWLEDGE_PRACTICE_PHASE1_WP4_ENGINEERING_ACCEPTANCE_REPORT.md)；WP4自动化 `33 / 33 PASS`；WP3回归 `49 / 49 PASS`；WP2回归 `47 / 47 PASS`；WP1回归 `47 / 47 PASS`；Vite build PASS；刷新、反馈、结果、错题、继续、放弃并新建、390px与控制台验收PASS。

已知限制：仅本机、本浏览器；清理数据或更换设备后不可恢复；变式巩固归WP5；正式结果摘要与推荐归WP6；Vite既存大chunk和动态导入警告未在WP4处理。

## 八、WP7A：唯一入口最小整合

状态：`ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING`

工程实施文档：[`KNOWLEDGE_PRACTICE_PHASE1_WP7A_SINGLE_ENTRY_INTEGRATION_ENGINEERING_PLAN.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP7A_SINGLE_ENTRY_INTEGRATION_ENGINEERING_PLAN.md)

目标：在不合并正式 Evidence 与知识练习本地事实的前提下，把正式阅读主线和基础知识巩固收敛到唯一 `/learning` 学生入口。

### 8.1 实施项

- [x] 建立只读 Student Learning Hub Projection，不复制 `UnifiedLearningEntryState`。
- [x] `/learning` 正确呈现正式主任务、基础知识巩固和唯一主要动作。
- [x] active Formal Session 与 active PracticeSession 使用冻结优先级投射。
- [x] 知识练习可从 `/learning` 开始或恢复。
- [x] 旧 `/practice/knowledge`、Quiz、Result 路由安全兼容。
- [x] 旧路由迁移不删除、不覆盖、不重建 active PracticeSession。
- [x] 旧一级“练习 / 错题本 / 我的”导航不再与 `/learning` 并列。
- [x] 正式题库和轻量题量使用动态、分层口径。
- [x] 正式 Runtime 故障不伪装成知识题不足，知识练习本地故障不阻断正式 Learning。
- [x] 不新增 Evidence、Profile、Trial 或正式资源写入。

### 8.2 自动化与浏览器验收

- [x] WP7A 契约测试全部通过。
- [x] WP1—WP4 全量回归通过。
- [x] 正式 Unified Learning、核心新会话和 Runtime Recovery 回归通过。
- [x] 首次进入、Formal 恢复、Practice 恢复、双 active 兼容和旧路由通过。
- [x] 390px、768px、PC 和键盘操作通过。
- [x] 浏览器控制台无未处理错误。

### 8.3 完成门禁

- [x] 输出 [WP7A Engineering Acceptance Report](./KNOWLEDGE_PRACTICE_PHASE1_WP7A_ENGINEERING_ACCEPTANCE_REPORT.md)。
- [x] 状态升级为 `ENGINEERING PASS`。
- [x] WP5 解除阻塞；后续 D1—D10 已确认，状态升级为 `DESIGN CONFIRMED / ENGINEERING AUTHORIZED BUT NOT STARTED`。
- [x] 不提前升级 Product Acceptance 或 Educational Evidence。

## 九、WP5：错题即时巩固

状态：`ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING`

工程实施文档：[`KNOWLEDGE_PRACTICE_PHASE1_WP5_WRONG_ANSWER_REINFORCEMENT_ENGINEERING_PLAN.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP5_WRONG_ANSWER_REINFORCEMENT_ENGINEERING_PLAN.md)

确认记录：2026-08-29，产品负责人确认 WP5 D1—D10；WP5 代码开发已获授权，在 WP5 `ENGINEERING PASS` 前不进入 WP6 代码开发。

目标：在有真实变式内容时，将一次错误转化为一次低负担巩固，同时保持统计口径真实。

### 9.1 实施项

- [x] 建立 `ReinforcementLink`。
- [x] 实现同一 `variantGroupId` 巩固候选选择。
- [x] 排除当前会话已出现题目。
- [x] 每道原题最多触发 1 道巩固题。
- [x] 每个会话最多插入 3 道巩固题。
- [x] 巩固题插入当前题之后第 1—2 个位置。
- [x] 巩固题答错不递归插题。
- [x] 没有合适变式题时安静降级。
- [x] 在反馈或进度中说明巩固题来源。
- [x] 原题和巩固题统计完全分离。
- [x] 补齐支撑主要知识点的人工核对变式题。

### 9.2 自动化测试

- [x] 原题答错且有候选时插入 1 题。
- [x] 原题答对不插入。
- [x] 无 `variantGroupId` 不插入。
- [x] 无可用候选不插入且会话继续。
- [x] 巩固题答错不递归。
- [x] 同一原题重复处理不重复插入。
- [x] 会话达到 3 道上限后不再插入。
- [x] 巩固题答对不修改原题首次正确率。

### 9.3 内容验收

- [x] 每个变式组训练目标一致。
- [x] 变式题不是原题机械改写。
- [x] 变式题可以独立作答。
- [x] 无法确认关系的题不标记 `variantGroupId`。

### 9.4 完成门禁

- [x] 巩固触发、插入、恢复和统计全链通过。
- [x] 不存在无限插题或动态题量失控。
- [x] 所有已上线变式关系经过人工确认。

工程证据：[WP5工程验收报告](./KNOWLEDGE_PRACTICE_PHASE1_WP5_ENGINEERING_ACCEPTANCE_REPORT.md)；WP5 `54 / 54 PASS`；WP1—WP4、WP7A 与正式 Runtime 全量回归 PASS；Production Build PASS；浏览器主链、恢复、统计、双页面冲突和移动端 PASS。

已知限制：当前 19 道 approved、15 道 draft；只有 3 个批准变式组和 6 条有向 Link；无可靠关系的错题安静降级；Product Acceptance 与 Educational Evidence 仍为 PENDING。

## 十、WP6：结果摘要与下一步推荐

状态：`ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING`

工程实施文档：[`KNOWLEDGE_PRACTICE_PHASE1_WP6_RESULT_SUMMARY_AND_NEXT_STEP_RECOMMENDATION_ENGINEERING_PLAN.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP6_RESULT_SUMMARY_AND_NEXT_STEP_RECOMMENDATION_ENGINEERING_PLAN.md)

目标：用真实统计和有限结论解释本轮表现，并提供有依据的下一步训练。

### 10.1 实施项

- [x] 建立 `PracticeResult` 不可变摘要。
- [x] 取消结果页“本次得分”。
- [x] 展示基础题首次正确率。
- [x] 单独展示巩固题数量和正确数。
- [x] 使用真实累计作答用时。
- [x] 实现单题最大有效计时上限。
- [x] 按知识点聚合基础题表现。
- [x] 严格使用“证据较少 / 本轮表现较稳 / 本轮建议巩固 / 本轮优先巩固”。
- [x] 按结构化错因聚合摘要。
- [x] 无错因时回退到具体错题列表。
- [x] 实现确定性下一步推荐。
- [x] 推荐文案展示依据。
- [x] 提供重做错题、开始专项和返回入口。

### 10.2 自动化测试

- [x] 5 道基础题答对 4 道显示 80%。
- [x] 0 道基础题不会除零。
- [x] 原题错、巩固题对时首次正确率保持原值。
- [x] 一个知识点只有 1 道题时显示证据较少。
- [x] 同知识点至少 2 道全对时只显示本轮表现较稳。
- [x] 错因按次数降序聚合。
- [x] 推荐选择错误最多的知识点。
- [x] 候选题不足时不生成无法开始的推荐。
- [x] 结果中不出现“已掌握”或“能力提升”。

### 10.3 浏览器验收

- [x] 结果页首屏可理解本轮正确率。
- [x] 能区分基础题和巩固题结果。
- [x] 能看到最需要巩固的具体知识点。
- [x] 推荐说明为什么练该专项。
- [x] 推荐按钮能创建符合规则的新会话。
- [x] 结果页刷新后保持一致。

### 10.4 完成门禁

- [x] 所有统计均来自不可变结果摘要。
- [x] 结果结论不越过正式能力证据边界。
- [x] 推荐动作真实可执行。

工程证据：[WP6工程验收报告](./KNOWLEDGE_PRACTICE_PHASE1_WP6_ENGINEERING_ACCEPTANCE_REPORT.md)；WP6 `56 / 56 PASS`；WP1—WP5、WP7A、Unified Entry、Day 0 与 Runtime R2 回归 PASS；Production Build PASS；浏览器结果、刷新、错题重做、集中错误专项推荐和390px验收PASS。

已知限制：Product Acceptance 与 Educational Evidence 仍为 PENDING；真实学生连续使用验收归 WP7B；当前仅本机、本浏览器保存；轻量内容仍为 19 approved、3 个批准变式组和6条有向Link；既存大 chunk 和无效动态导入警告仍未处理。

## 十一、WP7B：全链回归与产品验收

状态：`ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING (0 / 5)`

工程实施文档：[`KNOWLEDGE_PRACTICE_PHASE1_WP7B_FULL_CHAIN_REGRESSION_AND_PRODUCT_ACCEPTANCE_PLAN.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP7B_FULL_CHAIN_REGRESSION_AND_PRODUCT_ACCEPTANCE_PLAN.md)

确认与执行记录：2026-08-30，产品负责人确认WP7B D1—D12并授权执行；WP7B-1—WP7B-4已完成并达到Engineering PASS。Product Acceptance仍为0/5，只有后续真实目标学生受控试用可以计入。

目标：收敛入口体验，完成全量回归、浏览器验收和真实学生受控试用准备。

### 11.1 入口整合复核

- [x] 分类卡展示 5 题一组和预计时长；少于3题显示“内容准备中”。
- [x] 综合入口展示 10 题和覆盖说明。
- [x] 有 active 会话时优先展示继续入口。
- [x] 分类卡不显示长期掌握结论。
- [x] 空题库和题量不足状态可理解。
- [x] 返回、放弃、继续和新建动作无歧义。

### 11.2 全链回归

- [x] WP1—WP6 自动化测试全部通过。
- [x] 现有应用构建通过。
- [x] 知识练习冷启动主链无控制台未处理错误。
- [x] 正式 `/learning` 主链回归通过。
- [x] 错题页与新 Response / Repository 兼容。
- [x] 首页现有导航不被破坏。
- [x] 手机、平板和 PC 关键宽度通过。
- [x] 原生键盘语义和非颜色结果表达通过；物理键盘补验记录为P3。

### 11.3 浏览器主链

- [x] 主链 A：专项练习、错题反馈、巩固、结果、推荐通过。
- [x] 主链 B：综合练习、分类覆盖、近期轮换通过。
- [x] 主链 C：刷新、恢复、完成、结果刷新和双标签冲突通过。
- [x] 异常链：题目不足、存储损坏、无巩固题通过。

### 11.4 工程收口

- [x] 更新本清单所有工程证据。
- [x] 输出第一阶段 Engineering Acceptance Report。
- [x] 记录未完成项和已知限制。
- [x] 状态更新为 `ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING`。
- [x] 不提前标记 Product Acceptance 或 Live。

工程证据：[WP7B工程验收报告](./KNOWLEDGE_PRACTICE_PHASE1_WP7B_ENGINEERING_ACCEPTANCE_REPORT.md)；最低门禁443/443、追加当前Runtime后539/539 PASS；Production Build 607 modules PASS；浏览器专项、综合、巩固、结果、推荐、错题重做、刷新恢复、双标签冲突、390/768/1366与200%等效布局通过；Product Acceptance仍为0/5。

### 11.5 真实学生受控验收

- [ ] 产品负责人确定至少 5 次试用的学生与时间。
- [ ] 每次试用使用统一任务脚本。
- [ ] 记录学生是否能独立开始并完成。
- [ ] 记录学生能否解释至少一条具体反馈。
- [ ] 记录学生是否误解本轮结论为长期能力判断。
- [ ] 记录中断恢复是否造成困惑。
- [ ] 记录题目重复、题目质量和反馈价值评价。
- [ ] 每个问题标记内容、交互、Runtime 或表达归属。
- [ ] 形成 Product Acceptance Report。

## 十二、轻量知识题内容建设跟踪

只有 `approved` 且通过人工核对的题计入完成数。表中 100 道是内容建设目标，不是固定产品门禁；最终数量由覆盖、连续使用重复率和枯竭率校准。

| 分类 | 目标 | 已迁移可用 | 新增已审核 | 缺口 | 状态 |
| --- | ---: | ---: | ---: | ---: | --- |
| 字音字形 | 16 | 3 | 3 | 10 | `IN PROGRESS` |
| 成语运用 | 14 | 1 | 2 | 11 | `IN PROGRESS` |
| 病句辨析与修改 | 14 | 0 | 0 | 14 | `PENDING` |
| 标点符号 | 10 | 1 | 0 | 9 | `IN PROGRESS` |
| 文学文化常识 | 10 | 2 | 0 | 8 | `IN PROGRESS` |
| 古诗文默写与理解 | 14 | 2 | 0 | 12 | `IN PROGRESS` |
| 文言实词虚词 | 14 | 3 | 2 | 9 | `IN PROGRESS` |
| 作家作品与课文背景 | 8 | 0 | 0 | 8 | `PENDING` |
| 合计 | 100 | 12 | 7 | 81 | `IN PROGRESS` |

内容建设不得阻塞不依赖完整题量的领域逻辑开发。WP7B Product Acceptance 前必须达到基于覆盖、重复率和枯竭率定义的首批可用内容门禁，或由产品负责人显式调整阶段范围并更新上位方案。

## 十三、真实学生统一观察表

每次试用复制一份以下记录：

```text
试用编号：
日期：
使用设备与浏览器：
练习类型：专项 / 综合
是否独立找到开始入口：是 / 否
是否完成：是 / 否
中断与恢复是否成功：是 / 否 / 未测试

学生复述的一条反馈：
学生认为下一次应该怎么做：
是否误解为长期能力结论：是 / 否

题目质量问题：
反馈价值问题：
操作困惑：
重复感受：

观察结论：PASS / NEEDS REVISION
问题归属：内容 / 交互 / Runtime / 表达
后续处理：
```

## 十四、阻塞项

当前无已确认阻塞项。

新增阻塞项使用：

| 编号 | 工作包 | 阻塞原因 | 影响 | 解除条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — |

## 十五、已知限制

当前确认：

1. 第一阶段练习记录仅保存在本机、本浏览器；
2. 不进行跨设备同步；
3. 填空题只支持严格和显式等价答案；
4. 本轮表现不构成长期能力诊断；
5. 知识练习数据不写入正式 `/learning` Evidence 链；
6. Product Acceptance 与 Live 必须在 Engineering PASS 后另行验证。

实施过程中发现的新限制应补充到本节，不得只保留在提交信息或口头说明中。
