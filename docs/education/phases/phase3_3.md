# Phase 3.3：训练执行与复测证据

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

## 核心链路

```text
Training Plan
-> Day 1 Task
-> Student Answer
-> Training Evidence
-> Retest
-> Retest Evidence
-> Ability Evidence Update
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
