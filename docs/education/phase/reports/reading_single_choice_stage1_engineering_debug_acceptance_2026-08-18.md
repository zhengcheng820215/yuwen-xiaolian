# 阅读训练单项选择阶段 1 工程与 Debug 验收

日期：`2026-08-18`

状态：`STAGE 1 ENGINEERING + DEBUG PASS`

## 一、验收范围

本次只验收单项选择的第一阶段 Schema 与领域校验底座：

- `single_choice` 选择交互、稳定 `optionId` 和 `optionSetVersion`；
- 3–5 个选项、唯一正确答案和逐项干扰依据；
- 每个错误选项对应独立、可解释的典型偏差；
- 单选专用最低响应要求和结构化 Student Response；
- 学生 Delivery Projection 只包含题干所需选项，不包含答案键和干扰项内部依据；
- QuestionCandidate、Question Draft、Frozen Version、Editable Fields Hash 和版本复制链；
- 既有短文本、长文本 Candidate、Draft、发布与 Learning 主链兼容。

本阶段不实现 AI 自动生成单选 Candidate、生产工作台展示、Learning 单选控件、Diagnosis 映射、真实数据 Projection 或端到端试用。因此 `single_choice` 仍不能进入正式产品可执行能力集合。

## 二、工程产物

| 类型 | 文件 / 结果 |
| --- | --- |
| Choice Schema 与校验 | `src/ai/schemas/singleChoiceInteraction.schema.ts` |
| Candidate 校验 | `src/ai/schemas/questionCandidate.schema.ts` |
| Draft / Frozen Version Schema | `src/ai/schemas/questionResourceAdmission.schema.ts` |
| Admission Validation / Freeze | `src/ai/agents/questionResourceAdmissionAgent.ts` |
| Answer Acceptance | `src/ai/schemas/diagnosis.schema.ts` |
| 内容哈希与工作态复制 | `src/ai/schemas/workingTaskContent.schema.ts` |
| Candidate 服务字段映射 | `src/ai/agents/questionCandidateService.ts` |
| 专项 Debug | `src/ai/tests/runReadingSingleChoiceStage1Debug.ts` |

## 三、冻结的数据边界

1. 正确答案、学生选择和干扰项关系都只以稳定 `optionId` 保存，不以 A/B/C/D 或选项文字作为身份。
2. 学生响应同时绑定 `optionSetVersion` 与当次 `displayedOptionOrder`，选项换序不改变答案身份。
3. 新单选正式内容禁止继续写入历史 `options?: string[]`；旧字段仅保留只读兼容诊断。
4. 选择交互属于不可变题目内容。选项、答案键或干扰依据变化都会改变内容哈希，并要求形成新 Candidate / Revision / Frozen Version。
5. 文本题最低字数规则保持不变；单选使用“一次结构化选择”，不伪造文本长度。
6. Student Delivery Projection 不包含 `correctOptionIds`、`distractorRationales` 或 misconception 内部依据。

## 四、Debug 结果

| 验收组 | 结果 | 核心覆盖 |
| --- | ---: | --- |
| Single-choice Stage 1 专项 Debug | `21 / 21 PASS` | Schema、稳定身份、唯一正确答案、干扰项、学生投影、响应、Candidate、Draft、Freeze、文本兼容、内容哈希 |
| Question Resource Admission | `29 / 29 PASS` | Validation、Review、Freeze、版本、幂等、正式 Revision |
| Question Candidate Workflow | `12 / 12 PASS` | 不可变 Candidate、采用、重生、上下文漂移和批次状态 |
| Working Task Content | `13 / 13 PASS` | 工作态、哈希、恢复、冲突和旧记录迁移 |
| Resource Coverage | `22 / 22 PASS` | 当前单选产品能力继续保持 blocked，不提前进入正式覆盖 |
| Phase 1–16.2 Single-object E2E | `6 / 6 PASS` | 既有正式文本题从资源到 Learning 的单对象主链 |
| Candidate Optimization | `10 / 10 PASS` | 优化候选字段约束、幂等和上下文一致性 |
| Question Workflow Projection | `PASS` | 工作流只读投影兼容 |
| Question Publication Recovery | `3 / 3 PASS` | Frozen Version 与 Active Link 发布恢复 |
| Production Build | `PASS` | Vite 生产构建成功 |

自动化回归共 `116 / 116` 个显式用例通过，另有 Question Workflow Projection 专项通过。构建仅保留既有大 Chunk 与动态导入提示，没有新增构建错误。

## 五、Debug 中发现并修复的问题

既有 Admission 回归要求“缺失选择项”继续返回稳定的 `content.options_required` 诊断。新结构已经通过 `choice.interaction_required` 正确阻断，但旧断言无法识别新错误码。工程补充了兼容诊断：只有在新 `choiceInteraction` 和旧 `options` 同时缺失时返回旧错误码；不会允许历史字符串选项进入新的单选正式资源。

## 六、验收结论

阶段 1 已达到工程落地与 Debug 验收标准，可以作为阶段 2“AI 生成与生产工作台”的正式底座。稳定选项身份、答案键隔离、干扰项完整性和不可变版本边界已建立，既有文本题生产及 Learning 主链未发生回归。

阶段 1 PASS 不等于功能已经可供学生使用。阶段 2 必须在当前 Schema 上生成完整 Candidate 并接入现有采用发布链；阶段 3 才能开放 Learning、Diagnosis 与真实数据；阶段 4 完成端到端联调后，资源覆盖能力才可从 blocked 调整为 executable。
