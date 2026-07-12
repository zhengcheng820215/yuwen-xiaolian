# Phase 8.2.2：成长记忆存储最小闭环（Growth Memory Store Minimum Loop）

## 一、阶段目标

Phase 8.2.2 只解决一个问题：

```text
GrowthMemoryRecord 能否被保存、查询、隔离和按时间排序。
```

本阶段不做正式数据库。

本阶段可以先使用 memory store、mock store 或 local JSON 方式跑通。

## 二、所属关系

Phase 8.2.2 属于 Phase 8.2 的第二个子模块。

完整 Phase 8.2 链路是：

```text
GrowthMemoryRecord
-> GrowthMemoryStore
-> GrowthMemorySummary
```

本阶段只完成：

```text
GrowthMemoryRecord
-> GrowthMemoryStore
-> query result
```

## 三、输入

最小输入：

- `GrowthMemoryRecord`

查询输入：

- `recordId`
- `studentId`
- `abilityId`
- `limit`
- `sortOrder`

## 四、输出

最小输出：

- 保存后的 `GrowthMemoryRecord`
- 按 `recordId` 查询结果
- 按 `studentId` 查询结果
- 按 `studentId + abilityId` 查询结果
- 按时间排序后的记录列表

## 五、Store 职责

`GrowthMemoryStore` 负责：

- 保存记录；
- 根据 `recordId` 获取记录；
- 根据 `studentId` 查询记录；
- 根据 `abilityId` 查询记录；
- 根据 `studentId + abilityId` 查询记录；
- 按 `createdAt` 排序；
- 防止明显重复写入。

`GrowthMemoryStore` 不负责：

- 重新判断 Evidence；
- 重新生成 EvaluationResult；
- 重新生成 ProfileUpdateDecision；
- 修改 StudentAbilityProfile；
- 生成训练任务；
- 总结长期趋势。

## 六、幂等与重复处理

Phase 8.2.2 最小要求：

```text
相同 recordId 重复写入时，
Store 应拒绝重复写入或返回已有记录。
```

当前阶段不要求实现复杂冲突合并。

## 七、验收标准

通过条件：

1. 能保存一条 `GrowthMemoryRecord`。
2. 能按 `recordId` 获取记录。
3. 能按 `studentId` 查询记录。
4. 能按 `abilityId` 查询记录。
5. 能按 `studentId + abilityId` 查询记录。
6. 查询结果能按 `createdAt` 排序。
7. 不同学生记录不会串。
8. 不同能力记录不会串。
9. 重复 `recordId` 能拒绝或幂等处理。
10. Store 不重新生成教育判断。

## 八、Debug Case

至少覆盖：

| Case | 输入 | 预期 |
| --- | --- | --- |
| single record | 1 条记录 | 能保存并查询 |
| same student multiple abilities | 同一学生多能力记录 | 能按 abilityId 隔离 |
| multiple students | 多个 studentId | 查询结果不串 |
| sort by time | 多条不同 createdAt | 按时间排序 |
| duplicate recordId | 重复写入 | 拒绝或返回已有记录 |

## 九、本阶段不包含

- 不接正式数据库。
- 不做数据迁移。
- 不做权限系统。
- 不做成长报告。
- 不做 Summary。
- 不影响下一题生成。

