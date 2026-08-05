# Phase 17 真实数据长流程验收报告

日期：2026-08-05

结论：`ACCEPTED / THREE REGRESSION CATEGORIES PASS / REAL PUBLICATION AND LEARNING FLOW CONNECTED`

## 一、验收范围

本轮在现有本地数据和真实页面上验证三类高风险链路：

1. 历史数据与任务血缘兼容；
2. 部分失败、幂等重试与版本不重复；
3. 已发布资源与未采用 AI Candidate 隔离。

同时完成一条真实长流程：

```text
素材保存
-> AI 生成候选
-> 采用候选
-> 保存任务组
-> 题目检查
-> 最终确认
-> 正式发布
-> 学习入口匹配
-> 启动学习任务
```

## 二、真实页面结果

- 新建素材：`《真实链路验收素材20260805》`；
- 素材版本：`material-b313891f-593:v1`；
- 候选生成、采用和任务组保存成功，共形成 3 个训练任务；
- 任务 1 完成检查、最终确认和正式发布；
- 正式版本：`resource-observation-task-plan-2k0qkl:v1`；
- Formal Version 状态为 `frozen`，Registry Entry 状态为 `active`；
- 学习入口恢复为“可以开始”，点击后成功加载正式材料、题目、作答框及提交动作。

未采用 Candidate 未创建 Question Revision、Formal Version 或 Registry Entry。

## 三、验收中发现并修复的问题

### 1. 初次候选数量与生产计划边界不一致

真实 AI 首次返回 2 个候选，但生产计划仍要求 3 至 6 个任务，导致采用后无法保存。

修复后：

- 新生产计划接受 2 至 6 个任务；
- 1 个和 7 个任务继续阻断；
- 保留历史 6 任务数据兼容；
- 补充边界自动化回归。

### 2. 发布元数据与学习匹配约束不一致

学习入口要求 Training 资源支持 `hint_policy:limited_hint`，但工作台发布链此前未写入提示策略，导致已冻结、已注册资源被质量门判定为 `partial_match`。

修复后：

- 新建生产 Draft 按任务角色写入提示策略；
- Retest 写入 `hint_policy:no_hint`；
- 其他任务角色写入 `hint_policy:limited_hint`；
- 历史正式资源缺少该标签时，仅在学习匹配投影中按任务角色补默认能力；
- 不改写历史 Frozen Version，保持正式资源不可变；
- 显式声明的提示策略始终优先，不被兼容逻辑覆盖。

## 四、自动化证据

```text
debug:phase17-3-learning-entry        11 / 11 PASS
debug:resource-match-quality          16 / 16 PASS
debug:material-resource-production    16 / 16 PASS
debug:unified-resource-production-final 18 / 18 SUITES PASS
Vite production build                PASS
```

统一串联回归继续证明：Draft、Assessment、Human Review、Formal Version 和 Registry 没有重复写入，失败恢复不回滚已完成阶段。

## 五、放行结论

三类回归和真实数据长流程均通过。统一资源生产工作台能够把 AI Candidate 安全转为独立 Question Revision，完成检查、确认和发布，并由学习入口消费正式资源。

构建仍保留既有的动态导入与主 Bundle 体积提示；两项均为非阻断性能优化，不影响本次数据链与生命周期放行。
