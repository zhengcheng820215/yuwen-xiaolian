# Phase 6：Retest / Evaluation Runtime Acceptance Summary

## 一、阶段定位

Phase 6 的目标是建立 Retest / Evaluation Runtime，用于验证训练后的能力表现是否能在新题、新文本或新情境中迁移，并基于复测证据判断目标能力是否发生可解释变化。

Phase 6 不再只关注训练任务是否完成，而是进一步回答：

> 训练之后，学生是否能在新情境中表现出能力改善？

## 二、Phase 6 完成的 Runtime 阶梯

Phase 6.1 已完成：

```text
LearningSessionMemory
-> RetestTask
```

Phase 6.2 已完成：

```text
RetestTask
+ Student Retest Answer
-> Diagnosis Runtime
-> Retest Evidence
-> updatedEvidence
-> Evidence Summary
-> Student Ability Profile
```

Phase 6.3 已完成：

```text
Before Evidence
+ Training / Task Execution Evidence
+ Retest Evidence
-> AbilityChangeEvaluation
-> Next Decision
```

## 三、核心闭环

Phase 6 已完成以下最小闭环：

```text
LearningSessionMemory
-> RetestTask
-> Student Retest Answer
-> Retest Evidence
-> AbilityChangeEvaluation
-> Next Learning Decision
```

这说明系统已经能够从“训练后需要复测”推进到“复测后判断能力变化”。

## 四、已完成模块

Phase 6.1：

- `retestTask.schema.ts`
- `retestTaskAgent.ts`
- `runRetestTaskDebug.ts`
- `debug:retest-task`

Phase 6.2：

- `retestExecution.schema.ts`
- `retestExecutionAgent.ts`
- `runRetestExecutionDebug.ts`
- `debug:retest-execution`

Phase 6.3：

- `abilityChangeEvaluation.schema.ts`
- `abilityChangeEvaluationAgent.ts`
- `runAbilityChangeEvaluationDebug.ts`
- `debug:ability-change-evaluation`

## 五、验收方式

Phase 6 采用 Debug Runtime 验收，不以 Demo 页面作为必要验收条件。

已通过的最小验收入口：

```text
pnpm run debug:retest-task
pnpm run debug:retest-execution
pnpm run debug:ability-change-evaluation
```

Phase 6.3 Debug 已覆盖以下能力变化判断：

- `likely_improved`
- `not_transferred`
- `still_weak`
- `needs_more_evidence`

其中：

- `likely_improved` 表示训练与复测均出现改善信号；
- `not_transferred` 表示训练中改善但复测未迁移；
- `still_weak` 表示训练前、训练中、复测后持续薄弱；
- `needs_more_evidence` 表示证据不足，不能判断能力变化。

## 六、已证明能力

Phase 6 已证明：

1. 系统可以基于 Learning Session 生成复测任务。
2. 复测任务不是继续训练题，而是用于迁移验证。
3. 复测任务可以使用新题、新文本或新情境。
4. 学生复测答案可以进入 Diagnosis Runtime。
5. 复测答案可以生成 `source = retest` 的 Ability Evidence。
6. Retest Evidence 可以回流 `updatedEvidence`。
7. Evidence Summary 和 Student Ability Profile 可以消费 Retest Evidence。
8. 系统可以基于训练前、训练中、复测后的 Evidence 判断能力变化。
9. 系统可以识别 `likely_improved`、`not_transferred`、`still_weak`、`needs_more_evidence` 等状态。
10. 系统可以输出下一步学习决策。

## 七、冻结边界

Phase 6 冻结后不继续扩展：

- 不继续 Phase 6.4。
- 不继续扩展复测任务生成策略。
- 不做长期复测统计模型。
- 不做正式 UI。
- 不接数据库。
- 不生成正式长期成长报告。
- 不修改 Diagnosis Result Schema。
- 不修改 Ability Evidence Schema。
- 不重构 Phase 4 / Phase 5 主链路。

## 八、本阶段未证明内容

Phase 6 不证明：

1. 学生能力已经长期稳定提升。
2. 复测结果已经具备长期统计稳定性。
3. 训练任务一定有效。
4. 复测题质量已经长期稳定。
5. AI 诊断在所有题目上都准确。
6. Student Ability Profile 已经等同正式成长档案。
7. 系统已经具备完整长期学习报告能力。

Phase 6 证明的是：

> 系统可以通过复测证据，对训练后的能力变化做出结构化、可解释、可继续追踪的判断。

## 九、进入 Phase 7 的原因

Phase 6 已经完成复测与能力变化判断。

下一阶段不应继续堆叠 Retest Runtime，而应进入长期学习记忆层。

建议进入：

```text
Phase 7：Long-term Student Growth Memory
```

Phase 7 的核心问题是：

> 系统能否把多次 Session、Retest 和 AbilityChangeEvaluation 组织成长期学生成长记忆？

也就是说，Phase 7 应从“单轮能力变化判断”升级为“长期成长轨迹记录”。

## 十、最终结论

Phase 6 可以冻结。

Phase 6 已完成 Retest / Evaluation Runtime 最小闭环，系统已经能够基于 Learning Session 生成复测任务，将复测作答转化为 Retest Evidence，并基于训练前、训练中、复测后的证据判断目标能力是否发生可解释变化。

不建议继续 Phase 6.4。

建议进入 Phase 7：Long-term Student Growth Memory。
