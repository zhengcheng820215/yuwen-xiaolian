# Phase 16.3A Lightweight Demo Acceptance

验收日期：2026-07-21

验收状态：`PASS`

验收入口：

```text
/#/phase16-3-real-chain-demo
```

## 一、验收范围

本次人工验收验证 Phase 16.3A Orchestrator 的轻量浏览器联调入口，使用 Scripted Provider 和正式冻结资源样例，不调用 DeepSeek Live。

验收重点是：

- 正常链路能从 Frozen Resource、学生作答进入 Diagnosis、Evidence、GrowthMemory 和下一正式任务；
- 无效作答、Diagnosis 复核和下一资源能力错位能够停在正确位置；
- 同一答案重复提交不会重复调用 Provider 或生成第二份 Evidence；
- 学生任务与反馈区域不暴露内部 Runtime 字段；
- PC 与平板布局可用于人工操作。

## 二、人工验收结果

| Case | 预期 | 结果 |
| --- | --- | --- |
| 正常完整回流 | Provider 调用 1 次、Evidence 1 条，并展示另一条 Frozen Resource 的下一任务 | PASS |
| 重复提交同一答案 | 显示“已复用正式结果”，Provider 与 Evidence 数量不增加 | PASS |
| 无效作答阻断 | Provider 调用 0 次、Evidence 0 条，并提示补充回答 | PASS |
| Diagnosis 进入复核 | `review_required`，不生成 Evidence，不展示未经确认的能力结论 | PASS |
| 下一资源能力错位 | 本轮正式结果保留，下一任务 `no_match`，错误资源不进入学生题目区 | PASS |
| 信息隔离 | 学生区不展示内部 ID、Schema、Prompt 或 Raw Output | PASS |
| PC / 平板体验 | PC 与 1024×768 平板视口无明显遮挡或横向溢出 | PASS |

## 三、工程复核

- Phase 16.3A Deterministic Debug：`14 / 14 PASS`；
- Demo API 四类分支运行结果符合预期；
- 重复提交验证：Provider 保持 `1` 次，Evidence 保持 `1` 条；
- 浏览器控制台：无错误；
- Production Build：PASS。

## 四、能力边界

本次验收可以证明：

> Phase 16.3A 的轻量浏览器入口能够正确呈现正常、阻断、复核、资源缺口和幂等分支。

本次验收不能证明：

- DeepSeek 对不同真实答案的 Diagnosis 和反馈质量；
- 受控真实 Provider 在同一持久化产品链中的完整串联；
- Phase 16.3B 统一学生入口已经完成；
- Phase 16.3C 5—7 个自然日真实运行已经完成；
- 教学策略有效或学生能力长期提升。

因此当前正式状态为：

```text
Phase 16.3A Engineering / Debug: PASS
Phase 16.3A Lightweight Demo Acceptance: PASS
Phase 16.3A Controlled Real Provider Integration: PASS (subsequent acceptance)
Phase 16.3A Overall: PASS / FROZEN
```

后续状态：同日 [Controlled Real Provider Integration](./phase16_3a_controlled_real_provider_acceptance_2026-07-21.md) 已取得 `11 / 11 PASS`，Phase 16.3A Overall 更新为 `PASS / FROZEN`。
