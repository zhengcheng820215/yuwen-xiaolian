# 知识练习第一阶段 WP5 错题即时巩固工程实施文档

状态：`DESIGN CONFIRMED / ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING`

版本：`knowledge_practice_phase1_wp5_reinforcement_engineering_v1.0`

日期：2026-08-29

上位依据：

- [学生唯一入口、正式阅读题库与轻量知识练习角色对齐决策（WP0A）](./STUDENT_SINGLE_ENTRY_FORMAL_READING_AND_KNOWLEDGE_PRACTICE_ALIGNMENT_DECISION_WP0A.md)
- [知识练习可用产品第一阶段总体工程方案](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md)
- [知识练习第一阶段执行清单](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md)
- [WP4 本地持久化与恢复工程实施文档](./KNOWLEDGE_PRACTICE_PHASE1_WP4_LOCAL_PERSISTENCE_AND_RECOVERY_PLAN.md)
- [WP7A 唯一入口最小整合工程实施文档](./KNOWLEDGE_PRACTICE_PHASE1_WP7A_SINGLE_ENTRY_INTEGRATION_ENGINEERING_PLAN.md)

前置状态：`WP0A CONFIRMED / WP1—WP4 + WP7A ENGINEERING PASS`

## 一、文档目的

本文把 WP5 冻结为一个可独立开发、测试、回滚和验收的工程工作包，回答六个问题：

1. 什么错误允许触发巩固题；
2. 什么内容关系才算可用变式；
3. 巩固题如何确定性选取并安全插入现有队列；
4. 重复提交、刷新恢复和多页面冲突下如何保持幂等；
5. 基础题首次表现与巩固表现如何严格隔离；
6. 当前零批准变式组的内容缺口如何解除，而不制造弱关联题。

本文末尾 D1—D10 为 WP5 代码开发前的关键决策，已由产品负责人于 2026-08-29 确认。WP5 工程代码开发已获授权，但尚未开始。

## 二、目标、非目标与准确声明

### 2.1 工程目标

当学生首次答错一道人工作为基础题选入的轻量知识题，且存在经过人工审核的相关变式时，系统在本轮后续位置最多安排一道相关巩固题，并保证：

- 学生先看到当前错因和解题步骤，再完成一次低负担迁移尝试；
- 同一原题不重复安排；
- 巩固题错误不递归触发；
- 每轮动态增加不超过 3 题；
- 刷新后题目、顺序、来源和已答事实不变；
- 基础题首次正确率不被巩固结果改写；
- 没有可靠变式时继续原会话，不用无关题凑功能。

### 2.2 非目标

WP5 不负责：

- 扩写正式 81 道阅读题库；
- 把知识练习事实写入正式 Diagnosis、Evidence、Profile 或 Trial；
- 生成式 AI 临场出题、语义相似度匹配或模糊判题；
- 建立长期遗忘曲线、跨设备同步或云端错题本；
- 输出“已掌握”“能力提升”等长期结论；
- 完成 WP6 的完整结果摘要和下一步推荐；
- 以达到 100 道为由降低题目或变式审核标准。

### 2.3 WP5 Engineering PASS 的准确声明

通过后只能声明：

> 对存在已审核变式关系的轻量知识错题，系统已能确定性、非递归、有限量地安排并恢复本轮巩固题；基础题首次表现与巩固表现保持隔离。

不得声明巩固已证明长期掌握、能力提升或教育效果成立。

## 三、当前工程与内容基线

### 3.1 可复用资产

现有代码已预留：

- `PracticeQueueItem.role: 'base' | 'reinforcement'`；
- `PracticeQueueItem.sourceQuestionId`；
- `PracticeResponse.role` 和 `sourceQuestionId`；
- 冻结的 `PracticeSession.queue`、稳定 seed 和 Queue Item ID；
- 幂等 Response、逐题反馈、原子 Repository 写入；
- active Attempt 本地持久化、备份、冲突检测和刷新恢复；
- `KnowledgeQuestion.variantGroupId`；
- Completion 只按 `role === 'base'` 计算首次正确率的基础实现。

因此 WP5 是对现有领域模型的受控启用，不另建第二套 Session 或 Store。

### 3.2 必须解除的工程限制

当前 `validatePracticeSession` 明确拒绝所有非 `base` Queue Item；WP5 必须把该临时 WP2 门禁替换为完整巩固队列不变量校验。

当前 `PracticeSessionContext.submitCurrentAnswer` 只完成“判题、记录、保存”，WP5 必须把“首次错误后的巩固调度”纳入同一次 Attempt 变换与同一次 Repository 提交，不能先保存答案、再异步补插队列。

### 3.3 当前内容限制

当前轻量知识题基线为：

- 27 道已迁移；
- 12 道 `approved`；
- 15 道 `draft`；
- 0 个批准的 `variantGroupId`；
- 0 条批准的 `ReinforcementLink`。

因此代码可以先由测试夹具证明，但生产浏览器链在至少一组真实变式通过人工审核前必须安静降级。WP5 Engineering PASS 不允许只靠测试夹具伪造产品可用性。

## 四、术语和事实边界

| 术语 | 定义 |
| --- | --- |
| 基础题 `base` | WP2 创建会话时冻结的原始题目，计入 `actualBaseQuestionCount` 和首次正确率 |
| 巩固题 `reinforcement` | 基础题首次答错后，由已审核关系动态加入本轮队列的另一道独立题 |
| 变式组 `variantGroupId` | 内容层声明多题训练目标一致的分组标识，本身不等于任意方向都适合巩固 |
| 巩固关系 `ReinforcementLink` | 内容审核后明确允许从某道原题指向某道巩固题的有向关系 |
| 首次作答 | 某 Queue Item 第一次成功创建的唯一 Response；重复提交不形成第二次事实 |
| 安静降级 | 不插题、不报错、不承诺“稍后有巩固题”，保留原反馈并继续会话 |

事实归属：

- 基础题 Response、巩固题 Response 和 Queue 关系属于 Knowledge Practice 本轮事实；
- 巩固题答对不能把原基础题 Response 改为正确；
- 巩固题答错不新增正式证据，也不触发下一层巩固；
- 轻量错题列表第一阶段只记录基础题首次错误，巩固题错误保留在 Attempt 内，不另写入错题列表；
- 巩固题答对不自动将原错题标记为 `resolved`。

## 五、内容关系契约

### 5.1 ReinforcementLink

新增独立、可校验的内容关系数据：

```ts
type ReinforcementLinkStatus = 'draft' | 'approved' | 'retired';

type ReinforcementLink = {
  schemaVersion: 1;
  id: string;
  contentVersion: number;
  status: ReinforcementLinkStatus;
  variantGroupId: string;
  sourceQuestionId: string;
  reinforcementQuestionId: string;
  applicableMisconceptionCodes?: string[];
  reviewFocus: string;
  reviewedAt?: string;
  reviewNote?: string;
};
```

约束：

- Link 是有向关系，`A → B` 不自动推出 `B → A`；
- source 与 target 必须是不同题目；
- 两题必须均为七年级上册、`approved` 且共享同一非空 `variantGroupId`；
- 两题的 `knowledgePoint` 和核心判断动作必须一致；
- `applicableMisconceptionCodes` 非空时，只允许命中当前错误 Response 的预设错因；
- 未配置该字段表示该原题的任一错误选项均可进入该关系，不表示可跨知识点匹配；
- Link 的 source、target、group 三元组不得重复；
- `approved` Link 必须有 `reviewedAt`、`reviewFocus` 和可追踪审核说明；
- `draft`、`retired` Link 永不进入学生调度。

### 5.2 为什么不只依赖 variantGroupId

`variantGroupId` 证明“训练目标属于同组”，但不能证明：

- 某个错误选项适合接哪一道题；
- 两题难度跳跃是否合理；
- 题干是否泄露上一题答案；
- A 到 B 与 B 到 A 是否都成立。

因此生产调度必须同时满足“同组 + 显式 approved Link”，禁止扫描同组后随意挑一题。

### 5.3 首批内容门禁

WP5 Engineering PASS 前至少形成：

- 3 个通过人工审核的变式组；
- 每组至少 2 道 `approved` 独立题；
- 至少覆盖 2 个分类和 3 个具体知识点；
- 至少 3 条可用于生产链的 approved 有向 Link；
- 每条 Link 均完成独立作答、答案边界、错因对应、答案泄露和难度跨度复核。

可以用“现有 approved 原题 + 新增一道人审变式”组成一组，不要求每组新增两题。无法达到上述门禁时，代码可标记实现完成，但 WP5 整体不得标记 Engineering PASS。

## 六、触发与候选资格

### 6.1 必须同时满足的触发条件

1. Session 为 `active`；
2. 当前 Queue Item 为 `base`；
3. 本次提交结果为 `outcome === 'created'`；
4. Response 为错误；
5. source Question 为当前内容版本的 `approved` 题；
6. source Question 存在 `variantGroupId`；
7. 当前 source Queue Item 尚未安排巩固；
8. 当前 Session 已安排巩固数小于 3；
9. 存在至少一个通过 6.2 全部过滤的候选。

基础题答对、重复提交、巩固题提交或恢复已答题时均不得触发。

### 6.2 候选过滤

候选必须：

- 来自 source 对应的 approved ReinforcementLink；
- Link 的错因限制为空或包含当前 `misconceptionCode`；
- target Question 当前仍为 `approved`；
- source 与 target 的 `variantGroupId` 与 Link 完全一致；
- target 与 source ID 不同；
- target 未出现在当前 Session 的任何 Queue Item 中，包括 `base` 和已安排的 `reinforcement`；
- target 内容版本有效；
- target 可由现有确定性判题器独立判定；
- 不依赖上一题反馈文本才能理解。

任何字段不一致都视为内容关系不可用并安静降级，同时只向调试测试暴露稳定 reason code，不向学生显示内部错误码。

### 6.3 确定性候选选择

多个候选同时可用时，使用现有 Session seed 派生稳定排序：

```text
candidateSeed = session.seed + sourceQueueItem.id + response.id
```

选择排序后的第一题。相同 Attempt 输入必须得到相同候选和相同 Queue Item ID，禁止使用 `Math.random()`、当前时间或页面渲染次数参与选择。

## 七、队列插入规则

### 7.1 Reinforcement Queue Item

插入项沿用现有结构：

```ts
type PracticeQueueItem = {
  id: string;
  questionId: string;
  questionContentVersion: number;
  role: 'reinforcement';
  sourceQuestionId: string;
  status: 'pending';
};
```

Queue Item ID 必须由 `sessionId + sourceQueueItemId + reinforcementQuestionId` 确定性生成。相同 source 重放调度不得产生新 ID。

### 7.2 插入位置

冻结以下算法：

1. 优先插入 `currentIndex + 2`，使学生先完成一道原队列题，再做相关巩固，降低机械照抄；
2. 当前题后没有足够待答项时，插入 `currentIndex + 1`；
3. 不得插入到 `currentIndex` 之前；
4. 不得移动已作答 Queue Item；
5. 已插入后的队列顺序立即冻结，刷新时不得重新计算位置。

示例：

```text
插入前：B1(当前已答错) → B2 → B3
插入后：B1 → B2 → R1(source=B1) → B3

尾题插入：B1 → B2 → B3(当前已答错) → R1
```

### 7.3 数量与非递归

- 每个 source Queue Item 最多 1 道巩固题；
- 每个 Session 最多 3 道巩固题；
- `actualBaseQuestionCount`、`baseQuestionIds` 和 `targetBaseQuestionCount` 永不改变；
- Queue 总长度上限为 `actualBaseQuestionCount + 3`；
- `reinforcement` Response 无论对错都不得调用调度器；
- 同一道 target Question 在同一 Session 最多出现一次。

## 八、原子性、幂等与状态变换

### 8.1 单次提交事务

将当前提交编排收敛为一个纯领域操作：

```ts
submitPracticeAnswerWithReinforcement({
  attempt,
  queueItemId,
  question,
  answer,
  approvedQuestions,
  approvedLinks,
}): SubmitPracticeAnswerWithReinforcementResult
```

成功路径按以下顺序在内存中一次完成：

```text
校验当前题
→ 幂等判题并创建 Response / Feedback
→ 若为新建的基础题错误，计算 ReinforcementDecision
→ 必要时插入 Queue Item
→ 校验完整 Attempt
→ Repository 单次 saveActiveAttempt
```

不得出现“Response 已持久化但 Queue 尚未插入”的两个业务提交。Repository 写入冲突时沿用 WP4 规则，不基于旧内存状态再次盲插。

### 8.2 ReinforcementDecision

领域层返回可测试但不直接面向学生的决策：

```ts
type ReinforcementDecision =
  | {
      outcome: 'scheduled';
      sourceQuestionId: string;
      reinforcementQuestionId: string;
      queueItemId: string;
      insertionIndex: number;
      linkId: string;
    }
  | {
      outcome: 'not_scheduled';
      reason:
        | 'response_correct'
        | 'not_base_item'
        | 'already_scheduled'
        | 'session_limit_reached'
        | 'source_group_missing'
        | 'approved_link_missing'
        | 'misconception_not_applicable'
        | 'candidate_already_in_session'
        | 'candidate_unavailable';
    };
```

`not_scheduled` 是正常结果，不作为页面错误或保存失败。

### 8.3 重放规则

- 重复点击提交沿用同一 Response，Queue 不变；
- 浏览器刷新只读取已保存 Queue，不重新调度；
- 相同 source 已有 `reinforcement` 项时返回 `already_scheduled`；
- 多标签页 revision 冲突时提示重新载入，不合并两个动态队列；
- 从 backup 恢复后以 backup 中冻结的 Queue 为准，不扫描历史 Response 补插题。

## 九、验证器与持久化

### 9.1 Session Validator 新不变量

移除“WP2 Session 只能包含基础题”的临时限制，改为验证：

- Queue 中 `base` 的顺序仍与 `baseQuestionIds` 完全一致；
- `base` 不得设置 `sourceQuestionId`；
- `reinforcement` 必须设置非空 `sourceQuestionId`；
- source 必须对应本 Session 的某个 `base` Question；
- source 在 Queue 中必须位于 reinforcement 之前；
- 每个 source 最多一个 reinforcement；
- reinforcement 总数不超过 3；
- Queue Question ID 全局不重复；
- Queue 总长度等于 `actualBaseQuestionCount + reinforcementCount`；
- 已完成 Session 的全部 Queue Item 均为 `answered`；
- 当前索引之前全部 answered，之后全部 pending 的 WP3 约束继续成立。

### 9.2 Schema 决策

WP2 已在 `PracticeSession schemaVersion: 1` 和 `PracticeResponse schemaVersion: 1` 中预留 reinforcement 角色和来源字段；WP5 只解除临时校验门禁，不增加 Store 根字段，因此：

- `PRACTICE_STORE_SCHEMA_VERSION` 保持 1；
- 物理 localStorage key 保持不变；
- 不执行破坏性 Store 迁移；
- WP4 的 backup、quarantine、future-version read-only 和 revision 冲突语义保持不变。

如果开发时发现必须增加不可选字段或改变既有字段含义，应停止并改走显式 schema v2 迁移，不得静默扩大 v1。

### 9.3 保存与恢复

- Response、Feedback、插入后的 Queue 通过同一 `activeAttempt` 保存；
- 刷新后 `currentIndex`、Queue 顺序、role、sourceQuestionId 和 Question contentVersion 必须一致；
- 巩固题目标内容版本不匹配时沿用 WP4 的不可恢复保护，不静默换成新版题；
- active Attempt 可恢复，completed Attempt 不反向恢复为 active；
- Store 写失败时页面可继续内存状态，但必须沿用“刷新可能无法恢复”的明确提示。

## 十、统计与错题事实隔离

### 10.1 基础题首次口径

以下字段只读取 `response.role === 'base'`：

- `baseQuestionCount`；
- `firstAttemptCorrectCount`；
- `firstAttemptAccuracy`；
- `mistakeCount`；
- 现有基础题作答时长口径。

例：5 道基础题答对 4 道，1 道巩固题答对，首次正确率仍为 `80%`，不得显示为 `5 / 6` 或 `100%`。

### 10.2 巩固统计

WP5 在完成摘要中增加独立、可由 Attempt 重建的字段；为兼容旧的零巩固完成记录，仅在本轮存在巩固题时写入：

```ts
reinforcementQuestionCount?: number;
reinforcementCorrectCount?: number;
reinforcementDurationMs?: number;
```

三者只读取 `role === 'reinforcement'`。WP6 可展示“完成 2 道巩固题，其中 1 道答对”，但不得据此改写基础题首次表现。

### 10.3 错题列表

- 只有新建的错误 `base` Response 调用 `upsertPersistedMistake`；
- 错误 reinforcement Response 不写入独立错题项；
- 正确 reinforcement Response 不自动 resolve source mistake；
- 学生手动“本轮已复习”仍沿用现有显式操作；
- 该规则避免将同一学习事件重复统计为两个长期错题事实。

## 十一、学生体验与文案

### 11.1 当前反馈区

基础题答错且成功安排后，在现有反馈下增加一条短提示：

> 已安排 1 道相关巩固题，将在稍后出现。

不得提前展示目标题答案或内部 Link 信息。没有候选时不展示失败提示，也不承诺稍后出现。

### 11.2 巩固题题卡

巩固题显示：

- 标签“本轮巩固题”；
- 说明“根据本轮一道错题安排”；
- 正常题干、作答、判题与反馈；
- 不显示“补考”“能力薄弱”“仍未掌握”等标签。

巩固题答错后的文案只说明本题事实和下一次检查动作，不出现“继续追加一道”的暗示。

### 11.3 进度

基础题分母保持冻结，动态题量单列，例如：

> 基础题 3 / 5 · 本轮另有 1 道巩固题待完成

禁止把进度从“3 / 5”无解释地跳成“3 / 6”。总队列位置可用于可访问性辅助文本，但不替代基础题口径。

### 11.4 唯一入口边界

WP5 页面仍位于 `/learning/knowledge/quiz/:category`；完成或退出后返回 `/learning/knowledge` 或 `/learning`。不得恢复 `/practice/knowledge` 的并列一级入口，不得影响 `/learning` 的正式任务优先级。

## 十二、建议代码变更

### 12.1 新增

```text
src/domain/knowledge-practice/reinforcement/reinforcementTypes.ts
src/domain/knowledge-practice/reinforcement/reinforcementLinks.ts
src/domain/knowledge-practice/reinforcement/reinforcementLinkValidator.ts
src/domain/knowledge-practice/reinforcement/selectReinforcementCandidate.ts
src/domain/knowledge-practice/reinforcement/schedulePracticeReinforcement.ts
src/domain/knowledge-practice/response/submitPracticeAnswerWithReinforcement.ts
src/ai/tests/runKnowledgePracticeWP5Debug.ts
```

### 12.2 修改

```text
src/data/knowledgeQuestionApprovedOverrides.ts
src/domain/knowledge-practice/practice/practiceSessionState.ts
src/domain/knowledge-practice/practice/practiceSessionValidator.ts
src/domain/knowledge-practice/response/practiceAttemptValidator.ts
src/domain/knowledge-practice/persistence/buildPracticeCompletionRecord.ts
src/domain/knowledge-practice/persistence/localPracticeStoreTypes.ts
src/domain/knowledge-practice/persistence/localPracticeStoreValidator.ts
src/context/PracticeSessionContext.jsx
src/pages/Quiz.jsx
src/components/knowledge-practice/KnowledgeQuestionCard.jsx 或现有等价组件
src/components/knowledge-practice/KnowledgeQuizProgress.jsx 或现有等价组件
package.json
```

内容新增可放入现有 overrides，也可建立独立 reviewed dataset；只能保留一个生产 Owner，不得让页面合并两套题源。

### 12.3 原则上不修改

```text
正式 Learning Session / Diagnosis / Evidence / Profile Runtime
.local-data/formal-resource-store.json
WP7A Student Learning Hub 主动作投射规则
正式 81 道 Resource、Registry、Version 与 Quality Trace
```

## 十三、实施工作包

### WP5-1：内容关系契约与门禁

交付：

- ReinforcementLink 类型、数据与校验器；
- 同组、双 approved、有向关系和审核字段门禁；
- 首批 3 组人工审核变式关系；
- 内容校验失败可阻断 WP5 检查命令。

完成条件：测试夹具与生产内容分离，生产 approved Link 不为零。

### WP5-2：候选选择与队列调度

交付：

- 纯函数候选过滤和 seed 稳定排序；
- 确定性 Queue Item ID；
- `+2` 优先、`+1` 降级插入；
- 单 source 上限、单 Session 上限和非递归；
- Session / Attempt 完整不变量校验。

完成条件：相同输入、重放、刷新前后均得到同一冻结队列。

### WP5-3：提交事务与持久化

交付：

- 判题与调度的单次 Attempt 变换；
- Repository 单次写入；
- revision 冲突、备份恢复和内容版本错配回归；
- 基础错题与巩固错误持久化隔离。

完成条件：不存在答案已保存但巩固队列丢失的可观察中间态。

### WP5-4：页面表达与统计

交付：

- 已安排提示、巩固题标签和动态进度；
- 基础首次正确率与巩固计数的纯统计；
- Completion 可重建字段；
- 手机、键盘和刷新链验收。

完成条件：学生能识别巩固题来源，但不会把一次答对理解为长期掌握。

### WP5-5：回归与工程收口

交付：

- WP5 自动化命令；
- WP1—WP4、WP7A 和正式 Learning 回归；
- Production Build；
- 浏览器主链、降级链和恢复链；
- WP5 Engineering Acceptance Report；
- 执行清单与中央状态同步。

## 十四、自动化验收矩阵

建议命令：

```json
{
  "debug:knowledge-practice-wp5": "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runKnowledgePracticeWP5Debug.ts"
}
```

### 14.1 内容关系：WP5-C01—C10

| Case | 验收 |
| --- | --- |
| C01 | approved Link 的 source 与 target 均为 approved |
| C02 | source 与 target 不同且共享同一 variantGroupId |
| C03 | Link 三元组重复被阻断 |
| C04 | Link 指向不存在、draft 或 retired 题被阻断 |
| C05 | approved Link 缺审核字段被阻断 |
| C06 | knowledgePoint 或核心判断动作不一致被内容门禁阻断 |
| C07 | 单向 Link 不自动生成反向 Link |
| C08 | misconception 限制只接受 source 已定义 code |
| C09 | 无 Link 的同组题不会进入生产候选 |
| C10 | 学生数据集中至少存在 3 组已审核关系且覆盖门禁成立 |

### 14.2 触发与选择：WP5-C11—C22

| Case | 验收 |
| --- | --- |
| C11 | base 首次答错且有候选时安排 1 题 |
| C12 | base 答对不安排 |
| C13 | reinforcement 答错不安排 |
| C14 | 重复提交不安排第二题 |
| C15 | source 无 variantGroupId 时安静降级 |
| C16 | 无 approved Link 时安静降级 |
| C17 | misconception 不适用时安静降级 |
| C18 | target 已在 base Queue 时被排除 |
| C19 | target 已作为 reinforcement 时被排除 |
| C20 | 多候选相同 seed 结果稳定 |
| C21 | 不同 source 可得到各自确定性候选 |
| C22 | 选择逻辑不读取 Math.random 或页面状态 |

### 14.3 队列与幂等：WP5-C23—C34

| Case | 验收 |
| --- | --- |
| C23 | 有后续基础题时优先插入 currentIndex + 2 |
| C24 | 尾部空间不足时插入 currentIndex + 1 |
| C25 | 不移动已答 Queue Item |
| C26 | baseQuestionIds、actualBaseQuestionCount 不变 |
| C27 | 每个 source 最多一个 reinforcement |
| C28 | Session 达 3 道上限后不再插入 |
| C29 | Queue 总长度不超过 base + 3 |
| C30 | Queue Question ID 全局无重复 |
| C31 | Queue Item ID 重放稳定 |
| C32 | Response 与 Queue role、sourceQuestionId 一致 |
| C33 | 非法 reinforcement 队列被 Validator 阻断 |
| C34 | completed Session 必须包含全部巩固题 Response |

### 14.4 持久化与统计：WP5-C35—C46

| Case | 验收 |
| --- | --- |
| C35 | Response、Feedback 和插入 Queue 只执行一次 Repository 保存 |
| C36 | 保存失败保留一致的内存 Attempt 并提示恢复边界 |
| C37 | revision 冲突不盲合并或重复插题 |
| C38 | 刷新后 Queue 顺序、来源和当前索引一致 |
| C39 | backup 恢复不重新调度历史错误 |
| C40 | target 内容版本错配触发 WP4 安全保护 |
| C41 | 5 道 base 对 4 道时首次正确率恒为 80% |
| C42 | 原题错、巩固题对不改写原题正确性 |
| C43 | 巩固计数、正确数和用时只读取 reinforcement Response |
| C44 | reinforcement 错误不写入独立错题项 |
| C45 | reinforcement 正确不自动 resolve source mistake |
| C46 | 无巩固的既有 v1 Store 和完成摘要保持可读 |

### 14.5 入口与表达：WP5-C47—C54

| Case | 验收 |
| --- | --- |
| C47 | Quiz 仍使用 `/learning/knowledge/**` 规范路由 |
| C48 | 安排成功后显示一次短提示 |
| C49 | 无候选时不显示错误或虚假承诺 |
| C50 | 巩固题有可读标签和来源说明 |
| C51 | 基础题进度分母不因插题跳变 |
| C52 | 状态不只依赖颜色表达 |
| C53 | 页面无“已掌握”“能力已提升”等越界表达 |
| C54 | WP5 不创建正式 Evidence、Profile、Trial 或 Resource 写入 |

## 十五、必须执行的回归

```text
npm run debug:knowledge-practice-wp1
npm run debug:knowledge-practice-wp2
npm run debug:knowledge-practice-wp3
npm run debug:knowledge-practice-wp4
npm run debug:knowledge-practice-wp5
npm run debug:knowledge-practice-wp7a
npm run debug:unified-learning-entry
npm run debug:phase16-3-day0-integration
npm run debug:product-runtime-reliability-wp-r2
npm run build
```

实施时以 `package.json` 的真实命令为准。任何既有关键回归失败都不能用“与 WP5 无关”直接豁免，必须先定位并记录证据。

## 十六、浏览器人工验收

### B1：正常触发

1. 从 `/learning` 进入基础知识巩固；
2. 建立包含已审核 source 的练习；
3. 故意首次答错 source；
4. 核对反馈与“已安排”提示；
5. 核对先出现一道原队列题，再出现巩固题；
6. 完成巩固并确认基础题进度分母未变化。

### B2：非递归与上限

1. 连续触发 3 道巩固；
2. 第 4 道可触发基础题答错后不再插题；
3. 故意答错一题 reinforcement；
4. 确认没有继续追加，Queue 总长稳定。

### B3：安静降级

依次验证：无 group、无 Link、错因不适用、候选已在 Session、target 非 approved。每种情况均应保留原反馈、正常继续且不显示内部错误。

### B4：刷新与恢复

1. 触发巩固但尚未做到该题；
2. 在反馈状态刷新；
3. 确认 Response、Feedback、Queue、插入位置和来源保持；
4. 做完前一道题再次刷新；
5. 确认下一题仍是同一 reinforcement，不创建重复项。

### B5：统计隔离

完成 5 道基础题和至少 1 道巩固题，核对：

- 首次正确率只用 5 道基础题；
- 巩固结果独立；
- 原题错后巩固答对，原题仍为错误事实；
- 错题列表不新增 reinforcement 错误，也不自动消除 source 错题。

### B6：多页面与写入异常

- 两个标签页同时打开同一 active Attempt；
- 一个页面触发巩固，另一页面尝试提交；
- 确认 revision 冲突要求重新载入，不产生双队列；
- 模拟写入失败时页面不白屏，内存状态内部一致。

### B7：响应式与可访问性

在 390px、768px 和 PC 宽度检查题卡标签、反馈提示、基础题进度、按钮焦点顺序和长文案换行；控制台不得出现未处理错误。

## 十七、故障、降级与停止条件

| 场景 | 行为 |
| --- | --- |
| Link 数据不可用 | 不调度，原会话继续 |
| target 题不存在或非 approved | 不调度并由内容检查报告 |
| Session 已达上限 | 不调度，不向学生报错 |
| Queue 校验失败 | 禁止保存新状态，保留上一份可恢复 Store |
| localStorage 写失败 | 保留一致内存 Attempt，提示刷新恢复无保证 |
| target 内容版本变化 | 不替换题，执行 WP4 不可恢复保护 |
| 正式 Runtime 故障 | 不改变 WP5 Store，仍按 WP7A 独立故障规则 |

出现以下任一情况立即停止 WP5 发布：

- 动态 Queue 可超过 3 道巩固上限；
- reinforcement 可以递归触发；
- 重复提交或刷新生成重复 Queue Item；
- 基础题首次正确率被巩固结果改写；
- active Attempt 因新 Validator 被错误隔离；
- 未经审核的 Link 或 draft 题进入生产；
- 知识练习写入正式 Evidence / Profile / Trial；
- `/learning` 唯一入口或 WP1—WP4 关键链发生回归。

## 十八、回滚策略

WP5 回滚只撤销调度入口和页面表达：

- 停用 ReinforcementLink 生产调度；
- 新建 Session 恢复只含 base 的既有行为；
- 已持久化的 active reinforcement Queue 必须继续由兼容代码完成或显式安全放弃，不能静默删题；
- 不清空 localStorage，不删除 Response、Feedback 或错题事实；
- 不回退正式 Learning 资源与入口；
- 回滚版本仍需能读取已产生的 reinforcement Queue，否则必须先提供显式迁移或只读恢复页。

## 十九、Engineering PASS 门禁

WP5 只有同时满足以下条件才能标记 `ENGINEERING PASS`：

1. D1—D10 已确认；
2. ReinforcementLink 数据契约和校验器通过；
3. 至少 3 组生产变式关系通过人工审核并满足覆盖门禁；
4. 触发、候选过滤、确定性选择和插入位置通过；
5. 每 source 1 题、每 Session 3 题和非递归规则通过；
6. 提交与调度为单次 Attempt 变换和单次 Repository 保存；
7. 刷新、backup、内容版本错配和 revision 冲突链通过；
8. 基础首次正确率、巩固统计和错题列表事实完全隔离；
9. WP5-C01—C54 全部通过；
10. WP1—WP4、WP7A、Unified Learning 和 Runtime 关键回归通过；
11. Production Build 通过；
12. B1—B7 浏览器验收通过；
13. 输出 WP5 Engineering Acceptance Report 与真实已知限制；
14. 执行清单、产品控制表和系统地图状态同步；
15. 未提前实现 WP6 长期结论或推荐逻辑。

Engineering PASS 后，WP6 才可进入代码开发；真实学生对巩固关联性和反馈价值的判断继续归 WP7B Product Acceptance。

## 二十、关键决策确认

| 编号 | 决策 | 推荐结论 | 实施影响 |
| --- | --- | --- | --- |
| D1 | 触发对象 | 只允许首次答错的 `base` Queue Item | 重复提交和 reinforcement 永不触发 |
| D2 | 内容关系 | 必须同时具备同一 `variantGroupId` 与 approved 有向 ReinforcementLink | 禁止仅凭分类、知识点字符串或相似度配题 |
| D3 | 插入位置 | 优先 `currentIndex + 2`，尾部降级 `+1` | 降低立即机械模仿，刷新后位置冻结 |
| D4 | 数量上限 | 每 source 最多 1 道、每 Session 最多 3 道 | 阻止动态题量失控 |
| D5 | 递归规则 | reinforcement 无论对错均不再触发 | 保持低负担和可预测完成时间 |
| D6 | 无候选处理 | 安静降级，只保留当前反馈 | 不以无关题凑功能 |
| D7 | 统计口径 | 基础首次正确率与巩固计数完全分离 | 巩固答对不改写原题 |
| D8 | 错题事实 | 错题列表只新增错误 base；reinforcement 不新增、不自动 resolve source | 避免重复事实和虚假掌握 |
| D9 | 内容门禁 | Engineering PASS 前至少 3 个审核变式组、覆盖 2 分类和 3 知识点 | 测试夹具不能替代生产内容 |
| D10 | 数据与产品边界 | 保持 Store schema v1 预留结构，不进入正式 Evidence / Profile | 复用 WP4，维持 WP0A 隔离 |

建议签署语：

> 确认 WP5 的 D1—D10，授权进入 WP5 工程代码开发；实施必须同时完成已审核变式内容门禁，在 WP5 Engineering PASS 前不进入 WP6 代码开发。

确认记录：2026-08-29，产品负责人确认 WP5 D1—D10，授权进入 WP5 工程代码开发；实施必须同时完成已审核变式内容门禁，在 WP5 `ENGINEERING PASS` 前不进入 WP6 代码开发。

确认结果：`CONFIRMED`
