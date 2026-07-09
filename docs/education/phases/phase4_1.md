# Phase 4.1：Student Ability Profile 最小版本

## 阶段目标

基于 Phase 3 产生的 Ability Evidence、Training Evidence、Retest Evidence，生成学生能力画像最小版本。

本阶段验证：

```text
系统是否能够持续理解一个学生当前能力状态。
```

## 输入

- Ability Evidence Summary
- Top Weakness
- Training Evidence
- Retest Evidence

## 输出

Student Ability Profile:

- `current_weakness`
- `ability_status`
- `improvement_signals`
- `continue_training_focus`
- `evidence_links`
- `next_step_recommendation`

## 核心链路

```text
Evidence
-> Ability Profile
-> Next Step Recommendation
```

## 新增内容

- `src/ai/schemas/studentAbilityProfile.schema.ts`
- `src/ai/agents/studentAbilityProfileAgent.ts`
- `src/ai/tests/runStudentAbilityProfileDebug.ts`
- `src/api/studentProfile.ts`
- `src/pages/StudentProfileDemo.jsx`
- npm script: `debug:student-profile`

## 验收方式

运行：

```bash
pnpm run debug:student-profile
pnpm run build
```

Demo 页面：

```text
/#/student-profile-demo
```

## 验收标准

PASS 条件：

1. 能生成学生能力画像。

   系统能够根据 Evidence 输出稳定 Student Ability Profile。

2. 能解释当前能力状态。

   不是简单输出“某能力弱”，而是说明该状态来自哪些 weakness / growth / positive evidence。

3. 能区分能力状态阶段。

   至少支持：

   - `weak`
   - `improving`
   - `stable_positive`
   - `insufficient_evidence`

4. 能关联 Evidence。

   每个能力判断必须包含 `evidence_links`。

5. 能生成下一步建议。

   输出：

   - `continue_training_focus`
   - `next_step_recommendation`

6. Debug Demo 可以稳定运行。

7. Demo 页面可以展示画像结果和证据来源。

## 当前验收结果

- 验收日期：2026-07-08
- 验收结果：PASS

## 当前通过依据

`pnpm run debug:student-profile` 结果：

```text
Current Weakness
primary: 表达
secondary: 推理

Ability Status
表达: weak
概括: stable_positive
推理: improving

Acceptance
[PASS] Student Ability Profile debug demo meets Phase 4.1 minimum loop acceptance.
```

`pnpm run build` 通过。

页面 Demo 已接入：

```text
/#/student-profile-demo
```

页面展示：

- 当前最需要训练的能力。
- 次级观察能力。
- 各能力状态。
- training / retest improvement signals。
- 下一步训练建议。
- evidence links。
- Stable JSON。

首页已增加入口：

```text
学生画像 Demo
```

## 关键解释

Phase 3 中推理能力已经产生 training / retest growth evidence，因此 Phase 4.1 的画像不再把推理固定为唯一当前弱点。

当前画像判断为：

- 表达：仍有 weakness evidence，因此当前状态为 `weak`，是下一步优先训练能力。
- 推理：过去存在 weakness evidence，但训练和复测已经产生 growth evidence，因此当前状态为 `improving`。
- 概括：当前有 positive evidence，因此状态为 `stable_positive`。

这说明系统已经开始根据新证据更新学生当前状态，而不是停留在旧诊断结果。

## 本阶段边界

- 不接数据库。
- 不做完整 UI。
- 仅提供 Demo 演示页。
- 不扩展题库。
- 不做完整学生系统。
- 不做长期成长曲线。
- 不证明学生长期能力已经稳定提升。
- 本阶段验证的是 `Evidence -> Student Ability Profile` 的画像生成闭环。
- 本阶段不验证 Evidence 是否来自真实 AI 诊断。
- 本阶段默认 Evidence 可以来自 mock、debug、training 或 retest 流程，只要符合 Ability Evidence Schema 即可被画像模块消费。
- 真实 AI 诊断生成的 Evidence 可信度验证属于 Phase 4.2。

## 与 Phase 4.2 的衔接

当前 `AbilityEvidence` Schema 已支持 Phase 4.2 的真实 AI 诊断证据输入：

```ts
{
  source: 'diagnosis',
  evidenceType: 'weakness' | 'positive' | 'growth' | 'insufficient',
  ability: string,
  observation: string,
  rootCause?: string,
  confidence: number,
  taskId?: string,
  diagnosisId?: string
}
```

因此 Phase 4.2 不需要重构 Student Ability Profile。Phase 4.2 只需要验证：

```text
Real AI Diagnosis Result
-> Ability Evidence
-> Student Ability Profile
```

是否能够在真实题目和学生答案下稳定运行。

## 下一阶段建议

Phase 4.2：

```text
真实题目 + 学生答案
-> Prompt Builder
-> Real AI Diagnosis
-> Diagnosis Result
-> Ability Evidence
-> Student Ability Profile
```

也就是验证真实 AI 是否能够生成可解释、可结构化、可沉淀为 Evidence 的诊断结果。
