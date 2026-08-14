# Learning 反馈后修订阶段 3 工程与 Debug 验收

日期：`2026-08-14`

状态：`STAGE 3 ENGINEERING + AUTOMATED DEBUG PASS`

## 一、验收范围

本次验收反馈后一次修订的第三阶段：

- Revised Response 进入与首次回答一致的正式 Diagnosis Boundary；
- Revision Evaluation 比较同一冻结题目版本下的 Initial / Revised Formal Diagnosis；
- 形成 `improved / partially_improved / unchanged / regressed` 四类结果；
- 形成独立的 `feedback_supported` Revision Evidence；
- Profile 只追加证据，Growth Memory 保留“反馈支持”条件和独立验证要求；
- 评价失败时保留修订答案，自动恢复时只补评价；
- 学生端展示改善、剩余问题和下次独立作答行动，不提供第三次修改。

阶段 3 不新增 Revision 扩展事件、指标聚合或教育效果结论；这些属于阶段 4。

## 二、验收边界

| 边界 | 实现结论 |
| --- | --- |
| 诊断来源 | Initial / Revised 都必须是已提交的 Formal Diagnosis |
| 版本身份 | Evaluation 固定绑定 Diagnosis、Resource Version、Rubric Version |
| 结果判断 | 只比较正式 answer status 与 rubric gap，不使用关键词或字数启发式 |
| Evidence | 固定 `supportLevel=feedback_supported`，confidence `<= 0.6` |
| Profile | 固定 `append_evidence_only`，能力状态不变 |
| Growth Memory | 记录支持条件、局限与 Retest / Transfer 验证要求 |
| 失败恢复 | Revised Response 不回滚；恢复只补评，不重新提交 |
| 学生交互 | 只展示评价与继续入口，不展示分数或第三次编辑入口 |

## 三、工程产物

| 类型 | 文件 / 结果 |
| --- | --- |
| Evaluation Agent | `src/ai/agents/learningFeedbackRevisionEvaluationAgent.ts` |
| Schema 与 Evidence | `src/ai/schemas/learningFeedbackRevision.schema.ts`、`abilityEvidence.schema.ts` |
| Profile 受控执行 | `src/ai/agents/profileUpdateExecutor.ts`、`studentAbilityProfile.schema.ts` |
| 状态与恢复 | `src/ai/services/learningFeedbackRevisionPersistenceService.ts`、LearningTaskAttempt Repository |
| 正式 Learning 接线 | `src/api/phase163LiveLearning.ts` |
| 学生结果页 | `src/components/continuous-learning/FeedbackGuidedRevision.jsx`、`src/pages/Phase163LiveLearningWorkspace.jsx` |
| 专项 Debug | `src/ai/tests/runLearningFeedbackRevisionStage3Debug.ts` |

## 四、Debug 结果

| 验收组 | 结果 | 核心覆盖 |
| --- | ---: | --- |
| Revision Stage 3 专项 Debug | `15 / 15 PASS` | 四类结果、双 Diagnosis 与版本绑定、Evidence、Profile、Growth Memory、幂等、失败恢复 |
| Revision Stage 1 回归 | `26 / 26 PASS` | 身份、不可变、Repository、状态机 |
| Revision Stage 2 回归 | `28 / 28 PASS` | Offer、Goal、草稿、提交、单次上限 |
| Learning Feedback Presentation | `6 / 6 PASS` | 反馈呈现时序与空态 |
| Student Learning Narrative | `24 / 24 PASS` | 事实、缺口、行动与身份边界 |
| Student Feedback Grounding | `6 / 6 PASS` | 反馈事实可追溯 |
| Student Feedback Action Plan | `8 / 8 PASS` | 可执行行动与披露边界 |
| Student Thinking Analysis | `5 / 5 PASS` | 思考动作和断点表达 |
| Production Build | `PASS` | Vite production bundle 成功 |

自动化专项与关联回归合计 `118 / 118 PASS`，Production Build PASS。

## 五、失败恢复验收

1. Revised Diagnosis 调用前，Revised Response 已持久化；
2. Provider、正式化或 Evaluation 持久化失败，Attempt 进入 `completed_with_revision_pending_evaluation`；
3. 页面恢复只触发一次自动补评，避免同一页面形成无限重试；
4. 每次补评复用同一 `revisionId`、Revised Response 与确定性 Diagnosis Request；
5. 补评成功后清除 Issue，进入 `completed_with_revision`；
6. 首次回答、首次 Diagnosis 与题目校准 Projection 均不被改写。

## 六、界面验收说明

学生端代码与 Production Build 已验证以下展示契约：

- 评价中只显示保存 / 评价状态，不同时出现第二个提交入口；
- 暂不可评价时说明“回答已保存、系统自动补充”，学生可以正常继续；
- 评价完成后展示结果标题、真实改善观察、剩余关注点和下一次独立行动；
- 明示“反馈支持下形成，后续独立任务验证”；
- 页面只保留继续入口，不提供第三次修改。

本轮自动化浏览器控制连接被本地 URL 安全策略阻止，因此未把浏览器视觉检查伪报为 PASS。正式主页面的最终视觉点击验收需在已打开的本地 Learning 页面完成一次人工冒烟；该限制不影响领域 Debug、状态机、恢复测试和 Production Build 结论。

## 七、验收结论

第三阶段领域对象、正式诊断接线、受控证据、失败恢复与学生结果页已经完成。系统现在能够区分“首次独立表现”和“反馈支持下的修订表现”，并在不夸大长期能力变化的前提下，告诉学生这次修改改善了什么、还缺什么、下次应如何独立完成。

进入阶段 4 前，不应再扩展第二次修订、人工编辑评价或即时能力升级。下一阶段只处理 Revision 扩展事件、完整性审计和真实使用数据校准。
