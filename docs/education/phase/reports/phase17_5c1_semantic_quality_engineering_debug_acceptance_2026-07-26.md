# Phase 17.5C1 独立语义质量评估工程 Debug 验收记录

日期：2026-07-26

结论：`ENGINEERING + AUTOMATED DEBUG PASS`

## 一、实现范围

本次实现建立了：

- 独立 `QuestionSemanticQualityAssessment` Schema；
- 七项语义质量 Finding 的结构校验；
- 独立 Prompt 与一次结构修复 Prompt；
- 基于现有 Provider Adapter 的语义评估运行时；
- Provider Failed、Timeout 与 Invalid Output 失败对象；
- Evidence Ref 白名单与越权指令阻断；
- Prompt、Model、Rule、Schema 与 Draft Revision 身份绑定；
- Completed Assessment 会话级幂等复用；
- 确定性与语义结果的保守合并；
- `semantic_unavailable` 状态下的 Approve / Freeze 阻断；
- Revision Required 与 Reject 的安全降级通道。

本次没有实现：

- Shared Store 持久化；
- Frozen Resource Quality Trace；
- Batch Quality Summary；
- 十篇材料校准；
- 自动审核、自动改题或自动 Freeze；
- 真实 Provider 在线质量验收。

以上内容分别属于后续 17.5C2、17.5C3 或受控 Live 验收。

## 二、专项 Debug

```text
18 / 18 PASS
```

覆盖：

1. 当前 Draft、Validation 与 Deterministic Assessment 正常形成语义结果；
2. 旧 Revision、旧 Validation 与 Material 错位在 Provider 前阻断；
3. Provider Failed、Timeout 与两次结构非法均形成克制失败对象；
4. 非 JSON 输出只允许一次结构修复；
5. 非法 Evidence Ref 被拒绝；
6. Prompt 与 Model 变化形成新请求身份；
7. Completed 结果会话级幂等；
8. Semantic Failure 不静默降级为 Pass；
9. 合并采用最保守结果；
10. Deterministic Material Fail 不会被 Semantic Pass 抵消；
11. Semantic Strong Warning 形成 Revision Recommended；
12. Semantic Unavailable 阻断 Approve / Freeze，但允许 Revision Required / Reject。

## 三、回归结果

```text
12 / 12 PASS  Phase 17.5A Deterministic Assessment
 9 / 9 PASS   Phase 17.5B Review Gate
 9 / 9 PASS   Phase 17.5B Demo Contract
```

生产构建：`PASS`

构建仅保留既有的大 Chunk 与动态导入提示，不影响本次验收。

## 四、准确声明

当前可以声明：

> 系统能够对当前合法题目 Draft 发起独立、结构化且来源受控的语义质量评估；能够区分 Provider 失败、超时和结构非法；能够将语义结果与确定性检查保守合并，并在语义评估不可用时阻断正式通过与冻结。

当前仍不能声明：

> 语义 Assessment 已进入 Shared Store、Frozen Resource 已具备质量追溯、批次质量已经可汇总，或十篇材料校准已经完成。

