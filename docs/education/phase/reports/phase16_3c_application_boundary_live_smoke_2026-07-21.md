# Phase 16.3C Application Boundary Controlled Live Smoke（2026-07-21）

状态：`PASS`

## 验收目标

验证正式浏览器入口能够通过服务端 Application Boundary 调用真实 DeepSeek，并在浏览器不持有 API Key、完整 Prompt 或 Raw Output 的前提下完成：

```text
Frozen Resource
-> StudentResponse
-> Real DeepSeek Diagnosis
-> Formal Diagnosis Commit
-> AbilityEvidence
-> Existing Evaluation / Profile / GrowthMemory
-> Controlled Student Feedback
-> NextLearningStrategy
-> 下一条正式 Frozen Resource
```

## 固定配置

- Provider：`deepseek_chat`
- Model：`deepseek-v4-flash`
- Prompt：`Prompt v4`
- Execution Mode：`live / committed`
- Browser Boundary：`/__runtime/phase16-3/diagnose`
- Secret Source：macOS Keychain -> server environment
- Student Surface：`/learning`

API Key、完整 Prompt、学生答案原文和 Provider Raw Output 未写入本报告。

## 最终通过事实

1. 正式 `training` Frozen Resource 能在统一入口展示并接收有效作答；
2. 浏览器请求经过 Application Boundary，真实 DeepSeek 返回结果通过结构、身份和边界 Gate；
3. Formal Diagnosis、AbilityEvidence、Profile / GrowthMemory 回流和受控学生反馈形成；
4. 内部复核在清理前显示 `1 Session / 1 Round / 1 Resource / 1 Evidence`；
5. 上一轮正式结果生成迁移策略，第二轮展示独立审核冻结的 `transfer` Resource，而不是默认训练题；
6. 学生页面未暴露 Provider、Prompt、Raw Output、API Key 或内部追溯 ID；
7. Controlled Smoke 数据验收后已清理，正式自然日计数恢复为 `0 / 5`。

## Live 暴露并修复的问题

### 1. Session 回流身份常量残留

正式回流后追加 Learning Session 时仍引用旧常量 `UNIFIED_ENTRY_STUDENT_ID`，造成页面运行错误。

修复：统一使用 `PHASE163_LEARNING_STUDENT_ID`；正式结果可继续进入 Session History。

### 2. 正式资源角色覆盖不足

正向结果生成 `transfer` 策略时，资源池缺少正式迁移资源。此前复测分支还存在复制 Frozen Version 后改写 `taskRole` 的风险。

修复：正式资源池改为分别审核冻结 `training / retest / transfer` 资源；编排层只能按 `targetAbilityId + taskRole` 精确匹配，禁止改写 Frozen Version。

### 3. 已结束 Session 被旧 Checkpoint 锁住

Session 结束后，统一入口仍读取旧 Round 的 blocked Checkpoint，导致无法开始新 Session。

修复：Operation Checkpoint 只参与活动 Session 的入口决策；历史异常保留在内部复核，但不锁住新 Session。

### 4. 下一任务正式指针未被页面消费

上一轮已形成 `nextTaskResolution`，但进入下一轮时页面重新使用默认训练资源。

修复：新 Round 优先读取上一 Round Checkpoint 中的正式 `nextTaskResolution`，并在当前 Frozen Resource Pool 中复核该 Version 后展示。

### 5. 新 Round 被旧反馈覆盖

活动 Round 尚未写入 Persistence 时，入口错误回退到上一轮记录并显示旧反馈。

修复：活动 Round 有明确 ID 时只读取该 Round 的记录；记录尚未建立则显示开始当前任务，不拿历史反馈替代。

## 回归结果

- Phase 16.1 -> 16.2 Integration：`5 / 5 PASS`
- Phase 16.3 Day 0 Integration：`11 / 11 PASS`
- Phase 16.3C Multi-day Simulation：`10 / 10 PASS`
- Production Build：`PASS`

Build 仅保留既有 chunk size 与 dynamic import 提示，不构成本次阻断。

## 结论与边界

Application Boundary Controlled Live Smoke 已通过，证明真实 Provider 可以从正式学生入口安全进入 Runtime，并形成正式回流与策略驱动的下一资源。

本结果不代表 Phase 16.3C 已冻结：5—7 个自然日真实学生运行、延迟复测和最终历史回放仍为 `PENDING`。
