# 阅读开放文本题输入负担阶段 1 基线审计

状态：`READ-ONLY BASELINE / COMPLETED WITH PRE-EXISTING DATA ISSUES`

执行日期：`2026-08-20`

策略版本：`reading_open_response_input_load_policy_v1_1`

审计版本：`reading_open_response_input_load_audit_v1`

Source Digest：`fnv1a-65117aad`

Audit Digest：`fnv1a-adf815ec`

## 一、结论

阶段 1 已对当前活动正式文本题完成一次确定性、只读基线审计。24 份活动材料共有 79 道正式题，其中 62 道为开放文本题、17 道为单项选择；62 道文本题全部得到完整画像，没有 partial 或 insufficient_input。

当前开放文本题的输入负担明显偏向中高段：`developing + integrated` 共 55 道，占 62 道文本题的 88.7%；`entry_short + focused_short` 共 7 道。该结果支持“现有阅读输入题整体起步较重”的使用感受，但不等于 55 道题都不合格。后续应按治理分类逐题生成后继 Candidate，不得整批覆盖正式题。

## 二、资源口径

| 资源 | 数量 |
| --- | ---: |
| 活动材料 | 24 |
| 核心阅读材料 | 12 |
| 针对性短片段 | 12 |
| 活动正式题 | 79 |
| 核心阅读正式题 | 61 |
| 针对性短片段正式题 | 18 |
| 开放文本题 | 62 |
| 单项选择题 | 17 |
| 完整分析 | 62 |
| 部分分析 / 输入不足 | 0 / 0 |
| 题组 | 24 |

## 三、负担与治理分布

### 3.1 负担等级

| 负担等级 | 数量 |
| --- | ---: |
| entry_short | 1 |
| focused_short | 6 |
| developing | 28 |
| integrated | 27 |

### 3.2 治理建议

| 建议 | 数量 |
| --- | ---: |
| retain | 21 |
| copy_or_length_adjustment | 11 |
| decompose_or_refocus | 27 |
| regenerate | 3 |

四类建议合计 62，与本次审计的开放文本题总数一致。建议是旁路治理输入，不会修改或撤回正式题。

## 四、主要 Finding

| Finding | 数量 |
| --- | ---: |
| composite_core_actions | 5 |
| hidden_rubric_requirement | 20 |
| evidence_scope_insufficient | 3 |
| object_scope_overloaded | 4 |
| relation_load_overloaded | 3 |
| response_format_load_mismatch | 4 |
| minimum_length_under_supports_rubric | 13 |

题组顺序旁路审计另外记录：`unexplained_load_jump` 15、`missing_entry_path` 20、`duplicate_load_observation` 2。这些结果用于后续人工确认与阶段 2 对照样本，不在阶段 1 自动调整顺序或补题。缺少某个负担层级本身不构成问题，只有无合理说明的跳跃才进入后续审查。

## 五、优先复核样本

当前 3 道 `regenerate` 建议均来自证据范围与题目要求不匹配：

1. 《狼》“分析 · 主旨理解”：要求从屠户和狼两个角度说明并引用依据，但当前证据范围不足；
2. 《猫》“推理 · 无法补救的悔恨与主题”：要求结合全文推断并说明主题作用，但当前证据范围不足；
3. 《秋天的怀念》“分析 · 句子作用分析”：局部证据同时承载结构、情感两方面分析，且存在关系负担和 responseFormat 错配。

阶段 1 不修改这三道题。后续只允许生成后继 Candidate，并继续由用户执行“采用并发布 / 不采用并重新优化”。

## 六、既有数据问题

上游正式资源基线最初报告 36 条提示：

- `frozen_quality_trace_missing`：18；
- `learning_identity_mismatch`：18（由同一批 Trace 缺失派生，不是另外 18 道结构身份错误）。

实际根因是 18 道 `targeted_excerpt` 正式题缺少 Frozen Quality Trace。旧基线把 Trace 缺失同时纳入身份一致性表达，形成重复提示；这不是 36 个独立问题。这些问题在阶段 1 审计之前已经存在，不是本次负担分析产生的错误。阶段 1 保留上游执行时事实，不静默修复、不改变当前正式资源身份。后续修复结果另见独立一致性报告，不能回写篡改本报告的执行时基线。

## 七、零写入边界

专项 Debug 已验证审计前后以下对象保持一致：

- Frozen Question Version；
- Formal Resource Registry；
- Observation Link；
- Learning Session / Attempt；
- Student Ability Profile。

`loadLevel` 与 `expectedAnswerLengthBand` 只存在于派生审计结果，没有进入学生页面，也没有形成新的学生能力结论。
