# 阅读训练递进负担阶段 3 全量真实浏览器联调验收

日期：`2026-08-24`
状态：`IMPLEMENTED / DEBUG ACCEPTED / FULL BROWSER ACCEPTED / REAL CALIBRATION PENDING`

## 一、验收结论

`B3-01—B3-16` 已在真实应用内浏览器中逐项通过，结果为 `16 / 16 PASS`。联调入口调用正式 Scheduler、Learning Context Resolver、Performance Observation、Progression Instability、Evidence Admission 与旁路持久化服务，但使用隔离内存 Fixture；没有写入正式资源、学生作答、学生能力画像或真实校准分母。

本次联调证明阶段 3 工程链路、兼容降级和学生端投射边界成立，不证明教育效果，也不构成真实学生校准。

## 二、运行入口与隔离边界

- 验收入口：`/internal/acceptance/reading-training-progression-stage3`；
- Repository：隔离 `InMemoryLearningProgressionRepository`；
- 页面恢复：仅用当前标签页 `sessionStorage` 保存验收报告；
- 正式 Frozen Resource 写入：`0`；
- 正式 Student Attempt 写入：`0`；
- Student Profile 写入：`0`；
- 真实校准样本：`0`。

## 三、B3-01—B3-16 结果

| 编号 | 结果 | 浏览器证据 |
| --- | --- | --- |
| B3-01 | PASS | 原生 Plan 按正式 rank 将基础单选排在文本依据题之前。 |
| B3-02 | PASS | 第一题 Snapshot 保留正式资源身份与序列位置。 |
| B3-03 | PASS | 中途刷新按 Attempt ID 恢复相同不可变 Snapshot。 |
| B3-04 | PASS | 分批发布时只消费已发布成员，并保持其正式相对顺序。 |
| B3-05 | PASS | 历史题组缺少原生 Metadata 时继续走旧 Scheduler 兼容路径。 |
| B3-06 | PASS | `holistic_first` 服从正式计划，不被题型偏好再次改排。 |
| B3-07 | PASS | 同组可从 `single_choice` 连续进入 `short_text`。 |
| B3-08 | PASS | Initial Attempt 的学生反馈使用自然语言，不暴露内部归因代码。 |
| B3-09 | PASS | Revision 标记为支持下表现，不替代首次独立表现。 |
| B3-10 | PASS | Targeted 使用独立支持身份，返回后核心正式顺序不变。 |
| B3-11 | PASS | Retest / Transfer 不参与 Training 坡度重排。 |
| B3-12 | PASS | Artifact 缺失时 Authority 降级，Context 不具备可比较资格，学习不阻断。 |
| B3-13 | PASS | Context、Observation、Assessment 与 Admission 可从隔离仓库恢复。 |
| B3-14 | PASS | 当前题、总题数和下一题都来自实际正式序列。 |
| B3-15 | PASS | Context、Observation、Assessment、Evidence Context 与 Admission 身份可追踪。 |
| B3-16 | PASS | 正常 `/learning` 页面没有隔离测试面板、Plan Hash、Admission 或内部阶段码。 |

## 四、正式学习入口只读复核

真实浏览器返回 `/learning` 后，原有未完成题组仍显示“已完成 1 题、当前第 2 题”；点击继续进入《走一步，再走一步》第 `2 / 4` 题。刷新后回到可继续状态并仍指向第 2 题，没有提交答案或改写正式学习记录。

## 五、联调中发现并修复的问题

1. 隔离验收器最初调用了不存在的运行服务方法，已改为现有正式接口 `persistEvidenceSidecar`；
2. B3-12 初始断言把仓库的空值协议误写为 `undefined`，而正式接口返回 `null`。已按契约修正为“Authority 为 `null` 且 Context 不可比较”，没有修改正式 Scheduler 的安全降级逻辑；
3. 修正后重新运行完整矩阵，并验证页面刷新后仍恢复 `16 / 16`。

## 六、自动化与旧链零回归

- 阶段 3：`59 / 59 PASS`；
- 阶段 0：`24 / 24 PASS`；
- 阶段 1：`40 / 40 PASS`；
- 阶段 2：`48 / 48 PASS`；
- Learning Session Queue：`21 / 21 PASS`；
- Phase 16.3 Real Learning Chain：`17 / 17 PASS`；
- Training Task Sequence Planning：`20 / 20 PASS`；
- Learning Persistence：`13 / 13 PASS`；
- Training Evidence：PASS；
- Production Build：PASS，仅保留既有 bundle size 与 dynamic import 提示。

## 七、剩余边界

阶段 3 的工程、Debug 和全量浏览器联调已经完成，可以进入阶段 4。阶段 4 仍须坚持 successor Candidate 治理和真实校准边界；历史 Frozen Resource 不原地覆盖，教育效果保持 `REAL CALIBRATION PENDING`。
