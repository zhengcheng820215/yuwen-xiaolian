# Phase 17.5 题干优化与检查时效补强记录

日期：2026-07-27

结论：`ENGINEERING + AUTOMATED DEBUG + BROWSER CHECK PASS`

## 一、问题

题目审核平台已经能够指出“材料依据不明确”等质量提醒，但内容人员只能手工修改题干。引入 AI 辅助后还需要解决两个边界问题：

1. AI 只能提出题干改写建议，不能顺带改变能力、Observation、难度、Rubric 或 Answer Acceptance；
2. 题干发生变化后，上一次质量检查已经不再代表当前内容，不能继续显示为当前结论或用于提交审核。

同时，旧版材料依据规则没有把合法的“第 N 段”引用识别为明确依据，容易出现题干已补充段落范围、页面却仍保留旧提醒的体验冲突。

## 二、实现

新增受控题干优化链：

```text
Current Question Draft
+ Current Material Version
+ Current Quality Warnings
↓
Question Stem Optimization Boundary
↓
DeepSeek Provider
↓
Structure / Material Reference Validation
↓
Editable Suggestion Preview
↓
Human Apply
↓
Save Draft Revision
↓
Revalidate + Reassess
```

实现内容：

- 新增独立 `QuestionStemOptimizationInput / Result` Contract；
- Prompt 明确限定“只改题干”，禁止修改材料、能力、观察重点、难度和评分标准；
- Provider 输出必须通过 JSON 结构、长度、非原样返回、段落范围和原文引用检查；
- 首次输出不合格时只允许一次定向修复，不重跑整批题目；
- 审核页提供“AI 优化题干”，先展示建议、调整理由和变化说明，人工确认后才写入编辑表单；
- AI 建议不自动保存、不自动重新检查、不自动提交审核；
- 手工修改或采用 AI 建议后，旧质量结果立即标记为失效，页面显示“题干已修改，等待重新检查”，提交审核保持不可用；
- 保存并重新检查后，才使用当前 Draft Revision 生成新的质量结论。

## 三、材料依据规则 v2

`QUESTION_QUALITY_RULE_VERSION` 升级为 `question_quality_rules_v2`。

材料依据检查现在：

- 将材料中真实存在的“第 N 段”或“第 N—M 段”识别为明确材料范围；
- 段落号小于 1、结束段早于开始段或超出材料段落总数时，形成强提醒；
- 继续支持材料原句引用和连续材料锚点；
- 不因题干出现泛化的“结合材料”就自动判定为充分依据。

这项调整修复的是 Provider 建议与确定性检查之间的 Contract 对齐，不放宽材料证据要求。

## 四、正式边界

```text
AI Suggestion
≠ Saved Draft
≠ Current Quality Assessment
≠ Human Review Decision
≠ Frozen Resource
```

AI 优化完成后仍出现旧提醒，不再被视为正常的当前状态。页面必须区分：

- 仅生成建议：正式 Draft 与质量结果均未变化；
- 已采用建议但未保存检查：旧结果失效，显示等待重新检查；
- 已保存并检查：展示绑定当前 Revision 的新结果；
- 新结果仍有提醒：说明当前题干仍未满足对应规则，需要继续人工判断或修改。

## 五、验收

自动化结果：

```text
Question Quality Assessment       14 / 14 PASS
Question Stem Optimization         5 / 5 PASS
Production Build                       PASS
```

题干优化专项覆盖：

1. 合法建议正常返回；
2. 材料缺失时不调用 Provider；
3. 原样返回被拒绝并定向重试；
4. 越界段落被拦截并定向重试；
5. Prompt 明确限制只修改题干。

质量检查新增覆盖：

1. 合法段落引用通过材料依据检查；
2. 超出材料范围的段落引用形成强提醒。

浏览器检查确认：

- 修改题干后旧“七项检查均通过”不再继续显示；
- 页面改为显示“题干已修改，等待重新检查”；
- 在保存并重新检查前，提交审核按钮不可用；
- 刷新后未保存的人工测试内容不会污染正式草稿。

构建保留既有动态导入和大 Chunk 提示，均为非阻断项。

## 六、准确声明

当前可以声明：

> 题目审核平台能够针对当前材料和质量提醒生成受控的题干改写建议；人工采用建议后，系统会使旧质量结果失效，并要求保存和重新检查当前 Revision 后才能继续审核。

当前不能声明：

- AI 能够自动修复所有题目质量问题；
- AI 建议已经等同于人工审核；
- 题干优化可以修改能力、Rubric 或 Answer Acceptance；
- 通过确定性检查已经证明题目具有真实教学效果；
- Phase 17.5 的真实十素材校准已经完成。
