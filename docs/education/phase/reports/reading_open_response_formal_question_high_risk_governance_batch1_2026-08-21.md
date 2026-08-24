# 阅读开放文本题高风险正式题治理第一批报告

状态：`BATCH 1 APPLIED / DEBUG ACCEPTED / REAL CALIBRATION PENDING`

治理日期：`2026-08-21`

## 一、治理结论

本批按阶段 4 的小批次原则处理审计中仅有的 3 道 `regenerate` 正式题，涉及《狼》《猫》《秋天的怀念》。治理后：

- `regenerate` 从 `3` 降为 `0`；
- 3 个后继版本的治理结论均为 `retain`；
- 3 题均只保留一个主要问题，必需证据单元均为 `1`；
- 没有新增 `evidence_scope_insufficient`、`relation_load_overloaded` 或 `response_format_load_mismatch`；
- 活动正式题、活动 Observation Link、Registry、Learning 可消费题和冻结质量轨迹均保持 `81`。

本批只解决确定性高风险，不代表其余题已经完成真实学习效果校准。

## 二、逐题变化

| 材料 | 旧版本 | 后继版本 | 收口方式 | 后继负担 |
| --- | --- | --- | --- | --- |
| 《狼》 | `question-observation-task-plan-1dkgzj1:v5` | `question-observation-task-plan-1dkgzj1:v6` | 从并列分析多个对象与主旨，收敛为“结局证据支持作者态度” | `developing` |
| 《猫》 | `resource-observation-task-plan-10at8sx:v4` | `resource-observation-task-plan-10at8sx:v5` | 从跨 5 段取证与主题分析，收敛为“猫死亡导致无法补救”的单一因果关系 | `developing` |
| 《秋天的怀念》 | `resource-observation-task-plan-1i0snrc:v4` | `resource-observation-task-plan-1i0snrc:v5` | 从结构、情感并列分析，收敛为“病重仍照顾孩子所体现的人物特点” | `focused_short` |

后继版本继续沿用原 `resourceId`、题目 lineage、主要能力和任务角色；旧 Frozen Version 标记为 `superseded` 并完整保留，不做原地覆盖。

## 三、计划、链接与会话边界

本批为三个材料分别形成新的 reviewed Observation Plan：

- 《狼》：`material-observation-plan-5szbbu`
- 《猫》：`material-observation-plan-fy0qoc`
- 《秋天的怀念》：`material-observation-plan-17jsniq`

新计划吸收材料当前完整题组，而不是只重建目标题。由此保证核心题与补充题的活动链接均被继承，题量没有从 `81` 意外下降。

- 已打开 Learning Session 继续消费启动时冻结的旧版本；
- 新 Session 通过 Registry 消费上述后继版本；
- 治理结果不写入 Student Ability Profile；
- 重复执行治理命令返回 `apply-noop`，正式存储 revision 保持 `1960`。

## 四、治理后全量审计

| 项目 | 数量 |
| --- | ---: |
| 活动材料 | 24 |
| 核心阅读正式题 | 63 |
| 针对性短片段正式题 | 18 |
| 活动正式题 | 81 |
| 开放文本题 | 63 |
| 单项选择题 | 18 |
| retain | 25 |
| copy_or_length_adjustment | 11 |
| decompose_or_refocus | 27 |
| regenerate | 0 |

`decompose_or_refocus = 27` 表示仍有可继续收敛的题干、Rubric 或对象/关系负担，不等于 27 道题阻断发布。后续应继续按每批 `3—5` 道、先高确定性再看真实数据的顺序治理，禁止一次性重写题库。

全量序列仍包含针对性短片段的 `missing_entry = 7` 与 `duplicate_load_observation = 2`。针对性短片段允许单题微训练，不机械补入口；重复观察项应在下一批结合题目角色、证据范围与真实 Learning 表现复核，不能仅凭数量自动改题。

## 五、Debug 与构建验收

| 验收项 | 结果 |
| --- | ---: |
| 高风险治理 dry-run | `PASS` |
| 高风险治理 apply | `PASS` |
| 高风险治理重复执行 | `apply-noop PASS` |
| 正式资源基线一致性 | `PASS` |
| 题组顺序规划 | `20 / 20 PASS` |
| 阶段 1 输入负担审计 | `28 / 28 PASS` |
| 阶段 2 Planner / Prompt / 长度策略 | `40 / 40 PASS` |
| 阶段 3 质量门禁与顺序 | `48 / 48 PASS` |
| 阶段 4 治理与真实校准工程 | `56 / 56 PASS` |
| B4 浏览器验收矩阵 | `16 / 16 PASS` |
| Vite 生产构建 | `PASS` |

生产构建仍有既有的 bundle 体积及同模块静态/动态重复引入警告，未影响本批治理和构建通过。

## 六、下一批治理边界

下一批只从 `decompose_or_refocus` 中选择确定性最高的 `3—5` 道：

1. 先处理多个独立核心动作或隐藏 Required Rubric；
2. 再处理对象、关系负担过载；
3. 如果收敛会改变主要能力或 Observation Plan，则停止并返回重新规划；
4. 没有真实 Learning 数据时，不仅凭推荐长度批量改写题目；
5. 每批发布后重复执行正式基线、阶段 1—4、题组顺序和新 Session 消费检查。

当前边界继续保持：

```text
ENGINEERING ACCEPTED
REAL CALIBRATION PENDING
EDUCATIONAL EFFECT NOT PROVEN
```
