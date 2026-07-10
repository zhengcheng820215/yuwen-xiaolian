# Phase 6.1：Retest Task Generation 最小闭环

## 一句话定义

基于 Learning Session Memory 中的 `session_outcome` 和 `next_recommendation`，生成一题用于迁移验证的 Retest Task。

## 阶段背景

Phase 5 已完成 Personalized Learning Runtime 最小闭环：

```text
Student Ability Profile
-> Personalized Next Task
-> Task Execution
-> Diagnosis Runtime
-> Ability Evidence
-> Student Ability Profile Update
-> Learning Session Memory
-> Next Session Recommendation
```

Phase 5.3 已经能够输出：

```text
LearningSessionMemory
-> SessionOutcome
-> NextSessionRecommendation
```

当 `next_recommendation.decision = retest` 时，系统已经判断：

> 当前能力可能出现改善信号，但还需要通过新题、新文本或新情境进行迁移验证。

因此 Phase 6.1 的目标不是评估能力是否提升，而是先验证：

> 系统能否基于 Learning Session Memory 生成一题合格的复测任务？

## 阶段目标

建立 Retest Task Generation 最小闭环：

```text
LearningSessionMemory
+ target_ability
+ next_recommendation = retest
-> RetestTask
```

本阶段要证明：

- 复测任务来自 Learning Session，而不是随机生成。
- 复测目标能力来自 `LearningSessionMemory.target_ability`。
- 复测理由来自 `session_outcome` 和 `next_recommendation`。
- 复测题不能简单重复训练题。
- 复测题必须能够进入后续 Diagnosis Runtime。

## 核心问题

Phase 6.1 回答的问题是：

> 系统能否在一轮训练后，生成一题用于验证迁移的复测任务？

具体包括：

- 为什么现在需要复测？
- 复测哪个能力？
- 复测题是否与原训练任务保持同一能力目标？
- 复测题是否使用新文本、新情境或新表达方式？
- 复测题是否能被后续 Diagnosis Runtime 消费？

## 最小闭环

Phase 6.1 的最小链路为：

```text
LearningSessionMemory
-> read target_ability
-> read session_outcome
-> read next_recommendation
-> generate RetestTask
-> validate RetestTask
-> Debug Report
```

本阶段只生成复测任务，不处理学生复测答案。

## 输入

Phase 6.1 输入包括：

- `learningSessionMemory`

其中 `learningSessionMemory` 至少需要包含：

- `session_id`
- `student_id`
- `target_ability`
- `session_outcome`
- `next_recommendation.decision`
- `next_recommendation.reason`
- `task_execution_snapshots`
- `evidence_ids`

输入前置条件：

```text
learningSessionMemory.next_recommendation.decision === "retest"
```

如果 `next_recommendation.decision !== "retest"`，本阶段不应强行生成复测任务，应输出不可生成原因。

## 输出

Phase 6.1 输出 `RetestTaskGenerationResult`。

该结果用于同时表达：

- 是否可以生成复测任务；
- 生成失败时为什么跳过；
- 生成成功时的 RetestTask；
- 本次生成结果是否满足最小校验规则。

建议结构：

```ts
export type RetestTaskGenerationResult = {
  can_generate: boolean;
  retest_task?: RetestTask;
  skip_reason?: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

当 `next_recommendation.decision !== "retest"` 时：

- `can_generate = false`
- `retest_task` 不应输出
- `skip_reason` 必须说明当前 recommendation 不要求复测
- 不应强行生成任务

字段至少包含：

- `retest_task_id`
- `target_ability`
- `retest_goal`
- `why_retest_now`
- `question`
- `reference_answer`
- `scoring_points`
- `success_criteria`
- `linked_session_id`
- `source_session_outcome`
- `source_next_recommendation`
- `expected_evaluation_focus`

## 建议新增 Schema

```ts
export type RetestTask = {
  retest_task_id: string;

  target_ability: string;

  retest_goal: string;

  why_retest_now: string;

  question: string;

  reference_answer: string;

  scoring_points: string[];

  success_criteria: string[];

  linked_session_id: string;

  source_session_outcome: string;

  source_next_recommendation: string;

  expected_evaluation_focus: string[];
};

export type RetestTaskGenerationResult = {
  can_generate: boolean;
  retest_task?: RetestTask;
  skip_reason?: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

## 字段说明

| 字段 | 含义 |
| --- | --- |
| `retest_task_id` | 复测任务 ID |
| `target_ability` | 本次复测目标能力，必须来自 `LearningSessionMemory.target_ability` |
| `retest_goal` | 本次复测要验证的具体能力表现 |
| `why_retest_now` | 为什么现在需要复测 |
| `question` | 复测题题目 |
| `reference_answer` | 复测参考答案 |
| `scoring_points` | 可供后续 Diagnosis / Evaluation 使用的评分要点 |
| `success_criteria` | 本次复测达到最低有效表现的标准 |
| `linked_session_id` | 关联的 Learning Session |
| `source_session_outcome` | 触发本次复测的 Session Outcome |
| `source_next_recommendation` | 触发本次复测的 Next Recommendation |
| `expected_evaluation_focus` | 后续评估应重点观察什么 |

## Retest Task Generation Rules

Retest Task 必须遵循以下规则：

1. `target_ability` 必须来自 `LearningSessionMemory.target_ability`。
2. `linked_session_id` 必须等于 `LearningSessionMemory.session_id`。
3. `why_retest_now` 必须引用 `session_outcome` 或 `next_recommendation.reason`。
4. `source_session_outcome` 必须等于 `LearningSessionMemory.session_outcome`。
5. `source_next_recommendation` 必须等于 `LearningSessionMemory.next_recommendation.decision`。
6. `question` 必须使用新文本、新情境或新表达方式。
7. `question` 不能简单重复 Personalized Task 中的原题。
8. `reference_answer` 必须足够支持后续 Diagnosis Runtime。
9. `scoring_points` 必须可观察、可诊断。
10. `success_criteria` 不能证明长期能力提升，只能判断本次复测是否形成有效表现。
11. `expected_evaluation_focus` 必须指向同一 `target_ability` 下的迁移表现。

## 新情境最小判断规则

Phase 6.1 不做复杂题目相似度算法，但必须用最小规则避免“训练题原题复测”。

Debug 中至少验证：

1. Retest Task 的 `question` 不等于最近一次训练任务的 question。
2. Retest Task 使用新的文本、场景、人物行为或表达方式。
3. Retest Task 仍围绕同一个 `target_ability`。
4. Retest Task 的 `scoring_points` 能支撑后续 Diagnosis Runtime 判断。

如果无法证明新情境成立，应在 `validation.issues` 中输出问题。

## 复测与训练任务的区别

Retest Task 不是继续训练题。

Retest Task 的目标不是帮助学生学习方法，而是验证：

> 学生能否在新文本、新题目或新情境中迁移使用同一能力。

因此：

- 训练任务可以较强提示。
- 复测任务应减少提示。
- 训练任务可以聚焦方法建立。
- 复测任务应聚焦迁移验证。
- 复测任务必须与训练任务保持同一 `target_ability`，但不能简单重复原题。

## 建议新增文件

```text
src/ai/schemas/retestTask.schema.ts
src/ai/agents/retestTaskAgent.ts
src/ai/tests/runRetestTaskDebug.ts
```

新增命令：

```bash
pnpm run debug:retest-task
```

## Debug 最小流程

Debug 脚本模拟以下流程：

1. 构造一条 `LearningSessionMemory`。
2. 固定 `target_ability = 推理`。
3. 固定 `next_recommendation.decision = retest`。
4. 调用 Retest Task Agent。
5. 生成 `RetestTask`。
6. 校验 `RetestTask` 字段完整。
7. 校验 `RetestTask.target_ability === LearningSessionMemory.target_ability`。
8. 校验 `linked_session_id === LearningSessionMemory.session_id`。
9. 校验复测题不是原训练题简单重复。
10. 校验 `RetestTaskGenerationResult.validation.passed`。
11. 输出 Debug Report。

## Debug Report

Debug Report 至少展示：

```text
Retest Task Debug Report

Input Session:
- session_id
- target_ability
- session_outcome
- next_recommendation

Generated Retest Task:
- retest_task_id
- target_ability
- retest_goal
- why_retest_now
- question
- scoring_points
- success_criteria
- expected_evaluation_focus

Validation:
- target ability match
- linked session match
- has new context
- can enter Diagnosis Runtime
- generation result valid

PASS / FAIL
```

## 验收标准

Phase 6.1 通过条件：

1. 能读取 `LearningSessionMemory`。
2. 能识别 `next_recommendation.decision = retest`。
3. 能生成 `RetestTask`。
4. `RetestTask.retest_task_id` 非空。
5. `RetestTask.target_ability === LearningSessionMemory.target_ability`。
6. `RetestTask.linked_session_id === LearningSessionMemory.session_id`。
7. `RetestTask.source_session_outcome === LearningSessionMemory.session_outcome`。
8. `RetestTask.source_next_recommendation === LearningSessionMemory.next_recommendation.decision`。
9. `why_retest_now` 能解释为什么现在需要复测。
10. `question` 使用新文本、新情境或新表达方式。
11. `question` 不能简单重复训练题。
12. `reference_answer` 非空。
13. `scoring_points.length > 0`。
14. `success_criteria.length > 0`。
15. `expected_evaluation_focus.length > 0`。
16. `RetestTaskGenerationResult.can_generate === true`。
17. `RetestTaskGenerationResult.validation.passed === true`。
18. Debug Report 输出 PASS。
19. `pnpm run build` 通过。

## 本阶段不做

Phase 6.1 不做：

- 不处理学生复测答案。
- 不生成 Retest Evidence。
- 不判断能力是否提升。
- 不更新 Student Ability Profile。
- 不更新 Learning Session Memory。
- 不接数据库。
- 不做正式 UI。
- 不做家长报告。
- 不做长期成长曲线。
- 不做多题复测组卷。
- 不重构 Diagnosis Runtime。
- 不修改 Diagnosis Result Schema。

## 阶段边界

Phase 6.1 只回答：

> 系统能否基于 Learning Session Memory 生成一题合格的复测任务？

它不回答：

- 学生复测表现如何？
- 学生能力是否真正提升？
- 复测结果是否能形成 Retest Evidence？
- 是否应该更新学生画像？

这些属于后续 Phase。

## 与 Phase 6.2 的关系

Phase 6.1 生成：

```text
RetestTask
```

Phase 6.2 才处理：

```text
RetestTask
-> Student Retest Answer
-> Diagnosis / Evaluation Runtime
-> Retest Evidence
```

因此 Phase 6.1 不应提前实现复测结果判断。

## 阶段完成定义

Phase 6.1 完成时，应能通过一个命令证明：

```text
LearningSessionMemory
-> RetestTask
```

这一条最小复测任务生成闭环已经跑通。
