# Phase 16.3：真实学习运行与多日连续使用（Real Learning Operation and Multi-day Continuity）

设计状态：ACCEPTED

工程状态：IN PROGRESS（16.3A `PASS / FROZEN`：Deterministic Debug `14 / 14 PASS`、Lightweight Demo Acceptance `PASS`、Controlled Real Provider Integration `11 / 11 PASS`；16.3B `PASS / FROZEN`：Debug `14 / 14`、Controlled Demo `11 / 11`、PC / 平板人工验收与 Production Build `PASS`；Day 0 串联 `11 / 11 PASS`；16.3C Engineering Preflight、Application Boundary Controlled Live Smoke 与 Lightweight Demo Acceptance `PASS`：Multi-day Simulation `10 / 10`、正式 `/learning`、真实 Provider 回流、策略驱动下一 Frozen Resource、IndexedDB 恢复、受控多日人工验收与浏览器 Smoke 已成立；5—7 个自然日验收 `PENDING (0 / 5)`）

前置基线：

- Phase 16.1 `PASS`：正式题目能够完成 Draft、校验、人工审核、冻结和版本追溯；
- Phase 16.2 `PASS / FROZEN`：正式资源能够经过核心资格与上下文匹配质量 Gate，形成 `matched / partial_match / no_match / review_required`；
- Phase 1–16.2 单对象确定性 E2E：`5 / 5 PASS`；
- Phase 16 真实 Provider 单对象 Smoke：`5 / 5 PASS`，验证一次受控 DeepSeek 调用能够形成 Formal Diagnosis、Evidence、Phase 8 / 14 结果、受控反馈和下一 TaskRequest；
- Production Build：PASS；
- 上述单对象基线随后已由 6.12 的持久化第二资源 Controlled Live 补齐，Phase 16.3A 已完成；统一学生入口仍属于 Phase 16.3B。

## 一、阶段定位

Phase 16.1 已回答：

> 哪些真实题目可以成为正式、可追溯、不可静默修改的 Frozen Resource？

Phase 16.2 已回答：

> 当前 TaskRequest 可以安全匹配哪一份正式资源？

Phase 16.3 继续回答：

> 正式资源、真实学生作答、真实 AI Diagnosis、长期状态和下一任务，能否在统一入口中连续运行，并在多个自然日和异常发生后保持可恢复、可追溯且不污染正式事实？

Phase 16.3 不是重新实现 LearningRound、Diagnosis、Evidence、Evaluation、Profile、GrowthMemory、Delayed Retest 或 TaskFulfillment。

本阶段只负责把既有正式模块串成真实产品运行，并验证：

1. 同一个学生和同一条正式业务链可以贯穿完整身份；
2. 第一轮正式结果能够持久化并真实驱动第二份正式任务；
3. 学生不需要访问多个 Demo 地址即可开始、继续、复测和查看结果；
4. 多日运行中的刷新、失败、复核、缺席和资源版本变化不会污染正式状态；
5. 所有正式结果可以被人工回放和复核。

## 二、一句话定义

> 先完成真实学习主链的端到端联调和统一使用入口，再验证单个真实学生能否在多个自然日中安全、连续、可恢复地完成学习。

## 三、内部工作包与顺序

Phase 16.3 只保留一个正式 Phase 文档，内部拆为三个有严格进入条件的工作包：

```text
Phase 16.3A Real Learning Chain Integration
真实主链、真实 Provider、持久化恢复和下一正式任务
↓
Phase 16.3B Unified Learning Entry
统一学生入口与隔离的内部复核入口
↓
Phase 16.3C Real Multi-day Operation
5—7 个自然日真实运行
↓
Phase 16.3 Unified Acceptance / Freeze
```

进入规则：

1. 16.3A 未通过，不得用多日试用代替串联联调；
2. 16.3B 未通过，不得要求学生依赖多个 Demo 地址完成多日使用；
3. 只有 16.3A 和 16.3B 均通过，才进入 16.3C；
4. 16.3C 的自然日运行不能用时间模拟 Debug 替代；
5. A、B、C 是工程工作包，不新增 `16.3.1`、`16.3.2` 等更细 Phase。

## 四、权威链路

Phase 16.3 的正式链路为：

```text
Frozen Question Resource A
+ ResourceRegistry Current Head
+ AdaptiveTaskRequestEnvelope
↓
Phase 16.2 Resource Matching Quality
↓
QualityGatedExecutableTask
↓
Frozen Resource -> Concrete Task Adapter
↓
ConcreteLearningTask
↓
TaskExecutionSession
↓
StudentResponse
↓
ResponseValidityResult
├─ invalid
│  → retry / supplement_response
│  → 不调用 Provider
│  → 不生成 Diagnosis / Evidence
│
└─ valid
   ↓
   Real LLM Diagnosis Runtime
   ↓
   Diagnosis Quality Gate
   ├─ accepted
   │  ↓
   │  Formal Diagnosis Commit
   │  ↓
   │  AbilityEvidence
   │  ↓
   │  Existing Phase 8 Runtime
   │  ↓
   │  EvaluationResult
   │  ↓
   │  ProfileUpdateDecision
   │  ↓
   │  GrowthMemoryRecord
   │  ↓
   │  Phase 14 Evidence Quality Assessment
   │  ↓
   │  Controlled Student Feedback
   │
   ├─ questionable
   │  → review_required
   │  → 不自动生成正式 Evidence
   │
   └─ unacceptable / critical / provider_failed
      → blocked / retry / human_review
      → 不生成 mock Diagnosis
      → 不污染正式状态
↓
GrowthMemorySummary
↓
NextLearningStrategy
↓
AdaptiveTaskRequestEnvelope
↓
Phase 16.2 Resource Matching Quality
↓
Frozen Question Resource B
↓
Next ConcreteLearningTask
```

## 五、正式权威关系

Phase 16.3 必须保持以下权威关系：

```text
FrozenQuestionResourceVersion
= 本次任务内容与资源版本事实

ResponseValidityResult
= 是否存在值得诊断的可观察表现

FormalDiagnosisCommit
= 包含通过真实 Provider、Schema、身份、边界和质量 Gate 后提交的正式 DiagnosisResult

AbilityEvidence
= 正式作答经过 Diagnosis 转换后的能力观察

EvaluationResult / ProfileUpdateDecision / GrowthMemoryRecord
= Existing Phase 8 Runtime 的正式长期状态处理结果

EvidenceQualityAssessment
= 本次 Evidence 的判断价值，不等于能力等级

NextLearningStrategy
= 下一步教育方向唯一来源

AdaptiveTaskConstraints
= 下一任务结构化约束唯一来源

Phase 16.2 Match Result
= 正式资源是否满足当前执行条件

Student View State
= 已有正式状态的展示映射，不是教育判断来源
```

禁止：

- 页面根据学生答案自行形成 Diagnosis；
- Orchestrator 自行补造替代 Evidence、Profile 或 GrowthMemory；
- Resource Match 页面直接决定下一教育策略；
- Student Feedback 反向修改 Diagnosis 或 Evidence；
- 页面刷新重新运行已经正式完成的 Diagnosis；
- Provider 失败后静默调用 mock Diagnosis 并形成正式 Evidence。

## 六、Phase 16.3A：真实学习主链串联联调

### 6.1 核心问题

> 同一个学生、第一份正式资源和一次真实作答，能否经过真实 AI 与全部正式 Gate 形成长期状态，并在恢复后匹配出由本轮结果驱动的第二份正式资源？

### 6.2 正式输入

至少包括：

- `studentId`；
- 当前 `StudentAbilityProfile`；
- 当前 `GrowthMemorySummary`；
- 当前 `LearningSessionHistory`；
- `AdaptiveTaskRequestEnvelope`；
- Phase 16.1 Repository 中至少两份审核有效的 Frozen Resource；
- ResourceRegistry Snapshot；
- Phase 16.2 `QualityGatedExecutableTask`；
- 学生真实作答；
- 真实 Provider 配置的版本引用；
- Prompt Version、Quality Policy Version 和 Runtime Config Version；
- Repository 与幂等键。

第一份资源用于完成 Round 1。第二份资源用于证明下一 TaskRequest 能再次经过正式 Registry 与 Phase 16.2 匹配，不是展示层固定 Mock。

### 6.3 正式输出

16.3A 不新增教育判断对象。它输出已有正式对象和一份验收报告：

- `ConcreteLearningTask`；
- `TaskExecutionResult`；
- `FormalDiagnosisCommit`（内含通过校验的正式 `DiagnosisResult`）；
- `TaskEvidenceReturnResult`；
- `EvaluationResult`；
- `ProfileUpdateDecision`；
- `GrowthMemoryRecord`；
- `EvidenceQualityAssessment`；
- `StudentLearningFeedback`；
- `NextLearningStrategy`；
- 下一份 `AdaptiveTaskRequestEnvelope`；
- 下一份 Phase 16.2 Match Result；
- 下一份 `ConcreteLearningTask`；
- `RealLearningChainAcceptanceReport`。

工程实现使用 `RealLearningOperationCheckpoint` 记录编排阶段、恢复位置和下一流程动作。该对象只是运行控制与恢复快照，不是新的教育判断对象，也不替代 `FormalDiagnosisCommit`、`AbilityEvidence`、`ProfileUpdateDecision` 或 `GrowthMemoryRecord` 的权威地位。

`RealLearningChainAcceptanceReport` 只是运行验收与追溯对象，不是新的能力事实：

```ts
type RealLearningChainAcceptanceReport = {
  acceptanceRunId: string;
  studentId: string;
  startedAt: string;
  completedAt?: string;

  status:
    | 'completed'
    | 'blocked'
    | 'retry_required'
    | 'review_required';

  firstRound: {
    learningSessionId: string;
    learningRoundId: string;
    resourceId: string;
    resourceVersionId: string;
    taskId: string;
    executionSessionId: string;
    responseId: string;
    diagnosisResultId?: string;
    evidenceIds: string[];
  };

  persistence: {
    formalResultSaved: boolean;
    recoveredAfterRepositoryRecreation: boolean;
    diagnosisReexecutedDuringRecovery: boolean;
    duplicateFormalWrites: string[];
  };

  nextTask?: {
    strategyId: string;
    taskRequestId: string;
    matchResultId: string;
    resourceId: string;
    resourceVersionId: string;
    taskId: string;
  };

  checks: Record<string, boolean>;
  issues: string[];
};
```

### 6.4 身份与追溯不变量

必须验证：

1. `studentId` 在 Session、Round、Response、Diagnosis、Evidence、Evaluation、Profile、GrowthMemory 和下一 Strategy 中一致；
2. `resourceId` 与 `resourceVersionId` 保留在正式 Resource / Match / Acceptance 追溯中，`resource taskId -> ExecutableLearningTask.sourceTaskId -> ConcreteLearningTask.sourceExecutableTaskId` 链路闭合；
3. 实例化后的 `ConcreteLearningTask.taskId`、`executionSessionId`、`responseId` 和 `formalDiagnosisId` 在执行与 Evidence Trace Links 中完整一致；资源题目 `taskId` 与实例任务 `taskId` 不得被误当成同一层身份；
4. Evaluation、ProfileUpdateDecision 与 GrowthMemory 能追溯到同一组新 Evidence；
5. 下一 Strategy 可以追溯到更新后的 GrowthMemory；
6. 下一 TaskRequest 可以追溯到下一 Strategy；
7. 下一任务必须来自 Registry 当前 Frozen Head；
8. 旧版本被 supersede 后，已完成历史仍引用旧版本，新执行不得继续选择旧版本。

### 6.5 Provider 与 Diagnosis 安全边界

真实 Provider 只能在受控 Runtime 或服务端边界中调用。

不得：

- 将 API Key 放入浏览器代码、前端环境变量、URL、日志或 Git；
- 把完整 Prompt、Raw Output 或完整学生敏感内容返回给学生页面；
- Provider 失败后用 mock Diagnosis 形成正式 Evidence；
- 把 `questionable` 结果当作 accepted；
- 自动修复 mainAbility、answerStatus、rootCause 或学生引用等核心语义字段；
- 因反馈表达失败撤销已经合法提交的 Formal Diagnosis。

允许的失败处理：

```text
timeout / rate_limit / provider_unavailable
→ bounded retry
→ retry_required / blocked

schema / identity / semantic boundary failure
→ controlled structural repair when allowed
→ review_required / blocked

feedback expression failure
→ deterministic template fallback
→ 不重新运行 Diagnosis
```

这里的“安全回退”只适用于学生反馈模板，不适用于正式 Diagnosis。

### 6.6 持久化与幂等规则

同一正式运行至少使用以下稳定幂等身份：

- `learningSessionId`；
- `learningRoundId`；
- `executionSessionId`；
- `responseId`；
- Diagnosis `requestId`；
- `formalDiagnosisId`；
- `evidenceId`；
- `evaluationId`；
- `profileUpdateDecisionId`；
- `growthMemoryRecordId`。

必须满足：

1. 重复提交同一 `responseId` 不重复调用 Provider；
2. 同一 Diagnosis Request 只能产生一份 Formal Commit；
3. 同一 Formal Diagnosis 不重复生成 Evidence；
4. 同一 Evidence 不重复执行 Profile Update；
5. 页面刷新只恢复已保存对象，不重新执行已经完成的正式步骤；
6. 提交中刷新时先查询已有执行状态，不直接重发；
7. 持久化失败时保留当前 Runtime 结果并停止进入下一任务；
8. 重试持久化不得重新运行 Diagnosis；
9. 版本不兼容或损坏记录进入 rejected / blocked，不拼装成正常学习状态。

### 6.7 16.3A 自动化验收 Cases

至少覆盖：

**Case A1：完整成功链路**

```text
Formal Resource A
→ Real Diagnosis accepted
→ Formal Evidence
→ Phase 8 / Phase 14
→ Feedback
→ Updated Memory
→ Next Strategy / Request
→ Formal Resource B
```

预期：全链身份闭合，下一正式任务可执行。

**Case A2：无效作答**

空答案、占位回答或高确定性无意义输入。

预期：Provider 调用次数为 0，不生成 Diagnosis 或 Evidence。

**Case A3：Provider 临时失败**

预期：`retry_required / blocked`，不生成 mock Diagnosis，不修改 Profile。

**Case A4：Diagnosis Schema 或身份非法**

预期：`review_required / blocked`，不进入 Evidence Return。

**Case A5：Diagnosis Quality = questionable**

预期：人工复核，不自动生成正式 Evidence。

**Case A6：能力错位**

预期：不把结果作为目标能力 Evidence，不更新目标 Profile。

**Case A7：重复提交**

预期：复用同一 Formal Commit 和 Evidence，Provider 不重复调用。

**Case A8：完成后刷新恢复**

预期：恢复反馈、结果和下一入口，不重新运行 Diagnosis。

**Case A9：提交中刷新**

预期：查询已有状态，避免重复提交和重复回流。

**Case A10：下一资源不存在**

预期：形成 `no_match / ResourceGap`，不放宽能力约束凑题。

**Case A11：下一资源为 superseded 版本**

预期：创建下一任务前 Registry 二次检查阻断旧版本。

**Case A12：下一资源能力错位**

预期：`review_required / no_match`，不得因题目内容完整而放行。

**Case A13：持久化失败**

预期：Round Runtime 结果保留，下一任务不启动；存储重试不重新执行 Diagnosis。

**Case A14：恢复后正式数据驱动下一任务**

预期：重新创建 Repository 后读取正式 Profile / GrowthMemory / History，形成新的 Strategy 和 Resource B，不复用固定 Mock。

### 6.8 16.3A 人工联调

自动化 Debug 通过后，使用脱敏或明确授权的真实数据进行受控人工联调：

- 一次真实 Provider 调用；
- 一次有效真实作答；
- 一次无效作答阻断；
- 一次能力错位或复核分支；
- 一次刷新恢复；
- 一次下一正式资源匹配。

人工联调只展示必要追溯摘要，不展示 API Key、完整 Prompt、Raw Output 或完整敏感答案。

### 6.9 16.3A 完成条件

16.3A PASS 必须同时满足：

1. A1—A14 确定性 Cases 通过；
2. 真实 Provider 受控联调通过；
3. 至少两份正式 Frozen Resource 被同一链路连续消费；
4. 刷新恢复不重复运行正式步骤；
5. 幂等写入与身份追溯通过；
6. Existing Phase 8、13、14、15、16.1、16.2 关键回归通过；
7. Production Build 通过；
8. 形成脱敏 16.3A Acceptance Report。

16.3A PASS 只表示真实产品主链和恢复基础成立，不表示学生已经可以从统一入口独立使用，也不表示多日运行已经完成。

### 6.10 2026-07-21 工程 Debug Checkpoint

- `RealLearningOperationCheckpoint` 与 Repository 边界已实现；
- 正式资源到 Concrete Task Adapter 已接入 16.3A Orchestrator；
- A1—A14 Deterministic Debug：`14 / 14 PASS`；
- Phase 1—16.2 单对象 E2E：`5 / 5 PASS`；
- Phase 16.1 -> 16.2 Integration：`5 / 5 PASS`；
- Phase 15 Integrated Debug：`11 / 11 PASS`；
- Phase 12.1 Persistence Debug：`13 / 13 PASS`；
- Production Build：PASS；
- 本轮使用 Scripted Provider，不调用 DeepSeek Live，也不替代 6.8 的受控真实 Provider 与人工联调。

详细记录见 [Phase 16.3A Engineering Debug Acceptance](./reports/phase16_3a_engineering_debug_acceptance_2026-07-21.md)。

### 6.11 轻量联调 Demo Checkpoint（2026-07-21）

已新增独立入口：

```text
/#/phase16-3-real-chain-demo
```

Demo 直接调用 16.3A Orchestrator，并以 Scripted Provider 隔离外部费用与密钥。当前覆盖：

- 正常完整回流，并展示来自另一条 Frozen Resource 的下一正式任务；
- 无效作答在 Provider 前阻断；
- `questionable` Diagnosis 进入人工复核且不生成 Evidence；
- 下一资源能力错位时输出 `no_match`，不使用错误资源凑匹配；
- 同一答案重复提交复用正式结果，Provider 调用和 Evidence 数量不增加；
- 学生题目与反馈区不展示内部 ID，运行检查位于独立折叠区域；
- PC 宽屏与 1024×768 平板视口 Browser Smoke 通过；
- Production Build 通过。

人工验收已确认上述 Case 全部通过，正式记录见 [Phase 16.3A Lightweight Demo Acceptance](./reports/phase16_3a_demo_acceptance_2026-07-21.md)。

该 PASS 只表示 Scripted Provider 下的轻量联调入口、阻断分支和幂等展示成立，不替代受控真实 Provider 串联。后续受控真实 Provider 验收见 6.12。

### 6.12 Controlled Real Provider Acceptance（2026-07-21）

在明确授权下，使用 DeepSeek `deepseek-v4-flash` 与 Prompt v4 完成一次 Phase 16.3A 受控真实串联：

- Controlled Live：`11 / 11 PASS`；
- DeepSeek 调用 `1` 次，Retry `0`；
- Formal Diagnosis Commit、Evidence、Profile、GrowthMemory 和下一 Frozen Resource 全部形成；
- 重复提交与 Repository 重建恢复后 Provider 调用仍保持 `1` 次，Evidence 保持 `1` 条；
- 无效作答在 Provider 前阻断；
- questionable Diagnosis 进入 `review_required` 且不生成 Evidence；
- 普通 Live 的准入依据为 `formal_runtime_validation`，并保留 `not_individually_human_annotated` limitation，不伪装为 Dataset 人工 accepted 样本；
- Phase 1–16.2、Phase 12、14、15、16.1→16.2 关键回归与 Production Build 通过；
- API Key、完整 Prompt 和 Raw Model Output 未写入日志、报告或 Git。

详细脱敏记录见 [Phase 16.3A Controlled Real Provider Integration Acceptance](./reports/phase16_3a_controlled_real_provider_acceptance_2026-07-21.md)。

至此 6.9 的 16.3A 完成条件全部满足，Phase 16.3A 正式标记为 `PASS / FROZEN`，可以进入 Phase 16.3B。该结论仍不代表统一学生入口或 5—7 个自然日运行已经完成。

## 七、Phase 16.3B：统一学生学习入口与内部复核入口

### 7.1 核心问题

> 学生是否能够从一个稳定入口开始或继续学习，而不需要知道多个 Demo 地址、内部 Phase 或 Runtime 状态？

### 7.2 学生入口最小能力

第一版只提供一个轻量学习入口，至少能表达：

- 开始学习；
- 继续未完成 Session；
- 当前学习任务；
- 待完成延迟复测；
- 最近一次学习状态；
- 恢复的答案草稿；
- 查看本轮反馈或结果；
- `review_required`、`retry_required`、`blocked` 的学生可读提示；
- 结束当前学习；
- 在正式结果保存后进入下一任务。

学生入口不展示：

- Schema；
- 内部 ID；
- Evidence / Profile 原始对象；
- Prompt、Raw Output、Provider 错误；
- `weak / confidence / canEnterDiagnosisRuntime` 等工程字段；
- 资源审核或匹配调试信息。

### 7.3 入口状态优先级

统一入口应按以下顺序决定当前页面：

```text
需要人工复核或正式阻断
>
已有提交正在恢复或分析
>
未完成 LearningRound
>
已到期且可开始的 Delayed Retest
>
已完成但尚未查看的反馈 / Summary
>
可开始的新 LearningRound
>
暂无可用任务
```

页面不得因为同时存在多个状态而重复启动 Session 或跳过复核。

### 7.4 单一活动上下文

第一版必须保证：

1. 同一学生在同一浏览器中最多只有一个当前活动 LearningSession；
2. 同一 Session 最多只有一个当前活动 LearningRound；
3. 刷新和重复点击“开始学习”不会创建新 Session；
4. 已提交响应不能恢复为可再次提交的旧草稿；
5. 延迟复测入口必须引用正式 RetestPlan，不由页面自行创建；
6. 下一任务入口只能消费正式保存后的 `LearningRoundResult.nextStep` 和新 Strategy；
7. 学生主动结束只结束体验流程，不自动形成能力结论。

### 7.5 内部复核入口

内部工作台可以保留独立入口，第一版至少支持查看：

- 题目录入、审核、冻结和版本；
- Resource Match 的成功、部分匹配、缺口与复核理由；
- Diagnosis Quality Gate 与 Formal Commit 状态；
- Evidence、Evaluation、ProfileUpdateDecision 和 GrowthMemory 追溯；
- Session / Round 恢复状态；
- Provider、持久化和版本异常的脱敏摘要；
- 人工复核决策及其来源记录。

内部入口不得与学生体验区混排。第一版不要求完整账号权限系统，但必须具有明确的开发者 / 复核模式边界，学生默认路径不能进入内部页面。

### 7.6 受控 Runtime 边界

统一学生入口不得直接调用外部 Provider。

正式关系应为：

```text
Student Browser
→ Controlled Application / Runtime Boundary
→ Provider Adapter
→ Validation / Quality Gate
→ Formal Result
→ Student View Adapter
```

浏览器只能接收学生完成流程所需的正式状态和可读反馈。

### 7.7 16.3B 人工验收 Cases

至少覆盖：

1. 新学生从统一入口开始第一轮；
2. 已有未完成 Round 时显示“继续学习”，不重复启动；
3. 草稿刷新后恢复；
4. 已完成 Round 刷新后恢复反馈，不重新分析；
5. 待复测事项在到期后出现明确入口；
6. 无效作答原地返回修改，不进入结束页；
7. `review_required` 使用克制说明，不展示底层错误；
8. `no_match` 不展示残缺任务，提供可理解的稍后继续状态；
9. Provider 分析中防止重复提交；
10. 学生区不暴露 Runtime 字段和内部追溯 ID；
11. 内部复核入口能回放本轮正式链路；
12. PC 与平板上开始、阅读、作答、反馈和继续入口可操作。

### 7.8 16.3B 完成条件

16.3B PASS 必须满足：

1. 学生可以从一个入口完成开始、继续、复测、反馈和结束；
2. 不依赖多个 Demo URL；
3. 刷新不重复创建 Session / Round；
4. 学生入口与内部复核入口隔离；
5. 关键异常具有学生可理解的下一步；
6. PC / 平板人工验收通过；
7. 浏览器 Console Error 为 0；
8. Production Build 通过。

本阶段重点是入口整合和流程可达性，不进行全面视觉重构。

### 7.9 2026-07-21 工程验收记录

Phase 16.3B 已完成统一学生入口、单活动 Session 指针、状态优先级 Adapter、独立内部复核入口和学生字段隔离。确定性 Debug 为 `14 / 14 PASS`；Phase 16.3A、Phase 12.3、Phase 12.1 回归与 Production Build 均通过；浏览器 Smoke 已确认两个入口无 Console Error、无横向溢出且学生区不展示 Runtime 字段。

详细记录见 [Phase 16.3B Engineering Debug Acceptance](./reports/phase16_3b_engineering_debug_acceptance_2026-07-21.md) 与 [Phase 16.3B Demo Acceptance](./reports/phase16_3b_demo_acceptance_2026-07-21.md)。Controlled Demo `11 / 11 PASS`，PC / 平板操作、真实 `/learning` 草稿恢复、内部复核隔离与 Console 检查均通过，Phase 16.3B 正式标记为 `PASS / FROZEN`，Phase 16.3C 已具备进入条件。

2026-07-21，用户依据 Demo 验收标准完成最终人工确认：`PASS`。

当前“到期复测入口”已完成正式 `DelayedRetestPlan` 输入的状态适配与确定性验证；浏览器端跨日计划查询和真实到期触发属于 16.3C，不计入 16.3B Engineering PASS。

### 7.10 2026-07-21 Day 0 受控串联准入

在 16.3B 冻结后，新增统一入口到 Phase 16.3A 正式 Orchestrator 的确定性串联验收，结果为 `11 / 11 PASS`。该验收覆盖正式回流、下一 Frozen Resource、重复提交、Repository 重建恢复、无效作答、Provider 失败、Diagnosis 复核、资源错位和学生字段隔离；Phase 16.3A、16.3B 回归与 Production Build 同时通过。

详细记录见 [Phase 16.3 Day 0 Controlled Integration Debug Acceptance](./reports/phase16_3_day0_controlled_integration_debug_2026-07-21.md)。该结果表示 16.3C 的确定性技术准入成立，不替代真实 Application Boundary、真实授权数据和 5—7 个自然日运行。Phase 16.3A 既有 DeepSeek Controlled Live `11 / 11 PASS` 保持有效；本轮未重新形成新的 Live PASS。

## 八、Phase 16.3C：真实多日学习运行

### 8.1 核心问题

> 16.3A 与 16.3B 成立后，单个真实学生能否在 5—7 个自然日中安全、连续、可恢复地使用系统？

### 8.2 运行周期与最低事实量

真实运行周期：5—7 个自然日。

最低应形成：

- 1 个明确的学生身份；
- 2 个以上 `LearningSession`；
- 3 个以上正式 `LearningRound`；
- 2 份以上不同的 Frozen Resource；
- 1 次以上延迟复测；
- 多条正式 AbilityEvidence；
- 至少一次 Profile / GrowthMemory 的正式更新或明确不更新决策；
- 至少一次页面关闭或浏览器重启后的恢复；
- 至少一次异常、复核或资源不可用演练；
- 一份完整人工回放记录。

这里的“更新或明确不更新”同等重要。没有足够证据时保持当前 Profile 也是合法结果。

### 8.3 推荐自然日流程

```text
Day 1
正式资源 A → 学习 → 真实 Diagnosis → 保存并关闭

Day 2
恢复正式 Session / History / Memory → 继续学习

Day 3+
检查延迟复测计划是否到期
├─ 未到期 → 按下一 Strategy 继续
└─ 到期 → 匹配正式复测资源并完成新 Evidence

后续自然日
新 Evidence → Retention / Quality / Conflict Context
→ Existing Evaluation
→ 新 Strategy
→ 下一正式资源

最后一天
回放 Session、Round、Evidence、Profile Decision、Memory、Retest 和 Resource Version
```

自然日试用不得通过修改正式 `occurredAt` 冒充真实时间经过。时间注入只用于 Debug 预演。

### 8.4 多日运行必须观察的异常

至少观察或受控演练：

- 当前没有匹配资源；
- Provider 临时失败；
- Diagnosis 进入 `review_required`；
- 延迟复测到期但学生未完成；
- 正在引用的资源被新版本 supersede；
- 页面刷新或浏览器重启；
- 同一任务重复提交；
- 人工判定某条 Diagnosis 不应继续消费；
- 持久化暂时失败；
- 学生主动中断后再次进入。

异常不要求全部发生在真实学生的自然操作中。可以在不污染真实学生正式数据的隔离运行中受控演练，但必须复用相同 Runtime 和 Repository Contract。

### 8.5 每日验收记录

每日只记录必要事实：

- 日期与本地时区；
- Session / Round 状态；
- 使用的 resourceId / resourceVersionId；
- TaskRequest 与 Match Result 摘要；
- ResponseValidity；
- Diagnosis Formalization Status；
- 新增 Evidence ID；
- Evaluation / Profile Decision / GrowthMemory ID；
- 是否发生重复写入；
- 是否发生恢复；
- 下一流程动作；
- 人工复核结论；
- 学生体验阻断点。

不得在验收报告中记录 API Key、完整 Prompt、Raw Output 或未脱敏学生敏感答案。

### 8.6 多日运行硬性不变量

整个周期必须满足：

1. 同一正式结果只写入一次；
2. 恢复不会启动新的重复 Round；
3. 复测未完成不生成 Retest Evidence；
4. Provider 失败不生成 mock Evidence；
5. `questionable` Diagnosis 不自动回流；
6. superseded 资源不进入新执行，但历史引用保持不变；
7. 下一 Strategy 使用恢复后的正式 Profile / GrowthMemory / History；
8. Resource Match 不使用能力错位资源凑匹配；
9. 学生端始终隐藏内部 Runtime 字段；
10. 人工复核不能静默重写历史；
11. 数据版本不兼容时阻断恢复，不拼装残缺对象；
12. 任何 Profile 变化都能追溯到正式 Evidence 和 Decision。

### 8.7 16.3C 完成条件

16.3C PASS 必须满足：

1. 真实运行达到 5—7 个自然日；
2. 最低事实量达到本节要求；
3. 跨日保存、关闭和恢复成立；
4. 延迟复测至少完成一次或留下合法的未完成状态与后续处理；
5. 新 Evidence 能进入 Existing Phase 8、13、14；
6. 下一任务使用正式恢复数据和正式 Frozen Resource；
7. 异常分支未污染 Evidence、Profile 或 GrowthMemory；
8. 学生能够从统一入口独立继续；
9. 人工可以回放完整历史；
10. 关键冻结回归与 Production Build 再次通过。

### 8.8 2026-07-21 工程预演 Checkpoint

16.3C 工程实现已完成以下技术准入：

- `/learning` 不再嵌入旧连续学习 Mock，而是消费 Frozen Resource、Phase 16.3 Orchestrator 和正式 IndexedDB Repository；
- 浏览器通过本地 Application Boundary 调用 Diagnosis，Key 只允许存在于服务端环境；
- 正式 Checkpoint、草稿、Learning Session History 与 Multi-day Run State 可保存和恢复；
- 无效作答在 Diagnosis 前阻断，不占用不可变正式 Operation；
- 正式资源池已包含独立审核冻结的 `training` 与 `retest` 资源；任务角色是 Frozen Version 的正式事实，编排层不得复制或改写该字段；
- 当前任务与下一任务按能力和任务角色精确匹配，无对应正式资源时进入 `no_match / blocked`；
- 工程模拟 `10 / 10 PASS`，明确记录 `simulatedDays = 5`、`naturalDays = 0`；
- 浏览器验证发现并修复草稿主键错位，刷新恢复与学生信息隔离通过；
- Phase 12—16 关键回归和 Production Build 通过。

详细记录见 [Phase 16.3C Engineering Preflight](./reports/phase16_3c_engineering_preflight_2026-07-21.md)。

该 Checkpoint 与 [Application Boundary Controlled Live Smoke](./reports/phase16_3c_application_boundary_live_smoke_2026-07-21.md) 已通过。自然日运行、真实延迟复测和最终人工历史回放仍未完成，因此 16.3C 不得标记为 `PASS / FROZEN`。

### 8.9 2026-07-21 轻量人工 Demo 验收

独立入口 `/#/phase16-3-multiday-operation-demo` 已完成人工验收。多日运行总览、恢复与幂等、延迟复测、Provider 异常安全阻断四个 Case 全部通过；恢复同一轮后 Provider 总调用次数保持为 `1`，异常分支未生成 Evidence 或更新 Profile。页面明确标记为受控模拟，自然日保持 `0 / 5`。

详细记录见 [Phase 16.3C Lightweight Demo Acceptance](./reports/phase16_3c_demo_acceptance_2026-07-21.md)。该 PASS 只确认受控多日工程事实可被人工核对，不替代 5—7 个自然日真实运行，Phase 16.3C 仍为 `IN PROGRESS / NOT FROZEN`。

## 九、Diagnosis Quality 与 Evidence Quality 的边界

Phase 16.3 必须区分：

```text
Diagnosis Quality Gate（Phase 15.2）
= 这份真实模型 Diagnosis 是否有资格正式提交

Evidence Quality Assessment（Phase 14.1）
= 正式执行形成的 Evidence 对后续判断有多大价值
```

因此：

- Diagnosis Quality accepted 不等于 Evidence Quality high；
- Evidence Quality low 不等于 Diagnosis 非法；
- targetEvidenceQuality = high 不保证执行后实际 Evidence 为 high；
- 使用提示、材料新颖度、延迟时间和真实作答表现必须在执行后重新评估；
- `questionable` Diagnosis 在 Formal Commit 前阻断；
- 已合法提交但质量较低的 Evidence 可以保留，同时限制其画像影响。

## 十、学生反馈边界

Phase 16.3 继续复用 Phase 15.3：

- 确定性模板是可靠基线；
- 普通 Live 反馈只表达直接可追溯事实和既有下一步建议；
- LLM 表达不是新的 Diagnosis；
- 学生原话只能来自精确引用；
- 系统归纳不能伪装成学生已写出的内容；
- 单次表现不能扩大成长期掌握、提升或退步；
- 表达 Provider 失败时保留模板，不影响已合法提交的正式结果。

## 十一、建议新增工程入口

实现阶段建议新增：

```text
src/ai/tests/runPhase163RealLearningChainDebug.ts
src/ai/tests/runPhase163MultiDaySimulationDebug.ts
src/pages/UnifiedLearningEntry.jsx
src/pages/Phase163LiveLearningWorkspace.jsx
src/pages/InternalLearningReview.jsx
```

建议脚本：

```text
debug:phase16-3-real-chain
debug:phase16-3-multiday-simulation
```

建议路由：

```text
/#/learning
/#/internal/learning-review
```

具体文件名应在实现前与现有路由和组件命名再次对齐。学生入口不得直接包含真实 Provider Key 或调用外部 Provider 的浏览器代码。

## 十二、统一验收顺序

```text
1. 冻结 Phase 16.3 文档
2. 实现 16.3A 正式串联 Orchestrator / Adapter
3. 运行 A1—A14 Deterministic Debug
4. 运行一次受控真实 Provider 串联联调
5. 运行异常、幂等和恢复分支
6. 记录 16.3A PASS
7. 实现 16.3B 统一学生入口与内部复核入口
8. 完成 PC / 平板人工验收
9. 记录 16.3B PASS
10. 开始 16.3C 5—7 个自然日真实运行
11. 每日记录、人工抽检并修复阻断问题
12. 回归 16.3A / Existing Frozen Runtime
13. Production Build
14. 形成 Phase 16.3 Acceptance Report
15. 冻结 Phase 16.3 与 Phase 16
```

## 十三、本阶段不做

Phase 16.3 不做：

- 不建设大型题库；
- 不批量自动生成并发布题目；
- 不让 AI 绕过人工审核冻结资源；
- 不建设完整学生账号体系；
- 不做多学生并发与权限治理；
- 不做云端跨设备同步；
- 不做完整内容运营后台；
- 不做家长端与长期成长报告；
- 不做复杂奖励、游戏化或视觉重构；
- 不重写 Phase 8、9、10、13、14、15 的冻结协议；
- 不因 5—7 天结果宣称教学策略有效或学生能力长期提升；
- 不把真实 Provider 接入等同于 Diagnosis 已经达到人工教师水平。

## 十四、Phase 16.3 总体验收标准

Phase 16.3 PASS 必须同时满足：

### 16.3A

- 真实主链端到端成立；
- 至少两份正式资源连续消费；
- 真实 Provider、Diagnosis Quality、Evidence Return、Phase 8 / 14 和下一任务闭合；
- 刷新恢复、重复提交、Provider 失败、能力错位、资源版本变化和持久化失败安全；
- 自动化与人工联调通过。

### 16.3B

- 学生具备单一学习入口；
- 开始、继续、复测、反馈、结束和异常入口完整；
- 内部复核入口隔离；
- PC / 平板人工验收通过；
- 学生页面不暴露内部 Runtime 信息。

### 16.3C

- 真实运行 5—7 个自然日；
- 跨 Session 保存与恢复成立；
- 延迟复测和新 Evidence 回流成立；
- 下一任务使用恢复后的正式数据和正式资源；
- 异常不污染正式事实；
- 完整历史可回放、可复核。

### 统一冻结

- Existing Phase 8、13、14、15、16.1、16.2 关键回归通过；
- Phase 1–16.3 集成回归通过；
- Production Build 通过；
- Acceptance Report 完成；
- 所有已知限制明确记录。

## 十五、完成后的准确能力声明

Phase 16.3 完成后，可以宣称：

> 单个学生已经能够从统一入口使用经过审核和匹配的真实题目，提交真实作答，经过受控真实 AI Diagnosis 形成正式 Evidence 和长期状态，并在多个自然日中恢复、复测和继续下一任务；异常发生时，系统能够阻断不可靠结果并保持正式事实可追溯、可复核且不被重复污染。

仍不能宣称：

- 已证明长期教学有效；
- 已形成多学生标准化产品；
- 已具备正式云端部署、账号、权限和跨设备能力；
- 已经可以取消人工审核；
- 已经具备无限题目供应或自动题目生产能力。

## 十六、最终交接

```text
Phase 16.3A
真实产品主链与恢复基础
↓
Phase 16.3B
统一学生入口与内部复核入口
↓
Phase 16.3C
真实多日连续运行
↓
Phase 16 Acceptance / Freeze
```

Phase 16.3 的核心不是让系统连续运行得“从不出错”，而是证明：

> 当真实内容、真实学生行为、真实 Provider 和真实时间共同进入系统后，正式学习事实仍然可信，失败可以被安全处理，学习可以恢复并继续。
