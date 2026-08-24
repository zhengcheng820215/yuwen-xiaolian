# 产品复杂度收口阶段 1 工程、Debug 与浏览器验收报告

日期：2026-08-24
契约版本：`product_complexity_convergence_stage1_surface_projection_v1`
状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED`

## 一、交付结论

阶段 1 已完成普通录入端与 Learning 的页面投射和默认展示收口：

- 新增版本化 Surface Projection Schema、Guard 与纯函数 Agent；
- 录入端隐藏原始错误码、对象身份和共享写入工程文案，保留用户可执行恢复；
- Learning 入口不再展示 Scheduler、Evidence、Profile 或任务角色解释；
- Retest / Transfer 作为当前题时不向学生展示工程身份；
- Revision 与 Targeted 仅在既有事实已触发时显示，不改变触发条件；
- 下一题动作继续使用真实题号和总数；
- Internal Acceptance 保留完整错误引用与工程事实。

本阶段没有修改 Material、Plan、Task、Candidate、Frozen Resource、Registry、Session、Attempt、Diagnosis、Evidence、Profile、Calibration、条件能力触发或题组顺序。

## 二、自动化 Debug

执行：

```bash
npm run debug:product-complexity-convergence-stage1
```

结果：`C1-01—C1-28`，`28/28 PASS`。

覆盖：Schema / Guard、确定性投射、唯一主操作、发布运行态、单题状态隔离、内部术语隐藏、局部错误恢复、条件能力可见性、下一题与完成边界、不可变 Digest 和命令一致性。

## 三、真实浏览器验收

验收入口：

```text
#/internal/acceptance/product-complexity-convergence-stage1
```

结果：`B1-01—B1-18`，`18/18 PASS`。

浏览器附加检查：

- `/material-resource-workbench` 实际页面可加载，无 Candidate / Gate / Hash 等普通页面泄露；
- `/learning` 实际入口恢复到第 2 题，显示“可以继续”，不显示调度、证据、画像或 Retest 工程说明；
- 浏览器控制台 `error / warn = 0`；
- 正式资源 / Attempt / Profile / 真实校准分母写入：`0 / 0 / 0 / 0`。

## 四、旧主链回归

共执行 `685` 项专项断言，全部通过：

| 回归集合 | 结果 |
| --- | ---: |
| 录入端状态、选择、生产命令、Learning Queue、统一入口、Phase 16.3 主链 | 117/117 |
| Feedback Guided Revision Stage 1—4 | 92/92 |
| Targeted Micro-training Stage 1—4 | 156/156 |
| Reading Single Choice Stage 1—4 | 85/85 |
| Reading Training Progressive Load Stage 0—4 | 235/235 |

Production Build：`PASS`。构建仅保留既有 bundle size 与动态导入提示，不构成本阶段回归。

## 五、零回归与零写入证明

- 纯投射不注入 Repository 或业务 Command；
- 生产页面仍调用原有命令，未建立第二套状态机；
- 条件能力触发结果、题组顺序、题号和恢复身份不变；
- Internal 验收使用隔离投射与 `sessionStorage` 报告；
- 无正式资源、Attempt、Evidence、Profile 或 Calibration 写入。

## 六、后续边界

本报告不宣称以下问题已经完成：

- 阶段 2：Revision、Targeted、Retest、Transfer 的条件策略收口；
- 阶段 3：反馈生成减负、主要缺口收敛与非模板化表达；
- 阶段 4：长期能力展示、真实收益评估与低价值能力退役。

这些问题不得反向扩张阶段 1 的页面状态或改变旧主链。
