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

## 一、模型目标

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
- 提供常见错误与训练方向
- 为 Diagnosis Agent、Ability Evidence Extractor、Training Plan Agent 和 Personalized Next Task Agent 提供结构化输入

## 二、Question Metadata 数据结构

标准题目元数据可以使用 JSON 或 YAML 表达。

### TypeScript 结构

```ts
export type AssessmentMode =
  | 'exact_match'
  | 'key_points'
  | 'reasoning_chain'
  | 'expression_quality'
  | 'process_operation';

export type QuestionMetadata = {
  questionId: string;
  subject: string;
  grade: string;
  questionType: string;
  assessmentMode: AssessmentMode;
  mainAbility: string;
  relatedAbilities: string[];
  abilityPath: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  knowledgePoint?: string;
  rubric: QuestionRubricItem[];
  commonErrors: QuestionCommonError[];
  trainingDirection: string[];
};

export type QuestionRubricItem = {
  name: string;
  description?: string;
  ability?: string;
  weight: number;
  required?: boolean;
};

export type QuestionCommonError = {
  name: string;
  description?: string;
  relatedAbility?: string;
};
```

### 字段说明

| 字段 | 说明 |
| --- | --- |
| questionId | 题目唯一标识 |
| subject | 学科，如语文 |
| grade | 年级或学段 |
| questionType | 题目形式，如阅读简答、反义词、概括题 |
| assessmentMode | 答案评价方式 |
| mainAbility | 题目主要考察能力 |
| relatedAbilities | 题目关联能力 |
| abilityPath | 完成本题需要经过的能力路径 |
| difficulty | 题目难度 |
| knowledgePoint | 可选知识点，仅作为辅助标签 |
| rubric | AI 诊断依据，不是评分结果 |
| commonErrors | 常见错误类型 |
| trainingDirection | 诊断后可能进入的训练方向 |

### JSON 示例

```json
{
  "questionId": "reading_summary_001",
  "subject": "语文",
  "grade": "初中",
  "questionType": "阅读概括",
  "assessmentMode": "key_points",
  "mainAbility": "概括",
  "relatedAbilities": ["信息提取", "理解", "表达"],
  "abilityPath": ["信息提取", "要点筛选", "主题提炼"],
  "difficulty": "medium",
  "knowledgePoint": "记叙文阅读",
  "rubric": [
    {
      "name": "人物",
      "description": "是否说清主要人物或对象",
      "ability": "信息提取",
      "weight": 20,
      "required": true
    },
    {
      "name": "事件",
      "description": "是否概括核心事件",
      "ability": "概括",
      "weight": 30,
      "required": true
    },
    {
      "name": "结果",
      "description": "是否说明事件结果或变化",
      "ability": "概括",
      "weight": 20,
      "required": true
    },
    {
      "name": "主题",
      "description": "是否提炼文章核心情感或中心思想",
      "ability": "理解",
      "weight": 30,
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
  "trainingDirection": ["要点筛选训练", "主旨提炼训练", "简洁表达训练"]
}
```

## 三、assessmentMode 定义

`assessmentMode` 不按照具体题型分类，而按照答案评价方式分类。

### 1. exact_match

标准答案匹配。

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

## 四、rubric 评分标准模型

`rubric` 不是评分结果，而是 AI 诊断依据。

Rubric 的作用是告诉 AI：

- 本题必须关注哪些要点
- 每个要点对应什么能力
- 哪些要点是关键项
- 缺失某个要点时应如何归因

### Rubric Item 结构

```ts
export type QuestionRubricItem = {
  name: string;
  description?: string;
  ability?: string;
  weight: number;
  required?: boolean;
};
```

### 示例

```json
{
  "name": "主题",
  "description": "是否提炼文章核心情感或中心思想",
  "ability": "理解",
  "weight": 30,
  "required": true
}
```

### 使用原则

- `rubric` 应来自题目目标，而不是从学生答案中倒推。
- `rubric` 不直接等同于考试分数。
- `weight` 表示诊断权重，不表示最终成绩。
- `required=true` 的要点缺失时，应影响 `answerStatus` 和 `rootCause`。
- AI 应将 rubric 匹配结果转化为能力证据。

## 五、commonErrors 模型

`commonErrors` 用于描述该题常见错误类型。

它不是对某个学生的诊断结果，而是该题在运行时可参考的错误空间。

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

## 六、与现有系统关系

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
- 如何生成 abilityEvidence

### Training Agent

Training Agent 应读取诊断缺失项生成训练方案。

例如：

```text
missing rubric: 主题
=> 主旨提炼训练
```

### Evaluation Agent

Evaluation Agent 应读取 rubric 判断能力是否提升。

例如：

```text
训练前缺少“主题”
训练后能稳定提炼“主题”
=> 概括 / 理解能力形成成长证据
```

## 七、完整示例

### 示例 1：exact_match 反义词题

```json
{
  "questionId": "vocab_antonym_001",
  "subject": "语文",
  "grade": "初中",
  "questionType": "反义词",
  "assessmentMode": "exact_match",
  "mainAbility": "理解",
  "relatedAbilities": ["词义理解", "表达"],
  "abilityPath": ["词义理解", "准确表达"],
  "difficulty": "easy",
  "knowledgePoint": "词语理解",
  "rubric": [
    {
      "name": "答案命中",
      "description": "学生答案是否命中参考答案候选项",
      "ability": "理解",
      "weight": 100,
      "required": true
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
  "trainingDirection": ["词义辨析训练", "近反义词巩固训练"]
}
```

### 示例 2：key_points 概括题

```json
{
  "questionId": "reading_summary_001",
  "subject": "语文",
  "grade": "初中",
  "questionType": "阅读概括",
  "assessmentMode": "key_points",
  "mainAbility": "概括",
  "relatedAbilities": ["信息提取", "理解", "表达"],
  "abilityPath": ["信息提取", "要点筛选", "主题提炼", "简洁表达"],
  "difficulty": "medium",
  "knowledgePoint": "记叙文阅读",
  "rubric": [
    {
      "name": "人物",
      "description": "是否说清主要人物或对象",
      "ability": "信息提取",
      "weight": 20,
      "required": true
    },
    {
      "name": "事件",
      "description": "是否概括核心事件",
      "ability": "概括",
      "weight": 30,
      "required": true
    },
    {
      "name": "结果",
      "description": "是否说明事件结果或变化",
      "ability": "概括",
      "weight": 20,
      "required": true
    },
    {
      "name": "主题",
      "description": "是否提炼文章核心情感或中心思想",
      "ability": "理解",
      "weight": 30,
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
  "trainingDirection": ["要点筛选训练", "主旨提炼训练", "简洁表达训练"]
}
```

### 示例 3：reasoning_chain 句子含义理解题

```json
{
  "questionId": "reading_sentence_meaning_001",
  "subject": "语文",
  "grade": "初中",
  "questionType": "句子含义理解",
  "assessmentMode": "reasoning_chain",
  "mainAbility": "理解",
  "relatedAbilities": ["信息提取", "推理", "表达"],
  "abilityPath": ["文本依据提取", "语境理解", "深层含义推断", "完整表达"],
  "difficulty": "medium",
  "knowledgePoint": "记叙文阅读",
  "rubric": [
    {
      "name": "表层含义",
      "description": "是否理解句子表面意思",
      "ability": "理解",
      "weight": 20,
      "required": true
    },
    {
      "name": "语境关系",
      "description": "是否结合上下文理解句子所处情境",
      "ability": "理解",
      "weight": 25,
      "required": true
    },
    {
      "name": "深层含义",
      "description": "是否说明句子背后的情感、心理或主题意义",
      "ability": "推理",
      "weight": 35,
      "required": true
    },
    {
      "name": "表达完整",
      "description": "是否用完整语言说明理解结果",
      "ability": "表达",
      "weight": 20,
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
  "trainingDirection": ["语境理解训练", "文本依据提取训练", "深层含义推理训练"]
}
```

## 八、运行层使用建议

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
    "assessmentMode": "",
    "mainAbility": "",
    "abilityPath": [],
    "rubric": [],
    "commonErrors": [],
    "trainingDirection": []
  }
}
```

这样 Diagnosis Agent 不需要猜测题目意图，而是基于题目元数据执行稳定诊断。

最终目标：

> 让 AI 少猜题目，多读取结构化题目意图。
