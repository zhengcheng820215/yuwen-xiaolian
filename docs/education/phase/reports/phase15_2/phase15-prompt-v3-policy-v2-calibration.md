# Phase 15.2 Prompt v3 / Quality Policy v2 离线校准报告

状态：POLICY V2 CALIBRATION PASS

## 一、校准边界

- 来源报告：`phase15-prompt-v3-manual-review-2026-07-17T08-36-41-396Z`
- Dataset：`1.0.0`，内容未修改
- Annotation：`2.0.0`
- Quality Policy：`diagnosis_quality_policy_v2`
- Prompt：`real_ai_diagnosis_prompt_v3`
- Provider / Model：`deepseek_chat / deepseek-v4-flash`
- 本次 Provider 调用：0
- 重评 Candidate：36 个 Run / 12 个样本

本报告只重评人工复核包中已经保存的结构化 Candidate，不生成新的模型输出，也不是完整 Prompt v3 Calibrated Baseline。

## 二、重评结果

| 质量等级 | Run 数量 |
|---|---:|
| accepted | 20 |
| questionable | 3 |
| unacceptable | 13 |
| critical_violation | 0 |

## 三、模型质量层

| 指标 | 分子 | 分母 | 比例 |
|---|---:|---:|---:|
| Main Ability | 36 | 36 | 100.0% |
| Answer Status | 23 | 36 | 63.9% |
| Root Cause Category | 27 | 36 | 75.0% |
| Reasonable Alternative Acceptance | 1 | 6 | 16.7% |
| Concise Valid Acceptance | 0 | 0 | 0.0% |

## 四、评估器质量层

- Evaluator False Positive Finding：36
- Confirmed Model Issue Finding：21
- Mixed Issue Run：7
- 仍需人工复核 Run：16

## 五、稳定性

- Boundary Stability：`{"stable_within_boundary":7,"boundary_unstable":5,"critical_violation":0,"insufficient_runs":0}`
- Quality Stability：`{"stable_accepted":6,"stable_questionable":0,"quality_unstable":6,"critical_violation":0,"insufficient_runs":0}`

Boundary Stability 只判断 mainAbility、answerStatus 和 Critical Boundary；Quality Stability 继续观察 accepted、questionable 与 unacceptable 的漂移，两者不再混为一个指标。

## 六、逐 Run 归因

| Run | Policy v2 质量 | Root Cause 类别 | 问题归因 |
|---|---|---|---|
| `phase15-v1-01#1` | accepted | no_clear_deficit_in_current_response | evaluator_false_positive |
| `phase15-v1-01#2` | accepted | no_clear_deficit_in_current_response | evaluator_false_positive |
| `phase15-v1-01#3` | accepted | no_clear_deficit_in_current_response | evaluator_false_positive |
| `phase15-v1-02#1` | accepted | no_clear_deficit_in_current_response | evaluator_false_positive |
| `phase15-v1-02#2` | accepted | no_clear_deficit_in_current_response | evaluator_false_positive |
| `phase15-v1-02#3` | accepted | no_clear_deficit_in_current_response | evaluator_false_positive |
| `phase15-v1-03#1` | accepted | no_clear_deficit_in_current_response | evaluator_false_positive |
| `phase15-v1-03#2` | accepted | no_clear_deficit_in_current_response | evaluator_false_positive |
| `phase15-v1-03#3` | accepted | no_clear_deficit_in_current_response | evaluator_false_positive |
| `phase15-v1-04#1` | unacceptable | misread_key_detail | confirmed_model_issue |
| `phase15-v1-04#2` | questionable | no_clear_deficit_in_current_response | evaluator_false_positive, confirmed_model_issue |
| `phase15-v1-04#3` | unacceptable | unknown | confirmed_model_issue, insufficient_evidence |
| `phase15-v1-05#1` | accepted | missing_evidence | evaluator_false_positive |
| `phase15-v1-05#2` | accepted | missing_evidence | evaluator_false_positive |
| `phase15-v1-05#3` | accepted | missing_evidence | evaluator_false_positive |
| `phase15-v1-08#1` | unacceptable | expression_incomplete | confirmed_model_issue, evaluator_false_positive |
| `phase15-v1-08#2` | unacceptable | expression_incomplete | confirmed_model_issue, evaluator_false_positive |
| `phase15-v1-08#3` | unacceptable | expression_incomplete | confirmed_model_issue, evaluator_false_positive |
| `phase15-v1-13#1` | accepted | incorrect_causal_relation | evaluator_false_positive |
| `phase15-v1-13#2` | accepted | incorrect_causal_relation | evaluator_false_positive |
| `phase15-v1-13#3` | accepted | unsupported_inference | evaluator_false_positive |
| `phase15-v1-15#1` | unacceptable | misread_key_detail | confirmed_model_issue, evaluator_false_positive |
| `phase15-v1-15#2` | unacceptable | unsupported_inference, incomplete_summary, misread_key_detail | confirmed_model_issue, evaluator_false_positive |
| `phase15-v1-15#3` | unacceptable | incomplete_summary | confirmed_model_issue, evaluator_false_positive |
| `phase15-v1-23#1` | accepted | no_clear_deficit_in_current_response | evaluator_false_positive |
| `phase15-v1-23#2` | unacceptable | expression_incomplete | confirmed_model_issue |
| `phase15-v1-23#3` | unacceptable | expression_incomplete | confirmed_model_issue |
| `phase15-v1-26#1` | unacceptable | unknown | confirmed_model_issue, insufficient_evidence |
| `phase15-v1-26#2` | unacceptable | expression_incomplete | confirmed_model_issue |
| `phase15-v1-26#3` | unacceptable | expression_incomplete | confirmed_model_issue |
| `phase15-v1-29#1` | questionable | unknown | insufficient_evidence, evaluator_false_positive |
| `phase15-v1-29#2` | accepted | expression_incomplete | evaluator_false_positive |
| `phase15-v1-29#3` | questionable | unknown | insufficient_evidence, evaluator_false_positive |
| `phase15-v1-36#1` | accepted | incomplete_summary | evaluator_false_positive |
| `phase15-v1-36#2` | accepted | incomplete_summary | evaluator_false_positive |
| `phase15-v1-36#3` | accepted | incomplete_summary | evaluator_false_positive |

## 七、限制与下一步

- 本报告只重评优先人工复核包中已经保存的 Candidate Snapshot。
- 本次没有调用 Provider，也没有生成新的模型输出。
- 来源复核包不包含 concise_valid Candidate，因此本轮无法计算简短有效答案专项指标。
- 在完整 Dataset v1 重新运行或恢复全部原始 Candidate Snapshot 前，Policy v2 校准结果不等于完整 Prompt v3 Calibrated Baseline。

下一步应先人工确认本报告中的剩余模型问题，再以相同 Prompt v3 配置重跑完整 Dataset v1，形成正式 Calibrated Baseline；在此之前不进入 Prompt v4。
