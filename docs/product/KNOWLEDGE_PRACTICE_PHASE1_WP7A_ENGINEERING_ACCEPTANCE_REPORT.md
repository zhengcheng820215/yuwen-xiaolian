# 知识练习第一阶段 WP7A 工程验收报告

状态：`ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING / WP5 AUTHORIZED BUT NOT STARTED`

版本：`knowledge_practice_phase1_wp7a_engineering_acceptance_v1.0`

日期：2026-08-29

对应实施文档：[WP7A 唯一入口最小整合工程实施文档](./KNOWLEDGE_PRACTICE_PHASE1_WP7A_SINGLE_ENTRY_INTEGRATION_ENGINEERING_PLAN.md)

## 一、验收结论

WP7A 已达到 Engineering PASS：学生唯一 `/learning` 入口能够同时正确呈现正式阅读能力主线与轻量基础知识巩固；知识练习已进入 `/learning/knowledge/**` 规范路由；旧学生路由使用零业务写入的 `replace` 跳转；正式 Learning 与 PracticeSession 的身份、存储、判题和结论边界保持隔离。

本次通过只证明入口整合工程成立，不证明：

- 12 道 approved 轻量题已满足连续使用内容规模；
- 错题变式巩固已经实现；
- WP6 结果摘要和推荐已经实现；
- 真实学生认为反馈有效；
- 能力提升或教育效果成立。

## 二、实际交付

### 2.1 Student Learning Hub 纯投射

新增：

- `src/domain/student-learning-hub/studentLearningHubTypes.ts`
- `src/domain/student-learning-hub/studentLearningHubProjection.ts`

已实现：

- Knowledge Practice Entry 只读投射；
- 正式与轻量内容库存分层投射；
- 唯一主要动作优先级；
- Formal active / review、Knowledge active 和双 active 兼容；
- 正式恢复、Knowledge Store 恢复和内容不足的独立状态；
- 规范 Knowledge 路由和旧路由目标解析；
- 投射纯函数与内部字段隔离。

`UnifiedLearningEntryState` 仍由正式 Learning Owner 管理，Hub 没有重新读取 Formal Repository 拼装正式状态。

### 2.2 唯一入口整合

`src/pages/UnifiedLearningEntry.jsx` 已接入：

- 基础知识巩固入口卡；
- active PracticeSession 进度；
- 正式题库与轻量知识题的分层数量说明；
- 正式 Runtime 与轻量本地状态的独立投射；
- Formal review / recovery 优先级；
- Knowledge 可用时的安全辅助入口。

页面从 Runtime Health 动态读取正式 Current 数量。数量不可验证时显示 unknown 语义，不回退硬编码 81。

### 2.3 规范路由与兼容

正式规范路由：

```text
/learning
/learning/knowledge
/learning/knowledge/quiz/:category
/learning/knowledge/result
/learning/knowledge/mistakes
```

兼容跳转：

```text
/practice             → /learning
/practice/knowledge   → /learning/knowledge
/quiz/:category       → /learning/knowledge/quiz/:category
/result               → /learning/knowledge/result
/mistakes             → /learning/knowledge/mistakes
/profile               → /learning
```

跳转不调用 `startPractice`、`abandonSession`、`completeAttempt` 或任何正式写入。

### 2.4 页面语义收口

- “知识练习”入口名称调整为“基础知识巩固”；
- 删除“碎片化刷题”主定位；
- 明确本轮事实不代表长期能力结论；
- Quiz、Result、Mistakes 使用规范路由；
- “标记已掌握”调整为“标记本轮已复习”；
- Result 返回唯一 `/learning` 入口；
- 旧四栏学生导航不再渲染为可点击并列主入口。

### 2.5 未修改的正式事实

本次未修改：

- `.local-data/formal-resource-store.json`；
- Formal Resource、Registry、Version 和 Quality Trace；
- 正式 Learning Session、Diagnosis、Evidence、Profile 和 Growth Memory 契约；
- Trial Window、Activation State 或 Observation；
- Practice Store Schema Version；
- WP1—WP4 Knowledge Question、Session、Response 和 Persistence 契约；
- 题目内容和 approved / draft 状态。

## 三、自动化验收

### 3.1 WP7A

新增命令：

```text
npm run debug:knowledge-practice-wp7a
```

实际结果：`WP7A-C01—C50 = 50 / 50 PASS`。

覆盖：

- Projection 12 项；
- Inventory 8 项；
- Routing 12 项；
- Fact Isolation 10 项；
- Accessibility / Presentation 8 项。

### 3.2 WP1—WP4 回归

| 回归 | 结果 |
| --- | ---: |
| WP1 数据与迁移 | 47 / 47 PASS |
| WP2 Session 与选题 | 47 / 47 PASS |
| WP3 判题与反馈 | 49 / 49 PASS |
| WP4 持久化与恢复 | 33 / 33 PASS |

### 3.3 正式 Learning 与 Runtime 回归

| 回归 | 结果 |
| --- | ---: |
| Phase 16.3 Unified Learning Entry | 31 / 31 PASS |
| Phase 16.3 Day 0 Integration | 15 / 15 PASS |
| Product Runtime Reliability WP-R2 | 41 / 41 PASS |
| WP-R2 Browser Matrix | 19 / 19 PASS |

### 3.4 Production Build

Vite Production Build：`PASS`。

构建仍存在项目既有的大 Chunk 和动态导入提示，不是 WP7A 新增阻断；本工作包未扩大依赖范围。

## 四、浏览器验收

验收地址：`http://127.0.0.1:5174/#/learning`。

验收使用隔离的应用内浏览器环境，不把验收 Session 计入真实学生、正式 Learning 或 Trial 教育效果分母。

| 场景 | 结果 | 证据 |
| --- | --- | --- |
| 唯一入口 | PASS | `/learning` 同时展示正式状态和基础知识巩固，不展示第二学生首页 |
| 动态库存 | PASS | 页面显示正式 81 道发布题目与 12 道轻量题，并明确不合并计算 |
| Knowledge 规范入口 | PASS | 点击后进入 `#/learning/knowledge` |
| 旧知识路由 | PASS | `#/practice/knowledge` replace 到规范路由 |
| 开始练习 | PASS | 综合练习进入 `#/learning/knowledge/quiz/all`，生成 10 题稳定 Session |
| 逐题反馈 | PASS | 选择、提交、正确答案、关键依据、知识点和步骤正常 |
| 刷新恢复 | PASS | 刷新后同一题、已提交答案和 Feedback 保持 |
| 统一入口恢复 | PASS | 返回 `/learning` 后显示“继续基础知识巩固”和 1 / 10 进度 |
| 双 active 安全 | PASS | 既有 Formal 状态与 active PracticeSession 同时保留，未自动结束或覆盖 |
| 旧 Result / Mistakes / Profile | PASS | 分别跳转规范 Result、Mistakes 和 `/learning` |
| 移动端 | PASS | 390px 下 `scrollWidth = clientWidth = 390`，按钮无横向遮挡 |
| PC | PASS | 1280px 下无横向溢出，正式与辅助区域层级清晰 |
| 越界文案 | PASS | 页面无“已掌握”“能力已提升”表达 |
| 控制台 | PASS | Error / Warning 日志为 0 |

当前浏览器中既有 Formal Session 指向已更新的旧 Frozen Task，正式入口准确显示需要结束后重新开始；WP7A 没有把该正式状态伪装成题目不足，也没有为通过验收修改或删除该历史 Session。

## 五、数据与零写入核验

WP7A 入口投射和路由 Adapter 均为只读。浏览器验收只自然创建了一条隔离 Knowledge PracticeSession 和对应轻量 Response / Feedback，用于验证 WP1—WP4 主链；没有产生：

- Formal Resource 写入；
- 正式 Diagnosis / Evidence / Profile 写入；
- Trial Activation / Observation 写入；
- Knowledge Store Schema 迁移；
- active PracticeSession 覆盖或静默放弃。

包管理器基线检查曾生成未使用的 `.pnpm-store/` 临时缓存，验收收口时已验证目标位于工作区并删除；该缓存不属于产品交付。

## 六、已知限制

1. 轻量题仍为 12 道 approved、15 道 draft，连续 5 / 10 次使用的重复率和枯竭率尚未做产品验收；
2. 只有本机、本浏览器恢复，不支持账户或跨设备同步；
3. WP5 错题即时巩固尚未实现；
4. WP6 结果摘要与下一步推荐尚未实现；
5. Product Acceptance 和 Educational Evidence 仍为 PENDING；
6. 旧 `/practice/fun`、`/practice/ability` 页面未删除，但已失去 `/practice` 一级入口，不在 WP7A 继续扩展；
7. 当前正式浏览器状态中的旧 Frozen Task 需按正式 Learning 既有动作处理，不属于 WP7A 自动修复范围；
8. Production Build 保留既有大 Chunk 和动态导入警告。

## 七、门禁裁决

WP7A 的 15 项 Engineering PASS 门禁全部满足：

1. 唯一 `/learning` 入口成立；
2. 两类训练角色清晰；
3. 唯一主要动作优先级通过；
4. 规范路由和旧路由兼容通过；
5. Formal 与 PracticeSession 均未丢失；
6. 库存数量动态分层；
7. 故障保持隔离；
8. WP7A 50 / 50；
9. WP1—WP4 全量回归通过；
10. 正式 Learning 和 Runtime 回归通过；
11. Production Build 通过；
12. 浏览器主链、恢复、兼容和响应式通过；
13. 已输出本报告和已知限制；
14. 无非授权正式写入；
15. 未提前实现 WP5 或 WP6。

## 八、WP5 状态

依据 WP0A 和 WP7A 解锁规则：

- WP7A：`ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING`；
- WP5：从 `BLOCKED` 升级为 `PENDING / AUTHORIZED BUT NOT STARTED`；
- 下一步如进入 WP5，仍应先核对并确认 WP5 工程实施文档，不应直接沿用入口整合前的旧假设；
- WP5 继续遵守“轻量本轮事实、不进入正式 Evidence / Profile”的边界。

本报告的准确声明为：

> 学生唯一 `/learning` 入口已能正确呈现并进入正式阅读能力主线与轻量基础知识巩固；现有正式与轻量学习事实保持隔离，旧知识练习路由和未完成会话得到兼容保护。该结果证明入口整合工程成立，不代表知识练习内容规模、真实反馈价值或教育效果已经通过产品验收。
