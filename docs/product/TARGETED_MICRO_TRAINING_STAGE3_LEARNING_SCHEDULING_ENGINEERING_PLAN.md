# 针对性短片段微训练阶段 3：Learning 条件调度工程实施与验收清单

状态：`ENGINEERING + AUTOMATED DEBUG PASS / CONTROLLED TARGETED BROWSER FLOW + REAL EFFECT PENDING`

版本：`targeted_micro_training_stage3_learning_scheduling_v1`

日期：`2026-08-20`

## 零、阶段结论边界

阶段 3 只把阶段 1 已冻结的 Request / Assignment 身份和阶段 2 已通过的短片段正式资源接入 Learning 条件调度，形成：

```text
核心题正式提交
→ 正式 Diagnosis 给出唯一具体动作缺口
→ 触发资格判定
→ 确定性精确匹配
→ 幂等 Request + Assignment
→ 针对性练习
→ 独立 Attempt / Diagnosis / Evidence
→ 返回原核心题组游标
```

阶段 3 通过只代表调度、恢复和证据隔离在工程上成立，不代表微训练已经证明教育效果。Trigger Rate、Match Rate、Completion、Return 和 Same-gap Recurrence 的真实校准属于阶段 4。

阶段 3 不向当前用户正式资源库自动写入阶段 2 的隔离资源包。工程与真实浏览器验收使用隔离正式链或专用验证开关；只有形成受控上线决策后，才允许将已审查短片段导入真实活动 Registry。

### 当前工程结果（2026-08-20）

- 已建立确定性 Trigger / Match / Request / Assignment 调度链；
- 已建立内存与 IndexedDB 原子 Repository、Revision CAS、幂等复用和可恢复状态迁移；
- 已以 Session Overlay 接入正式 Learning，不插入、删除或重排核心题组；
- 已支持 pending / in-progress / completed / skipped / unavailable 与末题返回哨兵；
- 已把功能开关冻结为默认关闭，只允许专用验证参数或本地显式开关启用；
- 已完成 `57 / 57` Stage 3 专项 Debug、关键学习回归及生产构建；
- 已完成默认关闭和“验证开关开启但无精确资源”两条真实浏览器安全冒烟；完整 targeted Assignment 浏览器路径需在受控导入资源后验收；
- 阶段 2 的 12 份隔离短片段与 18 道题仍未自动写入当前活动正式资源库。

详细证据见[阶段 3 工程与 Debug 验收](../education/phase/reports/targeted_micro_training_stage3_engineering_debug_acceptance_2026-08-20.md)。

## 一、必须继承的输入

阶段 3 必须直接复用，不重新定义：

- `TargetedGapReasonCode` 首批四类具体动作缺口；
- `TargetedMicroTrainingRequest`；
- `TargetedMicroTrainingAssignment`；
- `studentId + sourceAttemptId + gapReasonCode` Request 幂等身份；
- `requestId + resourceVersionId` Assignment 幂等身份；
- `targeted_excerpt` Material、Frozen Version、Registry Active Link；
- `primaryGapReasonCode + targetedMaterialVersionId` 正式资源身份；
- 既有 Learning Session Task Queue；
- 既有 Question Presentation、Submission Intent、Attempt、Diagnosis、Evidence 和恢复机制。

正式资源匹配必须读取当前 Frozen Head 与 Active Registry Link，不读取 Candidate、Draft、历史非当前 Frozen Version 或停用资源。

## 二、冻结原则

1. **核心队列不可变。** 不向 `resourceVersionIds` 插入、删除或重排微训练资源。
2. **结构化事实触发。** 只使用已经正式持久化且身份对齐的 Diagnosis，不根据页面文案、模板反馈或临时 AI 推断触发。
3. **确定性匹配。** 同一 Request 和同一 Registry 快照必须得到相同匹配结果；运行时不得再次调用 AI 选择资源。
4. **精确匹配优先于有题可做。** Ability、Gap、Role 或来源边界不一致时必须 `no_match`，不能近似凑题。
5. **一次一个干预。** 同一核心学习结果不得同时向学生提供“反馈后修订”和“针对性练习”两个竞争主操作。
6. **失败不阻断核心学习。** 触发、匹配、持久化、资源读取或微训练反馈任一环节失败，都必须恢复到原核心队列。
7. **训练不自触发训练。** 微训练 Attempt 不能成为新的即时微训练来源。
8. **证据隔离。** 核心首次表现、反馈后修订和微训练分别形成独立 Attempt / Diagnosis / Evidence。
9. **不提前宣称提升。** 微训练完成只说明当前短片段中的动作完成情况。

## 三、阶段 3 工作包与执行顺序

### WP3.1 正式触发事实适配器

新增纯函数触发资格适配器，从正式 Persistence Result、Learning Round、Attempt、Diagnosis、当前核心队列和 Session 限额中提取：

```ts
type TargetedMicroTrainingTriggerDecision = {
  decisionId: string;
  studentId: string;
  learningSessionId: string;
  sourceLearningRoundId: string;
  sourceAttemptId: string;
  sourceResourceVersionId: string;
  sourceMaterialId: string;
  sourceCoreTaskNumber: number;
  abilityId?: string;
  primaryGapRequirementId?: string;
  gapReasonCode?: TargetedGapReasonCode;
  outcome:
    | 'eligible'
    | 'not_eligible'
    | 'no_match'
    | 'limit_reached'
    | 'intervention_conflict';
  reasonCode: string;
  triggerPolicyVersion: string;
  evaluatedAt: string;
};
```

`decisionId` 必须由 `studentId + sourceAttemptId + gapReasonCode + triggerPolicyVersion` 确定性形成。Decision 只记录结构化身份和结果，不复制学生答案正文或反馈全文。

#### WP3.1.1 必要触发条件

只有同时满足以下条件才能进入 `eligible`：

1. 来源是当前 Session 核心队列中的正式 `training` 题；
2. 来源不是微训练、Revision、Retest、Transfer 或 Diagnosis Task；
3. Student Response、Attempt、Learning Round、Material Version、Resource Version 和正式 Diagnosis 身份一致；
4. 正式 Persistence Result 已完成且没有半提交状态；
5. 回答可判断，不是 `insufficient_to_judge`；
6. 存在且只存在一个正式 `primaryGapRequirementId`；
7. 该 requirement 的 `gapReasonCode` 属于首批四类 Gap；
8. requirement 对应的主 Ability 可唯一解析；
9. 同一来源 Attempt 尚未形成 Request / Assignment / 已终止 Decision；
10. 当前核心题尚未触发过微训练；
11. 当前 Session 已完成微训练数少于 `2`，且不存在另一个 `pending / in_progress` Assignment；
12. 当前没有更高优先级的反馈后修订入口。

#### WP3.1.2 与反馈后修订互斥

第一版同一 `sourceLearningRoundId` 只允许一种即时干预：

```text
存在可用的反馈后修订
→ 本轮不创建微训练 Request
→ outcome = intervention_conflict
```

学生完成、放弃或错过修订后，也不回头为同一 Learning Round 再追加微训练。微训练应由后续独立核心题的新正式缺口触发，避免同一道题形成“反馈 → 修订 → 再补练”的过度干预链。

### WP3.2 确定性资源匹配器

匹配器输入：

```ts
type TargetedMicroTrainingMatchInput = {
  request: TargetedMicroTrainingRequest;
  sourceMaterialId: string;
  sourceResourceVersionId: string;
  sourceAnchors: TargetedSourceAnchor[];
  currentFrozenVersions: FrozenQuestionResourceVersion[];
  activeRegistryEntries: ResourceRegistryEntry[];
  activeMaterials: QuestionMaterialVersion[];
};
```

硬过滤顺序：

```text
当前 Frozen Head + Active Registry Link
→ Material usageType = targeted_excerpt
→ taskRole = training
→ Primary Ability 精确一致
→ primaryGapReasonCode 精确一致
→ targetedMaterialVersionId 与 Frozen Material Version 一致
→ Resource / Anchor 未被排除
→ Material 来源与内容身份有效
→ 同篇时 Anchor 不重叠且不存在答案泄露
```

任何硬条件失败都不得降级为近似匹配。

候选排序：

```text
不同材料、不同证据情境
→ 同篇但明确不同 Anchor
→ 提示强度和难度适配
→ 尚未被当前学生在本 Session 消费
→ resourceVersionId 稳定升序
```

排序最后必须使用稳定身份收口，禁止随机抽题导致刷新、跨标签或服务重试得到不同资源。

匹配结果：

```ts
type TargetedMicroTrainingMatchResult =
  | {
      status: 'matched';
      resourceVersionId: string;
      materialVersionId: string;
      matchPolicyVersion: string;
    }
  | {
      status: 'no_match';
      reasonCode: string;
      matchPolicyVersion: string;
    };
```

`no_match` 是正常业务结果：不创建 Assignment，不向学生显示错误，直接继续下一道核心题或完成 Session。

匹配阶段可以在内存中构造尚未持久化的 Request 候选；只有 `matched` 后才进入 Request / Assignment 原子命令。`no_match` 只持久化 Trigger Decision，不在正式 Request Repository 留下无法执行的请求。

### WP3.3 Request / Assignment Repository 与原子命令

阶段 1 只有 Schema 和写入校验，阶段 3 必须新增正式 Repository，并覆盖：

- InMemory；
- IndexedDB；
- Local API / 共享正式存储；
- Snapshot 导入、导出、重启恢复；
- 跨标签并发与 CAS / revision 冲突。

原子调度命令：

```text
读取或创建 Trigger Decision
→ 精确匹配
→ 幂等创建 Request
→ 幂等创建 Assignment
→ 提交同一 revision
```

不得出现 Request 已创建但 Assignment 丢失后，页面重复提交又产生第二条逻辑任务。重试必须复用相同 Request / Assignment 身份；若 Registry Head 在原子提交前变化，应重新校验匹配，不得把失效资源写入 Assignment。

### WP3.4 追加式 Session Overlay

不得修改：

```ts
LearningSessionTaskQueue.resourceVersionIds
LearningSessionTaskQueue.targetTaskCount
```

新增独立覆盖层：

```ts
type TargetedMicroTrainingSessionOverlay = {
  learningSessionId: string;
  mode: 'core' | 'targeted';
  activeAssignmentId?: string;
  returnToCoreTaskNumber?: number;
  completedAssignmentIds: string[];
  skippedAssignmentIds: string[];
  unavailableAssignmentIds: string[];
  consumedCount: number;
  overlayRevision: number;
  updatedAt: string;
};
```

核心任务进度始终由不可变核心队列计算。Overlay 只决定当前是否临时展示一个 Assignment，以及完成后返回哪个核心游标。

#### WP3.4.1 返回游标

完成核心第 `N` 题后创建的 Assignment：

```text
returnToCoreTaskNumber = N + 1
```

- 若 `N < targetTaskCount`：微训练结束后进入第 `N + 1` 道核心题；
- 若 `N = targetTaskCount`：`N + 1` 是合法的“核心队列已完成”哨兵，微训练结束后进入 Session 完成页，不读取不存在的核心资源；
- `returnToCoreTaskNumber` 不得回退到已完成题，也不得被当前页面临时序号覆盖。

#### WP3.4.2 状态机

```text
pending
├─ 学生进入题目且 Question Presentation 成功持久化 → in_progress
├─ 学生在进入前选择继续核心题组 → skipped
└─ 资源失效或读取失败 → unavailable

in_progress
├─ Attempt + Diagnosis + Evidence 完整持久化 → completed
├─ 退出或刷新 → 保持 in_progress，恢复原题
└─ 冻结资源无法读取 → unavailable

completed / skipped / unavailable
└─ 原子恢复 returnToCoreTaskNumber，mode = core
```

一旦 Question Presentation 已形成，即使 Registry Head 后续切换，也允许当前 `in_progress` Assignment 使用已绑定的不可变 Frozen Version 完成；新 Assignment 不得继续匹配旧 Head。

### WP3.5 Learning 页面接入

#### WP3.5.1 过渡页

只有真实 `matched + pending` 时才展示动态过渡：

```text
针对性练习
先用一小段文字练习如何把依据和判断连起来。

主操作：开始练习
次操作：继续下一题
```

次操作将 Assignment 标记为 `skipped` 并立即恢复核心游标。不得使用弹窗强迫完成，也不得在无匹配时展示空壳过渡页。

#### WP3.5.2 练习页

- 核心题进度保持“第 N / M 题”，不改为 M+1 或 M+2；
- 独立显示“针对性练习”，不暴露 Gap、Diagnosis、Strategy、Assignment 等内部术语；
- 材料标题继续遵守“《文章名称》· 作者；缺标题时显示阅读材料”；
- 单选、短文本、长文本继续复用既有作答组件和提交语义；
- 页面刷新恢复同一 Assignment、同一 Frozen Version 和已有草稿；
- 错误必须在当前操作区就近反馈，同时保留安全返回核心题组的主操作。

#### WP3.5.3 完成与返回

微训练反馈只解释当前动作，不宣称能力提升。主操作文案：

```text
仍有核心题：继续第 N 题
核心题已完成：完成本次学习
```

不得显示固定队列已删除的“为什么继续下一项任务”，也不得在返回时重新创建核心 Session。

### WP3.6 Attempt、Diagnosis 与 Evidence 隔离

微训练必须形成新的：

- `QuestionPresentationId`；
- `SubmissionIntentId`；
- `AttemptId`；
- `StudentResponseId`；
- `FormalDiagnosisId`；
- `AbilityEvidenceId`；
- `LearningRoundId`。

并额外保留：

```ts
type TargetedMicroTrainingEvidenceContext = {
  requestId: string;
  assignmentId: string;
  sourceLearningRoundId: string;
  sourceAttemptId: string;
  gapReasonCode: TargetedGapReasonCode;
  targetedMaterialVersionId: string;
  targetedResourceVersionId: string;
  promptDependency: 'none' | 'generic_hint' | 'specific_hint';
  taskNovelty: 'new_material' | 'distinct_anchor';
};
```

约束：

1. 微训练不覆盖来源核心 Attempt；
2. 微训练不计为来源题目的 Revision；
3. 微训练结果不改变来源 Diagnosis；
4. 微训练失败不触发新的微训练；
5. 微训练即时达标不直接生成“能力已掌握”；
6. 后续 Retest / Transfer 仍由既有 Strategy 独立决定。

### WP3.7 运行时事件与可观测性

阶段 3 只记录工程运行事件，不根据指标自动调参：

```text
targeted_trigger_evaluated
targeted_no_match
targeted_assignment_created
targeted_assignment_presented
targeted_assignment_completed
targeted_assignment_skipped
targeted_assignment_unavailable
targeted_core_queue_resumed
```

事件只包含稳定身份、策略版本、状态和时间，不记录学生完整答案、提示全文或材料全文。阶段 4 才对这些事件形成真实产品指标和教育效果口径。

### WP3.8 功能开关与放量边界

新增独立开关，例如：

```ts
targetedMicroTrainingSchedulingEnabled
```

- 关闭：触发器、匹配器和 Overlay 均不改变现有 Learning；
- 验证模式：只对隔离学生身份和隔离正式资源生效；
- 阶段 3 工程通过后：仍不得默认面向真实学生全量开启；
- 阶段 4 完成浏览器联调和首轮真实使用边界确认后，才能受控放量。

## 四、异常与恢复矩阵

| 异常 | 必须结果 |
| --- | --- |
| Diagnosis 缺少唯一主 Gap | `not_eligible`，继续核心题组 |
| `insufficient_to_judge` | 不创建 Request |
| 修订入口已成立 | `intervention_conflict`，只保留修订入口 |
| Session 已完成 2 道微训练 | `limit_reached`，继续核心题组 |
| 无精确资源 | 记录 `no_match`，不展示错误 |
| 匹配后 Registry Head 改变 | 原子提交前重算；已 Presentation 的 Frozen Version继续完成 |
| Request 已写、Assignment 提交冲突 | 重试同一确定性身份，不创建副本 |
| 刷新或跨标签同时进入 | CAS 只允许一个 `in_progress` Assignment |
| 微训练资源读取超时 | 就近提示并允许重试；持续失败标记 `unavailable` 后返回 |
| 微训练提交失败 | 保留草稿和 `in_progress`，不得跳过或重复 Attempt |
| Evidence 保存失败 | 不标记 `completed`；重试阶段提交 |
| 返回游标越界 | 使用已持久化哨兵语义完成 Session，不读取空资源 |
| 微训练再次形成缺口 | 只记录，不触发即时补练 |
| 功能开关关闭 | 现有固定题组行为完全不变 |

## 五、专项 Debug 矩阵

阶段 3 新增 `runTargetedMicroTrainingStage3Debug.ts`，建议至少覆盖以下 `40` 项：

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| TMT-S3-01 | 合法核心 Attempt + 唯一支持 Gap | Trigger eligible |
| TMT-S3-02 | Persistence 未完成 | 不触发 |
| TMT-S3-03 | 身份错位 Diagnosis | 不触发 |
| TMT-S3-04 | `insufficient_to_judge` | 不触发 |
| TMT-S3-05 | 多个主 Gap | 不触发 |
| TMT-S3-06 | 宏观能力弱项 | 不触发 |
| TMT-S3-07 | 来源是 Revision | 不触发 |
| TMT-S3-08 | 来源是微训练 | 不触发 |
| TMT-S3-09 | 修订入口同时成立 | 只保留修订 |
| TMT-S3-10 | 同一 Attempt 重复计算 | 同一 Decision |
| TMT-S3-11 | Ability + Gap + Role 精确资源 | 匹配成功 |
| TMT-S3-12 | 只有近似 Ability | `no_match` |
| TMT-S3-13 | 只有其他 Gap | `no_match` |
| TMT-S3-14 | Retest / Transfer 资源 | 不匹配 |
| TMT-S3-15 | Candidate / Draft / 非当前 Frozen | 不匹配 |
| TMT-S3-16 | Inactive Registry | 不匹配 |
| TMT-S3-17 | 同一 Resource 被排除 | 不匹配 |
| TMT-S3-18 | 同篇 Anchor 重叠 | 不匹配 |
| TMT-S3-19 | 不同材料与同篇合法 Anchor 并存 | 优先不同材料 |
| TMT-S3-20 | 同一候选集合重复匹配 | 结果稳定 |
| TMT-S3-21 | 匹配成功 | 原子创建 Request + Assignment |
| TMT-S3-22 | 重复提交 | 不重复 Request / Assignment |
| TMT-S3-23 | 跨标签并发 | 只有一个逻辑 Assignment |
| TMT-S3-24 | Registry revision 冲突 | 重算或安全 `no_match` |
| TMT-S3-25 | 核心队列创建 Assignment | `resourceVersionIds` 不变 |
| TMT-S3-26 | 完成核心第 2 题 | 返回第 3 题 |
| TMT-S3-27 | 完成最后一道核心题 | 微训练后进入完成页 |
| TMT-S3-28 | Pending 选择跳过 | 标记 skipped 并返回 |
| TMT-S3-29 | Presentation 成功 | Assignment 进入 in_progress |
| TMT-S3-30 | 刷新 in_progress | 恢复同一题和草稿 |
| TMT-S3-31 | Frozen 读取失败 | unavailable 并返回 |
| TMT-S3-32 | 微训练提交重试 | 不重复 Attempt |
| TMT-S3-33 | Diagnosis / Evidence 未完成 | 不标记 completed |
| TMT-S3-34 | 微训练完成 | 返回游标且 mode=core |
| TMT-S3-35 | 微训练失败 | 不连续追加下一道微训练 |
| TMT-S3-36 | 同一核心题第二次触发 | 阻断 |
| TMT-S3-37 | Session 第 3 次触发 | limit reached |
| TMT-S3-38 | 核心进度显示 | 分母不增加 |
| TMT-S3-39 | 功能开关关闭 | Learning 零变化 |
| TMT-S3-40 | Snapshot 重启恢复 | Queue / Overlay / Assignment 对齐 |

## 六、整体回归范围

阶段 3 至少运行：

- Targeted Micro-training Stage 1–3；
- Material Observation Draft Generator；
- Question Resource Admission / Candidate Workflow；
- Material Observation / Material Resource Production；
- Resource Coverage / Registry；
- Learning Session Task Queue；
- Phase 17.3 Learning Entry；
- Learning Persistence；
- Shared Formal Resource Cross-tab / Atomic Command；
- Reading Single-choice Stage 1–4；
- Learning Feedback Revision Stage 1–4；
- Student Learning Narrative；
- 生产构建；
- `git diff --check`。

任何现有核心题组连续学习、单选提交、文本提交、反馈后修订、刷新恢复、跨标签共享或 Session 完成回归失败，阶段 3 不得通过。

## 七、真实浏览器验收路径

阶段 3 至少完成以下隔离浏览器路径：

1. 支持 Gap 的核心文本题 → 正式反馈 → 针对性练习过渡 → 完成微训练 → 返回下一道核心题；
2. 支持 Gap 的核心单选题 → 精确干扰项 Diagnosis → 微训练 → 返回；
3. 无匹配资源 → 不显示错误或空页 → 直接进入下一道核心题；
4. 修订入口成立 → 不同时出现微训练入口；
5. 微训练页面刷新 → 恢复同一 Assignment 和草稿；
6. 微训练提交中断 → 重试后只有一个 Attempt；
7. 末道核心题触发 → 微训练完成后进入 Session 完成页；
8. Registry 资源停用 → Assignment unavailable → 安全返回；
9. 两个标签同时操作 → 不产生重复 Assignment；
10. 功能开关关闭 → 当前正式 Learning 行为与阶段 2 基线一致。

浏览器验收必须确认控制台无新增错误，所有失败提示出现在当前操作区域，不能要求学生滚动到页面顶部寻找错误。

## 八、阶段完成条件

只有同时满足以下条件，阶段 3 才可标记 `ENGINEERING + DEBUG PASS`：

1. 触发只来自正式、唯一、可执行的具体动作缺口；
2. 修订与微训练在同一来源轮次互斥；
3. 匹配严格使用 Ability + Gap + Training Role + 来源边界；
4. 无匹配和运行失败均不阻断核心学习；
5. Request / Assignment 在刷新、重试和跨标签下保持幂等；
6. 核心 Queue 内容和分母保持不变；
7. Pending / In-progress / Completed / Skipped / Unavailable 状态可恢复；
8. 正常题与末题两种返回游标均正确；
9. 同一核心题最多一次、单 Session 最多两次、微训练自身不触发补练；
10. 微训练 Attempt / Diagnosis / Evidence 与核心表现和 Revision 分离；
11. Stage 3 专项 Debug、整体回归、生产构建和真实浏览器验收通过；
12. 当前正式资源和真实学生默认不开启动态调度。

完成阶段 3 后状态只能标记为：

`STAGE 3 CONDITIONAL SCHEDULING PASS / REAL EFFECT PENDING`

不得把即时完成率解释为能力提升，也不得跳过阶段 4 的端到端真实校准。

## 九、相关文档

- [针对性短片段微训练材料与调度契约](./TARGETED_MICRO_TRAINING_MATERIAL_AND_SCHEDULING_CONTRACT.md)
- [阶段 2：生产工作台与首批资源工程实施及验收清单](./TARGETED_MICRO_TRAINING_STAGE2_PRODUCTION_ENGINEERING_PLAN.md)
- [阶段 2 工程与 Debug 验收](../education/phase/reports/targeted_micro_training_stage2_engineering_debug_acceptance_2026-08-20.md)
- [阶段 3 工程与 Debug 验收](../education/phase/reports/targeted_micro_training_stage3_engineering_debug_acceptance_2026-08-20.md)
- [学习反馈引导修订契约](./LEARNING_FEEDBACK_GUIDED_REVISION_CONTRACT.md)
- [学习反馈修订观察与审计契约](./LEARNING_FEEDBACK_REVISION_OBSERVATION_AND_AUDIT_CONTRACT.md)
- [学生学习叙事校准](./STUDENT_LEARNING_NARRATIVE_CALIBRATION.md)
- [真实 Learning 数据采集与观察契约](./REAL_LEARNING_DATA_COLLECTION_AND_OBSERVATION_CONTRACT.md)
- [正式资源生产契约地图](./FORMAL_RESOURCE_PRODUCTION_CONTRACT_MAP.md)
- [训练模型](../education/TRAINING_MODEL.md)
- [阶段 4：受控启用与真实校准契约](./TARGETED_MICRO_TRAINING_STAGE4_CONTROLLED_CALIBRATION_CONTRACT.md)
- [阶段 4：工程实施与验收清单](./TARGETED_MICRO_TRAINING_STAGE4_ENGINEERING_AND_ACCEPTANCE_PLAN.md)
