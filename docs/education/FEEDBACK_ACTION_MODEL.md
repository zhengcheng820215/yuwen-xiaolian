# 反馈行动转换模型（Feedback Action Model）

**Status:** DETERMINISTIC V1 IMPLEMENTED

## 文档定位

本文档定义系统如何把 `StudentThinkingAnalysis` 与 `Learning Gap` 转换为学生能够理解和执行的反馈，不重新诊断、不生成能力结论，也不直接给出完整答案。

## 核心链路

```text
Diagnosis Result / Requirement Coverage
↓
Learning Gap
+ StudentThinkingAnalysis
↓
StudentFeedbackActionPlan
↓
Student Learning Narrative
```

## 学生反馈结构

### 1. 已经完成的思考

回答两个问题：

- 学生已经完成了哪个具体答案或思考动作？
- 这个动作为什么有助于完成当前题目？

肯定必须能够回到学生原始答案，不使用无依据的“理解得很好”。

### 2. 思考缺口

不只说“缺少依据”，还应说明：

- 当前答案从哪一步直接跳到了哪一步；
- 缺少这个连接会使读者无法判断什么；
- 该判断是可观察问题，还是仍待验证的原因假设。

### 3. 下一步训练

优先提供思考支架，而不是把标准答案拆成机械填写步骤：

- 提出一个指向关键连接的思考问题；
- 必要时提供不含完整答案的句式支架；
- 避免连续输出“先找、再写、最后合并”式答案组装清单。

示例：

```text
想一想：父亲为什么会停留很久？这个动作除了说明他珍惜树叶，还表现了怎样的心理？

可以按“人物……，这个动作说明……，因此表现出……”重新组织答案。
```

## 禁止表达

- 你的答案不够完整；
- 缺少细节；
- 需要深入分析；
- 加强理解；
- 仅复述“找动作、说明关系”而不点明当前答案的具体断点；
- 把一次表现写成固定能力标签。

## 校验要求

- `acknowledgedAction` 必须引用已核验学生表现；
- `whyItMatters` 必须说明与本题要求的关系；
- `problemMechanism` 必须来自可追溯的思考断点；
- `thinkingPrompt` 必须推动学生补上关键连接；
- Scaffold 不得泄露完整结论；
- 无效作答只请求完成有效回答，不生成虚构肯定或具体能力缺口。
