# Phase 8.2.3：成长记忆摘要最小闭环（Growth Memory Summary Minimum Loop）

## 一、阶段目标

Phase 8.2.3 只解决一个问题：

```text
多条 GrowthMemoryRecord 能否形成最小 GrowthMemorySummary。
```

本阶段不重新 Evaluation。

本阶段不修改 StudentAbilityProfile。

本阶段不生成下一题。

它只总结：

```text
最近发生过哪些 Evaluation 和 ProfileUpdateDecision。
```

## 二、所属关系

Phase 8.2.3 属于 Phase 8.2 的第三个子模块。

完整 Phase 8.2 链路是：

```text
GrowthMemoryRecord
-> GrowthMemoryStore
-> GrowthMemorySummary
```

本阶段只完成：

```text
GrowthMemoryRecord[]
-> GrowthMemorySummary
```

## 三、输入

最小输入：

- `studentId`
- `abilityId`
- `GrowthMemoryRecord[]`

记录应来自同一学生和同一能力。

如果输入包含不同学生或不同能力，应先由 Store 查询层隔离。

## 四、输出

输出一个 `GrowthMemorySummary`。

最小字段包括：

- `studentId`
- `abilityId`
- `recordCount`
- `latestRecordId`
- `latestAction`
- `recentActions`
- `recentTrend`
- `pendingActions`
- `evidenceLinks`
- `limitations`
- `summary`

## 五、recentTrend 规则

`recentTrend` 只总结最近决策轨迹。

建议最小枚举：

- `insufficient_evidence`
- `continued_observation`
- `retest_pending`
- `fluctuating`
- `confidence_increasing`
- `status_improving`
- `mixed`

判断边界：

- 多次 `request_retest` -> `retest_pending`
- 出现 `mark_fluctuating` -> `fluctuating`
- 连续 `update_confidence` -> `confidence_increasing`
- 单次 `update_status` -> `status_improving`
- 多类 action 混合且方向不一致 -> `mixed`
- 主要是 `append_evidence_only` -> `continued_observation`
- 记录不足或主要为证据不足 -> `insufficient_evidence`

## 六、Summary 边界

`GrowthMemorySummary.summary` 生成的是历史轨迹描述，不生成新的能力评价结论。

推荐：

```text
最近三次能力评估中，该能力主要处于持续观察状态，最近一次请求复测。
```

不推荐：

```text
学生推理能力已经明显提升。
```

`GrowthMemorySummary` 不允许输出：

- 能力已经稳定提升；
- 薄弱点已经解决；
- 训练已经长期有效；
- 学生已经掌握某项能力。

它可以输出：

- 最近几次决策显示需要复测；
- 最近几次记录显示仍在观察；
- 最近置信度在增加；
- 最近存在波动；
- 最近有一次状态更新；
- 证据仍有局限。

## 七、验收标准

通过条件：

1. 能读取多条 `GrowthMemoryRecord`。
2. 能识别最近一条记录。
3. 能统计 `recentActions`。
4. 能合并 `evidenceLinks`。
5. 能输出 `pendingActions`。
6. 能识别 `retest_pending`。
7. 能识别 `fluctuating`。
8. 能识别 `confidence_increasing`。
9. 能识别 `status_improving`。
10. 能输出 `limitations`。
11. 不重新生成长期能力提升结论。

## 八、Debug Case

至少覆盖：

| Case | 输入 | 预期 |
| --- | --- | --- |
| append only | 多条 `append_evidence_only` | `continued_observation` |
| retest pending | 包含 `request_retest` | `retest_pending` |
| fluctuating | 包含 `mark_fluctuating` | `fluctuating` |
| confidence increasing | 连续 `update_confidence` | `confidence_increasing` |
| status update | 包含 `update_status` | `status_improving`，但不宣布稳定提升 |
| mixed | action 方向不一致 | `mixed` |

## 九、本阶段不包含

- 不重新运行 Evaluation。
- 不更新 Profile。
- 不生成下一题。
- 不生成家长报告。
- 不生成成长曲线。
- 不调用 LLM 自动总结。
- 不证明真实长期能力提升。
