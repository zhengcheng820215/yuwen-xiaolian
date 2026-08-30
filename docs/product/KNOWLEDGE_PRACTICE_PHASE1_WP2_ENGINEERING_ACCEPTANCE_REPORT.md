# 知识练习第一阶段 WP2 工程验收报告

状态：`ENGINEERING PASS`

版本：`knowledge_practice_phase1_wp2_engineering_acceptance_v1.0`

日期：`2026-08-28`

实施依据：[`KNOWLEDGE_PRACTICE_PHASE1_WP2_SESSION_AND_SELECTION_PLAN.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP2_SESSION_AND_SELECTION_PLAN.md)

## 一、验收结论

WP2“练习会话与选题”已达到工程通过标准。知识练习页面不再自行随机、切片或按 URL 临时拼装题目，而是创建稳定的 `PracticeSession`，由 Quiz 按冻结后的 queue 消费。

本结论仅代表 WP2 工程验收通过，不代表第一阶段整体完成，也不代表 Product Acceptance 或 Live。

## 二、已交付能力

- 建立 Session v1、Queue Item、Selection Summary、完成历史和领域错误契约；
- 建立 Session 校验器以及不可变的 answered、advance、abandon 状态变化；
- 建立稳定 ID、seed、FNV-1a 哈希、可复现 PRNG 和洗牌；
- 专项默认取 5 题，候选不足时返回实际数量且不重复；
- 综合默认取 10 题，实现分类覆盖、40% 上限、40/40/20 难度目标与固定降级；
- 实现 Question ID 去重、variantGroup 排重及最后放宽；
- 实现最近两个 completed Session 的分层复用顺序；
- Session 冻结题目 ID、顺序和内容版本，并可 JSON 序列化；
- KnowledgePractice 负责显式创建 Session，Quiz 只消费 Session queue；
- 入口展示实际题量、预计时长和综合分类覆盖说明。

## 三、自动化证据

| 检查 | 结果 |
| --- | --- |
| WP2 seed、专项、综合、近期降权、构建、状态和序列化 | `47 / 47 PASS` |
| WP1 回归 | `47 / 47 PASS` |
| 题库数据门禁 | `27 migrated / 12 approved / 15 draft / 0 error / 0 warning` |
| Vite 生产构建 | `PASS`，582 modules transformed |
| `git diff --check` | `PASS`；仅 Git 行尾提示，无空白错误 |

WP2 页面验收首次发现默认 Session ID 中 ISO 时间保留大写 `T/Z`，与小写 ID 契约冲突。实现已统一转为小写，并新增 `WP2-SD07` 回归用例。

## 四、浏览器验收证据

在本地 Vite 页面完成以下真实交互：

| 场景 | 结果 |
| --- | --- |
| 知识练习入口 | 综合显示 10 题、覆盖说明和预计时长；分类显示实际题量和预计时长 |
| 字音字形专项 | 当前 3 道 approved，创建 `1 / 3` Session |
| 逐题推进 | 作答后展示正确答案、知识点和解析；点击下一题进入 `2 / 3` |
| 综合练习 | 当前 12 道 approved 中创建 `1 / 10` Session，不再加载全部 12 道 |
| 单题完整闭环 | 成语运用 `1 / 1` 作答后进入结果页，结果为 `1/1`、`100%` |
| 再练一次 | 从结果页创建新的 10 题综合 Session |
| 正式学习页烟测 | `/learning` 可进入并呈现既有受控状态，无新增控制台错误 |
| 控制台 | `0 error / 0 warning` |

## 五、代码交付位置

- `src/domain/knowledge-practice/practice/`：Session、seed、选题、构建、状态和校验领域逻辑；
- `src/context/PracticeSessionContext.jsx`：当前内存 Session 与最近完成摘要装配；
- `src/pages/KnowledgePractice.jsx`：入口展示和 Session 创建；
- `src/pages/Quiz.jsx`：按 Session queue 作答与推进；
- `src/ai/tests/runKnowledgePracticeWP2Debug.ts`：WP2 自动化验收入口。

## 六、已知限制与后续边界

1. Session 当前仅在 React 内存中；刷新、关闭页面后的恢复由 WP4 实现，因此 WP2 只承诺同一挂载会话内重渲染稳定和数据可序列化。
2. WP2 暂沿用既有答题记录与结果页；幂等 `PracticeResponse`、选项级错因和严格反馈由 WP3 实现。
3. 当前只有 12 道 approved，连续 10 题综合练习不可避免出现必要重复；算法只承诺按最近两轮降权。
4. 当前没有难度 3 approved 题，运行时记录 `difficulty_quota_relaxed`，不伪造难度。
5. 当前没有经审核的 `variantGroupId`，真实数据不会触发组排重；该能力已由测试 Fixture 验证。
6. 内容目标仍为 100 道 approved，当前缺口 88 道。

## 七、交接结论

WP2 向 WP3 交付稳定的 Session、当前 Queue Item、Question ID/内容版本以及 answered/advance 命令边界。下一工作包应实现幂等响应、精确判题和逐题反馈，不得重新改写 WP2 已冻结的基础题集合与顺序。
