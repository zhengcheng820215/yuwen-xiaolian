# Phase 17.5C1 轻量 Demo 接入与人工验收记录

日期：2026-07-26

状态：DEMO INTEGRATED / AUTOMATED + PAGE PRECHECK PASS / HUMAN ACCEPTANCE PASS

## 一、Demo 入口

`#/phase17-5c1-semantic-quality-demo`

本地完整地址：

`http://127.0.0.1:5174/#/phase17-5c1-semantic-quality-demo`

## 二、演示范围

Demo 使用正式 C1 Schema、Agent 与失败边界，轻量呈现四个案例：

1. 语义评估完整：七项语义发现均形成，可进入人工审核；
2. 语义警告保留：警告来源可见，结论为 `review_with_warnings`；
3. Provider 失败：结果为 `semantic_unavailable`，不猜测语义发现；
4. 超时安全退出：批准与冻结被阻断，返回修改或拒绝仍可执行。

Demo 不接入真实 Provider，不保存 Assessment，不形成 Frozen Trace，也不代替 17.5C2。

## 三、预验收结果

- C1 Demo Debug：`12 / 12 PASS`；
- C1 Runtime 回归：`18 / 18 PASS`；
- Production Build：PASS；
- 1280px 页面预检：无横向溢出；
- 四个案例切换、状态展示与动作边界：PASS；
- Provider 失败与超时分支均未生成伪造语义结论：PASS。

## 四、人工验收步骤

### Case 1：语义评估完整

预期：

- 显示 `7 / 7` 项语义发现；
- 总结为可以进入人工审核；
- 不自动形成审核通过或 Freeze。

### Case 2：语义警告保留

预期：

- 显示 `review_with_warnings`；
- 警告来源和限制可见；
- 人工仍可决定继续审核、返回修改或拒绝。

### Case 3：Provider 失败

预期：

- 显示 `semantic_unavailable`；
- 语义发现数量为 `0 / 7`；
- 批准和 Freeze 明确阻断；
- 页面不使用模板内容补齐缺失语义结论。

### Case 4：超时安全退出

预期：

- 批准和 Freeze 明确阻断；
- 返回修改与拒绝仍可用；
- 不因超时卡住审核流程。

## 五、人工验收结论

2026-07-26，用户完成四个案例的人工演示检查并明确确认：

> Phase 17.5C1 轻量 Demo 通过人工演示验收。Demo 证明独立语义质量评估及其失败边界能够被清晰展示并正确约束审核动作；它不代表 Assessment 已持久化，也不代表 Phase 17.5C 整体完成。

验收边界保持不变：

- 17.5C1 已完成工程 Debug、轻量 Demo 与人工演示验收；
- 17.5C2 Assessment Persistence and Frozen Traceability 尚未实现；
- 17.5C3 Batch Quality Summary and Ten-material Calibration 尚未实现；
- Phase 17.5C 整体仍不得标记为完成。
