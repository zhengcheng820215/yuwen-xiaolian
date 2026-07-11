# 评估案例集（Evaluation Case Set）

## 文档定位

本文档用于记录 AI 语文能力诊断与成长系统中的关键评估样例。

它不是正式题库，也不是完整测试体系，而是一个轻量的测试样例资产库。

本文档回答：

```text
当学生输入不同质量的答案时，系统应该如何判断？
哪些结论是不允许输出的？
哪些 case 应该沉淀为 Debug 自动测试？
```

## 核心原则

每个 case 必须明确：

- Case ID；
- 输入是什么；
- 发生在哪个场景；
- 预期模式是 Strict 还是 Range；
- 预期 `answerStatus` 是什么；
- 预期 `evidenceType` 是什么；
- 为什么这样判断；
- 严重程度；
- 不允许输出什么；
- 是否需要进入 Debug 自动测试。

本文档特别关注以下风险：

- 无效答案被误判为能力薄弱；
- 一次好答案被误判为能力已经提升；
- 部分相关答案被误判为完全满足；
- 复测证据不足时仍然强行判断训练有效；
- AI 输出过度教育结论。

底层约束：

```text
“能力提升”不是 AI 输出的描述字段，
而是一个需要经过时间、多次表现和独立复测才能成立的状态。
```

因此，单个 case 可以形成 evidence，但不能单独证明长期能力提升。

## Case ID 规则（Case ID Rules）

| Prefix | 类型 | 说明 |
| --- | --- | --- |
| `INV` | Invalid Answer | 空答案、纯数字、敷衍答案、无关内容 |
| `PAR` | Partial Answer | 部分相关但缺少关键能力要素 |
| `GOD` | Good Answer | 较好答案，可形成正向证据或改善迹象 |
| `TRF` | Transfer / Retest | 训练后复测迁移判断 |
| `OVR` | Overclaim Risk | 过度结论风险 |

示例：

```text
INV-002: 纯数字复测答案 445
TRF-001: 训练 positive，复测 growth
OVR-001: 单次 positive 禁止宣布能力提升
```

## 预期类型（Expectation Type）

| 类型 | 含义 | 示例 |
| --- | --- | --- |
| `Strict` | 预期结果必须唯一匹配 | `445 -> insufficient_evidence / insufficient` |
| `Range` | 存在合理判断区间 | `因为母亲很心疼 -> growth 或 weakness` |

使用原则：

- 无效答案、过度结论风险优先使用 `Strict`。
- 部分答案、边界答案可以使用 `Range`。
- `Range` 不等于随意判断，必须写清楚允许范围和不允许范围。

## 严重程度（Severity）

| 严重程度 | 含义 | 是否阻止 Phase 冻结 |
| --- | --- | --- |
| `Critical` | 会污染能力画像、产生错误教育结论或误导下一步任务 | 是 |
| `Major` | 影响判断质量，需要修复或人工复核 | 通常阻止，除非明确记录为 REVIEW |
| `Minor` | 文案、展示或轻微体验问题 | 否 |

示例：

- 无效答案被写入 `weakness`：`Critical`
- 单次好答案被宣布能力已经提升：`Critical`
- `partially_meets` 与 `does_not_meet` 边界争议：`Major`
- 文案略显生硬：`Minor`

## 无效答案案例（Invalid Answer Cases）

无效答案指学生输入为空、纯数字、纯符号、明显敷衍或与任务无关，无法形成有效能力证据。

### INV-001：空答案

- 输入：空答案
- 场景：Diagnosis / Retest
- Expectation Type：`Strict`
- strict_expected:
  - answerStatus: `insufficient_evidence`
  - evidenceType: `insufficient`
- rationale：没有任何可分析内容，不能形成能力证据。
- severity：`Critical`
- 不允许输出：
  - `weakness`
  - `still_weak`
  - 缺少推理链
  - 缺少文本依据
- debug：待补充或由现有 invalid case 覆盖

### INV-002：纯数字复测答案 445

- 输入：`445`
- 场景：Retest
- Expectation Type：`Strict`
- strict_expected:
  - answerStatus: `insufficient_evidence`
  - evidenceType: `insufficient`
  - sessionStatus: `needs_more_evidence`
- rationale：没有可分析的语义内容，不能形成复测迁移证据。
- severity：`Critical`
- 不允许输出：
  - `still_weak`
  - `likely_improved`
  - 训练有效
  - 训练无效
- debug：
  - `runRetestExecutionDebug.ts`

### INV-003：纯数字复测答案 889

- 输入：`889`
- 场景：Retest
- Expectation Type：`Strict`
- strict_expected:
  - answerStatus: `insufficient_evidence`
  - evidenceType: `insufficient`
  - sessionStatus: `needs_more_evidence`
- rationale：与 `INV-002` 同类，属于非空但无有效语文作答内容。
- severity：`Critical`
- 不允许输出：
  - `still_weak`
  - `likely_improved`
  - 能力不稳定
  - 出现改善迹象
- debug：建议后续加入 `runRetestExecutionDebug.ts`

### INV-004：敷衍回答“哈哈”

- 输入：`哈哈`
- 场景：Diagnosis / Retest
- Expectation Type：`Strict`
- strict_expected:
  - answerStatus: `insufficient_evidence`
  - evidenceType: `insufficient`
- rationale：输入虽然包含中文，但没有与题目任务相关的分析内容。
- severity：`Critical`
- 不允许输出：
  - 缺少推理链
  - 缺少文本依据
  - 能力薄弱
  - 能力不稳定
- debug：建议后续覆盖 Diagnosis 与 Retest 两条链路

### INV-005：明确不会作答

- 输入：`不知道` / `不会` / `不懂`
- 场景：Diagnosis / Retest
- Expectation Type：`Strict`
- strict_expected:
  - answerStatus: `insufficient_evidence`
  - evidenceType: `insufficient`
- rationale：学生表达的是无法作答状态，不是可分析的能力表现。
- severity：`Major`
- 不允许输出：
  - 能力薄弱
  - 能力不稳定
  - 缺少文本依据
- debug：待补充

判断规则：

```text
无有效作答内容 -> 不判断具体能力缺口
无有效复测证据 -> 不判断训练是否有效
```

## 部分答案案例（Partial Answer Cases）

部分答案指学生答案包含一些相关内容，但缺少关键能力要素。

### PAR-001：只有情感判断，没有文本依据

- 输入：`因为母亲很心疼`
- 场景：Retest
- Expectation Type：`Range`
- allowed_expected:
  - answerStatus: `partially_meets`
  - evidenceType: `growth` 或 `weakness`
- rationale：答案包含人物心理判断，但缺少文本线索和依据说明。
- severity：`Major`
- 不允许输出：
  - `fully_meets`
  - `positive`
  - 能力已经提升
- debug：建议后续补充

### PAR-002：有线索和心理，但解释关系不足

- 输入：`母亲扶正菜苗，所以她心疼`
- 场景：Retest
- Expectation Type：`Range`
- allowed_expected:
  - answerStatus: `partially_meets`
  - evidenceType: `growth` 或 `weakness`
- rationale：答案包含文本线索和心理推断，但“线索如何支持心理”的解释仍较弱。
- severity：`Major`
- 不允许输出：
  - 能力已经掌握
  - 稳定提升
- debug：建议后续补充

### PAR-003：表层行为描述

- 输入：`父亲很喜欢整理东西`
- 场景：Diagnosis
- Expectation Type：`Range`
- allowed_expected:
  - answerStatus: `does_not_meet` 或 `partially_meets`
  - evidenceType: `weakness`
- rationale：答案与文本行为相关，但没有完成题目要求的心理推断。
- severity：`Major`
- 不允许输出：
  - 无证据地输出长期能力不足
  - 能力已经稳定薄弱
- debug：已被 Phase 7.1 / Phase 7.3 mock 主链路间接覆盖

判断规则：

```text
有相关内容，但缺少文本依据、推理链或解释关系 -> 可以形成 weakness / growth evidence
```

## 良好答案案例（Good Answer Cases）

较好答案指学生答案包含文本依据、能力动作和解释关系，能够形成正向证据或改善迹象。

### GOD-001：文本依据与解释关系完整

- 输入特征：有文本依据 + 心理推断 + 说明关系
- 场景：Retest
- Expectation Type：`Strict`
- strict_expected:
  - answerStatus: `fully_meets`
  - evidenceType: `positive`
- rationale：答案同时满足复测题的文本线索、心理推断和关系说明要求。
- severity：`Major`
- 不允许输出：
  - 能力已经提升
  - 能力已经掌握
  - 薄弱点已经解决
- debug：
  - `runRetestExecutionDebug.ts`

### GOD-002：训练后表现较好，复测出现迁移

- 输入特征：训练前存在 weakness；训练后表现较好；复测中出现新文本迁移表现
- 场景：Retest / Session Result
- Expectation Type：`Range`
- allowed_expected:
  - answerStatus: `fully_meets` 或 `partially_meets`
  - evidenceType: `positive` 或 `growth`
  - changeStatus: `likely_improved`
- rationale：训练与复测均出现正向信号，但仍不足以证明长期稳定提升。
- severity：`Major`
- 不允许输出：
  - 薄弱点已经解决
  - 稳定提升
  - 已经掌握
- debug：
  - `runBetaLearningSessionResultDebug.ts`

判断规则：

```text
较好答案可以形成 positive evidence。
一次复测较好只能说明出现改善迹象，不能证明长期稳定提升。
```

## 复测迁移案例（Retest Transfer Cases）

复测迁移 case 用于判断训练后的方法是否能迁移到新文本、新情境或新表达任务。

### TRF-001：训练 positive，复测 growth

- 输入表现：训练中 `positive`，复测 `growth`
- 场景：Session Result
- Expectation Type：`Strict`
- strict_expected:
  - changeStatus: `likely_improved`
  - sessionStatus: `completed`
- rationale：训练和复测都出现改善信号，可以判断为可能改善，但不能宣布稳定提升。
- severity：`Major`
- 不允许输出：
  - 已经掌握
  - 稳定提升
  - 能力已经提升
- debug：
  - `runBetaLearningSessionResultDebug.ts`

### TRF-002：训练 positive，复测 insufficient

- 输入表现：训练中 `positive`，复测 `insufficient`
- 场景：Session Result
- Expectation Type：`Strict`
- strict_expected:
  - changeStatus: `needs_more_evidence`
  - sessionStatus: `needs_more_evidence`
- rationale：复测没有形成有效迁移证据，不能判断训练是否真正有效。
- severity：`Critical`
- 不允许输出：
  - 训练有效
  - 训练无效
  - `likely_improved`
- debug：建议后续补充

### TRF-003：训练 positive，复测 weakness

- 输入表现：训练中 `positive`，复测 `weakness`
- 场景：Session Result
- Expectation Type：`Range`
- allowed_expected:
  - changeStatus: `not_transferred` 或 `still_weak`
  - sessionStatus: `needs_more_training`
- rationale：训练表现没有成功迁移到新文本或新情境。
- severity：`Major`
- 不允许输出：
  - 改善明显
  - 能力已经提升
- debug：建议后续补充

### TRF-004：训练 weakness，复测 positive

- 输入表现：训练中 `weakness`，复测 `positive`
- 场景：Session Result
- Expectation Type：`Range`
- allowed_expected:
  - changeStatus: `needs_more_evidence` 或 `likely_improved`
  - sessionStatus: `completed` 或 `needs_more_evidence`
- rationale：复测出现正向表现，但训练过程仍弱，需要结合更多证据判断是否稳定。
- severity：`Major`
- 不允许输出：
  - 直接宣布能力提升
  - 薄弱点已经解决
- debug：建议后续补充

判断规则：

```text
Retest evidence 权重高于 training evidence。
但单次 retest positive / growth 仍只能说明改善迹象或可能改善。
```

## 过度判断风险案例（Overclaim Risk Cases）

过度结论风险 case 用于约束 AI 不要把单次表现写成长期结论。

### OVR-001：单次 positive 禁止宣布能力提升

- 条件：有一条 `positive` evidence
- 场景：Profile / Session Result / Stage Report
- Expectation Type：`Strict`
- strict_expected:
  - 允许输出：本次表现满足要求
  - 禁止输出：能力已经提升
- rationale：单条正向证据只能说明本次表现，不能证明长期变化。
- severity：`Critical`
- debug：建议后续进入 Profile / Report debug

### OVR-002：单次 growth 禁止宣布稳定提升

- 条件：有一条 `growth` evidence
- 场景：Profile / Session Result / Stage Report
- Expectation Type：`Strict`
- strict_expected:
  - 允许输出：出现改善信号
  - 禁止输出：能力稳定提升
- rationale：成长证据需要多次、跨任务、独立复测支撑后才能升级为阶段性改善。
- severity：`Critical`
- debug：建议后续进入 Ability Change / Stage Report debug

### OVR-003：复测证据不足时禁止判断训练有效

- 条件：复测 `insufficient`
- 场景：Session Result
- Expectation Type：`Strict`
- strict_expected:
  - changeStatus: `needs_more_evidence`
  - sessionStatus: `needs_more_evidence`
- rationale：复测没有形成有效迁移证据时，不能判断训练有效或无效。
- severity：`Critical`
- debug：建议后续补充

### OVR-004：一次训练答案完整不等于已经掌握

- 条件：一次训练答案完整
- 场景：Training / Profile / Session Result
- Expectation Type：`Strict`
- strict_expected:
  - 允许输出：本次训练表现较好
  - 禁止输出：已经掌握该能力
- rationale：训练环境中的好表现仍需新题、新文本或新情境复测验证。
- severity：`Critical`
- debug：建议后续补充

## 当前已进入 Debug 的案例（Debug Cases）

| Case ID | Debug 入口 | 状态 |
| --- | --- | --- |
| `INV-002` | `runRetestExecutionDebug.ts` | PASS |
| `GOD-001` | `runRetestExecutionDebug.ts` | PASS |
| `GOD-002` | `runBetaLearningSessionResultDebug.ts` | PASS |
| `TRF-001` | `runBetaLearningSessionResultDebug.ts` | PASS |

## 后续维护规则

当 Demo 手测发现新的边界问题时，应按以下顺序处理：

```text
手测发现问题
-> 写入 Evaluation Case Set
-> 补 Debug 自动测试
-> 修复 Agent / Runtime
-> 重新运行 Debug / Build
```

提交、Issue、验收记录应优先引用 Case ID：

```text
fix: handle INV-002 in retest runtime
test: add regression case OVR-001
docs: add rationale for TRF-002
```

本文档不要求一次性覆盖所有题型。每次只沉淀对系统判断稳定性有价值的 case。

## Phase 冻结建议

当 `Critical` case 失败时，不应冻结当前 Phase。

当 `Major` case 失败时，应至少满足以下之一：

- 修复后重新验收；
- 明确标记为 REVIEW；
- 记录人工复核原因。

当 `Minor` case 失败时，可以不阻止 Phase 冻结，但应记录为后续体验优化。

## 本文档边界

本文档不包含：

- 正式题库；
- 完整评分标准；
- 大规模测试平台；
- 真实学生长期效果验证；
- 家长端报告样式。

本文档只服务于一个目标：

```text
让教育 AI Runtime 在关键边界输入下保持谨慎、稳定、可追溯。
```
