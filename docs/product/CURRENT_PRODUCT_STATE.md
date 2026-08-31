# 当前产品状态

状态：`CURRENT / ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING (0 / 5) / LIVE PENDING`

更新日期：2026-08-31

本文是当前事实的唯一快速入口。它不替代产品契约、工程实施文档或历史验收报告；当历史快照与当前事实冲突时，先以本文和 [`PRODUCT_CONTROL_TABLE.md`](./PRODUCT_CONTROL_TABLE.md) 为准，再核对相应原始证据。

## 一、当前裁决

- 学生唯一正式入口：`/learning`；
- 正式题库：24篇材料、81道 Current Frozen Resource，其中63道核心阅读、18道条件微训练；
- 轻量知识题：19道 approved、15道 draft，6个有题分类；
- 可独立成组的轻量分类：3个；
- 知识练习 WP1—WP6、WP7A、WP7B：Engineering PASS；
- WP7B Product Acceptance：0/5；
- Live / Natural-day：PENDING；
- Educational Evidence：PENDING。

## 二、角色边界

正式阅读题继续承担 Diagnosis、Evidence、Profile 与长期能力成长主线。轻量知识练习是 `/learning` 内的辅助任务家族，只描述本轮、短期、本机事实，不直接写入正式 Diagnosis、Evidence、Profile，也不生成长期能力结论。

正式81道题与轻量19道 approved 题必须分别表达，不得合并为“100道题库”。

## 三、当前工程证据

冻结工程基线提交：`5a6892e30d29634d007f2102aef481d6cd61f156`

2026-08-31 在该提交上复核：

- WP1—WP7B、Unified Entry、Day0、Runtime R2/R3/R4 与 Trial Control：539/539 PASS；
- Vite Production Build：607 modules transformed，PASS；
- `git diff --check`：PASS；
- 本地 `HEAD` 与 `origin/main` 均为该提交。

工程通过不自动升级 Product Acceptance。

## 四、当前唯一主任务

执行 WP7B-5 真实学生受控产品验收：

1. 使用冻结Build Identity的干净试用工作区；
2. 完成物理键盘Enter/Space和真实浏览器200%缩放现场补验；
3. 至少完成5次有效试用，建议至少3名不同目标学生；
4. 覆盖手机、平板、PC；
5. 按统一观察表记录入口、反馈、推荐、恢复、重复感受与内容问题；
6. 独立裁决 Product Acceptance；
7. Product PASS后再决定是否进入5—7个自然日Live观察。

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
