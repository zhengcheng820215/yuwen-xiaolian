# Phase 17.3 Batch A 正式资源串联 Debug 验收记录

日期：2026-07-23

验收范围：Phase 17.3 Work Package A

结论：`PASS`

## 一、验收对象

本次使用 Phase 17.2 Batch A 的正式资源进行隔离串联：

- 2 个已审核 Material；
- 8 道 Reviewed / Frozen / Registered / active-linked Resource；
- 4 项 Ability；
- 1 条 Training -> Retest；
- 1 条 Training -> Transfer；
- 16 组答案边界 Fixture。

本次不调用真实 DeepSeek，不写浏览器正式 Repository，不替代 Work Package B 的受控 Live。

## 二、实现内容

新增只读 Formal Resource Source Resolver，统一核对：

```text
Frozen Current Resource
+ Registry Current Head
+ immutable Material Version / frozen Material Snapshot
+ active ResourceObservationLink
+ reviewed MaterialObservationPlan / Material Structure contentHash
+ ObservationTaskPlan / Source Anchor contentHash
-> FormalResourceRuntimeSourceContext
```

该上下文只保留正式来源和运行追溯，不修改 `Diagnosis`、`AbilityEvidence`、`Profile`、`GrowthMemory` 或 `Strategy` Schema。Material 正式身份补强复用既有 `materialSnapshot`、Structure 与 Anchor，不新增 Material Schema：

- 同一 `materialVersionId` 不允许用不同内容覆盖；
- 新 Material Version 与历史 Material Version 并存；
- 历史 Response、Diagnosis 与 Evidence 继续保留执行时 `materialVersionId + materialContentHash`；
- Material 缺失、版本错位、Structure 过期或 Anchor 内容失效时不生成正式 Source Context。

Batch A 正式资源同步声明任务可支持的提示策略：

- Training / Transfer：`limited_hint`；
- Retest：`no_hint`。

匹配仍复用 Existing Phase 16.2 Resource Matching Quality，不新增第二套选择器。

## 三、专项结果

Phase 17.3 Batch A 专项：`17 / 17 PASS`

已验证：

1. 正式 Training 进入 Diagnosis / Evidence，Resource Version 与来源不变；
2. Retest 排除原题并匹配新材料；
3. Transfer 保持 Ability 并使用独立 Material Cluster；
4. Ability 错位不凑匹配；
5. Retest 缺失不降级成 Training；
6. Difficulty 保留正式资源声明；
7. Observation Plan、Dimension 与 Source Anchor 可追溯；
8. 非 Registry Current Head 被阻断；
9. 重复提交复用 Formal Diagnosis 与 Evidence；
10. 资源补齐后只重跑匹配；
11. Diagnosis Ability 错位不生成 Evidence；
12. 无效回答在 Provider 前阻断；
13. 相同 Observation Dimension 不覆盖 Ability；
14. 下一 Ability 由正式 TaskRequest 驱动，不由页面顺序决定；
15. Material Version 与 Observation Link 错位时不生成正式 Source Context；
16. 同版本内容覆写被拒绝，新版本不覆盖历史 Response / Diagnosis / Evidence 来源；
17. Material 缺失或 Source Anchor 失效时安全阻断。

## 四、回归结果

- Phase 17.2 Batch A：`14 / 14 PASS`
- Phase 16.1 -> 16.2 Integration：`5 / 5 PASS`
- Phase 16.2B Resource Match Quality：`16 / 16 PASS`
- Phase 16.3A Real Learning Chain：`16 / 16 PASS`
- Phase 17.1 Resource Coverage：`22 / 22 PASS`
- Phase 17.2 Material Observation：`26 / 26 PASS`
- Phase 17.2 Minimal Production Workspace：`13 / 13 PASS`
- Phase 16.1A Question Resource Admission：`22 / 22 PASS`
- Phase 1 -> 16.2 Single-object E2E：`5 / 5 PASS`
- Production Build：`PASS`

Build 仅保留既有 bundle size 与 dynamic import 警告，无新增阻断错误。

## 五、边界与下一步

本次允许宣称：

> Batch A 已通过 Phase 17.3 确定性正式资源串联，资源身份、Material Version 与内容哈希、Observation 来源、任务角色、Diagnosis / Evidence 对齐、错位阻断和幂等恢复成立。

本次不能宣称：

- Phase 17.3 最终产品 PASS；
- 真实 DeepSeek 串联已完成；
- `/learning` 人工 Demo 已完成；
- 完整 24—28 道资源包已完成；
- 六项 Ability、两条 Retest、两条 Transfer 和跨 Ability 路径已全部验收。

下一步为 Work Package B：选择 2—3 道 Batch A 正式资源，通过 Application Boundary 执行受控 DeepSeek Live 与 `/learning` 人工验收。
