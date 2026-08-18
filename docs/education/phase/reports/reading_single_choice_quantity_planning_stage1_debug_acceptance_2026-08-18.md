# 单选数量与分布工程任务 1 Debug 验收

日期：`2026-08-18`

状态：`PASS`

对应契约：

- [阅读训练单项选择作答契约](../../../product/READING_SINGLE_CHOICE_RESPONSE_FORMAT_CONTRACT.md)
- [AI 资源生成与优化工作流契约](../../../product/AI_RESOURCE_GENERATION_AND_OPTIMIZATION_WORKFLOW_CONTRACT.md)

## 1. 本阶段目标

本阶段只建立单选数量与容量的确定性规划基础，不接入生成 Prompt、Agent 质量放行或生产端提示。

完成内容：

1. 将任务组规划容量从历史值 `5` 统一为契约值 `6`；
2. 按目标任务组规模提供单选默认目标与允许上限；
3. 计算目标任务组规模、单选目标、目标缺口和剩余容量；
4. 将本轮计划补充数与合格独立观察数纳入实际请求上限；
5. 暴露既有单选数量超出当前任务规模上限的确定性标记；
6. 对负数、非整数、任务数超容量及单选数超过任务数等非法输入明确阻断。

## 2. 规划计算边界

核心计算为：

```text
目标任务组规模 = min(6, 当前有效任务数 + 本轮计划补充任务数)
目标单选数 = 根据目标任务组规模读取默认或扩展目标
单选缺口 = max(0, 目标单选数 - 当前有效单选数)
剩余容量 = max(0, 6 - 当前有效任务数)
实际请求单选数 = min(
  单选缺口,
  本轮计划补充任务数,
  剩余容量,
  合格独立单选观察数
)
```

默认目标：

| 目标任务组规模 | 默认单选目标 | 单选上限 |
| --- | --- | --- |
| 2 | 0 | 1 |
| 3 | 1 | 2 |
| 4 | 1 | 2 |
| 5 | 2 | 3 |
| 6 | 2 | 3 |

扩展目标只提供确定性计算能力，不代表自动满足增加第 3 道单选的质量条件。是否允许扩展由后续训练动作、独立观察、干扰项质量和文本覆盖校验决定。

## 3. 工程变更

- `src/pages/trainingTaskGroupPlanningState.ts`
  - `MAX_TRAINING_TASK_COUNT = 6`；
  - 新增 `resolveSingleChoiceTargetRange`；
  - 新增 `resolveSingleChoiceQuantityPlan`；
  - 新增 `SingleChoiceQuantityPlan` 与目标偏好类型。
- `src/ai/tests/runSingleChoiceQuantityPlanningDebug.ts`
  - 新增 18 项专项数量规划测试。
- `src/ai/tests/runTrainingTaskGroupPlanningDebug.ts`
  - 更新容量为 6 后的补充生成与采用边界。
- `package.json`
  - 新增 `debug:single-choice-quantity-planning`。

## 4. 最终 Debug 结果

| 验收项 | 结果 |
| --- | --- |
| 单选数量规划专项 Debug | `18 / 18 PASS` |
| 任务组规划 Debug | `PASS` |
| 任务组规划 E2E | `PASS` |
| Material Observation Draft Generator | `42 / 42 PASS` |
| Material Resource Production | `16 / 16 PASS` |
| Material Resource Workbench State | `23 / 23 PASS` |
| Production Build | `PASS` |

调试期间发现旧容量用例的第二个候选与已有任务实质重复，因此只能采用一个候选。该测试数据已改为两个真正独立的观察，用于验证剩余两个槽位均可采用；产品去重逻辑未放宽。

## 5. 明确未进入本阶段的内容

以下内容尚未改变：

1. 工作台仍使用既有单选目标适配器；
2. Prompt 尚未接收完整数量规划上下文；
3. Agent 仍未实现目标不足的结构化可解释放行；
4. 页面尚未展示数量目标或不足原因；
5. 不以本阶段通过声明真实材料一定生成 2–3 道高质量单选。

## 6. 验收结论

工程任务 1 已完成并通过 Debug 验收。数量与容量计算具有单一、可测试的确定性来源，可以进入工程任务 2 的 Prompt 与生成接入；后续不得在 Prompt 内重新复制一套数量推导规则。
