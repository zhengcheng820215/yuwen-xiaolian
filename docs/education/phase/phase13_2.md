# Phase 13.2：Delayed Retest Scheduling 最小闭环（延迟复测调度）

## 一、阶段目标

Phase 13.2 只解决一个核心问题：

```text
系统能否根据可信的跨 Session 历史、正式 Evidence 时间和明确规则，
生成有来源、有理由、有计划时间的延迟复测事项？
```

一句话定义：

> 将正式 Session History 与 Evidence 新鲜度转换为可追溯的 DelayedRetestCandidate 和 DelayedRetestPlan。

Phase 13.2 不创建题目，不启动复测，不评价保持性，也不更新 StudentAbilityProfile。

## 二、阶段背景

Phase 13.1 已经完成：

```text
LearningPersistenceRecord[]
-> LearningSessionRecord[]
-> LearningSessionHistoryResult
-> 按 student / ability / time 查询
```

并且已经建立：

- 正式 `sessions` 与 `rejectedRecords` 隔离；
- `latestLearningAt` 只来自合法 Session；
- Session、Round、Evidence 与 Persistence Record 可追溯；
- completed Session 与 Round 完成事实一致；
- 重复追加和跨 Session Round 冲突有明确规则。

但 Phase 13.1 只回答“发生过什么”，尚未回答：

```text
某项能力是否已经到了需要重新观察的时间？
为什么现在安排复测？
复测应验证什么？
计划到期后应如何交给既有任务链路？
```

Phase 13.2 为这些问题建立最小调度契约。

## 三、核心边界

### 1. Evidence 变旧不等于能力下降

```text
Evidence 距今时间增加
-> 需要重新观察表现
```

不能推导为：

```text
Evidence 距今时间增加
-> 学生能力已经退步
```

Phase 13.2 只能判断“是否需要安排新的观察”，不能生成能力变化结论。

### 2. 到期不等于自动开始复测

```text
DelayedRetestPlan.status = available
-> 可以进入下游任务准备
```

不等于：

```text
自动创建题目
自动启动 LearningRound
自动生成 Retest Evidence
```

真正执行仍必须经过：

```text
DelayedRetestPlan
-> Existing Phase 8 Strategy / TaskRequest
-> TaskFulfillment
-> ConcreteLearningTask
-> LearningRound
```

### 3. 调度计划不是教学策略

Phase 13.2 只提供：

- 复测目标能力；
- 来源 Session 与 Evidence；
- 计划复测时间；
- 为什么需要复测；
- 复测时需要验证的表现；
- 新材料与提示限制。

Phase 13.2 不决定：

- 下一轮是否改练其他能力；
- 是否降低训练难度；
- 是否已经适合迁移；
- 学生是否已经掌握；
- Profile 是否应该更新。

这些判断仍由既有 GrowthMemory、NextLearningStrategy、Evaluation 和 ProfileUpdateDecision 负责。

## 四、最小链路

Phase 13.2 最小闭环：

```text
GrowthMemorySummary
+ LearningSessionHistoryResult.sessions
+ AbilityEvidence.createdAt
+ Current Time
+ DelayedRetestPolicy
↓
DelayedRetestCandidate
↓
DelayedRetestPlan
↓
Scheduling Result
├─ wait_until_due
├─ create_task_request
├─ already_scheduled
├─ review_required
└─ blocked
```

本阶段完成时只需要证明：

```text
可信历史
-> 可重复的时间判断
-> 可追溯的复测计划
-> 明确的下游流程动作
```

## 五、输入

Phase 13.2 输入建议定义为：

```ts
type DelayedRetestSchedulingInput = {
  studentId: string;
  targetAbilityId: string;

  growthMemorySummary: GrowthMemorySummary;
  sessionHistory: LearningSessionHistoryResult;
  abilityEvidence: AbilityEvidence[];

  existingPlans?: DelayedRetestPlan[];

  currentTime: string;
  timezone: string;
  policy: DelayedRetestPolicy;
};
```

### 输入前置条件

1. `studentId` 必须与 GrowthMemory、Session History 和 Evidence 一致；
2. `targetAbilityId` 必须与 `GrowthMemorySummary.abilityId` 一致；
3. 只能消费 `LearningSessionHistoryResult.sessions` 中的合法记录；
4. `rejectedRecords` 不得进入时间和能力计算；
5. 第一版自动调度要求 `sessionHistory.rejectedTotal === 0`；
6. Evidence 必须属于目标能力；
7. Evidence ID 必须能在正式 Session 的 `evidenceIds` 中找到；
8. 当前时间必须通过输入注入；
9. 所有时间必须是可解析的 ISO 时间；
10. `currentTime` 不得早于作为调度依据的 Evidence 时间。

如果 Session History 中存在 rejected records，第一版应进入 `review_required`，不得自动忽略数据缺口后继续调度。

## 六、Evidence 时间字段对齐

现有 `AbilityEvidence` 的正式时间字段为：

```ts
createdAt: string;
```

Phase 13.2 第一版直接使用 `AbilityEvidence.createdAt` 作为本次 Evidence 的发生时间。

本阶段不新增另一套 `occurredAt` 字段，避免时间 Schema 漂移。

调度使用的基准时间必须来自：

```text
目标能力
+ 正式 Session 已关联
+ Schema 合法
+ evidenceType 为 positive 或 growth
```

以下 Evidence 不作为延迟保持性复测的主要基准：

- `insufficient`；
- 未被正式 Session 关联；
- `studentId` 不一致；
- ability 不一致；
- 来源不可追溯；
- 时间在未来；
- Schema 非法。

`weakness` Evidence 表示当前仍需训练或观察，不应仅因时间经过自动生成“保持性复测”计划。

## 七、DelayedRetestPolicy

第一版使用明确、可重复的规则，不引入复杂间隔算法。

建议结构：

```ts
type DelayedRetestPolicy = {
  policyVersion: 'delayed_retest_policy_v1';

  growthIntervalDays: 3;
  positiveIntervalDays: 7;

  requireNewMaterial: true;
  allowHint: false;
};
```

第一版规则：

```text
latest relevant evidenceType = growth
-> plannedRetestAt = evidence.createdAt + 3 days

latest relevant evidenceType = positive
-> plannedRetestAt = evidence.createdAt + 7 days
```

如果同一能力同时存在多条可用 Evidence：

1. 只选择正式 Session 已关联的 Evidence；
2. 按 `createdAt` 选择最新一条；
3. 相同时间时按 Evidence ID 做稳定排序；
4. 不由置信度擅自缩短或延长时间；
5. 不因 Session 已结束而自动创建计划。

## 八、DelayedRetestCandidate

`DelayedRetestCandidate` 表示某项能力是否具备生成延迟复测计划的条件。

建议结构：

```ts
type DelayedRetestCandidateStatus =
  | 'not_due'
  | 'due'
  | 'not_eligible'
  | 'already_scheduled'
  | 'review_required'
  | 'blocked';

type DelayedRetestCandidate = {
  candidateId: string;
  studentId: string;
  targetAbilityId: string;

  sourceSessionIds: string[];
  sourceEvidenceIds: string[];
  baselineEvidenceId?: string;
  baselineEvidenceType?: 'growth' | 'positive';
  baselineEvidenceAt?: string;

  plannedRetestAt?: string;
  currentTime: string;
  intervalDays?: number;

  status: DelayedRetestCandidateStatus;
  eligibilityReason: string;
  limitations: string[];

  policyVersion: string;
  schemaVersion: string;

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

`baselineEvidenceId`、`baselineEvidenceType`、`baselineEvidenceAt`、`plannedRetestAt` 和 `intervalDays` 在 `not_due`、`due`、`already_scheduled` 时必须存在。

当状态为 `not_eligible`、`review_required` 或 `blocked` 时，不得为了填满结构而伪造基准 Evidence 或计划时间，因此这些字段允许为空，并由 `eligibilityReason`、`validation.issues` 和 `limitations` 解释原因。

### Candidate 规则

1. Candidate 必须绑定唯一 student 和 target ability；
2. 必须引用至少一个正式 Session；
3. 必须引用正式 Evidence；
4. `baselineEvidenceId` 必须包含在 `sourceEvidenceIds` 中；
5. `baselineEvidenceAt` 必须等于正式 Evidence 的 `createdAt`；
6. `plannedRetestAt` 必须由 Policy 计算；
7. `currentTime < plannedRetestAt` 时为 `not_due`；
8. `currentTime >= plannedRetestAt` 时为 `due`；
9. Evidence 不足时为 `not_eligible`；
10. 身份、能力、版本或时间冲突时进入 `review_required` 或 `blocked`；
11. 已存在同一基线 Evidence 的有效计划时为 `already_scheduled`；
12. Candidate 不包含能力提升、退步或掌握结论。

## 九、DelayedRetestPlan

`DelayedRetestPlan` 是待复测事项，不是题目。

建议结构：

```ts
type DelayedRetestPlanStatus =
  | 'pending'
  | 'available'
  | 'completed'
  | 'cancelled'
  | 'review_required';

type DelayedRetestPlan = {
  planId: string;
  replacesPlanId?: string;
  rescheduleRevision?: number;
  candidateId: string;
  studentId: string;
  targetAbilityId: string;

  sourceSessionIds: string[];
  sourceEvidenceIds: string[];
  baselineEvidenceId: string;

  scheduledAt: string;
  plannedRetestAt: string;
  status: DelayedRetestPlanStatus;

  whyRetestNow: string;
  retestGoal: string;
  validationGoal: string;

  requestedTaskRole: 'retest';
  requireNewMaterial: true;
  allowHint: false;
  constraints: string[];

  policyVersion: string;
  schemaVersion: string;
  createdAt: string;
  updatedAt: string;

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

### Plan 状态规则

```text
Candidate.status = not_due
-> Plan.status = pending
-> nextStep = wait_until_due

Candidate.status = due
-> Plan.status = available
-> nextStep = create_task_request

Candidate.status = already_scheduled
-> 不创建第二份计划
-> nextStep = already_scheduled

Candidate.status = not_eligible
-> 不生成 Plan
-> nextStep = blocked

Candidate.status = review_required / blocked
-> 不生成可执行计划
```

第一版取消语义为临时取消：`cancelled` 计划不再阻止重新调度。重新调度必须生成新的 `planId`，通过 `replacesPlanId` 指向被取消计划，并递增 `rescheduleRevision`。`pending`、`available`、`review_required` 与 `completed` 仍阻止同一基线、同一 Policy 的重复计划。

`create_task_request` 只表示可以交给既有 Phase 8 策略与任务请求链路，不表示 Phase 13.2 自己创建 TaskRequest。

## 十、Scheduling Result

建议定义正式结果对象：

```ts
type DelayedRetestSchedulingNextStep =
  | 'wait_until_due'
  | 'create_task_request'
  | 'already_scheduled'
  | 'review_required'
  | 'blocked';

type DelayedRetestSchedulingResult = {
  studentId: string;
  targetAbilityId: string;

  candidate: DelayedRetestCandidate;
  plan?: DelayedRetestPlan;

  nextStep: DelayedRetestSchedulingNextStep;
  reason: string;

  validation: {
    passed: boolean;
    issues: string[];
  };
};
```

## 十一、计划幂等与去重规则

同一基线 Evidence、同一 Policy 和同一计划时间不得重复创建计划。

建议稳定 ID：

```text
candidateId
= studentId
+ targetAbilityId
+ baselineEvidenceId
+ policyVersion

planId
= candidateId
+ plannedRetestAt
+ rescheduleRevision
```

重复运行调度时：

- 返回已有计划；
- 不生成新的 `planId`；
- 不改变原计划创建时间；
- 不自动把 completed 计划恢复为 pending；
- 不因页面刷新重复创建 TaskRequest；
- 新 Evidence 到来后可以形成新的 Candidate，但必须引用新的基线 Evidence。
- `cancelled` 允许重新调度，但必须保留替代关系，不得覆盖旧计划；
- `completed` 不自动重开，新的复测周期必须来自新基线 Evidence 或新 Policy。

## 十二、任务准备边界

Phase 13.2 输出的 Plan 只能提供下游约束：

```text
targetAbilityId
requestedTaskRole = retest
validationGoal
sourceEvidenceIds
sourceSessionIds
requireNewMaterial
allowHint
constraints
```

计划到期后应进入：

```text
DelayedRetestPlan
-> Existing NextLearningStrategy / TaskRequest Adapter
-> TaskRequest
-> TaskFulfillment
-> ConcreteLearningTask
```

Phase 13.2 禁止：

- 直接生成 `RetestTask`；
- 直接选择一条题目并跳过 TaskFulfillment；
- 直接启动 LearningRound；
- 修改 `ConcreteLearningTask`；
- 自动提交学生答案；
- 生成 Retest Evidence。

## 十三、时间与时区规则

1. `currentTime` 必须由调用方传入；
2. Debug 不得完全依赖机器当前时间；
3. 所有正式时间使用 ISO 字符串；
4. 日期加减使用明确的 UTC 时间计算；
5. `timezone` 用于展示和日历解释，不用于改变 Evidence 原始时间；
6. 夏令时或本地日期切换不能通过字符串拼接计算；
7. `plannedRetestAt` 必须稳定可重复；
8. `currentTime` 早于 Evidence 时间时进入 `review_required`；
9. 查询历史不会刷新 Evidence 时间或计划时间。

## 十四、失败与阻断规则

以下情况不得生成可进入下游的计划：

- Session History Schema 非法；
- `rejectedTotal > 0`；
- Session、GrowthMemory、Evidence 的 `studentId` 不一致；
- target ability 不一致；
- Evidence 未关联正式 Session；
- Evidence Schema 非法；
- 只有 `insufficient` Evidence；
- 最新相关 Evidence 为 weakness；
- Evidence 时间晚于 currentTime；
- Policy 版本不支持；
- existing plan 与 Candidate 来源冲突；
- baseline Evidence 无法追溯。

这些情况必须输出：

```text
review_required
或
blocked
```

不得通过默认时间、默认能力或伪造 Evidence 继续运行。

## 十五、建议新增文件

```text
src/ai/schemas/delayedRetestScheduling.schema.ts
src/ai/agents/delayedRetestSchedulingAgent.ts
src/ai/tests/runDelayedRetestSchedulingDebug.ts
```

新增命令：

```text
npm run debug:delayed-retest-scheduling
```

第一版使用内存输入与现有 Session History Fixture，不接 UI，不接提醒系统。

## 十六、Debug 最小流程

```text
1. 准备合法 LearningSessionHistoryResult
2. 准备同 student / ability 的 GrowthMemorySummary
3. 准备正式 AbilityEvidence
4. 注入 currentTime
5. 注入 delayed_retest_policy_v1
6. 选择最新合法基线 Evidence
7. 生成 DelayedRetestCandidate
8. 计算 plannedRetestAt
9. 生成或复用 DelayedRetestPlan
10. 输出 Scheduling Result
11. 输出 PASS / FAIL
```

## 十七、Debug Report

Debug 至少展示：

- Student ID；
- Target Ability；
- Source Session IDs；
- Source Evidence IDs；
- Baseline Evidence ID / Type / Time；
- GrowthMemory Recent Trend；
- Current Time；
- Policy Version；
- Interval Days；
- Planned Retest Time；
- Candidate Status；
- Plan ID / Status；
- Why Retest Now；
- Retest Goal；
- Validation Goal；
- Require New Material；
- Allow Hint；
- Next Step；
- Validation Issues；
- PASS / FAIL。

## 十八、最小 Debug Cases

### Case 1：growth Evidence，3 天前已发生

```text
latest Evidence = growth
currentTime >= createdAt + 3 days
-> Candidate = due
-> Plan = available
-> nextStep = create_task_request
```

### Case 2：positive Evidence，尚未到第 7 天

```text
-> Candidate = not_due
-> Plan = pending
-> nextStep = wait_until_due
```

### Case 3：positive Evidence，已到第 7 天

```text
-> Candidate = due
-> Plan = available
```

### Case 4：Evidence 变旧

```text
-> 可以生成复测计划
-> 不输出能力下降或退步结论
```

### Case 5：只有 weakness Evidence

```text
-> not_eligible
-> 不生成保持性复测计划
```

### Case 6：只有 insufficient Evidence

```text
-> not_eligible
-> collect / continue observation
```

### Case 7：studentId 或 ability 不一致

```text
-> blocked
```

### Case 8：Evidence 未关联正式 Session

```text
-> review_required
-> 不生成可执行 Plan
```

### Case 9：Session History 含 rejected records

```text
-> review_required
-> rejected record 不参与时间计算
```

### Case 10：重复调度

```text
同一 baseline Evidence + policy
-> 返回相同 candidateId / planId
-> 不重复创建计划
```

### Case 11：Evidence 时间晚于 currentTime

```text
-> review_required
```

### Case 12：计划到期

```text
-> nextStep = create_task_request
-> Phase 13.2 不直接生成 TaskRequest / ConcreteLearningTask
```

## 十九、验收标准

Phase 13.2 通过条件：

1. 已定义 `DelayedRetestCandidate` Schema；
2. 已定义 `DelayedRetestPlan` Schema；
3. 已定义 `DelayedRetestSchedulingResult` Schema；
4. 已实现 DelayedRetestSchedulingAgent；
5. 能消费合法 `LearningSessionHistoryResult.sessions`；
6. 无效 Session 不进入调度计算；
7. 能校验 studentId 与 targetAbilityId；
8. 能根据正式 Evidence `createdAt` 计算计划时间；
9. growth 使用 3 天规则；
10. positive 使用 7 天规则；
11. 到期和未到期状态可区分；
12. Evidence 变旧不会生成能力下降结论；
13. weakness / insufficient 不会被错误转换为保持性复测计划；
14. Plan 能追溯到 Session 和 Evidence；
15. `whyRetestNow` 非空且引用正式来源；
16. `validationGoal` 非空；
17. `requireNewMaterial === true`；
18. `allowHint === false`；
19. 重复运行不会重复创建计划；
20. `currentTime` 通过输入注入；
21. 计划到期不会直接生成题目；
22. 计划到期不会直接启动 LearningRound；
23. 不生成 Retest Evidence；
24. 不调用 Diagnosis Runtime；
25. 不更新 StudentAbilityProfile；
26. 不更新 GrowthMemory；
27. Debug 覆盖至少 12 个最小 Case；
28. Debug 输出 PASS；
29. Phase 13.1 与 Phase 12 回归通过；
30. Production Build 通过。

## 二十、本阶段不做

Phase 13.2 不做：

- 不做通知推送；
- 不做提醒日历；
- 不做复杂间隔重复算法；
- 不根据遗忘曲线自动调整天数；
- 不自动生成题目；
- 不直接生成 RetestTask；
- 不绕过 TaskRequest / TaskFulfillment；
- 不处理学生复测答案；
- 不生成 Retest Evidence；
- 不调用 Diagnosis Runtime；
- 不做 RetentionEvaluation；
- 不判断能力是否保持；
- 不判断能力是否退步；
- 不修改 StudentAbilityProfile；
- 不创建新的 GrowthMemory；
- 不接云端数据库；
- 不做正式 UI。

## 二十一、与 Phase 13.3 的关系

Phase 13.2 输出：

```text
DelayedRetestCandidate
DelayedRetestPlan
Scheduling Result
```

计划到期后由既有 Runtime 完成：

```text
TaskRequest
-> TaskFulfillment
-> ConcreteLearningTask
-> LearningRound
-> Delayed Retest AbilityEvidence
```

Phase 13.3 将消费：

```text
Baseline Evidence
+ Delayed Retest Evidence
+ Formal Comparison Sources
↓
RetentionComparisonFacts
↓
RetentionComparabilityResult
↓
RetentionEvaluationResult
```

Phase 13.2 不提前实现 Phase 13.3 的保持性比较。可比性由 Phase 13.3 Agent 根据正式对象派生，不能由调度模块预先指定。

## 二十二、完成定义

Phase 13.2 完成时，应能证明：

```text
合法 Session History 与正式 Evidence 时间
可以被确定性规则转换为延迟复测 Candidate；

Candidate 可以生成可追溯、可去重、可等待到期的 DelayedRetestPlan；

计划到期后只提供进入既有任务准备链路的流程动作，
不会直接创建题目、启动复测或形成能力结论。
```

完成后的准确能力是：

> 系统能够基于正式跨 Session 历史和 Evidence 时间，判断何时需要重新观察某项能力，并生成一条有来源、有理由、有时间约束的延迟复测计划。

它仍不证明复测已经执行、能力已经保持、学生已经退步或长期学习效果已经成立。

## 二十三、工程验收记录

验收日期：2026-07-16

验收状态：PASS
验收类型：Delayed Retest Scheduling 最小工程闭环

本次已完成：

- `delayedRetestScheduling.schema.ts`；
- `delayedRetestSchedulingAgent.ts`；
- `runDelayedRetestSchedulingDebug.ts`；
- `debug:delayed-retest-scheduling`。

Debug 共覆盖 13 个场景：

1. growth Evidence 满 3 天时生成 available Plan；
2. positive Evidence 未满 7 天时生成 pending Plan；
3. positive Evidence 满 7 天时生成 available Plan；
4. Evidence 时间变旧只触发重新观察，不输出能力下降结论；
5. 只有 weakness Evidence 时不生成保持性复测计划；
6. 只有 insufficient Evidence 时不生成保持性复测计划；
7. studentId 或 ability 不一致时阻断；
8. Evidence 未关联正式 Session 时进入复核；
9. Session History 含 rejected records 时进入复核；
10. 重复调度返回相同 candidateId 与 planId；
11. Evidence 时间晚于 currentTime 时进入复核；
12. available Plan 只输出任务链路交接动作，不直接生成 TaskRequest 或 ConcreteLearningTask。
13. cancelled Plan 允许生成新计划，并保留 `replacesPlanId` 与递增的 `rescheduleRevision`。

验收结果：

- Phase 13.2 Debug：13 / 13 PASS；
- Phase 13.1 Regression：15 / 15 PASS；
- Phase 12 Integrated Acceptance Regression：9 / 9 PASS；
- Production Build：PASS；
- 仅存在既有 bundle size warning，不阻断本阶段验收。

工程结论：

> Phase 13.2 已证明合法 Session History、GrowthMemory 与正式 Evidence 时间可以被确定性规则转换为可追溯、可等待、可去重的 DelayedRetestPlan；计划到期时只提供进入既有任务准备链路的流程动作，不越权生成题目、启动复测或形成能力结论。

当前边界：

- 第一版固定使用 growth 3 天、positive 7 天策略；
- `currentTime` 必须由调用方注入；
- 计划仅为 Runtime 对象，尚未接 UI、通知或日历；
- 当前尚未建立正式 `DelayedRetestPlanRepository`，`existingPlans` 由调用方提供；
- 计划的跨刷新恢复、到期查询和自动消费属于后续集成边界；
- 计划尚未实际转入 TaskRequest / TaskFulfillment；
- 不证明复测已经执行；
- 不证明能力保持、提升或退步；
- 不修改 StudentAbilityProfile 或 GrowthMemory；
- Phase 13.1 IndexedDB Browser Persistence Smoke Test：12 / 12 PASS。
