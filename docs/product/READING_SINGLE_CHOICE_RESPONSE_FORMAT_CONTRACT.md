# 阅读训练单项选择作答契约

英文名称：Reading Single-Choice Response Format Contract

状态：`DESIGN ACCEPTED / STAGES 1–4 PASS / CAPABILITY GATE OPEN`

文档版本：`reading_single_choice_response_format_v1.17`

生效日期：`2026-08-18`

## 一、目的

本文定义阅读训练中的单项选择作答能力。单选题不是独立产品模块，也不是嵌入文本题内部的附加小题，而是 `QuestionCandidate` 的一种完整 `responseFormat`。它继续使用现有正式资源生产与 Learning 消费主链：

```text
Material Version
→ Observation Plan Revision
→ Training Task
→ QuestionCandidate(responseFormat = single_choice)
→ Adopt
→ Question Draft Revision
→ Validation / Quality Assessment
→ Publish
→ Frozen Resource / Registry / Active Link
→ Learning
```

本能力的目标是：

1. 为信息提取、基础理解、局部判断和简单关系辨析提供低输入成本的作答方式；
2. 通过稳定选项身份和可解释干扰项，让错误选择能够进入 Diagnosis；
3. 采集正确率、干扰项分布、作答时间等真实数据，帮助校准题目而不是机械判分；
4. 不改变“AI 生成完整候选，人只负责采用或不采用”的生产原则；
5. 不把高阶阅读能力批量改造成选择题。

## 二、产品定位与冻结边界

### 2.1 产品定位

单选题属于一篇阅读材料的训练任务组，可以与短文本、长文本任务并列：

```text
一篇阅读材料
├─ 独立任务：单项选择——信息定位、基础理解或局部判断
├─ 独立任务：简短回答——局部解释或概括
└─ 独立任务：长文本回答——分析、推理或证据整合
```

每个任务都是独立 Question Resource、独立 Attempt 和独立 Diagnosis。第一版禁止把“选择 + 解释”“选择 + 追问”包装为一道复合题。

### 2.1.1 基础理解入口与难度梯度

单项选择同时承担阅读训练的基础理解入口。对于部分材料和学习者，若直接从简答、分析或证据整合任务开始，学生需要同时承担材料理解、题意理解、判断形成和语言组织等多重负荷，可能使训练起始难度过高。

在训练动作适合时，系统可以先通过单项选择低成本确认信息定位、对象关系、局部含义或简单因果是否成立，再逐步进入简短解释和长文本分析。

推荐形成：

```text
基础辨认 / 理解 → 局部解释 → 综合分析
```

但该梯度不是固定题型流程。是否采用该梯度，应由当前 Observation Plan、已有能力证据、材料特征和训练目标共同决定，不能只根据年级、题型配额或单次表现机械安排。基础理解已有稳定证据、当前 Observation Plan 直接面向高阶能力，或材料无法形成有诊断价值的干扰项时，可以直接进入文本任务。

单选的目的不是降低能力标准，而是降低表达负担和训练入口负荷，使基础理解与高阶表达得到分层观察。单次选择正确只表示本次基础判断成立，不直接等于理解能力已经稳定；仍应根据观察目标，通过文本任务、Retest 或 Transfer 补充证据。

### 2.2 第一版只做什么

- 只实现 `single_choice`；
- 每题只能选择一个选项；
- 每题必须且只能有一个正确选项；
- 支持独立生成、重新生成、采用、发布、Learning 作答、反馈、恢复和真实数据采集；
- 支持选项显示顺序变化，但所有持久化关系使用稳定 `optionId`；
- 支持根据错误选项投影一种可解释的典型偏差。

### 2.3 第一版不做什么

- 不实现 `multiple_choice`、判断题或填空题；
- 不实现部分得分、漏选权重或组合评分；
- 不实现选择后自动追问；
- 不要求所有材料无条件固定达到选择题数量目标；数量不足可以基于质量、重复、容量或文本观察覆盖原因解释放行；
- 不按题型配额机械平衡题组；
- 不因选择正确直接宣称能力已经掌握；
- 不把正确答案和干扰项内部依据提前下发给学生端；
- 不开放反馈后的立即改选。若以后支持，必须形成独立 Revision，并继续保留首次选择。

## 三、作答格式与题目类型边界

### 3.1 唯一规范字段

学生作答交互由 `responseFormat` 决定。第一版不得再增加与其同义的 `interactionType`，避免出现两套事实来源。

```ts
type QuestionResponseFormat =
  | 'boolean'
  | 'short_text'
  | 'long_text'
  | 'single_choice';
```

`boolean` 作为既有兼容格式继续保留，但不属于本轮工程范围；`multiple_choice` 只保留为未来候选，第一版不进入正式 `QuestionResponseFormat` 可执行集合。

现有 Schema 中即使已经预留 `single_choice` 枚举，也不自动代表产品具备可执行能力。2026-08-18 完成本文第十三节四个阶段及第十四节最低验收后，`multiple_choice + single_choice` 已进入正式资源可执行能力集合；若后续阶段 4 回归或严重产品边界失败，仍应通过版本化 Capability Snapshot 关闭门禁，不修改或删除历史事实。

`questionType` 继续描述内容或结构分类，不能替代 `responseFormat` 驱动 Learning 交互。两者冲突时必须阻断发布。

### 3.2 作答形式由训练动作决定

允许优先评估单选题的训练动作包括：

- 定位明确事实、人物、对象或语句；
- 判断局部信息是否符合文本；
- 辨认简单因果、指代或人物关系；
- 初步辨认语句作用、人物心理或表达效果；
- 区分典型表面理解、对象混淆、证据遗漏和过度推断。

默认继续使用文本作答的训练动作包括：

- 概括多个信息或形成完整结论；
- 整合多个段落、对象或证据；
- 展开因果链和推理过程；
- 人物分析、主题理解和结构分析；
- 评价、迁移和表达。

单选题可以用于高阶任务的前置观察，但不能仅凭一个选择替代高阶能力的完整证据。

### 3.3 目标区间而非机械题型配额

系统不得规定选择题固定占比，也不得为了题型丰富度把高阶文本任务机械改成单选。单选数量采用“目标区间 + 质量约束”原则：目标用于让基础理解入口稳定进入规划，不能覆盖 Observation Plan、训练动作适配、干扰项质量、任务去重和文本观察覆盖等更高优先级事实。

生成器决定 `responseFormat` 的顺序固定为：

```text
训练目标
→ 是否适合低输入判断
→ 能否形成高质量、可解释干扰项
→ 是否与当前有效任务实质重复
→ 再参考当前有效任务组的单选数量与剩余容量
```

不得反过来因为“还缺 1 道单选”而强行转换不适合的训练动作。

#### 3.3.1 推荐数量与文本任务边界

数量区间约束同一材料某一规范 Observation Plan 完成后的有效任务组：不统计历史 Plan、已被替代或停用的任务，也不重复统计同一任务谱系的旧 Revision。评估已有题组时以当前 `Active Observation Plan Revision` 为准；生成新 Plan 或补充 Plan 时，以本轮规划完成后的目标有效任务总数为准，尚未采用的 Candidate 只用于预检，不提前计入正式统计。

| 当前有效任务总数 | 单选推荐目标 | 单选上限 | 文本任务保留边界 |
| --- | --- | --- | --- |
| 2 道 | 0–1 道 | 1 道 | 至少保留 1 道文本任务 |
| 3 道 | 默认 1 道 | 特殊情况下 2 道 | 至少保留 1 道具有解释、证据或表达价值的文本任务 |
| 4 道 | 1–2 道 | 2 道 | 至少保留 2 道文本任务 |
| 5 道 | 默认 2 道 | 3 道 | 至少保留 2 道文本任务；增加第 3 道前必须确认高阶观察未被挤压 |
| 6 道 | 默认 2 道，适合时 3 道 | 3 道 | 至少保留 3 道文本任务 |

对常规 `5–6` 道阅读训练任务组，系统应把 `2` 道单选作为默认基础理解入口；只有材料、训练目标、独立观察价值和干扰项质量均充分时才增加到 `3` 道。数量达到目标不等于规划合格；若多道单选观察同一对象、同一证据和同一认知动作，仍必须按重复或覆盖不足处理。

#### 3.3.2 分布与独立观察要求

推荐生成多道单选时，不得只是重复定位同一句话。多道单选之间至少应在观察对象、证据范围或认知动作之一形成实质差异，优先覆盖：

```text
单选 1：信息、人物、对象或指代定位
单选 2：基础含义、局部理解或简单关系
单选 3：简单因果、典型误读或过度推断辨析
```

上述顺序只是覆盖示例，不是固定出题顺序。实际任务顺序仍由 Observation Plan、任务依赖和 TrainingTask Role 决定。

#### 3.3.3 补充生成数量计算

补充生成只增加尚未覆盖的新 Observation，不修改、覆盖或替换既有正式题目。系统必须先基于当前有效任务组计算：

```text
目标任务组规模 = min(6, 当前有效任务总数 + 本轮计划补充任务总数)
本轮目标单选数 = 根据“目标任务组规模”查第 3.3.1 节目标区间
目标缺口 = max(0, 本轮目标单选数 - 当前有效单选数)
剩余容量 = max(0, 6 - 当前有效任务总数)
实际单选补充数 = min(目标缺口, 本轮计划补充任务总数, 剩余容量, 合格独立单选观察数)
```

推荐行为如下：

| 当前有效单选数 | 补充规划行为 |
| --- | --- |
| 0 道 | 当本轮目标任务组为 `5–6` 道时优先补充 2 道；较小任务组按第 3.3.1 节收敛，条件充分且总容量允许时可规划第 3 道 |
| 1 道 | 优先补充 1 道；仍有独立观察、质量充分且容量允许时可再补 1 道 |
| 2 道 | 默认不为数量继续补充；仅在第 3 道有独立价值且不挤压文本任务时增加 |
| 3 道 | 默认不再增加单选 |

当前有效任务组已经达到 `6` 道时，补充生成不得突破容量。若确有适合改成单选的既有文本任务，只能由用户从该 TrainingTask 发起单题替代优化，形成同一题目谱系的后继 Candidate / Revision；系统不得批量自动替换，也不得改写历史 Frozen Resource。

若候选只是在已有题干上更换 `responseFormat`，必须判为既有 Observation 的替代方案，不得作为补充任务采用。若没有新的合格观察点，系统必须明确记录目标不足原因，不得返回重复题、低质量干扰项或一组纯文本候选并误报为已满足单选补充目标。

#### 3.3.4 软目标、硬约束与可解释放行

以下属于规划软目标：

- `5–6` 道常规任务默认包含 `2` 道单选；
- 材料与训练目标适合时增加到 `3` 道；
- 多道单选尽量覆盖不同的基础理解动作。

以下属于发布前硬约束：

- 当前有效任务总数不得超过 `6`；
- 单选数量不得超过第 3.3.1 节上限；
- 不得与现有任务实质重复；
- 每个错误选项必须对应可解释偏差，不能用明显错误选项凑数；
- 不得挤压当前 Observation Plan 必需的概括、解释、推理、证据整合或表达任务。

软目标未达到时不得自动判定方案失败。系统应记录结构化不足结果，至少包含目标数、实际数和以下一个或多个原因：

- `insufficient_task_capacity`：当前任务组剩余容量不足；
- `insufficient_supplement_scope`：本轮计划补充的任务数量不足以一次补齐目标；
- `no_independent_observation`：没有新的独立基础理解观察；
- `duplicate_with_existing_task`：会与现有任务实质重复；
- `distractor_quality_insufficient`：无法形成高质量、可解释干扰项；
- `would_displace_text_observation`：会挤压必要的文本观察。

该结果用于生成治理和后续优化，不投射成新的人工审核步骤。生产端仍只提供“采用当前任务方案”或“重新生成任务方案”；单题仍只提供“采用并发布”或“不采用并重新优化”。核心原则冻结为：

> 宁可少一道单选，也不得为满足数量目标生成低诊断价值的选择题。

## 四、任务顺序规则

### 4.1 默认顺序与受控例外

常规情况下，系统优先将 `1–2` 道承担基础辨认、信息定位、局部理解或简单关系判断的 `single_choice` 安排在文本任务之前，作为阅读进入层，再逐步进入局部解释、证据组织和综合分析。该规则是可解释的规划软约束，不是“所有选择题永远排第一”的机械规则。

组级顺序策略只允许使用：

```ts
type TrainingTaskSequenceStrategy =
  | 'entry_first'
  | 'holistic_first'
  | 'role_driven';

type TrainingTaskSequenceReason =
  | 'default_foundation_entry'
  | 'holistic_judgment_required'
  | 'independent_expression_baseline'
  | 'retest_after_training'
  | 'transfer_in_new_context'
  | 'no_qualified_single_choice';
```

- `entry_first`：默认策略。优先把至多 `2` 道合格基础理解单选放在第一个高负荷文本任务之前；
- `holistic_first`：当前 Observation Plan 明确要求学生先形成整体判断，或需要先保留不受提示影响的独立文本表达基线；
- `role_driven`：单选承担 `retest / transfer` 时按任务角色和时间依赖投放，不提前到初始 Training 入口。

选择非默认策略必须同时记录一个受控原因码，不接受自由文本替代结构化决定。不得仅以“题型更丰富”“单选数量还不够”或“模型原本这样排序”为例外理由。

### 4.2 顺序示例

允许的顺序包括：

```text
局部单选 → 简短解释 → 全文分析
整体文本判断 → 局部单选辨析 → 证据整合
文本训练 → 间隔 Retest 单选 → 新材料 Transfer
```

`taskRole` 只约束任务用途：

- `training`：学习与形成能力；
- `retest`：间隔后验证稳定性；
- `transfer`：在新材料或新条件下验证迁移。

`taskRole` 不是同篇材料内排序的唯一依据，也不能成为重复题放行理由。

### 4.3 生产顺序与 Learning 投放顺序

顺序必须区分两个层面：

1. **生产存储顺序**：初始规划或整组替代可以按当前 `sequenceStrategy` 对新候选稳定排序；补充生成只能追加新 Candidate，不得重排、覆盖或重新编号既有已发布任务；
2. **Learning 投放顺序**：只对尚未消费的任务应用当前顺序策略。已完成、已提交或已进入反馈/修订链的任务保持原历史顺序；`retest / transfer` 继续服从到期时间、任务角色和材料迁移条件。

因此，补充发布一个新的基础单选，不会改写正式资源历史，也不会把学生已经完成的文本任务移到后面；它只允许在后续尚未消费的同组 Training 候选中获得入口优先级。

### 4.4 规划结果与放行规则

规划器必须返回结构化结果：

```ts
type TrainingTaskSequencePlanningResult = {
  strategy: TrainingTaskSequenceStrategy;
  reason: TrainingTaskSequenceReason;
  expectedPreludeChoiceCount: number;
  actualPreludeChoiceCount: number;
  status: 'not_applicable' | 'met' | 'adjusted' | 'underfilled';
};
```

- `met`：默认进入层达到目标；
- `adjusted`：因整体判断、独立表达基线、Retest 或 Transfer 采用受控例外；
- `underfilled`：材料没有足够的合格基础单选，但候选本身仍可通过其他质量门禁；
- `not_applicable`：当前任务组没有顺序目标。

`underfilled / adjusted` 不产生新的人工审核步骤，也不能单独阻断采用或发布。结构非法、重复、干扰项质量不合格、任务依赖冲突等既有硬门禁仍保持阻断。

## 五、Candidate 与正式资源数据契约

### 5.1 完整候选

单选 `QuestionCandidate` 必须作为不可拆分的完整方案生成。除现有题干、能力、Rubric、Answer Acceptance 和材料范围外，还必须包含选择交互配置：

```ts
type QuestionChoiceOption = {
  optionId: string;
  content: string;
};

type QuestionDistractorRationale = {
  optionId: string;
  misconceptionCode:
    | 'surface_reading'
    | 'entity_confusion'
    | 'evidence_omission'
    | 'over_inference'
    | 'causal_reversal'
    | 'scope_shift'
    | 'other_explainable_bias';
  diagnosisMeaning: string;
  evidenceBoundary?: string;
};

type SingleChoiceInteraction = {
  selectionMode: 'single';
  options: QuestionChoiceOption[];
  correctOptionIds: [string];
  distractorRationales: QuestionDistractorRationale[];
  optionSetVersion: number;
};

type QuestionCandidateContent = {
  responseFormat: 'single_choice';
  choiceInteraction: SingleChoiceInteraction;
  answerAcceptance: AnswerAcceptance;
  rubric: QuestionResourceRubricItem[];
  // 其余既有完整题目字段保持不变
};
```

字段可以在工程阶段按现有 Schema 命名风格微调，但必须保持一个聚合的选择交互对象，禁止把选项、答案键和干扰项依据散落到无版本关系的多个字段。

第一版每题必须包含 `3—5` 个互不重复的选项，默认优先生成 `4` 个；不能仅为满足数量要求添加没有诊断价值的错误选项。

### 5.2 稳定选项身份

- `optionId` 在同一个 Candidate 和由其形成的 Question Revision 中不可变；
- 不得使用 `A / B / C / D` 作为持久化身份；
- 显示字母和显示顺序只属于 Learning Presentation；
- 重新生成 Candidate 必须形成新的 Candidate 身份和新的选项集合版本；
- 采用后若改变任何选项内容、正确答案或干扰项依据，必须形成新的 Question Revision；
- Frozen Version 发布后不得原位修改选项或答案键。

### 5.3 正确答案与学生投影隔离

正式资源内部可以保存答案键和干扰项依据，但 Learning 学生投影只能得到：

```ts
type StudentSingleChoiceDelivery = {
  responseFormat: 'single_choice';
  options: Array<{
    optionId: string;
    content: string;
    displayOrder: number;
  }>;
  optionSetVersion: number;
};
```

学生投影不得包含：

- `correctOptionIds`；
- `distractorRationales`；
- Rubric 内部评分信号；
- 能够反推出答案的调试字段。

答案判断必须由正式 Evaluation / Diagnosis 侧读取受保护的 Frozen Resource 视图完成，不能依赖浏览器传回的正确答案字段。

## 六、干扰项质量契约

### 6.1 最低要求

每个错误选项必须对应一种独立、可解释的典型偏差。允许的设计示例：

```text
正确选项：符合文本证据的理解
错误选项1：只看到表面信息
错误选项2：混淆人物、对象或指代
错误选项3：推理超过文本证据
```

### 6.2 阻断性质量门禁

出现任一情况时，Candidate 不得标记为“可以发布”：

1. 正确选项数量不等于 `1`；
2. 任一选项缺少稳定 `optionId` 或内容为空；
3. `optionId` 重复，或答案键指向不存在的选项；
4. 任一错误选项缺少对应 `distractorRationale`；
5. 多个错误选项只是同一种错误的措辞变体；
6. 干扰项无法由当前材料语境解释；
7. 需要依赖材料之外的知识才能排除错误选项；
8. 选项存在明显语法、长度、语气或概念层级提示；
9. 题干要求解释、概括或整合证据，但交互只允许选择；
10. 使用“以上都对”“以上都不对”等第一版禁止形式；
11. 学生投影包含答案键或干扰项内部依据；
12. 选择题与同篇已有任务在对象、证据、动作和评分目标上实质重复。

### 6.3 质量提醒

以下情况可以产生提醒，由 AI 重新优化完整 Candidate，不增加人工改题步骤：

- 选项长度差异较大；
- 正确选项比错误选项明显更精确；
- 干扰项吸引力可能不足；
- 题目只观察记忆而缺少阅读价值；
- 单选题在同篇任务组中过多，可能挤压文本表达观察。

### 6.4 单选专用质量评估与文本规则隔离

质量评估必须先读取 `responseFormat`，不得把开放文本题的检查条件直接套用到 `single_choice`。

对于单选题：

1. “选择最准确、正确、符合文意或不能说明的一项”等选择语义，本身就是明确的可观察动作；只要题干、选项集合与选择模式完整，不得因为题干没有出现“找出、概括、分析”等文本作答动词而产生 `quality.observation.unclear`；
2. 单选题不要求用两个或更多 Rubric 项区分“完整回答、部分回答和未达到要求”。它的区分度由唯一正确答案、有效选项集合、逐项干扰依据和错误选项对应的可解释偏差共同建立；不得仅因 Rubric 只有一个核心判断项而产生 `quality.discrimination.weak`；
3. 单选专用区分度检查必须验证：`3–5` 个非空且稳定的选项、唯一且存在于选项集合中的正确项、每个错误项都有对应且非空的 `distractorRationale`，并且至少形成一个可解释的错误偏差；
4. 题干没有选择语义、选项缺失、答案键冲突、错误项缺少诊断依据、多个干扰项实质相同或选项无法由材料解释时，继续产生对应提醒或阻断；
5. `short_text / long_text` 继续使用可观察动作和多层 Rubric 检查，单选规则不得降低文本题原有质量标准。

质量提醒只报告当前题型真实存在的问题。由于检查器题型错配而产生的提醒属于误报，不得投射为用户需要判断或接受的质量风险。

### 6.5 选择动作语义与正式材料 Anchor

单选可观察动作必须按选择语义识别，不得只枚举少量固定句式。以下表达及其等价变体都属于明确选择动作：

- “正确的一项是 / 不正确的一项是”；
- “理解最准确的一项是 / 最符合文意的一项是”；
- “下列哪项能够说明 / 不能说明”；
- “请选择 / 选出”。

判断依据应是题干是否要求学生从选项中完成一个明确判断，而不是是否恰好命中某个完整字符串。新增真实题干表达时，不得反复通过用户侧质量提醒暴露词面漏配。

材料证据范围以 Observation Plan 关联的正式 `MaterialSourceAnchor` 为权威来源。若正式 Anchor 已明确为单段、段落范围或全文，质量评估必须消费该结构化范围；不得因为题干只写“文中”而要求题干重复“第 N 段”或“结合全文”。单选错误项的 `distractorRationale.evidenceBoundary` 可补充诊断依据，但不能替代正式 Anchor。

只有以下情况才可产生材料范围提醒：

1. 正式 Anchor 缺失或无效；
2. 题干显式段落范围与正式 Anchor 冲突；
3. 题干或选项要求的判断明显越过正式 Anchor；
4. 题目没有任何可用的材料关联。

任务卡展示的范围、质量评估消费的范围和发布链保存的范围必须来自同一正式 Anchor，禁止页面显示“第 2–4 段”而检查器仍按无范围题干生成提醒。

### 6.6 正确答案位置与确定性展示顺序

`optionId` 是答案、干扰项依据和诊断链使用的稳定身份；A / B / C / D 只是某次展示顺序生成的临时标签。系统不得把“正确答案总是第一个选项”作为生成模板或投放约定。

必须同时满足：

1. Prompt 示例不得持续把第一个 option 声明为正确答案；同批生成多道单选时，应主动变化正确 option 在返回数组中的位置；
2. 生成器不得为追求字母均衡改写答案内容或干扰项，只能在完整结构生成后调整展示顺序；
3. Candidate 预览和正式 Learning 投放必须使用稳定 optionId 构造确定性排列，不得默认照搬 Provider 返回顺序；
4. Learning 排列至少绑定正式资源版本和学生身份；同一学生面对同一正式资源时，刷新、断点恢复和重复读取必须保持一致，不得在页面重渲染时随机跳动；
5. 学生答案必须继续记录 `displayedOptionOrder`，评估与 Diagnosis 只按 optionId 判断，不按 A / B / C / D 判断；
6. 正确答案标签应在真实题组中形成合理分布，不得长期集中于单一位置，也不得机械形成可预测的 A-B-C-D 循环；
7. 内部查看正确答案时，必须基于当前展示顺序计算标签，禁止用 canonical options 数组位置直接推断字母。

确定性排列只能改变显示位置，不能改变 `correctOptionIds`、`distractorRationales.optionId`、`answerAcceptance.acceptedOptionIds` 或 `optionSetVersion`。任何排列都必须完整包含每个 optionId 且恰好一次。

## 七、Answer Acceptance、Rubric 与 Diagnosis

### 7.1 Answer Acceptance 与最低响应要求

`single_choice` 的形式判定以稳定 `optionId` 为准：

```text
selectedOptionIds 恰好包含一个有效 optionId
→ 可以进入正式 Evaluation

selectedOptionIds 为空、超过一个或包含未知 optionId
→ Response invalid，不进入能力诊断
```

不得把选项显示字母或选项文本作为唯一答案键。答案文本规范化不适用于单选结果身份。

第一版 `assessmentMode` 必须为 `exact_match`。现有面向文本的 `MinimumAnswerRequirement` 不能通过填写 `minLength = 1` 假装支持单选，工程阶段必须改为按 `responseFormat` 区分的联合类型：

```ts
type MinimumResponseRequirement =
  | {
      responseFormat: 'short_text' | 'long_text';
      minLength: number;
      requireTextEvidence: boolean;
      requireExplanation: boolean;
    }
  | {
      responseFormat: 'single_choice';
      minSelections: 1;
      maxSelections: 1;
    };
```

单选 Candidate 若继续依赖文本长度、关键词或语义等价规则判定有效性，必须阻断发布。

### 7.2 Rubric

Rubric 继续描述题目希望观察的能力，不得退化为“选A得1分”。至少需要说明：

- 正确选择支持观察什么；
- 每类错误选择暴露何种理解偏差；
- 本题证据强度是初步观察还是能够支持更强结论；
- 是否需要后续文本题、Retest 或 Transfer 补充证据。

### 7.3 Diagnosis

错误选择应映射为具体但不过度推断的反馈，例如：

```text
你目前更关注了句子的表面信息，但题目需要比较人物前后行为。
可以重新查看第3—4段中人物动作发生变化的位置。
```

禁止只输出“回答错误”“正确答案是B”，也禁止根据一个干扰项直接给学生贴固定能力标签。

选择正确只表示本次回答与答案键一致。系统必须结合题目版本、作答时间、是否使用提示、同能力其他任务以及后续 Retest / Transfer，才能形成更强的能力解释。

### 7.4 单选与文本作答的互补观察

单项选择与短文本、长文本不是相互替代的计分题型，而是面向能力路径不同环节的互补观察：

- `single_choice` 主要以低输入成本确认学生是否完成信息定位、对象与关系辨认、局部理解等前置动作；
- `short_text` 主要观察聚焦解释、局部概括和少量证据的准确使用；
- `long_text` 主要观察多证据组织、推理链、分析、完整结论和表达。

当系统需要区分“基础理解尚未成立”与“基础理解基本成立但表达、证据组织或高阶分析不足”时，可以关联同一材料或同一能力路径中的独立任务，但必须保持独立 Question Resource、Attempt、Diagnosis 和 Evidence，不得把两道题合并成一个总分或一条不可追溯的综合结论。

互补观察使用以下解释矩阵：

| 单选表现 | 文本表现 | 当前允许形成的解释 |
| --- | --- | --- |
| 弱 | 弱 | 基础定位或理解可能尚未成立；优先形成前置能力缺口假设 |
| 强 | 弱 | 基础理解具有初步支持；继续检查概括、证据组织、分析、推理或表达缺口 |
| 弱 | 强 | 证据冲突；优先检查题目质量、误触、猜测、交互适配或观察目标错位，不直接判定基础能力薄弱 |
| 强 | 强 | 形成较强的本次综合表现证据；仍需独立 Retest / Transfer 才能支持稳定掌握结论 |

矩阵中的“强 / 弱”只描述当前任务表现，不等于长期能力等级。跨格式联合解释必须遵守：

1. 只有材料版本、能力路径、观察对象和证据范围具有可解释关系的任务才能进入同一互补观察；
2. 任务角色不同不会自动使证据可比较，Training / Retest / Transfer 仍须分别解释；
3. 单选错误项只提供一种受材料支持的偏差信号，文本回答用于补充学生如何解释和组织证据；
4. 单选正确不得自动抵消文本任务中的真实缺口，文本表现优秀也不得静默覆盖单选侧的冲突信号；
5. 跨格式结果默认形成 `rootCauseHypothesis` 或 `unresolved`，不能仅凭一组互补题写入 `confirmedRootCause`；
6. 不要求每篇材料机械配置互补题组；只有新增观察价值明确时才生成和关联。

## 八、Learning 作答与恢复

### 8.1 学生响应

Learning 运行期必须扩展为结构化响应，而不是把选项文本或字母拼进 `answerText`：

```ts
type SingleChoiceStudentAnswer = {
  responseFormat: 'single_choice';
  selectedOptionIds: [string];
  optionSetVersion: number;
  displayedOptionOrder: string[];
};
```

`displayedOptionOrder` 用于解释当次展示和排查顺序偏差，不用于判断正误。正式判断只使用 `selectedOptionIds + resourceVersionId + optionSetVersion`。

### 8.2 交互状态

学生端至少支持：

```text
未选择
→ 已选择、可提交
→ 正在提交
→ 已提交、正在分析
→ 正式反馈
```

- 未选择时提交按钮不可用，并明确提示“请选择一个答案”；
- 提交中不能同时出现仍可点击的“提交答案”；
- 重复点击、刷新和网络重试必须幂等；
- 提交前刷新应恢复当前选择草稿；
- 提交后刷新应恢复同一个 Initial Response，不允许静默重置；
- 发布版本和选项集合已变化时，当前 Session 继续绑定开始时的 Frozen Version。

### 8.3 反馈后修订边界

第一版 `single_choice` 不开放即时重新选择。原因是正式反馈可能已经暴露判断方向，改选结果不能与首次独立表现等价。

后续若增加反馈后改选，必须遵循：

- Initial Response 不可变；
- Revised Response 独立保存；
- 改选不进入首次独立题目校准；
- 不把看过反馈后的正确选择解释为独立掌握；
- 不增加第二次以上 Revision。

## 九、真实数据与校准

每次有效单选作答至少记录：

- 匿名 Learner、Attempt、Session 和 Round 身份；
- `resourceId / resourceVersionId / taskId`；
- `responseFormat = single_choice`；
- `optionSetVersion`；
- `selectedOptionIds`；
- 当次 `displayedOptionOrder`；
- 正确与否；
- 命中的 `misconceptionCode`；
- 作答时长、提示使用和有效性；
- Prompt、Policy、Rubric 和 Diagnosis 版本。

题目治理层可以观察：

- 有效作答数与正确率；
- 各干扰项选择分布；
- 正确和错误作答时间差异；
- 选项位置分布是否异常；
- 某干扰项是否几乎无人选择；
- 同能力文本题、Retest 和 Transfer 的后续表现。

这些数据只能形成版本化治理信号，不能直接修改 Frozen Resource、Prompt、Rubric 或调度策略。不同 Question Version 或 `optionSetVersion` 的数据不得合并制造稳定结论。

## 十、生成、采用与发布边界

### 10.1 生成

AI 选择 `single_choice` 时必须同时生成题干、完整选项、正确答案、逐项干扰依据、Answer Acceptance、Rubric、能力与难度。禁止先生成题干，再用模板补三个错误选项。

### 10.2 采用

用户仍只执行：

```text
采用并发布
或
不采用并重新优化
```

用户不负责选择正确答案、改写干扰项、填写审核人或确认诊断映射。

#### 10.2.1 生产端评分详情展示

生产工作台可以向录入者展示单选的正确答案与干扰项诊断依据，但必须使用单选专属视图，不得套用文本作答的“完整有效 / 部分完成 / 合理异表述 / 无关回答”答案示例模板：

1. 任务卡片标题必须直接标识作答形式：单选显示为“训练任务 N（单项选择）”，文本题继续显示“训练任务 N”，不得要求录入者展开详情后才判断题型；
2. `optionId` 是持久化身份，页面不得直接显示 `option-1 / option-2` 等内部值；统一显示为当前选项顺序对应的 `A / B / C / D / E` 与完整选项内容；
3. “评分要点”保留 Rubric 名称、说明和可接受信号，但其中引用的 optionId 必须转换成选项标记和内容；
4. “选项判定”分别展示正确答案、每个错误选项对应的典型理解偏差与未作答边界；错误选项不得只显示“错误”；
5. 单选不展示“部分完成”“合理异表述”或“能口头说明”等系统无法从本次结构化选择中观察到的判定；
6. 未选择只表示未形成可判断结果，不形成能力结论；
7. 该信息只属于生产端任务依据与正式资源详情，不进入学生作答前的 Learning 投影。

### 10.3 发布

单选 Candidate 采用后继续进入现有 Revision、Validation、Assessment、发布决定、Freeze、Registry 和 Active Link。任一单选专属质量门禁失败时，必须回到“重新优化题目”，不能要求用户手工修补。

单选发布必须是严格的单任务事务边界：只能改变当前 `trainingTaskId` 对应的 Candidate、Question Revision、Frozen Version 和 Active Link。若单选来自补充计划，原有文本题的已发布状态必须沿稳定任务谱系继承；不得因补充 Plan Revision 或 Candidate 列表刷新把原题重新投影为“可以发布”。发布成功必须以权威快照确认该单选 Active Link 已成立为准，不能只依据 Candidate Adoption 的临时成功结果。

## 十一、兼容性与版本治理

1. 现有 `short_text / long_text` Candidate、Draft、Frozen Version、Attempt 和历史数据保持不变；
2. 现有 `options?: string[]` 只能作为历史兼容输入，不能作为新单选正式写入格式；
3. 新单选正式资源必须使用稳定 option 对象和版本化 choice interaction；
4. Schema 升级必须提供明确版本号和只读兼容 Adapter；
5. 不得批量把现有文本题转换为单选题；
6. 已发布文本题只有生成并采用后继 Candidate 时才允许改变 `responseFormat`；
7. 任何格式变化都必须形成新的 Question Revision 和 Frozen Version；
8. 旧 Learning Session 始终消费其开始时绑定的版本。

## 十二、错误与恢复表达

| 场景 | 学生或生产端表达 | 恢复动作 |
| --- | --- | --- |
| 未选择 | 请选择一个答案 | 选择后提交 |
| 选项集合不完整 | 这道题暂时无法作答 | 切换下一题并记录资源错误 |
| 提交中断 | 你的选择已经保留，请继续提交 | 幂等重试 |
| 分析中断 | 回答已经保留，请重新分析 | 复用同一 Initial Response |
| 答案键缺失或冲突 | 这道题暂时无法完成分析 | 阻断题目并进入资源治理 |
| Candidate 质量不合格 | 当前方案需要重新优化 | 生成新 Candidate |

底层 Schema、Provider 或答案键错误不得直接显示给学生。

## 十三、工程分阶段

### 阶段1：Schema 与领域校验

- 冻结选择交互 Schema、optionId、Student Response 和 Delivery Projection；
- 建立单选 Candidate / Draft / Frozen Version 校验；
- 增加正确答案唯一性、干扰项完整性和学生投影脱敏测试；
- 保证文本题全量回归不变。

执行状态：`ENGINEERING + DEBUG PASS（2026-08-18）`。

已完成稳定 optionId、唯一正确答案、逐项干扰依据、格式化最低响应要求、结构化学生选择、学生投影脱敏，以及 Candidate / Draft / Frozen Version / 内容哈希接入。专项 Debug `21 / 21 PASS`；既有候选、正式资源、发布恢复、资源覆盖和文本题主链回归通过。详细证据见[阅读单选阶段 1 工程与 Debug 验收](../education/phase/reports/reading_single_choice_stage1_engineering_debug_acceptance_2026-08-18.md)。

阶段 1 通过只证明 Schema 和领域底座可用，不代表生成器、生产工作台、Learning、Diagnosis 或真实数据链已经开放 `single_choice`。产品可执行能力仍保持阻断，直至阶段 2–4 全部通过。

### 阶段2：AI 生成与生产工作台

- 训练动作决定 `responseFormat`；
- 生成完整单选 Candidate；
- 增加干扰项质量评估和结构化优化；
- 工作台完整展示题干和选项，但不把内部依据变成人工编辑步骤；
- 采用并发布进入既有正式链。

执行状态：`ENGINEERING + DEBUG PASS（2026-08-18）`。

阶段 2 已完成训练动作驱动的格式决策、完整单选 Candidate 生成、干扰项质量门禁、工作台脱敏展示、重新优化以及既有采用发布链接入。专项 Debug `14 / 14 PASS`，连同关键回归共 `189 / 189 PASS`，Production Build PASS。具体工程边界见[阅读单选阶段 2 工程实施与验收清单](./READING_SINGLE_CHOICE_STAGE2_ENGINEERING_PLAN.md)，执行证据见[阅读单选阶段 2 工程与 Debug 验收](../education/phase/reports/reading_single_choice_stage2_engineering_debug_acceptance_2026-08-18.md)。

阶段 2 通过不代表学生端已经支持单选。Learning、Diagnosis、Attempt 与真实数据仍由阶段 3 实现，正式可执行能力继续保持阻断，直至阶段 3–4 全部通过。

### 阶段3：Learning、Diagnosis 与数据

- Learning 独立单选交互；
- 草稿恢复、幂等提交和版本固定；
- 正确答案与干扰项偏差 Diagnosis；
- 单选与文本任务保持独立 Evidence，并按第 7.4 节形成可追溯的互补观察和冲突处理；
- 五事件、Attempt、校准 Projection 和内部完整性统计支持结构化选择响应；
- 第一版不开放即时改选。

执行状态：`ENGINEERING + DEBUG PASS（2026-08-18）`。

阶段 3 已完成结构化单选 Learning 投影与作答、选择草稿恢复、稳定提交身份、无外部模型依赖的答案键判断、按干扰项语义生成的保守 Diagnosis、独立 Evidence 回流、单选校准 Projection，以及单选/文本四格互补观察与 Training 分流数据边界。第一版单选反馈后不提供立即改选，正确选择只形成当前低输入任务证据，不直接确认能力掌握。

专项 Debug 在阶段 4 最终恢复验收后扩展为 `20 / 20 PASS`，新增文本题与单选题草稿对原正式资源版本的身份锁定；阶段 1 `21 / 21 PASS`、阶段 2 `14 / 14 PASS`、资源覆盖 `22 / 22 PASS`、文本 Task Execution、Learning Persistence、真实数据最小采集 WP3、Question Empirical Calibration 和 Phase 16.3 正式学习主链回归均通过，Production Build PASS。工程清单见[阶段 3 工程实施与验收清单](./READING_SINGLE_CHOICE_STAGE3_ENGINEERING_PLAN.md)，执行证据见[阶段 3 工程与 Debug 验收](../education/phase/reports/reading_single_choice_stage3_engineering_debug_acceptance_2026-08-18.md)。

阶段 3 通过只表示学生作答、诊断、证据和数据链已经具备工程能力。`single_choice` 仍保持正式资源可执行阻断，必须完成阶段 4 的真实端到端联调与试用验收后，才允许修改资源覆盖能力集合并进入产品试用。

### 阶段4：端到端联调与试用验收

- Candidate → Adopt → Revision → Publish → Learning 全链；
- 至少两篇真实材料、每篇一道单选题；
- 至少覆盖正确、各类典型错误、刷新恢复和发布中断；
- 验证学生投影不含答案键；
- 验证文本题、Revision 和现有 Learning 数据无回归；
- 真实试用只观察，不立即扩大题型比例。

执行状态：`ENGINEERING + E2E + CONTROLLED PRODUCT ACCEPTANCE PASS（2026-08-18）`。

阶段 4 使用正式语料库当前版本《狼》与《天上的街市》完成隔离式正式对象链验收，覆盖单选在前与文本在前两种顺序、发布幂等、Frozen / Registry / Active Link、Learning、确定性 Diagnosis、Evidence、互补分流和版本错位阻断。PC 与 768 × 1024 Tablet 受控页面验收确认未选禁用、保存、唯一提交运行态、反馈边界和无横向溢出；最终真实浏览器冒烟进一步验证未提交草稿刷新后严格恢复同一 Frozen Version、同一题目与原草稿，版本不可用时明确阻断且不静默换题。Capability Snapshot 升级为 `phase17_1_product_capability_v2`，门禁已开启。详细结果见[阶段 4 端到端联调与产品验收清单](./READING_SINGLE_CHOICE_STAGE4_E2E_AND_PRODUCT_ACCEPTANCE_PLAN.md)与[阶段 4 验收报告](../education/phase/reports/reading_single_choice_stage4_e2e_product_acceptance_2026-08-18.md)。

2026-08-18 顺序规划工程最终收口：`training_task_sequence_planning_v2` 将进入层身份从位置推断升级为显式的 `preludeCandidateIds`，正式资源保存并恢复 `sequence-strategy / sequence-reason / sequence-rank / sequence-prelude / sequence-prelude-count`。默认 `entry_first` 最多只提前 `1–2` 道合格基础单选；即使题组包含第 `3` 道单选，只要存在文本任务，首个文本任务也必须紧随进入层，其余单选留在后续训练。`holistic_first` 必须确定性把首个文本任务置于本轮新候选首位，不能只依赖 Provider 原始返回顺序；`role_driven` 与 Retest / Transfer 保持时间依赖。Learning 优先级只作用于显式进入层，旧版无标记资源按同材料最多前置 `2` 道的保守兼容规则处理。顺序元数据必须在保存、权威刷新和再次保存后保持不变；补充采用继续追加，不重排已发布任务。执行证据见[单选进入层顺序规划与 Learning 调度验收报告](../education/phase/reports/reading_single_choice_sequence_planning_learning_scheduling_acceptance_2026-08-18.md)。

门禁开启仅表示正式发布的合格单选资源可以被 Learning 消费，不表示真实教育效果已经成立。后续仍需按 Resource Version 与 Option Set Version 分组采集真实 Attempt，并用文本互补任务、Retest 或 Transfer 校准解释边界。

## 十四、最低验收标准

### 14.1 生产端

1. 单选题作为独立 QuestionCandidate 出现，不嵌入文本题；
2. `responseFormat` 是唯一交互事实来源；
3. 正确答案唯一，所有错误选项都有独立可解释依据；
4. Candidate 失败只提供重新优化，不增加人工编辑步骤；
5. 采用后完整进入现有发布链；
6. 未采用 Candidate 不改变正式资源；
7. 单选题顺序由 Plan 决定，不强制排第一；
8. 不适合单选的训练动作不会因题型配额被强制转换。
9. 在“3 道已发布文本题 + 2 道补充任务”的场景中，采用补充方案后仍为已发布 3 道；发布其中的单选题后精确变为已发布 4 道，其他四张卡片状态不变。
10. Candidate 后台恢复不得把同材料所有任务同时标记为“可以发布”；已发布状态永远优先于 Candidate 可用状态。
11. 单选进入语义质量检查时，`evidenceRefs` 可以引用已声明字段、字段摘录及其合法子字段/数组路径，例如 `draft.choiceInteraction.correctOptionIds`、`draft.options[0]`；系统仍须拒绝不属于材料或题目快照的越界引用，不得因路径语法过严误阻断合法发布。
12. 生产端单选评分详情不出现裸 `optionId`、文本题校准分类或不可观察的口头补充行为；正确项与各干扰项均按选项标记、选项内容及诊断含义展示，文本题原展示保持不变。
13. 生产端任务列表中，单选卡片标题明确显示“训练任务 N（单项选择）”，文本题标题保持“训练任务 N”，刷新及状态恢复后题型标识不丢失。
14. `5–6` 道常规任务默认目标为 `2` 道单选，只有独立观察、干扰项质量、任务容量和文本覆盖均充分时增加到 `3` 道；目标未达到但存在合法原因时不得误判整组失败。
15. 补充单选数严格取目标缺口、剩余容量和合格独立观察数的最小值；采用后当前有效任务总数不得超过 `6`。
16. 当前已有 `0 / 1 / 2 / 3` 道单选时分别执行第 3.3.3 节的补充策略，不得重复生成同一观察，也不得在已有 `3` 道时继续按数量增加。
17. 多道单选必须在观察对象、证据范围或认知动作上形成实质差异；只改写同一事实定位不能计作不同单选覆盖。
18. 目标不足原因以结构化治理结果保存，不新增人工填写、审核或确认入口；总容量、单选上限、去重、干扰项质量和必要文本观察仍作为硬门禁。
19. 默认进入层必须显式标记具体 Resource Version，不能仅凭 `single_choice` 或列表位置推断；同组第 `3` 道及后续单选不得继续享受进入层优先级。
20. `holistic_first` 必须保证至少一个可用文本任务先于单选投放；Retest / Transfer 继续服从任务角色和时间依赖，不复用常规 Training 进入层排序。
21. 顺序策略、原因、序号、进入层身份和进入层数量在 Observation Plan 保存、权威刷新、页面恢复及后续 Revision 中不得丢失。

### 14.2 Learning 端

1. 学生只看到题干和选项，不得到答案键或内部干扰依据；
2. 未选择不能提交；
3. 提交中只有一个运行态，不同时保留可点击提交按钮；
4. 刷新和重试不重复创建 Attempt；
5. 提交后能够按错误选项产生具体 Diagnosis；
6. 单次选对不直接投影为能力掌握；
7. 第一版不出现立即改选入口；
8. 旧 Session 和历史文本题行为不变。
9. 互补任务保持独立 Attempt / Diagnosis，联合解释能区分前置理解缺口、文本组织缺口和证据冲突。

### 14.3 数据端

1. 稳定记录 optionId、optionSetVersion 和显示顺序；
2. 不以显示字母作为持久化答案；
3. 不同 Question Version 数据不混合；
4. 干扰项分布和时长只作为治理信号；
5. 模拟样本不得冒充真实 Learning 证据。
6. 跨格式互补观察保留来源 Task、Attempt、Question Version 和独立 Evidence 引用，不落成不可追溯的合并分数。

## 十五、冻结结论

第一版正式定义为：

> 单项选择是阅读训练任务组中的一种独立作答格式，用于低输入成本的基础能力观察和可解释诊断。数量采用“目标区间 + 质量约束”：常规 `5–6` 道任务默认目标为 `2` 道，条件充分时最多 `3` 道，但不能把该目标机械化为题型配额。是否采用单选以及任务顺序仍由训练动作和 Observation Plan 决定；每个错误选项必须对应一种可解释偏差。学生选择通过稳定 optionId 保存，并绑定 Question Version 与选项集合版本。单选题继续使用现有 Candidate → Adopt → Revision → Publish → Learning 主链，不构成独立模块，不替代高阶文本作答，也不因一次选对直接证明能力掌握。宁可少一道单选，也不得为满足数量目标生成低诊断价值的选择题。
