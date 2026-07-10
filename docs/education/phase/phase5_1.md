# Phase 5.1：Personalized Next Task 最小闭环

## 阶段背景

Phase 4.2 已完成 Real AI Diagnosis Runtime 结构闭环：

```text
真实题目 + 学生答案
-> Prompt Builder
-> Diagnosis Result
-> Normalize
-> Ability Evidence
-> updatedEvidence
-> evidenceSummary
-> topWeakness
-> Student Ability Profile
```

Phase 4.3 已完成 Live AI Diagnosis Quality Evaluation，并使用 DeepSeek Provider 完成真实 AI 验收。

Phase 5.1 不继续评估 AI 诊断质量。

Phase 5.1 的目标是验证：

> 学生能力画像和优先薄弱能力，能否驱动下一次个性化训练任务，并在学生作答后重新回流诊断与画像系统。

## 阶段目标

建立 Personalized Next Task 最小连续学习闭环：

```text
Student Ability Profile
+ Top Weakness
+ Evidence Summary
+ updatedEvidence
-> Personalized Next Task
-> Student Answer
-> Phase 4.2 Real Diagnosis Runtime
-> newAbilityEvidence
-> updatedEvidence
-> Student Ability Profile 更新
```

本阶段要证明：

- 任务不是随机生成，而是来自 `topWeakness`。
- 任务能够解释为什么此刻应该训练该能力。
- 任务能够关联已有能力证据。
- 任务具备明确题目、作答要求和成功标准。
- 学生完成任务后，结果可以重新进入 Phase 4.2 诊断 Runtime。
- 新证据可以合并回 `updatedEvidence`。
- Student Ability Profile 可以基于合并后的证据再次更新。

## 产品定义

Personalized Next Task 是一次下一步训练任务。

它不是完整训练计划，也不是长期学习路径。

本阶段只生成一个最小可作答、可诊断、可回流画像的任务，用于验证连续学习 Runtime 是否成立。

一句话定义：

> 基于学生当前最优先薄弱能力，生成一次可作答、可诊断、可回流画像的个性化下一步任务。

## 输入

Phase 5.1 的输入来自 Phase 4.2 Runtime：

- `studentAbilityProfile`
- `topWeakness`
- `evidenceSummary`
- `updatedEvidence`

其中：

- `topWeakness[0]` 是本次任务的首要依据。
- `updatedEvidence` 提供任务生成所需的证据来源。
- `studentAbilityProfile` 提供当前学生能力状态。
- `evidenceSummary` 提供按能力聚合后的证据统计。

## 输出

新增 `PersonalizedNextTask` 结构。

字段至少包含：

- `task_id`
- `target_ability`
- `task_goal`
- `why_this_task`
- `question`
- `reference_answer`
- `scoring_points`
- `answer_requirements`
- `success_criteria`
- `linked_evidence`
- `expected_diagnosis_focus`

字段说明：

| 字段 | 含义 |
| --- | --- |
| `task_id` | 个性化任务 ID |
| `target_ability` | 本次任务主要训练能力，默认来自 `topWeakness[0].ability` |
| `task_goal` | 本次任务希望改善的具体能力表现 |
| `why_this_task` | 为什么此刻生成该任务 |
| `question` | 学生需要作答的训练题目 |
| `reference_answer` | 可供诊断使用的参考答案 |
| `scoring_points` | 可供诊断使用的评分要点 |
| `answer_requirements` | 面向学生答案的明确要求 |
| `success_criteria` | 本次任务完成成功的判断标准 |
| `linked_evidence` | 支撑本任务生成的能力证据链接 |
| `expected_diagnosis_focus` | 学生作答后，下一次诊断应重点观察什么 |

`linked_evidence` 不复制完整 evidence，只引用必要信息：

```ts
type LinkedEvidence = {
  evidence_id: string;
  ability: string;
  evidence_type: string;
  reason: string;
};
```

## 新增文件

Phase 5.1 需要新增：

```text
src/ai/schemas/personalizedNextTask.schema.ts
src/ai/agents/personalizedNextTaskAgent.ts
src/ai/tests/runPersonalizedNextTaskDebug.ts
```

## 新增命令

建议新增：

```bash
pnpm run debug:personalized-next-task
```

## Debug 最小闭环

Debug 脚本需要模拟以下完整流程：

```text
1. 准备一组已有 updatedEvidence
2. 生成 evidenceSummary
3. 生成 topWeakness
4. 生成 studentAbilityProfile
5. 基于 topWeakness[0] 生成 Personalized Next Task
6. 模拟学生完成任务，得到 studentAnswer
7. 将 task.question、task.reference_answer、studentAnswer 输入 Phase 4.2 Real Diagnosis Runtime
8. 得到 Diagnosis Result
9. 生成 newAbilityEvidence
10. 合并 previousEvidence + newAbilityEvidence，得到新的 updatedEvidence
11. 基于新的 updatedEvidence 再次生成 Student Ability Profile
12. 输出 Debug Report
```

Debug Report 至少展示：

- `target_ability`
- `why_this_task`
- `linked_evidence`
- `question`
- `answer_requirements`
- `success_criteria`
- `simulated_student_answer`
- `diagnosisResult.mainAbility`
- `diagnosisResult.rootCause`
- `newAbilityEvidence`
- `updatedEvidence` 数量变化
- 更新后的 `studentAbilityProfile.current_weakness`
- PASS / FAIL

## 验收标准

运行 Debug 后，系统必须证明以下条件成立：

1. 能从 `topWeakness[0]` 生成任务。
2. `target_ability === topWeakness[0].ability`。
3. `linked_evidence.length > 0`。
4. 任务包含 `question`、`reference_answer`、`scoring_points`、`answer_requirements`、`success_criteria`。
5. `why_this_task` 能解释该任务与当前薄弱能力和证据之间的关系。
6. 模拟学生答案可以进入 `runRealAIDiagnosisLoop`。
7. 诊断后能够产生新的 `newAbilityEvidence`。
8. 新证据能够按 `evidence.id` 合并回 `updatedEvidence`。
9. 合并后的 `updatedEvidence` 能重新生成 Student Ability Profile。
10. Debug 输出完整链路摘要。
11. 不修改 Diagnosis Result Schema。
12. 不依赖数据库。
13. 不依赖 UI。

满足以上条件，即可认为 Phase 5.1 的 Personalized Next Task 最小闭环跑通。

## 本阶段不做

Phase 5.1 不做：

- 数据库
- 正式 UI
- 复杂题库
- 多任务训练计划
- 三天 / 七天训练路径
- 复测机制
- 长期成长报告
- 多模型路由
- Phase 4.2 Runtime 重构
- Diagnosis Result Schema 修改

本阶段也不把真实 AI 作为必需条件。

Debug 默认应可在 dry-run / mock 模式下稳定运行。

真实 AI 可以作为可选验证入口，但不作为 Phase 5.1 的最小验收前置。

## 阶段边界

Phase 5.1 只回答一个问题：

> 当前学生最应该做的下一次任务是什么？为什么？

它不回答：

- 学生未来一周如何训练？
- 学生长期能力如何规划？
- 训练后能力是否真正提升？
- 何时复测？

这些属于后续 Phase。

## 与前后阶段关系

Phase 5.1 接收 Phase 4.2 / 4.3 已验证的 Runtime 输出：

```text
updatedEvidence
evidenceSummary
topWeakness
studentAbilityProfile
```

Phase 5.1 产出：

```text
Personalized Next Task
```

该任务完成后重新进入 Phase 4.2：

```text
Personalized Next Task
-> Student Answer
-> Real Diagnosis Runtime
-> Ability Evidence
-> Student Ability Profile
```

因此 Phase 5.1 是系统从“诊断 Runtime”走向“连续成长 Runtime”的第一步。

## 阶段完成定义

Phase 5.1 完成时，应能够通过一个命令证明：

```text
Student Ability Profile
-> Personalized Next Task
-> Student Answer
-> Diagnosis Result
-> newAbilityEvidence
-> updatedEvidence
-> Student Ability Profile 更新
```

这一条最小连续学习闭环已经跑通。

## Phase 5.1 验收冻结记录

验收时间：2026-07-09

Debug 命令：

```bash
pnpm run debug:personalized-next-task
```

Debug 验收结果：

```text
topWeakness[0]: 推理
target_ability: 推理
linked_evidence: phase51-prev-inference-001
diagnosisResult.mainAbility: 推理
newAbilityEvidence.ability: 推理
updatedEvidence: 3 -> 4
updatedProfile.current_weakness: 推理

[PASS] Phase 5.1 Personalized Next Task minimum loop is ready.
```

Demo 页面：

```text
/#/personalized-next-task-demo
```

Demo 验收结论：

- 页面可展示当前 `Student Ability Profile`、`Evidence Summary` 和 `Top Weakness`。
- 页面可生成并展示 Personalized Next Task。
- 页面可编辑学生答案。
- 页面可将学生答案回流 Phase 4.2 Diagnosis Runtime。
- 页面可展示新的 Diagnosis Result、newAbilityEvidence 和更新后的 Student Ability Profile。
- Dry Run 已支持答案变化带来诊断变化。
- 真实 AI 模式可通过 DeepSeek 作为可选验证入口。

答案变化验证：

```text
弱答案：父亲很喜欢整理东西。
结果：answerStatus=does_not_meet，生成 weakness evidence。

改进答案：父亲看到旧书和树叶时，想起以前和孩子一起读书的时光，所以他内心有不舍、怀念和牵挂。
结果：answerStatus=partially_meets，诊断反馈发生变化。
```

## 验收报告

本阶段详细验收结果独立记录在：

```text
docs/education/phase/phase5_1_acceptance_report.md
```

阶段文档仅保留验收摘要；完整 Debug 链路、Demo 验收记录和冻结边界以 report 为准。

最终结论：

```text
Phase 5.1 通过。
allowNextPhase = true。
```

冻结边界：

- 不接数据库。
- 不保存任务历史。
- 不做正式 UI。
- 不做复杂题库。
- 不做长期训练路径。
- 不做复测机制。
- 不做长期成长报告。
- 不修改 Diagnosis Result Schema。
- 不重构 Phase 4.2 Runtime 主链路。


