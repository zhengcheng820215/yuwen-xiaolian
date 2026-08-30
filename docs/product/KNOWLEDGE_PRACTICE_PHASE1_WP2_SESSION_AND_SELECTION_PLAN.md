# 知识练习第一阶段 WP2 练习会话与选题工程实施文档

状态：`ENGINEERING PASS`

版本：`knowledge_practice_phase1_wp2_session_selection_v1.0`

日期：`2026-08-28`

上位方案：[`KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md`](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md)

WP1验收：[`KNOWLEDGE_PRACTICE_PHASE1_WP1_MIGRATION_REPORT.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP1_MIGRATION_REPORT.md)

执行清单：[`KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md`](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md)

## 一、文档目的

本文是第一阶段 WP2 的工程实施依据，负责把现有“按分类加载全部题目、固定顺序作答”升级为稳定、可测试、可恢复扩展的练习会话和选题基础。

WP2 完成后，产品应具备：

```text
选择专项或综合练习
→ 从 WP1 approved Repository 获取候选题
→ 根据固定规则选择基础题
→ 使用 seed 生成稳定顺序
→ 创建不可覆盖的 active PracticeSession
→ Quiz 只消费 Session queue
→ 同一挂载 Session 重渲染时保持同一题目与顺序
```

WP2 只建立会话和选题领域模型。浏览器持久化与跨页面恢复属于 WP4，但 WP2 的 Session 必须从设计上支持后续序列化和恢复。

## 二、现状基线

### 2.1 WP1 已交付能力

- 学生可用题由 `KnowledgeQuestionRepository.listApproved()` 提供；
- 当前 approved 题共 12 道，全部属于七年级上册；
- 分类分布为字音字形 3、成语运用 1、标点符号 1、文学文化常识 2、古诗文默写与理解 2、文言实词虚词 3；
- 病句辨析与修改、作家作品与课文背景当前为 0；
- 当前没有 approved `variantGroupId`；
- draft 和非七上题已与学生侧隔离。

### 2.2 当前 Quiz 行为

当前 `Quiz.jsx`：

- 直接取得全部 approved 题；
- 专项练习使用该分类全部题目；
- 综合练习使用全部 12 道题；
- 题目顺序固定；
- 没有稳定 Session ID；
- 没有 seed；
- 没有基础题与未来巩固题角色；
- 页面本地 state 同时承担会话和交互职责；
- 重新进入会重新从 Repository 构造题目数组。

## 三、WP2目标与非目标

### 3.1 工作包目标

1. 定义可序列化的 PracticeSession v1；
2. 定义基础题队列项 PracticeQueueItem；
3. 建立稳定 Session ID 和 seed；
4. 建立可复现的伪随机洗牌；
5. 实现专项默认 5 题；
6. 实现综合默认 10 题；
7. 实现会话内 Question ID 去重；
8. 实现基础题 `variantGroupId` 排重；
9. 实现综合分类覆盖和单分类比例控制；
10. 实现难度目标与候选不足降级；
11. 实现最近两个已完成会话的题目降权；
12. 会话创建后冻结基础题集合和顺序；
13. Quiz 改为消费 Session queue，不再自行筛选题目；
14. 建立自动化测试和浏览器验收。

### 3.2 非目标

WP2 不做：

- 不保存 Session 到 localStorage；
- 不实现刷新后真正读取本地存储恢复；
- 不记录完整 PracticeResponse；
- 不重做选项级反馈界面；
- 不动态插入巩固题；
- 不实现错题复习模式的完整业务；
- 不生成结果页知识点诊断；
- 不上传会话或历史；
- 不用大模型选题；
- 不改变 WP1 Question 契约；
- 不绕过 approved Repository 读取 draft；
- 不为了凑满题数重复题目。

### 3.3 与WP4的边界

WP2负责：

- Session 的确定性创建；
- Session 的纯状态变化；
- 同一个已创建 Session 对象重复加载时不重新选题；
- Session 可安全序列化。

WP4负责：

- Session 写入浏览器存储；
- 页面刷新后读取同一 Session；
- active Session 检测、继续和放弃；
- Schema 迁移与损坏数据降级。

WP2浏览器验收允许通过页面内重新渲染或相同 seed 重建验证稳定性，不把 localStorage 恢复作为 PASS 门禁。

## 四、核心术语

| 术语 | 定义 |
| --- | --- |
| Candidate | 从 WP1 approved Repository 获取、尚未入选的题目 |
| Base Question | 创建 Session 时确定的原始练习题 |
| Queue Item | Session 中一个可执行题目位置 |
| Session Seed | 决定本 Session 洗牌、同权重排序和补位顺序的稳定字符串 |
| Recent History | 最近两个 completed Session 的基础题历史摘要 |
| Relaxation | 候选不足时，按固定顺序逐步放宽近期排斥、难度和分类比例要求 |
| Frozen Selection | Session 创建后，基础题 ID 和顺序不随 Repository 或页面重渲染变化 |

## 五、PracticeSession v1契约

### 5.1 枚举

```ts
export type PracticeMode =
  | 'category'
  | 'mixed'
  | 'mistake_review';

export type PracticeSessionStatus =
  | 'active'
  | 'completed'
  | 'abandoned';

export type PracticeQueueItemRole =
  | 'base'
  | 'reinforcement';

export type PracticeQueueItemStatus =
  | 'pending'
  | 'answered';
```

WP2正式开放 `category` 和 `mixed`。`mistake_review`、`reinforcement` 仅保留类型兼容位，不在WP2入口开放。

### 5.2 PracticeQueueItem

```ts
export type PracticeQueueItem = {
  id: string;
  questionId: string;
  questionContentVersion: number;
  role: PracticeQueueItemRole;
  sourceQuestionId?: string;
  status: PracticeQueueItemStatus;
};
```

规则：

- `id` 是队列项身份，不直接等于 Question ID；
- 基础题推荐使用 `{sessionId}:base:{sequence}`；
- WP2 所有 Queue Item 均为 `role = base`；
- `questionContentVersion` 在创建时冻结；
- 基础题不得有 `sourceQuestionId`；
- `status` 初始为 `pending`；
- WP3提交成功后才改为 `answered`。

### 5.3 PracticeSession

```ts
export type PracticeSession = {
  schemaVersion: 1;
  id: string;
  mode: PracticeMode;
  category?: KnowledgeQuestionCategory;
  seed: string;

  targetBaseQuestionCount: number;
  actualBaseQuestionCount: number;
  baseQuestionIds: string[];
  queue: PracticeQueueItem[];
  currentIndex: number;

  status: PracticeSessionStatus;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  abandonedAt?: string;

  selectionSummary: PracticeSelectionSummary;
};
```

### 5.4 PracticeSelectionSummary

```ts
export type PracticeSelectionSummary = {
  candidateCount: number;
  selectedCount: number;
  targetCount: number;
  categoryCounts: Record<string, number>;
  difficultyCounts: Record<'1' | '2' | '3', number>;
  recentQuestionCount: number;
  reusedRecentQuestionCount: number;
  relaxationCodes: PracticeSelectionRelaxationCode[];
};
```

该摘要用于测试、Debug和后续产品解释，不直接向学生展示内部 code。

### 5.5 不变量

Session在创建时必须满足：

1. `schemaVersion = 1`；
2. ID非空且唯一；
3. `baseQuestionIds.length = actualBaseQuestionCount`；
4. queue中的基础题顺序与 `baseQuestionIds` 完全一致；
5. Question ID不重复；
6. Queue Item ID不重复；
7. 所有问题均能从创建时的approved候选集合解析；
8. 所有基础题 `questionContentVersion` 与创建时一致；
9. `currentIndex = 0`；
10. `status = active`；
11. `startedAt = updatedAt`；
12. category模式必须有category；
13. mixed模式不得携带限制为单分类的category；
14. `completedAt / abandonedAt` 初始不存在。

## 六、会话身份与seed

### 6.1 Session ID

推荐格式：

```text
kp-session-{UTC紧凑时间}-{随机后缀}
```

例如：

```text
kp-session-20260828T140500000Z-a3f91c2d
```

生产环境优先使用 `crypto.randomUUID()` 构建随机后缀。测试必须允许注入 `idFactory`，不能依赖真实随机值。

### 6.2 Seed来源

默认seed由以下稳定输入生成：

```text
sessionId | mode | category-or-all
```

不得使用每次排序时重新调用 `Math.random()`。

### 6.3 Seed哈希

WP2使用确定性32位无符号哈希。推荐FNV-1a或等价的稳定自实现算法：

```ts
function hashSeed(value: string): number
```

要求：

- 浏览器和Node结果一致；
- 不依赖运行时对象哈希；
- 同输入始终同输出；
- 实现有固定测试向量；
- 不把加密安全作为目标。

### 6.4 伪随机数生成器

推荐Mulberry32或等价的小型确定性PRNG：

```ts
function createSeededRandom(seed: number): () => number
```

输出范围必须为 `[0, 1)`。

### 6.5 稳定洗牌

使用注入的seeded random执行Fisher–Yates：

```ts
function seededShuffle<T>(items: readonly T[], seed: string): T[]
```

规则：

- 不修改输入数组；
- 同seed同输入产生完全一致结果；
- 同输入不同seed不保证一定不同，但测试样本应能观察到合理差异；
- 候选在进入洗牌前使用稳定Question ID排序，避免Repository原始顺序改变影响结果。

## 七、选题输入与输出

### 7.1 输入

```ts
export type CompletedPracticeSessionSummary = {
  sessionId: string;
  completedAt: string;
  baseQuestionIds: string[];
};

export type SelectPracticeQuestionsInput = {
  mode: 'category' | 'mixed';
  category?: KnowledgeQuestionCategory;
  targetCount?: number;
  seed: string;
  candidates: KnowledgeQuestion[];
  recentCompletedSessions?: CompletedPracticeSessionSummary[];
};
```

### 7.2 输出

```ts
export type SelectPracticeQuestionsResult = {
  questions: KnowledgeQuestion[];
  summary: PracticeSelectionSummary;
};
```

### 7.3 输入清洗

选题器必须再次防御性确认：

- 只接受 `approved`；
- 只接受七年级上册；
- Question ID去重；
- 同ID多版本只接受Repository返回的唯一当前approved版本；
- category模式只保留目标分类；
- recent Session只取状态已完成的摘要调用方结果；
- 最近历史按 `completedAt` 降序排序，最多取2个。

Repository是第一道边界，选题器的防御检查不替代WP1数据校验。

## 八、专项选题规则

### 8.1 目标数量

- 默认5道；
- 调用方可以在测试或内部场景显式传入1—20；
- 学生正式入口固定传5；
- 非法数量返回领域错误，不静默修正。

### 8.2 筛选

```text
approved七上候选
→ 指定category
→ Question ID去重
→ 基础题variantGroupId排重
→ 近期权重排序
→ 难度配额选择
→ seed稳定洗牌
```

### 8.3 难度目标

目标5题时：

| 难度 | 目标数 |
| --- | ---: |
| 1 基础 | 2 |
| 2 中等 | 2 |
| 3 较难 | 1 |

非5题时按比例近似：

- 难度1：40%；
- 难度2：40%；
- 难度3：20%；
- 使用最大余数法补齐整数题量；
- 同余数时优先难度1、2、3，保证首批不因高难题不足而失控。

### 8.4 难度补位

某难度不足时：

1. 难度1缺口优先由难度2补；
2. 难度2缺口先由难度1，再由难度3补；
3. 难度3缺口优先由难度2，再由难度1补；
4. 每次补位仍遵守ID和variantGroup排重；
5. 记录 `difficulty_quota_relaxed`。

### 8.5 当前12题数据下的专项行为

| 分类 | 当前approved | 实际专项题数 |
| --- | ---: | ---: |
| 字音字形 | 3 | 3 |
| 成语运用 | 1 | 1 |
| 标点符号 | 1 | 1 |
| 文学文化常识 | 2 | 2 |
| 古诗文默写与理解 | 2 | 2 |
| 文言实词虚词 | 3 | 3 |
| 病句辨析与修改 | 0 | 不允许创建 |
| 作家作品与课文背景 | 0 | 不允许创建 |

专项题不足5道时，使用所有符合条件且不重复的题，并记录 `candidate_shortage`。入口展示实际数量，不显示“5题一组”。

## 九、综合选题规则

### 9.1 目标数量

- 默认10道；
- 正式入口固定传10；
- 当前有12道approved，因此应选出10道；
- 不得因为有12道就继续沿用全部题。

### 9.2 分类覆盖

候选充足时：

- 至少覆盖3个非空分类；
- 目标优先覆盖尽可能多的分类；
- 单分类最多占基础题集合40%；
- 10题时单分类最多4题；
- 当前每类最多3题，因此自然满足40%上限。

### 9.3 分类选择算法

使用两阶段确定性算法：

#### 阶段A：覆盖种子题

1. 按分类构建候选桶；
2. 删除空桶；
3. 使用seed派生的分类seed稳定洗牌分类；
4. 每个非空分类先选1题，直到达到目标题数或所有分类均覆盖；
5. 桶内题仍按近期权重、难度和seed排序。

#### 阶段B：填充剩余名额

1. 在未选题中按综合优先级排序；
2. 不突破40%分类上限；
3. 不重复variantGroup；
4. 优先接近整体难度目标；
5. 候选不足时进入固定Relaxation。

### 9.4 综合难度目标

目标10题时：

| 难度 | 目标数 |
| --- | ---: |
| 1 基础 | 4 |
| 2 中等 | 4 |
| 3 较难 | 2 |

当前12道题没有难度3 approved题，必须：

- 不伪造难度；
- 不阻止综合练习；
- 从难度2、1按补位顺序补足；
- 记录 `difficulty_quota_relaxed`。

## 十、近期降权规则

### 10.1 历史范围

只使用最近两个completed Session的基础题：

- 最近第1轮：`recentRank = 1`；
- 最近第2轮：`recentRank = 2`；
- 更早历史不参与WP2降权；
- active或abandoned Session不作为已完成历史。

### 10.2 优先级分层

候选分三层：

| 层级 | 条件 | 优先级 |
| --- | --- | --- |
| Fresh | 最近两轮均未出现 | 最高 |
| Previous-2 | 只在最近第2轮出现 | 中 |
| Previous-1 | 在最近第1轮出现 | 最低 |

若同时出现在最近两轮，按Previous-1处理。

### 10.3 降权不是永久排除

- Fresh候选充足时不选近期题；
- Fresh不足时先放宽Previous-2；
- 仍不足时再放宽Previous-1；
- 每次放宽记录Relaxation code；
- 当前只有12道、综合每次10道，连续综合练习必然重复；产品承诺是降低近期重复，不是绝不重复。

### 10.4 同层排序

同一近期层级内，使用以下顺序：

1. 当前难度缺口贡献；
2. 当前分类覆盖贡献；
3. seed派生稳定随机键；
4. Question ID作为最终确定性tie-breaker。

禁止依赖JS sort不稳定行为。

## 十一、variantGroupId排重

### 11.1 基础规则

- `variantGroupId`缺失的题互不冲突；
- 同一基础题集合中，一个非空variantGroup最多选择1道；
- 排重发生在近期放宽和难度补位之前；
- 候选不足时，只有在所有不同组候选均耗尽后才允许放宽；
- 放宽后同一组仍最多再增加1道，并记录 `variant_group_relaxed`。

### 11.2 当前数据

WP1没有批准任何variantGroup，因此当前运行不会触发组排重或组放宽。WP2必须仍实现并测试该规则，为WP5即时巩固做好基础。

### 11.3 与WP5的关系

基础题不同时出现同组题，目的是保留同组其他题作为后续巩固候选。WP5插入reinforcement时不受“基础题集合同组最多1道”限制，但必须排除Session已出现题目。

## 十二、Relaxation固定顺序

```ts
export type PracticeSelectionRelaxationCode =
  | 'candidate_shortage'
  | 'recent_second_session_reused'
  | 'recent_latest_session_reused'
  | 'difficulty_quota_relaxed'
  | 'category_coverage_relaxed'
  | 'category_cap_relaxed'
  | 'variant_group_relaxed';
```

固定顺序：

1. 使用Fresh且满足variant排重的候选；
2. 放宽难度配额；
3. 使用最近第2轮题；
4. 使用最近第1轮题；
5. 放宽分类覆盖目标；
6. 放宽40%分类上限；
7. 最后才放宽variantGroup；
8. 仍不足则返回实际数量并记录candidate_shortage。

不得调整为“先重复同组题，再返回较少题量”。真实独立题不足时，宁可题目少，也不使用明显重复题制造题量。

## 十三、Session创建服务

### 13.1 输入

```ts
export type BuildPracticeSessionInput = {
  mode: 'category' | 'mixed';
  category?: KnowledgeQuestionCategory;
  targetCount?: number;
  recentCompletedSessions?: CompletedPracticeSessionSummary[];
  now?: string;
  idFactory?: () => string;
};
```

调用方不传candidates。服务内部必须从KnowledgeQuestionRepository读取，避免页面注入draft。

### 13.2 输出

```ts
export type BuildPracticeSessionResult =
  | { ok: true; session: PracticeSession }
  | { ok: false; error: PracticeSessionBuildError };
```

### 13.3 错误

```ts
export type PracticeSessionBuildErrorCode =
  | 'invalid_mode'
  | 'category_required'
  | 'category_not_allowed_for_mixed'
  | 'target_count_invalid'
  | 'no_approved_questions'
  | 'no_questions_for_category'
  | 'session_identity_failed';
```

错误返回结构：

```ts
type PracticeSessionBuildError = {
  code: PracticeSessionBuildErrorCode;
  studentMessage: string;
  details?: Record<string, unknown>;
};
```

学生文案示例：

- `no_questions_for_category`：当前分类还没有可用题目，可以先选择其他练习；
- `no_approved_questions`：当前题库正在准备中，暂时无法开始练习。

不得把内部Repository或Schema错误直接展示给学生。

### 13.4 创建步骤

```text
校验输入
→ 生成Session ID
→ 生成seed
→ 从Repository读取approved候选
→ 调用选题纯函数
→ 选题为空则返回领域错误
→ 建立baseQuestionIds
→ 建立queue
→ 校验Session不变量
→ 返回active Session
```

## 十四、Session状态变化

### 14.1 WP2允许操作

```ts
export function advancePracticeSession(
  session: PracticeSession,
  now: string,
): PracticeSession;

export function markPracticeQueueItemAnswered(
  session: PracticeSession,
  queueItemId: string,
  now: string,
): PracticeSession;
```

### 14.2 推进规则

- 只有当前Queue Item为answered时才能推进；
- 非最后一题：`currentIndex + 1`；
- 最后一题推进后状态改为completed并写completedAt；
- completed或abandoned不能继续推进；
- 所有状态变化返回新对象，不原地修改输入；
- `updatedAt`使用显式传入时间；
- 同一重复命令不产生越界或二次完成。

WP3负责在有效Response创建后调用mark answered。WP2测试可以直接调用状态函数，不伪造完整Response。

## 十五、页面改造边界

### 15.1 KnowledgePractice

负责：

- 展示分类实际approved数量；
- 有题分类提供开始入口；
- 空分类不显示或显示受控准备中状态；
- 调用Session创建服务；
- 创建成功后导航到Session执行页。

不负责：

- 自己筛选5题；
- 自己打乱题目；
- 拼接Session ID；
- 修改Repository结果。

### 15.2 Quiz

负责：

- 接收或取得一个已创建Session；
- 根据 `queue[currentIndex]` 获取Question；
- 展示进度 `currentIndex + 1 / queue.length`；
- 提交后由后续领域逻辑更新Queue状态；
- 调用Session推进。

不负责：

- 根据URL分类重新筛题；
- 直接使用Repository全部题；
- 在render中随机；
- 因重渲染重新构造Session；
- 用Question数组长度推断目标题数。

### 15.3 路由过渡

WP2允许保持现有 `/quiz/:category` 路由以减少改动，但进入路由前或路由初始化时必须只创建一次Session。

推荐后续稳定路由：

```text
/quiz/session/:sessionId
```

由于WP4才建立持久化，WP2不强制切换到只含sessionId的可刷新路由。若提前切换，必须保证没有Repository查不到Session导致的白屏。

## 十六、建议代码结构

```text
src/domain/knowledge-practice/practice/
├── practiceSessionTypes.ts
├── practiceSeed.ts
├── selectPracticeQuestions.ts
├── buildPracticeSession.ts
├── practiceSessionState.ts
└── practiceSessionValidator.ts

src/ai/tests/
└── runKnowledgePracticeWP2Debug.ts
```

可选页面装配：

```text
src/context/PracticeSessionContext.jsx
```

如果使用Context：

- 只保存当前Session和明确命令；
- 不复制Question Repository；
- 不承担localStorage；
- 不与StudyContext的长期模拟进度混为一体；
- WP4可在不改页面调用方式的情况下替换存储实现。

## 十七、会话校验器

### 17.1返回结构

```ts
export type PracticeSessionValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type PracticeSessionValidationResult = {
  passed: boolean;
  issues: PracticeSessionValidationIssue[];
};
```

### 17.2错误码

| Code | 条件 |
| --- | --- |
| `session.schema_version_invalid` | schemaVersion不是1 |
| `session.id_invalid` | ID为空或格式非法 |
| `session.mode_invalid` | mode非法 |
| `session.category_required` | category模式缺分类 |
| `session.category_forbidden` | mixed模式携带category |
| `session.seed_required` | seed为空 |
| `session.target_count_invalid` | 目标题数非法 |
| `session.actual_count_mismatch` | 实际数与ID数组不一致 |
| `session.base_question_duplicate` | 基础题ID重复 |
| `session.queue_item_duplicate` | Queue Item ID重复 |
| `session.queue_question_mismatch` | queue与baseQuestionIds不一致 |
| `session.queue_role_invalid` | WP2 queue出现非base项 |
| `session.question_version_invalid` | 内容版本非法 |
| `session.current_index_invalid` | currentIndex越界 |
| `session.status_invalid` | status非法 |
| `session.timestamp_invalid` | 时间字段非法或终态时间缺失 |
| `session.completed_state_inconsistent` | completed状态与队列不一致 |
| `session.abandoned_state_inconsistent` | abandoned状态仍可推进 |

## 十八、自动化验收矩阵

### 18.1 Seed与洗牌

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP2-SD01 | 固定seed哈希向量 | 输出固定32位数 |
| WP2-SD02 | 同seed同数组 | 顺序完全一致 |
| WP2-SD03 | 洗牌后输入数组 | 原数组未被修改 |
| WP2-SD04 | 不同seed样本 | 至少一个顺序不同 |
| WP2-SD05 | Repository顺序变化 | ID预排序后结果仍一致 |

### 18.2 专项选题

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP2-C01 | 分类有8道候选 | 选择5道 |
| WP2-C02 | 分类只有3道 | 选择3道且candidate_shortage |
| WP2-C03 | 分类没有题 | 返回no_questions_for_category |
| WP2-C04 | 候选混入其他分类 | 全部排除 |
| WP2-C05 | 候选含draft | 排除 |
| WP2-C06 | 候选ID重复 | 结果ID唯一 |
| WP2-C07 | 同variantGroup多题 | 基础集合最多1道 |
| WP2-C08 | 5题难度充足 | 2/2/1 |
| WP2-C09 | 无难度3 | 用相邻难度补位并记录放宽 |
| WP2-C10 | targetCount为0或21 | 返回target_count_invalid |

### 18.3 综合选题

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP2-M01 | 当前12道approved | 选择10道 |
| WP2-M02 | 至少6个非空分类 | 尽可能覆盖6类 |
| WP2-M03 | 候选充足 | 至少覆盖3类 |
| WP2-M04 | 单分类候选很多 | 不超过40% |
| WP2-M05 | 只有2个非空分类 | 返回可用题并category_coverage_relaxed |
| WP2-M06 | 总候选少于10 | 全部使用且不重复 |
| WP2-M07 | 同variantGroup跨分类 | 基础集合仍最多1道 |
| WP2-M08 | 无难度3 | 不阻断，记录difficulty_quota_relaxed |

### 18.4 近期降权

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP2-R01 | Fresh足够 | 不选最近两轮题 |
| WP2-R02 | Fresh不足 | 先复用最近第2轮 |
| WP2-R03 | 仍不足 | 再复用最近第1轮 |
| WP2-R04 | 同题出现于两轮 | 按最近第1轮处理 |
| WP2-R05 | 历史超过2轮 | 更早轮次不参与降权 |
| WP2-R06 | active或abandoned摘要 | 调用边界不作为completed历史 |
| WP2-R07 | 当前12题连续综合 | 允许必要重复并准确记录复用数 |

### 18.5 Session创建

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP2-B01 | category输入合法 | 创建active Session |
| WP2-B02 | mixed输入合法 | 创建active Session |
| WP2-B03 | category缺分类 | category_required |
| WP2-B04 | mixed携带分类 | category_not_allowed_for_mixed |
| WP2-B05 | Repository无approved | no_approved_questions |
| WP2-B06 | 注入固定ID和时间 | Session完全可复现 |
| WP2-B07 | Session创建完成 | base IDs与queue严格对齐 |
| WP2-B08 | Question内容版本 | queue正确冻结版本 |
| WP2-B09 | selectionSummary | 分类、难度、近期和放宽计数准确 |

### 18.6 状态与校验

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP2-ST01 | 当前题未answered就推进 | 阻止推进 |
| WP2-ST02 | 标记当前题answered | 返回新Session且输入不变 |
| WP2-ST03 | 推进非末题 | currentIndex加1 |
| WP2-ST04 | 推进末题 | completed并写completedAt |
| WP2-ST05 | completed再次推进 | 幂等或明确阻止，不越界 |
| WP2-ST06 | baseQuestionIds重复 | 校验失败 |
| WP2-ST07 | queue与base IDs错位 | 校验失败 |
| WP2-ST08 | currentIndex越界 | 校验失败 |
| WP2-ST09 | JSON序列化再解析 | 数据等价且校验通过 |

## 十九、浏览器人工验收

### 19.1专项练习

1. 进入知识练习；
2. 选择字音字形；
3. 当前仅3道approved，确认显示并创建3题Session；
4. 进度显示1/3；
5. 完成3题后结束，不重复题凑到5道；
6. 选择成语运用，确认创建1题Session；
7. 空分类不能创建Session。

### 19.2综合练习

1. 点击综合练习；
2. 确认目标10题，实际10题；
3. 核对题目ID无重复；
4. 核对覆盖当前多个非空分类；
5. 核对不再一次加载全部12题；
6. 新建另一轮综合练习，确认seed变化可带来合理轮换。

### 19.3会话稳定性

1. 创建一轮综合Session；
2. 触发页面普通重渲染；
3. 核对题目集合与顺序不变；
4. 使用同seed在Debug入口重建；
5. 核对顺序完全一致；
6. 页面没有在每次render调用随机选题。

### 19.4兼容回归

- 单选、判断、填空仍可作答；
- 错题收集没有因Session queue断开；
- 结果页仍能完成旧统计流程；
- 返回入口再开新练习创建新Session；
- 正式 `/learning` 不受影响；
- 浏览器控制台无新增error。

## 二十、实施步骤

### WP2-M0：基线与Fixture

1. 冻结WP1 approved集合测试Fixture；
2. 建立额外虚拟候选，覆盖5题以上、难度3和variantGroup场景；
3. 记录当前12题综合预期。

### WP2-M1：类型、seed和校验

1. 建立Session类型；
2. 实现hash、PRNG和稳定洗牌；
3. 实现Session校验器；
4. 完成基础测试向量。

### WP2-M2：选题纯函数

1. 实现输入清洗；
2. 实现专项规则；
3. 实现综合分类覆盖；
4. 实现难度配额与补位；
5. 实现近期降权；
6. 实现variantGroup排重；
7. 生成SelectionSummary。

### WP2-M3：Session创建与状态

1. 从Repository读取候选；
2. 创建Session ID和seed；
3. 构建queue；
4. 校验不变量；
5. 实现mark answered和advance纯状态函数。

### WP2-M4：页面接入

1. KnowledgePractice调用Session创建；
2. 建立最小当前Session装配；
3. Quiz从queue取题；
4. 移除Quiz内部分类筛选与全量题数组；
5. 保持现有作答和结果兼容。

### WP2-M5：验收与收口

1. 运行WP2自动化；
2. 运行WP1回归；
3. 运行生产构建；
4. 完成浏览器人工验收；
5. 输出WP2 Engineering Acceptance Report；
6. 更新执行清单。

## 二十一、建议命令

新增：

```json
{
  "scripts": {
    "debug:knowledge-practice-wp2": "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runKnowledgePracticeWP2Debug.ts"
  }
}
```

收口执行：

```text
npm run debug:knowledge-practice-wp1
npm run validate:knowledge-questions
npm run debug:knowledge-practice-wp2
npm run build
```

运行环境没有全局npm时，可使用工作区自带Node执行等价脚本，但验收报告必须记录真实命令。

## 二十二、WP2完成门禁

### 22.1领域逻辑

- [x] Session v1契约和校验器完成；
- [x] seed哈希、PRNG、稳定洗牌完成；
- [x] 专项默认5题完成；
- [x] 综合默认10题完成；
- [x] ID、variantGroup去重完成；
- [x] 分类覆盖和40%上限完成；
- [x] 难度配额和补位完成；
- [x] 最近两轮降权完成；
- [x] Relaxation顺序固定并可观察；
- [x] Session状态函数不可变且可序列化。

### 22.2页面

- [x] KnowledgePractice不自行选题；
- [x] Quiz只消费Session queue；
- [x] 页面render不调用随机选题；
- [x] 当前12题下专项返回实际题量；
- [x] 当前12题下综合恰好10题；
- [x] 题目不足不重复凑数；
- [x] 新Session使用新ID和seed；
- [x] 同一Session题目和顺序稳定。

### 22.3验证

- [x] WP2自动化测试全部通过；
- [x] WP1 47/47回归通过；
- [x] 数据门禁0 error；
- [x] 生产构建通过；
- [x] 浏览器专项、综合、稳定性和兼容回归通过；
- [x] 正式 `/learning` 烟测无新增控制台错误；
- [x] 输出WP2工程验收报告；
- [x] 执行清单更新为WP2 ENGINEERING PASS。

工程验收证据：[`KNOWLEDGE_PRACTICE_PHASE1_WP2_ENGINEERING_ACCEPTANCE_REPORT.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP2_ENGINEERING_ACCEPTANCE_REPORT.md)

## 二十三、风险与预案

| 风险 | 影响 | 预案 |
| --- | --- | --- |
| 当前题量只有12 | 连续综合不可避免重复 | 明确近期降权而非绝不重复；同步推进88题内容建设 |
| 当前没有难度3 | 10题难度目标无法满足 | 固定补位并记录difficulty_quota_relaxed，不伪造难度 |
| 当前没有variantGroup | 真实组排重无法用生产数据展示 | 使用测试Fixture验证；等待内容审核后再进入真实组 |
| WP2提前承担持久化 | 状态边界混乱 | 只保证可序列化，存储延后到WP4 |
| 页面重复创建Session | 重渲染导致题目变化 | Session创建放在显式命令或惰性初始化，不放render正文 |
| 近期降权算法过度复杂 | 难测试、难解释 | 使用三层优先级和固定Relaxation，不引入动态评分模型 |
| 分类配额与难度配额冲突 | 选题结果不稳定 | 先覆盖分类，再按难度填充；冲突进入固定Relaxation |

## 二十四、WP2之后的交接

WP2向WP3交付：

- 稳定PracticeSession；
- 当前Queue Item身份；
- Question ID与内容版本；
- mark answered和advance命令边界。

WP3负责：

- 创建幂等PracticeResponse；
- 判题；
- 选项级反馈；
- 有效提交后标记Queue Item answered；
- 不改变WP2基础题集合和顺序。

WP4后续负责将同一Session安全保存和恢复，不重新运行选题器覆盖已有Session。
