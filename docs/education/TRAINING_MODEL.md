# 能力训练模型（Training Model）

## 文档定位

本文档是 AI 语文能力诊断与成长系统的能力训练模型（Training Model）。

本模型负责定义：

- AI 如何根据能力诊断结果制定训练策略
- AI 如何组织训练过程
- AI 如何调整训练难度
- AI 如何收集训练过程中的表现证据
- AI 如何判断学生是否具备进入复测或迁移验证的条件
- AI 如何帮助学生建立能力、强化能力和迁移能力

Training 的目标不是完成更多题目。

Training 的目标是帮助学生完成能力成长。

但 Training 不负责直接证明长期能力已经成长。

Training Runtime 负责组织干预、记录训练表现、生成训练阶段的 Ability Evidence，并提出下一步验证需求。

能力是否真正改善、是否稳定、是否可以更新长期能力状态，必须由 EVALUATION_MODEL 基于多条 Evidence 判断。

本文档不是题库设计，不是 Prompt，不是页面设计，不是算法实现，也不是教学教案。

本文档是一份可被 AI 调用、可被程序实现、可长期扩展的能力训练模型。

未来以下模块必须引用本模型：

- Ability
- Diagnosis
- Evaluation
- Question
- AI Coach
- Student Ability Profile
- Prompt Guide

本文档的核心目标是建立整个系统统一的 Training Language（训练语言）。未来所有训练计划、AI 陪练和训练过程记录，都必须引用本模型。

本文档用于回答以下问题：

1. 什么是真正的能力训练？
2. 为什么训练不是刷题？
3. AI 如何帮助学生建立能力？
4. AI 如何制定训练计划？
5. AI 如何动态调整训练？
6. AI 如何判断本轮训练是否应继续、暂停、复测或迁移？

训练对象永远是能力，不是题目。题目只是训练载体。

## 一、训练模型定义（Training Definition）

训练不是重复做题。

训练是针对能力短板或有证据支持的根因假设，持续帮助学生建立正确思维方式的过程。

训练的目标不是单纯提高正确率，而是帮助学生形成独立、稳定、可迁移、可持续的能力。

稳定能力不是 Training 单独宣布的结论，而是 Evaluation 在后续复测、迁移和多次 Evidence 中确认的长期状态。

在本系统中，训练必须满足以下条件：

| 条件 | 说明 |
| --- | --- |
| 有明确能力目标 | 每次训练必须对应 ABILITY_MODEL 中定义的能力 |
| 来自诊断结果 | 训练目标应来自 DIAGNOSIS_MODEL 中有证据支持的能力短板或根因假设 |
| 有过程反馈 | 训练过程中必须观察学生的思考、修正和表达 |
| 有难度调整 | 训练难度应根据能力状态动态变化 |
| 有复测需求 | 训练结束后应提出独立复测、迁移验证或继续训练需求 |
| 有能力证据 | 训练结果必须形成新的能力证据 |

训练不是为了完成更多题目，而是为了让学生在特定能力上从不稳定走向稳定，从依赖提示走向独立完成，从熟悉情境走向迁移应用。

## 二、训练原则（Training Principles）

### 1. 能力优先

训练对象永远是能力，不是题目、篇目或知识点。

每一次训练都必须明确对应哪项能力短板，以及训练后期望形成什么能力证据。

### 2. 小步训练

能力成长应被拆分为小步目标。

系统不应一次性要求学生完成复杂综合任务，而应根据诊断结果定位一个主要短板，并围绕该短板进行聚焦训练。

### 3. 循序渐进

训练应从低复杂度任务逐步进入高复杂度任务。

学生尚未稳定掌握前置能力时，不应直接进入高阶综合训练。

### 4. 即时反馈

训练过程中应及时反馈学生的思考偏差、依据使用、表达缺口和修正方向。

反馈不是给答案，而是帮助学生看见自己的思维过程。

### 5. 允许犯错

错误是能力训练的重要输入。

训练过程中出现错误并不代表失败，而是进一步识别能力短板、调整训练策略和生成能力证据的机会。

### 6. 持续验证

训练结果必须通过后续任务验证。

完成一次训练任务不等于能力提升。只有当学生能在新任务中表现出更稳定、更独立或更可迁移的表现时，训练才产生更高价值的成长证据。

### 7. 迁移优先

训练不应只帮助学生掌握当前题目，而应帮助学生迁移到新的文本、题型和表达任务。

迁移表现是判断能力是否真正成长的重要证据。

### 8. 训练必须可解释

训练计划必须能够解释：

- 为什么训练这项能力
- 训练目标来自哪条诊断结论
- 当前训练处于什么阶段
- 如何判断是否应继续训练、降低支持、进入复测或进入迁移验证

### 9. 训练必须可调整

训练不是固定流程。

系统应根据学生的表现动态调整训练目标、提示强度、任务难度和复测节奏。

### 10. 训练必须有终点

训练不能无限循环。

训练终点不是做完指定数量的题，而是本轮训练达到明确状态：

- 当前小目标已完成
- 学生已能在较低提示下完成同类任务
- 已具备进入独立复测或迁移验证的条件
- 需要暂停并重新诊断
- 需要回到前置能力训练

Training completed 不等于 Ability growth confirmed。

能力成长确认必须交由 Evaluation 处理。

## 三、训练闭环（Training Workflow）

训练是循环，不是一次完成。

完整训练闭环为：

```text
能力诊断
↓
确认训练入口
↓
确定训练目标
↓
制定训练计划
↓
完成训练任务
↓
AI 反馈
↓
学生修正
↓
再次训练
↓
安排独立复测或迁移任务
↓
形成新的 Ability Evidence
↓
交由 Evaluation 判断
```

### 1. 能力诊断

训练必须从诊断开始。

系统应根据 DIAGNOSIS_MODEL 判断学生当前有证据支持的能力短板或根因假设，而不是根据题目类型直接安排训练。

更准确地说，Training 消费的是 Diagnosis Result、Ability Evidence 和 Root Cause Hypothesis。

单次 Diagnosis 不一定能确认真实短板，因此训练入口必须区分证据强度。

| Root Cause 状态 | Training 处理 |
| --- | --- |
| supported / confirmed | 可以进入针对性训练 |
| hypothesis | 可以进入低风险验证性训练或诊断性微任务 |
| unresolved | 不进入正式能力训练，优先补充诊断证据 |

如果根因尚未确认，Training 不应强行安排高针对性的训练任务。

### 1.1 互补证据驱动的训练分流

当 Diagnosis 同时获得单项选择与文本作答的可比较证据时，Training 必须根据能力缺口分流，不得按“做错哪种题就继续刷哪种题”调度：

| 互补观察结果 | 后续训练方向 |
| --- | --- |
| 单选弱、文本弱 | 优先安排低负荷的定位、限定条件、对象关系或局部理解训练，再进入文本组织 |
| 单选强、文本弱 | 不重复堆叠基础选择题；根据缺口安排概括、证据连接、分析、推理或表达训练 |
| 单选弱、文本强 | 暂不形成针对性能力训练；先安排低风险验证任务或检查题目与交互质量 |
| 单选强、文本强 | 提高材料、证据或任务复杂度，并进入独立 Retest / Transfer，而不是继续同难度重复 |

调度还必须遵守：

1. Training 消费的是 Diagnosis Result、独立 Ability Evidence 和 Root Cause Hypothesis，不消费不可追溯的跨题型总分；
2. 同一互补观察组内每个任务仍保持独立完成与反馈，不能在一道题内增加“选择后解释”的隐藏复合步骤；
3. 证据冲突时优先补充诊断，不把冲突静默归因于学生；
4. 一次单选正确只能降低部分前置能力假设的优先级，不能直接证明基础能力稳定；
5. 是否继续单选或切换文本形式由目标能力动作和所需证据决定，不以题型多样性、固定比例或页面顺序决定。

### 2. 确定训练目标

训练目标应明确、单一、可验证。

例如，训练目标不是“提高阅读理解”，而是“提升信息定位中的限定条件识别稳定性”或“提升概括中的核心信息筛选能力”。

### 3. 制定训练计划

训练计划应根据能力等级、能力状态、错因类型和证据强度制定。

训练计划应说明训练阶段、任务类型、提示强度、难度起点和复测方式。

### 4. 完成训练任务

学生在训练任务中完成作答、标注、概括、分析、推理或表达等能力活动。

训练任务是能力活动的载体，而不是训练的最终目标。

### 5. AI 反馈

AI 反馈应围绕能力表现展开。

反馈应指出学生在哪个能力步骤表现稳定，在哪个能力步骤仍存在偏差，并提示学生如何修正思考过程。

### 6. 学生修正

学生基于反馈进行修正。

修正过程本身是重要能力证据，可用于判断学生是否理解错误原因、是否能补足缺失步骤。

### 7. 再次训练

系统根据学生修正表现决定是否继续同能力训练、降低难度、提高难度或切换到前置能力训练。

### 8. 复测

系统通过新文本、新题型或新任务验证学生是否能够迁移应用。

复测应尽量避免只验证学生是否记住原题答案。

### 9. 能力升级

Training 不直接执行能力升级。

当训练产生新的 Training Evidence，并且学生具备进入独立复测或迁移验证的条件时，Training 应输出：

- ready_for_independent_retest
- ready_for_transfer_test
- continue_training
- return_to_prerequisite
- pause_for_review

能力状态或能力等级是否更新，由 Evaluation 和 Student Ability Profile 根据多条 Evidence 决定。

### 10. Training Plan 与 Training Execution

Training Model 必须区分训练计划和训练执行。

Training Plan 回答：

- 为什么训练
- 训练什么能力
- 训练哪个具体缺口
- 从什么难度开始
- 允许什么提示策略
- 如何判断是否可以进入复测或迁移

Training Execution 回答：

- 学生实际完成了哪些任务
- 使用了多少提示
- 是否经过示例、模板或 AI 定位支持
- 学生如何修正
- 训练中形成了哪些 Ability Evidence
- 下一步应继续训练、降低支持、提高难度、复测、迁移或暂停

最小结构示意：

```ts
type TrainingPlan = {
  planId: string;
  studentId: string;
  targetAbilityId: string;
  diagnosisEvidenceIds: string[];
  targetGap: string;
  stage: string;
  strategy: string;
  startingDifficulty: string;
  hintPolicy: string;
  completionCriteria: string[];
  verificationNeed: string;
};

type TrainingExecution = {
  executionId: string;
  planId: string;
  taskId: string;
  attempts: string[];
  hintHistory: string[];
  revisionHistory: string[];
  outcome: string;
  generatedEvidenceIds: string[];
};
```

这样系统才能区分：

- 训练计划是否合理
- 学生是否获得了有效训练
- 是否只是提示后完成
- 是否已经具备独立验证条件

## 四、训练对象（Training Target）

AI 训练的是能力，不是知识点。

训练对象必须来自 ABILITY_MODEL 中定义的能力体系。

一级训练对象包括：

| 训练对象 | 说明 |
| --- | --- |
| 信息提取能力 | 训练学生定位文本依据、提取关键词、识别限定条件和整合相关信息 |
| 理解能力 | 训练学生准确理解词句、段落、人物、事件、情感和观点 |
| 概括能力 | 训练学生提炼核心内容、删除无关细节、合并同类信息和形成主旨表达 |
| 分析能力 | 训练学生拆解人物、结构、手法、情感和观点，并说明作用或意义 |
| 推理能力 | 训练学生基于文本依据形成合理隐含判断 |
| 表达能力 | 训练学生用完整、准确、有逻辑、有依据的语言呈现思考结果 |

同一训练任务可以涉及多个能力，但训练目标必须明确主能力。

当多个能力同时薄弱时，应优先训练最关键的前置能力。

## 五、训练策略（Training Strategy）

训练策略用于定义系统如何根据能力短板组织训练。

### 1. 针对性训练

针对诊断出的主要能力短板进行训练。

适用于：能力短板明确、错因稳定出现、已有证据支持的情况。

当完整课文数量有限或继续在同篇材料中出题会造成对象、证据和评分目标重复时，系统可以使用独立的针对性短片段增加训练密度。短片段不是更小的课文题组，而是围绕一个正式主要缺口、一个主能力和一个可观察动作形成的微训练资源。

微训练必须遵守：缺口触发、一次一项、默认优先不同证据情境、题量止损和独立 Evidence。同篇片段只有在 Source Anchor 不同、确需重新聚焦局部证据且不会泄露刚才答案时才可使用。没有正式缺口、信息不足或没有精确匹配资源时，应继续核心学习，不得为了增加题量安排近似任务。第一版只接受能够在一次短任务中重新执行的具体动作缺口，不接纳“主题理解弱、人物分析弱、表达弱”等宏观能力标签。详细材料类型、资源生产、Session 追加调度和恢复规则见[针对性短片段微训练材料与调度契约](../product/TARGETED_MICRO_TRAINING_MATERIAL_AND_SCHEDULING_CONTRACT.md)。

阶段 3 已把上述原则落实为默认关闭的条件调度：只有核心 `training` 题的正式结果完成持久化、身份对齐、唯一主要缺口属于首批四类且不存在反馈后修订入口时才生成幂等 Request；匹配只接受 Ability、Gap、Role、Frozen Head、Active Registry 与来源边界全部一致的正式短片段。Assignment 通过 Session Overlay 暂时覆盖呈现，不改写核心任务队列，完成、跳过或资源失效后均返回冻结的核心游标。工程通过不等于教学效果成立，真实效果仍由后续独立核心题、Retest 或 Transfer 验证。

### 2. 渐进训练

从低复杂度任务逐步进入高复杂度任务。

适用于：学生能力处于 Lv1-Lv2，仍需要引导、示范或固定结构支持的情况。

### 3. 重复强化

围绕同一能力点进行多次短任务训练，以增强稳定性。

适用于：学生能够完成部分任务，但表现不稳定，容易在类似任务中反复出错的情况。

重复强化不是重复相同题型、相同文本或相同答案模板。

有效重复应满足：

- 能力目标保持一致
- 材料、表达形式或任务情境逐步变化
- 提示强度逐渐减少
- 观察点保持可比较

否则学生可能只是掌握了模板，而不是掌握了能力动作。

### 4. 变式训练

在保持能力目标一致的前提下，更换文本、题型或表达方式。

适用于：学生在原任务中完成较好，但需要验证是否真正掌握的情况。

### 5. 迁移训练

将能力应用到新的文本、新题型或更复杂任务中。

适用于：学生已经达到基本独立完成，需要验证能否跨情境使用该能力的情况。

### 6. 综合训练

将多个能力组合在同一任务中进行训练。

适用于：学生多个单项能力已有一定稳定性，需要完成综合阅读、分析或表达任务的情况。

不同能力可以采用不同训练策略。

例如：

| 能力 | 常用策略 |
| --- | --- |
| 信息提取 | 针对性训练、重复强化、变式训练 |
| 理解 | 渐进训练、针对性训练、变式训练 |
| 概括 | 小步拆解、重复强化、迁移训练 |
| 分析 | 渐进训练、综合训练、变式训练 |
| 推理 | 前置检查、渐进训练、迁移训练 |
| 表达 | 结构化训练、重复强化、综合训练 |

## 六、训练阶段（Training Stage）

训练不是一次完成，而是持续成长。

能力训练可分为五个阶段。

Training Stage 是训练状态，不是必须依次完成的课程目录。

系统可以根据 Evidence 在阶段间前进、停留或回退。

例如：

```text
method_building
↓
guided_practice
↓
independent_practice
↓
near_transfer
↓
far_transfer
```

也允许：

```text
near_transfer 失败 → independent_practice
guided_practice 持续失败 → prerequisite_training
rootCause 出现冲突 → diagnostic_verification
```

### 第一阶段：理解为什么错

学生需要知道错误不只是答案错误，而是某个能力步骤出现偏差。

该阶段目标是建立错因意识。

该阶段更准确地说是 pre_training_alignment，位于 Diagnosis、AI Coach 和 Training 之间。

它用于确认：

- 学生理解当前训练目标
- 学生知道本次要修正哪个思维动作
- 诊断假设是否得到后续表现支持

Training 不应在该阶段重新完成 Diagnosis。

### 第二阶段：掌握正确方法

学生需要理解完成该能力任务的基本思考路径。

该阶段目标是形成可重复使用的方法框架。

### 第三阶段：独立完成

学生在少量提示或无提示情况下完成同类能力任务。

该阶段目标是从依赖 AI 引导转向独立完成。

### 第四阶段：迁移应用

学生能够在新文本、新题型或新任务中使用同一能力。

该阶段目标是观察学生是否能在新情境中使用同一能力动作。

### 第五阶段：稳定保持

学生能够在多次任务、复杂任务或间隔复测中保持稳定表现。

该阶段目标是产生可供 Evaluation 判断能力成熟度的高价值证据。

训练阶段与能力等级相关，但不完全等同。

训练阶段描述训练过程，能力等级描述能力成熟度。

## 七、训练调节（Training Adaptation）

训练计划不是固定流程。

AI 应根据学生表现动态调整训练难度、提示数量、任务复杂度、文本长度、训练节奏和能力目标。

训练调节的核心目标，是让学生始终处于可完成、可挑战、可验证的能力成长区间。

训练调节维度包括：

| 调节维度 | 说明 |
| --- | --- |
| 文本长度 | 从短文本逐步进入长文本 |
| 文本复杂度 | 从结构清晰、语言直白的文本进入结构复杂、含义丰富的文本 |
| 信息数量 | 从单一信息点进入多信息点整合 |
| 推理层数 | 从直接判断进入多步骤推理 |
| 表达要求 | 从短答进入完整、有依据、有逻辑的表达 |
| 提示数量 | 从充分提示逐步减少到独立完成 |
| 任务综合度 | 从单项能力任务进入多能力综合任务 |
| 迁移跨度 | 从相似任务进入新文本、新题型和新情境 |
| 能力目标 | 根据训练表现继续当前能力、回到前置能力或进入综合能力 |
| 训练节奏 | 根据稳定性调整重复强化、变式训练、迁移训练和复测节奏 |

训练难度不是单一的 easy / medium / hard。

两个任务文本长度相同，认知难度也可能完全不同。

训练难度至少应区分：

| 难度维度 | 说明 |
| --- | --- |
| 内容难度 | 文本语言、主题和背景理解难度 |
| 任务难度 | 需要完成多少能力步骤 |
| 信息负荷 | 需要处理多少信息点 |
| 推理跨度 | 从依据到结论之间有几层关系 |
| 表达负荷 | 答案结构与语言组织要求 |
| 迁移跨度 | 与原训练情境的差异程度 |
| 支持程度 | 提示、定位、模板和示例的多少 |

最小结构示意：

```ts
type TrainingDifficulty = {
  textComplexity: number;
  informationLoad: number;
  reasoningDepth: number;
  expressionDemand: number;
  transferDistance: number;
  supportLevel: number;
};
```

训练调节应遵循以下规则：

- 如果学生持续无法完成，应降低难度或回到前置能力
- 如果学生在提示下可以完成，应逐步减少提示
- 如果学生能够独立完成，应增加变式任务
- 如果学生能够完成变式任务，应进入迁移训练
- 如果学生迁移表现稳定，应进入复测、迁移验证或 Evaluation 判断

训练还需要明确停止和退出机制。

正常停止：

- 当前训练目标已达到
- 学生已能在低提示下完成
- 已具备独立复测条件
- 本轮认知负荷达到上限

暂停训练：

- 连续多次无有效作答
- 学生明显疲劳或挫败
- 根因判断出现冲突
- 当前任务难度明显失配
- 题目资源不足
- AI 无法给出稳定反馈

返回诊断：

- 训练目标持续不匹配
- 前置能力问题重新暴露
- 不同任务表现矛盾
- 学生在训练中表现与原诊断不一致

不应因为学生持续失败，就无限增加同类训练数量。

训练调节不是为了增加负担，而是为了让训练始终服务于能力建立、能力强化和能力迁移。

## 八、训练完成标准（Training Completion）

训练完成标准不是做完指定数量的题。

训练完成标准是本轮训练目标达到可验证状态。

训练可以结束或进入下一阶段，必须满足以下条件中的若干项：

| 标准 | 说明 |
| --- | --- |
| 能够独立完成 | 学生能够在少量提示或无提示情况下完成能力任务 |
| 能够迁移应用 | 学生能够在新文本、新题型或新任务中使用该能力 |
| 能够稳定完成 | 学生在多次任务中表现稳定 |
| 能够完成修正 | 学生能够根据反馈识别问题并修正思考过程 |
| 能够通过训练后检查 | 学生在当前训练条件下表现达到目标状态 |
| 形成训练证据 | 系统获得新的 Training Evidence |

训练完成与能力成长确认必须分开。

本轮训练完成表示：

- 完成当前小目标
- 能在当前任务条件下使用方法
- 提示依赖有所下降
- 已具备进入独立复测或迁移验证的条件

能力成长确认表示：

- Evaluation 聚合了多条 Evidence
- Evidence 包含独立复测或迁移任务
- Evidence 具备一定时间跨度或任务差异
- 结论达到对应成长层级

Training completed 不等于 Ability growth confirmed。

如果学生只是知道原题答案，但不能独立完成、不能迁移、不能稳定保持，则训练不能视为完成。

### Training Evidence 权重

训练中的 positive evidence 不能与独立复测 evidence 等权。

推荐证据价值关系为：

```text
guided_training evidence
<
independent_training evidence
<
retest evidence
<
transfer / delayed_retest evidence
```

前提是题目目标、难度与 Rubric 具备可比较性。

Training Evidence 必须记录支持程度：

```ts
type TrainingSupportLevel =
  | 'high_support'
  | 'guided'
  | 'light_hint'
  | 'independent';
```

训练过程中应记录：

- 提示层级
- 是否看过示例
- 是否使用结构模板
- 是否经过多次修正
- 是否由 AI 指定文本位置
- 是否独立完成

在强提示下完成训练，不等于独立掌握能力。

### 反馈后一次修订

Training 任务可以在首次有效回答形成正式 Diagnosis 与 Feedback 后提供一次反馈后修订，但必须遵循以下边界：

- 首次回答是独立表现主证据，提交后不可覆盖；
- 修订属于同一 `LearningTaskAttempt`，不增加完成题数；
- Revised Response 独立保存，并记录其使用的 Revision Goal 和反馈支持程度；
- Revision Evaluation 只判断是否响应反馈、解决原缺口、引入新问题和达到当前要求；
- 修订改善只形成 `feedback_supported` evidence，不得提升为 independent training evidence；
- Revision Evidence 接入 Profile 时只允许追加证据，不允许据此改变长期能力状态或置信度；Growth Memory 必须保留“反馈支持下完成”和“待独立验证”的限制；
- Retest、Transfer、Maintenance 和 Formal Assessment 不开放即时修订；
- 每题最多一次 Revision，未解决的问题进入后续训练，不通过无限重写处理。

完整产品与工程边界遵循[Learning 反馈后修订契约](../product/LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md)。

## 九、AI 教练策略（AI Coaching）

AI 在训练中的角色是教练和陪练，不是答案提供者。

AI 应通过以下方式陪伴训练：

### 1. 提问

AI 通过问题引导学生回到文本、任务要求和思考步骤。

提问的目标是促使学生自己完成关键能力活动。

### 2. 提示

AI 可以提供适度提示，帮助学生定位下一步思考方向。

提示应逐步减少，避免学生长期依赖。

### 3. 鼓励

AI 应帮助学生识别已经完成的有效步骤，增强学生对能力成长的感知。

鼓励应基于具体表现，而不是笼统评价。

### 4. 追问

AI 应在学生回答不完整、缺少依据或推理跳跃时继续追问。

追问的目标是补足思维链条，而不是制造压力。

### 5. 降低提示

当学生表现趋于稳定时，AI 应减少提示数量和提示强度。

降低提示是判断独立完成能力的重要方式。

### 6. 增加挑战

当学生能够稳定完成当前任务时，AI 应增加文本复杂度、信息数量、推理层数或表达要求。

增加挑战用于验证能力是否可以迁移和保持。

### 7. 动态调整训练计划

AI 应根据学生训练表现调整训练路径。

如果训练暴露出更基础的前置能力短板，应回到前置能力训练；如果学生已能稳定完成，则应进入迁移或复测。

AI 不是讲答案，而是帮助学生建立正确的思考过程。

AI_COACH_MODEL 负责定义具体的追问、提示、反馈、情绪支持和介入策略。

TRAINING_MODEL 只定义训练过程需要哪类 Coach 行为，以及这些行为不能破坏训练证据质量。

特别是：

- 训练阶段可以允许递进提示
- 引导训练必须记录提示依赖
- 独立训练应减少提示
- 复测与迁移阶段不应继续提供方法性提示
- Coach 行为不得把训练答案结构泄漏给复测任务

## 十、训练任务角色（Training Task Role）

Training Model 必须与 QUESTION_MODEL 中的 Question Role 对齐。

不同任务角色对应不同的提示策略和证据价值。

| 任务角色 | 是否允许提示 | 证据价值 |
| --- | --- | --- |
| method_demonstration | 允许高支持 | 不用于成长判断 |
| guided_practice | 允许提示 | 形成 guided_training evidence |
| independent_practice | 少量或无提示 | 形成 independent_training evidence |
| retest | 默认无方法提示 | 形成 retest evidence |
| transfer | 无提示、新情境 | 形成 transfer evidence |
| maintenance | 无提示、延迟 | 形成 maintenance evidence |

训练题、复测题、迁移题不能混为同一种证据。

`independent_practice` 的 Initial Response 可以形成 independent training evidence；如果学生读取本题反馈后提交 Revised Response，该 Revision 只能形成 feedback-supported evidence。两类证据必须同时保留，不得用修订结果回写首次独立证据。

同一道题在不同阶段使用时，必须标记当次使用角色。

## 十一、训练输出（Training Output）

一次训练不应该只输出“训练完成”。

Training Result 至少应包含：

- Training Plan
- Training Execution Record
- Hint History
- Revision History（包含不可变 Initial Response、可选一次 Revised Response、Revision Goal 与 Revision Evaluation）
- Training Evidence
- Retest Readiness
- Next Training Decision

最小结构示意：

```ts
type TrainingResult = {
  planId: string;
  targetAbilityId: string;
  stage: string;
  completedTasks: string[];
  hintDependency: string;
  revisions: string[];
  generatedEvidenceIds: string[];
  trainingOutcome:
    | 'goal_reached'
    | 'partial_progress'
    | 'still_struggling'
    | 'invalid_execution'
    | 'diagnosis_recheck_needed';
  nextAction:
    | 'continue_training'
    | 'reduce_support'
    | 'increase_difficulty'
    | 'return_to_prerequisite'
    | 'independent_retest'
    | 'transfer_test'
    | 'pause';
};
```

Training Result 不应包含：

- ability_improved
- level_promoted
- stable_growth_confirmed

这些结论必须由 Evaluation 决定。

## 十二、本模型与其他模型关系

Training 位于能力成长闭环的核心位置。

系统关系可以表示为：

```text
Ability Model
↓
Question Metadata
↓
Diagnosis Result
↓
Ability Evidence / Root Cause Hypothesis
↓
Training Plan
↓
Training Execution + Coach Intervention
↓
Training Evidence
↓
Independent Retest / Transfer
↓
Evaluation
↓
Profile Update Decision
```

ABILITY_MODEL 定义系统训练什么能力。

DIAGNOSIS_MODEL 负责发现可观察问题，提出有证据支持的能力短板或根因假设。

TRAINING_MODEL 负责根据诊断结果组织能力干预、训练执行、提示调节和训练证据生成。

EVALUATION_MODEL 负责验证训练是否有效，能力是否真正提升。

QUESTION_MODEL 应提供能够承载能力训练和迁移验证的任务载体。

AI Coach 和 Prompt Guide 应使用本模型中的训练语言，避免只讲答案或只安排重复做题。

Student Ability Profile 应记录 Evaluation 批准后的长期能力状态、支撑证据和下一步成长需要。

Training 是干预层，不是成长结论层。

Training 可以创造更好的练习条件，但不能绕过 Evidence 和 Evaluation 直接宣布能力提升。

本模型不涉及：

- 页面设计
- Prompt 编写
- 算法实现
- 数据库设计
- 具体题目内容
- 具体题库组织
- 具体教材内容

Training 是能力改善被推动和被观察的地方。

Diagnosis 找问题。Training 解决问题。Evaluation 验证问题是否真正解决。

训练对象永远是能力。训练目标永远是让学生产生更独立、更稳定、更可迁移的表现。未来 AI 陪练、能力训练、成长路径和训练计划，都必须引用本模型。

训练不是刷题，而是帮助学生建立能力。

## 十三、底层约束（Core Constraints）

Training 不创造长期能力结论。

Training 只能：

- 消费有证据支持的诊断结果
- 确定单一、明确、可验证的训练目标
- 组织训练任务、提示、修正与难度调整
- 记录学生的训练过程和提示依赖
- 生成训练阶段的 Ability Evidence
- 判断学生是否具备进入独立复测或迁移验证的条件

Training 不得：

- 仅因完成训练任务宣布能力提升
- 把提示后完成等同于独立掌握
- 绕过 Evaluation 更新能力等级
- 在根因不明确时直接安排强针对性训练
- 因连续失败无限增加同类题量
- 把针对性短片段完成直接解释为能力提升，或让微训练失败继续触发微训练
- 使用原题记忆结果证明迁移能力
