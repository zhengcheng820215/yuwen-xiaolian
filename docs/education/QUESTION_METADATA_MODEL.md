# 题目元数据模型（Question Metadata Model）

## 文档定位

本文档定义 AI 语文能力诊断与成长系统中的题目元数据模型（Question Metadata Model）。

`QUESTION_METADATA_MODEL` 不负责定义如何设计题目；题目设计规范由 `QUESTION_MODEL.md` 负责。

本文档负责描述一道具体题目如何被 AI Runtime 理解、诊断、训练和评估。

当前系统已经具备：

- `QUESTION_MODEL.md`：定义题目是能力成长载体
- `DIAGNOSIS_MODEL.md`：定义能力诊断原则
- `TRAINING_MODEL.md`：定义能力训练机制
- `DIAGNOSIS_MODEL.md` 与 Phase 4.2 文档：定义开放题 Runtime 诊断原则与真实 AI Runtime 链路
- Diagnosis Agent
- Diagnosis Router

当前问题是：如果题目只有题干、参考答案和学生答案，AI 很难稳定识别题目的真实教学意图和核心考察能力。

例如：

```text
题目：概括选文主要内容
```

该题核心能力应是“概括”，但如果缺少题目元数据，AI 可能只根据题干或参考答案表层文本误判为“理解”。

因此，每一道进入 AI Runtime 的题目，都应携带题目元数据。

核心原则：

> 题目元数据不是题目内容本身，而是 AI 理解题目、选择诊断策略、生成能力证据的运行依据。

当前 Runtime 说明：

> 当前 Question Metadata 主要服务于 Diagnosis、Evidence 和 Task Matching。
> 早期 Training Agent 相关字段属于 Legacy 设计，不作为当前训练 Runtime 核心入口。
> 当前训练流程由 Training Plan Agent 和 Personalized Next Task Agent 负责。

vNext 增强方向：

> Question Metadata 应逐步从“题目标签”升级为“诊断运行契约”。
> 它需要明确答案接受规则、rubric 命中规则、训练方向映射、常见错误边界以及 metadata 版本来源。
> 当前代码 Schema 可分阶段落地，本文档先定义目标契约。

## 一、模型目标（Model Goal）

`QUESTION_METADATA_MODEL` 的目标是建立一道具体题目的运行层描述。

它回答以下问题：

1. 这道题真正考察什么能力？
2. 这道题应使用哪种答案评价方式？
3. 这道题的能力路径是什么？
4. AI 应按哪些 rubric 要点进行分析？
5. 常见错误有哪些？
6. 诊断结果应如何进入训练方向？

`QUESTION_METADATA_MODEL` 不负责：

- 定义如何出题
- 定义题库组织方式
- 定义页面展示
- 定义 Prompt 话术
- 定义数据库实现

`QUESTION_METADATA_MODEL` 负责：

- 描述具体题目的能力意图
- 标注具体题目的诊断方式
- 提供具体题目的 rubric
- 提供常见错误与训练方向候选空间
- 为 Diagnosis Agent、Ability Evidence Extractor、Training Plan Agent 和 Personalized Next Task Agent 提供结构化输入

## 二、数据结构（Data Structure）

标准题目元数据可以使用 JSON 或 YAML 表达。

### TypeScript 结构

```ts
export type AssessmentMode =
  | 'exact_match'
  | 'key_points'
  | 'reasoning_chain'
  | 'expression_quality'
  | 'process_operation';

export type AnswerAcceptance = {
  acceptedAnswers?: string[];
  acceptedKeywords?: string[];
  semanticEquivalentAllowed?: boolean;
  normalizationRules?: (
    | 'trim'
    | 'ignore_punctuation'
    | 'ignore_whitespace'
    | 'case_insensitive'
  )[];
};

export type RubricImportance =
  | 'critical'
  | 'important'
  | 'supporting';

export type RubricEvidenceRequirement = {
  requireTextEvidence?: boolean;
  requireExplanation?: boolean;
  requireConclusion?: boolean;
};

export type TrainingMapping = {
  rubricItemId: string;
  directionId: string;
};

export type QuestionMetadata = {
  questionId: string;
  metadataVersion: string;
  rubricVersion?: string;
  createdAt?: string;
  updatedAt?: string;
  source?: 'manual' | 'ai_generated' | 'imported';
  reviewStatus?: 'draft' | 'reviewed' | 'frozen';
  subject: string;
  grade: string;
  questionType: string;
  assessmentMode: AssessmentMode;
  answerAcceptance?: AnswerAcceptance;
  mainAbility: string;
  relatedAbilities: string[];
  abilityPath: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  knowledgePoint?: string;
  scoringEnabled?: boolean;
  rubric: QuestionRubricItem[];
  commonErrors: QuestionCommonError[];
  candidateTrainingDirections?: string[];
  trainingMappings?: TrainingMapping[];

  /**
   * Legacy:
   * 当前部分 Runtime 仍读取 trainingDirection。
   * 新链路中应优先使用 candidateTrainingDirections / trainingMappings。
   */
  trainingDirection?: string[];
};

export type QuestionRubricItem = {
  id: string;
  name: string;
  description?: string;
  abilityId?: string;
  importance: RubricImportance;
  required?: boolean;
  weight?: number;
  evidenceRequirement?: RubricEvidenceRequirement;
  acceptedSignals?: string[];
};

export type QuestionCommonError = {
  id?: string;
  name: string;
  description?: string;
  relatedAbility?: string;
};
```

### 字段说明

| 字段 | 说明 |
| --- | --- |
| questionId | 题目唯一标识 |
| metadataVersion | 题目元数据版本 |
| rubricVersion | rubric 版本，可与 metadataVersion 相同或独立维护 |
| createdAt / updatedAt | 元数据创建与更新时间 |
| source | 元数据来源，如人工、AI 生成或导入 |
| reviewStatus | 元数据审核状态 |
| subject | 学科，如语文 |
| grade | 年级或学段 |
| questionType | 题目形式，如阅读简答、反义词、概括题 |
| assessmentMode | 答案评价方式 |
| answerAcceptance | 答案接受规则，尤其用于 exact_match / 短答案题 |
| mainAbility | 题目主要考察能力 |
| relatedAbilities | 题目关联能力 |
| abilityPath | 完成本题需要经过的能力路径 |
| difficulty | 题目难度 |
| knowledgePoint | 可选知识点，仅作为辅助标签 |
| scoringEnabled | 是否启用分数化评分；能力诊断默认不依赖分数 |
| rubric | AI 诊断依据，不是评分结果 |
| commonErrors | 常见错误类型 |
| candidateTrainingDirections | 题目可能支持的训练方向候选 |
| trainingMappings | rubric item 到训练方向的结构化映射 |
| trainingDirection | Legacy 字段，不应作为当前学生最终训练结论 |

### JSON 示例

```json
{
  "questionId": "reading_summary_001",
  "metadataVersion": "1.0.0",
  "rubricVersion": "1.0.0",
  "source": "manual",
  "reviewStatus": "reviewed",
  "subject": "语文",
  "grade": "初中",
  "questionType": "阅读概括",
  "assessmentMode": "key_points",
  "mainAbility": "概括",
  "relatedAbilities": ["信息提取", "理解", "表达"],
  "abilityPath": ["信息提取", "要点筛选", "主题提炼"],
  "difficulty": "medium",
  "knowledgePoint": "记叙文阅读",
  "scoringEnabled": false,
  "rubric": [
    {
      "id": "main_object",
      "name": "人物",
      "description": "是否说清主要人物或对象",
      "abilityId": "information_extraction",
      "importance": "critical",
      "required": true,
      "evidenceRequirement": {
        "requireConclusion": true
      },
      "acceptedSignals": ["人物", "主要对象", "谁"]
    },
    {
      "id": "core_event",
      "name": "事件",
      "description": "是否概括核心事件",
      "abilityId": "summarization",
      "importance": "critical",
      "required": true
    },
    {
      "id": "event_result",
      "name": "结果",
      "description": "是否说明事件结果或变化",
      "abilityId": "summarization",
      "importance": "important",
      "required": true
    },
    {
      "id": "theme",
      "name": "主题",
      "description": "是否提炼文章核心情感或中心思想",
      "abilityId": "comprehension",
      "importance": "critical",
      "required": true
    }
  ],
  "commonErrors": [
    {
      "name": "只复述细节",
      "description": "学生只摘录局部情节，没有完成整体概括",
      "relatedAbility": "概括"
    },
    {
      "name": "缺少主题提炼",
      "description": "学生能说出事件，但没有提炼情感或主旨",
      "relatedAbility": "理解"
    }
  ],
  "candidateTrainingDirections": ["要点筛选训练", "主旨提炼训练", "简洁表达训练"],
  "trainingMappings": [
    {
      "rubricItemId": "core_event",
      "directionId": "core_event_summary_training"
    },
    {
      "rubricItemId": "theme",
      "directionId": "theme_extraction_training"
    }
  ]
}
```

## 三、评估模式定义（Assessment Mode）

`assessmentMode` 不按照具体题型分类，而按照答案评价方式分类。

### 1. exact_match

标准答案匹配。

注意：

```text
exact_match 不等于单一 referenceAnswer 字符串严格相等。
```

它的真实含义应是：

```text
对规范化后的候选答案集合进行匹配。
```

因此，`exact_match` 题目应优先使用 `answerAcceptance` 描述可接受答案规则。

例如：

```ts
answerAcceptance: {
  acceptedAnswers: ['清楚', '明白'],
  acceptedKeywords: ['清楚', '明白', '明确'],
  semanticEquivalentAllowed: true,
  normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace']
}
```

字段边界：

- `referenceAnswer` 是参考表达；
- `answerAcceptance` 是可接受答案规则；
- `rubric` 是能力诊断要点。

三者不能混用。

适用：

- 填空
- 选择
- 反义词
- 近义词
- 默写
- 词语解释中的短答案题

诊断重点：

- 学生答案是否命中参考答案或候选答案
- 是否存在字词错误、记忆错误或基础理解错误
- 是否可以通过规范化、候选答案或语义等价规则接受

不适合：

- 概括题
- 分析题
- 推理题
- 开放表达题

### 2. key_points

要点覆盖。

适用：

- 概括主要内容
- 简答题
- 人物特点概括
- 情节概括
- 信息整合题

诊断重点：

- 是否覆盖关键要点
- 是否遗漏必要对象、事件、结果、主题
- 是否只复述细节而没有概括

### 3. reasoning_chain

推理链判断。

适用：

- 原因分析
- 作用分析
- 理解句子含义
- 推断人物心理
- 分析表达效果

诊断重点：

- 是否找到文本依据
- 是否理解上下文关系
- 是否形成从依据到结论的推理链
- 是否存在过度推断

### 4. expression_quality

表达质量判断。

适用：

- 仿写
- 扩写
- 缩写
- 作文片段
- 语言表达题

诊断重点：

- 表达是否完整
- 语言是否准确
- 结构是否清晰
- 是否符合题目要求
- 是否能体现指定能力目标

### 5. process_operation

过程行为判断。

适用：

- 找依据
- 标关键词
- 修改答案
- 补全推理链
- 圈画、划线、标注类任务

诊断重点：

- 学生是否完成指定操作
- 操作是否对应题目要求
- 操作结果是否能支撑后续诊断
- 是否形成过程性能力证据

## 四、Rubric 诊断规则（Rubric Rules）

`rubric` 不是评分结果，而是 AI 诊断依据。

Rubric 的作用是告诉 AI：

- 本题必须关注哪些要点
- 每个要点对应什么能力
- 哪些要点是关键项
- 缺失某个要点时应如何归因

### Rubric Item 结构

```ts
export type QuestionRubricItem = {
  id: string;
  name: string;
  description?: string;
  abilityId?: string;
  importance: 'critical' | 'important' | 'supporting';
  required?: boolean;
  weight?: number;
  evidenceRequirement?: {
    requireTextEvidence?: boolean;
    requireExplanation?: boolean;
    requireConclusion?: boolean;
  };
  acceptedSignals?: string[];
};
```

### 示例

```json
{
  "id": "text_evidence",
  "name": "文本依据",
  "description": "是否提取支持判断的关键文本线索",
  "abilityId": "information_extraction",
  "importance": "critical",
  "required": true,
  "evidenceRequirement": {
    "requireTextEvidence": true
  },
  "acceptedSignals": ["原文行为", "关键句", "文本线索"]
}
```

```json
{
  "id": "theme",
  "name": "主题",
  "description": "是否提炼文章核心情感或中心思想",
  "abilityId": "comprehension",
  "importance": "critical",
  "required": true
}
```

### 使用原则

- `rubric` 应来自题目目标，而不是从学生答案中倒推。
- `rubric` 不直接等同于考试分数。
- `importance` 表示诊断重要性。
- `weight` 仅作为 Legacy 或评分型任务的辅助字段，不应制造虚假的精确感。
- `scoringEnabled=false` 时，Runtime 不应使用 weight 直接换算分数。
- `required=true` 或 `importance='critical'` 的要点缺失时，应优先影响 `answerStatus` 和 `rootCause`。
- AI 应将 rubric 匹配结果转化为能力证据。

判断优先级：

```text
required / critical 是否成立
↓
关键 rubric 覆盖程度
↓
非关键项覆盖程度
↓
weight 辅助参考
```

也就是说：

```text
required 优先于 weight。
critical 优先于覆盖率。
```

例如某答案覆盖了多个 supporting 要点，但缺少唯一 critical 要点，不能仅因“覆盖率较高”就判断为较好答案。

### Rubric 命中规则

Rubric item 不应只靠名称或描述让 Runtime 自由猜测。

每个关键 item 应尽量定义：

- 是否需要文本依据；
- 是否需要解释关系；
- 是否需要明确结论；
- 哪些信号可以作为命中候选；
- 哪些信号只是辅助，不足以单独命中。

例如人物心理推断题：

```json
{
  "id": "text_evidence",
  "name": "文本依据",
  "abilityId": "information_extraction",
  "importance": "critical",
  "required": true,
  "evidenceRequirement": {
    "requireTextEvidence": true
  }
}
```

```json
{
  "id": "inference_chain",
  "name": "推理链",
  "abilityId": "reasoning",
  "importance": "critical",
  "required": true,
  "evidenceRequirement": {
    "requireTextEvidence": true,
    "requireExplanation": true,
    "requireConclusion": true
  }
}
```

这可以避免系统仅因为答案中出现“心疼”就判断推理能力满足。

## 五、常见错误模型（Common Errors）

`commonErrors` 用于描述该题常见错误类型。

它不是对某个学生的诊断结果，而是该题在运行时可参考的错误空间。

强约束：

```text
Diagnosis Agent 不得仅因为学生答案未命中某个 rubric，
就自动选择一个 commonError。
```

`commonError` 必须有学生答案中的 observable evidence 支撑。

三层概念必须区分：

| 概念 | 含义 | 是否等同诊断事实 |
| --- | --- | --- |
| Common Error | 题目可能出现的候选错误模式 | 否 |
| Observed Error | 本次答案中可观察到的错误表现 | 是，但只限本次作答 |
| Root Cause | 在证据充分时形成的归因 | 是，但必须可追溯 |

例如学生没有提炼主题，不一定就是“理解能力不足”，也可能是：

- 未理解题目要求；
- 只完成了一半；
- 表达遗漏；
- 作答时间不足；
- 无效作答；
- 证据不足。

因此：

```text
Common Error = 候选错误模式
Observed Error = 本次已被证据支持的错误表现
Root Cause = 在证据充分时形成的归因
```

三者不能合并。

### Common Error 结构

```ts
export type QuestionCommonError = {
  name: string;
  description?: string;
  relatedAbility?: string;
};
```

### 概括题常见错误

- 只复述细节
- 遗漏关键事件
- 缺少主题提炼
- 表达冗长
- 要点不完整

### 推理题常见错误

- 无文本依据
- 只给结论
- 推理链断裂
- 过度推断
- 忽略上下文

### 分析题常见错误

- 只复述内容，不分析作用
- 分析对象不明确
- 缺少文本依据
- 结论空泛
- 表达不完整

### 表达题常见错误

- 不符合题目要求
- 句式不完整
- 逻辑混乱
- 语言空泛
- 缺少层次

## 六、训练方向映射（Training Mapping）

Question Metadata 可以描述这道题可能支持哪些训练方向，但不能直接决定某个学生下一步应该训练什么。

核心边界：

```text
题目可能暴露的训练方向
≠ 当前学生真实需要的训练方向
```

Legacy 字段：

```ts
trainingDirection?: string[];
```

`trainingDirection` 仅表示早期 Runtime 使用的候选训练方向，不应作为当前训练 Runtime 的核心入口。

推荐字段：

```ts
candidateTrainingDirections?: string[];

trainingMappings?: {
  rubricItemId: string;
  directionId: string;
}[];
```

例如：

```json
{
  "candidateTrainingDirections": [
    "主旨提炼训练",
    "简洁表达训练",
    "要点筛选训练"
  ],
  "trainingMappings": [
    {
      "rubricItemId": "theme",
      "directionId": "theme_extraction_training"
    },
    {
      "rubricItemId": "complete_expression",
      "directionId": "concise_expression_training"
    }
  ]
}
```

最终训练方向应由以下链路决定：

```text
实际缺失 Rubric
-> Observed Error
-> Root Cause
-> Training Plan Agent / Personalized Next Task Agent
```

也就是说：

- metadata 只提供候选空间；
- Diagnosis Runtime 判断本次学生实际缺失；
- Evidence 记录可追溯表现；
- Training Plan Agent / Personalized Next Task Agent 决定最终训练任务。

## 七、版本与来源追溯（Version and Source）

题目元数据本身需要版本和来源。

原因：

- rubric 可能调整；
- 主能力可能重新标注；
- 难度可能修正；
- Prompt 策略可能变化；
- AI 生成的 metadata 可能需要人工复核。

推荐字段：

```ts
metadataVersion: string;
rubricVersion?: string;
createdAt?: string;
updatedAt?: string;
source?: 'manual' | 'ai_generated' | 'imported';
reviewStatus?: 'draft' | 'reviewed' | 'frozen';
```

Review 状态含义：

| reviewStatus | 含义 |
| --- | --- |
| `draft` | 初稿，可用于调试，不建议进入长期证据 |
| `reviewed` | 已通过基本人工或规则审核，可进入 Beta Runtime |
| `frozen` | 已冻结，用于稳定题库或长期 evidence 追溯 |

Evidence 应尽量记录：

```ts
questionMetadataVersion: string;
rubricVersion: string;
```

这样后续发现结论不对时，可以追溯到底是：

- AI 诊断错误；
- rubric 本身设计错误；
- metadata 后来发生变化；
- 学生答案证据不足；
- Prompt / Runtime 策略发生变化。

## 八、与现有系统关系（System Relationship）

### QUESTION_MODEL

`QUESTION_MODEL.md` 负责题目设计规范。

它回答：

```text
题目为什么是能力成长载体？
题目如何支持诊断、训练和评估？
```

### QUESTION_METADATA_MODEL

`QUESTION_METADATA_MODEL.md` 负责具体题目的运行数据。

它回答：

```text
这道具体题目应被 AI 如何理解？
它主要考察什么能力？
它应使用哪种评价方式？
它的 rubric 是什么？
```

### Diagnosis Agent

Diagnosis Agent 应读取 Question Metadata 判断：

- 使用哪种诊断策略
- 关注哪些能力
- 按什么 rubric 分析
- 如何生成 rootCause
- 如何输出 DiagnosisResult，供 Ability Evidence Extractor 转换为长期证据

### Training Plan Agent / Personalized Next Task Agent

Training Plan Agent / Personalized Next Task Agent 应读取诊断缺失项、Ability Evidence 和训练方向映射生成训练方案。

例如：

```text
missing rubric: theme
trainingMappings.theme -> theme_extraction_training
=> 主旨提炼训练
```

Question Metadata 中的 `candidateTrainingDirections` 只是候选空间，不是学生最终训练结论。

### Evaluation Agent

Evaluation Agent 应读取 rubric 判断本次训练或复测是否出现改善信号。

例如：

```text
训练前缺少“主题”
训练后能稳定提炼“主题”
=> 形成概括 / 理解能力的 growth evidence
```

同时，Evaluation Agent 应读取 metadata / rubric version，以确认旧 evidence 与新 metadata 是否仍然可比。

约束：

- Evaluation Agent 可以生成 `positive` / `growth` / `weakness` / `insufficient` 等结构化证据。
- 不应仅凭单次复测宣布“能力已经提升”或“能力已经稳定”。
- 长期能力提升必须由多次 evidence、独立复测和 Student Ability Profile 综合判断。

## 九、完整示例（Examples）

### 示例 1：exact_match 反义词题

```json
{
  "questionId": "vocab_antonym_001",
  "metadataVersion": "1.0.0",
  "rubricVersion": "1.0.0",
  "source": "manual",
  "reviewStatus": "reviewed",
  "subject": "语文",
  "grade": "初中",
  "questionType": "反义词",
  "assessmentMode": "exact_match",
  "answerAcceptance": {
    "acceptedAnswers": ["冷淡", "漠然"],
    "acceptedKeywords": ["冷淡", "漠然", "淡漠"],
    "semanticEquivalentAllowed": true,
    "normalizationRules": ["trim", "ignore_punctuation", "ignore_whitespace"]
  },
  "mainAbility": "理解",
  "relatedAbilities": ["词义理解", "表达"],
  "abilityPath": ["词义理解", "准确表达"],
  "difficulty": "easy",
  "knowledgePoint": "词语理解",
  "scoringEnabled": false,
  "rubric": [
    {
      "id": "word_relation",
      "name": "答案命中",
      "description": "学生答案是否命中参考答案候选项",
      "abilityId": "comprehension",
      "importance": "critical",
      "required": true,
      "evidenceRequirement": {
        "requireConclusion": true
      }
    }
  ],
  "commonErrors": [
    {
      "name": "词义混淆",
      "description": "学生未能准确理解词语含义",
      "relatedAbility": "理解"
    },
    {
      "name": "答案不规范",
      "description": "学生答案不是一组明确的反义词",
      "relatedAbility": "表达"
    }
  ],
  "candidateTrainingDirections": ["词义辨析训练", "近反义词巩固训练"],
  "trainingMappings": [
    {
      "rubricItemId": "word_relation",
      "directionId": "word_meaning_discrimination_training"
    }
  ]
}
```

### 示例 2：key_points 概括题

```json
{
  "questionId": "reading_summary_001",
  "metadataVersion": "1.0.0",
  "rubricVersion": "1.0.0",
  "source": "manual",
  "reviewStatus": "reviewed",
  "subject": "语文",
  "grade": "初中",
  "questionType": "阅读概括",
  "assessmentMode": "key_points",
  "mainAbility": "概括",
  "relatedAbilities": ["信息提取", "理解", "表达"],
  "abilityPath": ["信息提取", "要点筛选", "主题提炼", "简洁表达"],
  "difficulty": "medium",
  "knowledgePoint": "记叙文阅读",
  "scoringEnabled": false,
  "rubric": [
    {
      "id": "main_object",
      "name": "人物",
      "description": "是否说清主要人物或对象",
      "abilityId": "information_extraction",
      "importance": "critical",
      "required": true
    },
    {
      "id": "core_event",
      "name": "事件",
      "description": "是否概括核心事件",
      "abilityId": "summarization",
      "importance": "critical",
      "required": true
    },
    {
      "id": "event_result",
      "name": "结果",
      "description": "是否说明事件结果或变化",
      "abilityId": "summarization",
      "importance": "important",
      "required": true
    },
    {
      "id": "theme",
      "name": "主题",
      "description": "是否提炼文章核心情感或中心思想",
      "abilityId": "comprehension",
      "importance": "critical",
      "required": true
    }
  ],
  "commonErrors": [
    {
      "name": "只复述细节",
      "description": "学生只摘录局部情节，没有完成整体概括",
      "relatedAbility": "概括"
    },
    {
      "name": "遗漏关键事件",
      "description": "学生答案缺少主要事件或结果",
      "relatedAbility": "信息提取"
    },
    {
      "name": "缺少主题提炼",
      "description": "学生能说出事件，但没有提炼情感或主旨",
      "relatedAbility": "理解"
    }
  ],
  "candidateTrainingDirections": ["要点筛选训练", "主旨提炼训练", "简洁表达训练"],
  "trainingMappings": [
    {
      "rubricItemId": "core_event",
      "directionId": "core_event_summary_training"
    },
    {
      "rubricItemId": "theme",
      "directionId": "theme_extraction_training"
    }
  ]
}
```

### 示例 3：reasoning_chain 句子含义理解题

```json
{
  "questionId": "reading_sentence_meaning_001",
  "metadataVersion": "1.0.0",
  "rubricVersion": "1.0.0",
  "source": "manual",
  "reviewStatus": "reviewed",
  "subject": "语文",
  "grade": "初中",
  "questionType": "句子含义理解",
  "assessmentMode": "reasoning_chain",
  "mainAbility": "理解",
  "relatedAbilities": ["信息提取", "推理", "表达"],
  "abilityPath": ["文本依据提取", "语境理解", "深层含义推断", "完整表达"],
  "difficulty": "medium",
  "knowledgePoint": "记叙文阅读",
  "scoringEnabled": false,
  "rubric": [
    {
      "id": "literal_meaning",
      "name": "表层含义",
      "description": "是否理解句子表面意思",
      "abilityId": "comprehension",
      "importance": "important",
      "required": true
    },
    {
      "id": "context_relation",
      "name": "语境关系",
      "description": "是否结合上下文理解句子所处情境",
      "abilityId": "comprehension",
      "importance": "critical",
      "required": true,
      "evidenceRequirement": {
        "requireTextEvidence": true
      }
    },
    {
      "id": "deep_meaning",
      "name": "深层含义",
      "description": "是否说明句子背后的情感、心理或主题意义",
      "abilityId": "reasoning",
      "importance": "critical",
      "required": true,
      "evidenceRequirement": {
        "requireExplanation": true,
        "requireConclusion": true
      }
    },
    {
      "id": "complete_expression",
      "name": "表达完整",
      "description": "是否用完整语言说明理解结果",
      "abilityId": "expression",
      "importance": "supporting",
      "required": false
    }
  ],
  "commonErrors": [
    {
      "name": "只解释表层意思",
      "description": "学生只解释字面意思，没有结合语境",
      "relatedAbility": "理解"
    },
    {
      "name": "缺少文本依据",
      "description": "学生给出结论，但没有说明上下文依据",
      "relatedAbility": "信息提取"
    },
    {
      "name": "推理链断裂",
      "description": "学生不能从语境推导深层含义",
      "relatedAbility": "推理"
    }
  ],
  "candidateTrainingDirections": ["语境理解训练", "文本依据提取训练", "深层含义推理训练"],
  "trainingMappings": [
    {
      "rubricItemId": "context_relation",
      "directionId": "context_understanding_training"
    },
    {
      "rubricItemId": "deep_meaning",
      "directionId": "deep_meaning_reasoning_training"
    }
  ]
}
```

## 十、运行层使用建议（Runtime Usage）

后续进入 Runtime 时，题目输入不应只包含：

```json
{
  "question": "",
  "referenceAnswer": "",
  "studentAnswer": ""
}
```

而应逐步升级为：

```json
{
  "question": "",
  "referenceAnswer": "",
  "studentAnswer": "",
  "metadata": {
    "questionId": "",
    "metadataVersion": "",
    "rubricVersion": "",
    "source": "manual",
    "reviewStatus": "reviewed",
    "assessmentMode": "",
    "answerAcceptance": {},
    "mainAbility": "",
    "abilityPath": [],
    "rubric": [],
    "commonErrors": [],
    "candidateTrainingDirections": [],
    "trainingMappings": []
  }
}
```

这样 Diagnosis Agent 不需要猜测题目意图，而是基于题目元数据执行稳定诊断。

Evidence 生成时，应尽量保留：

```json
{
  "questionMetadataVersion": "",
  "rubricVersion": ""
}
```

这用于长期追溯：当某条 evidence 未来被用于 Student Profile、Growth Memory 或 Stage Report 时，系统能知道它是基于哪一版题目元数据生成的。

最终目标：

> 让 AI 少猜题目，多读取结构化题目意图。
