# 产品复杂度收口阶段 2 工程、Debug 与浏览器验收报告

日期：2026-08-24
契约版本：`product_complexity_convergence_stage2_conditional_policy_v1`
策略版本：`product_complexity_convergence_stage2_policy_v1`
状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED`

## 一、交付结论

阶段 2 已完成 Revision、Targeted Micro-training、Retest、Transfer 四类条件能力的策略收口基础设施：

- 以既有能力 Owner Decision 为事实权威，不建立第五套任务状态机；
- 新增版本化统一判定封套、Validator、稳定 ID / Hash 和只读审计投影；
- 新增四类 Owner Adapter，将原生事实映射为统一策略输入，不复制原生生命周期；
- 支持 `legacy / shadow / enforced` 按能力独立配置，生产默认全部为 `legacy`；
- Shadow 只比较 Owner 与 Converged Decision，Effective Decision 仍服从 Owner；
- Enforced 仅在单项能力明确启用时允许采用收口结果；
- Session 开始时冻结策略快照，中途 Flag 变化不改写当前 Session；
- 策略计算、身份校验或审计写入失败时保留 Owner Flow，不阻断核心学习链；
- 独立 IndexedDB 审计仓不成为 Scheduler、Evidence、Profile 或 UI 的输入。

本阶段没有修改 Material、Observation Plan、TrainingTask、QuestionCandidate、Frozen Resource、Registry、题组顺序、Diagnosis、Evidence、Profile 或反馈表达。

## 二、工程交付范围

| 工程包 | 结果 |
| --- | --- |
| WP2-01 Schema 与 Owner Adapter | 完成 |
| WP2-02 Shadow Policy Agent | 完成 |
| WP2-03 Revision 单项策略边界 | 完成 |
| WP2-04 Targeted 单项策略边界 | 完成 |
| WP2-05 Retest 单项策略边界 | 完成 |
| WP2-06 Transfer 单项策略边界 | 完成 |
| WP2-07 全链 Debug、浏览器联调与回归 | 完成 |

核心实现包括：

- `productComplexityConvergenceConditionalPolicy.schema.ts`；
- `productComplexityConvergenceConditionalPolicyAgent.ts`；
- `productComplexityConvergenceConditionalPolicyOwnerAdapters.ts`；
- `productComplexityConvergenceConditionalPolicyService.ts`；
- `productComplexityConvergenceConditionalSessionPolicyService.ts`；
- In-memory / IndexedDB Audit Repository；
- C2 自动化 Debug Runner；
- B2 浏览器验收 API、页面与 Internal Acceptance 入口。

## 三、自动化 Debug

执行：

```bash
PATH=/usr/local/bin:$PATH npm run debug:product-complexity-convergence-stage2
```

结果：`C2-01—C2-40`，`40 / 40 PASS`。

覆盖 Schema / Policy 版本、非法值拒绝、触发完整性、稳定身份、四能力触发与不触发、冲突、防循环、Shadow 零行为变化、单项 Enforced、Session Flag 冻结、故障回退、Legacy 兼容、幂等与保护写入。

## 四、真实浏览器验收

验收入口：

```text
#/internal/acceptance/product-complexity-convergence-stage2
```

结果：`B2-01—B2-18`，`18 / 18 PASS`。

浏览器附加检查：

- Legacy、Shadow、单项 Enforced 的行为边界符合契约；
- 刷新后验收结果可恢复；
- 普通页面不显示 Policy、Owner、Shadow、Reason Code、Hash 或 Identity；
- 控制台 `error / warn = 0`；
- 隔离审计投影数量为 `4`；
- Formal Resource / Attempt / Evidence / Profile / 真实校准分母写入为 `0 / 0 / 0 / 0 / 0`。

浏览器验收使用隔离数据和隔离审计数据库，不计入真实使用或教育效果分母。

## 五、旧主链回归

共执行 `353` 项既有专项断言，全部通过：

| 回归集合 | 结果 |
| --- | ---: |
| Product Complexity Convergence Stage 0 | 24/24 |
| Product Complexity Convergence Stage 1 | 28/28 |
| Feedback Guided Revision Stage 1 / Stage 4 | 45/45 |
| Targeted Micro-training Stage 1 / Stage 4 | 67/67 |
| Delayed Retest | 13/13 |
| Next Learning Strategy | 1/1 |
| Phase 16.3 Real Learning Chain / Unified Entry | 44/44 |
| Formal Resource Match Quality | 16/16 |
| Reading Open Response Input Load Stage 4 | 56/56 |
| Reading Training Progression Stage 3 | 59/59 |

Production Build：`PASS`。构建仅保留既有动态导入与 bundle size 提示，不构成本阶段回归。

## 六、零回归与运行边界

- 统一策略输出是审计投影，不是新的任务或 Evidence；
- 相同输入和版本得到稳定决策，重复保存不创建第二条审计事实；
- Audit Repository 写入失败不回滚或阻断 Owner Flow；
- 身份不一致时停止新增条件动作，正式结果仍由 Owner 决定；
- 四项能力生产默认全部保持 `legacy`；
- 本报告确认“具备逐项 Shadow / Enforced 的工程条件”，不等于四项能力已经在生产环境全部启用；
- 真实触发率、完成率、后续独立改善、中断率与维护成本仍须由后续真实试用观察。

## 七、后续边界

阶段 2 不包含阶段 3 的反馈与 Profile 投射收口，也不执行阶段 4 的能力保留或退役判断。任何生产启用必须按单项能力进行：先 Shadow 观察，再独立验收，最后才可切换为 Enforced；任一能力均可独立回退 Legacy。
