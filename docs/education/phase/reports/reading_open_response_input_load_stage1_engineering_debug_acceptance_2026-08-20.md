# 阅读开放文本题输入负担阶段 1 工程与 Debug 验收报告

状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED`

验收日期：`2026-08-20`

## 一、交付范围

阶段 1 已完成以下旁路、只读能力：

- `readingOpenResponseInputLoad.schema.ts`：负担等级、规范动作、Finding、治理建议与运行时守卫；
- `readingOpenResponseInputLoadAnalyzer.ts`：不调用模型、不读取仓储的确定性单题分析器；
- `readingOpenResponseTaskGroupLoadAuditAgent.ts`：保持原顺序的题组梯度审计器；
- `readingOpenResponseInputLoadBaselineAuditService.ts`：活动正式题库只读基线服务与 Markdown 渲染器；
- `runReadingOpenResponseInputLoadStage1Debug.ts`：S1-01—S1-28 专项 Debug；
- `debug:reading-open-response-load-stage1`：专项执行入口。

没有修改 Prompt、Planner、发布门禁、Learning 页面、正式题或 Student Ability Profile。

## 二、专项 Debug

执行：

```text
node --experimental-strip-types --experimental-specifier-resolution=node src/ai/tests/runReadingOpenResponseInputLoadStage1Debug.ts
```

结果：`28 / 28 PASS`。

覆盖内容包括：单选排除、四级画像、复合动作、隐藏 Rubric、证据范围、最低字数、responseFormat、确定性、低置信度保护、合法顺序例外、重复观察、真实题库全量审计和零写入隔离。

真实基线：24 份活动材料、79 道正式题、62 道开放文本题、17 道单选；62 道开放文本题全部完整分析。

Source Digest：`fnv1a-65117aad`

Audit Digest：`fnv1a-adf815ec`

## 三、构建与相关主链回归

| 验收项 | 结果 |
| --- | --- |
| Vite production build | PASS |
| Question Resource Admission | 29 / 29 PASS |
| Training Task Sequence Planning | 20 / 20 PASS |
| Learning Session Task Queue | 21 / 21 PASS |
| Student Ability Profile | PASS |
| Formal Resource Version Upgrade | 6 / 6 PASS |

构建只保留既有动态导入和大 chunk 提示，没有新增构建失败。

## 四、写入隔离

S1-24—S1-26 已在真实 Snapshot 上比较审计前后状态：

- Formal Version、Registry、Observation Link 不变；
- Learning Session、Attempt 不变；
- Student Ability Profile 不变。

基线服务只返回派生对象和 Digest，不持有写仓储能力。

## 五、残余风险

1. 当前分析器属于确定性规则基线，不是最终生成门禁；高风险 Finding 仍需在阶段 2 固定样例中复核误判率；
2. 题库存在 18 条缺少冻结质量轨迹与 18 条 Learning 身份不一致的既有问题；它们未由阶段 1 引入，也未被阶段 1 静默修复；
3. `expectedAnswerLengthBand` 仍是内部设计提示，后续阶段不得把它直接显示为学生字数目标；
4. 阶段 1 没有修改现有正式题。任何治理必须生成后继 Candidate，并继续遵守显式采用边界。

## 六、验收结论

阶段 1 的工程交付、确定性、真实基线覆盖、生产构建、相关主链回归与零写入隔离均通过，可以作为阶段 2 Planner / Prompt 对照开发的稳定输入。

该结论不等于现有题目已经优化，也不授权绕过 Candidate → Adopt → Revision → Publish 主链。
