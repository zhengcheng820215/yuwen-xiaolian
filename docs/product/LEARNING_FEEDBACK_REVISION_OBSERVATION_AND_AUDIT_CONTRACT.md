# Learning 反馈后修订观察、审计与指标契约

状态：`IMPLEMENTED / STAGE 4 ACCEPTED`

版本：`learning_feedback_revision_observation_audit_v1`

生效日期：`2026-08-14`

## 一、目标与非目标

本契约只把已经完成的反馈后一次修订链路接入真实 Learning 的自动采集、完整性审计和受控指标，不新增学生步骤。

本阶段不建设：

- 第二次或多次修订；
- 人工填写评价、审核人或审核意见；
- 群体排名、教育效果结论或能力自动升级；
- 家长报告、云同步或多使用者系统；
- 高频点击、逐键输入、答案正文或反馈正文采集。

## 二、正式对象与身份

```text
Initial Calibration Attempt
└── learningTaskAttemptId
    ├── revisionOfferDecision
    └── revisionId
        ├── revisedResponseId
        ├── revisionEvaluationId
        └── feedbackSupportedEvidenceId
```

- 现有 `attemptId` 只代表 Initial Response 与题目校准身份；
- `learningTaskAttemptId` 连接首次作答、反馈和一次 Revision；
- Revision 事件不得再次发出 `answer_submitted`，不得形成第二个 Question Calibration Projection；
- Event ID 继续由 Schema、Event Type、Student、Session、Round 和稳定 Source Entity 确定性生成；时间不参与身份；
- Revision Offer Decision 一旦记录不可原地改写；重复计算必须语义相同，否则产生冲突。

## 三、Revision Offer Decision

为获得可信的修订入口分母，每个已经形成正式反馈的 LearningTaskAttempt 必须保存一次冻结决策：

```text
policyVersion
level = none | optional | recommended
eligible = boolean
actionLabel?
primaryIssueCode?
sourceDiagnosisId
sourceFeedbackId
decidedAt
```

该对象只记录资格事实，不复制反馈正文或 Revision Goal Instruction。`eligible=true` 当且仅当 `level=optional|recommended`。

没有该决策时，`revision_offer_rate` 必须返回 unavailable，不得用“存在 Revision”反推所有未开始者都没有看到入口。

## 四、扩展事件

第四阶段只新增三类事件：

| Event Type | 触发条件 | Source Entity |
| --- | --- | --- |
| `revision_started` | Revision 对象及 Goal 已成功持久化 | `revisionId` |
| `revision_submitted` | Revised Response 已正式持久化 | `revisedResponseId` |
| `revision_evaluation_completed` | Evaluation、Evidence、Profile Decision 与 Growth Memory Bundle 已正式持久化 | `revisionEvaluationId` |

### 4.1 Payload 最小字段

事件只保存身份、枚举与时间：

- `attemptId / learningTaskAttemptId / revisionId`；
- Initial 或 Revised `responseId`；
- Evaluation 完成事件包含 `revisionEvaluationId / outcome / feedbackSupportedEvidenceId / policyVersion`；
- 各事件自己的 `startedAt / submittedAt / completedAt`。

禁止在事件中保存：答案文本、Revision Goal Instruction、Diagnosis 文本、反馈正文、材料正文、昵称或人工备注。

### 4.2 触发与恢复

- 事件只能在对应正式对象持久化成功后写入；
- 事件采集失败不得回滚 Revision 主链；
- 失败进入现有 Learning Observation Outbox，页面恢复、提交完成或内部报告刷新时可安全补写；
- 相同事件重复记录返回 unchanged；相同 Event ID 不同语义返回 conflict；
- `revision_evaluation_failed` 只保留在 Revision Evaluation Issue / Outbox，不形成学生事件，也不要求学生确认；
- 自动补评成功后才记录 `revision_evaluation_completed`。

## 五、完整性审计

审计以 LearningTaskAttempt、Revision 扩展事件和 Outbox 为共同输入，不按 `recordedAt` 猜测业务状态。

### 5.1 PASS 条件

1. 有 `revisionOfferDecision`，且来源 Diagnosis / Feedback 与 Attempt 一致；
2. 有 Revision 时恰好一条 `revision_started`；
3. 有 Revised Response 时恰好一条 `revision_submitted`；
4. 有 Revision Evaluation 时恰好一条 `revision_evaluation_completed`；
5. Event Payload 中 Attempt、Revision、Response、Evaluation、Evidence 身份与正式对象一致；
6. Revision 未增加 `answer_submitted`、Initial Attempt 或 Question Calibration Projection；
7. Evaluation 完成 Bundle 只包含 `feedback_supported` Evidence 与 `append_evidence_only` Profile Decision；
8. pending evaluation 可以缺少 completed Event，但必须保留 Revised Response 和可重试 Issue；
9. Outbox 中相同 Event 只存在一个稳定身份；pending/retrying 为 warning，failed/conflict 为 fail。

### 5.2 Issue 严重性

| Issue | 严重性 |
| --- | --- |
| `offer_decision_missing` | warning；对应率返回 unavailable |
| `revision_event_pending_outbox` | warning；主链可继续 |
| `revision_event_missing` | fail |
| `revision_event_duplicate` | fail |
| `revision_event_identity_mismatch` | fail |
| `revision_calibration_contamination` | fail |
| `revision_evidence_boundary_violation` | fail |
| `revision_terminal_bundle_incomplete` | fail |

## 六、指标口径

所有指标只在内部观察，不进入学生默认界面。

| 指标 | 分子 / 分母 |
| --- | --- |
| `revision_offer_rate` | `eligible offer decisions / all frozen offer decisions` |
| `revision_start_rate` | `unique revision_started / eligible offer decisions` |
| `revision_completion_rate` | `unique revision_submitted / unique revision_started` |
| `revision_evaluation_completion_rate` | `unique evaluation_completed / unique revision_submitted` |
| `feedback_response_rate` | `feedbackRespondedTo=true / evaluated revisions` |
| `issue_resolution_rate` | `improved + partially_improved / evaluated revisions` |
| `new_issue_rate` | `newIssueCodes non-empty / evaluated revisions` |
| `revision_outcome_distribution` | 四类 Outcome 的唯一 Evaluation 数量 |

规则：

- 所有分子按稳定 ID 去重；
- 分母为 0 时返回 unavailable，不得显示 `0%`；
- pending evaluation 不进入 Outcome 分母；
- 草稿未提交不进入 completion / evaluation 指标；
- Revised Response 不进入首次正确率、题目难度、区分度、首次 Attempt 数或独立作答用时；
- 当前阈值只用于单学生封闭试运行治理，不解释为统计学显著教育效果。

## 七、阶段 4 验收标准

1. 三类扩展事件 Schema 与 Payload 校验通过；
2. 正式 `/learning` 的开始、提交、评价完成触发点接线完成；
3. 重复点击、刷新、补评和 Outbox 重试不增加事件数量；
4. pending evaluation 保留答案、可继续且不误发 completed Event；
5. 自动补评成功后补齐且只补齐一条 completed Event；
6. 完整性审计覆盖正常、跳过、草稿、pending、恢复、重复和身份错位；
7. 指标对零分母、缺失 Offer 分母和重复 Event 返回诚实结果；
8. Initial Question Calibration Projection 数量和内容保持不变；
9. 阶段 1—3、Learning 反馈与叙事链路、IndexedDB 升级和 Production Build 回归通过；
10. 学生界面没有新增采集按钮、内部 ID、指标或审核步骤。

## 八、冻结结论

第四阶段的完成标准是“Revision 数据可追溯、可补写、可审计、可按诚实口径汇总”，不是“已经证明教育效果”。教育效果仍需在真实使用中结合后续独立 Retest / Transfer 数据验证。

工程实现和 Debug 验收见[Learning 反馈后修订阶段 4 工程与 Debug 验收](../education/phase/reports/learning_feedback_revision_stage4_engineering_debug_acceptance_2026-08-14.md)。
