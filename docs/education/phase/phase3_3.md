# Phase 3.3：训练执行与复测证据（Training Execution and Retest Evidence）

## 阶段目标

让学生按照 Phase 3.2 生成的训练计划完成一天训练，并产生新的 training evidence / retest evidence。

本阶段重点不是长期提升，而是验证：

Training Plan 是否能够进入执行，并把训练结果重新沉淀为 Ability Evidence。

## 输入

- Training Plan
- Day 1 Training Task
- Student Answer
- 原始 evidence_links

## 输出

- Training Evidence
- Retest Evidence
- Updated Ability Evidence Summary
- Ability Change

## 核心链路

```text
Training Plan
-> Day 1 Task
-> Student Answer
-> Training Evidence
-> Retest
-> Retest Evidence
-> Ability Evidence Update
-> Ability Change
```

## Training Evidence Model

Training Evidence 描述学生在训练过程中的表现证据。

它不是长期能力掌握结论，只表示学生在当前训练任务中表现出了某项能力相关行为。

示例：

```ts
{
  studentId: "demo",
  ability: "推理",
  evidenceType: "growth",
  source: "training",
  trainingId: "TP001",
  targetSkill: "文本依据提取",
  observation: "学生能够根据文本找到支持结论的关键句",
  confidence: 0.82
}
```

使用原则：

- Training Evidence 来源于训练环境。
- Training Evidence 可以说明学生在训练任务中出现改善信号。
- Training Evidence 不能直接证明学生已经掌握该能力。
- Training Evidence 需要等待 Retest Evidence 进行迁移验证。

## Retest Evidence Model

Retest Evidence 描述学生在复测或迁移任务中的表现证据。

它比 Training Evidence 更能说明能力是否开始迁移，因为复测任务应尽量脱离刚训练过的原题环境。

示例：

```ts
{
  ability: "推理",
  source: "retest",
  targetSkill: "证据到结论",
  transferLevel: "partial",
  observation: "学生能够在新文本中完成简单推理，但复杂推断仍不足",
  confidence: 0.75
}
```

`transferLevel` 取值：

| transferLevel | 说明 |
| --- | --- |
| `none` | 未能迁移到新任务 |
| `partial` | 能迁移部分步骤，但不稳定或不完整 |
| `successful` | 能在新任务中较完整使用目标能力 |

使用原则：

- Training Evidence = 训练环境表现。
- Retest Evidence = 迁移验证表现。
- 如果只有 Training Evidence，没有 Retest Evidence，只能形成 improvement signal，不能形成稳定提升结论。
- Retest Evidence 权重高于 Training Evidence。

## Ability Evidence Update Rules

训练和复测产生的新证据需要合并回 Ability Evidence Summary，但不能简单覆盖历史证据。

最小更新规则：

| Evidence Source | 建议权重 | 说明 |
| --- | --- | --- |
| `training` | 0.5 | 训练环境中的表现，容易受刚练过的任务影响 |
| `retest` | 1.0 | 迁移验证表现，更能说明能力是否开始稳定 |

注意：

- 一次 Training Evidence 的 positive / growth 不应直接升级能力。
- 一次 Retest Evidence 的 positive / growth 也只能形成成长信号，不能直接证明长期掌握。
- 多次 retest 中稳定出现 growth / positive，才能支持后续能力升级。
- 历史 weakness 不能被单条新证据覆盖，只能被更多新证据逐步稀释。

示例输出：

```ts
{
  ability: "推理",
  previousStatus: "weak",
  currentSignal: "improving",
  evidenceChange: {
    weakness: -1,
    positive: +2
  }
}
```

## Ability Change Model

Ability Change 描述一次训练与复测闭环后，某项能力是否出现变化信号。

它不是最终能力等级。

最小结构：

```ts
type AbilityChange = {
  ability: string;

  before: {
    weaknessCount: number;
    positiveCount: number;
    growthCount: number;
  };

  after: {
    weaknessCount: number;
    positiveCount: number;
    growthCount: number;
  };

  change:
    | "improved"
    | "unchanged"
    | "declined"
    | "insufficient_data";

  reason: string;
};
```

示例：

```ts
{
  ability: "推理",
  before: {
    weaknessCount: 5,
    positiveCount: 0,
    growthCount: 0
  },
  after: {
    weaknessCount: 5,
    positiveCount: 0,
    growthCount: 2
  },
  change: "improved",
  reason: "训练任务中表现改善，且复测中出现迁移迹象，但仍需要更多复测证据确认稳定提升。"
}
```

本阶段应明确：

```text
training evidence
≠
能力掌握

retest evidence
=
迁移验证信号

ability change
=
能力变化信号，不是长期能力结论
```

## 建议新增内容

建议概念命名：

- `trainingExecution.schema.ts`
- `trainingExecutionAgent.ts`
- `retestEvidence.schema.ts`
- `retestAgent.ts`
- `runTrainingExecutionDebug.ts`
- npm script: `debug:training-execution`

当前最小实现命名：

- `src/ai/schemas/trainingEvaluation.schema.ts`
- `src/ai/agents/trainingEvaluationAgent.ts`
- `src/ai/tests/runTrainingEvidenceDebug.ts`
- npm script: `debug:training-evidence`

说明：

当前代码实现先采用 `trainingEvaluation` 命名，覆盖训练回答评估、复测评估和 evidence 回流。后续如果训练执行流程变复杂，再拆分为 `trainingExecution` 和 `retest` 模块。

## 验收标准

1. 能基于 Phase 3.2 的 Day 1 训练任务结构进行模拟执行。
2. 能模拟学生完成训练任务。
3. 能分析学生训练答案。
4. 能生成 training evidence。
5. 能生成 retest evidence。
6. 能判断原薄弱点是否有改善迹象。
7. 能把新的 evidence 合并回 Ability Evidence Summary。
8. 能区分 Training Evidence 与 Retest Evidence。
9. Retest Evidence 必须包含 `transferLevel`。
10. 能输出 Ability Change，并明确它只是变化信号，不是长期能力结论。

## 本阶段不包含

- 不证明学生长期能力已经提升。
- 不做完整课程体系。
- 不做复杂题库。
- 不做家长端。
- 不做长期成长曲线。

## 通过标准

运行 debug 后，系统能够证明：

训练计划不是静态建议，而是可以被执行、被评估、被重新沉淀为能力证据。

## 当前验收结果

PASS

## 当前通过依据

- `pnpm run debug:training-evidence` 通过。
- Debug 能模拟 Day 1 训练任务和学生训练回答。
- Debug 能生成 `source='training'` 的 Ability Evidence。
- Debug 能模拟 retest answer 并生成 `source='retest'` 的 Ability Evidence。
- Debug 能把新增 evidence 合并回 updated Ability Evidence。
- Debug 能输出训练前后对比和 `abilityChange`。
- Debug 能输出 `transferLevel` 和语义化 Ability Change。
- `pnpm run build` 通过。

## Demo 状态

当前 Phase 3.3 已接入页面 Demo：

```text
/#/training-evidence-demo
```

页面展示训练任务、训练回答、training evidence、复测回答、retest evidence 和 updated Ability Evidence Summary。

## 正式验收记录

- 验收日期：2026-07-08
- 验收结果：PASS

## 验收方式

```bash
pnpm run debug:training-evidence
pnpm run build
```

Demo 页面：

```text
/#/training-evidence-demo
```

## Demo 验收通过依据

1. 能读取 Phase 3.2 的 Day 1 训练任务。
2. 能模拟学生完成训练任务并提交训练答案。
3. 能分析训练答案，生成 training evidence。
4. 能生成 retest question / retest answer 的复测证据。
5. 能判断原薄弱点是否出现改善迹象。
6. 能把 training evidence 和 retest evidence 合并回 Ability Evidence Summary。
7. Demo 页面能展示训练任务、训练答案、复测答案、证据更新和 Stable JSON。

## 验收边界

本阶段验收的是产品最小闭环已经跑通：

```text
Training Plan
-> Training Execution
-> Training Evidence
-> Retest Evidence
-> Ability Evidence Update
```

本阶段不证明学生已经形成长期稳定提升，长期提升需要后续持续数据和多轮训练验证。

