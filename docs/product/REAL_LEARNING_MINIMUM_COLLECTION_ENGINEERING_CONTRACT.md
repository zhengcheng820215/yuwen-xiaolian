# 真实 Learning 最小采集工程契约

英文名称：Real Learning Minimum Collection Engineering Contract

状态：`DESIGN FROZEN / ENGINEERING WP0—WP7 PASS`

文档版本：`real_learning_minimum_collection_engineering_v1.2`

生效日期：`2026-08-13`

更新日期：`2026-08-14`

## 一、目的与工程边界

本文把[真实 Learning 数据采集与观察契约](./REAL_LEARNING_DATA_COLLECTION_AND_OBSERVATION_CONTRACT.md)中的 P0—P3 转换为可直接实现、测试和验收的工程约束，冻结：

- 五个核心事件的 Schema、触发点与稳定身份；
- `answer_submitted`、正式学习结果与校准 Attempt 的一对一关系；
- Repository、补写、幂等与错误处理边界；
- 开放题 `itemScore` 的第一版计算规则；
- 单学生阶段不能伪造 `totalScore` 与群体区分度的边界；
- 内部完整性报告的集合、公式与阻断等级；
- 最低单元、集成、恢复和人工验收矩阵。

本文不授权建设多用户、家长报告、行为埋点平台、云同步或长期能力新算法；也不改变现有 Learning 的任务、Diagnosis、Evidence、反馈和下一题语义。

## 二、当前事实与目标对象

### 2.1 复用的权威对象

第一版必须复用现有对象，不建立平行事实源：

| 事实 | 权威来源 |
| --- | --- |
| 当前产品学生 | `student-local-primary-v1` |
| Session / Round | `RealLearningOperationCheckpoint.learningSessionId / learningRoundId` |
| 实际消费题目版本 | `sourceResourceId / sourceResourceVersionId / sourceTaskId` |
| 提交 | `TaskExecutionResult.studentResponse` |
| 有效性 | `TaskExecutionResult.responseValidity` |
| 正式诊断 | `RealLLMDiagnosisRuntimeResult.formalCommit` |
| 正式反馈 | `RealLearningOperationCheckpoint.controlledFeedbackResult` |
| 正式完成 | `LearningPersistenceRecord.learningRoundResult.status === 'completed'` |

事件层只建立上述事实的轻量索引。事件 Payload 不复制答案原文、完整 Diagnosis、完整 Feedback 或 Evidence。

### 2.2 新增对象

本轮只新增四类对象：

1. `LearningObservationEvent`：五事件共同 Envelope 与受控 Payload；
2. `LearningObservationOutboxEntry`：非阻塞采集失败后的待补写任务；
3. `QuestionCalibrationProjectionRecord`：完成轮次向校准样本转换的本地审计记录；
4. `LearningCollectionIntegrityReport`：P3 内部一致性报告。

`AnonymousQuestionCalibrationAttempt` 是 `QuestionCalibrationProjectionRecord` 的去标识化输出，不是第二份学习事实。

## 三、Schema 与版本

### 3.1 LearningObservationEvent

```ts
export const LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION =
  'learning_observation_event_v1' as const;

export type LearningObservationEventType =
  | 'question_presented'
  | 'answer_submitted'
  | 'diagnosis_completed'
  | 'feedback_presented'
  | 'learning_round_completed';

export type LearningObservationEvent = {
  schemaVersion: typeof LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION;
  eventId: string;
  eventType: LearningObservationEventType;
  occurredAt: string;
  recordedAt: string;
  runtimeScope: 'product';
  studentId: 'student-local-primary-v1';
  operationId: string;
  learningSessionId: string;
  learningRoundId: string;
  materialVersionId: string;
  resourceId: string;
  resourceVersionId: string;
  taskId: string;
  sourceEntityId: string;
  appVersion: string;
  payload: LearningObservationEventPayload;
};
```

公共约束：

- 所有时间使用可解析的 ISO 8601；`occurredAt` 是事实发生时间，`recordedAt` 是事件成功写入时间；
- 时间不参与 `eventId`，补写不能改变事件身份；
- P1 只接收 `runtimeScope: 'product'` 与固定产品学生；Demo、Fixture、Debug 在 Schema 入口即拒绝；
- `resourceVersionId` 必须来自本轮 Checkpoint，禁止从 Registry 当前版本反查，以免题目换版后错绑；
- `materialVersionId` 必须来自本轮冻结资源引用；无法解析时不伪造空值，进入补写失败并由完整性报告暴露。

### 3.2 受控 Payload

```ts
export type LearningObservationEventPayload =
  | {
      kind: 'question_presented';
      presentationId: string;
    }
  | {
      kind: 'answer_submitted';
      responseId: string;
      attemptId: string;
      submittedAt: string;
    }
  | {
      kind: 'diagnosis_completed';
      responseId: string;
      attemptId: string;
      formalDiagnosisId: string;
      diagnosisSchemaVersion: string;
    }
  | {
      kind: 'feedback_presented';
      responseId: string;
      attemptId: string;
      feedbackRequestId: string;
      feedbackSchemaVersion: string;
    }
  | {
      kind: 'learning_round_completed';
      responseId: string;
      attemptId: string;
      persistenceRecordId: string;
      completedAt: string;
    };
```

Payload 的 `kind` 必须与 Envelope 的 `eventType` 相同。事件中禁止出现 `answerText`、阅读材料正文、Diagnosis 文本、反馈正文、昵称和家长备注。

### 3.3 QuestionCalibrationProjectionRecord

```ts
export const QUESTION_CALIBRATION_PROJECTION_SCHEMA_VERSION =
  'question_calibration_projection_v1' as const;

export type QuestionCalibrationProjectionStatus =
  | 'eligible'
  | 'excluded_invalid_response'
  | 'excluded_incomplete_round'
  | 'excluded_missing_formal_diagnosis'
  | 'excluded_unscorable'
  | 'excluded_non_product_scope'
  | 'projection_failed';

export type QuestionCalibrationProjectionRecord = {
  schemaVersion: typeof QUESTION_CALIBRATION_PROJECTION_SCHEMA_VERSION;
  projectionId: string;
  attemptId: string;
  status: QuestionCalibrationProjectionStatus;
  runtimeScope: 'product' | 'demo' | 'fixture' | 'debug';
  studentId: string;
  operationId: string;
  learningSessionId: string;
  learningRoundId: string;
  responseId: string;
  formalDiagnosisId?: string;
  resourceVersionId: string;
  itemScore?: number;
  itemScorePolicyVersion?: 'rubric_required_equal_weight_v1';
  totalScore?: number;
  totalScoreStatus: 'unavailable_single_round' | 'available_comparable_window';
  assessmentWindowId?: string;
  valid: boolean;
  completedAt?: string;
  projectedAt: string;
  issues: string[];
};
```

每个已产生 `attemptId` 的提交最终必须对应一条投影审计记录。只有 `status === 'eligible'` 的记录可导出为匿名 Attempt；其余状态用于解释为何未入池，不能混入有效样本数。

### 3.4 AnonymousQuestionCalibrationAttempt v2

现有 `question_empirical_calibration_v1` 强制要求 `totalScore: number`，不能诚实表达单学生单轮开放题。本轮接续前必须升级为：

```ts
export const QUESTION_EMPIRICAL_CALIBRATION_SCHEMA_VERSION =
  'question_empirical_calibration_v2' as const;

export type AnonymousQuestionCalibrationAttempt = {
  attemptId: string;
  subjectKey: string;
  resourceVersionId: string;
  itemScore: number;
  itemScorePolicyVersion: 'rubric_required_equal_weight_v1';
  totalScore?: number;
  totalScoreStatus: 'unavailable_single_round' | 'available_comparable_window';
  assessmentWindowId?: string;
  valid: true;
  completedAt: string;
};
```

`subjectKey` 是本地稳定、去显示名的受控标识，用于识别同一 Learner 的重复作答，不能直接显示给学生或家长。当前固定学生可以确定性映射为一个稳定 `subjectKey`，不得为每次提交随机生成新主体。

禁止：

- 用 `itemScore`、答案长度、题目序号或 Round 数冒充 `totalScore`；
- 在 `totalScoreStatus !== 'available_comparable_window'` 时计算高低组区分度；
- 把同一 `subjectKey` 的重复作答计为多个独立使用者。

## 四、稳定身份算法

### 4.1 统一算法

所有新身份复用项目现有 `buildStableId(namespace, parts)`。输入顺序是契约的一部分，禁止在实现中自行重排、加入当前时间或随机数。

```text
attemptId = buildStableId(
  "learning-calibration-attempt",
  [studentId, learningSessionId, learningRoundId, submissionIntentId]
)

eventId = buildStableId(
  "learning-observation-event",
  [schemaVersion, eventType, studentId, learningSessionId,
   learningRoundId, sourceEntityId]
)

projectionId = buildStableId(
  "question-calibration-projection",
  [schemaVersion, attemptId]
)
```

### 4.2 sourceEntityId

| 事件 | `sourceEntityId` |
| --- | --- |
| `question_presented` | `presentationId = buildStableId('question-presentation', [studentId, learningRoundId, resourceVersionId])` |
| `answer_submitted` | `submissionIntentId`（由 `responseId + normalizedAnswerText` 稳定生成） |
| `diagnosis_completed` | `FormalDiagnosisCommit.formalDiagnosisId` |
| `feedback_presented` | `ControlledFeedbackResult.feedbackRequestId` |
| `learning_round_completed` | `LearningPersistenceRecord.recordId` |

当前 `StudentResponse.responseId = response-${executionSessionId}` 在同一 Round 修改答案后不会变化，因此 P1 额外生成 `submissionIntentId = buildStableId('learning-answer-submission', [responseId, normalizedAnswerText])`。它只保留哈希结果，不复制答案原文：相同答案的刷新或重复点击复用身份，实质修改后的再次提交形成新身份。`answer_submitted.sourceEntityId` 使用 `submissionIntentId`，后续正式结果根据最终 Response 内容重新得到同一提交身份。不得靠时间戳区分提交。

### 4.3 冲突语义

同一 ID 再次写入：

- 内容完全一致：返回 `unchanged`；
- 只差 `recordedAt`：保留首次记录并返回 `unchanged`；
- 业务字段不同：返回 `conflict`，保留原记录，写入内部 Issue，不覆盖；
- 不允许 Repository 使用静默 last-write-wins。

## 五、五事件触发点

| 事件 | 唯一触发点 | 不得触发的情况 |
| --- | --- | --- |
| `question_presented` | 正式冻结题目与作答控件首次同时可见、可交互后 | Skeleton、恢复探测、隐藏标签页预加载、Demo |
| `answer_submitted` | `TaskExecutionResult.studentResponse` 已形成并被本轮 Checkpoint 接纳后 | 点击尚未形成 Response、仅保存草稿、客户端校验失败 |
| `diagnosis_completed` | `FormalDiagnosisCommit.status === 'committed'` 且正式 Diagnosis 可恢复后 | Provider 返回但尚未 Commit、Mock、Review/Blocked |
| `feedback_presented` | 正式 Feedback 已渲染，容器首次进入可见状态后 | 只在后台生成、Loading、系统错误、恢复探测 |
| `learning_round_completed` | `LearningPersistenceRecord` 已保存且 `learningRoundResult.status === 'completed'` 后 | 只有 Checkpoint 完成、Persistence 失败、Retry/Blocked |

`question_presented` 与 `feedback_presented` 是 UI 可见事实，其余三个是 Runtime 事实。UI 组件只调用 Application Service，不得直接写 IndexedDB。

当前正式运行代际固定为 `real_learning_collection_v1`，五类事件的 `appVersion` 必须使用这一代际标识。不得继续沿用 `phase16_3_live_learning_wp5` 等工作包临时名称，避免当前采集链与运行时事件版本漂移。

## 六、事件服务与 Repository

### 6.1 Application Service

```ts
export interface LearningObservationService {
  record(eventInput: LearningObservationEventInput):
    Promise<'created' | 'unchanged' | 'queued'>;
  reconcileRound(input: ReconcileLearningRoundInput):
    Promise<LearningRoundReconciliationResult>;
}
```

`record` 先校验身份、版本、事件—Payload 一致性，再生成稳定 ID。Repository 写入失败时建立 Outbox；只要学习权威事实已经成功，采集错误不得回滚学习结果。

### 6.2 LearningObservationRepository

```ts
export interface LearningObservationRepository {
  save(event: LearningObservationEvent):
    Promise<{ status: 'created' | 'unchanged' | 'conflict'; event: LearningObservationEvent }>;
  getById(eventId: string): Promise<LearningObservationEvent | undefined>;
  listByRound(studentId: string, learningRoundId: string):
    Promise<LearningObservationEvent[]>;
  listByResourceVersion(resourceVersionId: string):
    Promise<LearningObservationEvent[]>;
}
```

### 6.3 QuestionCalibrationProjectionRepository

```ts
export interface QuestionCalibrationProjectionRepository {
  save(record: QuestionCalibrationProjectionRecord):
    Promise<{ status: 'created' | 'unchanged' | 'conflict'; record: QuestionCalibrationProjectionRecord }>;
  getByAttemptId(attemptId: string):
    Promise<QuestionCalibrationProjectionRecord | undefined>;
  listByRound(studentId: string, learningRoundId: string):
    Promise<QuestionCalibrationProjectionRecord[]>;
  listEligibleByResourceVersion(resourceVersionId: string):
    Promise<QuestionCalibrationProjectionRecord[]>;
}
```

### 6.4 本地存储

实现使用独立 IndexedDB `yuwen_xiaolian_learning_collection`，当前版本为 `3`，不使用 LocalStorage 保存完整事件或投影。v3 在保留既有 Event、Outbox 和 Projection 的基础上补充 `studentId` 索引；独立数据库避免升级采集能力时改变现有 Learning Persistence、Session、Operation 与多日运行数据库。Object Store 名称固定为：

- `learningObservationEvents`，主键 `eventId`；
- `learningObservationOutbox`，主键 `outboxId`；
- `questionCalibrationProjections`，主键 `projectionId`。

最低索引：`studentId + learningRoundId`、`resourceVersionId`、`eventType`、`attemptId`、`status`。数据库升级必须保留既有答案、Session、Checkpoint 与 Persistence Store；升级失败时 Learning 主链继续可用，采集进入明确降级状态。

Projection 的重复检查、冲突判定和写入必须在同一个 IndexedDB `readwrite` Transaction 内完成。浏览器会按 Store 串行化不同标签页的写事务，因此并发写入同一 `attemptId` 时只能得到以下稳定结果：相同内容为一次 `created` 加一次 `unchanged`；不同 `projectionId` 为一次 `created` 加一次结构化 `conflict`。不得把唯一索引异常直接暴露给 Learning 主链，也不得用事务外“先查后写”制造竞态窗口。

v2 → v3 Upgrade 的验收必须预置并保留 Event、Outbox、Projection 和无关旧 Store 的实际记录，不以空库成功升级代替数据兼容性证明。

## 七、补写、顺序与失败恢复

### 7.1 非阻塞写入顺序

```text
权威学习事实成功
→ 尝试幂等写事件
→ 成功：结束
→ 失败：写 Outbox
→ Outbox 失败：记录进程内 Issue，并在下次恢复执行确定性 reconcile
```

不得为了保证分析事件“看起来完整”而把学习权威写入包进跨 Repository 伪事务。

### 7.2 Outbox

Outbox 至少包含 `outboxId / eventId / roundId / eventType / retryCount / lastError / nextRetryAt / createdAt / updatedAt`。重试采用上限退避；页面启动、Round 恢复、提交完成与内部报告刷新时都可以触发安全补写。

### 7.3 reconcileRound

`reconcileRound` 只从权威对象重建可推导事件：

- Response 可重建 `answer_submitted`；
- Formal Commit 可重建 `diagnosis_completed`；
- Persistence completed 可重建 `learning_round_completed`；
- `question_presented` 与 `feedback_presented` 只有存在已持久化的 UI presentation marker 时才能补写，不能从“有题目/有反馈”反推“学生看见过”。

补写使用原事实的 `occurredAt`；无法确定时保留 Issue，不使用补写时刻伪装事实时刻。

事件正常顺序为五事件链，但报告按来源身份判断，不按 `recordedAt` 排序推断业务真相。

## 八、校准投影算法

### 8.1 投影触发

`learning_round_completed` 写入后调用 `projectQuestionCalibrationAttempt(attemptId)`。刷新、恢复、内部修复可以重复调用，结果必须幂等。

### 8.2 资格决策顺序

1. 非 Product 作用域：`excluded_non_product_scope`；
2. Response 不存在或 Validity 非 `valid`：`excluded_invalid_response`；
3. Round 非正式 `completed`：`excluded_incomplete_round`；
4. Formal Commit 不存在或未 committed：`excluded_missing_formal_diagnosis`；
5. 无法按评分策略得到 `itemScore`：`excluded_unscorable`；
6. 身份、版本或 Repository 冲突：`projection_failed`；
7. 全部满足：`eligible`。

一次调用只写入一个 `projectionId`。后续权威事实从 pending 变为完成时，允许同一 Projection 从排除状态升级为 `eligible`，但必须采用受控状态转换并保留 `issues`；已经 `eligible` 的记录不可被较弱状态覆盖。

### 8.3 itemScore v1

第一版只对具有正式 `rubricItems` 的开放题启用：

```text
requiredItems = rubricItems.filter(item.required)
itemScore = matched requiredItems / requiredItems
```

规则：

- 至少存在一个 required Rubric Item；否则 `excluded_unscorable`；
- 每项等权，结果限制在 `0—1`；
- `scoreBand`、`correct`、答案长度、Diagnosis confidence 不代替 Rubric 计分；
- `itemScorePolicyVersion = rubric_required_equal_weight_v1`；
- 将来使用权重或题型专用评分必须新增 Policy Version，不能重算并覆盖旧 Attempt。

### 8.4 totalScore 与区分度

P2 单学生单轮没有可比较的 assessment total，因此：

```text
totalScore = undefined
totalScoreStatus = unavailable_single_round
assessmentWindowId = undefined
```

当前校准计算器可先计算版本级有效 Attempt 数和平均 `itemScore`；高低组区分度只有在同一版本存在足够多个不同 `subjectKey`，且每条 Attempt 都绑定同一可比较 `assessmentWindowId` 和总分策略时才可计算。否则字段缺省并写入 limitation。

现有 v1 计算器按 `totalScore` 排序的逻辑在 Schema v2 适配完成前不得接入真实 P2 数据。

历史 v1 Attempt 可以通过兼容适配器读取，但因缺少可信 `subjectKey`，统一归入未知旧主体，不得按 `attemptId` 伪造多个独立使用者；只有迁移时获得可验证主体归属后，才允许生成不同的 v2 `subjectKey`。

### 8.5 去标识化输出

只有 `eligible` 投影输出匿名 Attempt。输出移除 `studentId / sessionId / roundId / responseId / formalDiagnosisId / operationId` 和原文；`subjectKey` 仅用于独立样本去重与纵向识别。

## 九、P3 内部完整性报告

### 9.1 报告 Schema

```ts
export type LearningCollectionIntegrityReport = {
  schemaVersion: 'learning_collection_integrity_report_v2';
  reportId: string;
  studentId: string;
  generatedAt: string;
  scope: 'current_collection' | 'all_history';
  collectionGeneration: 'real_learning_collection_v1';
  totals: {
    sessions: number;
    roundsWithFormalQuestion: number;
    completedRounds: number;
    submittedAttempts: number;
    eligibleCalibrationAttempts: number;
    excludedCalibrationAttempts: number;
    projectionFailedAttempts: number;
  };
  eventCounts: Record<LearningObservationEventType, number>;
  issues: LearningCollectionIntegrityIssue[];
  status: 'pass' | 'warning' | 'fail';
};
```

### 9.2 权威集合与公式

令：

- `R` = 固定产品学生的正式 Round；
- `C` = `R` 中 Persistence 已保存且状态为 `completed` 的 Round；
- `S` = `R` 中不同 `answer_submitted.payload.attemptId` 的集合；
- `E` = Projection 状态为 `eligible` 的 Attempt；
- `X` = Projection 状态为 `excluded_*` 的 Attempt。
- `F` = Projection 状态为 `projection_failed` 的 Attempt。

必须满足 `|S| = |E| + |X| + |F|`。`submittedAttempts` 取 `|S|`，不得继续按“Checkpoint 中存在最终 StudentResponse 的 Round 数”计算。Checkpoint 最终 Response 只用于确认当前正式结果的提交事件没有缺失，不代表同一 Round 之前没有发生其他无效或被排除的提交。

报告必须检查：

| Issue | 判定公式 | 等级 |
| --- | --- | --- |
| `missing_question_presented` | 正式题可交互 marker 存在但对应事件数为 0 | warning |
| `missing_answer_submitted` | Checkpoint 最终 Response 推导的 `attemptId` 不在 S | fail |
| `missing_diagnosis_completed` | Formal Commit 已存在但诊断事件数为 0 | fail |
| `missing_feedback_presented` | 反馈可见 marker 存在但事件数为 0 | warning |
| `missing_round_completed` | `round ∈ C` 但完成事件数为 0 | fail |
| `missing_projection` | `attemptId ∈ S` 且无 E、X 或 F 中的唯一 Projection | fail |
| `duplicate_event` | 同一规范 Event Key 的活动记录数大于 1 | fail |
| `duplicate_projection` | 同一 `attemptId` 的 Projection 数大于 1 | fail |
| `resource_version_mismatch` | Event/Projection 版本不等于本轮 Checkpoint 版本 | fail |
| `identity_mismatch` | Event/Projection 的 Session、Round、Attempt、Response 或 Diagnosis 链不能按对应提交意图闭合 | fail |
| `demo_scope_leak` | Product Repository 中存在非 Product 数据 | fail |
| `occurred_at_inversion` | 可比较事实时间明显逆序 | warning；若影响归属则 fail |
| `eligible_without_completed_round` | `attemptId ∈ E` 但所属 Round 不在 `C` | fail |
| `independent_sample_overcount` | 独立样本数大于 distinct `subjectKey` | fail |

`status = fail` 当存在任一 fail Issue；否则有 warning 为 `warning`；无 Issue 为 `pass`。报告不得用事件存在替代权威完成事实，也不得自动修复后隐藏本次发现的 Issue。

身份核对按 Attempt 分组：`answer_submitted` 建立 `attemptId -> responseId` 权威映射；同一 Attempt 的后续 Event 与 Projection 必须使用相同 Response。早期无效 Attempt 不要求等于 Checkpoint 最终 Response；最终正式 Diagnosis、Feedback 与 Round Completion 仍必须与 Checkpoint 当前正式结果闭合。Projection 存在但找不到对应 `answer_submitted` 时属于 `identity_mismatch`。

### 9.3 内部显示

P3 只提供内部只读页面或 JSON，不进入学生默认界面。至少支持按 Round 展开五事件、Attempt 状态、版本绑定与 Issue，并分别显示提交、eligible、excluded 和 projection failed 数量；不显示群体百分位或“题目已验证”。

报告查询增加固定范围：

```ts
type LearningCollectionIntegrityScope =
  | 'current_collection'
  | 'all_history';

const CURRENT_COLLECTION_GENERATION = 'real_learning_collection_v1';
const CURRENT_COLLECTION_STARTED_AT = '2026-08-13T14:03:24.000Z';
```

范围判定以 `RealLearningOperationCheckpoint.createdAt` 为权威：

- `current_collection` 只包含 `createdAt >= CURRENT_COLLECTION_STARTED_AT` 的 Round，并同步过滤其 Persistence、Event、Projection 与 UI marker；
- `all_history` 保留固定产品学生的全部 Round 和全部真实 Issue；
- 不得以 Event 或 Projection 是否存在作为当前代际判定条件；
- 报告必须返回当前范围、代际、范围起点、纳入 Round 数、当前代际 Round 数和旧历史 Round 数；
- 当前范围为零个 Round 时，页面显示等待真实数据，不把空集合投影为“采集链完整”；
- 页面切换范围和刷新报告均为只读操作。

默认内部页面使用 `current_collection`。`all_history` 的 FAIL 不改变当前范围的状态；当前范围的 FAIL 也不得被全量统计或旧历史说明降级隐藏。

## 十、模块落位

建议工程位置，允许在保持边界一致时按仓库命名微调：

```text
src/ai/schemas/learningObservationEvent.schema.ts
src/ai/schemas/questionCalibrationProjection.schema.ts
src/ai/schemas/learningCollectionIntegrity.schema.ts
src/ai/repositories/learningObservationRepository.ts
src/ai/repositories/questionCalibrationProjectionRepository.ts
src/ai/repositories/indexedDBLearningObservationRepository.ts
src/ai/repositories/indexedDBQuestionCalibrationProjectionRepository.ts
src/ai/services/learningObservationService.ts
src/ai/services/questionCalibrationProjectionService.ts
src/ai/services/learningCollectionIntegrityService.ts
```

UI 只依赖 Service；Projection Service 依赖权威学习 Repository 与投影 Repository；完整性 Service 只读，不直接修改正式记录。

## 十一、测试与验收矩阵

### 11.1 Schema 与单元测试

- 五种 Event Payload 与 Event Type 严格对应；
- 非 Product scope、错误学生、空版本、非法时间拒绝；
- 固定输入生成固定 `eventId / attemptId / projectionId`；
- 相同写入 `unchanged`，不同内容同 ID 返回 `conflict`；
- required Rubric 为 `3/4` 时 `itemScore === 0.75`；
- 无 required Rubric 不生成 eligible Attempt；
- 单轮投影的 `totalScore` 缺省且状态正确。

### 11.2 Runtime 集成测试

1. 正常完成：五事件各一条、一个 eligible Projection；
2. 无效乱输入：有 `question_presented / answer_submitted`，无 Diagnosis/Feedback/Completed，有 excluded Projection 或待完成审计，不进入有效样本；
3. Provider 失败：提交事件保留，不伪造 Diagnosis 与 Attempt；
4. Persistence 失败：不写 Round Completed，不生成 eligible Attempt；
5. 刷新恢复：不重复 Response、Event、Projection、Evidence；
6. 重复点击提交：同一权威 Response 只有一个提交事件；
7. 题目换版：新旧 Attempt 按 `resourceVersionId` 分离；
8. Demo/Fixture：不能进入 Product Event 与有效 Attempt；
9. 采集 Repository 故障：学生仍能完成，恢复后补写；
10. 冲突记录：保留首条并在报告显示 fail。

### 11.3 P3 公式测试

为每类 Issue 构造最小 Fixture，断言计数、Issue Code 与最终等级。重点覆盖“已完成但无 Attempt”“一个 Attempt 两份 Projection”“版本错绑”“Demo 泄漏”“同一主体重复作答不增加独立主体数”。

### 11.4 人工浏览器验收

固定产品学生执行：

```text
打开正式题
→ 提交有效答案
→ 看见正式反馈
→ 完成本轮
→ 刷新并恢复
→ 打开内部完整性页
```

验收结果必须证明：学生界面没有新增采集步骤；五事件与一个 Attempt 身份闭合；刷新后数量不变；技术 ID 不出现在学生界面；内部报告为 pass。

## 十二、完成定义

### P0 完成

- 本文 Schema 与身份算法落实为 TypeScript；
- v1 校准 Schema 升级方案有兼容测试；
- Repository 接口、IndexedDB Upgrade 与冲突语义通过测试。

### P1 完成

- 五事件接入正式 `/learning`；
- 正常、无效、失败、刷新与 Demo 隔离测试通过；
- 采集失败不阻断主链。

### P2 完成

- 每个提交都有唯一 Projection 审计结果；
- 只有有效、已正式诊断、可评分且完成的 Round 产生 eligible Attempt；
- 不伪造 `totalScore`，不同题目版本不合并。

### P3 完成

- 内部报告实现全部公式与 Issue Code；
- 正常 Case 为 pass，注入缺失、重复、错绑和 Demo 泄漏均能发现；
- 人工浏览器验收留存证据。

只有对应阶段的代码、自动化测试和人工验收同时满足，产品文档才能把该阶段从 `IMPLEMENTATION PENDING` 更新为 `PASS`。

## 十三、实施顺序

```text
Schema v1 + ID helpers
→ IndexedDB Repository + Upgrade
→ Observation Service + 五个触发点
→ Outbox / reconcile
→ Calibration Schema v2 + Projection Service
→ Integrity Service + 内部页面
→ 自动化回归 + 人工浏览器验收
```

本轮不得先做家长页面或多用户。P1、P2、P3 及其对应的 `WP0—WP7` 工程与验收现已完成：第一批34道题可以进入固定单学生的受控真实运行，并自动形成版本化 Projection 与匿名 Attempt。该完成状态只证明采集、恢复和审计能力已经就绪；在缺少足量不同 `subjectKey` 时，仍不得宣称题目完成群体实证校准。
