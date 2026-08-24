# 阅读训练递进负担阶段 4 全量真实浏览器联调验收

日期：`2026-08-24`
状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED / REAL CALIBRATION NOT STARTED`

## 一、验收结论

`B4-01—B4-16` 已在真实应用内浏览器中逐项执行并通过，结果为 `16 / 16 PASS`。验收入口调用正式 Governance Schema、既有治理 Agent、Session 版本解析、校准事件仓库与版本级投影服务，但运行数据限定在隔离内存环境。

本次签署证明阶段 4 的 successor 治理、版本消费、事件失败隔离、Outbox 幂等、校准状态投影和正常产品隔离边界成立；不证明真实样本已经充分，不构成真实校准完成或教育效果证明。

## 二、运行入口与数据边界

- 验收入口：`/internal/acceptance/reading-training-progression-stage4`；
- Internal Review：`/internal/reading-training-progression-stage4`；
- 正常录入端：`/material-resource-workbench`；
- 正常学习端：`/learning`；
- 运行范围：`in_memory_isolated`；
- 正式 Frozen Resource 写入：`0`；
- Student Attempt 写入：`0`；
- Student Profile 写入：`0`；
- 真实校准分母写入：`0`。

## 三、B4-01—B4-16 人工联调结果

| 编号 | 结果 | 浏览器证据 |
| --- | --- | --- |
| B4-01 | PASS | 只读基线只保存版本身份与 Finding，不复制正式题正文，也不修改正式资源。 |
| B4-02 | PASS | 单个受控 Case 经既有 Candidate Gateway 形成完整 successor Candidate 身份。 |
| B4-03 | PASS | candidate-ready 状态只提供“重新生成”和“采用并发布”，没有新增审核或保存步骤。 |
| B4-04 | PASS | blocked 与 stale 均在原卡说明原因，并明确“原题保持不变”。 |
| B4-05 | PASS | 点击“采用并发布”后，探针区域只剩 `1` 个“正在发布…”按钮，且按钮不可重复点击。 |
| B4-06 | PASS | 发布结果同时保留 predecessor `resource-v1` 与 successor `resource-v2` 身份。 |
| B4-07 | PASS | 已开始 Session 继续消费 predecessor。 |
| B4-08 | PASS | 新 Session 从 Registry Head 消费 successor。 |
| B4-09 | PASS | 页面刷新后重新运行仍为唯一 `published` 状态，没有重复发布。 |
| B4-10 | PASS | 回滚仅切换 Head；predecessor 与 successor 版本身份继续保留。 |
| B4-11 | PASS | 校准仓库失败被隔离为 `dropped`，不阻断提交、反馈或下一题。 |
| B4-12 | PASS | 相同事件恢复重放第一次为 `created`、第二次为 `unchanged`，不重复计数。 |
| B4-13 | PASS | `awaiting_data`、`collecting`、`insufficient_sample` 与 `review_ready` 四种边界均被投射。 |
| B4-14 | PASS | Internal Acceptance 事件不构成真实独立首答，真实分母保持 `0`。 |
| B4-15 | PASS | Internal Review 只展示版本事实、样本完整性和限制；当前治理与真实投影均为 `0`，不宣称能力或教育效果。 |
| B4-16 | PASS | 正常录入端与 Learning 端均可加载，且不出现 B4、Governance、Calibration、Plan Hash 或阶段 4 测试面板。 |

## 四、刷新重放与正常页面复核

1. 首次完成矩阵后刷新验收页面，再次执行仍为 `16 / 16 PASS`；
2. 刷新重放后四类写入仍为 `0 / 0 / 0 / 0`；
3. blocked / stale 原位说明刷新后仍存在；
4. 正常录入端显示“素材与题目生产工作台”，正常 Learning 入口可恢复，二者均无内部验收字段；
5. Internal Review 明确显示“内部观察 · 不面向学生”“不据此直接判断学生能力或教育效果”与“尚无合格真实样本”。

## 五、联调中发现并修正的问题

正式签署前发现原 B4-05 验收实现实际检查的是“Candidate 生成幂等”，没有覆盖契约冻结的“publishing 时唯一进行中按钮”。本次先校正验收入口：

1. B4-04 增加 blocked / stale 可见原位说明；
2. B4-05 改为采用态唯一 `continue_publication`，并增加真实按钮交互探针；
3. B4-13 补齐 `insufficient_sample`，不再只检查 awaiting / collecting / review-ready；
4. 修正后重新执行专项 Debug、Production Build、页面刷新重放与完整 B4 矩阵。

## 六、自动化与旧主链证据

- 阶段 4专项 Debug：`64 / 64 PASS`；
- B4-01—B4-16：`16 / 16 PASS`；
- 阶段 0 / 1 / 2 / 3：`24 / 24`、`40 / 40`、`48 / 48`、`59 / 59 PASS`；
- Learning Session Queue：`21 / 21 PASS`；
- Phase 16.3 Real Learning Chain：`17 / 17 PASS`；
- 开放文本负担阶段 4：`56 / 56 PASS`；
- 单项选择阶段 4：`13 / 13 PASS`；
- Targeted Micro-training 阶段 4：`51 / 51 PASS`；
- Production Build：PASS，仅保留既有 bundle size 与静态 / 动态导入提示。

## 七、剩余边界

阶段 4 已达到 `FULL BROWSER ACCEPTED`。下一步可以进入小批次真实使用，观察事件完整性与版本级样本；在真实数据达到当时策略门槛并完成人工复核前，状态继续保持 `REAL CALIBRATION NOT STARTED`，不得宣称 `PILOT DATA SUFFICIENT`、`REAL CALIBRATION COMPLETE` 或 `EDUCATIONAL EFFECT PROVEN`。
