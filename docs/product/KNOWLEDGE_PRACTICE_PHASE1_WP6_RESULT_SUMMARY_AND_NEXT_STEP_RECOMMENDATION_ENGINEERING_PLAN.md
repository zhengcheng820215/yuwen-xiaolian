# 知识练习第一阶段 WP6 结果摘要与下一步推荐工程实施文档

状态：`ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING`

版本：`knowledge_practice_phase1_wp6_engineering_plan_v1.0`

日期：`2026-08-30`

上位方案：[`KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md`](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md)

中央执行清单：[`KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md`](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md)

入口与资源角色决策：[`STUDENT_SINGLE_ENTRY_FORMAL_READING_AND_KNOWLEDGE_PRACTICE_ALIGNMENT_DECISION_WP0A.md`](./STUDENT_SINGLE_ENTRY_FORMAL_READING_AND_KNOWLEDGE_PRACTICE_ALIGNMENT_DECISION_WP0A.md)

前置验收：[`KNOWLEDGE_PRACTICE_PHASE1_WP5_ENGINEERING_ACCEPTANCE_REPORT.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP5_ENGINEERING_ACCEPTANCE_REPORT.md)

## 一、文档目的

本文将 WP6“结果摘要与下一步推荐”拆解为可直接编码、测试、回归和验收的工程契约，解决当前结果页只能展示基础统计和通用文案、不能准确回答“本轮哪里需要巩固、为什么这样推荐、下一步能否直接开始”的问题。

本文不重新定义 WP0A、WP1—WP5 已冻结的产品规则。发生冲突时按以下优先级处理：

1. WP0A 的学生唯一入口、正式阅读主线与轻量知识练习角色边界；
2. 第一阶段总体方案中的统计、结果与推荐口径；
3. WP5 已通过的基础题与巩固题事实隔离；
4. 本文的 WP6 工程细化规则。

本文末尾 D1—D12 已由产品负责人于 2026-08-30 整体确认并授权进入代码开发。WP6 现已达到 Engineering PASS，但不自动授权修改正式 Evidence、Profile、Resource 或 Learning Runtime。

## 二、目标、非目标与准确声明

### 2.1 工程目标

WP6 必须完成：

1. 从已完成且通过校验的 `PracticeAttempt` 构建不可变 `PracticeResult`；
2. 结果页只从 `PracticeResult` 展示统计，不在 JSX 中重新计算业务指标；
3. 基础题首次表现与巩固题表现完全分开；
4. 使用响应记录中的真实用时，并按单题上限计算有效累计用时；
5. 按知识点聚合本轮基础题证据，并输出受限、可解释的四级学生文案；
6. 仅按已审核结构化错因聚合；没有结构化错因时回退到本轮具体错题；
7. 生成确定性、带依据、当下可执行的下一步推荐；
8. 提供复盘或重做本轮错题、开始专项、开始综合练习、返回 `/learning`；
9. 兼容 WP4 本地持久化、WP5 动态巩固队列和 WP7A 唯一入口；
10. 结果刷新、旧记录恢复、多标签页冲突和内容不足均有受控表现。

### 2.2 非目标

WP6 不做：

- 不生成长期“掌握度”“能力等级”“薄弱能力”或成长趋势；
- 不把知识练习结果写入正式 Evidence / Profile / Trial；
- 不把 81 道正式阅读题并入轻量知识题 Store；
- 不用大模型、模糊相似度或临时推断生成错因和推荐；
- 不引入跨设备、账户或云端同步；
- 不改造正式阅读结果页；
- 不解决 19 道 approved 轻量题的长期内容容量问题；
- 不在 WP6 内宣告 Product Acceptance PASS 或 Educational Evidence PASS；
- 不把 Result 页面重新建设成第二个学生首页。

### 2.3 WP6 Engineering PASS 的准确声明

WP6 Engineering PASS 只能声明：

> 对一组已完成的轻量知识练习，系统可以基于冻结的本轮作答事实，稳定生成基础题首次表现、巩固表现、有效用时、知识点摘要、已审核错因摘要和一项可执行的下一步推荐；结果页刷新后保持一致，且不越过正式能力证据边界。

不得据此声明：

- 学生已经掌握或未掌握某知识；
- 推荐能改善长期能力；
- 当前 19 道 approved 题可以支撑长期连续使用；
- 学生唯一入口已经完成真实用户产品验收；
- 第一阶段全部完成。

## 三、当前工程基线

### 3.1 已通过前置能力

| 能力 | 当前事实 | WP6 复用方式 |
| --- | --- | --- |
| 题目契约 | WP1 `47 / 47 PASS` | 读取冻结题目身份、分类、知识点和内容版本 |
| 会话与选题 | WP2 `47 / 47 PASS` | 复用 category / mixed 新会话创建与近期降权 |
| 作答与反馈 | WP3 `49 / 49 PASS` | 读取幂等 Response、反馈和结构化错因 |
| 持久化与恢复 | WP4 `33 / 33 PASS` | 扩展最近完成记录，不新增页面级 localStorage 写入 |
| 唯一入口 | WP7A `50 / 50 PASS` | 所有动作保持在 `/learning` 及 `/learning/knowledge/**` |
| 错题即时巩固 | WP5 `54 / 54 PASS` | 保持 base / reinforcement 分账和非递归规则 |

### 3.2 当前结果实现

当前 `buildPracticeCompletionRecord.ts` 已保存：

- 基础题数量；
- 基础题首次答对数量与正确率；
- 基础题响应累计用时；
- 错题数量；
- 可选的巩固题数量、答对数量和用时；
- 完成时间和完整 `completedAttempt`。

当前 `Result.jsx` 已能读取 `lastCompletion.summary`，但仍存在以下限制：

1. 结果结构只是 WP4/WP5 兼容摘要，还不是完整 `PracticeResult`；
2. 知识点和错因没有聚合；
3. 用时直接求和，没有 WP6 明确的有效计时口径；
4. 下一步文案由页面根据 `mistakeCount` 临时分支，缺少领域规则和推荐依据；
5. “再练一次”固定进入综合练习，不一定对应本轮问题；
6. 结果页不能提供精确的本轮错题重做会话；
7. 旧 completion record 尚无新结果结构的显式兼容策略。

### 3.3 内容与验收限制

当前轻量知识题为 `19 approved / 15 draft`，已审核变式关系为 `3 个 variant group / 6 条有向 ReinforcementLink`。WP6 推荐必须基于当下 approved 库存验证动作可执行，但 Engineering PASS 不以扩充到 100 道为门禁。

## 四、术语和事实边界

| 术语 | WP6 定义 |
| --- | --- |
| 基础题 | Session 创建时冻结在 `baseQuestionIds` 中、Queue Item role 为 `base` 的题 |
| 巩固题 | WP5 根据 approved 有向 Link 插入、Queue Item role 为 `reinforcement` 的题 |
| 首次正确率 | 正确基础题 Response 数 / 冻结基础题数，巩固题永不回写 |
| 原始用时 | Response 中已校验并冻结的 `durationMs` |
| 有效用时 | 每条 Response 原始用时与 WP6 单题上限的较小值之和 |
| 本轮证据 | 当前一个 completed PracticeSession 内的基础题 Response |
| 结构化错因 | WP3 从审核内容映射并冻结在 Response / Feedback 中的 misconception |
| 推荐 | 对本轮事实的确定性下一动作，不是能力诊断 |
| 可执行 | 推荐构建时存在 approved 候选，点击时仍通过当前 Session 冲突与库存校验 |
| 复盘本轮错题 | 查看本轮错误快照，不等于修改错题状态或长期掌握结论 |
| 重做本轮错题 | 用仍为 approved 的本轮错误基础题创建新的 `mistake_review` Session |

所有学生可见结论必须带“本轮”边界。禁止使用：

- 已掌握；
- 尚未掌握；
- 能力提升；
- 基础薄弱；
- 学习态度问题；
- 以后不会再错；
- 已通过巩固掌握。

## 五、PracticeResult 领域契约

### 5.1 建议类型

```ts
export type PracticeResult = {
  schemaVersion: 1;
  resultId: string;
  sourceSessionId: string;
  mode: 'category' | 'mixed' | 'mistake_review';
  category?: KnowledgeQuestionCategory;
  completedAt: string;
  basePerformance: BasePerformanceSummary;
  reinforcementPerformance: ReinforcementPerformanceSummary;
  timing: PracticeTimingSummary;
  knowledgePoints: KnowledgePointResultSummary[];
  misconceptions: MisconceptionResultSummary[];
  wrongItems: PracticeWrongItemSummary[];
  recommendation: PracticeRecommendation;
  statementBoundary: 'current_round_only';
};

export type BasePerformanceSummary = {
  questionCount: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  firstAttemptAccuracy: number;
};

export type ReinforcementPerformanceSummary = {
  scheduledCount: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
};

export type PracticeTimingSummary = {
  perResponseCapMs: 600_000;
  rawDurationMs: number;
  effectiveDurationMs: number;
  baseEffectiveDurationMs: number;
  reinforcementEffectiveDurationMs: number;
  cappedResponseCount: number;
};
```

### 5.2 身份与不可变性

- `resultId` 固定为由 `sourceSessionId` 派生的稳定身份，不使用渲染时间或随机数；
- 同一 completed Attempt 重建必须得到深度相同的结果；
- 输入对象不得被修改；
- Result 页面不得改写 `PracticeResult`；
- 推荐点击只创建新 Session，不修改来源结果；
- 原 Session、Response、Feedback、题目内容版本必须保留；
- 所有展示所需的错题、知识点、错因和推荐依据均冻结为快照，避免后续题库改动改变历史结果。

### 5.3 构建函数

```ts
buildPracticeResult({
  completedAttempt,
  questionSnapshots,
  approvedQuestionInventory,
}): BuildPracticeResultResult
```

前置条件：

1. Attempt 通过 WP3/WP5 验证器；
2. Session 状态为 `completed`；
3. 每个 Queue Item 都有且只有一条匹配 Response；
4. 基础题身份与 `baseQuestionIds` 一致；
5. `questionSnapshots` 的内容版本与 Queue 冻结版本一致；
6. 缺失非关键展示快照时允许受控降级，缺失统计事实时构建失败。

构建失败不得保存半成品 Result；原 completed Attempt 和其他本地记录必须保留。

### 5.4 验证器不变量

新增 `validatePracticeResult`，至少验证：

- Result 与来源 Session 身份、模式、分类、完成时间一致；
- 基础题数量等于 Session 冻结基础题数；
- `correct + incorrect = answered = questionCount`；
- 巩固题数量与来源 Queue 一致；
- 正确率是 0—100 的整数且可由冻结计数重算；
- 所有时长是有限、非负整数；
- 有效用时不大于原始用时；
- knowledge point 聚合总数等于基础题数；
- wrong items 只来自错误 base Response；
- misconception 只来自错误 base Response 的审核 code；
- recommendation 类型、路由、参数和依据一致；
- 不包含正式 Evidence、Profile 或 mastery 字段。

## 六、基础题与巩固题统计

### 6.1 基础题首次表现

```ts
firstAttemptAccuracy = baseQuestionCount === 0
  ? 0
  : Math.round(baseCorrectCount / baseQuestionCount * 100);
```

统计只读取 role 为 `base` 的 Response。即使来源基础题答错后巩固题答对，来源基础题仍计为错误。

正常 completed Session 理论上不允许 0 道基础题；Result builder 和 validator 仍必须防止除零，以兼容损坏隔离和单元测试。

学生展示：

- 主标题：`本轮首次正确率 80%`；
- 辅助计数：`基础题 4 / 5 首次答对`；
- 不再出现“本次得分”“80 分”或星级换算。

### 6.2 巩固题表现

巩固题单独展示：

- 安排数量；
- 已完成数量；
- 答对数量；
- 答错数量；
- 有效用时。

没有巩固题时显示“本轮未安排额外巩固题”，不得显示 `0 分` 或暗示系统遗漏。

巩固题答对只能表述为：

> 本轮安排的 1 道巩固题中，答对 1 道。

不得表述为“巩固后已掌握”。

## 七、有效用时规则

### 7.1 计算口径

WP6 不使用 `completedAt - startedAt` 作为学习用时，因为页面停留、切换标签和离开浏览器会污染该值。

固定规则：

```ts
const PER_RESPONSE_EFFECTIVE_CAP_MS = 10 * 60 * 1000;
effectiveDurationMs = sum(
  min(response.durationMs, PER_RESPONSE_EFFECTIVE_CAP_MS)
);
```

- 基础题与巩固题分别累计，再合并为总有效用时；
- 原始 Response 不被改写；
- `cappedResponseCount` 只用于测试和解释，不默认展示给学生；
- UI 使用 `X 分 Y 秒`，不足 1 分钟时使用 `Y 秒`；
- 0 秒显示“少于 1 秒”，不得人为改为 1 分钟。

### 7.2 与 WP3 的关系

WP3 的输入验证上限用于拒绝异常提交；WP6 的 10 分钟上限用于结果统计。两者职责不同，不应通过修改历史 Response 实现。

## 八、知识点摘要

### 8.1 聚合结构

```ts
export type KnowledgePointResultLevel =
  | 'insufficient_evidence'
  | 'steady_this_round'
  | 'reinforce_this_round'
  | 'prioritize_this_round';

export type KnowledgePointResultSummary = {
  knowledgePoint: string;
  category?: KnowledgeQuestionCategory;
  baseQuestionCount: number;
  correctCount: number;
  incorrectCount: number;
  firstOccurrenceIndex: number;
  level: KnowledgePointResultLevel;
  studentMessage: string;
};
```

### 8.2 判定优先级

按以下顺序唯一判定：

| 条件 | level | 学生表达 |
| --- | --- | --- |
| 基础题数 0—1 | `insufficient_evidence` | 本轮证据较少 |
| 基础题数至少 2 且错误数为 0 | `steady_this_round` | 本轮表现较稳 |
| 基础题数至少 2 且错误数为 1 | `reinforce_this_round` | 本轮建议巩固 |
| 基础题数至少 2 且错误数至少 2 | `prioritize_this_round` | 本轮优先巩固 |

只有 1 道题且答错时，知识点标签仍为“本轮证据较少”；推荐规则可以依据这一个真实错误提供错题重做，但不得把单题错误升级为“薄弱知识点”。

### 8.3 排序

结果页排序：

1. `prioritize_this_round`；
2. `reinforce_this_round`；
3. `insufficient_evidence`；
4. `steady_this_round`；
5. 同级按错误数降序；
6. 再按首次出现顺序；
7. 最后按稳定字符串顺序。

## 九、错因摘要与错题回退

### 9.1 结构化错因

只聚合错误 base Response 中已有的 `misconceptionCode`。学生文案优先使用来源 Feedback 已冻结的 `misconception.studentMessage`，不通过 code 临时生成新诊断。

```ts
export type MisconceptionResultSummary = {
  code: string;
  studentMessage: string;
  occurrenceCount: number;
  questionIds: string[];
  firstOccurrenceIndex: number;
};
```

排序规则：出现次数降序 → 首次出现顺序 → code 稳定顺序。

### 9.2 本轮错题快照

每个错误 base Response 冻结：

- questionId 和 contentVersion；
- category 和 knowledgePoint；
- 题干快照；
- 学生答案；
- 正确答案；
- 关键依据；
- 是否存在结构化错因。

若本轮存在错误但没有结构化错因，结果页展示具体错题列表，文案为“本轮这些题可以再看一次”，不得推断共同原因。

若同时有结构化和非结构化错误：先显示审核错因摘要，再显示未被结构化错因覆盖的具体错题。

## 十、确定性下一步推荐

### 10.1 推荐契约

```ts
export type PracticeRecommendation = {
  type:
    | 'continue_active_session'
    | 'retry_wrong_items'
    | 'start_category_practice'
    | 'start_mixed_practice'
    | 'return_to_learning';
  title: string;
  reason: string;
  targetPath: string;
  sourceKnowledgePoint?: string;
  category?: KnowledgeQuestionCategory;
  targetCount?: number;
  sourceQuestionIds?: string[];
  availability: 'available' | 'fallback';
};
```

`continue_active_session` 是 Result 页结合当前 Store 状态形成的展示覆盖，不写回历史 `PracticeResult`。其余推荐在结果生成时冻结。

### 10.2 推荐规则

按以下顺序选择且只生成一个主要推荐：

1. 访问结果页时若另有 active PracticeSession，页面主要动作改为“继续当前练习”；历史 Result 不变；
2. 某知识点至少 2 道基础题且错误至少 2 次，推荐该知识点所属分类的 5 题专项；
3. 没有上述集中错误但存在本轮错误，推荐重做本轮错误基础题；
4. 全部基础题首次答对，且 mixed 练习存在 approved 候选，推荐新的综合练习；
5. 目标动作没有可用 approved 题时，依次降级为可用的错题重做、分类入口或返回 `/learning`；
6. 永不生成点击后必然得到空题组的推荐。

### 10.3 错误知识点选择

候选知识点排序：

1. 错误基础题数量降序；
2. 该知识点基础题数量降序；
3. 首次错误在 Queue 中的位置升序；
4. knowledgePoint 稳定字符串顺序。

推荐理由必须包含本轮事实，例如：

> 本轮“成语感情色彩”3 道基础题中有 2 道首次答错，建议继续完成“成语运用”5 题专项。

禁止文案：

> 你的成语能力薄弱，系统判断你还没有掌握。

### 10.4 重做本轮错题

WP6 补齐 `mistake_review` Session 的最小构建能力：

- 输入只接受来源 Result 的错误 base question IDs；
- 保持来源错误出现顺序；
- 去重并过滤非 approved、缺失或版本不可用题；
- 最多 10 道，实际不足时使用实际数量；
- 不把 reinforcement 错误加入重做集合；
- 新建独立 Session ID，不修改来源结果；
- 重做 Session 中的题仍视为新一轮 base，可按 WP5 规则触发一次巩固；
- 全部来源题不可用时禁止创建，并执行明确降级推荐。

`mistake_review` 是轻量知识练习内部模式，不进入正式 Evidence/Profile。

## 十一、持久化与旧结果兼容

### 11.1 Completion Record 版本

根 `LocalPracticeStore` 第一阶段继续保持 `schemaVersion: 1`，避免无关全量迁移。`lastCompletion` 使用显式子版本联合：

```ts
type PracticeCompletionRecord =
  | PracticeCompletionRecordV1
  | PracticeCompletionRecordV2;

type PracticeCompletionRecordV2 = {
  schemaVersion: 2;
  sessionId: string;
  completedAttempt: PracticeAttempt;
  result: PracticeResult;
  completedAt: string;
};
```

V2 不再要求页面读取旧 `summary`。旧 V1 仅作为兼容输入存在。

### 11.2 迁移规则

- 读取到合法 V2：直接验证并使用；
- 读取到合法 V1 且 `completedAttempt` 完整：确定性重建 V2；
- V1 重建缺少非关键题干快照：保留统计并使用受控展示降级；
- V1 缺少关键 Response 或身份不一致：只隔离 `lastCompletion`，不得清空 active Attempt、完成历史或错题；
- 重建后的 V2 在下一次安全写入时持久化，不在未来版本只读状态下覆盖；
- 多标签页仍使用 WP4 revision 冲突规则，不进行自动合并。

### 11.3 保存时机

完成 Session 的同一次 Repository 事务必须原子生成并保存：

1. completed Attempt；
2. completed session history；
3. PracticeResult；
4. WP5 错题事实。

Result 构建失败时不得写入“Session 已完成但 Result 半成品”的不一致状态。

## 十二、Result 页面与交互

### 12.1 信息层级

结果页顺序固定为：

1. 本轮模式和完成状态；
2. 首次正确率主指标；
3. 基础题计数和有效用时；
4. 巩固题独立结果；
5. 需要关注的知识点；
6. 审核错因或具体错题回退；
7. 一项主要下一步推荐及依据；
8. 次要动作：查看错题、选择其他知识练习、返回学习入口；
9. “只代表本轮”的边界说明。

### 12.2 路由与动作

| 动作 | 目标 |
| --- | --- |
| 继续当前知识练习 | 当前 active Session 的 `/learning/knowledge/quiz/**` |
| 重做本轮错题 | 由 `PracticeResult.wrongItems` 创建 `mistake_review` Session 后进入 Quiz |
| 开始专项 | `/learning/knowledge/quiz/{category}`，通过 Context 创建 category Session |
| 新的综合练习 | `/learning/knowledge/quiz/all`，通过 Context 创建 mixed Session |
| 查看本机错题 | `/learning/knowledge/mistakes` |
| 返回统一入口 | `/learning` |

页面不得只依赖 Link 假定 Session 一定创建成功。推荐动作需调用 Context 的受控创建方法，成功后导航；失败时留在结果页展示明确错误或降级动作。

### 12.3 可访问性与响应式

- 390px 宽度无横向溢出；
- 结果状态同时使用文字和图形，不只依赖颜色；
- 主要动作可键盘聚焦和触发；
- 聚合列表使用语义标题和列表结构；
- 读取、迁移、冲突和动作失败使用 `role=status` 或 `role=alert`；
- 长知识点和错因文案可换行，不截断关键依据；
- 首屏不堆叠超过一个主按钮。

## 十三、建议代码变更

### 13.1 新增

```text
src/domain/knowledge-practice/result/
├── practiceResultTypes.ts
├── buildPracticeResult.ts
├── practiceResultValidator.ts
├── aggregateKnowledgePointResults.ts
├── aggregateMisconceptionResults.ts
└── selectPracticeRecommendation.ts

src/components/knowledge-practice/
├── PracticeResultOverview.jsx
├── ReinforcementResultSummary.jsx
├── KnowledgePointResultList.jsx
├── MisconceptionResultList.jsx
└── PracticeNextStepCard.jsx

src/ai/tests/
└── runKnowledgePracticeWP6Debug.ts
```

### 13.2 修改

| 文件 | 变更 |
| --- | --- |
| `persistence/buildPracticeCompletionRecord.ts` | 改为调用纯函数 `buildPracticeResult` |
| `persistence/localPracticeStoreTypes.ts` | 增加 Completion Record V1/V2 联合 |
| `persistence/localPracticeStoreValidator.ts` | 验证新 Result，并兼容旧 V1 |
| `persistence/migrateLocalPracticeStore.ts` | 增加旧 completion 的受控重建 |
| `practice/practiceSessionTypes.ts` | 使 `mistake_review` 成为可构建模式 |
| `practice/buildPracticeSession.ts` | 支持受控错误题 ID 集合 |
| `practice/practiceSessionValidator.ts` | 增加 mistake review 身份与数量不变量 |
| `PracticeSessionContext.jsx` | 暴露推荐动作和错题重做的受控创建方法 |
| `pages/Result.jsx` | 只负责加载状态、布局和动作编排 |
| `package.json` | 增加 WP6 调试/验收命令 |

### 13.3 原则上不修改

- 正式 Learning Runtime、Evidence、Profile 和 Resource Repository；
- WP5 ReinforcementLink 内容关系；
- WP3 判题结果和已冻结 Response；
- 81 道正式阅读资源；
- `/learning` 唯一入口优先级规则。

若实现中必须修改上述边界，停止 WP6 开发并回到文档重新确认。

## 十四、实施工作包

### WP6-1：结果契约与纯构建器

交付：

- PracticeResult 类型；
- 基础题、巩固题和有效用时聚合；
- Result validator；
- V1/V2 completion 兼容类型。

完成条件：同一 completed Attempt 可重复生成相同且通过校验的 Result。

### WP6-2：知识点、错因与错题摘要

交付：

- 知识点四级规则；
- 审核错因聚合；
- 无错因的具体错题回退；
- 学生文案边界检查。

完成条件：所有聚合可由基础 Response 逐项追溯，不推断缺失事实。

### WP6-3：推荐与 mistake review

交付：

- 确定性推荐选择器；
- 推荐库存可用性检查；
- `mistake_review` 最小 Session 构建；
- Context 受控动作。

完成条件：主要推荐点击后能创建合法 Session，或在库存变化时明确降级。

### WP6-4：持久化与迁移

交付：

- Completion Record V2；
- V1 Result 重建；
- Repository 原子完成事务；
- 损坏隔离和多标签页冲突回归。

完成条件：刷新读取同一 Result，旧记录不造成白屏或全库清空。

### WP6-5：结果页与工程收口

交付：

- Result 页面组件化；
- 响应式、键盘和非颜色表达；
- WP1—WP5、WP7A、正式 Runtime 回归；
- Production Build；
- WP6 Engineering Acceptance Report。

完成条件：自动化、浏览器和回归门禁全部通过。

## 十五、自动化验收矩阵

### 15.1 结果契约：WP6-C01—C12

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP6-C01 | 5 道基础题答对 4 道 | 首次正确率 80% |
| WP6-C02 | 0 道基础题防御输入 | 不除零，结果校验受控失败或返回 0% |
| WP6-C03 | 原题错、巩固题对 | 基础首次正确率不变 |
| WP6-C04 | 2 道巩固题答对 1 道 | 巩固统计为 1 / 2 |
| WP6-C05 | 无巩固题 | 显式 0 数量，不影响基础统计 |
| WP6-C06 | Queue 与 Response 数不一致 | Result 构建失败 |
| WP6-C07 | Result Session 身份不一致 | Validator 失败 |
| WP6-C08 | 同一 Attempt 构建两次 | 深度相同 |
| WP6-C09 | 构建 Result | 不修改输入 Attempt 和题目 |
| WP6-C10 | Result 含 mastery / Evidence 字段 | Validator 或静态门禁失败 |
| WP6-C11 | Result JSON roundtrip | 结构和语义不变 |
| WP6-C12 | 页面统计来源 | 不在 Result JSX 重算业务统计 |

### 15.2 用时与知识点：WP6-C13—C24

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP6-C13 | 单题 30 秒 | 有效用时 30 秒 |
| WP6-C14 | 单题 15 分钟 | 有效用时封顶 10 分钟 |
| WP6-C15 | 基础与巩固均有响应 | 分项和总有效用时一致 |
| WP6-C16 | 原始用时被封顶 | Response 原值不变 |
| WP6-C17 | 一个知识点只有 1 道且答对 | 本轮证据较少 |
| WP6-C18 | 一个知识点只有 1 道且答错 | 仍为本轮证据较少 |
| WP6-C19 | 同知识点至少 2 道全对 | 本轮表现较稳 |
| WP6-C20 | 同知识点至少 2 道错 1 道 | 本轮建议巩固 |
| WP6-C21 | 同知识点至少 2 道错 2 道 | 本轮优先巩固 |
| WP6-C22 | 巩固题答对 | 不改变知识点基础层级 |
| WP6-C23 | 聚合顺序相同输入 | 输出顺序稳定 |
| WP6-C24 | 聚合数量 | 与全部基础题一一对应 |

### 15.3 错因与推荐：WP6-C25—C40

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP6-C25 | 两次相同审核错因 | 聚合为 2 次 |
| WP6-C26 | 两个错因同次数 | 按首次出现顺序 |
| WP6-C27 | 无 misconceptionCode | 不生成推测错因 |
| WP6-C28 | 部分错误无结构化错因 | 显示对应具体错题 |
| WP6-C29 | reinforcement 错误 | 不进入基础错因摘要 |
| WP6-C30 | 一个知识点错误最多 | 推荐该知识点所属分类 |
| WP6-C31 | 错误数并列 | 按题数、首次出现和稳定字符串决胜 |
| WP6-C32 | 仅 1 次零散错误 | 推荐重做本轮错题 |
| WP6-C33 | 全部基础题正确 | 推荐新综合练习 |
| WP6-C34 | 目标分类无 approved 题 | 不生成不可执行专项 |
| WP6-C35 | 本轮错题全部不可用 | 错题重做降级 |
| WP6-C36 | 推荐理由 | 包含知识点、题数和本轮边界 |
| WP6-C37 | 相同输入 | 推荐完全相同 |
| WP6-C38 | 推荐选择 | 不调用 Math.random 或大模型 |
| WP6-C39 | 已存在 active Session | UI 主要动作改为继续，不覆盖 Session |
| WP6-C40 | 学生文案 | 不出现已掌握、能力提升或长期诊断 |

### 15.4 重做、持久化与页面：WP6-C41—C56

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP6-C41 | 3 道错误 base 可用 | 创建 3 道 mistake_review Session |
| WP6-C42 | 输入含重复 ID | 去重且保持首次顺序 |
| WP6-C43 | 输入含 reinforcement ID | 排除或阻断 |
| WP6-C44 | 1 道来源题 retired | 过滤并使用实际数量 |
| WP6-C45 | 所有来源题不可用 | 不创建空 Session |
| WP6-C46 | 重做 Session | 新 Session ID，不修改来源 Result |
| WP6-C47 | 合法 V1 completion | 重建合法 V2 Result |
| WP6-C48 | V1 关键响应缺失 | 仅隔离 lastCompletion |
| WP6-C49 | V2 刷新读取 | Result 深度一致 |
| WP6-C50 | 完成事务写入失败 | 内存状态一致并提示，持久化不留半成品 |
| WP6-C51 | revision 冲突 | 不自动覆盖另一页面结果 |
| WP6-C52 | future Store | 不迁移、不写回 |
| WP6-C53 | 结果页空状态 | 返回知识练习入口，不白屏 |
| WP6-C54 | 推荐创建失败 | 留在结果页并展示可恢复动作 |
| WP6-C55 | 结果路由 | 保持 `/learning/knowledge/result` 规范路径 |
| WP6-C56 | 代码依赖 | 不导入正式 Evidence/Profile 写入模块 |

## 十六、必须执行的回归

WP6 Engineering PASS 前必须执行：

1. WP1 数据契约与迁移全量回归；
2. WP2 选题、Session seed 和近期去重全量回归；
3. WP3 判题、幂等 Response 和反馈全量回归；
4. WP4 持久化、恢复、损坏隔离和多标签页回归；
5. WP5 巩固调度、上限、恢复和统计隔离全量回归；
6. WP7A 唯一入口、旧路由兼容和双 active 投射回归；
7. Unified Learning Entry 正式主线回归；
8. Runtime Recovery / 核心新会话准入回归；
9. Vite production build；
10. `git diff --check` 和本地 Markdown 链接检查。

任何正式 Evidence/Profile 写入变化、正式阅读题量变化或 `/learning` 优先级变化均视为 WP6 越界，不以新增测试替代停止条件。

## 十七、浏览器人工验收

### B1：基础结果与用时

1. 完成 5 道基础题，其中首次答对 4 道；
2. 核对首屏显示 80%，不显示得分；
3. 核对基础题计数和真实有效用时；
4. 刷新结果页，数值与顺序不变。

### B2：巩固分账

1. 答错一题并完成后续巩固；
2. 核对基础首次正确率仍按原题错误计算；
3. 核对巩固数量和正确数单独展示；
4. 核对不存在“巩固后已掌握”。

### B3：知识点与错因

1. 构造同知识点至少 2 次基础错误；
2. 核对“本轮优先巩固”及真实题数依据；
3. 核对审核错因按次数展示；
4. 对无结构化错因题，核对只展示具体错题，不生成原因。

### B4：推荐专项

1. 完成含集中错误的综合练习；
2. 核对推荐目标为错误最多知识点所属分类；
3. 点击主要推荐；
4. 核对创建合法 category Session，题量不足时使用实际数量；
5. 返回结果页不改写原 Result。

### B5：重做本轮错题

1. 完成含 1—3 道零散错误的练习；
2. 点击重做本轮错题；
3. 核对只包含错误 base，顺序稳定且没有 reinforcement；
4. 核对创建新 Session ID；
5. 来源题失效时核对过滤或明确降级。

### B6：恢复、冲突与旧记录

1. 使用旧 V1 completion 打开结果页；
2. 核对受控重建且不丢失其他 Store 数据；
3. 双标签页中一页开始新 Session，另一页点击推荐；
4. 核对不覆盖 active Session，并提示继续或重新载入；
5. 模拟损坏 Result，核对页面不白屏。

### B7：入口、移动端与可访问性

1. 从 `/learning` 完成知识练习并进入结果页；
2. 核对返回动作只回 `/learning`，不出现第二学生首页；
3. 在 390px、768px 和 PC 宽度检查首屏、列表和按钮；
4. 使用键盘完成主要推荐；
5. 核对颜色之外有明确文字，控制台无未处理错误。

## 十八、故障、降级与停止条件

| 场景 | 处理 |
| --- | --- |
| Result 构建事实不完整 | 不保存半成品，保留 completed Attempt，显示结果暂不可用 |
| 题目展示快照缺失 | 保留可验证统计，隐藏无法验证的题干字段并记录 issue |
| 结构化错因缺失 | 回退具体错题，不推断原因 |
| 推荐目标库存不足 | 逐级降级到可执行动作 |
| 推荐点击时已有 active Session | 优先继续 active，不覆盖 |
| 推荐点击时库存刚变化 | 创建失败并留在结果页，展示重新选择入口 |
| 旧 V1 Result 无法重建 | 只隔离 lastCompletion，不清空其他记录 |
| 本地写入失败 | 当前页面保留一致内存结果，提示刷新后可能丢失 |
| 多标签页 revision 冲突 | 不合并、不覆盖，要求载入最新状态 |
| future Store | 只读，不迁移、不写回 |

出现以下任一情况必须停止 WP6 并回到决策层：

1. 需要把知识练习结果写入正式 Evidence/Profile；
2. 需要改变 `/learning` 正式主任务优先级；
3. 需要依赖未审核内容或大模型推断错因；
4. 需要用巩固正确结果改写基础首次正确率；
5. 需要删除旧 Store 或静默覆盖 active Session；
6. 无法在不修改 81 道正式题契约的情况下完成推荐。

## 十九、回滚策略

WP6 应保持可单独回滚：

- 新 Result builder 与页面组件可整体撤回；
- Completion Record V2 读取器必须保留对 V1 的兼容；
- 回滚后遇到 V2 不得清空 Store，应安全忽略新 Result 并保留 completedAttempt；
- 新 `mistake_review` 入口可关闭，不影响 category / mixed 和 WP5 巩固；
- 不删除 WP4 备份键和隔离记录；
- 不通过清空 localStorage 作为部署或回滚方案。

## 二十、WP6 Engineering PASS 门禁

必须同时满足：

1. D1—D12 已确认；
2. WP6-C01—C56 全部通过；
3. WP1—WP5 与 WP7A 全量回归通过；
4. 正式 Unified Learning 与 Runtime 回归通过；
5. Production Build PASS；
6. 浏览器 B1—B7 通过；
7. 390px、768px、PC 和键盘操作通过；
8. Result 刷新、V1 兼容和多标签页冲突通过；
9. 推荐动作真实创建合法 Session，失败时受控降级；
10. 结果页没有得分、长期掌握、能力提升或未审核错因；
11. 没有新增正式 Evidence/Profile/Resource 写入；
12. 输出 WP6 Engineering Acceptance Report；
13. 中央执行清单、产品控制表和 System Map 使用同一状态口径；
14. 状态只升级为 `ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING`，不提前进入 Product PASS。

WP6 Engineering PASS 后才进入 WP7B 全链产品验收。

## 二十一、关键决策确认

以下决策在 WP6 代码开发前必须由产品负责人整体确认：

| 编号 | 决策 | 建议确认值 | 工程约束 |
| --- | --- | --- | --- |
| D1 | 结果核心指标 | 基础题首次正确率，不展示得分 | 巩固题永不回写基础首次表现 |
| D2 | 结果事实载体 | 新建不可变 `PracticeResult`，页面只读 | JSX 不重新计算业务统计 |
| D3 | 有效用时 | 累加 Response 用时，单条最多计 10 分钟 | 不使用 Session 墙钟差，不修改原 Response |
| D4 | 知识点层级 | 仅使用证据较少 / 本轮表现较稳 / 本轮建议巩固 / 本轮优先巩固 | 单题错误不升级为薄弱或未掌握 |
| D5 | 错因来源 | 只聚合审核 misconception；缺失时回退具体错题 | 禁止相似度、大模型或页面推断 |
| D6 | 推荐数量 | 每个结果只突出一个主要推荐 | 其他动作降为次要入口 |
| D7 | 推荐优先级 | active Session → 集中错误专项 → 零散错误重做 → 全对后综合 → 返回入口 | 推荐必须确定且可解释 |
| D8 | 推荐依据 | 展示本轮知识点、题数和错误数 | 不使用长期能力语言 |
| D9 | 重做错题 | 补齐最小 `mistake_review`，只重做错误 base | 新 Session ID，最多 10 道，过滤失效题 |
| D10 | 旧结果兼容 | Store 根版本保持 v1，Completion Record 升 V2，V1 可确定性重建 | 失败只隔离 lastCompletion，不清空全库 |
| D11 | 唯一入口与证据边界 | 动作保持 `/learning/knowledge/**`，结果不写正式 Evidence/Profile | 不新增第二学生首页或正式写入 |
| D12 | 阶段门禁 | WP6 Engineering PASS 后进入 WP7B | Product Acceptance 仍需至少 5 次受控试用 |

建议确认语句：

> 确认 WP6 的 D1—D12，授权进入 WP6 工程代码开发；实现必须保持基础题与巩固题分账、只输出本轮有限结论、推荐真实可执行，在 WP6 Engineering PASS 前不进入 WP7B。

确认记录：2026-08-30，产品负责人确认 WP6 D1—D12并授权代码开发；同日完成领域契约、持久化兼容、结果页、错题重做、自动化和浏览器验收，状态升级为 `ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING`。WP7B 已解除工程依赖，但尚未开始。
