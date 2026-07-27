# 基于 Revision 的质量评估失效记录

日期：2026-07-27

## 结论

任何影响正式质量判断输入的编辑，都必须使相关 Assessment 失效，并要求基于新 Revision 重新评估。

```text
Formal Object Revision N
+ Assessment N
-> 编辑质量相关字段
-> Formal Object Revision N + 1
-> Assessment N 仅保留用于追溯
-> 重新评估
-> Review / Freeze / Publish
```

“失效”不表示删除旧版本。旧 Revision 和旧 Assessment 保留审计价值，但不能继续代表当前内容；已发布版本不会被编辑操作直接覆盖。

## 依赖范围

| 编辑对象 | 典型质量相关字段 | 必须失效的当前判断 |
| --- | --- | --- |
| Question | 题干、题型、作答格式、材料关联与题目范围 | 结构校验、题目质量评估、人工审核依据 |
| Rubric | 评分项、能力、重要程度、证据信号与解释要求 | Rubric 对齐、区分力、人工审核依据 |
| Answer Acceptance | 可接受答案、关键词、语义等价与最低作答要求 | 作答边界、评分一致性、人工审核依据 |
| Difficulty | 难度声明、任务步骤、提示量 | 难度一致性与资源匹配判断 |
| Ability Mapping | 主要能力、辅助能力、前置能力、任务角色 | Observation Clarity、Coverage 与匹配判断 |
| Material Observation | Observation Focus、Dimension、Ability、Anchor、Material Version | Plan Validation、下游 Question Quality 与 Observation Link |

审核说明、页面展开状态、筛选条件等不改变正式对象内容的操作，不触发质量评估失效。

## 当前工程落实

题目审核与发布平台统一使用质量相关编辑入口：

1. 当前 Draft 尚未形成 Validation 或 QuestionQualityAssessment 时，继续正常编辑，不显示多余的失效提示；
2. 已形成检查结果后，编辑任一持久化正式字段，页面立即停止展示旧结果为当前结论；
3. 提交审核保持阻断，直到保存修改、形成新 Draft Revision，并完成新的结构检查与题目质量评估；
4. AI 题干建议与人工编辑遵循同一规则；
5. 审核备注不触发失效。

后端继续以 `draftId + resourceId + assessedDraftRevision + validationId + ruleVersion` 判断 Assessment 是否为当前结果，因此旧结果即使保留，也不能被新 Revision 的 Review 或 Freeze 消费。

## 验收结果

- Question Quality Assessment：`14 / 14 PASS`；
- Phase 17.5B Review Gate：`9 / 9 PASS`；
- Question Stem Optimization：`5 / 5 PASS`；
- Production Build：`PASS`；
- `git diff --check`：`PASS`。

验收同时修正了 Review Gate Debug 中硬编码旧规则版本的问题。测试现在读取正式 `QUESTION_QUALITY_RULE_VERSION`，避免质量规则升级后产生与运行时无关的假失败。

## Material Observation 后续约束

当前 Observation Plan 已具备 Revision 与 Anchor 版本边界。后续补充正式质量评估时，应采用依赖定向失效：

- 修改某一 Observation，只重评直接依赖它的 Question 与 Link；
- 修改 Material Version 或使 Anchor 失效时，相关 Plan 与下游资源全部进入重新确认；
- 不删除历史 Plan、Question、Assessment 或 Frozen Resource；
- 不允许通过改写旧对象绕过重新审核。

## 验收边界

本次补强证明题目编辑器的质量相关字段统一触发旧检查失效，并沉淀跨对象规则。它不表示 Material Observation 已具备完整自动依赖图，也不表示系统已建立资源使用后的自动优化闭环。
