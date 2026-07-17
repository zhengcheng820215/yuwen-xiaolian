# Phase 15.2 Prompt v3 人工复核样本包

状态：自动 Shadow Batch 已完成 / 生成报告时人工复核待处理

> 本文是优先异常样本复跑完成时生成的原始复核包，数值和自动标签保持不变。人工复核后的解释与结论见 [Prompt v3 人工复核报告](./PHASE15_PROMPT_V3_HUMAN_REVIEW.md)。

## 运行配置

- 数据集：`phase15-real-diagnosis-dataset-v1 / 1.0.0`
- Provider / 模型：`deepseek_chat / deepseek-v4-flash`
- Prompt / Repair：`real_ai_diagnosis_prompt_v3 / diagnosis_repair_policy_v1`
- Temperature：`0.2`
- 执行模式：`shadow`
- 报告用途：人工复核样本包（`manual_review_packet`）
- 每个样本运行次数：3

## 运行摘要

- 计划 / 完成逻辑 Run：36 / 36
- 计划 / 完成 Provider 调用：36 / 36
- Provider 失败 Run：0
- 可接受 / 待复核 / 不可接受 / 关键违规：0 / 23 / 11 / 2

## 指标

| 指标 | 分子 | 分母 | 排除数量 | 比例 |
| --- | ---: | ---: | ---: | ---: |
| Provider 可用性（`providerAvailability`） | 36 | 36 | 0 | 100.0% |
| 原始 Schema 合法率（`rawSchemaValidity`） | 36 | 36 | 0 | 100.0% |
| Repair 后 Schema 合法率（`postRepairSchemaValidity`） | 36 | 36 | 0 | 100.0% |
| Formal Candidate Schema 合法率（`formalCandidateSchemaValidity`） | 36 | 36 | 0 | 100.0% |
| 主要能力准确率（`mainAbilityAccuracy`） | 36 | 36 | 0 | 100.0% |
| 答案状态准确率（`answerStatusAccuracy`） | 23 | 36 | 0 | 63.9% |
| 根因可接受率（`rootCauseAcceptability`） | 2 | 36 | 0 | 5.6% |
| 学生原话引用真实性（`studentQuoteFidelity`） | 34 | 36 | 0 | 94.4% |
| 文本依据真实性（`textEvidenceFidelity`） | 34 | 36 | 0 | 94.4% |
| 无效回答安全率（`invalidResponseSafety`） | 0 | 0 | 0 | 0.0% |
| 语义稳定性（`semanticStability`） | 7 | 12 | 0 | 58.3% |
| 至少 2 / 3 次可接受的样本（`samplesAcceptedAtLeastTwoOfThree`） | 0 | 12 | 0 | 0.0% |
| 3 / 3 次稳定可接受的样本（`samplesStableThreeOfThree`） | 0 | 12 | 0 | 0.0% |

## Provider 运行情况

- 输入 / 输出 / 总 Token：40281 / 8916 / 49197
- 平均耗时：2494 ms
- 重试次数：0
- 错误分类：`{}`

## 复核队列

- 优先复核：`phase15-v1-01, phase15-v1-02, phase15-v1-03, phase15-v1-04, phase15-v1-05, phase15-v1-08, phase15-v1-13, phase15-v1-15, phase15-v1-23, phase15-v1-26, phase15-v1-29, phase15-v1-36`
- 可接受结果抽查样本：无
- 生成报告时的人工复核结论：待处理

### 优先 Run 的自动判定原因

| Run | 质量标签 | 未通过维度 | 违规项 |
| --- | --- | --- | --- |
| `phase15-v1-04#1` | 不可接受（`unacceptable`） | `answerStatusAccepted, rootCauseAcceptable` | 无 |
| `phase15-v1-04#3` | 不可接受（`unacceptable`） | `answerStatusAccepted` | 无 |
| `phase15-v1-08#1` | 不可接受（`unacceptable`） | `answerStatusAccepted, rootCauseAcceptable` | 无 |
| `phase15-v1-08#2` | 不可接受（`unacceptable`） | `answerStatusAccepted, rootCauseAcceptable` | 无 |
| `phase15-v1-08#3` | 不可接受（`unacceptable`） | `answerStatusAccepted, rootCauseAcceptable` | 无 |
| `phase15-v1-15#1` | 不可接受（`unacceptable`） | `answerStatusAccepted, rootCauseAcceptable` | 无 |
| `phase15-v1-15#2` | 关键违规（`critical_violation`） | `answerStatusAccepted, studentQuoteFaithful, textEvidenceFaithful, noCriticalHallucination` | 自动检测为虚构引用：“保留主要事件”“表达简洁完整” |
| `phase15-v1-15#3` | 关键违规（`critical_violation`） | `answerStatusAccepted, rootCauseAcceptable, studentQuoteFaithful, textEvidenceFaithful, noCriticalHallucination` | 自动检测为虚构引用：“表达简洁完整” |
| `phase15-v1-23#2` | 不可接受（`unacceptable`） | `answerStatusAccepted, rootCauseAcceptable` | 无 |
| `phase15-v1-23#3` | 不可接受（`unacceptable`） | `answerStatusAccepted, rootCauseAcceptable` | 无 |
| `phase15-v1-26#1` | 不可接受（`unacceptable`） | `answerStatusAccepted, rootCauseAcceptable` | 无 |
| `phase15-v1-26#2` | 不可接受（`unacceptable`） | `answerStatusAccepted, rootCauseAcceptable, requiredFactsPresent` | 无 |
| `phase15-v1-26#3` | 不可接受（`unacceptable`） | `answerStatusAccepted, rootCauseAcceptable, requiredFactsPresent` | 无 |

> 人工复核确认，Sample 15 的“虚构引用”主要由 Quality Policy v1 把 Rubric 名称误识别为学生原话造成，属于评估器误报，并非已经确认的模型 Critical Hallucination。

## 安全边界

- 是否生成 Evidence：否
- 是否更新 Profile：否
- 本报告是否保存 Secret、完整 Prompt 或 Raw Output：否

自动基线判定：因关键违规被阻断（`blocked_by_critical_violation`）
