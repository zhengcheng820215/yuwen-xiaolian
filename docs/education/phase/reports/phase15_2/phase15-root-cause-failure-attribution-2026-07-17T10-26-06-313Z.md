# Phase 15.2 Root Cause Failure Attribution

状态：PASS
执行模式：离线审查已有 Candidate，不调用 Provider
来源报告：phase15-prompt-v4-calibrated-baseline-2026-07-17T10-03-31-702Z
Prompt：real_ai_diagnosis_prompt_v4

## 一、结论

本次初步审查覆盖 13 个样本、32 个 Root Cause Category 失败 Run。其中 29 个 Run 的实际 Root Cause 在语义上合理，3 个 Run 确认为 Prompt 层 Root Cause 问题，0 个 Run 无法判定。

原始自动指标保持为 65.6%。若只把本次确认合理的失败 Run 计入，投影可接受率为 96.8%；该投影不等于全量人工确认率，因为原本自动通过的 61 个 Run 未在本轮逐条重审。

优先建议：人工确认归因后，先进行 Policy v2.1 与 Evaluator 分类校准，当前不启动 Prompt v4.1。

## 二、归因统计

### Run 级主责任

- Prompt：3
- Policy：6
- Dataset：0
- Evaluator：23
- Ambiguous：0

### Sample 级主责任

- Prompt：1
- Policy：3
- Dataset：0
- Evaluator：9
- Ambiguous：0

## 三、样本级归因

| Sample | 失败 Run | 主责任层 | 共同影响层 | 建议动作 | 审查说明 |
|---|---:|---|---|---|---|
| phase15-v1-05 | 2 | evaluator | prompt | evaluator_fix | Root Cause 已正确识别缺少文本依据，但分类器返回 unknown；Run 1-2 还存在独立的 answerStatus 校准问题。 |
| phase15-v1-06 | 3 | prompt | - | prompt_change | 回答给出了可能成立的目的，但没有材料依据；模型连续三次判为 fully_meets 且未发现缺口。 |
| phase15-v1-07 | 3 | evaluator | - | evaluator_fix | 三次 Root Cause 都清楚描述了概括不完整，但 Evaluator 未能映射到 incomplete_summary。 |
| phase15-v1-08 | 2 | policy | evaluator, prompt | policy_change | 对于表达题中的笼统理由，missing_evidence 与 expression_incomplete 均可成立；v2 类别边界过窄，answerStatus 漂移则是另一项 Prompt 问题。 |
| phase15-v1-09 | 1 | evaluator | - | evaluator_fix | Root Cause 已明确指出“褪色”与“价值昂贵”之间的错误关系，但其中一次被误分类为 missing_evidence。 |
| phase15-v1-10 | 3 | evaluator | - | evaluator_fix | 三次 Root Cause 都描述了缺乏依据或错误的因果推断，但全部被分类为 unknown。 |
| phase15-v1-11 | 3 | evaluator | - | evaluator_fix | 答案给出了无关的因果理由；Evaluator 将其映射为 unknown 或表达类别，而不是 incorrect_causal_relation / unsupported_inference。 |
| phase15-v1-12 | 3 | policy | evaluator | policy_change | Dataset v1 接受“添加不存在事实 / 事实错误”，但 Annotation v2 对该样本类别遗漏了 incomplete_summary 与 misread_key_detail。 |
| phase15-v1-13 | 1 | evaluator | - | evaluator_fix | 失败 Run 已清楚描述“引用动作正确但心理推断错误”，Evaluator 却返回 unknown。 |
| phase15-v1-14 | 3 | evaluator | - | evaluator_fix | 三次 Root Cause 都识别了缺乏依据的“惩罚”解释，但 Evaluator 全部返回 unknown。 |
| phase15-v1-15 | 3 | evaluator | - | evaluator_fix | 三次 Root Cause 都识别了在相关事件概括中加入无依据结论的问题，但 Evaluator 全部返回 unknown。 |
| phase15-v1-16 | 2 | policy | - | policy_change | Dataset v1 允许 fully_meets，但 Annotation v2 只允许 missing_evidence；“未发现明确缺口”与被允许的 fully_meets 路径并不冲突。 |
| phase15-v1-17 | 3 | evaluator | - | evaluator_fix | 三次 Root Cause 都识别了深层目的或关系缺失，但 Evaluator 将其映射为 misread_key_detail 或 unknown。 |

## 四、Run 级明细

| Case | Answer Status | 允许 Root Cause | 检出类别 | 实际理由 | 主责任层 | 建议动作 |
|---|---|---|---|---|---|---|
| phase15-v1-05#1 | insufficient_evidence | missing_evidence | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-05#2 | insufficient_evidence | missing_evidence | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-06#1 | fully_meets | missing_evidence | no_clear_deficit_in_current_response | unreasonable | prompt | prompt_change |
| phase15-v1-06#2 | fully_meets | missing_evidence | no_clear_deficit_in_current_response | unreasonable | prompt | prompt_change |
| phase15-v1-06#3 | fully_meets | missing_evidence | no_clear_deficit_in_current_response | unreasonable | prompt | prompt_change |
| phase15-v1-07#1 | does_not_meet | incomplete_summary | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-07#2 | does_not_meet | incomplete_summary | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-07#3 | does_not_meet | incomplete_summary | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-08#1 | does_not_meet | expression_incomplete | missing_evidence | reasonable | policy | policy_change |
| phase15-v1-08#3 | insufficient_evidence | expression_incomplete | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-09#2 | does_not_meet | incorrect_causal_relation, unsupported_inference | missing_evidence | reasonable | evaluator | evaluator_fix |
| phase15-v1-10#1 | does_not_meet | incorrect_causal_relation, unsupported_inference | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-10#2 | does_not_meet | incorrect_causal_relation, unsupported_inference | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-10#3 | does_not_meet | incorrect_causal_relation, unsupported_inference | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-11#1 | does_not_meet | incorrect_causal_relation, unsupported_inference | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-11#2 | does_not_meet | incorrect_causal_relation, unsupported_inference | missing_evidence, expression_incomplete | reasonable | evaluator | evaluator_fix |
| phase15-v1-11#3 | does_not_meet | incorrect_causal_relation, unsupported_inference | expression_incomplete | reasonable | evaluator | evaluator_fix |
| phase15-v1-12#1 | does_not_meet | incorrect_causal_relation, unsupported_inference | incomplete_summary, misread_key_detail | reasonable | policy | policy_change |
| phase15-v1-12#2 | does_not_meet | incorrect_causal_relation, unsupported_inference | unknown | reasonable | policy | policy_change |
| phase15-v1-12#3 | does_not_meet | incorrect_causal_relation, unsupported_inference | unknown | reasonable | policy | policy_change |
| phase15-v1-13#2 | does_not_meet | incorrect_causal_relation, unsupported_inference, misread_key_detail | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-14#1 | does_not_meet | incorrect_causal_relation, unsupported_inference, misread_key_detail | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-14#2 | does_not_meet | incorrect_causal_relation, unsupported_inference, misread_key_detail | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-14#3 | does_not_meet | incorrect_causal_relation, unsupported_inference, misread_key_detail | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-15#1 | does_not_meet | incomplete_summary, unsupported_inference, misread_key_detail | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-15#2 | does_not_meet | incomplete_summary, unsupported_inference, misread_key_detail | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-15#3 | does_not_meet | incomplete_summary, unsupported_inference, misread_key_detail | unknown | reasonable | evaluator | evaluator_fix |
| phase15-v1-16#1 | fully_meets | missing_evidence | no_clear_deficit_in_current_response | reasonable | policy | policy_change |
| phase15-v1-16#3 | fully_meets | missing_evidence | no_clear_deficit_in_current_response | reasonable | policy | policy_change |
| phase15-v1-17#1 | partially_meets | missing_evidence | misread_key_detail | reasonable | evaluator | evaluator_fix |
| phase15-v1-17#2 | partially_meets | missing_evidence | misread_key_detail | reasonable | evaluator | evaluator_fix |
| phase15-v1-17#3 | partially_meets | missing_evidence | unknown | reasonable | evaluator | evaluator_fix |

## 五、安全边界

- Provider 调用：0；
- Prompt、Policy、Dataset 修改：否；
- Evidence 创建：否；
- Profile 更新：否；
- Raw Output 保存：否。

## 六、限制

- This report reviews only the 32 Root Cause Category failures in the frozen Prompt v4 calibrated baseline.
- The attribution is an agent-assisted initial review. Final human adjudication and agreement are still required before changing Policy or Prompt.
- The projected post-attribution rate assumes the 61 automatically accepted Root Cause runs remain valid; those runs were not fully re-adjudicated here.
- Attribution is an offline human review artifact and must not be used as an online quality classifier for new student responses.
- No Prompt, Policy, Dataset, Annotation or Runtime behavior is changed by this report.
