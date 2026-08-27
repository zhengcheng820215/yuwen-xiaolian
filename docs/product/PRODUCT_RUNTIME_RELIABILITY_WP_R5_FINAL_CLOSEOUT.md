# WP-R5 最终收口说明

状态：`CLOSEOUT FROZEN / NARROW FIX READY`

## 1. 收口目标

WP-R5 的真实学习验收只观察当前已激活 Trial Window 内形成的学习事实。历史轮次继续只读保留，不得因为沿用旧的静态采集起点而进入当前代际报告。

## 2. 当前采集范围

- `current_collection` 优先使用当前激活 Trial Window 的 `startsAt` 作为范围起点；
- 只有 Trial 激活状态与 Trial Window 均可读取、且窗口状态为 `active` 时才采用该起点；
- 无有效 Trial Window 时回退到冻结的静态代际起点，保证历史环境和测试夹具兼容；
- Runtime Identity 的一致性继续由正式 Trial 准入链负责，本次修复不改写既有事件、答案、Evidence 或 Frozen Resource；
- `all_history` 仍保留全部历史事实，用于追溯，不作为当前 Trial 是否通过的依据。

## 3. 学习入口终态

当正式题组已完成且没有后续任务时，入口必须表达为“本轮学习已结束，暂时没有新的任务”，不得同时出现“任务已经准备好”或可开始操作。

未开始过学习、正式资源缺失、匹配不足等状态继续使用各自原因文案，不统一伪装成“已结束”。

## 4. 零写入边界

本次修改仅调整只读范围投射和入口文案：

- 不修改学生历史答案；
- 不补写或删除 Learning Event / Projection；
- 不修改正式题库和发布状态；
- 不重新激活 Trial；
- 不改变 Material → Plan → Task → Candidate → Publish → Learning 主链。

## 5. 验收

1. 当前 Trial 报告不再纳入 Trial Window 之前的轮次；
2. 全历史报告仍能看到旧轮次；
3. 无有效 Trial 时静态边界回退有效；
4. 完成整组后入口显示明确终态且无可点击开始按钮；
5. 既有学习入口、采集完整性与正式学习链回归通过。

## 6. Trial 内部验收与真实学生轮次分层

同一 Trial Window 内允许保留工程内部验收记录，但不得将其混入真实学生轮次的健康结论或真实样本分母。

- `real_learning`：真实学生在正式 Learning 入口中的自然作答轮次，参与当前完整性检查与真实样本统计；
- `internal_acceptance`：为验证运行时、恢复和页面链路形成的内部验收轮次，只读保留并单独展示；
- 当前 Trial 的历史兼容通过版本化来源策略按 Session 身份明确归类，不修改原 Checkpoint、Event、Projection 或学生作答；
- 未被明确标记为内部验收、且位于当前 Trial Window 内的新正式轮次默认按 `real_learning` 评价，避免静默漏数；
- `all_history` 保留全部轮次供追溯，`current_collection` 的健康结论只评价 `real_learning`；
- 内部验收失败不得投射成真实学生数据失败，也不得推动题目校准、能力画像或教育效果结论。

当前 Trial 的来源分层事实为：8 个窗口内轮次中，3 个内部验收轮次来自 2 个显式 Session，5 个轮次来自真实学生自然使用 Session。该分层仅改变只读统计投射，不写回业务数据。
