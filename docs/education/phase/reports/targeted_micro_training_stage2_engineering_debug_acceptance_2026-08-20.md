# 针对性短片段微训练阶段 2 工程与 Debug 验收（2026-08-20）

结论：`STAGE 2 RESOURCE PRODUCTION PASS / LEARNING SCHEDULING NOT STARTED`

## 一、工程范围

阶段 2 已完成：

- Material 创建、修订与正式持久化保留 `usageType / contentHash / contentNormalizationPolicyVersion / targetedExcerptMetadata`；
- `targeted_excerpt` 正式 Material 的必要元数据缺一即阻断；
- `material_content_normalization_v1` 与确定性内容哈希；
- Observation Plan、Question Candidate、Frozen Version、Registry 和 Resource Observation Link 的专项身份贯通；
- 工作台区分核心阅读材料与针对性短片段，并只读展示 Ability、Gap、来源关系和预计题数；
- AI 规划仅生成 `1–2` 个 `training` 任务，并校验目标 Ability、唯一主要 Gap、材料身份与来源关系；
- 四类 Gap 的资源覆盖统计与 `Gap × Ability` 矩阵；
- 首批受控短片段资源包及隔离正式生产链验收。

阶段 2 未实现：

- 不从 Diagnosis 自动创建 Request；
- 不匹配 Assignment；
- 不改变固定 Session Task Queue；
- 不在 Learning 动态插入或消费微训练；
- 不迁移当前用户正式资源快照。

## 二、首批资源包

隔离验收链共生产：

- `12` 份独立 `targeted_excerpt` Material；
- `18` 道正式结构资源；
- `missing_text_evidence / missing_reasoning_relation / conclusion_inconsistent / incomplete_task_requirement` 各 `3` 份 Material；
- 每类 Gap 均至少有 `3` 道活动 Registry 资源；
- 每份 Material 为 `1–2` 道题，且均为 `training` Role；
- `6` 份 Material 含第二道互补任务，总数因此为 `18` 道。

该资源包只用于隔离工程验收，没有写入当前用户的活动正式资源库。当前 `12` 篇核心材料、`61` 道活动题目保持不变。

## 三、专项 Debug

`runTargetedMicroTrainingStage2Debug.ts`：`32 / 32 PASS`。

覆盖 Material → Plan → Review → Draft → Review → Frozen → Registry → Observation Link 全链，包含：

- 正常创建、修订与用途继承；
- 元数据缺失、哈希不一致、用途静默切换阻断；
- 目标 Ability、Gap、Role、题数与材料身份门禁；
- Frozen / Registry / Observation Link 身份追踪；
- 四类 Gap 最小覆盖和 Gap × Ability 矩阵；
- 资源包幂等生产；
- 当前核心正式快照不被改写。

## 四、整体回归

| 验收项 | 结果 |
| --- | --- |
| Targeted Micro-training Stage 1 | `16 / 16 PASS` |
| Targeted Micro-training Stage 2 | `32 / 32 PASS` |
| Material Observation Draft Generator | `44 / 44 PASS` |
| Question Candidate Workflow | `12 / 12 PASS` |
| Resource Coverage / Registry | `22 / 22 PASS` |
| Material Observation | `29 / 29 PASS` |
| Material Resource Production | `16 / 16 PASS` |
| Reading Single-choice Stage 1–4 | `85 / 85 PASS` |
| Learning Session Task Queue | `19 / 19 PASS` |
| Phase 17.3 Learning Entry | `16 / 16 PASS` |
| Learning Persistence | `13 / 13 PASS` |
| Shared Formal Resource Cross-tab + Atomic Command | `24 / 24 PASS` |
| Student Learning Narrative | `31 / 31 PASS` |
| Training Task Group Planning | `PASS` |
| Vite Production Build | `PASS` |

具名计数合计：`359 / 359 PASS`，另有 Training Task Group Planning 与生产构建通过。

## 五、真实浏览器验收

在资料生产工作台完成只读验收：

- 当前正式基线显示 `12` 篇材料、`61` 道已发布题目；
- 历史材料均兼容显示为“核心阅读材料”；
- 材料选择器、当前材料标题和任务卡用途展示正常；
- 既有文本题与单选题正常渲染；
- 浏览器控制台无错误与警告；
- 未为演示而向活动正式库写入短片段资源。

## 六、冻结边界

1. 普通自由录入入口继续创建核心阅读材料；受控短片段由资源包或正式生产 API 创建，避免把 Ability、Gap 和哈希变成人工配置步骤。
2. 阶段 2 通过只证明短片段资源可被生产、审查、发布和追踪。
3. Diagnosis 触发、Request、Assignment、Learning 插入、返回核心题组与效果验证属于阶段 3–4，当前不得宣称已上线。
4. 后续进入阶段 3 前，必须继续保持首次核心表现与微训练 Attempt / Evidence 分离。
