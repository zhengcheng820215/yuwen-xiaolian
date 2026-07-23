# Phase 17.2 辅助首稿生成工程验收

日期：2026-07-23

状态：ENGINEERING PASS / CONTROLLED LIVE QUALITY REVIEW PENDING

## 一、目标

在不改变既有正式资源准入链的前提下，增加一条低成本内容生产路径：

```text
Material
-> AI Observation Planning Candidate
-> Deterministic Validation
-> Human Import / Edit
-> Existing Plan Review
-> Existing Draft / Freeze / Registry
```

AI 只负责生成结构化首稿。人工继续对教育设计、证据边界和正式发布负责。

## 二、已实现

1. `Material Observation Draft Generator` 根据一篇完整 Material 生成 3—6 个候选；
2. 候选包含题目、Primary / Supporting Ability、Observation Dimension / Focus、Material Anchor、预期学生动作、设计理由、Rubric、Answer Acceptance、五类校准答案和 Evidence Potential；
3. 默认只允许 `training_candidate`，不自动创建 Retest 或 Transfer；
4. 逐候选校验材料锚点、能力身份、Rubric、Acceptance、校准答案和安全边界；
5. 重复 Observation 会被识别，不能用同质候选凑足数量；
6. 单个坏候选不会污染其他合法候选；
7. 少于 3 个合法独立候选时，整批不可导入；
8. 工作台只把通过校验的候选导入现有编辑器，不直接写入 Repository；
9. Provider Raw Output 不进入正式资源对象，也不在学生或内容页面展示；
10. 人工仍需通过现有 Plan Review、Question Draft、Freeze、Registry 和 Observation Link 链路。

## 三、验收结果

| 验收项 | 结果 |
| --- | --- |
| Draft Generator 专项 Debug | 25 / 25 PASS |
| Phase 17.1 Coverage 回归 | 22 / 22 PASS |
| Phase 17.2 Observation Contract 回归 | 26 / 26 PASS |
| 最小生产工作台回归 | 13 / 13 PASS |
| Batch A 回归 | 14 / 14 PASS |
| 《潼关》校准回归 | 12 / 12 PASS |
| Production Build | PASS |
| 工作台入口浏览器 Smoke | PASS |
| 正式 Repository 写入 | 0 |
| Live Provider 调用 | 0 |

本轮累计完成 112 个确定性 Case，全部通过。

浏览器 Smoke 进一步确认：

- 未选择 Material 时生成按钮保持禁用；
- 载入《潼关》后生成入口启用；
- Provider readiness 只显示服务就绪，不触发真实请求；
- 当前 Plan 的六项真实任务继续原样显示，不被通用模板覆盖；
- 页面明确提示 Candidate 不自动保存、审核或 Freeze。

同日完成工作台信息层级校准：

- 候选卡片以 Observation Focus 为主标题，Question 明确降为“题目入口”；
- 编辑区同时预览 Primary Ability 与 Material Dimension，不只统计题目数量；
- 未生成 AI 初稿时不展示空进度；生成后展示 `生成初稿 -> 编辑确认 -> 提交审核 -> 逐题审核 -> 正式发布` 五步状态；
- 既有人工 Plan 不会因为生成器可用而被误标为 AI Candidate；
- 本次调整只修改展示与审核顺序，不新增 Schema、Agent、Repository 或正式状态。

后续素材生产工作台 UX 校准进一步完成：

- 工作台头部和主体最大宽度统一为 `1120px`；
- 学习材料、训练任务、审核与正式化由左右双栏调整为纵向生产流；
- 已有素材与新素材录入使用明确双模式入口，不再复用空选择值表达新建状态；
- 《潼关》校准案例与 Batch A 资源包继续作为受控示例入口，最近一次成功使用的资源组以绿色标识；
- 训练任务数量合并到标题，例如“训练任务（6/6）”，当前数量使用绿色；
- 选中态与键盘聚焦态统一为绿色；刷新成功使用 3 秒 Toast，错误继续显式保留；
- “AI 结构化首稿、题目入口、隔离候选区、Freeze”等页面术语收敛为“AI 生成训练任务初稿、训练任务、待确认初稿、正式发布”；
- 删除重复步骤标题、低信息提示和非必要分割线，保留版本、审核和正式发布的真实边界。

这些变化不修改 Candidate、Plan、Draft、Review、Freeze、Registry 或 Observation Link 的正式数据和权限。

## 六、首轮真实生成与修复

首轮用户触发的真实古诗材料生成结果：

```text
Provider 返回候选：4
合法独立候选：0
导入：阻断
正式 Repository 写入：0
```

该结果证明安全闸门能够阻止不完整结构进入编辑区和正式链，但同时暴露出 Prompt 示例与严格 Contract 对齐不足、拒绝原因不可见的问题。

第一轮修复：

1. Prompt 升级为 `material_observation_draft_prompt_v1_1`；
2. JSON 示例完整展开 `fully_meets`、`partially_meets`、`typical_error`、`reasonable_alternative`、`irrelevant` 五类必需校准答案；
3. 默认结构化输出预算从 5,000 提高到 8,000 tokens；
4. 页面逐候选展示中文拒绝原因；
5. 材料限制与结构拒绝分开显示；
6. 未降低 Ability、Anchor、Rubric、Acceptance、Calibration 或 Safety Gate。

第一次修复后再次触发真实 Provider，结果在产生候选前进入 `provider_failed` 分支，仍保持正式写入为 0。复核发现浏览器 Live Boundary 仍显式覆盖旧的 `5000 tokens / 30 秒` 配置，使 Agent 的 `8000 tokens` 默认值未真正作用到真实入口；同时页面只显示笼统英文限制，没有展示 Runtime 已保留的具体 Provider 错误分类。

第二次小范围修复：

1. Live Boundary 统一使用 `8000 tokens / 90 秒`；
2. 保留最多两次受控尝试，不改变候选准入与正式写入边界；
3. 页面区分 Provider 调用失败、JSON 解析失败和候选结构校验失败；
4. 将超时、网络、限流、凭据、服务不可用和输出异常显示为中文原因；
5. Provider 失败时明确说明本次没有候选进入校验或正式数据。

修复后确定性 Debug 为 `20 / 20 PASS`，工作台回归 `13 / 13 PASS`，Production Build 通过。修复后的真实 Provider 复测由负责人再次触发。

## 七、重复生成与虚假覆盖收尾

真实材料生成能力通过后，继续补充“题目增长不等于 Observation 覆盖增长”的工程约束：

1. 生成请求携带当前材料的只读 Existing Observation Inventory 与 Existing Question Inventory；
2. 生成模式固定为 `discover_new_observation`，Prompt v1.2 明确禁止用同义题干、题型变化或替代问法凑数量；
3. 通过结构校验的候选继续按库存关系分类：
   - `new_observation_candidate`：可以进入人工导入；
   - `alternate_question_for_existing_observation`：保留预览，不增加 Coverage；
   - `likely_duplicate`：隔离，不允许导入；
   - `unsupported_by_material`：结构拒绝；
4. 首次生成仍需至少 3 个合法独立新 Observation；已有库存时允许只返回 1—2 个真正的新 Observation；
5. 已有库存且没有发现新 Observation 时返回 `review_required`，导入按钮保持禁用；
6. 工作台显示已有库存、新 Observation、替代题、疑似重复和材料不支持数量；
7. 本轮新增 5 个确定性 Case，专项结果更新为 `25 / 25 PASS`，正式 Repository 写入和 Live Provider 调用均为 0。

当前未建设模式 B“围绕既有 Observation 生成替代题”和模式 C“跨材料寻找 Retest / Transfer 候选”。两者不得静默混入当前按钮，也不阻塞 Phase 17.3 对 Batch A 正式资源的运行链验证。

## 四、明确边界

- `evidencePotential` 只描述题目设计可能支持的观察强度，不是 Phase 14 的实际 Evidence Quality；
- LLM Candidate 不是正式 Observation、Question Resource、Retest 或 Transfer；
- 生成失败、候选不足或候选重复时，不留下半成品正式对象；
- 不自动 Freeze，不自动更新 Registry，不自动补齐 Coverage；
- 不新增 Repository、Profile、Evidence 类型或教育能力枚举；
- 不以候选数量替代内容质量审核。

## 五、后续验收

下一步只需执行一轮受控 DeepSeek 候选生成：

1. 使用一篇已知材料生成 3—6 个候选；
2. 人工检查候选是否值得存在、Primary Ability 是否准确、Observation 是否重复；
3. 确认至少 60% 候选经过轻量修改后可进入 Review；
4. 确认未导入候选不会进入 Plan、Draft、Freeze 或 Registry；
5. 通过后再将该能力用于首批正式资源生产，不扩大为通用 CMS。
