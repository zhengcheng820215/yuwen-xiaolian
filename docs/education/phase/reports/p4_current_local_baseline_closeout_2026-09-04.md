# P4 当前本地基线收口记录

日期：2026-09-04

状态轴：`Engineering = PASS / Runtime Identity = PASS / Provider = PENDING / Trial Binding = PENDING / Product Acceptance = PENDING / Live = OFF`

## 一、收口范围

本次只完成当前本地工作区的跨机器可复现性、Formal Store Revision 1964 对齐、中央控制面同步、Production Build 与 Runtime Identity 复读。未执行外部 Provider 调用，未创建或激活 Trial Window，未提交真实学生答案。

## 二、路径可复现性

以下 Debug 入口已由开发机绝对路径改为基于 `import.meta.url` 推导仓库根目录：

- `runReadingTrainingProgressionStage2Debug.ts`；
- `runReadingTrainingProgressionStage3Debug.ts`；
- `runTextbookObjectiveCalibrationTaskGroupCorrectionDebug.ts`；
- `runFoundationalExerciseTaskAtomicityCalibrationDebug.ts`。

当前工作区复读结果：

| 验收组 | 结果 |
| --- | ---: |
| Reading Training Progression Stage 2 | `48 / 48 PASS` |
| Reading Training Progression Stage 3 | `59 / 59 PASS` |
| Textbook Objective Calibration | `22 / 22 PASS` |
| Foundational Exercise Task Atomicity | `8 / 8 PASS` |

## 三、Formal Store 对齐

治理预演只命中《皇帝的新装》两道既定资源。正式执行结果：

| 项目 | 结果 |
| --- | --- |
| Revision | `1963 → 1964` |
| successor | `question-observation-task-plan-19178y4:v5`、`question-observation-task-plan-z8hqcb:v6` |
| 重复执行 | `apply-noop`，Revision 保持 `1964` |
| 正式材料 | `24` |
| Current / Learning 可消费题目 | `81 / 81` |
| 质量分布 | `66 ready / 15 guided / 0 blocked` |
| 本地文件 SHA-256 | `4dcb1989b135a0bd1564b6a3d39a0b100926897fa934070849130dd8f6c3d9ae` |

本地文件哈希包含环境时间与命令回执，不作为跨环境 Runtime Identity。Runtime Identity 使用去除易变字段后的正式资源快照摘要。

## 四、构建与运行身份

- Vite Production Build：`608 modules transformed / PASS`；
- `git diff --check`：`PASS`；
- Runtime Identity Digest：`sha256:07be4093a008c15535d1735752982831d0e41e1d1ba9f5c805b78f94e5f8da6a`；
- Formal Resource Snapshot Digest：`sha256:8aab84fdc5139dd1364ea73b1de34d5a239fbe638549b5d6ddbe0eefc2bb87cf`；
- Formal Store Revision：`1964`；
- Trial requested / effective：`off / off`。

Runtime Identity 的工作树状态只检查实际身份输入路径；仓库根目录中与产品构建无关的个人未跟踪文件不参与身份，也不因此阻断可复现构建。未跟踪产品源码仍会被判为 `dirty`。

## 五、裁决

P4 当前本地基线收口达到 Engineering 与 Runtime Identity PASS。旧 Runtime Identity、Launch Record 与 Trial Binding 继续失效；Provider 真实可用性和 Trial Identity Binding 仍为独立 `PENDING` 门禁，不能由本记录上推为真实 Trial 已准入、学生体验已通过或教育效果成立。
