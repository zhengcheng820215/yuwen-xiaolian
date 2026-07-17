# Phase 15.2 real_ai_diagnosis_prompt_v4 Calibrated Baseline

状态：requires_human_review

## 一、固定配置

- Dataset：`1.0.0`
- Provider / Model：`deepseek_chat / deepseek-v4-flash`
- Prompt：`real_ai_diagnosis_prompt_v4`
- Temperature：0.2
- 执行模式：shadow
- 逻辑 Run / Provider 调用：108 / 93
- 来源报告：`phase15-prompt-v4-baseline-2026-07-17T10-03-19-131Z`

## 二、预注册门槛

| 指标 | 实际 | 门槛 | 结果 |
|---|---:|---:|---|
| providerAvailability | 100.0% | 100.0% | PASS |
| formalCandidateSchemaValidity | 100.0% | 100.0% | PASS |
| invalidResponseSafety | 100.0% | 100.0% | PASS |
| mainAbility | 100.0% | 90.0% | PASS |
| answerStatus | 91.4% | 85.0% | PASS |
| rootCauseCategory | 65.6% | 80.0% | FAIL |
| reasonableAlternativeAcceptance | 100.0% | 75.0% | PASS |
| conciseValidAcceptance | 100.0% | 75.0% | PASS |
| boundaryStability | 90.3% | 85.0% | PASS |
| criticalModelViolationCount | 0 | 0 | PASS |

## 三、Provider 层

- 调用完成 / 失败：93 / 0
- Provider 可用率：100.0%
- Raw Schema 合法率：100.0%
- Formal Candidate Schema 合法率：100.0%
- Token 总量：183779
- 平均延迟：2918ms
- Retry：0

## 四、模型质量层

- Main Ability：93/93 (100.0%)
- Answer Status：85/93 (91.4%)
- Root Cause Category：61/93 (65.6%)
- Reasonable Alternative Acceptance：12/12 (100.0%)
- Concise Valid Acceptance：9/9 (100.0%)
- Boundary Stability：28/31 (90.3%)
- Critical Model Violation：0
- 质量分布：`{"accepted":55,"questionable":30,"unacceptable":8,"critical_violation":0}`

## 五、评估器质量层

- Evaluator False Positive Finding：65
- Confirmed Model Issue Finding：26
- Mixed Issue Run：5
- Human Review Run：38

## 六、安全结果

- Validity Gate 阻断：15
- 无效作答安全率：100.0%
- Evidence created：false
- Profile updated：false
- API Key、完整 Prompt、Raw Output 写入报告：false

## 七、优先人工复核

| Run | Policy v2 质量 | 归因 |
|---|---|---|
| `phase15-v1-04#2` | questionable | evaluator_false_positive, confirmed_model_issue |
| `phase15-v1-05#1` | unacceptable | confirmed_model_issue, insufficient_evidence |
| `phase15-v1-05#2` | unacceptable | confirmed_model_issue, insufficient_evidence |
| `phase15-v1-06#1` | unacceptable | confirmed_model_issue, confirmed_model_issue |
| `phase15-v1-06#2` | unacceptable | confirmed_model_issue, confirmed_model_issue |
| `phase15-v1-06#3` | unacceptable | confirmed_model_issue, confirmed_model_issue |
| `phase15-v1-07#1` | questionable | insufficient_evidence |
| `phase15-v1-07#2` | questionable | insufficient_evidence |
| `phase15-v1-07#3` | questionable | insufficient_evidence |
| `phase15-v1-08#1` | unacceptable | confirmed_model_issue, confirmed_model_issue |
| `phase15-v1-08#2` | unacceptable | confirmed_model_issue, evaluator_false_positive, evaluator_false_positive |
| `phase15-v1-08#3` | unacceptable | confirmed_model_issue, insufficient_evidence |
| `phase15-v1-09#1` | questionable | confirmed_model_issue |
| `phase15-v1-09#2` | questionable | confirmed_model_issue |
| `phase15-v1-10#1` | questionable | insufficient_evidence |
| `phase15-v1-10#2` | questionable | insufficient_evidence |
| `phase15-v1-10#3` | questionable | insufficient_evidence |
| `phase15-v1-11#1` | questionable | insufficient_evidence |
| `phase15-v1-11#2` | questionable | confirmed_model_issue |
| `phase15-v1-11#3` | questionable | confirmed_model_issue |
| `phase15-v1-12#1` | questionable | confirmed_model_issue |
| `phase15-v1-12#2` | questionable | insufficient_evidence |
| `phase15-v1-12#3` | questionable | insufficient_evidence, confirmed_model_issue, evaluator_false_positive |
| `phase15-v1-13#2` | questionable | insufficient_evidence |
| `phase15-v1-14#1` | questionable | insufficient_evidence |
| `phase15-v1-14#2` | questionable | insufficient_evidence |
| `phase15-v1-14#3` | questionable | insufficient_evidence |
| `phase15-v1-15#1` | questionable | insufficient_evidence |
| `phase15-v1-15#2` | questionable | insufficient_evidence |
| `phase15-v1-15#3` | questionable | insufficient_evidence |
| `phase15-v1-16#1` | questionable | confirmed_model_issue |
| `phase15-v1-16#3` | questionable | confirmed_model_issue |
| `phase15-v1-17#1` | questionable | confirmed_model_issue, evaluator_false_positive |
| `phase15-v1-17#2` | questionable | confirmed_model_issue |
| `phase15-v1-17#3` | questionable | insufficient_evidence |
| `phase15-v1-18#1` | questionable | confirmed_model_issue |
| `phase15-v1-18#2` | questionable | confirmed_model_issue |
| `phase15-v1-27#3` | questionable | evaluator_false_positive, confirmed_model_issue |

## 八、结论边界

- Dataset v1 is an engineering and educational-boundary baseline, not a representative product-quality dataset.
- Automatic threshold success does not freeze Phase 15.2; questionable, unacceptable, critical and sampled accepted runs still require human review.
- Candidate snapshots are structured and deidentified; API keys, full prompts and raw provider outputs are not stored.
