# Phase 17 统一资源生产工作台 P7 Debug 验收记录

日期：2026-08-03

结论：`P7 DEBUG ACCEPTED / 13 OF 13 AUTOMATED SUITES PASS / PRODUCTION BUILD PASS`

## 一、验收范围

本轮验收不新增生产能力，验证 P0-P6 已冻结的统一资源生产链能同时成立：

1. TrainingTask、QuestionLineage、Draft Revision 与正式题目保持稳定身份；
2. 状态、互斥数量、发布资格和题目步骤只读取统一 Resolver；
3. 保存、检查、最终确认、人工决定和发布继续由独立 Command 执行；
4. 退回修改复用同一 Draft，并只为真实修改创建新 Revision；
5. 部分发布、失败恢复和重复点击不产生重复 Review、Formal Version 或 Registry；
6. 学习入口只读取完整正式资源；
7. 旧题目工作台不再形成第二条可写生产链。

## 二、环境与基线

```text
分支：main
验收前 Git 基线：c8512dd feat: complete partial task publication workflow
Node.js：v24.14.0（Codex bundled runtime）
构建工具：Vite 8.1.5
验收日期：2026-08-03（Asia/Shanghai）
```

自动化使用隔离内存 Fixture，每个 suite 创建独立后缀身份，不写入长期保留的真实资源。浏览器验收使用现有稳定对象，只读核对身份与状态：

```text
runId: p7-acceptance-2026-08-03
materialVersionId: material-b38614ee-a55:v1
planId: material-observation-plan-1hhavbz
draftId: draft-observation-task-plan-qwk3su
```

自动化 Fixture 使用 `material-${suffix}:v1`、`p1-command-${suffix}` 等 suite-scoped ID，并在每个场景中断言 Draft、Revision、Review、Formal Version 与 Registry 身份没有被重建或错绑。

## 三、自动化结果

执行命令：

```bash
NODE_NO_WARNINGS=1 /Users/chengzheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --experimental-strip-types \
  --experimental-specifier-resolution=node \
  src/ai/tests/runUnifiedResourceProductionP7AcceptanceDebug.ts
```

结果：

```text
PASS 01 runTaskProductionStateDebug.ts
PASS 02 runTaskProductionCommandRuntimeDebug.ts
PASS 03 runTaskPublicationOrchestrationDebug.ts
PASS 04 runQuestionWorkflowProjectionDebug.ts
PASS 05 runMaterialResourceProductionDebug.ts
PASS 06 runMaterialResourceProductionCommandDebug.ts
PASS 07 runMaterialQuestionReviewSubmissionDebug.ts
PASS 08 runQuestionWorkbenchCommandE2EDebug.ts
PASS 09 runQuestionPublicationRecoveryDebug.ts
PASS 10 runQuestionWorkbenchPresentationStateDebug.ts
PASS 11 runProductColorSemanticsDebug.ts
PASS 12 runPhase173LearningEntryIntegrationDebug.ts
PASS 13 runQuestionWorkbenchLegacyClosureDebug.ts
Result: 13 / 13 P7 suites PASS
```

## 四、P7 场景结论

| 场景 | 核心验收点 | 结果 |
| --- | --- | --- |
| 完整生产链 | 素材、任务、Draft、Assessment、Review、Formal Version、Registry 与学习读取身份闭合 | PASS |
| 退回修改 | 复用同一 Draft；旧 Assessment 失效；新 Revision 重新检查并再次提交 | PASS |
| 部分发布 | 单任务状态互斥；任务组数量守恒；已发布、待确认和待修改任务互不污染 | PASS |
| 保存幂等 | 重复保存不产生空 Revision；冲突不覆盖较新 Revision | PASS |
| 检查幂等 | 同一 Revision 重复检查不生成重复有效检查记录 | PASS |
| 最终确认幂等 | 重复提交和重复人工决定不生成重复 Review | PASS |
| 发布恢复 | 部分成功后从既有 Freeze / Formal Version 继续，不创建第二个正式版本 | PASS |
| Registry 恢复 | Registry 或 Material Link 失败时不进入学习集合，重试复用既有正式版本 | PASS |
| 批量发布 | 只重试失败任务，成功任务不被重复发布 | PASS |
| 学习入口 | 草稿、待确认和发布不完整资源不可见；完整正式资源可稳定读取 | PASS |
| 旧入口 | 独立旧地址只进入安全适配；有效深链只读或回到唯一主入口 | PASS |

## 五、浏览器端到端证据

P6-P7 同一工作树和同一生产入口已完成以下界面核对：

1. `/material-resource-workbench` 正常载入素材资源录入、已有素材和任务卡；
2. 从任务卡进入详情时保持同一 `materialVersionId`、`planId`、TrainingTask 与 Draft；
3. `task-detail` 显示只读题目生产详情，不出现第二套编辑和发布入口；
4. 独立 `/question-resource-workbench` 显示入口已合并的安全适配页，只提供返回素材工作台；
5. `/learning` 正常读取完整正式资源，未出现 Draft、待确认或 Registry 不完整资源；
6. 任务详情刷新和深链恢复后仍定位同一生产对象；
7. 以上路径验收时浏览器控制台无新增运行时错误。

本轮文档收口时，应用内浏览器的新一轮自动导航受到本地 URL 安全策略限制，因此没有用绕过方式重复操作。该限制不影响同一代码工作树已形成的浏览器证据；自动化、生产构建和本地 Vite 服务均在本轮重新执行通过。

## 六、静态检查与生产构建

```text
git diff --check                                      PASS
源码旧入口文案扫描                                   PASS
Vite production build                                PASS
2074 modules transformed                             PASS
```

生产构建保留两项既有非阻断提示：

1. `phase163RealLearningChainDemo.ts` 同时存在静态和动态导入；
2. 主 Bundle 大于 500 kB。

两项均为 P3 构建性能事项，不改变 P7 数据、状态、恢复或学习读取结论。

## 七、数据完整性与重复对象审计

1. 重复保存、检查、提交、确认和发布均由幂等键保护；
2. 退回链不创建第二个活动 Draft；
3. 发布恢复不创建第二个 Formal Version；
4. Registry 与 Material Link 不完整时，资源不会进入学习可用集合；
5. 任务组互斥状态桶总和始终等于 TrainingTask 总数；
6. 已发布正式版本与新活动 Revision 可以并存，互不覆盖；
7. 旧入口只保留身份恢复与只读审计兼容，不保留写入能力。

## 八、未解决问题与放行结论

未发现未解决 P0、P1 或 P2 缺陷。

保留事项：

| 事项 | 级别 | 处理 |
| --- | --- | --- |
| 主 Bundle 体积提示 | P3 | 后续独立性能任务处理 |
| 动态导入未拆包提示 | P3 | 后续独立构建优化处理 |
| 多人独立审核模式 | 产品决策 | 不属于 P7 放行条件 |

最终结论：P7 工程与 Debug 验收通过。统一资源生产工作台具备单一可写入口、可追溯状态链、任务级部分发布、失败恢复、学习读取和历史只读兼容能力，可以结束 P7 阶段。

后续 P0-P7 最终串联验收已完成，完整结果见 [Phase 17 统一资源生产 P0-P7 最终串联验收报告](./phase17_unified_resource_production_p0_p7_final_integration_acceptance_2026-08-03.md)。
