# 针对性短片段微训练阶段 2：生产工作台与首批资源工程实施及验收清单

状态：`ENGINEERING + DEBUG PASS / LEARNING SCHEDULING NOT STARTED`

版本：`targeted_micro_training_stage2_production_engineering_v1.1`

日期：`2026-08-20`

## 零、执行结论

阶段 2 已完成工程实现与 Debug 验收：Material 创建、修订、Observation Plan、Candidate、Frozen Version、Registry 和 Resource Observation Link 均可保留针对性短片段身份；受控首批资源包在隔离验收链中形成 `12` 份短片段、`18` 道正式资源，四类 Gap 各覆盖 `3` 份独立材料与至少 `3` 道可执行资源；专项 Debug `32 / 32 PASS`。

当前用户正式资源快照中的 `12` 篇核心材料、`61` 道活动题目未被迁移或改写。阶段 3 的 Diagnosis 触发、资源匹配、Assignment 和 Learning 动态调度尚未开始，因此学生端不会自动消费这批短片段资源。

## 一、阶段目标

阶段 2 只完成针对性短片段的生产端闭环和首批正式资源建设：

```text
Targeted Excerpt Material Version
→ Observation Plan
→ 1–2 个 Training Task
→ Question Candidate
→ 人工采用或重新优化
→ Revision / Validation / Assessment / Publish
→ Frozen Version / Registry Active Link
```

完成后，生产工作台能够明确区分核心阅读材料与针对性短片段，并能够用既有 AI 规划、Candidate、采用发布和质量门禁生产首批约 `12` 份短片段、`18–24` 道正式题。

本阶段不从学生 Diagnosis 自动创建 Request，不匹配 Assignment，不改变 Session Task Queue，也不在 Learning 展示或消费微训练。阶段 2 通过只代表“资源已经可生产、可审查、可发布”，不代表“动态微训练已上线”。

## 二、阶段输入与冻结边界

### 2.1 已有输入

阶段 2 必须直接复用阶段 1 已通过的结构：

- `MaterialUsageType`；
- `TargetedExcerptMetadata`；
- `TargetedGapReasonCode`；
- Source Anchor；
- Material 内容哈希；
- Request / Assignment 身份定义。

阶段 2 不修改 Request / Assignment 语义，也不提前实现它们的 Repository 或 Runtime 调度。

阶段 2 在 Material 生产身份上新增版本化内容规范化字段：

```ts
type MaterialContentNormalizationPolicyVersion =
  | 'material_content_normalization_v1';
```

该字段只用于解释 `contentHash` 如何形成，不改变阶段 1 的 Request / Assignment 契约。历史 Material 缺少该字段时继续按既有版本读取，不批量重算旧哈希。

### 2.2 不迁移正式核心资源

当前正式快照基线为：

- `12` 个活动核心 Material Version；
- `61` 个活动 Registry 题目；
- 历史 Material 缺少 `usageType` 时只读投影为 `core_reading`。

阶段 2 不为历史 Material 批量补字段，不重建现有 Frozen Version，不改写 Registry Head，不重新发布 61 道既有题目。新短片段使用新的 `materialId / materialVersionId` 和独立生产链身份。

### 2.3 人工职责

人工仍只负责：

- 录入或选择合法材料来源；
- 对 AI 生成的完整题目方案执行“采用”或“不采用并重新优化”。

不得增加手工改题、手填 Rubric、指定答案、额外审核意见或“保存后再发布”等中间步骤。

## 三、工作包与执行顺序

阶段 2 必须按以下顺序实施，避免页面先展示、底层保存却丢失用途字段。

### WP2.1 Material 创建、修订与持久化贯通

先扩展现有 Material 输入与修订接口，使以下字段完整进入 `QuestionMaterialVersion`：

```ts
usageType
contentHash
contentNormalizationPolicyVersion
targetedExcerptMetadata
```

必须覆盖：

- `createQuestionMaterial`；
- `createQuestionMaterialRevision`；
- `createProductionMaterial`；
- `stageProductionMaterialRevision`；
- InMemory / IndexedDB / Local API Repository；
- Shared Formal Resource Snapshot 的导入、导出和重启恢复。

新建正式短片段的发布身份至少包含：

```ts
type TargetedExcerptMaterialIdentity = {
  usageType: 'targeted_excerpt';
  contentHash: string;
  contentNormalizationPolicyVersion: MaterialContentNormalizationPolicyVersion;
  targetedExcerptMetadata: {
    targetAbilityIds: string[];
    supportedGapReasonCodes: TargetedGapReasonCode[];
    sourceRelation: TargetedExcerptSourceRelation;
    intendedTaskCount: 1 | 2;
    parentMaterialId?: string;
    sourceAnchor?: TargetedExcerptSourceAnchor;
  };
};
```

### WP2.1.1 正式 Material 完整性硬门禁

只要 `usageType = targeted_excerpt`，以下字段任何一项缺失、为空或不合法，Material 就不得进入正式 Repository，也不得创建正式 `materialVersionId`：

- `contentHash`；
- `contentNormalizationPolicyVersion`；
- `targetAbilityIds`，至少一个且去重；
- `supportedGapReasonCodes`，至少一个且只能来自首批四类 Gap；
- `sourceRelation`；
- `intendedTaskCount = 1 | 2`。

`same_material_excerpt` 还必须具有有效 `parentMaterialId + sourceAnchor`。这些条件必须在 Material 创建边界和三个 Repository 写入边界重复防守，不能只依赖页面必填。

不完整内容可以停留在页面本地输入或 AI 生成临时态，但不能保存为正式 Material Version，不能进入 Observation Plan、Candidate 或后续发布链。系统不得使用空数组、默认 Ability、默认 Gap 或虚构 Anchor 自动补齐。

要求：

1. 新建核心材料可以显式写入 `core_reading`，但历史记录不强制回写；
2. 新建 `targeted_excerpt` 必须保留内容哈希和完整元数据；
3. 修订时默认继承用途与来源关系，除非显式创建新的 Material 身份；
4. 已进入正式资源链的 Material 修订继续使用新版本，不覆盖旧版本；
5. 用途从 `core_reading` 改为 `targeted_excerpt` 或反向改变，不得作为普通内容修订静默发生，应新建独立 Material 身份或被门禁阻断。

### WP2.2 工作台用途与来源交互

工作台在已保存材料、材料选择器和任务卡中明确展示用途：

```text
核心阅读材料
针对性短片段
```

普通自由录入继续创建“核心阅读材料”，保证现有录入习惯不变。阶段 2 的受控短片段资源通过首批资源包或正式生产 API 创建；工作台读取到“针对性短片段”时展示专项字段，但不要求录入人员手工配置 Ability、Gap 或哈希。自由创建入口留待后续真实生产需求验证后再决定是否开放。

短片段专项信息：

- 训练能力（由 AI 规划或首批受控配置产生，工作台只读展示）；
- 支持的具体缺口（由 AI 规划或首批受控配置产生，工作台只读展示）；
- 来源关系；
- 预计题数 `1–2`（由规划结果决定）；
- 来源和合法使用说明；
- 同篇截取时的父 Material 与段落 Anchor。

工作台不得要求用户手填 `contentHash`。内容哈希由系统基于规范化正文确定性生成，保存与修订时重新校验。

标准生产路径中，用户只录入正文、用途及必要来源事实；Ability、Gap 和题数由 AI 规划形成，不把字段配置变成人工设计题目的新步骤。若 AI 无法形成合法且完整的短片段元数据，应保持 Material 未提交并给出可重试说明，不允许用前端默认值凑齐后保存。

### WP2.3 Observation Plan 与 AI 生成约束

针对性短片段的 AI 规划必须满足：

- 只生成 `1–2` 个 Training Task；
- 每题只有一个主要 Ability、一个 Gap 方向和一个可观察动作；
- 不生成 Retest、Transfer、Diagnosis 或 Observation Role；
- 题型只允许 `single_choice / short_text / long_text`；
- 题型由训练动作决定，不按题型配额分配；
- 不因片段短而降低材料依据、题干清晰度或 Rubric 完整度；
- 不把宏观能力弱项写入 Gap；
- 不在 Prompt 中要求把每份片段机械生成两题。

生成 Prompt 必须携带：

- `usageType = targeted_excerpt`；
- 目标 Ability；
- 支持的 Gap；
- Source Relation 和 Anchor；
- 已有核心任务或其他短片段的去重摘要；
- 禁止答案泄露和禁止重复的明确边界。

Provider 输出偏差不得由前端猜测修补。字段缺失、Gap 不支持、题数越界或身份不一致时，应隔离为未通过任务，不进入 Candidate 采用区。

为了让阶段 3 能按 Ability + Gap 精确匹配，每个针对性正式题目还必须保存一个不可从题干推断的主 Gap 身份：

```ts
type TargetedTrainingResourceMetadata = {
  primaryGapReasonCode: TargetedGapReasonCode;
  targetedMaterialVersionId: string;
};
```

该元数据必须从 Observation Task 进入 Candidate、Draft、Frozen Version 和 Registry 可读取快照。一个正式资源只计入一个 `primaryGapReasonCode`；Material 的 `supportedGapReasonCodes` 只表示可生产范围，不能替代题目主 Gap。

### WP2.4 Candidate、采用发布与正式资源身份

短片段 Candidate 继续使用现有：

```text
Candidate
→ Adopt
→ Revision
→ Validation
→ Assessment
→ Publication
```

要求：

1. Candidate 卡片明确显示“针对性短片段”及训练动作，但不增加新的人工审核步骤；
2. 采用后形成 Frozen Version 和 Registry Active Link；
3. Frozen Version 的 Material Snapshot 必须保留用途、内容哈希和短片段元数据；
4. 未采用、blocked、superseded 或发布失败的 Candidate 不得进入 Registry；
5. 发布中断继续复用 adoption / validation / assessment / publication 阶段结果；
6. 重试不得重复创建 Material、Draft、Frozen Version 或 Active Link；
7. 短片段资源不得替换同 Ability 的核心题目，也不得成为核心题组默认候选。

### WP2.5 首批资源包建设

工程链打通后，建设约 `12` 份短片段：

| 缺口方向 | 建议片段数 | 每片段题数 | 推荐训练动作 |
| --- | ---: | ---: | --- |
| 信息与证据定位 | 3 | 1–2 | 限定对象、范围和直接证据 |
| 局部含义理解 | 3 | 1–2 | 字面信息、对象关系和局部含义 |
| 证据—结论连接 | 3 | 1–2 | 说明证据为什么支持判断 |
| 简单因果与关系判断 | 3 | 1–2 | 区分直接原因、表面相关和过度推断 |

首批正式题总量建议为 `18–24`，但数量不是发布条件。某份片段只能形成一道高质量题时允许只发布一道；任何题不得为了达到库存数量绕过质量门禁。

### WP2.5.1 四类 Gap 可用资源覆盖门禁

首批资源包验收同时检查“库存总量”和“Gap 可匹配覆盖”，不能只看 18–24 道总数。

每一类 Gap 至少满足：

- `3` 个不同的活动短片段 Material Version；
- `3` 个通过完整发布链的当前 Frozen Resource Version；
- `3` 个 Active Registry Link；
- 资源的 `taskRole = training`；
- Ability、主 Gap、来源和 Anchor 均可结构化读取；
- 三个资源之间不存在实质重复。

资源计数规则：

1. Candidate、Draft、Validation 或非当前 Frozen Version 不计入可用资源；
2. 同一题不能因为 Material 支持多个 Gap 而重复计数；
3. 每题只按 `primaryGapReasonCode` 计入一个 Gap；
4. 同一 Material 上的换皮题不增加独立情境数；
5. retired Material、superseded Version、非 Active Link 或来源未通过的资源不计入；
6. 四类 Gap 任一类未达到最小覆盖，阶段 2 不得以“总数已经达到”通过验收。

验收报告必须输出 `Gap × Ability` 覆盖矩阵，显示每个交叉格的独立 Material 数和可执行资源数。第一版不要求形成完整笛卡尔积，但空白或偏薄单元格必须如实标记，不能用其他 Ability 的资源冒充 Match 可用。

## 四、材料来源与身份规则

### 4.1 `controlled_original`

- 明确标识为受控原创训练材料；
- 不使用教材作者、作品名或原文口吻暗示其为正式课文；
- Source Description 和版权说明可审计；
- 内容必须构成完整证据情境，不能只是为某答案拼出的句子。

### 4.2 `authorized_external_excerpt`

- 必须提供来源定位和合法使用说明；
- 作者、作品名、译者等元数据按已有来源规范保存；
- 未完成来源核验时不得发布；
- 不得仅凭 AI 声称来源合法。

### 4.3 `same_material_excerpt`

只有同时满足以下条件才可生产：

- 具有 `parentMaterialId`；
- Source Anchor 指向父材料真实段落；
- Anchor 内容哈希与当前父 Material Version 对齐；
- 与触发核心题的证据范围不同或训练动作确需重新聚焦；
- 不直接包含核心题答案；
- 不同时重复观察对象、证据范围和评分目标。

同篇片段不因为 TaskRole 不同自动放行。

## 五、长度、完整性与内容哈希

`100–300` 字继续作为第一版推荐区间，不作为 Schema 或发布硬门禁。

发布质量判断优先级为：

```text
证据情境完整
→ 训练动作可独立完成
→ 不依赖缺失上下文
→ 不泄露答案
→ 再参考推荐长度
```

内容哈希必须基于统一且版本化的正文规范化规则生成。Hash 输入必须包含策略版本，等价内容使用同一版本时形成同一哈希；正文实质变化必须形成新的哈希和 Material Version。

### 5.1 `material_content_normalization_v1`

第一版按以下顺序处理：

1. 移除 UTF-8 BOM；
2. Unicode 使用 NFC；
3. `CRLF / CR` 统一为 `LF`；
4. Tab 和不换行空格统一为普通空格；
5. 清除每行首尾无意义空白，连续水平空白折叠为一个空格；
6. 连续三个及以上空行折叠为一个段落空行；
7. 保留段落顺序、换行语义、汉字、数字和所有未列入显式等价表的标点；
8. 对规范化结果计算确定性哈希，并同时保存策略版本。

不得笼统删除标点。逗号、分号、问号、引号、书名号和重复标点可能影响语义、情绪、句法或证据范围，默认都视为正文内容。所谓“标点输入噪声”只允许处理策略中显式列明的 Unicode 等价字形；`v1` 未列明的标点变化必须形成不同哈希。

未来修改规则时发布新的 Policy Version。旧 Material 保留原策略和原哈希，不后台重算；跨版本去重必须记录比较使用的策略，不能用新算法重新解释旧身份。

## 六、去重与答案泄露门禁

### 6.1 去重维度

系统至少比较：

- 观察对象；
- 证据范围；
- 评分目标；
- 主要 Ability；
- Gap Reason；
- 认知动作；
- 题干语义；
- Source Anchor；
- 正确答案或校准结论。

只改题干措辞、题型或 TaskRole 不构成新的训练价值。

### 6.2 答案泄露

以下情况必须阻断：

- 片段直接复述核心题的正确结论；
- 提示或题干给出应由学生完成的证据—结论连接；
- 单选只有一个与原题反馈措辞一致的选项；
- 同篇 Anchor 使学生无需重新定位或推理即可凭记忆作答；
- Calibration Answer、Rubric 或内部 Gap 描述进入学生可见题干。

## 七、工作台状态与交互

### 7.1 材料层状态

列表与当前材料标题附近可显示：

- `核心阅读`；
- `针对性短片段`；
- 来源关系；
- 已规划题数、已发布题数和未通过题数。

不得把 `targeted_excerpt` 显示为“待处理”的同义词。用途与生产状态是两个不同维度。

### 7.2 主操作

短片段仍沿用：

- `AI 规划训练任务`；
- `采用当前任务方案`；
- 单题 `采用并发布` 或等价整组采用动作；
- `重新生成题目 / 重新优化`。

运行中只显示一个不可重复触发的状态；成功后原位更新，错误就近显示并提供明确重试，不要求用户滚回页面顶部寻找提示。

### 7.3 空状态与失败

- 没有合格任务时说明具体阻断原因，不生成空 Candidate 卡片；
- 部分任务未通过时隔离失败项，合格项仍可采用；
- Material 保存失败不得留下半条 Observation Plan；
- 发布失败不得把 Candidate 误显示为已发布；
- 共享资源超时或冲突继续使用既有结构化恢复提示。

## 八、阶段 2 自动化 Debug 矩阵

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| TMT-S2-01 | 历史核心 Material 读取 | 投影为 `core_reading`，不回写 |
| TMT-S2-02 | 新建显式核心 Material | 现有录入、规划、发布行为不变 |
| TMT-S2-03 | 新建受控原创短片段 | 用途、哈希和元数据完整持久化 |
| TMT-S2-04 | 新建合法外部短片段 | 来源核验信息完整保留 |
| TMT-S2-05 | 新建同篇截取短片段 | 父 Material、Anchor 和哈希对齐 |
| TMT-S2-06 | 同篇缺少 Anchor | 保存阻断且无半成品 |
| TMT-S2-07 | 用途在普通修订中改变 | 阻断或要求新 Material 身份 |
| TMT-S2-08 | 60–100 字完整文言片段 | 不因低于推荐字数机械阻断 |
| TMT-S2-09 | 约 350 字完整叙事片段 | 不因高于推荐字数机械阻断 |
| TMT-S2-10 | 片段缺乏完整证据情境 | 质量门禁阻断 |
| TMT-S2-11 | AI 生成 1–2 个 Training Task | 结构通过 |
| TMT-S2-12 | AI 生成 3 个任务或 Retest Role | 隔离并阻断采用 |
| TMT-S2-13 | 使用宏观能力弱项作为 Gap | 阻断 |
| TMT-S2-14 | 单选与训练动作匹配 | 完整选项、答案键和干扰依据通过 |
| TMT-S2-15 | 文本题与训练动作匹配 | Rubric 和最低作答要求通过 |
| TMT-S2-16 | 同对象、同证据、同评分目标换皮 | 去重阻断 |
| TMT-S2-17 | 同篇不同 Anchor 且无答案泄露 | 可以进入 Candidate |
| TMT-S2-18 | Candidate 采用并发布 | Frozen Snapshot 保留短片段字段 |
| TMT-S2-19 | 发布中断后重试 | 不重复 Version 或 Active Link |
| TMT-S2-20 | 未通过 Candidate | 不写入 Registry |
| TMT-S2-21 | 工作台切换核心与短片段 | 选择与详情上下文保持一致 |
| TMT-S2-22 | 错误发生在长页面底部 | 错误就近可见且可重试 |
| TMT-S2-23 | 12 篇、61 题历史基线 | 身份、版本、Registry 和 Learning 零回归 |
| TMT-S2-24 | 阶段 2 完成后进入 Learning | 不出现微训练自动插题 |
| TMT-S2-25 | 短片段缺少任一必要元数据 | 不创建正式 Material Version |
| TMT-S2-26 | 相同正文仅有 BOM、换行或空白噪声 | `v1` 形成相同规范化正文和哈希 |
| TMT-S2-27 | 正文标点发生未列明变化 | 形成不同哈希，不静默合并 |
| TMT-S2-28 | 同一正文使用不同 Policy Version | 身份和比较策略可解释，不改写旧哈希 |
| TMT-S2-29 | 四类 Gap 各有 3 个独立正式资源 | 覆盖矩阵通过 |
| TMT-S2-30 | 总量达标但某一 Gap 少于 3 个 | 阶段 2 资源包验收阻断 |
| TMT-S2-31 | Material 声明多个支持 Gap | 正式题只按主 Gap 计入一次 |
| TMT-S2-32 | Gap × Ability 存在空白格 | 如实报告，不用近似 Ability 冒充 |

## 九、真实浏览器验收

至少完成以下浏览器路径：

1. 新建一份 `controlled_original` 短片段；
2. 展开材料详情，确认用途、来源和训练范围；
3. AI 规划 `1–2` 个任务；
4. 查看 Candidate，确认训练动作和题目内容匹配；
5. 不采用一次并重新优化，确认正式资源不变；
6. 采用合格方案并发布；
7. 刷新、跨标签和服务重启后恢复同一 Material / Frozen Version / Active Link；
8. 切回一篇既有核心材料，确认其题目与操作不受影响；
9. 打开 Learning，确认尚未自动插入短片段任务。

同篇截取和授权外部片段可使用独立受控样本验收，不要求在首个浏览器冒烟中同时录入三类来源。

## 十、整体回归范围

阶段 2 至少运行：

- 阶段 1 Targeted Micro-training Debug；
- Question Resource Admission；
- Material Observation；
- Material Resource Production；
- Candidate Workflow / Adoption / Publication Recovery；
- Shared Formal Resource Persistence 与并发；
- Registry / Resource Coverage；
- Training Task Group Planning；
- Reading Single-choice Stage 1–4；
- Learning Session Task Queue；
- Phase 17.3 Learning Entry；
- Production Build；
- `git diff --check`。

任何现有 12 篇核心材料、61 道活动题目、单选题、文本题、固定题组连续学习或反馈后修订回归失败，阶段 2 不得通过。

## 十一、失败恢复与回滚

1. 新字段保存失败：不创建 Material；
2. Material 已保存、Plan 失败：保留 Material，允许从同一身份重试，不重复创建；
3. Candidate 失败：隔离 Candidate，不影响 Material 和已发布资源；
4. 发布失败：保留 adoption / validation / assessment 阶段结果，继续发布；
5. Registry 提交失败：不得出现 Frozen Version 已成功但错误标记为 Learning 可用的前台状态；
6. 阶段 2 功能开关关闭时，既有核心材料生产和 Learning 必须继续可用；
7. 回滚代码不删除已保存的短片段 Material 或 Frozen Version，只关闭新的生产入口与后续匹配资格。

## 十二、阶段完成条件

只有同时满足以下条件，阶段 2 才可标记 `ENGINEERING + DEBUG PASS`：

1. Material 创建与修订不再丢失阶段 1 用途字段；
2. 三类短片段来源都有确定性结构和来源门禁；
3. 工作台能够区分用途但不把用途与“待处理”混淆；
4. AI 只规划 `1–2` 个单一动作 Training Task；
5. 去重、答案泄露、来源和内容完整性门禁生效；
6. Candidate 继续执行“采用或重新优化”，无新增人工编辑步骤；
7. Frozen Snapshot 和 Registry 保留短片段身份；
8. 首批约 `12` 份片段、`18–24` 道题通过逐项来源和质量审查；
9. 四类 Gap 各自至少具有 3 个独立活动片段和 3 个可执行当前正式资源，并输出 `Gap × Ability` 覆盖矩阵；
10. 当前 12 篇核心材料、61 道活动题目及 Learning 消费零回归；
11. 自动化、真实浏览器和生产构建验收通过并形成阶段 2 报告。

完成阶段 2 后，状态只能标记为：

`STAGE 2 RESOURCE PRODUCTION PASS / LEARNING SCHEDULING NOT STARTED`

不得宣称学生已经能够消费微训练，也不得收集 Trigger、Match、Completion 或 Return 数据。上述能力属于阶段 3–4。

## 十三、相关文档

- [针对性短片段微训练材料与调度契约](./TARGETED_MICRO_TRAINING_MATERIAL_AND_SCHEDULING_CONTRACT.md)
- [阶段 1 工程与 Debug 验收](../education/phase/reports/targeted_micro_training_stage1_engineering_debug_acceptance_2026-08-20.md)
- [阶段 2 工程与 Debug 验收](../education/phase/reports/targeted_micro_training_stage2_engineering_debug_acceptance_2026-08-20.md)
- [正式资源生产契约地图](./FORMAL_RESOURCE_PRODUCTION_CONTRACT_MAP.md)
- [AI 题目生成质量与定向优化契约](./AI_QUESTION_GENERATION_QUALITY_AND_TARGETED_OPTIMIZATION_CONTRACT.md)
- [阅读训练单项选择作答契约](./READING_SINGLE_CHOICE_RESPONSE_FORMAT_CONTRACT.md)
- [训练模型](../education/TRAINING_MODEL.md)
