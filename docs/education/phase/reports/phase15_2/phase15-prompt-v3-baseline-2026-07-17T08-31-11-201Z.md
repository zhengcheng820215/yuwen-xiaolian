# Phase 15.2 Prompt v3 基线报告

状态：自动 Shadow Batch 已完成 / 生成报告时人工复核待处理

> 本文是全量 Batch 完成时生成的原始基线快照，数值与自动判定保持不变。后续人工复核结论见 [Prompt v3 人工复核报告](./PHASE15_PROMPT_V3_HUMAN_REVIEW.md)。

## 运行配置

- 数据集：`phase15-real-diagnosis-dataset-v1 / 1.0.0`
- Provider / 模型：`deepseek_chat / deepseek-v4-flash`
- Prompt / Repair：`real_ai_diagnosis_prompt_v3 / diagnosis_repair_policy_v1`
- Temperature：`0.2`
- 执行模式：`shadow`
- 每个样本运行次数：3

## 运行摘要

- 计划 / 完成逻辑 Run：108 / 108
- 计划 / 完成 Provider 调用：93 / 93
- Provider 失败 Run：0
- 可接受 / 待复核 / 不可接受 / 关键违规：16 / 77 / 11 / 4

## 指标

| 指标 | 分子 | 分母 | 排除数量 | 比例 |
| --- | ---: | ---: | ---: | ---: |
| Provider 可用性（`providerAvailability`） | 93 | 93 | 15 | 100.0% |
| 原始 Schema 合法率（`rawSchemaValidity`） | 93 | 93 | 0 | 100.0% |
| Repair 后 Schema 合法率（`postRepairSchemaValidity`） | 93 | 93 | 0 | 100.0% |
| Formal Candidate Schema 合法率（`formalCandidateSchemaValidity`） | 93 | 93 | 0 | 100.0% |
| 主要能力准确率（`mainAbilityAccuracy`） | 93 | 93 | 0 | 100.0% |
| 答案状态准确率（`answerStatusAccuracy`） | 80 | 93 | 0 | 86.0% |
| 根因可接受率（`rootCauseAcceptability`） | 7 | 93 | 0 | 7.5% |
| 学生原话引用真实性（`studentQuoteFidelity`） | 89 | 93 | 0 | 95.7% |
| 文本依据真实性（`textEvidenceFidelity`） | 89 | 93 | 0 | 95.7% |
| 无效回答安全率（`invalidResponseSafety`） | 15 | 15 | 0 | 100.0% |
| 语义稳定性（`semanticStability`） | 29 | 36 | 0 | 80.6% |
| 至少 2 / 3 次可接受的样本（`samplesAcceptedAtLeastTwoOfThree`） | 5 | 36 | 0 | 13.9% |
| 3 / 3 次稳定可接受的样本（`samplesStableThreeOfThree`） | 5 | 36 | 0 | 13.9% |

> 注意：这是 Quality Policy v1 生成时的原始分母。后续审查确认其中 5 个稳定样本只经过 Validity Gate，并未调用真实 Diagnosis。报告器现已修正，未来的 Diagnosis 语义稳定性只统计 Provider 可诊断样本；当前基线按修正后的解释为 24 / 31，即 77.4%。

## Provider 运行情况

- 输入 / 输出 / 总 Token：103341 / 23225 / 126566
- 平均耗时：2594 ms
- 重试次数：0
- 错误分类：`{}`

## 复核队列

- 优先复核：`phase15-v1-01, phase15-v1-02, phase15-v1-03, phase15-v1-04, phase15-v1-05, phase15-v1-06, phase15-v1-07, phase15-v1-08, phase15-v1-09, phase15-v1-10, phase15-v1-11, phase15-v1-12, phase15-v1-13, phase15-v1-14, phase15-v1-15, phase15-v1-16, phase15-v1-17, phase15-v1-18, phase15-v1-19, phase15-v1-20, phase15-v1-21, phase15-v1-22, phase15-v1-23, phase15-v1-24, phase15-v1-25, phase15-v1-26, phase15-v1-27, phase15-v1-28, phase15-v1-29, phase15-v1-35, phase15-v1-36`
- 生成报告时的可接受结果抽查样本：`phase15-v1-30, phase15-v1-31, phase15-v1-32, phase15-v1-34`
- 生成报告时的人工复核结论：待处理

## 安全边界

- 是否生成 Evidence：否
- 是否更新 Profile：否
- 本报告是否保存 Secret、完整 Prompt 或 Raw Output：否

自动基线判定：因关键违规被阻断（`blocked_by_critical_violation`）
