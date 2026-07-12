# Phase 8.2.1：成长记忆记录最小闭环（Growth Memory Record Minimum Loop）

## 一、阶段目标

Phase 8.2.1 只解决一个问题：

```text
一次 EvaluationResult + ProfileUpdateDecision + Profile 前后状态，
能否生成一条可追溯的 GrowthMemoryRecord。
```

本阶段不保存到正式数据库。

本阶段不汇总历史趋势。

本阶段不重新评估 Evidence。

## 二、所属关系

Phase 8.2.1 属于 Phase 8.2 的第一个子模块。

完整 Phase 8.2 链路是：

```text
EvaluationResult
+ ProfileUpdateDecision
+ beforeProfile
+ afterProfile
-> GrowthMemoryRecord
-> GrowthMemoryStore
-> GrowthMemorySummary
```

本阶段只完成其中第一段：

```text
EvaluationResult
+ ProfileUpdateDecision
+ beforeProfile
+ afterProfile
-> GrowthMemoryRecord
```

## 三、输入

最小输入：

- `studentId`
- `abilityId`
- `EvaluationResult`
- `ProfileUpdateDecision`
- `beforeProfile`
- `afterProfile`

可选输入：

- `sourceRuntime`
- `createdAt`

## 四、输出

输出一条稳定结构的 `GrowthMemoryRecord`。

最小字段包括：

- `recordId`
- `studentId`
- `abilityId`
- `createdAt`
- `evaluationResultId`
- `profileUpdateDecisionId`
- `evidenceLinks`
- `action`
- `beforeProfileSummary`
- `afterProfileSummary`
- `reason`
- `limitations`
- `nextAction`
- `sourceRuntime`
- `relatedSessionId`

## 五、处理规则

`GrowthMemoryRecord` 只记录事实。

它可以记录：

- Evaluation 判断了什么；
- Decision 做出了什么更新动作；
- Evidence 链接有哪些；
- Profile 更新前是什么摘要；
- Profile 更新后是什么摘要；
- 本次记录有哪些限制；
- 下一步建议是什么。

它不允许：

- 重新判断 Evidence 是否充分；
- 重新生成 EvaluationResult；
- 修改 ProfileUpdateDecision；
- 修改 StudentAbilityProfile；
- 生成新的能力提升结论。

## 六、Profile 摘要边界

Phase 8.2.1 不保存完整 Profile。

`beforeProfileSummary` 和 `afterProfileSummary` 只需保存当前能力相关摘要。

建议包括：

- `abilityId`
- `abilityStatus`
- `confidence`
- `currentWeakness`
- `evidenceCount`
- `updatedAt`

`relatedSessionId` 是可选字段，用于把本条成长记忆记录关联到一次学习 Session。

它可以指向：

- `LearningSessionMemory`
- `BetaLearningSessionResult`
- 后续真实学习 Session

当前阶段不要求必须存在该字段，也不要求根据它查询历史。

## 七、验收标准

通过条件：

1. 能读取 `EvaluationResult`。
2. 能读取 `ProfileUpdateDecision`。
3. 能读取 Profile 更新前后状态。
4. 能生成唯一 `recordId`。
5. 能保留 `evaluationResultId`。
6. 能保留 `profileUpdateDecisionId`。
7. 能保留 `evidenceLinks`。
8. 能记录 `action`。
9. 能记录 before / after Profile 摘要差异。
10. 能在存在 `relatedSessionId` 时保留 Session 关联。
11. 不重新生成教育结论。

## 八、Debug Case

至少覆盖：

| Case | 输入 | 预期 |
| --- | --- | --- |
| append evidence only | `append_evidence_only` | before / after 状态相同，只记录证据追加 |
| request retest | `request_retest` | 记录下一步复测需求 |
| update confidence | `update_confidence` | 记录置信度变化 |
| update status | `update_status` | 记录 Profile 状态变化 |
| conflicting evidence | `mark_fluctuating` | 记录波动与限制，不输出能力提升 |

## 九、本阶段不包含

- 不实现 Store。
- 不实现 Summary。
- 不接数据库。
- 不查询历史记录。
- 不生成下一题。
- 不生成报告。
