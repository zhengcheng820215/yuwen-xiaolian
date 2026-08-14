# AI 训练任务、题目采用与真实作答校准契约

英文名称：AI Question Adoption and Empirical Calibration Contract

状态：`ACTIVE`

文档版本：`ai_question_adoption_and_empirical_calibration_v1.8`

生效日期：`2026-08-13`

## 一、适用边界

本契约同时约束两层 AI 结果：

1. `TrainingTaskCandidate`：AI 规划出的训练任务组；
2. `QuestionCandidate`：针对单项训练任务生成的完整题目方案。

QuestionCandidate 的生成完整性、作答格式匹配、题组去重、梯度提醒和定向试点范围，遵循[AI 题目生成质量与定向优化契约](./AI_QUESTION_GENERATION_QUALITY_AND_TARGETED_OPTIMIZATION_CONTRACT.md)。

素材标题和正文仍属于人工录入的原始输入，不属于“人工改题”。标准录入页不要求用户填写“来源说明”：系统根据录入动作自动记录 `sourceType = manual` 和创建时间，版权备注仅作为折叠的可选信息。进入 AI 生产阶段后，标准工作台不再提供训练任务删除、字段级改写、任务组编辑缓冲或独立保存步骤。

## 二、唯一人工决策

训练任务与题目生产主链都只允许一次人工选择：

```text
AI 生成训练任务组
→ 采用当前任务方案 | 不采用并重新生成
→ 系统自动保存 Observation Plan 并执行结构检查

AI 生成题目候选
→ 用户查看候选与质量提醒
→ 采用并发布 | 不采用并重新优化
```

用户不负责逐字段修改 AI 题目，也不需要填写审核人、审核意见或第二份确认说明。

- `采用并发布`：表示用户接受当前完整候选。系统自动完成 Revision、Validation、Quality Assessment、发布决定、Freeze、Formal Version、Registry 和 Observation Link；
- `不采用并重新优化`：当前候选不进入正式资源，系统保留已发布版本并生成新候选；
- `采用当前任务方案`：表示用户接受本轮完整训练任务组，系统自动保存 Plan Revision；不得再要求“保存任务组修改”；
- `不采用并重新生成`：当前训练任务候选不写入 Plan，AI 直接生成新一轮完整方案；
- 自动质量检查只负责阻断结构错误或展示质量提醒，不增加一道人工作业；
- 页面不得出现“待教师审核”“提交教师审核”“填写审核意见”等状态和入口；
- 采用成功后即可进入 Learning，不附加外部审核条件。

底层 `ResourceReviewDecision` 只是对同一次“采用并发布”的审计记录，不代表用户执行了第二次人工审核，也不得在界面上投射为额外步骤。

同一次采用命令必须保留内部阶段结果，例如 `adoption_completed`、`validation_failed`、`assessment_failed`、`publication_failed` 和 `publication_completed`。这些结果用于断点恢复和幂等重试，不是新的用户决定：内容检查失败导向“重新生成题目”，技术检查或发布中断导向“继续发布”，只有 `publication_completed` 才投影为“已发布”。

## 三、减少人为改写

1. 候选内容以整体方案呈现，人只判断是否采用；
2. 不提供把正式题目重新打开后逐字段修补的主流程；
3. 当前候选不合适时优先“重新优化”，由 AI 基于问题重新生成完整方案；
4. 已发布版本不可原位修改，新方案必须形成后继版本；
5. 质量提醒应转化为 AI 下一轮优化约束，不要求用户手工消除内部 warning code。
6. 补充任务默认作为一个完整候选组判断，不要求用户逐项勾选或删除现有任务；
7. 采用失败时，内容问题回到 AI 重新生成，技术中断由系统继续重试，不要求用户进入编辑器处理。

## 四、素材来源状态

来源状态用于告知材料是否已经核对，不是题目采用的额外审批：

- “人工录入素材”属于系统可以确定的操作事实，不得要求用户再次填写同义自由文本；
- 标准录入页只要求标题和正文，系统自动形成来源记录；
- 已有 Material Version 的历史来源说明继续保留，不因界面收口而清空或覆盖；
- 版权备注可以作为可选折叠项录入，未填写时保持未知，不伪造授权结论；
- `pending / unknown`：来源或权利信息尚未补齐；
- `verified / cleared`：已有明确证据；
- 不得伪造来源和授权；
- 来源状态可以作为运营治理信息，但当前本地试运行不因缺少人工签字而增加题目审核步骤。
- 来源状态不得进入题目待处理数；批次页面只在素材治理摘要中聚合展示，不能覆盖题目的正式发布状态。

## 五、真实作答后台校准

真实作答校准是 Learning 使用后的后台观察，不进入题目生成与发布交互，也不要求教师填写意见。

真实作答的采集事实、匿名 Learner、Attempt 资格、成人帮助处理、时间口径、前端展示与本地数据控制统一遵循[真实 Learning 数据采集与观察契约](./REAL_LEARNING_DATA_COLLECTION_AND_OBSERVATION_CONTRACT.md)。本文只负责题目版本级校准状态与阈值，不重复定义 Learning 事件。

P0—P3 的具体事件 Schema、稳定 Attempt 身份、投影审计、required Rubric 等权计分、`totalScore` 缺省语义与完整性公式统一遵循[真实 Learning 最小采集工程契约](./REAL_LEARNING_MINIMUM_COLLECTION_ENGINEERING_CONTRACT.md)。在 v2 Schema 适配完成前，现有强制 `totalScore` 的 v1 计算器不得接入真实单学生数据。

样本必须绑定学生实际消费的 `resourceVersionId`，并只向题目治理层提供匿名指标：

```text
awaiting_data
→ insufficient_sample
→ calibrated
```

`calibrated` 是当前实现中“已经具备计算初步试运行指标条件”的内部状态名称，不表示统计学结论已经稳定，也不得直接显示为“题目质量已验证”。

- `0` 个真实有效样本：`awaiting_data`；
- 按当前试运行策略，`1–29` 个真实有效样本：`insufficient_sample`；
- 按当前试运行策略，达到 `30` 个有效样本：允许计算初步难度和区分度指标；
- `30` 份是当前单学生、本地试运行的产品治理阈值，不代表统计学稳定性，也不冻结为永久标准；阈值必须随策略版本记录并允许后续调整；
- 样本不足时只显示样本数，不输出伪百分比或稳定性结论；
- 达到试运行阈值后仍不得把初步指标描述为题目质量已经稳定；
- 不同 Question Version 的样本不得合并。
- 能力、难度等非阻断建议按材料聚合后供后台治理使用，不创建新的人工确认入口，也不自动修改当前正式题。
- 同一 Learner 对同一版本的重复作答可以用于纵向观察，但不得冒充多个独立使用者样本；成人较多帮助的作答默认不进入独立题目校准。
- 当前校准计算器已经实现，但 Learning 提交自动投影为匿名校准 Attempt 尚未完成；在接续验收通过前保持 `awaiting_data`，不得用已有答案记录推断已自动入池。
- `answer_submitted` 只创建稳定 `attemptId` 和待定提交事实；必须在 Validity 通过、Diagnosis 与正式评分形成且 `learning_round_completed` 后，才自动投影有效 `AnonymousQuestionCalibrationAttempt`。无效或未完成提交不得入池。

## 六、真实数据驱动的生成调整门槛（2026-08-14）

当前题目生成与正式发布主链保持稳定。真实作答数据不得直接修改 Prompt、Rubric、Answer Acceptance 或 Frozen Version，而应先形成绑定题目版本的可解释治理信号。

最低记录范围包括：

- 生成、重新生成、采用与放弃事件及其 Prompt / Policy Version；
- 有效作答、空答、明显跑题、返回修改、完成时长与 Diagnosis；
- 作答绑定的 `resourceVersionId`、Attempt有效性及是否存在成人较多帮助；
- 由数据支持的问题归因：题干不清、难度/证据负荷不当、区分潜力不足或评分接受边界失配。

样本不足只进入观察队列。达到当前版本化阈值后，治理层可以提出后继候选建议，但仍须沿用“完整候选 → 质量检查 → 采用并发布”的标准路径。禁止依据单次异常自动改题，也禁止跨 Question Version 合并样本来制造调整依据。

## 七、最低验收标准

- 每个 AI 候选只提供“采用并发布”和“重新优化”两种结果；
- 每个训练任务候选组只提供“采用当前任务方案”和“重新生成任务方案”两种结果；
- 训练任务采用后自动保存，不显示删除任务、逐项勾选或“保存任务组修改”；
- 采用时不要求审核人、审核意见或第二次确认；
- 不采用不会改变当前正式版本和 Learning；
- 当前正式题严格保持46道，无历史 Registry 泄漏；
- 自动质量检查通过不显示为“教师已审核”；
- 空作答样本返回 `awaiting_data`，未达到当前版本化试运行阈值时返回 `insufficient_sample`；
- 后台校准状态不阻断采用、发布或 Learning。
- 定向优化只生成候选，未采用时不得改变当前46道正式题及 Learning 消费。

阶段4真实采用发布已验证上述边界：四道试点均通过单次“采用并发布”形成 v4 后继版本，当前 Formal Version、Registry、Observation Link、Frozen Quality Trace 与 Learning 可消费题目仍为 `34 / 34`。内部断点与修复记录见[AI 题目优化阶段4采用发布报告](./AI_QUESTION_OPTIMIZATION_STAGE4_PUBLICATION_REPORT_2026-08-13.md)。

阶段5再次验证材料换版不增加人工决定：《走一步，再走一步》v2 与3道正式题 v2 由一次原子维护命令完成接续，未要求用户填写来源说明、审核人或意见；来源待核验只作为治理信息，Learning 可消费仍为 `34 / 34`。

P2首批补题已经验证上述边界：四道基础理解/概括候选分别形成后继 Plan Task 与完整正式题链，当前 Formal Version、Registry、Observation Link、Frozen Quality Trace 与 Learning 可消费题统一为 `46 / 46`；重复发布为 `apply-noop`。详细记录见[P2-03 基础能力补充正式发布验收记录](../education/phase/reports/question_portfolio_supplement_p2_03_acceptance_2026-08-14.md)。

## 八、禁止做法

- 把教师盲审嵌入生产主链；
- 要求用户先采用、再填写审核意见、再发布；
- 为减少 AI 重新生成而要求用户大量手工改题；
- 用来源核验状态阻断当前候选选择但不给出可执行路径；
- 制造学生样本或在样本不足时显示稳定质量结论。
- 把 Plan 保存、结构检查或候选持久化写进用户按钮文案，制造采用后的第二个保存决定；
- 要求用户删除、恢复或逐字段修改 AI 训练任务来完成标准生产。
