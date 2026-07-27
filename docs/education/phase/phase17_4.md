# Phase 17.4：本机共享正式资源持久化

英文名称：Local Shared Formal Resource Persistence

设计状态：ACCEPTED

工程状态：17.4A ENGINEERING + AUTOMATED DEBUG + STANDARD-BROWSER BASELINE CUTOVER + FRESH BASELINE QUALITY INITIALIZATION + CONTROLLED DUAL-CLIENT HUMAN CHECK + INDEPENDENT BROWSER-KERNEL CONSISTENCY PASS；17.4B PLANNED

优先级：17.4A P1（继续规模化录题前完成）/ 17.4B P2

所属总纲：[Phase 17：学习资源覆盖扩展与基于材料的能力观测基础](./phase17.md)

最新验收记录：[Phase 17.4A 受控双端人工验收记录（2026-07-27）](./reports/phase17_4a_controlled_dual_client_human_acceptance_2026-07-27.md)

前置阶段：

- Phase 16.1 Structured Question Intake and Review：`PASS`
- Phase 17.2 Material Observation Design：生产工作台工程基础已通过
- Phase 17.3 Formal Resource Runtime Integration：Batch A 单轮真实链路已通过

## 一、问题背景

当前资源生产工作台使用浏览器 IndexedDB 保存 Material、训练任务、题目审核和正式资源数据。

IndexedDB 的数据归属于具体浏览器配置空间。即使内置浏览器与标准浏览器访问相同的 `http://127.0.0.1:5174`，二者仍可能形成互不共享的数据集。

当前已经观察到：

```text
内置浏览器
-> 3 份学习材料
-> 14 个学习任务

标准浏览器
-> 5 份学习材料
-> 23 个学习任务
```

这不是页面计数错误，而是正式资源数据已经发生浏览器级分叉。

固定端口只能避免同一浏览器因 Origin 变化产生新的数据空间，不能解决不同浏览器之间的 IndexedDB 隔离。

## 二、阶段目标

Phase 17.4 只解决一个核心问题：

> 如何让同一台电脑上的内置浏览器和标准浏览器读写同一套正式资源数据，并保证旧数据可以受控迁移、冲突不会被静默覆盖、服务重启后仍能恢复？

该目标拆为两个顺序闭环：

1. **17.4A 先恢复稳定录入**：正式资源脱离浏览器私有存储，两个浏览器读取同一套共享数据；
2. **17.4B 再增强迁移与恢复**：补齐复杂差异报告、冲突治理、历史快照和自动恢复。

目标链路：

```text
内置浏览器 ─┐
            ├─ Local Resource API
标准浏览器 ─┘
                    ↓
          Shared Formal Resource Store
                    ↓
          Backup / Restore / Audit
```

完成后，浏览器不再是正式资源事实的唯一保存位置。

## 三、一句话定义

> Phase 17.4 将正式资源数据从浏览器私有 IndexedDB 迁移到本机共享持久化边界，使多个本地浏览器能够读取同一套可追溯、可恢复、不可静默覆盖的资源事实。

## 四、子阶段拆分

### 4.1 Phase 17.4A：Shared Store Cutover

17.4A 只完成：

```text
Local Resource API
+ Shared Formal Resource Store
+ Repository Adapter Cutover
+ Minimal Baseline Import
+ Dual-browser Read Consistency
+ Basic Backup
```

17.4A 的产品终点是：

> 内置浏览器和标准浏览器读取同一套正式资源；任一浏览器写入后，另一浏览器刷新即可看到结果；服务重启后数据仍然存在。

17.4A 不建设复杂迁移平台。现有两套数据采用最小受控方式处理：

1. 分别导出两侧完整只读快照；
2. 人工指定一套快照作为首次共享存储基线；
3. 另一套快照完整保留，不在 A 阶段自动合并；
4. 同 ID 不同内容时必须阻断；
5. 导入失败时共享存储保持导入前状态。

17.4A 通过后，可以恢复规模化录题。

### 4.2 Phase 17.4B：Migration and Recovery Hardening

17.4B 在共享存储已经稳定运行后，再完成：

- 两套历史数据的结构化差异报告；
- 同内容不同 ID、同 ID 不同内容和依赖关系冲突分析；
- 人工确认后的受控补充导入；
- 历史快照与迁移审计；
- 自动备份、恢复验证与更完整的故障演练。

17.4B 不重新建设 Shared Store，也不阻塞 17.4A 通过后的正常资源生产。

顺序关系：

```text
17.4A
先让正式资源脱离浏览器并恢复稳定生产
↓
17.4B
再让历史迁移、冲突治理和恢复能力更加完整
```

## 五、数据职责边界

### 5.1 必须进入共享存储的数据

以下对象属于正式资源生产链，应由本机共享存储统一保存：

- `QuestionMaterialVersion`
- `MaterialSourceAnchor`
- `MaterialObservationPlan`
- Observation Plan Validation / Review
- `StructuredQuestionDraft`
- Question Validation / Review Decision
- `FrozenQuestionResourceVersion`
- `ResourceRegistryEntry`
- `ResourceObservationLink`
- Material 生命周期状态，例如 `active / retired`

这些对象一旦进入审核、冻结、Registry 或正式运行链，就不能继续依赖某个浏览器的私有数据空间作为唯一事实来源。

### 5.2 可以继续保留在浏览器本地的数据

以下内容可以继续使用 IndexedDB、Local Storage 或页面状态：

- 当前选中的 Material、Plan 或标签页；
- 尚未保存的输入框内容；
- 面板展开状态；
- Toast 是否已经展示；
- 临时筛选条件；
- 可重新生成的页面缓存。

浏览器本地状态不得改变 Frozen Resource、Registry Current Head、Review Decision 或 Material Version 的正式事实。

### 5.3 IndexedDB 的长期定位

Phase 17.4 完成后，IndexedDB 可以作为：

- 未提交草稿缓存；
- 离线临时缓冲；
- 页面恢复缓存；
- 旧数据迁移来源。

IndexedDB 不再作为正式资源链的最终权威存储。

## 六、Phase 17.4A 最小实现边界

第一版建议建立一个仅在本机运行的 Resource Persistence Service：

```text
Workbench UI
↓
Local Resource API
↓
Shared Resource Repository
↓
Local File or Lightweight Database
```

17.4A 最小能力包括：

1. 读取完整正式资源快照；
2. 按现有 Repository Contract 写入和查询资源对象；
3. 串行化或受控处理写操作；
4. 使用稳定对象 ID 保持幂等；
5. 写入失败时不产生半条正式记录；
6. 在首次导入和关键写入前保存基础备份；
7. 服务重启后恢复同一套数据；
8. 向不同浏览器返回相同的 Current Head、Review 和计数。

17.4A 可以采用本地 JSON 文件或轻量数据库，但不得让页面直接拼接或修改存储文件。所有正式读写必须经过统一 Application / Repository Boundary。

## 七、旧数据迁移与恢复增强

### 7.1 Phase 17.4A 最小迁移

17.4A 不尝试自动合并两套浏览器历史。

它只要求：

- 两侧快照均已导出并可恢复；
- 人工明确指定首次共享存储基线；
- 基线导入前完成结构校验；
- 同 ID 不同内容时阻断；
- 未作为基线的一侧保持只读备份；
- 导入结果能够在两个浏览器中一致读取。

### 7.2 Phase 17.4B 迁移原则

现有两个浏览器的数据不能直接自动合并。

17.4B 按稳定 ID、版本号和内容哈希形成详细分类：

```text
identical
only_in_source_a
only_in_source_b
same_id_different_content
same_content_different_id
dependency_conflict
```

### 7.3 冲突处理

- `identical`：只保留一份；
- `only_in_source_a / b`：经预检后可以导入；
- `same_id_different_content`：必须阻断并人工选择，不允许覆盖；
- `same_content_different_id`：标记为疑似重复，不自动合并下游关系；
- `dependency_conflict`：保持两侧快照，进入人工复核；
- 已 Frozen 或已进入 Registry 的对象，不能因另一浏览器存在新 Draft 而被覆盖。

17.4B 迁移工具必须先生成报告，再执行补充写入。迁移失败时，共享存储必须保持迁移前状态。

### 7.4 Phase 17.4B 完成条件

迁移完成后必须能够回答：

- 哪个浏览器快照作为基线；
- 哪些对象被导入；
- 哪些重复对象被忽略；
- 哪些冲突被阻断；
- 哪些对象等待人工复核；
- 迁移前备份位于何处；
- 迁移后的正式对象数量和 Current Head 是否一致。

## 八、读写一致性原则

1. 同一对象写入必须幂等；
2. 同一 Resource 只能存在一个 Registry Current Head；
3. Material Version 和 Frozen Version 保持不可变；
4. 生命周期状态与不可变版本内容分离保存；
5. 删除只允许无下游依赖的对象；
6. 已有关联的 Material 只能停用，不得破坏历史；
7. 浏览器 A 的成功写入，应在浏览器 B 刷新后可见；
8. 过期页面提交旧版本时必须返回冲突，不得静默覆盖新版本；
9. API 不可用时，页面必须阻断正式写入并保留未提交内容；
10. 任何失败不得留下 Draft、Review、Freeze 或 Registry 的半完成组合。

Phase 17.4 不要求浏览器之间实时推送更新。第一版采用“写入后刷新可见”即可。

## 九、Debug 与验收

### 9.1 Phase 17.4A 必须通过

#### Case A1：跨浏览器读取一致

```text
内置浏览器读取
+ 标准浏览器读取
-> Material / Plan / Draft / Frozen / Registry 数量一致
-> Stable ID 与 Current Head 一致
```

#### Case A2：一端新增，另一端可见

```text
浏览器 A 新建 Material
-> 保存成功
-> 浏览器 B 刷新
-> 看到同一 Material Version
```

#### Case A3：审核和发布一致

```text
浏览器 A 完成 Review / Freeze
-> 浏览器 B 刷新
-> Review Decision、Frozen Version、Registry Head 一致
```

#### Case A4：重复写入幂等

同一请求重复提交，不产生第二份 Material、Draft、Review 或 Frozen Version。

#### Case A5：过期写入阻断

浏览器 A 已保存新修订时，浏览器 B 提交旧修订必须返回明确冲突，不覆盖新数据。

#### Case A6：服务重启恢复

停止并重新启动本地服务后，资源数量、版本关系、审核状态和 Registry Current Head 保持不变。

#### Case A7：最小迁移安全

两侧快照均已导出；只允许人工指定的基线进入共享存储；同 ID 不同内容时必须阻断。

#### Case A8：失败回滚

模拟写入中断后，不产生 Review 已完成但 Frozen Version 缺失、或 Frozen Version 已存在但 Registry 未更新的半完成状态。

### 9.2 Phase 17.4B 后续通过

#### Case B1：迁移冲突

两个浏览器存在同 ID 不同内容时，迁移必须阻断并生成报告，不得选择任意一侧覆盖。

#### Case B2：停用与历史保持

停用一份已有下游关系的重复 Material 后：

- 默认选择列表不再显示；
- 历史题目和训练关系仍可查询；
- 另一份保留 Material 不受影响。

#### Case B3：旧数据备份与恢复

迁移前快照可以重新导入隔离环境，并恢复原浏览器数据关系。

## 十、完成定义

### 10.1 Phase 17.4A 完成定义

17.4A 完成至少需要：

- 本机共享 Resource Store 与 Local API 已建立；
- 正式资源 Repository 已切换到共享持久化实现；
- 两类浏览器不再形成各自独立的正式资源事实；
- 两侧旧 IndexedDB 数据已完成只读导出；
- 已人工指定并导入一套正式基线；
- 冲突不会被静默覆盖；
- 服务重启后数据可恢复；
- 17.4A 跨浏览器一致性 Debug 全部通过；
- 至少完成一次真实双浏览器人工验收；
- 文档记录正式基线来源和另一侧备份位置。

17.4A 完成后可以宣称：

> 单台电脑上的正式资源生产数据已经统一保存，内置浏览器与标准浏览器可以读取同一套资源，并可恢复稳定录题。

### 10.2 Phase 17.4B 完成定义

17.4B 完成至少需要：

- 两套旧数据可以生成完整差异报告；
- 疑似重复、身份冲突和依赖冲突可以进入人工复核；
- 受控补充导入不改写既有 Frozen Version；
- 历史快照、自动备份和恢复演练通过；
- 迁移与恢复过程具备审计记录。

17.4B 完成后可以进一步宣称：

> 本机共享资源存储已经具备完整的历史迁移治理、冲突复核、快照和恢复能力。

## 十一、当前不做

Phase 17.4A / B 均不做：

- 云端正式部署；
- 多设备自动同步；
- 多用户账号与权限；
- 多人实时协作编辑；
- 大型关系数据库平台；
- 浏览器间实时消息推送；
- 自动合并内容相同但身份不同的资源；
- 自动决定两套历史数据哪一套更权威；
- 修改 Ability、Diagnosis、Evidence、Evaluation 或 Profile 语义；
- 借迁移机会重写已 Frozen 的题目内容。

## 十二、当前临时运行规则

在 Phase 17.4A 真实基线切换与双浏览器人工验收完成前：

1. 指定标准浏览器 `http://127.0.0.1:5174` 为唯一正式录题入口；
2. 内置浏览器仅用于页面检查，不继续录入正式素材；
3. 两侧现有数据都不得清空；
4. 继续录题前先分别导出或保留两侧快照；
5. 不以当前页面计数判断哪一侧自动成为权威版本；
6. 重复素材可以停用，但不得为了对齐计数删除已有正式历史。

## 十三、17.4A 工程结果

2026-07-24 已完成：

- 本机 JSON Shared Formal Resource Store；
- Vite Local Resource API；
- Question Resource 与 Material Observation Repository Adapter；
- Shared Store 初始化后自动切换、未初始化时保留原 IndexedDB；
- API 不可用时阻断正式读写，不静默回退生成第三套数据；
- revision 冲突检测、同 ID 不同内容阻断和单次原子替换；
- 写入前 `.bak` 基本备份与失败回滚；
- 当前浏览器完整快照导出；
- 人工确认后将指定快照初始化为唯一共享基线；
- 基线未选定前不自动合并、不自动覆盖任一浏览器数据。

专项 Debug：

```text
A1 双客户端读取一致                         PASS
A2 一端写入后另一端刷新可见                 PASS
A3 Review / Freeze / Registry 原子提交       PASS
A4 重复正式写入幂等                         PASS
A5 过期 revision 写入阻断                   PASS
A6 服务重启恢复                             PASS
A7 显式基线导入与身份冲突阻断               PASS
A8 写入失败回滚、不产生半完成正式事实        PASS
A9 中文跨网络分块写入保持 UTF-8 完整性       PASS

Result: 9 / 9 PASS
```

相关回归：

```text
Question Resource Admission                 22 / 22 PASS
Material Observation                        26 / 26 PASS
Material Resource Production                13 / 13 PASS
Material Resource Workbench State            5 / 5 PASS
Phase 17.3 Batch A Integration              17 / 17 PASS
Phase 17.3 /learning Entry                    5 / 5 PASS
Production Build                                  PASS
```

真实基线切换结果：

- 已指定标准浏览器 `http://127.0.0.1:5174` 为正式基线来源；
- 已导出标准浏览器完整快照并完成身份完整性校验；
- 已初始化本机 Shared Store，并建立 `.bak` 基本备份；
- 基线切换时发现并修复 UTF-8 网络分块解码问题；
- 修复后已恢复受影响字段，正式资源中不存在 Unicode 替换字符；
- 当前共享数据包含 6 篇学习材料、6 个训练计划、23 个训练任务、9 个题目 Draft、9 个 Frozen Version、9 个 Registry Entry 与 9 个 Observation Link。

2026-07-27 受控双端人工检查已完成：

- 全新基线初始化与 `questionQuality` 补齐通过；
- A 端写入、B 端读取通过；
- B 端发布、A 端读取通过；
- 旧 Revision 写入返回 HTTP `409`；
- 重启开发服务后共享正式资源保持；
- 验收临时素材已清理。

2026-07-27 独立浏览器内核最终确认已完成：

- Codex 内置浏览器写入，隔离用户目录的独立 Google Chrome 刷新可见；
- 独立 Google Chrome 写入，内置浏览器刷新并选择最新版本后可见；
- 两端最终计数一致：学习材料 `2`、学习任务 `8`、待审核题目 `3`、已发布练习 `1`；
- 验收前完整数据已恢复，两端均不存在临时验收标记。

因此当前准确状态是：

> Phase 17.4A 工程实现、自动化 Debug、标准浏览器正式基线切换、全新基线初始化、受控双端检查与独立浏览器内核一致性确认均已通过；共享存储已成为本机正式资源来源。Phase 17.4B 继续负责复杂迁移、冲突治理、历史快照和自动恢复。

## 2026-07-26 Shared Store 生命周期 Revision 对齐

Phase 17.4A Repository 已补充同一内容 Revision 下的生命周期转换规则：

- 允许 `draft -> pending_review` 等不改变 Plan 内容的合法状态转换；
- 继续阻断同一 Revision 下对 Material、Task Plan 等正式内容的静默修改；
- Phase 17.4A Shared Resource Persistence Debug 更新为 `10 / 10 PASS`。

完整记录见：
[Phase 17 训练任务到题目审核交接修复记录](./reports/phase17_review_handoff_idempotency_fix_2026-07-26.md)
