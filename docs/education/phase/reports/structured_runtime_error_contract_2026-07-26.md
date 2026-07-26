# Structured Runtime Error Contract 补强记录

日期：2026-07-26

## 目标

为题目录入、素材生产、质量审核和 Shared Store 正式资源链路建立最小结构化错误契约，使系统能够稳定回答：

- 发生了什么类型的错误；
- 错误发生在哪个操作；
- 哪个对象受到影响；
- 当前是否可以重试，以及应该如何恢复。

本次补强不建设完整日志平台，不改变正式资源业务语义。

## 最小契约

每个结构化运行时错误至少包含：

```ts
{
  code: StructuredRuntimeErrorCode;
  message: string;
  operation: string;
  objectId?: string;
  recoverability: RuntimeErrorRecoverability;
}
```

`message` 面向当前操作者，允许继续优化文案；`code`、`operation`、`objectId` 和 `recoverability` 构成稳定工程契约。

## 首批错误码

- `FORMAL_RESOURCE_IMMUTABLE_CONFLICT`
- `FORMAL_RESOURCE_REVISION_CONFLICT`
- `FORMAL_RESOURCE_NOT_FOUND`
- `INVALID_STATE_TRANSITION`
- `VALIDATION_REQUIRED`
- `VALIDATION_FAILED`
- `VALIDATION_STALE`
- `QUALITY_ASSESSMENT_REQUIRED`
- `SHARED_STORE_UNAVAILABLE`
- `OPERATION_NOT_ALLOWED`
- `INPUT_INVALID`
- `RUNTIME_OPERATION_FAILED`

恢复类型包括直接重试、刷新后重试、用户修正、创建新修订、恢复服务和人工检查。

## 工程接入

已接入：

- Question Resource Workbench 错误提示；
- Material Resource Production Workbench 错误提示；
- Question Resource Validation 当前性检查；
- Question Quality Assessment 不可变写入；
- Question Quality Review Gate 当前评估检查；
- Material Observation Plan 不可变与 Revision 冲突；
- Shared Formal Resource 禁止清空与不可变记录冲突；
- 旧式自然语言 `Error` 的兼容归类。

工作台保留可理解中文提示，并补充错误码、对象身份和恢复建议。正式资源冲突不会因为提示文案变化而失去可追踪身份。

## 测试升级

涉及结构化边界的既有测试已从“匹配英文错误句子”升级为“断言稳定错误码”。提示文案可以独立优化，不再被误当成底层接口。

```text
Structured Runtime Error Contract       8 / 8 PASS
Question Resource Admission            23 / 23 PASS
Material Observation                   27 / 27 PASS
Shared Formal Resource Persistence     10 / 10 PASS
Question Quality Assessment            12 / 12 PASS
Question Quality Review Gate            9 / 9 PASS
Production Build                             PASS
```

## 当前边界

本次尚未提供：

- 全局错误事件持久化；
- 跨 Session 错误时间线；
- 服务端日志聚合与检索；
- 告警、监控和错误趋势统计；
- 所有历史 `throw new Error` 的一次性重写。

未知错误会统一归入 `RUNTIME_OPERATION_FAILED`，保留原始信息并要求人工检查。后续可以按真实故障样本逐步增加稳定错误码，避免过度设计。

## 准确结论

系统已具备关键正式资源链路的最小结构化错误识别、对象追踪和恢复指引能力。类似底层问题今后可以基于稳定错误码进入专项 Debug 与持续回归，但尚不能宣称具备完整生产级可观测性平台。
