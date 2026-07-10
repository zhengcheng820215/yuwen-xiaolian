# Phase 6.2：Retest Execution Evidence 最小闭环

## 一句话定义

学生完成 Retest Task 后，系统将复测作答结果转化为 `source = retest` 的 Ability Evidence，并回流更新 Evidence Summary 与 Student Ability Profile。

## 阶段背景

Phase 6.1 已完成：

```text
LearningSessionMemory
-> RetestTask
```

Phase 6.1 只负责生成复测任务，不处理学生复测答案，也不判断能力是否提升。

进入 Phase 6.2 后，系统开始处理学生对复测任务的作答结果。

本阶段的重点不是证明学生已经掌握某项能力，而是证明：

> 复测作答可以被诊断，并生成高价值的 Retest Evidence，进入长期能力证据池。

## 阶段目标

建立 Retest Execution Evidence 最小闭环：

```text
RetestTask
+ Student Retest Answer
-> Diagnosis Runtime
-> Retest Evidence
-> updatedEvidence
-> Evidence Summary
-> updatedStudentAbilityProfile
```

本阶段要证明：

- RetestTask 可以进入 Diagnosis Runtime。
- 学生复测答案可以生成 Ability Evidence。
- 新生成的 Evidence 必须标记为 `source = retest`。
- Retest Evidence 的 `ability` 必须与 `RetestTask.target_ability` 保持一致。
- Retest Evidence 可以进入 `updatedEvidence`。
- Evidence Summary 可以消费 Retest Evidence。
- Student Ability Profile 可以基于 Retest Evidence 更新。

## 核心问题

Phase 6.2 回答的问题是：

> 学生完成复测后，系统能否生成可被长期 Runtime 消费的 Retest Evidence？

具体包括：

- 复测作答是否能进入 Diagnosis Runtime？
- Diagnosis Result 是否能转化为 Ability Evidence？
- Retest Evidence 是否保持目标能力一致？
- Retest Evidence 是否区别于 Training Evidence？
- Retest Evidence 是否可以影响 Evidence Summary？
- Student Ability Profile 是否能基于 Retest Evidence 更新？

## 最小闭环

Phase 6.2 的最小链路为：

```text
RetestTask
-> Student Retest Answer
-> Diagnosis Runtime
-> newRetestEvidence
-> merge updatedEvidence
-> build Evidence Summary
-> build Student Ability Profile
-> Debug Report
```

本阶段可以先使用 mock Diagnosis Runtime 或复用现有 Diagnosis Runtime 的 dry-run 能力。

## 输入

Phase 6.2 输入包括：

- `retestTask`
- `studentRetestAnswer`
- `previousEvidence`

其中 `retestTask` 来自 Phase 6.1。

`retestTask` 至少包含：

- `retest_task_id`
- `target_ability`
- `question`
- `reference_answer`
- `scoring_points`
- `success_criteria`
- `linked_session_id`
- `expected_evaluation_focus`

`studentRetestAnswer` 是学生对复测题的作答。

`previousEvidence` 是进入本次复测前已有的 Ability Evidence 集合。

## 输出

Phase 6.2 输出 `RetestExecutionResult`。

建议包含：

- `retest_task_id`
- `target_ability`
- `student_retest_answer`
- `diagnosis_result`
- `new_retest_evidence`
- `updated_evidence`
- `evidence_summary`
- `updated_student_ability_profile`
- `validation`

## 建议新增 Schema

```ts
export type RetestExecutionResult = {
  retest_task_id: string;

  target_ability: string;

  student_retest_answer: string;

  diagnosis_result: unknown;

  new_retest_evidence: AbilityEvidence;

  updated_evidence: AbilityEvidence[];

  evidence_summary: unknown;

  updated_student_ability_profile: unknown;

  validation: {
    passed: boolean;
    diagnosis_focus_match: boolean;
    review_required: boolean;
    issues: string[];
  };
};
```

其中 `new_retest_evidence` 必须满足：

```ts
new_retest_evidence.source === 'retest'
new_retest_evidence.ability === retestTask.target_ability
```

## Retest Evidence 规则

Retest Evidence 是复测场景下生成的 Ability Evidence。

它与 Training Evidence 的区别：

- Training Evidence 表示训练环境中的表现。
- Retest Evidence 表示新题、新文本或新情境中的迁移表现。
- Retest Evidence 对 Student Ability Profile 的影响权重高于 Training Evidence。
- Retest Evidence 可以支持 `improving` 或 `stable_positive` 的判断，但不能单独证明长期掌握。

Retest Evidence 至少需要包含：

- `id`
- `ability`
- `evidenceType`
- `reason`
- `detail`
- `confidence`
- `source = retest`
- `taskId`

其中：

- `source` 必须由 Runtime 强制设置为 `retest`，不能依赖 AI 输出。
- `taskId` 必须等于 `RetestTask.retest_task_id`。
- `ability` 默认必须等于 `RetestTask.target_ability`。
- `confidence` 必须被裁剪到 0 到 1 之间。

## Evidence Type 使用规则

Phase 6.2 允许生成以下 evidenceType：

- `positive`：本次复测表现达到要求；
- `growth`：相较原 weakness 出现改善迹象，但尚不足以证明稳定掌握；
- `weakness`：本次复测仍暴露目标能力问题；
- `insufficient`：本次复测答案无法形成有效判断。

注意：

- `positive` 不等于长期稳定掌握。
- `growth` 用于支持 `ability_status = improving`。
- `weakness` 用于支持继续训练或降低难度。
- `insufficient` 不应作为能力强弱判断的主要依据。

## 目标能力一致性规则

Phase 6.2 必须验证：

```text
newRetestEvidence.ability === retestTask.target_ability
```

如果 Diagnosis Result 的 `mainAbility` 与 `RetestTask.target_ability` 不一致：

1. 若属于相邻能力，可以记录为 secondary observation，但不能直接证明目标能力改善。
2. 若明显偏离目标能力，应标记为 `diagnosis_focus_mismatch`。
3. mismatch 情况下不应直接更新目标能力状态，应进入 REVIEW。

## REVIEW 与 FAIL 区分

Phase 6.2 需要区分 Runtime 阻断失败与需要复核的诊断不确定性。

### Runtime FAIL

以下情况属于 `validation.passed = false`：

- RetestTask 缺少关键字段；
- studentRetestAnswer 缺失；
- Diagnosis Result 无法形成可消费结构；
- newRetestEvidence 无法生成；
- newRetestEvidence 缺少 `source / ability / evidenceType / confidence` 等关键字段；
- updatedEvidence 无法生成；
- Evidence Summary 或 Student Ability Profile 无法消费 updatedEvidence。

### REVIEW

以下情况属于 `review_required = true`：

- Diagnosis Result 的 `mainAbility` 与 `RetestTask.target_ability` 不一致；
- Diagnosis Result 的判断方向可解释，但不能直接证明目标能力变化；
- studentRetestAnswer 与题目存在弱相关，仍能形成证据但需要人工复核。

注意：

`review_required = true` 不一定代表 Runtime 失败。

如果结构完整、证据可消费，则可以保持 `validation.passed = true`，但必须标记 REVIEW，供后续人工或更高阶评估处理。

## Evidence 合并规则

`updatedEvidence` 必须由以下数据合并生成：

```text
previousEvidence + newRetestEvidence
```

合并时必须按 `evidence.id` 去重。

如果 `newRetestEvidence` 不满足 schema、source、ability 或 confidence 要求，不得污染 `updatedEvidence`。

## Evidence Summary 规则

Evidence Summary 必须基于 `updatedEvidence` 生成，而不是只基于 `newRetestEvidence`。

Evidence Summary 至少需要支持：

- 按 ability 聚合；
- 统计 weakness / positive / growth / insufficient；
- 区分 retest evidence 与 training evidence；
- 为 Student Ability Profile 提供状态判断依据。

## Student Ability Profile 更新规则

Student Ability Profile 必须基于 `updatedEvidence` 生成。

Phase 6.2 允许 Retest Evidence 影响：

- `ability_status`
- `current_weakness`
- `improvementSignals`
- `continueTrainingFocus`
- `nextStepRecommendation`

但 Phase 6.2 不直接输出长期学习结论。

例如：

- 一条 `growth` retest evidence 可以支持 `improving`；
- 多条稳定的 `positive` retest evidence 才能支持更高稳定状态；
- 单条 `positive` retest evidence 不能直接证明长期掌握。

## 建议新增文件

```text
src/ai/schemas/retestExecution.schema.ts
src/ai/agents/retestExecutionAgent.ts
src/ai/tests/runRetestExecutionDebug.ts
```

新增命令：

```bash
pnpm run debug:retest-execution
```

## Debug 最小流程

Debug 脚本模拟以下流程：

1. 构造一条 Phase 6.1 生成的 `RetestTask`。
2. 构造一条 `studentRetestAnswer`。
3. 构造若干条 `previousEvidence`。
4. 调用 Diagnosis Runtime 或 mock Diagnosis Runtime。
5. 将 Diagnosis Result 转换为 `newRetestEvidence`。
6. 校验 `newRetestEvidence.source === 'retest'`。
7. 校验 `newRetestEvidence.ability === retestTask.target_ability`。
8. 合并 `previousEvidence + newRetestEvidence`，生成 `updatedEvidence`。
9. 基于 `updatedEvidence` 生成 Evidence Summary。
10. 基于 `updatedEvidence` 生成 updatedStudentAbilityProfile。
11. 输出 Debug Report。

## Debug Report

Debug Report 至少展示：

```text
Retest Execution Debug Report

Input:
- retest_task_id
- target_ability
- student_retest_answer
- previousEvidence count

Diagnosis:
- mainAbility
- answerStatus
- rootCause
- confidence

Retest Evidence:
- id
- ability
- source
- evidenceType
- reason
- confidence

Evidence Update:
- previousEvidence count
- newRetestEvidence count
- updatedEvidence count
- dedupe result

Profile Update:
- current_weakness
- ability_status
- improvementSignals
- nextStepRecommendation

PASS / FAIL
```

## 验收标准

Phase 6.2 通过条件：

1. 能读取 `RetestTask`。
2. 能接收 `studentRetestAnswer`。
3. 能调用 Diagnosis Runtime 或 mock Diagnosis Runtime。
4. 能生成 `newRetestEvidence`。
5. `newRetestEvidence.source === 'retest'`。
6. `newRetestEvidence.ability === RetestTask.target_ability`。
7. `newRetestEvidence.taskId === RetestTask.retest_task_id`。
8. `newRetestEvidence.confidence` 为 0 到 1 之间的数字。
9. `newRetestEvidence.evidenceType` 属于 `positive / growth / weakness / insufficient`。
10. `updatedEvidence = previousEvidence + newRetestEvidence`。
11. `updatedEvidence` 按 `evidence.id` 去重。
12. Evidence Summary 基于 `updatedEvidence` 生成。
13. Student Ability Profile 基于 `updatedEvidence` 更新。
14. `validation.diagnosis_focus_match` 能正确表达诊断能力是否对齐目标能力。
15. `validation.review_required` 能正确表达是否需要人工复核。
16. Debug Report 输出 PASS。
17. `pnpm run build` 通过。

## 本阶段不做

Phase 6.2 不做：

- 不生成新的 RetestTask。
- 不修改 RetestTask Generation。
- 不生成正式评估报告。
- 不判断长期能力掌握。
- 不宣布学生能力已经稳定提升。
- 不接数据库。
- 不做正式 UI。
- 不做多题复测。
- 不做长期成长曲线。
- 不修改 Diagnosis Result Schema。
- 不重构 Diagnosis Runtime。

## 阶段边界

Phase 6.2 只回答：

> 学生完成复测后，系统能否生成 Retest Evidence，并让它进入 Evidence Summary 和 Student Ability Profile？

它不回答：

- 学生能力是否已经长期稳定提升？
- 复测题质量是否已经充分可靠？
- 多次复测后应该如何形成正式评估报告？
- 家长或学生应该如何阅读长期成长趋势？

这些属于后续 Phase。

## 与 Phase 6.3 的关系

Phase 6.2 生成：

```text
Retest Evidence
```

Phase 6.3 才进一步处理：

```text
Retest Evidence
-> Ability Change Validation
-> Retest Evaluation Summary
-> Next Learning Decision
```

因此 Phase 6.2 不应提前做长期能力升级判断。

## 阶段完成定义

Phase 6.2 完成时，应能通过一个命令证明：

```text
RetestTask
+ Student Retest Answer
-> Retest Evidence
-> updatedEvidence
-> Evidence Summary
-> Student Ability Profile
```

这一条复测证据回流闭环已经跑通。
