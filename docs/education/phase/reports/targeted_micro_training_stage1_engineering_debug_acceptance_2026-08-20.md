# 针对性短片段微训练阶段 1 工程与 Debug 验收（2026-08-20）

## 一、范围

本阶段只实现 Schema、历史兼容投影、持久化写入校验与幂等身份，不接入生产工作台、资源匹配或 Learning 动态调度。

已实现：

- `core_reading / targeted_excerpt` Material 用途；
- `TargetedExcerptMetadata`、独立内容哈希与 Source Anchor；
- 四类首批 `TargetedGapReasonCode`；
- `TargetedMicroTrainingRequest / Assignment`；
- `studentId + sourceAttemptId + gapReasonCode` 确定性 Request 身份；
- `requestId + resourceVersionId` 确定性 Assignment 身份；
- 内存、IndexedDB、本地共享 API 三类正式资源 Repository 写入前校验；
- 历史 Material 缺少用途字段时只读投影为 `core_reading`，不回写旧版本。

明确未实现：

- 不创建首批短片段资源；
- 不修改工作台；
- 不从 Diagnosis 自动触发 Request；
- 不匹配 Registry；
- 不改变固定 Session Task Queue；
- 不向学生展示“针对性练习”。

## 二、结构边界

1. `targeted_excerpt` 必须具有独立 `contentHash` 和完整元数据；
2. `same_material_excerpt` 必须具有 `parentMaterialId` 和有效 Source Anchor；
3. 只接受 `missing_text_evidence / missing_reasoning_relation / conclusion_inconsistent / incomplete_task_requirement`；
4. `insufficient_to_judge` 和宏观能力弱项不能进入 Request；
5. Request 固定使用 `training` 且 `maxTaskCount = 1`；
6. Assignment 必须保留正整数 `returnToCoreTaskNumber`；
7. 重复 Anchor、非法范围、错误身份或缺失哈希均被确定性阻断。

## 三、专项 Debug

`runTargetedMicroTrainingStage1Debug.ts`：`16 / 16 PASS`。

覆盖：

- 历史 Material 默认投影且不发生对象变更；
- 历史 Material 原样持久化与恢复；
- 三类短片段来源边界；
- 内容哈希、Gap、元数据和 Source Anchor 门禁；
- Request / Assignment 有效样本；
- Request 重试幂等、不同 Gap 身份隔离；
- `insufficient_to_judge`、错误 Role、多任务请求和重复 Anchor 阻断；
- Repository 阻断畸形短片段。

## 四、整体回归

| 验收项 | 结果 |
| --- | --- |
| Question Resource Admission | `29 / 29 PASS` |
| Material Observation | `29 / 29 PASS` |
| Material Resource Production | `16 / 16 PASS` |
| Resource Coverage / Registry | `22 / 22 PASS` |
| Learning Session Task Queue | `19 / 19 PASS` |
| Phase 17.3 Learning Entry | `16 / 16 PASS` |
| Shared Formal Resource Persistence | `14 / 14 PASS` |
| Reading Single-choice Real-material E2E | `13 / 13 PASS` |
| Vite Production Build | `PASS` |

共享持久化专项在受限沙箱内首次因不能监听 `127.0.0.1` 出现 `EPERM`；获准使用本机临时回环测试服务后重跑 `14 / 14 PASS`，确认不是产品代码故障。

构建保留既有大 Chunk 和同一模块同时动态、静态导入提示，与本阶段无关，不构成功能阻断。

## 五、当前真实快照兼容核对

对 `.local-data/formal-resource-store.json` 进行只读核对：

- Material Version：`47`；
- 活动 Material Version：`12`；
- 活动 Registry：`61`；
- 历史 Material 中显式 `usageType`：`0`；
- 兼容投影为 `core_reading`：`47 / 47`；
- Material 用途结构错误：`0`。

本次验收未改写本地正式资源快照，现有 12 篇活动材料与 61 道活动题目身份保持不变。

## 六、结论

阶段 1 工程与 Debug 验收通过，状态标记为：

`STAGE 1 ENGINEERING PASS / STAGES 2–4 NOT STARTED`

可以进入阶段 2 的生产工作台与首批短片段资源开发，但不得把当前状态描述为“微训练已经在 Learning 中可用”。
