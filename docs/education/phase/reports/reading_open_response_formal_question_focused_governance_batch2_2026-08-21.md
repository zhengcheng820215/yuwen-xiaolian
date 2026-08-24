# 阅读开放文本题正式题第二批聚焦治理报告

状态：`BATCH 2 APPLIED / DEBUG ACCEPTED / REAL CALIBRATION PENDING`

治理日期：`2026-08-21`

实施计划：[阅读开放文本题正式题第二批聚焦治理实施与 Debug 验收计划](../../../product/READING_OPEN_RESPONSE_FORMAL_QUESTION_FOCUSED_GOVERNANCE_BATCH2_PLAN.md)

## 一、治理结论

本批按“小批次、先高确定性、后真实校准”的边界，处理《皇帝的新装》《猫》《天上的街市》各 1 道 `composite_core_actions` 正式题。治理后：

- 三个后继版本的处置结论均为 `retain`；
- `decompose_or_refocus` 从 `27` 降为 `24`，`retain` 从 `25` 增至 `28`；
- `composite_core_actions` 从 `5` 降为 `2`；
- 三题均只保留一个主要认知动作，`requiredRelationCount <= 1`；
- 三个所在题组均未新增顺序跳跃或实质重复观察；
- 活动正式题、Registry、Observation Link、Learning 可消费题和冻结质量轨迹均保持 `81`。

本批只完成工程治理，不代表三道题的真实学习效果已经得到证明。

## 二、逐题治理结果

| 材料 | 旧版本 | 后继版本 | 聚焦后的主要动作 | 后继负担 |
| --- | --- | --- | --- | --- |
| 《皇帝的新装》 | `question-observation-task-plan-12ktvxo:v4` | `question-observation-task-plan-12ktvxo:v5` | 连接“孩子说出真相”与“骗局被揭穿”的情节关系 | `focused_short` |
| 《猫》 | `resource-observation-task-plan-10up8i5:v4` | `resource-observation-task-plan-10up8i5:v5` | 按三次经历概括“我”面对猫亡失时的情感变化 | `focused_short` |
| 《天上的街市》 | `question-observation-task-plan-r3zmn4:v4` | `question-observation-task-plan-r3zmn4:v5` | 根据传统故事与诗中改写的差异推断诗人的生活愿望 | `developing` |

《猫》的后继题在写入前与材料当前正式题组完成语义去重，没有重复现有“第三只猫死亡后无法补救”或“针刺良心”的局部因果观察。

## 三、版本、计划与会话边界

正式存储 revision 由 `1960` 更新为 `1961`。三个材料分别形成新的 reviewed Observation Plan：

- 《皇帝的新装》：`material-observation-plan-nw4s8l`；
- 《猫》：`material-observation-plan-1nnvdjb`；
- 《天上的街市》：`material-observation-plan-1uynm5y`。

每个新计划继承材料当前完整活动题组，不只重建目标题。旧 v4 Frozen Version 转为 `superseded` 并保留，Registry 和活动 Observation Link 指向 v5 后继版本。

- 已打开 Learning Session 继续消费启动时冻结的旧版本；
- 新 Session 通过 Registry 消费 v5；
- Governance Finding 和负担等级不写入 Student Ability Profile；
- 第二次执行治理命令返回 `apply-noop`，revision 仍为 `1961`。

## 四、治理后全量审计

| 项目 | 数量 |
| --- | ---: |
| 活动材料 | 24 |
| 活动正式题 | 81 |
| 冻结质量轨迹 | 81 |
| retain | 28 |
| copy_or_length_adjustment | 11 |
| decompose_or_refocus | 24 |
| regenerate | 0 |
| composite_core_actions | 2 |
| hidden_rubric_requirement | 20 |
| object_scope_overloaded | 4 |
| relation_load_overloaded | 1 |
| response_format_load_mismatch | 2 |

剩余 Finding 是后续治理候选，不等于正式资源不可消费。下一批仍应按风险确定性和题组去重结果选择少量目标题，禁止仅为降低统计数字批量改题。

## 五、Debug 与构建验收

| 验收项 | 结果 |
| --- | ---: |
| 第二批 dry-run / apply / apply-noop | `PASS` |
| 正式资源基线一致性 | `81 / 81 PASS` |
| 题组顺序规划 | `20 / 20 PASS` |
| Learning Session 历史身份与冻结边界 | `PASS` |
| 阶段 1 输入负担审计 | `28 / 28 PASS` |
| 阶段 2 Planner / Prompt / 长度策略 | `40 / 40 PASS` |
| 阶段 3 质量门禁与顺序 | `48 / 48 PASS` |
| 阶段 4 治理与真实校准工程 | `56 / 56 PASS` |
| B4 浏览器联调矩阵 | `16 / 16 PASS` |
| Vite 生产构建 | `PASS` |

生产构建仍报告既有 bundle 体积及同模块静态/动态重复引入警告；它们未阻断本批治理和构建，不属于本批正式题聚焦治理范围。

## 六、下一步边界

第二批完成后，不继续扩大治理范围。下一步应先：

1. 在真实 Learning 中采集 v5 的首次独立作答、提示使用、修订与后续 Retest / Transfer 事实；
2. 观察三道题的完成率、异常短答率、提示开启率和 Rubric 命中分布；
3. 仅当数据表明仍存在系统性负担问题时，再启动第三批 `3—5` 道聚焦治理；
4. 剩余两道 `composite_core_actions` 可作为第三批优先审查对象，但仍需先完成题组语义去重与 dry-run。

当前结论保持：

```text
ENGINEERING GOVERNANCE ACCEPTED
REAL CALIBRATION PENDING
EDUCATIONAL EFFECT NOT PROVEN
```
