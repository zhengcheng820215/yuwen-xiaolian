# 针对性短片段微训练材料与调度契约

英文名称：Targeted Micro-training Material and Scheduling Contract

状态：STAGES 1–4 ENGINEERING PASS / REAL EFFECT PENDING

文档版本：`targeted_micro_training_material_scheduling_v1.1`

更新日期：2026-08-21

## 一、问题与目标

当前正式阅读材料以完整初中课文为主。每篇课文的核心题组通常包含 `5–6` 道任务，足以支持一次课文理解训练，但单篇材料无法无限增加互不重复的高质量观察点，也不能仅凭一次题组完成证明能力已经提升。

本契约解决的问题不是“如何给每篇课文增加更多题”，而是：

> 当正式反馈已经确认一个具体、可训练的理解缺口时，如何用一个低负担、不同证据情境的短片段任务增加针对性训练密度，并在完成后返回原有核心学习节奏。

目标链路为：

```text
核心课文任务
-> 正式反馈确认唯一主要缺口
-> 匹配 1 道针对性短片段微训练
-> 形成独立 Attempt / Diagnosis / Evidence
-> 返回核心题组
-> 后续通过迁移或延迟复测验证
```

本能力不以题量增长为成功标准。它的成功标准是：在不重复同一题、不拉长无效练习、不破坏首次独立表现的前提下，为已确认缺口增加一次有明确训练动作的观察。

## 二、总原则

1. **训练密度不等于文章数量。** 完整课文负责核心理解，短片段负责单一缺口的低负担练习。
2. **缺口触发，不做固定加题。** 没有正式缺口时，不因“题量不足”自动插题。
3. **一次只处理一个缺口。** 微训练不得同时承担多个高阶能力目标。
4. **不修改核心题组。** 已发布题目、Frozen Resource、题组顺序和已消费历史保持不变。
5. **不形成练习死循环。** 同一核心题最多触发一次，单次 Session 最多两次；微训练未完成时不继续即时追加同类题。
6. **训练完成不等于能力掌握。** 微训练只形成训练阶段证据，能力保持与迁移仍由正式 Retest / Transfer 验证。
7. **继续复用现有生产主链。** 短片段及其题目仍执行 Material → Observation Plan → Candidate → Adopt → Revision → Publish。

### 2.1 三层训练结构

产品中的阅读训练按三个层次分工：

```text
第一层：核心阅读
完整课文 + 核心题组
-> 负责完整理解与首次能力观察

第二层：即时针对训练
Targeted Excerpt + 单一微训练任务
-> 负责对已确认的具体缺口增加一次练习密度

第三层：后续验证
Retest / Transfer
-> 负责判断相关能力动作能否独立保持与跨情境迁移
```

三个层次不能互相替代。核心阅读不能因为已有微训练而缩减为碎片练习；微训练不能因为即时答对而承担长期验证；Retest / Transfer 不能被同一 Session 内的追加题冒充。

单项选择可以自然存在于三个层次，但职责不同：

- 核心题组中的单选：作为基础理解入口；
- 微训练中的单选：用于低负担纠偏、对象辨认或典型误读辨析；
- Retest / Transfer 中的单选：只在训练动作适配时观察学生是否能够独立保持相关判断。

单选仍然是一种 `responseFormat`，不是独立训练层，也不能替代解释、证据组织、推理和表达等文本任务。

## 三、材料用途与身份

### 3.1 Material 用途

Material 增加用途语义，但不建立第二套材料 Repository：

```ts
type MaterialUsageType =
  | 'core_reading'
  | 'targeted_excerpt';
```

工程字段挂载在既有 `QuestionMaterialVersion` 上，保持可选以兼容历史版本：

```ts
type QuestionMaterialVersionTargetedUsage = {
  usageType?: MaterialUsageType;
  contentHash?: string;
  contentNormalizationPolicyVersion?: 'material_content_normalization_v1';
  targetedExcerptMetadata?: TargetedExcerptMetadata;
};
```

只有 `targeted_excerpt` 强制要求独立 `contentHash`、`contentNormalizationPolicyVersion` 和完整 `targetedExcerptMetadata`；历史记录缺少用途与哈希策略字段时，只在读取与校验边界投影为 `core_reading`，不得静默回写。

- `core_reading`：完整课文或完整阅读材料，承担核心理解、综合分析和跨能力观察；
- `targeted_excerpt`：第一版推荐使用 `100–300` 字的独立短片段，只承担一个明确的训练动作。

`100–300` 字是内容生产建议，不是 Schema 门禁或发布硬条件。文言文可能用 `60–100` 字已经形成完整证据情境，叙事片段也可能需要约 `350` 字才能保留必要因果关系。材料完整性、证据充分性和训练动作适配性高于机械字数；过短导致无法判断、过长重新形成完整课文负担时，仍应由质量门禁阻断。

历史 Material 缺少该字段时一律按 `core_reading` 解释，不回写旧版本，不改变现有 12 篇材料及 61 道题的身份。

### 3.2 短片段训练元数据

```ts
type TargetedExcerptMetadata = {
  targetAbilityIds: string[];
  supportedGapReasonCodes: TargetedGapReasonCode[];
  sourceRelation:
    | 'same_material_excerpt'
    | 'authorized_external_excerpt'
    | 'controlled_original';
  parentMaterialId?: string;
  sourceAnchor?: {
    paragraphStart?: number;
    paragraphEnd?: number;
    contentHash: string;
  };
  intendedTaskCount: 1 | 2;
};
```

`targeted_excerpt` 必须具有独立 `materialId / materialVersionId / contentHash`。从既有课文抽取时必须保留 `parentMaterialId` 和 Anchor；外部片段必须保留来源与合法使用说明；受控原创片段必须明确标识为原创训练材料，不得冒充教材或作者原文。

### 3.2.1 正式版本完整性与内容规范化

`usageType = targeted_excerpt` 时，`contentHash / contentNormalizationPolicyVersion / targetAbilityIds / supportedGapReasonCodes / sourceRelation / intendedTaskCount` 构成正式 Material Version 的完整性硬门禁。任何字段缺失、为空或非法时，只能停留在临时输入态，不得进入 Material Repository、Observation Plan 或正式发布链；`same_material_excerpt` 还必须具有合法 `parentMaterialId + sourceAnchor`。

第一版 `contentNormalizationPolicyVersion = material_content_normalization_v1`。规范化只处理 BOM、Unicode NFC、换行和空白等明确输入噪声，并保留段落结构及未列入显式等价表的标点。不得通过删除全部标点制造“相同正文”。策略升级必须形成新版本，旧 Material 的哈希不回算。完整算法和跨版本边界见阶段 2 工程清单。

`same_material_excerpt` 不是默认捷径。系统默认优先使用不同材料或不同证据情境，使学生需要重新执行能力动作，而不是回忆刚才答案。只有训练目标确实需要重新聚焦同篇课文中的局部证据，并同时满足以下条件时才允许使用：

- Source Anchor 与触发任务的证据范围不同；
- 不重复触发任务的观察对象、证据范围和评分目标；
- 不包含能够直接暴露原题答案的内容；
- 学生仍需重新定位、辨认、连接或解释，而不是换个问法复述；
- 使用同篇片段比外部片段更能保持训练动作的准确性。

无法满足时必须继续优先匹配不同证据情境；没有合格资源时不补练。

### 3.3 Frozen Quality Trace 与 Learning 可消费性

`targeted_excerpt` 的 Frozen Resource、Registry Head 和 Observation Link 完整，不等于已经可以进入 Learning。每个当前 Frozen Resource Version 还必须具有与自身身份一致、来源工件完整的 `FrozenQuestionQualityTrace`：

```text
Draft + Validation + Deterministic Assessment
+ Semantic Assessment + Assessment Bundle + Human Review
→ Frozen Question Quality Trace
→ Learning Consumable
```

缺少冻结质量轨迹时：

- Resource Version、Registry 和 Observation Link 继续保持原身份，不得重建或覆盖；
- 该题不得进入正式 Learning 匹配结果；
- 系统必须报告 `frozen_quality_trace_missing`；
- 不得因为 Trace 缺失又把同一问题重复解释为结构身份错位；只有 Material、Plan、Task Lineage、Link、Registry、Version 或已经存在的 Trace 真实不一致时，才报告 `learning_identity_mismatch`。

历史补齐只能根据已经存在且身份对齐的 Draft、Validation、Review、Material 和 Frozen Version 重建质量工件。任何来源缺失、校验未通过或身份冲突都必须停止，不得伪造通过结论。补齐操作必须满足：

- 只追加缺失的 Deterministic Assessment、Semantic Assessment、Assessment Bundle 和 Frozen Quality Trace；
- 不修改题干、Rubric、作答格式、能力标签、Frozen Version、Registry Head、Observation Link 或 Learning 历史；
- 同一 Repair Command 可重复执行且不产生重复工件；
- 四类质量集合在同一共享资源 Revision 中原子提交；
- 修复后重新执行正式资源基线，目标为当前任务、Frozen Version、Quality Trace 与 `learningConsumable` 数量一致。

本轮 18 道受控微训练题的具体修复范围、Debug 和回滚边界见[针对性微训练冻结质量轨迹一致性修复计划](./TARGETED_MICRO_TRAINING_QUALITY_TRACE_CONSISTENCY_REPAIR_PLAN.md)。

### 3.4 支持的首批缺口

第一版只支持可直接映射到单一训练动作的高频缺口：

```ts
type TargetedGapReasonCode =
  | 'missing_text_evidence'
  | 'missing_reasoning_relation'
  | 'conclusion_inconsistent'
  | 'incomplete_task_requirement';
```

`insufficient_to_judge` 不得直接触发微训练。系统应先让学生形成有效回答，使 Diagnosis 能够建立。

第一版不得继续扩展为 `theme_understanding_weak / character_analysis_weak / expression_weak` 等宏观能力标签。这些标签无法在一次短任务中重新执行并验证一个明确动作，容易把微训练退化为泛化加题。新增 Gap 必须先证明它能够被转换为一个具体、单一、可观察且可在短片段中完成的学生动作，并通过独立契约评审后再进入 Schema。

单项选择的错误结果只有在稳定 `optionId` 已映射到正式干扰项偏差，并且该偏差能够安全映射为上述训练动作时，才允许触发；不能仅凭“选错”安排补练。

## 四、资源生产规则

### 4.1 继续使用现有生产链

```text
Targeted Excerpt Material Version
-> Observation Plan Revision
-> Training Task
-> Question Candidate
-> 人工采用或重新优化
-> Question Revision / Validation / Assessment
-> Frozen Resource Version
-> Registry / Active Link
```

人工职责仍只有“采用”或“不采用并重新优化”。不得为短片段增加手工改题、独立审核表单或第二套发布按钮。

### 4.2 每份短片段的题目边界

- 每份短片段规划 `1–2` 道 Training Task；
- 一道任务只对应一个主 Ability、一个主要缺口类别和一个可观察动作；
- 允许 `single_choice / short_text / long_text`，由训练动作决定，不按题型配额分配；
- 以基础辨认或局部判断为目标时优先单选或短文本；
- 以“证据为什么支持结论”为目标时优先短文本；
- 不以一个短片段同时训练主题、人物、结构、手法和表达。

### 4.3 去重与质量门禁

微训练与触发它的核心任务不得同时重复：

- 同一观察对象；
- 同一证据范围；
- 同一评分目标。

至少有一项关键情境发生变化，并且新的任务确实需要学生重新执行能力动作，而不是回忆刚才答案。

默认优先使用不同材料或不同证据情境。`same_material_excerpt` 仅在需要重新聚焦局部证据且不存在答案泄露时使用；即使题干不同，只要学生可以直接复用刚才的对象、原句和结论，也应判定为低价值重复。

单选继续遵守逐项干扰依据、唯一答案键和答案隔离规则。错误选项必须对应可解释误读，不得用明显错误选项凑数。

### 4.4 首批资源包建议

首批不建设大规模新题库，先建立四类共约 `12` 份短片段：

| 缺口方向 | 片段建议数 | 每片段任务数 | 主要训练动作 |
| --- | ---: | ---: | --- |
| 信息与证据定位 | 3 | 1–2 | 找到限定范围、对象和直接证据 |
| 局部含义理解 | 3 | 1–2 | 区分字面信息、对象关系和局部含义 |
| 证据—结论连接 | 3 | 1–2 | 说明某处事实为什么支持已有判断 |
| 简单因果与关系判断 | 3 | 1–2 | 区分直接原因、表面相关和过度推断 |

首批总量约 `18–24` 道正式题。数量只是建设范围，不构成发布质量豁免。

首批资源包同时执行 Gap 覆盖门禁：四类 Gap 各至少具有 `3` 个不同活动短片段和 `3` 个可执行当前正式资源。Candidate、Draft、非当前 Frozen Version、非 Active Link、来源未通过或实质重复资源不计入；一个正式题只按其结构化 `primaryGapReasonCode` 计入一次。验收必须输出 `Gap × Ability` 覆盖矩阵，允许第一版存在明确空白格，但不得用近似 Ability 或其他 Gap 资源冒充可匹配库存。

首批约 `12` 份短片段进入真实 Learning 前，不继续扩展为几十或上百份。资源是否扩容必须依据 Trigger Rate、Match Rate、学生完成意愿、核心题组返回率和后续独立任务中的同类缺口复现情况决定，而不是依据库存数量决定。

## 五、触发与匹配契约

### 5.1 必要触发事实

只有同时满足以下条件才创建微训练请求：

1. 当前核心任务已经形成正式 Persistence Result；
2. 当前反馈存在唯一 `primaryGapRequirementId`；
3. `gapReasonCode` 属于第一版支持范围；
4. Student Response 有效，身份、任务、材料版本和 Diagnosis 对齐；
5. 当前 Session 尚未达到微训练上限；
6. 同一来源 Attempt 尚未创建或完成同类微训练；
7. Registry 中存在 Ability、Gap、TaskRole 和来源边界均匹配的正式资源。

### 5.2 微训练请求

```ts
type TargetedMicroTrainingRequest = {
  requestId: string;
  studentId: string;
  learningSessionId: string;
  sourceLearningRoundId: string;
  sourceAttemptId: string;
  abilityId: string;
  gapReasonCode: TargetedGapReasonCode;
  taskRole: 'training';
  materialRelationPolicy:
    | 'prefer_new_context'
    | 'allow_same_material_distinct_anchor';
  excludedSourceAnchors: Array<{
    materialId: string;
    paragraphStart?: number;
    paragraphEnd?: number;
    contentHash: string;
  }>;
  excludedResourceVersionIds: string[];
  maxTaskCount: 1;
  createdAt: string;
};
```

第一版不新增 `targeted_training` TaskRole。正式资源仍使用 `training`，针对性用途由请求和 Assignment 表达，避免破坏既有 Training / Retest / Transfer 链。

`prefer_new_context` 是默认策略。它不是绝对排除当前 `materialId`，而是优先选择不同材料；当前材料只有存在明确不同的 Source Anchor、重新执行价值和无答案泄露时，才可在无更优外部情境的情况下进入候选。`excludedSourceAnchors` 是硬边界，匹配器不得返回与触发任务相同或高度重叠的证据范围。

### 5.3 匹配优先级

匹配顺序为：

```text
Ability 对齐
-> Gap Reason 支持
-> Training Role 对齐
-> 默认优先不同材料或不同证据情境
-> 同篇材料时 Source Anchor 明确不同且无答案泄露
-> 不重复当前 Resource / Source Anchor
-> 证据范围和认知动作具有实际差异
-> 难度与提示强度适配
-> 当前 Registry Version 可执行
```

不能因为缺少精确资源而用近似 Ability、错误 Gap 或 Retest / Transfer 资源凑题。没有合格匹配时记录 `no_match`，Learning 继续原核心题组，不阻断 Session，也不向学生显示错误提示。

## 六、Session 调度与恢复

### 6.1 不重写核心队列

现有 Session Task Queue 保持不可变。动态微训练以追加式 Assignment 叠加：

```ts
type TargetedMicroTrainingAssignment = {
  assignmentId: string;
  requestId: string;
  sourceLearningRoundId: string;
  resourceVersionId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'unavailable';
  returnToCoreTaskNumber: number;
};
```

Assignment 不插入、不重排、不覆盖核心 `resourceVersionIds`。调度器完成当前核心题后，若存在一个合格 Pending Assignment，则优先进入该微训练；完成或跳过后回到 `returnToCoreTaskNumber`。

### 6.2 题量与止损

- 同一核心题最多触发 `1` 道微训练；
- 同一 Session 最多完成 `2` 道微训练；
- 微训练自身不得立即再触发新的微训练；
- 微训练答对或充分达标后停止即时补练；
- 微训练仍未达标时只记录结果，不在当前 Session 连续追加同类题；
- 后续是否 Retest / Transfer 由既有 Strategy 决定；
- Session 总任务上限为“核心题组 + 2”，通常为 `5–8` 道。

### 6.3 幂等与失败恢复

`studentId + sourceAttemptId + gapReasonCode` 构成首批幂等语义。同一正式结果在刷新、重复提交、跨标签恢复或服务重试时不得生成多个 Assignment。

恢复时必须同时恢复：

- 核心队列游标；
- 当前 Assignment；
- 微训练 Attempt；
- `returnToCoreTaskNumber`；
- 已使用的 Session 微训练数量。

微训练资源失效、停用或读取失败时，将 Assignment 标记为 `unavailable` 并返回核心队列；不得清空已完成核心题结果，也不得把 Session 卡死在“继续 / 返回”循环。

## 七、Learning 交互

### 7.1 学生可感知结构

核心题组进度保持稳定，例如“第 3 / 5 题”。微训练不把核心进度突然改成“第 3 / 6 题”，而使用独立轻量标识：

```text
针对性练习
先用一小段文字练习如何把依据和判断连起来。
```

完成后主操作为：

```text
继续第 4 题
```

### 7.2 说明边界

微训练属于真实动态调度，可以展示一句具体的过渡说明，但必须：

- 面向学生描述训练动作，不显示 Gap Reason、Diagnosis、Evidence 或 Strategy 术语；
- 不宣称学生能力差或已经提升；
- 不泄露当前题或微训练答案；
- 不使用“补充目前还不充分的信息”等含糊模板；
- 无法形成准确具体说明时，只显示“针对性练习”，不强造原因。

## 八、证据与能力边界

微训练必须形成独立：

- Question Presentation；
- Submission Intent；
- Learning Task Attempt；
- Student Response；
- Diagnosis；
- Ability Evidence；
- Calibration Projection。

它不得覆盖触发它的首次独立表现，也不得被计为原核心题的 Revision。

微训练 Evidence 必须保留：

- `sourceAttemptId`；
- `assignmentId`；
- `gapReasonCode`；
- Material / Resource Version；
- 提示依赖；
- 独立性和任务新颖度。

一次微训练完成只说明“在该短片段和当前支持条件下完成了训练动作”。能力提升、保持或迁移仍需后续无即时支架的 Retest / Transfer 和 Evaluation。

## 九、观察指标

首批真实使用只观察，不用单一正确率自动改变产品策略：

| 指标 | 用途 |
| --- | --- |
| Trigger Rate | 有多少正式缺口满足触发条件 |
| Match Rate | 是否有足够准确的短片段资源 |
| Completion Rate | 插入后学生是否愿意完成 |
| Immediate Resolution | 微训练中对应要求是否完成 |
| Core Return Rate | 是否顺利回到原题组 |
| Same-gap Recurrence | 后续材料是否仍出现同类缺口 |
| Transfer / Retest Result | 方法能否在新情境或延迟后保持 |
| Session Length / Exit Rate | 追加训练是否造成明显疲劳或退出 |

`Immediate Resolution` 只表示学生在当前短片段与当前支持条件下完成了相关动作，不能作为缺口已经减少的证据。`Same-gap Recurrence` 必须来自后续独立核心题、Retest 或 Transfer；同一 Session 内刚完成的微训练不得用来为自身效果作证。

产品价值判断优先看“后续独立任务中的同类缺口复现率是否下降、迁移是否改善、Session 是否仍可完成”，而不是把微训练即时答对率解释为能力提升。

## 十、明确不做

第一版不做：

- 给所有学生、所有课文固定增加题量；
- 在第一批真实数据形成前把约 12 份片段扩展成大规模题库；
- 在核心题组中无限插题；
- 微训练失败后连续追问直到答对；
- 用同一句、同一证据、同一评分目标换皮重复；
- 自动改写或替换已发布题目；
- AI 直接生成并绕过采用发布；
- 把训练完成计为 Retest、Transfer 或能力掌握；
- 新建第二套题库、发布链、Diagnosis 或 Learning 页面；
- 用来源不明或未经授权的外部文本扩大材料池。

## 十一、分阶段工程计划

### 阶段 1：Schema 与迁移边界

- 增加 `MaterialUsageType` 和 `TargetedExcerptMetadata`；
- 历史材料默认 `core_reading`；
- 增加请求与 Assignment Schema、结构校验和幂等身份；
- 不接入正式 Learning 调度。

验收：旧 12 篇材料、61 道题、Registry 和 Learning 消费零回归。

### 阶段 2：生产工作台与首批资源

- 工作台可区分“核心材料 / 针对性短片段”；
- 复用现有 AI 规划、Candidate、采用发布和质量门禁；
- 建立首批约 `12` 份片段、`18–24` 道题；
- 完成来源、去重、Gap 支持和题型质量审查。

验收：所有片段均有合法来源、明确训练动作和可执行 Frozen Version。

阶段 2 的工程顺序、工作台交互、首批资源包、来源门禁、Debug 矩阵、浏览器路径和回归范围，冻结在[阶段 2：生产工作台与首批资源工程实施及验收清单](./TARGETED_MICRO_TRAINING_STAGE2_PRODUCTION_ENGINEERING_PLAN.md)。阶段 2 已完成隔离资源生产链和专项验收；当前用户正式资源快照不迁移，Learning 条件调度仍属于阶段 3。

### 阶段 3：Learning 条件调度

- 从正式主要缺口创建幂等 Request；
- 匹配精确资源并创建追加式 Assignment；
- 完成“核心题 → 微训练 → 返回核心题”的恢复链；
- 无匹配、资源失效和刷新时安全继续核心题组。

验收：不会重排核心题组、不会重复 Assignment、不会形成循环或空白页。

阶段 3 的触发事实、与反馈后修订互斥、确定性资源匹配、原子 Request / Assignment、追加式 Session Overlay、末题返回游标、失败恢复、专项 Debug 和浏览器验收，冻结在[阶段 3：Learning 条件调度工程实施与验收清单](./TARGETED_MICRO_TRAINING_STAGE3_LEARNING_SCHEDULING_ENGINEERING_PLAN.md)。当前已完成工程与 `57 / 57` 自动化 Debug，并通过默认关闭及无匹配浏览器安全冒烟；完整 targeted Assignment 浏览器联调仍需在受控导入资源后完成。

### 阶段 4：端到端与真实校准

- 覆盖四类缺口、文本题和单选题触发；
- 验证首次表现、微训练 Attempt、Evidence 与核心队列完全分离；
- 验证 Session 上限、退出恢复和跨标签幂等；
- 收集真实 Trigger、Match、Completion、Return 和 Recurrence 数据。

验收：工程链路通过后仍只标记 `ENGINEERING PASS / REAL EFFECT PENDING`，至少完成一轮真实学生使用后再调整触发阈值和资源密度。

首轮真实效果判断至少回答三个问题：

1. 系统是否只在正式、具体且适合一次微训练的缺口上触发；
2. 学生是否愿意完成微训练并顺利返回核心题组；
3. 后续独立核心题、Retest 或 Transfer 中的同类缺口是否减少。

阶段 4 的受控资源导入、启用状态、事件 Ledger / Outbox、Episode 与 Follow-up 身份、指标分母、观察周期、暂停回滚和允许结论，冻结在[阶段 4：受控启用与真实校准契约](./TARGETED_MICRO_TRAINING_STAGE4_CONTROLLED_CALIBRATION_CONTRACT.md)。具体工作包、48 项专项 Debug、16 条浏览器路径、验收报告模板和完成状态见[阶段 4：工程实施与验收清单](./TARGETED_MICRO_TRAINING_STAGE4_ENGINEERING_AND_ACCEPTANCE_PLAN.md)。阶段 4 工程与 `48 / 48` 自动化 Debug 已完成；本地受控资源包已验证为 `12 / 12` Material、`18 / 18` Frozen Resource、`18 / 18` Active Registry，默认启用状态仍为关闭。完整受控浏览器矩阵和真实学生校准尚未完成。

## 十二、工程放行条件

进入阶段 1 前必须确认：

1. 本契约与 Training Model、Material Version、Formal Resource、Learning Session 和 Evidence 边界一致；
2. 第一版支持的四类 Gap 已有稳定结构化原因码；
3. 不新增人工步骤，不改变“采用或重新优化”原则；
4. 不修改或迁移现有正式题目；
5. 微训练资源缺失时核心学习仍可完成；
6. 每阶段都有独立 Debug、整体回归和浏览器验收计划。

## 十三、相关文档

- [训练模型](../education/TRAINING_MODEL.md)
- [学习缺口模型](../education/LEARNING_GAP_MODEL.md)
- [正式资源生产契约地图](./FORMAL_RESOURCE_PRODUCTION_CONTRACT_MAP.md)
- [AI 题目生成质量与定向优化契约](./AI_QUESTION_GENERATION_QUALITY_AND_TARGETED_OPTIMIZATION_CONTRACT.md)
- [阅读训练单项选择作答契约](./READING_SINGLE_CHOICE_RESPONSE_FORMAT_CONTRACT.md)
- [学生学习叙事校准](./STUDENT_LEARNING_NARRATIVE_CALIBRATION.md)
- [真实 Learning 数据采集与观察契约](./REAL_LEARNING_DATA_COLLECTION_AND_OBSERVATION_CONTRACT.md)
- [阶段 2：生产工作台与首批资源工程实施及验收清单](./TARGETED_MICRO_TRAINING_STAGE2_PRODUCTION_ENGINEERING_PLAN.md)
- [阶段 2 工程与 Debug 验收](../education/phase/reports/targeted_micro_training_stage2_engineering_debug_acceptance_2026-08-20.md)
- [阶段 3：Learning 条件调度工程实施与验收清单](./TARGETED_MICRO_TRAINING_STAGE3_LEARNING_SCHEDULING_ENGINEERING_PLAN.md)
- [阶段 3 工程与 Debug 验收](../education/phase/reports/targeted_micro_training_stage3_engineering_debug_acceptance_2026-08-20.md)
- [阶段 4：受控启用与真实校准契约](./TARGETED_MICRO_TRAINING_STAGE4_CONTROLLED_CALIBRATION_CONTRACT.md)
- [阶段 4：工程实施与验收清单](./TARGETED_MICRO_TRAINING_STAGE4_ENGINEERING_AND_ACCEPTANCE_PLAN.md)

## 十四、增补记录

2026-08-21 质量轨迹边界与数据收口：明确 Frozen Resource、Registry 与 Observation Link 之外，当前正式微训练题还必须具有身份一致的 Frozen Quality Trace 才能进入 Learning。Trace 缺失与结构身份错位分开计数；已从完整既有审核证据为 18 道受控微训练题原子补齐质量工件，Shared Store `1957 → 1958`，当前正式任务 / Trace / Learning Consumable 达到 `79 / 79 / 79`，重复执行 no-op，未重建题目或切换正式版本。

2026-08-20 设计增补：将 `100–300` 字明确为推荐区间而非结构门禁；默认优先不同证据情境，`same_material_excerpt` 只在不同 Anchor、重新执行价值和无答案泄露同时成立时使用；请求从粗粒度排除整个 Material 调整为 `materialRelationPolicy + excludedSourceAnchors`；第一版 Gap 固定为四类具体动作缺口，不接纳宏观能力弱项；补充三层训练结构、单选分层职责和后续独立任务效果口径，并冻结首批约 12 份片段在真实数据形成前不继续扩容。

2026-08-20 阶段 1 工程收口：完成 Material 用途兼容投影、短片段元数据、四类 Gap、Request / Assignment、Source Anchor、确定性幂等身份和三类正式资源 Repository 写入校验。历史 Material 不迁移、不回写，工作台、资源匹配和 Learning 动态调度尚未接入；专项 Debug `16 / 16`、正式资源与 Learning 回归、当前 `12` 个活动 Material Version / `61` 个活动 Registry 快照校验和生产构建均通过。详见[阶段 1 工程与 Debug 验收](../education/phase/reports/targeted_micro_training_stage1_engineering_debug_acceptance_2026-08-20.md)。

2026-08-20 阶段 2 工程收口：完成 Material 创建/修订、工作台用途展示、AI 规划、Candidate、Frozen Version、Registry 与 Observation Link 的专项身份贯通；建立 `12` 份受控短片段、`18` 道隔离验收资源，四类 Gap 均达到最小覆盖；专项 Debug `32 / 32`、正式资源回归、Learning 固定队列回归和生产构建通过。当前正式 12 篇核心材料、61 道活动题目未迁移，阶段 3 Learning 条件调度尚未开始。

2026-08-20 阶段 3 工程收口：完成正式触发适配、确定性精确匹配、Request / Assignment 原子幂等、核心队列不可变的 Session Overlay、Learning 接入和学生过渡交互；专项 Debug `57 / 57`、关键回归与生产构建通过，默认关闭和无匹配浏览器安全冒烟通过。受控资源尚未导入，完整 targeted Assignment 浏览器路径仍待阶段 4 前半段验收。

2026-08-20 阶段 4 工程收口：完成 Pack Manifest、幂等导入与回滚、四态启用、事件 Ledger / Outbox、Calibration Episode、独立 Follow-up、指标分母与内部控制台；专项 Debug `48 / 48`、阶段 1—3 与关键 Learning 回归、生产构建均通过。本地受控资源包完整性为 `12 / 12` Material、`18 / 18` Frozen Resource、`18 / 18` Active Registry，且保持 `disabled`。完整 `B4-01—B4-16` 浏览器矩阵和 5—7 日真实观察仍待执行，详见[阶段 4 工程与 Debug 验收](../education/phase/reports/targeted_micro_training_stage4_engineering_debug_acceptance_2026-08-20.md)。
