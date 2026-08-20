# Student Learning Narrative Calibration

**Status:** ENGINEERING BASELINE PASS / REAL STUDENT CALIBRATION PENDING
**Scope:** 单学生正式学习入口与反馈连续性
**Updated:** 2026-08-20

> **总设计原则：**一个教育 AI 的价值，不取决于它知道多少，而取决于学生能否感受到它知道、理解并持续帮助自己。

本原则要求学生端不仅呈现正确结论，还要让学生看见系统理解了本次作答、记得前后学习关系，并能给出具体且连续的下一步帮助。内部模型再完整，如果学生只能感受到机械判定和流程驱动，产品价值仍未成立。

## 一、问题定义

现有 Runtime 已经能够形成正式 Diagnosis、AbilityEvidence、GrowthMemory、NextLearningStrategy 和下一项 Frozen Resource，但学生看到的仍可能只是：

```text
做题
-> 提交
-> 收到点评
-> 进入下一题
```

工程链路已经连通，不代表学生理解了学习链。当前缺口是：正式教育事实缺少面向学生的连续解释。

本校准不追求“说话更温柔”，而是让学生能够理解：

- 为什么现在练这项内容；
- 本次已经完成了什么；
- 当前最需要补哪一步；
- 下一次可以怎样做；
- 当下一项任务确由本次表现动态调整时，为什么这样安排；
- 只有在证据可比时，这次表现与历史记录有什么关系。

## 二、正式定位

本能力是现有 Runtime 上的只读投影，不是新教育模型，也不新增 Phase。

```text
Formal Task / Task Requirement Coverage
+ StudentLearningFeedback / ControlledFeedbackResult
+ Eligible Evidence Quality / GrowthMemory
+ NextLearningStrategy / Matched Next Task
↓
StudentFeedbackGrounding
↓
StudentThinkingAnalysis
↓
StudentFeedbackActionPlan
↓
StudentLearningNarrativeProjection
↓
StudentLearningPresentation
↓
UnifiedLearningEntryState / Student Feedback UI
```

`StudentLearningNarrativeProjection` 保留来源绑定和校验；`StudentLearningPresentation` 只读地把合法文本组织成学生当前阶段需要回答的四个问题。页面不得读取 Projection 内部来源 ID，也不得绕过 Projection 直接展示 Strategy reason、GrowthMemory summary 或内部状态。

`StudentThinkingAnalysis` 只依据已校验事实描述“已经完成的思考动作”和“答案连接中断的位置”。`StudentFeedbackActionPlan` 再把该断点翻译为“为什么已有动作有价值、问题机制、思考提示和允许使用的句式支架”。二者都不是新 Diagnosis Agent，也不重新判断学生能力。Narrative 只能表达通过该计划校验的内容。

## 三、权威边界

- Narrative 只能解释已有正式结果，不能新增或修改 Diagnosis、Evidence、Profile、GrowthMemory、Strategy 或 Frozen Resource；
- Narrative 不持久化为新的教育事实，不建立独立 Repository；
- Narrative 不参与 Task Matching，不反向控制任务；
- 页面继续只消费统一入口状态和正式学生反馈；
- 确定性投影是默认基线，未来 LLM 只能在通过事实边界校验后增强表达；
- 投影校验失败时不展示该段解释，不回退展示内部原文。

## 四、最小学生展示视图

```ts
type StudentLearningPresentation = {
  taskReason?: string;
  outcome?: {
    responseAnchor?: string;
    achieved?: string;
    primaryGap?: string;
    progressMeaning?: string;
  };
  nextAction?: string;
  continuationReason?: string;
};
```

字段不要求同时出现。没有可靠来源时必须省略，不能为了版式完整生成模板内容。

四个区域分别回答：

1. `taskReason`：为什么练；
2. `outcome`：这次发生了什么；
3. `nextAction`：接下来怎么想、怎么写；
4. `continuationReason`：当下一项任务由本次表现动态调整时，为什么这样安排。

这四项是信息架构，不是四张必须同时展示的卡片。页面应按学习阶段只显示当前需要的信息。

### 4.1 taskReason

作答前解释当前任务角色，不泄露答案、评分点或关键材料线索。

- `training`：优先说明本题要求学生完成的具体阅读动作；基础进入层单选可以说明它为后续解释、证据组织或分析打基础；
- `retest`：说明经过间隔后再次独立完成同一具体阅读动作；
- `transfer`：说明在新材料中使用之前练过的具体阅读动作；
- `diagnosis / observation`：说明先通过当前具体任务了解学生怎样处理相关要求，后续学习据此安排。

`taskReason` 的事实来源按以下优先级确定：

1. 当前 Frozen Resource 所绑定 Observation Task 的 `expectedStudentAction / observationGoal / designReason`；
2. 当前 Concrete Task 的 `responseFormat / taskRole / targetAbilityName`；
3. 仅在具体训练意图缺失或不适合学生展示时，使用能力级安全回退。

具体训练意图进入学生投影前必须去除“学生需要 / 要求学生”等生产语气，并阻断正确答案、正确选项 ID、评分信号、干扰项依据和内部对象名。它只能解释“要完成什么阅读动作”和“为什么现在练”，不得提示“应该选什么”。说明不持久化为新的教育事实，也不修改 Frozen Resource。

当前题目的说明必须满足：

- 至少包含一个与本题直接相关的对象、证据范围或认知动作，不能只显示“理解 / 分析 / 推理”等能力词；
- 第一轮普通 Training 不得在缺少历史依据时写“继续练习”；
- 基础进入层单选推荐使用“先练习……，为后面的解释和分析打基础”；
- Retest 使用“再次”，Transfer 使用“换一份材料”，不得把角色语气混用；
- 刷新恢复必须基于同一 Concrete Task 和正式训练意图生成稳定文案；
- 具体训练意图不完整、包含疑似答案或含内部语言时，安全回退为能力级说明，不得为追求具体而泄露答案。

例如，题目“女娲最初感到孤独，是因为什么？”绑定的任务动作是“阅读第 1–2 段，定位描述女娲孤独的句子，并选择最直接的原因”，学生端可以显示：

> 这道题先练习阅读第 1–2 段，定位描述女娲孤独的句子，并判断最直接的原因，为后面的解释和分析打基础。

不得显示：

> 这项任务继续练习“理解”，重点是把阅读思路用在当前材料中。

后者只重复能力标签，既不能解释本题的具体作用，也可能在第一轮错误暗示已有连续训练。

### 4.2 responseAnchor / outcome / nextAction

这些字段继续复用现有本轮反馈边界：

- `outcome.responseAnchor` 只锚定与 `achieved` 或 `primaryGap` 直接相关的学生表达；
- `outcome.achieved` 来自本次答案中已核验的任务要求命中点，并说明该动作为什么有助于完成题目；
- `outcome.primaryGap` 只保留一个最关键缺口，并说明答案连接具体在哪里中断；
- `nextAction` 优先提供解决该断点的思考问题，不重复评价本次答案，也不机械拆分标准答案。句式支架只能在学生仍无法表达且提示层级已明确升级时出现，不能作为首次反馈的默认内容。

反馈不得只把能力术语换成另一套抽象话术。已有学生观点和正式材料线索时，应明确写出：学生已经提出哪个观点、当前答案缺少哪个组成部分、可回到材料中的哪一处线索、下一句可以怎样组织。单独使用“心理判断、具体动作、你的理解、说明关系”不能视为可执行反馈。

单项选择的 `responseAnchor` 与 Outcome 必须从结构化 `singleChoiceAnswer` 及其正式 Diagnosis / Evidence 生成。`answerText` 为空是单选的合法表示，不得因此阻断反馈。选项内容可以作为学生本次选择的可读表达，但必须由当前 Frozen Resource 的稳定 `optionId` 解析，不得把显示字母或选项文本当作正式答案身份。

单选反馈必须使用独立的叙事投影：`responseAnchor` 只说明“你选择了什么”，正确时 `achieved` 只说明本次判断符合材料和题意，错误时 `primaryGap` 只说明命中的可解释理解偏差；`nextAction` 只提示回到正式 `evidenceBoundary` 核对，或进入后续任务。不得把选项内容解析成学生自主写出的“观点、依据、解释”，也不得生成“解释没有写出来、补充文本依据、重新组织答案、修改本次选择”等文本题反馈。

单选第一版不开放反馈后修订。`StudentThinkingAnalysis` 与 `StudentFeedbackActionPlan` 必须按 `responseFormat` 分流，不能仅凭题干出现“为什么 / 说明 / 体现”等词语就建立 `missing_reasoning_relation`。后续若需要观察解释或证据组织，应由独立的短文本或长文本任务承担。

当 Narrative Outcome 因旧数据、降级反馈或安全边界无法形成时，页面必须回退显示受控反馈的 `headline / summary / nextActionText`；若这些字段也不可用，显示不带能力结论的最低保存说明。Narrative 缺失可以减少内容，但不能形成空白结果页。

主要缺口必须承接本次已经完成的内容。例如学生已经写出人物心理但缺少依据时，应说明“还需要找出什么，以及该内容需要支持哪一个已有理解”，不得退回“还缺少这一部分”等脱离上下文的通用模板。该表达只能引用学生已经写出的结论，不能泄露学生尚未发现的完整材料关键细节。

当人物心理判断需要调整时，点评应保留学生已经找到的动作或其他有效内容，再说明需要重新思考的对象；建议必须按“保留已有内容 / 找出依据 → 重新思考结论 → 说明依据与结论的联系”推进。显式人物名称高于“他 / 她”等代词，且不得使用没有明确前文对象的“这样的心理”“这种理解”等指代。

结论与材料不一致时，`StudentResponse` 必须作为只读反馈锚点进入 Narrative 转换。学生端应比较“学生原判断”和“正式材料线索”，说明两者为何没有对应，再提供重新判断的思考问题；不得退回“结论与材料意思不一致 / 重新查看 / 重新写出”等无上下文模板。

页面以“已经完成的思考 / 思考缺口 / 下一步训练”承载这三个字段，不重复新增一套反馈卡片。标题负责稳定信息结构，具体缺口类型仍由结构化原因码和正文解释，不依赖标题表达判断精度。

`responseAnchor` 可以是学生原文短引用、经核验的等价概括，或学生已经完成的明确认知动作。它不得复制整段答案，不得回应与当前完成点和主要缺口无关的内容，也不得把系统推断伪装成学生原话。没有可靠短锚点时允许省略。

`nextAction` 优先说明学生现在怎样修改本次答案，而不是泛化成以后如何做题。它必须直接对应唯一 `primaryGap`，保留已经完成的部分，不得使用“继续努力、加强理解、深入思考”作为核心建议，也不得提前给出学生尚未发现的完整结论或材料依据。

主要缺口必须保留结构化原因，不能再由 `answerStatus` 或页面文案直接猜测：

```ts
type TaskRequirementGapReasonCode =
  | 'conclusion_inconsistent'
  | 'missing_text_evidence'
  | 'missing_reasoning_relation'
  | 'incomplete_task_requirement'
  | 'insufficient_to_judge';
```

- `conclusion_inconsistent` 只有在正式 Diagnosis 明确确认结论与材料事实不一致时才能使用；
- `missing_text_evidence` 表示已有理解可能成立，但没有完成题目要求的原文依据；
- `missing_reasoning_relation` 表示结论和事实已经出现，但两者的联系未说明；
- `incomplete_task_requirement` 表示还有其他明确任务要求未完成；
- `insufficient_to_judge` 表示当前信息不足，不能写成答案错误。

`does_not_meet` 不得直接映射为 `conclusion_inconsistent`。正式结论未确认冲突时，应继续依据 Rubric 覆盖、可接受表达和已核验材料事实区分“需要重新判断 / 还需补充依据 / 还需说明联系 / 先补充回答”。页面只消费原因码，不重新解释 Diagnosis。

#### 4.2.1 反馈后 Revision Narrative

当正式策略允许一次反馈后修订时，Narrative 只负责把已成立的主要缺口转成一个学生可执行的 Revision Goal，不负责决定是否开放修订，也不重新诊断。

Revision Goal 必须与 `outcome.primaryGap` 和 `nextAction` 同源，不能出现点评要求补证据、修订目标却要求改结论等逻辑断裂。学生进入 Revision Mode 后，Narrative 应压缩为一至两条修改目标，不重复展示全部首次反馈。

Revised Response 提交后的学生表达必须来自正式 Revision Evaluation，只回答：

- 本次具体改善了什么；
- 主要缺口还有什么未解决；
- 下一次遇到类似任务时先做什么。

不得把修订后的达标描述为“已经独立掌握”，不得覆盖首次独立表现，也不得只写“回答更完整了”。Revision Evaluation 暂时不可用时，Narrative 只说明修改已经保存，不生成任何改善判断。

完整资格、状态与证据边界遵循[Learning 反馈后修订契约](./LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md)。

### 4.3 outcome.progressMeaning

只有同时存在以下正式事实时才能生成：

- 延迟复测计划具有正式基线 Evidence；
- 当前 Evidence Quality 为 `medium / high` 且 `eligible`；
- 回答有效、能力对齐、Diagnosis 对齐、追溯完整；
- 当前表现独立完成且属于 delayed observation；
- GrowthMemory 至少包含两个正式记录；
- 正式趋势允许表达 `confidence_increasing / status_improving`。

即便满足条件，也只表达“增加了一次可靠观察”，不得根据一次作答宣称能力已经提升、稳定或掌握。

### 4.4 continuationReason

`continuationReason` 只解释**真实发生的动态调度变化**，不解释固定题组中的普通“下一题”。只有同时满足以下条件时才能展示：

- `NextLearningStrategy` 存在且下一项正式资源已经 `matched`；
- 下一项任务确由本次正式结果触发 Retest、Transfer 或其他可追溯的策略调整；
- 当前不是既定 Session Task Queue 中按序进入下一题；
- 文案能说明学生可感知的变化，例如“换一份材料练习同一方法”或“间隔后再次独立完成”，而不是复述能力标签或内部观察目的。

固定题组连续训练时，按钮中的“进入第 k 题（共 n 题）”已经完整表达导航结果，其中 `k` 是即将进入的题号，不是完成题数。此时 `continuationReason` 必须省略，页面不得增加“为什么继续下一项任务”，也不得把后台 Strategy 的常规续题说明投射为学生必须理解的新信息。

正确作答后不得使用“补充目前还不够充分的信息”“处理还需巩固的部分”等暗示本题未完成的过渡文案。若动态调整确由缺口触发，说明必须绑定正式缺口事实；若无法形成具体、准确且不泄露答案的理由，宁可不展示。

资源 `no_match / blocked / review_required` 时不得暗示下一任务正在准备，也不得虚构任务目的。

## 五、分阶段展示

```text
作答前
-> 为什么练

作答后
-> 发生了什么
-> 怎么办

下一项任务因本次表现发生动态调整时
-> 为什么这样调整

合法跨 Session 比较成立时
-> 这次学习说明了什么
```

不得把四个区域同时堆在一个页面。一个阶段只展示当前决策所需的信息。已有“思路点评”和“思路建议”分别承载 `outcome` 与 `nextAction`，不新增重复反馈卡片。

## 六、最小学生主动性

Narrative 负责解释，不替代学生主动选择。统一入口继续保留：

- 查看本轮反馈；
- 进入下一项任务；
- 稍后继续；
- 结束本次学习。

本阶段不开放任意选能力、任意换题或聊天式 AI Coach。

## 七、首轮真实样例校准

工程基线通过后，选择 6—10 组真实样例，至少覆盖：

- extraction / comprehension / summarization / analysis / inference / expression；
- training / retest / transfer；
- incomplete response / insufficient evidence；
- 一组合法跨 Session 可比观察；
- 一组资源无法匹配的阻断状态。

每组冻结：Material、Question、Student Answer、Rubric、DiagnosisResult、Current Feedback、人工理想 Narrative、NextLearningStrategy、允许表达和禁止表达。

首批先冻结 4 组代表样例，覆盖“结论成立但缺依据、找到动作但结论偏差、完整回答、信息不足”。Builder 校准后再扩展为 8—10 组完整基线，避免使用当前实现反向定义理想反馈。

样例采用固定评审结构，但暂不升级为正式 Runtime Schema：

```ts
type NarrativeCalibrationSample = {
  sampleId: string;
  taskRole: 'diagnosis' | 'training' | 'retest' | 'transfer';
  materialExcerpt: string;
  question: string;
  studentAnswer: string;
  rubricCoverage: string[];
  diagnosisSummary: string;
  evidenceSummary?: string;
  strategySummary?: string;
  currentNarrative: StudentLearningNarrative;
  idealNarrative: StudentLearningNarrative;
  gapReasons: Array<
    | 'missing_response_anchor'
    | 'achieved_not_specific'
    | 'primary_gap_not_unique'
    | 'next_action_not_executable'
    | 'continuation_not_grounded'
    | 'language_too_generic'
    | 'unsupported_inference'
  >;
};
```

这批样例是首版产品语言基线，不代表全部题型和教育质量。

## 八、验收标准

### 8.1 确定性工程验收

- Training / Retest / Transfer 的任务原因准确且不泄题；
- 已完成点、主要缺口和下一动作均有来源；
- 没有正向事实时不强造 `achieved`；
- 下一任务未正式匹配时不生成 `continuationReason`；
- 固定 Session Task Queue 按序进入下一题时不展示 `continuationReason`；
- 动态继续说明不得与本题结果矛盾，也不得使用无法绑定正式缺口的不足暗示；
- 没有合法可比 Evidence 时不生成 `outcome.progressMeaning`；
- 四问展示层只重组合法投影，不生成新的内容；
- 页面按阶段消费展示对象，不并行拼装 Projection 原始字段；
- 身份或能力错位时整段投影阻断；
- 学生视图不包含内部 ID、枚举或 Runtime 术语；
- 原有 Unified Entry、反馈、持久化和生产构建保持通过。

### 8.2 学生理解验收

学生看完当前阶段信息后，应能在没有解释的情况下回答：

1. 我刚才哪一步做对了？
2. 我还缺哪一步？
3. 下一次具体怎样做？
4. 如果下一项任务发生了动态调整，为什么这样安排？

无法回答的内容应回到样例和人工理想文本校准，不通过扩大模板数量解决。

验收分为两层：内容层确认回应、完成点、主要缺口和修改动作均有正式来源，动态后续原因还必须证明任务确实因本次表现发生调整；感知层不询问“反馈好不好”，而要求学生用自己的话复述系统注意到什么、自己完成了什么、当前先改哪里，并仅在动态调度发生时说明下一任务为何变化。固定题组只需让学生明确当前进度和下一题入口。

## 九、当前实现记录

2026-08-20 固定题组继续说明收口：明确 `continuationReason` 只服务真实动态调度，不服务既定 Session Task Queue 的顺序导航。固定题组完成一题后仅展示本题反馈和“进入第 k 题（共 n 题）”；后台 Strategy 即使已经形成常规续题原因，也不得投射为“为什么继续下一项任务”。同时禁止在正确作答后使用“信息还不充分”等与结果矛盾的模板过渡。

2026-08-18 单选提交后反馈边界补强：冻结结构化选择身份与展示文本的分工；文本题继续校验 `answerText`，单选改为校验 `singleChoiceAnswer + optionSetVersion + displayedOptionOrder` 及正式 Response / Task / Session 身份。结果页增加“受控反馈 → 最低安全说明”展示兜底，任何已完成或受控阻断状态不得出现空白反馈卡片。

2026-08-18 “为什么练这题”具体意图补强：冻结 `taskReason` 的正式来源优先级、任务角色语气、基础进入层表达和答案泄露边界。Learning 应从 Frozen Resource 绑定的 Observation Task 读取具体训练动作；第一轮普通 Training 不再默认写“继续练习”，具体意图不可安全展示时才回退能力级说明。本轮只调整只读学生叙事投影，不修改题目、正式资源版本或发布状态。

2026-07-22 完成工程基线：

- 新增只读 `StudentLearningNarrativeProjection` 与安全学生视图；
- 新增确定性 `StudentThinkingAnalysis` 与 `StudentFeedbackActionPlan`，将唯一主要 Gap 转换为已完成思考及其价值、可观察断点和思考问题；受控句式支架仅作为后续提示升级能力保留；
- 当 `TaskRequirementCoverage` 已包含学生观点和任务材料线索时，反馈直接引用这些合法事实，不再退化为“具体动作 / 你的理解 / 说明关系”等无指向表达；
- 反馈深度按正式状态控制：无效作答不生成具体 Gap 或材料提示，可重试反馈降低支架深度，正式结果允许提供区块级修改路径；
- 新增只读 `StudentLearningPresentation`，将合法叙事组织为“为什么练 / 发生了什么 / 怎么办 / 动态调整时为什么变化”；
- 接入统一学习入口和正式学习工作区；
- 作答前展示“为什么练这题”；
- 正式下一任务匹配且确由本次表现发生动态调整后，才展示继续原因；固定题组顺序导航不展示；
- 合法延迟独立观察成立时才允许展示进展含义；
- 缺少文本依据时，主要缺口会承接学生已经写出的结论，说明“还要找什么、找到后要说明什么关系”，不再使用“还缺少这一部分”等脱离上下文的句式，也不泄露学生尚未发现的完整材料细节；
- `/learning` 恢复正式反馈时，先依据本轮事实重建“思路点评”，再以同一主要缺口生成“思路建议”；刷新、恢复和继续学习不得出现点评要求重新判断、建议却跳过该步骤的逻辑断裂；
- 人物心理判断需要重想时，思路建议拆成三个独立动作：找出或保留人物动作、重新判断人物心理、说明判断理由；不得把三个步骤压缩成包含“重新得出的理解”等抽象表述的长句；
- 新增与主要缺口直接相关的短 `responseAnchor`，不重复展示整段学生答案；
- 正式 `StudentResponse` 以只读方式进入 Narrative Builder：当回答方向错误但文本有效时，可以中性回应“你在回答中写到……”，但该内容不得进入 `achieved`；“不知道”等占位回答和提示注入文本不得生成锚点；
- Narrative 保留 `needs_adjustment / needs_completion / insufficient_to_judge` 三种展示语义，并结合正式原因码区分“需要重新判断 / 还需补充依据 / 还需说明联系 / 还需完成 / 先补充回答”，不再根据缺口文案猜测状态；
- 正式题目要求覆盖项新增五类 `gapReasonCode`，页面可进一步区分“需要重新判断 / 还需补充依据 / 还需说明联系 / 还需完成 / 先补充回答”；`does_not_meet` 不再自动等于理解错误，只有正式结果明确确认结论与材料不一致时才进入“需要重新判断”；
- Narrative `nextAction` 优先消费已校验的当前答案修改步骤，泛化鼓励不得进入正式展示；
- `/learning` 正式反馈页以通过校验的 `StudentLearningPresentation` 为首选展示源，直接呈现“已经完成的思考 / 思考缺口 / 下一步训练”，不再增加“思路点评”总标题；`responseAnchor` 继续作为内部追溯信息保留，不再单独占用学生反馈区块；旧 `thinkingReview + guidance` 仅在 Narrative 缺失时作为安全回退；
- 冻结 4 组代表样例，并提供旧版与理想 Narrative 并排验收入口 `/student-learning-narrative-calibration-demo`；
- Controlled Feedback Expression 回归 `61 / 61 PASS`；
- 专项 Debug `24 / 24 PASS`，覆盖错误答案中性锚点、占位答案阻断、缺口展示语义、身份错位阻断与四组冻结样例正式 Builder 验收；
- Feedback Action Plan 专项 Debug `8 / 8 PASS`，其中包含“结论偏差同时锚定学生原判断与材料线索”案例；Grounding 回归 `6 / 6 PASS`；
- 确定性映射与模板是正式可靠基线，LLM 表达仅可作为后续受控增强，不是学生叙事成立的前提；
- Unified Learning Entry 回归 `17 / 17 PASS`；
- Phase 16.3 Day 0 正式恢复链回归 `12 / 12 PASS`；
- Production Build `PASS`。

### 9.1 Student Learning Narrative Calibration v1.1

本轮把反馈从界面字段调整升级为受约束的教学反馈结构：

```text
Question Metadata / Rubric
↓
Student Response
↓
DiagnosisResult
↓
TaskRequirementCoverage
↓
StudentFeedbackGrounding
↓
StudentLearningNarrative
↓
已经完成的思考 / 思考缺口 / 下一步训练
```

新增只读 `StudentFeedbackGrounding` 契约：

- `achievedPoints` 必须同时具有正式 Requirement 与学生作答证据，不能凭语言习惯表扬；
- `primaryGap` 从唯一 `primaryGapRequirementId / gapReasonCode` 映射，不根据自然语言缺口文案猜测；
- `actions` 必须绑定同一个主要 Gap，并声明补充后需要重新验证的任务要求；
- `insufficient_to_judge` 不生成具体 Learning Gap，只保留 `cannot_assess / needs_verification`；
- 当前 Gap 只描述本次任务表现，不写入长期 Profile，也不代表长期能力薄弱；
- 来源链接使用内部标识，不把学生原答案拼接进 ID 或展示层。

新增专项命令：

```bash
npm run debug:student-feedback-grounding
```

当前专项结果：`6 / 6 PASS`；Narrative 回归：`24 / 24 PASS`；Production Build：`PASS`。

当前仍未完成：6—10 组真实样例冻结、旧版与新版并排人工评审、真实学生理解验收。未完成上述工作前，不宣称“学习叙事体验已经正式通过”。

## 十、停止条件

首轮满足以下条件后立即停止扩展并进入真实使用：

- 6—10 组样例有人工理想文本和来源边界；
- 四个学生理解问题能够被独立回答；
- 没有越权进步结论或下一任务虚构；
- 页面信息量没有增加新的阅读负担；
- 既有 Runtime 回归和 Production Build 通过。

本校准不继续发展 Persona、聊天、全局文案平台、第二套 Feedback Runtime 或新的成长模型。
