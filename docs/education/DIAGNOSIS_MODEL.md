# 能力诊断模型（Diagnosis Model）

## 文档定位

本文档是 AI 语文能力诊断与成长系统的核心诊断模型。

本模型负责定义：

- AI 如何从学生作答中识别可观察的能力表现
- AI 如何判断本次作答是否能够形成诊断证据
- AI 如何提出有证据支持的根因假设
- AI 如何生成可供长期能力状态判断使用的能力证据

本文档不是 Prompt，不是算法设计，不是页面说明，也不是训练方案。

本文档是一份可被 AI 调用、可被程序实现、可长期扩展的能力诊断模型。

未来以下模块必须引用本模型：

- Training
- Evaluation
- Question
- AI Coach
- Student Profile
- Prompt Guide

本文档的核心目标不是解释诊断，而是建立整个系统统一的 Diagnosis Language（诊断语言）。未来所有 AI 行为、Prompt 编写、能力分析和训练建议，都必须引用本模型。

本文档用于回答以下问题：

1. AI 如何判断本次作答暴露了哪些可观察表现？
2. 一道题为什么不能直接判断能力？
3. AI 如何判断本次作答是否有效？
4. AI 如何识别有证据支持的候选错误原因？
5. AI 如何区分“表面错误”与“根因假设”？
6. AI 如何形成能力证据？
7. AI 如何把本次证据提交给 Evaluation / Profile Runtime？

本系统诊断的是能力，不是题目。

## 一、诊断模型定义（Diagnosis Definition）

能力诊断不是判断一道题是否正确。

能力诊断是通过观察学生在具体任务中的思维表现，识别本次可观察的问题，并生成可被长期累计的能力证据。

诊断目标不是判断“错了”，而是回答：

```text
为什么错？
```

诊断应关注学生在完成语文任务时的思维路径，包括审题、定位、理解、概括、分析、推理和表达等环节。

一道题只提供一次观察机会，不能直接等同于能力结论。系统需要通过多次作答、不同文本、不同题型、修正过程、迁移任务和复测结果，持续形成能力证据。

因此，诊断模型必须区分四类对象：

| 对象 | 说明 |
| --- | --- |
| 作答结果 | 学生最终答案是否符合任务要求 |
| 思维过程 | 学生如何理解题目、寻找依据、组织判断和表达答案 |
| 本次诊断证据 | 本次作答中可观察、可追溯、可解释的能力表现 |
| 长期能力状态 | 由 Evaluation / Profile Runtime 基于多次 evidence 判断的稳定性、独立性和迁移性 |

能力诊断的核心任务是从作答结果进入思维过程，再从思维过程生成本次 DiagnosisResult 和 Ability Evidence。

长期能力状态不由单次 Diagnosis 直接决定。

### Diagnosis 职责边界

Diagnosis 不创造长期能力事实。

Diagnosis 可以：

- 判断当前作答是否有效；
- 描述当前可观察表现；
- 识别表面错误；
- 提出有证据支持的根因假设；
- 生成单次 Ability Evidence 或 Evidence Proposal；
- 建议下一步验证或训练方向。

Diagnosis 不得：

- 仅凭单次作答宣布能力薄弱；
- 仅凭单次好答案宣布能力提升；
- 直接修改长期能力等级；
- 直接确定成长趋势；
- 在证据不足时强行选择根因。

Diagnosis 形成的 `TaskRequirementCoverage` 和可观察表现，可以由只读的 `StudentThinkingAnalysis` 进一步整理为“已完成的思考动作”和“答案连接中断位置”。原始 `StudentResponse` 可以作为下游反馈的只读表达锚点，用于准确复述学生实际写出的判断；它不得被下游重新解释为新的 Diagnosis。该投影不得反向改写 Diagnosis，也不得把答案中的断点升级为已确认的学生内在 Root Cause。

## 二、诊断原则（Diagnosis Principles）

### 1. 不根据一道题下结论

单次作答只能作为诊断线索，不能直接形成能力结论。

能力判断必须基于持续证据，包括多次作答、修正记录、独立完成情况、迁移任务和复测结果。

### 2. 不根据正确率判断能力

正确率是能力表现之一，但不是能力本身。

学生做对一道题，可能来自稳定能力，也可能来自题目熟悉、猜测或提示支持。学生做错一道题，也可能只是局部失误，而不是能力缺失。

### 3. 先判断作答有效性

诊断前必须先判断学生输入是否能够形成诊断证据。

无有效作答不等于能力薄弱。

无有效作答只表示当前证据不足。

### 4. 优先寻找有证据支持的候选原因

诊断不能停留在“答错了”“不完整”“不会做”等表层描述。

系统应进一步判断错误发生在哪个思维步骤，以及当前证据支持哪些可能的能力缺口。

单次诊断中的原因通常应被表达为 rootCauseHypothesis，而不是 confirmedRootCause。

### 5. 优先寻找前置能力

能力之间存在依赖关系。

当学生在高阶能力任务中失败时，AI 应优先检查前置能力是否缺失。

例如，推理错误可能源于信息提取不足、理解偏差、概括不完整或分析不到位，而不一定是推理能力本身不足。

### 6. 所有诊断必须有证据

没有证据，不能输出能力判断。

诊断证据必须能够回到学生的具体作答、修正记录、文本依据使用、迁移任务或复测表现。

### 7. 所有诊断必须可以解释

诊断结论必须能够说明：

- 观察到了什么表现
- 该表现说明了什么问题
- 为什么归因到该能力
- 是否需要继续验证

不可解释的诊断不能进入能力画像。

### 8. 所有诊断必须指导下一步验证或训练

诊断不是终点。

有效诊断必须能够指向下一步动作，包括需要继续验证的能力、需要强化的能力、需要复测的能力或需要降低认知负担的任务。

本文档只定义诊断如何产生验证或训练方向，不定义具体训练方案。

## 三、能力诊断流程（Diagnosis Workflow）

能力诊断应遵循统一流程。

```text
学生输入
↓
Answer Validity Check
↓
无效：insufficient_evidence，结束本次诊断
↓
有效：AI 分析答案
↓
识别能力路径
↓
定位失败步骤
↓
识别表面错误与候选错因
↓
寻找前置能力
↓
形成 Ability Evidence / Evidence Proposal
↓
提交给 Profile / Evaluation Runtime
↓
生成验证或训练建议
```

### 1. 学生作答

学生完成题目、阅读任务或表达任务，系统记录原始作答。

原始作答是诊断的基础证据，应保留学生真实表达。

### 2. Answer Validity Check

系统必须先判断当前输入是否能够形成诊断证据。

无效输入包括：

- 空答案；
- 纯数字或纯符号；
- 明显敷衍，如“哈哈”；
- “不知道”“不会”“不懂”等未完成作答；
- 与任务完全无关；
- 没有可分析语义；
- 未完成题目要求的最低作答动作。

底层规则：

```text
无有效作答
≠ 能力薄弱

无有效作答
= 当前证据不足
```

当作答无效时，Diagnosis 应输出 `insufficient_evidence`，并结束本次根因诊断。

禁止输出：

- 审题错误；
- 推理链缺失；
- 文本依据不足；
- 能力仍然薄弱；
- 能力没有提升。

无效作答边界应与 `EVALUATION_CASE_SET.md` 保持一致。

### 3. AI 分析答案

AI 判断答案是否满足任务要求，并识别答案中的有效信息、缺失信息、偏差信息和表达问题。

该步骤不是为了给出标准答案，而是为了发现可诊断的思维表现。

### 4. 识别能力路径

AI 判断本任务涉及哪些能力路径。

例如，一道阅读题可能涉及：

```text
审题 -> 信息提取 -> 理解 -> 概括 -> 表达
```

不同任务可能对应不同能力路径，但必须回到 ABILITY_MODEL 中定义的能力体系。

### 5. 定位失败步骤

AI 判断学生在哪个步骤出现偏差。

例如：

- 没有理解题干要求
- 没有找到关键文本依据
- 找到依据但理解错误
- 能理解内容但无法概括
- 能得出结论但表达不完整

### 6. 识别表面错误与候选错因

AI 根据错误模型识别本次作答中的可观察错误表现。

错误类型描述的是本次表现，不等于长期能力薄弱。

当证据不足以区分多个可能原因时，应保留候选原因，而不是强行选择唯一 rootCause。

### 7. 寻找前置能力

AI 不能只依据表面错误直接归因。

当高阶能力表现失败时，必须回溯检查前置能力是否存在问题。

### 8. 形成 Ability Evidence / Evidence Proposal

AI 将本次作答、错误表现、修正情况或复测表现转化为 Ability Evidence 或 Evidence Proposal。

能力证据可以是 positive、weakness、growth 或 insufficient。

### 9. 提交给 Profile / Evaluation Runtime

Diagnosis 不直接更新学生长期能力画像。

系统应将新 Evidence 提交给 Profile Aggregator / Evaluation Runtime，由长期聚合模块判断能力状态、成长趋势和下一阶段画像变化。

Diagnosis 可以输出轻量影响建议，例如：

```ts
profileImpactSuggestion: {
  abilityId: string;
  direction: 'positive' | 'negative' | 'neutral';
  requiresMoreEvidence: boolean;
}
```

该建议不是画像更新结论。

### 10. 生成验证或训练建议

诊断结果应指向下一步验证或训练方向。

建议应基于当前可观察表现和根因假设，而不是基于题目表面类型。

真正诊断的是思维过程，不是答案。

## 四、诊断对象（Diagnosis Target）

AI 观察的是学生行为，不是最终答案。

诊断对象包括以下维度：

| 诊断对象 | 观察问题 | 关联能力 |
| --- | --- | --- |
| 是否理解题意 | 是否明确题目要求、对象、范围和作答方式 | 理解、表达 |
| 是否找到文本依据 | 是否定位到相关段落、句子和关键词 | 信息提取 |
| 是否理解文本 | 是否准确理解词句、段落、人物、事件和观点 | 理解 |
| 是否遗漏限定条件 | 是否忽略题干中的范围、数量、角度或对象 | 信息提取、理解 |
| 是否完成概括 | 是否能提炼核心内容并删除无关细节 | 概括 |
| 是否完成分析 | 是否能拆解结构、人物、手法、情感或观点 | 分析 |
| 是否完成推理 | 是否能基于文本依据得出合理隐含判断 | 推理 |
| 是否组织表达 | 是否表达完整、准确、有逻辑、有依据 | 表达 |
| 是否能够修正 | 是否能根据反馈修正错误并补足缺口 | 多能力综合 |
| 是否能够迁移 | 是否能在新文本、新题型或新任务中稳定完成 | 多能力综合 |

诊断对象必须能够被观察、记录和解释。

AI 不应只观察答案是否接近标准答案，而应观察学生完成任务时表现出的能力路径和思维偏差。

## 五、错误模型（Error Model）

错误模型用于统一系统对错误的命名、归因和解释。

错误不是简单的“对”或“错”。

错误类型描述的是本次可观察表现，不等于长期 Ability Weakness。

诊断必须区分：

| 层级 | 说明 |
| --- | --- |
| Answer Status | 本次答案满足任务要求的程度 |
| Observed Error | 本次答案中可直接观察到的错误或缺失 |
| Observed Signal | 本次答案中出现的诊断信号，如缺少文本依据 |
| Cause Hypothesis | 基于当前证据提出的候选原因 |
| Ability Evidence | 该表现是否支持某项能力的 positive / weakness / growth / insufficient 证据 |

禁止直接形成以下跳跃：

```text
Observed Error
-> Ability Weakness
```

例如：

```text
本次表达不完整
≠ 学生表达能力薄弱
```

中间必须经过证据判断、置信度判断和后续验证。

特别说明：

`missing_text_evidence` 不应固定归入某一种能力错误。

它可能代表：

- 没有找到依据 -> 信息提取问题；
- 找到但理解错误 -> 理解问题；
- 有依据但没有建立解释关系 -> 分析 / 推理问题；
- 已经想到但没有写完整 -> 表达问题。

因此这类现象更适合先作为 `observedSignal` 记录，再通过追问、过程任务或复测确认原因。

### 1. 审题错误

**定义：**  
学生未能准确理解题干要求、作答对象、作答范围、作答角度或数量要求。

**典型表现：**

- 答非所问
- 忽略“结合全文”“分别说明”“两个方面”等要求
- 混淆问题对象
- 没有按照题目要求的角度回答

**容易误判原因：**  
容易被误判为知识不会、表达不清或态度不认真，但实际原因可能是题意理解和限定条件识别不足。

**对应能力：**  
理解、信息提取、表达。

### 2. 定位错误

**定义：**  
学生没有找到与问题相关的正确文本区域、关键句或关键词。

**典型表现：**

- 引用无关段落
- 答案依据与问题不匹配
- 遗漏关键句
- 只凭印象作答

**容易误判原因：**  
容易被误判为理解错误或推理错误，但实际原因可能是信息提取能力不足。

**对应能力：**  
信息提取。

### 3. 理解错误

**定义：**  
学生对词句、段落、人物行为、事件关系、情感态度或作者观点的理解发生偏差。

**典型表现：**

- 误解关键词含义
- 脱离语境解释句子
- 误判人物情感
- 误解事件因果关系
- 将文本观点替换为主观判断

**容易误判原因：**  
容易被误判为推理错误或分析错误，但实际原因可能是基础理解偏差。

**对应能力：**  
理解。

### 4. 概括错误

**定义：**  
学生无法从文本中提炼核心内容，或无法删除无关细节、合并同类信息。

**典型表现：**

- 大量照抄原文
- 只写细节，不写核心
- 遗漏主要对象、事件或结果
- 段意或主旨概括过宽、过窄或偏离

**容易误判原因：**  
容易被误判为表达问题，但实际原因可能是信息筛选和核心提炼能力不足。

**对应能力：**  
概括、信息提取、理解。

### 5. 分析错误

**定义：**  
学生无法拆解文本结构、人物特点、表达手法、情感变化或观点逻辑，并说明其作用或意义。

**典型表现：**

- 只复述内容，不分析作用
- 只说结论，不说明依据
- 手法判断与文本不匹配
- 人物分析空泛
- 情感变化分析不完整

**容易误判原因：**  
容易被误判为表达不完整，但实际原因可能是分析对象不清、分析角度偏离或依据不足。

**对应能力：**  
分析、理解、信息提取。

### 6. 推理错误

**定义：**  
学生无法基于文本依据形成合理隐含判断，或推理链条不成立。

**典型表现：**

- 结论缺少文本依据
- 因果关系错误
- 人物动机推断偏差
- 隐含信息判断过度
- 用主观经验替代文本线索

**容易误判原因：**  
容易被直接判断为推理能力不足，但实际原因可能来自信息提取、理解、概括或分析环节缺失。

**对应能力：**  
推理、分析、理解、信息提取。

### 7. 表达错误

**定义：**  
学生已经具备部分思考结果，但无法用完整、准确、有逻辑、有依据的语言表达出来。

**典型表现：**

- 答案要点不完整
- 语言含混
- 逻辑顺序混乱
- 缺少文本依据
- 结论与依据没有连接
- 表达不符合题目要求

**容易误判原因：**  
容易被误判为理解或分析不足，但实际原因可能是答案组织能力不足。

**对应能力：**  
表达。

### 8. 迁移失败

**定义：**  
学生在熟悉题目或有提示任务中能够完成，但在新文本、新题型或新任务中无法稳定使用同一能力。

**典型表现：**

- 原题订正后能答对，变式题仍错误
- 有模板时能完成，脱离模板后失败
- 熟悉文本能回答，新文本无法回答
- 提示减少后表现明显下降

**容易误判原因：**  
容易被误判为训练量不足，但实际原因可能是能力尚未真正内化，仍停留在模仿或依赖提示阶段。

**对应能力：**  
多能力综合，重点关联能力迁移和能力稳定性。

## 六、根因假设与验证（Root Cause Hypothesis）

诊断必须区分 Surface Error（表面错误）与 Root Cause Hypothesis（根因假设）。

表面错误是最终答案中呈现的问题。

根因假设是当前证据支持的候选原因。

单次 Diagnosis 大多数情况下只能形成有证据支持的 hypothesis，而不是 confirmed root cause。

例如：

```text
学生表现：推理题错误
↓
表面原因：不会推理
↓
继续追溯：没有找到关键句
↓
根因假设：信息提取能力可能不足，需通过文本定位任务进一步验证
```

再例如：

```text
学生表现：人物分析不完整
↓
表面原因：分析能力不足
↓
继续追溯：只找到人物行为，未理解行为背后的情感
↓
根因假设：理解可能不稳定，分析依据不足；仍需通过追问确认
```

AI 应寻找有证据支持的 Root Cause Hypothesis，而不是停留在 Surface Error。

根因判断应遵循以下规则：

| 规则 | 说明 |
| --- | --- |
| 前置追溯 | 高阶能力失败时，先检查前置能力是否缺失 |
| 证据优先 | 只有有证据支撑的原因才能成为诊断假设 |
| 主因优先 | 多个问题同时出现时，优先定位对本次答案影响最大的候选原因 |
| 可验证 | 根因假设应能够通过后续任务、修正或复测继续验证 |
| 可转化 | 根因假设应能够转化为下一步验证或训练方向 |
| 可保留不确定 | 证据不足时允许输出 unresolved，而不是强行选择原因 |

根因诊断不追求一次性判断全部问题，而是优先识别当前最影响本次作答的可验证候选原因。

### Root Cause 分层

建议将根因表达分为三层：

| 层级 | 说明 |
| --- | --- |
| Observed Problem | 可直接观察到的问题 |
| Root Cause Hypothesis | 根据当前证据推测的候选原因 |
| Confirmed Root Cause | 经过追问、修正、复测或不同任务验证后的较可信原因 |

示例结构：

```ts
rootCause: {
  status: 'unresolved' | 'hypothesis' | 'supported' | 'confirmed';
  abilityId?: string;
  explanation: string;
  evidenceLinks: string[];
  alternativeCauses?: string[];
  requiresVerification: boolean;
}
```

当现有证据只能识别表面问题，但无法可靠区分多个可能原因时，Diagnosis 应输出：

```ts
rootCauseStatus: 'unresolved';
candidateAbilities: string[];
nextVerificationTask: string;
```

例如：

```text
observedSignals: ['missing_text_evidence']
causeCandidates: ['information_extraction', 'reasoning', 'expression']
nextVerificationTask: '要求学生指出文本依据'
```

成熟的诊断系统必须能够说“当前证据不足，无法可靠定位根因”。

## 七、能力证据生成（Ability Evidence）

诊断完成后，系统必须将观察结果转化为能力证据。

能力证据是长期能力判断、能力画像和后续训练建议的共同输入。

能力证据来源包括：

- 多次作答
- 修正记录
- 独立完成情况
- 迁移任务表现
- 复测结果
- 长期稳定性
- 文本依据使用情况
- 限定条件识别情况
- 提示依赖程度

能力证据可以分为三类：

| 类型 | 说明 |
| --- | --- |
| 正向证据 | 支撑某项能力在本次或近期任务中出现正向表现 |
| 薄弱证据 | 支撑某项能力存在不足或不稳定的表现 |
| 待验证证据 | 单次或少量表现形成的线索，需要后续复测确认 |

说明：

本节使用的是长期诊断模型中的中文概念分类。当前工程最小实现中的 Ability Evidence 枚举以 `ABILITY_EVIDENCE_CONTRACT.md` 为准：

```text
positive / weakness / growth / insufficient
```

其中“待验证证据”不应简单等同于 `insufficient`。

`insufficient` 更适合表示：

> 当前输入不足以形成有效的正向、薄弱或成长证据。

而“已有一定线索，但需要继续验证”可能对应：

- `weakness` + low confidence；
- `positive` + low confidence；
- `growth` + low confidence。

例如：

| 情况 | 更合适的证据表达 |
| --- | --- |
| 纯数字 `445` | insufficient |
| 有相关答案但缺少文本依据 | weakness + low confidence |
| 比训练前更完整但仍不充分 | growth + low confidence |
| 一次正确作答 | positive + low confidence |

能力证据应包含以下信息：

| 字段 | 说明 |
| --- | --- |
| 关联能力 | 该证据对应 ABILITY_MODEL 中的哪项能力 |
| 观察表现 | 学生在作答、修正或复测中表现出了什么 |
| 证据类型 | 正向证据、薄弱证据或待验证证据 |
| 证据来源 | 来自作答、修正、迁移任务、复测或长期记录 |
| 诊断解释 | 为什么该表现可以支撑该能力判断 |
| 独立程度 | 学生是否独立完成、轻提示完成或引导完成 |
| 题目角色 | 本次证据来自 diagnostic、training、retest、transfer 等哪类任务 |
| 置信度 | 本条证据的可靠程度 |
| metadata 版本 | 本条证据所依据的 question metadata / rubric 版本 |
| 根因状态 | unresolved、hypothesis、supported 或 confirmed |

具体字段结构以 `ABILITY_EVIDENCE_CONTRACT.md` 为准。Diagnosis Model 只定义 Evidence Proposal 应包含这些质量条件。

能力结论必须可解释。任何不能回到具体表现的能力判断，都不能进入长期能力画像。

## 八、Profile Update Proposal

诊断完成后，系统不应直接更新学生长期能力画像。

Diagnosis 应将新增 Evidence 或 Evidence Proposal 提交给 Profile Aggregator / Evaluation Runtime。

必要时，Diagnosis 可以输出 Profile Update Proposal。

它表示“本次 evidence 可能如何影响画像”，不是最终画像结论。

建议内容包括：

| 更新项 | 说明 |
| --- | --- |
| abilityId | 本次 evidence 可能影响的能力 |
| direction | positive、negative 或 neutral |
| requiresMoreEvidence | 是否需要更多证据 |
| verificationNeed | 是否需要复测、迁移题或追问 |
| candidateTrainingDirection | 候选训练方向 |

Profile Update Proposal 应遵循以下原则：

- 不能直接决定能力等级；
- 不能直接决定长期能力状态；
- 不能直接判断成长趋势；
- 单次 evidence 只能作为画像聚合输入；
- 迁移任务表现优先级高于原题订正表现；
- 独立完成表现优先级高于提示后完成表现；
- 长期稳定表现优先级高于短期波动表现。

能力画像记录的是能力成长，而不是考试成绩。画像更新应由 Student Ability Profile / Evaluation Runtime 负责。

## 九、诊断输出规范（Diagnosis Output）

诊断输出用于统一 AI 对诊断结果的结构化表达。

本节只定义输出结构，不定义 Prompt。

标准诊断输出应分为四层：

### A. Answer Assessment

描述本次答案是否有效，以及对任务要求的满足程度。

| 字段 | 说明 |
| --- | --- |
| answerValidity | valid、invalid 或 insufficient |
| answerStatus | meets、partially_meets、does_not_meet、cannot_assess |
| rubricMatches | 本次答案命中的 rubric 项 |
| observedSignals | 本次答案中可观察的诊断信号 |

### B. Diagnosis

描述本次可观察问题、错误类型和根因假设。

| 字段 | 说明 |
| --- | --- |
| mainAbility | 本次任务主要观察能力 |
| abilityPath | 本次任务涉及的能力路径 |
| surfaceError | 学生答案中直接呈现的问题 |
| observedErrorTypes | 根据错误模型识别出的本次错误类型 |
| rootCauseStatus | unresolved、hypothesis、supported 或 confirmed |
| rootCauseHypothesis | 当前证据支持的候选原因 |
| alternativeCauses | 仍可能存在的其他原因 |
| requiresVerification | 是否需要继续验证 |

### C. Evidence Proposal

描述本次诊断可沉淀为哪类能力证据。

| 字段 | 说明 |
| --- | --- |
| abilityId | 证据关联能力 |
| evidenceType | positive、weakness、growth 或 insufficient |
| confidence | low、medium 或 high |
| evidenceLinks | 可追溯到学生作答、rubric、题目 metadata 或过程记录的链接 |
| sourceType | diagnosis、guided_training、independent_training、retest、transfer 等 |

### D. Runtime Recommendation

描述下一步运行建议，但不直接生成训练计划。

| 字段 | 说明 |
| --- | --- |
| nextAction | retry_answer、verify_with_question、train、retest、observe 等 |
| verificationNeed | 需要通过什么任务验证 |
| candidateTrainingDirection | 候选训练方向 |
| profileImpactSuggestion | 对画像聚合的轻量影响建议 |

示例结构：

```text
answerAssessment:
  answerValidity: valid
  answerStatus: partially_meets
  observedSignals: [too_many_details, missing_core_summary]

diagnosis:
  mainAbility: 概括
  abilityPath: 信息提取 -> 理解 -> 概括 -> 表达
  surfaceError: 答案包含大量细节，但没有提炼核心意思
  observedErrorTypes: [summary_incomplete]
  rootCauseStatus: hypothesis
  rootCauseHypothesis: 信息筛选能力可能不足，无法区分主要信息与次要信息
  alternativeCauses: [表达组织不完整]
  requiresVerification: true

evidenceProposal:
  abilityId: summarization
  evidenceType: weakness
  confidence: low
  evidenceLinks: [student_answer, rubric_core_summary]

runtimeRecommendation:
  nextAction: verify_with_question
  verificationNeed: 要求学生划出主要信息和次要信息
  candidateTrainingDirection: information_filtering_training
```

诊断输出必须满足以下要求：

- 面向能力，而不是面向题目
- 说明错误原因，而不是只说明答案问题
- 能够追溯到能力证据
- 能够提交给 Profile / Evaluation Runtime
- 能够指向下一步验证或训练方向
- 不直接宣布长期能力状态或能力提升

## 十、本模型与其他模型关系

Diagnosis 位于整个系统的核心枢纽位置。

系统关系可以表示为：

```text
Ability Model
      ↓
Question Metadata
      ↓
Student Answer
      ↓
Answer Validity
      ↓
Diagnosis Result
      ├──────────────────────────┐
      ↓                          ↓
Learning Gap Assessment    Ability Evidence
      ↓                          ↓
Verification / Training    Profile / Evaluation
Candidate                       │
      └──────────────┬───────────┘
                     ↓
       Training / Retest / Transfer
                     ↓
           New Ability Evidence
```

ABILITY_MODEL 定义系统如何理解能力。

DIAGNOSIS_MODEL 定义系统如何判断本次作答有效性、识别可观察表现、提出根因假设并生成 Ability Evidence。

LEARNING_GAP_MODEL 定义如何将有效表现与正式任务要求之间的差距表达为可观察、可验证、可干预的能力动作缺口。Learning Gap 描述“缺少什么”，不重新判断“为什么”，也不替代 Diagnosis 中的 Root Cause Hypothesis。

当前工程仍可通过 `TaskRequirementCoverage`、`primaryGapRequirementId`、`primaryGap` 和 `gapReasonCode` 表达兼容缺口；独立 `LearningGapAssessment` 属于长期模型目标，尚不代表已经建立新的持久化 Runtime。

TRAINING_MODEL 应基于诊断结果、Ability Evidence 和 Profile 状态生成针对性训练方向。

EVALUATION_MODEL 应基于多次能力证据判断训练是否有效、是否出现改善信号，以及是否满足更长期的能力变化条件。

QUESTION_MODEL 应确保每一道题能够映射到明确能力路径，并支持诊断所需的证据生成。

AI Coach 和 Prompt Guide 应使用本模型中的诊断语言，避免只讲答案或只解释题目。

Student Profile 应以本模型生成的 Ability Evidence 为输入，由画像聚合逻辑判断长期能力状态。

本模型不涉及：

- 页面设计
- Prompt 编写
- 算法实现
- 数据库设计
- 具体训练方案
- 具体题目内容

Diagnosis 是整个系统的核心枢纽，但不是最终裁判。

诊断对象永远是能力表现，而不是题目本身。

所有诊断语言、能力分析、Evidence Proposal 和验证建议都必须以本模型为基础。长期能力画像和能力提升判断必须交由 Evidence、Evaluation 和 Student Profile 链路完成。
