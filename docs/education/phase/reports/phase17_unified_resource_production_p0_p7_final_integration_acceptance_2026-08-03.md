# Phase 17 统一资源生产 P0-P7 最终串联验收报告

日期：2026-08-03

结论：`P0-P7 FINAL INTEGRATION ACCEPTED / 18 OF 18 SUITES PASS / PRODUCTION BUILD PASS`

## 一、验收目标

本轮不新增业务能力，验证 P0-P7 在同一工作树中组成一条可恢复、可追溯且只有一个写入口的正式资源生产链：

```text
素材版本
-> AI 规划训练任务
-> 人工编辑与保存
-> 题目检查
-> 最终确认
-> 正式发布
-> 学习入口读取
```

同时验证旧题目工作台只保留安全适配和只读审计，不再形成第二条写链。

## 二、环境与基线

```text
分支：main
Git 基线：c8512dd feat: complete partial task publication workflow
验收对象：统一资源生产 P0-P7 收口工作树
Node.js：Codex bundled runtime
构建工具：Vite 8.1.5
验收日期：2026-08-03（Asia/Shanghai）
```

自动化使用隔离 Fixture，不覆盖长期保留的真实素材、Draft、Review 或正式资源。

## 三、最终聚合自动化

统一入口：

```bash
pnpm run debug:unified-resource-production-final
```

当前机器使用支持 TypeScript strip-types 的 bundled Node 执行：

```bash
NODE_NO_WARNINGS=1 /Users/chengzheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --experimental-strip-types \
  --experimental-specifier-resolution=node \
  src/ai/tests/runUnifiedResourceProductionP0P7FinalIntegrationDebug.ts
```

结果：

```text
PASS 01 [P0]    runAuthoringFieldContractDebug.ts
PASS 02 [P0-P1] runTaskProductionStateDebug.ts
PASS 03 [P1]    runQuestionWorkflowProjectionDebug.ts
PASS 04 [P1]    runMaterialResourceWorkbenchStateDebug.ts
PASS 05 [P1-P2] runTrainingTaskGroupPlanningE2EDebug.ts
PASS 06 [P2]    runMaterialResourceWorkbenchSelectionStateDebug.ts
PASS 07 [P2]    runMaterialResourceProductionDebug.ts
PASS 08 [P2]    runQuestionWorkbenchPresentationStateDebug.ts
PASS 09 [P3]    runTaskProductionCommandRuntimeDebug.ts
PASS 10 [P3]    runMaterialResourceProductionCommandDebug.ts
PASS 11 [P3]    runMaterialQuestionReviewSubmissionDebug.ts
PASS 12 [P3-P4] runQuestionWorkbenchCommandE2EDebug.ts
PASS 13 [P4]    runQuestionQualityRevisionProgressDebug.ts
PASS 14 [P4-P5] runTaskPublicationOrchestrationDebug.ts
PASS 15 [P5]    runQuestionPublicationRecoveryDebug.ts
PASS 16 [P6]    runPhase173LearningEntryIntegrationDebug.ts
PASS 17 [P6]    runQuestionWorkbenchLegacyClosureDebug.ts
PASS 18 [P7]    runProductColorSemanticsDebug.ts
Result: 18 / 18 P0-P7 integration suites PASS
```

## 四、跨阶段串联结论

| 链路 | 验收结论 |
| --- | --- |
| 字段契约与保存恢复 | 页面、Schema、校验和定位读取同一字段；修改后旧 Assessment 失效 |
| 统一状态与动作 | 页面标题、步骤、任务卡、主按钮和可用动作读取统一 Resolver |
| AI 候选与 Revision | 候选生成不直接写 Revision；多次生成和采用后，最终保存只新增一个 Revision |
| 检查与最终确认 | 保存、检查、提交、人工决定为独立 Command；返回修改复用同一 Draft |
| 部分发布 | 单任务可独立发布；任务组汇总由互斥状态计算，数量守恒 |
| 发布失败恢复 | 审核决定不回滚；重试复用已有 Freeze 与 Formal Version，不产生重复正式资源 |
| 学习读取 | 仅完整 Formal Version、Registry 和材料关联进入学习可用集合 |
| 旧入口收口 | 旧题目工作台只读，不保留编辑、确认和发布写入口 |
| 颜色与交互语义 | 状态色、AI 相关紫色、操作蓝色及 Loading/禁用语义通过契约检查 |

未发现重复 Draft、重复 Human Review、重复 Formal Version、错误 Registry 关联或已发布内容被新 Revision 覆盖。

## 五、浏览器端到端核对

使用本地 Vite 服务完成以下路径核对：

1. `/material-resource-workbench`：深链恢复同一素材和计划，3 个训练任务均显示已发布，任务卡提供“查看已发布题目”，汇总数量守恒；
2. `/learning`：在当前端口没有符合条件的正式任务时展示明确空状态，未错读 Draft 或不完整正式资源；
3. `/question-resource-workbench`：历史深链可恢复 3 个已发布题目，只读展示发布步骤和题目详情；
4. 三条路径均无新增浏览器控制台错误。

浏览器验收使用 `5175` 临时端口，与固定 `5174` 的浏览器本地数据隔离，因此学习入口空状态属于验收环境差异，不是数据链路缺陷。

## 六、构建与静态检查

```text
git diff --check               PASS
Vite production build         PASS
2074 modules transformed      PASS
build time                     853 ms
```

构建保留两项既有非阻断提示：

1. `phase163RealLearningChainDemo.ts` 同时存在静态和动态导入；
2. 主 JavaScript Bundle 大于 500 kB。

两项均属于后续 P3 性能优化，不影响生产状态、发布恢复或学习读取正确性。

系统自带旧 Node 不支持 `--experimental-strip-types`，最终验收使用项目已配置的 bundled Node。该项是本地运行时前置条件，不是产品链路缺陷。

## 七、最终放行结论

1. P0-P7 的字段、身份、状态、命令、部分发布、失败恢复、学习读取和旧入口收口能够串联成立；
2. 未发现未解决 P0、P1 或 P2 缺陷；
3. 当前工作树通过最终聚合自动化、生产构建、静态检查和浏览器路径核对；
4. 后续开发不得重新引入第二写链、组件级生命周期拼装、非互斥状态计数或不可恢复的发布命令。

最终结论：P0-P7 最终串联验收通过，可以结束本轮统一资源生产链收口。
