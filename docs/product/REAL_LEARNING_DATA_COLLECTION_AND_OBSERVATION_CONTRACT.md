# 真实 Learning 数据采集与观察契约

英文名称：Real Learning Data Collection and Observation Contract

状态：`ACTIVE / P0—P3 IMPLEMENTED / P4—P5 PENDING`

文档版本：`real_learning_data_collection_and_observation_v1.4`

生效日期：`2026-08-13`

更新日期：`2026-08-14`

## 一、目的与适用范围

本文定义正式 `/learning` 在真实使用中如何识别匿名使用者、记录学习会话与作答过程、形成可解释观察、向题目校准提供版本化样本，以及分别向学生、家长和开发审计展示哪些信息。

采集只服务以下目的：

1. 刷新、退出和隔天后的学习恢复；
2. 依据本轮真实作答生成 Diagnosis、Evidence、反馈和下一任务；
3. 观察题目可理解性、作答负荷、完成情况和异常；
4. 比较 Training、Retest 与 Transfer 中的纵向变化；
5. 为绑定具体 `resourceVersionId` 的题目试运行校准提供匿名有效样本；
6. 支持家长查看整理后的学习记录，并允许本地导出、备份和删除。

本文不授权采集与学习无关的浏览行为，不建立广告画像，不记录其他页面、剪贴板或逐键输入，也不把过程指标直接解释为长期能力结论。

相关权威边界：

- 学生页面展示遵循[PC / 平板学习工作台体验校准](./PC_LEARNING_WORKSPACE_UX_CALIBRATION.md)；
- 题目版本、采用发布与样本阈值遵循[AI 训练任务、题目采用与真实作答校准契约](./AI_QUESTION_ADOPTION_AND_EMPIRICAL_CALIBRATION_CONTRACT.md)；
- Diagnosis、Evidence、Evaluation 和 Profile 的教育含义继续由各自模型契约决定；
- 本文只定义采集事实、观察口径和展示边界，不新增教育判断。
- P0—P3 的字段、身份算法、Repository、评分、补写和测试要求遵循[真实 Learning 最小采集工程契约](./REAL_LEARNING_MINIMUM_COLLECTION_ENGINEERING_CONTRACT.md)。
- Training 题首次反馈后的一次修订、Revision Evaluation 与证据解释遵循[Learning 反馈后修订契约](./LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md)。

## 二、当前工程基线与本轮边界

### 2.1 已实现

当前正式单学生路径已经在浏览器本地持久化：

- 固定产品学生身份 `student-local-primary-v1`；
- `learningSessionId / learningRoundId / operationId`；
- 实际消费的 `resourceVersionId` 与冻结任务内容；
- 答案草稿、最终提交答案与提交时间；
- Response Validity、Diagnosis、Rubric 命中、Evidence、反馈与下一任务结果；
- Session 开始、结束、状态、轮次数和多日运行记录；
- 刷新恢复、重复提交幂等和异常断点。

P0—P3 已进一步完成：

- `question_presented / answer_submitted / diagnosis_completed / feedback_presented / learning_round_completed` 五事件最小链；
- 提交意图、Event、Projection 与匿名 Attempt 的稳定身份；
- Learning 完成轮次向匿名题目校准样本的自动投影；
- 采集失败后的 Outbox 恢复与幂等补写；
- 内部只读完整性报告及 Demo、Fixture 与 Product 数据隔离；
- `WP0—WP7` 自动化、浏览器与最终端到端验收。

### 2.2 后续阶段尚未实现

以下内容属于 P4、P5 或后续基础设施，不得因 P0—P3 已完成而标记为工程完成：

- 多使用者匿名档案与选择入口；
- 首次输入、有效停留和主动放弃等广泛扩展观察；
- 反馈后一次修订已进入独立阶段 1—3 工程链路；Revision 扩展事件、完整性审计和指标由[Learning 反馈后修订观察、审计与指标契约](./LEARNING_FEEDBACK_REVISION_OBSERVATION_AND_AUDIT_CONTRACT.md)治理，接入时不得复用现有 `answer_submitted` 制造第二个校准 Attempt；
- 成人帮助与家长简短观察；
- 家长学习记录页与题目观察页的正式分层；
- 数据导出、导入恢复、按使用者删除与保留期限控制；
- 跨浏览器、跨设备或服务端集中同步。

### 2.3 最小采集链

当前已实现的最小采集链继续使用固定产品身份 `student-local-primary-v1`，包含五个核心事件：

```text
question_presented
→ answer_submitted
→ diagnosis_completed
→ feedback_presented
→ learning_round_completed
```

草稿、答案、Validity、Diagnosis、Evidence、Feedback、Session 与恢复继续复用现有持久化，不在 P1 重新建立第二套记录。首次输入、有效时长、修改次数、成人帮助、家长观察、多使用者和完整行为分析均不属于第一阶段阻塞项。

采集失败不得阻断阅读、作答、提交或反馈。系统必须优先保证学习主链，再以可恢复、可审计方式补写非关键过程事件。

第一阶段的目标不是形成完整分析系统，而是确保每次真实学习至少能够回答：展示了哪个题目版本、提交了哪次作答、是否完成正式诊断、学生是否看到了反馈、本轮是否正式完成。

## 三、核心原则

1. **最小必要。** 只记录能够支持恢复、诊断、个性化、题目治理和家长观察的事实。
2. **版本绑定。** 任何题目观察必须绑定学生实际消费的 Material 与 Question Frozen Version。
3. **事实与结论分离。** “停留较久”“修改两次”“成人提示”是事实，不直接等同于能力弱或题目差。
4. **后台自动采集。** 不要求学生填写技术信息，不把记录动作变成新的学习步骤。
5. **前台分层。** 学生看到学习所需提示，家长看到整理结果，开发审计才看到技术身份和原始事件。
6. **本地优先与可控。** 当前封闭 Beta 默认本机保存且不静默上传；导出、恢复和按使用者删除属于 P4、P5 后续能力。
7. **幂等与可恢复。** 刷新、重复提交和断点恢复不得制造重复事件、重复作答或重复校准样本。
8. **样本诚实。** 不制造学生样本，不跨题目版本合并，不把单人重复作答伪装为群体独立样本。

## 四、使用者身份边界

### 4.1 当前阶段

P0—P4 继续使用现有固定产品身份 `student-local-primary-v1`。事件与 Attempt 保留稳定 `studentId` 字段，为未来迁移提供归属依据；当前不新增使用者选择页，不要求先建立多用户系统才开始真实采集。

Demo、Fixture、自动化和产品身份必须继续严格隔离。只有正式产品身份产生的完成轮次可以进入真实校准投影。

### 4.2 后续多使用者对象

多使用者属于 P5。届时建立 `LearnerProfile`，至少包含：

| 字段 | 要求 |
| --- | --- |
| `learnerId` | 本机生成、稳定、不可从显示名反推真实身份 |
| `displayName` | 可选本地昵称，只用于选择使用者，不进入匿名校准样本 |
| `gradeBand` | 可选受控值，用于解释难度，不记录学校或班级 |
| `readingBaseline` | 可选：`needs_support / typical / advanced / unknown` |
| `createdAt / updatedAt` | 本地时间戳 |
| `consentStatus` | `granted / withdrawn / not_required_local_owner` |
| `status` | `active / archived` |

禁止采集真实姓名、精确生日、学校、班级、联系方式、精确位置或与学习无关的设备身份。昵称不得进入题目校准导出。

### 4.3 当前固定身份迁移

现有 `student-local-primary-v1` 作为默认 Learner 的兼容身份。引入多使用者后必须通过一次显式迁移将历史记录归属到默认 Learner，不得重新生成 Session 或改变历史 `resourceVersionId`。迁移必须幂等并保留来源标记。

同一时刻只允许一个活动 Learner 进入 Learning。切换 Learner 前必须保护当前草稿；不同 Learner 的 Session、Round、Evidence、进度和报告不得混合。

## 五、事件模型

### 5.1 事件公共字段

每条 `LearningObservationEvent` 至少包含：

```text
eventId
eventType
occurredAt
studentId
learningSessionId
learningRoundId
materialVersionId
resourceVersionId
taskRole
abilityId
appVersion
schemaVersion
```

事件与题目无关时可以省略 Material、Resource、TaskRole 和 Ability，但不得用空字符串伪装已知身份。`appVersion` 使用可追溯构建或 Git 提交身份。

未来进入 P5 后，可以在不改变历史事件身份的前提下增加 `learnerId` 投影；不得为了字段改名重写既有 Session、Round 或 Attempt。

### 5.2 P1 核心事件集

| 事件 | 触发条件 | 是否进入学生界面 |
| --- | --- | --- |
| `question_presented` | 正式题目首次可见且可作答 | 不提示 |
| `answer_submitted` | 用户明确提交一次答案；同步形成稳定 `attemptId` | 提交状态反馈 |
| `diagnosis_completed` | 正式 Diagnosis 形成 | 通过反馈页表达，不显示事件名 |
| `feedback_presented` | 正式反馈首次可见 | 不额外提示 |
| `learning_round_completed` | 本轮正式完成 | 显示完成与下一步 |

这五个事件是第一批真实数据的最低闭环。`answer_submitted` 只证明发生了提交，并创建后续结果共用的稳定 `attemptId`；它本身不证明答案有效、已评分或已经具备校准资格。

### 5.3 后续扩展事件

以下事件延后实现，不阻塞 P1 和 P2：

| 事件 | 触发条件 |
| --- | --- |
| `learning_session_started` | 使用者明确开始或续接一次 Session |
| `answer_input_started` | 本轮答案从空变为首次非空 |
| `answer_draft_saved` | 草稿持久化成功 |
| `answer_rejected_invalid` | Validity 阻断进入 Diagnosis |
| `revision_started` | 学生在允许即时学习干预的 Training 题中明确进入 Revision Mode |
| `revision_submitted` | 同一 LearningTaskAttempt 内的 Revised Response 正式提交 |
| `revision_evaluation_completed` | Revision Evaluation 正式持久化 |
| `learning_round_abandoned` | 用户明确结束未完成轮次；仅在存在明确结束动作时记录 |
| `learning_session_ended` | Session 以明确原因结束 |
| `adult_observation_recorded` | 家长主动补充简短观察 |

页面关闭、浏览器崩溃或长时间无活动不能直接记为 `abandoned`；没有明确用户意图时只保留 `interrupted / unfinished` 可恢复状态。

### 5.4 禁止事件

不得记录逐键内容、鼠标轨迹、剪贴板内容、其他标签页、访问历史、与 Learning 无关的页面停留或后台推断的情绪。答案文本只保存在正式作答记录中，不复制到每条过程事件。

## 六、时间与行为口径

时间与行为口径属于 P4 扩展观察，不阻塞最小采集和校准接续。实现后一次题目观察至少区分：

- `presentedAt`：题目与作答区首次可交互；
- `firstInputAt`：答案首次出现非空输入；
- `submittedAt`：用户明确提交；
- `completedAt`：本轮正式完成；
- `lastActivityAt`：本轮最近一次与学习有关的有效活动。

由此计算：

```text
理解启动时间 = firstInputAt - presentedAt
作答输入时间 = submittedAt - firstInputAt
总任务时间 = completedAt - presentedAt
有效作答时间 = 可见且存在有效学习活动的时间片总和
```

默认连续无活动超过 `120` 秒后暂停累计有效时间；恢复输入、滚动阅读区、保存或提交后重新开始。阈值必须记录 `timingPolicyVersion`，后续可调整，不得改写历史结果。

页面在后台、设备休眠或浏览器不可见的时间不计入有效时长。阅读区滚动可以作为活动信号，但不单独形成可识别行为画像。

P4 只保存聚合后的有效时长和关键时间戳，不保存高频活动明细。

## 七、作答、帮助与有效样本

### 7.1 Learning 作答记录

每次明确提交形成稳定 `attemptId`。P1 至少记录题目版本、最终提交答案、提交时间、Validity 结果和既有正式学习结果的关联；P4 扩展后再补充：

- 题目与材料版本身份；
- 最终答案、答案字数和提交序号；
- Validity 结果与原因类别；
- 是否返回修改及有效修改次数；
- Diagnosis 与评分规则版本；
- Rubric 命中、标准化题目得分与能力证据引用；
- 有效作答时长；
- `assistanceLevel`：`independent / light_prompt / substantial_help / unknown`；
- 是否完成、放弃或技术中断。

一般草稿“修改次数”只统计稳定草稿之间的有效内容变化，不记录按键数。正式反馈后 Revision 不折算成普通修改次数，必须按独立 `revisionId`、Revised Response 与 Revision Evaluation 记录。

完整性审计以每条 `answer_submitted` 的提交意图为准，不以 Round 最终 Checkpoint 中只保留的一份 Response 代替全部提交事实：

- 同一 Round 先提交无效答案、修改后再次提交时，两次提交必须形成不同 `submissionIntentId / attemptId`；
- 刷新、恢复或相同答案的幂等重试复用既有 `attemptId`，不得增加提交数；
- 每个不同 `attemptId` 必须恰好对应一份 Projection 审计结果；
- Projection 结果只能归入 `eligible`、`excluded_*` 或 `projection_failed`；
- 早期无效提交可以是 `excluded_invalid_response`，后续有效提交可以是 `eligible`，二者不得互相覆盖；
- 人工界面不增加“确认审计”步骤，所有闭合检查继续由后台完成。

内部计数必须满足：

```text
distinct answer_submitted attemptId
= eligible Projection
+ excluded_* Projection
+ projection_failed Projection
```

若 Projection 因存储故障完全缺失，则公式不闭合并报告 `missing_projection`，不得静默忽略或把该提交计为有效样本。

#### 7.1.1 反馈后 Revision 与 Attempt 的兼容口径

上述“实质修改答案后形成新 `submissionIntentId / attemptId`”只适用于当前首次提交前后的有效性恢复、普通重新提交或未来 Retry，不适用于正式反馈后的一次 Revision。

Revision 实施后：

- 当前五事件链中的 `attemptId` 固定代表 Initial Response 及其题目校准身份；
- Revision 使用独立 `revisionId` 引用原 `attemptId`，不得再次发出 `answer_submitted`；
- Revised Response 不创建第二份 `QuestionCalibrationProjectionRecord`；
- Revision 扩展事件使用独立 Schema 与身份算法，并由完整性报告单独核对；
- 一道题仍计一个 LearningTaskAttempt，但 Initial Response 与 Revised Response 是两份独立、不可变的响应记录。

完整定义以[Learning 反馈后修订契约](./LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md)为准。工程实现前，现有五事件与 Projection 行为保持不变。

### 7.2 家长简短观察

家长端可以在本轮后自愿记录：

- 题意理解：`understood / understood_after_explanation / still_unclear / unknown`；
- 帮助程度：与 `assistanceLevel` 共用枚举；
- 主要困难：`question_understanding / evidence_location / answer_organization / input_burden / material_difficulty / motivation / other`；
- 诊断符合观察：`yes / partial / no / unknown`；
- 可选短备注。

该观察是外部上下文，不覆盖学生答案、Diagnosis 或 Evidence；系统不得自动生成家长观察。

### 7.3 校准样本资格

`answer_submitted` 发生时只创建稳定 `attemptId` 和待定提交记录。系统必须等待以下链路完成后，才能确定性投影 `AnonymousQuestionCalibrationAttempt`：

```text
answer_submitted
→ Validity 通过
→ diagnosis_completed
→ 正式评分结果形成
→ learning_round_completed
→ 投影 AnonymousQuestionCalibrationAttempt
```

一次提交进入校准 Attempt 前必须满足：

1. 来自正式 Learning，而非 Demo、Fixture 或调试入口；
2. 绑定唯一活动时实际消费的 `resourceVersionId`；
3. Validity 为有效并完成正式评分；
4. 具有稳定 `attemptId`，重复提交和恢复只保留一个最终样本；
5. `itemScore` 为规范化 `0—1`，并记录评分策略版本；第一版按 required Rubric 等权命中率计算；
6. 不包含昵称、答案原文、家长备注或可识别个人信息。

无效答案、Diagnosis 未完成、评分失败或 Round 未完成时，不生成有效校准 Attempt；原始提交事实仍保留在学习记录中。刷新恢复必须复用提交时的 `attemptId`，不得在链路完成后追加第二个身份。

当前单学生、单轮开放题没有可信的可比总分，`totalScore` 必须缺省并标记 `unavailable_single_round`，不得用 `itemScore`、答案长度或 Round 序号冒充。只有建立版本化可比评估窗口后才能计算高低组区分度；具体 Schema 与算法由最小采集工程契约冻结。

`substantial_help` 的作答仍属于真实学习记录，但默认不进入独立题目校准样本；`light_prompt` 单独标记，由校准策略决定是否纳入。Retest 和同一 Learner 对同一版本的重复作答必须保留纵向价值，但不得被计作多个独立群体样本。

## 八、观察指标与解释边界

### 8.1 使用者与 Session

- 访问和 Session 数；
- 完成、未完成、阻断和恢复数量；
- 完成题数与使用的正式资源版本数；
- 独立完成、轻提示和较多帮助的分布；
- Training、Retest、Transfer 的实际完成情况。

### 8.2 题目

- 展示、有效提交、完成、无效和放弃数量；
- 理解启动时间、有效作答时间和答案长度分布；
- 一般返回修改率、Revision Offer / Start / Completion / Issue Resolution 和成人帮助率；
- Rubric 各项命中情况；
- 同版本真实有效样本数与校准状态。

### 8.3 能力纵向观察

- 首次训练、间隔复测和迁移任务中的 Evidence 变化；
- 成人帮助是否减少；
- 找证据和组织答案是否改善；
- 相同错误是否跨题重复出现。

单人阶段不得展示群体百分位、常模、稳定区分度或“题目质量已验证”。同一 Learner 多次作答不能替代多个独立使用者样本。

## 九、前端展示分层

### 9.1 学生 Learning

只展示：

- 首次使用时一次简洁说明：“本次学习会在本机记录答题与学习进度，用于保存进度和安排后续练习”；
- 草稿保存、提交、恢复和完成状态；
- 学生能够理解的本轮反馈、进度和下一步。

当 Revision 能力启用后，学生只额外看到由正式资格决策产生的“根据反馈修订 / 完善回答”、Revision Goal、修订输入区与简洁 Revision Evaluation；不得展示 revisionId、内部 Outcome 枚举、事件或数值反馈利用分数。

不得展示 `learnerId / sessionId / resourceVersionId`、原始事件、停留时长、修改次数、校准样本数、后台评分日志或使用者比较。

### 9.2 家长／内部学习记录

独立页面展示整理后的：

- 使用者、日期、材料、题目和完成状态；
- 有效时长、答案、反馈、诊断摘要与帮助程度；
- Training—Retest—Transfer 变化；
- 数据完整性、导出和删除入口。

页面必须区分“系统记录”“家长观察”和“系统推断”，不能混为一个结论。

### 9.3 开发审计

仅内部入口展示技术身份、原始事件顺序、规则版本、幂等状态和采集失败。技术审计不得直接成为学生或家长默认报告。

内部完整性报告必须区分两个只读范围：

- `current_collection`：默认范围，只统计当前最小采集链正式启用后的 Round，用于判断新链路是否持续健康；
- `all_history`：包含启用前历史 Round，用于保留和查看真实遗留缺口。

当前采集代际固定为 `real_learning_collection_v1`，正式切换时间为 `2026-08-13T14:03:24.000Z`（北京时间 `2026-08-13 22:03:24`）。Round 以权威 Checkpoint 的 `createdAt` 判定归属，不得根据“事件是否完整”反推范围，否则完整采集失败的当前 Round 可能被错误隐藏。

旧历史不得删除、自动补造或改写为 PASS，但旧历史 Issue 也不得永久污染 `current_collection` 的健康状态。当前范围尚无 Round 时显示“尚无当前采集轮次”，不得以空集合宣称采集链已验证通过。范围切换只改变报告查询，不得修改 Checkpoint、Persistence、Event、Projection 或正式学习结果。

## 十、存储、隐私与生命周期

当前封闭 Beta 默认保存在本机浏览器 IndexedDB；LocalStorage 只保存轻量入口和恢复指针，不保存完整事件或答案副本。任何未来服务端同步必须单独更新本文、明确目的和授权，不得沿用“本地记录”提示静默上传。

最低能力：

1. 按 Learner 查看本地数据范围；
2. 导出带 Schema Version 的 JSON；
3. 导入前只读校验身份、版本和重复项；
4. 按 Learner 删除，删除前说明对历史、校准和恢复的影响；
5. 清除浏览器数据前提示本地记录可能丢失；
6. 校准投影只保留匿名指标，不携带答案原文和家长备注。

第一阶段不设置未经验证的自动到期删除。后续引入保留期限时必须版本化，并保证撤回授权后停止新增采集。

## 十一、失败、幂等与数据完整性

- 当前 `eventId` 由固定 `studentId`、Session、Round、Event Type 和稳定操作身份确定性形成；P5 增加 Learner 投影后不得改变历史 ID；
- 同一 Round 的 `question_presented`、同一 Diagnosis 的 `diagnosis_completed`、同一反馈版本的 `feedback_presented` 和同一完成结果的 `learning_round_completed` 各自最多存在一条活动事件；刷新只复用或补写，不追加重复记录；
- 一个 `attemptId` 对应一次用户提交意图，刷新和断点恢复不得创建第二份样本；
- 关键学习持久化成功、过程事件失败时，页面不阻断学习，并记录待补写状态；
- 提交已完成但回执丢失时，以权威 Operation、Persistence 与 Evidence 恢复成功状态；
- 事件不得早于所属 Session，完成不得早于提交；
- Material、Resource、Task、Diagnosis 与评分版本身份不一致时，该记录保留审计但不得进入校准；
- 导出统计必须能够回溯到去标识化 attempt，汇总数不得由页面临时状态覆盖。

## 十二、实施顺序

当前阶段状态：P0—P3 已完成工程实现与验收；P4、P5 仍为后续阶段。以下顺序继续作为能力依赖和后续维护依据，不表示 P0—P3 尚未实施。

### P0：固定单学生核心 Schema

- 冻结五个核心 Event 与 Attempt Schema；
- 继续使用 `student-local-primary-v1`，不建设多用户；
- 定义提交时生成、全链复用的稳定 `attemptId`；
- 不改变现有 Learning 恢复和正式题消费行为。

### P1：五事件最小采集

- 只接入 `question_presented / answer_submitted / diagnosis_completed / feedback_presented / learning_round_completed`；
- 所有事件绑定固定学生、Session、Round、Material Version 与 Resource Version；
- 保持离线、刷新和重复提交幂等。

### P2：校准 Attempt 自动接续

- 以 `answer_submitted` 创建的稳定身份贯穿 Validity、Diagnosis 与完成阶段；
- 只在 `learning_round_completed` 且正式评分齐备后投影匿名校准 Attempt；
- 按 `resourceVersionId` 汇总，样本不足只报告数量；
- 投影失败不阻断学生完成学习，并支持幂等补写。

### P3：内部采集完整性报告

- 显示真实 Session、完成 Round、使用的 Resource Version 与有效 Attempt 数；
- 检查“已完成但 Attempt 缺失”、重复 Attempt、版本错绑和 Demo 数据泄漏；
- 只服务产品核对，不先建设完整家长体验。

### P4：家长报告与扩展观察

- 增加首次输入、有效时长、一般返回修改、成人帮助和家长观察；
- 建设家长 Session、题目与纵向变化报告；
- 增加 JSON 导出、校验和数据删除。

### Revision 扩展：反馈后一次修订

- 独立于完整 P4 家长报告实施，不要求先建设多使用者或完整行为分析；
- 新增 `revision_started / revision_submitted / revision_evaluation_completed` 扩展事件；
- Revision 只引用 Initial `attemptId`，不创建第二个题目校准 Attempt；
- 内部报告分别核对 Revision 身份、提交、评价和待补状态；
- 完成工程与产品验收前保持 `DESIGN ACCEPTED / ENGINEERING PENDING`。

### P5：多使用者与严格隔离

- 建立匿名 `LearnerProfile` 与选择入口；
- 幂等迁移现有固定学生历史；
- 验证草稿、进度、Evidence、报告和导出严格隔离。

## 十三、最低验收标准

- [x] 现有固定单学生的答案、Session、Evidence 与题目版本不变；
- [x] 一次正常作答形成五个核心事件，刷新不重复；
- [x] `answer_submitted` 创建稳定 attemptId，但在本轮完成前不生成有效校准 Attempt；
- [x] 无效答案、Diagnosis 失败和未完成 Round 不进入有效校准样本；
- [x] 正常完成轮次自动形成一个且仅一个匿名校准 Attempt；
- [x] 题目换版后新旧 Attempt 不合并；
- [x] 采集失败不阻断作答、Diagnosis、反馈或下一任务；
- [x] 学生端不显示技术身份和监控式指标；
- [x] 内部报告能够发现已完成但 Attempt 缺失、重复、错绑和 Demo 泄漏；
- [x] Demo 和自动化 Fixture 永不进入真实样本统计。

P4、P5 各自增加独立验收；家长报告或多用户尚未完成，不影响已完成的 P1、P2 继续采集第一批真实数据。

## 十四、禁止做法

- 因为“以后可能有用”而采集无明确用途的数据；
- 把每次按键、鼠标轨迹、剪贴板或其他网页活动作为学习数据；
- 用真实姓名、学校、班级或联系方式作为 `learnerId`；
- 把页面打开时长直接当作学习时长；
- 把家长帮助后的答案计为独立能力证明；
- 合并不同 `resourceVersionId` 的样本；
- 用同一孩子重复作答制造30份独立样本；
- 在学生页面展示后台评分、校准或行为监控详情；
- 采集失败时阻断学生继续学习；
- 在没有新增授权和文档更新时把本地数据上传到服务端。

## 十五、当前结论

正式 Learning 已完成五事件最小链、稳定提交身份、Outbox 恢复、匿名校准接续、逐提交 Attempt 闭合和内部完整性核对，`WP0—WP7` 工程与浏览器验收通过，可以进入固定单学生的受控真实运行。该结论只代表采集工程就绪，不代表已经获得足量真实样本或完成群体校准。过程时间、帮助程度、家长展示与多使用者继续保留正式边界，并按 P4、P5 后置实现。

P0—P3 已完成，不再是34道题进入受控真实运行的工程阻塞项。当前主任务是让固定单学生完成真实新轮次，并通过 P3 内部完整性报告观察五事件、eligible / excluded Projection、Outbox 恢复和版本绑定是否持续闭合。

P3 内部报告默认使用 `current_collection`，并允许显式切换到 `all_history`。当前链健康度与历史遗留 Issue 必须分别解释；不得为了得到绿色状态改写旧事实，也不得因为旧轮次缺少上线前不存在的事件而把所有新轮次永久判为 FAIL。

当前固定身份只会形成一个稳定 `subjectKey`，因此同一学生的重复作答可以支持纵向观察和链路校验，但不能凑成多个独立使用者，也不能据此宣称完成群体校准。达到当前30个独立使用者的试运行治理阈值需要 P5 或其他经过契约更新的多使用者采集方式；P4、P5 均不阻断现阶段单学生真实试用。
