# 阅读训练递进负担模型阶段 2 工程与 Debug 验收记录

状态：`IMPLEMENTED / DEBUG ACCEPTED`

验收日期：2026-08-24

阶段版本：`reading_training_progressive_load_stage2_v1`

## 1. 验收结论

阶段 2 已完成 Planner、两步式 Prompt、Candidate 身份回执、题组级 Progression Gate、工作台持久化和旧顺序兼容投影。

真实生成边界不再先写完整题面后反推计划，而是：

```text
Material / Observation Intent
→ Pass A: Task Planning Seeds
→ Host: TaskGroupProgressionPlan + stable hashes
→ Pass B: Question Candidate Realization
→ Candidate semantics / receipt verification
→ Task Group Progression Gate
→ existing Adopt / Revision / Publish
```

阶段 2 没有重建 Material → Plan → Task → Candidate → Publish → Learning 主链，也没有让 Learning、Diagnosis、Evidence 或 Student Profile 提前消费负担层级。

## 2. 已实施能力

1. `ReadingTaskPlanningSeed`、`TaskGroupProgressionPlan`、Transition 和 Gate Assessment 均有运行态 Guard 与稳定 Hash；
2. Planner 规划题组坡度和相邻责任变化，不机械要求单选数量或全部负担等级；
3. `holistic_first` 与 `role_driven` 仅允许受控原因；
4. Pass A 只规划 Seed，不生成题干、选项、Rubric、答案或学生提示；
5. Pass B 必须逐题回显 `planningTaskKey`、Task Hash、Plan Hash 和 rank；
6. 题面与 Seed 的能力、观察维度、Anchor、作答形式或回执不一致时阻断；
7. Candidate 与正式 TrainingTask 继承同一 Task Semantics；局部再生成保持身份，改变主要动作或位置则要求整组重规划；
8. Group Gate 检查计划身份、顺序、Task Hash、同线程跨级、重复观察价值和受保护高阶任务；
9. 旧 `training_task_sequence_planning_v2` 仅保留为兼容投影；历史对象缺阶段 2 字段仍可读。

## 3. 专项验收

| 验收 | 结果 |
| --- | --- |
| 阶段 2 Planner / Prompt / Group Gate | `48 / 48 PASS` |
| Material Observation Draft Generator | `45 / 45 PASS` |
| 真实两步式脚本联调 | `PASS`，Provider 2 次调用，正式 Repository 写入 `0` |
| TypeScript | `PASS` |
| Production Build | `PASS` |

两步式脚本联调覆盖：Planner 对 Seed 重排后，Pass B 按权威顺序实现题面；四项回执与 Seed 语义一致；最终三个候选均继承同一 Plan Hash。

## 4. 旧主链零回归

以下既有自动化在阶段 2 开发期间保持通过：

- 阶段 1 原生负担语义：`40 / 40 PASS`；
- 训练任务顺序：`20 / 20 PASS`；
- Open Response Stage 3：`48 / 48 PASS`；
- 题目生成质量策略：`15 / 15 PASS`；
- Question Workbench Command E2E：`7 / 7 PASS`；
- Material Resource Production Commands：`16 / 16 PASS`；
- Learning Session Queue：`21 / 21 PASS`；
- Targeted Micro-training Stage 4：`51 / 51 PASS`；
- Single Choice Stage 4：`13 / 13 PASS`；
- Learning Feedback Revision Stage 4：`19 / 19 PASS`；
- Question Candidate Workflow：`12 / 12 PASS`；
- Unified Resource Production P0–P7：`26 / 26 SUITES PASS`；
- 正式 Learning 入口：`17 / 17 PASS`。

## 5. 浏览器边界核对

只读浏览器冒烟确认：

1. 资源生产工作台和 Learning 均可正常打开；
2. 工作台不显示阶段工程验证面板、内部状态切换控件或内部错误码；
3. 已有 24 篇材料、81 道正式题保持可读，未为验收覆盖 Frozen Resource；
4. Learning 继续按既有兼容顺序恢复当前题组；学生界面未提前显示 Plan、Load Level、sequenceRole 或内部 Hash。

候选发布、stale、blocked 等写状态场景由隔离自动化覆盖；本次浏览器核对没有写入或覆盖用户正式资源。

## 6. 阶段授权边界

阶段 2 允许：

- 新题组规划并持久化 Progression Metadata；
- Candidate 生成、再生成、采用和发布前校验消费该计划；
- 工作台展示既有业务状态并使用唯一准备态。

阶段 2 禁止：

- Learning 用负担层级解释学生表现；
- Diagnosis / Evidence / Profile 形成新的能力归因；
- 批量修改历史 Frozen Resource、Registry 或 Learning Link；
- 因缺少某一层级或题型数量不足而机械补题。

## 7. 进入阶段 3 的结论

阶段 2 工程门槛已满足，可以进入阶段 3。阶段 3 才能在严格身份和同线程条件下让 Learning、Diagnosis 与 Evidence 消费正式 Progression Metadata，并区分“任务负担过高”与“学生能力不足”。
