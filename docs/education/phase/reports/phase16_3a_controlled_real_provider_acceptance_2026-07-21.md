# Phase 16.3A Controlled Real Provider Integration Acceptance

验收日期：2026-07-21

验收状态：`PASS`

Provider / Model：`deepseek_chat / deepseek-v4-flash`

Prompt：`real_ai_diagnosis_prompt_v4`

## 一、验收范围

本次验收在明确授权下，将一份 Frozen Resource、模拟学生有效答案和 Prompt v4 诊断请求发送至 DeepSeek，并由 Phase 16.3A Orchestrator 串联既有正式 Runtime：

```text
Frozen Resource A
→ ConcreteLearningTask
→ StudentResponse
→ Real DeepSeek Diagnosis
→ Formal Diagnosis Commit
→ AbilityEvidence / Existing Phase 8 / Phase 14.1
→ Controlled Feedback
→ Persistence / Recovery
→ NextLearningStrategy / TaskRequest
→ Frozen Resource B
```

API Key、完整 Prompt、Raw Model Output 和完整敏感数据未写入报告、日志或 Git。

## 二、真实运行摘要

| 项目 | 结果 |
| --- | --- |
| 检查项 | `11 / 11 PASS` |
| Provider 调用 | `1` 次 |
| Runtime | `formal_result_committed` |
| Diagnosis Admission | `accepted`，basis = `formal_runtime_validation` |
| AbilityEvidence | `1` 条 |
| Profile / GrowthMemory | 各形成一次正式结果 |
| 下一资源 | 匹配另一份 Frozen Resource |
| 重复提交 | 复用原正式结果，Provider 保持 1 次 |
| Repository 重建恢复 | PASS，未重跑 Diagnosis |
| 无效作答 | Provider 前阻断 |
| questionable Diagnosis | `review_required`，不生成 Evidence |
| 延迟 | `2523 ms` |
| Token | input `1812` / output `237` / total `2049` |
| Retry | `0` |

## 三、验收 Cases

1. 完整主链完成，Checkpoint 到达 `next_task_ready`；
2. Real Diagnosis 合法提交并通过正式准入；
3. Evidence、Profile 和 GrowthMemory 各形成一次；
4. 正式回合结果成功持久化；
5. 下一任务使用另一份 Frozen Resource；
6. DeepSeek 只调用一次；
7. 重复提交复用同一 Formal Commit 与 Evidence；
8. Repository 重建后恢复，Diagnosis 不重跑；
9. 无效作答在 Provider 前阻断；
10. questionable Diagnosis 保持 `review_required` 且不回流 Evidence；
11. Acceptance Checks 与 Evidence Traceability 全部通过。

本次普通 Live 结果保留 `not_individually_human_annotated` limitation。它通过的是正式 Runtime Schema、Identity、Boundary 与 Commit Gate，不等同于 Dataset v1 样本的逐条人工质量标注；若后续质量状态为 `questionable`，仍必须进入人工复核且不得自动回流。

## 四、冻结回归

- Phase 16.3A Deterministic Debug：`14 / 14 PASS`；
- Phase 1–16.2 Single-object E2E：`5 / 5 PASS`；
- Phase 15 Integrated Debug：`11 / 11 PASS`；
- Phase 16.1 → 16.2 Integration：`5 / 5 PASS`；
- Phase 12 Integrated Acceptance：`9 / 9 PASS`；
- Phase 14 Integrated Case 27：`16 / 16 PASS`；
- Production Build：PASS。

## 五、能力边界

本次验收可以证明：

> Phase 16.3A 能在同一受控产品链中消费真实 DeepSeek Diagnosis，安全形成正式 Evidence、长期状态和下一份正式资源，并在重复提交和 Repository 重建后保持幂等。

本次验收不能证明：

- DeepSeek 对全部题型和真实学生答案均具有稳定教育质量；
- Phase 16.3B 统一学生入口已经完成；
- Phase 16.3C 5—7 个自然日真实运行已经完成；
- 教学策略有效或学生能力长期提升；
- 多学生、多标签页或云端并发已经成立。

## 六、正式状态

```text
Phase 16.3A Engineering / Debug: PASS
Phase 16.3A Lightweight Demo Acceptance: PASS
Phase 16.3A Controlled Real Provider Integration: PASS
Phase 16.3A Overall: PASS / FROZEN
Phase 16.3B: READY
```
