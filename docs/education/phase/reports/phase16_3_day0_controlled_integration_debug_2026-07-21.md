# Phase 16.3 Day 0 Controlled Integration Debug Acceptance

日期：2026-07-21  
状态：`DETERMINISTIC INTEGRATION PASS`  
范围：统一学生入口状态与 Phase 16.3A 正式 Orchestrator 的受控技术准入  
Provider：Scripted deterministic adapter；本轮未重新调用 DeepSeek Live

## 一、验收目的

在开始 Phase 16.3C 的自然日真实使用前，验证统一入口所表达的学生状态与正式学习主链能够使用同一份运行事实闭合，并确认恢复、重复提交和异常分支不会产生第二份 Diagnosis、Evidence 或长期状态更新。

本次不是人工 Demo，也不替代 5—7 个自然日真实运行。

## 二、正式串联范围

```text
Unified Learning Entry
-> Frozen Resource / Quality-gated Task
-> Student Response Validity
-> Formal Diagnosis Commit
-> AbilityEvidence
-> Existing Evaluation / Profile / GrowthMemory
-> Persistence Checkpoint
-> NextLearningStrategy / TaskRequest
-> Next Frozen Resource
-> Unified Learning Entry State
```

浏览器不直接持有 Provider Key，也不消费 Raw Model Output。

## 三、确定性结果

新增命令：

```bash
pnpm run debug:phase16-3-day0-integration
```

结果：`11 / 11 PASS`

1. 统一入口可以启动正式任务；
2. 正式作答完成 Diagnosis、Evidence、Profile 与 GrowthMemory 回流；
3. 下一任务由正式结果驱动并使用另一条 Frozen Resource；
4. 正式完成结果能够映射为统一入口反馈状态；
5. 重复提交复用正式结果，Provider 只调用一次，持久化记录只写入一次；
6. Repository 重建后从 Checkpoint 恢复，不重新执行 Diagnosis；
7. 无效答案在 Provider 前阻断并返回原题修改；
8. Provider 失败不生成 Mock Diagnosis、Evidence 或 Profile 更新；
9. questionable Diagnosis 进入人工复核，不污染正式数据；
10. 能力错位资源不用于凑匹配，已完成结果仍保持保存；
11. 学生入口不暴露 Runtime、Prompt、Provider 或内部追溯 ID。

## 四、冻结回归

- Phase 16.3A Real Learning Chain Debug：`14 / 14 PASS`；
- Phase 16.3B Unified Learning Entry Debug：`14 / 14 PASS`；
- Production Build：`PASS`。

Build 仍存在单个 bundle 大于 500 kB 的非阻断警告，本次未扩大处理范围。

## 五、真实 Provider 状态

Phase 16.3A 既有受控 DeepSeek 串联验收仍为 `11 / 11 PASS`，详见 [Phase 16.3A Controlled Real Provider Integration Acceptance](./phase16_3a_controlled_real_provider_acceptance_2026-07-21.md)。

本轮尝试重新运行同一受控 Live Smoke 时，执行环境因“将仓库测试内容发送至外部服务”的安全策略拒绝调用。未尝试绕过，也未将其记录为本轮 Live PASS。该拒绝不改变既有验收事实，但说明 Phase 16.3C 的真实 Provider 调用必须继续位于明确授权、可脱敏和服务端受控的 Application Boundary 内。

## 六、结论与边界

> 统一入口状态与正式 Orchestrator 的确定性串联已经通过 Day 0 技术准入；幂等恢复、无效作答、Provider 失败、人工复核和资源错位均能在正确边界停止，不会静默回退到 Mock Diagnosis 或污染正式数据。

当前可以进入 Phase 16.3C 工程准备，但在开始真实 5—7 日使用前仍必须确认：

1. 浏览器通过正式 Application Boundary 调用受控 Runtime，而不是直接调用 Provider；
2. Provider Key 仅存在于服务端或受控执行环境；
3. 页面刷新后的状态查询来自正式 Repository；
4. 真实数据已获得明确授权并完成必要脱敏；
5. 自然日运行记录不能由时间模拟 Debug 替代。

