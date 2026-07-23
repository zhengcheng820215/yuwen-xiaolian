# Phase 17.3 Controlled DeepSeek Live 验收记录

日期：2026-07-23

结论：`3 / 3 PASS`

## 一、验收目标

使用 Work Package B 已冻结的 Training、Retest、Transfer 三条样例，验证正式资源来源能够进入真实 DeepSeek Diagnosis Runtime，并继续形成可追溯的 Formal Diagnosis 与 AbilityEvidence。

本次只验证真实 Provider 串联，不替代 `/learning` 人工 Demo、完整 24—28 道资源包或 Phase 17 最终验收。

## 二、执行边界

- Provider：`deepseek_chat`；
- Model：`deepseek-v4-flash`；
- Prompt：`real_ai_diagnosis_prompt_v4`；
- Temperature：`0.2`；
- 单样例最大尝试：`2`；
- 总 Provider 调用预算：`6`；
- Credential 来源：受控 macOS Keychain；
- 正式副作用：隔离的 In-Memory Repository 镜像；
- 浏览器 IndexedDB：未修改；
- 日志不记录 API Key、完整 Prompt、学生完整答案或 Raw Model Output。

隔离镜像先按既有 Review、Freeze、Registry 与 Observation Link 流程重建 Batch A，再建立与浏览器 Current Head 身份一致的 `v2` 样例。该方式验证真实 Provider 和完整正式链路，同时避免验收运行污染浏览器中的正式学习数据。

## 三、样例结果

| 角色 | Resource Version | Ability | Runtime | Formalization | Answer Status | Evidence | Trace | Calls | Attempts | Latency | Tokens |
| --- | --- | --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: |
| Training | `phase17-batch-a-resource-station-analysis-training:v2` | analysis | `formal_result_committed` | `committed` | `fully_meets` | 1 | PASS | 1 | 1 | 2654 ms | 2699 |
| Retest | `phase17-batch-a-resource-riverbank-inference-retest:v2` | inference | `formal_result_committed` | `committed` | `fully_meets` | 1 | PASS | 1 | 1 | 3175 ms | 2732 |
| Transfer | `phase17-batch-a-resource-riverbank-analysis-transfer:v2` | analysis | `formal_result_committed` | `committed` | `fully_meets` | 1 | PASS | 1 | 1 | 2779 ms | 2818 |

聚合结果：

- 样例：`3 / 3 PASS`；
- Provider 调用：`3 / 6`；
- 总尝试：`3 / 6`；
- 重试：`0`；
- 总耗时：`8608 ms`；
- Input Tokens：`7512`；
- Output Tokens：`737`；
- Total Tokens：`8249`。

## 四、关键验收事实

三条样例均满足：

1. Formal Resource Source Resolver 返回 `ready`；
2. Frozen Resource 的 Ability 与 TaskRole 未被默认值覆盖；
3. Answer Validity 通过后才调用 Provider；
4. DeepSeek 输出通过 Schema、Identity 与 Boundary Validation；
5. Formal Diagnosis 完成 Commit；
6. 每条正式结果仅形成 1 条 AbilityEvidence；
7. Material、Observation、Question、Diagnosis 与 Evidence Trace 全部通过；
8. 使用同一 `requestId` 重放时复用已提交结果，不增加 Provider 调用；
9. 未使用 mock Diagnosis 回退。

## 五、调用后回归

- Phase 17.3 Batch A Integration：`17 / 17 PASS`；
- Phase 17.2 Batch A：`14 / 14 PASS`；
- Production Build：`PASS`。

Build 仅保留既有 bundle size 与 dynamic import 非阻断警告。

## 六、准确状态

允许宣称：

> Phase 17.3 Work Package B Controlled DeepSeek Live 已通过。Training、Retest 与 Transfer 三条固定正式资源镜像均能经真实 DeepSeek 完成 Formal Diagnosis Commit、Evidence Return、来源追溯和幂等复用。

仍不能宣称：

- 浏览器正式 IndexedDB 已写入本次 Live 结果；
- `/learning` Batch A 人工 Demo 已完成；
- 完整 24—28 道首批资源包已完成；
- Phase 17.3 或 Phase 17 已最终冻结；
- 单次 Live 可以证明长期教育效果。
