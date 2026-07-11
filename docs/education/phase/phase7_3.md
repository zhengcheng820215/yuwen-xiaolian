# Phase 7.3：复测与 Session 结果流程最小闭环（Retest & Session Result Flow）

## 一句话定义

基于 Phase 7.2 的个性化训练结果，生成复测任务，让学生完成复测，并输出 Ability Change Evaluation 和本次 Beta Learning Session Result，形成一次 Beta Learning Flow 的完整闭环。

更简单地说：

```text
7.1：发现问题
7.2：针对训练
7.3：复测验证 + 本轮结果
```

## 阶段背景

Phase 7.1 已完成：

```text
Start Learning
-> Student Answer
-> Diagnosis Runtime
-> Ability Evidence
-> Student Ability Profile
-> Initial Session State
```

Phase 7.2 已完成：

```text
LearningEntryResult
-> PersonalizedNextTask
-> StudentTaskAnswer
-> Diagnosis Runtime
-> New AbilityEvidence
-> Updated StudentAbilityProfile
-> PersonalizedTrainingFlowResult
```

Phase 7.3 负责把一次 Beta 学习流程收束为可解释的本轮结果。

它不是长期成长报告。

它不是数据库记录。

它不证明学生已经长期掌握某项能力。

它只回答：

> 学生完成个性化训练后，系统能不能安排一次复测，判断训练结果是否迁移，并生成学生能看懂的本轮学习结果？

## 阶段定位

Phase 7.3 是将 Phase 6.1 `RetestTask`、Phase 6.2 `RetestExecution` 和 Phase 6.3 `AbilityChangeEvaluation` 接入 Beta Learning Flow。

本阶段不重新定义 RetestTask 模型。

本阶段不重新实现 RetestExecution。

本阶段不重新实现 AbilityChangeEvaluation。

它的重点是：

- 消费 Phase 7.2 的 `PersonalizedTrainingFlowResult`；
- 判断训练流程是否已经 `ready_for_retest`；
- 基于训练结果生成复测任务；
- 让学生完成复测；
- 将复测表现转换为 `source = retest` 的 Ability Evidence；
- 基于训练前、训练中、复测后的 Evidence 判断能力变化；
- 输出本轮 Beta Learning Session Result；
- 用学生可读语言解释本轮结果和下一步。

## 阶段目标

建立 Retest & Session Result Flow 最小闭环：

```text
PersonalizedTrainingFlowResult
+ updatedEvidence
+ updatedStudentAbilityProfile
+ targetAbility
-> Generate RetestTask
-> Student Completes Retest
-> Diagnosis Runtime
-> Retest Evidence
-> Ability Change Evaluation
-> BetaLearningSessionResult
-> Student-facing Session Feedback
```

本阶段要证明：

- 系统可以消费 Phase 7.2 的 `PersonalizedTrainingFlowResult`。
- 系统可以识别 `flow_status = ready_for_retest`。
- 系统可以基于训练结果生成复测任务。
- 复测任务不是继续训练题，而是用于迁移验证。
- 学生可以在页面完成复测。
- 复测答案可以进入 RetestExecution。
- RetestExecution 可以生成 `source = retest` 的 Ability Evidence。
- Retest Evidence 可以进入 Ability Change Evaluation。
- 系统可以输出本轮能力变化判断。
- 系统可以输出 BetaLearningSessionResult。
- 页面可以用学生可读语言说明本轮学习结果和下一步。

## 前置条件

Phase 7.3 的前置条件是：

```text
PersonalizedTrainingFlowResult.flow_status === 'ready_for_retest'
```

如果不满足该条件：

- 不生成 RetestTask；
- 不执行 RetestExecution；
- 不生成 AbilityChangeEvaluation；
- 返回 `validation_failed` 或 `not_ready_for_retest`；
- 页面提示学生先完成当前训练任务或等待训练结果完成。

该规则用于避免训练尚未完成时提前进入复测。

## 核心问题

Phase 7.3 只回答一个问题：

> 学生完成个性化训练后，系统能不能用一题新文本 / 新情境 / 新表达完成复测，并给出本轮是否出现能力改善迹象的判断？

它不回答长期能力是否稳定。

它不生成长期成长趋势。

它不替代正式学生成长档案。

## 最小闭环

Phase 7.3 的最小链路为：

```text
PersonalizedTrainingFlowResult
-> RetestTask
-> StudentRetestAnswer
-> RetestEvidence
-> AbilityChangeEvaluation
-> BetaLearningSessionResult
```

换成人话：

```text
学生完成训练
-> 系统换一题复测
-> 学生完成复测
-> 系统判断复测表现
-> 系统判断能力是否出现变化迹象
-> 输出本轮学习结果
```

## 输入

Phase 7.3 初始输入包括：

- `personalizedTrainingFlowResult`
- `sessionId`
- `studentId`
- `targetAbility`
- `updatedEvidence`
- `updatedStudentAbilityProfile`
- `taskExecutionSummary`

复测提交时，还需要：

- `retestTask`
- `studentRetestAnswer`

说明：

- `personalizedTrainingFlowResult` 必须来自 Phase 7.2。
- `targetAbility` 必须来自 Phase 7.2 的 `target_ability`。
- `updatedEvidence` 是训练后的证据池。
- `studentRetestAnswer` 由学生在页面输入。

## Evidence 分层规则

AbilityChangeEvaluation 需要区分不同阶段的证据来源。

Phase 7.3 中的 Evidence 分层如下：

| 分层 | 来源 | 含义 |
| --- | --- | --- |
| `beforeEvidence` | Phase 7.1 入口诊断 evidence | 训练前的初始薄弱表现 |
| `trainingEvidence` / `taskExecutionEvidence` | Phase 7.2 个性化训练 evidence | 训练过程中的表现 |
| `retestEvidence` | Phase 7.3 复测 evidence | 新题 / 新文本 / 新情境下的迁移验证表现 |

Retest Evidence 的权重高于训练 Evidence。

训练中表现改善不等于迁移成功。

只有复测 Evidence 才能支持是否迁移的判断。

## 输出

Phase 7.3 输出 `BetaLearningSessionResult`。

它不是长期成长档案，只是本次 Beta Learning Session 的结果汇总。

建议结构：

```ts
export type BetaLearningSessionResult = {
  session_id: string;

  student_id: string;

  target_ability: string;

  personalized_training_result_id?: string;

  retest_task: RetestTask;

  student_retest_answer: string;

  retest_execution_result: RetestExecutionResult;

  ability_change_evaluation: AbilityChangeEvaluation;

  session_summary: {
    initial_problem: string;
    training_focus: string;
    retest_result: string;
    ability_change_summary: string;
    next_learning_decision: string;
  };

  student_readable_feedback: {
    title: string;
    summary: string;
    what_improved?: string;
    what_still_needs_work?: string;
    next_step: string;
  };

  session_status:
    | 'completed'
    | 'needs_more_training'
    | 'needs_more_evidence'
    | 'ready_for_next_ability'
    | 'validation_failed'
    | 'not_ready_for_retest';

  persistence_status:
    | 'not_persisted'
    | 'mock_saved'
    | 'ready_for_persistence';

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

为了支持训练流程未 ready 的情况，以下字段可以设计为可选：

- `retest_task`
- `student_retest_answer`
- `retest_execution_result`
- `ability_change_evaluation`

当 `PersonalizedTrainingFlowResult.flow_status !== 'ready_for_retest'` 时：

- `session_status = not_ready_for_retest`
- `validation.passed = false`
- `validation.issues` 必须包含 `not_ready_for_retest`
- 不生成 RetestTask
- 不执行 RetestExecution
- 不生成 AbilityChangeEvaluation

当前阶段默认：

```text
persistence_status = not_persisted
```

该字段用于明确本阶段不接数据库，不表示 Session Result 已经正式保存。

## 字段说明

| 字段 | 含义 |
| --- | --- |
| `session_id` | 本次学习 Session ID |
| `student_id` | 学生 ID |
| `target_ability` | 本轮训练和复测的目标能力 |
| `personalized_training_result_id` | 关联的 7.2 训练结果 ID，可选 |
| `retest_task` | 复测任务 |
| `student_retest_answer` | 学生复测答案 |
| `retest_execution_result` | 复测执行结果，来自 Phase 6.2 |
| `ability_change_evaluation` | 能力变化判断，来自 Phase 6.3 |
| `session_summary` | 本轮 Session 结构化摘要 |
| `student_readable_feedback` | 面向学生的本轮反馈 |
| `session_status` | 本轮 Session 状态 |
| `persistence_status` | 持久化状态，本阶段默认不持久化 |
| `validation` | Runtime 结构校验结果 |

## RetestTask 生成规则

Phase 7.3 生成 RetestTask 时必须遵循：

1. `target_ability` 必须与 Phase 7.2 的 `target_ability` 一致。
2. RetestTask 必须复用 Phase 6.1 的 RetestTask 模型。
3. RetestTask 不是继续训练题，而是迁移验证题。
4. RetestTask 必须使用新文本、新情境或新表达方式。
5. RetestTask 不应简单重复 Phase 7.2 的训练题。
6. 最小校验必须满足：

```text
retest_task.question !== personalized_training_result.personalized_task.question
```

7. RetestTask 必须包含 `reference_answer`。
8. RetestTask 必须包含 `scoring_points`。
9. RetestTask 必须包含 `success_criteria`。
10. RetestTask 必须包含 `linked_session_id` 或可追溯的训练结果引用。

## RetestExecution 规则

学生提交 `studentRetestAnswer` 后：

1. 复测答案进入 RetestExecution。
2. RetestExecution 复用 Phase 6.2。
3. 系统生成 Retest Evidence。
4. Retest Evidence 的 `source` 必须强制为 `retest`。
5. Retest Evidence 的 `ability` 应与 `targetAbility` 一致。
6. 如果 Retest Evidence 的 `ability` 或 DiagnosisResult.mainAbility 与 `targetAbility` 不一致，必须进入 REVIEW 或记录 validation issue，且不能直接用于目标能力变化判断。
7. Retest Evidence 用于 AbilityChangeEvaluation。
8. Retest Evidence 不等同于长期稳定掌握，只代表本次迁移验证表现。

## AbilityChangeEvaluation 规则

Phase 7.3 的能力变化判断复用 Phase 6.3。

输入包括：

- `beforeEvidence`
- `trainingEvidence`
- `taskExecutionEvidence`
- `retestEvidence`
- `targetAbility`

输出包括：

- `likely_improved`
- `not_transferred`
- `still_weak`
- `needs_more_evidence`
- `ready_to_switch_ability`

注意：

- `positive` 不等于长期掌握；
- `growth` 只代表改善迹象；
- `retest weakness` 优先级高于 `training positive`；
- 证据不足不应强行判断能力变化。

## Session Status 规则

Phase 7.3 需要将 `AbilityChangeEvaluation.change_status` 转换为更适合学生流程的 `session_status`。

建议规则：

| change_status | session_status |
| --- | --- |
| `likely_improved` | `completed` 或 `needs_more_evidence` |
| `not_transferred` | `needs_more_training` |
| `still_weak` | `needs_more_training` |
| `needs_more_evidence` | `needs_more_evidence` |
| `ready_to_switch_ability` | `ready_for_next_ability` |

注意：

`completed` 只表示本轮 Beta Session 已完成，不表示学生已经长期稳定掌握该能力。

## Student-facing Session Feedback 规则

Phase 7.3 的学生可读反馈需要回答 4 个问题：

1. 这一轮练了什么？
2. 复测表现怎么样？
3. 能力有没有出现变化迹象？
4. 下一步该怎么做？

### likely_improved

```text
本轮学习结果：推理能力出现改善迹象

你一开始能说出结论，但缺少文本依据。
训练后，你在复测中能更好地结合文本信息说明理由。

这说明你在“根据文本依据进行推理”上有改善迹象。
不过这还不等于长期稳定掌握，建议后续再用不同文本继续验证。
```

### not_transferred

```text
本轮学习结果：训练中有改善，但复测没有迁移成功

你在训练任务中能更好地使用文本依据，
但换到新的复测题后，答案又出现依据不足的问题。

下一步建议继续练习“先找依据，再写结论”，并降低一点题目难度。
```

### still_weak

```text
本轮学习结果：当前能力仍然不稳定

从第一题、训练任务到复测，你在“文本依据支持结论”上仍然不够稳定。

下一步建议继续围绕同一能力训练，先从更短文本和更明确的问题开始。
```

### needs_more_evidence

```text
本轮学习结果：目前证据还不足

这次复测答案信息不足，系统还不能判断训练是否有效。

下一步建议再完成一题同能力复测，收集更多有效证据。
```

### ready_to_switch_ability

```text
本轮学习结果：当前能力可以暂时降低训练优先级

本轮证据显示，你在这个能力点上已经出现较稳定的改善迹象。

下一步可以转向当前更突出的薄弱能力。
```

学生主体验区不应直接展示：

- `source = retest`
- `evidenceType`
- `confidence`
- `change_status`
- `raw JSON`
- `AbilityChangeEvaluation` 原始字段名
- `RetestExecutionResult` 原始字段名

开发者调试信息可以折叠展示。

## 页面最小体验

建议新增页面：

```text
src/pages/BetaSessionResultDemo.jsx
```

建议路由：

```text
/#/beta-session-result-demo
```

页面入口：

```text
从 Phase 7.2 页面结果点击“进入复测”
```

页面最小结构：

### 上一步训练摘要

- 本次训练能力；
- 训练任务表现；
- 当前是否可以复测。

### 复测任务区

- 复测目标；
- 为什么现在复测；
- 复测题目；
- 作答要求；
- 答案输入框；
- 提交按钮。

### 复测反馈区

- 复测表现；
- 是否迁移成功；
- 当前能力变化判断；
- 下一步建议。

### 本轮 Session 结果区

- 本轮训练能力；
- 初始问题；
- 训练过程；
- 复测结果；
- 本轮结论；
- 下一步学习建议。

### 开发者折叠区

- `RetestTask`
- `RetestExecutionResult`
- `RetestEvidence`
- `AbilityChangeEvaluation`
- `BetaLearningSessionResult`

## 建议新增文件

```text
src/ai/schemas/betaLearningSessionResult.schema.ts
src/ai/agents/betaLearningSessionResultAgent.ts
src/ai/tests/runBetaLearningSessionResultDebug.ts
src/pages/BetaSessionResultDemo.jsx
```

新增脚本：

```text
debug:beta-learning-session-result
```

## 建议落地顺序

Phase 7.3 建议按以下顺序落地：

1. 新增 `betaLearningSessionResult.schema.ts`。
2. 新增 `betaLearningSessionResultAgent.ts`。
3. 复用 Phase 6.1 `RetestTaskAgent`。
4. 复用 Phase 6.2 `RetestExecutionAgent`。
5. 复用 Phase 6.3 `AbilityChangeEvaluationAgent`。
6. 新增 `runBetaLearningSessionResultDebug.ts`。
7. 新增 `debug:beta-learning-session-result` 脚本。
8. 新增 `BetaSessionResultDemo.jsx`。
9. 增加 `/#/beta-session-result-demo` 路由。
10. 从 7.2 页面结果增加“进入复测”入口。
11. 跑通 Debug。
12. 跑通 build。

## Debug 最小流程

Debug 脚本应执行：

1. 准备 mock `PersonalizedTrainingFlowResult`。
2. 读取 `sessionId / studentId / targetAbility`。
3. 确认 `flow_status = ready_for_retest`。
4. 调用 RetestTaskAgent。
5. 生成 RetestTask。
6. 准备 mock `studentRetestAnswer`。
7. 调用 RetestExecutionAgent。
8. 生成 Retest Evidence。
9. 调用 AbilityChangeEvaluationAgent。
10. 生成 AbilityChangeEvaluation。
11. 生成 BetaLearningSessionResult。
12. 输出学生可读反馈。
13. 输出 PASS / FAIL。

## Debug Report 要求

Debug Report 至少展示：

```text
Beta Learning Session Result Debug Report

Input:
- studentId
- sessionId
- targetAbility
- trainingFlowStatus
- evidenceCountBeforeRetest

Retest Task:
- retestTaskId
- targetAbility
- retestGoal
- whyRetestNow
- successCriteria

Student Retest Answer:
- answer text

Retest Execution:
- diagnosisMainAbility
- answerStatus
- rootCause
- retestEvidenceId
- retestEvidenceType
- retestEvidenceSource

Ability Change Evaluation:
- changeStatus
- changeReason
- evidenceBasis
- confidence
- nextDecision

Session Result:
- sessionStatus
- persistenceStatus
- initialProblem
- trainingFocus
- retestResult
- abilityChangeSummary
- nextLearningDecision

Student Feedback:
- title
- summary
- nextStep

PASS / FAIL
```

## 验收标准

Phase 7.3 通过条件：

1. 能消费 Phase 7.2 的 `PersonalizedTrainingFlowResult`。
2. 能读取 `sessionId / studentId / targetAbility`。
3. 能确认训练流程已 `ready_for_retest`。
4. 如果训练流程未 ready，不生成 RetestTask，并返回 validation issue。
5. 能生成 RetestTask。
6. `RetestTask.target_ability` 与 `targetAbility` 一致。
7. RetestTask 不是重复训练题。
8. RetestTask 有新文本 / 新情境 / 新表达。
9. 页面能展示复测任务。
10. 学生能提交 `studentRetestAnswer`。
11. 系统能调用 RetestExecutionAgent 或 mock RetestExecution。
12. 系统能生成 Retest Evidence。
13. Retest Evidence.source = `retest`。
14. Retest Evidence.ability 非空。
15. 系统能生成 AbilityChangeEvaluation。
16. AbilityChangeEvaluation.change_status 非空。
17. AbilityChangeEvaluation.next_decision 非空。
18. 系统能生成 BetaLearningSessionResult。
19. `persistence_status = not_persisted`。
20. 系统能生成学生可读 Session Feedback。
21. 页面能从 7.2 结果进入 7.3。
22. 页面不依赖 JSON 才能理解本轮结果。
23. Debug 输出 PASS。
24. `pnpm run build` 通过。

## 本轮实现收敛原则

Phase 7.3 文档描述的是完整设计边界，但本轮工程实现只完成最小主流程。

本轮只要求：

1. 消费 Phase 7.2 `PersonalizedTrainingFlowResult`。
2. 生成 `RetestTask`。
3. 提交 `studentRetestAnswer`。
4. 生成 `source = retest` 的 Retest Evidence。
5. 生成 `AbilityChangeEvaluation`。
6. 生成 `BetaLearningSessionResult`。
7. 生成学生可读反馈。
8. Debug 输出 PASS。
9. `pnpm run build` 通过。

本轮暂不做：

- 复杂 `not_ready_for_retest` 分支；
- 复杂 persistence 状态流转；
- 复杂 RetestTask 相似度校验；
- 长期成长报告；
- 数据库持久化；
- 大范围重构。

如果后续实现中发现需要新增较多字段，或改动超过 3-5 个核心文件，应先停止并输出方案，不应直接扩展。

当前实现允许新增 Phase 7.3 必需的 schema、agent、debug、demo page、route 和 package script。这些属于本阶段预期范围，不视为失控扩展。

## 本阶段不做

Phase 7.3 不做：

- 不重新实现 Diagnosis Runtime；
- 不重新定义 RetestTask 模型；
- 不重新定义 RetestExecution 模型；
- 不重新定义 AbilityChangeEvaluation 模型；
- 不做长期成长报告；
- 不做多 Session 趋势分析；
- 不做数据库持久化；
- 不做账号系统；
- 不做家长端；
- 不做正式视觉打磨；
- 不做多学生管理；
- 不做课程路径系统；
- 不证明学生已经长期掌握某项能力。

Phase 7.3 只做：

```text
训练后
-> 复测
-> 能力变化判断
-> 本轮 Session Result
```

## 与 Phase 7.1 / 7.2 的关系

Phase 7.1：

```text
开始学习，完成第一题诊断，生成初始能力状态。
```

Phase 7.2：

```text
基于初始能力状态，生成个性化任务，完成任务执行与证据回流。
```

Phase 7.3：

```text
基于训练结果，生成复测任务，完成复测，输出 Ability Change Evaluation 和 Session Result。
```

也就是：

```text
7.1：发现问题
7.2：针对训练
7.3：复测验证 + 本轮结果
```

## Definition of Done

Phase 7.3 完成时，应能证明：

```text
PersonalizedTrainingFlowResult
-> RetestTask
-> StudentRetestAnswer
-> RetestEvidence
-> AbilityChangeEvaluation
-> BetaLearningSessionResult
```

这一条 Beta Learning Flow 的复测与结果闭环已经跑通。

## 最终目标

Phase 7.3 的最终目标不是证明学生长期能力提升，而是让一次 Beta Learning Flow 能够完整闭环：

```text
发现问题
-> 针对训练
-> 复测验证
-> 输出本轮结果
```

Phase 7.3 完成后，Phase 7 就具备小范围 Beta 试用的完整流程基础。
