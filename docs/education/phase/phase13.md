# Phase 13：跨 Session 学习与延迟复测基础（Cross-Session Learning and Delayed Retest Foundation）

## 一、阶段定位

Phase 12 已经证明：

```text
真实 TaskResource
-> LearningRound
-> StudentResponse
-> AbilityEvidence
-> GrowthMemory
-> 保存与恢复
-> 下一轮 LearningRound
```

可以在单学生、本地持久化条件下连续运行。

但 Phase 12 主要验证的是同一次连续学习过程中的多轮运行。它尚未回答：

```text
学生结束一次学习后，
系统能否在未来重新读取历史，
在合适时间安排延迟复测，
并判断本次复测是否形成保持性观察？
```

Phase 13 不新增新的诊断模型，也不重新实现 Evaluation、ProfileUpdateDecision 或 GrowthMemory。

Phase 13 的任务是把已经成立的单轮、多轮 Runtime 延伸到多个 Learning Session 和不同时间点。

## 二、一句话定义

Phase 13 是跨 Session 学习与延迟复测基础。

它验证：

```text
学习历史能够跨 Session 保存和查询；
正式 Evidence 能够触发有来源的延迟复测计划；
延迟复测产生的新 Evidence 能够形成克制、可追溯的保持性观察。
```

### Phase 13 产品声明

> 系统能够在单学生、单浏览器本地环境下，跨 Session 保存和恢复正式学习历史，根据 Evidence 时间生成可追溯的延迟复测计划，并在复测后形成克制、可比较的保持性观察，同时验证延迟 Evidence 已完整进入既有 Evaluation、ProfileUpdateDecision 与 GrowthMemory 链路。

## 三、核心问题

Phase 13 只回答三个核心问题：

1. 多个 LearningRound 能否归入不同 LearningSession，并按学生、能力和时间查询？
2. 系统能否基于 Session History、GrowthMemory 和 Evidence 时间生成延迟复测计划？
3. 系统能否比较基线 Evidence 与延迟复测 Evidence，形成保持性观察，并安全关联延迟 Evidence 已有的正式 Evaluation 结果？

Phase 13 不回答：

- 学生是否已经长期掌握某项能力；
- 一次延迟复测失败是否代表能力退化；
- 复测策略是否已经具备长期教学有效性；
- 真实 AI 诊断是否已经在所有题型中稳定。

## 四、核心概念

### 1. LearningRound

`LearningRound` 表示一次从策略、任务执行到 Evidence 回流的最小学习回合。

```text
Strategy
-> Task
-> StudentResponse
-> Evidence Return
```

### 2. LearningSessionRecord

`LearningSessionRecord` 表示学生一次连续学习活动的正式历史记录。

一个 Session 可以包含一个或多个 LearningRound。

```text
LearningSessionRecord
├─ LearningRound 1
├─ LearningRound 2
└─ LearningRound 3
```

Session 是时间与活动容器，不是能力判断对象。

### 3. LearningSessionMemory

Phase 5.3 已存在 `LearningSessionMemory`，用于汇总训练过程中的多次任务执行。

Phase 13 不重新定义或替换该对象。

正式边界：

```text
LearningSessionMemory
= Phase 5.3 训练过程汇总

LearningSessionRecord
= Phase 13.1 跨天 Session 历史记录
```

### 4. DelayedRetestPlan

`DelayedRetestPlan` 表示基于正式历史与时间规则生成的待复测事项。

它不是题目，也不是 `RetestTask`。

计划到期后仍必须进入：

```text
DelayedRetestPlan
-> TaskRequest
-> TaskFulfillment
-> ConcreteLearningTask
-> LearningRound
```

### 5. RetentionEvaluationResult

`RetentionEvaluationResult` 表示基线表现与延迟复测表现之间的结构化比较观察。

它不直接修改 StudentAbilityProfile，也不是 Existing Phase 8 Evaluation Runtime 的输入。

## 五、完整目标链路

Phase 13 的完整目标链路：

```text
Session 1
↓
LearningRoundResult[]
↓
AbilityEvidence / GrowthMemory
↓
LearningSessionRecord
↓
跨天保存与查询
↓
GrowthMemorySummary
+ Session History
+ Evidence createdAt
+ Current Time
↓
DelayedRetestCandidate
↓
DelayedRetestPlan
↓
计划到期
↓
TaskRequest
↓
TaskFulfillment
↓
新的 ConcreteLearningTask
↓
Session 2 / Delayed Retest Round
↓
新的 Retest AbilityEvidence
├─ Existing Phase 8 Evaluation Runtime（只执行一次）
│  ↓
│  EvaluationResult
│  ↓
│  ProfileUpdateDecision
│  ↓
│  GrowthMemoryRecord
│
└─ Baseline Evidence + Delayed Evidence
   ↓
   RetentionComparisonFacts
   ↓
   RetentionComparabilityResult
   ↓
   RetentionEvaluationResult
   ↓
   关联并解释已有 Evaluation / Decision / GrowthMemory
```

当前 Phase 9.3 在成功生成 delayed Evidence 时已经同步执行 Existing Phase 8 Runtime。为避免同一 Evidence 重复更新 Profile，Phase 13.3 第一版采用安全复用顺序：

```text
Delayed Retest Evidence
-> Existing Phase 8 Runtime（由 Phase 9.3 执行一次）
-> RetentionEvaluationResult
-> 关联并复用原 EvaluationResult / ProfileUpdateDecision / GrowthMemoryRecord
```

未来只有在出现“Evidence 尚未进入 Phase 8”的正式受控分支时，才允许由 Orchestrator 将原始 `AbilityEvidence` handoff 给 Existing Phase 8 Runtime 一次。`RetentionEvaluationResult` 本身永远不是 handoff 输入。无法确认 Evidence 是否已处理时必须进入复核，不得重复执行。

## 六、与既有阶段的关系

### Phase 5.3

Phase 5.3 提供 `LearningSessionMemory`。

Phase 13.1 不修改该模型，而是新增正式 Session 历史对象。

### Phase 6

Phase 6 提供：

```text
RetestTask
Retest Evidence
AbilityChangeEvaluation
```

Phase 13 不重复即时复测能力。

Phase 13 增加的是跨时间调度与保持性比较。

### Phase 8

Phase 8 继续负责：

```text
EvaluationResult
ProfileUpdateDecision
Profile Decision Execution
GrowthMemory
NextLearningStrategy
TaskRequest
TaskFulfillment
```

延迟复测产生的原始 AbilityEvidence 继续由 Phase 8 负责正式 Evaluation、ProfileUpdateDecision 和 GrowthMemory 回流。Phase 13.3 只关联并解释这些已有正式结果，不把保持性观察适配成新的 Phase 8 输入，也不创建第二条画像更新链路。

### Phase 9 / 10

Phase 9、10 继续负责真实任务执行与 LearningRound 编排。

Phase 13.2 不直接拼题或启动复测。

### Phase 12

Phase 12 提供：

- 正式 TaskResource；
- LearningRound 持久化；
- IndexedDB Repository 边界；
- 连续多轮运行；
- GrowthMemory 回流。

Phase 13 在这些正式数据之上建立跨 Session 能力。

## 七、Phase 13 拆分

Phase 13 拆为三个最小闭环。

### Phase 13.1：Learning Session History

核心问题：

```text
系统能否保存和查询学生跨 Session 发生过什么？
```

最小链路：

```text
LearningPersistenceRecord[]
+ LearningRoundResult[]
↓
LearningSessionRecord
↓
LearningSessionRepository
↓
按 student / ability / time 查询
```

Phase 13.1 只记录事实，不判断保持性。

当前工程状态：Runtime PASS（2026-07-16）。

已完成 LearningSessionRecord、Repository、内存与 IndexedDB Adapter、查询 Agent 和 15 场景 Debug。

无效历史已经与正式 `sessions` 隔离，completed Session 已与 Round 完成事实建立严格不变量。IndexedDB Browser Persistence Smoke Test 已完成真实跨刷新验收，刷新恢复、索引查询、未完成 Session 恢复、版本隔离、幂等保存、Round 冲突阻断与清空均通过。

### Phase 13.2：Delayed Retest Scheduling

核心问题：

```text
系统能否根据正式历史、Evidence 时间和明确规则，生成有来源、有理由的延迟复测计划？
```

最小链路：

```text
GrowthMemorySummary
+ Session History
+ Evidence Time
+ Current Time
↓
DelayedRetestCandidate
↓
DelayedRetestPlan
```

第一版使用明确、可重复的时间规则，例如训练后第 3 天或第 7 天。

当前工程状态：Runtime PASS（2026-07-16）。

Phase 13.2 已完成 Candidate、Plan、Scheduling Result、确定性时间策略、幂等规则、取消后重调度追溯、失败分支和与既有 TaskRequest / TaskFulfillment 的边界，共 13 个 Debug 场景通过。该阶段只生成延迟复测计划，不创建题目、不启动复测、不形成保持性判断。

### Phase 13.3：Retention Evaluation

核心问题：

```text
基线 Evidence 与延迟复测 Evidence 之间，是否存在可比较的保持性观察？
```

最小链路：

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
↓
关联 delayed Evidence 已有的 Evaluation / Decision / GrowthMemory
```

Phase 13.3 不直接更新 Profile。

当前工程状态：Runtime PASS（2026-07-16）。

Phase 13.3 已完成 RetentionComparisonFacts、RetentionComparabilityResult、RetentionEvaluationResult、可比性派生闸门、提示依赖、材料与难度约束及 Existing Phase 8 结果关联。18 / 18 Debug、Phase 13.1 / 13.2 / 9.3 / Phase 12 回归与 Production Build 均通过；EvaluationResult、ProfileUpdateDecision 与 GrowthMemoryRecord 必须全部追溯本次 delayed Evidence，RetentionResult 不重复更新 Profile 或 GrowthMemory。

## 八、Phase 13 核心数据对象

Phase 13 至少涉及：

- `LearningSessionRecord`；
- `LearningSessionQuery`；
- `LearningSessionHistoryResult`；
- `DelayedRetestCandidate`；
- `DelayedRetestPlan`；
- `RetentionComparisonFacts`；
- `RetentionComparabilityResult`；
- `RetentionEvaluationResult`；
- 既有 `LearningPersistenceRecord`；
- 既有 `AbilityEvidence`；
- 既有 `GrowthMemorySummary`；
- 既有 `TaskRequest`；
- 既有 `ConcreteLearningTask`；
- 既有 `EvaluationResult`；
- 既有 `ProfileUpdateDecision`；
- 既有 `GrowthMemoryRecord`。

## 九、跨阶段安全原则

### 1. Session 结束不等于学习目标完成

Session 可以因为以下原因结束：

- 学生主动结束；
- 达到计划轮数；
- 暂时停止；
- Runtime 阻断；
- 需要人工复核。

以上状态都不能直接形成能力结论。

### 2. Evidence 变旧不等于能力下降

Evidence 时间只用于判断是否需要重新观察。

```text
Evidence 变旧
-> 可信度或新鲜度需要重新验证
-> 可以安排保持性复测
```

不能推导为：

```text
Evidence 变旧
-> 能力自动下降
```

### 3. 复测计划到期不等于自动开始复测

到期计划必须通过既有任务链获得正式任务。

调度模块不得直接生成题目或创建 Evidence。

### 4. 延迟复测必须产生新的正式 Evidence

不得：

- 复制旧 Evidence 并更换时间戳；
- 因学生打开页面而标记复测完成；
- 因计划到期而创建 positive / weakness Evidence；
- 绕过 ResponseValidity 与 Diagnosis Runtime。

### 5. 保持性比较必须检查可比性

至少检查：

- 同一目标能力；
- 任务角色是否为复测或迁移验证；
- 是否使用提示；
- 是否为原题、相似题或新情境；
- 作答是否有效；
- Diagnosis 是否通过一致性校验；
- 基线与延迟任务难度是否具备最低可比性。

### 6. 保持性观察不直接更新 Profile

正式能力更新链路为：

```text
Delayed AbilityEvidence
-> Existing Evaluation Runtime（只执行一次）
-> ProfileUpdateDecision
```

保持性观察链路为：

```text
Baseline Evidence + Delayed Evidence
-> RetentionEvaluationResult
-> 关联并解释已有正式回流结果
```

当前 Phase 9.3 已经让 delayed Evidence 进入 Existing Evaluation Runtime，因此第一版 13.3 只关联并复用已有 EvaluationResult、ProfileUpdateDecision 和 GrowthMemoryRecord，不重复执行正式回流。`RetentionEvaluationResult` 不参与这次画像更新判断。

Phase 13 不创建新的 Profile Executor，也不把 RetentionEvaluationResult 转换成重复 AbilityEvidence。

## 十、时间、版本与幂等原则

Phase 13 涉及跨天数据，必须显式记录：

- `createdAt`；
- `updatedAt`；
- `startedAt`；
- `endedAt`；
- `lastActivityAt`；
- `scheduledFor`；
- `completedAt`；
- `timezone`；
- `schemaVersion`；
- `policyVersion`。

Debug 中的当前时间必须通过输入注入，不得完全依赖机器当前时间。

同一 Session、计划、TaskRequest 和延迟复测结果不得因刷新、恢复或重复调度而重复创建。

## 十一、Phase 13 总体验收标准

Phase 13 完成时，应能证明：

1. 多个 LearningRound 可以归入不同 LearningSessionRecord；
2. Session History 可以跨天保存；
3. 可以按 studentId、abilityId 和时间范围查询 Session；
4. 未完成回合可以被明确识别；
5. Session 结束不会被解释为学习目标完成；
6. 可以基于正式 Session / Evidence / GrowthMemory 生成延迟复测计划；
7. 计划包含来源、时间、理由、目的和提示限制；
8. 计划到期不会绕过 TaskRequest / TaskFulfillment；
9. 延迟复测必须产生新的正式 Evidence；
10. 保持性比较会检查目标能力、任务角色、提示和作答有效性；
11. 一次延迟失败不会直接形成能力退化结论；
12. RetentionEvaluationResult 可以安全关联既有 Phase 8 Runtime 结果，但不会作为 Phase 8 输入；只有原始 Evidence 尚未处理时才允许由 Orchestrator 单次 handoff；
13. ProfileUpdateDecision 和 GrowthMemory 仍由既有模块生成；
14. 重复恢复、重复调度和重复提交不会污染正式数据；
15. Debug 可重复运行；
16. Production Build 通过。

## 十二、冻结结论

验收日期：2026-07-16

验收结论：PASS / Frozen

```text
Phase 13.1 Debug                 15 / 15 PASS
Phase 13.1 Browser Smoke        12 / 12 PASS
Phase 13.2 Debug                13 / 13 PASS
Phase 13.3 Debug                18 / 18 PASS
Phase 9.3 Regression            PASS
Phase 12 Integration             9 / 9 PASS
Production Build               PASS
```

Phase 13 已证明跨 Session 学习历史、延迟复测调度和保持性观察最小闭环成立，可以冻结。完整记录见 `phase13_acceptance_report.md`。

该冻结结论验证的是本地持久化、调度规则、保持性比较和正式结果关联，不表示系统已经在真实自然日内自动完成 `DelayedRetestPlan -> TaskRequest -> TaskFulfillment -> LearningRound` 的端到端执行。

## 十三、本阶段不做

Phase 13 不做：

- 不做复杂提醒系统；
- 不做通知推送；
- 不做日历产品；
- 不做复杂间隔重复算法；
- 不自动生成题目；
- 不绕过 TaskFulfillment；
- 不重新实现 Diagnosis Runtime；
- 不修改 DiagnosisResult Schema；
- 不创建第二套 Evaluation；
- 不直接修改 StudentAbilityProfile；
- 不做长期成长报告；
- 不做多学生账号系统；
- 不证明长期学习效果。

## 十四、阶段完成定义

Phase 13 完成时，系统应能证明：

```text
一次学习 Session 的正式结果可以跨天保存；
历史与 Evidence 时间可以生成延迟复测计划；
延迟复测产生的新 Evidence 可以形成保持性观察；
保持性观察可以关联并解释该 Evidence 已有的正式评估与成长记忆结果。
```

完成后的准确产品能力是：

> 系统能够跨 Session 保存正式学习历史，根据历史与证据时间生成可追溯的延迟复测计划；新产生的复测 Evidence 继续由已有 Evaluation Runtime 完成一次正式回流，Phase 13.3 在此基础上生成克制、可比较的保持性观察，并关联已有正式结果。

这仍然不代表学生已经长期掌握能力，也不代表系统已经证明长期教学效果。
