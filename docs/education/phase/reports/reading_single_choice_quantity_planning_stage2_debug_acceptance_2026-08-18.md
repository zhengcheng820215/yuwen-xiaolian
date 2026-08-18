# 单选数量与分布工程任务 2 Debug 验收

日期：`2026-08-18`

状态：`PASS`

## 1. 本阶段目标

将工程任务 1 的确定性数量规划结果接入补充生成请求和 Material Observation Draft Prompt，使生成器知道“为什么请求、请求多少、完成后的题组规模和不能突破的质量边界”。

本阶段不实现目标不足的最终结构化放行和页面提示，该部分属于工程任务 3。

## 2. 已完成工程

### 2.1 工作台请求接入

补充生成现在通过 `resolveSupplementSingleChoiceQuantityPlan` 获得本轮规划，并传递：

- 当前有效任务数；
- 当前有效单选数；
- 本轮计划补充任务数；
- 规划完成后的目标任务组规模；
- 默认单选目标、实际单选目标与单选上限；
- 当前剩余容量；
- 本批次实际请求的单选数。

典型场景：当前 `3` 道文本任务、本轮补充 `2` 道时，目标任务组规模为 `5`，默认请求 `2` 道单选。

### 2.2 Prompt 约束

Prompt 版本升级为 `material_observation_draft_prompt_v1_9`，新增：

1. 单选数量是规划软目标，不是放宽门禁的题型配额；
2. 作答形式仍先服从训练动作、干扰项质量和去重；
3. 多道单选必须在观察对象、证据范围或认知动作上形成差异；
4. 禁止连续改写同一事实定位；
5. 数量不足时宁可少生成，并使用受控前缀与原因说明；
6. 任务顺序继续由 TrainingTask Role 和 Observation Plan 决定。

### 2.3 输入一致性

Generator 版本升级为 `material_observation_draft_generator_v1_5`。数量规划上下文必须使用非负整数，并满足任务容量、单选上限、当前任务/单选关系和请求数量一致性。`singleChoiceCandidateTarget` 与规划上下文中的实际请求数不一致时，在 Provider 调用前以 `single_choice_planning_context_invalid` 阻断。

## 3. Debug 结果

| 验收项 | 结果 |
| --- | --- |
| 阅读单选生成与生产专项 | `21 / 21 PASS` |
| 单选数量规划专项 | `18 / 18 PASS` |
| 任务组规划 | `PASS` |
| Material Observation Draft Generator | `42 / 42 PASS` |
| Material Resource Production | `16 / 16 PASS` |
| Material Resource Workbench State | `23 / 23 PASS` |
| Structured Runtime Error Contract | `10 / 10 PASS` |
| Product Color Semantics | `PASS` |
| Production Build | `PASS` |

专项新增覆盖：

- Prompt 完整接收 `3 → 5`、`0 → 2` 的数量规划上下文；
- 两道单选分别观察人物心理理解和明确动作定位，能够同时进入候选；
- 两题的对象、证据和认知动作具有实际差异；
- 请求目标与规划上下文不一致时不调用 Provider；
- 既有单选 Candidate → Adopt → Revision → Publish 主链继续通过。

## 4. 调试说明

首次双单选测试中，第二道测试候选使用了未冻结的干扰项代码 `sequence_confusion`，Schema 正确拒绝了该候选，并连带触发目标不足。测试数据已改用现有受支持代码 `evidence_omission`；产品 Schema 和干扰项质量门禁没有放宽。

## 5. 未进入本阶段的内容

1. 目标数量不足目前仍沿用既有 `single_choice_candidate_target_unmet` 批次状态；
2. 尚未把不足原因解析为结构化治理结果；
3. 尚未实现“满足硬门禁但少于软目标”的可解释放行；
4. 页面尚未展示受控的数量不足说明；
5. 第 3 道单选的扩展目标尚未自动启用。

## 6. 验收结论

工程任务 2 已完成并通过 Debug 验收。正常补充生成路径现在能够稳定请求 2 道彼此独立的单选；可以进入工程任务 3，处理目标不足、软硬约束分流与生产端状态表达。
