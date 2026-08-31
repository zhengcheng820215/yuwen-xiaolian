# 知识练习第一阶段 WP5 工程验收报告

状态：`ENGINEERING PASS / WP6 + WP7B ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING (0 / 5)`

版本：`knowledge_practice_phase1_wp5_engineering_acceptance_v1.0`

日期：2026-08-29

执行更新：2026-08-31，WP6与WP7B Engineering Acceptance均已PASS；正文中的后继工作包状态保留为验收时历史快照，当前状态以 [`CURRENT_PRODUCT_STATE.md`](./CURRENT_PRODUCT_STATE.md) 为准。

对应实施文档：[WP5 错题即时巩固工程实施文档](./KNOWLEDGE_PRACTICE_PHASE1_WP5_WRONG_ANSWER_REINFORCEMENT_ENGINEERING_PLAN.md)

## 一、验收结论

WP5 已达到 Engineering PASS：对存在人工审核有向变式关系的轻量知识基础题，首次答错后可以确定性安排一道后续巩固题；插入位置、单题与单轮上限、非递归、重复提交、刷新恢复和多页面冲突均受控；基础题首次表现与巩固表现保持隔离。

本次通过不证明：

- 一道巩固题答对等于已经掌握；
- 错题巩固已经产生长期能力提升；
- 19 道 approved 轻量题已经满足长期连续使用；
- WP6 结果摘要与下一步推荐已经完成；
- 真实学生 Product Acceptance 或 Educational Evidence 已成立。

## 二、实际交付

### 2.1 内容关系与生产内容

新增：

- 7 道人工审核轻量题，其中 6 道组成变式关系，1 道用于专项容量保护；
- 3 个批准变式组，覆盖字音字形、成语运用、文言实词虚词；
- 6 条双向但逐条审核的有向 `ReinforcementLink`；
- Link schema、审核字段、同组、知识点、范围、错因引用和重复关系校验。

当前轻量内容基线：

- 27 道历史迁移题；
- 7 道 WP5 审核补充题；
- 19 道 `approved`；
- 15 道 `draft`；
- 3 个批准变式组；
- 6 条批准有向 Link。

浏览器验收首次发现字音专项原有容量会触发 WP2 最后一级 `variant_group_relaxed`，导致两道同组题同时进入基础队列。已增加一道人审非变式题，使 5 题专项无需放宽变式组去重即可保留一个巩固候选，并将该条件加入 WP5-C10 自动化门禁。

### 2.2 确定性调度

已实现：

- 只处理 `outcome === 'created'` 的错误 base Response；
- 同一 `variantGroupId` + approved 有向 Link 双门禁；
- 可选 `applicableMisconceptionCodes`；
- 排除 Session 中所有已出现 Question；
- 基于 Session seed、source Queue Item 和 Response ID 的稳定选择；
- 优先 `currentIndex + 2`、尾部降级 `+1`；
- 每 source 最多 1 道、每 Session 最多 3 道；
- reinforcement 无论对错均不递归；
- 无候选时返回稳定领域 reason，并在学生端安静降级。

### 2.3 原子提交、校验与恢复

`submitPracticeAnswerWithReinforcement` 将以下步骤收敛为一个 Attempt 变换：

```text
判题与幂等 Response
→ Feedback
→ 必要时调度 Reinforcement
→ 完整 Attempt 校验
→ Context 单次 saveActiveAttempt
```

Session Validator 已从“只允许 base”升级为完整 reinforcement 不变量校验，包括来源、顺序、数量、Question 去重和完成态一致性。Store schema 与物理 key 保持 v1，旧零巩固记录仍可读取；刷新恢复使用已经冻结的 Queue，不重新扫描历史错误补插题。

### 2.4 统计与错题事实

- `baseQuestionCount`、首次正确数、首次正确率、错题数和原有时长继续只读取 base Response；
- reinforcement 的题数、正确数和用时使用独立可重建字段；
- reinforcement 答对不改写 source Response；
- reinforcement 错误不新增独立错题项；
- reinforcement 正确不自动 resolve source mistake；
- 无 reinforcement 的旧 Completion Summary 保持原 JSON 形状。

### 2.5 页面表达

Quiz 已增加：

- “已安排 1 道相关巩固题，将在稍后出现”；
- “本轮巩固题”标签与来源说明；
- 冻结的基础题分母和单列巩固待完成数；
- 无候选时零错误码、零虚假承诺；
- `/learning/knowledge/**` 规范路由与 WP7A 唯一入口边界。

## 三、自动化验收

### 3.1 WP5

新增命令：

```text
npm run debug:knowledge-practice-wp5
```

结果：`WP5-C01—C54 = 54 / 54 PASS`。

覆盖：

- 内容关系 10 项；
- 触发与选择 12 项；
- 队列与幂等 12 项；
- 持久化与统计 12 项；
- 入口与表达 8 项。

### 3.2 WP1—WP4 与 WP7A 回归

| 回归 | 结果 |
| --- | ---: |
| WP1 数据与迁移 | 47 / 47 PASS；19 approved / 15 draft / 0 validation issue |
| WP2 Session 与选题 | 47 / 47 PASS |
| WP3 判题与反馈 | 49 / 49 PASS |
| WP4 持久化与恢复 | 33 / 33 PASS |
| WP7A 唯一入口整合 | 50 / 50 PASS |

### 3.3 正式 Learning 与 Runtime 回归

| 回归 | 结果 |
| --- | ---: |
| Phase 16.3 Unified Learning Entry | 31 / 31 PASS |
| Phase 16.3 Day 0 Integration | 15 / 15 PASS |
| Product Runtime Reliability WP-R2 | 41 / 41 PASS |
| WP-R2 Browser Matrix | 19 / 19 PASS |

### 3.4 Production Build

Vite Production Build：`PASS`。

仍存在项目既有的大 Chunk 与 ineffective dynamic import 提示；没有新增构建错误或依赖下载。

## 四、浏览器验收

验收地址：`http://127.0.0.1:5174/learning#/learning/knowledge/**`。

| 场景 | 结果 | 证据 |
| --- | --- | --- |
| 动态内容库存 | PASS | 入口动态显示审核题数量，新增内容可被 Repository 与分类入口读取 |
| 正常触发 | PASS | `q-rf-zy-2` 首次答错后显示已安排提示，Queue 增加 1 道巩固 |
| 间隔插入 | PASS | source 后先出现一道原基础题，再出现 target |
| 巩固识别 | PASS | 题卡显示“本轮巩固题”和“根据本轮一道错题安排” |
| 刷新恢复 | PASS | 在 reinforcement 未答状态刷新后，题目、来源、进度和 Queue 保持 |
| 非递归 | PASS | reinforcement 答错后会话按冻结总量完成，没有继续追加 |
| 安静降级 | PASS | 容量修正前 target 已在基础 Queue 时不插题、不报错；该真实缺口随后被内容容量修正 |
| 统计隔离 | PASS | 5 道 base 中 2 道正确显示 40%；另有 1 道 reinforcement 正确未显示成 3 / 6 或 50% |
| 双页面冲突 | PASS | 第二页面写入后旧页面显示“重新载入最新进度”，未盲合并队列 |
| 移动端 | PASS | 390px viewport override 下两次采样均为 `scrollWidth = clientWidth`，无横向溢出 |
| 越界文案 | PASS | 无“已掌握”“能力已提升”表达 |
| 控制台 | PASS | Error / Warning 为 0 |

验收会话均已自然完成，临时浏览器标签已关闭；没有通过清空 localStorage 或删除历史记录制造通过条件。

## 五、事实隔离与数据版本

本次未修改：

- 正式 81 道 Resource、Registry、Version 或 Quality Trace；
- Formal Learning Session、Diagnosis、Evidence、Profile 或 Growth Memory；
- Trial Activation、Observation 或正式教育效果分母；
- Practice Store 根 schemaVersion 和物理 key；
- `/learning` 唯一主要动作优先级。

WP5 只产生本轮 Knowledge Practice Queue、Response、Feedback 和 Completion 事实。

## 六、已知限制

1. 19 道 approved 仍不足以证明连续 5—10 轮使用不会出现明显重复或枯竭；
2. 当前只有 3 个批准变式组、6 条有向 Link，未覆盖全部知识点；
3. 无可靠 Link 的错误会正确地安静降级，不保证每道错题都有巩固；
4. 第一阶段只支持本机、本浏览器恢复；
5. WP6 完整结果摘要和下一步推荐尚未实现；
6. Product Acceptance 与 Educational Evidence 仍为 PENDING；
7. Production Build 保留既有大 Chunk 与动态导入警告。

## 七、门禁裁决

WP5 Engineering PASS 门禁全部满足：

1. D1—D10 已确认；
2. ReinforcementLink 契约与校验通过；
3. 3 个生产变式组覆盖 3 分类、3 知识点；
4. 触发、过滤、选择和插入稳定；
5. 单 source、单 Session 与非递归规则通过；
6. 提交与调度为单次 Attempt 变换；
7. 刷新、版本冻结和 revision 冲突通过；
8. 基础、巩固和错题事实隔离；
9. WP5 54 / 54；
10. WP1—WP4、WP7A 与正式 Runtime 回归通过；
11. Production Build 通过；
12. 浏览器主链、降级、恢复、冲突和响应式通过；
13. 已输出本报告和已知限制；
14. 中央文档已同步；
15. 未提前实现 WP6 长期结论或推荐。

## 八、下一状态

- WP5：`ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING`；
- WP6：`PENDING / AUTHORIZED BUT NOT STARTED`；
- WP7B：继续 `PENDING`；
- WP6 仍只能输出本轮结果、短期建议和明确下一动作，不得升级为长期掌握或能力结论。

准确声明：

> 对存在已审核变式关系的轻量知识错题，系统已能确定性、非递归、有限量地安排并恢复本轮巩固题；基础题首次表现与巩固表现保持隔离。该结果证明 WP5 工程成立，不代表真实反馈价值、长期掌握或教育效果已经通过产品验收。
