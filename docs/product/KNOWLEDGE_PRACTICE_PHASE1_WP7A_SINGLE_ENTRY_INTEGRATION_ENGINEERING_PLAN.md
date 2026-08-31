# 知识练习第一阶段 WP7A 唯一入口最小整合工程实施文档

状态：`ENGINEERING PASS / WP5 + WP6 + WP7B ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING (0 / 5)`

工程证据：[WP7A 工程验收报告](./KNOWLEDGE_PRACTICE_PHASE1_WP7A_ENGINEERING_ACCEPTANCE_REPORT.md)

版本：`knowledge_practice_phase1_wp7a_single_entry_integration_v1.0`

日期：2026-08-29

执行更新：2026-08-31，WP5、WP6与WP7B Engineering Acceptance均已PASS；正文中的后继工作包状态保留为验收时历史快照，当前状态以 [`CURRENT_PRODUCT_STATE.md`](./CURRENT_PRODUCT_STATE.md) 为准。

上位决策：

- [WP0A 学生唯一入口、正式阅读题库与轻量知识练习角色对齐决策](./STUDENT_SINGLE_ENTRY_FORMAL_READING_AND_KNOWLEDGE_PRACTICE_ALIGNMENT_DECISION_WP0A.md)
- [全项目文档审计报告](./FULL_PROJECT_DOCUMENT_AUDIT_2026-08-29.md)
- [学生产品界面收口契约](./STUDENT_PRODUCT_INTERFACE_CONSOLIDATION.md)
- [知识练习第一阶段总体工程方案](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md)
- [知识练习第一阶段执行清单](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md)

依赖状态：

- WP0A：`DECISION CONFIRMED`；
- WP1：`ENGINEERING PASS / 47 / 47`；
- WP2：`ENGINEERING PASS / 47 / 47`；
- WP3：`ENGINEERING PASS / 49 / 49`；
- WP4：`ENGINEERING PASS / 33 / 33`；
- WP5：`BLOCKED UNTIL WP7A ENGINEERING PASS`。

## 一、工程目标

WP7A 把正式阅读能力主线和轻量知识巩固收敛到学生唯一 `/learning` 产品入口，同时保持两类任务的数据、判题和结论边界。

完成后，学生应能在一个入口中：

1. 看懂系统当前推荐的正式阅读任务；
2. 开始或继续正式 Learning；
3. 看见并主动进入“基础知识巩固”；
4. 恢复未完成的 PracticeSession；
5. 从旧知识练习链接安全返回统一入口；
6. 理解正式阅读和知识巩固产生的结论不同。

WP7A 只完成入口、路由、投射和兼容整合，不实现 WP5 错题变式巩固、WP6 结果推荐，也不宣称产品验收或教育效果成立。

## 二、冻结边界

### 2.1 必须保持

- `UnifiedLearningEntryState` 继续是正式 Learning 状态和正式主要动作的唯一 Owner；
- 正式 81 道题继续通过 Formal Resource / Registry / Learning 主链消费；
- `PracticeSessionContext`、Knowledge Question Repository 和 WP1—WP4 领域能力继续复用；
- PracticeSession 继续使用本机浏览器 Store；
- 正式 Learning Session 与 PracticeSession ID 不合并；
- 知识练习结果不写入 Diagnosis、Evidence、Profile 或正式 Trial 教育效果分母；
- active PracticeSession 不因路由调整被删除、覆盖、重建或静默放弃。

### 2.2 本工作包不做

- 不把 81 道正式题写入 Knowledge Question Repository；
- 不把轻量知识题升级为 Frozen Resource；
- 不创建第二个 `UnifiedLearningEntryState`；
- 不新增第二套学生身份；
- 不改写正式 Observation Plan、Strategy 或 Next Task；
- 不实现 WP5 的 ReinforcementLink 和动态插题；
- 不实现 WP6 的正式 PracticeResult 推荐；
- 不扩充题目内容；
- 不删除历史路由或学生本地记录；
- 不重新激活 Trial；
- 不调整正式反馈 Rubric、Diagnosis 或 Profile 规则。

## 三、当前代码基线

当前实现已经具备：

| 能力 | 当前代码 |
| --- | --- |
| 根路径进入正式学习 | `src/App.jsx`：`/ → /learning` |
| 正式入口与工作区 | `src/pages/UnifiedLearningEntry.jsx` |
| 知识练习分类入口 | `src/pages/KnowledgePractice.jsx` |
| 知识题作答 | `src/pages/Quiz.jsx` |
| 知识练习结果 | `src/pages/Result.jsx` |
| 知识错题 | `src/pages/Mistakes.jsx` |
| 全局轻量会话状态 | `src/context/PracticeSessionContext.jsx` |
| 本地持久化 | `src/repositories/knowledge-practice/localStoragePracticeRepository.ts` |
| 正式与轻量 Provider 挂载 | `src/main.jsx` |

当前主要缺口：

1. `/learning` 不知道 active PracticeSession 和轻量题库概况；
2. `/practice/knowledge` 仍是独立学生入口；
3. `/quiz/:category`、`/result` 和 `/mistakes` 不处于 `/learning` 路由命名空间；
4. 底部“练习 / 错题本 / 我的”虽然标记 `frozen`，仍可点击；
5. 页面没有解释 81 道正式题与 12 道 approved 轻量题的不同角色；
6. 正式 Runtime 故障和轻量本地状态尚未独立投射到同一入口。

## 四、目标信息架构

### 4.1 规范路由

WP7A 冻结以下学生规范路由：

| 路由 | 职责 |
| --- | --- |
| `/learning` | 唯一学生入口与正式能力主线 |
| `/learning/knowledge` | 基础知识巩固目录、开始与恢复 |
| `/learning/knowledge/quiz/:category` | 轻量知识题作答 |
| `/learning/knowledge/result` | 最近完成结果兼容页 |
| `/learning/knowledge/mistakes` | 现有本地错题事实兼容页 |

旧路由保留为兼容跳转：

| 旧路由 | 目标路由 | 规则 |
| --- | --- | --- |
| `/practice` | `/learning` | `replace`，不再展示第二入口菜单 |
| `/practice/knowledge` | `/learning/knowledge` | `replace`，不得改变 Store |
| `/quiz/:category` | `/learning/knowledge/quiz/:category` | 保留编码后的 category |
| `/result` | `/learning/knowledge/result` | 读取持久化 `lastCompletion` |
| `/mistakes` | `/learning/knowledge/mistakes` | 读取现有本地错题事实 |
| `/profile` | `/learning` | WP7A 不继续维护旧等级画像入口 |

兼容跳转必须使用 React Router 声明式重定向或纯路由 Adapter，不在重定向中调用 `startPractice`、`abandonSession`、`completeAttempt` 或任何写操作。

### 4.2 页面层级

```text
Student Learning Shell
├─ 当前任务区
│  ├─ 正式任务开始 / 继续 / 恢复
│  └─ 已有轻量练习继续（按优先级投射）
├─ 系统推荐区
│  └─ 正式阅读与能力训练
├─ 辅助训练区
│  └─ 基础知识巩固
└─ 状态说明
   ├─ 正式资源与任务状态
   └─ 本机知识练习保存边界
```

`/learning` 不展示 81 张题卡，也不改造成题库目录。它只展示库存口径、当前任务、进入理由和允许的动作。

## 五、只读入口投射契约

### 5.1 不复制正式入口状态

新增只读 `StudentLearningHubProjection`，它只组合两个 Owner 的投射结果：

```ts
type StudentLearningHubProjection = {
  projectionVersion: 'student_learning_hub_projection_v1';
  formal: FormalLearningEntryProjection;
  knowledge: KnowledgePracticeEntryProjection;
  primaryAction: StudentHubAction;
  secondaryActions: StudentHubAction[];
  inventory: StudentContentInventoryProjection;
  notices: StudentHubNotice[];
};
```

约束：

- `formal.entry` 直接引用或只读适配现有 `UnifiedLearningEntryState`；
- Hub Projection 不重新判断正式任务是否可进入；
- Hub Projection 不读取 Formal Repository 原始记录自行拼装正式状态；
- Knowledge Projection 只读取 `PracticeSessionContext` 已恢复的状态和 Knowledge Question Repository 只读统计；
- Projection 构建必须为纯函数，不产生 Store、Session、Event 或 Trial 写入。

### 5.2 Knowledge Practice Entry Projection

```ts
type KnowledgePracticeEntryProjection = {
  status:
    | 'loading'
    | 'ready_to_start'
    | 'active_session'
    | 'content_insufficient'
    | 'store_read_only'
    | 'store_recovery_required';
  approvedQuestionCount: number;
  availableCategoryCount: number;
  activeSession?: {
    sessionId: string;
    mode: 'category' | 'mixed' | 'mistake_review';
    category?: string;
    currentPosition: number;
    totalItems: number;
  };
  primaryPath: string;
  studentMessage: string;
};
```

不得向入口暴露：

- `writerId`、Store revision、localStorage key；
- 正式 Evidence 或 Trial 工程字段；
- 错题长期根因推断；
- 未 approved 的题目内容。

### 5.3 内容库存投射

```ts
type StudentContentInventoryProjection = {
  formal: {
    currentCount?: number;
    coreEligibleCount?: number;
    targetedCount?: number;
    status: 'available' | 'unavailable' | 'unknown';
  };
  knowledge: {
    approvedCount: number;
    categoryCount: number;
  };
};
```

数量规则：

- 正式数量只能来自现有 Runtime Health / Formal Resource Snapshot 的只读投射；
- Runtime 未运行或数量不可验证时显示“内容状态暂不可读取”，不得回退硬编码 81；
- Knowledge 数量来自 `knowledgeQuestionRepository.listApproved()`；
- 不向学生展示 15 道 draft；
- 不把 `81 + 12` 表述为“93 道同一题库”。

## 六、唯一主要动作规则

Hub 入口使用确定性优先级，不允许页面自行竞态：

| 优先级 | 条件 | 唯一主要动作 |
| ---: | --- | --- |
| 1 | 正式 Session 处于提交恢复、审核或可继续状态 | 继续正式学习 |
| 2 | 正式 Session 不可继续，但 active PracticeSession 存在 | 继续基础知识巩固 |
| 3 | 无 active Session，正式 Entry 可开始新任务 | 开始正式阅读训练 |
| 4 | 正式任务暂不可开始，知识练习可用 | 开始基础知识巩固 |
| 5 | 两类任务都不可进入 | 执行唯一恢复动作或保持只读说明 |

双 active 兼容规则：

- 历史状态可能同时存在 active Formal Session 与 active PracticeSession；
- 正式 Session 为唯一主要动作；
- active PracticeSession 作为明确的次要“稍后继续”状态展示；
- 不自动结束任一 Session；
- 不因进入正式 Learning 删除知识练习草稿或答案；
- 学生主动切换时给出“两个进度分别保存”的简短说明，不弹出强制放弃确认。

新状态下不禁止两类 Session 并存，因为它们属于不同事实链；WP7A 只保证入口优先级清晰。

## 七、故障与降级规则

### 7.1 正式 Runtime 故障

正式 Runtime Health 不可用时：

- 保留现有正式恢复提示和唯一恢复动作；
- 不把 Runtime 故障表述成“题目不足”；
- 如果 Knowledge Store 和 approved 内容可用，基础知识巩固仍可作为辅助动作进入；
- 辅助动作不得遮盖正式故障说明；
- 进入轻量练习不会修改正式 Trial 或 Health 状态。

### 7.2 Knowledge Store 故障

Knowledge Store 损坏、冲突或未来版本只读时：

- 正式 Learning 继续正常加载；
- 复用 WP4 的 backup、quarantine、read-only 和 reload 语义；
- 不把知识 Store 故障投射成正式资源故障；
- 禁止通过清空 localStorage 作为自动恢复动作；
- active Attempt 无法可靠恢复时，保留已有答案事实并要求学生显式选择下一步。

### 7.3 内容不足

- 某分类不足 5 道时展示实际可组成题量；
- 综合不足 10 道时沿用 WP2 的可执行降级规则；
- 0 道 approved 时禁用新建知识练习，但不阻断正式 Learning；
- draft 题不得为满足 UI 数量而进入候选池。

## 八、页面与组件实施

### 8.1 `/learning` 外壳

在现有 `UnifiedLearningEntry.jsx` 基础上完成最小整合，推荐拆分：

```text
src/components/student-learning/
├─ StudentLearningHubHeader.jsx
├─ FormalLearningEntryCard.jsx
├─ KnowledgePracticeEntryCard.jsx
├─ StudentContentInventoryNote.jsx
└─ StudentLearningHubNotice.jsx
```

要求：

- 现有正式工作区 `Phase163LiveLearningWorkspace` 不重写；
- 正式 Entry 状态、错误和恢复组件保持原 Owner；
- Knowledge Card 使用 `usePracticeSession()` 的只读字段；
- 页面动作只调用现有正式命令或显式导航；
- 不在渲染或 `useEffect` 中自动创建 PracticeSession。

### 8.2 Knowledge 目录

将 `KnowledgePractice.jsx` 迁移到规范 `/learning/knowledge` 路由，保留：

- 12 道 approved 动态统计；
- 分类和综合入口；
- active Session 恢复；
- active Session 覆盖确认；
- WP4 持久化 notice 和 reload；
- 本机、本浏览器保存边界。

文案调整：

- 页面名称：“基础知识巩固”；
- 删除“碎片化刷题”主定位；
- 增加“本练习只记录本轮知识巩固，不代表长期能力结论”；
- 返回动作固定回到 `/learning`；
- 正式题库数量不在此页重复伪装成轻量题数量。

### 8.3 Quiz、Result 和 Mistakes

- Quiz 使用规范路由并返回 `/learning/knowledge`；
- Result 从持久化 `lastCompletion` 恢复，不依赖导航瞬时 state；
- Mistakes 继续读取 WP4 本地错题事实；
- WP7A 不增加“掌握”“能力提升”等文案；
- 所有页面提供返回唯一学习入口的稳定路径；
- 完成一组练习后，学生可以返回 `/learning`，但 WP6 前不新增复杂推荐算法。

### 8.4 旧底部导航

`Layout.jsx` 中 `frozen: true` 的并列入口不得继续渲染为可点击一级导航。

WP7A 处理方式：

- `/learning` 工作区继续不展示旧底部导航；
- 旧非工作区页面如仍需兼容，可显示单一“返回学习”动作；
- 不新增新的四栏学生主导航；
- 不在本工作包建设新版 Profile 或独立错题首页。

## 九、建议文件变更

### 9.1 新增

```text
src/domain/student-learning-hub/studentLearningHubProjection.ts
src/domain/student-learning-hub/studentLearningHubTypes.ts
src/components/student-learning/KnowledgePracticeEntryCard.jsx
src/components/student-learning/StudentContentInventoryNote.jsx
src/pages/KnowledgePracticeRouteRedirect.jsx
src/ai/tests/runKnowledgePracticeWP7ADebug.ts
```

如实现能够保持职责清晰，可减少组件文件；不得把 Projection 逻辑重新堆回页面条件分支。

### 9.2 修改

```text
src/App.jsx
src/pages/UnifiedLearningEntry.jsx
src/pages/KnowledgePractice.jsx
src/pages/Quiz.jsx
src/pages/Result.jsx
src/pages/Mistakes.jsx
src/components/Layout.jsx
package.json
```

### 9.3 原则上不修改

```text
src/domain/knowledge-practice/questions/**
src/domain/knowledge-practice/practice/**
src/domain/knowledge-practice/response/**
src/domain/knowledge-practice/persistence/**
src/repositories/knowledge-practice/**
正式 Learning Diagnosis / Evidence / Profile Runtime
.local-data/formal-resource-store.json
```

如果实现中确需修改上述领域层，必须先证明是 WP7A 入口集成必需的只读 Adapter，而不是提前实现 WP5 或改变事实契约。

## 十、实施工作包

### WP7A-1：Projection 与路由基础

交付：

- Student Learning Hub 类型和纯投射器；
- Knowledge Entry 只读投射；
- 规范 `/learning/knowledge/**` 路由；
- 旧路由零写入兼容 Adapter；
- 基础契约测试。

完成条件：路由迁移不改变 active PracticeSession 和 Store revision。

### WP7A-2：`/learning` 入口整合

交付：

- 正式任务与基础知识巩固入口卡；
- 唯一主要动作优先级；
- 双 active Session 兼容；
- 动态库存说明；
- Runtime 与 Store 故障独立投射。

完成条件：不复制正式 Entry 判断，不产生隐式写入。

### WP7A-3：Knowledge 页面规范化

交付：

- KnowledgePractice、Quiz、Result、Mistakes 规范路由；
- 统一返回路径和结论边界文案；
- 旧底部导航收口；
- PC / Tablet / Mobile 与键盘适配。

完成条件：现有 WP1—WP4 主链和本地恢复零回归。

### WP7A-4：回归与工程收口

交付：

- WP7A 自动化命令；
- 正式 Learning 回归；
- WP1—WP4 全量回归；
- Production Build；
- 浏览器主链与异常链验收；
- WP7A Engineering Acceptance Report。

完成条件：全部门禁通过后，才将执行清单中的 WP5 从 `BLOCKED` 改为 `PENDING / AUTHORIZED`。

## 十一、自动化验收矩阵

建议命令：

```json
{
  "debug:knowledge-practice-wp7a": "node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runKnowledgePracticeWP7ADebug.ts"
}
```

### 11.1 Projection：WP7A-C01—C12

| Case | 验收 |
| --- | --- |
| C01 | Formal active 时主要动作为继续正式学习 |
| C02 | Formal 无 active、Knowledge active 时主要动作为继续知识巩固 |
| C03 | 两者无 active 且 Formal 可开始时优先正式任务 |
| C04 | Formal 不可开始但 Knowledge 可用时允许开始知识巩固 |
| C05 | 两类都不可用时只输出一个恢复动作 |
| C06 | 双 active 时不结束、不覆盖任一 Session |
| C07 | Hub 不重新生成正式 `primaryAction` |
| C08 | Knowledge loading 不阻断正式 Entry |
| C09 | Knowledge future-version read-only 不阻断正式 Entry |
| C10 | Formal Runtime blocked 不伪装为知识题不足 |
| C11 | Projection 为纯函数、输入相同输出稳定 |
| C12 | Projection 不包含内部 Store key、writerId 或 Trial 工程字段 |

### 11.2 Inventory：WP7A-C13—C20

| Case | 验收 |
| --- | --- |
| C13 | Knowledge approved 数量来自 Repository |
| C14 | draft 不计入学生可用数 |
| C15 | 正式数量不可读时显示 unknown，不回退硬编码 81 |
| C16 | 正式库存、核心池、微训练池分层展示 |
| C17 | 不把正式题与轻量题求和为同一题库 |
| C18 | 分类数量按 approved 题动态生成 |
| C19 | 0 approved 时禁用新建但正式 Learning 可用 |
| C20 | 数量变化不修改 Session 或正式资源 |

### 11.3 Routing：WP7A-C21—C32

| Case | 验收 |
| --- | --- |
| C21 | `/practice` replace 到 `/learning` |
| C22 | `/practice/knowledge` replace 到 `/learning/knowledge` |
| C23 | `/quiz/:category` 保留 category 跳转规范 Quiz |
| C24 | `/result` 跳转规范 Result 并恢复 lastCompletion |
| C25 | `/mistakes` 跳转规范本地错题页 |
| C26 | `/profile` 不再进入旧等级主产品 |
| C27 | 兼容跳转 Store revision 不变 |
| C28 | 兼容跳转 active Attempt 身份不变 |
| C29 | 兼容跳转 Response 和 Feedback 数量不变 |
| C30 | 规范页面返回 `/learning` 或 `/learning/knowledge` |
| C31 | 页面刷新后规范路由仍可恢复 |
| C32 | 编码后的中文 category 不丢失 |

### 11.4 Fact isolation：WP7A-C33—C42

| Case | 验收 |
| --- | --- |
| C33 | 打开 Knowledge Card 不创建 PracticeSession |
| C34 | 只有显式开始动作创建 Session |
| C35 | 打开或完成知识练习不创建正式 Evidence |
| C36 | 不修改正式 Profile 或 Growth Memory |
| C37 | 不写 Formal Resource Store |
| C38 | 不修改 Trial Activation / Observation |
| C39 | 正式 Session 操作不删除 active PracticeSession |
| C40 | Knowledge Store 故障不修改正式 Entry 状态 |
| C41 | 正式 Runtime 故障不清理 Knowledge Store |
| C42 | 旧路由兼容过程零业务写入 |

### 11.5 Accessibility and presentation：WP7A-C43—C50

| Case | 验收 |
| --- | --- |
| C43 | 唯一主要动作可被程序识别 |
| C44 | 次要知识入口不伪装成正式 Evidence 任务 |
| C45 | 状态不只依赖颜色表达 |
| C46 | loading、blocked、read-only 有可理解文本 |
| C47 | 键盘可进入、返回和恢复 |
| C48 | 390px 下无横向溢出和按钮遮挡 |
| C49 | PC 内容宽度与正式入口阅读节奏一致 |
| C50 | 页面无“已掌握”“能力已提升”等越界表达 |

## 十二、必须执行的回归

```text
npm run debug:knowledge-practice-wp1
npm run debug:knowledge-practice-wp2
npm run debug:knowledge-practice-wp3
npm run debug:knowledge-practice-wp4
npm run debug:knowledge-practice-wp7a
npm run debug:unified-learning-entry
npm run debug:phase16-3-day0-integration
npm run debug:product-runtime-reliability-wp-r2
npm run debug:core-reading-new-session-admission
npm run build
```

如实际 `package.json` 命令名称不同，实施时以现有命令为准，并在验收报告记录真实命令和结果；不得为了文档目标伪造不存在的 PASS。

## 十三、浏览器验收

### B1：首次进入

1. 清空隔离验收环境中的知识练习数据；
2. 打开 `/learning`；
3. 确认正式任务为主要产品方向；
4. 确认基础知识巩固清晰可见但不生成 Session；
5. 进入 Knowledge 目录并开始一组练习；
6. 返回后仍能继续相同 Session。

### B2：正式 Session 恢复

1. 准备可恢复 Formal Session；
2. 同时保留无 active 的 Knowledge Store；
3. 打开 `/learning`；
4. 确认唯一主要动作为继续正式学习；
5. 正式草稿、任务和资源身份保持不变。

### B3：Knowledge Session 恢复

1. 建立 active PracticeSession 并完成部分题；
2. 刷新 `/learning`；
3. 在无可继续 Formal Session 时，主要动作是继续基础知识巩固；
4. 进入规范 Quiz 后题号、答案、Response 和 Feedback 保持；
5. 不创建重复 Session。

### B4：双 active 兼容

1. 在隔离环境准备 active Formal Session 与 active PracticeSession；
2. 打开 `/learning`；
3. Formal 继续为唯一主要动作；
4. Knowledge 显示已保存的次要继续状态；
5. 分别进入两类任务，确认互不覆盖。

### B5：旧路由

依次打开 `/practice`、`/practice/knowledge`、`/quiz/:category`、`/result`、`/mistakes` 和 `/profile`，确认：

- 到达规范路由；
- 浏览器 Back 不形成重定向循环；
- Store revision、active Session 和已提交事实不变；
- 没有白屏或控制台未处理异常。

### B6：独立故障

- 正式 Runtime 不可用而 Knowledge 可用；
- Knowledge Store 损坏而 Formal 可用；
- Knowledge 0 approved 而 Formal 可用；
- 两类均不可用。

每种情况必须只解释真实故障，并提供一个明确主要动作。

### B7：响应式与可访问性

在 390px、768px 和 PC 宽度检查：

- 主要动作和辅助动作层级；
- 卡片、题量说明和状态文本；
- 键盘焦点顺序；
- 返回、继续、重试和只读状态；
- 非颜色状态表达；
- 控制台无未处理错误。

## 十四、数据迁移与回滚

### 14.1 不做 Store 数据迁移

WP7A 不提升 `PRACTICE_STORE_SCHEMA_VERSION`。路由和入口变化不构成业务数据迁移，现有 Store 原样读取。

### 14.2 回滚原则

若 WP7A 页面整合失败：

- 可回滚入口组件和规范路由；
- 不删除 Knowledge Store；
- 不改写 active Attempt；
- 不回滚正式学生事实；
- 旧兼容路由仍应提供到可恢复页面的安全路径；
- WP5 继续保持 `BLOCKED`。

### 14.3 停止条件

出现以下任一情况立即停止 WP7A 发布：

- 正式 `/learning` 无法开始或恢复；
- active PracticeSession 被自动覆盖或丢失；
- 旧路由触发业务写入；
- Knowledge 事实进入正式 Evidence / Profile；
- Runtime 故障被错误表述为题目不足；
- 页面出现两个同等主要动作；
- WP1—WP4 或正式 Learning 关键回归失败。

## 十五、Engineering PASS 门禁

WP7A 只有同时满足以下条件才能标记 `ENGINEERING PASS`：

1. `/learning` 是唯一学生产品入口；
2. 正式阅读与基础知识巩固角色清晰；
3. 唯一主要动作优先级通过全部组合测试；
4. 规范路由和旧路由兼容通过；
5. active Formal Session 与 active PracticeSession 均不丢失；
6. 正式库存与轻量题量动态、分层、无误导；
7. Formal Runtime 与 Knowledge Store 故障隔离；
8. WP7A-C01—C50 全部通过；
9. WP1—WP4 回归全部通过；
10. 正式 Unified Learning、核心新会话和 Runtime Recovery 回归通过；
11. Production Build 通过；
12. B1—B7 浏览器验收通过；
13. 输出 Engineering Acceptance Report 和已知限制；
14. 未产生正式资源、学生 Evidence、Profile 或 Trial 非授权写入；
15. 未提前实现 WP5 或 WP6。

通过后的准确声明只能是：

> 学生唯一 `/learning` 入口已能正确呈现并进入正式阅读能力主线与轻量基础知识巩固；现有正式与轻量学习事实保持隔离，旧知识练习路由和未完成会话得到兼容保护。该结果证明入口整合工程成立，不代表知识练习内容规模、真实反馈价值或教育效果已经通过产品验收。

## 十六、WP5 解锁规则

只有 WP7A Engineering Acceptance Report 明确记录以下结果后，WP5 才可从 `BLOCKED` 升级为 `PENDING / AUTHORIZED`：

- WP7A `ENGINEERING PASS`；
- 未发现需回滚的 P0 / P1 入口或事实隔离问题；
- WP1—WP4 零回归；
- 产品控制表、系统地图和执行清单状态同步；
- WP5 仍遵守“轻量本轮事实、不进入正式 Evidence”的边界。

WP7A 通过不自动开始 WP5 代码开发；后续仍需先输出或确认 WP5 工程实施文档。
