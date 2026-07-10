# Phase 5.2：Personalized Task Execution Evidence

## 阶段背景

Phase 5.1 已完成 Personalized Next Task 最小闭环：

```text
Student Ability Profile
+ Top Weakness
+ Evidence Summary
+ updatedEvidence
-> Personalized Next Task
```

Phase 5.1 证明系统能够回答：

```text
当前学生最应该做哪一道任务？为什么？
```

但 Phase 5.1 还需要继续向前推进一步：

```text
这道任务完成后，是否真的能产生同一能力的新证据，并驱动下一步学习决策？
```

因此，Phase 5.2 的重点不是继续生成更多任务，而是验证 Personalized Task 能否进入执行、评估、证据沉淀和下一步决策。

## 阶段目标

建立 Personalized Task Execution Evidence 最小闭环。

本阶段必须证明：

```text
训练前：
推理 weakness

-> 完成 PersonalizedTask

训练后：
推理 evidence 更新

-> 下一步：
继续强化 / 提升难度 / 转换能力 / 复测
```

一句话定义：

> PersonalizedTask 不是一次孤立任务，而是能够改变同一能力的 evidence 状态，并驱动下一步训练决策。

## 核心链路

Phase 5.2 的最小链路为：

```text
PersonalizedNextTask
-> Student Answer
-> Diagnosis Runtime
-> DiagnosisResult
-> New AbilityEvidence
-> updatedEvidence
-> Updated StudentAbilityProfile
-> PersonalizedTaskExecutionSummary
-> next_decision
```

本阶段必须保留训练前后对比：

```text
Before:
推理 weakness

Task:
推理 PersonalizedTask

After:
推理 evidence updated

Next:
continue_reinforcement / increase_difficulty / switch_ability / retest
```

## 输入

- `studentAbilityProfile`
- `evidenceSummary`
- `topWeakness`
- `updatedEvidence`
- `personalizedNextTask`
- `studentAnswer`

其中：

- `personalizedNextTask.target_ability` 必须来自 `topWeakness[0].ability`。
- Phase 5.2 最小 Debug 样例中，训练前目标能力固定为：`推理`。
- `updatedEvidence` 必须包含训练前的 `推理 weakness evidence`。

## 输出

Phase 5.2 输出：

- `diagnosisResult`
- `newAbilityEvidence`
- `updatedEvidence`
- `updatedStudentAbilityProfile`
- `taskExecutionSummary`
- `next_decision`

其中 `taskExecutionSummary` 用于解释训练前后变化。

## 建议新增结构

新增：

```text
src/ai/schemas/personalizedTaskExecution.schema.ts
src/ai/agents/personalizedTaskExecutionAgent.ts
src/ai/tests/runPersonalizedTaskExecutionDebug.ts
```

新增命令：

```bash
pnpm run debug:personalized-task-execution
```

## 建议 Schema

```ts
export type PersonalizedTaskNextDecision =
  | 'continue_reinforcement'
  | 'increase_difficulty'
  | 'switch_ability'
  | 'retest';

export type PersonalizedTaskExecutionSummary = {
  before: {
    target_ability: string;
    weakness_evidence_count: number;
    growth_evidence_count: number;
    status: string;
    reason: string;
  };
  execution: {
    task_id: string;
    target_ability: string;
    student_answer: string;
    diagnosis_answer_status: string;
    new_evidence_type: string;
  };
  after: {
    target_ability: string;
    evidence_updated: boolean;
    weakness_evidence_count: number;
    growth_evidence_count: number;
    status: string;
  };
  next_decision: PersonalizedTaskNextDecision;
  decision_reason: string;
};
```

## 最小决策规则

Phase 5.2 不需要复杂策略，先使用最小规则：

| 条件 | next_decision |
| --- | --- |
| 新 evidence 仍为 `weakness` | `continue_reinforcement` |
| 新 evidence 为 `growth`，但同能力历史 weakness 仍较多 | `continue_reinforcement` |
| 新 evidence 为 `growth`，且画像状态进入 improving / stable_positive | `increase_difficulty` |
| 当前目标能力已出现稳定 positive / growth，且其他能力 weakness 更突出 | `switch_ability` |
| evidence 显示有改善但仍需验证迁移 | `retest` |

本阶段只要求规则可解释，不要求证明长期能力已经提升。

## 验收方式

运行：

```bash
pnpm run debug:personalized-task-execution
```

同时执行：

```bash
pnpm run build
```

## 验收标准

通过条件：

1. 能读取 Phase 5.1 生成的 `PersonalizedNextTask`。
2. 能接收学生答案。
3. `before.target_ability === "推理"`。
4. `before.status` 能说明训练前存在 `推理 weakness`。
5. `personalizedNextTask.target_ability === "推理"`。
6. 能把 Personalized Task 和学生答案送入 Diagnosis Runtime。
7. 能生成结构化 `DiagnosisResult`。
8. 能生成新的 `AbilityEvidence`。
9. 新 evidence 必须关联 `推理`。
10. 能把新 evidence 合并回 `updatedEvidence`。
11. `after.evidence_updated === true`。
12. `after.weakness_evidence_count` 或 `after.growth_evidence_count` 能反映推理 evidence 变化。
13. 能重新生成 `updatedStudentAbilityProfile`。
14. 能说明这次任务是否支持原薄弱点改善。
15. `next_decision` 必须属于：
    - `continue_reinforcement`
    - `increase_difficulty`
    - `switch_ability`
    - `retest`
16. Debug 输出必须能直观看到：

```text
Before: 推理 weakness
Task: 推理 PersonalizedTask
After: 推理 evidence updated
Next: continue_reinforcement / increase_difficulty / switch_ability / retest
```

## 当前验收结果

待开发 / 待验收

## 本阶段不做

Phase 5.2 不做：

- 不接数据库。
- 不保存正式任务历史。
- 不做正式 UI。
- 不扩展复杂题库。
- 不生成多道任务队列。
- 不做多日训练计划。
- 不做长期学习报告。
- 不做奖励系统。
- 不证明学生长期能力已经提升。
- 不重构 Phase 4.2 Diagnosis Runtime。
- 不修改 Diagnosis Result Schema。

## 与 Phase 5.1 的关系

Phase 5.1 回答：

```text
当前最应该做哪一道任务？
```

Phase 5.2 回答：

```text
做完这道任务后，系统是否能产生同能力新证据，并更新下一步判断？
```

## 阶段完成定义

Phase 5.2 完成时，应能够通过一个命令证明：

```text
推理 weakness
-> PersonalizedTask
-> Student Answer
-> DiagnosisResult
-> 推理 New AbilityEvidence
-> updatedEvidence
-> updatedStudentAbilityProfile
-> next_decision
```

这一条最小任务执行证据闭环已经跑通。

## 下一阶段建议

Phase 5.3 可以考虑进入：

```text
Personalized Task History / Learning Session Memory
```

也就是把多次 Personalized Task Execution 组织成一次学习 session，观察连续任务是否能形成更稳定的成长记忆。
