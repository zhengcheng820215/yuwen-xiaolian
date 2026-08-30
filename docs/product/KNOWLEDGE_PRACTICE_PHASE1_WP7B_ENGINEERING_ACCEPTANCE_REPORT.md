# 知识练习第一阶段 WP7B 工程验收报告

状态：`ENGINEERING PASS / PRODUCT ACCEPTANCE PENDING (0 / 5) / LIVE PENDING`

版本：`knowledge_practice_phase1_wp7b_engineering_acceptance_v1.0`

日期：`2026-08-30`

工程实施文档：[`KNOWLEDGE_PRACTICE_PHASE1_WP7B_FULL_CHAIN_REGRESSION_AND_PRODUCT_ACCEPTANCE_PLAN.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP7B_FULL_CHAIN_REGRESSION_AND_PRODUCT_ACCEPTANCE_PLAN.md)

产品验收报告：[`KNOWLEDGE_PRACTICE_PHASE1_WP7B_PRODUCT_ACCEPTANCE_REPORT.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP7B_PRODUCT_ACCEPTANCE_REPORT.md)

中央执行清单：[`KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md`](./KNOWLEDGE_PRACTICE_USABLE_PRODUCT_PHASE1_EXECUTION_CHECKLIST.md)

## 一、验收结论

WP7B-1—WP7B-4 已完成，Engineering Acceptance 结论为 `PASS`。

在冻结的第一阶段边界内，系统已证明：

1. `/learning` 仍是唯一学生入口，81道正式发布题与19道已审核轻量题分开表达；
2. 知识练习专项、综合、反馈、即时巩固、结果、推荐和错题重做主链可完成；
3. 未作答、已反馈、已完成结果和双标签冲突均可受控恢复；
4. 19道approved轻量题可稳定创建10题综合练习，Session内不重复；
5. 连续轮换中的库存必要重复、变式约束重复和不可解释超额重复已分账；
6. 少于3道题的分类不再包装为普通专项，统一显示“内容准备中”；
7. 轻量练习仍不写入正式Diagnosis、Evidence、Profile或长期能力结论；
8. 0个开放P0/P1。

该结论不表示 Product Acceptance 已通过。真实目标学生受控试用仍为 `0 / 5`，不得宣称第一阶段已完成真实学生可用性验证或进入Live。

## 二、验收版本与资源快照

| 项目 | 验收事实 |
| --- | --- |
| 回滚基线 | 本地Git提交 `a8467f0` |
| 工程快照 | `a8467f0` + 本报告列出的WP7B验收测试与范围内修复 |
| 时区 | Asia/Shanghai |
| Production Build | Vite 8.1.0，607 modules transformed |
| 正式题库 | 24篇材料、81道Current；63道核心阅读、18道条件微训练 |
| 轻量题库 | 19 approved、15 draft；6个有题分类 |
| 可独立成组分类 | 3个：字音字形6、成语运用3、文言实词虚词5 |
| 内容准备中分类 | 标点符号1、文学文化常识2、古诗文默写与理解2 |
| 即时巩固 | 3个approved变式组、6条有向Link |
| Store / Completion | LocalPracticeStore v1 / Completion Record v2 |
| 保存范围 | 本机、本浏览器 |

正式学生试用前必须把本报告对应工作树形成新的clean Git检查点，并记录该提交为试用Build Identity；在此之前的操作不得计入Product Acceptance。

## 三、范围内缺陷与修复

| 编号 | 等级 | 问题 | 修复 | 状态 |
| --- | --- | --- | --- | --- |
| WP7B-P2-01 | P2 | 只有1—2题的分类仍显示为普通可开始专项 | 少于3题统一标记“内容准备中”、禁用新建；旧直达链接显示受控说明 | CLOSED |
| WP7B-P2-02 | P2 | 选题排序中难度软约束先于近期排重 | 近期排重优先于难度配比；WP2 47/47复测通过 | CLOSED |
| WP7B-P3-01 | P3 | 内置浏览器控制接口不能可靠派发Enter/Space或修改浏览器Zoom | 已验证全部交互使用原生button/input及自然焦点语义；以683×384 CSS视口覆盖1366×768的200%等效布局；真实试用前补一次物理键盘/浏览器缩放人工复核 | OPEN / NON-BLOCKING |

热更新期间曾出现一次Hook依赖数组长度变化提示；使用修复后代码新建冷启动标签页复核为控制台0 error / 0 warning，该热更新记录不计为正式构建缺陷。

## 四、自动化回归

### 4.1 冻结最低门禁

| 测试组 | 结果 |
| --- | ---: |
| WP1 数据与迁移 | 47 / 47 PASS |
| WP2 选题与Session | 47 / 47 PASS |
| WP3 判题与反馈 | 49 / 49 PASS |
| WP4 持久化与恢复 | 33 / 33 PASS |
| WP5 错题即时巩固 | 54 / 54 PASS |
| WP6 结果与推荐 | 56 / 56 PASS |
| WP7A 唯一入口 | 50 / 50 PASS |
| WP7B 容量与内容门禁 | 20 / 20 PASS |
| Unified Learning Entry | 31 / 31 PASS |
| Phase16.3 Day0 | 15 / 15 PASS |
| Product Runtime Reliability WP-R2 | 41 / 41 PASS |
| 合计 | 443 / 443 PASS |

### 4.2 当前Runtime追加回归

| 测试组 | 结果 |
| --- | ---: |
| Product Runtime Reliability WP-R3 | 40 / 40 PASS |
| Product Runtime Reliability WP-R4 | 48 / 48 PASS |
| Product Runtime Trial Control | 8 / 8 PASS |
| 最低门禁加追加回归合计 | 539 / 539 PASS |

## 五、浏览器全链证据

### 5.1 主链A：专项、反馈、巩固、结果、推荐

- 从 `/learning` 进入“基础知识巩固”，正式Runtime未配置时知识练习仍可用；
- 完成5道“字音字形”基础题并触发1道审核巩固题；
- 错误选项反馈包含当前选择、正确答案、关键依据、审核错因和步骤；
- 巩固题按冻结位置出现，不递归调度；
- 结果显示基础首次正确率20%，巩固1/1单独分账；
- 结果刷新前后一致；
- 专项推荐创建新的5题Session，来源Result事实未改写。

### 5.2 主链B：综合、轮换与错题重做

- 显式放弃active专项后创建10题综合Session；
- 实际完成10道基础题和2道巩固题；
- 结果显示基础5/10、首次正确率50%，巩固1/2独立展示；
- 结果按10个本轮知识点展示，不生成长期掌握结论；
- “重做本轮错题”创建新的5题 `mistake_review` Session；
- 第二至第十轮轮换由WP7B确定性容量脚本复核。

### 5.3 主链C：恢复与并发

- 基础题未提交刷新：恢复同题；
- 已提交且反馈展开刷新：反馈和巩固队列保持；
- completed Result刷新：统计、错因和推荐保持；
- 从 `/learning` 显示active知识练习并优先提供继续动作；
- 双标签页revision冲突：旧标签显示准确冲突提示；
- 点击“重新载入最新进度”后恢复权威版本；
- active Session下创建新练习必须经过显式放弃确认。

### 5.4 异常与降级

- 空题库、候选不足、无可靠变式、损坏JSON、future Store、写入失败、题目版本失效和Result隔离由WP1—WP7B自动化覆盖；
- 少于3题的分类在普通入口显示实际库存与“内容准备中”，旧直达链接不创建Session；
- 正式Runtime反馈服务未配置时显示准确故障，不伪装为知识题不足；
- 冷启动浏览器控制台0 error / 0 warning。

## 六、响应式与可访问性

| 矩阵 | 结果 |
| --- | --- |
| 390×844手机 | 入口、答题、反馈、结果、错题页无横向溢出；底部提交不遮挡题目 |
| 768×1024平板 | 无横向溢出，关键动作可见 |
| 1366×768 PC | 无横向溢出，内容宽度受控 |
| 200%等效布局 | 683×384 CSS视口无横向溢出，主要继续动作可见 |
| 非颜色表达 | 正确答案、你的答案、需要核查、正确等均有文本 |
| 语义 | 原生button、input、status、alert、alertdialog可识别 |
| 键盘 | 原生控件和文本输入语义通过；物理Enter/Space与浏览器Zoom补验列为P3 |

## 七、内容容量与重复率

### 7.1 连续序列结果

| 序列 | 库存 / 每轮 | 相邻重复 | 理论或约束解释 | 不可解释超额重复 |
| --- | ---: | ---: | --- | ---: |
| 综合第2轮 | 19 / 10 | 20% | 库存理论下限10% + 同轮变式组排重10% | 0% |
| 综合第3—10轮 | 19 / 10 | 10% | 库存理论下限10% | 0% |
| 字音字形第2—5轮 | 6 / 5 | 80% | 库存理论下限80% | 0% |
| 文言实词虚词第2—5轮 | 5 / 5 | 100% | 库存理论下限100% | 0% |

全部20轮满足：

- Session内重复率0%；
- 有approved候选时exhaustionRate 0%；
- 相同seed和历史可复现；
- 综合每轮10题并覆盖至少3分类；
- 题量不足时使用实际数量，不复制凑题；
- 所有候选均为approved。

### 7.2 产品风险

算法未产生不可解释超额重复，但专项库存仍小：字音专项第二轮起理论重复80%，文言专项为100%。这不是Engineering失败，却可能成为真实学生主要负面反馈。是否补题必须由5次受控试用决定；建议优先准备字音至少2道、文言至少3道新的approved题，以把5题专项相邻重复理论下限降到40%或以下。

## 八、构建与静态检查

- Vite production build：PASS；
- 607 modules transformed；
- `git diff --check`：PASS（仅Windows行尾提示）；
- 354个Markdown文件、908个本地链接、0损坏；
- 正式边界回归：WP5-C54与WP6-C56 PASS；
- 未发现知识练习对正式Evidence/Profile的写入。

既存非阻断构建警告：

1. 主JavaScript chunk大于500kB；
2. `phase163RealLearningChainDemo.ts` 同时静态和动态导入，动态拆包未生效。

## 九、已知限制与下一步

1. Product Acceptance为0/5，必须由真实目标学生完成；
2. 正式试用前需建立本报告对应的clean Git检查点；
3. 只支持本机、本浏览器保存，不支持账户、云同步或跨设备恢复；
4. 三个分类仍为“内容准备中”；
5. 专项连续使用存在高库存必要重复；
6. 物理键盘Enter/Space与真实浏览器200% Zoom保留一次人工补验；
7. Educational Evidence与Live继续PENDING。

下一步只进入WP7B-5：由产品负责人组织至少5次受控真实学生试用，并使用独立Product Acceptance Report逐项核对12项硬门禁。
