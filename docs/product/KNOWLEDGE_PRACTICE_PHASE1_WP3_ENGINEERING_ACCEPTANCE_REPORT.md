# 知识练习第一阶段 WP3 工程验收报告

状态：`ENGINEERING PASS`

版本：`knowledge_practice_phase1_wp3_engineering_acceptance_v1.0`

日期：`2026-08-29`

实施依据：[`KNOWLEDGE_PRACTICE_PHASE1_WP3_RESPONSE_EVALUATION_AND_FEEDBACK_PLAN.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP3_RESPONSE_EVALUATION_AND_FEEDBACK_PLAN.md)

## 一、验收结论

WP3“判题、响应与逐题反馈”已达到工程通过标准。知识练习的判题、Response创建、幂等、Queue锁定和反馈构建已从Quiz页面迁移到可独立测试的领域层；学生必须先选择或填写答案，再显式提交，提交后获得针对本次答案的结构化反馈。

本结论只代表WP3工程验收通过。刷新恢复仍归WP4，错题变式归WP5，最终结果摘要归WP6，81道正式阅读题的统一入口归WP7。

## 二、交付能力

- `PracticeResponse v1`：冻结Session、Queue Item、Question、内容版本、首次答案、正确性、错因、时长与时间；
- `PracticeAttempt v1`：聚合WP2 Session、Responses和Feedback，不原位修改Session v1契约；
- 三类题型纯判题：单选/判断按Option ID，填空按严格答案、acceptedAnswers和声明式规范化；
- 无效输入：空白、纯标点、非法Option、超长、控制字符、异常时间和异常duration受控拒绝；
- 幂等提交：`sessionId + queueItemId`唯一，重复请求返回首次事实；
- 原子状态：Response、Feedback和Queue answered一次生成，不产生半完成状态；
- 内容版本保护：Repository题目版本与Queue冻结版本不一致时不判题；
- 反馈：使用当前错误选项解析、正确依据、审核错因和1—3条步骤；
- 内容降级：缺少独立解析时使用稳定通用文案并记录fallback code，不临时编造；
- 实际时长：记录题目呈现到首次有效提交，单题上限30分钟；
- 页面拆分：题卡、答案输入、反馈卡和底部动作组件独立；
- 错题兼容：仅新建错误Response时写入一次现有错题Adapter；
- 键盘与非颜色表达：Option和动作支持Enter/Space，结果同时提供明确文字。

## 三、自动化证据

| 检查 | 结果 |
| --- | --- |
| WP3输入、判题、Response、幂等、反馈、Attempt校验 | `49 / 49 PASS` |
| WP2回归 | `47 / 47 PASS` |
| WP1回归 | `47 / 47 PASS` |
| 题库门禁 | `27 migrated / 12 approved / 15 draft / 0 error / 0 warning` |
| Vite生产构建 | `PASS`，593 modules transformed |

生产构建仍报告既有动态导入与大chunk提示；不是WP3新增错误，不阻断本工作包。

## 四、浏览器验收证据

| 场景 | 结果 |
| --- | --- |
| 单选显式提交 | 未选择时提交禁用；选择A后可改B；提交后全部选项锁定 |
| 错项针对性反馈 | 错选“骇人听闻”后准确解释其不适用原因，并展示正确依据与三步方法 |
| 判断题 | 按固定Option ID选择，显式提交后显示文字结果与依据 |
| 填空题 | 纯标点提交按钮禁用；带首尾空格和句末标点的显式等价答案正确匹配 |
| 反馈停留 | 提交后不自动跳题，必须点击下一题或查看结果 |
| 错题兼容 | 错误答案、正确答案、知识点和解析均在错题页正确呈现 |
| 结果兼容 | 单题错误正确显示`0/1`、`0%`和1道错题 |
| 键盘 | Enter完成选项选择和提交并展示反馈 |
| 手机宽度 | 390×844下无横向溢出，底部主动作宽350px |
| 控制台 | `0 error / 0 warning` |

## 五、代码交付位置

- `src/domain/knowledge-practice/response/`：类型、身份、输入校验、判题、反馈、Attempt校验、原子提交与状态；
- `src/context/PracticeSessionContext.jsx`：Attempt唯一运行事实与同步ref，抵御快速重复提交；
- `src/components/knowledge-practice/`：题卡、答案输入、反馈和动作组件；
- `src/pages/Quiz.jsx`：只做页面编排、草稿输入、领域命令调用和旧结果兼容；
- `src/ai/tests/runKnowledgePracticeWP3Debug.ts`：49项WP3验收测试；
- `package.json`：`debug:knowledge-practice-wp3`命令。

## 六、关键问题处理

1. 页面原`answered`布尔值和`records`数组已移除，Attempt成为唯一作答事实；
2. 选择题由“点击即提交”改为“先选择、后显式提交”；
3. 快速重复提交通过同步Attempt ref与领域responseKey双层幂等；
4. 错题写入只发生在`outcome=created && isCorrect=false`时；
5. 反馈焦点在提交后移动到可感知反馈区域；
6. 纯标点填空在UI层禁用，同时领域层继续阻断绕过请求。

## 七、已知限制

1. Attempt仍在React内存中，刷新、关闭和重新进入后的恢复由WP4实现；
2. 错题记录仍使用StudyContext兼容结构，持久化与变式巩固分别归WP4、WP5；
3. 结果页仍显示“本次得分”，最终首次正确率、真实总用时和推荐重构归WP6；
4. 当前知识练习Repository仍为12道approved轻量知识题；81道正式阅读题保持正式Learning契约，WP7只统一入口与推荐；
5. 当前没有审核通过的variantGroup，WP3不会触发巩固题。

## 八、交接结论

WP3向WP4交付可JSON序列化并可校验的PracticeAttempt、稳定Response身份、首次作答事实、结构化Feedback和实际作答时间。WP4应保存和恢复整个Attempt，不得只保存Session后重新判题或重建Response。
