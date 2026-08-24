# 阅读开放文本题难度梯度与输入负担优化契约

英文名称：Reading Open-response Difficulty and Input-load Optimization Contract

状态：`V1.1 ACTIVE AS CONTENT-LOAD GOVERNANCE / TRAINING MODEL V2 STAGE 0 IN PROGRESS`

契约版本：`reading_open_response_input_load_policy_v1.1`

更新日期：2026-08-21

## 一、目标

本文约束阅读训练中 `short_text / long_text` 题目的进入难度、单题复合度、作答长度、思路提示、题组顺序和质量门禁。

优化目标不是降低最终能力标准，而是把以下能力分开观察：

1. 是否完成基础材料理解；
2. 是否能找到相关文本依据；
3. 是否能说明依据与判断之间的关系；
4. 是否能进行概括、推理、人物或主题分析；
5. 是否能把已经形成的理解组织为清楚表达。

本文解决的是开放文本题的内容负担治理，不单独承担跨题组、跨 Learning、Diagnosis 与 Evidence 的训练梯度语义。若系统需要通过不同负担层级的表现差异识别学生从哪一层开始失稳，应同时遵循《阅读训练递进负担模型契约》。该能力属于兼容式 Training Model 核心升级，但仍不重建现有生产和消费主链。

上位契约：[`READING_TRAINING_PROGRESSIVE_LOAD_MODEL_CONTRACT.md`](./READING_TRAINING_PROGRESSIVE_LOAD_MODEL_CONTRACT.md)

## 二、适用范围与非目标

### 2.1 适用范围

本文适用于：

- 完整阅读材料中的常规 `training` 任务组；
- `short_text / long_text` QuestionCandidate 的生成、重新生成和质量检查；
- TrainingTask 顺序规划与 Learning 连续作答；
- 现有正式题库的只读审查和后继 Candidate 治理；
- 文本题首次作答前的按需思路提示；
- 作答后的 Diagnosis、Revision 和 Targeted Micro-training 衔接。

### 2.2 不改变的边界

本优化不改变：

- Material → Observation Plan → QuestionCandidate → Adopt → Revision → Publish 主链；
- Frozen Resource 与 Registry 的不可变版本规则；
- 人只负责“采用并发布 / 不采用并重新生成”的产品原则；
- 单选题的稳定身份、干扰项和 Diagnosis 契约；
- 首次独立作答、反馈支持下修订和后续独立验证的证据隔离；
- Retest、Transfer、Maintenance 不被即时提示污染的边界。

本优化不授权系统原地修改或删除已经发布的正式题目。现有题需要优化时，只能生成后继 Candidate，由用户采用后形成新 Frozen Version；旧版本继续保留历史事实。

## 三、核心原则

1. **降低入口负担，不降低最终能力标准。** 题组前段先确认基础理解，后段仍保留解释、概括、推理、证据组织和综合分析。
2. **一道题只观察一个主要认知动作。** 最多允许一个与主要动作紧密依赖的支撑动作；不得把多个相互独立任务拼成一题。
3. **阅读困难与表达困难分层观察。** 学生未完成高负荷文本题，不能直接推断其材料理解失败。
4. **作答长度服务于观察动作。** 字数不是难度代理，也不是内容质量门禁。
5. **题组形成坡度，不形成题型或层级配额。** 梯度要求题组不存在无正式理由的负担跳跃，不要求每个负担等级都必须出现；实际结构仍服从 Observation Plan 和材料价值。
6. **提示只降低启动难度。** 提示提供一个线索和一个推敲方向，不再生成第二套答题任务。
7. **先治理新 Candidate，再治理历史题。** 新生成规则先稳定；既有正式题只做审查和定向后继，不整批覆盖。

## 四、文本题输入负担模型

### 4.1 输入负担不是题目难度本身

文本题负担至少由以下维度共同决定：

| 维度 | 低负担 | 高负担 |
| --- | --- | --- |
| 材料范围 | 单句或局部段落 | 跨段或全文 |
| 回答对象 | 单一对象 | 多人物、多阶段或多对象 |
| 主要认知动作 | 定位、简单解释 | 整合、比较、推理、主题分析 |
| 必需证据 | 一处直接证据 | 多处证据或跨段关系 |
| 关系说明 | 无或单一关系 | 因果链、转折链、结构关系 |
| 表达组织 | 一个短结论 | 多层观点和证据组织 |
| Required Rubric | 一个核心观察 | 多个相互独立观察 |

系统不得用 `short_text / long_text` 或最低字数单独代表真实负担。

### 4.2 建议的结构化负担画像

工程实现可以为 TrainingTaskCandidate 和 QuestionCandidate 增加或计算以下画像：

```ts
type TextResponseLoadProfile = {
  policyVersion: 'reading_open_response_input_load_policy_v1_1';
  loadLevel: 'entry_short' | 'focused_short' | 'developing' | 'integrated';
  primaryAction: string;
  supportingAction?: string;
  requiredEvidenceUnitCount: 0 | 1 | 2 | '3_or_more';
  requiredRelationCount: 0 | 1 | '2_or_more';
  requiredObjectCount: 1 | 2 | '3_or_more';
  expectedAnswerLengthBand: {
    recommendedMin: number;
    recommendedMax: number;
  };
  compositeLoadReasons: string[];
};
```

该画像用于生成、排序、质量检查和治理，不形成新的学生能力结论。`primaryAction / supportingAction` 必须来自现有 Observation Plan 和 Required Rubric，不建立第二套题目语义。

计数字段采用封顶枚举而不是任意精确数字，目的是识别负担等级和阻断明显过载，不鼓励模型为题目制造更多对象、关系或证据。

### 4.2.1 `loadLevel` 的题目属性边界

`loadLevel` 只描述当前题目要求学生同时承担的阅读、推理和表达负担，属于 TrainingTask / QuestionCandidate / Frozen Resource 的题目属性，不属于学生能力等级。

工程实现必须遵守：

- 不把 `loadLevel` 写入 Student Ability Profile；
- 不把学生在 `integrated` 题中的一次失败投射为“学生只能完成 developing”；
- 不直接使用 `loadLevel` 升降长期能力结论；
- 不让 `loadLevel` 替代 Evidence、Requirement Coverage、Diagnosis、Retest 或 Transfer；
- 调度可以把负担等级作为任务适配条件之一，但必须同时读取正式能力证据、任务角色和训练目标。

正确关系固定为：

```text
loadLevel
→ 描述题目要求

Evidence / Diagnosis
→ 解释本次真实表现

Retest / Transfer
→ 验证是否独立保持或迁移
```

### 4.2.2 `expectedAnswerLengthBand` 的内部使用边界

`recommendedMin / recommendedMax` 是内容设计与质量治理提示，默认不得投射为学生界面要求。它只用于：

- AI 生成约束；
- Rubric 与 Answer Acceptance 设计辅助；
- 输入框初始尺寸和增长策略；
- 题目负担审查与真实数据校准。

Learning 不得直接显示“建议回答 30–60 字”等推荐区间。学生端只有在题目确实存在必要形式约束时，才显示独立推导的 `minimumAnswerRequirement`；推荐区间不能成为最低字数的别名，也不能参与提交阻断。

### 4.3 四级负担定义

| 等级 | 主要用途 | 典型结构 | 推荐回答长度 |
| --- | --- | --- | --- |
| `entry_short` | 基础理解后的第一次文本表达 | 一个局部对象 + 一个动作；通常一处证据 | `10–25` 字 |
| `focused_short` | 局部解释或简单关系 | 一个主要动作 + 一个依赖性支撑动作 | `20–40` 字 |
| `developing` | 证据与判断连接、简单推理 | 一至两处证据 + 一个明确关系 | `30–60` 字 |
| `integrated` | 概括、人物、主题、多证据分析 | 跨段或全文整合，允许两个紧密相关步骤 | `50–100` 字 |

以上是第一版推荐区间，不是结构门禁。材料完整性、训练动作和“最低有效完整回答”优先于机械字数。

## 五、常规题组难度梯度

### 5.1 五至六题常规题组

常见的有效结构示例：

```text
1–2 道基础理解单选
→ 1 道 entry_short / focused_short
→ 1–2 道 developing
→ 1 道 integrated
```

该结构只表达一种常见训练坡度，不要求每篇材料机械凑齐所有层级。梯度要求的是题组不存在无正式理由的负担跳跃，不要求 `entry_short / focused_short / developing / integrated` 全部出现。

以下结构同样可以成立：

```text
single_choice → focused_short → developing → integrated
single_choice → entry_short → integrated
focused_short → developing → integrated
holistic_first 文本任务 → 局部单选 → developing
```

规划器不得为了得到“漂亮梯度”补入没有独立观察价值的中间层任务。缺少某个负担等级本身不是质量问题，也不能触发自动补题或阻断发布。

系统必须优先保证：

- 前段至少存在低输入负担的理解入口；
- 中段能够观察“依据—判断”关系；
- 后段仍保留至少一项高阶文本能力观察；
- 多道任务在对象、证据范围或认知动作上具有实质差异。

### 5.2 三至四题较小题组

常见结构示例：

- `3` 道：`1` 道单选 + `1` 道短文本 + `1` 道中等或综合文本；
- `4` 道：`1–2` 道单选 + `1` 道短文本 + `1` 道中等或综合文本。

题量较小时不得为了保留形式完整而把多个高阶动作压缩进最后一道文本题。材料无法在有限题量中稳定观察所有目标时，应缩小 Observation Plan，而不是提高单题复合度。

较小题组同样不要求覆盖每个负担等级。若 `single_choice → focused_short → integrated` 已具有合理依赖和材料支持，不得为了补齐 `entry_short / developing` 增加重复任务。

### 5.3 顺序例外

默认优先由低输入负担进入，但以下情况允许调整：

- Observation Plan 要求先保留学生整体判断或自由表达基线；
- 当前已有稳定基础理解证据；
- 单选承担 `retest / transfer`，不属于当前基础进入层；
- 材料不适合形成高质量干扰项；
- 任务之间存在必要的内容依赖。

顺序例外继续遵循 `entry_first / holistic_first / role_driven` 策略，不创建新的顺序系统。

## 六、单题动作与拆分规则

### 6.1 允许结构

每道文本题默认采用：

```text
一个主要认知动作
+ 最多一个紧密依赖的支撑动作
```

允许示例：

> 找出最能表现人物犹豫的一个动作，并说明这个动作表现了怎样的心理。

其中“找出动作”是支撑动作，“说明心理”是主要动作，两者共享同一回答对象和证据范围。

### 6.2 必须拆分或重生的结构

以下情况不得继续作为一道常规文本题：

- 同时要求定位、概括、比较、分析作用和联系主题；
- 要求分别分析两个以上独立对象或阶段，但没有共同单一结论；
- 题干要求一处局部内容，Required Rubric 却要求全文结构或主题；
- 短段落只能支持一个观察，却要求列举多处描写并完成综合分析；
- 一道 `short_text` 需要三个或更多相互独立 Required Rubric 项；
- 学生必须先推断隐藏任务，才能知道需要完成什么。

处理优先级：

```text
缩小观察范围
→ 删除非核心动作
→ 将非核心 Required Rubric 降为 Optional
→ 仍无法对齐时拆成独立 TrainingTaskCandidate
```

系统不得仅通过切换成 `long_text` 掩盖任务设计过载。

## 七、作答长度规则

### 7.1 推荐长度与最低字数分离

`expectedAnswerLengthBand` 表达正常完整回答的大致长度；`minimumAnswerRequirement` 只在确有形式完整性需要时使用。两者不能混为一体。

最低字数必须根据“最短但完整有效的合理回答”推导，不得根据理想答案长度、Rubric 总字数或统一模板设置。

`expectedAnswerLengthBand` 默认只存在于内部题目设计和治理对象中，不进入学生题干、作答要求、思路提示或反馈。输入框可以依据它选择合适的初始尺寸，但不得显示推荐区间，也不得要求学生“尽量写到推荐字数”。

### 7.2 默认策略

- `entry_short` 默认不设置硬性最低字数，或只设置很低的有效输入边界；
- `focused_short` 只有必须同时写出判断和简短理由时才设置最低字数；
- `developing / integrated` 可以设置最低字数，但必须与必需证据和关系数量对应；
- 学生达到最低字数不代表内容有效、答案正确或任务完成；
- 学生使用少于推荐长度但已完整完成动作时，不得仅因字数判定失败。

### 7.3 禁止做法

- 所有文本题统一“不少于 30 / 40 字”；
- 用较高最低字数迫使学生重复题干或材料；
- 单一事实定位题要求长段表达；
- 为制造难度增加与观察目标无关的表达量；
- 把表达流畅度混入不以表达为目标的基础理解题。

## 八、思路提示边界

思路提示继续遵循：

```text
一个核心线索 + 一个推敲方向
```

示例：

> 留意人物说这句话前后的动作变化，想一想这种变化反映了什么心理。

提示不得：

- 罗列完整答题流程；
- 重复题干所有要求；
- 增加新的证据、比较或表达任务；
- 直接指出答案结论、正确选项或完整证据；
- 使用“找到相关句段、结合上下文、用自己的话说明”等没有具体思维方向的空泛表述。

若题目必须依靠复杂提示才能让学生理解任务，应优先修复题干或降低单题复合度，不能持续扩写提示。

## 九、Planner 与生成 Prompt 规则

### 9.1 Observation Plan / TrainingTask Planner

规划器应先决定观察动作和题组坡度，再决定作答形式。推荐决策顺序：

```text
训练目标
→ 学生需要完成的主要认知动作
→ 材料可支持的对象和证据范围
→ 是否需要支撑动作
→ 输入负担等级
→ responseFormat
→ 题组顺序
```

不得先设定文本题数量或字数，再反向拼接训练动作。

Planner 只需避免无理由的负担跳跃，不得把四个 `loadLevel` 当作必填覆盖槽位。层级缺失不是 Coverage Gap；只有 Observation Plan 的真实观察目标缺失，才允许生成补充任务。

### 9.2 Question Candidate Prompt

Prompt 必须要求模型：

1. 明确唯一 `primaryAction`；
2. 若存在 `supportingAction`，说明它为何与主要动作紧密依赖；
3. 标出回答对象、材料范围和必需证据数量；
4. 生成与题干一致的 Required Rubric；
5. 按最低有效完整回答推导作答长度；
6. 发现三个以上独立动作时主动缩小范围或拆分候选；
7. 避免把单选已确认的基础事实再次改写成长文本题；
8. 保留题组后段的高阶文本观察，不把所有任务都降为低负担题。

### 9.3 定向修复

当候选仅存在以下问题时，可执行一次结构化定向修复：

- 题干动作过多；
- Required Rubric 超出题干；
- 最低字数与负担不匹配；
- 证据范围不足；
- 第一条文本题过早达到 `integrated`；
- 思路提示比题目更复杂。

定向修复必须保持 Material、TrainingTask 主目标和回答对象稳定。若必须改变核心观察目标，应重新生成完整 QuestionCandidate，而不是局部修补。

## 十、质量门禁

### 10.1 阻断项

以下问题必须阻止 Candidate 进入“可以发布”：

1. 存在三个或更多相互独立的必需认知动作；
2. 题干与 Required Rubric 的动作、对象或证据范围不一致；
3. 材料证据不足以完成题干要求；
4. `short_text` 实际要求跨段、多对象或多关系综合；
5. 最低字数明显高于完成观察动作所需的最低有效长度；
6. 提示承担隐藏评分要求或形成第二套任务；
7. Candidate 的负担等级、responseFormat 与题组顺序发生身份错配；
8. 为降低难度删除了 Observation Plan 必需的高阶文本观察。

不得把“题组没有覆盖全部四个负担等级”设置为阻断项或质量提醒。

### 10.2 非阻断提醒

以下情况可以提醒，但不自动阻断：

- 两个动作虽紧密相关，但真实学生可能仍感到负担较高；
- 推荐回答长度处于相邻等级边界；
- 第一条文本题为 `developing`，但前置单选已充分覆盖基础理解；
- 材料支持多个合理解释，Answer Acceptance 需要真实样本扩展；
- 题组高阶文本题只有一道，需要后续真实数据验证覆盖是否充分。

### 10.3 题组级检查

单题全部通过不等于题组合格。题组还必须检查：

- 是否存在可进入的低负担任务；
- 相邻任务是否存在无正式原因的明显负担跳跃；
- 是否至少保留一项高阶文本观察；
- 是否因多道相似短文本造成低价值重复；
- 是否把同一理解结论分别包装为单选、短文本和长文本重复提问；
- 例外顺序是否有受控原因。

## 十一、现有正式题库治理

### 11.1 审查分类

现有题目按以下四类处理：

| 分类 | 处理 |
| --- | --- |
| `retain` | 动作、范围、字数和顺序均合理，继续使用 |
| `copy_or_length_adjustment` | 只需缩短题干、提示或最低字数，生成完整后继 Candidate |
| `decompose_or_refocus` | 存在复合动作或范围过大，缩小观察目标或拆分任务候选 |
| `regenerate` | 证据不足、Rubric 错位或训练价值重复，重新生成完整方案 |

### 11.2 处理优先级

优先审查：

1. 题组第一道开放文本题；
2. 最低字数为 `30 / 40` 且只有一个局部动作的题；
3. 题干包含三个以上并列动词的题；
4. 短段落要求多处描写、多个角度或综合作用的题；
5. 学生真实作答中出现高放弃率、长停顿或大量无效填充的题；
6. 单选已经完成基础观察、文本题却继续重复同一判断的题。

### 11.3 版本边界

- 审查本身不改变正式资源；
- 每个后继 Candidate 独立采用并发布；
- 不批量静默替换 Active Registry；
- 已开始 Learning Session 继续消费冻结队列版本；
- 新版本只影响之后新建的 Learning Session；
- 旧 Attempt、Diagnosis、Evidence 和 Calibration 数据继续绑定旧版本。

## 十二、Learning、Diagnosis 与后续训练边界

### 12.1 Learning

Learning 只消费已经冻结的题目负担画像和作答要求，不在前端临时重写题目。页面可以根据 `responseFormat` 和负担等级调整输入框初始尺寸，但不得暗示答案结构。

### 12.2 Diagnosis

Diagnosis 必须区分：

- 基础理解未成立；
- 理解成立但缺少文本依据；
- 有依据但未说明关系；
- 高阶分析尚未完成；
- 表达组织影响了已形成理解的呈现。

不得仅因答案较短，把所有问题统一判为“理解不足”或“表达不足”。Requirement Coverage 继续是 Revision、反馈与后续训练的共同事实来源。

### 12.3 Revision 与 Targeted Micro-training

- 普通 Training 文本题已有有效基础且存在可执行缺口时，优先允许一次反馈后修订；
- 完全无效、离题或没有任何必需观察成立时，不开放普通 Revision；
- 修订不可替代题目本身的负担治理；
- 需要不同证据情境重新执行具体动作时，才考虑 Targeted Micro-training；
- 不得因原题过载而通过连续微训练把问题转嫁给学生。

## 十三、工程影响评估

本优化属于中等规模、低架构风险调整。

主要修改范围：

- TrainingTask / QuestionCandidate 的负担画像或确定性派生逻辑；
- Observation Planner 和 Question Prompt；
- Question Quality Assessment / Admission Gate；
- 题组顺序和现有正式题只读审查工具；
- Learning 输入区对推荐长度的轻量适配；
- 回归测试与真实使用指标。

`loadLevel` 和 `expectedAnswerLengthBand` 不得进入 Student Ability Profile，也不得成为学生端新的可见要求。工程只允许在题目、生成、质量治理和受控 UI 尺寸计算边界内读取它们。

无需重写：

- Candidate / Adopt / Revision / Publish；
- Formal Resource Registry；
- Learning Session 与连续题组队列；
- 单选题结构和提交恢复；
- Diagnosis、Revision 和 Targeted Micro-training 的领域对象。

## 十四、建议工程阶段

### 阶段 1：负担画像与基线审计

阶段 1 的 Schema、计算顺序、只读边界、工程工作包和 `28 / 28` Debug 验收矩阵见[阅读开放文本题输入负担阶段 1 工程实施与 Debug 验收清单](./READING_OPEN_RESPONSE_INPUT_LOAD_STAGE1_ENGINEERING_AND_DEBUG_PLAN.md)。

阶段 1 已于 `2026-08-20` 完成工程与 Debug 验收；真实题库只读结果见[阶段 1 基线审计](../education/phase/reports/reading_open_response_input_load_stage1_baseline_audit_2026-08-20.md)，工程证据见[阶段 1 工程与 Debug 验收报告](../education/phase/reports/reading_open_response_input_load_stage1_engineering_debug_acceptance_2026-08-20.md)。该完成状态只代表负担画像与旁路审计可用，不代表现有正式题已经完成治理，也不授权提前接入 Prompt、发布阻断或学生能力画像。

- 冻结 `TextResponseLoadProfile` 计算规则；
- 对现有活动文本题生成只读负担报告；
- 识别首题过载、复合动作、字数错配和证据不足；
- 验证负担画像不会写入 Student Ability Profile，推荐长度不会投射到学生页面；
- 不修改任何正式资源。

### 阶段 2：Planner、Prompt 与长度策略

阶段 2 已于 `2026-08-21` 完成 Planner Schema、Prompt 输入输出、内部长度策略、一次受控修复、Candidate 投影和写入隔离工程，并通过 `40 / 40` 专项 Debug；实施边界见[阶段 2 Planner、Prompt 与长度策略工程实施及 Debug 验收清单](./READING_OPEN_RESPONSE_INPUT_LOAD_STAGE2_PLANNER_PROMPT_AND_LENGTH_ENGINEERING_PLAN.md)，工程证据见[阶段 2 工程与 Debug 验收报告](../education/phase/reports/reading_open_response_input_load_stage2_engineering_debug_acceptance_2026-08-21.md)。该完成状态只授权生成期 Candidate 优化，不授权提前接入发布门禁、正式题组重排、Learning 或 Student Ability Profile。

- 规划器输出主要动作、支撑动作和负担等级；
- 生成 Prompt 按负担等级生成题干、Rubric 和长度；
- 加入一次受控定向修复；
- 候选仍由用户决定采用或重新生成。

### 阶段 3：质量门禁与题组顺序

阶段 3 已于 `2026-08-21` 完成单题与题组门禁、Candidate / Draft 身份校验、发布就绪同源投影和工作台错误映射工程，并通过 `P3-01—P3-48，48 / 48` 专项 Debug、关键主链回归、生产构建以及 ready / advisory / blocked / stale / publishing / published 隔离真实浏览器状态验收。数据契约、顺序兼容性和验收矩阵见[阶段 3 质量门禁、题组顺序与发布一致性工程实施及 Debug 验收清单](./READING_OPEN_RESPONSE_INPUT_LOAD_STAGE3_QUALITY_GATE_AND_SEQUENCE_ENGINEERING_PLAN.md)，工程证据见[阶段 3 工程与 Debug 验收报告](../education/phase/reports/reading_open_response_input_load_stage3_engineering_debug_acceptance_2026-08-21.md)。阶段 3 状态为 `ENGINEERING COMPLETE / DEBUG ACCEPTED`；浏览器验收使用零正式数据写入的开发隔离面板，不构成真实教育效果校准数据。

- 接入单题和题组级负担门禁；
- 校验单选入口、首道文本题和综合题之间是否存在无理由跳跃；
- 阻断高复合、证据不足和最低字数明显错配的 Candidate；
- 验证缺少任意中间 `loadLevel` 不会被误判为题组不合格；
- 补充现有链路回归。

### 阶段 4：既有题治理与真实校准

阶段 4 的治理 Case、批次上限、后继 Candidate 身份、真实 Learning 样本资格、校准指标、`S4-01—S4-56` 专项 Debug、浏览器矩阵和工程/真实校准双重完成门，统一遵循[阶段 4 既有题治理与真实校准工程实施及 Debug 验收清单](./READING_OPEN_RESPONSE_INPUT_LOAD_STAGE4_EXISTING_QUESTION_GOVERNANCE_AND_REAL_CALIBRATION_ENGINEERING_PLAN.md)。当前已完成 `B4-01—B4-16` 全量真实应用内浏览器联调，状态为 `ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED / REAL CALIBRATION PENDING`。

- 按四类审查结果逐题生成后继 Candidate；
- 先处理少量高风险题，不整批覆盖；
- 在 Learning 采集完成率、停顿、无效输入、修订率和后续独立表现；
- 根据真实样本调整推荐长度和负担阈值。

## 十五、验收标准

### 15.1 契约与生成

- [ ] 每道文本 Candidate 都能确定一个主要认知动作；
- [ ] 支撑动作最多一个，且与主要动作共享对象和证据；
- [ ] 题干、Rubric、材料范围、responseFormat 和长度一致；
- [ ] 三个以上独立动作被阻断或拆分；
- [ ] 推荐长度不是硬性固定模板；
- [ ] `recommendedMin / recommendedMax` 默认不出现在学生题干、作答要求、提示或反馈中；
- [ ] `loadLevel` 只属于题目属性，不进入 Student Ability Profile 或长期能力结论；
- [ ] 提示只包含一个线索和一个推敲方向。

### 15.2 题组

- [ ] 常规题组存在低负担进入层；
- [ ] 第一条文本题默认不是无理由的 `integrated`；
- [ ] 题组不要求覆盖全部四个负担等级，缺少中间层级不会自动补题或阻断；
- [ ] `single_choice → focused_short → developing → integrated` 等非齐全梯度可以通过；
- [ ] 至少保留一项高阶文本能力观察；
- [ ] 单选和文本题不重复观察同一对象、证据和判断；
- [ ] 顺序例外有正式策略原因。

### 15.3 正式资源与 Learning

- [ ] 审查不修改 Frozen Resource；
- [ ] 后继 Candidate 采用后才生成新正式版本；
- [ ] 活动 Session 不被新版本改写；
- [ ] Learning 正确展示真实作答要求；
- [ ] Learning 不展示内部推荐长度区间，只在确有必要时展示独立的最低字数约束；
- [ ] 高负担题的一次失败不会自动降低学生能力等级或限制后续只能匹配低负担题；
- [ ] Revision、Diagnosis 和 Targeted Micro-training 身份保持一致；
- [ ] 构建、固定题组、单选、修订和资源生产回归通过。

### 15.4 真实使用观察

第一版重点观察：

- 各负担等级的完成率和中位作答时间；
- 空答案、无效填充和主动退出比例；
- 首道文本题的提示打开率；
- `does_not_meet / partially_meets` 分布；
- Revision 接受率与改善类型；
- 后续同类独立题是否减少相同具体缺口。

真实数据只用于校准阈值，不允许以单次表现直接宣称能力提升。

## 十六、最终产品原则

> 阅读训练应让学生逐步承担更复杂的理解与表达任务。系统可以降低进入负担、拆开观察动作并提供克制提示，但不能用大量简单题替代高阶阅读，也不能把题目设计过载解释成学生能力不足。
