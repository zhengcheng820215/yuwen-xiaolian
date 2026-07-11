# Phase 5.3：学习 Session 记忆最小闭环（Learning Session Memory）

## 一句话定义

把多次 Personalized Task Execution 组织成一次可追踪的学习 Session，让系统能够理解“这一轮训练过程发生了什么”。

## 阶段背景

Phase 5.1 已验证：

```text
Student Ability Profile
-> Personalized Next Task
```

Phase 5.2 已验证：

```text
PersonalizedNextTask
-> Student Answer
-> Diagnosis Runtime
-> newAbilityEvidence
-> updatedEvidence
-> updatedStudentAbilityProfile
-> taskExecutionSummary
-> next_decision
```

但目前系统仍然只理解一次任务执行结果，还不能理解连续几次任务组成的一轮学习过程。

因此 Phase 5.3 的重点不是生成更多任务，而是建立最小 Learning Session Memory。

## 阶段目标

建立一个最小学习 Session 闭环：

```text
Learning Session Start
-> PersonalizedTaskExecution 1
-> PersonalizedTaskExecution 2
-> PersonalizedTaskExecution 3
-> LearningSessionMemory
-> SessionOutcome
-> NextSessionRecommendation
```

本阶段要证明：

系统不仅能记录一次任务结果，还能把多次任务执行组织成一次学习过程，并总结这一轮训练是否仍需继续、是否可以复测、是否可以切换能力。

## 核心问题

Phase 5.3 回答的问题是：

> 学生完成了一轮连续个性化任务后，系统是否能理解这一轮训练发生了什么？

具体包括：

- 这一轮主要训练了什么能力？
- 一共完成了几次任务？
- 每次任务产生了什么 evidence？
- 目标能力是否出现改善信号？
- 当前应该继续训练、复测，还是切换能力？
- 这一轮 Session 是否可以沉淀为长期学习记忆的基础结构？

## 最小闭环

Phase 5.3 的最小闭环为：

```text
updatedEvidence
+ StudentAbilityProfile
+ PersonalizedTaskExecutionSummary[]
-> LearningSessionMemory
-> SessionOutcome
-> NextSessionRecommendation
```

注意：

Phase 5.3 不要求真实连续三天，也不要求真实学生长期使用。

本阶段可以先用 Debug 模拟 3 次任务执行。

## 输入

Phase 5.3 输入包括：

- `studentId`
- `initialStudentAbilityProfile`
- `initialUpdatedEvidence`
- `initialTopWeakness`
- `personalizedTaskExecutionSummaries`

其中：

`personalizedTaskExecutionSummaries` 来自 Phase 5.2。

每条 summary 至少包含：

- `task_id`
- `target_ability`
- `student_answer`
- `diagnosis_answer_status`
- `diagnosis_main_ability`
- `diagnosis_focus_match`
- `new_evidence_type`
- `before.status`
- `after.status`
- `next_decision`
- `decision_reason`

## 输出

Phase 5.3 输出：

- `learningSessionMemory`
- `session_outcome`
- `next_recommendation`

本阶段不单独新增 `LearningSessionSummary` schema。

`LearningSessionSummary` 由 `LearningSessionMemory.summary` 承担，避免过早拆分模型。

## 建议新增 Schema

```ts
export type LearningSessionStatus =
  | 'in_progress'
  | 'completed'
  | 'needs_retest'
  | 'needs_more_training'
  | 'ready_to_switch_ability';

export type LearningSessionOutcome =
  | 'no_clear_improvement'
  | 'early_improvement_signal'
  | 'consistent_improvement'
  | 'needs_retest_validation'
  | 'ability_focus_can_shift';

export type LearningSessionNextRecommendationDecision =
  | 'continue_session'
  | 'retest'
  | 'start_new_session_same_ability'
  | 'start_new_session_new_ability';

export type LearningSessionTaskExecutionSnapshot = {
  task_id: string;
  diagnosis_answer_status: string;
  diagnosis_main_ability: string;
  diagnosis_focus_match: boolean;
  new_evidence_type: string;
  next_decision: string;
};

export type LearningSessionMemory = {
  session_id: string;
  student_id: string;

  target_ability: string;

  started_at: string;
  ended_at?: string;

  task_execution_ids: string[];
  task_execution_snapshots: LearningSessionTaskExecutionSnapshot[];

  evidence_ids: string[];

  task_count: number;

  weakness_evidence_count_before: number;
  weakness_evidence_count_after: number;

  growth_evidence_count_before: number;
  growth_evidence_count_after: number;

  positive_evidence_count_before: number;
  positive_evidence_count_after: number;

  session_status: LearningSessionStatus;

  session_outcome: LearningSessionOutcome;

  summary: string;

  next_recommendation: {
    decision: LearningSessionNextRecommendationDecision;
    reason: string;
  };
};
```

## 字段边界

### session_status

`session_status` 表示 Session 当前生命周期状态。

例如：

- `in_progress`
- `completed`
- `needs_retest`
- `needs_more_training`
- `ready_to_switch_ability`

### session_outcome

`session_outcome` 表示本轮训练结果判断。

例如：

- `no_clear_improvement`
- `early_improvement_signal`
- `consistent_improvement`
- `needs_retest_validation`
- `ability_focus_can_shift`

### next_recommendation

`next_recommendation` 表示下一步动作建议。

`session_outcome` 与 `next_recommendation` 不要求一一对应。

例如：

```text
session_outcome: consistent_improvement
next_recommendation.decision: retest
```

也可能：

```text
session_outcome: needs_retest_validation
next_recommendation.decision: retest
```

`session_outcome` 描述本轮训练表现状态。

`next_recommendation` 描述下一步动作。

### task_execution_snapshots

`task_execution_snapshots` 不复制完整 `PersonalizedTaskExecutionSummary`。

它只保留每次执行的最小可读摘要，用于 Debug、Demo 和后续 Session 复盘。

完整长期判断仍以 `AbilityEvidence` 和 `StudentAbilityProfile` 为准。

## Evidence 使用规则

Phase 5.3 允许使用以下 evidenceType 作为 session 判断依据：

- `weakness`
- `growth`
- `positive`
- `insufficient`

其中：

- `weakness` 表示目标能力仍存在问题。
- `growth` 表示相较原薄弱点出现改善迹象。
- `positive` 表示本次任务表现达到要求。
- `insufficient` 表示本次答案无法形成有效判断。

注意：

`positive` / `growth` 不能单独证明能力长期稳定提升，只能作为 session outcome 的判断依据。

## 建议新增文件

```text
src/ai/schemas/learningSession.schema.ts
src/ai/agents/learningSessionAgent.ts
src/ai/tests/runLearningSessionDebug.ts
```

新增命令：

```bash
pnpm run debug:learning-session
```

## Debug 最小流程

Debug 脚本模拟一轮 3 次任务执行：

1. 准备初始 `updatedEvidence`。
2. 准备初始 `StudentAbilityProfile`。
3. 固定 `target_ability = 推理`。
4. 模拟 `PersonalizedTaskExecution 1`。
5. 生成 `taskExecutionSummary 1`。
6. 模拟 `PersonalizedTaskExecution 2`。
7. 生成 `taskExecutionSummary 2`。
8. 模拟 `PersonalizedTaskExecution 3`。
9. 生成 `taskExecutionSummary 3`。
10. 汇总 3 次 execution summary。
11. 生成 `LearningSessionMemory`。
12. 输出 `SessionOutcome`。
13. 输出 `NextSessionRecommendation`。

## Debug Report

Debug Report 至少展示：

```text
Learning Session Debug Report

Session ID
Student ID
Target Ability

Before:
- weakness count
- growth count
- positive count
- ability status

Task Executions:
1. task_id
   diagnosis_answer_status
   diagnosis_main_ability
   diagnosis_focus_match
   new_evidence_type
   next_decision

2. task_id
   diagnosis_answer_status
   diagnosis_main_ability
   diagnosis_focus_match
   new_evidence_type
   next_decision

3. task_id
   diagnosis_answer_status
   diagnosis_main_ability
   diagnosis_focus_match
   new_evidence_type
   next_decision

After:
- weakness count
- growth count
- positive count
- ability status

Session Outcome
Next Recommendation
PASS / FAIL
```

## 最小决策规则

Phase 5.3 不需要复杂学习策略，先使用最小规则。

### no_clear_improvement

条件：

连续任务后仍主要产生 `weakness` evidence。

输出：

```text
session_outcome = no_clear_improvement
next_recommendation = start_new_session_same_ability
```

含义：

继续围绕同一能力训练，但可能需要降低难度或换训练方式。

### early_improvement_signal

条件：

出现 1 条 `growth` evidence，但 `weakness` 仍然较多。

输出：

```text
session_outcome = early_improvement_signal
next_recommendation = continue_session
```

含义：

已有改善迹象，但还不能认为能力稳定。

### consistent_improvement

条件：

出现多条 `growth` / `positive` evidence，且近期 `weakness` 减少。

输出：

```text
session_outcome = consistent_improvement
next_recommendation = retest
```

含义：

训练中表现变好，下一步应复测验证迁移。

### needs_retest_validation

条件：

训练任务中表现改善，但缺少 `retest` evidence。

输出：

```text
session_outcome = needs_retest_validation
next_recommendation = retest
```

含义：

不能只看训练表现，需要换题验证。

### ability_focus_can_shift

条件：

目标能力已 `stable_positive`，且其他能力 weakness 更突出。

输出：

```text
session_outcome = ability_focus_can_shift
next_recommendation = start_new_session_new_ability
```

含义：

当前能力可以暂时放下，转向新的薄弱能力。

## 验收标准

Phase 5.3 通过条件：

1. 能读取至少 3 条 `PersonalizedTaskExecutionSummary`。
2. 能识别本轮 session 的 `target_ability`。
3. `target_ability` 在最小 Debug 中固定为 `推理`。
4. 能统计 session 前后的 weakness / growth / positive evidence 数量。
5. 能生成 `LearningSessionMemory`。
6. `LearningSessionMemory` 包含 `task_execution_ids`。
7. `LearningSessionMemory` 包含 `task_execution_snapshots`。
8. `LearningSessionMemory` 包含 `evidence_ids`。
9. 能生成 `session_outcome`。
10. 能生成 `next_recommendation`。
11. `next_recommendation` 必须有 reason。
12. Debug Report 能展示 Before / Task Executions / After / Outcome / Recommendation。
13. Debug 输出 PASS。
14. `pnpm run build` 通过。

## 本阶段不做

Phase 5.3 不做：

- 不接数据库。
- 不保存真实长期历史。
- 不做正式 UI。
- 不做家长报告。
- 不做长期成长曲线。
- 不做多日训练计划。
- 不做奖励系统。
- 不做复测 Agent 重构。
- 不做真实 AI 任务质量评估。
- 不证明学生长期能力真实提升。

非常重要：

Phase 5.3 只是在内存 / mock / debug 层面验证 session memory 结构成立，不证明真实长期学习效果。

## 阶段边界

Phase 5.3 只回答：

> 多次 Personalized Task Execution 能否被组织成一次学习 Session？

它不回答：

- 这个学生长期是否真的提升？
- 未来一周应该怎么训练？
- 家长应该看到什么报告？
- 是否应该进入正式课程系统？

这些属于后续 Phase。

## 与 Phase 5.2 的关系

Phase 5.2 回答：

```text
一次任务执行后，是否能形成 evidence 和 next_decision？
```

Phase 5.3 回答：

```text
多次任务执行后，是否能形成 session memory 和 session outcome？
```

## 阶段完成定义

Phase 5.3 完成时，应能通过一个命令证明：

```text
PersonalizedTaskExecutionSummary x 3
-> LearningSessionMemory
-> SessionOutcome
-> NextSessionRecommendation
```

这一条最小学习 Session 记忆闭环已经跑通。

## 阶段名称

正式名称：

```text
Phase 5.3：Learning Session Memory 最小闭环
```

不使用“长期学习记忆”，因为当前还不是长期。

不使用“训练计划”，因为本阶段不是计划生成，而是把多次执行结果组织成 session。
