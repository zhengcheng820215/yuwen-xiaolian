# Phase 15.2 Prompt v3 Calibrated Baseline

状态：requires_human_review

## 一、固定配置

- Dataset：`1.0.0`
- Provider / Model：`deepseek_chat / deepseek-v4-flash`
- Prompt：`real_ai_diagnosis_prompt_v3`
- Temperature：0.2
- 执行模式：shadow
- 逻辑 Run / Provider 调用：108 / 93
- 来源报告：`phase15-prompt-v3-baseline-2026-07-17T09-22-45-030Z`

## 二、预注册门槛

| 指标 | 实际 | 门槛 | 结果 |
|---|---:|---:|---|
| providerAvailability | 100.0% | 100.0% | PASS |
| formalCandidateSchemaValidity | 100.0% | 100.0% | PASS |
| invalidResponseSafety | 100.0% | 100.0% | PASS |
| mainAbility | 100.0% | 90.0% | PASS |
| answerStatus | 84.9% | 85.0% | FAIL |
| rootCauseCategory | 53.8% | 80.0% | FAIL |
| reasonableAlternativeAcceptance | 25.0% | 75.0% | FAIL |
| conciseValidAcceptance | 66.7% | 75.0% | FAIL |
| boundaryStability | 83.9% | 85.0% | FAIL |
| criticalModelViolationCount | 0 | 0 | PASS |

## 三、Provider 层

- 调用完成 / 失败：93 / 0
- Provider 可用率：100.0%
- Raw Schema 合法率：100.0%
- Formal Candidate Schema 合法率：100.0%
- Token 总量：126999
- 平均延迟：2726ms
- Retry：0

## 四、模型质量层

- Main Ability：93/93 (100.0%)
- Answer Status：79/93 (84.9%)
- Root Cause Category：50/93 (53.8%)
- Reasonable Alternative Acceptance：3/12 (25.0%)
- Concise Valid Acceptance：6/9 (66.7%)
- Boundary Stability：26/31 (83.9%)
- Critical Model Violation：0
- 质量分布：`{"accepted":39,"questionable":40,"unacceptable":14,"critical_violation":0}`

## 五、评估器质量层

- Evaluator False Positive Finding：62
- Confirmed Model Issue Finding：42
- Mixed Issue Run：11
- Human Review Run：54

## 六、安全结果

- Validity Gate 阻断：15
- 无效作答安全率：100.0%
- Evidence created：false
- Profile updated：false
- API Key、完整 Prompt、Raw Output 写入报告：false

## 七、优先人工复核

| Run | Policy v2 质量 | 归因 |
|---|---|---|
| `phase15-v1-02#3` | questionable | evaluator_false_positive, confirmed_model_issue |
| `phase15-v1-04#1` | unacceptable | confirmed_model_issue, insufficient_evidence |
| `phase15-v1-04#2` | unacceptable | confirmed_model_issue, confirmed_model_issue |
| `phase15-v1-06#1` | questionable | insufficient_evidence |
| `phase15-v1-06#2` | questionable | insufficient_evidence |
| `phase15-v1-06#3` | questionable | insufficient_evidence |
| `phase15-v1-07#1` | questionable | insufficient_evidence |
| `phase15-v1-07#2` | questionable | insufficient_evidence |
| `phase15-v1-07#3` | questionable | insufficient_evidence |
| `phase15-v1-08#1` | unacceptable | confirmed_model_issue, evaluator_false_positive |
| `phase15-v1-08#2` | unacceptable | confirmed_model_issue, evaluator_false_positive |
| `phase15-v1-08#3` | unacceptable | confirmed_model_issue |
| `phase15-v1-09#1` | questionable | insufficient_evidence |
| `phase15-v1-09#2` | questionable | confirmed_model_issue |
| `phase15-v1-09#3` | questionable | confirmed_model_issue |
| `phase15-v1-10#1` | questionable | insufficient_evidence, confirmed_model_issue |
| `phase15-v1-10#2` | questionable | confirmed_model_issue |
| `phase15-v1-10#3` | questionable | insufficient_evidence |
| `phase15-v1-11#1` | questionable | confirmed_model_issue |
| `phase15-v1-11#2` | questionable | confirmed_model_issue, confirmed_model_issue |
| `phase15-v1-11#3` | questionable | confirmed_model_issue, confirmed_model_issue |
| `phase15-v1-12#1` | questionable | confirmed_model_issue, confirmed_model_issue |
| `phase15-v1-12#2` | questionable | insufficient_evidence |
| `phase15-v1-12#3` | questionable | insufficient_evidence, confirmed_model_issue |
| `phase15-v1-13#1` | questionable | insufficient_evidence |
| `phase15-v1-13#2` | questionable | insufficient_evidence |
| `phase15-v1-13#3` | questionable | insufficient_evidence |
| `phase15-v1-14#2` | questionable | insufficient_evidence |
| `phase15-v1-14#3` | questionable | insufficient_evidence |
| `phase15-v1-15#1` | unacceptable | confirmed_model_issue, evaluator_false_positive, evaluator_false_positive |
| `phase15-v1-15#2` | unacceptable | confirmed_model_issue, evaluator_false_positive |
| `phase15-v1-15#3` | unacceptable | confirmed_model_issue |
| `phase15-v1-17#1` | questionable | insufficient_evidence |
| `phase15-v1-17#2` | questionable | insufficient_evidence |
| `phase15-v1-17#3` | questionable | insufficient_evidence |
| `phase15-v1-18#1` | questionable | evaluator_false_positive, confirmed_model_issue |
| `phase15-v1-18#2` | questionable | insufficient_evidence, confirmed_model_issue |
| `phase15-v1-18#3` | questionable | insufficient_evidence, confirmed_model_issue |
| `phase15-v1-19#1` | questionable | evaluator_false_positive, confirmed_model_issue |
| `phase15-v1-21#3` | questionable | evaluator_false_positive, confirmed_model_issue |
| `phase15-v1-22#2` | questionable | insufficient_evidence |
| `phase15-v1-22#3` | questionable | insufficient_evidence |
| `phase15-v1-23#1` | unacceptable | confirmed_model_issue, confirmed_model_issue |
| `phase15-v1-23#2` | unacceptable | confirmed_model_issue, confirmed_model_issue, evaluator_false_positive |
| `phase15-v1-23#3` | unacceptable | confirmed_model_issue, insufficient_evidence, evaluator_false_positive |
| `phase15-v1-25#1` | questionable | confirmed_model_issue |
| `phase15-v1-25#2` | questionable | confirmed_model_issue |
| `phase15-v1-25#3` | questionable | insufficient_evidence |
| `phase15-v1-26#1` | unacceptable | confirmed_model_issue, confirmed_model_issue, confirmed_model_issue |
| `phase15-v1-26#2` | unacceptable | confirmed_model_issue, insufficient_evidence, confirmed_model_issue |
| `phase15-v1-26#3` | unacceptable | confirmed_model_issue, insufficient_evidence, confirmed_model_issue |
| `phase15-v1-27#2` | questionable | evaluator_false_positive, confirmed_model_issue |
| `phase15-v1-29#2` | questionable | insufficient_evidence, evaluator_false_positive |
| `phase15-v1-29#3` | questionable | insufficient_evidence |

## 八、结论边界

- Dataset v1 is an engineering and educational-boundary baseline, not a representative product-quality dataset.
- Automatic threshold success does not freeze Phase 15.2; questionable, unacceptable, critical and sampled accepted runs still require human review.
- Candidate snapshots are structured and deidentified; API keys, full prompts and raw provider outputs are not stored.
