# 知识练习第一阶段 WP6 工程验收报告

状态：`ENGINEERING PASS / WP7B ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING (0 / 5)`

版本：`knowledge_practice_phase1_wp6_engineering_acceptance_v1.0`

日期：`2026-08-30`

执行更新：2026-08-31，WP7B Engineering Acceptance已PASS并进入WP7B-5真实学生受控验收准备；正文中的后继状态保留为验收时历史快照，当前状态以 [`CURRENT_PRODUCT_STATE.md`](./CURRENT_PRODUCT_STATE.md) 为准。

工程实施文档：[`KNOWLEDGE_PRACTICE_PHASE1_WP6_RESULT_SUMMARY_AND_NEXT_STEP_RECOMMENDATION_ENGINEERING_PLAN.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP6_RESULT_SUMMARY_AND_NEXT_STEP_RECOMMENDATION_ENGINEERING_PLAN.md)

中央执行清单：[`KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md`](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md)

## 一、验收结论

WP6 已达到 Engineering PASS。

对一组已完成的轻量知识练习，系统现在能够基于冻结的本轮作答事实生成不可变 `PracticeResult`，分开展示基础题首次表现和巩固题表现，按单题10分钟上限计算有效用时，聚合知识点与已审核错因，并生成一项确定性、带依据且可执行的下一步推荐。

结果刷新保持一致；旧 Completion Record V1 可以受控升级为 V2；重做本轮错题会创建新的 `mistake_review` Session；已有 active Session 时不会被结果页推荐覆盖。

该结论不表示：

- 已完成真实学生产品验收；
- 已形成长期掌握度或能力证据；
- 已验证 19 道 approved 轻量题的长期连续使用容量；
- 已进入 Live；
- WP7B 已完成。

## 二、关键决策执行情况

产品负责人于 2026-08-30 确认 D1—D12。工程实现保持：

| 决策 | 执行结果 |
| --- | --- |
| D1 首次正确率 | 结果页不显示得分，巩固不回写基础首次表现 |
| D2 不可变 PracticeResult | 页面只读 Result，不在 JSX 重算业务指标 |
| D3 有效用时 | 累加 Response，单条最多计10分钟 |
| D4 四级本轮表达 | 证据较少 / 表现较稳 / 建议巩固 / 优先巩固 |
| D5 审核错因 | 只聚合已冻结 misconception；缺失时回退具体错题 |
| D6 单一主要推荐 | Result 首屏只突出一个主要动作 |
| D7 推荐优先级 | active → 集中错误专项 → 零散错题重做 → 全对后综合 → 返回入口 |
| D8 推荐依据 | 展示本轮知识点、题数和错误数 |
| D9 mistake_review | 只重做错误 base，新 Session ID，过滤失效题 |
| D10 V1/V2兼容 | Store根版本保持v1，Completion Record升级V2 |
| D11 边界 | 保持 `/learning/knowledge/**`，无正式Evidence/Profile写入 |
| D12 阶段门禁 | WP6通过后只解锁WP7B，不升级Product PASS |

## 三、主要工程交付

### 3.1 Result 领域层

新增：

- `practiceResultTypes.ts`；
- `buildPracticeResult.ts`；
- `practiceResultValidator.ts`；
- `aggregateKnowledgePointResults.ts`；
- `aggregateMisconceptionResults.ts`；
- `selectPracticeRecommendation.ts`。

关键不变量：

- Result ID由来源Session稳定派生；
- 基础题和巩固题分别计数；
- 结果构建不修改Attempt、Response或题目输入；
- 错题摘要只来自错误base Response；
- 知识点聚合总数等于基础题数；
- Result不包含mastery、Evidence、Profile或正式资源写入字段。

### 3.2 有效用时

实现：

```text
effectiveDuration = Σ min(response.durationMs, 10分钟)
```

同时冻结：

- 原始累计用时；
- 基础题有效用时；
- 巩固题有效用时；
- 总有效用时；
- 被封顶的Response数量。

页面展示真实格式化时间，不再把不足一分钟人为展示为一分钟。

### 3.3 知识点与错因

知识点只使用本轮基础题事实：

| 条件 | 表达 |
| --- | --- |
| 0—1道 | 本轮证据较少 |
| 至少2道且全对 | 本轮表现较稳 |
| 至少2道且错1道 | 本轮建议巩固 |
| 至少2道且错至少2道 | 本轮优先巩固 |

错因只聚合WP3已冻结的审核 misconception。没有结构化错因时展示本轮具体错题、正确答案和关键依据，不生成推测性原因。

### 3.4 确定性推荐

实现顺序：

1. 当前已有active Session时优先继续；
2. 同知识点至少2次错误时推荐其分类5题专项；
3. 零散错误推荐重做本轮错题；
4. 全部基础题首次答对时推荐新的综合练习；
5. 库存不足时降级到可执行入口。

推荐过程不使用随机数、大模型或模糊相似度。推荐理由包含本轮知识点、基础题数量和错误数量。

### 3.5 mistake_review

`buildPracticeSession` 现在支持最小 `mistake_review`：

- 显式输入错误base question IDs；
- 去重并保持首次出现顺序；
- 过滤非approved或缺失题；
- 最多10道，使用实际可用数量；
- 全部不可用时拒绝创建空Session；
- 新Session可按WP5规则继续触发一次巩固；
- 入口恢复路由固定为 `/learning/knowledge/quiz/retry`。

浏览器验收期间发现并修复了“继续上次错题重做”旧路由会生成 `quiz/undefined` 的问题，并加入WP6-C55回归门禁。

### 3.6 持久化兼容

- LocalPracticeStore根schema保持v1；
- 新Completion Record使用schema v2并保存完整PracticeResult；
- 保留旧summary字段供WP4/WP5兼容；
- 合法V1记录在读取时确定性升级；
- future Store保持只读；
- revision冲突仍不自动覆盖；
- Result损坏不会要求清空整个localStorage。

## 四、自动化证据

| 测试组 | 结果 |
| --- | ---: |
| WP1 数据与迁移 | 47 / 47 PASS |
| WP2 选题与Session | 47 / 47 PASS |
| WP3 判题与反馈 | 49 / 49 PASS |
| WP4 持久化与恢复 | 33 / 33 PASS |
| WP5 错题即时巩固 | 54 / 54 PASS |
| WP6 结果与推荐 | 56 / 56 PASS |
| WP7A 唯一入口 | 50 / 50 PASS |
| Unified Learning Entry | 31 / 31 PASS |
| Phase16.3 Day0 | 15 / 15 PASS |
| Product Runtime Reliability WP-R2 | 41 / 41 PASS |
| 合计 | 423 / 423 PASS |

WP6专项覆盖：

- 80%首次正确率与除零防护；
- 基础/巩固分账；
- 10分钟有效计时封顶；
- 四级知识点表达；
- 错因聚合和错题回退；
- 推荐排序、库存降级和active优先；
- mistake review去重、过滤和身份；
- Completion V1升级、V2 roundtrip、future Store和revision冲突；
- 页面空状态、错误提示、规范路由和正式边界。

## 五、浏览器验收证据

本地浏览器完成：

1. 单题答错：结果显示0%首次正确率；
2. 显示有效用时、知识点“本轮证据较少”和审核错因；
3. 无巩固题时显示明确空状态；
4. 刷新前后结果文本完全一致；
5. 390px视口无横向溢出；
6. “重做本轮错题”创建新的1题mistake_review Session；
7. 从知识练习入口可恢复mistake_review；
8. 5道字音基础题全部答错、另有1道巩固后，首次正确率仍为0%；
9. “多音字语境读音”2道错2道，显示“本轮优先巩固”；
10. 推荐理由准确展示2道中错2道；
11. 点击推荐成功创建新的5题“字音字形”专项；
12. 浏览器控制台0 error / 0 warning。

## 六、构建与静态检查

- Vite production build：PASS；
- 606 modules transformed；
- `git diff --check`：PASS；
- WP6及中央文档本地链接：无损坏。

仍有既存非阻断警告：

- 主JavaScript chunk大于500kB；
- `phase163RealLearningChainDemo.ts` 同时被静态和动态导入，动态拆包未生效。

这些警告不由WP6引入，不阻塞本工作包，但应在后续技术治理中处理。

## 七、已知限制

1. Product Acceptance仍为PENDING；
2. WP7B尚未开始；
3. 第一阶段只支持本机、本浏览器恢复；
4. 当前轻量题仍为19 approved、15 draft；
5. 当前仅3个批准变式组、6条有向Link；
6. 没有难度3轻量题；
7. 连续5—10轮的重复率与枯竭率尚未做真实学生验证；
8. Result只保留最近一次完成结果，未建设历史结果中心；
9. 本轮结论不能当作正式阅读能力证据。

## 八、阶段状态

- WP6：`ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING`；
- WP7B：`PENDING / UNBLOCKED`；
- Educational Evidence：`PENDING`；
- Live：`PENDING`。

下一步进入WP7B文档确认与全链产品验收，不再新增WP6范围内的平行结果页或第二学生入口。
