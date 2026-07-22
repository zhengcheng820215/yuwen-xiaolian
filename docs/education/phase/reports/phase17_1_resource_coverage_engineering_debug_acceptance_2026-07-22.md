# Phase 17.1 Resource Coverage Engineering Debug Acceptance

日期：2026-07-22  
状态：ENGINEERING PASS / DEBUG ACCEPTED / HUMAN DEMO PENDING

## 一、实现范围

本轮完成 Phase 17.1 资源覆盖契约的工程实现，没有新增资源、教育判断或学生能力结论：

- `ResourceCoveragePolicy` 与 30 个 `abilityId + taskRole` Primary Cell；
- 版本化 `ProductExecutableCapabilitySnapshot`；
- Registry current head、Validation、Review、Rubric、Material 与产品能力 Eligibility；
- `materialId` 聚合的 V1 Material Cluster；
- executable resource、Material Cluster 与 independent Context 分离统计；
- Difficulty、QuestionType、ResponseFormat Breakdown；
- `covered / thin / gap / blocked / not_planned`；
- 结构化 Gap、Rejected Record、稳定 Snapshot 与 Report ID；
- 只读 `ResourceCoverageApplicationService`；
- 只读 `ResourceCoverageDashboardViewModel`。

Coverage 只消费现有 Question Resource Repository，不修改 Registry、Frozen Version、Review、Material、Strategy 或 TaskRequest。

## 二、Phase 17.1 Debug

执行：

```text
pnpm run debug:resource-coverage
```

结果：`22 / 22 PASS`

覆盖重点：

1. 只统计 Registry current head，旧版本不增加当前覆盖；
2. current version 缺失、身份错位、Review / Rubric / Material 缺失均被隔离；
3. 同一 Material 多题或多版本不制造多个独立 Context；
4. 不同 Material 可以增加可验证 Context；
5. Schema 支持但产品端未验收的题型不进入 executable count；
6. Primary Cell 不制造 Difficulty、QuestionType 的笛卡尔积；
7. 五类 Coverage Status 与 Policy 阈值一致；
8. 输入顺序、Policy 与 Capability 版本变化具有稳定身份语义；
9. Dashboard 只投影正式 Report；
10. 生成失败不污染 Repository。

## 三、相邻回归

- Phase 16.1A Question Resource Admission：`22 / 22 PASS`；
- Phase 16.2A Core Resource Eligibility：`12 / 12 PASS`；
- Phase 16.2B Resource Match Quality：`16 / 16 PASS`。

回归结果证明 Phase 17.1 没有改变既有资源准入、当前版本选择或正式匹配语义。

## 四、构建

Production Build：`PASS`

构建只保留既有动态导入和 bundle size 警告，不构成 Phase 17.1 功能失败。

## 五、当前结论

Phase 17.1 的 Coverage Contract、Agent、Application Service、Dashboard Adapter 和确定性 Debug 已成立，可以支撑 Phase 17.2 使用正式 Gap 规划首批资源包。

当前尚未执行：

- 浏览器 IndexedDB 跨刷新读取与重算 Smoke；
- Coverage Dashboard 轻量人工验收。

因此当前准确状态是 `ENGINEERING PASS / DEBUG ACCEPTED`，不是 `PASS / FROZEN`。本轮未调用 DeepSeek Live Provider，也未建设首批 Frozen Resource Pack。

## 六、Phase 17 目标增强后的兼容结论

Phase 17 总目标后续增加了 `Material -> Observation Dimension -> Ability Action -> Question Resource` 的材料能力观测基础。该增强不修改本次已验收的 Phase 17.1 Contract：

- Primary Cell 仍为 `abilityId + taskRole`；
- Observation Dimension 不进入 V1 Coverage denominator；
- Material Observation Plan 与 Observation Diversity View 由 Phase 17.2 建立；
- Phase 17.3 只验证观测引用的正式传递；
- Dimension 暂不直接影响 Evidence、Profile 或 GrowthMemory。

因此 `22 / 22 PASS` 的原始测试解释保持有效。未来若将 Dimension 纳入正式 Coverage Status，必须发布新的 Policy / Schema Version，而不是重解释 V1 Report。
