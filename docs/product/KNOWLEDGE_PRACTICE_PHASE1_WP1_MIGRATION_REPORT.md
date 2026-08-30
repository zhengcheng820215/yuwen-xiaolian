# 知识练习第一阶段 WP1 迁移与工程验收报告

状态：`ENGINEERING PASS`

版本：`knowledge_practice_phase1_wp1_migration_report_v1.0`

日期：`2026-08-28`

实施文档：[`KNOWLEDGE_PRACTICE_PHASE1_WP1_DATA_CONTRACT_AND_MIGRATION_PLAN.md`](./KNOWLEDGE_PRACTICE_PHASE1_WP1_DATA_CONTRACT_AND_MIGRATION_PLAN.md)

## 一、验收结论

WP1 已完成数据契约、旧数据迁移、七年级上册候选修订、结构校验、Repository 切换、页面兼容、自动化测试和浏览器主链检查。

结论：`ENGINEERING PASS`。

WP1 PASS 只表示轻量知识题数据基础可用，不表示第一阶段整体完成，也不表示 100 道题内容目标已经完成。WP2—WP7 仍为 `PENDING`。

## 二、迁移结果

| 指标 | 结果 |
| --- | ---: |
| 旧数据源题目 | 27 |
| 成功迁移 | 27 |
| 迁移失败 | 0 |
| 静默丢失 | 0 |
| 七年级上册候选 | 12 |
| 非首批题 | 15 |
| 人工修订并 approved | 12 |
| 保留为 draft | 15 |
| retired | 0 |
| 数据校验 error | 0 |
| 数据校验 warning | 0 |

旧 `src/data/questions.json` 继续作为只读迁移基线保留；学生页面已不再直接消费该文件。

## 三、首批可用题分布

| 分类 | approved | 第一阶段目标 | 剩余缺口 |
| --- | ---: | ---: | ---: |
| 字音字形 | 3 | 16 | 13 |
| 成语运用 | 1 | 14 | 13 |
| 病句辨析与修改 | 0 | 14 | 14 |
| 标点符号 | 1 | 10 | 9 |
| 文学文化常识 | 2 | 10 | 8 |
| 古诗文默写与理解 | 2 | 14 | 12 |
| 文言实词虚词 | 3 | 14 | 11 |
| 作家作品与课文背景 | 0 | 8 | 8 |
| 合计 | 12 | 100 | 88 |

病句辨析与修改、作家作品与课文背景目前没有七年级上册 approved 题，因此学生入口不会展示空分类。

## 四、完成的工程能力

1. 建立 Question v1 类型、分类、状态和答案规范化契约；
2. 建立旧中文题型、难度、分类、选项和答案的确定性迁移；
3. 为选择题建立稳定 optionId，页面不再使用字符串首字符判题；
4. 判断题固定使用 `true / false`；
5. 填空题使用明确 `acceptedAnswers` 和允许的确定性规范化；
6. 建立选项级 `answerAnalysis`、预设错因和解题步骤；
7. 建立 `draft / approved / retired` 状态边界；
8. 建立数据集、题目、选项、填空和变式组校验；
9. 建立学生侧只读 KnowledgeQuestionRepository；
10. Repository 返回防御性副本并隔离非七上、draft 和 retired 题；
11. 切换 KnowledgePractice、Quiz、StudyContext 和 Mistakes；
12. 保留旧题库作为安全回退基线。

## 五、修订的关键内容问题

- 字音题补充规范声调并修正误读呈现；
- 判断题统一稳定身份；
- 成语题拆分为选项级具体解释；
- 文学常识题补充错误文体和作者对应说明；
- 古诗默写明确严格答案及允许的句末标点规范化；
- “学而时习之”中的“而”由过宽的“并列或承接”修订为唯一明确的“表承接”；
- 所有 12 道 approved 题补充 1—3 个可执行解题步骤；
- 当前没有足够真实变式题，因此未为了功能预埋而建立单例 `variantGroupId`。

## 六、自动化验收

执行环境未提供全局 npm，因此使用工作区自带 Node 直接执行与 package script 等价的命令：

```text
node --experimental-strip-types --experimental-specifier-resolution=node
src/ai/tests/runKnowledgePracticeWP1Debug.ts --validate-data
```

结果：

```text
WP1_RESULT 47/47 PASS
DATASET source=27 migrated=27 failed=0 approved=12 draft=15
VALIDATION errors=0 warnings=0
```

覆盖范围：

- 基线数量与范围；
- 题型、难度、选项和答案迁移；
- 数据集与题目结构门禁；
- 选择题和判断题门禁；
- 填空题和答案规范化；
- Repository 学生侧隔离与防御性副本。

## 七、构建验收

使用仓库现有 Vite 依赖离线构建：

```text
node node_modules/vite/bin/vite.js build
```

结果：`PASS`，576 个模块完成转换并生成 `dist`。

构建存在既有提示：主包体积较大，以及一个模块同时被静态和动态导入。本次 WP1 未新增这些架构问题，且提示不阻断构建。

## 八、浏览器人工验收

本地地址：`http://127.0.0.1:5174/`

已通过：

1. `#/practice/knowledge` 只展示七年级上册 approved 题；
2. 分类计数为 3、1、1、2、2、3，总计 12；
3. 非首批七下、八年级和九年级题未展示；
4. 字音题选项没有重复的展示字母前缀；
5. 选择 `opt-b` 后正确判题并显示可读正确答案；
6. 填空输入“江春入旧年。”并带首尾空格时，按已声明规则正确匹配；
7. 错题相关数据结构未造成页面初始化崩溃；
8. 浏览器控制台 error / warning 为 0。

## 九、工程产物

核心文件：

```text
src/domain/knowledge-practice/questions/knowledgeQuestionTypes.ts
src/domain/knowledge-practice/questions/knowledgeQuestionNormalization.ts
src/domain/knowledge-practice/questions/knowledgeQuestionValidator.ts
src/domain/knowledge-practice/questions/legacyKnowledgeQuestionMigration.ts
src/domain/knowledge-practice/questions/knowledgeQuestionRepository.ts
src/data/knowledgeQuestionApprovedOverrides.ts
src/ai/tests/runKnowledgePracticeWP1Debug.ts
```

切换消费方：

```text
src/pages/KnowledgePractice.jsx
src/pages/Quiz.jsx
src/pages/Mistakes.jsx
src/context/StudyContext.jsx
```

命令入口：

```text
debug:knowledge-practice-wp1
validate:knowledge-questions
```

## 十、已知限制与后续交接

1. approved 题只有 12 道，距离 100 道目标还差 88 道；
2. 病句和作家作品分类当前为空；
3. 当前没有已批准的变式组，即时巩固要在 WP5 前补足真实变式题；
4. 旧题库仍作为迁移基线被 Repository 和测试读取，后续可在独立清理任务中冻结为归档数据；
5. Quiz 仍按分类全量顺序作答，专项 5 题、综合 10 题和稳定会话属于 WP2；
6. 逐题页面目前仍展示通用解析，选项级反馈呈现属于 WP3；
7. 本地持久化、恢复、巩固和新结果页尚未实现。

WP2 可以进入 `IN PROGRESS`，但不得绕过 Repository 读取 draft 或重新解释 Question v1 字段。
