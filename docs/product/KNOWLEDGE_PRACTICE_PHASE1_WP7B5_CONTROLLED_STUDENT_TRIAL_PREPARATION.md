# 知识练习第一阶段 WP7B-5 真实学生受控产品验收准备与执行包

状态：`PREPARATION COMPLETE / FIELD PREFLIGHT PENDING / VALID TRIALS 0 / 5`

版本：`knowledge_practice_phase1_wp7b5_trial_package_v1.0`

日期：2026-08-31

上位文档：

- [`KNOWLEDGE_PRACTICE_PHASE1_WP7B_FULL_CHAIN_REGRESSION_AND_PRODUCT_ACCEPTANCE_PLAN.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP7B_FULL_CHAIN_REGRESSION_AND_PRODUCT_ACCEPTANCE_PLAN.md)
- [`KNOWLEDGE_PRACTICE_PHASE1_WP7B_ENGINEERING_ACCEPTANCE_REPORT.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP7B_ENGINEERING_ACCEPTANCE_REPORT.md)
- [`KNOWLEDGE_PRACTICE_PHASE1_WP7B_PRODUCT_ACCEPTANCE_REPORT.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP7B_PRODUCT_ACCEPTANCE_REPORT.md)
- [`CURRENT_PRODUCT_STATE.md`](./CURRENT_PRODUCT_STATE.md)

## 一、准备结论

WP7B-5的文档、任务、样本、设备、隐私、停止规则和汇总口径已经冻结，可进入现场前置检查。真实学生试用尚未开始，当前有效计数保持 `0 / 5`。

本次准备已完成：

1. 统一当前状态为 `Engineering PASS / Product Acceptance Pending 0/5 / Live Pending`；
2. 冻结工程基线提交和候选试用Build Identity；
3. 固化T1—T5场景、设备矩阵、统一任务指令和观察表；
4. 固化隐私、有效样本、停止、变更与作废规则；
5. 复核自动化539/539与Production Build；
6. 复核 `/learning` 入口文案、主要动作和控制台状态；
7. 明确现场仍需完成的物理键盘、真实200%缩放、参与者与全新Store准备。

## 二、试用批次与Build Identity

| 字段 | 冻结值 |
| --- | --- |
| 批次ID | `kp-wp7b5-20260831-b01` |
| 工程基线提交 | `5a6892e30d29634d007f2102aef481d6cd61f156` |
| 候选Build Identity | `kp-wp7b5-5a6892e30d29634d007f2102aef481d6cd61f156` |
| 分支 | `main` |
| 时区 | `Asia/Shanghai` |
| 正式库存快照 | 24篇材料 / 81道Current / 63核心阅读 / 18条件微训练 |
| 轻量库存快照 | 19 approved / 15 draft / 6有题分类 / 3可独立成组分类 |
| 保存边界 | 本机、本浏览器 |

该Build Identity只允许从上述提交的干净checkout生成。当前开发目录存在与项目无关的未跟踪文件，因此不得直接把当前目录当作正式试用工作区；应使用干净clone、干净worktree或经人工确认的隔离试用目录。

若试用前代码、锁文件、运行配置或approved内容发生变化，必须：

1. 停止当前批次；
2. 重新执行Engineering门禁；
3. 生成新的Build Identity与批次ID；
4. 将旧批次未完成试用标记为INVALID；
5. 不把两个Build Identity的数据混为同一批次。

## 三、现场开始门禁

以下项目全部勾选后，第一条试用才可计入分母：

- [ ] 从冻结提交建立干净试用工作区；
- [ ] 记录实际Build Identity并确认与本文一致；
- [ ] 启动正式试用构建并确认 `/learning` 可访问；
- [ ] 使用物理键盘验证Tab聚焦、Enter与Space可触发主要按钮；
- [ ] 使用浏览器真实200% Zoom验证无横向溢出、主要动作可见；
- [ ] 准备至少一台手机、一台平板和一台PC；
- [ ] 确认至少3名不同目标学生并分配参与者编号；
- [ ] 完成必要的未成年人参与授权和现场安排；
- [ ] 默认不录音、不录像、不记录真实姓名、联系方式或学校班级；
- [ ] 为要求全新Store的场景准备新的浏览器配置或隔离试用配置；
- [ ] 观察员已阅读统一指令、提示边界和停止规则；
- [ ] 试用期间冻结代码和approved内容。

不允许通过擅自清除使用者现有浏览器数据来制造“全新Store”。优先使用专门的试用浏览器配置、独立设备或明确隔离的试用环境。

## 四、T1—T5冻结分配

| 试用 | 必含场景 | 指定设备 | Store要求 | 参与者编号 | 时间 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | 首次从 `/learning` 找到专项；至少一次答错反馈 | 手机 | 全新 | 待安排 | 待安排 | PENDING |
| T2 | 综合10题、至少3分类、结果与新综合推荐 | PC | 全新 | 待安排 | 待安排 | PENDING |
| T3 | 错题即时巩固、基础/巩固分账和专项推荐 | 任一 | 全新或已记录基线 | 待安排 | 待安排 | PENDING |
| T4 | 中途刷新或关闭后恢复并完成 | 平板 | 全新开始，同一Store恢复 | 待安排 | 待安排 | PENDING |
| T5 | 错题重做或“内容准备中”分类理解 | 手机或平板 | 全新或已记录基线 | 待安排 | 待安排 | PENDING |

设备矩阵按上述分配已覆盖手机、平板和PC。建议同一参与者最多承担两次试用，至少3名不同学生。

## 五、统一任务指令

观察员只读以下内容，不增加按钮方向提示：

> 请从学习入口开始一组基础知识练习。按你自己的判断完成，看到反馈后继续，最后告诉我这轮哪里做得比较稳、哪里还建议练，以及你准备点哪个下一步。

T4在完成至少一道题后增加：

> 现在请刷新或关闭后重新进入，看看能否继续刚才的练习。

若学生询问“点哪里”，观察员最多使用一次非指向提示：

> 请根据页面上你理解的主要动作继续。

不得指出具体按钮，不得解释正确答案，不得提前解释结果推荐。

## 六、单次记录卡

每次试用复制以下记录，并同步回写产品验收报告：

```text
批次ID：kp-wp7b5-20260831-b01
Build Identity：
试用编号：T1 / T2 / T3 / T4 / T5
参与者编号：
日期与时区：Asia/Shanghai
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

## 七、有效样本与停止规则

有效试用必须同时满足：

1. 使用冻结Build Identity；
2. 参与者属于目标学生；
3. 从 `/learning` 开始；
4. 没有观察员指向具体按钮或答案；
5. 完整记录设备、Store、提示、反馈复述、下一步理解和重复感受；
6. 给出PASS、NEEDS REVISION或INVALID结论。

出现以下任一情况立即停止该批次，不继续凑满5次：

- 数据丢失、错题串人或恢复到他人记录；
- 正确答案、解析或题目存在明确冲突；
- 学生无法离开死循环或无法完成主要动作；
- 页面将本轮结果表达为长期能力结论；
- Build Identity不一致或试用中发生代码/approved内容变更；
- 出现开放P0/P1。

## 八、Product Acceptance汇总门禁

完成5次后逐项填写：

| 门禁 | 目标 | 当前 |
| --- | ---: | ---: |
| 有效试用 | 5 | 0/5 |
| 无P0/P1 | 5 | 0/5 |
| 不超过1次非指向提示独立完成 | 至少4 | 0/5 |
| 准确复述一条反馈 | 至少3 | 0/5 |
| 理解推荐及本轮依据 | 至少3 | 0/5 |
| 误解为长期能力结论 | 0 | 0/5 |
| 安排的恢复场景恢复成功 | 全部 | 0/0 |
| 未把重复列为主要负面反馈 | 至少4 | 0/5 |
| 认为反馈能帮助下次判断 | 至少3 | 0/5 |
| 答案、歧义和解析冲突 | 全部关闭 | 无样本 |
| 手机、平板、PC | 全覆盖 | 0/3类 |
| Engineering Acceptance | 保持PASS | PASS |

不允许平均抵消P0/P1，无效试用不计入分母。`CONDITIONAL PASS`在中央控制表中仍记作Product Acceptance Pending。

## 九、准备阶段实测证据

2026-08-31复核结果：

- 自动化：539/539 PASS；
- Production Build：Vite 8.1.0，607 modules transformed，PASS；
- `/learning`：正式阅读与19道轻量题分开表达；
- 当前浏览器存在active知识练习时，显示“继续基础知识巩固”；
- 主要按钮：可见、启用、原生button语义；
- 控制台：0 error / 0 warning；
- 当前浏览器已有练习进度，因此不作为T1全新Store环境；
- 物理键盘与真实200% Zoom：FIELD PREFLIGHT PENDING。

## 十、准备完成边界

本文完成表示“试用执行条件、材料和口径已经准备好”，不表示：

- 已产生真实学生样本；
- Product Acceptance已经PASS；
- Live已经开始；
- Educational Evidence已经成立。

下一动作由产品负责人完成现场门禁勾选、参与者和时间安排；第一条有效记录形成后，将产品验收报告从0/5更新为1/5。
