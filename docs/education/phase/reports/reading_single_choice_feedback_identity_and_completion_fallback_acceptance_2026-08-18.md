# 单选反馈身份与完成态兜底验收报告

日期：2026-08-18

结论：`PASS`

## 一、问题

单选作答提交后，正式 `StudentResponse.answerText` 合法保持为空，实际选择保存在 `singleChoiceAnswer`。受控反馈准入此前仍使用文本题规则比较 `answerText` 与选项展示文本，导致合法单选被误判为身份不一致。反馈链虽然保存了完成态，但页面没有展示受控失败信息，最终出现空白反馈卡片。

完成态可见性修复后，进一步暴露出反馈语义错投影：系统把学生所选的完整选项内容当作学生自主组织的文本答案，再根据题干中的“为什么”等词语推导出“解释没有写出来”和“重新组织答案”。单选本轮只要求完成判断，并没有要求学生书面解释，因此该反馈不成立。

## 二、契约调整

- 单选答案身份冻结为 `selectedOptionIds + optionSetVersion + displayedOptionOrder + Response / Task / Session identity`；
- 选项内容只用于学生可读表达，不替代结构化正式答案；
- 文本题继续校验 `answerText`，单选按结构化作答校验；
- 结果页展示优先级冻结为 Narrative、结构化点评、受控反馈、最低安全说明；
- 已进入结果态的轮次不得只显示空白反馈容器。
- 单选选项内容只表示“本次选择”，不得解析为学生自主写出的观点、依据或解释；
- 正确选择只确认本次判断，错误选择只呈现对应干扰项的理解偏差与材料核对范围；
- 单选不得生成 `missing_text_evidence`、`missing_reasoning_relation`，也不得要求补写解释、重新组织答案或修改本次选择。

## 三、工程修复

1. `ControlledFeedbackExpressionAgent` 按 `responseFormat` 分流身份校验。
2. 单选使用 Frozen Delivery 校验选项集合版本、选择 ID 与展示顺序。
3. Learning 完成页增加可测试的最低反馈解析策略。
4. 受控失败保留原有标题、摘要与下一步；旧记录缺少反馈对象时显示“本轮结果已保存”。
5. `StudentThinkingReview` 按 `responseFormat` 分流：单选只生成 `choice_judgment` 覆盖结果。
6. `StructuredFeedbackFacts / TeachingPlan` 对单选不建立文本陈述、文本细节与修订动作。
7. `StudentLearningNarrative` 使用单选专用投影；页面使用“本次选择 / 需要核对 / 回到材料看看”，不再复用文本题标题。

## 四、验收结果

| 验收项 | 结果 |
| --- | --- |
| 单选答错进入 Diagnosis、Evidence 与受控反馈 | PASS |
| 单选答对保持克制且生成可读反馈 | PASS |
| 选项版本或展示顺序错位在正式链路前阻断 | PASS |
| 受控反馈失败时完成页不为空 | PASS |
| 旧单选完成态缺少反馈对象时显示最低说明 | PASS |
| 文本题反馈身份校验保持原规则 | PASS |
| 刷新恢复继续读取同一正式 Attempt | PASS |
| 正确单选只确认本次判断，不生成能力掌握结论 | PASS |
| 不同错误选项呈现各自 `diagnosisMeaning` 与 `evidenceBoundary` | PASS |
| 单选不生成文本证据、解释关系或答案改写要求 | PASS |
| 单选 Teaching Plan 不创建文本修订动作 | PASS |

自动化结果：

- Reading single-choice Stage 4 E2E：`13/13 PASS`；
- Learning Feedback Presentation：`10/10 PASS`；
- Controlled Feedback Expression：`62/62 PASS`；
- Phase 16.3 Real Learning Chain：`16/16 PASS`；
- Unified Learning Entry：`24/24 PASS`；
- Student Learning Narrative：`30/30 PASS`；
- Phase 17.3 Learning Entry：`16/16 PASS`；
- Phase 17.3 Batch A Integration：`17/17 PASS`；
- Vite production build：`PASS`。

## 五、边界

- 修复不修改已发布题目、正确答案、选项顺序或正式学习证据；
- 不把选项文本写入 `answerText`；
- 不重新提交当前学生作答；
- 最低安全说明只保证结果可理解，不生成未经 Evidence 支持的能力结论。
- 第一版仍不开放反馈后改选；后续解释与证据组织由独立文本任务观察，不投射为本次单选的漏答项。
