# Phase 12.1：学习回合持久化与恢复最小闭环（Learning Round Persistence）

## 一、阶段目标

Phase 12.1 只解决一个核心问题：

```text
学生完成的一轮学习，刷新或重新进入后还能不能恢复？
```

Phase 12.1 的一句话定义：

```text
将 LearningRound、学生作答、反馈、结束摘要和 GrowthMemory 相关结果保存为结构化记录，并能在重新进入时恢复当前学习状态。
```

## 二、阶段背景

Phase 11 已经完成学生端一轮最小体验：

```text
进入任务
↓
作答提交
↓
学生可读反馈
↓
本轮结束页
```

但 Phase 11 的结果仍主要存在于当前页面生命周期中。

一旦刷新页面或关闭浏览器，本轮学习结果就可能丢失。

Phase 12.1 的目标不是做完整数据库。

Phase 12.1 的目标是建立最小持久化契约：

```text
正式 Runtime 数据可以保存；
重新进入后可以恢复；
保存的数据可以继续驱动下一步 Runtime。
```

## 三、核心链路

Phase 12.1 的最小链路：

```text
LearningRoundResult
+
StudentResponse
+
StudentLearningFeedback
+
StudentRoundSummary
+
GrowthMemoryRecord / GrowthMemorySummary
↓
LearningPersistenceRecord
↓
Local Persistence Store
↓
Reload / Re-enter
↓
RestoredLearningState
```

Phase 12.1 证明：

```text
学生完成的学习不再只存在于当前页面状态中。
```

## 四、输入

Phase 12.1 输入：

```text
studentId
LearningRoundResult
StudentResponse
StudentLearningFeedback
StudentRoundSummary
GrowthMemoryRecord?
GrowthMemorySummary?
StudentAbilityProfile?
```

说明：

- `LearningRoundResult` 是本轮流程结果；
- `StudentResponse` 是学生真实作答；
- `StudentLearningFeedback` 是学生可读反馈；
- `StudentRoundSummary` 是本轮结束页摘要；
- `GrowthMemoryRecord / GrowthMemorySummary` 是后续持续学习的重要输入；
- `StudentAbilityProfile` 用于恢复下一轮学习起点。

## 五、输出

Phase 12.1 输出两个对象：

```text
LearningPersistenceRecord
RestoredLearningState
```

建议最小结构：

```ts
type LearningPersistenceStatus =
  | 'saved'
  | 'restore_ready'
  | 'restore_failed'
  | 'invalid';

type LearningPersistenceRecord = {
  recordId: string;
  studentId: string;
  learningRoundId: string;

  savedAt: string;
  updatedAt: string;
  version: 'phase12_1_v1';
  schemaVersion: 'learning_persistence_v1';
  sourceVersion?: string;

  learningRoundResult: unknown;
  studentResponse?: unknown;
  studentLearningFeedback?: unknown;
  studentRoundSummary?: unknown;

  growthMemoryRecord?: unknown;
  growthMemorySummary?: unknown;
  studentAbilityProfile?: unknown;

  status: LearningPersistenceStatus;
  issues: string[];
};

type RestoredLearningState = {
  studentId: string;
  learningRoundId: string;

  canResume: boolean;
  resumeMode:
    | 'continue_unfinished_round'
    | 'view_completed_round'
    | 'start_next_round'
    | 'cannot_restore';

  restoredRecord?: LearningPersistenceRecord;

  studentVisibleState: {
    title: string;
    message: string;
    primaryActionText: string;
  };

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

说明：

- `LearningPersistenceRecord` 是保存对象；
- `RestoredLearningState` 是恢复后供页面消费的对象；
- 第一版可以使用 `unknown` 承载已有 Runtime 对象，但必须保留对象边界；
- 后续可逐步替换为严格类型。
- `version` 表示 Phase 12.1 持久化协议版本；
- `schemaVersion` 表示记录结构版本；
- 版本不兼容时必须阻断恢复，不得静默读取旧字段。

## 六、保存原则

Phase 12.1 只保存 Runtime 正式数据和恢复所需的最小展示状态。

允许保存：

- `studentId`；
- `learningRoundId`；
- `LearningRoundResult`；
- `StudentResponse`；
- `StudentLearningFeedback`；
- `StudentRoundSummary`；
- `GrowthMemoryRecord`；
- `GrowthMemorySummary`；
- `StudentAbilityProfile`；
- 版本号；
- 保存时间；
- 恢复状态。

不允许保存：

- 整个 React state；
- 未清洗的临时页面状态；
- Prompt 全文；
- 模型原始输出；
- 开发者 Debug JSON 作为正式记录；
- 无效作答推导出的能力结论；
- 与当前 studentId 不一致的数据。

## 七、恢复原则

恢复时必须先校验：

1. `recordId` 是否存在；
2. `studentId` 是否一致；
3. `learningRoundId` 是否一致；
4. `version` 是否受支持；
5. `LearningRoundResult` 是否存在；
6. `StudentRoundSummary` 是否存在；
7. 已完成回合是否有可展示摘要；
8. 未完成回合是否有可继续作答的任务；
9. GrowthMemory 相关数据是否可作为下一轮输入。

如果校验失败：

```text
canResume = false
resumeMode = cannot_restore
```

不得展示混合结果，不得把其他学生或其他回合的数据恢复到当前页面。

### 幂等性规则

恢复不得导致 Runtime 重复执行。

同一：

```text
learningRoundId
responseId
taskExecutionResultId
taskEvidenceReturnResultId
GrowthMemoryRecordId
```

不得因为页面刷新或重新进入而重复：

- 提交学生答案；
- 调用 Diagnosis Runtime；
- 生成 AbilityEvidence；
- 更新 StudentAbilityProfile；
- 写入 GrowthMemoryRecord。

任务已提交不等于可以重新提交。

恢复完成页不等于重新运行诊断。

如果提交过程中刷新，应查询已有执行状态，而不是创建新的执行结果。

## 八、恢复模式

Phase 12.1 至少支持四种恢复模式。

### continue_unfinished_round

适用：

```text
学生已经进入任务，但尚未完成本轮。
```

页面应恢复：

- 当前任务；
- 答案草稿；
- 可继续作答状态。

### view_completed_round

适用：

```text
本轮已经完成，存在 StudentRoundSummary。
```

页面应恢复：

- 本轮结束页；
- 学生可读摘要；
- 下一步入口文案。

### start_next_round

适用：

```text
本轮已经完成，并且 GrowthMemory / Profile 可以作为下一轮输入。
```

页面可以提示：

```text
可以开始下一轮学习。
```

但 Phase 12.1 不真正启动下一轮。

### cannot_restore

适用：

```text
保存数据缺失、不一致或版本不支持。
```

页面应提示：

```text
暂时无法恢复，请重新开始。
```

## 九、本地持久化边界

Phase 12.1 第一版可以使用本地持久化。

推荐：

- `localStorage` 只保存少量入口和恢复指针；
- `IndexedDB` 保存正式结构化学习数据；
- 轻量 Storage Adapter。

第一版不要求：

- 云端数据库；
- 登录账号；
- 多设备同步；
- 服务端 API；
- 数据迁移系统。

但必须通过 Adapter 隔离存储实现。

业务代码不应直接散落调用：

```text
localStorage
indexedDB
```

建议新增：

```text
LearningPersistenceRepository
```

职责：

```text
save(record)
load(studentId)
clear(studentId)
```

第一版可由 `IndexedDBLearningPersistenceAdapter` 实现。

如果暂时使用内存 Store 做 Debug，也必须保留 Repository 接口形态。

## 十、最小 Debug 流程

Phase 12.1 Debug 最小流程：

1. 创建 mock studentId；
2. 创建 mock LearningRoundResult；
3. 创建 mock StudentResponse；
4. 创建 mock StudentLearningFeedback；
5. 创建 mock StudentRoundSummary；
6. 创建 mock GrowthMemorySummary；
7. 生成 LearningPersistenceRecord；
8. 保存到本地测试 Store；
9. 重新读取；
10. 生成 RestoredLearningState；
11. 校验恢复结果；
12. 输出 PASS / FAIL。

## 十一、Debug Case

Phase 12.1 Debug 至少覆盖以下样例：

| Case | 输入 | 预期 |
| --- | --- | --- |
| 已完成回合保存 | 完整 LearningRoundResult + StudentRoundSummary | save 成功 |
| 刷新后恢复完成页 | 已保存 completed round | `resumeMode = view_completed_round` |
| 任务页刷新 | 任务已加载，学生尚未作答 | 恢复同一个 learningRoundId，不启动新回合 |
| 答案草稿恢复 | 学生已输入但未提交 | 恢复答案草稿和任务上下文，草稿不等于正式 StudentResponse |
| 未完成回合恢复 | 有任务和答案草稿，但无 LearningRoundResult completed | `resumeMode = continue_unfinished_round` |
| 可进入下一轮 | completed + GrowthMemorySummary | `resumeMode = start_next_round` |
| 已完成回合恢复 | completed round + StudentRoundSummary | 恢复结束页，不重新运行 Diagnosis，不重复生成 Evidence |
| 提交过程中刷新 | 存在提交状态但回流未完成 | 查询已有执行状态，不重复提交或重复回流 |
| studentId 不一致 | record.studentId 与当前 studentId 不一致 | `canResume = false` |
| learningRoundId 不一致 | 保存对象内部 ID 不一致 | `canResume = false` |
| 缺少 StudentRoundSummary | completed round 无结束摘要 | `restore_failed` |
| 版本不支持 | version 非当前版本 | `cannot_restore` |
| 数据损坏 | 读取失败或关键对象缺失 | 不拼装残缺状态，记录失败原因 |
| 清除记录 | clear(studentId) 后读取 | 不再恢复旧状态 |

## 十二、Debug Report

Debug Report 至少展示：

- studentId；
- learningRoundId；
- recordId；
- savedAt；
- updatedAt；
- schemaVersion；
- status；
- resumeMode；
- canResume；
- hasLearningRoundResult；
- hasStudentLearningFeedback；
- hasStudentRoundSummary；
- hasGrowthMemorySummary；
- validation issues；
- PASS / FAIL。

## 十三、验收标准

Phase 12.1 通过条件：

1. 已定义 `LearningPersistenceRecord`；
2. 已定义 `RestoredLearningState`；
3. 能保存 completed LearningRound；
4. 能保存 StudentResponse；
5. 能保存 StudentLearningFeedback；
6. 能保存 StudentRoundSummary；
7. 能保存 GrowthMemory 相关结果；
8. 能重新读取保存记录；
9. 能生成 RestoredLearningState；
10. 能识别 `view_completed_round`；
11. 能识别 `continue_unfinished_round`；
12. 能识别 `start_next_round`；
13. 能识别 `cannot_restore`；
14. studentId 不一致时阻断恢复；
15. learningRoundId 不一致时阻断恢复；
16. 不直接保存整个 React state；
17. localStorage 只用于少量恢复指针；
18. 正式学习记录通过 Repository 保存；
19. 版本不兼容时阻断恢复；
20. 已完成回合恢复时不重新运行 Diagnosis；
21. 已完成回合恢复时不重复生成 Evidence；
22. 提交过程中刷新不重复提交或重复回流；
23. Debug 输出 PASS；
24. `pnpm run build` 通过。

## 十四、页面验收建议

Phase 12.1 可以接入轻量 Demo。

Demo 最少支持：

1. 完成一轮学习；
2. 点击保存；
3. 刷新页面；
4. 点击恢复；
5. 展示本轮结束页；
6. 提示可以开始下一轮。

学生端不展示：

- 存储 key；
- recordId；
- Runtime 原始 JSON；
- GrowthMemory 原始结构；
- Debug issues。

开发者调试区可以折叠展示。

## 十五、工程验收记录

Phase 12.1 已完成工程最小闭环实现。

已实现：

- `learningPersistence.schema.ts`
- `learningPersistenceAgent.ts`
- `learningPersistenceRepository.ts`
- `inMemoryLearningPersistenceRepository.ts`
- `indexedDBLearningPersistenceRepository.ts`
- `runLearningPersistenceDebug.ts`
- `debug:learning-persistence`

Debug 验收结果：

```text
total: 13
pass: 13
fail: 0
```

覆盖样例：

1. 已完成回合保存；
2. 刷新后恢复完成页；
3. 任务页刷新恢复同一 `learningRoundId`；
4. 答案草稿恢复；
5. 已完成回合进入下一轮；
6. 已完成回合恢复时不重新运行 Diagnosis、不重复 Evidence；
7. 提交过程中刷新不重复提交或重复回流；
8. `studentId` 不一致阻断恢复；
9. `learningRoundId` 不一致阻断恢复；
10. 缺少 `StudentRoundSummary` 阻断恢复；
11. 版本不兼容阻断恢复；
12. 数据损坏时不拼装残缺状态；
13. 清除记录后不再恢复旧状态。

Build 验收：

```text
vite build PASS
```

当前结论：

```text
Phase 12.1 Debug / Build 验收通过。
Demo 已完成轻量接入，可在学生学习入口页验证保存、恢复、清除。
```

Demo 接入记录：

- 页面：`student-learning-entry-demo`
- 支持保存当前任务和答案草稿；
- 支持保存本轮反馈和结束页；
- 支持刷新后恢复上次学习状态；
- 支持清除保存记录；
- 学生主体验区不展示存储 key、recordId 或 Runtime 原始 JSON；
- 开发者调试信息仍放在折叠区。

Demo 验收结果：

```text
Demo PASS
```

已通过验收项：

1. 草稿保存后刷新可恢复；
2. 未完成回合可恢复到可作答状态；
3. 完成结果保存后可恢复反馈和结束页；
4. 清除记录后不再恢复旧状态；
5. 学生主体验区不暴露存储 key、recordId、原始 JSON 或 GrowthMemory 原始结构；
6. 阻断和任务未准备完整 Case 不展示残缺任务，也不误导为正常可继续状态。

## 十六、本阶段不做

Phase 12.1 不做：

- 不接云端数据库；
- 不做账号系统；
- 不做多设备同步；
- 不做真实题目录入；
- 不生成新任务；
- 不启动下一轮；
- 不做长期成长报告；
- 不做数据迁移；
- 不做复杂权限；
- 不做家长端。

## 十七、与 Phase 12.2 的关系

Phase 12.1 输出：

```text
LearningPersistenceRecord
RestoredLearningState
GrowthMemorySummary
StudentAbilityProfile
```

Phase 12.2 将基于这些能力继续验证：

```text
真实题目能否进入 Runtime，
并被保存、恢复和复用。
```

## 十八、完成定义

Phase 12.1 完成时，应能证明：

```text
一轮学习结果可以保存；
刷新后可以恢复；
恢复后的状态可以继续作为下一轮学习的基础。
```

这意味着系统第一次具备：

```text
单学生学习状态保留能力。
```

但它还不证明：

```text
真实题目已经可用；
连续多轮已经跑通；
云端长期数据已经成立。
```
