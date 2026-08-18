# 单选数量与分布工程任务 3 Debug 验收

日期：`2026-08-18`

状态：`PASS`

## 1. 本阶段目标

将单选推荐数量从“整批采用门禁”收敛为可解释的规划软目标，同时继续保留结构、去重、容量、干扰项质量和必要文本观察等硬门禁。

本阶段不改变用户决策模型：生产端仍只提供“采用当前任务方案”与“重新生成任务方案”，不会因为数量不足增加人工审核、说明填写或二次确认。

## 2. 已完成工程

### 2.1 结构化目标结果

Material Observation Draft Generator 升级到 `material_observation_draft_generator_v1_6`，生成结果新增 `singleChoicePlanningResult`：

- `status`：`not_applicable / met / underfilled`；
- `targetCount` 与 `actualCount`；
- 当前单选数、本次请求数与本次实际生成数；
- 采用后的预计单选总数与缺口数；
- 受控不足原因码。

受控原因包括：

- `insufficient_task_capacity`；
- `insufficient_supplement_scope`；
- `no_independent_observation`；
- `duplicate_with_existing_task`；
- `distractor_quality_insufficient`；
- `would_displace_text_observation`。

Provider 可以通过 `single_choice_target_unfilled:` 返回明确原因；Generator 也会根据容量、重复候选和单选结构拒绝结果补充确定性原因。无明确原因时使用 `no_independent_observation`，不得返回空洞未知状态。

### 2.2 软约束与硬门禁拆分

单选数量少于规划目标时，不再写入 `single_choice_candidate_target_unmet` 批次错误。存在合法文本 Candidate 或少量合法单选 Candidate 时，结果保持 `candidates_ready`，允许用户整体采用。

以下情况继续阻断：

- Candidate 结构不完整或字段契约不合法；
- 没有任何新的独立 Observation Candidate；
- 任务数量、上下文或其他批次结构不符合契约；
- 单选选项、答案键或干扰项依据不满足质量门禁；
- 最终任务组违反容量、去重或必要文本观察边界。

被拒绝的低质量 Candidate 不会因为数量目标而被放行；目标不足只允许剩余合法方案继续采用。

### 2.3 生产端状态表达

补充候选区新增受控说明：

- 达到目标时说明本次生成数量和采用后的预计单选总数；
- 未达到目标时说明目标数、预计实际数、本次生成数和具体原因；
- 明确提示“当前合格方案仍可采用”；
- 不显示内部 `optionId`、英文原因码或新的人工处理步骤。

旧的“本次未生成单选，因此该方案不可采用”提示与处理动作已从活动页面逻辑删除。

## 3. Debug 验收边界

专项用例覆盖：

1. 纯文本候选满足硬门禁但未达到单选软目标时保持可采用；
2. 结构化结果正确保存目标、实际、生成、预计和缺口数量；
3. Provider 返回的干扰项质量不足原因得到保留；
4. 一道合格单选加一道合格文本任务可以在目标不足时整体采用；
5. 结构非法且没有合法 Candidate 时仍然硬阻断；
6. 两道独立单选正常达到目标的既有路径保持通过；
7. Candidate → Adopt → Revision → Publish 正式资源链保持通过。

验收结果：

| 验收项 | 结果 |
| --- | --- |
| 阅读单选生成与生产专项 | `23 / 23 PASS` |
| 单选数量规划专项 | `18 / 18 PASS` |
| 任务组规划 | `PASS` |
| Material Observation Draft Generator | `42 / 42 PASS` |
| Material Resource Production | `16 / 16 PASS` |
| Material Resource Workbench State | `23 / 23 PASS` |
| Structured Runtime Error Contract | `10 / 10 PASS` |
| Product Color Semantics | `PASS` |
| Production Build | `PASS` |

Production Build 仅保留既有大 Chunk 与动态导入提示，没有新增编译错误或失败。

## 4. 验收结论

工程任务 3 完成后，系统能够区分“规划目标少生成”和“候选本身不可用”：前者形成可解释治理信息并允许采用合格方案，后者继续阻断。该调整消除了为了满足题型数量而凑题或误报整批失败的风险，并保持既有单人采用与发布闭环不变。

可以进入工程任务 4，执行数量规划、生成、采用、发布、Learning 消费和真实浏览器的整体联调收口。
