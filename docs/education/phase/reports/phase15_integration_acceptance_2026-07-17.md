# Phase 15：整链集成 Debug 验收记录（Integration Debug Acceptance）

验收日期：2026-07-17

验收结论：PASS

## 验收目标

验证 Phase 15 已冻结的子 Runtime 能否通过既有正式接口组成同一条产品链，而不是只分别通过专项测试：

```text
TaskExecution Validity Gate
-> Scripted LLM Provider
-> Formal Diagnosis Commit
-> Phase 9.3 Evidence Return
-> Phase 8 Evaluation / ProfileUpdateDecision / GrowthMemory
-> Phase 14.1 Evidence Quality Assessment
-> Controlled Feedback
```

本次使用脚本化 Provider 形成可重复、无外部费用的确定性集成验收；不把它表述为真实外部 Provider 的完整端到端验收。

## 执行命令

```bash
pnpm run debug:phase15-integration
```

## 验收结果

结果：`11 / 11 PASS`

已验证：

1. 合法作答可形成唯一 Formal Diagnosis Commit，并进入 Existing Evidence Return；
2. Evidence Return 首次失败不会破坏后续重试；
3. 回流继续复用 Phase 8 的 EvaluationResult、ProfileUpdateDecision 与 GrowthMemoryRecord；
4. 同一正式输入重复回流保持同一 Evidence 身份；
5. Phase 14.1 能消费新回流 Evidence 并形成 EvidenceQualityAssessment；
6. Controlled Feedback 具有正式来源链接并保持幂等；
7. 表达 Provider 失败时回退确定性模板，不改变正式教育事实；
8. 重复 Diagnosis requestId 复用已有 Commit，不重复调用 Provider；
9. Evidence 可以继续追溯到 Evaluation 与 GrowthMemory；
10. 无效作答在 Provider 调用前阻断，不生成 Evidence；
11. Diagnosis 能力错位进入 review_required，不进入 Evidence Return。

## 回归结果

- `debug:real-llm-runtime-foundation`：`22 / 22 PASS`
- `debug:controlled-feedback-expression`：`24 / 24 PASS`
- `debug:phase14-integration`：`16 / 16 PASS`
- `debug:phase9-3`：PASS
- `pnpm run build`：PASS

Build 仍存在既有的大 Chunk 提示，不影响本次验收结论。

## 当前边界

本次已经证明确定性整链组合、失败阻断、重试恢复、幂等和安全回退成立。

本次没有执行：

- 真实外部 Provider 贯穿整条产品链的单次端到端调用；
- Prompt v4 成为所有正式 Provider 调用默认版本的切换与回滚；
- 真实学生长期学习效果验证。

因此当前准确结论是：

> Phase 15 已具备可重复运行的独立整链 Debug 验收；真实外部 Provider 的完整产品主链仍需在受控环境中单独试跑。

## 轻量 Demo 人工验收

验收日期：2026-07-17

验收入口：`#/phase15-integration-demo`

验收结论：PASS

已人工确认以下场景：

1. 完整成功链路：Diagnosis、Ability Evidence、Evaluation 与 Student Feedback 均按正式链路形成；
2. 无效作答阻断：LLM Provider 未调用，正式 Diagnosis 与 Evidence 未生成，Student Feedback 被阻断；
3. 能力错位复核：任务目标能力为“推理”，错位 Diagnosis 进入复核，不形成正式 Evidence 与 Evaluation；
4. 反馈安全回退：正式 Diagnosis、Evidence 与 Evaluation 已形成，仅表达层回退到 `deterministic_template`，不改变已确认教育事实。

页面中的“真实 LLM 接入”区域用于展示已经完成的 Live Smoke 接入记录与安全边界，不代表浏览器在本次 Demo 中直接调用外部 Provider。
