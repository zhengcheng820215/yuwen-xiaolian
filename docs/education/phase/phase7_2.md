# Phase 7.2：个性化训练流程最小闭环（Personalized Training Flow）

## 一句话定义

基于 Phase 7.1 生成的初始诊断、能力画像和目标能力，生成一项个性化训练任务，让学生完成任务，并将任务结果回流为新的 Ability Evidence 和更新后的能力画像。

## 阶段背景

Phase 7.1 已经完成 Beta Learning Flow 的入口闭环：

```text
Start Learning
-> Student Answer
-> Diagnosis Runtime
-> Ability Evidence
-> Student Ability Profile
-> Initial Session State
```

Phase 7.1 解决的是：

> 学生能不能从一个真实入口开始学习，并完成第一道题诊断？

Phase 7.2 接着解决：

> 学生完成第一题诊断后，系统能不能立刻安排一项针对性训练任务，并让学生完成这项任务？

Phase 7.2 不是复测阶段，也不是完整 Session 总结阶段。

它只负责把学生从“知道问题”推进到“开始针对性训练”。

## 阶段定位

Phase 7.2 是将 Phase 5.1 `PersonalizedNextTask` 与 Phase 5.2 `PersonalizedTaskExecution` 接入 Beta Learning Flow。

本阶段不重新定义一套训练任务模型，也不重新实现一套任务执行模型。

它的重点是：

- 消费 Phase 7.1 的 `LearningEntryResult`；
- 基于 7.1 产生的 `StudentAbilityProfile / updatedEvidence / initialTargetAbility` 生成个性化训练任务；
- 让学生在页面完成这项训练任务；
- 将任务表现回流为新的能力证据和更新后的学生能力画像；
- 用学生可读语言解释训练目标、训练表现和下一步。

## 阶段目标

建立 Personalized Training Flow 最小闭环：

```text
LearningEntryResult
+ StudentAbilityProfile
+ updatedEvidence
+ initialTargetAbility
-> Generate PersonalizedNextTask
-> Show Personalized Task to Student
-> Student Completes Task
-> Diagnosis Runtime
-> New Ability Evidence
-> Updated Evidence
-> Updated Student Ability Profile
-> PersonalizedTrainingFlowResult
-> Student-facing Training Feedback
```

本阶段要证明：

- 系统可以消费 Phase 7.1 的 `LearningEntryResult`。
- 系统可以基于 `StudentAbilityProfile / updatedEvidence / initialTargetAbility` 生成 `PersonalizedNextTask`。
- 个性化任务能解释“为什么现在做这道任务”。
- 个性化任务必须关联来自 7.1 证据池的 `linked_evidence`。
- 学生可以在页面完成训练任务。
- 任务答案可以进入 Diagnosis Runtime 或 mock Diagnosis Runtime。
- 系统可以生成新的 Ability Evidence。
- 新 Evidence 可以合并回 `updatedEvidence`。
- 系统可以重新生成 `StudentAbilityProfile`。
- 系统可以生成任务执行摘要。
- 页面可以用学生可读语言说明训练目标、本次表现和下一步。

## 核心问题

Phase 7.2 只回答一个问题：

> 第一题诊断完成后，学生能不能进入一项基于当前能力短板的个性化训练，并将训练结果回流为新的能力证据？

它不回答复测是否通过。

它不判断能力是否真实提升。

它不生成长期学习报告。

## 最小闭环

Phase 7.2 的最小链路为：

```text
LearningEntryResult
-> PersonalizedNextTask
-> StudentTaskAnswer
-> Diagnosis Runtime
-> New AbilityEvidence
-> Updated StudentAbilityProfile
-> PersonalizedTrainingFlowResult
```

可以理解为：

```text
7.1：发现问题
7.2：针对训练
7.3：复测验证
```

## 输入

Phase 7.2 初始输入包括：

- `studentId`
- `sessionId`
- `learningEntryResult`
- `studentAbilityProfile`
- `updatedEvidence`
- `initialTargetAbility`

个性化任务提交时，还需要：

- `personalizedTask`
- `studentTaskAnswer`

说明：

- `learningEntryResult` 必须来自 Phase 7.1。
- `initialTargetAbility` 通常来自 `new_ability_evidence.ability`、`currentWeakness` 或 `topWeakness`。
- `updatedEvidence` 是当前证据池。
- `studentTaskAnswer` 由学生在页面输入。
- 7.2 的主入口应从 7.1 页面结果进入，而不是重新造一个孤立 Demo 起点。

## 输出

Phase 7.2 输出 `PersonalizedTrainingFlowResult`。

它的作用是汇总一次个性化训练任务的生成、执行、诊断和回流结果。

建议结构：

```ts
export type PersonalizedTrainingFlowResult = {
  session_id: string;

  student_id: string;

  target_ability: string;

  personalized_task: PersonalizedNextTask;

  student_task_answer: string;

  task_diagnosis_result: DiagnosisResult;

  new_ability_evidence: AbilityEvidence;

  updated_evidence: AbilityEvidence[];

  updated_student_ability_profile: StudentAbilityProfile;

  task_execution_summary: PersonalizedTaskExecutionSummary;

  flow_status:
    | 'task_generated'
    | 'task_completed'
    | 'diagnosis_completed'
    | 'ready_for_retest'
    | 'validation_failed';

  student_readable_feedback: {
    task_goal: string;
    why_this_task: string;
    performance_summary: string;
    what_to_improve_next: string;
  };

  next_step_hint: string;

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

## 字段说明

| 字段 | 含义 |
| --- | --- |
| `session_id` | 本次学习 Session ID |
| `student_id` | 学生 ID |
| `target_ability` | 本次个性化训练目标能力 |
| `personalized_task` | 基于 7.1 诊断结果生成的个性化任务 |
| `student_task_answer` | 学生对个性化任务的作答 |
| `task_diagnosis_result` | 对任务答案的诊断结果 |
| `new_ability_evidence` | 本次任务执行产生的新能力证据 |
| `updated_evidence` | 合并任务新证据后的证据池 |
| `updated_student_ability_profile` | 基于 updatedEvidence 重新生成的能力画像 |
| `task_execution_summary` | 本次任务执行摘要，复用 Phase 5.2 结构 |
| `flow_status` | 当前训练流程状态 |
| `student_readable_feedback` | 面向学生的训练反馈 |
| `next_step_hint` | 下一步动作提示 |
| `validation` | Runtime 结构校验结果 |

## 任务生成规则

Phase 7.2 生成 `PersonalizedNextTask` 时必须遵循：

1. `target_ability` 默认来自 Phase 7.1 的 `initialTargetAbility`。
2. 任务必须基于 `StudentAbilityProfile` 或 `updatedEvidence`。
3. `personalized_task.target_ability` 必须与 `target_ability` 一致。
4. `personalized_task.why_this_task` 必须说明为什么现在做这项训练。
5. `personalized_task.linked_evidence` 必须包含至少一条来自 7.1 `updatedEvidence` 的 evidence id。
6. 任务目标必须落到具体能力动作，而不是只重复能力名称。
7. 作答要求必须明确。
8. 成功标准必须可观察、可诊断。
9. 任务不得偏离 `target_ability`。
10. 本阶段优先复用 Phase 5.1 的 `PersonalizedNextTaskAgent`。

## 任务执行规则

学生提交 `studentTaskAnswer` 后：

1. 答案进入 Diagnosis Runtime 或 mock Diagnosis Runtime。
2. 生成 `task_diagnosis_result`。
3. 从诊断结果生成 `new_ability_evidence`。
4. `new_ability_evidence.source` 必须合法。
5. `new_ability_evidence.ability` 必须非空。
6. `updated_evidence = previous updatedEvidence + newAbilityEvidence`。
7. `updated_evidence` 必须按 evidence id 去重。
8. `updated_student_ability_profile` 必须基于新的 `updated_evidence` 生成。
9. 任务执行摘要优先复用 Phase 5.2 的 `PersonalizedTaskExecutionSummary`。
10. 如果任务诊断能力与 `target_ability` 不一致，应进入 REVIEW 或在 validation 中记录 issue。
11. `new_ability_evidence.source` 不得使用 `retest`。
12. 如果任务已完成、诊断已完成、新 Evidence 已生成、Profile 已更新，则 `flow_status = ready_for_retest`。

## Flow Status 规则

`flow_status` 用于描述 7.2 当前流程进度。

支持状态：

```ts
type PersonalizedTrainingFlowStatus =
  | 'task_generated'
  | 'task_completed'
  | 'diagnosis_completed'
  | 'ready_for_retest'
  | 'validation_failed';
```

状态含义：

| 状态 | 含义 |
| --- | --- |
| `task_generated` | 已生成个性化任务，但学生尚未提交训练答案 |
| `task_completed` | 学生已提交训练答案，但尚未完成诊断回流 |
| `diagnosis_completed` | 训练答案已完成诊断，但证据或画像更新仍存在校验问题 |
| `ready_for_retest` | 任务执行、诊断、Evidence 更新和 Profile 更新均已完成，可进入 Phase 7.3 复测 |
| `validation_failed` | 结构校验失败，不能进入下一步 |

Phase 7.2 验收通过时，最终状态应为：

```text
ready_for_retest
```

## Student-facing Feedback 规则

Phase 7.2 的学生可读反馈需要把 `PersonalizedNextTask` 与 `task_execution_summary` 转换为自然语言。

学生可见区域应回答：

- 这次训练目标是什么？
- 为什么现在做这道任务？
- 这次表现如何？
- 下一步应该怎么做？

例如：

```text
本次训练目标：从文本依据推出合理结论。

为什么做这道任务：
你上一题已经能说出结论，但缺少文本依据，所以这次先练习“找到依据，再得出结论”。

本次表现：
这次你能引用部分文本信息，说明推理过程比上一题更清楚。

下一步：
建议再换一篇文本复测，看看这种方法能不能迁移到新题里。
```

如果任务结果仍然暴露 weakness，页面应展示：

```text
你仍然能说出判断，但依据不够明确，结论和文本之间的关系还需要加强。

下一步继续练习“先找依据，再写结论”。
```

学生主体验区不应直接展示：

- `evidenceType`
- `source`
- `confidence`
- `raw JSON`
- `DiagnosisResult` 原始字段名
- `AbilityEvidence` 原始字段名

开发者调试信息可以折叠展示。

## 页面最小体验

建议新增页面：

```text
src/pages/BetaPersonalizedTrainingDemo.jsx
```

建议路由：

```text
/#/beta-personalized-training-demo
```

页面入口：

```text
从 Phase 7.1 页面结果点击“继续个性化训练”
```

页面也可以保留独立调试入口，但 Phase 7.2 的主验收应证明它能够消费 Phase 7.1 输出。

页面最小结构：

### 上一步诊断摘要

- 本次重点能力；
- 当前主要问题；
- 下一步训练方向。

### 个性化任务说明

- 训练目标；
- 为什么做这道任务；
- 作答要求；
- 成功标准。

### 任务题目区域

- 题目；
- 学生输入答案；
- 提交按钮。

### 任务反馈区域

- 本次表现；
- 做得好的地方；
- 仍需改进的地方；
- 下一步建议。

### 开发者折叠区

- `personalizedTask`
- `taskDiagnosisResult`
- `newAbilityEvidence`
- `updatedStudentAbilityProfile`
- `PersonalizedTrainingFlowResult`

## 建议新增文件

```text
src/ai/schemas/personalizedTrainingFlow.schema.ts
src/ai/agents/personalizedTrainingFlowAgent.ts
src/ai/tests/runPersonalizedTrainingFlowDebug.ts
src/pages/BetaPersonalizedTrainingDemo.jsx
```

新增脚本：

```text
debug:personalized-training-flow
```

## 建议落地顺序

Phase 7.2 建议按以下顺序落地：

1. 新增 `personalizedTrainingFlow.schema.ts`。
2. 新增 `personalizedTrainingFlowAgent.ts`。
3. 复用 Phase 5.1 `PersonalizedNextTaskAgent`。
4. 复用 Phase 5.2 `PersonalizedTaskExecutionSummary` 或任务执行规则。
5. 新增 `runPersonalizedTrainingFlowDebug.ts`。
6. 新增 `debug:personalized-training-flow` 脚本。
7. 新增 `BetaPersonalizedTrainingDemo.jsx`。
8. 增加 `/#/beta-personalized-training-demo` 路由。
9. 从 7.1 页面结果增加“继续个性化训练”入口。
10. 跑通 Debug。
11. 跑通 build。

## Debug 最小流程

Debug 脚本应执行：

1. 准备 mock `LearningEntryResult`。
2. 准备 mock `StudentAbilityProfile`。
3. 准备 mock `updatedEvidence`。
4. 读取 `initialTargetAbility`。
5. 调用 `PersonalizedNextTaskAgent`。
6. 生成 `PersonalizedNextTask`。
7. 准备 mock `studentTaskAnswer`。
8. 调用 Diagnosis Runtime 或 mock Diagnosis Runtime。
9. 生成 `newAbilityEvidence`。
10. 合并 `updatedEvidence`。
11. 更新 `StudentAbilityProfile`。
12. 生成 `taskExecutionSummary`。
13. 生成 `PersonalizedTrainingFlowResult`。
14. 输出 PASS / FAIL。

## Debug Report 要求

Debug Report 至少展示：

```text
Personalized Training Flow Debug Report

Input:
- studentId
- sessionId
- targetAbility
- previousWeakness
- evidenceCountBefore

Generated Task:
- taskId
- targetAbility
- taskGoal
- whyThisTask
- linkedEvidence
- successCriteria

Student Task Answer:
- answer text

Task Diagnosis:
- mainAbility
- answerStatus
- rootCause

New Ability Evidence:
- ability
- evidenceType
- source
- confidence

Updated Profile:
- currentWeakness
- abilityStatus
- nextStepRecommendation

Task Execution Summary:
- diagnosisFocusMatch
- executionSummary
- newEvidenceId

Student Readable Feedback:
- taskGoal
- performanceSummary
- whatToImproveNext

Flow:
- flowStatus

PASS / FAIL
```

## 验收标准

Phase 7.2 通过条件：

1. 能消费 Phase 7.1 的 `LearningEntryResult`。
2. 能读取 `sessionId / studentId / targetAbility`。
3. 能基于 `StudentAbilityProfile` 或 `updatedEvidence` 生成 `PersonalizedNextTask`。
4. `PersonalizedNextTask.target_ability` 与 `targetAbility` 一致。
5. `PersonalizedNextTask.why_this_task` 非空。
6. `PersonalizedNextTask.success_criteria` 非空。
7. `PersonalizedNextTask.linked_evidence` 至少包含一条来自 7.1 `updatedEvidence` 的 evidence id。
8. 页面能展示个性化任务。
9. 学生能提交 `studentTaskAnswer`。
10. 系统能调用 Diagnosis Runtime 或 mock Diagnosis Runtime。
11. 系统能生成 `task_diagnosis_result`。
12. 系统能生成 `new_ability_evidence`。
13. `new_ability_evidence.ability` 非空。
14. `new_ability_evidence.source` 合法。
15. `new_ability_evidence.source !== 'retest'`。
16. `updated_evidence.length` 大于执行前或按 id 去重后保持合理变化。
17. 系统能更新 `StudentAbilityProfile`。
18. 系统能生成 `task_execution_summary`。
19. 系统能生成学生可读反馈。
20. `flow_status = ready_for_retest`。
21. 页面能从 7.1 结果进入 7.2。
22. 页面不依赖 JSON 才能理解训练结果。
23. Debug 输出 PASS。
24. `pnpm run build` 通过。

## 本阶段不做

Phase 7.2 不做：

- 不生成 Retest Task；
- 不处理复测答案；
- 不生成 Retest Evidence；
- 不生成 Ability Change Evaluation；
- 不生成完整 Session Result；
- 不做长期成长报告；
- 不接正式数据库；
- 不做账号系统；
- 不做家长端；
- 不做正式 UI 视觉打磨；
- 不做多任务训练计划；
- 不做复杂课程路径。

Phase 7.2 只做：

```text
诊断后
-> 个性化任务
-> 学生完成任务
-> 任务结果回流
```

## 与 Phase 7.1 / 7.3 的关系

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
基于任务执行结果，生成复测任务，完成复测，输出 Ability Change Evaluation 和 Session Result。
```

也可以这样理解：

```text
7.1：发现问题
7.2：针对训练
7.3：复测验证
```

## Definition of Done

Phase 7.2 完成时，应能通过一个入口证明：

```text
LearningEntryResult
-> PersonalizedNextTask
-> StudentTaskAnswer
-> Diagnosis Runtime
-> New AbilityEvidence
-> Updated StudentAbilityProfile
-> PersonalizedTrainingFlowResult
```

这一条 Beta Learning Flow 的训练执行闭环已经跑通。

## 最终目标

Phase 7.2 的最终目标不是证明训练效果已经稳定，而是让学生在第一题诊断后能够进入一项有依据、有目标、可执行、可回流的个性化训练任务。

它标志着系统从：

```text
发现问题
```

推进到：

```text
开始针对训练
```
