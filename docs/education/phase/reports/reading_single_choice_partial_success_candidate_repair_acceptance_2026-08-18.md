# 阅读单选部分成功批次候选级修复验收记录

日期：2026-08-18

结论：通过

## 一、问题

补充生成请求目标为两道单选时，Provider 返回一条合格 Candidate 和一条结构不合格 Candidate。系统正确隔离了不合格题，但因为顶层批次仍是 `candidates_ready`，没有调用已经存在的候选级修复流程，最终只保留一道单选。

同时，不合格题的 `choiceInteraction` 因干扰项偏差类型重复而未能形成；后续答案接受检查继续拿空解析结果比较，额外产生“正确答案与选项身份不一致”的级联误报。

## 二、契约与工程调整

- 工作流契约升级为 `ai_resource_generation_and_optimization_workflow_contract_v1_18`；
- 单选作答契约升级为 `reading_single_choice_response_format_v1.18`；
- 生成器升级为 `material_observation_draft_generator_v1_8`；
- Prompt 升级为 `material_observation_draft_prompt_v1_12`；
- 当批次部分成功、单选规划仍为 `underfilled`，且被拒单选只包含可修复结构问题时，仍执行一次候选级修复；
- 修复只替换被拒 Candidate，已经合格的 Candidate 原样保留；
- 为干扰项偏差重复和答案 optionId 对齐增加定向修复说明；
- 答案身份检查改为读取原始可独立提取的正确 optionId，不再依赖已通过全部结构校验的 `choiceInteraction`；
- 当前置身份无法独立确定时跳过依赖检查，不再把一个根因扩张成多个错误；
- 自动修复仍失败时，页面明确说明当前合格候选可继续采用，无需重新生成整个方案。

## 三、自动化验收

| 范围 | 结果 |
| --- | --- |
| 部分成功批次、级联误报与完整单选采用链 | 28/28 PASS |
| 通用素材 Observation 生成器 | 42/42 PASS |
| 单选数量规划 | 18/18 PASS |
| 单选数量规划阶段 4 集成 | 7/7 PASS |
| 单选结构 | 22/22 PASS |
| Learning 诊断与 Evidence | 20/20 PASS |
| 真实材料发布与 Learning E2E | 11/11 PASS |
| 统一资源生产 P0–P7 | 26/26 PASS |
| Vite 生产构建（Node 24） | PASS |

## 四、边界

自动修复不会为了满足数量目标放宽门禁。材料不支持、与已有或同批任务重复、缺少独立观察价值、挤压必要文本任务等问题不进入本次部分成功修复。修复用尽后仍不合格时，系统保留已通过 Candidate，并按真实剩余原因返回 `underfilled`。
