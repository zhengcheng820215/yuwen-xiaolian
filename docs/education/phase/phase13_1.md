# Phase 13.1：Learning Session History 最小闭环（跨 Session 学习历史）

## 一、阶段目标

Phase 13.1 只解决一个核心问题：

```text
系统能否保存和查询学生跨 Session 发生过什么？
```

一句话定义：

> 将一个或多个正式 LearningRound 归入 LearningSessionRecord，并支持跨天保存以及按学生、能力和时间查询。

Phase 13.1 只记录事实，不生成延迟复测计划，不重新评估能力，不更新 StudentAbilityProfile。

## 二、阶段背景

Phase 12 已经完成：

```text
LearningRound 正式结果
-> LearningPersistenceRecord
-> IndexedDB Repository
-> 保存与恢复
-> 下一轮运行
```

但当前正式持久化主要以单个 `learningRoundId` 为索引。

系统还缺少一个更高层的历史容器，用于回答：

- 学生在哪一天开始了一次学习？
- 这次学习包含哪些 Round？
- 主要涉及哪些能力？
- 产生了哪些正式 Evidence？
- Session 是否正式完成？
- 是否仍有未完成回合？
- 最近一次学习发生在什么时候？

Phase 13.1 为这些问题建立最小数据契约。

## 三、Round / Session / Memory 命名边界

### LearningRound

一次策略到 Evidence 回流的最小学习回合。

```text
Strategy
-> Task
-> StudentResponse
-> Diagnosis
-> AbilityEvidence
-> GrowthMemory
```

### LearningSessionRecord

学生一次连续学习活动的正式历史记录，可以包含一个或多个 LearningRound。

### LearningSessionMemory

Phase 5.3 已有对象，用于训练过程汇总。

Phase 13.1 不修改、不替换、不扩展 `LearningSessionMemory`。

正式关系：

```text
LearningSessionMemory
= 训练过程汇总

LearningSessionRecord
= 跨天历史索引与查询对象
```

## 四、最小链路

Phase 13.1 最小链路：

```text
LearningPersistenceRecord 1
+ LearningRoundResult 1
+ Evidence IDs
↓
LearningSessionRecord
↓
Append LearningRound 2 / 3
↓
LearningSessionRepository.save
↓
跨天重新进入
↓
LearningSessionRepository.query
↓
LearningSessionHistoryResult
```

Phase 13.1 证明：

```text
多个 Round 可以归入正确 Session；
不同 Session 不会互相串线；
正式历史可以跨天保存并查询。
```

## 五、输入

Phase 13.1 输入至少包括：

- `sessionId`；
- `studentId`；
- `LearningPersistenceRecord`；
- `LearningRoundResult`；
- 本轮目标能力；
- 本轮 Evidence IDs；
- Session 开始时间；
- 当前活动时间；
- 可选的 Session 结束信息。

输入必须来自正式 Runtime 或正式持久化结果。

不得使用：

- 页面临时轮次编号代替 `learningRoundId`；
- 未提交的答案草稿代替正式 StudentResponse；
- Debug 文案代替正式 Evidence；
- 前端页面状态推断能力结论。

## 六、输出

Phase 13.1 输出：

```text
LearningSessionRecord
LearningSessionHistoryResult
```

建议最小结构：

```ts
type LearningSessionRecordStatus =
  | 'in_progress'
  | 'completed'
  | 'interrupted'
  | 'blocked'
  | 'review_required';

type LearningSessionEndReason =
  | 'student_finished'
  | 'max_rounds_reached'
  | 'student_stopped'
  | 'runtime_blocked'
  | 'review_required'
  | 'no_available_task';

type LearningSessionRecord = {
  sessionId: string;
  studentId: string;

  startedAt: string;
  endedAt?: string;
  lastActivityAt: string;
  timezone: string;

  learningRoundIds: string[];
  persistenceRecordIds: string[];
  evidenceIds: string[];

  primaryAbilityId?: string;
  targetAbilityIds: string[];

  status: LearningSessionRecordStatus;
  endReason?: LearningSessionEndReason;
  unfinishedRoundId?: string;

  roundCount: number;
  completedRoundCount: number;

  schemaVersion: 'learning_session_history_v1';
  createdAt: string;
  updatedAt: string;

  validation: {
    passed: boolean;
    issues: string[];
  };
};

type LearningSessionQuery = {
  studentId: string;
  abilityId?: string;
  startedFrom?: string;
  startedTo?: string;
  status?: LearningSessionRecordStatus;
  hasUnfinishedRound?: boolean;
  limit?: number;
};

type LearningSessionHistoryResult = {
  studentId: string;
  sessions: LearningSessionRecord[];
  total: number;
  rejectedRecords: RejectedLearningSessionRecord[];
  rejectedTotal: number;
  latestSessionId?: string;
  latestLearningAt?: string;

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

正式查询规则：

```text
候选记录
-> 完整 Schema 与业务不变量校验
-> 合法记录进入 sessions
-> 无效记录进入 rejectedRecords
-> 仅对 sessions 执行能力 / 时间 / 状态筛选、排序和 limit
-> 仅由 sessions 计算 latestSessionId / latestLearningAt
```

无效记录不得被静默修复后参与正式计算。

## 七、字段语义

### sessionId

Session 的正式主键。

同一次连续学习活动必须持续使用同一个 `sessionId`。

页面刷新不得创建新 Session。

### learningRoundIds

属于当前 Session 的正式 Round ID 集合。

同一个 `learningRoundId`：

- 在同一 Session 中只能出现一次；
- 不能同时属于两个正式 Session；
- 不得因恢复重复追加。

### targetAbilityIds

记录当前 Session 正式涉及过的全部目标能力。

不得假设一个 Session 永远只包含一种能力。

`primaryAbilityId` 只是本次 Session 的主要关注能力，不代表长期主要薄弱能力。

### evidenceIds

只保存正式 AbilityEvidence ID。

无效作答、答案草稿、页面提示和未通过 Diagnosis 一致性校验的结果不得进入该数组。

### lastActivityAt

表示当前 Session 最近一次正式活动时间。

它可来自：

- Round 创建；
- 正式作答提交；
- Evidence 回流；
- Session 正式结束。

读取历史本身不得刷新 `lastActivityAt`。

### unfinishedRoundId

只表示当前 Session 是否存在未完成回合。

它不代表能力不足，也不能生成 weakness Evidence。

### endReason

只解释 Session 为什么结束。

```text
Session completed
!= 学习目标完成
!= 能力已经提升
!= 能力已经掌握
```

### completed 严格不变量

```text
status = completed
-> endedAt 存在
-> endReason 合法
-> unfinishedRoundId 不存在
-> completedRoundCount === roundCount
```

反向不成立：

```text
completedRoundCount === roundCount
!= 自动结束 Session
```

Session 结束必须来自正式关闭动作。

## 八、Session 生命周期规则

### 创建 Session

只有学生正式开始一次新的连续学习活动时才创建 Session。

创建时：

```text
status = in_progress
roundCount = 0
completedRoundCount = 0
learningRoundIds = []
evidenceIds = []
```

### 追加 Round

追加 Round 前必须校验：

1. `studentId` 一致；
2. Session 尚未被正式关闭；
3. `learningRoundId` 未被其他 Session 占用；
4. `persistenceRecordId` 可追溯；
5. 目标能力来自正式 Strategy / TaskRequest / Round；
6. Evidence IDs 来自正式回流结果。

### 更新 Session

追加已存在的 `learningRoundId` 必须幂等：

```text
同一 Round 重复保存
-> 不增加 roundCount
-> 不重复 evidenceIds
-> 不重复 persistenceRecordIds
```

### 结束 Session

结束时必须写入：

- `endedAt`；
- `status`；
- `endReason`；
- `updatedAt`。

达到 `max_rounds_reached` 只表示本次计划轮数结束，不表示能力目标完成。

### 恢复 Session

恢复未完成 Session 时：

- 继续使用原 `sessionId`；
- 继续使用原 `unfinishedRoundId`；
- 不重新创建已经存在的 Round；
- 不重新执行 Diagnosis；
- 不重复生成 Evidence；
- 不因读取历史改变 Session 状态。

## 九、Repository 边界

Phase 13.1 建议新增统一接口：

```text
LearningSessionRepository
```

最小能力：

```ts
interface LearningSessionRepository {
  save(record: LearningSessionRecord): Promise<void>;
  getById(studentId: string, sessionId: string): Promise<LearningSessionRecord | undefined>;
  findByRoundId(studentId: string, learningRoundId: string): Promise<LearningSessionRecord | undefined>;
  query(input: LearningSessionQuery): Promise<LearningSessionRecord[]>;
}
```

建议实现：

- `InMemoryLearningSessionRepository`：Debug；
- `IndexedDBLearningSessionRepository`：浏览器与本地正式数据。

页面不得直接读写 IndexedDB。

Phase 13.1 不要求云端数据库。

## 十、查询规则

Phase 13.1 至少支持：

1. 按 `studentId` 查询全部 Session；
2. 按 `studentId + abilityId` 查询；
3. 按时间范围查询；
4. 按状态查询；
5. 查询是否存在未完成回合；
6. 查询最近一次学习时间；
7. 按 `startedAt` 或 `lastActivityAt` 倒序返回。

查询不得：

- 改写 Session；
- 重新运行 Runtime；
- 自动关闭未完成 Session；
- 汇总新的能力结论；
- 把最近一次表现解释为长期能力状态。

## 十一、身份、追溯与幂等规则

必须保持：

```text
LearningSessionRecord.studentId
= LearningRoundResult.studentId
= LearningPersistenceRecord.studentId
```

必须能够追溯：

```text
sessionId
-> learningRoundId
-> persistenceRecordId
-> evidenceId
```

以下情况必须阻断：

- `studentId` 不一致；
- `learningRoundId` 已属于其他 Session；
- `persistenceRecordId` 无法读取；
- Round 与 Persistence Record ID 不一致；
- 版本不兼容；
- completed Session 缺少 `endedAt` 或 `endReason`；
- completed Session 仍包含 `unfinishedRoundId`；
- completed Session 的 `completedRoundCount !== roundCount`；
- `unfinishedRoundId` 不属于 `learningRoundIds`；
- Evidence ID 来源不可追溯。

重复保存同一 Session 或同一 Round 不得增加正式计数。

当前 IndexedDB 唯一性属于单标签页 Runtime 保证：

```text
Single-tab runtime guarantee only.
Cross-tab atomic uniqueness is not guaranteed.
```

跨标签页原子唯一性不属于 Phase 13.1 单页面 MVP 的已验证能力。

## 十二、数据版本规则

Phase 13.1 正式记录必须带：

```text
schemaVersion
createdAt
updatedAt
timezone
```

第一版：

```text
schemaVersion = learning_session_history_v1
```

读取不支持的版本时：

```text
validation.passed = false
```

不得静默拼装为正常历史。

## 十三、最小 Debug 流程

1. 创建 mock studentId；
2. 创建 Session 1；
3. 将两个正式 LearningRound 追加到 Session 1；
4. 关闭 Session 1；
5. 将 Session 1 保存到 InMemory Repository；
6. 注入第二天时间；
7. 创建 Session 2；
8. 将一个未完成 Round 追加到 Session 2；
9. 保存 Session 2；
10. 按 studentId 查询；
11. 按 abilityId 查询；
12. 按时间范围查询；
13. 查询未完成 Session；
14. 校验最近学习时间；
15. 重复保存同一 Round，验证幂等；
16. 输出 PASS / FAIL。

## 十四、Debug Case

| Case | 输入 | 预期 |
| --- | --- | --- |
| 单 Session 多 Round | 同一 sessionId 追加两个 Round | `roundCount = 2` |
| 多 Session 跨天 | 同一学生在不同日期创建两个 Session | 查询返回两个 Session |
| 按能力查询 | Session 涉及推理和表达 | 能按 abilityId 正确过滤 |
| 按时间查询 | 查询第二天时间范围 | 只返回 Session 2 |
| 未完成回合 | Session 2 有 unfinishedRoundId | 可查询且不生成能力结论 |
| 最近学习时间 | 两个 Session 时间不同 | latestLearningAt 来自最新正式活动 |
| 重复追加 Round | 同一 learningRoundId 保存两次 | roundCount、Evidence 数量不增加 |
| Round 跨 Session 冲突 | 同一 learningRoundId 追加到 Session 2 | 阻断 |
| studentId 不一致 | Round 与 Session 学生不同 | 阻断 |
| completed 缺结束信息 | completed 无 endedAt / endReason | validation FAIL |
| 版本不兼容 | schemaVersion 非 v1 | 不读取为正常记录 |
| Session 结束语义 | endReason = max_rounds_reached | 不输出能力完成结论 |

## 十五、Debug Report

Debug Report 至少展示：

- studentId；
- sessionId；
- status；
- endReason；
- startedAt；
- endedAt；
- lastActivityAt；
- learningRoundIds；
- persistenceRecordIds；
- evidenceIds；
- targetAbilityIds；
- roundCount；
- completedRoundCount；
- unfinishedRoundId；
- schemaVersion；
- query filters；
- query result count；
- latestLearningAt；
- idempotency result；
- validation issues；
- PASS / FAIL。

## 十六、验收标准

Phase 13.1 通过条件：

1. 已定义 `LearningSessionRecord`；
2. 已定义 `LearningSessionQuery`；
3. 已定义 `LearningSessionHistoryResult`；
4. 已建立 `LearningSessionRepository` 边界；
5. 一个 Session 可以包含多个 LearningRound；
6. 同一学生可以保存多个跨天 Session；
7. `learningRoundId` 不会跨 Session 重复归属；
8. 重复追加同一 Round 不增加正式计数；
9. 可以按 studentId 查询；
10. 可以按 abilityId 查询；
11. 可以按时间范围查询；
12. 可以查询未完成回合；
13. 可以得到最近一次正式学习时间；
14. `targetAbilityIds` 支持 Session 内多个能力；
15. Session 结束不会生成能力结论；
16. `max_rounds_reached` 不会被解释为能力目标完成；
17. Evidence IDs 只来自正式 AbilityEvidence；
18. `studentId` 不一致时阻断；
19. 版本不兼容时阻断；
20. 跨天查询不会修改正式记录；
21. 不重新运行 Diagnosis；
22. 不更新 StudentAbilityProfile；
23. Debug 输出 PASS；
24. `pnpm run build` 通过。

## 十七、本阶段不做

Phase 13.1 不做：

- 不生成 DelayedRetestCandidate；
- 不生成 DelayedRetestPlan；
- 不生成 RetestTask；
- 不调用 Diagnosis Runtime；
- 不生成新的 AbilityEvidence；
- 不做 RetentionEvaluation；
- 不重新汇总能力结论；
- 不把最近一次表现当作长期状态；
- 不更新 StudentAbilityProfile；
- 不生成新的 GrowthMemory；
- 不做提醒通知；
- 不做日历界面；
- 不做完整历史报告；
- 不接云端数据库；
- 不做多学生账号系统；
- 不做正式 UI。

## 十八、与 Phase 13.2 的关系

Phase 13.1 输出：

```text
LearningSessionRecord[]
LearningSessionHistoryResult
latestLearningAt
evidenceIds
targetAbilityIds
```

Phase 13.2 将消费：

```text
Session History
+ GrowthMemorySummary
+ Evidence createdAt
+ Current Time
↓
DelayedRetestCandidate
↓
DelayedRetestPlan
```

Phase 13.2 不能根据 Session 状态直接推断能力退化。

## 十九、完成定义

Phase 13.1 完成时，应能证明：

```text
多个 LearningRound 可以归入正确 LearningSessionRecord；
多个 LearningSessionRecord 可以跨天保存；
系统可以按学生、能力和时间查询历史；
未完成回合、结束原因和最近学习时间都能被准确识别；
查询历史不会触发新的能力判断或重复 Runtime。
```

Phase 13.1 完成后，系统第一次具备正式的跨 Session 学习历史基础。

它仍不证明延迟复测计划、保持性评估或长期学习效果已经成立。

## 二十、工程验收记录

验收日期：2026-07-16

验收状态：PASS
验收类型：Learning Session History 最小工程闭环

本次已完成：

- `learningSessionHistory.schema.ts`；
- `learningSessionHistoryAgent.ts`；
- `learningSessionRepository.ts`；
- `inMemoryLearningSessionRepository.ts`；
- `indexedDBLearningSessionRepository.ts`；
- `runLearningSessionHistoryDebug.ts`；
- `debug:learning-session-history`。

Debug 共覆盖 15 个场景：

1. 单个 Session 包含两个正式 Round；
2. 两个跨天 Session 独立保存与查询；
3. 按能力查询；
4. 按时间范围查询；
5. 识别未完成回合；
6. 计算最近正式学习时间；
7. 重复追加同一 Round 保持幂等；
8. 同一 Round 归入不同 Session 时阻断；
9. `studentId` 不一致时阻断；
10. 已结束 Session 缺少结束信息时校验失败；
11. Schema 版本不兼容时不读取为正常记录；
12. `max_rounds_reached` 只表示流程结束，不生成掌握或提升结论；
13. 无效最新记录进入 `rejectedRecords`，不影响正式查询和 `latestLearningAt`；
14. completed Session 含未完成 Round 时校验失败并拒绝保存；
15. Evidence、Round 或 Trace 身份单独错位时阻断。

验收结果：

- Phase 13.1 Debug：15 / 15 PASS；
- IndexedDB Browser Persistence Smoke：12 / 12 PASS；
- Phase 12.1 Persistence Regression：PASS；
- Phase 12 Integrated Acceptance Regression：PASS；
- Production Build：PASS；
- 仅存在既有 bundle size warning，不阻断本阶段验收。

工程结论：

> Phase 13.1 已证明多个正式 LearningRound 可以安全归入 LearningSessionRecord，并能够按学生、能力和时间查询；跨 Session 身份隔离、Evidence 追溯、版本阻断和重复追加幂等规则均已成立。

当前边界：

- Debug 使用内存 Repository；
- 浏览器端 IndexedDB Adapter 已实现并通过生产构建；
- 独立 Browser Persistence Smoke Test 入口已完成：`/learning-session-history-smoke.html`；
- Browser Smoke 已实际执行“写入 IndexedDB -> 页面刷新 -> 新 Repository 查询恢复”，并验证学生、能力、时间、未完成 Session、`latestLearningAt`、版本隔离、幂等保存、Round 冲突与清空；
- 跨标签页原子唯一性未验证，当前只保证单标签页 Runtime；
- 本阶段不生成延迟复测计划；
- 本阶段不形成保持性判断；
- 本阶段不更新 StudentAbilityProfile 或 GrowthMemory。
