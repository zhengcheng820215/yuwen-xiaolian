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
| Draft Generator 专项 Debug | 38 / 38 PASS |
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
- “AI 结构化首稿、题目入口、隔离候选区、Freeze”等页面术语收敛为“AI 生成训练任务、训练任务、待确认初稿、正式发布”；
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
7. 该轮新增 5 个确定性 Case，当时专项结果为 `25 / 25 PASS`；后续 Prompt v1.4、候选修复与 Provider 可诊断性校准已将总数更新为 `38 / 38 PASS`。

当前未建设模式 B“围绕既有 Observation 生成替代题”和模式 C“跨材料寻找 Retest / Transfer 候选”。两者不得静默混入当前按钮，也不阻塞 Phase 17.3 对 Batch A 正式资源的运行链验证。

## 八、拒绝原因可执行性校准

真实生成复核进一步发现，页面虽然已经能显示“素材段落超出范围”“题型不在允许范围”，但没有说明模型实际填写了什么，也没有给出当前素材和题型的允许边界。

本轮小范围修复：

1. 被拒绝候选保存受控诊断快照，只记录题型、作答形式、素材 Anchor 与当前素材段落数，不保留完整 Raw Output；
2. 素材范围错误展示实际引用段落、当前素材有效段落和修正方向；
3. 题型或作答形式错误展示实际值与全部允许值；
4. 整批候选不足时展示总候选数、通过结构校验数、拒绝数与最低准入数；
5. 不修改原有候选校验、人工审核、正式发布或 Repository 写入规则。

新增两个确定性 Case，验证范围拒绝与题型拒绝均保留可解释的实际值。

后续体验校准继续补充：

1. 每项拒绝原因增加当前可以执行的操作，不再要求用户修改无法进入编辑区的 Raw Candidate；
2. `single_paragraph -> paragraph`、`paragraph_span -> paragraph_range`、`whole_text -> full_text` 作为不改变教育语义的受控别名由 Adapter 自动归一；
3. 超出真实材料段落等无法安全推断的问题继续阻断，不截断、不猜测、不静默改写；
4. 页面解释 AI 生成的是候选首稿，确定性校验器负责在导入前隔离不合格内容。

## 九、Prompt Contract 与候选级修复校准

2026-07-24 对真实生成中的高结构拒绝率完成根因校准。问题集中在 Provider 未获得 Runtime 的真实段落编号和完整枚举，以及有效 JSON 返回后没有结构修复机会；本轮没有放宽重复、材料支持或教育语义门槛。

### 9.1 问题记录

| 现象 | 归因 | 处理原则 |
| --- | --- | --- |
| AI 引用第 1—9 段，Runtime 实际只有 7 段 | Prompt 未提供同源段落编号，Provider 只能猜测 | 向 Provider 提供 Runtime 同源编号，不确定性问题不得截断猜测 |
| AI 使用近义但非法的题型、作答形式或 Anchor 类型 | Contract 没有完整暴露给 Provider | 完整列出合法枚举；仅对不改变语义的已知别名做确定性归一 |
| 一个末端字段错误导致整道候选淘汰 | 候选采用严格全量校验，且没有修复机会 | 保留严格校验，增加一次候选级定向修复 |
| 重新生成可能覆盖已经合格的候选 | 原链路只能重新生成整批 | 修复调用只返回失败 Candidate Index，确定性合并后重新校验 |
| 重复或材料不支持也可能被当作“通过率问题” | 结构误拒绝与正确阻断未分开统计 | 重复、无依据、虚构和语义越界继续阻断，不纳入自动放宽 |

1. Prompt 升级为 `material_observation_draft_prompt_v1_3`，Generator Contract 升级为 `material_observation_draft_generator_v1_2`；
2. Material 按 Runtime 相同规则拆分并编号，Prompt 明确提供段落总数，不再要求模型按视觉换行猜测 Anchor；
3. Prompt 完整列出 Ability、Dimension、Question Type、Response Format、Anchor Type、Difficulty、Assessment Mode 和 Evidence Potential 合法值；
4. 明确题型与作答形式的兼容关系，并要求输出前逐候选检查 Anchor、Supporting Ability、Rubric、五类校准答案和 Safety Boundary；
5. 首轮结构拒绝导致整批不足时，第二次 Provider 调用只接收失败候选、错误代码和原候选，不重新生成整批；
6. 已通过候选保持原样；修复结果按原 Candidate Index 合并后重新执行完整结构校验、库存比对和同批去重；
7. 修复最多一轮；修复 JSON 或 Provider 调用失败时保留第一轮合法候选，不降级为整批 Provider Failure；
8. 页面显示“请求修复、恢复、仍未通过”数量；结果保留受控 issue count，便于后续判断失败是否集中在 Anchor、Rubric 或 Calibration；
9. 同批重复、已有 Observation 重复和没有新 Observation 不触发结构修复；
10. 超范围 Anchor 不会被确定性截断，Provider 必须重新对照编号材料；仍无法成立时继续拒绝。

Prompt v1.3 校准新增 5 个确定性 Case 后，Draft Generator 专项 Debug 为 `33 / 33 PASS`；Provider 可诊断性补充 2 个 Case 后为 `35 / 35 PASS`；Prompt v1.4 能力一致性校准再补充 3 个 Case，当前结果为 `38 / 38 PASS`。工作台状态回归 `5 / 5 PASS`、资源生产回归 `13 / 13 PASS`、Production Build 通过。未调用真实 Provider，未写入正式 Repository。

### 9.2 当前验收结论

```text
Prompt Contract 修复：PASS
候选级定向修复：PASS
修复失败安全回退：PASS
重复与材料边界保持：PASS
真实 Provider 降低拒绝率：PENDING
```

当前只允许宣称“误拒绝治理的工程机制已完成”，不得宣称真实不合格率已经达标。

### 9.3 Provider 失败可诊断性修复

2026-07-24 受控人工测试发现，工作台把账户余额不足与上游临时异常统一显示为“模型服务暂时不可用”，用户无法判断应当重试还是检查账户。

本轮小范围修复：

1. HTTP `402` 单独映射为 `insufficient_balance`，不得再归入 `provider_unavailable`；
2. `insufficient_balance` 为不可重试错误，单次失败后立即安全停止；
3. 上游 `5xx` 仍归入 `provider_unavailable`，按既有预算最多尝试两次；
4. 工作台显示本轮实际自动尝试次数；
5. 余额、凭据、模型配置和临时异常分别提供对应操作，不再统一要求“稍后重试”；
6. 所有 Provider 失败继续保持零候选、零导入、零正式写入，不修改候选校验与审核边界。
7. 工作台不再展示 `rubric_0_ability_undeclared` 等内部校验码；页面只说明可理解的问题、系统处理和下一步操作，原始错误码继续保留在 Debug 结果中。
8. 整批校验摘要、下一步操作和未通过任务详情收拢到同一问题处理区；拒绝详情紧跟摘要并保持可折叠，可导入任务随后展示，不再要求用户跨越候选列表寻找原因。
9. 候选卡片将“素材范围”改为“题目依据”，并与题目标题放入同一容器；桌面端右侧展示，窄屏自动换行，保留正式 Material Anchor 的可追溯性。
10. 任务编辑标题统一为“训练任务一 · 编辑区、训练任务二 · 编辑区……”；序号归属于任务，“编辑区”用于说明当前区域用途，删除操作的无障碍名称同步使用相同标题。

新增确定性 Case：

- 账户余额不足只调用一次，输出 `provider_insufficient_balance`；
- 上游临时异常自动尝试两次，最终仍保持候选为空。

### 9.4 Rubric 能力一致性校准

真实候选复核发现，任务能力声明和 Rubric 可能由 Provider 分别生成，导致 Rubric 引用了候选未声明的能力。原有 Validator 已能正确阻断，但通用自检和只包含错误码的修复上下文不足以稳定降低发生率。

本轮处理：

1. Prompt 升级为 `material_observation_draft_prompt_v1_4`；
2. `supportingAbilityIds` 默认使用空数组，仅在题目确实要求另一项独立认知动作时声明；
3. 每个 Rubric 的 `abilityId` 只能取自该候选的 Primary Ability 或已声明 Supporting Ability；
4. 候选修复上下文显式提供 `allowedRubricAbilityIds` 和可执行修复说明；
5. 修复必须保持 Primary / Supporting Ability 不变，不得通过增加辅助能力让候选表面通过；
6. 若 Rubric 无法在允许能力内保持原题教育含义，应省略候选并继续阻断；
7. 修复结果仍执行完整结构校验、库存比对和同批去重。

新增 3 个确定性 Case，分别验证主 Prompt 约束、修复允许集合和只修改 Rubric 后重新通过完整校验。

下一次受控 Live 使用同一篇已知材料连续生成 3 轮，每轮记录：

1. Provider 返回候选数；
2. 首轮结构通过数；
3. 自动修复请求数与恢复数；
4. 最终可导入数；
5. 重复、材料不支持和其他正确阻断数；
6. 人工判断经过轻量修改可进入 Review 的数量。

建议接受标准：

- 候选结构合格率 `>= 85%`；
- 人工轻量修改后可用率 `>= 60%`；
- 至少一个可修复结构错误能被定向恢复，或三轮均未出现结构错误；
- 重复、材料不支持、虚构事实和教育语义越界不得因校准而放行。

### 9.5 生产工作台体验收敛

2026-07-24 在真实材料连续生成与人工审核过程中，工作台暴露出信息术语偏内部、模块边界过重、审核内容重复和失败操作不明确等问题。本轮只调整产品呈现与受控生成可诊断性，不新增正式对象，不放宽 Candidate、Review、Freeze、Registry 或 Observation Link 边界。

本轮完成：

1. 将页面用语统一为内容人员可理解的“素材、训练方向、训练能力、训练任务、题目依据、评分标准、审核与发布”，内部 `Observation`、`Draft`、`Freeze` 和错误码不再直接作为主操作文案；
2. AI 生成参数优先使用标签和数量选择；开放字段保留明确示例，生成中进入 Loading 状态并阻止重复提交；
3. 生成结果统一显示“生成、可导入、替代题、疑似重复、素材不支持”数量，有数据使用绿色标签，无数据使用灰色标签；
4. 生成失败与结构拒绝均说明原因和下一步操作；Provider 失败、候选结构失败、材料不支持和重复 Observation 保持不同语义；
5. 自动修复只处理结构偏差，Rubric 能力集合、Anchor、枚举和校准答案重新执行完整校验；重复、无材料依据和教育语义越界继续阻断；
6. AI 生成区、训练任务编辑区、当前覆盖与审核区统一为白色容器和响应式内边距，辅助说明与标签不低于 `12px`，普通正文不低于 `14px`；
7. 训练任务编辑区使用中文序号、标签化 Select 已选值、自动增高题目输入和明确删除动作；可点击选择的字段不要求手工输入内部值；
8. 审核区只读版本状态与审核状态合并展示，单版本不显示无意义下拉；提交审核按钮位于内容底部并作为绿色主操作；
9. 审核区默认外显“题目一、题目二、题目三”，Ability 与 TaskRole 使用辅助标签；Anchor、作答要求、设计说明、Rubric 与答案示例保持折叠；
10. 删除重复的常态进度、已保存任务标题和说明；只有存在未保存修改或校验失败时才展示提示，失败项紧邻“提交审核”按钮；
11. 发布进度与实际动作统一为 `AI 生成训练任务 -> 保存训练任务 -> 提交审核 -> 审核题目 -> 发布任务`，已完成步骤改为结果态文案；
12. 工作台头部吸顶，长页面滚动时保留素材切换与刷新入口；PC 与 Tablet 继续保持无横向溢出。

体验收敛后的边界：

- 页面优化不改变 Material、Plan、Task、Draft、Review、Freeze、Registry 与 Link 的状态机；
- 页面不根据视觉状态推断正式成功，正式状态仍由 Application Service 与 Repository 事实决定；
- AI 生成内容仍是待确认候选，不自动保存、提交审核或发布；
- 真实候选合格率仍需按 9.4 的三轮 Controlled Live 标准单独验收。

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
