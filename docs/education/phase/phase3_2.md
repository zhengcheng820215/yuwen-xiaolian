# Phase 3.2：阶段训练计划生成（Training Plan Generation）

## 阶段目标

基于 Ability Evidence 和 Weakness Ranking，将学生当前主要能力缺口转换为结构化阶段训练目标，并生成短周期训练计划。

本阶段重点不是让学生真实训练，而是验证：

```text
Evidence
↓
Training Target
↓
Training Plan
```

是否成立。

## 训练计划生成链路

Phase 3.2 的训练计划生成链路为：

```text
Ability Evidence Summary
↓
Weakness Ranking
↓
Training Target Extractor
↓
Training Strategy Selector
↓
Training Plan Generator
↓
3 Day Training Plan
```

本阶段不直接从“能力名称”生成训练计划，而是先从 Evidence 中抽取具体训练目标，再选择训练策略。

例如：

```ts
{
  ability: "推理",
  weakness_reason: [
    "文本依据不足",
    "推理链不完整"
  ],
  trainingTarget: {
    skill: "证据到结论转换",
    level: "基础"
  }
}
```

能力需要继续拆到可训练技能层。例如：

```text
推理能力
├── 找证据
├── 建立关系
├── 得出结论
└── 验证合理性
```

训练计划不应只写“训练推理能力”，而应明确当前训练落在哪一个技能点上。

## Training Strategy Rules

训练策略必须来自 Ability Evidence 中的结构化原因或 rootCause，而不是凭空生成。

| Ability Gap / Reason | Training Strategy |
| --- | --- |
| `missing_skill` | 基础能力建立 |
| `incomplete_understanding` | 增加理解深度 |
| `reasoning_error` | 纠正推理链 |
| `expression_issue` | 答案组织训练 |
| `knowledge_gap` | 知识补充 |
| `unstable_performance` | 重复验证训练 |

因此，Phase 3.2 的职责不是简单“生成一个计划”，而是：

1. 判断当前主要能力缺口。
2. 抽取具体训练技能。
3. 根据薄弱原因选择训练策略。
4. 生成短周期、可验收的训练安排。

## 输入

- Ability Evidence Summary
- Top Weakness
- weakness evidence
- confidence
- evidence_links

## 输出

一份 3 天训练计划。

每一天至少包含：

- day
- target_ability
- targetSkill
- strategy
- training_goal
- reason_from_evidence
- focus_skills
- tasks
- success_criteria
- evidence_links

最小结构：

```ts
type TrainingPlanDay = {
  day: number;
  target_ability: string;
  targetSkill: string;
  strategy: string;
  training_goal: string;
  reason_from_evidence: string;
  focus_skills: string[];
  tasks: string[];
  success_criteria: string[];
  successCriteria: {
    measurable: boolean;
    description: string;
  };
  evidence_links: TrainingPlanEvidenceLink[];
};
```

其中：

- `target_ability` 表示训练所属能力。
- `targetSkill` 表示本次具体训练技能。
- `strategy` 表示为什么采用这种训练方式。
- `reason_from_evidence` 必须能追溯到 Phase 3.1 的 Evidence。
- `successCriteria` 必须可观察、可复核。

后续阶段可以将 `tasks` 从字符串数组升级为结构化任务对象：

```ts
{
  type: string;
  instruction: string;
  difficulty: string;
}
```

Phase 3.2 当前先保持字符串任务，以保证既有 Demo 和 Debug 稳定。

## 3 天计划生成规则

3 天计划不是简单重复练习，而是按照“建立 → 强化 → 迁移”的短周期训练节奏生成：

```text
Day 1 建立能力
↓
Day 2 强化能力
↓
Day 3 迁移验证
```

例如针对“推理”：

| Day | 阶段 | 目标 |
| --- | --- | --- |
| Day 1 | 建立能力 | 找到文本依据，理解推理需要从证据出发 |
| Day 2 | 强化能力 | 完成“证据 -> 关系 -> 结论”的推理链 |
| Day 3 | 迁移验证 | 换一篇文本完成同类推理任务 |

## 新增内容

- `src/ai/schemas/trainingPlan.schema.ts`
- `src/ai/agents/trainingPlanAgent.ts`
- `src/ai/tests/runTrainingPlanDebug.ts`
- npm script: `debug:training-plan`

## 验收方式

运行：

```bash
pnpm run debug:training-plan
```

同时执行：

```bash
pnpm run build
```

## 验收标准

通过条件：

1. 能识别当前优先训练能力。
2. 能说明为什么训练该能力。
3. 能生成 3 天阶段训练计划。
4. 每一天都有明确训练目标。
5. 每一天都有 `success_criteria`。
6. 训练计划能关联 `evidence_links`。
7. 不复用旧的单题 `trainingAgent` 作为核心。
8. 每个训练计划日必须有明确 `targetSkill`。
9. 每个训练计划日必须有 `strategy`。
10. `strategy` 必须来源于 weakness reason 或 rootCause。
11. `tasks` 不能只引用 ability，必须对应具体技能。

## 当前验收结果

PASS

## 通过依据

- Debug 能根据 Top Weakness 生成 3 天训练计划。
- 当前优先训练能力为：推理。
- 训练原因来自 Phase 3.1 的 weakness evidence。
- 每一天都有 `reason_from_evidence` 和 `evidence_links`。
- build 通过。

## Demo 状态

当前 Phase 3.2 已接入最小 Demo 演示页：

```text
/#/training-plan-demo
```

Demo 页面用于展示：

- 当前 Top Weakness。
- 3 天阶段训练计划。
- 每天的 `reason_from_evidence`。
- 每天的 `success_criteria`。
- 与 Phase 3.1 evidence 的关联。
- Stable JSON 输出。

该 Demo 仅用于阶段验收，不代表正式训练产品 UI。

## 本阶段不包含

- 不接入真实题库。
- 不接入数据库。
- 不做完整 UI。
- 不验证真实学生是否提升。
- 不做训练执行流程。

## 下一阶段

进入 Phase 3.3：

让学生按训练计划完成一天训练，并产生新的 training evidence / retest evidence。

