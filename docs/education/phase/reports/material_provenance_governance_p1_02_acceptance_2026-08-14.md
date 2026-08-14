# P1-02 材料来源治理工程验收记录

日期：2026-08-14
结论：通过

## 一、任务目标

为当前 12 篇正式材料补齐可追溯的课程目录来源和所在单元，同时严格区分以下三类事实：

1. 篇目是否出现在权威课程目录中；
2. 本地正文是否已经与权威文本逐字核对；
3. 当前系统是否已经取得相应的使用授权。

本任务只完成第一项，不以课程目录记录替代正文核验或权利授权。

## 二、采用的来源证据

- 人民教育出版社七年级上册课程目录：<https://bp.pep.com.cn/2018spring/gzhtbjc/sfkl/czywk/zyqs/index.html>
- 《中华人民共和国著作权法》：<https://www.npc.gov.cn/c2/c30834/202011/t20201119_308796.html>

出版社课程目录用于确认篇目和所在单元。著作权状态需要基于作者、作品、版本、使用场景和授权证据单独判断，因此系统没有把“目录可查”推导为“正文已核验”或“权利已清理”。

## 三、落盘规则

12 篇现行材料均新增或补齐：

- `curriculumUnit`：人民教育出版社七年级上册对应单元；
- `provenanceReview.sourceLocator`：上述出版社课程目录；
- `provenanceReview.note`：明确记录已完成篇目目录核对、尚未完成逐字正文比对与版权授权确认。

状态保持为：

- `provenanceStatus = needs_verification`
- `textVerificationStatus = pending`
- `rightsStatus = unknown`

禁止将本次治理结果自动升级为 `verified` 或 `cleared`。

## 四、版本与语义保护

- 共享正式资源库：revision `1045 -> 1046`
- 现行材料：12 篇
- 现行题目：42 道
- 来源治理写入采用追加版本，不覆盖历史版本；
- 材料正文与父版本逐字保持一致；
- 题干、作答方式、答案接受规则、Rubric、能力与难度元数据均与父版本保持一致；
- 第二次执行结果为 `apply-noop`，验证治理操作具有幂等性。

## 五、自动化验收

以下检查全部通过：

1. `runMaterialProvenanceGovernance.ts --apply`
   - 12 篇材料均有课程单元和来源定位；
   - 42 道现行题语义不变；
   - 重复执行不产生新版本。
2. `runMaterialCorpusMaintenance.ts`
   - 可执行语料问题：0；
   - 12 条 `provenance_unverified` 均为预期的治理信息，不阻断生产和学习。
3. `runQuestionOptimizationBaselineAudit.ts`
   - 42/42 任务、链接、Registry、冻结资源、质量轨迹和学习消费链完整；
   - issues：0。
4. `runCurrentQuestionGenerationQualityAudit.ts`
   - 审计通过；
   - 仅存在题组能力/难度分布建议，不属于数据链故障。
5. `vite build`
   - 构建通过；
   - 既有动态导入与包体积警告不阻断本任务。

## 六、后续边界

P1-02 完成的是“来源线索可追溯”，不是“全部材料已完成权威文本和版权核验”。后续若执行更高等级的来源治理，需要逐篇补充：

1. 可逐字核验的权威正文或版本信息；
2. 核验人员、核验时间和差异记录；
3. 公版判断、授权文件或适用使用依据；
4. 通过复核后再分别更新 `textVerificationStatus` 与 `rightsStatus`。
