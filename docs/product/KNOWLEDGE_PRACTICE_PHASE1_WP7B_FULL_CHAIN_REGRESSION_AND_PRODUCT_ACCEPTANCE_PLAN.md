# 知识练习第一阶段 WP7B 全链回归与产品验收工程实施文档

状态：`DESIGN CONFIRMED / ENGINEERING ACCEPTANCE AUTHORIZED BUT NOT STARTED`

版本：`knowledge_practice_phase1_wp7b_acceptance_plan_v1.0`

日期：`2026-08-30`

上位方案：[`KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md`](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_PLAN.md)

中央执行清单：[`KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md`](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md)

入口与角色决策：[`STUDENT_SINGLE_ENTRY_FORMAL_READING_AND_KNOWLEDGE_PRACTICE_ALIGNMENT_DECISION_WP0A.md`](./STUDENT_SINGLE_ENTRY_FORMAL_READING_AND_KNOWLEDGE_PRACTICE_ALIGNMENT_DECISION_WP0A.md)

前置验收：[`KNOWLEDGE_PRACTICE_PHASE1_WP6_ENGINEERING_ACCEPTANCE_REPORT.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP6_ENGINEERING_ACCEPTANCE_REPORT.md)

## 一、文档目的

本文定义 WP7B 的执行范围、测试矩阵、真实学生试用流程、内容容量测量、缺陷分级和状态升级门禁，用于回答两个彼此独立的问题：

1. WP1—WP6 与 WP7A 组合后，工程主链是否仍稳定、可恢复、可回归；
2. 目标学生是否能独立理解并使用这套产品，且不会把轻量知识练习误解为正式能力结论。

WP7B 是第一阶段的产品收口包，不是新增功能包。只有验收发现阻断缺陷时才允许进行范围内修复；任何新功能、第二学生入口、正式 Evidence/Profile 写入或大规模题库扩建必须另立决策。

本文末尾 D1—D12 已由产品负责人于2026-08-30整体确认，并授权先执行冻结基线、全量回归、浏览器矩阵和内容容量评估。文档确认不等于 Engineering Acceptance、Product Acceptance 或 Live。

## 二、前置状态与准确声明

### 2.1 已满足的工程依赖

| 工作包 | 当前状态 | 主要证据 |
| --- | --- | --- |
| WP0A | Decision Confirmed | `/learning` 唯一学生入口与资源角色冻结 |
| WP1 | Engineering PASS | 数据迁移与题目契约 47 / 47 |
| WP2 | Engineering PASS | 选题与 Session 47 / 47 |
| WP3 | Engineering PASS | 判题与反馈 49 / 49 |
| WP4 | Engineering PASS | 本地持久化与恢复 33 / 33 |
| WP7A | Engineering PASS / Product Pending | 唯一入口 50 / 50 |
| WP5 | Engineering PASS / Product Pending | 错题即时巩固 54 / 54 |
| WP6 | Engineering PASS / Product Pending | 结果与推荐 56 / 56 |

当前自动化基线为：知识练习 WP1—WP6 与 WP7A 共 `336 / 336 PASS`；加上 Unified Entry、Day0 与 Runtime R2 的已执行回归为 `423 / 423 PASS`。

### 2.2 当前资源口径

- 正式题库：24篇材料、81道Current；63道核心阅读、18道条件微训练；
- 轻量知识题：19 approved、15 draft；
- 轻量内容覆盖：6个当前可用分类；
- 已审核巩固内容：3个变式组、6条有向 ReinforcementLink；
- 第一阶段保存范围：本机、本浏览器。

81道正式题与19道approved轻量题不得合并表述。WP7B测量轻量知识练习重复率时只使用轻量题库存。

### 2.3 WP7B 的三层状态

| 状态层 | 能证明什么 | 不能证明什么 |
| --- | --- | --- |
| Engineering Acceptance PASS | 自动化、构建、浏览器矩阵和异常链稳定 | 真实学生理解与产品价值 |
| Product Acceptance PASS | 至少5次受控试用达到冻结标准 | 长期学习效果与自然日稳定性 |
| Live / Natural-day | 连续5—7个自然日运行达到观察标准 | 永久有效或长期能力提升 |

允许出现：`Engineering PASS / Product Acceptance Pending`。不得因为全量自动化通过直接升级 Product Acceptance。

## 三、目标、非目标与停止边界

### 3.1 WP7B 目标

1. 复核 `/learning` 唯一入口及正式阅读、轻量知识练习优先级；
2. 执行 WP1—WP6、WP7A 和正式 Runtime 的全量回归；
3. 完成专项、综合、恢复、异常、推荐和错题重做浏览器矩阵；
4. 在手机、平板和PC关键宽度验证布局、键盘和非颜色表达；
5. 运行连续5轮和10轮轻量题容量模拟，记录重复、超额重复、短缺和枯竭；
6. 形成统一真实学生试用包；
7. 完成至少5次有效受控试用；
8. 对问题进行内容、交互、Runtime、表达或验收环境归因；
9. 输出 Engineering Acceptance Report 和 Product Acceptance Report；
10. 明确第一阶段是 PASS、CONDITIONAL PASS、NEEDS REVISION 还是 BLOCKED。

### 3.2 非目标

WP7B 不负责：

- 新建第二学生首页或恢复 `/practice/knowledge` 产品壳；
- 将知识练习结果写入正式 Evidence/Profile；
- 用真实学生试用宣称长期能力提升；
- 为达到题量数字批量发布未审核内容；
- 默认录音、录像或收集学生真实姓名；
- 接入账户、云同步或跨设备恢复；
- 在试用中临时修改题目答案、规则或统计口径；
- 将老师演示、开发者自测或自动化脚本计入5次真实学生试用；
- 把5次受控试用等同5—7个自然日 Live 观察。

### 3.3 立即停止条件

出现以下任一情况，相关试用立即停止并转为缺陷处理：

1. 正确答案、判题或结果统计错误；
2. 学生答案、正式 Evidence 或本地记录发生不可解释丢失；
3. 知识练习写入正式 Evidence/Profile；
4. 重复提交产生重复事实；
5. active Formal 或 Practice Session 被静默覆盖；
6. 学生无法退出、恢复或完成且没有可理解的恢复动作；
7. 页面暴露内部 Prompt、Provider、Runtime ID或敏感技术字段；
8. 发现涉及未成年人隐私、录音录像或身份记录的未授权行为；
9. 试用环境与冻结版本不一致；
10. 试用过程中发生影响后续观察的临时代码热修复。

修复后必须使用新 build identity 重新执行受影响回归；修复前后的试用记录不得混为同一批次。

## 四、角色与责任

| 角色 | 责任 |
| --- | --- |
| 产品负责人 | 确认D1—D12、组织学生与时间、处理必要授权、决定最终Product状态 |
| 工程执行者 | 冻结版本、执行自动化/浏览器验收、记录技术证据、修复范围内阻断 |
| 观察员 | 按脚本观察，不代替学生操作；记录提示次数、原话和问题归属 |
| 目标学生 | 独立完成指定任务并用自己的话反馈理解 |
| 内容审核者 | 核查发现的题干、答案、解析和错因问题 |

同一人可以承担产品负责人和观察员，但不得一边操作产品一边把该次记录为“学生独立完成”。

## 五、验收版本冻结

### 5.1 冻结项

每一批验收必须记录：

- 日期和时区；
- Git commit或可复核diff快照；
- build identity；
- 浏览器与设备；
- WP1—WP7A测试结果；
- approved题量、分类数、变式组和Link数；
- Store schema与Completion Record版本；
- 已知限制；
- 是否使用全新浏览器数据或已有恢复数据。

当前工作区存在大量尚未提交的WP1—WP7A变更。正式受控试用前必须建立可回滚、可复核的Git检查点；否则不得开始计入Product Acceptance的试用。

### 5.2 试用中变更规则

- 同一批次试用期间不修改产品代码和approved内容；
- 发现P0/P1后停止该批次；
- 修复后重新执行全部受影响的自动化和浏览器链；
- 修复前记录保留为失败证据，但不能与修复后结果平均抵消；
- 仅文档错字且不影响学生界面时可在批次后统一修订。

## 六、Engineering Acceptance 全量回归

### 6.1 自动化矩阵

必须全部通过：

| 组别 | 最低证据 |
| --- | ---: |
| WP1 数据与迁移 | 47 / 47 |
| WP2 选题与Session | 47 / 47 |
| WP3 判题与反馈 | 49 / 49 |
| WP4 持久化与恢复 | 33 / 33 |
| WP5 错题即时巩固 | 54 / 54 |
| WP6 结果与推荐 | 56 / 56 |
| WP7A 唯一入口 | 50 / 50 |
| Unified Learning Entry | 31 / 31 |
| Phase16.3 Day0 | 15 / 15 |
| Product Runtime Reliability WP-R2 | 41 / 41 |

若正式 Runtime 后续已有更高且被中央文档指定的可靠性基线，执行时使用更高基线，不因本文写死R2而退回旧门禁。

### 6.2 构建与静态检查

- Vite production build PASS；
- `git diff --check` PASS；
- 新增和修改Markdown本地链接0损坏；
- 不存在未处理TypeScript语法或模块导入错误；
- 记录既存大chunk和动态导入警告，不把警告误报为新PASS；
- 结果、推荐和巩固领域不得导入正式Evidence/Profile写入模块。

### 6.3 入口与身份矩阵

| 场景 | 预期主要动作 |
| --- | --- |
| 无active Formal、无active Practice | 按正式主线可用性投射唯一主要动作 |
| active Formal | 继续正式任务 |
| 无active Formal、active Practice | 继续知识练习 |
| 双active历史兼容态 | 按WP7A冻结优先级投射，不静默修改任一Session |
| Formal Runtime故障 | 准确显示正式故障，不伪装为知识题不足 |
| Practice Store故障 | 不阻断正式Learning |
| 旧知识路由 | 只读迁移到规范路径，不重建Session |
| future Practice Store | 正式Learning可用，知识练习保持只读 |

### 6.4 浏览器主链A：专项、反馈、巩固、结果、推荐

1. 从 `/learning` 进入知识练习；
2. 选择至少5道可用的分类；
3. 核对只生成5道基础题；
4. 制造至少1次可触发巩固的错误；
5. 核对错误选项反馈、关键依据和解题步骤；
6. 核对巩固题在冻结位置出现且不递归；
7. 完成后核对基础首次正确率和巩固分账；
8. 核对知识点与审核错因；
9. 点击推荐并创建合法新Session；
10. 返回来源Result，历史事实不被改写。

### 6.5 浏览器主链B：综合与轮换

1. 创建10题综合练习；
2. 核对至少3个可用分类和分类上限；
3. 完成后创建第二轮、第三轮；
4. 记录相邻轮重复率和库存理论下限；
5. 核对没有同一Session内重复题；
6. 核对候选不足时使用实际题数，不重复凑数；
7. 全部基础题首次答对时核对新综合推荐。

### 6.6 浏览器主链C：恢复与并发

- 基础题未提交时刷新；
- 已提交且反馈展开时刷新；
- 巩固题插入后刷新；
- 关闭页面后从 `/learning` 恢复；
- completed Result刷新；
- Completion V1升级为V2；
- mistake_review从入口恢复；
- 双标签页revision冲突；
- active Session下点击旧Result推荐；
- 显式放弃并新建，且旧Session进入终态。

### 6.7 异常与降级链

| 场景 | 预期 |
| --- | --- |
| 空题库 | 不创建Session，显示准确空状态 |
| 分类不足5题 | 展示并使用实际数量 |
| 无可靠变式 | 安静降级，不插无关题 |
| 推荐目标库存变化 | 不创建空Session，留在Result并提示 |
| 本地JSON损坏 | 隔离损坏对象，应用不白屏 |
| localStorage不可用或写满 | 保持一致内存态并说明刷新风险 |
| future Store | 不覆盖、不迁移 |
| 题目版本失效 | 保留已有事实并给出受控结束/重建动作 |
| Result不可重建 | 只隔离lastCompletion，不清空其他记录 |

### 6.8 响应式与可访问性

必须覆盖：

- 390×844手机；
- 768×1024平板；
- 1366×768或更大PC；
- 键盘选择、提交、下一题、推荐和返回；
- 200%浏览器缩放下关键动作可见；
- 结果和错误不只依赖红绿颜色；
- loading、status、alert和alertdialog语义可识别；
- 长题干、长知识点和错因文本不横向溢出；
- 底部操作不遮挡题干或反馈。

## 七、内容容量与重复率验收

### 7.1 为什么不能直接要求零重复

当前轻量库存只有19道approved。专项池可能只有1—6道，综合每轮目标10道。连续使用必然存在由库存规模决定的重复下限，因此WP7B区分：

- 理论必要重复；
- 选题算法造成的超额重复；
- 学生主观感受到的不可接受重复。

### 7.2 指标定义

```text
withinSessionDuplicateRate
  = Session内重复Question ID数 / 实际基础题数

adjacentRepeatRate(n)
  = 第n轮与第n-1轮重复Question ID数 / 第n轮实际基础题数

theoreticalAdjacentFloor(n)
  = max(0, currentCount + previousCount - eligiblePoolSize) / currentCount

excessAdjacentRepeatRate(n)
  = max(0, adjacentRepeatRate(n) - theoreticalAdjacentFloor(n))

fillRate
  = 实际基础题数 / 目标题数

exhaustionRate
  = 无法创建任何题目的请求数 / 有效创建请求数
```

理论下限只用于解释库存约束，不为可避免的算法重复免责。若变式组排重、近期降权等约束进一步缩小候选池，报告必须单独列出。

### 7.3 连续使用矩阵

| 序列 | 次数 | 目标 |
| --- | ---: | --- |
| 综合练习连续序列 | 10轮 | 测量相邻重复、最近两轮复用、分类覆盖和枯竭 |
| 字音字形专项 | 5轮 | 测量小池重复、实际题量和学生重复感 |
| 文言实词虚词专项 | 5轮 | 复核另一完整5题分类 |
| 题量不足分类 | 每个当前不足5题分类至少1轮 | 核对实际题数表达和可理解性 |
| 错题重做 | 至少3组 | 核对失效过滤、顺序和新Session身份 |

### 7.4 Engineering 内容门禁

必须满足：

1. Session内重复率恒为0%；
2. 有approved候选时exhaustionRate为0%；
3. 相同输入与seed结果可复现；
4. 超额重复必须为0，或有明确被验证的约束原因；
5. 题量不足时fillRate真实展示，不复制题目凑数；
6. 不足3道approved的分类不得被包装为正常5题专项；应显示实际数量，并在Product Acceptance前由产品负责人决定补题、隐藏或标记“内容准备中”；
7. mixed至少具备10道approved且覆盖至少3个分类；
8. 所有参与验收的题均为approved且内容版本可追溯。

### 7.5 Product 内容门禁

- 至少4/5有效试用未把“题目重复”列为主要负面反馈；
- 不得出现同轮重复或明显可避免的相邻重复；
- 不得出现错误答案、歧义题干或解析与答案冲突；
- 内容问题必须完成审核归因，P0/P1内容缺陷为0；
- 若学生集中反馈小题池重复，Product Acceptance保持Pending，并由数据决定补题范围；
- 100道仍是规划参考，不因WP7B自动变成固定PASS门槛。

## 八、真实学生受控试用设计

### 8.1 有效试用定义

计入Product Acceptance的试用必须：

1. 使用冻结且通过Engineering Acceptance的同一版本；
2. 由真实目标学生操作，不由老师或开发者代做；
3. 使用参与者编号，不在工程文档记录真实姓名；
4. 记录设备、浏览器、任务脚本和必要提示次数；
5. 完成至少一组专项或综合练习并查看Result；
6. 有明确PASS / NEEDS REVISION结论；
7. 观察表字段完整；
8. 未在中途修改代码或approved内容。

同一学生可参加多次，但建议至少覆盖3名不同目标学生；最终必须至少5次有效试用。

涉及未成年人时，参与授权、现场安排和信息保存由产品负责人按适用要求处理。默认不录音、不录像、不采集联系方式或真实姓名。

### 8.2 五次最低场景分配

| 试用 | 必含场景 |
| --- | --- |
| T1 | 首次从 `/learning` 找到并完成专项；至少一次答错反馈 |
| T2 | 综合10题、分类覆盖、结果与新综合推荐 |
| T3 | 可触发错题巩固、基础/巩固分账和专项推荐 |
| T4 | 中途刷新或关闭后恢复并完成 |
| T5 | 手机或平板；错题重做或题量不足分类 |

设备覆盖最低要求：至少1次手机、1次平板、1次PC。若实际目标场景不包含平板，产品负责人可在D12中显式调整，但必须保留手机和PC。

### 8.3 统一任务指令

观察员只说：

> 请从学习入口开始一组基础知识练习。按你自己的判断完成，看到反馈后继续，最后告诉我这轮哪里做得比较稳、哪里还建议练，以及你准备点哪个下一步。

恢复场景额外说：

> 现在请刷新或关闭后重新进入，看看能否继续刚才的练习。

除非学生已明确卡住，观察员不得提示具体按钮。每次提示必须记录原话和发生步骤。

### 8.4 观察后提问

任务完成后只问：

1. 这轮你第一次答对了多少？
2. 选一道反馈，用自己的话说你为什么错或正确依据是什么；
3. 结果页最建议你接下来做什么？为什么？
4. 你觉得页面是在说“这一轮”，还是在判断你一直以来的能力？
5. 哪一步最让你困惑？
6. 题目有没有明显重复、答案不清或反馈没帮助的情况？

不得通过问题暗示正确答案，例如不得问“你是不是已经掌握了”。

## 九、统一观察记录

每次试用复制以下模板：

```text
批次ID：
Build Identity：
试用编号：T1 / T2 / T3 / T4 / T5 / 扩展
参与者编号：
日期与时区：
设备 / 系统 / 浏览器 / 视口：
是否全新Store：是 / 否
任务类型：专项 / 综合 / 错题重做 / 恢复

独立找到 /learning 入口：是 / 否
独立开始练习：是 / 否
独立完成：是 / 否
提示次数与原话：
是否发生中断恢复：是 / 否
恢复是否成功：是 / 否 / 不适用

基础题数量 / 首次答对数：
巩固题数量 / 答对数：
学生复述的一条反馈：
学生理解的下一步及依据：
是否误解为长期能力结论：是 / 否

重复感受：无 / 可接受 / 主要负面反馈
题目质量问题：
反馈价值问题：
操作困惑：
观察到的缺陷编号：

本次结论：PASS / NEEDS REVISION / INVALID
问题归属：内容 / 交互 / Runtime / 表达 / 验收环境
后续处理：
观察员：
```

## 十、Product Acceptance 判定

### 10.1 硬门禁

必须同时满足：

1. 至少5次有效试用；
2. 5/5不存在阻断完成或数据正确性的P0/P1；
3. 至少4/5能在不超过1次非指向性提示下独立找到入口、开始并完成；
4. 至少3/5能准确复述一条具体反馈的错误原因或正确依据；
5. 至少3/5能说出Result推荐的下一动作及本轮依据；
6. 0/5因产品文案把“本轮表现”误解为长期能力结论；
7. 被安排恢复场景的试用全部成功恢复，且没有重复作答事实；
8. 至少4/5未把短期题目重复列为主要负面反馈；
9. 至少3/5明确认为一条错题反馈“知道下次怎么判断”；
10. 所有发现的答案错误、歧义和解析冲突均关闭；
11. 手机、平板、PC最低设备覆盖完成；
12. Engineering Acceptance仍保持PASS。

### 10.2 判定结果

| 结果 | 条件 |
| --- | --- |
| `PRODUCT ACCEPTANCE PASS` | 所有硬门禁满足，0个开放P0/P1 |
| `CONDITIONAL PASS` | 工程稳定，仅有明确接受的P2/P3或内容扩充项；不得等同正式PASS |
| `NEEDS REVISION` | 任一硬门禁未满足但可通过范围内修复或补验解除 |
| `BLOCKED` | 缺少学生、授权、冻结版本或外部条件，且无法继续有效试用 |

`CONDITIONAL PASS` 在中央控制表中仍记作 `PRODUCT ACCEPTANCE PENDING`，直到条件关闭并复核。

### 10.3 不允许平均抵消

- 一个错误答案不能被其他四次顺利试用抵消；
- 一次数据丢失不能用平均完成率淡化；
- 修复前失败记录不删除；
- 修复后必须补足至少受影响场景的有效试用；
- 无效试用不计入分母，也不能算PASS。

## 十一、缺陷分级与处理

| 等级 | 定义 | 示例 | Product门禁 |
| --- | --- | --- | --- |
| P0 | 数据、事实或边界严重错误 | 判题错误、正式Evidence污染、答案丢失 | 立即停止，必须关闭 |
| P1 | 主链阻断或结果错误 | 无法开始/完成/恢复、推荐死链、统计错误 | 停止受影响场景，必须关闭 |
| P2 | 明显困惑但可完成 | 文案歧义、移动端遮挡、重复感突出 | 可修复后补验；开放时只能Conditional |
| P3 | 轻微体验或视觉问题 | 间距、非关键措辞、低频提示 | 可记录后排期 |

每个缺陷至少记录：ID、版本、场景、复现步骤、预期、实际、截图或日志、归属、严重度、修复提交、回归证据和关闭人。

## 十二、实施工作包

### WP7B-1：冻结基线与预检

交付：

- 可回滚Git检查点；
- build identity；
- 内容库存快照；
- 自动化命令清单；
- 试用授权与参与者编号规则。

完成条件：同一验收版本可在另一环境复核。

### WP7B-2：自动化与正式主线回归

交付：

- WP1—WP6、WP7A全量结果；
- Unified Entry、Day0和当前Runtime可靠性结果；
- Production Build和静态检查；
- Engineering regression log。

完成条件：0失败，或失败已归因并停止升级。

### WP7B-3：浏览器全链矩阵

交付：

- 主链A—C；
- 异常链；
- 390 / 768 / PC；
- 键盘与200%缩放；
- 控制台日志；
- Engineering Acceptance Report。

完成条件：0开放P0/P1，Engineering状态可独立判断。

### WP7B-4：容量与重复率评估

交付：

- 10轮综合、两个5轮专项；
- 理论下限、实际重复、超额重复、fill和exhaustion表；
- 不足3题分类处理建议；
- 内容门禁结论。

完成条件：不以感觉替代库存和序列数据。

### WP7B-5：真实学生受控试用

交付：

- 至少5份完整观察表；
- 问题清单与分级；
- 必要修复和补验；
- Product Acceptance Report。

完成条件：每次试用有效性可核查，最终判定逐条对应硬门禁。

### WP7B-6：中央状态收口

交付：

- 更新执行清单、产品控制表和System Map；
- 记录Engineering、Product、Educational Evidence和Live四层状态；
- 输出后续决策：补题、修复、自然日观察或第一阶段收口。

## 十三、报告结构

### 13.1 Engineering Acceptance Report

必须包含：

- 冻结版本与资源快照；
- 自动化、构建和浏览器结果；
- 容量模拟数据；
- P0—P3缺陷清单；
- 已知限制；
- Engineering PASS / FAIL结论；
- Product仍Pending的准确说明。

### 13.2 Product Acceptance Report

必须包含：

- 有效/无效试用数量；
- 设备与场景覆盖；
- 每个硬门禁的分子、分母和证据；
- 学生原话的短摘要，不记录身份信息；
- 重复、反馈理解、恢复和推荐理解结果；
- 开放缺陷与接受条件；
- PASS / CONDITIONAL / NEEDS REVISION / BLOCKED结论。

## 十四、Live与自然日边界

Product Acceptance PASS后仍不得自动标记Live。

进入Live/Natural-day前至少需要：

- 稳定冻结版本连续5—7个自然日；
- 记录开始率、完成率、恢复成功率、重复率、巩固比例和推荐继续率；
- 0个开放P0/P1；
- 没有新增答案质量问题；
- 本地保存边界持续清晰；
- 产品负责人单独确认Live状态。

自然日观察不是WP7B Product Acceptance PASS的前置条件，但属于后续Live门禁。

## 十五、回滚与恢复

- WP7B发现缺陷时优先回滚到WP6 Engineering PASS基线；
- 不通过清空全部localStorage掩盖迁移或恢复问题；
- 内容回滚使用contentStatus与版本，不删除历史身份；
- Result V2回滚仍需保留completedAttempt和V1兼容；
- 试用数据只保留去身份化观察记录；
- 回滚后重新生成build identity并重跑受影响矩阵。

## 十六、WP7B完成门禁

WP7B完成必须同时有两份独立结论：

### 16.1 Engineering 完成

- D1—D12已确认；
- WP7B-1—WP7B-4完成；
- 自动化、构建、浏览器、异常、容量与响应式门禁通过；
- 输出Engineering Acceptance Report；
- 0个开放P0/P1；
- 状态可升级为 `ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING`。

### 16.2 Product 完成

- WP7B-5完成；
- 至少5次有效受控试用；
- 10.1全部硬门禁逐项通过；
- 输出Product Acceptance Report；
- 产品负责人确认；
- 才可升级为 `PRODUCT ACCEPTANCE PASS`。

若学生、授权或时间尚未准备好，可以先完成Engineering部分，但不得把WP7B整体标记为Product PASS。

## 十七、关键决策确认

| 编号 | 决策 | 建议确认值 | 执行约束 |
| --- | --- | --- | --- |
| D1 | WP7B性质 | 验收收口包，不是新增功能包 | 仅修复验收发现的范围内缺陷 |
| D2 | 状态分层 | Engineering、Product、Live分别判定 | 自动化通过不升级Product |
| D3 | 版本冻结 | 正式试用前建立Git检查点和build identity | 试用中不热修复 |
| D4 | 自动化基线 | WP1—WP6、WP7A及正式主线回归全部通过 | 使用中央文档指定的最新Runtime基线 |
| D5 | 浏览器矩阵 | 主链A—C、异常链、390/768/PC、键盘和200%缩放 | 0开放P0/P1 |
| D6 | 重复率口径 | 使用理论必要重复与超额重复分离 | 不在19题库存下武断要求零相邻重复 |
| D7 | 内容最低可用 | mixed至少10题/3分类；不足3题分类需补题、隐藏或明确准备中 | 不重复凑题，不发布draft |
| D8 | 真实试用数量 | 至少5次有效试用，建议至少3名不同学生 | 老师演示和开发自测不计入 |
| D9 | 设备与场景 | 至少手机、平板、PC各1次，并覆盖专项、综合、巩固、恢复和错题重做 | 缺失场景必须补验 |
| D10 | Product硬门禁 | 采用本文10.1的12项门禁 | 不允许平均抵消P0/P1 |
| D11 | 隐私与记录 | 参与者编号、默认不录音录像、不记录真实姓名 | 产品负责人处理必要授权 |
| D12 | 完成顺序 | 先Engineering报告，再真实学生Product报告，最后另行决定Live | Product PASS前不得宣称第一阶段正式可用验证完成 |

建议确认语句：

> 确认 WP7B 的 D1—D12，授权先执行冻结基线、全量回归、浏览器矩阵和内容容量评估；Engineering Acceptance PASS 后，由产品负责人组织至少5次受控真实学生试用。Product Acceptance与Live必须分别出具证据，不因自动化通过自动升级。

确认记录：2026-08-30，产品负责人确认WP7B D1—D12，并授权进入Engineering Acceptance执行阶段；真实学生Product Acceptance仍须等待工程验收通过并由产品负责人组织，Live继续独立保持PENDING。
