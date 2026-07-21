# Phase 16.3C Engineering Preflight（2026-07-21）

状态：`PASS / APPLICATION BOUNDARY LIVE PASS / NATURAL-DAY ACCEPTANCE PENDING`

## 本次完成

- 新增服务端 `Phase 16.3 Diagnosis Application Boundary`，DeepSeek Key 只从服务端环境读取；浏览器只提交冻结的 Runtime 输入，不持有 Key、完整 Prompt 或 Raw Output；
- `/learning` 已从旧连续学习 Mock 工作台切换为正式资源、正式 Repository 与 Phase 16.3 Orchestrator；
- 正式 Checkpoint、Learning Persistence、Session History 和多日运行记录均使用 IndexedDB Repository；页面不直接操作存储；
- 无效作答在 Diagnosis 前阻断，并允许学生原地补充，不占用不可变的正式 Operation；
- 正式资源池新增两条 `training` 与一条 `retest` Frozen Resource；每条都经过录入、校验、审核、冻结与匹配，Learning Runtime 不再通过复制或改写 Frozen Version 的 `taskRole` 伪造复测任务；
- 当前任务与下一任务均按 `targetAbilityId + taskRole` 精确消费正式资源；无对应角色资源时返回 `no_match / blocked`，不得使用角色错位资源凑匹配；
- 草稿保存、刷新后入口恢复、重新进入工作台恢复原文已通过浏览器 Smoke；
- 新增自然日运行事实与工程模拟严格分离的 Multi-day Runtime；
- 内部复核入口新增自然日、Session、Round、正式资源、Evidence、复测、恢复和异常计数，不展示学生答案原文或敏感 Runtime 内容。

## 自动化结果

- Phase 16.3C Multi-day Engineering Simulation：`10 / 10 PASS`；
- Phase 16.3 Day 0 Integration：`11 / 11 PASS`；
- Phase 16.3A Real Learning Chain：`14 / 14 PASS`；
- Phase 16.3B Unified Entry：`14 / 14 PASS`；
- Phase 12 Integration：`9 / 9 PASS`；
- Phase 13.1 / 13.2 / 13.3：`15 / 15`、`13 / 13`、`18 / 18 PASS`；
- Phase 14 Integration：`16 / 16 PASS`；
- Phase 15 Integration：`11 / 11 PASS`；
- Phase 16.1 -> 16.2 Integration：`5 / 5 PASS`；
- Phase 16.3 Formal Resource Pool：`2 training + 1 retest`，Version / ExecutableTask 角色一致；
- Production Build：`PASS`。

## 浏览器 Smoke

在 `/learning` 验证：

1. 统一入口能够创建正式 Learning Session 并打开 Frozen Resource；
2. 页面展示正式阅读材料、题目和能力目标，不暴露 Runtime 字段；
3. 答案草稿保存后，刷新页面回到“继续上次的回答”，重新进入后原文完整恢复；
4. “不知道”等占位回答原地提示补充，不进入 Diagnosis；
5. Console 未出现 Error / Warning；
6. `/internal/learning-review` 能显示自然日运行进度，当前明确为 `0 / 5`，不会把工程模拟计入自然日。

浏览器 Smoke 期间发现并修复了 Learning Persistence 草稿 `recordId` 与 Repository `loadByRound` 主键不一致的问题。

最终协议审计同时发现并修复了复测分支改写 Frozen Resource `taskRole` 的问题。修复后，复测只能消费正式审核冻结的 `retest` 资源；Phase 16.1 -> 16.2、Day 0、多日模拟和 Production Build 再次通过。

## 未完成与边界

- 5–7 个自然日真实运行尚未开始，因此 Phase 16.3C 尚未 PASS / FROZEN；
- 新增 Application Boundary Controlled Live Smoke 已于同日完成并通过；详细记录见 [Phase 16.3C Application Boundary Controlled Live Smoke](./phase16_3c_application_boundary_live_smoke_2026-07-21.md)；
- 多日工程模拟使用注入时间，只证明 Runtime、恢复、复测、异常与幂等规则，不证明真实时间经过；
- 当前仍是单学生、单浏览器、本地 IndexedDB MVP，不证明跨设备、跨标签页原子性或长期教学效果。

## 下一步

1. 从 `/learning` 开始 5–7 个自然日真实运行；
2. 每日通过 `/internal/learning-review` 检查正式事实和异常，不记录敏感原文；
3. 达到最低事实量后运行冻结回归、Production Build 和人工历史回放；
4. 再决定 Phase 16.3C 与 Phase 16 是否可以冻结。
