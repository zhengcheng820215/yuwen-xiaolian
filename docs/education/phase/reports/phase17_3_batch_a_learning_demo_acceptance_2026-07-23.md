# Phase 17.3 Batch A `/learning` 人工 Demo 验收记录

日期：2026-07-23

验收结论：`PASS（单轮正式学习链；下一资源缺口已记录）`

## 一、验收目标

验证已完成 Review、Freeze、Registry 和 active Observation Link 的 Batch A 正式资源，能够从 `/learning` 进入真实学习链，并保持：

```text
Formal Material / Resource
-> Concrete Task
-> StudentResponse
-> Real Diagnosis
-> Formal Diagnosis Commit
-> AbilityEvidence
-> Student Learning Narrative
-> Next Resource Resolution
```

本次验收不用于宣称完整 24—28 道资源包、连续多轮路径或 Phase 17 最终 PASS。

## 二、正式验收对象

- 页面：`/learning`
- Material：`站台上的蓝布包`
- Resource Version：`phase17-batch-a-resource-station-analysis-training:v2`
- Ability：`analysis`
- TaskRole：`training`
- 题目：结合父亲在车站中的具体表现，分析他是一个怎样的父亲。
- 作答类型：完整有效答案，包含人物特点、具体动作和关系说明

## 三、可见验收结果

1. `/learning` 展示了 Batch A 正式材料、正式题目和“分析”能力目标；
2. 真实 Provider 返回结果通过 Formal Commit，`answerStatus = fully_meets`；
3. 本轮生成 `1` 条正式 AbilityEvidence；
4. 学生反馈同时回应了“细心”这一人物特点和“裹好水杯、扣紧肩带”这一材料动作；
5. 反馈正确使用“人物特点”，没有将本题误写为人物心理题；
6. 完整答案不再被错误标记为缺少文本依据或解释关系；
7. 刷新后复用同一 Session、Round、Diagnosis Request 和 Formal Diagnosis，Evidence 数量保持 `1`；
8. 下一任务无兼容正式资源时进入安全阻断，没有拿 Ability 或 TaskRole 错位资源凑匹配。

脱敏覆盖追溯：

```text
conclusion: covered
text_evidence: covered
reasoning_relation: covered
```

## 四、验收中完成的修复

1. 正式 Frozen Resource 的 Rubric accepted signals 进入 ConcreteTask scoring points 与 reference signals；
2. 学生证据识别同时支持受控评分信号匹配和材料可核验动作句匹配；
3. `fully_meets`、Rubric 命中、具体动作与关系表达同时成立时，不再被旧泛化文本制造假缺口；
4. Student Thinking Analysis 根据题目目标区分人物特点、人物心理等表达；
5. “已经完成的思考”同时回应结论与具体材料依据，不再只复述一个关键词；
6. 内部验收页增加脱敏评分信号和反馈覆盖追溯，不显示完整学生答案、Prompt、Raw Output 或 Secret。

## 五、自动验收

| 验收项 | 结果 |
| --- | --- |
| Phase 17.3 Learning Entry Debug | `5 / 5 PASS` |
| Phase 17.3 Batch A Integration Debug | `17 / 17 PASS` |
| Controlled Feedback Expression | `62 / 62 PASS` |
| Student Thinking Analysis | `5 / 5 PASS` |
| Student Feedback Action Plan | `8 / 8 PASS` |
| Production Build | `PASS` |

既有 Controlled DeepSeek Live 仍为 `3 / 3 PASS`，本次刷新验收未重新调用 Provider。

## 六、保留边界

1. 当前 Batch A 单轮任务已通过，但下一项 Strategy 请求尚无兼容资源，因此进入 `blocked / prepare_resource`；
2. 该状态表示需要补充正式资源，不表示系统正在后台自动生成；
3. 资源补齐后只重新执行匹配，不得重复 Diagnosis 或 Evidence；
4. 完整 24—28 道资源包、第二条 Retest / Transfer 链、跨 Ability 路径和自然日运行仍未完成；
5. 因此本记录只把 Phase 17.3 Product Acceptance 更新为 `BATCH A /LEARNING DEMO PASS`，不更新为最终 `PASS / FROZEN`。

