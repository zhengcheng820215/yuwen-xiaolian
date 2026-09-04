# 当前产品状态

英文名称：Current Product State

文档类型：`CURRENT_CONTROL`

状态：`CURRENT / ENGINEERING PASS / CURRENT GOVERNANCE BATCH FROZEN IN GIT / PRODUCT ACCEPTANCE PENDING (0 / 5) / LIVE NOT STARTED`

状态轴：`Design = NOT_APPLICABLE / Engineering = PASS / Product Acceptance = PENDING / Live = PENDING`

更新日期：2026-09-04

本文是当前事实的唯一快速入口，也是当前运行状态的唯一文档入口。产品文档的类型、生命周期和权威顺序遵循[产品文档治理契约](./PRODUCT_DOCUMENT_GOVERNANCE_CONTRACT.md)，完整登记见[产品文档权威清单](./PRODUCT_DOCUMENT_AUTHORITY_MANIFEST.md)。它不替代产品契约、工程实施文档或历史验收报告；当历史快照与当前事实冲突时，按以下顺序裁决：

```text
实时 Runtime Health / 当前 Runtime Identity / 当前 Trial Binding
→ 本文最近一次采样结论
→ 产品负责人控制表
→ 阶段契约与验收报告
→ 历史激活、审计与校准记录
```

实时事实高于文档快照；本文不能凭文档描述重新激活 Trial。只有当前 Runtime Identity、Provider、Formal Store、Launch Record 与 Trial Binding 联合复读通过后，才允许将状态更新为 `REAL TRIAL ACTIVE`。

## 一、当前裁决

- 学生唯一正式入口：`/learning`；
- 正式题库：24篇材料、81道 Current Frozen Resource，其中63道核心阅读、18道条件微训练；
- 轻量知识题：19道 approved、15道 draft，6个有题分类；
- 可独立成组的轻量分类：3个；
- 知识练习 WP1—WP6、WP7A、WP7B：Engineering PASS；
- WP7B Product Acceptance：0/5；
- Live / Natural-day：`NOT STARTED / PENDING PRODUCT ACCEPTANCE`；
- Educational Evidence：PENDING。

## 二、角色边界

正式阅读题继续承担 Diagnosis、Evidence、Profile 与长期能力成长主线。轻量知识练习是 `/learning` 内的辅助任务家族，只描述本轮、短期、本机事实，不直接写入正式 Diagnosis、Evidence、Profile，也不生成长期能力结论。

正式81道题与轻量19道 approved 题必须分别表达，不得合并为“100道题库”。

## 三、当前工程证据

最近一次完整冻结验收基线提交：`5a6892e30d29634d007f2102aef481d6cd61f156`

本轮教材目标校准、基础练习任务原子性校准、正式内容窄范围治理及关联实现，随本文所在 Git Commit 一并冻结。当前可复读源码身份以 `git rev-parse HEAD` 与干净工作区联合确认；该 Commit 不自动成为新的 Trial Build，只有重新执行 Runtime / Provider / Formal Store / Launch Record / Trial Binding 准入后，才能替代最近一次完整冻结验收基线。

2026-08-31 在最近一次完整冻结验收基线上复核：

- WP1—WP7B、Unified Entry、Day0、Runtime R2/R3/R4 与 Trial Control：539/539 PASS；
- Vite Production Build：607 modules transformed，PASS；
- `git diff --check`：PASS；
- 该次受控 Trial 当时以该冻结 Build Identity 为准；Revision 1964 正式治理后该身份已失效，当前不得继续作为 Trial 准入身份。

2026-09-04 文档治理采样：

- `docs/product` 共112份 Markdown，机器治理审计确认112/112唯一登记、相对链接有效且当前状态入口唯一；
- 文档语义审计与产品主张证据审计均为 PASS，向上推断继续被阻断，文档治理写入正式产品数据为0；
- 当前正式资源仍为24篇材料、81道 Current Frozen Resource；文档治理不得写入或覆盖 Formal Store；
- 本轮治理提交与最近一次完整冻结验收基线不同，且尚未重新完成 Trial 准入；
- 最新局部工程通过不能替代统一主链、Production Build 与真实 Trial 的重新准入。

2026-09-04 基础练习任务原子性工程验收：

- `FA-01—FA-08` 专项 `8 / 8 PASS`，关联负担规划、题组梯度、教材校准、草稿生成与单选回归合计 `326 / 326 PASS`；
- Production Build 通过，Formal Store 前后哈希一致，正式数据写入为 `0`，Live Provider 调用为 `0`；
- 该结果只关闭本轮 Engineering 验收门，并随本文所在 Git Commit 冻结；Product Acceptance 仍为 `0 / 5`，Live 仍未开始。

2026-09-04 正式内容窄范围治理：

- 只治理《皇帝的新装》两道命中 `composite_core_actions` 的 Current Frozen Resource，以 successor 版本分别收敛为“共同反应—社会风气”和“威胁性话术—隐瞒附和—骗局持续”单一观察链；
- Formal Store Revision 由 `1963` 原子更新为 `1964`，当前正式资源仍为 `24` 篇材料、`81` 道 Current Frozen Resource、`81` 条 Frozen Quality Trace、`81` 道 Learning 可消费题目；
- 治理后全量正式题 `blocked = 0`、`guided = 15`、`ready = 66`，两道 successor 不再命中复合核心动作或负担身份风险；
- 原版本已转为 `superseded`，既有历史身份继续可追溯；本次正式资源身份变化使旧 Runtime Identity、Launch Record 与 Trial Binding 失效，不构成 Trial 自动重新激活。

2026-09-04 当前本地基线收口：

- 四份负担规划、教材校准与任务原子性 Debug 已移除开发机绝对路径，当前工作区复读为 `48 / 48`、`59 / 59`、`22 / 22`、`8 / 8 PASS`；
- 本地 Formal Store 已从 Revision `1963` 原子治理到 `1964`，重复执行为 `apply-noop`；当前仍为 `24` 篇材料、`81` 道题、`66 ready / 15 guided / 0 blocked`；
- Vite Production Build 为 `608 modules transformed`，Runtime Identity 内容摘要为 `sha256:07be4093a008c15535d1735752982831d0e41e1d1ba9f5c805b78f94e5f8da6a`；
- Runtime 启动预检为 `CHECK_DEGRADED`，唯一原因是 `ai_provider_not_configured`；本地基线收口只恢复可复现 Engineering / Runtime Identity 前提，Provider 与 Trial Identity Binding 仍为 `PENDING`，Trial 保持 `off`。

工程通过不自动升级 Product Acceptance。

## 四、当前唯一主任务

完成 P4 Trial 重新准入门禁，再执行 WP7B-5 真实学生受控产品验收：

1. 复读当前 clean Runtime Identity 与 Revision 1964 Formal Store；
2. 经独立授权完成 Provider 真实可用性检查；
3. 创建与当前 Runtime Identity 一致的 Preflight、Launch Record 与 Trial Identity Binding；
4. 在显式激活前保持 Trial `off`；
5. 准入通过后完成物理键盘、真实浏览器200%缩放及至少5次受控学生试用；
6. 独立裁决 Product Acceptance，PASS 后再决定是否进入5—7个自然日 Live 观察。

WP7B-5 是 P4 `knowledge_practice_single_entry` 主张及 Batch E01—E02 的限定验收子批次，不代表 P4 总体完成，也不替代 P4 Batch B、C、D 对核心阅读连续题组、反馈修订、微训练、事件链和恢复能力的独立验收。这里的“当前唯一主任务”只表示当前执行焦点，不改变 P4 中 P0—P2 的产品风险分级。

试用执行包：[`KNOWLEDGE_PRACTICE_PHASE1_WP7B5_CONTROLLED_STUDENT_TRIAL_PREPARATION.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP7B5_CONTROLLED_STUDENT_TRIAL_PREPARATION.md)

## 五、当前限制

- 知识练习只保存于本机、本浏览器；
- 三个轻量分类仍为“内容准备中”；
- 字音与文言专项连续使用存在较高的库存必要重复；
- 当前构建存在大chunk与无效动态导入警告；
- 真实学生对反馈价值和下一步理解尚无有效样本。

## 六、禁止性声明

在WP7B Product Acceptance完成前，不得宣称：

- 第一阶段已经通过真实学生可用性验证；
- 学生反馈效果已经成立；
- 学生能力已经改善；
- 系统已经进入Live；
- 100道内容目标已经成为固定产品门禁。

## 七、更新触发条件

Git Commit、Production Artifact、Formal Store、Provider、Runtime、Trial Binding 或 Product Acceptance 任一发生变化时，必须重新采样相应状态。更新必须记录事实来源，不得复制历史 PASS 或历史 Trial 结论作为当前证明。
