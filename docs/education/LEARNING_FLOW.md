# 学习流程模型（Learning Flow）

## 文档定位

本文档是 AI 语文能力诊断与成长系统的学习流程模型。

本模型负责定义学生一次完整学习过程如何发生，以及 Ability、Question、Diagnosis、Training、Evaluation、Student Profile 和 AI Coach 如何协同工作。

本文档不是页面流程，不是 UI 设计，不是 Prompt，不是算法实现，也不是具体课程方案。

本文档是一份可被产品设计、AI 行为设计和系统实现共同引用的学习流程总线。

学习流程的目标不是完成题目，而是推动能力成长。

LEARNING_FLOW 只负责编排，不负责重新定义能力结论。

它规定各模型何时被调用、消费什么输入、产生什么输出。

长期能力结论必须由 Evaluation 基于多次 Ability Evidence 产生。

## 一、学习流程定义（Flow Definition）

一次完整学习不应是：

```text
做题 -> 看答案 -> 结束
```

而应是：

```text
任务进入
↓
学生作答
↓
作答有效性检查
↓
能力诊断 / 诊断充分性判断
↓
AI Coach 介入决策
↓
反馈 / 追问 / 修正 / 训练
↓
复测 / 迁移验证
↓
Ability Evidence
↓
Evaluation
↓
Profile Update Decision
```

学习流程的核心是让每一次题目任务都转化为能力证据和成长机会。

完整路径表示系统可支持的最大闭环，不代表每个 Session 必须依次经过所有步骤。

例如，首次作答已经满足要求时，可以直接形成 positive evidence，并进入迁移验证、保持性复测或下一任务；无效作答时，则可能只产生 insufficient 记录和 retry 动作。

### 学习 Session 定义

一个 Learning Session 是围绕一个主要能力目标展开的一次可追踪学习过程。

它可以包含：

- 一次或多次作答；
- 一次或多次 Coach 介入；
- 修正；
- 训练；
- 复测；
- Ability Evidence；
- Evaluation Result。

但 Session 不要求一定完成全部步骤。

建议结构：

```ts
type LearningSession = {
  sessionId: string;
  studentId: string;
  primaryAbilityId: string;
  status: LearningSessionStatus;
  taskIds: string[];
  answerAttemptIds: string[];
  evidenceIds: string[];
  evaluationResultId?: string;
  startedAt: string;
  completedAt?: string;
};
```

Phase 8 的多 Session 聚合应以 Session 作为重要输入：

```text
Session 1
Session 2
Session 3
↓
Growth Memory
↓
Stage Evaluation
```

## 二、流程原则（Flow Principles）

### 1. 能力驱动

流程始终围绕能力目标展开。

### 2. 题目承载

题目是任务载体，用于观察、训练和验证能力。

### 3. 诊断先行

训练和反馈应基于诊断结果，而不是基于题目类型直接生成。

### 4. 反馈促修正

AI 反馈必须引导学生修正思考过程。

### 5. 训练要验证

训练完成后必须通过复测或迁移任务验证效果。

### 6. 证据入画像

所有有价值的作答、修正、训练和复测表现，都应沉淀为能力证据。

### 7. 有效性优先

无效作答不得进入具体能力诊断。

系统必须先判断学生输入是否提供最低限度的可分析内容。

### 8. 克制更新

每次 Session 可以追加 evidence，但不一定改变能力状态。

已完成不等于已提升。

## 三、完整学习路径（End-to-End Flow）

### Step 1：任务进入

系统读取题目或学习任务，并识别其能力标签、能力路径、诊断价值、训练价值和评估价值。

引用模型：

- QUESTION_MODEL
- ABILITY_MODEL

### Step 2：学生作答

学生完成原始作答。

系统保留学生原始表达，用于后续诊断、证据生成和画像更新。

引用模型：

- QUESTION_MODEL

### Step 3：作答有效性检查

系统判断学生输入是否提供了最低限度的可分析内容。

```text
学生作答
↓
作答有效性检查
├─ 无效作答 -> 证据不足 -> 请求重新作答 / 结束本次
└─ 有效作答 -> 进入能力诊断
```

无效输入包括：

- 空答案；
- 纯数字；
- 明显敷衍，如“哈哈”；
- “不知道”“不会”等未完成作答；
- 与任务完全无关；
- 没有可分析语义；
- 未完成题目要求的最低作答动作。

底层规则：

```text
无效输入
-> 不形成 weakness
-> 不定位具体能力缺口
-> 不进入长期画像聚合
```

引用模型：

- EVALUATION_CASE_SET
- DIAGNOSIS_MODEL
- QUESTION_METADATA_MODEL

### Step 4：能力诊断

AI 根据有效作答分析能力路径，识别可观察表现、表面问题和根因假设。

引用模型：

- DIAGNOSIS_MODEL
- ABILITY_MODEL

### Step 5：诊断充分性判断

Diagnosis Result 不一定直接进入反馈或训练。

系统应先判断当前诊断是否足以支持下一步动作：

```text
Diagnosis Result
↓
诊断充分性判断
├─ 根因较明确 -> 反馈 / 修正 / 训练
├─ 根因待验证 -> 追问或诊断性小任务
└─ 证据不足 -> 请求补充作答
```

例如学生回答：

```text
因为母亲很心疼。
```

系统看到相关内容，但可能无法判断他是：

- 没找到文本依据；
- 找到了但没写；
- 不会建立依据与结论关系；
- 只是表达过短。

此时 AI Coach 不应直接安排“推理训练”，而应先追问：

```text
你是从母亲的哪个动作看出她心疼菜苗的？
```

可能状态：

- 待澄清；
- 诊断验证中；
- 证据不足。

引用模型：

- DIAGNOSIS_MODEL
- AI_COACH_MODEL

### Step 6：AI Coach 介入

AI 基于诊断结果给出反馈、追问或提示。

反馈目标是帮助学生理解错因，并回到正确思考路径。

引用模型：

- AI_COACH_MODEL
- DIAGNOSIS_MODEL

### Step 7：学生修正或重新作答

学生基于反馈完善原有思考，或在无效作答时重新完成最低有效作答。两者必须区分：

- `Revision`：首次回答有效、方向基本成立，学生在正式诊断反馈后针对一个可执行缺口进行一次修订；
- `Retry`：首次回答无效、答非所问或完全误解任务，需要重新完成最低有效作答。

Revision 不定义为覆盖原答案。首次提交形成不可变 `Initial Response`；修订形成同一 `LearningTaskAttempt` 内独立保存的 `Revised Response`。系统分别记录 Initial Evidence 与 feedback-supported Revision Evidence，不因修订改善而删除首次独立表现。

Revision 只适用于允许即时学习干预的 Training 任务，每题最多一次。Retest、Transfer、Maintenance 和 Formal Assessment 不开放即时修订，以保持独立性和可比性。完整资格、状态、事件、失败恢复和统计口径遵循[Learning 反馈后修订契约](../product/LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md)。

修订过程本身可以形成受支持的能力证据，但不能替代后续无提示复测或迁移证据。

但学生修正不是每次流程都必须发生。

如果首次作答已经独立完成并形成较强正向 evidence，可以直接进入下一任务、迁移验证或保持性复测。

引用模型：

- DIAGNOSIS_MODEL
- STUDENT_PROFILE_MODEL

### Step 8：针对训练

系统根据可观察表现、Ability Evidence 和诊断假设安排训练任务。

训练目标是建立或强化某项能力，而不是完成更多题目。

训练阶段允许 AI Coach 递进提示，但必须记录提示依赖。

引用模型：

- TRAINING_MODEL
- QUESTION_MODEL

### Step 9：复测 / 迁移验证

系统通过新文本、新题型或新任务验证学生是否真正掌握该能力。

复测应避免只验证原题记忆。

训练与复测之间必须保持独立性隔离：

- 复测不能继续沿用训练提示；
- 复测不能直接暴露训练答案结构；
- 复测题与训练题应保持能力一致，但内容具备差异；
- 复测开始后 AI Coach 应进入较少介入状态；
- Training Context 不得自动泄漏到 Retest Answer Context。

运行层建议：

| 阶段 | Coach 行为 |
| --- | --- |
| 训练阶段 | 允许递进提示 |
| 复测阶段 | 默认无提示或少提示 |
| 迁移阶段 | 使用新文本 / 新情境 / 新表达形式 |

引用模型：

- EVALUATION_MODEL
- QUESTION_MODEL

### Step 10：能力评估

系统根据复测、迁移和训练证据判断是否出现成长信号、是否证据充足、是否存在冲突。

一次复测表现良好，最多形成：

- positive evidence；
- growth evidence；
- improvement signal；
- likely_improved。

是否能更新为阶段性改善或稳定提升，必须经过 Evaluation 的证据充足性判断。

引用模型：

- EVALUATION_MODEL
- ABILITY_MODEL

### Step 11：Profile Update Decision

系统将新 evidence 和 evaluation result 交给 Student Profile。

每次都可以发生：

- 追加 Evidence；
- 记录 Session；
- 更新最后观察时间；
- 记录待验证项；
- 记录下一步建议。

只有满足条件才发生：

- 修改能力等级；
- 修改长期状态；
- 宣布成长趋势变化；
- 判断能力提升或退化。

建议结构：

```text
Evaluation Result
↓
Profile Update Decision
├─ append_evidence_only
├─ update_confidence
├─ request_retest
├─ update_status
├─ promote
└─ regression_review
```

引用模型：

- STUDENT_PROFILE_MODEL
- EVALUATION_MODEL

## 四、流程状态（Flow State）

一次学习任务可能处于以下状态：

| 状态 | 说明 |
| --- | --- |
| 待作答 | 学生尚未完成任务 |
| 作答无效 | 当前输入不能形成诊断证据 |
| 待补充 | 需要学生补充最低有效作答或文本依据 |
| 待诊断 | 已完成作答，等待能力诊断 |
| 诊断待确认 | 已发现表面问题，但根因尚未确认 |
| 待修正 | 已完成诊断，需要学生修正 |
| 修订草稿 | 已进入 Revision Mode，首次回答保持不可变，修订尚未提交 |
| 修订评价中 | Revised Response 已提交，等待比较首次缺口与修订变化 |
| 修订评价待补 | Revised Response 已保存，评价暂时失败并等待后台补写 |
| 待训练决策 | 已形成 evidence，等待决定训练、观察或复测 |
| 训练中 | 学生正在进行能力训练 |
| 待复测 | 已完成训练，需要验证迁移或保持 |
| 复测中 | 学生正在独立完成复测 |
| 证据不足 | 当前 Session 无法形成成长结论 |
| 待人工复核 | evidence 冲突或 AI 判断风险较高 |
| 已评估 | 已完成能力评估 |
| 已入画像 | 评估结果已沉淀到能力画像 |
| 已完成 | 本次 Session 完成，但不一定产生状态变化 |

状态用于描述学习闭环进度，不代表 UI 页面。

底层约束：

```text
已完成
≠ 已提升
```

## 五、流程分支（Flow Branch）

学习流程应支持分支。

| 情况 | 流程处理 |
| --- | --- |
| 无效作答 | 不诊断能力，请求重新作答 |
| 有效作答且满足要求 | 生成 positive evidence，决定进入迁移、保持或下一任务 |
| 部分满足，根因明确 | 进入反馈、修正或针对训练 |
| 部分满足，根因不明确 | 进入追问或诊断性任务 |
| 训练中有提示完成 | 记录提示依赖，不作为独立掌握证据 |
| 训练后复测无效 | 标记证据不足，重新安排复测 |
| 复测出现改善 | 生成 growth / positive evidence，交由 Evaluation 聚合 |
| 复测失败 | 判断是未迁移、能力仍不稳定，或需要重新验证根因 |
| Evidence 冲突 | 保持波动或待验证状态，必要时人工复核 |
| 长期无新数据 | 降低状态可信度，安排保持性复测，不直接判定退化 |

流程分支必须以能力证据为依据。

## 六、流程输出（Flow Output）

一次完整学习流程可以产生以下输出：

| 输出 | 说明 |
| --- | --- |
| 本次能力诊断 | 学生本次作答暴露的能力表现和短板 |
| 根因判断 / 根因假设 | 主要错误类型、候选原因和验证需求 |
| 修正记录 | Initial Response、Revised Response、Revision Goal 与修订前后变化；两份回答不可互相覆盖 |
| 修订评价 | 原缺口是否解决、是否响应反馈、是否引入新问题以及后续相似任务动作 |
| 训练记录 | 训练目标、训练阶段和训练表现 |
| 复测结果 | 学生迁移或复测表现 |
| 能力证据 | 可进入画像的能力证据 |
| Evaluation Result | 证据充足性、成长层级、冲突状态和下一步动作 |
| Profile Update Decision | append_evidence_only、update_status、promote、request_retest 等 |

更稳妥的输出结构：

```text
Session
├── Task Context
├── Answer Attempts
├── Answer Validity
├── Diagnosis Result
├── Coach Interventions
├── Training Execution
├── Retest Result
├── Ability Evidence[]
├── Evaluation Result
└── Profile Update Decision
```

不是每项都必须存在。

例如，一次无效作答 Session 可能只有：

```text
Task Context
Answer Attempt
Answer Validity = invalid
Evidence = insufficient
Next Action = retry
```

## 七、本模型与其他模型关系

LEARNING_FLOW 是产品运行过程的总线。

它不创造各模型的规则，只规定它们何时被调用、消费什么输入、产生什么输出。

系统关系可以表示为：

```text
Ability Model
      ↓
Question Model / Metadata
      ↓
Learning Session
      ↓
Answer Validity
      ↓
Diagnosis
      ↓
Ability Evidence
      ↓
AI Coach / Training
      ↓
Retest / Transfer
      ↓
New Ability Evidence
      ↓
Evaluation
      ↓
Profile Update Decision
      ↓
Student Profile
```

ABILITY_MODEL 定义能力标准和能力边界。

QUESTION_MODEL / QUESTION_METADATA_MODEL 提供任务载体和运行契约。

DIAGNOSIS_MODEL 识别本次可观察表现、表面问题和根因假设。

AI_COACH_MODEL 组织反馈、追问和陪练。

TRAINING_MODEL 负责能力训练，并记录提示依赖。

ABILITY_EVIDENCE_CONTRACT 定义一次表现如何保存为证据。

EVALUATION_MODEL 负责聚合多次 evidence，判断证据是否足够支持成长层级或状态变化。

STUDENT_PROFILE_MODEL 负责长期成长记录和 Profile Update Decision 的落地。

完整学习流程将各模型连接成能力成长闭环。

底层约束：

- 无效作答不得进入具体能力诊断；
- 根因未确认时，应进入追问或验证，不得强行训练；
- Training 中的反馈后修订每题最多一次；Retest、Transfer、Maintenance 和 Formal Assessment 不开放即时修订；
- Initial Response、Initial Evidence、Revised Response 与 Revision Evidence 必须分别保存；修订不得覆盖首次独立表现；
- Revision Evidence 必须标记反馈支持程度，不能作为独立掌握或题目首次校准证据；
- 训练表现必须记录提示依赖；
- 复测必须尽量保持独立性和新情境；
- 单次复测不得直接宣布长期能力提升；
- 每次 Session 可以追加证据，但不一定改变能力状态；
- 所有长期结论必须由 Evaluation 基于多次 Evidence 产生。
