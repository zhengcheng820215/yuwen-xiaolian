# Agent 协作协议（Agent Protocol）

## 文档定位

本文档用于定义 AI Runtime 中所有 Agent 的协作协议。

本文档不是产品模型文档，也不是 Prompt 文档，而是运行层协议文档。

当前系统已经存在：

- Diagnosis Agent
- Training Agent

后续还会继续增加：

- Evaluation Agent
- Coach Agent
- Profile Agent

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

例如，Diagnosis Agent 只负责能力诊断，不负责制定详细训练计划；Training Agent 只负责生成训练方案，不重新判断学生错因。

### 2. JSON 协作原则

Agent 之间必须通过结构化 JSON 传递结果。

上游 Agent 的输出，应作为下游 Agent 的输入。

Agent 之间不能依赖自然语言描述来传递核心业务结论。

### 3. 不重复推理原则

下游 Agent 不能重新判断上游 Agent 已经完成的业务结论。

例如，Training Agent 不能重新判断学生的 rootCause、mainAbility 或 errorType。

### 4. 不修改上游结论原则

下游 Agent 不能修改上游 Agent 的核心结论。

例如，Training Agent 不能修改 Diagnosis Result 中的 rootCause、mainAbility、surfaceError、abilityEvidence 等字段。

如果下游 Agent 发现上游结论缺失或不可信，应返回 warning 或 failed 状态，而不是直接覆盖上游结论。

### 5. 只追加不覆盖原则

下游 Agent 可以基于上游结果生成新的 Runtime Result，但不能覆盖上游结果。

例如，Training Agent 可以基于 Diagnosis Result 生成 Training Plan，但不能改写 Diagnosis Result。

### 6. 可追溯原则

每个 Agent 输出都应保留来源、版本、时间和输入摘要。

可追溯信息应写入 response.meta。

### 7. 可替换原则

mockLLM 与真实 LLM 应保持相同输入输出协议。

Agent 的调用方不应关心底层使用 mockLLM 还是真实 LLM。

只要协议一致，运行层就可以替换实现。

## 三、Agent Pipeline

当前和未来的 Agent Pipeline 如下：

```text
Question / Student Answer
↓
Diagnosis Agent
↓
Diagnosis Result JSON
↓
Training Agent
↓
Training Plan JSON
↓
Evaluation Agent
↓
Evaluation Result JSON
↓
Student Ability Profile
```

每个阶段的输出都是下一个阶段的输入。

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
| success | Agent 成功完成任务，并返回完整结构化结果 |
| partial | Agent 返回部分结果，但存在证据不足、输入缺失或低置信度问题 |
| failed | Agent 无法完成任务，data 应为 null，并返回结构化错误 |

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

### Diagnosis Agent

Diagnosis Agent 负责：

- 判断能力短板
- 判断错因
- 定位 rootCause
- 生成 abilityEvidence
- 输出 Diagnosis Result

Diagnosis Agent 不负责：

- 制定详细训练计划
- 判断训练是否有效
- 更新完整学生画像
- 生成面向学生的长期陪练话术

### Training Agent

Training Agent 负责：

- 根据 Diagnosis Result 生成训练目标
- 生成训练策略
- 生成训练步骤
- 生成练习任务建议
- 生成完成标准

Training Agent 不负责：

- 重新判断错因
- 修改 Diagnosis Result
- 判断训练后能力是否提升
- 更新完整学生画像

### Evaluation Agent

Evaluation Agent 负责：

- 判断训练后能力是否提升
- 判断能力是否保持、迁移或退化
- 生成 Evaluation Result
- 为 Profile Agent 提供评估证据

Evaluation Agent 不负责：

- 重新诊断原始答案
- 重新制定训练计划
- 修改 Diagnosis Result 或 Training Plan

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

### Profile Agent

Profile Agent 负责：

- 更新 Student Ability Profile
- 写入能力证据
- 更新能力状态和成长趋势
- 生成下一阶段画像摘要

Profile Agent 不负责：

- 重新解释题目
- 重新诊断学生答案
- 重新制定训练计划
- 覆盖上游 Agent 结论

## 七、Agent 输入输出关系

| Agent | 输入 | 输出 | 下游 |
| --- | --- | --- | --- |
| Diagnosis Agent | question, referenceAnswer, studentAnswer | DiagnosisResult | Training Agent |
| Training Agent | DiagnosisResult, question, studentAnswer | TrainingPlan | Evaluation Agent |
| Evaluation Agent | TrainingResult / RetestResult | EvaluationResult | Profile Agent |
| Coach Agent | 当前阶段数据 | CoachMessage | 前端 |
| Profile Agent | Diagnosis / Training / Evaluation Result | StudentAbilityProfile | 前端 |

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
  "message": "Training Agent 缺少 diagnosisResult，无法生成训练方案。",
  "recoverable": true,
  "details": {}
}
```

### 常见错误码

| code | 说明 |
| --- | --- |
| INVALID_INPUT | 输入结构不符合 AgentRequest 要求 |
| MISSING_DIAGNOSIS_RESULT | Training Agent 缺少 Diagnosis Result |
| MISSING_TRAINING_RESULT | Evaluation Agent 缺少 Training Result |
| UPSTREAM_RESULT_UNTRUSTED | 上游结果置信度过低，需要人工或额外证据确认 |
| LLM_RESPONSE_PARSE_FAILED | LLM 输出无法解析为目标 JSON |
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
