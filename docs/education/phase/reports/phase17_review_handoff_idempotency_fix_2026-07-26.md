# Phase 17 训练任务到题目审核交接修复记录

日期：2026-07-26

结论：`FIXED / AUTOMATED DEBUG PASS / BROWSER VERIFIED`

## 问题

在素材资源录入平台点击“确认训练任务并进入题目审核”后，页面无法稳定进入题目审核与发布平台。

实际链路连续暴露了三个相互关联的幂等问题：

1. 同一 Observation Plan Revision 在预览校验与提交审核时重复生成 Validation，触发不可变记录冲突；
2. Observation Plan 从 `draft` 进入 `pending_review` 时，内容 Revision 没有变化，但 Shared Store 将合法的生命周期变化误判为 Revision 冲突；
3. 审核页在开发环境重复加载同一 Draft 时，并发生成身份相同、时间不同的 Question Quality Assessment，触发不可变评估冲突。

## 修复

- 同一 Observation Plan Revision 复用既有 Validation；
- Local API Repository 允许同一内容 Revision 的合法生命周期字段变化，同时继续阻断同 Revision 下的内容静默修改；
- 同一 Question Draft Revision 复用既有结构校验；
- Question Quality Assessment Repository 将仅 `assessedAt` 不同的重复写入视为同一幂等请求，保留第一次正式评估；检查结果、Decision 或 Warning 不同仍然阻断。

## 保持的边界

- 没有降低 Validation、Review、Quality Assessment 或 Freeze 标准；
- 没有允许同 Revision 静默修改 Plan 或 Question 内容；
- 没有自动审核或自动发布题目；
- 没有覆盖已有不可变 Validation、Assessment、Review 或 Frozen Resource；
- 修复只消除重复点击、页面恢复和并发加载产生的伪冲突。

## 自动化验收

```text
Question Resource Admission                 23 / 23 PASS
Material Observation                        27 / 27 PASS
Phase 17.4A Shared Resource Persistence      10 / 10 PASS
Question Quality Assessment                  12 / 12 PASS
Material Resource Production                 13 / 13 PASS
Production Build                                  PASS
```

新增回归重点：

- 同一 Draft Revision 重复执行结构校验时复用原 Validation；
- 预览校验后提交 Observation Plan 时复用原 Validation；
- Plan 生命周期变化保持内容 Revision，不被误判为内容冲突；
- 并发加载同一 Draft 时，质量评估只保留一个正式对象；
- 实质不同的同身份评估仍然触发不可变冲突。

## 浏览器验收

真实入口：

```text
#/material-resource-workbench
```

操作：

```text
确认训练任务并进入题目审核
```

结果：

- 正常进入 `#/question-resource-workbench?mode=plan-review...`；
- 页面标题为“题目审核与发布平台”；
- 当前批次 3 道题正常加载；
- 待处理数量为 3；
- 页面不再显示 Validation、Plan Revision 或 Question Quality Assessment 不可变冲突。

## 当前准确状态

> 素材录入、训练任务确认与题目审核交接链路已经恢复可用；重复点击、页面恢复和开发环境并发加载不会再制造身份相同但内容无效漂移的正式对象。

