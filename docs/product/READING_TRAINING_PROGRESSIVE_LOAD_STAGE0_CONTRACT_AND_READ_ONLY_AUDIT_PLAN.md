# 阅读训练递进负担模型阶段 0：契约与只读审计计划

状态：`ENGINEERING COMPLETE / DEBUG 24/24 PASSED / READ-ONLY VERIFIED`

对应契约：`reading_training_progressive_load_policy_v2`

更新日期：2026-08-21

## 一、阶段目标

阶段 0 按以下顺序执行：

1. 冻结上位契约与兼容规则；
2. 建立版本化、纯函数式 `legacy_projection`；
3. 按 Learning 实际消费顺序审计现有正式题组；
4. 输出可机器读取与可人工复核的报告；
5. 完成 Debug 矩阵与真实题库只读验收。

阶段 0 只回答“现有数据能否支持递进训练解释、缺口在哪里”，不启用新发布门禁，也不修改 Learning 行为。

### 1.1 贯穿性双重验收

阶段 0 同样遵循上位契约的统一原则：**每个阶段都必须证明旧主链零回归，并且新语义只在该阶段允许的边界内生效。**

本阶段必须分别证明：

- 既有生产、发布、Learning 消费及相关专项回归不因只读审计接入而变化；
- 新的 `legacy_projection`、Finding 与审计摘要只存在于只读审计输出中，不写入正式对象，不成为发布阻断或学生能力结论。

## 二、绝对禁止的写入

阶段 0 不得修改：

- Formal / Frozen Question Resource Version；
- Registry Entry 与 Resource Observation Link；
- Material、Observation Plan 与 TrainingTask；
- QuestionCandidate、Assessment、Review 或 Publication 状态；
- Learning Session、Task Queue、Attempt、Diagnosis、Revision、Evidence；
- Student Ability Profile。

审计前后必须比较 Store Revision 和关键集合摘要；发生变化即验收失败。

## 三、审计投影

每道正式题生成 `TaskLoadSemanticsProjection`：

- `questionVersionId / materialVersionId / observationTaskPlanId`；
- `responseFormat / taskRole / abilityId`；
- `sequenceRole / primaryAction / supportingAction / textLoadLevel`；
- `derivationSource = legacy_projection`；
- `confidence = high | medium | low`；
- `completeness = complete | partial | insufficient`；
- `evidencePaths` 与 `limitations`。

单选通过正式交互、能力、顺序前置标签和题目语义派生；开放文本题复用 v1.1 Analyzer。不得把单选统一假设为第一题，也不得把文本题的最低字数当作主要难度依据。

## 四、题组审计

每个核心阅读题组按 Learning 实际顺序输出：

- 有效排序后的题目 ID；
- 各题负担角色与动作；
- 相邻过渡新增的责任；
- 是否存在无理由负担跳跃；
- 是否存在同对象、同证据、同目标的重复；
- 是否具有基础理解入口；
- 是否能区分基础理解、证据、关系、推理综合、表达组织；
- `traceable | partial | not_assessable` 的结构可解释性结论。

审计不要求所有题组出现全部负担等级。`holistic_first`、`retest`、`transfer`、Targeted Excerpt 单任务可以形成合法例外。

## 五、Finding 口径

阶段 0 使用独立 Finding，不直接复用发布错误：

- `projection_incomplete`
- `projection_low_confidence`
- `missing_accessible_entry`
- `unexplained_responsibility_jump`
- `duplicate_observation_scope`
- `cross_thread_comparison_invalid`
- `breakpoint_not_inferable`
- `task_overload_attribution_risk`
- `legacy_sequence_reason_missing`

这些 Finding 只用于治理排序，不投射为新的人工审核步骤或学生能力结论。

## 六、Debug 验收矩阵

| 编号 | 验收项 |
| --- | --- |
| S0-01 | 文本题完整投影为正确负担角色 |
| S0-02 | 单选题投影为基础入口且不伪造文本负担 |
| S0-03 | Retest / Transfer 投影为独立验证 |
| S0-04 | 缺少字段时保守降级，不抛出错误 |
| S0-05 | 相同输入重复运行结果与摘要一致 |
| S0-06 | entry → focused → developing → integrated 无跳跃 Finding |
| S0-07 | entry → integrated 无理由跳跃被识别 |
| S0-08 | holistic_first 合法例外不被机械阻断 |
| S0-09 | 不要求每个等级都必须出现 |
| S0-10 | 同对象、同证据、同动作重复被识别 |
| S0-11 | 跨观察线程不伪造失稳位置 |
| S0-12 | 题目过载只产生归因风险，不修改学生能力 |
| S0-13 | Targeted Excerpt 不被当作完整核心题组 |
| S0-14 | Learning 实际排序被审计而非历史插入顺序 |
| S0-15 | 真实活动正式题覆盖数与基线一致 |
| S0-16 | 真实核心题组全部有审计结果 |
| S0-17 | Formal Version / Registry / Link 审计前后不变 |
| S0-18 | Store Revision 审计前后不变 |
| S0-19 | Learning Session / Attempt 模拟对象不变 |
| S0-20 | Student Profile / Evidence 模拟对象不变 |
| S0-21 | 报告 Finding 汇总与逐项结果一致 |
| S0-22 | Schema Guard 拒绝未知版本和非法枚举 |
| S0-23 | 真实报告可稳定渲染并包含迁移限制 |
| S0-24 | 阶段 0 不调用任何保存或发布接口 |

## 七、阶段完成标准

只有同时满足以下条件才可以进入阶段 1：

1. S0-01—S0-24 全部通过；
2. 所有活动正式题均被覆盖或明确记录缺失原因；
3. 所有核心阅读题组均有只读审计结果；
4. 审计前后 Store Revision 与正式集合摘要一致；
5. 报告明确区分题目治理风险和学生能力结论；
6. 对低置信度历史投影保留迁移清单，不写回旧资源。
7. 已同时提供旧主链零回归证据和阶段 0 生效边界证据；缺少任一类证据不得进入阶段 1。
