# 单选进入层顺序规划与 Learning 调度验收报告

日期：2026-08-18
结论：`PASS`

## 一、完成范围

1. 契约明确常规 `entry_first`、受控 `holistic_first / role_driven`，并区分生产存储顺序和 Learning 投放顺序；
2. `training_task_sequence_planning_v2` 新增显式 `preludeCandidateIds`，进入层身份不再依赖列表位置推断；
3. 确定性 Planner 最多选择 `1–2` 道合格基础单选作为进入层；存在第 `3` 道单选时，首个文本任务仍紧随进入层，高阶或 Advanced 单选不被机械提前；
4. Generator 接收顺序偏好、稳定排序新候选并返回 `sequencePlanningResult`；Prompt 明确默认策略与受控例外，Provider 只能以两个合法原因提出 `holistic_first`，非法值回退默认；
5. 正式资源保存并恢复 `sequence-strategy / sequence-reason / sequence-rank / sequence-prelude / sequence-prelude-count` 标签，Observation Plan 权威刷新后不会丢失；
6. Learning 只对显式进入层 Resource Version 应用优先级；同材料旧版无标记资源最多兼容前置 `2` 道，Retest / Transfer 保持角色顺序；
7. 补充 Candidate 继续追加，未重排既有已发布任务。

## 二、关键边界

- 顺序是软规划约束，不因 `adjusted / underfilled` 增加人工审核或阻断发布；
- 已发布任务、已完成作答和反馈/修订历史不可重排；
- `holistic_first` 只接受整体判断或独立表达基线原因；
- `holistic_first` 由 Planner 确定性将首个文本任务置于新候选首位，不依赖 Provider 原始顺序；
- `role_driven` 只接受 Retest / Transfer 原因；
- Advanced 单选不作为默认低负荷进入题；
- Learning 会排除已消费 Resource Version，不重放已完成题目。
- 第 `3` 道及后续单选不属于进入层，不得继续排在首个文本任务之前。
- 历史资源若没有顺序标签，无法安全反推“整体判断优先”的语义意图；系统只做最多两道基础单选的保守兼容，不自动改写旧版本。

## 三、自动化验收

| 验收项 | 结果 |
| --- | --- |
| 顺序 Schema、Planner、持久化恢复、三单选边界与 Learning 调度专项 | `20 / 20 PASS` |
| 单选 Prompt、生成、采用与正式资源链 | `25 / 25 PASS` |
| 单选数量、生产、Learning 与 E2E 串联 | `7 / 7 PASS` |
| 统一资源生产 P0–P7 | `26 / 26 PASS` |
| Learning 反馈修订 Stage 4 | `19 / 19 PASS` |
| 正式产品 / Demo 身份隔离 | `11 / 11 PASS` |
| Phase 17.3 Learning Entry | `16 / 16 PASS` |
| Phase 17.3 正式资源集成 | `17 / 17 PASS` |
| Phase 16.3 真实学习链 | `16 / 16 PASS` |
| Production Build | `PASS` |

## 四、真实浏览器冒烟

- `/material-resource-workbench` 正常加载“素材与题目生产工作台”，控制台无错误；
- `/learning` 正常恢复正式学习状态；本次验收状态为“本次学习已结束”，未出现历史任务被重排或重复投放；
- Learning 控制台无错误。

## 五、最终结论

本轮已完成“契约 → Schema / Planner → Prompt / Generator → Learning 调度 → 整体回归”的闭环。默认进入层与受控例外均有结构化表达，且没有破坏 Candidate → Adopt → Revision → Publish、正式资源不可变和 Learning 历史恢复边界。

最终收口后，目标规则的关键语义已由结构化数据和确定性代码共同保证：默认只提前 `1–2` 道进入层单选；`holistic_first` 确保文本先行；Retest / Transfer 不应用常规 Training 排序；保存与刷新不会丢失进入层身份。因此不再依赖 Prompt 自觉、数组偶然顺序或 UI 状态维持核心规则。
