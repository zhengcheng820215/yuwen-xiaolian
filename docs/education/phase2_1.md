# Phase 2.1：Question Metadata Pattern Library v1

## 一、项目背景

Phase 1 已完成。

目前系统已经实现：

- Question Metadata Schema
- QuestionMetadataAgent
- Metadata Validator
- Diagnosis Agent
- Training Agent

当前已经跑通完整链路：

```text
Question
↓
Question Metadata
↓
Metadata Validator
↓
Diagnosis Agent
↓
Training Agent
```

当前 Demo 已支持：

- 自定义输入题目
- 自动生成 Metadata
- Metadata 校验
- Diagnosis
- Training

这说明整个 Education Agent Pipeline 已经成立。

## 二、Phase 2.1 总目标

本阶段不是继续开发 Diagnosis。

也不是继续开发 Training。

本阶段的核心目标是：

> 建立 Question Metadata Pattern Library v1。

最终希望达到：

```text
输入任意真实阅读题
↓
匹配稳定的 Metadata Pattern
↓
生成可用于 Diagnosis 的 Metadata
```

本阶段的重点不是让 QuestionMetadataAgent 变得“更聪明”，而是先沉淀真实语文阅读题中可复用、可校验、可扩展的 Metadata Pattern。

QuestionMetadataAgent 在本阶段的职责是：

```text
识别题目意图
↓
匹配合适的 Metadata Pattern
↓
生成标准 Question Metadata
```

因此，Pattern Library 是本阶段的核心产物。

## 三、本阶段开发原则

### 1. 不修改整体架构

继续保持当前 Agent Pipeline：

```text
Question
↓
QuestionMetadataAgent
↓
Metadata Validator
↓
Diagnosis Agent
↓
Training Agent
```

所有 Agent 必须保持解耦。

Diagnosis 不负责理解题目。

Diagnosis 仅消费 Metadata。

### 2. 不增加新的 Agent

本阶段不引入：

- Evaluation Agent
- Ability Profile
- Database
- LLM 推理
- 长期学习记录

以上内容全部属于后续阶段。

### 3. Question Metadata Pattern Library 是唯一重点

本阶段允许修改：

- `questionMetadataAgent.ts`
- `questionMetadata.schema.ts`
- `questionMetadata.samples.ts`
- `runQuestionMetadataDebug.ts`

本阶段禁止修改：

- DiagnosisAgent
- TrainingAgent
- EvaluationAgent
- 整体 UI

## 四、本阶段目标

建立第一版 Question Metadata Pattern Library。

Pattern Library 用于定义常见真实语文阅读题的标准 Metadata 生成模式。

每一个 Pattern 至少应定义：

- `patternId`
- `questionType`
- `assessmentMode`
- `mainAbility`
- `relatedAbilities`
- `abilityPath`
- `rubric`
- 典型问法
- 常见错误归类

QuestionMetadataAgent 不应直接为每一道题临时拼装 Metadata，而应优先匹配 Pattern Library 中的稳定 Pattern。

至少支持以下题型：

- 信息提取题
- 概括题
- 句子含义题
- 推理题
- 人物形象分析题
- 作用分析题
- 表达效果题
- 表达题

本阶段重点不是增加更多 `if-else`。

重点是：

> 建立稳定、可复用的 Metadata Pattern。

在当前 mock 规则阶段，允许使用规则进行识别。

但规则应围绕“Pattern 匹配”抽象，而不是针对单个题目文本硬编码。

例如，以下问题：

- 分析父亲形象。
- 父亲是一个怎样的人？
- 结合全文评价父亲。
- 作者塑造了怎样的父亲？

应该匹配同一个 Metadata Pattern，并生成一致的 Metadata：

- `questionType`
- `assessmentMode`
- `mainAbility`
- `abilityPath`
- `rubric`

而不是依赖单一固定关键词。

同样，以下问题：

- 赏析画线句。
- 说说这句话好在哪里。
- 分析表达效果。
- 这句话有什么妙处？

也应该匹配同一个 Metadata Pattern，并生成一致的 Metadata。

## 五、Pattern 输出要求

Pattern Library 中的每个 Pattern 需要稳定输出标准 Metadata。

生成结果至少包含：

- `subject`
- `questionType`
- `assessmentMode`
- `mainAbility`
- `relatedAbilities`
- `abilityPath`
- `rubric`

其中 `rubric` 应包含：

- `id`
- `name`
- `description`
- `ability`
- `weight`

本阶段必须保持当前 Metadata Schema 稳定。

不得为了单个题型随意修改 Schema。

Pattern Library 可以扩展 Pattern 数量，但不应随意扩展 Metadata 字段。

字段扩展必须服务长期 Metadata Contract，而不是服务某一道题的临时需求。

## 六、Benchmark 要求

扩展：

```text
src/ai/tests/questionMetadata.samples.ts
```

建立 Metadata Pattern Benchmark。

Benchmark 至少包含 20 道真实阅读题。

覆盖题型包括：

- 信息提取
- 概括
- 含义理解
- 推理
- 人物分析
- 作用分析
- 表达效果
- 表达

每类至少包含 2 到 3 种不同表达方式。

例如，人物分析题应覆盖：

- 分析人物形象
- 人物有什么特点
- 评价人物
- 结合全文分析人物

这些不同问法最终应生成一致、稳定的 Metadata。

Benchmark 不只是测试 Generator 是否能通过样例。

Benchmark 更重要的作用是验证：

```text
同一类题是否稳定匹配同一个 Pattern
不同类题是否不会误匹配
Pattern 输出是否可被 Validator 和 Diagnosis 消费
```

## 七、Validation 要求

继续使用现有 Metadata Validator。

所有 Benchmark 样例必须满足：

```text
validation.valid == true
```

Validator 至少应继续检查：

- 必填字段是否存在
- `questionType` 与 `assessmentMode` 是否明显冲突
- `mainAbility` 是否明显偏离题目任务
- `rubric` 是否为空
- 同一 Pattern 是否生成稳定的核心 rubric

### 同类问法一致性

同一 Pattern 的不同表达方式，生成的核心 Metadata 必须保持一致。

至少要求以下字段一致：

- `questionType`
- `assessmentMode`
- `mainAbility`

例如，以下问题：

- 分析父亲形象。
- 父亲是一个怎样的人？
- 结合全文评价父亲。
- 作者塑造了怎样的父亲？

均应输出：

```text
questionType: 人物形象分析
assessmentMode: reasoning_chain
mainAbility: 分析
```

再例如，以下问题：

- 赏析画线句。
- 说说这句话好在哪里。
- 分析表达效果。
- 这句话有什么妙处？

均应输出：

```text
questionType: 表达效果
assessmentMode: reasoning_chain
mainAbility: 分析
```

### 错误归类反例

Validator 或 Debug Benchmark 应能发现明显错误归类或错误 Pattern 匹配。

至少需要覆盖以下反例：

- 句子含义题不得归为推理题。
- 人物形象题不得归为概括题。
- 表达效果题不得归为普通表达题。
- 信息提取题不得归为理解题。
- 概括题不得归为信息提取题。

这些反例的目标不是扩大题型数量，而是防止 QuestionMetadataAgent 在常见真实题中匹配错误 Pattern。

## 八、Debug 要求

继续维护：

```bash
npm run debug:question-metadata
```

要求：

```text
Total >= 20
PASS = Total
FAIL = 0
```

Debug 输出建议包含：

- Question
- Matched Pattern
- Generated Metadata
- Validation
- Expected QuestionType
- Expected MainAbility
- PASS / FAIL

Debug 输出还应增加按题型统计通过率。

示例：

```text
信息提取：3 / 3
概括：3 / 3
句子含义：3 / 3
推理：3 / 3
人物分析：3 / 3
作用分析：2 / 2
表达效果：2 / 2
表达：2 / 2
```

这样可以明确判断是整体通过，还是某一类题型仍然不稳定。

这样后续可以持续扩展 Benchmark，并快速发现 Pattern 匹配或 Pattern 输出的退化问题。

## 九、本阶段不追求

本阶段不追求：

- 覆盖全部语文题
- Metadata 百分之百准确
- 真正理解所有阅读题
- LLM 推理能力
- 数据库接入
- 学生长期画像
- Evaluation Agent

本阶段也不应为了追求样例准确率而不断增加硬编码规则。

本阶段重点验证：

> Question Metadata Pattern Library 是否能够覆盖常见真实阅读题，并稳定生成可供 Diagnosis 使用的统一 Metadata。

## 十、Phase 2.1 Definition of Done

完成以下内容即可收敛：

- 建立 Question Metadata Pattern Library v1。
- Pattern Library 覆盖上述常见阅读题。
- QuestionMetadataAgent 能基于 Pattern Library 匹配并生成 Metadata。
- Metadata Schema 保持稳定。
- Validator 全部通过。
- 建立不少于 20 道真实阅读题 Benchmark。
- 每类题至少支持 2 到 3 种不同问法。
- 同类问法生成的 `questionType`、`assessmentMode`、`mainAbility` 保持一致。
- Debug Benchmark 能识别并暴露明显错误归类或错误 Pattern 匹配。
- Debug 输出包含按题型统计通过率。
- Debug 输出包含 Matched Pattern。
- 所有样例均可直接进入完整链路：

```text
Question
↓
Metadata
↓
Validator
↓
Diagnosis
↓
Training
```

并且无需人工修改 Metadata。

## 十一、最终原则

本阶段必须始终遵循一个原则：

> 目标不是增加更多题型，而是建立稳定可复用的 Question Metadata Pattern Library。

如果某个题型只是依赖单个关键词或单道题文本硬编码识别，即使能够通过样例，也不属于本阶段的最佳实现。

应尽可能让不同表达方式、但本质相同的问题，匹配同一个 Pattern，并生成一致且稳定的 Metadata，为后续 Diagnosis Agent、Training Agent，以及未来扩展到数学、英语、物理等学科奠定统一的数据契约。

这个数据契约即：

```text
Metadata Contract
```
