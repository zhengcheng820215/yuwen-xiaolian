# Phase 4.1：学生能力画像最小版本（Student Ability Profile）

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

## Ability Status Decision Rules

Student Ability Profile 不直接根据单条 Evidence 判断能力状态，而是基于同一 `ability` 下的多条 evidence 进行综合判断。

能力状态至少支持：

- `weak`
- `improving`
- `stable_positive`
- `insufficient_evidence`

### weak

当某能力存在多条 weakness evidence，且近期缺少 training / retest 的 positive 或 growth evidence 时，状态为 `weak`。

典型条件：

- `weaknessCount` 较高。
- weakness evidence 置信度较高。
- 最近 evidence 仍为 weakness。
- 缺少 retest positive / growth evidence。

### improving

当某能力过去存在 weakness evidence，但近期出现 training 或 retest 来源的 growth / positive evidence 时，状态为 `improving`。

典型条件：

- history 中存在 weakness。
- recent evidence 中出现 growth 或 positive。
- retest evidence 优先级高于 training evidence。
- positive / growth 数量仍不足以判断为 `stable_positive`。

### stable_positive

当某能力持续出现 positive evidence，且近期没有明显 weakness evidence 时，状态为 `stable_positive`。

典型条件：

- `positiveCount` 较高。
- recent evidence 以 positive 为主。
- 没有高置信度 weakness。
- retest positive 优先于 training positive。

### insufficient_evidence

当某能力 evidence 数量不足，或主要证据为 insufficient 时，状态为 `insufficient_evidence`。

注意：

`insufficient` evidence 不能推导为 `weak`，也不能推导为 `stable_positive`。

## Evidence Source Weight Rules

不同来源的 Evidence 对 Student Ability Profile 的影响权重不同。

建议优先级：

1. retest evidence
2. diagnosis evidence
3. training evidence
4. insufficient evidence

说明：

- retest evidence 代表迁移验证，优先级最高。
- diagnosis evidence 代表真实题目表现，是判断当前问题的重要依据。
- training evidence 代表训练环境表现，能提供改善迹象，但不能单独证明稳定掌握。
- insufficient evidence 只说明证据不足，不参与强弱判断。

## Current Weakness Selection Rules

`current_weakness` 不等于历史 `weaknessCount` 最高的能力。

系统应综合考虑：

1. 当前 `ability_status` 是否为 `weak`。
2. weakness evidence 数量。
3. weakness evidence 平均置信度。
4. 最近一次 evidence 是否仍为 weakness。
5. 是否已有 training / retest growth evidence。
6. 是否缺少 stable positive evidence。

如果某能力已有明确 `improvement_signal`，则不应继续固定为 primary weakness，除非近期 retest 再次失败。

## 关于 growth evidenceType

`growth` 表示学生相较于原 weakness 出现改善迹象。

`growth` 不等于 `stable_positive`。

growth 通常来自：

- training evidence
- retest evidence
- 同一 targetSkill 的后续表现改善

growth 用于支持：

```text
ability_status = improving
```

Evidence 类型含义：

| 类型 | 含义 |
| --- | --- |
| `positive` | 本次表现达到要求 |
| `growth` | 相对原薄弱点出现改善迹象 |
| `weakness` | 暴露薄弱表现 |
| `insufficient` | 证据不足 |

## Student Ability Profile Conceptual Schema

Phase 4.1 的目标模型如下：

```ts
type StudentAbilityProfile = {
  studentId: string;

  generatedAt: string;

  currentWeakness: {
    primary?: string;
    secondary?: string[];
    reason: string;
    evidenceLinks: string[];
  };

  abilityStatus: {
    ability: string;
    status:
      | "weak"
      | "improving"
      | "stable_positive"
      | "insufficient_evidence";
    summary: string;
    evidenceLinks: string[];
  }[];

  improvementSignals: {
    ability: string;
    signal: string;
    source: "training" | "retest" | "diagnosis";
    evidenceLinks: string[];
  }[];

  continueTrainingFocus: {
    ability: string;
    targetSkill?: string;
    reason: string;
  }[];

  nextStepRecommendation: {
    type:
      | "continue_training"
      | "retest"
      | "switch_focus"
      | "collect_more_evidence";
    description: string;
    reason: string;
  };
};
```

当前 Runtime 实现仍保留 snake_case 输出，例如：

- `current_weakness`
- `ability_status`
- `continue_training_focus`
- `next_step_recommendation`

这是为了保持已验收 Demo 和 Phase 4.2 / Phase 5.1 链路兼容。

后续如需升级为正式产品 API，可将上述 Conceptual Schema 作为迁移目标。

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

## 与长期协议的关系

本阶段记录的是 Phase 4.1 当时已验收的最小实现。

当前实现中，Student Ability Profile 可以基于 Evidence Summary / Top Weakness 生成画像。

长期标准协议应收敛为：

```text
AbilityEvidence
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

因此，Phase 4.1 的 PASS 结论仍然有效，但不代表单条 Evidence 可以直接确认长期能力状态变化。

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
