# Phase 8.2：Growth Memory 最小闭环（Growth Memory Minimum Loop）

## 一、阶段目标

Phase 8.2 只解决一个核心问题：

```text
Phase 8.1 产生的 EvaluationResult、ProfileUpdateDecision 和画像变化，
能否被记录、查询、回放，并形成最小 Growth Memory Summary。
```

Phase 8.2 不是简单保存日志。

它要让系统以后能够回答：

- 这次画像为什么变化？
- 哪几条 Evidence 支撑了这次变化？
- 当时 Evaluation 判断了什么？
- 最终 ProfileUpdateDecision 是什么？
- Profile 前后到底改了哪里？
- 最近几次对同一能力的判断趋势是什么？
- 当前还有哪些待复测、波动或人工复核事项？

完成本阶段后，Phase 8.1 的结果才真正开始变成长期资产。

## 二、阶段背景

Phase 8.1 已经完成：

```text
AbilityEvidence[]
-> EvaluationResult
-> ProfileUpdateDecision
-> StudentAbilityProfile
```

但如果这些结果只存在于当前运行中，系统仍然无法形成长期成长记忆。

Phase 8.2 要补上记录层：

```text
EvaluationResult
+ ProfileUpdateDecision
+ beforeProfile
+ afterProfile
-> GrowthMemoryRecord
-> GrowthMemoryStore
-> GrowthMemorySummary
```

## 三、核心对象边界

### GrowthMemoryRecord

`GrowthMemoryRecord` 记录一次完整的“评估 -> 决策 -> 画像变化”事件。

它保存事实，不重新评估。

最小结构建议：

```ts
type GrowthMemoryRecord = {
  recordId: string;
  studentId: string;
  abilityId: string;
  createdAt: string;

  evaluationResultId: string;
  profileUpdateDecisionId: string;
  evidenceLinks: string[];

  action: ProfileUpdateAction;

  beforeProfileSummary: AbilityProfileSnapshot;
  afterProfileSummary: AbilityProfileSnapshot;

  reason: string;
  limitations: string[];
  nextAction?: string;

  sourceRuntime?: string;
  relatedSessionId?: string;
};
```

`beforeProfileSummary` 和 `afterProfileSummary` 不要求保存完整 Profile。

Phase 8.2 只保存当前能力相关摘要即可。

`relatedSessionId` 用于预留后续 Session 级成长记忆关联。

它可以指向：

- `LearningSessionMemory`
- `BetaLearningSessionResult`
- 后续真实学习 Session

### GrowthMemoryStore

`GrowthMemoryStore` 只负责：

- 保存记录；
- 按 `studentId` 查询；
- 按 `abilityId` 查询；
- 按时间排序；
- 根据 `recordId` 获取记录；
- 防止明显重复写入。

它不负责：

- 重新判断 Evidence；
- 重新生成 EvaluationResult；
- 修改 StudentAbilityProfile；
- 生成训练任务。

### GrowthMemorySummary

`GrowthMemorySummary` 是对历史记录的轻量汇总，不是新的长期 Evaluation。

最小结构建议：

```ts
type GrowthMemorySummary = {
  studentId: string;
  abilityId: string;

  recordCount: number;
  latestRecordId?: string;
  latestAction?: ProfileUpdateAction;

  recentActions: ProfileUpdateAction[];
  recentTrend:
    | 'insufficient_evidence'
    | 'continued_observation'
    | 'retest_pending'
    | 'fluctuating'
    | 'confidence_increasing'
    | 'status_improving'
    | 'mixed';

  pendingActions: string[];
  evidenceLinks: string[];
  limitations: string[];
  summary: string;
};
```

`recentTrend` 只总结最近决策轨迹。

`summary` 生成的是历史轨迹描述，不生成新的能力评价结论。

推荐：

```text
最近三次能力评估中，该能力主要处于持续观察状态，最近一次请求复测。
```

不推荐：

```text
学生推理能力已经明显提升。
```

它不应重新宣布：

- 能力已经稳定提升；
- 薄弱点已经解决；
- 训练已经长期有效。

## 四、最小功能拆分

Phase 8.2 拆成三个子闭环。

### Phase 8.2.1：Growth Memory Record

```text
EvaluationResult
+ ProfileUpdateDecision
+ beforeProfile
+ afterProfile
-> GrowthMemoryRecord
```

只验证一次 Evaluation / Decision / Profile 变化能否生成一条完整记录。

### Phase 8.2.2：Growth Memory Store

```text
GrowthMemoryRecord
-> GrowthMemoryStore
-> query result
```

只验证记录能否被保存、查询、隔离和排序。

### Phase 8.2.3：Growth Memory Summary

```text
GrowthMemoryRecord[]
-> GrowthMemorySummary
```

只验证多条历史记录能否形成最小成长记忆摘要。

## 五、最小验收案例

Phase 8.2 至少覆盖以下 Case：

| Case | 输入 | 预期 |
| --- | --- | --- |
| Case 1 | `append_evidence_only` | 保存记录；before / after 长期状态相同 |
| Case 2 | `request_retest` | Summary 显示 `retest_pending` |
| Case 3 | `mark_fluctuating` | Summary 显示 `fluctuating`，不输出 `improving` |
| Case 4 | 连续多次 `update_confidence` | Summary 显示 `confidence_increasing`，不自动提升长期 status |
| Case 5 | 一次 `update_status` | 记录 Profile 前后变化，保留 evidenceLinks |
| Case 6 | 不同 studentId / abilityId | 查询结果严格隔离 |

## 六、验收标准

Phase 8.2 通过条件：

1. 能生成 `GrowthMemoryRecord`。
2. 记录能追溯 `EvaluationResult`。
3. 记录能追溯 `ProfileUpdateDecision`。
4. 记录能追溯 `evidenceLinks`。
5. 记录能表达 Profile 前后差异。
6. 能保存并查询 Growth Memory Record。
7. 能按 `studentId` 隔离查询。
8. 能按 `abilityId` 隔离查询。
9. 能按时间排序。
10. 能生成 `GrowthMemorySummary`。
11. Summary 能识别待复测、波动、置信度增加或状态变化轨迹。
12. Summary 不重新生成新的能力提升结论。

## 七、当前验收结果

PASS

## 八、通过依据

已完成最小工程实现：

- `growthMemory.schema.ts`
- `growthMemoryRecordAgent.ts`
- `growthMemoryStore.ts`
- `growthMemorySummaryAgent.ts`
- `runPhase821GrowthMemoryRecordDebug.ts`
- `runPhase822GrowthMemoryStoreDebug.ts`
- `runPhase823GrowthMemorySummaryDebug.ts`
- `runPhase82Debug.ts`

已新增 npm script：

- `debug:phase8-2-1`
- `debug:phase8-2-2`
- `debug:phase8-2-3`
- `debug:phase8-2`

已执行：

```text
pnpm run debug:phase8-2-1
pnpm run debug:phase8-2-2
pnpm run debug:phase8-2-3
pnpm run debug:phase8-2
pnpm run build
```

结果：

- Debug 全部 PASS。
- Build PASS。
- `GrowthMemoryRecord` 可以记录 Evaluation、Decision、Evidence、Profile 前后摘要和 `relatedSessionId`。
- `GrowthMemoryStore` 可以保存、查询、隔离和处理重复 `recordId`。
- `GrowthMemorySummary` 可以输出最近决策轨迹，并明确不生成新的能力评价结论。

## 九、Demo 演示验收记录

Demo 入口：

```text
/#/phase82-growth-memory-demo
```

Demo 验收结果：

```text
PASS
```

验收时间：

```text
2026-07-12
```

Demo 已展示 5 类典型 Growth Memory 状态：

- 只追加证据
- 请求复测
- 表现波动
- 置信度增加
- 状态更新记录

通过依据：

- 页面能展示 `GrowthMemoryRecord -> GrowthMemoryStore -> GrowthMemorySummary`。
- 页面能展示 `EvaluationResult`、`ProfileUpdateDecision`、`evidenceLinks` 和 `relatedSessionId` 的可追溯关系。
- 页面能展示 Profile 前后摘要差异。
- 页面能展示 Store 的保存、查询和重复 recordId 幂等处理。
- 页面能展示 Summary 只描述历史轨迹，不生成新的能力评价结论。

验收边界：

本次 Demo 验收通过的是 Growth Memory 模块演示闭环。

它不是完整上游动态联动验收。

也就是说，本次 Demo 主要验证：

```text
不同 ProfileUpdateDecision action
-> GrowthMemoryRecord
-> Store
-> Summary
```

暂不验证：

```text
学生答案变化
-> AbilityEvidence 变化
-> EvaluationResult 变化
-> ProfileUpdateDecision 变化
-> GrowthMemory 变化
```

后续如需更严格验收，可增加“上游 Evidence 联动 Case”。

## 十、本阶段不包含

Phase 8.2 不做：

- 不接正式数据库。
- 不做多 Session 学习计划。
- 不做下一题生成。
- 不做 Stage Report。
- 不做家长报告。
- 不做成长曲线。
- 不接 LLM 自动总结。
- 不保存全量 Profile 快照。
- 不做复杂趋势算法。
- 不做历史数据迁移。

尤其不允许让 `GrowthMemorySummary` 重新承担 `EvaluationResult` 的职责。

它只总结：

```text
最近发生过哪些 Evaluation 和 ProfileUpdateDecision。
```

它不重新判断：

```text
学生现在到底提升了多少。
```

## 十一、完成后的产品能力

完成 Phase 8.2 后，系统可以宣称：

```text
评估结果、画像更新决策及其前后状态，
已经能够被长期记录、查询和回放，
并能形成最小成长记忆摘要。
```

但还不能宣称：

- 历史已经自动影响下一次学习；
- 已形成长期成长报告；
- 已证明能力持续提升；
- 已具备正式持久化能力。

## 十二、下一阶段

Phase 8.3 可以继续考虑：

```text
GrowthMemorySummary
+ StudentAbilityProfile
+ currentLearningContext
-> NextLearningStrategy
-> StrategyValidationResult
-> TaskRequest
```

也就是说，Phase 8.2 先保存和总结成长记忆。

Phase 8.3 再让成长记忆影响后续学习决策。

Phase 8.3 的重点不是生成具体题目，而是先形成经过校验的下一步学习策略：

```text
valid strategy -> TaskRequest
invalid strategy -> blocked / review / regenerate
```
