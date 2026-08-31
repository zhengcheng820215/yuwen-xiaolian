# 知识练习第一阶段 WP7B 产品验收报告

状态：`PRODUCT ACCEPTANCE PENDING / VALID TRIALS 0 / 5 / LIVE PENDING`

版本：`knowledge_practice_phase1_wp7b_product_acceptance_v1.0`

日期：`2026-08-30`

工程验收：[`KNOWLEDGE_PRACTICE_PHASE1_WP7B_ENGINEERING_ACCEPTANCE_REPORT.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP7B_ENGINEERING_ACCEPTANCE_REPORT.md)

工程实施文档：[`KNOWLEDGE_PRACTICE_PHASE1_WP7B_FULL_CHAIN_REGRESSION_AND_PRODUCT_ACCEPTANCE_PLAN.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP7B_FULL_CHAIN_REGRESSION_AND_PRODUCT_ACCEPTANCE_PLAN.md)

试用准备与执行包：[`KNOWLEDGE_PRACTICE_PHASE1_WP7B5_CONTROLLED_STUDENT_TRIAL_PREPARATION.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP7B5_CONTROLLED_STUDENT_TRIAL_PREPARATION.md)

## 一、当前结论

WP7B Engineering Acceptance 已PASS，但真实学生Product Acceptance尚未开始，当前有效试用为 `0 / 5`。

2026-08-31更新：WP7B-5试用材料、T1—T5场景、候选Build Identity、隐私规则、停止规则和汇总门禁已经准备完成；现场物理键盘/真实200% Zoom、干净试用工作区、参与者与时间安排仍待完成，因此有效试用计数保持0/5。

开发者自测、自动化脚本和浏览器控制验收均不计入真实学生试用。因此本报告当前只作为统一试用包和证据容器，不输出PASS、CONDITIONAL PASS或NEEDS REVISION结论。

开始计数前必须满足：

1. 使用工程基线 `5a6892e30d29634d007f2102aef481d6cd61f156` 的clean checkout；
2. 记录Build Identity、设备、浏览器与视口；
3. 产品负责人完成必要的未成年人参与授权与现场安排；
4. 使用参与者编号，不记录真实姓名；
5. 默认不录音、不录像、不采集联系方式；
6. 同一批次不修改代码或approved内容。

## 二、试用计划与完成状态

| 试用 | 必含场景 | 设备要求 | 状态 |
| --- | --- | --- | --- |
| T1 | 首次从 `/learning` 找到专项；至少一次答错反馈 | 手机 | PENDING |
| T2 | 综合10题、分类覆盖、结果与新综合推荐 | PC | PENDING |
| T3 | 错题巩固、基础/巩固分账和专项推荐 | 任一 | PENDING |
| T4 | 中途刷新或关闭后恢复并完成 | 平板 | PENDING |
| T5 | 错题重做或内容准备中分类理解 | 手机或平板 | PENDING |

最低设备覆盖：手机1次、平板1次、PC1次。建议至少3名不同目标学生。

## 三、Product硬门禁计数

| 门禁 | 当前证据 | 状态 |
| --- | --- | --- |
| 至少5次有效试用 | 0 / 5 | PENDING |
| 5/5无P0/P1 | 0 / 5 | PENDING |
| 至少4/5在不超过1次非指向提示下独立完成 | 0 / 5 | PENDING |
| 至少3/5准确复述一条反馈 | 0 / 5 | PENDING |
| 至少3/5理解Result推荐及本轮依据 | 0 / 5 | PENDING |
| 0/5误解为长期能力结论 | 0 / 5 | PENDING |
| 安排恢复场景的试用全部恢复成功 | 0 / 0 | PENDING |
| 至少4/5未把重复列为主要负面反馈 | 0 / 5 | PENDING |
| 至少3/5认为反馈能帮助下次判断 | 0 / 5 | PENDING |
| 答案错误、歧义和解析冲突全部关闭 | 尚无学生样本 | PENDING |
| 手机、平板、PC覆盖完成 | 0 / 3类 | PENDING |
| Engineering Acceptance保持PASS | 当前PASS | PASS |

## 四、统一任务指令

> 请从学习入口开始一组基础知识练习。按你自己的判断完成，看到反馈后继续，最后告诉我这轮哪里做得比较稳、哪里还建议练，以及你准备点哪个下一步。

恢复场景额外说：

> 现在请刷新或关闭后重新进入，看看能否继续刚才的练习。

观察员不得提示具体按钮；发生提示时记录原话和步骤。

## 五、单次观察记录

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

## 六、当前风险假设

工程容量模拟显示：

- 综合第3轮起相邻必要重复为10%，不可解释超额重复为0%；
- 字音5题专项第二轮起理论必要重复为80%；
- 文言5题专项第二轮起理论必要重复为100%。

因此真实试用必须重点记录“题目重复”是否成为主要负面反馈。若集中出现，Product Acceptance继续PENDING，并按学生数据决定优先补题范围，不通过放宽门禁或发布draft掩盖。

## 七、下一动作

产品负责人需要：

1. 从冻结提交建立clean checkout并核对Build Identity；
2. 安排T1—T5参与者、设备和时间；
3. 每次试用复制一份观察表；
4. 发现P0/P1立即停止该批次；
5. 完成5次后逐项填写第三节分子、分母和证据；
6. 最终单独确认Product状态；
7. Product PASS后再另行决定是否进入5—7个自然日Live观察。
