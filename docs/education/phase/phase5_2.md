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

## Evidence Type 使用说明

Phase 5.2 允许使用以下 `evidenceType`：

- `weakness`：本次任务仍暴露目标能力问题。
- `positive`：本次任务表现达到要求。
- `growth`：相较于原 weakness 出现改善迹象，但尚不足以证明稳定掌握。
- `insufficient`：本次答案无法形成有效判断。

其中：

- `growth` 用于支持 `ability_status = improving`。
- `positive` 可以作为 `stable_positive` 的证据之一，但不能单独证明 `stable_positive`。
- `weakness` 用于支持继续训练。
- `insufficient` 不应作为 `next_decision` 的主要依据。

Phase 5.2 不能因为单条 `positive` 或 `growth` evidence 直接判断长期能力已经稳定提升。

## Same Ability Evidence Rule

Phase 5.2 必须验证 `newAbilityEvidence.ability` 与 `personalizedNextTask.target_ability` 保持一致。

如果 `DiagnosisResult.mainAbility` 与 `personalizedNextTask.target_ability` 不一致，则进入 REVIEW 状态，不直接用于更新目标能力判断。

处理规则：

1. 如果 `DiagnosisResult.mainAbility === personalizedNextTask.target_ability`，则正常生成 execution summary。
2. 如果 `DiagnosisResult.mainAbility` 与 `personalizedNextTask.target_ability` 为相邻能力，可以记录为 secondary observation，但不能直接证明目标能力变化。
3. 如果 `DiagnosisResult.mainAbility` 明显偏离 `personalizedNextTask.target_ability`，应标记为 `diagnosis_focus_mismatch`，并进入 REVIEW。

该规则用于保证 Personalized Task 的回流诊断仍然围绕同一目标能力，不因诊断焦点漂移而污染长期 evidence。

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
    diagnosis_main_ability: string;
    diagnosis_focus_match: boolean;
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

其中：

- `diagnosis_main_ability` 记录 Diagnosis Runtime 实际返回的主要能力。
- `diagnosis_focus_match` 用于判断本次诊断是否仍然聚焦任务目标能力。
- 当 `diagnosis_focus_match === false` 时，本次 execution summary 可以保留，但不得直接证明 `target_ability` 已改善。

## Task Execution Evidence 与 Ability Evidence 的关系

Phase 5.2 不新增独立长期证据类型。

任务执行结果通过 Diagnosis Runtime 转换为 Ability Evidence，进入 `updatedEvidence`。

`taskExecutionSummary` 是本次任务执行的过程摘要，用于解释 before / after / `next_decision`，不作为长期能力证据池的主数据源。

长期累计仍以 `AbilityEvidence` 为准。

因此：

- `AbilityEvidence` 负责长期能力判断。
- `taskExecutionSummary` 负责解释本次任务执行过程。
- `next_decision` 必须基于 `AbilityEvidence` 更新结果，而不是只基于任务是否完成。

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

PASS。

通过性质：

Runtime 最小闭环通过。

已证明：

- `PersonalizedNextTask` 可以进入执行。
- 学生答案可以进入 Diagnosis Runtime。
- 诊断结果可以生成 `newAbilityEvidence`。
- `newAbilityEvidence` 可以合并回 `updatedEvidence`。
- `updatedEvidence` 可以更新 `StudentAbilityProfile`。
- 系统可以生成 `taskExecutionSummary`。
- 系统可以基于执行结果给出 `next_decision`。

未证明：

- 真实 AI 对学生答案的诊断质量已经稳定。
- 任务本身具备真实教学有效性。
- 学生能力已经真实提升。
- 长期训练路径已经成立。

## Phase 5.2 验收冻结记录

验收时间：2026-07-10

验收结论：PASS

通过类型：Runtime 最小闭环通过

本阶段已完成：

- `personalizedTaskExecution.schema.ts`
- `personalizedTaskExecutionAgent.ts`
- `runPersonalizedTaskExecutionDebug.ts`
- `debug:personalized-task-execution`
- Personalized Task Execution Demo 页面
- 首页 Demo 入口

本阶段已验证以下链路：

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

Debug 验收结果：

- Debug 可重复运行。
- Debug 输出 PASS。
- `taskExecutionSummary` 可展示 before / execution / after / `next_decision`。
- `newAbilityEvidence` 能合并回 `updatedEvidence`。
- `updatedStudentAbilityProfile` 能基于新证据重新生成。
- `next_decision` 能根据最小规则输出。

Demo 验收结果：

页面能够展示并运行：

- `PersonalizedNextTask`
- Student Answer
- Diagnosis Runtime
- `newAbilityEvidence`
- `updatedEvidence`
- `updatedStudentAbilityProfile`
- `taskExecutionSummary`
- `next_decision`

验收边界：

本阶段不证明真实训练效果。

本阶段不验证真实 AI 对学生答案的诊断质量。

本阶段不证明学生能力真实提升。

本阶段不接数据库。

本阶段不保存长期任务历史。

本阶段不做多任务训练计划。

本阶段不做长期学习报告。

本阶段不做真实 AI 任务质量评估。

最终结论：

Phase 5.2 已证明一次 `PersonalizedNextTask` 可以完成执行、诊断、证据沉淀、画像更新和下一步决策。

因此，Phase 5.2 可以冻结，允许进入 Phase 5.3 的规划与最小闭环开发。

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
