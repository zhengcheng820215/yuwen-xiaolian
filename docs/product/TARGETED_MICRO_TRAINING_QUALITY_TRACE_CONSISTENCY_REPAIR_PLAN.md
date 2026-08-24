# 针对性微训练冻结质量轨迹一致性修复计划

英文名称：Targeted Micro-training Frozen Quality Trace Consistency Repair Plan

状态：`ENGINEERING COMPLETE / DATA REPAIR ACCEPTED`

文档版本：`targeted_micro_training_quality_trace_repair_v1.1`

日期：`2026-08-21`

## 一、问题结论

当前正式资源基线中的“18 条缺少冻结质量轨迹 + 18 条 Learning 身份不一致”不是 36 个独立问题。

真实范围为：

- 12 份活动 `targeted_excerpt` Material；
- 18 道当前 Frozen Resource；
- 18 道均具有活动 Registry Head 和 Observation Link；
- 18 道均缺少 `FrozenQuestionQualityTrace`；
- 旧身份判断把 Trace 缺失同时计入 `learning_identity_mismatch`，因此形成重复提示。

核心阅读的 61 道正式题具有完整质量轨迹并可被 Learning 消费。问题只阻断上述 18 道针对性微训练题，不要求重新生成或重新发布核心题。

## 二、修复目标

本次修复只完成：

1. 将“Trace 缺失”和“真实结构身份错位”分开报告；
2. 从既有审核证据为 18 道题补齐四类不可变质量工件；
3. 使当前 79 道正式题全部满足 Learning Consumable 身份条件；
4. 建立确定性、幂等、原子且可审计的修复入口。

## 三、明确非目标

本次不得：

- 修改 Material 正文或元数据；
- 修改题干、Rubric、选项、正确答案、作答格式或能力标签；
- 创建新的 Question Candidate、Draft Revision 或 Frozen Version；
- 切换 Registry Head；
- 重建或替换 Observation Link；
- 修改 Learning Session、Attempt、Diagnosis、Evidence 或 Student Ability Profile；
- 把缺少来源证据的记录伪造为质量通过。

## 四、修复前置条件

每个目标版本必须同时找到并对齐：

- 当前活动 `targeted_excerpt` Material Version；
- 当前 Reviewed Observation Plan 与非 cancelled Task；
- 与该 Task 对齐的正式 Material Source Anchor；修复质量证据时必须沿用这一冻结范围，避免把题干中的“待判断说法”或反例误判成正文直接引文缺失；
- Active Observation Link；
- Active Registry Head；
- Frozen Question Resource Version；
- Source Draft；
- 当前 Passed Validation；
- Frozen Version 引用的 Human Review。

任一前置条件缺失，本轮整体停止且零写入。只要已经存在 Trace，也必须验证其 `resourceId / resourceVersionId / sourceDraftId / validationId / reviewId`，不得静默覆盖冲突记录。

## 五、写入对象与原子性

每道目标题只允许追加：

```text
QuestionQualityAssessment
QuestionSemanticQualityAssessment
QuestionQualityAssessmentBundle
FrozenQuestionQualityTrace
```

四类集合必须通过同一个 Shared Formal Resource Atomic Command 提交。命令身份由修复策略版本与排序后的目标 Resource Version Id 确定；重复执行时复用 Command Receipt，或在已经完整时返回 no-op。

写入前后必须比较正式资源、观察链、Learning 和学生画像的稳定摘要。除 `questionQuality` 上述四类集合以及 Shared Store Revision / Command Receipt 外，其他业务集合不得变化。

## 六、身份错误去重

正式资源基线采用两个独立判断：

```text
structuralIdentityConsistent
= Material + Plan + Task Lineage + Link + Registry + Frozen Version

qualityTraceComplete
= Trace 存在且与 Frozen Version / Draft / Validation / Review 对齐
```

只有第一项失败，或已经存在的 Trace 与正式版本冲突时，才报告 `learning_identity_mismatch`。单纯缺少 Trace 只报告 `frozen_quality_trace_missing`，但 `learningConsumable` 仍为 false。

## 七、Debug 与验收

专项 Debug 至少覆盖：

1. 只选择活动 `targeted_excerpt` 的缺失 Trace；
2. 18 道真实记录前置证据完整；
3. Dry-run 零写入；
4. 四类质量工件数量一致；
5. 原子提交失败不留下部分工件；
6. 重复执行 no-op / 幂等；
7. 已存在同身份不同内容时阻断；
8. 修复前 Frozen Version、Registry、Link 摘要与修复后相同；
9. Learning / Student Ability Profile 不变；
10. 正式资源基线达到 `79 current tasks = 79 frozen traces = 79 learning consumable`；
11. `frozen_quality_trace_missing = 0`；
12. `learning_identity_mismatch = 0`；
13. Targeted Micro-training Stage 1—4、Learning 队列与生产构建回归通过。

## 八、回滚

Shared Formal Resource Store 在原子提交前保存上一 Revision 的备份。若提交或后续验收失败：

- 停止启用 targeted micro-training；
- 使用提交前备份恢复完整 Snapshot；
- 不单独删除某一类质量工件；
- 重新执行 Dry-run，确认目标与命令身份稳定后再处理。

## 九、完成条件

只有修复代码、专项 Debug、真实数据提交、79/79 基线、相关回归和修复报告全部通过，本文才更新为：

```text
ENGINEERING COMPLETE / DATA REPAIR ACCEPTED
```

## 十、实际执行结果

2026-08-21 已完成真实 Shared Formal Resource Store 修复：

- 修复命令：`targeted_quality_trace_repair_v1:fnv1a-a3a5ded3`；
- Store Revision：`1957 → 1958`；
- 目标版本：18；新增 Frozen Quality Trace：18；
- 当前正式任务 / Frozen Quality Trace / Learning Consumable：`79 / 61 / 61 → 79 / 79 / 79`；
- `frozen_quality_trace_missing：18 → 0`；
- `learning_identity_mismatch：0 → 0`；历史“18 条身份不一致”已通过口径去重，不再把 Trace 缺失重复计为结构身份错误；
- Material、Plan、Task、Draft、Validation、Review、Frozen Version、Registry、Observation Link 与 Learning 数据未修改；
- 重复 Dry-run 返回 no-op，原子故障注入确认零部分写入；
- Targeted Micro-training Stage 1—4、Learning Session Task Queue、阅读开放文本负担 Stage 1、正式资源基线与生产构建均通过。

详细证据见[针对性微训练冻结质量轨迹一致性修复验收报告](../education/phase/reports/targeted_micro_training_quality_trace_consistency_repair_2026-08-21.md)。
