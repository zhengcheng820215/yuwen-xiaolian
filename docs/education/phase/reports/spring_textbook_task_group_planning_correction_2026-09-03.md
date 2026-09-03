# 《春》教材目标校准与题组规划校正报告

状态：READ-ONLY AUDIT COMPLETE / SUCCESSOR PLAN READY

日期：2026-09-03

依据契约：[教材目标校准与题组规划校正契约](../../../product/TEXTBOOK_OBJECTIVE_CALIBRATION_AND_TASK_GROUP_PLANNING_CORRECTION_CONTRACT.md)

## 一、审计对象与边界

- 正式材料：`material-109b70ff-106:v3`，朱自清《春》；
- 正式题目：6 道 Frozen Resource；
- 教材校准信号：全文春景图、语言品味、结尾比喻递进、朗读想象；
- 本轮只读，不修改 Material、Frozen Resource、Registry、Launch Record、Trial Binding 或 Learning 数据；
- 朗读、背诵和字词积累只保留为教学参考，不进入当前正式阅读诊断链。

审计前后 Formal Store SHA-256 均为：

`a9015721abf2f588b2d2f8d2fd3d049906f5e8650d34132beb4ef30cf8e9ab7c`

## 二、当前正式题组

| 题目 | 作答形式 | 当前主要观察 |
| --- | --- | --- |
| 结尾比喻顺序的逻辑 | long_text | “娃娃—小姑娘—青年”的递进 |
| 拟人词语的表达效果分析 | long_text | “偷偷地”“钻”的局部表达 |
| 作者情感与景物描写的关系 | long_text | “可别恼”的上下文关系 |
| 比喻句的提取与对应 | long_text | 花色比喻与共同表达 |
| 拟人总起句与分述景物的对应 | long_text | 第二段景物与“刚睡醒” |
| 春回大地共同含义 | single_choice | 第二段局部基础理解 |

单题质量总体可用，局部语言、内容关系和结尾综合理解均有覆盖。当前问题不是已有题目全部失效，而是题组缺少显式的 `whole_text_orientation`：现有单选只观察第二段，不能帮助学生先建立全文“盼春—绘春—颂春”及各幅春景之间的整体地图。

## 三、校正结论

当前题组审计结果：`whole_text_orientation_missing`。

该结果对历史正式题只形成治理建议，不撤回、不覆盖、不中断现有 Learning；新生成 successor 题组应先补整体入口，再进入局部细读和综合分析。

## 四、Successor 题组规划

推荐保持 6 道左右，不通过无限追加扩大题量：

1. `whole_text_orientation`：辨认全文主要春日图景及“盼春—绘春—颂春”结构，优先低负担单选或短文本；
2. `local_close_reading`：第二段“刚睡醒”与山、水、太阳的变化；
3. `relation_explanation`：具体景物如何共同体现春回大地；
4. `local_close_reading`：春草、春花或春雨中的高价值词句；
5. `relation_explanation`：局部语言与全文生机、情感方向的关系；
6. `integrated_understanding`：结尾三个比喻的顺序及递进意义。

若必须保持 6 道总量，应将观察价值接近的局部题降为候补，由 successor Candidate 替换；已发布版本继续冻结。

## 五、工程验收证据

- 教材目标校准专项：TC-01—TC-20，20/20 PASS；
- 既有题组递进 Planner：S2-01—S2-48，48/48 PASS；
- 材料 Observation Draft Generator：C01—C45，45/45 PASS，Formal Repository writes = 0；
- Production Build：PASS；
- 无校准上下文时保持历史 Plan 兼容；
- 自动从段落结构推断时仅使用 `advisory`，只有明确冻结的教材目标才允许 `enforced`；
- 新角色不投射到学生页面，也不进入学生能力画像。

## 六、结果

本轮已完成“教材目标 → 结构化校准语义 → Planner 顺序 → Prompt → 题组 Gate → 只读审计”的闭环。后续生成《春》新方案时，系统可优先形成全文理解入口，并阻止明确强制上下文下直接从局部高负担题开始；历史正式资源保持不变。
