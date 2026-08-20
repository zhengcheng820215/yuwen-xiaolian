# 针对性短片段微训练阶段 4：工程实施与验收清单

英文名称：Targeted Micro-training Stage 4 Engineering and Acceptance Plan

状态：`ENGINEERING + CONTROLLED BROWSER PASS / REAL CALIBRATION PENDING`  
文档版本：`targeted_micro_training_stage4_engineering_acceptance_v1.1`  
日期：`2026-08-20`

当前工程实现已经完成受控资源包 Manifest、幂等导入、暂停/回滚、四态启用、运行事件 Ledger / Outbox、Episode / Follow-up 投影、校准指标和内部控制台，并通过阶段 4 专项 Debug `51 / 51`。`B4-01—B4-16` 已在 `isolated_verify` 下完成全量真实浏览器联调；5—7 日单学生真实观察仍未完成，因此不得标记真实校准或教育效果通过。

工程验收记录见：[阶段 4 工程与 Debug 验收](../education/phase/reports/targeted_micro_training_stage4_engineering_debug_acceptance_2026-08-20.md)与[阶段 4 全量真实浏览器联调验收](../education/phase/reports/targeted_micro_training_stage4_full_browser_acceptance_2026-08-20.md)。

## 零、阶段结论边界

阶段 4 按以下顺序执行：

```text
WP4.1 受控资源包导入与回滚
→ WP4.2 完整 targeted Assignment 浏览器联调
→ WP4.3 运行事件、完整性审计与校准投影
→ WP4.4 内部只读观察与暂停控制
→ WP4.5 单学生真实观察窗口
→ WP4.6 校准决策与工程收口
```

WP4.1–WP4.4 通过，只能标记：

`ENGINEERING + CONTROLLED BROWSER PASS / REAL CALIBRATION PENDING`

WP4.5–WP4.6 还必须完成真实观察，才能判断是否进入：

`CONTROLLED SINGLE-LEARNER CALIBRATION PASS / GENERALIZATION NOT PROVEN`

若数据不足或出现风险，必须使用 `INSUFFICIENT DATA` 或 `PAUSED`，不能以工程通过代替真实校准。

## 一、进入条件

开始阶段 4 工程前必须满足：

1. Stage 1 Schema Debug `16 / 16 PASS`；
2. Stage 2 Resource Production Debug `32 / 32 PASS`；
3. Stage 3 Conditional Scheduling Debug `57 / 57 PASS`；
4. Stage 3 默认关闭与无匹配安全浏览器冒烟通过；
5. 阶段 2 隔离资源包保持独立，当前 12 篇核心材料、61 道活动题目未被静默迁移；
6. 受控资源包完成正式内容复核并能生成稳定 Manifest；
7. 当前正式 Learning 的选择题、文本题、Revision、固定题组继续和 Session 完成回归通过。

如资源包尚未获得正式导入批准，可实施 WP4.3 的纯 Schema 与隔离测试，但不得执行真实产品导入或单学生观察。

## 二、WP4.1 受控资源包导入与回滚

### 2.1 工程对象

新增：

```ts
type TargetedMicroTrainingControlledPackManifest = {
  packId: string;
  packVersion: string;
  sourceSnapshotRevision: number;
  materialVersionIds: string[];
  resourceVersionIds: string[];
  registryResourceIds: string[];
  gapCoverage: Record<TargetedGapReasonCode, number>;
  manifestHash: string;
  status: 'prepared' | 'imported' | 'paused' | 'rolled_back';
  reviewedAt: string;
  importedAt?: string;
  rolledBackAt?: string;
};
```

新增 Repository / Service：

- `TargetedMicroTrainingPackRepository`；
- `prepareControlledTargetedPack`；
- `importControlledTargetedPack`；
- `pauseControlledTargetedPack`；
- `rollbackControlledTargetedPack`；
- `auditControlledTargetedPack`。

### 2.2 原子导入

一次导入命令必须原子验证或分阶段可恢复写入：

```text
Manifest 校验
→ Material Version 幂等写入
→ Frozen Resource Version 幂等写入
→ Registry Head 原子更新
→ 导入审计完成
```

发生中断时，重试从正式快照继续，不重复创建 Material、Frozen Version 或 Registry Entry。

不得覆盖同 `resourceId` 下不同内容的现有 Frozen Head；身份冲突必须阻断并输出结构化错误。

同一不可变 `packId + packVersion + manifestHash` 在完整回滚后允许再次导入，用于恢复与重复联调；再次导入仍须执行完整身份、观察链和 Registry 一致性校验。若内容或身份发生变化，必须发布新的 Pack Version 和 Material / Resource 身份，不得复用旧版本伪装更新。

### 2.3 回滚

回滚命令必须：

- 阻止新 Assignment；
- 只撤销本 Manifest 引入的活动 Link；
- 恢复受影响资源的导入前 Registry Head；
- 保留已完成的历史版本和学生事实；
- 对 Pending Assignment 执行 unavailable 安全返回；
- 重复执行保持幂等。

## 三、WP4.2 完整浏览器联调

### 3.1 验证模式

只允许在 `isolated_verify` 下联调：

- 使用隔离学生身份；
- 使用受控 Pack Version；
- 不进入真实效果分母；
- 浏览器刷新与跨标签共享正式 Repository；
- 页面参数不能切换到正式单学生模式。

### 3.2 必验路径

| 编号 | 浏览器路径 | 必须结果 |
| --- | --- | --- |
| B4-01 | 核心文本题形成支持 Gap | 显示一项准确的针对性练习过渡 |
| B4-02 | 核心单选错选映射支持 Gap | 由稳定干扰项偏差精确触发 |
| B4-03 | Revision 入口成立 | 只显示 Revision，不显示微训练 |
| B4-04 | 无精确资源 | 不显示空过渡和错误，继续核心题组 |
| B4-05 | 开始微训练 | 展示正确短片段、Frozen 题目和独立进度 |
| B4-06 | Pending 选择跳过 | 返回下一核心题或完成页 |
| B4-07 | 微训练刷新 | 恢复同一 Assignment 与草稿 |
| B4-08 | 提交途中刷新或重试 | 只有一个 targeted Attempt |
| B4-09 | 微训练完成 | 展示克制反馈并返回冻结核心游标 |
| B4-10 | 核心末题触发 | 微训练后进入 Session 完成页 |
| B4-11 | Registry 在 Pending 时停用 | Assignment unavailable 并安全返回 |
| B4-12 | 两标签同时开始 | 只有一个 in-progress Assignment |
| B4-13 | 开关关闭 | 当前 Learning 与 Stage 3 基线一致 |
| B4-14 | 运行错误 | 错误出现在当前操作区域，不要求滚到顶部 |
| B4-15 | 单选微训练 | 选项、提交、反馈和答案隔离正常 |
| B4-16 | 文本微训练 | Validity、Diagnosis、反馈和恢复正常 |

所有浏览器路径必须检查：控制台无新增错误；核心进度分母不增加；Material、Resource、Attempt 和 Assignment 身份一致；学生界面不显示 Gap Code、策略版本或内部错误码。

WP4.2 全部通过后，阶段 3 才可从“受控 targeted 浏览器路径待验收”更新为 `STAGE 3 CONDITIONAL SCHEDULING PASS / REAL EFFECT PENDING`。

### 3.3 受控浏览器验收参数

- `stage4verify=1` 只允许进入隔离工程验收，不进入真实效果分母；
- `stage4choice=1` 只在同时存在 `stage4verify=1` 时将可匹配资源限制为 `single_choice`，用于确定性覆盖 B4-15；
- 上述参数不得改变正式单学生启用状态，不得成为生产调度偏好，也不得投射到学生界面；
- 验收后必须再次确认无参数正式 Learning 仍消费完整候选集合。

## 四、WP4.3 事件 Ledger、Outbox 与校准投影

### 4.1 Repository

新增：

- `TargetedMicroTrainingRuntimeEventRepository`；
- In-memory / IndexedDB 实现；
- `TargetedMicroTrainingEventOutboxRepository`；
- `TargetedMicroTrainingCalibrationEpisodeRepository`；
- `TargetedMicroTrainingFollowUpObservationRepository`。

写入顺序：

```text
正式学习对象提交成功
→ 对应 targeted Event 写入
→ 失败则进入 Outbox
→ 后台按稳定 eventId 幂等补写
→ Episode Projection 重算
```

事件写入不得成为学习提交事务的失败前置条件；正式 Assignment 状态和核心游标仍是恢复权威。

### 4.2 Episode 投影

投影必须从正式对象和事件重建，不依赖页面状态。至少检查：

- Decision、Request、Assignment 关系；
- source Attempt 与 targeted Attempt 不同；
- targeted Attempt 的 Resource Version 等于 Assignment；
- Assignment terminal 状态与核心返回事件闭合；
- 同一 Episode 没有重复呈现、重复完成或两个返回结果；
- `no_match` 没有虚构 Assignment；
- Revision Episode 不进入 targeted 分母。

### 4.3 Follow-up 投影

后续核心题、Retest 或 Transfer 完成后，只有独立性校验通过才生成 `qualified` Follow-up。无法建立 Ability / Gap 比较或答案不足时记录 `insufficient_to_judge`，不得默认视为改善。

## 五、WP4.4 内部观察与控制

新增只读内部面板，不进入学生页面：

- 当前 Enablement Mode；
- Pack ID / Version / Manifest Hash；
- Trigger、Match、Start、Completion、Skip、Unavailable、Return；
- Immediate Resolution；
- Follow-up Coverage 与 Same-gap Recurrence；
- 按 Gap / Ability / responseFormat / taskRole 分层；
- Integrity、Outbox、Pending / In-progress 异常；
- `INSUFFICIENT DATA` 与排除原因。

面板必须显示分子、分母与样本量，不允许只显示百分比。答案正文、材料全文和学生可识别信息不进入汇总页。

控制操作仅提供：

- 启用隔离验证；
- 开始受控单学生观察；
- 暂停新调度；
- 回滚 Pack；
- 重试 Outbox；
- 导出脱敏校准快照。

控制操作必须二次确认影响范围并写入审计，但不增加学生或录入人员的人工步骤。

## 六、WP4.5 单学生真实观察

### 6.1 启动前检查

进入 `controlled_single_learner` 前必须确认：

- WP4.1–WP4.4 全部通过；
- 当前 Pack 通过完整性审计；
- 默认关闭仍成立；
- 固定产品学生已有稳定备份与恢复路径；
- 当前活动核心资源快照有记录；
- 暂停与回滚操作已经演练；
- 学生无需理解实验、Gap 或内部策略术语。

### 6.2 观察周期

首轮建议 `5–7` 个自然日。每天只记录自然发生的正式学习，不为达到数量强制学生重复做题。

最低治理观察：

- 运行安全：至少 5 次 presented Assignment、至少 3 个 Session；
- 初步教育方向：至少 8 个 completed Episode，至少 6 个可判断 qualified Follow-up；
- 数量不足则延长观察并标记 `INSUFFICIENT DATA`；
- 同一学生的多次 Episode 只能作为纵向事实，不能包装成多人样本。

### 6.3 每日检查

- 是否存在卡死、重复 Assignment / Attempt 或核心游标错位；
- 是否有学生跳过、退出或明确不愿继续；
- Match 是否集中在单一 Gap 或资源；
- Immediate Resolution 是否依赖特定提示；
- 是否已经产生独立 Follow-up；
- Outbox 和完整性审计是否闭合。

不得在观察期中途因为单次表现自动修改策略或题目。必要修复若改变触发、匹配、提示、资源版本或指标分母，必须结束当前窗口并开启新的 Policy / Pack Version 窗口。

## 七、WP4.6 校准决策

观察窗口结束后生成版本化报告：

```ts
type TargetedMicroTrainingCalibrationDecision = {
  decisionId: string;
  policyVersion: string;
  packVersion: string;
  observationWindow: { startedAt: string; endedAt: string };
  sampleSummary: {
    sessions: number;
    presented: number;
    completed: number;
    qualifiedFollowUps: number;
  };
  runtimeSafety: 'pass' | 'fail' | 'insufficient_data';
  educationalSignal: 'favorable' | 'neutral' | 'adverse' | 'insufficient_data';
  decision: 'continue_controlled' | 'adjust_resources' | 'tighten_policy' | 'pause';
  reasons: string[];
  decidedAt: string;
};
```

决策必须基于可追溯聚合，不由 AI 自由生成。AI 可以整理说明，不得更改指标或决策门禁。

## 八、专项 Debug 矩阵

新增 `runTargetedMicroTrainingStage4Debug.ts`，至少覆盖以下 48 项：

### 8.1 Pack 与模式（S4-01—S4-12）

1. 合法 Manifest 通过；
2. Manifest Hash 不一致阻断；
3. Material 元数据不完整阻断；
4. Frozen / Registry Head 错位阻断；
5. Gap 覆盖声明不实阻断；
6. 重复导入幂等；
7. 资源身份冲突阻断；
8. 暂停后不创建新 Assignment；
9. 回滚恢复原 Registry Head；
10. 回滚保留历史 Attempt；
11. 页面参数只能进入 isolated_verify；
12. 模式切换审计完整。

### 8.2 事件与完整性（S4-13—S4-28）

13. 每个 Decision 恰好一个 evaluated 事件；
14. eligible 正确闭合为 no_match 或 Assignment；
15. no_match 不产生 Assignment；
16. created / presented 身份一致；
17. completed 只来自 in-progress；
18. skipped 只来自 Pending；
19. unavailable 可安全闭合；
20. terminal 恰好一个 Core Return；
21. 事件重试复用 eventId；
22. Outbox 不阻断主链；
23. Outbox 补写不重复事件；
24. 重复 Episode 被审计阻断；
25. source / targeted Attempt 必须不同；
26. Resource Version 与 Assignment 对齐；
27. Revision 不进入 targeted Episode；
28. 答案和材料全文不进入 Event。

### 8.3 Follow-up 与指标（S4-29—S4-40）

29. 不同材料 Follow-up qualified；
30. 同篇不同 Anchor 可 qualified；
31. 同一资源重答不独立；
32. Revision 不独立；
33. 微训练自身不成为 Follow-up；
34. 无效回答 insufficient；
35. Gap 不可比较 insufficient；
36. Trigger Rate 分母正确；
37. Match Rate 不把 no-match 当学生失败；
38. Completion Rate 分母为 in-progress；
39. Same-gap Recurrence 排除 insufficient；
40. Retest 与 Transfer 分层，不混成总体分数。

### 8.4 决策与回滚（S4-41—S4-48）

41. 样本不足输出 insufficient_data；
42. 单学生重复 Episode 不变成多人样本；
43. 硬故障生成 pause 决策；
44. Match 低只生成资源建议，不放宽门禁；
45. 指标不自动修改 Prompt / Policy；
46. Policy Version 变化切断旧窗口；
47. Pack Version 变化切断旧窗口；
48. 脱敏快照不含答案正文和可识别信息。

实际实现可以增加 Case，但不得删除上述边界。

## 九、整体回归

阶段 4 至少运行：

- Targeted Micro-training Stage 1–4；
- Controlled Pack Production / Import / Rollback；
- Material Observation 与 Resource Admission；
- Registry / Shared Formal Resource Cross-tab；
- Learning Session Task Queue；
- Unified Learning Entry 与 Learning Persistence；
- Reading Single-choice Stage 1–4；
- Learning Feedback Revision Stage 1–4；
- Real Learning Collection、Projection Integrity 与 Outbox；
- Student Learning Narrative；
- 生产构建；
- `git diff --check`。

任一核心学习、固定题组、正式资源、Revision、单选、文本题或恢复回归失败，阶段 4 工程不得通过。

## 十、工程验收报告模板

工程完成后新增：

`docs/education/phase/reports/targeted_micro_training_stage4_engineering_browser_acceptance_YYYY-MM-DD.md`

报告必须包含：

1. 实际实现文件和版本；
2. Pack Manifest 与导入前后快照；
3. 回滚演练结果；
4. Stage 4 专项 Debug 逐项计数；
5. 整体回归与生产构建；
6. 16 条真实浏览器路径结果；
7. 控制台与错误就近展示检查；
8. 核心 Queue、Attempt、Evidence 身份审计；
9. 仍未进入真实效果结论的明确声明。

真实观察结束后另建：

`docs/education/phase/reports/targeted_micro_training_stage4_real_calibration_YYYY-MM-DD.md`

该报告必须显示分子、分母、样本量、排除原因、Policy / Pack Version、观察期、暂停事件与外推限制。

## 十一、阶段完成条件

### 11.1 工程与受控浏览器通过

必须同时满足：

1. Manifest 导入、暂停和回滚幂等；
2. Stage 3 全 targeted 浏览器路径通过；
3. 核心 Queue 与进度分母不变；
4. Request / Assignment / Attempt / Event / Episode 身份完整；
5. Outbox 与跨标签恢复通过；
6. Follow-up 独立性校验成立；
7. 指标分母和排除原因可审计；
8. 内部控制可立即暂停新调度；
9. Stage 1–4 专项、整体回归和生产构建通过；
10. 默认正式模式仍为 disabled。

满足后标记：

`ENGINEERING + CONTROLLED BROWSER PASS / REAL CALIBRATION PENDING`

### 11.2 单学生真实校准通过

必须同时满足：

1. 完成冻结版本下的真实观察窗口；
2. 运行安全治理样本达到最低范围；
3. Core Return 无不可恢复失败；
4. 没有重复 Assignment / Attempt、身份串线或答案泄露；
5. Follow-up Coverage 足以形成初步方向，或诚实标记不足并延长；
6. 校准决策有版本、有证据、有外推限制；
7. 未自动修改正式题目、Prompt、Policy 或 Ability Profile；
8. 产品负责人明确选择继续受控、调整或暂停。

只有真实数据达到门槛且运行安全通过时，才可标记：

`CONTROLLED SINGLE-LEARNER CALIBRATION PASS / GENERALIZATION NOT PROVEN`

## 十二、相关文档

- [阶段 4：受控启用与真实校准契约](./TARGETED_MICRO_TRAINING_STAGE4_CONTROLLED_CALIBRATION_CONTRACT.md)
- [针对性短片段微训练材料与调度契约](./TARGETED_MICRO_TRAINING_MATERIAL_AND_SCHEDULING_CONTRACT.md)
- [阶段 3 工程实施与验收清单](./TARGETED_MICRO_TRAINING_STAGE3_LEARNING_SCHEDULING_ENGINEERING_PLAN.md)
- [阶段 3 工程与 Debug 验收](../education/phase/reports/targeted_micro_training_stage3_engineering_debug_acceptance_2026-08-20.md)
- [真实 Learning 数据采集与观察契约](./REAL_LEARNING_DATA_COLLECTION_AND_OBSERVATION_CONTRACT.md)
- [真实 Learning 最小采集工程契约](./REAL_LEARNING_MINIMUM_COLLECTION_ENGINEERING_CONTRACT.md)
- [AI 训练任务、题目采用与真实作答校准契约](./AI_QUESTION_ADOPTION_AND_EMPIRICAL_CALIBRATION_CONTRACT.md)
- [产品负责人控制表](./PRODUCT_CONTROL_TABLE.md)
