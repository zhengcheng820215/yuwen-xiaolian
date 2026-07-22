# Phase 17.2 最小资源生产工作台工程 Debug 验收

日期：2026-07-22

状态：PASS

## 一、验收范围

本次只验收 Phase 17.2 的最小资源生产工具与 Existing Phase 16.1 正式准入链集成，不验收首批正式内容质量，也不宣称 26—28 道 Frozen Resource Pack 已完成。

正式实现链路：

```text
QuestionMaterialVersion
-> Material Structure / Source Anchor
-> MaterialObservationPlan
-> Human Plan Review
-> 3–6 ObservationTaskPlan
-> StructuredQuestionDraft Batch
-> Existing Phase 16.1 Validation / Review / Freeze
-> ResourceObservationLink
```

## 二、工程实现

已完成：

1. 新增 `/material-resource-workbench` 最小生产入口；
2. 支持手工录入或选择正式 Material Version；
3. 支持基于自然段设计 3—6 个 Observation Task；
4. 自动继承 Material、Ability、TaskRole、Difficulty 与 Observation 追溯标签；
5. 统一创建并校验 Structured Question Draft 批次；
6. Plan 未审核时禁止生成 Draft；
7. 重复执行复用既有 Draft，不重复创建，也不改写待审核或已审核状态；
8. 单个 Draft 失败不会删除或回滚已成功的兄弟 Draft；
9. 批量生产不自动 Review、Freeze、更新 Registry 或生成正式 Link；
10. Existing Question Resource Workbench Freeze 后，若存在合法 Observation 标签，则尝试建立正式 ResourceObservationLink；关联失败保留 Frozen 事实并显式返回问题，不伪装为完整成功；
11. 内部工作入口已收敛到“材料资源生产”，逐题审核与 Freeze 继续复用 Existing Phase 16.1 工作台。

### 2.1 页面级 Smoke

`/material-resource-workbench` 已完成轻量页面级检查：

- `1280 × 720` PC 视口使用完整工作台宽度与双栏布局；
- `1024 × 768` 平板横屏视口保持材料与任务双栏；
- 两个视口均无横向溢出；
- 工作台不再继承 `430px` 移动端容器或学生端底部导航；
- 页面加载后浏览器控制台无错误。

该 Smoke 只证明路由与基础布局可达，不替代实际内容录入、IndexedDB 刷新恢复和 PC / Tablet 人工操作验收。

## 三、专项 Debug

执行：

```text
npm run debug:material-resource-production
```

结果：`12 / 12 PASS`

覆盖：

- 3—6 个任务边界；
- 重复题干阻断；
- 段落 Anchor 错位不污染正式 Plan；
- 元数据自动继承；
- Plan Review Gate；
- 批量 Draft 与结构校验；
- 重复执行幂等；
- 非编辑状态保护；
- 单题失败隔离；
- 禁止自动正式化；
- Plan revision lineage。

## 四、回归结果

| 回归项 | 结果 |
| --- | --- |
| Phase 17.2 Material Observation | `26 / 26 PASS` |
| Phase 17.1 Resource Coverage | `22 / 22 PASS` |
| Phase 16.1 Question Resource Intake | `22 / 22 PASS` |
| Phase 16.2 Resource Match Quality | `16 / 16 PASS` |
| Phase 16.1 -> 16.2 Resource Integration | `5 / 5 PASS` |
| Phase 1 -> 16.2 Single-object E2E | `5 / 5 PASS` |
| Node 24 Production Build | `PASS` |

以上回归未调用真实 DeepSeek，不生成学生 Evidence、ProfileUpdateDecision 或 GrowthMemory。

## 五、准确结论

Phase 17.2 最小资源生产工作台工程闭环已经成立，可以支持首批正式内容生产。系统能够以 Material 为起点建立可审核观测计划，批量生成符合 Existing Phase 16.1 Contract 的题目 Draft，并保持审核、Freeze、Registry 与 Observation Link 边界。

当前仍待完成：

- 工作台浏览器 IndexedDB 刷新恢复 Smoke；
- PC / Tablet 真实内容录入与连续操作人工验收；
- 首批 4—6 个真实 Material Cluster；
- 26—28 道人工审核并 Frozen 的正式资源；
- Resource Pack Manifest、Coverage Recalculation 与内容质量验收。

Debug 合成材料与题目不计入正式资源包。
