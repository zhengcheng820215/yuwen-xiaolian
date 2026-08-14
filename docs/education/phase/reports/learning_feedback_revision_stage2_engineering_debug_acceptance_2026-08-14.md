# Learning 反馈后修订阶段 2 工程与 Debug 验收

日期：`2026-08-14`

状态：`STAGE 2 ENGINEERING + DEBUG PASS`

## 一、验收范围

本次只验收反馈后一次修订的第二阶段：

- 基于正式 Diagnosis、Feedback、Task Role 与 Requirement Coverage 的 Revision Offer Policy；
- 正式反馈页的 Revision Goal、推荐 / 可选动作和跳过路径；
- Revision Mode：题目、必要材料、只读首次回答、自动带入的修订输入框；
- 修订草稿保存、刷新恢复、离开确认与独立提交；
- 同一 Initial Attempt 只复用一个 LearningTaskAttempt，每题最多一个 Revision；
- Revised Response 不覆盖 Initial Response，不创建第二个题目校准 Attempt。

本阶段明确不实现 Revision Evaluation、feedback-supported Evidence、Profile / Growth Memory 接入或 Revision 扩展事件。这些仍分别属于阶段 3–4。

## 二、资格边界

第一版采用保守入口策略：

| 条件 | 结果 |
| --- | --- |
| `training + partially_meets + required missing gap` | 推荐“根据反馈修订” |
| `training + partially_meets + required partially_covered gap` | 可选“完善回答” |
| `fully_meets` | 不显示修订入口 |
| `does_not_meet / insufficient_evidence` | 不进入普通修订 |
| Retest / Transfer / Diagnosis / Observation | 不显示修订入口 |
| Feedback 未正式形成或缺口不可执行 | 不显示修订入口 |

Revision Goal 只保留一个主要问题和最多两个紧密相关问题，并绑定首次 Formal Diagnosis 与 Formal Feedback 身份。

## 三、工程产物

| 类型 | 文件 / 结果 |
| --- | --- |
| Offer Policy | `src/ai/agents/learningFeedbackRevisionOfferPolicy.ts` |
| Learning API 接线 | `src/api/phase163LiveLearning.ts` |
| 正式 Learning 页面 | `src/pages/Phase163LiveLearningWorkspace.jsx` |
| Revision UI | `src/components/continuous-learning/FeedbackGuidedRevision.jsx` |
| 幂等恢复加固 | `src/ai/services/learningFeedbackRevisionPersistenceService.ts` |
| 领域 Debug | `src/ai/tests/runLearningFeedbackRevisionStage2Debug.ts` |
| 浏览器验收 | `learning-feedback-revision-stage2.html` 与 `src/ai/tests/runLearningFeedbackRevisionStage2BrowserAcceptance.jsx` |

## 四、Debug 结果

| 验收组 | 结果 | 核心覆盖 |
| --- | ---: | --- |
| Revision Stage 2 领域 Debug | `28 / 28 PASS` | 资格矩阵、Goal、草稿、刷新恢复、独立提交、单次上限、跳过与未提交修订收口 |
| Revision Stage 2 浏览器交互 | `10 / 10 PASS` | Goal 与双动作、初答只读、自动带入、未修改禁用提交、保存、刷新恢复、独立提交 |
| Revision Stage 1 回归 | `26 / 26 PASS` | 身份、Schema、不可变、状态迁移和 Repository |
| Learning Persistence | `13 / 13 PASS` | 回合、答案草稿和提交恢复 |
| Phase 16.3 Real Learning Chain | `16 / 16 PASS` | 正式诊断、证据、下一任务与中断恢复 |
| Student Learning Narrative | `24 / 24 PASS` | 学生反馈事实与行动表达 |
| Unified Learning Entry | `24 / 24 PASS` | 入口优先级、恢复和阻断边界 |
| Production Build | `PASS` | Vite production bundle 成功 |

自动化领域与关联回归合计 `131 / 131 PASS`；另完成专项浏览器交互 `10 / 10 PASS`。

## 五、浏览器验收路径

1. 正式反馈视图展示一个“这次重点修改”和“根据反馈修订 / 继续下一项”；
2. 点击修订进入原题上下文；
3. 首次回答只读显示，修订输入框自动带入初答；
4. 未发生实质修改时“提交修订”禁用；
5. 修改后保存修订草稿；
6. 刷新页面，仍恢复同一 Revision 与完整草稿；
7. 提交后进入“修订已提交”；
8. Initial Response 内容保持不变；
9. Revised Response 独立保存；
10. Revision 数量保持为 1，不出现第三次修改入口。

## 六、验收结论

第二阶段工程已完成。学生现在可以在符合正式资格的 Training 回答反馈页中，自主选择跳过或进行一次反馈后修订；修订草稿和提交结果均基于阶段 1 正式 Repository 恢复，不依赖页面临时状态。

当前提交页只确认“修订已独立保存”，不评价是否改善。只有阶段 3 完成 Revision Evaluation 与 feedback-supported Evidence 后，产品才能向学生表达“改善了什么”；只有阶段 4 完成扩展事件、完整性审计和真实数据观察后，才能评价该机制的实际教育效果。
