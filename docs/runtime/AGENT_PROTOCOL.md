# Agent 协作协议（Agent Protocol）

## 文档定位

本文档用于定义 AI Runtime 中所有 Agent 的协作协议。

本文档不是产品模型文档，也不是 Prompt 文档，而是运行层协议文档。

当前系统已经形成的 Runtime 模块包括：

- Question Metadata Agent
- Diagnosis Agent / Real AI Diagnosis Runtime
- Ability Evidence Extractor
- Weakness Ranking Agent
- Training Plan Agent
- Training Execution / Retest Evidence Runtime
- Evaluation Agent / Long-term Evaluation Runtime
- Student Ability Profile Runtime
- Personalized Next Task Agent
- Evidence Quality Assessment / Conflict Coordination Runtime
- Adaptive Task Constraints Runtime
- Real LLM Provider / Formal Diagnosis Commit Runtime
- Diagnosis Quality Evaluation Runtime
- Controlled Feedback Expression Runtime

后续仍可继续增加：

- Coach Agent
- Growth Report Agent

为了避免不同 Agent 之间职责重复、数据结构混乱、上游结论被下游重新判断，系统必须建立统一的 Agent Protocol。

本文档回答以下问题：

1. Agent 是什么？
2. Agent 之间如何协作？
3. Agent 的输入输出格式是什么？
4. Agent 是否可以修改上游结论？
5. Agent 如何消费上游 JSON？
6. Agent 如何返回结构化结果？
7. Agent 如何处理错误、版本和状态？

核心原则：

> Agent 之间不通过自然语言协作，而通过结构化 JSON 协作。

## 一、Agent 定义

Agent 是 AI Runtime 中的业务执行模块。

Agent 负责读取模型规则、消费输入数据、调用 LLM 或 mockLLM，并输出结构化 JSON。

Agent 不是：

- 页面
- Markdown 文档
- Prompt
- 数据库
- UI 组件

Agent 是把 Knowledge Layer 转化为 Runtime Result 的执行单元。

在本系统中，Knowledge Layer 包括能力模型、诊断模型、训练模型、评估模型、题目模型、AI 教练模型和学生画像模型等文档。

Runtime Agent 的职责是：

- 接收结构化输入
- 引用模型规则
- 执行业务阶段任务
- 生成结构化结果
- 保持职责边界
- 为下游 Agent 提供可消费 JSON

## 二、Agent 协作原则

### 1. 单一职责原则

一个 Agent 只完成一个阶段的任务。

例如，Diagnosis Agent 只负责作答有效性、当前答案状态、可观察表现和根因假设，不负责生成正式 Ability Evidence；Training Plan Agent 只负责生成训练计划，不重新判断学生错因。

### 2. JSON 协作原则

Agent 之间必须通过结构化 JSON 传递结果。

上游 Agent 的输出，应作为下游 Agent 的输入。

Agent 之间不能依赖自然语言描述来传递核心业务结论。

### 3. 不无依据改写原则

下游 Agent 不得无依据改写上游事实。

下游 Agent 可以进行：

- 契约校验
- 可信度审查
- 证据充分性判断
- Evidence 冲突识别
- 版本兼容检查

如果下游 Agent 发现上游结论缺失、不可信或与其他 Evidence 冲突，应返回 `warning`、`review_required`、`failed` 或在业务 data 中标记拒绝聚合，而不是偷偷覆盖上游结论。

### 4. 只追加不覆盖原则

下游 Agent 可以基于上游结果生成新的 Runtime Result，但不能覆盖上游结果。

例如：

- Ability Evidence Extractor 可以基于 Diagnosis Result 生成 Ability Evidence。
- Evaluation Agent 可以基于多条 Evidence 生成 Evaluation Result 和 Profile Update Decision。
- Profile Runtime 可以执行 Profile Update Decision。

但这些 Agent 都不能改写原始 Diagnosis Result 或原始 Ability Evidence。

### 5. 可追溯原则

每个 Agent 输出都应保留来源、版本、时间和输入摘要。

可追溯信息应写入 `response.meta`。

凡输出以下内容的 Agent，必须包含 `evidenceLinks` 或等价的证据引用：

- Root Cause Hypothesis
- Weakness Ranking
- Evaluation Result
- Profile Update Decision
- Growth Report

自然语言解释不能代替证据链接。

### 6. 可替换原则

mockLLM 与真实 LLM 应保持相同输入输出协议。

Agent 的调用方不应关心底层使用 mockLLM 还是真实 LLM。

只要协议一致，运行层就可以替换实现。

## 三、Agent Pipeline

当前主线 Runtime Pipeline 是可分支运行图，不是每次 Session 都必须完整经过的固定流水线。

建议主线如下：

```text
Question
↓
Question Metadata
↓
Student Answer
↓
Answer Validity
├─ invalid → Insufficient Evidence / Retry
└─ valid
    ↓
Diagnosis Agent
    ↓
Diagnosis Result
    ↓
Ability Evidence Extractor
    ↓
Ability Evidence
    ↓
Weakness Ranking / Evaluation
    ├─ 候选问题与行动需求
    └─ 长期证据聚合
         ↓
Training Plan / Personalized Next Task
↓
Training Execution + Coach
↓
Training Evidence
↓
Independent Retest / Transfer
↓
Retest Evidence
↓
Evaluation Agent
↓
Evaluation Result
↓
Profile Update Decision
↓
Student Ability Profile
↓
Personalized Next Task
```

关键链路约束：

```text
Diagnosis Result
→ Ability Evidence
→ Evaluation Result
→ Profile Update Decision
→ Student Ability Profile
```

Phase 14、Phase 15 在这条主线外围增加质量解释、真实模型准入和受控表达，但不创建第二条正式教育链：

```text
Valid TaskExecutionResult
-> Real LLM Provider Adapter
-> Candidate Validation
-> Formal Diagnosis Commit
-> Existing Ability Evidence Return
-> Evidence Quality Assessment
-> Evidence Conflict Assessment
-> Existing Evaluation Capability Negotiation

Committed Diagnosis + Confirmed Evidence Facts
-> Controlled Feedback Expression
-> StudentLearningFeedback
```

真实模型 Candidate、Quality Assessment、Conflict Assessment 和 Controlled Feedback 都不能绕过 Existing Evaluation、ProfileUpdateDecision 或 Evidence Return 独立修改长期状态。

Pipeline 中的任何阶段都必须满足：

- 输入结构明确
- 输出结构明确
- 状态明确
- 错误结构明确
- 不越权执行其他 Agent 的职责

## 四、统一请求结构 AgentRequest

所有 Agent 应采用统一请求结构。

本节只定义 TypeScript / JSON 结构，不涉及数据库实现。

### TypeScript 结构

```ts
export type AgentRequest<TInput = unknown, TContext = unknown> = {
  requestId: string;
  agentName: string;
  version: string;
  timestamp: string;
  input: TInput;
  context?: TContext;
  source?: string;
};
```

### 字段说明

| 字段 | 说明 |
| --- | --- |
| requestId | 本次 Agent 调用的唯一标识 |
| agentName | 被调用的 Agent 名称 |
| version | Agent 协议或实现版本 |
| timestamp | 请求创建时间，使用 ISO 8601 格式 |
| input | Agent 的核心输入数据 |
| context | 可选上下文，例如题目、学生答案、历史画像摘要 |
| source | 请求来源，例如 AgentPlayground、Frontend、Pipeline |

### 示例

```json
{
  "requestId": "req_001",
  "agentName": "TrainingAgent",
  "version": "0.1",
  "timestamp": "2026-07-02T00:00:00.000Z",
  "input": {
    "diagnosisResult": {}
  },
  "context": {
    "question": {},
    "studentAnswer": ""
  },
  "source": "AgentPlayground"
}
```

## 五、统一响应结构 AgentResponse

所有 Agent 应采用统一响应结构。

### TypeScript 结构

```ts
export type AgentStatus = 'success' | 'partial' | 'failed';

export type AgentResponse<TData = unknown> = {
  agentName: string;
  version: string;
  status: AgentStatus;
  timestamp: string;
  data: TData | null;
  warnings: AgentWarning[];
  errors: AgentError[];
  meta: AgentMeta;
};
```

### 状态定义

| status | 说明 |
| --- | --- |
| success | Agent 执行成功，并返回结构化结果 |
| partial | Agent 返回部分结果，但存在证据不足、输入缺失或低置信度问题 |
| failed | Agent 无法完成任务，data 应为 null，并返回结构化错误 |

`success` 只表示 Agent 成功执行，不表示：

- 学生回答正确
- Evidence 充分
- 能力提升
- 训练有效
- Profile 已更新

教育业务判断必须写入业务 data，例如：

- answerStatus
- evidenceType
- evaluationStatus
- profileUpdateAction

人工复核需求优先放入 `warnings` 或业务字段，例如 `reviewRequired: true`，避免把执行状态与教育判断混合。

### 字段说明

| 字段 | 说明 |
| --- | --- |
| agentName | 输出结果的 Agent 名称 |
| version | Agent 版本 |
| status | 执行状态 |
| timestamp | 响应生成时间 |
| data | Agent 生成的结构化业务结果 |
| warnings | 可恢复或需要注意的问题 |
| errors | 阻断执行的问题 |
| meta | 运行元信息，例如 confidence、usedMockLLM、sourceRequestId |

### 示例

```json
{
  "agentName": "TrainingAgent",
  "version": "0.1",
  "status": "success",
  "timestamp": "2026-07-02T00:00:00.000Z",
  "data": {
    "targetAbility": "概括",
    "trainingGoal": "建立段落概括能力"
  },
  "warnings": [],
  "errors": [],
  "meta": {
    "confidence": 0.72,
    "usedMockLLM": true
  }
}
```

## 六、Agent 职责边界

### Question Metadata Agent

Question Metadata Agent 负责：

- 解析题目目标
- 标注题目能力映射
- 输出题目运行契约
- 提供 Rubric、answerAcceptance、commonError candidates 和 questionRole

Question Metadata Agent 不负责：

- 判断学生答案
- 生成 Diagnosis Result
- 生成 Ability Evidence
- 决定训练计划

### Answer Validity Gate

Answer Validity Gate 可以是独立 Agent，也可以是 Diagnosis Agent 内部的强制前置阶段。

它负责：

- 判断学生答案是否提供最低限度的可分析内容
- 区分空答案、纯数字、敷衍回答、无关回答和有效回答
- 对无效作答输出 insufficient evidence / retry 需求

它不负责：

- 判断具体能力短板
- 输出 rootCause
- 生成 weakness
- 推进长期能力判断

协议约束：

```text
Diagnosis Agent 在进行能力诊断前，必须先完成作答有效性判断。
无效作答不得继续生成具体错误类型、rootCause 或 weakness。
```

### Diagnosis Agent

Diagnosis Agent 负责：

- 作答有效性判断
- 当前答案状态
- 可观察表现
- 表面错误
- 有证据支持的 rootCause hypothesis / supported cause
- Evidence 生成所需的诊断数据
- 输出 Diagnosis Result

Diagnosis Agent 不负责：

- 生成正式 Ability Evidence
- 制定详细训练计划
- 判断训练是否有效
- 判断长期能力等级
- 更新完整学生画像
- 生成面向学生的长期陪练话术

Diagnosis Agent 不创造长期能力事实。

### Ability Evidence Extractor

Ability Evidence Extractor 负责：

- 根据 Diagnosis Result 生成 Ability Evidence
- 区分 `positive`、`weakness`、`growth`、`insufficient`
- 保留 observation、rootCause、confidence、source 和 evidenceLinks
- 为 Weakness Ranking、Evaluation 和 Student Ability Profile 提供可累计证据

Ability Evidence Extractor 不负责：

- 重新判断题目答案质量
- 修改 Diagnosis Result
- 生成训练计划
- 判断长期能力状态

### Real LLM Provider Adapter / Formal Diagnosis Commit Runtime

该 Runtime 负责：

- 在 Answer Validity Gate 之后调用版本化真实 Provider；
- 隔离 Raw Output，并执行 Schema、身份、语义和安全边界校验；
- 对可修复的非语义结构问题执行白名单 Repair；
- 通过 `requestId` 原子唯一约束提交正式 Diagnosis；
- 在 Commit 成功但 Evidence Return 失败时，基于同一正式 Diagnosis 重试下游回流。

该 Runtime 不负责：

- 直接生成 AbilityEvidence；
- 在 Live 失败时静默改用 mock 形成正式结果；
- 修复 `mainAbility`、`answerStatus`、`rootCause`、引用或 Evidence 方向；
- 修改 EvaluationResult、ProfileUpdateDecision 或 StudentAbilityProfile。

### Diagnosis Quality Evaluation Runtime

该 Runtime 负责使用冻结 Dataset、人工预期边界和版本化 Policy，对真实 Diagnosis 形成 `accepted`、`questionable`、`unacceptable` 或 `critical_violation` 结果。

只有 `accepted` 可以继续作为正式候选；`questionable` 必须复核，`unacceptable` 与 `critical_violation` 必须阻断。质量评估不修改原始 Diagnosis，也不能把离线通过率解释为长期能力置信度。

### Evidence Quality Assessment / Conflict Coordination Runtime

该 Runtime 负责：

- 根据任务、作答、提示、时间、Diagnosis 和追溯事实评估单条 Evidence 的观察质量；
- 按 Observation Unit 去重独立观察；
- 协调一致、可解释混合、未解决冲突、证据不足和复核状态；
- 在 Existing Evaluation 明确声明所需 capability 时准备 quality-aware handoff。

它不改变 Evidence 的原始方向，不把质量等级解释为能力等级，也不能在 Existing Evaluation 不兼容时静默替换 legacy 语义。

### Weakness Ranking Agent

Weakness Ranking Agent 负责：

- 基于 Ability Evidence Summary 生成候选薄弱能力排序
- 汇总 weakness / positive / growth / insufficient 数量
- 输出 reasons 和 evidenceLinks
- 输出候选问题模式和候选行动方向
- 为 Training Plan Agent 或 Personalized Next Task Agent 提供候选输入

Weakness Ranking Agent 不负责：

- 生成具体训练任务
- 判断长期能力等级
- 修改原始 Ability Evidence
- 直接决定下一题
- 给学生形成固定能力标签

`suggestedTrainingFocus` 是 Phase 3.1 的最小字段。长期语义应理解为 `candidateTrainingFocus`。

### Training Plan Agent

Training Plan Agent 负责：

- 根据 Top Weakness / Ability Evidence Summary 生成候选训练目标
- 结合 Student Ability Profile、Evaluation Result、当前成长需求和最近训练历史生成训练计划
- 生成训练策略
- 生成阶段训练计划
- 生成每日训练任务建议
- 生成完成标准
- 保留 evidence_links

Training Plan Agent 不负责：

- 重新判断错因
- 修改 Diagnosis Result
- 判断训练后能力是否提升
- 更新完整学生画像
- 把 Top Weakness 当作直接训练命令

Training Plan Agent 的输入不应长期只依赖 Top Weakness。

长期至少还应读取：

- Student Ability Profile
- Evaluation Result
- 当前成长需求
- 最近训练历史
- 根因确认状态
- 当前是训练、复测还是迁移需求
- 可用题目与任务资源

### Adaptive Task Constraints Runtime

Adaptive Task Constraints Runtime 只在已成立的 `NextLearningStrategy` 方向内，约束下一任务的角色、难度、材料新颖度、提示策略和观察目标。

它不负责重新选择教育方向，不把 `targetEvidenceQuality` 当作执行结果承诺，也不能在 Strategy 与 Constraints 冲突时勉强生成 TaskRequest。约束只有通过 Alignment Validation 后才能进入 Existing TaskFulfillment。

### Training Execution / Retest Evidence Runtime

Training Execution / Retest Evidence Runtime 负责：

- 判断训练或复测作答状态
- 生成 Training Evidence
- 生成 Retest Evidence
- 判断本次是否相对基线出现改善信号
- 保留提示依赖、任务角色和比较基线
- 为 Evaluation Agent 提供评估证据

Training Execution / Retest Evidence Runtime 不负责：

- 判断长期能力已经提升
- 判断能力状态应升级
- 判断训练已经被证明有效
- 重新诊断原始答案
- 重新制定训练计划
- 修改 Diagnosis Result 或 Training Plan

### Evaluation Agent / Long-term Evaluation Runtime

Evaluation Agent 负责：

- 筛选可聚合 Evidence
- 判断 Evidence 是否同能力且可比较
- 判断证据是否充分
- 识别正反 Evidence 冲突
- 判断原 Diagnosis 假设是否仍得到后续证据支持
- 形成成长层级与置信度
- 输出 Evaluation Result
- 输出 Profile Update Decision
- 提出训练、复测、迁移或人工复核需求

Evaluation Agent 不负责：

- 重新改写原始 Diagnosis Result
- 重新生成 Ability Evidence
- 直接写入 Student Ability Profile
- 直接决定具体训练题

Evaluation Agent 可以拒绝消费证据，但必须显式输出原因。

### Controlled Feedback Expression Runtime

Controlled Feedback Expression Runtime 负责把 Committed Diagnosis、AbilityEvidence 和可追溯的 `StructuredFeedbackFacts` 转换为学生可读反馈。

它必须：

- 将事实与行动建议分开；
- 校验学生原话、材料引用和事实归因；
- 阻止长期能力结论、Prompt 泄漏和语义扩大；
- 在 Provider、Schema 或表达校验失败时回退到确定性模板。

它不重新执行 Diagnosis，不生成 Evidence，不修改 Evaluation 或 Profile，也不能因为语言更自然就扩大上游结论。

### Coach Agent

Coach Agent 负责：

- 生成面向学生的互动语言
- 生成提示、追问、鼓励和反馈
- 根据当前阶段调整表达方式
- 将结构化结果转化为学生可理解的学习引导

Coach Agent 不负责：

- 改变诊断结论
- 改变评估结论
- 修改训练计划的核心结构
- 独立宣布长期能力状态

### Profile Agent / Profile Runtime

Profile Agent / Profile Runtime 负责执行合法的 Profile Update Decision。

它可以：

- 追加 Evidence 引用
- 保存 Evaluation Result
- 更新置信度
- 按决策修改维度或等级
- 保存状态变化历史
- 标记待验证需求
- 生成下一阶段画像摘要

Profile Agent / Profile Runtime 不负责：

- 自行重新聚合并判断是否提升
- 自行判断是否退化
- 自行判断状态如何变化
- 自行判断哪项能力最弱
- 重新解释题目
- 重新诊断学生答案
- 重新制定训练计划
- 覆盖上游 Agent 结论

Profile 更像状态存储与受约束更新 Runtime，不一定必须依靠 LLM。

## 七、Agent 输入输出关系

| Agent | 输入 | 输出 | 下游 |
| --- | --- | --- | --- |
| Question Metadata Agent | question | QuestionMetadata | Answer Validity Gate / Diagnosis Agent |
| Answer Validity Gate | studentAnswer, questionMetadata | AnswerValidityResult | Diagnosis Agent / Retry |
| Diagnosis Agent | question, referenceAnswer, studentAnswer, metadata, answerValidity | DiagnosisResult | Ability Evidence Extractor |
| Real LLM Provider / Formal Diagnosis Commit Runtime | Valid TaskExecutionResult、ConcreteLearningTask、ProviderConfig | RealDiagnosisRuntimeResult、FormalDiagnosisCommit | Existing Ability Evidence Return / Review |
| Diagnosis Quality Evaluation Runtime | Frozen Dataset、Diagnosis Candidate、Quality Policy | DiagnosisQualityEvaluation | Formal Candidate Gate / Human Review |
| Ability Evidence Extractor | DiagnosisResult | AbilityEvidence | Weakness Ranking Agent / Evaluation Agent |
| Evidence Quality Assessment Runtime | AbilityEvidence、正式任务、执行与提示事实 | EvidenceQualityAssessment | Conflict Coordination / Evaluation Context Adapter |
| Evidence Conflict Coordination Runtime | AbilityEvidence[]、当前 Quality Assessment[]、Comparison Context[] | EvidenceConflictAssessment | Evaluation Context Adapter / Adaptive Task Constraints |
| Weakness Ranking Agent | AbilityEvidence[] | TopWeakness / CandidateAction | Training Plan Agent / Personalized Next Task Agent |
| Training Plan Agent | TopWeakness, EvidenceSummary, StudentAbilityProfile, EvaluationResult | TrainingPlan | Training Execution / Retest Evidence Runtime |
| Adaptive Task Constraints Runtime | NextLearningStrategy、Quality / Conflict Context | AdaptiveTaskConstraints、AlignmentResult | TaskRequest / TaskFulfillment |
| Training Execution / Retest Evidence Runtime | TrainingPlan, studentAnswer, retestAnswer, baselineEvidence | TrainingEvidence / RetestEvidence | Evaluation Agent |
| Learning Entry Agent | question, studentAnswer, questionMetadata | LearningEntryResult | Personalized Training Flow Agent / 前端 |
| Personalized Training Flow Agent | LearningEntryResult, studentTrainingAnswer | PersonalizedTrainingFlowResult | Beta Learning Session Result Agent |
| Beta Learning Session Result Agent | PersonalizedTrainingFlowResult, studentRetestAnswer | BetaLearningSessionResult | Evaluation Agent / 前端 |
| Evaluation Agent | AbilityEvidence[], TrainingEvidence, RetestEvidence | EvaluationResult | Profile Update Decision Agent |
| Profile Update Decision Agent | EvaluationResult, currentProfile | ProfileUpdateDecision | Profile Runtime |
| Profile Runtime | ProfileUpdateDecision, EvaluationResult, Evidence references | StudentAbilityProfile | Personalized Next Task Agent / 前端 |
| Controlled Feedback Expression Runtime | Committed Diagnosis、AbilityEvidence、StructuredFeedbackFacts、Suggestions | ControlledFeedbackResult | Student Feedback Adapter / 前端 |
| Coach Agent | 当前阶段数据 | CoachMessage | 前端 |
| Personalized Next Task Agent | StudentAbilityProfile, CandidateAction, EvidenceSummary | PersonalizedNextTask | Diagnosis Agent |

所有输入输出都应为结构化 JSON。

如果某个 Agent 需要自然语言内容，例如学生可读反馈，该自然语言内容也应作为 JSON 字段存在，而不是作为跨 Agent 协作的唯一载体。

## 八、错误处理规范

Agent 失败时必须返回结构化错误，而不是自然语言报错。

### 错误结构

```ts
export type AgentError = {
  code: string;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
};
```

### Warning 结构

```ts
export type AgentWarning = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};
```

### 示例

```json
{
  "code": "MISSING_DIAGNOSIS_RESULT",
  "message": "Ability Evidence Extractor 缺少 diagnosisResult，无法生成能力证据。",
  "recoverable": true,
  "details": {}
}
```

### 常见错误码

| code | 说明 |
| --- | --- |
| INVALID_INPUT | 输入结构不符合 AgentRequest 要求 |
| INVALID_ANSWER | 学生答案没有提供最低限度的可分析内容 |
| MISSING_DIAGNOSIS_RESULT | Ability Evidence Extractor 缺少 Diagnosis Result |
| MISSING_TRAINING_PLAN | Training Execution / Retest Evidence Runtime 缺少 Training Plan |
| MISSING_EVIDENCE_LINKS | 需要证据链接的输出缺少 evidenceLinks |
| EVIDENCE_NOT_COMPARABLE | Evaluation Agent 判断 Evidence 不具备可比较性 |
| EVIDENCE_CONFLICT | 多条 Evidence 存在明显冲突，需要复测或人工复核 |
| UPSTREAM_RESULT_UNTRUSTED | 上游结果置信度过低，需要人工或额外证据确认 |
| REVIEW_REQUIRED | 当前结果需要人工复核 |
| LLM_RESPONSE_PARSE_FAILED | LLM 输出无法解析为目标 JSON |
| FORMAL_DIAGNOSIS_COMMIT_CONFLICT | 同一 requestId 已存在另一份正式 Diagnosis，禁止重复提交 |
| DIAGNOSIS_QUALITY_REVIEW_REQUIRED | 真实 Diagnosis 质量结果需要人工复核 |
| EVIDENCE_QUALITY_CONTEXT_MISSING | 缺少生成 Evidence Quality Assessment 所需的正式上下文 |
| EVALUATION_CAPABILITY_UNSUPPORTED | Existing Evaluation 不支持所需 Quality / Conflict Capability |
| ADAPTIVE_CONSTRAINT_MISALIGNED | AdaptiveTaskConstraints 与既有 Strategy 不一致 |
| CONTROLLED_FEEDBACK_VALIDATION_FAILED | 反馈表达发生引用、归因、越权或语义扩大错误 |
| AGENT_VERSION_UNSUPPORTED | 当前 Agent 不支持上游结果版本 |

## 九、版本规范

每个 Agent 必须包含 version。

版本规范用于保证 Agent 增多后仍然可追踪、可兼容、可升级。

### 基本规则

- Agent 输出结构变化时必须升级版本
- 上游结果版本应保留在 response.meta 中
- 不同版本 Agent 之间需要尽量保持向后兼容
- 如果无法兼容，应返回 AGENT_VERSION_UNSUPPORTED
- mockLLM 和真实 LLM 必须遵守同一版本协议

### Meta 建议结构

```ts
export type AgentMeta = {
  confidence?: number;
  usedMockLLM?: boolean;
  sourceRequestId?: string;
  upstreamAgent?: string;
  upstreamVersion?: string;
  modelReferences?: string[];
  inputSummary?: Record<string, unknown>;
  evidenceLinks?: string[];
};
```

## 十、与现有文档关系

AGENT_PROTOCOL.md 属于 Runtime Layer。

它引用 Knowledge Layer 的模型文档：

- ABILITY_MODEL.md
- DIAGNOSIS_MODEL.md
- TRAINING_MODEL.md
- EVALUATION_MODEL.md
- QUESTION_MODEL.md
- QUESTION_METADATA_MODEL.md
- ABILITY_EVIDENCE_CONTRACT.md
- WEAKNESS_RANKING_MODEL.md
- AI_COACH_MODEL.md
- STUDENT_PROFILE_MODEL.md

但它不重新定义这些模型。

Knowledge Layer 负责定义：

- 什么是能力
- 如何诊断能力
- 如何训练能力
- 如何评估能力
- 题目如何承载能力
- AI 教练如何行动
- 学生画像如何更新

Runtime Layer 负责定义：

- Agent 如何协作
- Agent 如何传递数据
- Agent 如何保持职责边界
- Agent 如何处理错误
- Agent 如何管理版本
- Agent 如何保持可追溯

本协议的目标不是增加复杂度，而是保证 AI Runtime 在 Agent 增多后依然保持清晰、稳定、可追溯、可扩展。
