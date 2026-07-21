# Phase 16.3 Product / Demo Scope Isolation Debug

记录日期：2026-07-21  
验收状态：PASS  
验收性质：确定性 Debug，不调用真实网络 Provider，不进行人工 Demo

## 一、目标

修复正式 `/learning` 与 Phase 16.3 Demo 共用学生身份造成的数据串线风险，并确认：

- Demo 的 `review_required` 不会进入正式学生入口；
- 正式资源、Task、Response、Evidence 和持久化使用同一产品学生身份；
- 清理 Demo 数据不会删除正式学习 Operation；
- 旧 Demo 数据保留但不参与正式恢复和自然日统计；
- 没有真实承接人的复核状态不会向学生显示“等待确认”。

## 二、实现边界

- 正式产品学生：`student-local-primary-v1`；
- Demo 学生：`student-phase16-integration-demo`；
- 不删除、不改写旧 Demo 数据；
- 不修改 Diagnosis、Evidence、Profile、GrowthMemory 或策略算法；
- 不重新调用 DeepSeek；
- Frozen Resource 内容保持不变，进入本轮时绑定当前产品学生身份；
- Operation Repository 增加按 `studentId` 清理能力，保留全库清理接口但内部验收页不再使用它清理 Demo。

## 三、专项结果

`npm run debug:phase16-3-scope-isolation`

| Case | 结果 |
|---|---|
| 产品与 Demo 学生身份分离 | PASS |
| 产品身份解析为 product | PASS |
| Demo 身份解析为 demo | PASS |
| 产品 studentId 混入 Demo Operation 标记时拒绝 | PASS |
| 正式资源进入本轮前绑定产品学生 | PASS |
| 清理 Demo Operation 不影响正式 Operation | PASS |
| Demo Checkpoint 不进入正式学生入口 | PASS |
| review_required 使用“结果暂不采用”学生文案 | PASS |
| 产品身份贯穿 Task、Response、Evidence 与持久化主链 | PASS |

结果：`9 / 9 PASS`

## 四、回归结果

- Phase 16.3B Unified Learning Entry：`17 / 17 PASS`；
- Phase 16.3A Real Learning Chain：`16 / 16 PASS`；
- Phase 16.3 Day 0 Integration：`11 / 11 PASS`；
- Phase 15 Integrated Debug：`11 / 11 PASS`；
- Phase 15.3 Controlled Feedback：`36 / 36 PASS`；
- Production Build：PASS。

本轮未执行真实 DeepSeek Live Smoke，未进行新的人工 Demo。构建仅保留既有动态导入和 bundle size 非阻断警告。

## 五、正式结论

Phase 16.3 正式学生入口与 Demo / Debug 数据作用域已经分离。Demo 复核状态、历史、Operation、Session 和 Round 不会被 `/learning` 当作正式学习事实恢复；产品身份下的完整确定性主链已经通过。旧 Demo 数据被保留并隔离，不构成正式学生历史。

Phase 16.3C 自然日验收仍为 `PENDING (0 / 5)`，本次 Debug 不替代自然日真实使用。
