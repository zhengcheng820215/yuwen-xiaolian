# Phase 17.3 Work Package B 前置验收记录

日期：2026-07-23

结论：`PREFLIGHT PASS / CONTROLLED LIVE READY`

## 一、正式 Repository 对账

本次在浏览器正式 IndexedDB Repository 中执行，而非内存夹具：

- Batch A Active Registry Head：`8 / 8`；
- Active ResourceObservationLink：`8 / 8`；
- Runtime 所需 `hint_policy` 与 `material_relation` 声明：`8 / 8`；
- Registry 一致性：`PASS`。

原有 8 个 `v1` 正式资源缺少 Phase 17.3 Runtime 声明。本次通过受控新版本流程形成 8 个 `v2`：

```text
Current v1
-> New Version Draft
-> Validation
-> Explicit Review
-> Freeze v2
-> Registry Head -> v2
-> Active Observation Link -> v2
-> v1 superseded
```

题目、Rubric、Answer Acceptance、Ability、TaskRole 和 Material 均未改变。再次运行前置检查返回“无需升级”，幂等通过；中途存在合法升级 Draft 时可继续恢复，不静默覆盖正式版本。

## 二、受控 Live 样例

固定以下三条样例，不在 Live 时临时换题：

| 角色 | Resource Version | Ability | 提示声明 | 材料关系 |
| --- | --- | --- | --- | --- |
| Training | `phase17-batch-a-resource-station-analysis-training:v2` | analysis | `limited_hint` | `same_context` |
| Retest | `phase17-batch-a-resource-riverbank-inference-retest:v2` | inference | `no_hint` | `new_context` |
| Transfer | `phase17-batch-a-resource-riverbank-analysis-transfer:v2` | analysis | `limited_hint` | `new_context` |

三条样例均为 Registry Current Head，并拥有指向当前版本的 Active ResourceObservationLink。

## 三、Provider 与预算

- Provider：`deepseek_chat`；
- Model：`deepseek-v4-flash`；
- Prompt：Existing Prompt v4；
- Temperature：`0.2`；
- 单次最大输出：`1600 tokens`；
- 单次超时：`30 秒`；
- 单样例最大尝试：`2`；
- 三样例理论最大 Provider 尝试：`6`；
- 已 Commit 的同一 requestId 不得再次调用 Provider；
- 任一身份错位、结构失败或关键边界失败时停止该样例，不用 mock 结果替代。

工作台服务状态为 `DeepSeek 已就绪 · deepseek-v4-flash`。Material Generator 与 Diagnosis Application Boundary 使用同一受控 Credential Resolver；Key 不进入浏览器、Git、报告或完整日志。

## 四、回归

- Phase 17.3 Batch A Integration：`17 / 17 PASS`；
- Phase 17.2 Batch A：`14 / 14 PASS`；
- Phase 16.1 -> 16.2 Integration：`5 / 5 PASS`；
- Production Build：`PASS`。

Build 仅保留既有 bundle size 与 dynamic import 非阻断警告。

## 五、准确状态

本次未调用真实 DeepSeek，不产生新的 Diagnosis、Evidence、Profile 或 GrowthMemory。

允许宣称：

> Phase 17.3 Work Package B 的正式资源、来源声明、Live 样例、Provider 配置和调用预算已经完成前置验收，可以执行受控 DeepSeek Live。

不能宣称：

- Work Package B Live 已通过；
- `/learning` 人工验收已完成；
- Phase 17.3 最终产品 PASS；
- 完整 24—28 道首批资源包已完成。
