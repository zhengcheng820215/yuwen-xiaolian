# Phase 15.2 Root Cause Policy v2.1 Calibration

状态：policy_v2_1_ready_for_human_confirmation
模式：离线重评已有 Candidate，Provider 调用 0
Policy：diagnosis_quality_policy_v2_1

## 一、结果

- Root Cause 接受：90 / 93（96.8%）；
- 29 个合理失败 Run 恢复：29 / 29；
- 3 个 Prompt 错误继续阻断：3 / 3；
- 原 61 个自动通过 Run 保持：61 / 61；
- unknown：0；conflicting：0。

## 二、防过拟合验收

| 状态 | 约束 | 实际 | 要求 |
|---|---|---|---|
| PASS | root_cause_acceptance_at_least_80_percent | 90/93 | >= 80% |
| PASS | reasonable_29_no_regression | 29/29 | 29/29 |
| PASS | prompt_error_3_remain_blocked | 3/3 | 3/3 |
| PASS | previously_accepted_61_preserved | 61/61 | 61/61 |
| PASS | unknown_significantly_reduced | 0 | <= 3 |
| PASS | no_conflicting_classification_accepted | 0 | 0 accepted conflicts |
| PASS | unseen_paraphrase_holdout_pass | 7/7 | 7/7 |
| PASS | classifier_has_no_identity_input | 1 | 1 rootCause-only argument |

## 三、未见表达回归

| 状态 | Case | 结果 |
|---|---|---|
| PASS | 未见同义表达：缺少依据关系 | classified: missing_evidence |
| PASS | 未见同义表达：错误目的推断 | classified: incorrect_causal_relation |
| PASS | 未见同义表达：添加材料外信息 | classified: unsupported_inference |
| PASS | 未见同义表达：概括遗漏 | classified: incomplete_summary |
| PASS | 无明确缺口 | classified: no_clear_deficit_in_current_response |
| PASS | 互斥类别冲突不得吞并 | conflicting: no_clear_deficit_in_current_response,missing_evidence |
| PASS | 无具体语义保持 unknown | unknown: unknown |

## 四、多标签边界

- 仅当至少一个已检出的具体类别被人工边界明确允许时，该 Run 才能通过。
- `no_clear_deficit` 与任何明确缺陷类别互斥。
- 多个缺陷类别可以同时存在并保持可见，不得静默丢弃任何类别。
- 当 `fully_meets` 属于人工允许状态时，即使旧标注只列出了缺陷路径，也可接受 `no_clear_deficit`。
- `unknown` 和 `conflicting` 始终需要复核，不得自动通过。

## 五、61 个原通过 Run 的复核状态

已完成全量 Agent 初步语义复核与 v2.1 回归，仍需人工确认；本报告不把该步骤表述为人工共识。

## 六、安全边界

- 未调用 Provider；
- 未修改 Prompt 或 Dataset；
- 未创建 Evidence；
- 未更新 Profile；
- 未切换线上 Runtime。

## 七、下一步

在任何正式评估链路中替换 Policy v2 之前，需人工确认 29 个已恢复 Run、3 个持续阻断的 Prompt 错误，以及 61 个原通过 Run 的全量保持性审核。
