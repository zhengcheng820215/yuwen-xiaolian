# Phase 3.2：阶段训练计划生成

## 阶段目标

基于 Phase 3.1 生成的 Ability Evidence Summary / Top Weakness，生成一个 3 天阶段训练计划。

本阶段重点不是让学生真实训练，而是验证：

Top Weakness 是否能够转化为结构化训练计划。

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
- training_goal
- reason_from_evidence
- focus_skills
- tasks
- success_criteria
- evidence_links

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

## 当前验收结果

PASS

## 通过依据

- Debug 能根据 Top Weakness 生成 3 天训练计划。
- 当前优先训练能力为：推理。
- 训练原因来自 Phase 3.1 的 weakness evidence。
- 每一天都有 `reason_from_evidence` 和 `evidence_links`。
- build 通过。

## 本阶段不包含

- 不接入真实题库。
- 不接入数据库。
- 不做完整 UI。
- 不验证真实学生是否提升。
- 不做训练执行流程。

## 下一阶段

进入 Phase 3.3：

让学生按训练计划完成一天训练，并产生新的 training evidence / retest evidence。
