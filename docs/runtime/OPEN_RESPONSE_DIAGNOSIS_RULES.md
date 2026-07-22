# 开放题诊断规则（Open Response Diagnosis Rules）

## 文档定位

本文档定义 AI Runtime 中 `open_response` 任务类型的诊断规则。

本文档不是产品模型文档，不是 Prompt 文档，不是题库设计，也不是考试评分规则。

本文档属于 Runtime Layer，用于指导 Diagnosis Agent 在处理开放式语文题时，如何判断作答有效性、答案质量、Rubric 匹配、可观察表现、rootCause 假设，并为 Ability Evidence Extractor、Evaluation Agent、Training Plan Agent 和后续 Training Runtime 提供可消费的结构化诊断结果。

本文档引用但不重新定义以下模型：

- `ABILITY_MODEL.md`
- `DIAGNOSIS_MODEL.md`
- `QUESTION_MODEL.md`
- `QUESTION_METADATA_MODEL.md`
- `ABILITY_EVIDENCE_CONTRACT.md`
- `AGENT_PROTOCOL.md`

核心原则：

> 开放题不以“是否等于参考答案”为判断标准，而以“是否满足任务要求、覆盖能力要点、形成可追溯诊断依据”为判断标准。

Diagnosis Agent 不直接生成正式 Ability Evidence。

Diagnosis Agent 只输出 Diagnosis Result 和 Evidence Proposal。

正式 Ability Evidence 必须由 Ability Evidence Extractor 根据 Diagnosis Result 生成。

## 一、适用范围

`open_response` 适用于需要学生组织语言、解释、概括、分析或推理的开放式任务。

典型题型包括：

- 概括主要内容
- 概括段落大意
- 理解句子含义
- 分析人物形象
- 分析表达作用
- 推断人物心理
- 说明原因
- 结合文本谈理解
- 阅读理解简答题

`open_response` 不适用于：

- 反义词、近义词等精确答案题
- 填空、默写、选择题
- 只要求标注、圈画、修改、补全过程的任务

这些任务应分别进入 `exact_match` 或 `process_task`。

## 二、开放题诊断目标

开放题诊断不是判断学生答案是否与参考答案完全一致。

开放题诊断应回答：

1. 学生答案是否有效？
2. 学生答案是否满足题目要求？
3. 学生答案覆盖了哪些 Rubric 要点？
4. 学生答案缺失了哪些 Rubric 要点？
5. 缺失要点能否支持 rootCause hypothesis / supported cause？
6. 当前答案能为 Evidence Extractor 提供哪些 Evidence Proposal？
7. 下一步候选行动是补充作答、诊断验证、训练、复测、迁移还是继续观察？

开放题诊断应先判断答案有效性，再判断答案质量，最后才形成诊断结果。

```text
Answer Validity
↓
Answer Quality
↓
Rubric Match
↓
Diagnosis Result
↓
Evidence Proposal
↓
Ability Evidence Extractor
```

## 三、Answer Validity Gate

开放题诊断必须先通过 Answer Validity Gate。

Answer Validity Gate 可以是独立 Runtime，也可以是 Diagnosis Agent 内部的强制前置阶段。

无效答案包括：

- 空答案
- 纯数字，例如 `5`、`445`、`889`
- 敷衍回答，例如“哈哈”“不知道”
- 与任务完全无关的内容
- 过短且无法判断语义意图的内容
- 只复制一处原文片段、整段或全文，但没有形成对题目要求的独立判断与解释

对于要求判断、分析或解释的开放题，单独复制材料只能说明材料被输入，不能证明学生完成了判断、依据选择或推理解释。该输入应由 Answer Validity Gate 标记为 `insufficient`，不得因为命中材料关键词或动作描写而进入具体 Diagnosis。若任务目标本身只是找出或摘录原句，则应按该任务的 AnswerAcceptance 和 Rubric 判断，不适用此阻断规则。

无效答案统一输出：

```ts
answerStatus: 'insufficient_evidence'
scoreBand: 'invalid'
rootCause: {
  status: 'unresolved',
  explanation: '学生答案未提供足够可分析内容，暂无法判断具体能力缺口。'
}
nextActionCandidate: 'retry'
```

无效答案不得继续生成：

- 具体错误类型
- 具体 rootCause
- weakness
- 训练焦点
- 长期能力判断

任务相关性采用两层闸门：确定性规则能够高置信识别时，在 Provider 前直接输出 `irrelevant`；若输入表面完整但语义上未回应任务，Diagnosis 只能将其标记为 `insufficient_evidence / invalid`，随后停止 Evidence、Profile 与学生反馈生成，并请求重新作答。

无效答案可以生成 Evidence Proposal，但只能指向 `insufficient`，并且不应参与 weakness ranking 的主排序。

## 四、答案状态（answerStatus）

开放题不应只使用 `correct=true/false`。

应使用 `answerStatus` 表达答案是否达到任务要求。

```ts
export type OpenResponseAnswerStatus =
  | 'fully_meets'
  | 'partially_meets'
  | 'does_not_meet'
  | 'insufficient_evidence';
```

| answerStatus | 说明 |
| --- | --- |
| fully_meets | 答案完整覆盖核心能力点，可形成正向 Evidence Proposal |
| partially_meets | 答案部分满足要求，但存在关键要点缺失、依据不足或表达不完整 |
| does_not_meet | 答案明显未满足题目要求，方向偏离或核心能力任务未完成 |
| insufficient_evidence | 学生答案无效、过短、空泛或无法判断其能力表现 |

### 使用原则

- `fully_meets` 不等于能力已经稳定掌握，只能作为正向 Evidence Proposal。
- `partially_meets` 应进一步定位缺失 Rubric 要点。
- `partially_meets` 不自动映射为 `weakness`。
- `does_not_meet` 应追溯可观察的任务失败表现，但不自动确认长期能力短板。
- `insufficient_evidence` 不应强行输出明确能力结论。

## 五、诊断等级（scoreBand）

`scoreBand` 用于表达本次开放题答案质量的诊断等级。

它不是考试分数，也不用于排名。

```ts
export type OpenResponseScoreBand =
  | 'high'
  | 'medium'
  | 'low'
  | 'invalid';
```

| scoreBand | 说明 |
| --- | --- |
| high | 关键要点完整，表达清晰，能形成较强正向 Evidence Proposal |
| medium | 部分满足要求，已体现主要能力表现，但仍有关键点缺失 |
| low | 未完成核心能力任务，仅有少量或表层表现 |
| invalid | 答案无效、偏题、空泛或无法形成可靠诊断 |

### 与 answerStatus 的关系

| answerStatus | 推荐 scoreBand |
| --- | --- |
| fully_meets | high |
| partially_meets | medium |
| does_not_meet | low / invalid |
| insufficient_evidence | invalid |

## 六、Rubric Item 结构

开放题应基于 Rubric 进行诊断。

Rubric 不是考试评分表，而是能力要点结构。

Rubric 应优先读取 Question Metadata 中的 `rubricItems` 或等价字段。

Diagnosis Agent 不应绕过 Question Metadata 随意重建 Rubric。

当 Question Metadata 缺失或 Rubric 不完整时，Diagnosis Agent 可以返回 warning，并在必要时生成临时 Rubric Proposal，但该 Proposal 必须标记为低置信度，不能替代正式 Question Metadata。

```ts
export type OpenResponseRubricItem = {
  id: string;
  label: string;
  abilityId: string;
  abilityLabel?: string;
  required: boolean;
  matched: boolean;
  evidence?: string;
  missingReason?: string;
  evidenceLinks?: string[];
};
```

| 字段 | 说明 |
| --- | --- |
| id | Rubric 要点 ID |
| label | 要点说明 |
| abilityId | 稳定能力 ID，长期应来自 ABILITY_MODEL |
| abilityLabel | 展示名称，例如信息提取、理解、概括、分析、推理、表达 |
| required | 是否为关键要点 |
| matched | 学生答案是否满足该要点 |
| evidence | 学生答案中支撑 matched 的内容 |
| missingReason | 未满足该要点的原因 |
| evidenceLinks | 指向题目、答案片段、Rubric 或诊断依据的链接 |

Phase 早期兼容字段中可能仍使用 `ability: string`。长期协议应使用稳定 `abilityId`，中文能力名只作为展示 label。

## 七、Rubric 来源与生成原则

每个 `open_response` 任务应引用一组 Rubric Items。

Rubric 来源优先级：

1. Question Metadata 中已审核的 Rubric。
2. Question Metadata 中 draft Rubric。
3. 由 Question Metadata Agent 生成的 Rubric Proposal。
4. Diagnosis Agent 临时生成的低置信度 Rubric Proposal。

Rubric 应来自题目要求、Question Metadata 和参考答案，而不是从学生答案中倒推。

### 概括题 Rubric 示例

```ts
rubricItems: [
  {
    id: 'main_object',
    label: '是否说清主要对象',
    abilityId: 'extraction',
    abilityLabel: '信息提取',
    required: true
  },
  {
    id: 'core_event',
    label: '是否概括核心事件',
    abilityId: 'summarization',
    abilityLabel: '概括',
    required: true
  },
  {
    id: 'theme_or_emotion',
    label: '是否提炼主旨、情感或意义',
    abilityId: 'comprehension',
    abilityLabel: '理解',
    required: true
  },
  {
    id: 'concise_expression',
    label: '是否删除无关细节并表达简洁',
    abilityId: 'expression',
    abilityLabel: '表达',
    required: false
  }
]
```

### 分析题 Rubric 示例

```ts
rubricItems: [
  {
    id: 'analysis_target',
    label: '是否明确分析对象',
    abilityId: 'comprehension',
    abilityLabel: '理解',
    required: true
  },
  {
    id: 'text_evidence',
    label: '是否提供文本依据',
    abilityId: 'extraction',
    abilityLabel: '信息提取',
    required: true
  },
  {
    id: 'analysis_explanation',
    label: '是否说明依据如何支持结论',
    abilityId: 'analysis',
    abilityLabel: '分析',
    required: true
  },
  {
    id: 'complete_expression',
    label: '是否表达完整、有层次',
    abilityId: 'expression',
    abilityLabel: '表达',
    required: false
  }
]
```

### 推理题 Rubric 示例

```ts
rubricItems: [
  {
    id: 'clue_extraction',
    label: '是否提取文本线索',
    abilityId: 'extraction',
    abilityLabel: '信息提取',
    required: true
  },
  {
    id: 'context_understanding',
    label: '是否理解上下文关系',
    abilityId: 'comprehension',
    abilityLabel: '理解',
    required: true
  },
  {
    id: 'inference_chain',
    label: '是否形成依据到结论的推理链',
    abilityId: 'inference',
    abilityLabel: '推理',
    required: true
  },
  {
    id: 'avoid_over_inference',
    label: '是否避免脱离文本的过度推断',
    abilityId: 'inference',
    abilityLabel: '推理',
    required: false
  }
]
```

## 八、Rubric 匹配规则

Rubric 匹配不要求学生答案与参考答案逐字一致。

应判断学生是否表达了等价含义。

### matched 判定

`matched=true` 的条件：

- 学生答案覆盖该要点的核心含义
- 表达方式可以不同，但语义应成立
- 能从学生答案中找到对应证据
- 对应证据能链接到学生答案片段或文本依据

`matched=false` 的条件：

- 学生答案未覆盖该要点
- 学生答案只覆盖细节，没有完成该能力动作
- 学生答案方向偏离
- 学生答案过于空泛，无法形成证据

### required 要点

如果 required 要点缺失，应影响 `answerStatus` 和 `scoreBand`。

如果多个 required 要点缺失，通常不应输出 `fully_meets`。

missing rubric 不等于已确认能力短板。

missing rubric 只能说明本次作答中该能力要点未被观察到或未满足。它需要结合学生答案、任务要求、历史 Evidence、提示依赖和 Evaluation 结果，才能形成更稳的能力判断。

## 九、Evidence Proposal 规则

开放题诊断应将 Rubric 匹配结果转化为 Evidence Proposal，而不是正式 Ability Evidence。

正式 Ability Evidence 必须由 Ability Evidence Extractor 生成。

### 正向 Evidence Proposal

当某个 Rubric item `matched=true` 时，可以生成正向 Evidence Proposal。

示例：

```text
学生能够提取主要对象。
学生能够概括核心事件。
学生能够基于文本线索形成合理判断。
学生能够使用完整表达呈现结论。
```

### 薄弱 Evidence Proposal

当 required Rubric item `matched=false` 时，可以生成薄弱 Evidence Proposal，但不得自动确认长期能力短板。

示例：

```text
学生能写出事件细节，但未提炼主旨。
学生给出人物特点，但缺少文本依据。
学生能得出结论，但推理链不完整。
学生答案方向相关，但表达不完整。
```

### 待验证 Evidence Proposal

当学生答案过短、无效或证据不足时，应生成待验证 Evidence Proposal，而不是强行输出能力短板。

`partially_meets` 不自动映射为 `weakness`。

Evidence 类型应由 Ability Evidence Extractor 综合以下信息决定：

- answerStatus
- matched / missing Rubric
- rootCause status
- evidenceLinks
- 历史 Evidence
- 任务角色与提示依赖

## 十、Root Cause 生成规则

`rootCause` 应来自 missing required Rubric items、学生答案中的可观察表现和 evidenceLinks。

不能仅因为学生答案与参考答案不完全一致就生成 rootCause。

长期协议中，rootCause 应使用克制结构：

```ts
export type RootCauseDiagnosis = {
  status: 'unresolved' | 'hypothesis' | 'supported';
  abilityId?: string;
  abilityLabel?: string;
  explanation: string;
  evidenceLinks: string[];
};
```

### 生成原则

- 如果 required Rubric 全部 matched，则不生成补弱型 rootCause。
- 如果部分 required Rubric 缺失，可以生成 `hypothesis` 或 `supported` rootCause。
- 如果答案证据不足，则 rootCause 必须为 `unresolved`。
- missing rubric 不自动等于 `supported` rootCause。
- rootCause 应指向本次作答中有证据支持的可观察问题，而不是长期能力标签。

### 示例

```text
缺失 theme_or_emotion
=> hypothesis：学生能概括事件，但本次答案未能体现文本主旨或情感提炼。

缺失 text_evidence
=> supported：学生给出判断，但本次答案中没有可追溯文本依据支撑。

缺失 inference_chain
=> hypothesis：学生答案出现线索或结论，但依据到结论之间的说明关系不足。
```

## 十一、正确答案处理规则

开放题学生答案达到要求时，系统应输出正向诊断。

### 当答案满足要求时

应输出：

```ts
answerStatus: 'fully_meets'
scoreBand: 'high'
correct: true
rootCause: {
  status: 'unresolved',
  explanation: '本次答案已满足题目要求，暂无补弱型 rootCause。'
}
nextActionCandidate: 'next_task' | 'increase_difficulty' | 'transfer_test' | 'maintenance'
```

不应输出：

```text
学生仍然存在能力不足
学生缺少依据
学生不会概括
需要补弱训练
```

### 注意

正确答案只能说明本次任务表现良好。

它不能直接证明该能力已经稳定掌握。

因此，正确答案应形成正向 Evidence Proposal，并建议通过新任务继续验证稳定性和迁移性。

## 十二、建议输出结构

后续 Diagnosis Result 可扩展以下字段：

```ts
export type OpenResponseDiagnosis = {
  taskType: 'open_response';
  correct: boolean | null;
  answerStatus: OpenResponseAnswerStatus;
  scoreBand: OpenResponseScoreBand;

  mainAbilityId: string;
  mainAbilityLabel?: string;
  relatedAbilityIds: string[];

  rubricItems: OpenResponseRubricItem[];
  matchedRubricItems: string[];
  missingRubricItems: string[];

  surfaceError?: string;
  rootCause: RootCauseDiagnosis;
  evidenceProposal: {
    evidenceType: 'positive' | 'weakness' | 'insufficient';
    abilityId: string;
    abilityLabel?: string;
    observation: string;
    evidenceLinks: string[];
  }[];

  diagnosisSummary: string;
  nextActionCandidate:
    | 'retry'
    | 'diagnostic_verification'
    | 'training'
    | 'retest'
    | 'transfer_test'
    | 'increase_difficulty'
    | 'maintenance'
    | 'observe';
  confidence: number;
  evidenceLinks: string[];
};
```

### Phase 早期兼容字段

当前工程早期版本可能仍保留：

```ts
mainAbility: string;
relatedAbilities: string[];
rootCause: string;
abilityEvidence: string[];
nextTraining: string;
```

兼容关系：

| 早期字段 | Phase 8+ 长期协议 |
| --- | --- |
| `mainAbility` | `mainAbilityId` + `mainAbilityLabel` |
| `relatedAbilities` | `relatedAbilityIds` |
| `rootCause: string` | `RootCauseDiagnosis` |
| `abilityEvidence` | `evidenceProposal`，再由 Evidence Extractor 生成正式 AbilityEvidence |
| `nextTraining` | `nextActionCandidate` |

上述兼容字段可继续服务当前 Demo 和早期 Runtime，但不应作为长期协议的唯一字段。

## 十三、与 Training Plan / Training Runtime 的关系

Training Plan Agent / Training Runtime 不应重新判断开放题答案质量。

Training Plan 长期不应绕过 Evidence 层直接消费 Diagnosis 自然语言结论。

长期链路应为：

```text
Diagnosis Result
↓
Ability Evidence Extractor
↓
Ability Evidence
↓
Evaluation Result / Student Ability Profile
↓
Training Plan / Personalized Next Task
```

Training Plan Agent / Training Runtime 可以读取 Diagnosis Result 中的候选信息：

- `answerStatus`
- `scoreBand`
- `mainAbilityId`
- `rootCause`
- `missingRubricItems`
- `evidenceProposal`
- `nextActionCandidate`

但最终训练计划应优先消费：

- Ability Evidence
- Evidence Summary
- Evaluation Result
- Student Ability Profile
- Weakness Ranking 的 candidate action / candidate training focus

当 `answerStatus='fully_meets'` 时：

- Training Plan Agent / Training Runtime 不应生成补弱训练
- 可生成提高难度、迁移验证或巩固训练方案

当 `answerStatus='partially_meets'` 或 `does_not_meet` 时：

- 不应自动生成 weakness 训练
- 应先判断 rootCause 是 `hypothesis` 还是 `supported`
- rootCause 不明确时，应优先进入 `diagnostic_verification`
- rootCause 有支持时，才适合生成训练候选方向

当 `answerStatus='insufficient_evidence'` 时：

- Training Plan Agent / Training Runtime 应优先建议补充作答或重新作答
- 不应直接训练某个能力短板

说明：

早期单题 `Training Agent` 只负责基于一次 Diagnosis Result 生成训练建议。Phase 3.2 之后的核心训练入口是 `Training Plan Agent`，它基于 Top Weakness / Ability Evidence Summary 生成阶段训练计划。

## 十四、与现有 Agent Protocol 的关系

本文档是 `AGENT_PROTOCOL.md` 下的开放题策略规则。

它不改变 Agent 协作协议，而是对 `taskType='open_response'` 时 Diagnosis Agent 的运行边界进行细化。

它只定义 Diagnosis Agent 如何生成更稳定、更可解释、更符合能力理念的 Diagnosis Result 和 Evidence Proposal。

本规则的目标不是增加复杂度，而是避免开放题被错误地简化为关键词匹配或标准答案匹配。

开放题诊断必须体现：

> 不问学生答案是否和参考答案一模一样，而问学生是否完成了题目要求的能力动作。

## 十五、当前实现与长期协议差异

当前实现仍可能存在以下 Phase 早期兼容行为：

- `mainAbility` 使用中文字符串，而非稳定 `abilityId`。
- `rootCause` 仍可能是字符串，而非结构化 `RootCauseDiagnosis`。
- `nextTraining` 仍可能存在，用于早期训练建议。
- `abilityEvidence` 字段可能作为诊断摘要存在，但不应理解为正式 Ability Evidence。
- 部分 Runtime 仍可能直接从 Diagnosis Result 进入 Training 建议。

这些行为不要求本次修改代码。

Phase 8+ 长期协议应逐步收敛到：

- Answer Validity Gate 前置
- `insufficient_evidence` 统一处理无效答案
- `abilityId` 稳定化
- `evidenceProposal` 与正式 `AbilityEvidence` 分离
- `rootCause` 使用 `unresolved / hypothesis / supported`
- `nextActionCandidate` 替代 `nextTraining`
- Training Plan 消费 Ability Evidence、Evaluation Result 和 Profile
- 所有教育结论带 `evidenceLinks`
