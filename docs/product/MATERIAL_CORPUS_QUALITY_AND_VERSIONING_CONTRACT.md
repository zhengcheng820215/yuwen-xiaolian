# 材料语料质量与版本升级契约

英文名称：Material Corpus Quality and Versioning Contract

状态：`ACTIVE`

文档版本：`material_corpus_quality_and_versioning_v1.9`

生效日期：`2026-08-13`

## 一、目标与适用范围

本文约束正式材料语料从录入、校准、正文修订、任务重新规划、题目重新发布到 Learning 消费的完整换代流程。它解决以下问题：

1. 正文、分段、标点或来源元数据需要修订时，如何保留旧版本审计而不污染当前生产；
2. 材料换版后，旧 Plan、TrainingTask、Question、Observation Link 和 Registry 如何退出当前口径；
3. 工作台“待处理 / 已发布”与 Learning 实际可消费资源如何保持同一事实；
4. 如何识别 OCR 空格、标点、重复设问、能力失衡和来源不完整等语料质量问题。

本文不改变 Candidate、Question Revision、Assessment、Human Review、Freeze 和 Registry 的既有不可变边界。正文换版不能被解释为允许静默修改已冻结题目。

## 二、历史语料校准基线

2026-08-13 的本地 Shared Store 校准后包含 `9` 篇活动材料、`31` 道当时的 Plan 任务，全部已有活动正式资源。该次主要校准问题为：

补充记录：同日后续录入《走一步，再走一步》并完成3道正式题发布后，阶段1只读基线曾更新为 `10` 篇活动材料、`34` 道正式题；原 `9 / 31` 记录作为前一校准时点的历史事实保留，两者均不再作为当前状态或后续优化验收基数。

| 类型 | 已发现问题 | 处理要求 |
| --- | --- | --- |
| 正文格式 | 《从百草园到三味书屋》存在 OCR 式中文内空格、全角拉丁字母和分段质量问题 | 创建新 Material Version；不得原位改写 v1 |
| 标点 | 《皇帝的新装》《女娲造人》存在可确定的引号或问号规范问题 | 形成新 Material Version，并重新建立当前资源关系 |
| 题目覆盖 | 《天上的街市》两题围绕同一组肯定副词，区分度不足 | 生成新题目 Revision，保留旧正式版本历史 |
| 任务覆盖 | 《从百草园到三味书屋》偏重百草园 | 创建新 Plan Revision；已发布旧任务不自动成为新 Plan 的当前正式资源 |
| 能力分布 | 当前题目明显偏向 `analysis / intermediate` | 作为批次质量提醒，逐篇校准，不以配额机械改题 |
| 来源元数据 | 多篇材料仅有测试性来源描述，缺少作者、体裁、年级、教材版本和核验状态 | 补充结构化元数据；未核验信息不得伪造为权威来源 |
| 历史关系 | 个别材料仍保留旧 Plan 的 active link 或活动旧草稿 | 标记为 `superseded / archived`，保留审计，不参与当前统计和 Learning |

本表是校准基线，不是永久题库清单。后续材料按同一规则增量审查。

素材维护和优化命令必须按运行时活动材料集合工作，不得把 `9 / 31`、`10 / 34` 或其他校准时点硬编码成执行前提。固定数量只可作为一次报告的验收快照；未来材料增删或换版时，工具仍须正常 dry-run，并通过显式 `--apply` 才能写入。

## 三、Material Version 不可变规则

1. `materialVersionId` 标识一份不可变正文快照。标题、正文、分段、来源或影响语义定位的元数据发生变化时，必须创建后继 Material Version。
2. 新版本必须保留稳定 `materialId`，递增 `versionNumber`，记录 `parentMaterialVersionId`、`revisionNote` 与创建时间。
3. 纯界面空白折叠可以作为展示投影；任何写回 Shared Store 的正文规范化仍属于版本升级，不得原位覆盖。
4. 新版本完成 Plan 和正式资源接续前，旧版本可以继续保持 `active`；切换必须在新链路可消费后完成。失败时保持旧链路，不制造半切换状态。
5. 切换完成后，旧版本标记为 `retired`。`retired` 只表示不再进入当前生产和新 Learning 分配，不删除历史版本、历史学习会话或冻结快照。

## 四、材料元数据契约

Material Version 可以附带以下结构化元数据：

| 字段 | 含义 |
| --- | --- |
| `author` | 已核验作者；不确定时省略 |
| `translator` | 已核验译者；不确定时省略 |
| `genre` | 叙事散文、写景散文、童话、寓言、神话、现代诗、文言文等受控值 |
| `gradeRange` | 适用年级范围，不替代题目自身难度 |
| `curriculumUnit` | 教材单元或课程位置 |
| `edition` | 教材或来源版本 |
| `tags` | 用于检索的稳定标签，不承载状态 |
| `provenanceStatus` | `verified / needs_verification / test_only` |

`source` 继续保留历史来源说明和版权备注，但标准录入页不得要求用户填写“人工录入素材”一类无信息增量的来源说明。新建人工素材时，系统自动写入 `sourceType = manual`、系统来源描述和创建时间；版权备注作为折叠的可选信息。已有版本的来源数据不得因界面收口被清空或覆盖。`provenanceStatus` 为 `needs_verification` 或 `test_only` 时，工作台可以生产和校准，但生产规模批准必须单独判断；页面不得把“可生成题目”描述为“来源已核验”。

## 五、正文换版后的资源接续

材料 v1 升级为 v2 时，当前链路按以下顺序建立：

```text
Material v2
→ Structure / Anchor v2
→ Observation Plan Revision for v2
→ TrainingTask v2
→ Question Candidate / Revision bound to v2
→ Assessment + Human Review
→ Frozen Formal Version bound to v2
→ Active Registry / Observation Link
→ retire Material v1 current-production relation
```

强制要求：

1. 新 Plan 和 TrainingTask 必须绑定 v2 的 `materialVersionId`，不得复制旧 ID 后仅替换正文；
2. 新正式题目必须绑定 v2，且 Frozen Version 的材料快照必须来自 v2；
3. 旧题可以作为生成参考，但不能因题干相同而直接冒充 v2 已发布；
4. 只有新任务的当前活动 Registry 与活动 Observation Link 同时成立，工作台才显示“已发布”；
5. 换版中断时保留已经成功的后继对象并支持幂等继续，但 Learning 继续使用切换前的完整活动链路。

## 六、当前资源唯一判定

工作台统计、任务卡和 Learning 必须共用以下判定。一个正式题目属于“当前可消费资源”，必须同时满足：

1. Material Version 为该 `materialId` 的当前 `active` 版本；
2. Observation Plan 是该 Material Version 的规范当前 Plan；
3. TrainingTask 属于该 Plan 的当前任务集合；
4. Frozen Formal Version 的 `materialVersionId` 与 TrainingTask 完全一致；
5. 任务身份通过 `observationTaskPlanId / taskRevisionRootId / parentObservationTaskPlanId` 合法匹配；
6. Registry Entry 为 `active`，Observation Link 为 `active`；
7. 不存在更新的人工决策要求当前 Revision 停止自动替换。

任何只满足“同一 resourceId”“题干相同”“旧 Plan 曾发布”或“历史 link 仍为 active”的对象，都不能进入当前发布数或新 Learning 分配。

## 七、历史关系清理

1. 旧 Plan 对应 Observation Link 在新链路切换后改为 `superseded`；不得物理删除。
2. 已被后继 Draft 替代且不再可操作的旧活动 Draft 改为 `archived`；Validation、Assessment、Review 和 Frozen Version 继续保留。
3. 历史 Registry Entry 由新活动版本替换或标记退休；一个资源血缘不得同时存在两个被解释为“当前”的活动版本。
4. 清理命令必须幂等，支持 dry-run，并输出材料、Plan、任务、题目和链接的变更清单。
5. 历史清理不能反向修改已经存在的 Learning Session 引用。旧 Session 继续读取其冻结版本，新 Session 只分配当前活动链路。

## 八、语料与题目质量门禁

### 8.1 正文检查

- 中文字符之间异常空格、全角拉丁字母、半角中文标点；
- 引号、书名号、括号不配对；
- 段落分隔缺失或段号与正文锚点不一致；
- 标题或正文为空，或系统来源记录缺失；
- 正文哈希重复但被录入为不同活动材料。

检查结果区分：可确定的机械规范化、需要版本升级的内容修订、需要人工核验的来源问题。系统不得在无法确认原文时自动改写内容。

### 8.2 题目与任务检查

题目完整方案、作答格式匹配、题组去重、能力梯度与少量定向替换遵循[AI 题目生成质量与定向优化契约](./AI_QUESTION_GENERATION_QUALITY_AND_TARGETED_OPTIMIZATION_CONTRACT.md)。题目定向优化不得创建新的 Material Version，也不得改写材料正文或来源状态。

- 同篇材料的题干、回答对象、证据范围和评分目标高度重复；
- 任务只覆盖材料前半部分或单一情节；
- 批次长期集中在单一 `abilityId`、难度或题型；
- 题目声称引用的段落超出 Material Version；
- 题干可读但 Frozen Version、任务身份或 Assessment 不属于同一材料版本。

能力分布用于发现盲区，不设置脱离文本价值的机械配额。替换题目必须先说明新增的观察价值。

## 九、Learning 消费边界

1. Learning 新建或续接下一任务时，只读取第六节定义的当前可消费资源。
2. `retired` Material、历史 Plan、`superseded` Link、未采用 Candidate、未冻结 Revision 和非活动 Registry 不进入新分配。
3. 已开始 Session 固定引用其 Frozen Version；材料换版不得让进行中的题目正文或评分规则静默变化。
4. 生产端发布成功与 Learning 可用性探测读取同一 Shared Store Revision。出现并发变化时返回可恢复状态，不进入空工作区或无限重试。

## 十、迁移与验收

一次材料语料优化必须依次完成：

1. `dry-run` 生成审计报告；
2. 创建必要的 Material Version、Plan Revision 和任务身份；
3. 生成或接续题目 Revision，并重新完成质量检查与发布；
4. 原子切换活动 Material / Registry / Link 关系；
5. 将旧链接和旧活动草稿改为历史状态；
6. 验证工作台总数、单卡状态和 Learning 可消费数一致；
7. 验证刷新、失败重试和重复执行不产生重复版本或重复活动关系。

最低验收用例：正文修订换版、只换题不换材料、Plan 增题、历史 link 清理、换版中断恢复、旧 Session 固定版本、新 Session 读取新版本、批次统计与 Learning Registry 一致。

### 10.1 首次校准执行记录（2026-08-13）

- `audit:material-corpus` 已形成只读语料审计，识别元数据、中文内空格、全角拉丁字符、半角中文标点、引号配对和题目重合风险；
- `maintain:material-corpus` 已原子地把 `5` 条不属于当前任务血缘的历史 active link 改为 `superseded`，把 `4` 个无 Frozen Version 支撑且不属于当前任务的旧 Draft 改为 `archived`；重复执行不再产生生命周期变更；
- 《女娲造人》通过“生成补充候选 → 采用并保存 → 质量检查 → 正式发布”新增 `1` 道主题分析题，批次由 `30/30` 更新为 `31/31`；
- Learning 刷新后继续返回“可以开始”，证明新增正式资源未破坏当前消费链；
- 正文与来源问题只进入新版材料流程，未直接覆盖当前活动 Material Version。

## 十一、禁止做法

- 为了快速修正错字直接改写既有 Material Version；
- 仅修改下拉框“待处理 / 已完成”文案来掩盖历史活动关系；
- 在新 Material Version 下复用旧任务 ID 并把旧题误计为已发布；
- 删除旧 Frozen Version、Review 或学习会话以消除冲突；
- 将来源不明内容自动标记为 `verified`；
- 生产端显示“已发布”，但 Learning 仍按另一套身份条件筛选资源。

## 十二、第二次语料校准执行方案（2026-08-13）

本轮校准按“合同先行、材料换版、题组修订、质量补证、全链路验收”的顺序执行。执行过程中不得为了让统计归零而改变题目或材料的教育含义。

### 12.1 材料换版范围

| 材料 | 新版本允许的改动 | 不允许自动推断的内容 |
| --- | --- | --- |
| 《皇帝的新装》 | 修复能够由引号配对唯一确定的标点问题；补充 `needs_verification` 来源元数据 | 未核验的译者、教材册次和出版社 |
| 《从百草园到三味书屋》 | 清理中文字符间 OCR 空格、全角拉丁字符；保持段落与原有锚点语义 | 对原文措辞、段落顺序或删节范围的文学性改写 |
| 《女娲造人》 | 把中文语境中的半角问号替换为全角问号；补充 `needs_verification` 来源元数据 | 未核验教材版本和作者署名细节 |

其余六篇材料本轮只补充保守的结构化元数据，`provenanceStatus` 一律保持 `needs_verification`，不得写成 `verified`。任何正文变化都必须形成 Material v2；仅补充不影响正文定位的元数据时，也通过同一版本化入口记录审计原因。

### 12.2 题组修订范围

1. 《从百草园到三味书屋》形成新 Plan Revision：至少两道当前任务直接覆盖三味书屋的先生、课堂或学生生活；题组不能继续全部标记为 `analysis`。
2. 《天上的街市》保留一道人称肯定副词题，另一题改为“街灯—明星”的联想和意象转换，避免两个问题共享同一回答证据。
3. 《猫》优先把一题改为三只猫的比较整合；《秋天的怀念》只扩充评分标准的开放答案边界；《女娲造人》允许把主题题调整为推断能力。
4. 题目修改一律创建 Question Revision / Frozen Version，不原位改写既有 Frozen Version；未被替换的正式题继续沿用。
5. 题组任务数原则上保持当前总数 `31`，本轮以替换和校准为主，不以增加题量制造能力分布改善。

### 12.3 早期质量证据补齐

《散步》《秋天的怀念》《猫》的九道当前正式题缺少 Frozen Quality Trace。处理遵循：

1. 重新执行确定性检查与语义质量检查；
2. 检查结论通过时，为当前不可变 Frozen Version 建立可审计 Assessment Bundle 与 Frozen Quality Trace；
3. 如题干、评分标准或人工决定发生变化，不得回填到旧版本，必须创建新 Revision 后重新冻结；
4. 补证必须幂等，同一 `resourceVersionId` 不得产生多个有效 Trace；
5. 补证失败不影响现有发布和 Learning 会话，但该题必须保留“证据待补齐”的审计状态。

### 12.4 原子切换与回滚

一次材料换版只有在新 Material、Structure、Anchor、Plan、正式 Frozen Version、Registry 和 Observation Link 均写入成功后，才能退休旧材料和 supersede 旧链接。任一步失败时：

- 当前 Learning 继续消费完整旧链路；
- 新建但尚未接通的对象保留为可恢复草稿或非活动版本；
- 重试复用稳定血缘身份，不重复创建 Material Version 或 Question Revision；
- Shared Store 仍使用 revision compare-and-swap，禁止绕过仓储直接覆盖 JSON。

### 12.5 本轮验收指标

- 该次验收中的活动材料为 `9` 篇，正式题为 `31` 道；
- 该次正式题 `31/31` 同时具备 active Registry 和 active Observation Link；
- 该次正式题 `31/31` 具备 Frozen Quality Trace；
- 三篇目标材料的机械正文问题归零，九篇材料均有结构化元数据且未虚标 `verified`；
- 《从百草园到三味书屋》至少两道题覆盖三味书屋，《天上的街市》不再存在同证据语言题；
- 工作台发布统计与 Learning 新任务可消费统计一致；
- dry-run、重复 apply、刷新恢复和 Learning 启动测试全部通过。

### 12.6 第二次校准执行记录（2026-08-13）

- Shared Store 由 revision `728` 原子切换到 `729`，九篇活动材料均建立 v2，旧 v1 进入版本历史；
- 九篇 v2 均补充作者、体裁、七年级范围、检索标签和 `needs_verification` 来源状态，没有把未核验教材信息标记为 `verified`；
- 《皇帝的新装》引号、《从百草园到三味书屋》OCR 空格与全角拉丁字符、《女娲造人》半角问号已通过新 Material Version 修复，机械正文审计归零；
- 当前 `31` 道题全部形成绑定 v2 的新 Frozen Version、active Registry、active Observation Link 和 Frozen Quality Trace；原有缺证据的九道早期正式题同时完成历史质量补证；
- 《从百草园到三味书屋》任务4改为寿镜吾先生形象理解，任务5改为三味书屋生活概括与两地童年乐趣比较；
- 《天上的街市》任务1改为街灯与明星的联想及现实—想象过渡，任务2继续观察“定然 / 定能够”，两题不再共享同一证据目标；
- 《猫》任务1改为三只猫的全文比较整合，《秋天的怀念》菊花题允许有依据的开放解释，《女娲造人》主题题调整为推断能力；
- 重复执行优化命令返回 `apply-noop`，没有新增版本或链接；语料维护 dry-run 返回历史 active link `0`、陈旧 Draft `0`；
- 浏览器实测工作台显示“9 篇材料，共 31 道题，已全部发布”，被 v2 替代的 v1 不再误计入“停用素材”，停用素材数量保持为真实逻辑材料 `2`；
- Learning 刷新后显示“可以开始”；工作台状态 `20/20`、选择恢复 `11/11`、统一生产 P0-P7 `26/26`、质量持久化 `25/25` 通过，生产构建通过。

## 十三、第三次质量治理补强（2026-08-13）

第二次校准当时的投影为九篇 v2 材料和31道正式题，但原始 Registry 复核发现《皇帝的新装》3条、《狼》2条旧题仍保持 `active`，其 Frozen Version 绑定已经退休的 Material v1。它们因当时页面和 Learning 同时校验材料版本而未进入31道投影，但依赖 Registry 单表查询的消费者仍可能误读。

本轮按以下口径修复：

1. Observation Link 被新链路替换时标记为 `superseded`；
2. Registry Entry 不再参与新分配时标记为 `retired`；
3. 维护审计必须同时检查 Link 和 Registry，不得以“当前页面未显示”代替数据生命周期清理；
4. 当前活动 Registry 的 Frozen Version 必须绑定同一 `materialId` 的当前活动 Material Version；
5. 修订四道提醒题时创建后继 Question Version，不改变题目总数31；
6. AI 候选采用和真实作答校准遵循[AI 题目采用与真实作答校准契约](./AI_QUESTION_ADOPTION_AND_EMPIRICAL_CALIBRATION_CONTRACT.md)；来源状态只作为治理信息，不增加审核人或审核意见步骤。

本轮验收要求原始活动 Registry、当前 Observation Link、工作台统计和 Learning 可消费数全部为31；历史 v1 Frozen Version 与旧 Session 继续可追溯。

### 13.1 第三次治理执行记录

- Shared Store revision `729 → 730`：准确识别并退休《皇帝的新装》3条、《狼》2条绑定已退休 Material v1 的活动 Registry Entry；再次 dry-run 返回待退休 Registry `0`；
- Shared Store revision `730 → 731`：九篇材料形成 v3，31道正式题形成对应 v3 Frozen Version、active Registry、active Observation Link 和 Frozen Quality Trace；
- 《猫》全文比较题明确四个比较维度，《狼》行为题调整为 `comprehension / intermediate`，《皇帝的新装》骗子题调整为骗局因果链分析，《天上的街市》神话改写题补充传统故事背景并限定分析维度；
- 该次31道题的确定性质量结果为 `31 / 31 pass`，不再保留第二次校准中的3项 warning 和1项 `revision_recommended`；
- 九篇 v3 材料均写入 `textVerificationStatus = pending`、`rightsStatus = unknown`，没有伪造来源核验或版权授权；
- 生产主链固定为“采用并发布 / 不采用并重新优化”，不要求审核人、审核意见或第二次确认；
- 真实作答后台校准在0份样本时返回 `awaiting_data`，1–29份返回 `insufficient_sample`，达到30份后才计算试运行指标；
- 本次只保留非阻断的来源信息和真实样本校准，不引入教师盲审，也不制造学生样本。

补充一致性清理：Shared Store revision `731 → 732`。复核原始 Registry 时另发现1条绑定已停用 Batch A 演示素材的活动记录。它虽然已被当时 Learning 材料过滤挡住，仍按相同规则改为 `retired`，使原始活动 Registry 与该次31道正式题完全一致。

## 十四、阶段5收口约束（2026-08-13）

阶段4后的历史执行基线为 `10` 篇活动材料、`34` 道正式题。《走一步，再走一步》的机械标点和结构化元数据通过后继 Material Version 定向修复；不得原位覆盖 v1，也不得把未核验来源标为 `verified`。该次换版必须完整接续其3道正式题并维持全局 Registry、Observation Link、Frozen Quality Trace 与 Learning 可消费 `34 / 34`。

执行计划与验收记录见[AI 题目与素材优化阶段5收口计划](./AI_QUESTION_OPTIMIZATION_STAGE5_CLOSURE_PLAN_2026-08-13.md)。

### 14.1 阶段5执行记录

Shared Store revision `915 → 916`。《走一步，再走一步》形成 v2，9处半角中文标点归零并补齐保守结构化元数据；其3道正式题同步形成 v2 Frozen Version。重复 apply 为 no-op。该次执行结束时活动材料为 `10`、正式题为 `34`、Registry / Link / Trace / Learning 为 `34 / 34`，素材审计可执行问题为 `0`。全部来源待核验状态仅作为后台治理信息保留。

## 十五、P1-03 来源核验就绪度契约（2026-08-14）

来源治理必须区分三种证据，不得复用一个链接替代全部判断：

1. `sourceLocator`：篇目目录或来源线索，只证明目录归属；
2. `textSourceLocator`：能够支持当前版本逐字比对的正文证据；
3. `rightsEvidenceLocator`：支持 `cleared / public_domain` 判断的权利依据。

内部真实 Learning 试运行与扩大生产使用两套门槛：

- 内部试运行：材料正文非空，已有目录线索，正文未被核验为 `rejected`，权利状态未标记为 `restricted`；允许保持 `needs_verification / pending / unknown`，但必须在治理摘要中持续展示；
- 扩大生产：`provenanceStatus = verified`，正文状态为 `verified`，权利状态为 `cleared / public_domain`，并同时具备版本、正文证据、权利证据、核验人和核验时间；任一项缺失均不得显示为已满足扩大生产条件。

来源就绪度审计只读运行，不自动修改状态，也不因待核验事项阻断当前受控 Learning。标准 Material 创建和换版入口必须完整保留 `provenanceReview`，不得在元数据规范化时丢失证据字段。

## 十六、P2-01 题组基础能力补充规划（2026-08-14）

P2 的目标是为适合观察基础能力、但当前题组明显偏分析的材料补充少量理解、概括或事实确认题。能力分布只用于发现盲区，不要求材料之间或单篇内部比例平均。

### 16.1 首批冻结范围

首批最多新增4道，每篇最多1道：

| 材料 | 目标能力 / 难度 | 新增观察价值 |
| --- | --- | --- |
| 《皇帝的新装》 | `comprehension / basic` | 辨认骗局揭露前后人物可见言行与事实关系，不要求分析社会主题 |
| 《秋天的怀念》 | `summarization / basic` | 梳理母亲照顾并鼓励“我”的具体行为与直接结果，不分析象征或结构 |
| 《散步》 | `comprehension / basic` | 确认散步分歧、人物选择与解决结果，不扩展家庭责任主题 |
| 《狼》 | `summarization / basic` | 概括屠户行动链，不重复现有“两只狼如何配合围困”的证据对象 |

《从百草园到三味书屋》《走一步，再走一步》已有理解、概括或基础题，本轮不补。《女娲造人》《天上的街市》暂缓，等待首批新增题和真实作答反馈后再判断，不把“暂无基础题”机械解释为必须补题。

### 16.2 工程边界

1. P2-01 只冻结规划，不生成 Candidate、不创建 Plan Revision、不发布、不修改 Shared Store；
2. P2-02 如生成候选，必须读取当前 Material Version、现行题组和本节的观察边界；
3. 新候选不得仅把现有分析题改写为低难度，也不得与现有题共享回答对象、证据范围和评分目标；
4. 未采用候选不计入正式题数；实际采用少于4道属于合法结果；
5. 每采用1道都必须完整新增 Plan Task、Question Revision、Assessment、Frozen Version、Registry、Observation Link 和 Frozen Quality Trace；
6. 发布前后42道现有题保持不可变；发布完成后各消费链计数必须统一为 `42 + 实际采用数`，上限46。

### 16.3 验收矩阵

| 用例 | 预期 |
| --- | --- |
| 当前42题只读规划 | Shared Store revision和数据完全不变 |
| 目标范围 | 恰为4篇，每篇1个不同观察点 |
| 能力与难度 | 仅 `comprehension / summarization`，难度为 `basic` |
| 当前题质量 | 四篇现行题均无 blocker |
| 重复控制 | 新观察点与现有题的回答对象或行动线明确不同 |
| 数量控制 | 首批新增上限4，总量上限46 |
| 延后材料 | 延后不等于质量不合格，不产生待处理状态 |
| P2-02/P2-03 接续 | 候选未采用不改统计；采用后全链路计数一致 |

## 十七、P2-02 基础能力补充候选（2026-08-14）

P2-02 依据第十六节冻结范围形成4个完整 Training Candidate。候选必须通过现有 Material Observation Draft Generator 的隔离校验，并同时转换为完整 Question Editable Fields 接受题目生成质量检查。

| 材料 | 候选题干 | 能力 / 难度 |
| --- | --- | --- |
| 《皇帝的新装》 | 小孩子说出真相以前，皇帝、大臣和百姓是怎样对待这件“新衣服”的？请根据全文写出其中两类人物的具体表现。 | `comprehension / basic` |
| 《秋天的怀念》 | 母亲为了照顾并鼓励“我”重新面对生活，做了哪些具体事情？请根据全文概括其中两件。 | `summarization / basic` |
| 《散步》 | 请根据全文说明：一家人在田野散步时遇到了什么分歧？“我”最初怎样决定，最后一家人怎样解决？ | `comprehension / basic` |
| 《狼》 | 请根据全文，按事情发展概括屠户面对两只狼时采取的三个关键行动。 | `summarization / basic` |

每个候选均包含：材料范围、观察焦点、学生动作、题型与作答格式、最低要求、Rubric、答案接受范围、5类校准答案、Evidence Boundary 和 Training Candidate 安全边界。

P2-02 禁止创建或修改 Plan、Draft、Frozen Version、Registry、Observation Link 与 Quality Trace。候选通过只表示可以进入后续采用判断，不等于正式发布或教育效果已经验证。

### 17.1 P2-02 验收

- 4/4 被现有库存判定为 `new_observation_candidate`；
- 4/4 完整字段检查通过；
- 4/4 题目质量结果为 `ready`，blocker和实质重复均为0；
- 4/4 使用 `short_text + key_points`，不要求主题分析或深层解释；
- 4/4 提供 fully meets、partially meets、typical error、reasonable alternative、irrelevant 校准答案；
- Shared Store revision、42道正式题和全部当前资源关系保持不变。

## 十八、P2-03 基础能力补充正式发布（2026-08-14）

P2-03 只采用第十七节已经通过的4个完整候选，不重新生成题干，不替换原有42道正式题。每篇目标材料新增1个 Plan Task，并为该任务建立独立的 Draft、Validation、Human Review、Frozen Version、active Registry、active Observation Link、质量 Assessment Bundle 与 Frozen Quality Trace。

### 18.1 发布与身份规则

1. 四个候选必须作为一个完整受控批次进入发布准备；候选缺失、存在质量问题或只出现1—3个部分发布标记时，命令必须安全阻断；
2. 每篇材料创建后继 reviewed Plan，保留原 Plan 的既有任务身份与正式资源关联，只追加1个新任务；原 Plan 转为 `superseded`；
3. 新题使用独立 `resourceId / resourceVersionId / taskId`，并写入固定发布标记 `portfolio-supplement:p2-03-v1`；
4. 发布必须通过 Shared Store revision compare-and-swap 原子提交，禁止逐题形成可见的半完成状态；
5. 成功后再次执行同一发布命令必须返回 `apply-noop`，不得重复创建题目、Plan、Registry、Link 或质量记录；
6. 发布完成后的正式计数以当前活动材料、当前 Plan、active Registry、active Observation Link、Frozen Version、Frozen Quality Trace 与 Learning 可消费资源的交集为准，所有链路必须统一为46；
7. P2-01/P2-02 在发布后应把四篇目标识别为已满足，不再重复产出规划目标或候选；
8. 发布通过只证明内容与工程准入成立，不证明真实学生学习效果；后者仍由 Learning 真实作答与校准链验证。

### 18.2 发布结果

- Shared Store revision：`1046 → 1047`；
- 新增正式题：4道，分别属于《皇帝的新装》《秋天的怀念》《散步》《狼》；
- 该次发布结束时活动材料为12篇、正式题为46道；
- Current Task / Registry / Observation Link / Frozen Version / Frozen Quality Trace / Learning 可消费题：`46 / 46`；
- 新题能力与难度：2道 `comprehension / basic`、2道 `summarization / basic`；
- 重复执行发布命令：`apply-noop`，revision保持1047；
- P2-01发布后规划回归：4篇均识别为已满足；P2-02发布后候选回归：新增候选0、已发布4、问题0；
- 浏览器工作台显示“12 篇材料，共 46 道题，已全部发布”，四篇目标材料均显示4个训练任务、已发布4个。

详细记录见 [P2-03 基础能力补充正式发布验收记录](../education/phase/reports/question_portfolio_supplement_p2_03_acceptance_2026-08-14.md)。
