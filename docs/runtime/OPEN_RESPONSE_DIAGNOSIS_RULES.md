# 开放题诊断规则（Open Response Diagnosis Rules）

## 文档定位

本文档定义 AI Runtime 中 `open_response` 任务类型的诊断规则。

本文档不是产品模型文档，不是 Prompt 文档，不是题库设计，也不是考试评分规则。

本文档属于 Runtime Layer，用于指导 Diagnosis Agent 在处理开放式语文题时，如何判断答案质量、识别能力要点、生成能力证据，并为 Ability Evidence Extractor、Training Plan Agent 和后续 Training Runtime 提供可消费的结构化诊断结果。

本文档引用但不重新定义以下模型：

- `ABILITY_MODEL.md`
- `DIAGNOSIS_MODEL.md`
- `QUESTION_MODEL.md`
- `AGENT_PROTOCOL.md`

核心原则：

> 开放题不以“是否等于参考答案”为判断标准，而以“是否满足任务要求、覆盖能力要点、形成能力证据”为判断标准。

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

1. 学生答案是否满足题目要求？
2. 学生答案覆盖了哪些能力要点？
3. 学生答案缺失了哪些能力要点？
4. 缺失要点对应什么能力短板？
5. 当前答案能形成哪些能力证据？
6. 下一步应进入训练、复测、提高难度还是迁移验证？

开放题诊断应先判断答案质量，再判断能力状态。

```text
Answer Quality
↓
Rubric Match
↓
Ability Evidence
↓
Root Cause
↓
Next Training / Next Evaluation
```

## 三、答案状态（answerStatus）

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
| fully_meets | 答案完整覆盖核心能力点，可形成正向能力证据 |
| partially_meets | 答案部分满足要求，但存在关键要点缺失、依据不足或表达不完整 |
| does_not_meet | 答案明显未满足题目要求，方向偏离或核心能力任务未完成 |
| insufficient_evidence | 学生答案过短、空泛或无法判断其真实能力状态 |

### 使用原则

- `fully_meets` 不等于能力已经稳定掌握，只能作为正向能力证据。
- `partially_meets` 应进一步定位缺失 rubric 要点。
- `does_not_meet` 应追溯前置能力。
- `insufficient_evidence` 不应强行输出明确能力结论。

## 四、诊断等级（scoreBand）

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
| high | 关键要点完整，表达清晰，能形成较强正向能力证据 |
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

## 五、Rubric Item 结构

开放题应基于 rubric 进行诊断。

Rubric 不是考试评分表，而是能力要点结构。

```ts
export type OpenResponseRubricItem = {
  id: string;
  label: string;
  ability: string;
  required: boolean;
  matched: boolean;
  evidence?: string;
  missingReason?: string;
};
```

| 字段 | 说明 |
| --- | --- |
| id | rubric 要点 ID |
| label | 要点说明 |
| ability | 对应能力，如信息提取、理解、概括、分析、推理、表达 |
| required | 是否为关键要点 |
| matched | 学生答案是否满足该要点 |
| evidence | 学生答案中支撑 matched 的内容 |
| missingReason | 未满足该要点的原因 |

## 六、Rubric 生成原则

每个 `open_response` 任务应生成或引用一组 rubricItems。

Rubric 应来自题目要求和参考答案，而不是从学生答案中倒推。

### 概括题 Rubric 示例

```ts
rubricItems: [
  {
    id: 'main_object',
    label: '是否说清主要对象',
    ability: '信息提取',
    required: true
  },
  {
    id: 'core_event',
    label: '是否概括核心事件',
    ability: '概括',
    required: true
  },
  {
    id: 'theme_or_emotion',
    label: '是否提炼主旨、情感或意义',
    ability: '理解',
    required: true
  },
  {
    id: 'concise_expression',
    label: '是否删除无关细节并表达简洁',
    ability: '表达',
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
    ability: '理解',
    required: true
  },
  {
    id: 'text_evidence',
    label: '是否提供文本依据',
    ability: '信息提取',
    required: true
  },
  {
    id: 'analysis_explanation',
    label: '是否说明依据如何支持结论',
    ability: '分析',
    required: true
  },
  {
    id: 'complete_expression',
    label: '是否表达完整、有层次',
    ability: '表达',
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
    ability: '信息提取',
    required: true
  },
  {
    id: 'context_understanding',
    label: '是否理解上下文关系',
    ability: '理解',
    required: true
  },
  {
    id: 'inference_chain',
    label: '是否形成依据到结论的推理链',
    ability: '推理',
    required: true
  },
  {
    id: 'avoid_over_inference',
    label: '是否避免脱离文本的过度推断',
    ability: '推理',
    required: false
  }
]
```

## 七、Rubric 匹配规则

Rubric 匹配不要求学生答案与参考答案逐字一致。

应判断学生是否表达了等价含义。

### matched 判定

`matched=true` 的条件：

- 学生答案覆盖该要点的核心含义
- 表达方式可以不同，但语义应成立
- 能从学生答案中找到对应证据

`matched=false` 的条件：

- 学生答案未覆盖该要点
- 学生答案只覆盖细节，没有完成该能力动作
- 学生答案方向偏离
- 学生答案过于空泛，无法形成证据

### required 要点

如果 required 要点缺失，应影响 `answerStatus` 和 `scoreBand`。

如果多个 required 要点缺失，通常不应输出 `fully_meets`。

## 八、能力证据生成

开放题诊断应将 rubric 匹配结果转化为能力证据。

### 正向能力证据

当某个 rubric item matched=true 时，可以生成正向证据。

示例：

```text
学生能够提取主要对象。
学生能够概括核心事件。
学生能够基于文本线索形成合理判断。
学生能够使用完整表达呈现结论。
```

### 薄弱能力证据

当 required rubric item matched=false 时，应生成薄弱证据。

示例：

```text
学生能写出事件细节，但未提炼主旨。
学生给出人物特点，但缺少文本依据。
学生能得出结论，但推理链不完整。
学生答案方向相关，但表达不完整。
```

### 待验证证据

当学生答案过短或证据不足时，应生成待验证证据，而不是强行输出能力短板。

## 九、Root Cause 生成规则

`rootCause` 应来自 missing required rubric items。

不能仅因为学生答案与参考答案不完全一致就生成 rootCause。

### 生成原则

- 如果 required rubric 全部 matched，则不生成补弱型 rootCause。
- 如果部分 required rubric 缺失，则根据缺失要点生成 rootCause。
- 如果答案证据不足，则 rootCause 应标记为待验证。
- rootCause 应指向能力短板，而不是题目表面错误。

### 示例

```text
缺失 theme_or_emotion
=> 学生能概括事件，但未能提炼文本主旨或情感。

缺失 text_evidence
=> 学生能给出判断，但缺少文本依据支撑。

缺失 inference_chain
=> 学生能找到线索，但未形成完整推理链。
```

## 十、正确答案处理规则

开放题学生答案达到要求时，系统应输出正向诊断。

### 当答案满足要求时

应输出：

```ts
answerStatus: 'fully_meets'
scoreBand: 'high'
correct: true
rootCause: '本次答案已满足要求，暂无补弱型 rootCause'
nextTraining: '进入下一题 / 提高难度 / 迁移验证 / 巩固训练'
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

因此，正确答案应形成正向能力证据，并建议通过新任务继续验证稳定性和迁移性。

## 十一、建议输出结构

后续 Diagnosis Result 可扩展以下字段：

```ts
export type OpenResponseDiagnosis = {
  taskType: 'open_response';
  correct: boolean | null;
  answerStatus: OpenResponseAnswerStatus;
  scoreBand: OpenResponseScoreBand;
  mainAbility: string;
  relatedAbilities: string[];
  rubricItems: OpenResponseRubricItem[];
  matchedRubricItems: string[];
  missingRubricItems: string[];
  surfaceError: string;
  rootCause: string;
  abilityEvidence: string[];
  diagnosisSummary: string;
  nextTraining: string;
  confidence: number;
};
```

## 十二、与 Training Plan / Training Runtime 的关系

Training Plan Agent / Training Runtime 不应重新判断开放题答案质量。

Training Plan Agent / Training Runtime 只消费 Diagnosis Result 或由其生成的 Ability Evidence 中的：

- `answerStatus`
- `scoreBand`
- `mainAbility`
- `rootCause`
- `missingRubricItems`
- `abilityEvidence`
- `nextTraining`

当 `answerStatus='fully_meets'` 时：

- Training Plan Agent / Training Runtime 不应生成补弱训练
- 可生成提高难度、迁移验证或巩固训练方案

当 `answerStatus='partially_meets'` 或 `does_not_meet` 时：

- Training Plan Agent / Training Runtime 应基于 missingRubricItems、rootCause 或 Top Weakness 生成针对训练方案

当 `answerStatus='insufficient_evidence'` 时：

- Training Plan Agent / Training Runtime 应优先建议补充作答或重新作答，而不是直接训练某个能力短板

说明：

早期单题 `Training Agent` 只负责基于一次 Diagnosis Result 生成训练建议。Phase 3.2 之后的核心训练入口是 `Training Plan Agent`，它基于 Top Weakness / Ability Evidence Summary 生成阶段训练计划。

## 十三、与现有 Agent Protocol 的关系

本文档是 `AGENT_PROTOCOL.md` 下的开放题策略规则。

它不改变 Agent 协作协议。

它只定义 Diagnosis Agent 在 `taskType='open_response'` 时如何生成更稳定、更可解释、更符合能力理念的诊断结果。

本规则的目标不是增加复杂度，而是避免开放题被错误地简化为关键词匹配或标准答案匹配。

开放题诊断必须体现：

> 不问学生答案是否和参考答案一模一样，而问学生是否完成了题目要求的能力动作。
