# Phase 16.3 Learning 分析超时恢复收口

状态：`IMPLEMENTED / DEBUG PASSED`

## 一、问题

学生提交开放文本回答后，浏览器请求没有外层等待上限。当 Provider、网络或 Application Boundary 没有及时返回时，页面会持续显示“正在提交并分析本次回答…”，输入与操作被长期锁定，学生无法判断是否需要等待、重试或返回修改。

## 二、收口边界

本次只调整 Learning 提交的可恢复边界，不改变 Material → Task → Diagnosis → Evidence 主链，不修改 Provider 的诊断 Prompt、Rubric、模型重试策略或正式资源。

1. Diagnosis Application Boundary 增加浏览器侧总等待上限；默认值必须覆盖现有两次 Provider 尝试预算。
2. 超时统一返回可重试的结构化错误 `diagnosis_request_timeout`。
3. 页面收到可重试错误后必须退出忙碌态，并保留当前文本或单选答案草稿。
4. 页面提供“重新分析”和“返回修改”，不得要求学生刷新或重新作答。
5. 重试复用原 Operation、Response 和 Diagnosis Request 身份；不得重复形成 Evidence。
6. 已超时请求的迟到结果不得回写旧页面状态；若服务端已按相同 requestId 正式提交，后续重试复用既有提交。
7. Runtime 状态读取同样使用较短的有限等待，但状态读取超时只投射为服务暂不可用。

## 三、Debug 验收

- T01：Diagnosis 在上限内成功，正式结果保持原行为。
- T02：Diagnosis 超过上限，抛出 `diagnosis_request_timeout` 且 `retryable=true`。
- T03：超时后 AbortSignal 已触发，浏览器不继续等待迟到响应。
- T04：HTTP 失败仍保留原有错误码与 retryable 语义。
- T05：单选仍走本地确定性 Diagnosis，不受网络等待上限影响。
- T06：Learning 捕获可重试错误后保存草稿、解除 busy，并显示重新分析/返回修改。
- T07：Production Build 与 Phase 16.3 Diagnosis Boundary 回归通过。

## 四、零回归原则

本次新语义只在“提交已发出但 Application Boundary 未及时完成”时生效。正常提交、无效回答、正式阻断、资源匹配失败、Revision、Targeted Micro-training、Retest 与 Transfer 均保持现有语义。

## 五、验收结果

- 超时恢复专项：`6 / 6 PASS`；
- 原 Diagnosis Application Boundary：`3 / 3 PASS`；
- Phase 16.3A 正式学习主链：`20 / 20 PASS`；
- Production Build：通过；
- Learning 入口只读浏览器检查：正常加载，现有 Session 完成态可读取；
- 未执行真实学生提交，未新增 Diagnosis、Evidence 或 Profile 数据。
