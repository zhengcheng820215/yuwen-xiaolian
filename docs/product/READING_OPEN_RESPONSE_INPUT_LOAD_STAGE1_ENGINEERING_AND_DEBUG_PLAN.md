# 阅读开放文本题输入负担阶段 1 工程实施与 Debug 验收清单

英文名称：Reading Open-response Input Load Stage 1 Engineering and Debug Plan

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED`

文档版本：`reading_open_response_input_load_stage1_v1.1`

更新日期：`2026-08-20`

上位契约：[阅读开放文本题难度梯度与输入负担优化契约](./READING_OPEN_RESPONSE_DIFFICULTY_AND_INPUT_LOAD_OPTIMIZATION_CONTRACT.md)

## 零、阶段结论

阶段 1 只完成两项基础能力：

1. 对 `short_text / long_text` 题目形成确定、可解释、可重复计算的 `TextResponseLoadProfile`；
2. 对当前活动正式文本题执行只读基线审计，输出保留、文案或长度调整、拆分或聚焦、重新生成四类治理建议。

阶段 1 不修改正式题，不改变题组顺序，不接入发布阻断，不改变 Learning 作答页面，也不形成任何新的学生能力结论。

因此，阶段 1 的完成标志不是“现有题已经被优化”，而是：

```text
同一题目输入
→ 稳定得到同一负担画像
→ 稳定得到同一审计结论
→ 能解释结论依据
→ 全过程对正式资源、Learning 和学生画像零写入
```

## 一、阶段目标

阶段 1 必须交付：

- 负担画像 Schema；
- 纯函数负担分析器；
- 只读正式题库审计服务；
- 题目级与题组级审计结果 Schema；
- 当前活动文本题基线报告；
- 自动化 Debug 与写入隔离验收；
- 为阶段 2 Planner / Prompt 接入提供稳定输入，但不提前实现阶段 2。

本阶段重点回答四个问题：

1. 一道文本题要求学生同时完成多少个认知动作？
2. 题目要求的证据、关系、对象与回答长度是否相互匹配？
3. 题组是否存在无理由的负担跳跃？
4. 哪些现有正式题最值得在后续阶段生成后继 Candidate？

## 二、阶段范围与明确非目标

### 2.1 纳入范围

只分析：

- `responseFormat = short_text`；
- `responseFormat = long_text`；
- 当前活动 Frozen Question Version；
- 生成中的完整 Question Candidate，限 Debug 固定样例；
- 同一材料内的正式任务顺序；
- 题干、Rubric、最低作答要求、能力元数据、材料证据范围和任务角色。

### 2.2 不纳入范围

阶段 1 不做：

- 不修改 Prompt；
- 不修改 Observation Plan / TrainingTask Planner；
- 不重新排序题目；
- 不增加发布阻断或质量提醒；
- 不自动生成后继 Candidate；
- 不修改现有 Frozen Question Version；
- 不修改 Formal Resource Registry 或 Observation Link；
- 不修改 Learning 输入框、最低字数文案、思路提示或反馈；
- 不把 `loadLevel` 写入 Student Ability Profile；
- 不依据 `loadLevel` 判断学生只能完成某个难度层级；
- 不要求每个题组必须凑齐四个负担等级。

## 三、阶段 1 冻结决策

### 3.1 计算态与持久化边界

阶段 1 的 `TextResponseLoadProfile` 是只读派生结果：

- 由纯函数根据题目当前结构计算；
- 可以保存在 Debug 报告或内存审计结果中；
- 不写回 Question Draft、Frozen Question Version 或 Registry；
- 不迁移历史正式资源 Schema；
- 不作为 Learning Runtime 的必需字段；
- 不进入学生作答、诊断、能力画像或训练证据。

候选生成时保存画像、正式化时冻结画像的接入边界留到阶段 2—3；阶段 1 不提前制造双写状态。

### 3.2 分析顺序

分析器固定按以下顺序执行：

```text
响应格式资格检查
→ 输入字段完整性检查
→ 训练动作归一化
→ 证据 / 关系 / 对象计数
→ 推荐回答长度带计算
→ 单题 loadLevel 计算
→ 单题风险识别
→ 同材料题组顺序审计
→ 治理分类
```

任何后置规则不得反向覆盖原始事实。例如，不能因为希望题目被归入 `focused_short`，就降低实际 Rubric 的证据要求。

### 3.3 确定性与置信度

阶段 1 默认不新增模型调用。

分析器优先读取结构化字段；只有可由明确规则确认的内容才进入确定结论。题干自然语言无法可靠拆分时，必须输出 `analysisCompleteness = partial`，不得伪造高置信度画像。

同一结构化输入重复运行必须得到：

- 相同 `loadLevel`；
- 相同推荐长度带；
- 相同 Finding Code；
- 相同治理分类；
- 与运行时间、数组遍历顺序无关的稳定排序。

## 四、阶段 1 Schema

### 4.1 负担画像

```ts
export type TextResponseLoadLevel =
  | 'entry_short'
  | 'focused_short'
  | 'developing'
  | 'integrated';

export type TextResponseLoadProfile = {
  policyVersion: 'reading_open_response_input_load_policy_v1_1';
  loadLevel: TextResponseLoadLevel;
  primaryAction: CanonicalTextResponseAction;
  supportingAction?: CanonicalTextResponseAction;
  requiredEvidenceUnitCount: 0 | 1 | 2 | '3_or_more';
  requiredRelationCount: 0 | 1 | '2_or_more';
  requiredObjectCount: 1 | 2 | '3_or_more';
  expectedAnswerLengthBand: {
    recommendedMin: number;
    recommendedMax: number;
  };
  compositeLoadReasons: TextResponseCompositeLoadReason[];
};
```

`expectedAnswerLengthBand` 只用于生成约束、Rubric 辅助、输入框尺寸推导和后台治理。阶段 1 不产生任何学生可见文案。

### 4.2 规范化训练动作

第一版动作集合冻结为：

```ts
export type CanonicalTextResponseAction =
  | 'locate_information'
  | 'extract_evidence'
  | 'identify_relation'
  | 'explain_local_meaning'
  | 'summarize_content'
  | 'connect_evidence_and_conclusion'
  | 'infer_from_evidence'
  | 'compare_objects'
  | 'analyze_character'
  | 'analyze_theme'
  | 'analyze_structure'
  | 'evaluate_expression';
```

动作来源优先级：

1. Rubric 中必答核心观察点；
2. `abilityMetadata.abilityId` 与 supporting ability；
3. 题干明确动作词；
4. 最低作答要求中的证据与解释约束。

归一化必须保留原始依据，不允许只保存归一化结论。

同一题允许：

- 一个主要动作；
- 最多一个与主要动作紧密依赖的支撑动作。

若存在三个或更多相互独立的核心动作，应产生复合负担 Finding，而不是把多余动作静默丢弃。

### 4.3 分析完整性

```ts
export type TextResponseLoadAnalysisCompleteness =
  | 'complete'
  | 'partial'
  | 'insufficient_input';
```

- `complete`：结构化输入足以形成完整画像；
- `partial`：可形成部分画像，但至少一个计数或动作只能保守估计；
- `insufficient_input`：字段不足，不能给出可靠分类。

`partial / insufficient_input` 只能进入审计提醒，不得在后续阶段直接用作发布阻断证据。

### 4.4 单题审计结果

```ts
export type TextResponseLoadAuditFinding = {
  code: TextResponseLoadFindingCode;
  severity: 'info' | 'warning' | 'high_risk';
  evidencePaths: string[];
  explanation: string;
  recommendedDisposition:
    | 'retain'
    | 'copy_or_length_adjustment'
    | 'decompose_or_refocus'
    | 'regenerate';
};

export type TextResponseLoadAuditResult = {
  questionVersionId: string;
  materialVersionId?: string;
  responseFormat: 'short_text' | 'long_text';
  analysisCompleteness: TextResponseLoadAnalysisCompleteness;
  profile?: TextResponseLoadProfile;
  findings: TextResponseLoadAuditFinding[];
  disposition:
    | 'retain'
    | 'copy_or_length_adjustment'
    | 'decompose_or_refocus'
    | 'regenerate';
  analyzerVersion: 'reading_open_response_input_load_audit_v1';
};
```

### 4.5 题组审计结果

```ts
export type TextResponseTaskGroupLoadAudit = {
  materialVersionId: string;
  orderedQuestionVersionIds: string[];
  textQuestionCount: number;
  singleChoiceCount: number;
  levelDistribution: Record<TextResponseLoadLevel, number>;
  sequenceFindings: TextResponseLoadAuditFinding[];
  questionResults: TextResponseLoadAuditResult[];
};
```

单项选择只作为题组进入层与顺序上下文参与审计，不生成 `TextResponseLoadProfile`。

## 五、负担等级计算规则

### 5.1 `entry_short`

典型特征：

- 一个明确对象；
- 零到一个证据单元；
- 不要求组织复杂关系；
- 完成信息定位、直接提取或一句局部判断；
- 推荐答案很短，但学生端不显示推荐字数。

### 5.2 `focused_short`

典型特征：

- 一个主要动作；
- 一个对象或一组高度相关对象；
- 一到两个局部证据单元；
- 需要一句解释或证据—结论连接；
- 不要求跨大范围整合。

### 5.3 `developing`

典型特征：

- 一个主要动作加一个紧密依赖的支撑动作；
- 两个证据单元，或一个明确关系；
- 需要组织局部证据并形成较完整说明；
- 可以涉及比较、推断或局部结构分析。

### 5.4 `integrated`

典型特征：

- 多证据或跨段整合；
- 两个及以上关系，或多个对象之间的组织；
- 面向人物、主题、结构、表达效果等综合分析；
- 仍须保持题目边界清楚，不等于允许无限复合。

### 5.5 负担等级不是能力结论

下列推断全部禁止：

```text
学生 integrated 题答错
→ 学生只能做 developing              // 禁止

学生完成 entry_short
→ 学生已掌握对应宏观能力              // 禁止

某题 loadLevel = integrated
→ 该题自动更有教学价值                // 禁止
```

`loadLevel` 只描述完成当前题目所需承担的输入与组织负担。

## 六、推荐长度与最低字数审计

### 6.1 长度单位

第一版内部计数规则冻结为：

- 使用 Unicode code point 计数；
- 去除首尾空白；
- 不把换行和连续空格作为有效回答长度；
- 不以字节数或 UTF-16 code unit 计数；
- 与 Learning 当前 `Array.from(answer.trim()).length` 的实现保持可解释兼容，但阶段 1 不修改 Learning。

### 6.2 推荐长度带

推荐长度带由以下因素共同决定：

- 主要动作与支撑动作数量；
- 必需证据单元数量；
- 必需关系数量；
- 必需对象数量；
- Rubric 必答观察点数量；
- `short_text / long_text` 作答形式。

推荐长度带不是学生最低作答要求。

阶段 1 只审计以下错配：

- 简单局部动作却设置过高最低字数；
- Rubric 要求多证据整合但最低作答要求过低；
- `short_text` 承担明显综合负担；
- `long_text` 只要求单一直接提取；
- 最低字数成为判断完成质量的主要依据。

### 6.3 学生界面隔离

任何 Stage 1 产物不得进入：

- 题干；
- 作答要求；
- 提示；
- 字数指示器文案；
- 反馈页；
- 下一题说明。

Debug 必须证明学生端不会出现“建议回答 30–60 字”等派生文案。

## 七、复合动作与证据范围识别

### 7.1 允许

允许一个主要动作加一个紧密依赖的支撑动作，例如：

```text
找出局部证据
→ 解释该证据说明了什么
```

这里“找证据”服务于“解释”，不构成两个独立训练目标。

### 7.2 需要审计

下列情况产生 Finding：

- 同时要求概括、分析人物、联系主题且三个目标可独立评分；
- 证据范围只有一个短句，却要求多角度综合分析；
- 题干只写“结合全文分析”，Rubric 却包含多个未显式要求的核心观察点；
- 要求比较多个对象，却没有可区分的比较维度；
- 要求引用多处证据，但材料或题目范围无法支持；
- 题干、Rubric、能力元数据指向不同训练动作。

### 7.3 Finding Code

第一版冻结：

```ts
export type TextResponseLoadFindingCode =
  | 'analysis_input_incomplete'
  | 'composite_core_actions'
  | 'hidden_rubric_requirement'
  | 'evidence_scope_insufficient'
  | 'evidence_requirement_excessive'
  | 'object_scope_overloaded'
  | 'relation_load_overloaded'
  | 'response_format_load_mismatch'
  | 'minimum_length_overweighted'
  | 'minimum_length_under_supports_rubric'
  | 'unexplained_load_jump'
  | 'missing_entry_path'
  | 'duplicate_load_observation';
```

阶段 1 Finding 全部是只读审计结论，不产生发布状态变化。

## 八、题组梯度与顺序审计

### 8.1 等级序位

仅用于审计：

```text
single_choice 基础入口 = 0
entry_short             = 1
focused_short           = 2
developing              = 3
integrated              = 4
```

这个序位不表示学习价值高低。

### 8.2 正常示例

下列序列都可通过：

```text
single_choice → focused_short → developing → integrated
single_choice → entry_short → developing → integrated
focused_short → developing → integrated
single_choice → focused_short → integrated
```

最后一例可以成立，但分析器要确认 `integrated` 前已有足够的基础理解入口，或存在合法顺序理由。

### 8.3 不要求凑齐全部等级

梯度要求的是题组不存在无理由的负担跳跃，不要求：

- 每组必须有 `entry_short`；
- 每组必须有 `focused_short`；
- 每组必须有 `developing`；
- 每组必须有 `integrated`；
- 每组必须按固定模板排序。

缺少某个中间等级本身不是 Finding。

### 8.4 合法顺序例外

复用现有 Training Task Sequence Preference：

- `holistic_judgment_required`；
- `independent_expression_baseline`；
- `retest_after_training`；
- `transfer_in_new_context`；
- `no_qualified_single_choice`。

存在合法理由时，审计报告保留顺序事实，但不产生 `unexplained_load_jump`。

### 8.5 题组级提醒

阶段 1 可以报告：

- 首道文本题直接进入综合多证据分析且无说明；
- 连续多道题都要求高负担整合；
- 全组只有开放综合题，没有低负担进入路径；
- 多题在相同证据范围执行近似动作；
- 单选之后仍出现无支撑的巨大负担跃迁。

阶段 1 不自动调序。

## 九、既有题审计分类

### 9.1 `retain`

适用：

- 题干、Rubric、证据范围、作答形式与最低要求一致；
- 负担与所在题组位置基本合理；
- 没有高风险 Finding。

### 9.2 `copy_or_length_adjustment`

适用：

- 核心观察目标合理；
- 主要问题是最低字数、题干冗长、提示过重或作答形式轻微错配；
- 不需要改变正式题的核心证据与评分目标。

### 9.3 `decompose_or_refocus`

适用：

- 同一道题包含多个可独立评分的核心动作；
- 题干范围、证据范围或对象数量过大；
- 需要拆成更清楚的一项主要动作与一项支撑动作。

### 9.4 `regenerate`

适用：

- 题干、Rubric、材料证据和能力目标实质不一致；
- 材料无法支持题目要求；
- 仅调整文案或长度无法恢复观察价值。

### 9.5 分类优先级

若同题出现多个 Finding，按以下优先级归类：

```text
regenerate
> decompose_or_refocus
> copy_or_length_adjustment
> retain
```

低置信度分析不得自动归为 `regenerate`；最多归入待人工审计的 `decompose_or_refocus` 建议，并显式标记 `analysisCompleteness`。

## 十、工程工作包与建议文件

### WP1.1 Schema 与守卫

实际新增：

- `src/ai/schemas/readingOpenResponseInputLoad.schema.ts`

包含：

- 负担等级；
- 规范化动作；
- 画像；
- Finding；
- 单题与题组审计结果；
- 运行时类型守卫；
- 稳定排序与去重辅助。

### WP1.2 纯函数分析器

实际新增：

- `src/ai/agents/readingOpenResponseInputLoadAnalyzer.ts`

职责：

- 只接受显式输入；
- 不访问浏览器存储；
- 不调用写仓储；
- 不调用模型；
- 不读取 Student Ability Profile；
- 输出稳定画像与单题 Finding。

### WP1.3 题组审计器

实际新增：

- `src/ai/agents/readingOpenResponseTaskGroupLoadAuditAgent.ts`

职责：

- 使用现有题组顺序；
- 读取现有 Sequence Preference；
- 检查进入路径和无理由跳跃；
- 不改变原顺序；
- 不写回任务组。

### WP1.4 正式题库只读审计服务

实际新增：

- `src/ai/services/readingOpenResponseInputLoadBaselineAuditService.ts`

职责：

- 只读取当前活动 Frozen Version 与关联 Material；
- 排除单项选择与非文本任务；
- 输出题目级、材料级和全库汇总；
- 输出四类治理数量与 Finding 分布；
- 审计前后校验正式资源状态哈希一致。

### WP1.5 Debug 入口

实际新增：

- `src/ai/tests/runReadingOpenResponseInputLoadStage1Debug.ts`
- `npm run debug:reading-open-response-load-stage1`

Debug 输出必须包含：

- 通过数 / 总数；
- 当前活动文本题总数；
- 分材料数量；
- 四类治理分布；
- Finding Code 分布；
- 不完整分析数量；
- 写入隔离校验结果。

## 十一、阶段 1 自动化 Debug 矩阵

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| S1-01 | `single_choice` 输入分析器 | 明确排除，不创建文本负担画像 |
| S1-02 | 单一信息定位短答 | 形成 `entry_short` |
| S1-03 | 局部证据加一句解释 | 形成 `focused_short` |
| S1-04 | 两处证据与一个关系 | 形成 `developing` |
| S1-05 | 跨段、多证据综合分析 | 形成 `integrated` |
| S1-06 | 一个主要动作加紧密支撑动作 | 不误报复合核心动作 |
| S1-07 | 三个独立必答动作 | 产生 `composite_core_actions` |
| S1-08 | Rubric 含题干未说明的必答项 | 产生 `hidden_rubric_requirement` |
| S1-09 | 单句证据要求多角度综合 | 产生 `evidence_scope_insufficient` |
| S1-10 | 简单局部题最低字数过高 | 产生 `minimum_length_overweighted` |
| S1-11 | 多证据 Rubric 但最低要求过低 | 产生 `minimum_length_under_supports_rubric` |
| S1-12 | `short_text` 承担综合多证据分析 | 产生 `response_format_load_mismatch` |
| S1-13 | 同一输入重复分析 20 次 | 画像、Finding、排序完全一致 |
| S1-14 | 字段不足 | 返回 `partial` 或 `insufficient_input`，不伪造高置信结果 |
| S1-15 | 推荐长度带生成 | 只存在审计结果，不生成学生可见文案 |
| S1-16 | `loadLevel` 输出 | 不写入 Student Ability Profile |
| S1-17 | `single_choice → focused_short → developing → integrated` | 通过梯度审计 |
| S1-18 | 缺少 `entry_short` 但顺序平滑 | 不因层级缺失报错 |
| S1-19 | `single_choice → integrated` 且无支撑 | 产生 `unexplained_load_jump` |
| S1-20 | `holistic_judgment_required` 先综合表达 | 合法例外，不报无理由跳跃 |
| S1-21 | Retest / Transfer 角色调整顺序 | 合法例外，不强制入口题在前 |
| S1-22 | 同证据、同动作连续重复 | 产生 `duplicate_load_observation` |
| S1-23 | 当前活动正式文本题全量审计 | 数量与活动 Frozen Version 口径一致 |
| S1-24 | 审计前后 Formal Version / Registry / Observation Link 哈希 | 完全一致，零写入 |
| S1-25 | 审计前后 Learning Session 与 Attempt | 完全一致，零写入 |
| S1-26 | 审计前后 Student Ability Profile | 完全一致，零写入 |
| S1-27 | 四类治理汇总 | 题目总数等于四类之和 |
| S1-28 | 真实基线重复运行与 Schema 守卫 | 报告和 Digest 稳定，Stage 1 自身无结构问题 |

阶段 1 专项 Debug 必须达到 `28 / 28`。

## 十二、当前正式题库基线报告要求

工程完成后已生成报告：

- [阶段 1 真实题库只读基线审计](../education/phase/reports/reading_open_response_input_load_stage1_baseline_audit_2026-08-20.md)；
- 报告记录执行时刻的真实活动资源口径；
- 不在本计划文档中预填固定题目数量，避免数据变化后失真。

报告至少包含：

| 维度 | 必需内容 |
| --- | --- |
| 资源范围 | 活动材料数、活动正式题数、文本题数、单选题数 |
| 负担分布 | 四个 `loadLevel` 的数量与比例 |
| 风险分布 | Finding Code 数量与涉及材料数 |
| 治理分类 | 四类 disposition 数量与比例 |
| 题组梯度 | 正常、存在合法例外、存在无理由跳跃的材料数 |
| 分析完整性 | complete、partial、insufficient_input 数量 |
| 写入隔离 | 正式资源、Learning、学生画像前后哈希 |
| 优先样本 | 后续阶段建议先处理的少量高风险题，不自动改题 |

基线报告不得把审计建议描述成“质量已经修复”。

## 十三、回归与写入隔离

### 13.1 必跑回归

阶段 1 实施后至少运行：

- 新增 Stage 1 专项 Debug；
- Question Resource Admission 相关 Debug；
- Training Task Sequence Planning Debug；
- Formal Resource Runtime / Registry 相关 Debug；
- Learning 正式资源读取与连续题组相关 Debug；
- Student Ability Profile 相关 Debug；
- `npm run build`。

具体脚本名以实施时仓库现状为准，验收报告必须记录实际命令与通过数。

### 13.2 零写入证明

审计前后必须比较：

- Frozen Question Version 集合与内容哈希；
- Formal Resource Registry；
- Observation Link；
- Material Version；
- Learning Session / Attempt；
- Student Ability Profile；
- Candidate / Revision / Assessment / Publication 状态。

任一发生变化，阶段 1 直接判定失败。

## 十四、失败处理与回滚

阶段 1 新能力必须是旁路、可移除的：

- 分析失败不得阻断当前生产与发布；
- 单题无法分析时记录 `analysis_input_incomplete`，继续其他题；
- 全库审计失败不得修改已有报告以外的任何状态；
- 删除新增分析器、审计服务和 Debug 入口即可回滚；
- 不需要回滚正式数据，因为阶段 1 禁止写正式数据。

## 十五、阶段完成条件

只有同时满足以下条件，才可以声明阶段 1 完成：

1. Schema、分析器、题组审计器和只读审计服务已落地；
2. Stage 1 专项 Debug `28 / 28`；
3. 同输入确定性测试通过；
4. 当前活动正式文本题基线报告已生成；
5. 四类治理数量之和等于审计题目总数；
6. 所有写入隔离哈希一致；
7. `loadLevel` 未进入 Student Ability Profile；
8. 推荐长度带未投射到学生页面；
9. 缺少某个中间等级不会被误判；
10. 合法顺序例外能够被识别；
11. 现有核心回归与生产构建通过；
12. 验收报告记录真实命令、通过数和残余风险。

### 15.1 实际执行记录

- Schema、单题分析器、题组审计器与只读基线服务已经落地；
- Stage 1 专项 Debug：`28 / 28`；
- 活动资源基线：24 份材料、79 道正式题，其中 62 道开放文本题全部完成分析；
- 四类治理数量：保留 21、文案或长度调整 11、拆分或聚焦 27、重新生成 3，总和等于 62；
- Frozen Version、Registry、Observation Link、Learning Session / Attempt 与 Student Ability Profile 写入隔离测试全部通过；
- 生产构建与五组相关主链回归通过；
- 详细命令、通过数、基线 Digest 和残余风险见[阶段 1 工程与 Debug 验收报告](../education/phase/reports/reading_open_response_input_load_stage1_engineering_debug_acceptance_2026-08-20.md)。

阶段 1 只完成观察能力与基线审计，没有自动修改上述正式题，也没有提前开始阶段 2。

## 十六、进入阶段 2 的门槛

进入阶段 2 前必须确认：

- 负担画像定义在真实题库上可稳定计算；
- 高风险 Finding 不是由明显规则误判造成；
- 推荐长度带没有学生端泄露；
- 审计没有写入正式资源；
- 当前正式题库不因审计发生状态变化；
- 已选出少量固定样例用于 Planner / Prompt 对照测试；
- 阶段 2 仍只生成 Candidate，不直接改正式题。

未满足时不得用不稳定画像驱动 Prompt 或发布门禁。

## 十七、最终工程原则

阶段 1 冻结为：

> 先以只读方式看清文本题的真实输入负担，再决定如何生成和治理；负担画像属于题目，不属于学生；推荐长度属于内部设计提示，不属于学生要求；梯度用于避免无理由跳跃，不用于机械凑层级。
