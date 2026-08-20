# 针对性短片段微训练阶段 4 全量真实浏览器联调验收

日期：`2026-08-20`  
状态：`ENGINEERING + CONTROLLED BROWSER PASS / REAL CALIBRATION PENDING`

## 一、验收结论

`B4-01—B4-16` 已在真实应用内浏览器、正式本地 Shared Store 与 `isolated_verify` 模式下逐项通过。核心题、针对性 Assignment、Frozen Resource、Attempt、Diagnosis、Evidence 与核心游标能够在刷新、重试、跨标签、末题、暂停和回滚路径中保持身份一致。

本报告只签署工程和受控浏览器闭环，不证明真实教育效果。`controlled_single_learner` 未在本轮启用，5—7 日真实观察仍为 `PENDING`。

## 二、受控资源包

- Pack：`targeted_micro_training_controlled_pack_v3`；
- Material：`12 / 12`；
- Frozen Resource：`18 / 18`；
- Active Registry：`18 / 18`；
- Material Structure / Source Anchor / Observation Plan / Resource Link：完整；
- 四类 Gap：均满足受控覆盖；
- 最新题目质量门禁：`79 / 79` 可进入新 Learning，`blocked = 0`；
- v2 已完成回滚，历史保留；v3 使用新不可变 Material 身份，未覆盖旧版本。

## 三、B4-01—B4-16 结果

| 编号 | 结果 | 浏览器证据 |
| --- | --- | --- |
| B4-01 | PASS | 核心文本题形成明确 Gap 后，只呈现一项匹配的短片段微训练。 |
| B4-02 | PASS | 核心单选错误干扰项映射到具体偏差并触发精确资源。 |
| B4-03 | PASS | Revision 资格成立时优先呈现修订入口，不创建 targeted Assignment。 |
| B4-04 | PASS | 无精确资源时静默继续核心题组，无空壳过渡、无学生错误。 |
| B4-05 | PASS | 开始后显示正确短片段、Frozen 题目与独立进度，不增加核心题分母。 |
| B4-06 | PASS | Pending 状态选择跳过后返回冻结核心游标；末题场景进入完成页。 |
| B4-07 | PASS | 刷新后恢复同一 Assignment 和同一草稿。 |
| B4-08 | PASS | 重试与另一标签页的陈旧提交未生成第二个 targeted Attempt。 |
| B4-09 | PASS | 完成后显示克制反馈并返回原核心队列位置。 |
| B4-10 | PASS | 核心末题触发微训练后，完成或跳过均进入 Session 完成页。 |
| B4-11 | PASS | Pending / In-progress 资源回滚后变为 unavailable，并安全返回核心题组。 |
| B4-12 | PASS | 两标签并发只恢复一个 in-progress Assignment。 |
| B4-13 | PASS | 调度暂停后正式 Learning 保持 Stage 3 基线，不再创建新 Assignment。 |
| B4-14 | PASS | 资源或运行错误显示在当前操作区域，保留核心进度和可恢复入口。 |
| B4-15 | PASS | 真实单选微训练显示四个选项；错误选项产生对应干扰项偏差反馈；答案键未泄露。 |
| B4-16 | PASS | 真实文本微训练完成 Validity、Diagnosis、反馈、刷新和核心返回闭环。 |

## 四、联调中发现并修复的问题

1. 隔离身份与正式学生身份可能串用：改为按浏览器验证模式解析稳定运行身份。
2. targeted 刷新恢复可能重新走普通匹配：增加活动 Assignment 版本锁定与专用恢复查询。
3. 受控包缺少完整 Observation Trace 校验：导入前新增 Structure、Anchor、Plan 和 Link 身份门禁。
4. 回滚后同一不可变包无法重复导入：允许 `rolled_back → imported`，但仍复核 Manifest 与全部身份。
5. v2 文本题存在 Rubric 要求未显式进入题干：v3 在不泄露答案的前提下补齐“文本依据 / 说明理由”动作，并使用新不可变资源身份。
6. 单选微训练难以确定性覆盖：仅在 `stage4verify=1&stage4choice=1` 的隔离验收中限制候选为 `single_choice`；正式产品不受影响。

## 五、自动化与构建

- Stage 1：`16 / 16 PASS`；
- Stage 2：`32 / 32 PASS`；
- Stage 3：`57 / 57 PASS`；
- Stage 4：`51 / 51 PASS`；
- Unified Learning Entry：`27 / 27 PASS`；
- Learning Session Task Queue：`19 / 19 PASS`；
- Reading Single-choice Stage 4 E2E：`13 / 13 PASS`；
- Learning Feedback Revision Stage 4：`19 / 19 PASS`；
- 最新正式题质量准入：`8 / 8 PASS`，活动题 `blocked = 0`；
- Production Build：`PASS`。

## 六、剩余边界

下一步不是继续扩展功能，而是在明确授权后开启固定单学生真实观察窗口。只有达到契约中的真实分母和独立 Follow-up 条件，才能判断 `CONTINUE / ADJUST / PAUSE / INSUFFICIENT DATA`；当前不得宣称能力提升或泛化已经成立。
