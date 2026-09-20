# Phase 16.3 提交后恢复契约

状态：工程实现约束。适用于正式 `/learning` 的阅读理解提交，不改变 Diagnosis、Evidence 或正式资源的领域边界。

## 一、权威事实

- `StudentResponse` 与 `RealLearningOperationCheckpoint` 记录本次提交及处理进度；页面输入框不是提交后的恢复依据。
- `retry_required` 表示后续处理未完成，不表示答案未提交，也不表示正式学习结果已保存。
- 只有 `FormalDiagnosisCommit` 已提交且通过准入，才能跳过 Diagnosis。失败的 Runtime Result 可以保留用于排障，但不能作为已完成诊断的缓存。
- 只有正式 `LearningPersistenceRecord` 已完成，才能呈现反馈或进入下一题；此后恢复不得重复诊断、生成 Evidence 或更新 Profile。

## 二、恢复动作

| 已保存阶段 | 恢复动作 | 学生看到的结果 |
| --- | --- | --- |
| 作答尚未通过有效性检查 | 继续编辑原答案 | 补充回答；不调用 Provider |
| 作答已验证，诊断未正式提交 | 复用同一 Operation、Response、Diagnosis Request 重试诊断 | 正在分析；失败时可重试 |
| 诊断已正式提交，后续反馈或持久化未完成 | 从 checkpoint 继续剩余阶段 | 不重复诊断或正式 Evidence |
| 本题正式结果已保存，下一题尚未准备好 | 仅恢复下一题准入 | 显示本题反馈及下一题准备状态 |
| 本题与下一题均已准备好 | 读取已保存结果 | 显示反馈或继续下一题 |

恢复命令必须从持久化的 `StudentResponse` 读取原答案、原提交时间和身份，不依赖当前输入框，也不再执行页面提交前的校验与 `answer_submitted` 记录。若缺失可信的已提交作答，明确停止恢复并提示返回学习入口，不得凭草稿伪造提交。重复点击、刷新与迟到响应不得增加正式结果数量。

## 三、失败与展示

- Provider 超时、暂时不可用或返回 `failed`：保留可重试 checkpoint；重试时重新执行 Diagnosis，不沿用失败结果进入 Admission。
- 浏览器的整条提交等待也有上限；到期只解除页面等待并查询最新 checkpoint，不撤销可能仍在完成的正式写入，不把超时误报为“未提交”。
- 观测事件补偿与渐进校准重试不属于本题正式结果的提交条件；页面加载和提交结果展示不得等待这些后台补偿。继续处理也须有限等待，并从持久化 checkpoint 恢复。
- 题目明确给出最低字数时，在启动提交前提示补充；该页面门槛不替代领域层的作答有效性判定。
- Evidence sidecar 或正式结果写入失败：保留已经成功的正式诊断，从失败阶段继续写入。
- `review_required`、正式阻断和资源缺口不得伪装为通用“恢复本次提交”。
- 学生页面只展示“正在分析”“处理未完成，可重试”“结果已保存，继续学习”等可操作信息；具体 `stage / nextAction / issue code` 仅供本地 checkpoint 排障查询，不展示答案内容。

## 四、验收

1. 诊断失败后重试成功，Provider 被重新调用，正式 Diagnosis / Evidence / 学习结果各只有一份。
2. 浏览器请求超时或刷新后，从同一已保存作答恢复，不要求重新输入，不重复 `answer_submitted`。
3. 反馈或持久化失败后恢复，不重新执行已提交 Diagnosis。
4. 正式结果已保存时直接进入反馈或下一题准备，不回到提交态。
5. 缺失已提交作答时安全阻断；不能把草稿当作已提交事实。

既有超时处理基线见 [Learning 分析超时恢复收口](./reports/phase16_3_learning_analysis_timeout_recovery_2026-08-28.md)。
