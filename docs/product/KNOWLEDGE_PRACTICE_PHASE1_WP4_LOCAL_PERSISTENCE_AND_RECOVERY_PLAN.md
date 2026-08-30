# 知识练习第一阶段 WP4 本地持久化与恢复工程实施文档

状态：`ENGINEERING PLAN READY / IMPLEMENTATION PENDING / KEY DECISIONS PENDING CONFIRMATION`

版本：`knowledge_practice_phase1_wp4_local_persistence_recovery_v1.0`

日期：`2026-08-29`

上位方案：[`KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md`](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md)

WP3验收：[`KNOWLEDGE_PRACTICE_PHASE1_WP3_ENGINEERING_ACCEPTANCE_REPORT.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP3_ENGINEERING_ACCEPTANCE_REPORT.md)

执行清单：[`KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md`](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md)

## 一、文档目的

本文定义第一阶段 WP4 的本地存储边界、持久化根对象、Repository接口、保存时机、启动恢复、active冲突、版本迁移、损坏隔离、写入失败降级、页面交互、自动化测试和浏览器验收标准。

WP4完成后，知识练习应从：

```text
Session与Response只在React内存
→ 刷新或关闭页面后全部丢失
→ 重新进入时创建一轮新题
```

升级为：

```text
每次有效状态变化
→ LocalPracticeRepository校验并保存完整PracticeAttempt
→ 刷新或关闭页面
→ 读取、迁移、校验持久化数据
→ 恢复同一Session、题目顺序、Response、反馈与当前索引
→ 学生显式继续或放弃
```

恢复不能重新运行WP2选题器，不能重新调用WP3判题器，也不能使用当前题库重新解释历史Response。

## 二、前置条件与当前基线

### 2.1 WP1—WP3已交付

- WP1：稳定Question ID、Option ID、内容版本与approved Repository；
- WP2：PracticeSession v1、Queue、稳定顺序、Session状态函数；
- WP3：PracticeAttempt v1、幂等Response、结构化Feedback、实际作答时长；
- Attempt通过JSON序列化再解析后可由`validatePracticeAttempt`校验；
- Response与Queue answered保持原子一致；
- 当前浏览器主链、WP1—WP3自动化和生产构建均已通过。

### 2.2 当前缺口

1. `PracticeSessionContext`仍使用React内存状态；
2. 刷新后Provider重新初始化为空；
3. Quiz直达路由会重新创建Session；
4. KnowledgePractice不知道是否存在未完成练习；
5. `completedSessions`只在内存中，近期降权刷新后失效；
6. 错题仍由StudyContext内存保存；
7. 结果页依赖StudyContext的`lastResult`，刷新后归零；
8. localStorage不可用、JSON损坏、版本未知和写入配额失败没有学生可见降级；
9. 多标签页可能互相覆盖active Attempt；
10. 页面尚未明确说明“仅保存在本机、本浏览器”。

## 三、WP4范围

### 3.1 本工作包必须完成

- 建立`LocalPracticeRepository`唯一存储边界；
- 建立带schema、revision和更新时间的持久化根对象；
- 保存active Attempt、最近完成Session、最后完成记录和错题记录；
- 会话创建、答案提交、推进、完成和放弃后立即保存；
- Provider初始化时完成hydrate后再允许创建或恢复；
- 在知识练习入口展示“继续上次练习”；
- 禁止新Session静默覆盖active Session；
- 提供显式的两步“放弃并新建”；
- 恢复已答题的答案、锁定状态和反馈；
- 结果页刷新后读取同一完成记录；
- 实现已知旧版本迁移；
- 实现主记录损坏、备份恢复和隔离元数据；
- 实现localStorage不可用、写入失败和并发冲突的非白屏降级；
- 在页面明确说明本地保存边界；
- 为WP5巩固题插入预留通用Attempt保存能力。

### 3.2 本工作包明确不做

- 不接入账号、服务端、云同步或跨设备恢复；
- 不将知识练习数据写入正式`/learning` Evidence链；
- 不创建巩固题或修改Queue插题规则；
- 不重做WP3判题、Response或Feedback；
- 不生成WP6完整知识点与错因结果摘要；
- 不承诺无痕模式、禁用存储或用户清理浏览器数据后仍可恢复；
- 不实现跨浏览器迁移；
- 不把81道正式阅读题写入知识练习本地Store；
- 不在页面或Context中直接调用`localStorage`。

## 四、持久化原则

### 4.1 单一边界

只有`LocalPracticeRepository`实现可以访问Storage API。页面、组件、Context、领域函数和结果页不得直接调用：

```text
localStorage.getItem
localStorage.setItem
localStorage.removeItem
```

### 4.2 保存完整事实，不重新计算历史

保存：

- 完整PracticeAttempt；
- 已生成Response；
- 已生成Feedback；
- Queue状态和当前索引；
- 题目内容版本；
- Session seed、基础题ID和顺序；
- 完成时的兼容结果摘要。

恢复时禁止：

- 重新选题或洗牌；
- 使用当前Question正确答案重判旧Response；
- 重新生成Feedback覆盖旧反馈；
- 使用当前题库版本修改历史Queue；
- 把completed或abandoned改回active。

### 4.3 内存继续优先于写入成功

一次localStorage写入失败时：

- 当前内存作答继续；
- 页面显示“本次进度暂未保存，请不要关闭页面”；
- 下一次状态变化继续尝试保存；
- 不向学生显示“已保存”；
- 不清空当前Attempt；
- 不因为持久化失败重复提交Response。

## 五、物理存储布局

### 5.1 固定键

```ts
export const LOCAL_PRACTICE_STORAGE_KEYS = {
  primary: 'yuwen_knowledge_practice_store_v1',
  backup: 'yuwen_knowledge_practice_store_backup_v1',
  quarantine: 'yuwen_knowledge_practice_quarantine_v1',
} as const;
```

禁止按页面、分类或Session动态创建任意键。后续schema升级使用新的根`schemaVersion`和显式迁移，不通过散落新键绕过迁移。

### 5.2 主记录与备份

写入顺序：

```text
读取并校验当前primary
→ 当前primary有效时复制到backup
→ 写入新的primary
→ 回读并校验revision与内容
→ 返回saved
```

localStorage单个`setItem`写入字符串是同步替换，但多个键不是事务。backup仅用于主记录损坏后的最近有效恢复，不作为第二份active事实。

### 5.3 隔离元数据

Quarantine只保存：

```ts
type PracticeQuarantineRecord = {
  detectedAt: string;
  source: 'primary' | 'backup';
  reasonCode: PracticeStoreIssueCode;
  rawLength: number;
  schemaVersion?: number;
};
```

不保存损坏原文、学生答案、题干、浏览器信息或堆栈，避免把不可用数据重复扩散。

最多保留最近5条隔离元数据。

## 六、持久化根对象

### 6.1 LocalPracticeStore v1

```ts
export type LocalPracticeStoreV1 = {
  schemaVersion: 1;
  revision: number;
  activeAttempt: PracticeAttempt | null;
  completedSessions: CompletedPracticeSessionSummary[];
  lastCompletion: PracticeCompletionRecord | null;
  mistakes: PersistedKnowledgeMistake[];
  lastAbandonedSessionId?: string;
  updatedAt: string;
  writerId: string;
};
```

### 6.2 初始值

```ts
{
  schemaVersion: 1,
  revision: 0,
  activeAttempt: null,
  completedSessions: [],
  lastCompletion: null,
  mistakes: [],
  updatedAt: now,
  writerId,
}
```

### 6.3 revision

- 每次成功写入`revision + 1`；
- Repository写入接收`expectedRevision`；
- 写入前重新读取primary；
- 当前revision与expectedRevision不同则返回`conflict`；
- 冲突时不得静默覆盖；
- Provider提示“练习已在另一个页面更新，请重新载入最新进度”。

revision是轻量乐观并发控制，不宣称localStorage具备完整数据库事务。

### 6.4 writerId

- 每个页面Provider初始化时生成一次随机writerId；
- 仅用于识别本标签写入与storage事件来源；
- 不包含学生身份、设备指纹或账户信息；
- 不持久化为长期跨页面身份。

## 七、完成记录

### 7.1 PracticeCompletionRecord

```ts
export type PracticeCompletionRecord = {
  schemaVersion: 1;
  sessionId: string;
  completedAttempt: PracticeAttempt;
  summary: PracticeCompletionSummary;
  completedAt: string;
};

export type PracticeCompletionSummary = {
  schemaVersion: 1;
  sessionId: string;
  mode: PracticeSession['mode'];
  category?: string;
  baseQuestionCount: number;
  firstAttemptCorrectCount: number;
  firstAttemptAccuracy: number;
  durationMs: number;
  mistakeCount: number;
  completedAt: string;
};
```

### 7.2 与WP6的边界

该summary只用于WP4结果页刷新兼容，不等同于WP6最终`PracticeResult`。

WP6必须从不可变`completedAttempt`生成：

- 基础题与巩固题分离统计；
- 知识点摘要；
- 错因摘要；
- 下一步推荐；
- 正式结果展示。

WP4不得提前编造WP5尚不存在的巩固结果，也不得继续使用`correct * 10`。

### 7.3 完成事务

完成最后一题时一次Repository命令必须：

```text
校验completed Attempt
→ 生成CompletionRecord
→ activeAttempt = null
→ lastCompletion = record
→ completedSessions头部加入当前Session摘要
→ completedSessions按sessionId去重并保留最近10条
→ revision + 1
→ 保存根对象
```

如写入失败，内存中的completed Attempt和结果仍可展示，并提示未保存。

## 八、错题持久化

### 8.1 PersistedKnowledgeMistake

```ts
export type PersistedKnowledgeMistake = {
  schemaVersion: 1;
  questionId: string;
  questionContentVersion: number;
  category: KnowledgeQuestionCategory;
  knowledgePoint: string;
  stemSnapshot: string;
  wrongAnswer: string;
  correctAnswerText: string;
  explanationSnapshot: string;
  responseId: string;
  status: 'active' | 'resolved';
  firstWrongAt: string;
  lastWrongAt: string;
};
```

### 8.2 更新规则

- 只在WP3`outcome=created && isCorrect=false`时写入；
- 以Question ID作为当前错题唯一键；
- 同题再次答错更新`lastWrongAt`、wrongAnswer和内容快照，不重复新增；
- 标记已处理仅修改`status=resolved`；
- 新的错误Response可重新激活resolved错题；
- 不因题库当前版本变化重写历史wrongAnswer或解释快照；
- 最多保留200条，优先删除最早resolved记录；active记录不得静默淘汰。

### 8.3 与WP5的边界

WP4只保存错题事实。WP5负责基于Response、variantGroup和Queue调度巩固，不得仅凭Mistake记录重新判题。

## 九、Store校验器

### 9.1 校验结果

```ts
export type LocalPracticeStoreValidationResult = {
  passed: boolean;
  issues: Array<{
    severity: 'error' | 'warning';
    code: PracticeStoreIssueCode;
    path: string;
    message: string;
  }>;
};
```

### 9.2 必须校验

1. 根schemaVersion为1；
2. revision为非负整数；
3. updatedAt合法；
4. activeAttempt为空或通过Attempt校验；
5. activeAttempt的Session必须为active；
6. completedSessions合法、按sessionId唯一、最多10条；
7. lastCompletion的Session必须completed；
8. Completion summary与completedAttempt的Response统计一致；
9. active Session ID不得与lastCompletion相同；
10. mistakes结构合法、Question ID唯一、最多200条；
11. Response ID和Mistake responseId引用边界合法；
12. writerId非空但不要求跨页面稳定；
13. 不允许未知顶层字段携带任意大对象；
14. 序列化大小不超过512KB软门禁。

### 9.3 Question版本变化

Attempt恢复主要依赖WP3已经保存的Response和Feedback，但当前待答题仍需Repository解析Question。

规则：

- 待答Queue Item的当前Repository版本与冻结版本一致：允许继续；
- 已答Queue Item：继续显示保存的Response和Feedback，不重新判题；
- 待答题当前版本不一致或Question不存在：Attempt标记`unrecoverable_question_version`，不得跳题或换题；
- 页面说明“本组未答题内容已经更新，已有答案已保留，请放弃后重新开始”；
- WP4不私自生成Question内容快照；如要实现跨内容版本继续，需要后续单独扩展Session Snapshot契约。

## 十、Repository接口

### 10.1 StorageLike

```ts
export interface PracticeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

测试使用内存Storage，不依赖浏览器全局对象。

### 10.2 Repository

```ts
export interface LocalPracticeRepository {
  load(now: string): PracticeStoreLoadResult;
  saveActiveAttempt(input: SaveActiveAttemptInput): PracticeStoreWriteResult;
  completeAttempt(input: CompleteAttemptInput): PracticeStoreWriteResult;
  abandonAttempt(input: AbandonAttemptInput): PracticeStoreWriteResult;
  upsertMistake(input: UpsertMistakeInput): PracticeStoreWriteResult;
  resolveMistake(input: ResolveMistakeInput): PracticeStoreWriteResult;
  clearActiveAttempt(input: ClearActiveAttemptInput): PracticeStoreWriteResult;
}
```

页面不直接调用Repository，统一由Provider命令装配。

### 10.3 Load结果

```ts
export type PracticeStoreLoadResult =
  | { status: 'empty'; store: LocalPracticeStoreV1 }
  | { status: 'loaded'; store: LocalPracticeStoreV1 }
  | { status: 'migrated'; store: LocalPracticeStoreV1; fromVersion: number }
  | { status: 'recovered_from_backup'; store: LocalPracticeStoreV1; issues: PracticeStoreIssue[] }
  | { status: 'damaged'; store: LocalPracticeStoreV1; issues: PracticeStoreIssue[] }
  | { status: 'unavailable'; store: LocalPracticeStoreV1; issues: PracticeStoreIssue[] };
```

### 10.4 Write结果

```ts
export type PracticeStoreWriteResult =
  | { status: 'saved' | 'reused'; store: LocalPracticeStoreV1 }
  | { status: 'conflict'; latest: LocalPracticeStoreV1; issues: PracticeStoreIssue[] }
  | { status: 'unavailable' | 'failed'; store: LocalPracticeStoreV1; issues: PracticeStoreIssue[] };
```

Repository捕获Storage异常并返回结构化结果，不向React抛出QuotaExceededError或SecurityError。

## 十一、读取、迁移与损坏隔离

### 11.1 启动读取顺序

```text
读取primary
→ 无记录：返回empty
→ JSON解析
→ 识别schemaVersion
→ 当前版本：结构校验
→ 已知旧版本：迁移后再校验
→ primary不可用：尝试backup
→ backup有效：恢复并写回primary
→ primary与backup均不可用：记录quarantine元数据并返回空Store
```

### 11.2 Legacy v0迁移

WP4没有已上线的正式旧Store，但测试需要冻结一个明确v0 fixture，防止未来迁移逻辑只写空壳。

```ts
export type LocalPracticeStoreV0 = {
  activeAttempt?: PracticeAttempt;
  completedSessions?: CompletedPracticeSessionSummary[];
  lastResult?: {
    sessionId: string;
    correct: number;
    total: number;
    accuracy: number;
    duration: string;
    mistakeCount: number;
    category: string;
  };
  mistakes?: PersistedKnowledgeMistake[];
};
```

迁移规则：

- 缺失schemaVersion视为v0；
- activeAttempt通过WP3校验才迁移；
- completedSessions去重、排序并截断到10条；
- 旧`lastResult`没有completedAttempt时不得伪造CompletionRecord，只作为迁移warning丢弃；
- 合法mistakes迁移，无效单条隔离，不阻断其他字段；
- 生成revision=1、当前updatedAt与writerId；
- 迁移后立即保存v1并保留原有效记录为backup。

### 11.3 未知版本

- schemaVersion大于当前版本：不尝试猜测读取；
- 返回`unsupported_future_version`；
- 不删除原primary；
- 页面进入内存只读降级，提示当前版本无法恢复；
- 不自动用空v1覆盖未来版本数据。

### 11.4 局部损坏

可独立隔离：

- 单条completedSessions摘要；
- 单条mistake；
- quarantine历史。

不可局部猜测：

- activeAttempt内部Response/Queue不一致；
- completedAttempt与summary统计冲突；
- 根revision或schema非法。

activeAttempt不一致时整条Attempt不可恢复，不通过删除某条Response来“修好”历史。

## 十二、保存时机

### 12.1 必须立即保存

| 状态变化 | Repository动作 |
| --- | --- |
| 新Session创建 | `saveActiveAttempt` |
| 有效Response创建 | `saveActiveAttempt` |
| 当前题推进 | `saveActiveAttempt` |
| WP5未来插入巩固题 | `saveActiveAttempt` |
| 最后一题完成 | `completeAttempt` |
| 会话放弃 | `abandonAttempt` |
| 错题新增或更新 | `upsertMistake` |
| 错题标记已处理 | `resolveMistake` |

### 12.2 不需要保存

- 提交前的选择题临时选择；
- 未提交的填空草稿；
- 页面滚动位置；
- 反馈卡展开状态；
- hover、focus和动画状态；
- 重复提交返回`already_submitted`且Store完全一致。

### 12.3 保存顺序

答案提交：

```text
WP3领域函数生成nextAttempt
→ Provider内存立即commit
→ Repository保存nextAttempt
→ 错误Response再执行同一根Store的mistake更新
```

推荐将Attempt与Mistake合并为一次根对象命令，避免错误Response已保存而Mistake未保存。Repository提供高层`commitAnswerOutcome`可作为实现优化，但不得在Repository重新判题。

## 十三、Provider初始化与状态机

### 13.1 Hydration状态

```ts
export type PracticeHydrationStatus =
  | 'loading'
  | 'ready'
  | 'restored'
  | 'migrated'
  | 'recovered_from_backup'
  | 'damaged'
  | 'unavailable';
```

### 13.2 启动规则

- Provider首次挂载只hydrate一次；
- hydrate完成前KnowledgePractice和Quiz不得创建Session；
- 读取到active Attempt时同时更新state与同步ref；
- 读取到completed或abandoned Attempt时不得作为active恢复；
- completedSessions、lastCompletion和mistakes一起恢复；
- 读取失败返回可用空状态，不白屏。

### 13.3 计时恢复

当前题为pending时：

- 恢复时间写入新的`currentQuestionPresentedAt`；
- 立即保存该更新；
- 不把页面关闭期间计入作答时长。

当前题为answered且反馈可见时：

- 保持原Response duration；
- 不重新计时；
- 保持反馈可见和输入锁定。

页面从hidden重新visible且当前题pending时，重置presentedAt并保存，避免长时间后台停留进入有效时长。

## 十四、active Session冲突

### 14.1 禁止静默覆盖

当Store存在active Attempt时：

- KnowledgePractice不直接创建新Session；
- 分类和综合按钮仍可见，但点击后进入冲突确认状态；
- 默认推荐“继续上次练习”；
- 新建必须先显式放弃旧Attempt；
- 不允许仅因URL分类不同就覆盖active Attempt。

### 14.2 继续入口

入口卡展示：

- 练习类型或分类；
- 进度，例如“已完成2/5题”；
- 当前是否处于反馈状态；
- 最后更新时间；
- “继续上次练习”主按钮；
- “放弃并新建”次按钮；
- “仅保存在本机、本浏览器”的说明。

继续路由从Session本身确定：

```text
mixed → /quiz/all
category → /quiz/{encoded category}
mistake_review → 后续WP5路由
```

### 14.3 两步放弃

第一步点击“放弃并新建”只展示确认区：

```text
放弃后不能继续本组练习，已经提交的答案仍保留在本机记录中。
```

第二步必须有：

- “继续原练习”；
- “确认放弃并开始新练习”。

确认后：

```text
Attempt状态改为abandoned
→ Repository保存lastAbandonedSessionId并清空activeAttempt
→ 创建新Session ID和Attempt
→ 保存新activeAttempt
→ 导航
```

若放弃保存失败，不创建新Session，避免出现两个无法判断优先级的active事实。

### 14.4 多标签页冲突

- Provider监听`storage`事件；
- 其他writer写入更高revision时显示冲突提示；
- 当前标签停止继续写入，直至用户点击“载入最新进度”；
- 不自动合并两个标签中的Response；
- 不按时间戳猜测哪个答案更正确；
- 如果两个标签几乎同时写入，Repository写前revision校验作为第二道保护。

## 十五、页面改造

### 15.1 KnowledgePractice

新增：

- hydration loading状态；
- active Attempt继续卡；
- 本地保存边界说明；
- 放弃确认区；
- damaged、unavailable、write failed和conflict提示；
- 新Session冲突保护。

页面不读取Storage，也不自行解析Attempt。

### 15.2 Quiz

新增：

- hydrate完成前等待；
- 恢复pending题；
- 恢复answered反馈态；
- 写入失败非阻断提示；
- 多标签冲突时停止提交与推进；
- 待答题版本失效时受控终止入口；
- “进度仅保存在本机、本浏览器”简短说明。

Quiz不得因为恢复失败自动创建同一路由新Session。

### 15.3 Result

- 优先读取`lastCompletion.summary`；
- Session ID与路由/内存完成Attempt一致时展示；
- 刷新后仍展示相同数字；
- 没有完成记录时显示受控空状态并返回练习入口；
- WP6前保留兼容版结果表达；
- 不在每次渲染时从当前Question Repository重判。

### 15.4 Mistakes

- 从Store的PersistedKnowledgeMistake恢复；
- 新错题、重复错题和标记已处理立即保存；
- 写入失败时保持内存变化并提示未保存；
- 使用快照展示历史错题，不因当前题库变化白屏。

## 十六、学生文案

### 16.1 本地边界

```text
练习进度仅保存在当前设备的当前浏览器中。清理浏览器数据后将无法恢复。
```

### 16.2 保存失败

```text
本次进度暂未保存，请不要关闭页面。你仍可以继续完成当前练习。
```

### 16.3 损坏恢复

```text
上次练习记录无法完整恢复，你可以开始一组新练习。
```

### 16.4 备份恢复

```text
已恢复最近一次可用的练习进度，请确认当前题目后继续。
```

### 16.5 多标签冲突

```text
这组练习已在另一个页面更新。请载入最新进度后继续。
```

### 16.6 存储不可用

```text
当前浏览器无法保存练习进度。你可以继续练习，但刷新或关闭页面后进度可能丢失。
```

禁止文案：

- “已同步到云端”；
- “永不丢失”；
- “所有设备都能继续”；
- 写入失败时仍显示“已自动保存”；
- 直接展示QuotaExceededError、SecurityError或JSON解析异常。

## 十七、自动化验收矩阵

### 17.1 Store与Repository

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP4-S01 | 空Storage load | 返回empty v1 Store |
| WP4-S02 | 保存active Attempt | primary包含完整Attempt |
| WP4-S03 | 保存前存在有效primary | 旧值进入backup |
| WP4-S04 | 保存后回读 | revision与内容一致 |
| WP4-S05 | 相同对象重复保存 | reused且不增加revision |
| WP4-S06 | expectedRevision过期 | conflict且不覆盖 |
| WP4-S07 | Storage不可用 | unavailable，不抛异常 |
| WP4-S08 | setItem抛Quota错误 | failed，内存Store保留 |
| WP4-S09 | JSON序列化失败 | failed，不破坏旧primary |
| WP4-S10 | 超过软大小门禁 | 受控失败 |

### 17.2 恢复与迁移

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP4-L01 | 合法v1 primary | loaded |
| WP4-L02 | primary损坏、backup合法 | recovered_from_backup |
| WP4-L03 | primary和backup均损坏 | damaged空Store、不白屏 |
| WP4-L04 | 损坏记录 | 写入最小quarantine元数据 |
| WP4-L05 | 合法v0 activeAttempt | migrated到v1 |
| WP4-L06 | v0旧lastResult无Attempt | 丢弃并warning，不伪造 |
| WP4-L07 | 未知未来版本 | 不覆盖原数据 |
| WP4-L08 | 单条mistake损坏 | 隔离该条，保留其他字段 |
| WP4-L09 | active Attempt不一致 | 整条active不可恢复 |
| WP4-L10 | completed Session作为active | 拒绝恢复active |

### 17.3 Attempt保存与恢复

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP4-A01 | 新建Session | 立即保存active Attempt |
| WP4-A02 | 第1题提交反馈态 | 刷新后答案、锁定和Feedback一致 |
| WP4-A03 | 第2题完成并推进 | 恢复到第3题 |
| WP4-A04 | pending题恢复 | presentedAt重置为恢复时间 |
| WP4-A05 | answered题恢复 | Response duration不变 |
| WP4-A06 | 完成最后一题 | active清空，lastCompletion写入 |
| WP4-A07 | completed Attempt | 不恢复为active |
| WP4-A08 | 放弃Attempt | 保存终态并清空active |
| WP4-A09 | 放弃后新建 | Session ID不同 |
| WP4-A10 | Attempt写入失败 | 内存继续且暴露warning |

### 17.4 历史、结果与错题

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP4-H01 | 完成Session | completedSessions新增并去重 |
| WP4-H02 | 超过10个摘要 | 只保留最近10个 |
| WP4-H03 | 刷新结果页 | 数字与完成时一致 |
| WP4-H04 | Completion summary | 与completedAttempt统计一致 |
| WP4-H05 | 新错误Response | 新增active Mistake |
| WP4-H06 | 同题再次错误 | 更新而不重复 |
| WP4-H07 | 标记已处理 | resolved立即保存 |
| WP4-H08 | resolved题再次答错 | 重新激活 |

### 17.5 冲突与版本

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| WP4-C01 | 已有active时开始新练习 | 返回active_attempt_conflict |
| WP4-C02 | 仅点击放弃入口 | 不改变Store |
| WP4-C03 | 确认放弃 | 先保存abandoned再新建 |
| WP4-C04 | 放弃保存失败 | 不创建新Session |
| WP4-C05 | 另一个writer提高revision | 当前写入conflict |
| WP4-C06 | storage事件来自当前writer | 不误报冲突 |
| WP4-C07 | pending Question版本变化 | 受控不可恢复，不重判 |
| WP4-C08 | answered Question版本变化 | 使用已存Response与Feedback展示 |

## 十八、浏览器人工验收

### 18.1 pending题恢复

1. 开始3题专项；
2. 完成第1题并进入第2题；
3. 刷新页面；
4. 确认仍是第2题、同一题目和同一Session；
5. 确认未提交草稿可以丢失；
6. 提交后主链继续。

### 18.2 反馈态恢复

1. 在第1题提交一个错误答案；
2. 停留在反馈卡；
3. 刷新页面；
4. 确认所选答案、错误标识、正确答案和反馈完全一致；
5. 确认不能再次提交；
6. 点击下一题只推进一次。

### 18.3 关闭与重新进入

1. 创建综合10题Session；
2. 完成至少2题；
3. 关闭当前标签；
4. 重新打开知识练习入口；
5. 确认显示“继续上次练习”；
6. 继续后进入正确索引。

### 18.4 放弃并新建

1. 存在active Attempt；
2. 点击新分类；
3. 确认没有静默覆盖；
4. 点击放弃但不确认，Store不变；
5. 确认放弃；
6. 新Session ID与旧ID不同；
7. 新Session从第1题开始。

### 18.5 结果与错题

1. 完成单题专项；
2. 记录结果数字；
3. 刷新结果页，数字不变；
4. 进入错题页，记录存在；
5. 刷新错题页，记录仍存在；
6. 标记已处理后刷新，状态保持。

### 18.6 异常链

- 注入损坏primary且有效backup，页面恢复备份；
- 注入primary与backup均损坏，页面显示受控空状态；
- 模拟Storage写入失败，当前答题不中断并显示未保存；
- 模拟未来schema，原数据不被覆盖；
- 双标签写入出现明确冲突，不静默合并；
- 清理浏览器数据后不声称仍可恢复；
- 浏览器控制台无未处理错误。

## 十九、实现结构

建议代码结构：

```text
src/domain/knowledge-practice/persistence/
├── localPracticeStoreTypes.ts
├── localPracticeStoreValidator.ts
├── migrateLocalPracticeStore.ts
├── buildPracticeCompletionRecord.ts
├── persistedKnowledgeMistake.ts
└── practicePersistenceErrors.ts

src/repositories/knowledge-practice/
├── localPracticeRepository.ts
├── localStoragePracticeRepository.ts
└── inMemoryPracticeStorage.ts

src/context/
└── PracticeSessionContext.jsx

src/components/knowledge-practice/
├── ContinuePracticeCard.jsx
├── PracticePersistenceNotice.jsx
└── AbandonPracticeConfirmation.jsx

src/ai/tests/
└── runKnowledgePracticeWP4Debug.ts
```

## 二十、实施步骤

### WP4-M0：冻结Fixture与存储键

1. 冻结空Store、active、feedback、completed、abandoned和mistake Fixture；
2. 冻结v0迁移Fixture；
3. 冻结损坏JSON、未来schema和版本错位Fixture；
4. 固定primary、backup和quarantine键。

### WP4-M1：类型、校验与迁移

1. 建立Store、Completion、Mistake和结果类型；
2. 实现根校验器；
3. 实现v0→v1显式迁移；
4. 实现局部mistake与history隔离；
5. 实现未知未来版本保护。

### WP4-M2：Repository

1. 实现StorageLike注入；
2. 实现empty/load/save；
3. 实现revision冲突；
4. 实现backup和回读校验；
5. 实现quarantine最小元数据；
6. 实现Storage异常结构化降级；
7. 实现完成、放弃和Mistake高层命令。

### WP4-M3：Provider持久化装配

1. 加入hydration状态；
2. 恢复Attempt、history、completion和mistakes；
3. commit Attempt后立即保存；
4. 完成和放弃使用专用Repository命令；
5. 加入写入失败与revision冲突状态；
6. 监听storage事件；
7. 恢复pending题时重置计时。

### WP4-M4：页面接入

1. KnowledgePractice增加继续卡和本地边界说明；
2. 增加两步放弃并新建；
3. Quiz增加hydrate、保存失败和冲突状态；
4. Result读取lastCompletion；
5. Mistakes切换到持久化记录；
6. Direct Quiz路由不再静默覆盖active。

### WP4-M5：验收与收口

1. 运行WP4自动化；
2. 运行WP1—WP3回归；
3. 运行数据门禁和生产构建；
4. 完成pending、feedback、close/reopen、result和mistake浏览器主链；
5. 完成损坏、备份、不可用和冲突异常链；
6. 输出WP4 Engineering Acceptance Report；
7. 更新执行清单为WP4 ENGINEERING PASS。

## 二十一、建议命令

新增：

```json
{
  "scripts": {
    "debug:knowledge-practice-wp4": "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runKnowledgePracticeWP4Debug.ts"
  }
}
```

收口执行：

```text
npm run debug:knowledge-practice-wp1
npm run validate:knowledge-questions
npm run debug:knowledge-practice-wp2
npm run debug:knowledge-practice-wp3
npm run debug:knowledge-practice-wp4
npm run build
```

## 二十二、完成门禁

### 22.1 领域与Repository

- [ ] Store v1、Completion和Mistake契约完成；
- [ ] 页面和Context不直接访问localStorage；
- [ ] Attempt保存与读取均执行结构校验；
- [ ] revision冲突不静默覆盖；
- [ ] primary损坏可从backup恢复；
- [ ] 双损坏返回受控空状态；
- [ ] v0可显式迁移；
- [ ] 未来schema不被空Store覆盖；
- [ ] 写入异常不向React抛出；
- [ ] Completion summary与completedAttempt一致。

### 22.2 产品主链

- [ ] Session创建后立即保存；
- [ ] Response提交后立即保存；
- [ ] 当前题推进后立即保存；
- [ ] 完成、放弃和错题变化立即保存；
- [ ] pending题刷新后恢复正确索引；
- [ ] feedback态刷新后保持答案、锁定和反馈；
- [ ] 关闭后重新进入可继续；
- [ ] active Attempt不被新Session静默覆盖；
- [ ] 两步放弃后才能新建；
- [ ] 结果页和错题页刷新保持一致；
- [ ] 本地保存边界清晰可见；
- [ ] 保存失败时当前练习仍可继续。

### 22.3 验证

- [ ] WP4自动化全部通过；
- [ ] WP3 `49 / 49`回归通过；
- [ ] WP2 `47 / 47`回归通过；
- [ ] WP1 `47 / 47`回归通过；
- [ ] 数据门禁`0 error / 0 warning`；
- [ ] 生产构建通过；
- [ ] 正常恢复、反馈恢复、关闭重开主链通过；
- [ ] 损坏、备份、不可用、未来schema和冲突异常链通过；
- [ ] 浏览器控制台无新增未处理错误；
- [ ] 输出WP4工程验收报告；
- [ ] 执行清单更新为WP4 ENGINEERING PASS。

## 二十三、风险与预案

| 风险 | 影响 | 预案 |
| --- | --- | --- |
| Context在hydrate前创建Session | 覆盖旧active | hydration完成前禁止start和direct-route fallback |
| 页面直接写localStorage | 键和schema失控 | 只允许Repository访问StorageLike |
| 保存Session但漏Response | 恢复后状态不一致 | 始终保存完整Attempt并校验 |
| 结果页只存数字 | WP6无法生成结构化结果 | lastCompletion同时保存completedAttempt |
| 主记录损坏 | 所有本地事实丢失 | primary+backup，失败后最小隔离元数据 |
| 备份成为第二事实源 | 恢复选择混乱 | primary始终权威；backup仅在primary不可用时读取 |
| 写入失败阻断答题 | 学生无法完成 | 内存继续、非阻断提示、后续重试 |
| active被新Session覆盖 | 学生进度丢失 | 冲突返回+两步放弃 |
| 多标签各自产生Response | 历史分叉 | revision、writerId、storage事件，不自动合并 |
| 关闭期间计入时长 | 用时失真 | pending恢复和visible时重置presentedAt |
| 当前题库版本变化 | 旧Session被新内容重判 | answered读保存事实；pending版本错位受控终止 |
| future schema被旧客户端覆盖 | 新版本数据丢失 | future版本只读失败，禁止写空v1 |
| Store无限增长 | Quota失败 | 10条Session摘要、1条完整Completion、200条Mistake、512KB软门禁 |
| 文案夸大本地保存能力 | 学生误解同步范围 | 所有入口明确本机、本浏览器边界 |

## 二十四、WP4之后的交接

WP4向WP5交付：

- 可持久化和恢复的PracticeAttempt；
- 原题错误Response；
- Queue原子保存命令；
- 可保存未来reinforcement Queue Item的通用Repository边界；
- 持久化Mistake事实。

WP5插入巩固题后必须通过同一`saveActiveAttempt`路径立即保存，不得创建第二个localStorage键。

WP4向WP6交付：

- lastCompletion中的不可变completedAttempt；
- 兼容Completion summary；
- 真实Response duration；
- completedSessions历史。

WP6从completedAttempt构建正式PracticeResult，并迁移结果展示；不得从当前题库重新判题。

## 二十五、关键决策确认

进入代码开发前确认以下决策：

| 编号 | 决策 | 推荐结论 | 影响 |
| --- | --- | --- | --- |
| D1 | 持久化范围 | 仅本机、当前浏览器 | 不承诺账号与跨设备同步 |
| D2 | 唯一写入边界 | LocalPracticeRepository | 页面与Context不得直接读写localStorage |
| D3 | 根对象 | 一个Store v1聚合Attempt、历史、Completion和Mistakes | 保持一致性并减少散落键 |
| D4 | 物理可靠性 | primary + backup + quarantine元数据 | 主记录损坏时恢复最近有效版本 |
| D5 | 并发控制 | revision + writerId + storage事件 | 冲突不静默覆盖、不自动合并 |
| D6 | active冲突 | 默认继续；两步放弃后才能新建 | 防止Session丢失 |
| D7 | 写入失败 | 内存继续并明确提示未保存 | 可完成当前练习但不虚假承诺恢复 |
| D8 | pending恢复计时 | 恢复与重新visible时重置presentedAt | 不计关闭和后台停留时间 |
| D9 | feedback恢复 | 使用已存Response与Feedback，不重新判题 | 保持历史事实稳定 |
| D10 | Question版本错位 | answered可展示；pending受控终止 | 不用新版本替换旧未答题 |
| D11 | 结果刷新 | 保存完整completedAttempt与兼容summary | WP6仍能生成正式结果 |
| D12 | 错题存储 | 保存最小身份与展示快照，Question ID去重 | 题库变化后仍可理解历史错题 |
| D13 | 旧版本迁移 | 只迁移冻结v0；future schema不覆盖 | 不猜测未知数据 |
| D14 | 容量边界 | 10条Session摘要、1条完整Completion、200条Mistake、512KB软门禁 | 防止Store无限增长 |
| D15 | 81道正式题 | 不写入知识练习Store，WP7统一入口 | 保持正式Learning契约隔离 |
| D16 | WP4完成状态 | 自动化、回归、构建、浏览器正常链与异常链齐全后才PASS | 不以“刷新看似可用”代替工程验收 |

推荐D1—D16全部作为WP4冻结基线。若无调整，下一步按本文生成WP4执行清单并进入代码开发。
