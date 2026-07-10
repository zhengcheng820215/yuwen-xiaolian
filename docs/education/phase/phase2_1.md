# Phase 2.1：Question Metadata Pattern Library v1

当前状态：已完成基础链路建设，后续暂时冻结为底层能力维护，不作为 Phase 3 主线。

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

## 六、Pattern Contract

Question Metadata Pattern 是 Phase 2.1 的核心契约。

一个 Pattern 不只是若干关键词规则，而是一组可复用的题目理解与 Metadata 输出约定。

最小结构：

```ts
type QuestionMetadataPattern = {
  patternId: string;
  questionType: string;
  assessmentMode: string;
  mainAbility: string;
  relatedAbilities: string[];
  abilityPath: string[];
  rubric: RubricItem[];
  examples: string[];
  negativeExamples: string[];
  matcherNotes: string;
};
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `patternId` | Pattern 的稳定标识 |
| `questionType` | 题目类型输出 |
| `assessmentMode` | 答案评价方式 |
| `mainAbility` | 主要诊断能力 |
| `relatedAbilities` | 相关能力 |
| `abilityPath` | 能力路径 |
| `rubric` | 可观察评分 / 诊断依据 |
| `examples` | 应匹配该 Pattern 的典型问法 |
| `negativeExamples` | 不应匹配该 Pattern 的反例 |
| `matcherNotes` | Pattern 匹配边界说明 |

示例：

```ts
{
  patternId: "sentence_meaning",
  questionType: "句子含义",
  assessmentMode: "reasoning_chain",
  mainAbility: "理解",
  relatedAbilities: ["信息提取", "推理", "表达"],
  abilityPath: ["字词含义理解", "语境分析", "深层含义理解", "情感体会"],
  rubric: [
    {
      id: "literal_meaning",
      name: "字面含义转换",
      description: "是否理解关键词不是停留在表层意思",
      ability: "理解",
      weight: 30
    }
  ],
  examples: [
    "说说这句话的含义",
    "理解画线句的深层含义"
  ],
  negativeExamples: [
    "推测人物为什么这样做",
    "分析人物形象"
  ],
  matcherNotes: "句子含义题重点判断语境和深层含义，不应默认归为推理题。"
}
```

使用原则：

- Pattern 必须同时定义正例和反例。
- Pattern 输出必须满足 Metadata Schema。
- Pattern 不能为单道题临时扩展字段。
- Pattern 匹配失败应回到 Pattern Library 修复，而不是让 Diagnosis 重新解释 Question。

## 七、Benchmark 要求

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

## 八、Validation 要求

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

### Validator Pass 与 Pattern Match Pass

Phase 2.1 必须区分两类通过：

```text
Validator Pass
=
Metadata 结构合法，可被下游消费

Pattern Match Pass
=
题目匹配到了正确 Pattern，语义方向正确
```

`validation.valid == true` 只能说明 Metadata 结构可用，不代表 Pattern 匹配正确。

例如：

```text
句子含义题
↓
错误匹配为推理题
↓
字段完整
↓
Validator 可能仍然通过
```

因此 Debug 必须同时输出：

- Validator Pass / Fail
- Pattern Match Pass / Fail
- Expected Pattern
- Actual Matched Pattern

只有两者同时通过，才能认为该样例真正通过。

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

### negativeExamples 要求

每个稳定 Pattern 都应逐步补充 `negativeExamples`。

`negativeExamples` 用于描述：

- 哪些题目看起来相似，但不应匹配当前 Pattern。
- 哪些关键词不能作为单独匹配依据。
- 当前 Pattern 与相邻 Pattern 的边界。

示例：

| Pattern | examples | negativeExamples |
| --- | --- | --- |
| 句子含义 | 理解画线句含义、说说这句话的深层含义 | 推测人物为什么这样做、分析人物形象 |
| 人物形象 | 分析人物形象、父亲是一个怎样的人 | 概括文章主要内容、分析句子表达效果 |
| 表达效果 | 赏析画线句、分析表达效果 | 写一段话表达观点、概括段落内容 |

Debug Benchmark 后续应逐步利用 `negativeExamples` 发现误匹配。

## 九、Debug 要求

继续维护：

```bash
pnpm run debug:question-metadata
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

## 十、Sprint 2.1.1：建立第一版 Benchmark

Sprint 2.1.1 的目标不是提升通过率，而是先建立一套可靠、可重复运行的 Metadata Benchmark。

本 Sprint 的 Benchmark 规模为 40 道真实阅读题，覆盖 8 类题型：

| 题型 | 数量 |
| --- | --- |
| 信息提取 | 5 |
| 概括 | 5 |
| 句子含义 | 5 |
| 推理 | 5 |
| 人物分析 | 5 |
| 作用分析 | 5 |
| 表达效果 | 5 |
| 表达 | 5 |

本 Sprint 的收敛标准：

- Benchmark 建立完成。
- 每道题都包含题目、参考答案、学生答案和预期 Metadata。
- 每道题都可自动生成 Question Metadata。
- 每道题都可进入 Metadata Validator。
- 每道题都可进入 Diagnosis Agent。
- Debug 输出每道题的 PASS / FAIL。
- Debug 输出按题型统计结果。

本 Sprint 不要求：

- `PASS = Total`
- 所有 Pattern 均完全命中预期
- 所有题型达到稳定可用

本 Sprint 的核心价值是建立基线。失败样例不是阶段失败，而是后续优化 Pattern Library 的证据。

## 十一、Sprint 2.1.2：修 Pattern Library

Sprint 2.1.2 的目标是基于 Benchmark 暴露出的失败样例修复 Pattern Library。

流程：

```text
Benchmark
↓
发现 FAIL
↓
判断失败原因
↓
修 Pattern
↓
重新运行完整 Benchmark
```

本 Sprint 只允许围绕 QuestionMetadataAgent 和 Pattern Library 调整：

- Pattern matcher
- Pattern anti-matcher
- examples
- negativeExamples
- rubric 稳定输出

不允许：

- 修改 Diagnosis
- 修改 Training
- 修改 UI
- 为单道题写特殊规则

修复完成的标准不是某一道题通过，而是完整 Benchmark 没有明显回归。

## 十二、Sprint 2.1.3：质量指标

Sprint 2.1.3 的目标是在 Benchmark Debug 中加入质量指标，使 Pattern Library 的稳定性可以被持续观察。

Debug 输出至少包含：

- PASS 数量
- FAIL 数量
- PASS Rate
- 每类题型通过率
- 低置信度数量
- Validator Fail 数量
- QuestionType 识别错误数量
- AssessmentMode 错误数量

建议同时保留：

- MainAbility 错误数量
- Pattern 匹配错误数量
- Diagnosis 不可进入数量

质量指标不用于替代逐题报告。逐题报告用于定位问题，质量指标用于判断整体趋势。

低置信度阈值可作为调试参数维护，当前建议值为：

```text
confidence < 0.75
```

本 Sprint 不改变 QuestionMetadataAgent 的业务逻辑，不改 Diagnosis，不改 Training，不改 UI。

## 十三、Sprint 2.1.4：验收门槛

Sprint 2.1.4 的目标是在质量指标基础上形成可执行的验收门槛。

Benchmark Debug 不只输出质量指标，还必须判断当前结果是否通过验收。

当前验收门槛如下：

| 指标 | 要求 |
| --- | --- |
| 总体通过率 | >= 90% |
| 每类通过率 | >= 85% |
| Validator Fail | 0 |
| 崩溃数量 | 0 |
| Metadata 缺字段数量 | 0 |

其中：

- 总体通过率用于判断 Pattern Library 整体稳定性。
- 每类通过率用于避免某一类题型被整体平均值掩盖。
- Validator Fail 必须为 0，确保所有 Metadata 都满足结构契约。
- 崩溃数量必须为 0，确保 Debug 可连续运行。
- Metadata 缺字段数量必须为 0，确保下游 Diagnosis 可消费。

Debug 输出应包含：

```text
Acceptance Gate
---------------
[PASS] Overall PASS Rate: required >= 90%, actual ...
[PASS] Each Type PASS Rate: required >= 85%, actual ...
[PASS] Validator Fail: required 0, actual ...
[PASS] Crash Count: required 0, actual ...
[PASS] Metadata Missing Fields: required 0, actual ...
Gate Result: PASS
```

当任一验收门槛不满足时，Debug 脚本应返回失败状态，阻止将不稳定的 Pattern Library 误判为可验收。

## 十四、与 Phase 3 的边界

Phase 3 只消费 Phase 2.1 输出的 Question Metadata。

Phase 3 不负责重新解释 Question。

边界原则：

- Diagnosis Agent 使用 Metadata 判断诊断策略和主要能力。
- Training Agent 使用 Diagnosis / Evidence 生成训练目标。
- Phase 3 不通过重新理解题干来修正 Metadata。
- 如果 Metadata 错误，应回到 Phase 2.1 修复 Pattern Library。

这条边界可以避免下游 Agent 重复承担上游职责，保证系统职责清晰：

```text
Phase 2.1
负责 Question -> Metadata

Phase 3
负责 Metadata / Diagnosis -> Evidence -> Training
```

## 十五、本阶段不追求

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

## 十六、Phase 2.1 Definition of Done

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
- Debug Benchmark 能区分 Validator Pass 与 Pattern Match Pass。
- Pattern 能维护 `examples` 与 `negativeExamples`。
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

## 十七、最终原则

本阶段必须始终遵循一个原则：

> 目标不是增加更多题型，而是建立稳定可复用的 Question Metadata Pattern Library。

如果某个题型只是依赖单个关键词或单道题文本硬编码识别，即使能够通过样例，也不属于本阶段的最佳实现。

应尽可能让不同表达方式、但本质相同的问题，匹配同一个 Pattern，并生成一致且稳定的 Metadata，为后续 Diagnosis Agent、Training Agent，以及未来扩展到数学、英语、物理等学科奠定统一的数据契约。

这个数据契约即：

```text
Metadata Contract
```

