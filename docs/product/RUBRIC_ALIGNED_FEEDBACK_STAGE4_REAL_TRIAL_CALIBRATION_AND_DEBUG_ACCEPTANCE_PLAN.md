# Rubric 对齐反馈阶段 4：真实 Trial 校准与 Debug 验收文档

**English Name:** Rubric-aligned Feedback Stage 4 Real Trial Calibration and Debug Acceptance Plan

**状态：** `ENGINEERING COMPLETE / AUTOMATED + ISOLATED BROWSER ACCEPTED / REAL TRIAL NOT ACTIVATED`

**阶段版本：** `rubric_aligned_feedback_stage4_v1`

**上游版本：** `rubric_aligned_feedback_stage3_v1`

**Trial Activation Schema：** `rubric_aligned_feedback_trial_activation_v1`

**Trial Observation Schema：** `rubric_aligned_feedback_trial_observation_v1`

**Trial Decision Policy：** `rubric_aligned_feedback_trial_decision_policy_v1`

**更新日期：** 2026-08-28

上游工程与验收基线：

- [阶段 3：Narrative 与学生页面投射工程实施与 Debug 验收文档](./RUBRIC_ALIGNED_FEEDBACK_STAGE3_NARRATIVE_AND_STUDENT_SURFACE_PROJECTION_ENGINEERING_AND_DEBUG_PLAN.md)
- [阶段 4 工程与 Debug 验收报告](../education/phase/reports/rubric_aligned_feedback_stage4_engineering_debug_acceptance_2026-08-28.md)
- [阶段 3 工程与自动化 Debug 验收报告](../education/phase/reports/rubric_aligned_feedback_stage3_engineering_debug_acceptance_2026-08-28.md)
- [阶段 3 全量真实浏览器联调签署](../education/phase/reports/rubric_aligned_feedback_stage3_full_browser_acceptance_2026-08-28.md)

## 一、文档目的

阶段 4 只负责在受控真实 Trial 中校准已经通过阶段 3 验收的 Rubric 对齐反馈：

```text
Formal Diagnosis + Requirement Coverage + Rubric
↓ 确定性投射
RubricFeedbackProjection
↓ 最小披露
StudentVisibleFeedbackGrounding + Action Plan
↓ 原子来源选择
StudentLearningNarrativeProjection
↓ 受控 Trial
真实学生阅读、理解、行动与一次修订
↓ 隔离观察
Calibration Observation / Finding / Decision
```

本阶段回答的是：

1. 反馈是否准确对应当前学生、当前回答和当前题目；
2. 学生是否能理解“已经做到、还缺什么、下一步做什么”；
3. 学生能否依据一个明确行动完成一次修订；
4. 同一主要缺口在修订或后续独立任务中是否减少；
5. 是否出现答案泄露、错误肯定、题型串用、阅读负担或连续学习中断；
6. 新路径异常时能否完整回退并保留学习进度。

阶段 4 不是新的 Diagnosis、Evidence、题目生成或学习调度引擎。它不得把 Trial 观察结果直接写成长期能力结论，也不得因观察需要改变学生当次任务。

阶段完成后最多只能声明：

> Rubric 对齐反馈已在限定学生、限定 Runtime、限定正式资源和限定时间窗口内完成真实运行校准，并满足本阶段规定的准确性、可行动性、连续性与安全边界。

不能声明：

- 一次修订证明学生已经独立掌握；
- Trial 样本足以证明普遍教育效果；
- 反馈对所有学生、材料和能力均已稳定有效；
- Trial Finding 可以直接覆盖 Frozen Resource、Rubric、Diagnosis 或历史 Evidence；
- `student_visible` 可以因此默认全量启用。

## 二、贯穿性验收原则

每项阶段 4 工程与运行验收必须同时证明：

1. 旧 `Publish → Learning → Diagnosis → Evidence → Revision` 主链零回归；
2. 新语义只在阶段 4 允许的 Trial 激活、观察、校准和回滚边界内生效；
3. Trial 之外默认保持 `shadow`，不得因 URL、刷新、热更新或配置缺失进入 `student_visible`；
4. 系统可以读取完整 Projection，但学生只看到完成当前行动所需的最小信息；
5. Primary Item 是当前最值得处理且一次行动能够改善的主要断点，不等于最高权重或最严重错误；
6. `partially_achieved` 只能来自已提交的 Requirement Coverage / Formal Diagnosis，不允许 Trial 层重新判断；
7. 单项选择继续走选项与干扰项诊断链，不套用文本 Rubric 补全逻辑；
8. Revision 保留首次独立表现，支持下修订不覆盖 Initial Evidence；
9. Retest / Transfer 保持独立作答，不投射即时答案路径；
10. 固定题组必须连续完成，反馈页不得无理由提前返回学习入口；
11. 真实学生事实与内部 Debug / 合成样例严格分层，后者不得进入校准分母；
12. 任一身份、版本、运行时或披露门禁失败时必须原子回退，不得混拼新旧字段；
13. 每个阶段都必须证明旧主链零回归，并且新语义只在该阶段允许的边界内生效。

统一原则冻结为：

> 系统知道得多，学生看到得少；Trial 观察真实行动，但不替代正式诊断，也不把支持下改善误写成独立掌握。

## 三、保持不变的架构

以下主链保持不变：

```text
Material → Observation Plan → TrainingTask → QuestionCandidate
→ Adopt → Frozen Resource → Learning → Formal Diagnosis → Evidence
```

以下职责保持不变：

- Rubric 定义观察点、接受范围与评分责任；
- Formal Diagnosis 决定学生回答的正式诊断事实；
- Evidence 保存正式学习证据；
- Revision 只允许一次基于反馈的修订，并保留首次回答；
- Retest / Transfer 验证独立保持或迁移；
- Targeted Micro-training 只处理已确认、可在一次小任务中重做的原子缺口；
- Frozen Resource 通过 Finding 与 successor Candidate 治理，不原地改写；
- Trial 层只保存运行身份、结构化观察和校准决策，不成为第二个教学事实 Owner。

阶段 4 不新建：

- 第二套学生能力画像；
- 第二套 Diagnosis Agent；
- 第二套 Learning 反馈页面；
- 新的人工审核步骤；
- 为了 Trial 专门制造的学生题目或额外任务。

## 四、阶段范围

### 4.1 本阶段包含

- Stage 3 签署结果与 Runtime Identity 的准入校验；
- 限定学生、限定学习轮次或限定 Session 的显式激活；
- `shadow` 与 `student_visible` 的运行时绑定和隔离；
- 文本题完整达成、部分达成与不可评估路径的真实观察；
- 单选正确、单选错误与干扰项反馈的独立观察；
- Revision 入口、修订提交和修订结果的连续性观察；
- 固定题组续题、刷新恢复和异常回落；
- Retest / Transfer 的结果型投射边界；
- 结构化 Trial Observation、Finding、暂停、失效、回滚与关闭；
- 自动化 Debug、真实浏览器联调与真实 Trial 运行报告。

### 4.2 本阶段不包含

- 修改 Rubric、Question、AnswerAcceptance 或正式题目；
- 调整题量、难度梯度、题型配额或任务顺序；
- 从 Trial 自由文本重新推断学生能力；
- 将反馈满意度直接写入 Evidence 或 Profile；
- 让 AI Narrative 读取完整 Rubric、完整 acceptedSignals 或参考答案；
- 因样本不足主动触发 Revision、Targeted Micro-training、Retest 或 Transfer；
- 扩大到多人远程试用、跨设备账号体系或云部署；
- 直接默认开启全量 `student_visible`。

## 五、Trial 状态模型

```text
not_eligible
  → shadow_ready
    → student_visible_active
      → paused
        → student_visible_active
        → rolled_back
      → completed
    → expired
  → invalidated
```

状态语义：

| 状态 | 含义 | 学生可见路径 |
| --- | --- | --- |
| `not_eligible` | 阶段 3、身份或运行门禁未通过 | `shadow / legacy` |
| `shadow_ready` | 已具备激活条件但尚未显式激活 | `shadow` |
| `student_visible_active` | 当前限定范围允许新反馈可见 | `student_visible` |
| `paused` | 暂停接收新 Trial 暴露，保留历史 | `shadow / legacy` |
| `rolled_back` | 因异常原子回退，不再接收新暴露 | `shadow / legacy` |
| `completed` | Window 正常结束，等待校准结论 | 不改变默认模式 |
| `expired` | 超过有效期，不能继续使用旧授权 | `shadow / legacy` |
| `invalidated` | 身份或事实完整性不可接受 | `shadow / legacy` |

规则：

- 只有 `student_visible_active` 允许新反馈进入真实 Trial 分母；
- 页面查询参数、LocalStorage 或前端按钮不得单独完成激活；
- 应用重启、身份不明或配置丢失时安全回到 `shadow`；
- `completed / expired / invalidated / rolled_back` 不得恢复为 active；
- 需要继续观察时创建新的 `trialId`。

## 六、激活 Schema 与身份绑定

```ts
type RubricAlignedFeedbackTrialActivation = {
  schemaVersion: 'rubric_aligned_feedback_trial_activation_v1';
  trialId: string;
  status:
    | 'shadow_ready'
    | 'student_visible_active'
    | 'paused'
    | 'rolled_back'
    | 'completed'
    | 'expired'
    | 'invalidated';
  stage3Acceptance: {
    reportRef: string;
    acceptanceDigest: string;
    acceptedAt: string;
  };
  scope: {
    studentIds: string[];
    learningRoundIds?: string[];
    maxSessions: number;
  };
  runtimeIdentityDigest: string;
  gitCommit: string;
  formalResourceRevision: number;
  sourcePolicyVersion: string;
  feedbackMode: 'student_visible';
  startsAt: string;
  expiresAt: string;
  rollbackPolicyVersion: 'rubric_aligned_feedback_trial_rollback_v1';
  activatedBy: string;
  activatedAt: string;
};
```

激活事实必须绑定：

```text
Trial
+ Student Scope
+ Runtime Identity
+ Git Commit / Build
+ Formal Resource Revision
+ Stage 3 Acceptance Digest
+ Feedback Policy Version
+ Time Window
```

任一身份不一致，不得以“内容看起来相同”继续使用旧激活。

## 七、激活前门禁

只有以下条件全部通过，Trial 才能从 `shadow_ready` 转为 `student_visible_active`：

1. 阶段 3 工程与自动化验收已完成；
2. `B3-01—B3-16` 为 `16 / 16 PASS`；
3. 浏览器控制台为 `0 error / 0 warning`；
4. 阶段 3 验收前后正式 Revision 不变；
5. Runtime Identity 与当前 Commit、Build、Formal Resource Revision 对齐；
6. Learning、Formal Store 与所需 Provider 状态可用；
7. 当前 Trial 外默认模式仍为 `shadow`；
8. 指定学生、Window 时间和最大 Session 数已冻结；
9. 当前不存在未解决的 P0 / P1；
10. 当前题目具备一致的 Question / Rubric / Diagnosis / Grounding / Action Plan 身份；
11. 单选、历史资源、Retest / Transfer 和不可评估路径均有确定回退；
12. 激活前保护写入基线已记录；
13. 激活动作与“保存准入包”分离，必须显式确认；
14. 失效和回滚服务已经通过演练。

准入失败时只能记录结构化原因：

```ts
type RubricAlignedFeedbackTrialAdmissionReasonCode =
  | 'stage3_acceptance_missing'
  | 'stage3_acceptance_stale'
  | 'runtime_identity_mismatch'
  | 'formal_resource_revision_mismatch'
  | 'provider_not_ready'
  | 'student_scope_missing'
  | 'trial_window_invalid'
  | 'feedback_identity_not_aligned'
  | 'rollback_not_ready'
  | 'unresolved_critical_issue';
```

不得用自由文本代替准入结论。

## 八、写入边界与真实数据分层

### 8.1 允许写入

阶段 4 控制面只允许写入：

- Trial Activation / Pause / Rollback / Close Audit；
- Trial Observation Event；
- Calibration Finding；
- Trial 运行与验收报告。

真实学生正常作答仍通过既有主链写入 Session、Attempt、Diagnosis、Evidence 与合法 Revision；这些不是阶段 4 新增写入。

### 8.2 禁止写入

Trial 激活、Debug 与校准不得直接写入或改写：

- Formal Resource；
- Rubric；
- Question / Candidate；
- Formal Diagnosis；
- 历史 Attempt / Initial Evidence；
- Student Profile / Growth Memory；
- Retest / Transfer 结论；
- 正式资源 Registry。

### 8.3 真实与内部样例分层

```ts
type TrialObservationOrigin =
  | 'internal_debug'
  | 'browser_acceptance'
  | 'real_student';
```

只有同时满足以下条件的事件可进入真实校准分母：

```text
origin = real_student
+ active Trial Identity aligned
+ real Session / Attempt identity aligned
+ not synthetic
+ not acceptance fixture
+ not operator-authored response
+ event integrity valid
```

工程人员、测试脚本和验收 Fixture 不得代写真实学生答案。

## 九、Trial Observation Schema

```ts
type RubricAlignedFeedbackTrialObservation = {
  schemaVersion: 'rubric_aligned_feedback_trial_observation_v1';
  observationId: string;
  trialId: string;
  origin: 'internal_debug' | 'browser_acceptance' | 'real_student';
  countsTowardCalibration: boolean;
  identity: {
    studentId: string;
    sessionId: string;
    roundId: string;
    attemptId: string;
    questionId: string;
    questionVersion: string;
    formalResourceRevision: number;
    runtimeIdentityDigest: string;
  };
  taskContext: {
    responseFormat: 'short_text' | 'long_text' | 'single_choice';
    taskRole: 'training' | 'revision' | 'retest' | 'transfer';
    projectionStatus: 'ready' | 'limited' | 'not_assessable';
    feedbackSource: 'rubric_aligned' | 'legacy_fallback';
  };
  observationCodes: RubricAlignedFeedbackObservationCode[];
  severity: 'info' | 'advisory' | 'blocking';
  occurredAt: string;
};
```

结构化观察码冻结为：

```ts
type RubricAlignedFeedbackObservationCode =
  | 'feedback_matches_original_response'
  | 'feedback_mismatches_original_response'
  | 'student_understands_completed_part'
  | 'student_understands_primary_gap'
  | 'student_understands_next_action'
  | 'student_executes_revision_action'
  | 'revision_reduces_primary_gap'
  | 'revision_does_not_reduce_primary_gap'
  | 'independent_revalidation_reduces_gap'
  | 'answer_leakage_detected'
  | 'false_positive_praise_detected'
  | 'task_type_crossover_detected'
  | 'feedback_reading_load_high'
  | 'fixed_group_continuity_preserved'
  | 'fixed_group_continuity_broken'
  | 'fallback_recovery_succeeded'
  | 'fallback_recovery_failed';
```

报告可包含简短说明，但统计、门禁和去留判断必须使用结构化 Code，不以自由文本为计算依据。

## 十、校准观察规则

### 10.1 反馈对应性

反馈必须能追溯至：

```text
当前 Attempt
→ 当前 Formal Diagnosis
→ 当前 Requirement Coverage
→ 当前 Projection Primary Item
→ 当前 Grounding / Action Plan
→ 当前 Narrative
```

不得只因反馈“语句通顺”判定准确。反馈若针对另一题、另一版本、另一回答或另一学生，即使教学建议本身合理，也属于阻断错误。

### 10.2 可理解与可行动

学生是否能理解，不通过新增测验或让学生复述完整 Rubric 判断。只观察：

- 是否能指出当前要补的一个方面；
- 是否能按反馈回到材料找到所需线索；
- 是否能完成反馈要求的一个思考动作；
- 是否能进入合法 Revision 或继续下一题。

### 10.3 `partially_achieved`

这是本阶段重点观察状态，但 Trial 层不得重新生成它。必须同时满足：

- Requirement Coverage 已明确部分达成；
- Formal Diagnosis 身份一致；
- Projection 只选择一个可行动 Primary Gap；
- Narrative 肯定真实完成部分，不虚构完成；
- 下一步动作不泄露完整答案。

### 10.4 单项选择

单选反馈继续围绕：

```text
selectedOption
→ correctness / distractor rationale
→ 典型误读或遗漏
→ 一个重新核对动作
```

禁止出现：

- “补充文本依据并说明关系”这类默认文本题反馈；
- 要求学生输入一段新答案才能继续；
- 把正确选项和完整解释直接拼成标准答案；
- 因单选错误自动形成宏观能力结论。

### 10.5 Revision

- 一道题最多开放一次基于反馈的修订；
- 原始回答和 Initial Evidence 保留；
- 修订结果只证明在反馈支持下的改善；
- `revision_reduces_primary_gap` 不等于独立掌握；
- 是否真正保持，留给后续 Retest / Transfer。

### 10.6 Retest / Transfer

- 默认只展示结果型反馈，不提供可直接复用的即时修复路径；
- 不因 Trial 校准降低独立作答要求；
- 不把题目角色不同自动当作观察价值不同；
- 只有证据情境、观察对象或认知动作确有变化时，才可作为独立再验证样本。

## 十一、固定题组与连续学习

真实 Trial 必须验证 5—6 题固定题组中的连续行为：

1. 完成当前题后，反馈页显示准确的下一题位置；
2. “进入第 N 题（共 M 题）”中的 N 表示即将进入的题号；
3. 队列尚有正式任务时不得只显示“返回学习入口”；
4. Revision 完成后应回到原固定题组的下一合法位置；
5. 刷新、返回、重进后恢复同一 Session 与同一任务队列；
6. 当前任务不可继续时，必须说明原因并给出可执行恢复动作；
7. 不得在“继续学习 → 同一反馈页 → 返回学习入口”之间形成死循环；
8. 没有下一道符合条件的正式任务时，才能结束题组并返回入口。

任何一次提前结束、题号错位、任务丢失或恢复死循环均视为阶段 4 阻断问题。

## 十二、运行时失败、回退与熔断

触发原子回退的条件：

- Student / Session / Attempt / Question 身份不一致；
- Formal Resource Revision 或 Runtime Identity 变化；
- Projection / Grounding / Action Plan 来源不完整；
- Narrative 输出包含未授权事实或答案泄露风险；
- Provider、正式资源或 Learning 状态不可用；
- Trial 已暂停、过期、失效或超出 scope；
- 连续题组恢复无法证明正确下一任务。

回退规则：

```text
新路径失败
→ 整包丢弃 Rubric-aligned Narrative
→ 使用合法 Legacy / Shadow 路径
→ 保留学生回答、Session 与题组位置
→ 写入结构化失败码
→ 必要时暂停 Trial
```

禁止：

- 新旧反馈逐字段拼接；
- 静默展示空白卡片；
- 让学生重新提交已成功保存的回答；
- 删除历史 Trial Observation；
- 通过扩大学生操作弥补系统错误。

以下任一情况触发 Trial 熔断并回落 `shadow`：

- 任一答案泄露；
- 任一跨学生、跨回答或跨题身份错投；
- 固定题组不可恢复的死循环；
- 正式数据被阶段 4 控制面误写；
- 同一 P1 问题在修复后再次出现；
- 无法确认当前 Runtime Identity。

## 十三、校准判定与阈值

阶段 4 首轮是单学生、小样本的运行校准，不把样本数量解释为统计学稳定性或教育效果。

### 13.1 零容忍项

以下必须为 `0`：

- 答案泄露；
- 错误肯定；
- 学生 / Attempt / Question 身份错投；
- 单选与文本反馈串用；
- 固定题组提前结束或死循环；
- Trial 控制面误写正式资源、Diagnosis、Evidence 或 Profile；
- 内部 Debug 数据进入真实分母。

### 13.2 首轮建议观察量

首轮建议：

- 至少完成 `5—10` 个真实 Learning Session；
- 至少形成 `12` 次有效学生可见反馈暴露；
- 至少包含 `3` 次合法 Revision 机会；
- 至少覆盖文本部分达成、文本完整达成、单选正确和单选错误；
- 固定题组至少完整跑通 `3` 组；
- Retest / Transfer 只在自然触发时计入，不为凑样本强制生成。

这些是当前 Trial 的产品治理阈值，不是永久统计标准。若真实学习中某类状态没有自然发生，必须记录“未观察到”，不得使用合成样例补足真实分母。

### 13.3 决策结果

```ts
type RubricAlignedFeedbackTrialDecision =
  | 'continue_shadow'
  | 'continue_limited_trial'
  | 'ready_for_scoped_enablement'
  | 'pause_and_fix'
  | 'rollback';
```

只有零容忍项全部为 0、连续学习可恢复、代表性反馈状态已覆盖且不存在未解决 P0 / P1，才允许讨论 `ready_for_scoped_enablement`。该状态也不等于全量默认启用。

## 十四、自动化 Debug 验收矩阵

阶段 4 自动化编号统一使用 `RF4-A01—RF4-A24`：

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| RF4-A01 | Stage 3 签署缺失 | 不可激活 |
| RF4-A02 | Stage 3 Digest 过期 | 不可激活 |
| RF4-A03 | Runtime Identity 对齐 | 可进入 shadow_ready |
| RF4-A04 | Runtime Identity 错位 | 原子拒绝 |
| RF4-A05 | Formal Revision 变化 | 激活失效 |
| RF4-A06 | Trial scope 外学生 | 保持 shadow |
| RF4-A07 | Trial scope 内学生 | 仅 active 时 student_visible |
| RF4-A08 | Trial 到期 | 自动回落 shadow |
| RF4-A09 | 完整覆盖文本题 | 不制造缺口和修改动作 |
| RF4-A10 | 有结论无依据 | 只投射一个可行动缺口 |
| RF4-A11 | 有依据无关系 | 不改写为标准答案 |
| RF4-A12 | not_assessable | 安全回退，不猜测 |
| RF4-A13 | 单选正确 | 简洁确认，不套文本反馈 |
| RF4-A14 | 单选错误 | 使用对应干扰项路径 |
| RF4-A15 | Revision 合法 | 保留首次回答和证据 |
| RF4-A16 | Revision 第二次请求 | 阻断，不扩大次数 |
| RF4-A17 | Retest / Transfer | 只显示结果型必要信息 |
| RF4-A18 | 固定题组尚有下一题 | 返回准确下一题位置 |
| RF4-A19 | 固定题组结束 | 才允许返回学习入口 |
| RF4-A20 | 刷新与恢复 | Session 和队列位置稳定 |
| RF4-A21 | 新路径运行失败 | 整包回退且进度不丢失 |
| RF4-A22 | Debug / Fixture 观察 | 不进入真实校准分母 |
| RF4-A23 | 重复 Observation | 幂等，不重复计数 |
| RF4-A24 | 全矩阵执行前后 | 正式受保护数据零额外写入 |

完成标准：`24 / 24 PASS`，且失败报告不能只输出异常文本，必须包含 Check ID、结构化原因码、身份摘要和保护写入计数。

## 十五、真实浏览器联调矩阵

阶段 4 浏览器编号统一使用 `RF4-B01—RF4-B16`：

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| RF4-B01 | Trial 外普通 Learning | 默认仍为 shadow / legacy |
| RF4-B02 | 合法 Trial 激活 | scope 内显示 Rubric 对齐反馈 |
| RF4-B03 | 文本完整达成 | 只显示真实完成，不显示伪缺口 |
| RF4-B04 | 文本部分达成 | 已做到、一个缺口、一个动作均可追溯 |
| RF4-B05 | 无效或不可评估回答 | 不虚假肯定，不拼凑具体建议 |
| RF4-B06 | 单选正确 | 简洁确认，按钮与题型匹配 |
| RF4-B07 | 单选错误 | 干扰项反馈与所选项一致 |
| RF4-B08 | Revision 入口 | 只在合法条件下出现一次 |
| RF4-B09 | Revision 完成 | 原回答保留，随后回到正确队列位置 |
| RF4-B10 | Retest / Transfer | 无即时答案泄露 |
| RF4-B11 | 五题固定题组 | 连续完成，不提前返回入口 |
| RF4-B12 | 刷新 / 返回 / 重进 | 恢复同一 Session 与下一题 |
| RF4-B13 | Provider 或新路径失败 | 反馈不空白，学习可继续 |
| RF4-B14 | Trial 暂停 / 到期 / 失效 | 立即回落 shadow，不污染进度 |
| RF4-B15 | 连续异常 | 熔断生效，历史事实保留 |
| RF4-B16 | 全流程结束 | 控制台 0 error / 0 warning，正式保护写入符合边界 |

浏览器验收必须使用干净应用入口；内部验收页不得出现在普通 Workbench 或 Learning 页面。

## 十六、真实 Trial 运行顺序

```text
T01 保持默认 feedback mode = shadow
T02 复读 Stage 3 验收报告与 Digest
T03 复读 Git Commit、Build、Runtime Identity、Formal Revision
T04 建立 draft Trial 与限定 scope
T05 执行 RF4-A01—RF4-A24
T06 执行 RF4-B01—RF4-B16 隔离联调
T07 保存准入包，仍保持 shadow
T08 操作者显式确认激活
T09 原子写入 active Trial 与 Activation Audit
T10 复读 scope 内 student_visible、scope 外 shadow
T11 等待真实学生自然作答，不代写答案
T12 只接收 origin = real_student 的有效观察
T13 每个 Session 后巡检身份、连续性和 P0 / P1
T14 达到观察量或触发熔断时关闭 / 回滚
T15 输出 Trial 校准与 Debug 验收报告
T16 默认模式仍保持 shadow，另行决定是否扩大范围
```

## 十七、中途巡检

每个真实 Session 后至少巡检：

- Trial、Student、Session、Attempt、Question 身份是否一致；
- feedbackSource 与题型是否一致；
- 当前反馈是否对应原回答；
- Revision 是否只开放一次；
- 下一题位置是否正确；
- 是否出现空白、重复、死循环或提前结束；
- 是否发生答案泄露、错误肯定或题型串用；
- Observation 是否只保存结构化事实；
- Trial 外学生是否仍保持 shadow；
- Runtime / Formal Revision 是否仍与激活事实一致。

巡检不得查看或复制 Provider Raw Output，也不得把学生答案正文写入运行报告。

## 十八、阶段完成定义

只有以下事实全部成立，阶段 4 才可标记为 `TRIAL CALIBRATION ACCEPTED`：

1. 阶段 3 验收基线持续有效；
2. `RF4-A01—RF4-A24` 为 `24 / 24 PASS`；
3. `RF4-B01—RF4-B16` 为 `16 / 16 PASS`；
4. Trial 激活、暂停、失效、回滚和关闭均有身份一致的 Audit；
5. 默认模式在 Trial scope 外保持 `shadow`；
6. 零容忍问题为 `0`；
7. 固定题组、Revision、单选、Retest / Transfer 与恢复链零回归；
8. 真实观察与 Debug / Fixture 分母严格隔离；
9. 正式资源、Rubric、历史 Diagnosis / Evidence / Profile 未被 Trial 控制面改写；
10. 达到当前 Window 冻结的最低真实观察量，或明确记录样本不足而继续限定 Trial；
11. 输出独立工程 Debug 报告、浏览器签署和真实 Trial 校准报告；
12. 是否扩大 `student_visible` 范围由单独决策授权，不由阶段完成自动触发。

## 十九、分阶段工程顺序

### Stage 4.0：契约与 Schema

- 冻结 Activation、Observation、Decision 与 Reason Code；
- 建立历史兼容和默认 shadow 规则；
- 只读，不激活 Trial。

### Stage 4.1：Preflight 与激活控制

- 接入 Stage 3 Acceptance Digest、Runtime Identity 与 Formal Revision；
- 分离保存准入包和显式激活；
- 完成过期、失效和回滚。

### Stage 4.2：运行时来源绑定

- 仅对 scope 内真实 Session 原子选择 student_visible；
- scope 外、身份错位和失败路径保持 shadow / legacy；
- 不改变 Narrative Schema。

### Stage 4.3：Observation 与校准

- 记录结构化 Observation；
- 分离 real_student 与内部样例；
- 建立中途巡检、熔断和 Decision。

### Stage 4.4：全量验收与真实窗口

- 完成 RF4-A01—RF4-A24；
- 完成 RF4-B01—RF4-B16；
- 显式激活限定 Trial；
- 完成真实运行、关闭和校准报告。

每个子阶段都必须证明旧主链零回归，且新语义只在该子阶段允许的边界内生效。

## 二十、当前状态与下一步

截至 2026-08-28：

- 阶段 0—3 已完成对应工程与验收；
- 阶段 3 已完成 `B3-01—B3-16` 真实浏览器签署；
- 阶段 4 Activation、Preflight、Runtime Binding、Observation、Decision、Pause / Rollback 控制面已经实现；
- `RF4-A01—RF4-A24` 自动化验收为 `24 / 24 PASS`；
- `RF4-B01—RF4-B16` 隔离真实浏览器验收为 `16 / 16 PASS`；
- 阶段 2、阶段 3 回归分别为 `30 / 30 PASS`、`36 / 36 PASS`，生产构建通过；
- 浏览器验收前后 Formal Revision 保持 `1963 → 1963`，Material / Registry / Evidence / Profile / Session 保护写入均为 `0`；
- 默认反馈模式仍为 `shadow`；
- 阶段 4 工程实现与隔离验收已完成；
- 真实 Rubric 对齐反馈 Trial 尚未激活；
- 当前完成状态是“工程可准入”，不是 `TRIAL CALIBRATION ACCEPTED`；后者仍要求显式激活限定真实窗口并取得真实观察。

下一环节应先审阅独立工程验收报告，再由单独授权决定是否创建限定 Trial Activation；不得因工程验收通过而自动切换 `student_visible`。

## 二十一、冻结声明

本文档冻结 Rubric 对齐反馈阶段 4 的真实 Trial 激活、身份绑定、最小披露、结构化观察、真实数据分层、连续学习、回退熔断、校准判定与 Debug 验收边界。

任何实现不得绕过 Stage 3 验收、Runtime Identity、Formal Revision、学生 scope 或显式激活；不得把 Trial 变成第二个 Diagnosis Agent，不得把支持下修订写成独立掌握，也不得通过扩大默认展示来增加样本。

状态冻结为：

```text
DESIGN FROZEN
ENGINEERING COMPLETE
AUTOMATED DEBUG = 24 / 24 PASS
ISOLATED BROWSER ACCEPTANCE = 16 / 16 PASS
REAL TRIAL NOT ACTIVATED
DEFAULT FEEDBACK MODE = SHADOW
```
