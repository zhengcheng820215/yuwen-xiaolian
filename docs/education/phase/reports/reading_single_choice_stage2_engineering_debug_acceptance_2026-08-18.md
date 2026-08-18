# 阅读训练单项选择阶段 2 工程与 Debug 验收

日期：`2026-08-18`

状态：`STAGE 2 ENGINEERING + DEBUG PASS`

## 一、验收范围

本阶段只验收 AI 生成与资源生产端闭环：

- 由 Training Task / Observation Plan 决定 `responseFormat`，不设置单选题配额，也不固定单选题排第一；
- AI 在一次生成中返回完整 `single_choice` QuestionCandidate；
- 结构校验之外增加训练动作适配和干扰项生成质量门禁；
- 工作台展示题干与全部选项，但不暴露答案键和干扰项内部依据；
- 人只执行“采用并发布”或“不采用并重新优化”；
- 采用后继续进入既有 Candidate → Revision → Validation → Assessment → Publish 主链；
- 生成失败、采用中断和发布失败继续使用既有幂等与阶段恢复语义；
- 现有文本题生成、正式资源和发布行为保持不变。

本阶段不实现 Learning 单选控件、学生提交、Diagnosis、Attempt 或真实数据 Projection。因此 `single_choice` 仍不得进入正式 Learning 可执行能力集合。

## 二、工程产物

| 类型 | 文件 / 结果 |
| --- | --- |
| 训练动作与干扰项生成策略 | `src/ai/agents/singleChoiceGenerationPolicy.ts` |
| AI 输出 Schema 与解析 | `src/ai/schemas/materialObservationDraftGenerator.schema.ts`、`src/ai/agents/materialObservationDraftGeneratorAgent.ts` |
| 生成 Prompt | `src/ai/prompts/materialObservationDraftPrompt.ts` |
| Observation Plan 与 Draft 同步 | `src/ai/agents/materialObservationAgent.ts`、`src/ai/agents/materialObservationApplicationService.ts` |
| 生成质量门禁 | `src/ai/agents/questionGenerationQualityPolicyAgent.ts`、`src/ai/schemas/questionGenerationQuality.schema.ts` |
| 工作台展示与采用发布 | `src/pages/MaterialResourceProductionWorkbench.jsx` |
| 工作台脱敏投影 | `src/pages/singleChoiceCandidatePresentation.ts` |
| 语义质量与补充候选透传 | `src/ai/agents/questionSemanticQualityAssessmentAgent.ts`、`src/ai/agents/questionPortfolioSupplementCandidateAgent.ts`、`src/ai/agents/questionPortfolioSupplementPublicationAgent.ts` |
| 版本哈希与语料优化透传 | `src/ai/agents/questionOptimizationBaselineAgent.ts`、`src/ai/agents/materialCorpusOptimizationAgent.ts` |
| 阶段 2 专项 Debug | `src/ai/tests/runReadingSingleChoiceStage2Debug.ts` |

## 三、已冻结的生成决策

1. `single_choice` 只用于一次明确判断即可观察的基础或局部训练动作；概括、多证据整合、推理链、人物/主题分析和开放表达继续使用文本作答。
2. 不设置“每篇至少一道单选”或固定比例；题组没有单选 Candidate 是合法结果。
3. 不固定单选题排第一；生成结果和任务排序继续由 Observation Plan 决定。
4. 单选 Candidate 必须原子包含 3–5 个稳定选项、唯一答案键、逐项干扰依据、Accepted Option、`exact_match` 和结构化最低响应要求。
5. 每个错误项必须对应独立且可解释的偏差，并说明材料证据边界；重复偏差、明显长度提示和高阶训练动作错配均会被阻断。
6. 工作台学生式预览只展示选项内容和当次显示序号，不展示 `correctOptionIds`、`distractorRationales` 或内部评分信号。
7. 人不编辑选项、不指定正确答案、不填写审核意见；不采用时生成新 Candidate，采用时进入既有正式化编排。

## 四、阶段 2 验收矩阵结果

| 编号 | 结果 | 验收证据 |
| --- | --- | --- |
| S2-01 基础训练动作生成完整单选 | PASS | 完整 Provider 输出解析及 Candidate 校验 |
| S2-02 高阶训练动作保持文本 | PASS | 概括、密集 Rubric 和开放分析适配门禁 |
| S2-03 同篇允许没有单选 | PASS | 文本-only 生成不受题型配额影响 |
| S2-04 单选不固定排首位 | PASS | Candidate 顺序保持 Provider / Plan 顺序 |
| S2-05 缺少错误项依据 | PASS | 结构与生成质量双门禁阻断 |
| S2-06 重复偏差 | PASS | misconception 独立性校验阻断 |
| S2-07 Accepted Option 错位 | PASS | acceptedOptionIds 与答案键身份一致性校验 |
| S2-08 工作台不泄露答案 | PASS | 脱敏 Preview 只含选项显示字段 |
| S2-09 不采用并重新优化 | PASS | Candidate 重生成形成新身份，正式资源不变 |
| S2-10 采用并发布 | PASS | 单选 Candidate 经既有资源链校验并 Freeze |
| S2-11 发布中断恢复 | PASS | 已完成阶段复用，不重复 Revision 或 Formal Version |
| S2-12 文本 Candidate 无回归 | PASS | 生成器、Candidate、Admission 与 Observation 回归 |
| S2-13 错误不暴露内部英文 | PASS | 工作台错误码统一映射为产品级重新优化表达 |
| S2-14 运行态与主按钮互斥 | PASS | 既有 Workbench P4 状态投影与组件运行分支 |

## 五、Debug 与构建结果

| 验收组 | 结果 |
| --- | ---: |
| Single-choice Stage 2 专项 Debug | `14 / 14 PASS` |
| Single-choice Stage 1 回归 | `21 / 21 PASS` |
| Material Observation Draft Generator | `41 / 41 PASS` |
| Material Observation Plan / Resource | `29 / 29 PASS` |
| Question Generation Quality Policy | `8 / 8 PASS` |
| Question Resource Admission | `29 / 29 PASS` |
| Question Candidate Workflow | `12 / 12 PASS` |
| Question Candidate Workbench P4 | `16 / 16 PASS` |
| Question Publication Recovery | `3 / 3 PASS` |
| Material Resource Production Commands | `16 / 16 PASS` |
| Production Build | `PASS` |

本轮共 `189 / 189` 个显式用例通过。生产构建只保留既有动态导入和大 Chunk 提示，没有新增构建错误。

## 六、联调说明

已尝试通过应用内浏览器打开本地资源生产工作台进行额外可视化验收，但浏览器安全策略阻止了本次 localhost 页面接管。未绕过该策略。工作台相关边界由阶段 2 专项 Preview 脱敏测试、Question Candidate Workbench P4、Material Resource Production Commands 和 Production Build 共同覆盖；该限制不影响本阶段代码、自动化或构建结论。

## 七、验收结论

阶段 2 已达到 `ENGINEERING + DEBUG PASS`：AI 能够按训练动作选择作答格式并生成完整单选 Candidate，生成质量门禁、工作台脱敏展示、重新优化和采用发布链均已接入；文本题和既有正式资源链无回归。

当前可以进入阶段 3 的 Learning、Diagnosis 与真实数据工程，但不得提前宣称学生端已经支持单选题。只有阶段 3 和阶段 4 完成端到端验收后，资源覆盖能力才可从 blocked 调整为 executable。
