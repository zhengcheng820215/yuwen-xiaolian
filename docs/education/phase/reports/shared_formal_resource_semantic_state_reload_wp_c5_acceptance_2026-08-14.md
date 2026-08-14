# WP-C5 权威业务状态重载与续接验收报告

- 日期：2026-08-14
- 状态：PASS
- 优先级：P0
- 范围：同一 Observation Plan 下连续采用发布时的状态竞争、幂等续接和用户错误投影

## 一、问题与根因

同一材料的多张任务卡共享一个 Observation Plan。页面虽然已经通过命令队列串行执行正式写入，但后发命令仍使用点击时捕获的 `selectedPlan.status`。当前序命令已经把 Plan 从 `draft` 推进到 `reviewed` 后，后发命令仍可能再次提交 Plan，领域状态机因此正确拒绝并返回：`Material Observation Plan cannot be submitted from status: reviewed`。

这不是数据损坏，而是“写入已串行、业务判断仍陈旧”的应用编排缺口。

## 二、契约调整

1. 命令排队时只保留稳定身份，不把排队前的业务状态视为权威事实；
2. 命令取得执行权后，按 `materialObservationPlanId` 绕过缓存读取权威 Plan；
3. `reviewed` 跳过 Plan 阶段，`pending_review` 只审批，`draft / revision_required` 才提交并审批；
4. 提交或审批竞争失败后重读状态，目标阶段已完成则安全续接；
5. 缺失、身份不一致或不可续接状态以中文业务错误阻断；
6. 领域状态机继续严格拒绝非法转换，不用放宽不变量换取表面幂等。

## 三、工程实现

- 新增按 Plan ID 绕过缓存读取当前生产 Observation Plan 的接口；
- 采用发布命令在执行 Plan 状态转换前读取权威状态；
- 把 Plan 阶段改为可续接的状态驱动编排；
- 对提交和审批的并发竞争增加失败后权威重读；
- 保留页面命令队列、共享存储并发保护和后续正式发布链路不变。

## 四、自动化验收

| 验收项 | 结果 |
| --- | --- |
| Material Resource Production Commands | 13/13 PASS |
| Formal Resource Command Queue | 5/5 PASS |
| Task Production State | PASS |
| Candidate Workbench P6 | PASS |
| Unified Resource Production P0-P7 Final Integration | 26/26 PASS |
| Material Question Review Submission | 6/6 PASS |
| Material Resource Workbench State | 20/20 PASS |
| Question Candidate Workbench P4 | 16/16 PASS |
| Production Vite Build | PASS |

新增用例覆盖：页面状态陈旧但权威状态已为 `reviewed`、提交竞争后权威状态已完成、同一 Plan 两个发布命令顺序执行且 Plan 只提交审批一次，以及不可续接状态的中文阻断。

## 五、验收边界

本轮没有修改真实材料、题目、Formal Resource 或 Registry 数据，也没有通过浏览器执行真实发布。验收基于命令级、状态级、集成级自动化测试和生产构建；真实工作台仍应补做一次同一材料两张任务卡连续发布的人工 Smoke，确认页面不再出现底层英文错误且两张卡均正确刷新。

## 六、结论

WP-C5 P0 修复通过工程验收。连续发布不再依赖排队前的陈旧 Plan 状态，已完成阶段可以安全续接，领域状态机的严格性保持不变。
