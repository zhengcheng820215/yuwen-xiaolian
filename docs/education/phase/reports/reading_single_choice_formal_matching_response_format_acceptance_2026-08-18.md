# 单选正式资源匹配与 Learning 投放修复验收

日期：2026-08-18  
结论：`PASS`

## 一、问题现象与根因

生产工作台已经发布合格的 `single_choice` Frozen Resource，但新 Learning 会话仍显示文本输入框。排查确认不是资源未发布、顺序未生效或 Learning 组件缺失，而是正式资源匹配层仍统一生成文本题约束：

- `questionType = open_response`；
- `responseMode = written`；
- 必需能力固定包含 `open_response / text_evidence / inference_chain`。

因此顺序规划虽然先选中了单选，匹配层仍会以“缺少开放文本能力”拒绝该 Resource Version，并继续尝试后续文本题，形成无提示的题型回退。

## 二、完成修复

1. 显式匹配 `requiredResourceVersionId` 时，从冻结版本读取 `responseFormat`；
2. `single_choice` 映射为 `multiple_choice / single_choice / single_choice_response`，不再要求 `open_response`；
3. 单选 Rubric 的可观察性由合法 `choiceInteraction`、唯一正确答案和核心评分项确认，不再依赖文本证据、解释或结论字段；
4. 文本题的 `text_evidence / inference_chain` 要求改为读取冻结 Rubric，不再只按能力名称猜测；
5. 锁定版本的难度仍位于允许区间时，Fulfillment 难度软偏好与该版本对齐，避免基础入口单选因 `lower` 与默认 `same` 的偏好差异被误降级为 `partial_match`；
6. Candidate 能力映射补充 `single_choice_response`，文本题原能力与正式链保持不变。

## 三、自动化验收

| 验收范围 | 结果 |
| --- | --- |
| 单选 Stage 4 真实材料 E2E（新增正式匹配与新会话投放） | `13 / 13 PASS` |
| Core Resource Eligibility | `12 / 12 PASS` |
| Task Fulfillment Request | `PASS` |
| Phase 17.3 Learning Entry | `16 / 16 PASS` |
| Training Task Sequence Planning | `20 / 20 PASS` |
| 单选 Stage 3 Learning / Diagnosis / 数据 | `20 / 20 PASS` |
| Phase 17.3 正式资源集成 | `17 / 17 PASS` |
| Production Build（项目配置的新 Node Runtime） | `PASS` |

## 四、真实正式资源只读验收

以当前 `.local-data/formal-resource-store.json` 做只读匹配，不写入产品数据：

- 当前可消费正式版本：`39`；
- 其中单选版本：`7`；
- 空历史的新 Training 会话匹配状态：`matched`；
- 命中版本：`question-observation-task-plan-1bb7kvk:v1`；
- Resource Version `responseFormat`：`single_choice`；
- Concrete Learning Task `responseFormat`：`single_choice`；
- 匹配问题：无。

## 五、状态恢复边界

已经开始的学习轮次继续锁定原 Resource Version，不因本次修复或后来发布的单选而被替换。修复影响的是结束当前轮次后新建的 Training 会话；新会话存在未消费的进入层单选时，应显示选项交互，而不是文本输入框。

## 六、最终结论

本次问题已经从顺序层、正式匹配层、资源能力层和 Learning Concrete Task 层完成闭环修复。合格单选不会再因文本题约束被静默过滤；文本任务仍按各自冻结 Rubric 匹配，单选之后可以正常继续进入文本训练。
