# Phase 5.1 Acceptance Report

## 验收对象

Phase 5.1：Personalized Next Task 最小闭环

本次验收验证学生画像与优先薄弱能力是否能够驱动下一次个性化训练任务，并在学生作答后重新回流诊断与画像系统。

## 验收链路

```text
Student Ability Profile
-> Top Weakness
-> Personalized Next Task
-> Student Answer
-> Diagnosis Result
-> newAbilityEvidence
-> updatedEvidence
-> Student Ability Profile 更新
```

## 实现范围

本阶段新增：

```text
src/ai/schemas/personalizedNextTask.schema.ts
src/ai/agents/personalizedNextTaskAgent.ts
src/ai/tests/runPersonalizedNextTaskDebug.ts
src/pages/PersonalizedNextTaskDemo.jsx
```

本阶段更新：

```text
package.json
src/App.jsx
src/pages/Home.jsx
```

新增命令：

```bash
pnpm run debug:personalized-next-task
```

## Debug 验收结果

Phase 5.1 Debug 已通过。

关键输出：

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

说明：

- 个性化任务能够从 `topWeakness[0]` 生成。
- `target_ability` 能够保持为当前优先薄弱能力。
- 任务能够关联已有 weakness evidence。
- 学生答案可以进入 Phase 4.2 Diagnosis Runtime。
- 回流后能够生成新的 Ability Evidence。
- 新 Evidence 可以合并回 updatedEvidence。
- Student Ability Profile 可以基于合并后的 evidence 再次更新。

## Demo 验收结果

Demo 页面：

```text
/#/personalized-next-task-demo
```

Demo 已验证：

- 页面能够展示当前 Runtime 状态。
- 页面能够展示 Personalized Next Task。
- 用户可以编辑学生答案。
- 提交后能够回流诊断。
- 回流后能够展示 Diagnosis Result。
- 回流后能够展示 newAbilityEvidence。
- 回流后能够展示更新后的 Student Ability Profile。

### 答案变化验证

弱答案：

```text
父亲很喜欢整理东西。
```

预期结果：

```text
answerStatus = does_not_meet
evidenceType = weakness
```

改进答案：

```text
父亲看到旧书和树叶时，想起以前和孩子一起读书的时光，所以他内心有不舍、怀念和牵挂。
```

预期结果：

```text
answerStatus = partially_meets
```

说明：

- 系统已经能够体现“答案变化 -> 诊断变化 -> evidence 变化”的最小体验。
- 当前 Dry Run 会基于文本线索、心理判断、理由说明进行轻量判断。
- 真实 AI 模式可作为后续质量验证入口，但不是 Phase 5.1 最小验收前置。

## Phase 5.1 验收结论

Phase 5.1 验收通过。

```text
allowNextPhase = true
```

Phase 5.1 Personalized Next Task 最小闭环通过。

系统能够基于以下 Runtime 数据，自动生成下一步个性化训练任务：

- `Student Ability Profile`
- `Top Weakness`
- `Evidence Summary`
- `updatedEvidence`

本次生成的任务针对当前第一薄弱能力：

```text
推理
```

训练方向为：

```text
文本线索 -> 人物心理 -> 推理说明
```

任务生成依据来自历史 Ability Evidence：

```text
学生曾停留在表面行为描述，未能从文本行为线索推断人物心理，
也未能完成“文本行为线索 -> 人物心理 -> 结论表达”的推理链。
```

学生完成任务后，答案可以进入回流诊断；在真实 AI 模式下，可进入 DeepSeek 诊断。

回流诊断能够输出：

- `answerStatus`
- `mainAbility`
- `rootCause`
- `abilityEvidence`
- `nextTraining`
- `confidence`

系统已具备区分以下作答状态的结构能力：

- `does_not_meet`
- `partially_meets`
- `fully_meets`

当前 Demo 已验证：

- 弱答案可生成 `does_not_meet` 和 weakness evidence。
- 改进答案可生成 `partially_meets`，并触发不同诊断反馈。

因此，Phase 5.1 已经证明：

```text
能力画像可以驱动下一次学习任务；
下一次学习任务可以重新回流诊断；
诊断结果可以继续更新能力证据和学生画像。
```

换言之：

```text
Personalized Next Task
-> Student Answer
-> Diagnosis Result
-> Ability Evidence
```

这一条最小连续学习闭环已经成立。

## 冻结边界

本阶段冻结以下边界：

- 不接数据库。
- 不保存任务历史。
- 不做正式 UI。
- 不做复杂题库。
- 不做长期训练路径。
- 不做复测机制。
- 不做长期成长报告。
- 不修改 Diagnosis Result Schema。
- 不重构 Phase 4.2 Runtime 主链路。
- 不验证 AI Task Generator 自由出题能力。
- 不验证多学生任务分发。
- 不验证长期训练效果。

## 后续方向

后续阶段可以继续推进：

- 将 Personalized Next Task 持久化为任务记录。
- 支持真实学生连续完成任务。
- 支持任务完成后的复测机制。
- 支持多次任务形成短周期训练序列。
- 将 Phase 5.1 Demo 升级为正式学习入口。
- 升级为 `Student Ability Profile + Evidence Summary -> AI Task Generator -> Personalized Next Task`。
- 继续验证任务质量与训练有效性。

