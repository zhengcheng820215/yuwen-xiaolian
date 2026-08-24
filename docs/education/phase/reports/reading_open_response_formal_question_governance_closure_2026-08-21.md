# 阅读开放文本题正式题治理收口报告

状态：`FORMAL GOVERNANCE APPLIED / ENGINEERING ACCEPTED / REAL CALIBRATION PENDING`

收口日期：`2026-08-21`

## 一、收口结论

本次正式题治理已完成工程与数据收口。治理没有原地修改、删除或覆盖既有 Frozen Question Version，也没有建立批量自动发布入口；仅对确认存在阅读入口缺口的正式题组生成、采用并发布两个后继版本：

- 《春》：新增 1 道基础理解单项选择，作为低输入成本的阅读进入层；
- 《女娲造人》：新增 1 道局部证据与简单因果短答，降低从基础理解直接跳入综合分析的负担。

当前 12 个核心阅读题组按 Learning 实际调度顺序复审后，`missing_entry` 与 `unexplained_load_jump` 均为 `0`。

该结论证明正式题结构与消费顺序已经完成治理，不代表真实学习效果已经得到证明。

## 二、正式数据变化

| 项目 | 治理前 | 治理后 |
| --- | ---: | ---: |
| 活动正式题 | 79 | 81 |
| 核心阅读正式题 | 61 | 63 |
| 单项选择题 | 17 | 18 |
| 开放文本题 | 62 | 63 |
| 活动材料 | 24 | 24 |

本次新增版本：

- 《春》：`question-observation-task-plan-10w5bsw:v1`
- 《女娲造人》：`question-observation-task-plan-bp4jxh:v1`

2026-08-21 后续又完成第一批高风险正式题治理，在不增加题量的前提下为《狼》《猫》《秋天的怀念》发布 3 个继任版本，使 `regenerate` 从 `3` 降为 `0`。逐题变化、身份链和验收结果见：[阅读开放文本题高风险正式题治理第一批报告](./reading_open_response_formal_question_high_risk_governance_batch1_2026-08-21.md)。

同日完成第二批聚焦治理，在不增加题量的前提下为《皇帝的新装》《猫》《天上的街市》各发布 1 个继任版本，使 `decompose_or_refocus` 从 `27` 降为 `24`、`composite_core_actions` 从 `5` 降为 `2`。逐题变化、题组去重和全链路验收见：[阅读开放文本题正式题第二批聚焦治理报告](./reading_open_response_formal_question_focused_governance_batch2_2026-08-21.md)。

对应 Observation Plan：

- `material-observation-plan-1mkb42j`
- `material-observation-plan-1y1hktd`

发布后正式题、Registry、Observation Link、质量轨迹与 Learning 身份保持一致；重复执行治理命令返回 `apply-noop`，不会再次生成或发布相同资源。

## 三、顺序与审计口径收口

本次同时关闭了两项工程偏差：

1. 正式题基线审计改为复用 Learning Scheduler 的有效消费顺序，不再用历史插入顺序误判梯度；
2. Learning Scheduler 按输入负担安排题序，默认将基础单选和低负担文本题置于综合文本题之前，同时保留整体判断、文本先行、Retest 与 Transfer 的角色例外。

梯度规则继续遵守：题组只需避免无理由负担跳跃，不要求机械补齐 `entry_short / focused_short / developing / integrated` 每一个等级。

## 四、版本与会话边界

- 既有 Frozen Question Version 保持不可变；
- 新版本通过既有 Candidate → Adopt → Revision → Publish 链形成；
- 已打开的 Learning Session 继续使用启动时冻结的题目版本与题序；
- 新建 Learning Session 才消费当前 Registry 与治理后的有效顺序；
- 治理 Finding、输入负担等级和一次作答结果均不直接写入 Student Ability Profile。

## 五、自动化与构建验收

| 验收项 | 结果 |
| --- | ---: |
| 题组顺序规划 | `20 / 20 PASS` |
| 阶段 1 输入负担审计 | `28 / 28 PASS` |
| 阶段 2 Planner / Prompt / 长度策略 | `40 / 40 PASS` |
| 阶段 3 质量门禁与顺序 | `48 / 48 PASS` |
| 阶段 4 治理与真实校准工程 | `56 / 56 PASS` |
| 正式题治理 dry-run | `PASS` |
| 正式题治理 apply | `PASS` |
| 正式题治理重复执行 | `apply-noop PASS` |
| Vite 生产构建 | `PASS` |

生产构建使用工作区内置 Node.js。主 bundle 体积和静态/动态重复引入仍为既有非阻断警告。

## 六、真实浏览器核对

真实浏览器已核对：

- 工作台选择《春》后可见新增的基础单选正式题；
- 工作台选择《女娲造人》后可见新增的低负担短答正式题；
- `/learning` 可正常读取与恢复，没有出现“暂时无法打开学习入口”。

浏览器核对未提交学生答案，也未改动已有学习记录。

## 七、剩余边界

全量审计仍会看到 7 个针对性短片段的 `missing_entry`，这些资源是单任务微训练，不属于 12 个核心阅读题组，也不要求在每个短片段内再次补齐阅读进入层；因此不构成本次正式题治理阻断。

后续只进入真实 Learning 校准，继续按 Question Version 独立累计完成率、无效输入、提示打开、修订和后续独立表现。当前必须保持：

```text
REAL CALIBRATION PENDING
EDUCATIONAL EFFECT NOT PROVEN
```
