# P4 当前本地基线收口记录

日期：2026-09-04

状态轴：`Engineering = PASS / Runtime Identity = PASS / Provider = PASS / Preflight + Launch + Trial Binding = PASS / Trial Activation = ACTIVE / Product Acceptance = PENDING / Live = NOT STARTED`

## 一、收口范围

本记录先完成当前本地工作区的跨机器可复现性、Formal Store Revision 1964 对齐、Production Build 与 Runtime Identity 复读；随后在独立授权下执行 1 次 DeepSeek 真实 Provider Smoke，创建 Preflight、Launch Record 和 Trial Identity Binding，并在第二次独立授权下显式激活同范围 Trial。未提交真实学生答案，未生成 Observation Event。

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
- Runtime Identity Digest：`sha256:62056231c38d1463e7870f9b7b29ea7c3dfec4142fa9158fdf3b639190ee7197`；
- Formal Resource Snapshot Digest：`sha256:8aab84fdc5139dd1364ea73b1de34d5a239fbe638549b5d6ddbe0eefc2bb87cf`；
- Formal Store Revision：`1964`；
- Trial requested / effective：`real_trial / real_trial`。
- Runtime Health：`overallStatus = ready / instance = ready / formalResourceStore = ready / aiProvider = configured + live_verified / learning = ready / trial identity = aligned`，`summaryReasonCodes = []`。

Runtime Identity 的工作树状态只检查实际身份输入路径；仓库根目录中与产品构建无关的个人未跟踪文件不参与身份，也不因此阻断可复现构建。未跟踪产品源码仍会被判为 `dirty`。

## 五、Provider Smoke 与重新准入

DeepSeek 真实 Provider Smoke 使用虚构、非学生数据输入，仅发起 1 次真实生成调用：

| 项目 | 结果 |
| --- | --- |
| Provider / Model | `deepseek / deepseek-v4-flash` |
| Model discovery | HTTP `200`，账户模型列表包含目标模型 |
| 真实调用 | `1` |
| 延迟 / Token | `2078 ms / 2377 total tokens` |
| Smoke 门禁 | `LIVE-001—LIVE-005 = 5 / 5 PASS` |
| 隐私 | 日志未输出 API Key、完整 Prompt、原始模型输出或学生答案 |

Provider 通过后，R4-P01—R4-P24 以当前 clean Runtime Identity 执行为 `24 / 24 PASS`，并原子保存：

- Trial Window：`real-trial-639190ee7197-1788530431552`；
- Preflight：与上述 Window 及 Runtime Identity 交叉绑定，`eligibleForActivation = true`；
- Launch Record：`trial-reentry-launch-814804ae`，`status = approved_to_activate`；
- Trial Identity Binding：`trial-runtime-binding-c7b800c3`；
- 页面刷新后仍可复读 Preflight 与 Launch Record；
- 经用户独立授权后执行显式确认，服务端 `product-runtime-trial-control.json` 已持久化上述三项身份，`activatedAt = 2026-09-04T14:01:09.526Z`；
- 页面刷新与 Runtime Health 均复读为 `requestedMode = real_trial / effectiveMode = real_trial / identityAlignment = aligned`；
- Formal Store 保持 Revision `1964`、24 篇材料和 81 道题；Observation Event 保持 `0`，激活未创建 Session、Attempt、Diagnosis、Evidence 或学生作答。Activation Audit 按契约追加 1 条。

## 六、裁决

P4 当前本地基线、Runtime Identity、DeepSeek 真实 Provider 可用性、准入包与显式激活均达到对应工程门禁。当前只能表述为“限定范围 Trial 已激活”，不得表述为真实学生体验已通过、已进入自然日 Live 或教育效果成立。下一主任务是 WP7B-5 真实学生受控产品验收。
