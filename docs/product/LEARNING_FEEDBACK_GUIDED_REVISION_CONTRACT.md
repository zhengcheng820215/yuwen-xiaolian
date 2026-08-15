# Learning 反馈后修订契约

英文名称：Learning Feedback-Guided Revision Contract

状态：`DESIGN ACCEPTED / STAGES 1–4 ENGINEERING + DEBUG + E2E PASS / REAL USE CALIBRATION PENDING`

文档版本：`learning_feedback_guided_revision_v1.2`

生效日期：`2026-08-14`

## 一、目的

本文定义正式 `/learning` 中的反馈后修订能力：

> 学生在获得正式诊断反馈后，可以基于反馈进行一次修订；系统保留首次独立表现，并评价修订带来的改善。

本能力不定义为“学生可以修改已经提交的答案”。首次提交后，原答案立即成为不可变的 `Initial Response`；后续输入属于同一学习任务 Attempt 内的新 `Revision`，不得覆盖首次答案。

教育目标分为两类，必须分别保存和解释：

- 首次回答观察学生在未获得本题反馈时的独立表现；
- 修订观察学生能否理解反馈并完成针对性改善。

相关权威边界：

- 学习主流程遵循[学习流程模型](../education/LEARNING_FLOW.md)；
- 反馈内容遵循[反馈行动转换模型](../education/FEEDBACK_ACTION_MODEL.md)；
- 训练证据权重遵循[训练模型](../education/TRAINING_MODEL.md)；
- 当前事件、校准 Attempt 和完整性审计遵循[真实 Learning 最小采集工程契约](./REAL_LEARNING_MINIMUM_COLLECTION_ENGINEERING_CONTRACT.md)；
- 学生端表达不得新增正式诊断结论，继续遵循[学生学习叙事校准](./STUDENT_LEARNING_NARRATIVE_CALIBRATION.md)。

## 二、核心原则

1. **首次表现不可覆盖。** `Initial Response`、首次 Diagnosis、首次 Feedback 和 Initial Evidence 一经正式形成即不可原地修改。
2. **一题一个学习 Attempt。** 一次题目运行只计一个 `LearningTaskAttempt`；可选 Revision 是其内部学习行为，不增加完成题数。
3. **两份响应分别保存。** “一个 Attempt”不等于“只有一条响应记录”。Initial Response 与 Revised Response 必须分别持久化、分别可审计。
4. **修订不是独立掌握。** Revision 在明确反馈支持下完成，只形成 feedback-supported improvement evidence，不得冒充独立复测或迁移证据。
5. **一次反馈、一次修订、一次评价。** 第一版每题最多提交一次 Revised Response，不提供第三次修改、逐句提示或多轮 AI 共写。
6. **按诊断结果提供入口。** 不要求每题机械修订；只有存在可执行改善目标时才显示或推荐修订。
7. **不污染题目校准。** 题目难度、首次独立得分和版本级经验校准继续只消费 Initial Response；Revision 单独用于观察反馈有效性。
8. **失败不丢学习事实。** Revision Evaluation 失败时保留 Revised Response，自动重试评价，不要求学生重复提交。

## 三、适用范围

### 3.1 允许修订的任务

| 任务角色 | 即时反馈 | 是否允许一次修订 | 证据解释 |
| --- | --- | --- | --- |
| `method_demonstration` | 是 | 可允许 | 高支持训练行为，不用于独立能力判断 |
| `guided_practice` | 是 | 允许 | feedback-supported improvement |
| `independent_practice` | 是 | 允许 | Initial 保持独立证据；Revision 降级为反馈支持证据 |
| 普通 `training` 兼容角色 | 是 | 允许 | 按实际提示强度记录 |
| `retest` | 完成后或延迟 | 不允许 | 保持独立可比性 |
| `transfer` | 完成后或延迟 | 不允许 | 保持新情境独立应用证据 |
| `maintenance` / delayed retest | 完成后 | 不允许 | 保持保持性证据 |
| Formal Assessment | 完成后 | 不允许 | 保持测量有效性 |

禁止仅因页面存在反馈就开放修订。Runtime 必须先确认本轮 Task Role 允许即时学习干预。

### 3.2 第一版不做

- 不支持无限修改或第二次 Revision；
- 不支持学生查看详细 Diff、版本时间轴或恢复任意历史版本；
- 不展示 Revision 分数或“反馈利用能力 73 分”等伪精确结果；
- 不提供“让 AI 帮我改”、实时逐字指导或多轮自由对话；
- 不把 Revision 单独计为一道题或新的校准样本；
- 不用修订后的正确结果覆盖 Initial Evidence；
- 不在本功能中实现无效回答的 `Retry`；Retry 继续属于有效性恢复边界，后续单独设计。

## 四、修订资格决策

Revision Offer 必须由正式 Diagnosis、Requirement Coverage 和可执行反馈共同决定，不由页面根据文案猜测。

| 首次表现 | 额外条件 | 学生端操作 |
| --- | --- | --- |
| `strong / fully_meets` | 无需要修正的正式缺口 | 不显示修订入口；主操作为“继续下一题” |
| 基本达标但仍有小幅优化空间 | 存在一个可执行、非答案泄漏的 Revision Goal | 可显示“完善回答”，作为次操作 |
| `partial` | 缺口可通过一次修订处理，且反馈已正式生成 | 显示“根据反馈修订”，作为推荐主操作 |
| `invalid / off_topic / misunderstood_task` | 不满足普通修订条件 | 不进入 Revision；按有效性恢复或未来 Retry 处理 |
| Diagnosis 或 Feedback 未正式形成 | 无可追溯 Revision Goal | 不显示修订入口 |
| 已提交 Revision | 达到一次上限 | 不再显示修订入口 |

第一版只允许一个主 Revision Goal，最多附带两个紧密相关的观察点。目标必须来自首次 Diagnosis 的主要缺口和 Next Action，不得由前端自由拼接。

示例：

```text
这次重点修改：补充人物行为对应的文本依据，并说明该行为体现的心理。
```

Revision Goal 只说明“缺什么、关注什么、下一步做什么”，不得直接给出完整结论或标准答案。

## 五、学生端流程

```text
题目
↓
首次作答
↓
提交回答并冻结 Initial Response
↓
正式 Diagnosis 与 Feedback
↓
├─ 无需修订：继续下一题
├─ 可选完善：完善回答 / 继续下一题
└─ 推荐修订：根据反馈修订 / 继续下一题
                    ↓
                Revision Mode
                    ↓
                提交修订
                    ↓
             Revision Evaluation
                    ↓
                继续下一题
```

### 5.1 首次反馈页

反馈页必须保持“反馈主体 + 明确下一动作”：

```text
你的回答
...

反馈
你已经完成了...
还缺少...
这次重点修改...

[ 根据反馈修订 ]  [ 继续下一题 ]
```

按钮层级由第四节的资格结果决定。学生始终可以选择继续下一题；Revision 是推荐学习动作，不是完成当前轮次的强制条件。

### 5.2 Revision Mode

点击后保持原题上下文，不跳转到无关页面。页面至少展示：

1. 原题与必要材料上下文；
2. 不可编辑的首次回答；
3. 压缩为一至两条的 Revision Goal；
4. 自动带入首次答案的修订输入框；
5. 唯一提交动作“提交修订”。

顶部使用轻量说明：

```text
根据刚才的反馈完善回答。首次回答已经保留，不会被覆盖。
```

反馈与输入区不得同时展示大量 Diagnosis Metadata。修订时只保留完成本次修改所需的信息。

学生退出 Revision Mode 时不得静默丢弃已有草稿。若选择继续下一题，系统必须明确本次修订尚未提交；存在实质草稿时需要一次简短确认。

### 5.3 修订结束页

Revision Evaluation 只回答：

- 已经根据反馈改善了什么；
- 主要缺口是否解决；
- 是否引入新问题；
- 下一次遇到类似任务时应注意什么。

结束页不再提供第三次修改，只保留“继续下一题”。

## 六、状态模型

```text
initial_draft
→ initial_submitted
→ initial_diagnosed
→ feedback_presented
→ revision_offered
├─ revision_skipped → completed_initial_only
└─ revision_started
   → revision_draft
   ├─ revision_abandoned → completed_initial_only
   → revision_submitted
   → revision_evaluating
   ├─ revision_evaluated → completed_with_revision
   └─ revision_evaluation_pending_retry → completed_with_revision_pending_evaluation
```

约束：

- `initial_submitted` 后禁止回到可编辑的 Initial Response；
- `revision_started` 不代表 Revision 已完成；
- 已开始但未提交的修订可在确认后进入 `revision_abandoned`；草稿保留用于恢复与审计，但不形成 Revised Response、Evidence 或完成数；
- 每个 `LearningTaskAttempt` 最多存在一个正式 Revised Response；
- Revision Evaluation 暂时失败时，学生可以继续下一题；系统保留待补评价状态并后台重试；
- `completed_with_revision_pending_evaluation` 不得生成“已改善”等结论；
- 重试成功后只补充 Revision Evaluation，不修改 Initial Diagnosis、Initial Evidence 或题目校准 Projection。

## 七、数据对象

建议最小逻辑结构：

```ts
type LearningTaskAttempt = {
  learningTaskAttemptId: string;
  learningSessionId: string;
  learningRoundId: string;
  taskRole: string;
  initialResponseId: string;
  initialDiagnosisId: string;
  initialFeedbackId: string;
  initialEvidenceIds: string[];
  revision?: FeedbackGuidedRevision;
  completionStatus:
    | 'completed_initial_only'
    | 'completed_with_revision'
    | 'completed_with_revision_pending_evaluation';
};

type FeedbackGuidedRevision = {
  revisionId: string;
  initialResponseId: string;
  revisionGoal: {
    primaryIssueCode: string;
    instruction: string;
    sourceDiagnosisId: string;
    sourceFeedbackId: string;
  };
  status:
    | 'draft'
    | 'submitted'
    | 'evaluating'
    | 'evaluated'
    | 'evaluation_pending_retry';
  draftAnswer?: string;
  revisedResponseId?: string;
  submittedAt?: string;
  evaluation?: RevisionEvaluation;
};
```

`draftAnswer` 可以更新；`Initial Response` 和已提交的 `Revised Response` 不可变。任何 Repository 均不得用 Revised Response 覆盖 Initial Response 的记录、索引或内容签名。

### 7.1 Attempt 任务身份唯一来源

`LearningTaskAttempt.taskId` 必须等于冻结的 `Initial Response.taskId`，也就是本轮实际执行的 `ConcreteLearningTask.taskId`。创建 Attempt 时不得再由调用方传入第二份可独立变化的 `taskId`。

正式资源生产侧的 `FrozenQuestionResourceVersion.taskId` 用于追溯资源所属的录入任务，可能与运行期 `ConcreteLearningTask.taskId` 不同。该身份只能通过 `resourceId / resourceVersionId / materialVersionId` 等资源字段保留，禁止覆盖运行期任务身份。必须满足：

```text
LearningTaskAttempt.taskId
= Initial Response.taskId
= ConcreteLearningTask.taskId

Frozen Resource identity
= resourceId + resourceVersionId + materialVersionId
```

如果上述等式不能成立，系统必须停止创建 Attempt；但已经冻结的 Initial Response、Diagnosis 和 Feedback 不得丢失，学生端应提供“重新分析”恢复入口，不得显示内部 Schema 错误或要求学生重新作答。

## 八、Revision Evaluation

第二次评价不是再次运行同一份普通 Student Feedback 模板。它必须比较 Initial Gap、首次 Feedback 和 Revised Response，至少判断四件事：

1. 原问题是否得到修复；
2. 修改是否实际响应反馈；
3. 是否引入新的错误；
4. 最终回答是否达到本题要求。

第一版内部结构：

```ts
type RevisionOutcome =
  | 'improved'
  | 'partially_improved'
  | 'unchanged'
  | 'regressed';

type RevisionEvaluation = {
  revisionEvaluationId: string;
  revisionId: string;
  outcome: RevisionOutcome;
  feedbackRespondedTo: boolean;
  resolvedIssueCodes: string[];
  remainingIssueCodes: string[];
  newIssueCodes: string[];
  improvedObservation: string;
  remainingFocus?: string;
  nextSimilarTaskAction: string;
  evaluatedAt: string;
  policyVersion: string;
};
```

学生端不显示数值 Revision Score，只显示简洁的“已改善 / 仍需注意 / 下次怎么做”。评价文本必须引用 Revised Response 中真实发生的变化，不使用模板化的“回答更完整了”。

### 8.1 阶段 3 评价输入与判定边界

阶段 3 评价必须同时固定并比较以下事实，不允许只按字数增加或前端字符串 Diff 宣布改善：

- Initial Response 与首次 Formal Diagnosis；
- 首次 Formal Feedback 绑定的 Revision Goal；
- Revised Response；
- 在同一 `materialVersionId + resourceVersionId + rubricVersion` 下形成的 Revised Formal Diagnosis。

Revised Formal Diagnosis 只服务于 Revision Evaluation，不进入普通 Task Evidence Return，不创建第二个学习回合、题目校准 Attempt 或普通 Student Feedback。判定规则冻结为：

| 结果 | 最小事实条件 |
| --- | --- |
| `improved` | Revised Diagnosis 相对首次 Diagnosis 明确提升，主要缺口已解决，且未引入新的必需项缺口 |
| `partially_improved` | 已响应反馈并解决部分缺口，但仍保留主要或相关缺口 |
| `unchanged` | 有修改但 Formal Diagnosis 没有可确认改善，或没有实际响应 Revision Goal |
| `regressed` | Revised Diagnosis 的达成状态下降、必需缺口增加或出现新的实质错误 |

`feedbackRespondedTo` 只表示修改是否针对 Revision Goal，不表示最终正确。`resolvedIssueCodes / remainingIssueCodes / newIssueCodes` 必须可追溯到 Revision Goal 和两次 Formal Diagnosis，不能由展示层补造。

若 Revised Formal Diagnosis 未正式形成、身份或版本不对齐、Provider / 持久化失败，评价必须进入 `evaluation_pending_retry`；不得用启发式文案、旧 Diagnosis 或“已提交”状态伪造 Outcome。

## 九、证据与画像口径

Initial Evidence 与 Revision Evidence 分别保存：

```text
Initial Evidence
独立表现中缺少文本依据

Revision Evidence
在明确反馈“补充文本依据”后能够补充相关证据
```

Revision 不得删除 Initial Evidence，也不得直接把长期 Profile 从 weakness 改为 mastered。Profile 可以记录：

- 当前独立表现仍不稳定；
- 在明确反馈支持下能够改善；
- 后续应通过 Retest、Transfer 或 delayed retest 验证是否能独立完成。

后续无提示证据可以改变当前 Profile 判断，但不得改写历史 Initial Evidence 与 Revision Evidence。

Revision Evidence 的支持等级至少记录为 `feedback_supported`，其证据价值低于 independent training、retest、transfer 和 delayed retest。

### 9.1 阶段 3 Profile / Growth Memory 接入边界

阶段 3 只允许以下受控接入：

- 形成一条独立 `feedback_supported` Revision Evidence；
- Profile Update Action 固定为 `append_evidence_only`；
- 能力状态、长期置信度、weakness/mastery 判断保持不变；
- Growth Memory 只记录“在明确反馈支持下改善 / 未改善”和后续独立验证要求；
- `improved` 与 `partially_improved` 仍必须产生 `retest / transfer` 待验证项；
- `unchanged / regressed` 只能记录当前修订表现和下一行动，不得反向覆盖首次正式 Evidence。

Revision Evidence 不进入题目难度、首次得分、独立正确率、区分度或首次 Attempt 数。后续策略可以读取其“待独立验证”提示，但不得仅凭该证据将能力状态更新为 improving / stable_positive。

## 十、版本绑定

Revision 与 Revision Evaluation 必须固定关联首次提交实际消费的：

- `materialVersionId`；
- `resourceVersionId / questionVersionId`；
- `rubricVersion`；
- `initialResponseId`；
- `initialDiagnosisId / diagnosisSchemaVersion`；
- `initialFeedbackId / feedbackSchemaVersion`；
- `revisionEvaluationPolicyVersion`。

Revision 期间 Registry 出现新版本，不得把本轮切换到新题目、Rubric 或材料版本。新版本只影响后续新 Attempt。

## 十一、事件与现有校准兼容

### 11.1 身份拆分

现有真实采集中的 `attemptId` 继续代表首次独立提交及其题目校准身份。Revision 使用独立 `revisionId`，引用该 `attemptId`，但不创建第二个校准 Attempt。

```text
learningTaskAttemptId
├── initial attemptId → 现有五事件与题目校准 Projection
└── revisionId → Revision 扩展事件与反馈有效性观察
```

### 11.2 Revision 扩展事件

工程实现时新增独立版本的扩展事件，不复用 `answer_submitted`：

| 事件 | 触发条件 |
| --- | --- |
| `revision_started` | 学生明确进入 Revision Mode，且 Revision 身份已持久化 |
| `revision_submitted` | Revised Response 已形成并被当前 Attempt 接纳 |
| `revision_evaluation_completed` | Revision Evaluation 已正式持久化 |

`revision_evaluation_failed` 属于内部阶段结果或 Outbox Issue，不投射成新的学生操作步骤。学生端只看到“修改已保存，评价暂时不可用”及正常继续入口。

### 11.3 题目校准口径

- Initial Response 继续进入现有 Validity、Diagnosis、Rubric Score 和 Question Calibration Projection；
- Revised Response 不进入题目难度、首次得分、独立正确率或版本区分度计算；
- Revision 单独支持 revision offer rate、revision completion rate、feedback responsiveness 和 issue resolution 等观察；
- 一题的完成数、题目数和首次 Attempt 数均不因 Revision 增加；
- Revision 用时与 Initial Response 用时分别记录，不合并冒充独立作答时长。

## 十二、幂等、恢复与失败

1. 相同 `revision_started` 重试复用同一 `revisionId`；
2. Revision 草稿按 `revisionId` 保存，刷新后恢复到相同 Revision Mode；
3. 重复点击“提交修订”只形成一份 Revised Response；
4. 已提交内容发生冲突时保留首次接纳版本并产生结构化 Issue，禁止 last-write-wins；
5. Revision Evaluation Provider 或持久化失败不回滚 Revised Response；
6. 自动重试只补评价，不重新调用首次 Diagnosis，不创建第二个 Revision；
7. 页面恢复必须区分 `revision_draft`、`revision_evaluating` 和 `evaluation_pending_retry`；
8. 未提交 Revision 草稿不得进入正式证据、统计或题目校准；
9. 学生选择继续下一题时，初答轮次正常完成；不得伪造 Revision Outcome；
10. Product、Demo、Fixture 和 Debug 数据继续隔离。

## 十三、观察指标

第一阶段只在内部观察，不向学生展示数值：

- `revision_offer_rate`：满足资格并展示修订入口的比例；
- `revision_start_rate`：看到入口后进入 Revision Mode 的比例；
- `revision_completion_rate`：开始后正式提交修订的比例；
- `feedback_response_rate`：修改实际响应主要反馈的比例；
- `issue_resolution_rate`：主要缺口被解决的比例；
- `revision_outcome_distribution`：improved / partially improved / unchanged / regressed；
- `new_issue_rate`：修订引入新问题的比例；
- `later_independent_success`：后续独立 Retest / Transfer 是否成功。

这些指标用于校准反馈与训练策略，不直接等同于长期能力成长。真实教育价值必须结合后续无提示表现判断。

## 十四、产品验收

第一版至少通过以下场景：

1. 首答充分达标：不显示修订入口，继续下一题；
2. 首答存在一个可修正缺口：显示推荐修订入口和明确 Revision Goal；
3. 基本达标：修订入口降级为次操作；
4. 无效或答非所问：不误进入 Revision；
5. Revision Mode 自动带入原答案，Initial Response 只读且不可覆盖；
6. 提交后生成一份独立 Revised Response 和一份 Revision Evaluation；
7. 评价明确指出已改善、未解决和新问题，不重复普通反馈模板；
8. 重复点击、刷新和恢复不重复 Revision、Evidence 或 Provider 调用；
9. Evaluation 失败时修订答案不丢失，学生可继续，后台可补评价；
10. Retest、Transfer、Maintenance 和 Formal Assessment 不出现即时修订；
11. 题目完成数、首次 Attempt 数和校准 Projection 不因 Revision 增加；
12. Initial Evidence 与 Revision Evidence 分别可追溯，后续 Profile 不把支持下改善误判为独立掌握。

## 十五、实施顺序

```text
阶段 1：Schema、身份和 Repository
→ 冻结 LearningTaskAttempt / Revision / RevisionEvaluation
→ 保证 Initial 与 Revised Response 不可变、幂等和可恢复

阶段 2：资格决策与学生交互
→ Revision Offer Policy
→ 首次反馈页动作
→ Revision Mode 与草稿恢复

阶段 3：Revision Evaluation 与证据
→ 差异评价
→ feedback-supported evidence
→ Profile / Growth Memory 受控接入

阶段 4：采集、审计与真实校准
→ Revision 扩展事件
→ 完整性报告
→ 真实学生反馈有效性观察
```

阶段 4 的事件 Payload、Offer 分母、完整性 Issue 与指标计算遵循[Learning 反馈后修订观察、审计与指标契约](./LEARNING_FEEDBACK_REVISION_OBSERVATION_AND_AUDIT_CONTRACT.md)。

阶段之间不得通过临时前端状态绕过正式对象。完成阶段 1 前，不应只增加“根据反馈修订”按钮。

### 15.1 阶段 1 工程验收结论

阶段 1 已于 `2026-08-14` 完成工程与 Debug 验收：

- 已冻结 `LearningTaskAttemptRecord`、`FeedbackGuidedRevision`、`RevisedResponse` 与 `RevisionEvaluation` v1 Schema；
- 已建立 `learningTaskAttemptId / revisionId / revisedResponseId / revisionEvaluationId` 稳定身份；
- 已建立 In-memory 与 IndexedDB Repository，IndexedDB 从 v3 升级到 v4 时保留原 Event、Outbox、Projection 与其他旧 Store；
- Initial Response 与已提交 Revised Response 均不可原地覆盖；同一 Initial Attempt 只能形成一个 LearningTaskAttempt，每题最多一个 Revision；
- 相同创建、开始修订和提交重试保持幂等，冲突返回结构化 Issue；
- 修订草稿与已提交修订可按 Student + Round 恢复，Revision 不创建第二个题目校准 Projection；
- 阶段 1 专项领域 Debug `26 / 26 PASS`，专项浏览器验收 `18 / 18 PASS`，既有 IndexedDB 迁移回归 `30 / 30 PASS`，相关 Learning 回归 `82 / 82 PASS`，Production Build PASS。

验收记录见[Learning 反馈后修订阶段 1 工程与 Debug 验收](../education/phase/reports/learning_feedback_revision_stage1_engineering_debug_acceptance_2026-08-14.md)。

### 15.2 阶段 2 工程验收结论

阶段 2 已于 `2026-08-14` 完成工程与 Debug 验收：

- Revision Offer Policy 只消费正式 Diagnosis、正式 Feedback、Task Role 与 Requirement Coverage，不从页面文案猜测资格；
- 第一版仅对 `training + partially_meets + 可执行 required gap` 开放一次修订；`fully_meets`、无效 / 证据不足回答、Retest、Transfer、Diagnosis、Observation 均不开放；
- `missing` 缺口显示推荐操作“根据反馈修订”，`partially_covered` 显示可选操作“完善回答”，学生始终可以跳过；
- 正式反馈页展示一个 Revision Goal；Revision Mode 保留题目、必要材料、只读 Initial Response 和自动带入的独立修订输入框；
- 修订草稿进入正式 `LearningTaskAttempt` Repository，刷新后恢复；实质草稿离开前需要确认且不会静默丢失；
- Revised Response 独立提交且每题仍只有一个 Revision；本阶段不运行 Revision Evaluation、不生成 feedback-supported Evidence、不新增扩展事件；
- 阶段 2 专项领域 Debug `28 / 28 PASS`，专项浏览器交互 `10 / 10 PASS`，阶段 1 回归 `26 / 26 PASS`，相关 Learning 回归 `77 / 77 PASS`，Production Build PASS。

验收记录见[Learning 反馈后修订阶段 2 工程与 Debug 验收](../education/phase/reports/learning_feedback_revision_stage2_engineering_debug_acceptance_2026-08-14.md)。该结论是阶段 2 当时的冻结快照；阶段 3 完成前，不得把“修订已提交”解释为“已经改善”。

### 15.3 阶段 3 工程验收边界

阶段 3 开工前冻结以下 PASS 条件：

1. Revision Evaluation 必须消费同一冻结题目版本下的首次与修订 Formal Diagnosis；身份或版本错位时阻断；
2. `improved / partially_improved / unchanged / regressed` 四类均有确定性样例与边界测试；
3. 学生端评价引用真实修改或正式缺口，不出现数值分数、模板化空话或第三次修改入口；
4. 每个 Revision 只形成一个 Evaluation 与一条 `feedback_supported` Evidence；刷新、重复点击和 Provider 重试保持幂等；
5. Profile 只执行 `append_evidence_only`，能力状态与置信度不因 Revision 改变；Growth Memory 明确保留支持条件和独立复测要求；
6. Revised Diagnosis / Evaluation 失败不丢 Revised Response，进入 pending retry，学生仍可继续；补评不得重跑首次 Diagnosis；
7. Revision 不增加题目完成数、首次 Attempt、普通 Evidence Return 或 Question Calibration Projection；
8. 阶段 1–2 专项、正式 Learning 主链、入口恢复、学生叙事与 Production Build 全部回归通过。

阶段 3 不新增扩展事件、指标聚合或真实教育效果结论；这些仍属于阶段 4。

### 15.4 阶段 3 工程验收结论

阶段 3 已于 `2026-08-14` 完成工程与自动化 Debug 验收：

- Revised Response 通过与首次作答相同的正式 Diagnosis Boundary 形成 Revised Formal Diagnosis；Evaluation 同时绑定首次 / 修订 Diagnosis、冻结 Resource Version 与 Rubric Version；
- `improved / partially_improved / unchanged / regressed` 四类结果由正式 Diagnosis 差异确定，不使用文本长度、关键词或前端文案替代诊断；
- 每个 Revision 形成一个确定性 Revision Evaluation 与一条 `feedback_supported` Evidence；证据置信度上限为 `0.6`，并固定要求后续 Retest / Transfer 独立验证；
- Profile Update Action 固定为 `append_evidence_only`，只追加带 `supportLevel=feedback_supported` 的证据链接，不改变能力状态；Growth Memory 明确保留支持条件与验证要求；
- Revised Diagnosis 或持久化失败时保留 Initial / Revised Response，进入 `evaluation_pending_retry`；恢复只补 Revision Evaluation，不要求学生重答，也不重跑首次 Diagnosis；
- 学生端完成态区分四类结果，展示真实改善观察、仍需关注与下一次独立作答行动；不显示分数，不提供第三次修改入口；
- 后续 Learning Descriptor 会消费最新受控 Profile / Growth Memory，同时按 `recordId` 去重；Revision 仍不新增首次 Attempt 或 Question Calibration Projection；
- 阶段 3 专项 Debug `15 / 15 PASS`，阶段 1 回归 `26 / 26 PASS`，阶段 2 回归 `28 / 28 PASS`，相关反馈 / 叙事回归 `49 / 49 PASS`，Production Build PASS。

验收记录见[Learning 反馈后修订阶段 3 工程与 Debug 验收](../education/phase/reports/learning_feedback_revision_stage3_engineering_debug_acceptance_2026-08-14.md)。该结论保留为阶段 3 的冻结快照；Revision 扩展事件与完整性报告现已在阶段 4 落地，真实教育效果仍需使用数据校准。

### 15.5 阶段 4 工程验收结论

阶段 4 已于 `2026-08-14` 完成工程与自动化 Debug 验收：

- 每个已形成正式反馈的 Attempt 冻结一份 Revision Offer Decision，缺失分母时指标返回 unavailable，不用“未开始修订”猜测“没有看到入口”；
- `revision_started / revision_submitted / revision_evaluation_completed` 只在对应正式对象成功持久化后记录，Payload 不包含答案、诊断、反馈或材料正文；
- 稳定 Event ID、语义冲突保护和 Outbox 使刷新、重试与失败恢复不重复增加事件，采集失败不回滚 Revision 主链；
- 完整性审计核对 Offer、Revision、Response、Evaluation、Evidence 身份，并阻止 Revision 污染 Initial Question Calibration Projection；
- 内部“学习采集完整性”报告已显示修订链完整性与受控指标；报告只读，不向学生投射工程阶段、内部 ID 或审核步骤；
- Revised Response 仍不增加首次 Attempt、题目完成数或校准 Projection；零分母与不完整 Offer 分母不伪造比率；
- 阶段 4 专项 Debug `19 / 19 PASS`，阶段 1—3 回归 `69 / 69 PASS`，Learning 最小采集 WP1—WP7 回归 `110 / 110 PASS`，反馈呈现与学生叙事回归通过，Production Build PASS。

验收记录见[Learning 反馈后修订阶段 4 工程与 Debug 验收](../education/phase/reports/learning_feedback_revision_stage4_engineering_debug_acceptance_2026-08-14.md)。阶段 1—4 工程链已收口；下一步是真实使用与 Retest / Transfer 校准，不是继续增加学生操作。

正式使用前的正常修订、跳过修订、评价失败恢复、事件失败恢复、学生端草稿恢复和校准隔离已完成跨层联调，验收记录见[Learning 反馈后修订端到端联调 Debug 验收](../education/phase/reports/learning_feedback_revision_end_to_end_integration_debug_2026-08-14.md)。

### 15.6 Attempt 任务身份 P0 修复（2026-08-15）

真实 Learning 首次提交暴露了资源任务身份与运行期任务身份混用的问题：反馈修订持久化曾把 `FrozenQuestionResourceVersion.taskId` 写入 `LearningTaskAttempt.taskId`，而冻结的 `StudentResponse.taskId` 来自 `ConcreteLearningTask.taskId`，导致合法回答在反馈呈现阶段触发 `learning_task_attempt_input_invalid`。

P0 已按第 7.1 节收口：Attempt 创建接口不再接受独立 `taskId`，统一从冻结 Initial Response 派生；资源身份继续独立追溯；学生端将相关内部失败映射为“回答已保留、可重新分析”的恢复表达。修订阶段 1—4 专项共 `88 / 88 PASS`，单对象端到端 `6 / 6 PASS`，Day 0 集成 `15 / 15 PASS`，统一入口 `24 / 24 PASS`，反馈呈现 `6 / 6 PASS`，Production Build PASS。既有真实学习记录未迁移、未删除、未重写。

详细记录见[Learning Attempt 任务身份 P0 修复验收](../education/phase/reports/learning_attempt_task_identity_p0_fix_acceptance_2026-08-15.md)。

## 十六、冻结结论

第一版正式定义为：

> 学生在 Training 题首次独立作答并获得正式反馈后，可在存在可执行缺口时进行一次反馈后修订。系统分别保留 Initial Response 与 Revised Response，单独评价修订是否响应反馈、解决原缺口并避免新错误。修订属于同一 LearningTaskAttempt，不增加题目数量，不进入首次独立题目校准，也不覆盖 Initial Evidence。Retest、Transfer、Maintenance 和 Formal Assessment 不开放即时修订。

该能力的目标不是让学生反复改到正确，而是推动一次可观察的学习行为，并为后续无提示复测提供更准确的反馈利用证据。
