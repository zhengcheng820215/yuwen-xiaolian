# 针对性短片段微训练阶段 4 工程与 Debug 验收

日期：`2026-08-20`  
状态：`ENGINEERING + CONTROLLED BROWSER PASS / REAL CALIBRATION PENDING`

## 一、结论

阶段 4 工程主体已完成：受控资源包可生成稳定 Manifest，可幂等导入、暂停、回滚及回滚后重导；运行侧已建立四态启用、事件 Ledger / Outbox、Calibration Episode、Follow-up、指标投影、完整性审计和内部控制页面。专项 Debug 为 `51 / 51 PASS`，生产构建和关键既有链路回归通过。

`B4-01—B4-16` 完整受控浏览器矩阵已执行通过，详见独立[浏览器验收报告](./targeted_micro_training_stage4_full_browser_acceptance_2026-08-20.md)。本结论仍不等于教育效果验证完成；5—7 日单学生真实观察尚未执行，当前不得标记真实校准通过，也不得外推到其他学生。

## 二、实现范围

- Schema / Policy：`targetedMicroTrainingStage4.schema.ts`；
- Repository：内存与 IndexedDB 双实现；
- Service：受控包 Manifest、导入、审计、暂停、回滚、事件、Outbox、Episode、Follow-up 和指标；
- API：Learning 启用门和 Stage 4 内部治理 API；
- 页面：`/internal/targeted-micro-training`；
- Learning：在既有 Stage 3 调度前增加 Stage 4 `canSchedule` 门，并记录生命周期事件；
- Debug：`runTargetedMicroTrainingStage4Debug.ts`。

## 三、资源包验证

本地受控导入验证结果：

- Material Version：`12 / 12`；
- Frozen Resource Version：`18 / 18`；
- Active Registry Entry：`18 / 18`；
- 默认启用模式：`disabled`；
- 核心正式资源：未静默迁移、未被受控包覆盖。

导入失败路径会恢复导入前 Registry 和 Material 状态；回滚停用包内 Registry 并保留运行历史，不删除 Attempt、Diagnosis、Evidence 或 Ledger。

## 四、专项 Debug

命令：`npm run debug:targeted-micro-training-stage4`

结果：`51 / 51 PASS`。

覆盖：

1. Manifest 稳定身份、哈希与完整性；
2. 幂等导入、Registry 冲突阻断与失败恢复；
3. 四态启用和版本切断；
4. 暂停、回滚和历史保留；
5. 生命周期事件幂等与 Outbox 重试；
6. Episode / Follow-up 独立身份；
7. 资格分母、排除原因和分项指标；
8. 重复 Assignment / Presentation / Terminal、Attempt 复用、资源错位等完整性审计；
9. 脱敏导出不包含答案正文、材料正文或可识别学生信息。

## 五、回归与构建

通过：

- Targeted Micro-training Stage 1：`16 / 16`；
- Stage 2：`32 / 32`；
- Stage 3：`57 / 57`；
- Learning Session Task Queue：`19 / 19`；
- Unified Learning Entry：`27 / 27`；
- Reading Single-choice Stage 4：`13 / 13`；
- Learning Feedback Revision Stage 4：`19 / 19`；
- Material Observation：`29 / 29`；
- Production Build：PASS；
- `git diff --check`：PASS。

构建仍有既有大 Chunk 与动态导入提示，但未构成构建失败；后续完整浏览器验收应在无编辑期重新检查干净控制台。

## 六、浏览器冒烟

已验证：

- 内部控制页路由可访问；
- 默认状态为关闭；
- 受控包准备、导入和完整性汇总可显示；
- Learning 端在关闭状态下保持原固定题组恢复，不出现微训练 Overlay。

已完成 `B4-01—B4-16` 全部路径逐条签署，包括隔离启用、暂停与回滚、刷新、跨标签、末题返回、单选和文本微训练；`controlled_single_learner` 仍须在真实观察窗口开始时单独授权启用。

## 七、剩余工作

1. 获得真实观察授权后再启用固定学生 `controlled_single_learner`；
2. 运行 5—7 日真实观察并冻结分母、排除原因、Policy Version 和 Pack Version；
3. 依据数据作出 `CONTINUE / ADJUST / PAUSE / INSUFFICIENT DATA` 决策；
4. 在完成上述工作前，不宣称普遍教育效果或泛化能力。
