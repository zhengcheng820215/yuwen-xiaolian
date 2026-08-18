# 阅读训练单项选择作答契约

英文名称：Reading Single-Choice Response Format Contract

状态：`DESIGN ACCEPTED / STAGES 1–4 PASS / CAPABILITY GATE OPEN`

文档版本：`reading_single_choice_response_format_v1.5`

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
- 不要求每篇材料固定包含选择题；
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

### 3.3 不设置题型配额

系统不得规定“每篇必须有一道选择题”或“选择题必须占固定比例”。生成器只能在训练动作适合时提出单选 Candidate；材料不支持有价值干扰项时，应继续使用文本格式。

## 四、任务顺序规则

推荐按低输入负荷到高输入负荷组织同篇任务，但不得冻结“选择题一定排第一”。实际顺序由当前 Observation Plan 的教学意图、任务依赖和稳定任务序列决定。

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

### 10.3 发布

单选 Candidate 采用后继续进入现有 Revision、Validation、Assessment、发布决定、Freeze、Registry 和 Active Link。任一单选专属质量门禁失败时，必须回到“重新优化题目”，不能要求用户手工修补。

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

> 单项选择是阅读训练任务组中的一种独立作答格式，用于低输入成本的基础能力观察和可解释诊断。是否采用单选以及任务顺序由训练动作和 Observation Plan 决定，不按题型配额机械分配。每个错误选项必须对应一种可解释偏差；学生选择通过稳定 optionId 保存，并绑定 Question Version 与选项集合版本。单选题继续使用现有 Candidate → Adopt → Revision → Publish → Learning 主链，不构成独立模块，不替代高阶文本作答，也不因一次选对直接证明能力掌握。
