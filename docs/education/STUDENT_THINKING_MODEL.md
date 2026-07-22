# 学生思考分析模型（Student Thinking Model）

**Status:** MODEL ENHANCED / DETERMINISTIC V1 IMPLEMENTED

## 文档定位

本文档定义系统如何依据正式任务要求、学生原始回答与已校验的 Diagnosis Result / Requirement Coverage，描述当前答案中可观察的思考痕迹。

模型重点回答：

- 当前答案显示学生已经完成了哪个思考动作；
- 该动作为什么有助于完成当前任务；
- 哪个思考连接没有呈现、只完成了一部分或发生了可观察偏差；
- 下一步最值得验证哪个思考动作。

模型不声称还原学生真实的内在思维过程。最终答案只能支持对“外显思考痕迹”的判断，不能证明学生没有进行某项思考。

本文档不负责：

- 判断智力水平、学习态度、性格或心理状态；
- 根据单次答案生成长期能力标签；
- 把未外显的思考直接判定为能力缺失；
- 确认 Root Cause；
- 决定最终训练、复测或下一任务；
- 修改 Ability Evidence、Evaluation Result 或 Student Profile。

推荐表达：

> 本次回答已经写出人物心理判断，但答案中没有呈现文本动作，也没有说明动作如何支持该判断。

禁止表达：

> 学生分析能力差。

## 一、核心定义

### Student Thinking Trace

`Student Thinking Trace` 是当前任务中能够从学生答案、修正过程、提示记录或其他有效行为证据中观察到的思考动作。

它不是学生真实思维的完整还原，也不是长期能力状态。

### Student Thinking Path

`Student Thinking Path` 是完成当前任务可能需要的主要思考节点及其依赖关系。

常见阅读任务可以使用以下示意：

```text
Task Understanding
↓
Information Extraction
↓
Information Organization
↓
Reasoning / Inference
↓
Expression
↓
Self Review
```

该结构只是常见参考，不是固定流水线：

- 不同题目需要的节点不同；
- 信息组织与推理可能并行或反复发生；
- 表达贯穿作答过程，不一定只发生在最后；
- 学生真实思考可能回退、跳转或并行；
- 后一节点出现问题，不代表前一节点必然失败。

正式 Thinking Path 必须由 Question Requirement、Rubric 与 Task Role 共同限定。

## 二、阅读理解 V1 观察节点

### 2.1 任务理解（Task Understanding）

观察学生是否在答案中回应了题目要求的对象、范围和动作。

可观察正向表现：

- 回答对象与题目一致；
- 能区分概括、分析、推断和表达等任务要求；
- 答案包含题目明确要求的结论、依据或解释。

可观察风险表现：

- 回答偏离问题；
- 只复述材料，没有进入题目要求；
- 把分析题回答成概括题。

仅凭偏题不能直接确认学生“没有理解题意”，仍可能存在表达遗漏、作答未完成或任务要求不清等原因。

### 2.2 信息提取（Information Extraction）

观察学生是否在答案中呈现了完成任务需要的文本信息。

可能包括人物动作、语言、神态、环境、限制条件、事件与关键语句。

```text
文本细节
↓
当前任务所需证据
```

“答案中没有证据”只表示证据没有外显，不能自动确认学生没有找到证据。

### 2.3 信息组织（Information Organization）

观察学生是否能够筛选、组合或区分多个信息之间的关系。

可观察风险表现包括：

- 罗列多个细节但没有形成共同指向；
- 事实之间缺少因果、转折、对比或主次关系；
- 重复材料内容但没有组织成观点。

### 2.4 推理形成（Reasoning / Inference）

观察答案是否形成了可追踪的推理连接。

常见结构：

```text
Evidence
↓
Meaning
↓
Conclusion
```

典型断点：

```text
Evidence
↓
Conclusion
```

如果依据和结论同时出现，但没有解释依据为什么支持结论，可以描述为“证据到意义的连接没有外显”，不能直接宣布学生不会推理。

### 2.5 表达输出（Expression）

观察学生是否把已有结论、依据和解释完整外显。

只有存在其他证据表明学生已经理解相关内容时，才能优先形成表达缺口。例如学生在口头说明或前一次修正中已经完成推理，但书面答案没有呈现完整关系。

如果只有一次简短书面回答，应保留不确定性：

> 当前答案没有完整外显解释，尚不能确认是理解连接不足还是表达遗漏。

### 2.6 自我检查（Self Review）

观察学生是否检查：

- 回答是否回应问题；
- 观点是否有依据；
- 解释是否形成完整连接；
- 表达是否遗漏关键部分。

V1 不根据最终答案推断学生已经或没有进行自检。只有存在修改记录、检查操作、自我说明或修正前后对比时，才能形成可观察结果；否则应标记为 `not_observed` 或 `needs_verification`。

## 三、思考步骤状态

长期模型建议使用：

```ts
type ThinkingStepStatus =
  | 'completed'
  | 'partial'
  | 'not_observed'
  | 'misguided'
  | 'needs_verification';
```

| 状态 | 含义 |
| --- | --- |
| `completed` | 有明确证据支持当前步骤已经外显完成 |
| `partial` | 步骤已经出现，但内容或连接尚不完整 |
| `not_observed` | 当前答案中没有呈现，不等于学生没有思考 |
| `misguided` | 有材料事实或任务要求支持其方向发生偏差 |
| `needs_verification` | 现有信息不足以区分缺失、遗漏或理解偏差 |

`misguided` 不能仅根据“答案与参考表述不同”生成，必须引用明确的材料事实、Rubric 或 Answer Acceptance 边界。

## 四、当前 V1 数据契约

当前工程采用克制的最小结构：

```ts
type StudentThinkingAnalysis = {
  status: 'analyzed' | 'cannot_assess' | 'no_gap';
  completedSteps: StudentThinkingStep[];
  interruptedTransition?: {
    fromStep: string;
    toStep: string;
    observedProblem: string;
    evidenceLinks: string[];
    certainty: 'observed' | 'supported' | 'needs_verification';
  };
  unresolvedQuestions: string[];
  limitations: string[];
};
```

V1 不试图填满整条 Thinking Path，只保存：

- 已有明确证据支持的完成步骤；
- 当前最关键的一个可观察连接断点；
- 仍需通过追问、修正或新任务确认的问题；
- 当前分析不能支持的结论。

完整 `thinkingPath[] + ThinkingStepStatus` 属于后续演进方向，不要求当前 Runtime 立即实现。

## 五、输出规则

### 5.1 已经完成的思考

必须同时说明：

- 学生具体写出了、找到了或解释了什么；
- 该动作为什么对完成当前题目有价值；
- 对应的学生答案与 Requirement Evidence Link。

不得只写“尝试判断人物心理”，也不得在 Requirement 尚未命中时强行制造优点。

### 5.2 思考缺口

应描述两个答案动作之间缺少的连接及其影响，例如：

```text
已经写出人物心理
但没有呈现人物动作
因此读者无法判断该结论来自材料中的哪一处
```

思考缺口描述的是当前答案中的可观察机制，不是学生没有外显的真实认知过程。

### 5.3 候选修复目标

模型可以指出下一步最值得验证的思考动作，例如：

- 补充一个能够支持现有观点的文本动作；
- 解释已有动作为什么能支持人物心理；
- 重新检查答案是否回应了题目对象。

它不能直接决定：

- 安排哪一道训练题；
- 是否降低或提高难度；
- 是否进入复测、迁移或长期训练；
- 学生能力状态是否需要改变。

这些决策属于 Feedback Action、Training Strategy、Evaluation 与 Personalized Task Runtime。

## 六、与现有系统的关系

```text
Question Requirement
+ Student Response
↓
Diagnosis Result / Requirement Coverage
↓
├─ StudentThinkingAnalysis
│  └─ 已完成步骤与可观察连接断点
│
└─ LearningGap
   └─ 相对任务要求缺少的能力动作
↓
RootCauseHypothesis（必要时继续验证）
↓
FeedbackActionPlan / Teaching Strategy
```

职责边界：

| 对象 | 职责 |
| --- | --- |
| Question Model / Metadata | 定义当前任务要求观察什么 |
| Diagnosis Model | 判断本次作答状态、Requirement Coverage 与可观察表现 |
| Student Thinking Model | 将已校验事实组织为完成步骤和答案连接断点 |
| Learning Gap Model | 描述相对任务要求缺少的能力动作 |
| Root Cause Hypothesis | 在证据允许时解释为什么可能出现该缺口 |
| Feedback Action Model | 将断点与 Gap 转换为学生可执行的思考提示 |
| Training / Strategy | 决定训练、验证、复测或观察行动 |
| Evaluation | 基于多条 Ability Evidence 形成长期能力结论 |

`StudentThinkingAnalysis` 与 `LearningGap` 不自动生成 Ability Evidence。正式 Evidence 仍必须经过 Answer Validity、Diagnosis 质量、身份、追溯与 Evidence Extractor 契约校验。

## 七、V1 范围

V1 聚焦阅读理解任务中的：

- 是否回应题意；
- 是否呈现关键文本依据；
- 是否组织相关信息；
- 是否建立证据、意义与观点之间的连接；
- 是否把已有理解完整外显。

V1 暂不覆盖：

- 创造力与开放性价值判断；
- 批判性思维成熟度；
- 长期元认知能力；
- 学习习惯、动机和态度；
- 不可从当前行为证据观察的内在思维过程。

## 八、底层约束

- 无效或信息不足的回答不得生成具体完成步骤和思考断点；
- `not_observed` 不等于 `missing ability`；
- Missing Rubric 不自动等于能力短板；
- 思考断点不自动等于 Root Cause；
- 表达遗漏与理解缺口不能在证据不足时强行二选一；
- 不使用“理解能力差、推理能力弱”等固定能力标签；
- 所有完成点与断点都必须带有 `evidenceLinks`；
- 每次分析可以提供候选验证方向，但不能直接决定训练任务；
- 长期能力结论仍由 Evaluation 基于多条 Ability Evidence 形成。

## 九、模型目标

Student Thinking Model 不只回答：

> 学生答案哪里错？

它应在证据允许的范围内回答：

> 当前答案显示学生已经完成了哪一步思考？

> 哪个思考连接没有呈现、只完成了一部分或发生了偏差？

> 下一步最值得验证哪个思考动作？

它不回答：

> 学生真实内心一定是怎样想的？

> 学生长期能力处于什么水平？
