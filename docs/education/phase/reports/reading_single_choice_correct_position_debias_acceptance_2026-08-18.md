# 阅读单选正确答案位置去偏工程验收记录

日期：2026-08-18

结论：通过

## 一、问题与边界

现有单选 Prompt 的唯一结构示例把 `option-1` 设为正确项，生成结果又直接沿用 Provider 返回顺序，因此多道题在界面中持续显示 A 为正确答案。这不是答案字段被硬编码为 A，但会形成可学习的位置偏差，降低诊断有效性。

本次只调整生成引导和选项展示顺序，不修改题干、选项内容、正确答案身份、干扰项依据、发布版本或 Learning 评价规则。

## 二、工程调整

- 契约升级为 `reading_single_choice_response_format_v1.17` 与 `ai_resource_generation_and_optimization_workflow_contract_v1_17`；
- Prompt 升级为 `material_observation_draft_prompt_v1_11`，示例不再以第一项为正确项，并要求同批单选自然变化正确 option 的返回位置；
- 新增基于稳定 optionId、选项内容指纹与展示 seed 的确定性排列；
- Candidate 预览、评分说明和 Learning 投放统一消费确定性展示顺序；
- Learning seed 绑定正式资源版本与学生身份，同一学生面对同一资源时刷新和恢复顺序不变；
- A / B / C / D 仅由当次展示顺序计算，答案与 Diagnosis 始终按 optionId 对齐；
- 已发布资源无需重新生成或重新发布，即可在 Learning 展示层使用新顺序。

## 三、自动化验收

| 范围 | 结果 |
| --- | --- |
| 单选结构、选项身份与确定性排列 | 22/22 PASS |
| Prompt、候选预览、评分说明与采用链 | 26/26 PASS |
| Learning 作答、Diagnosis 与 Evidence | 20/20 PASS |
| 真实材料发布与 Learning E2E | 11/11 PASS |
| 单选数量规划阶段 4 集成 | 7/7 PASS |
| 统一资源生产 P0–P7 | 26/26 PASS |
| Vite 生产构建（Node 24） | PASS |

## 四、验收边界

确定性排列不承诺每个小批次都严格平均分布，也不采用机械 A-B-C-D 循环。它保证同一展示上下文可恢复，并消除系统性固定首项偏置。真实试用仍应基于答案记录中的 `displayedOptionOrder` 持续观察各位置分布与干扰项选择率；若未来调整排列算法，不得改变已有 optionId 或历史作答判定。
