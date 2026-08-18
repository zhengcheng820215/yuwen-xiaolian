# 阅读单选自然动作与正式 Anchor 工程验收记录

日期：2026-08-18

结论：通过

## 一、修复对象

真实单选题干“下列对文中人物心理变化的理解，正确的一项是？”结构完整，但质量评估仍产生：

1. 材料证据范围较笼统；
2. 没有清楚说明学生需要完成什么判断。

第一项源于质量检查只读取题干，没有消费任务卡已经展示的正式段落 Anchor；第二项源于选择动作规则没有覆盖“正确的一项是”这一自然表达。

## 二、工程调整

- 契约升级为 `reading_single_choice_response_format_v1.16` 与 `ai_resource_generation_and_optimization_workflow_contract_v1_16`；
- 选择动作按语义族识别，覆盖“正确的一项是、最符合文意的一项是、不正确的一项是”等表达；
- 工作台根据 Draft 的 Observation Plan 与 Observation Task 身份解析正式 `MaterialSourceAnchor`；
- 正式 Anchor 传入确定性质量评估，结构有效时不再因题干只写“文中”而产生范围提醒；
- 题干显式段落或全文要求与正式 Anchor 冲突时，仍产生 `quality.material.anchor_conflict` 并阻止静默放行；
- 质量规则升级为 `question_quality_rules_v5`，旧版结果自动失效并重新评估。

## 三、自动化验收

| 范围 | 结果 |
| --- | --- |
| 质量评估专项（含真实题干、段落冲突和全文冲突） | 28/28 PASS |
| 质量评估发布门禁（含 Anchor 传递） | 12/12 PASS |
| 工作台命令 E2E | 7/7 PASS |
| 阅读单选生成与采用链 | 25/25 PASS |
| 统一资源生产 P0–P7 | 26/26 PASS |
| Vite 生产构建 | PASS |

## 四、边界

本次不修改题目数量、顺序、候选采用、正式发布或 Learning 调度。没有正式 Anchor 的历史或独立题目继续使用题干证据范围检查；正式 Anchor 无效、版本不一致或与题干显式范围冲突时仍保留质量问题。
