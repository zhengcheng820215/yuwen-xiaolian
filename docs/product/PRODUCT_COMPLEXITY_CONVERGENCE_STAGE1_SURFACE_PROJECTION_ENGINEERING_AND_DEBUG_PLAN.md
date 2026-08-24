# 产品复杂度收口阶段 1：页面投射与默认展示收口工程实施与 Debug 验收文档

英文名称：Product Complexity Convergence Stage 1 Surface Projection Engineering and Debug Plan
阶段契约版本：`product_complexity_convergence_stage1_surface_projection_v1`
对应总契约：`product_complexity_convergence_v1`
状态：`ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED`
日期：2026-08-24

关联文档：

- [产品复杂度收口总契约](./PRODUCT_COMPLEXITY_CONVERGENCE_CONTRACT.md)
- [阶段 0 只读复杂度审计工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_READ_ONLY_AUDIT_ENGINEERING_AND_DEBUG_PLAN.md)
- [阶段 0 工程与 Debug 验收报告](../education/phase/reports/product_complexity_convergence_stage0_engineering_debug_acceptance_2026-08-24.md)
- [阶段 1 工程、Debug 与浏览器验收报告](../education/phase/reports/product_complexity_convergence_stage1_engineering_debug_browser_acceptance_2026-08-24.md)

## 一、阶段定位

阶段 1 只收敛普通用户能够看见和操作的页面投射，不改变底层能力、领域事实或运行决策。

本阶段把以下原则落实为工程边界：

> 页面只展示影响当前判断与下一步操作的信息；后台能力继续完整运行，但不得要求普通用户理解其工程身份。

阶段 1 重点处理：

1. 普通页面内部术语与工程状态泄露；
2. 同一用户意图对应多个主操作；
3. 标签、正文和提示重复表达同一事实；
4. 未触发条件能力仍占据页面；
5. Learning 暴露 Scheduler、Evidence、Profile 或 Load Pipeline 说明；
6. 错误远离当前操作、无法发现或没有本地恢复出口；
7. 不改变业务事实即可完成的说明减负。

阶段 1 不是条件能力策略、反馈生成策略或 Training Model 的升级，也不负责证明教育效果改善。

## 二、贯穿性验收原则

阶段 1 必须同时证明：

> 旧主链零回归，并且新投射语义只在普通页面展示层生效。

具体要求：

- `Material → Plan → Task → Candidate → Adopt → Revision → Publish → Learning` 不变；
- 页面不得通过隐藏按钮改变命令可用条件；
- 页面不得通过改写状态改变真实状态机；
- Revision、Targeted、Retest、Transfer 的触发与退出结果保持不变；
- Task Group 顺序、Scheduler 决策与题号保持不变；
- Attempt、Diagnosis、Evidence、Profile、Calibration 和 Registry 写入保持不变；
- Internal / Debug / Acceptance 页面继续承载完整工程事实；
- 新语义不得提前进入阶段 2 条件策略或阶段 3 反馈生成与 Profile 投射范围。

## 三、绝对禁止的修改

阶段 1 不得修改：

- Material、Material Version、正文和段落身份；
- Observation Plan、TrainingTask、TaskGroupProgressionPlan 与 Load Semantics；
- QuestionCandidate 内容、质量评估、Admission、Adoption 与 Publication 规则；
- Frozen Resource、Registry Head 与 Version Chain；
- Learning Queue、Session、Round、Attempt 与 Snapshot；
- Diagnosis、Feedback 生成、Hint 生成与缺口判定；
- Revision、Targeted、Retest、Transfer 的资格、触发、退出和防循环策略；
- Evidence Admission、Progression Assessment、Student Profile 与 Calibration；
- 幂等键、Outbox、恢复身份与错误码本体；
- 历史正式资源和历史 Learning 记录。

禁止以“简化页面”为理由：

- 删除底层能力；
- 建立第二套页面状态机；
- 在组件本地重新推断发布、学习或条件能力事实；
- 把失败降级为成功；
- 隐藏会造成数据丢失或流程阻断的真实错误；
- 将未触发能力伪装为已完成；
- 通过固定文案覆盖真实状态差异。

## 四、工程架构边界

### 4.1 单一事实来源

阶段 1 必须继续消费既有 View Model、Command State 和 Runtime Result。页面投射只允许形成纯函数派生对象：

```ts
type ProductSurfaceProjection = {
  projectionVersion: 'product_complexity_convergence_stage1_surface_projection_v1';
  surfaceId: string;
  audience: 'authoring_user' | 'learning_student';
  stateId: string;
  title?: string;
  status?: {
    tone: 'neutral' | 'progress' | 'success' | 'warning' | 'error';
    label: string;
    detail?: string;
  };
  primaryAction?: ProductSurfaceAction;
  secondaryActions: ProductSurfaceAction[];
  disclosureSections: ProductSurfaceDisclosure[];
  localRecovery?: ProductSurfaceRecovery;
};
```

投射对象：

- 不持久化；
- 不进入领域 Repository；
- 不参与 Gate、Scheduler、Diagnosis、Evidence 或 Profile 判断；
- 刷新后由既有事实重新计算；
- 不能成为第二套正式状态来源。

### 4.2 操作适配

`ProductSurfaceAction` 只能引用现有命令，不得创建语义重复的新命令：

```ts
type ProductSurfaceAction = {
  actionId: string;
  commandId: string;
  label: string;
  emphasis: 'primary' | 'secondary' | 'text';
  disabled: boolean;
  busy: boolean;
};
```

同一时刻一个操作区域最多存在一个主操作。若两个按钮最终调用同一用户意图，必须在投射层合并；若底层命令不同且都不可缺少，应明确一个主操作、一个次操作，不得制造两个同权主按钮。

### 4.3 错误投射

错误事实继续来自现有命令和 Runtime。页面只把内部错误映射为用户可操作的局部投射：

```ts
type ProductSurfaceRecovery = {
  errorCategory: 'temporary' | 'conflict' | 'validation' | 'unavailable' | 'unknown';
  userMessage: string;
  preservationMessage: string;
  action: ProductSurfaceAction;
  internalErrorRef?: string;
};
```

`internalErrorRef` 只允许进入 Internal 详情或受控复制入口，不得作为普通页面主文案。

### 4.4 兼容策略

未知或历史状态必须采用保守投射：

- 保留原有可执行动作；
- 不自行推断成功；
- 不暴露原始对象内容；
- 必要时显示“当前状态暂时无法确认，请重试”；
- Internal 侧保留原始状态与错误引用；
- 不因投射失败阻断底层恢复。

## 五、录入端页面白名单

普通录入端只长期显示：

- 生成训练任务；
- 重新优化；
- 采用并发布；
- 正在生成或正在发布；
- 已发布；
- 当前必须处理且有明确出口的错误；
- 当前材料、题目和必要的题目详情。

### 5.1 状态与主操作矩阵

| 底层事实 | 普通页面状态 | 主操作 | 次操作 | 禁止展示 |
| --- | --- | --- | --- | --- |
| 尚无候选 | 尚未生成 | 生成训练任务 | 无 | Candidate 缺失、Plan 状态 |
| 正在生成 | 正在生成 | 无，原按钮进入 busy | 取消仅在已有真实命令时显示 | Generator 阶段码、Prompt 状态 |
| 候选可用 | 可以采用 | 采用当前方案或采用并发布 | 重新优化 | Candidate / Gate / Admission |
| 正在采用或发布 | 正在发布 | 原主按钮 disabled + busy | 无 | 并列的“采用并发布”可点击按钮 |
| 已发布 | 已发布 | 无 | 展开详情、生成新版方案 | Registry、Frozen、Revision Identity |
| 可恢复失败 | 操作未完成 | 重试或继续发布 | 查看内部引用仅限 Internal | Runtime Code 作为主文案 |
| 当前版本冲突 | 内容已更新 | 刷新当前状态 | 返回 | Expected Revision、Hash |

### 5.2 候选与正式任务投射

- “Candidate”统一面向用户表达为“待采用方案”或“候选题目”，不得暴露对象身份；
- “Adopt + Revision + Publish”在正常链路中投射为一次“采用并发布”；
- 已发布任务只显示“已发布”，不得同时显示“可以发布”“待处理”或历史失败正文；
- 单题发布只更新该题的页面状态，不得把同组其他题投射为同一结果；
- 整组生成、补充生成和新版方案必须说明影响范围，但不展开内部版本链；
- 未采用候选可放弃或重新优化，但不得以删除正式资源的方式实现。

### 5.3 错误与恢复

录入端错误必须出现在触发操作附近，并至少说明：

1. 当前操作没有完成；
2. 已有候选、草稿或已发布内容是否保留；
3. 用户现在可以重试、刷新还是返回。

页面底部操作产生的错误不得只出现在页面顶部。允许使用：

- 卡片内错误区；
- 当前按钮附近的持久提示；
- 可被屏幕阅读器立即宣布的 Toast；
- 自动聚焦或滚动到错误位置。

## 六、Learning 页面白名单

Learning 普通页面只长期显示：

- 文章标题、作者与正文；
- 当前题和必要作答组件；
- 按需展开的提示；
- 提交、保存草稿和当前必要操作；
- 当前反馈；
- 已触发且确有价值的一次修订；
- 已触发且确有价值的一次针对练习；
- 下一题与题组完成；
- 服务异常时的恢复入口。

### 6.1 默认隐藏内容

以下内容不得投射到学生页面：

- Load Level、Sequence Role、Observation Thread 与 Breakpoint；
- Scheduler 为什么选择下一题；
- Evidence Admission、Profile 更新和 Calibration 状态；
- Revision / Targeted / Retest / Transfer 的工程名称和内部身份；
- Plan Hash、Semantics Hash、Gate Code、Reason Code 与 Policy Version；
- “系统将把本次表现作为某类证据”一类管线说明；
- 不能改变学生当前动作的工程状态。

### 6.2 当前题与下一步

- 题目页面只解释当前要完成什么，不解释系统内部为什么安排此题；
- 未打开提示时，提示正文不得预先占据页面；
- 未触发 Revision 时，不显示修订入口、修订占位或“无需修订”；
- 未触发 Targeted 时，不显示针对训练占位或跳过说明；
- Retest / Transfer 若作为正式当前任务出现，只使用学生可理解的题目文案，不显示工程角色；
- “下一题”按钮必须表达将进入的实际题号，例如“进入第 2 题（共 6 题）”；
- 尚有正式任务时不得投射“返回学习入口”为唯一出口；
- 题组结束时才显示完成结论和返回入口。

### 6.3 条件能力可见性

阶段 1 只消费既有“已触发 / 未触发”事实：

```text
未触发 → 完全不展示
已触发 → 以学生动作表达，不展示工程身份
执行中 → 展示当前动作与保存状态
完成 → 返回正式序列或题组完成
失败 → 说明保留情况并提供恢复
```

阶段 1 不判断某项能力是否应该触发，也不改变其次数、退出条件或后续调度。

### 6.4 反馈展示边界

阶段 1 允许：

- 移除重复标题、重复目标和 Scheduler 说明；
- 隐藏内部术语；
- 对已有反馈字段做条件展示；
- 没有缺口时不渲染空的“继续关注”区；
- 没有下一步动作时不渲染空的“下一步”区。

阶段 1 不允许：

- 改写 Diagnosis 结论；
- 从多个缺口中重新选择主要缺口；
- 生成新的提示或训练动作；
- 修改反馈结构、生成 Prompt 或 Profile 投影规则。

上述策略属于阶段 3。本阶段只能减轻重复展示，不能改变反馈含义。

## 七、内部术语与用户文案映射

| 内部术语 | 录入端投射 | Learning 投射 |
| --- | --- | --- |
| Candidate | 待采用方案 / 候选题目 | 不展示 |
| Adoption | 采用 | 不展示 |
| Publication / Frozen | 发布 / 已发布 | 正式题目，不展示状态 |
| Revision Identity | 新版方案或内容已更新 | 根据反馈完善回答 |
| Admission / Gate | 检查未通过或暂时不能发布 | 不展示 |
| Registry | 已发布资源 | 不展示 |
| Scheduler | 不展示 | 下一题 |
| Targeted Micro-training | 不展示工程名 | 针对练习 |
| Retest / Transfer | 不展示工程名 | 当前题 / 后续练习 |
| Evidence / Profile | Internal 展示 | 不展示 |
| Hash / Policy / Code | Internal 展示 | 不展示 |

映射不改变内部字段名称，也不要求迁移历史数据。

## 八、页面投射规则

### 8.1 必要性规则

一个信息只有满足至少一项时才允许默认展示：

- 改变当前选择；
- 解释当前状态；
- 告知数据是否保留；
- 提供当前可执行操作；
- 是完成当前学习任务所必需的内容。

仅用于审计、追踪、统计或未来决策的信息必须移入 Internal。

### 8.2 唯一主操作规则

- 同一操作区最多一个主按钮；
- busy 期间原主按钮保留位置并进入 disabled / loading，不得同时出现第二个可点击主按钮；
- 成功后主按钮必须退出，不能与“已发布”“已提交”并存；
- 次操作不能与主操作产生相同结果；
- 重试必须复用既有幂等命令。

### 8.3 状态一致性规则

标签、正文、按钮和 Toast 必须来自同一底层事实快照。优先级为：

```text
最新已确认正式事实
→ 当前进行中的幂等命令
→ 可恢复失败
→ 历史只读信息
```

历史失败不得覆盖已确认成功；局部成功不得投射为整组成功。

### 8.4 默认披露规则

- 必需信息默认展开；
- 解释性详情按需展开；
- 内部追踪永不进入普通页面 Disclosure；
- 折叠不得移除主操作、错误出口或当前题；
- 折叠状态只属于页面偏好，不得成为领域事实。

### 8.5 可访问性规则

- 错误使用 `role="alert"`，进行中与成功使用适当 `status`；
- busy 状态具有可读名称并禁止重复提交；
- 自动定位错误后焦点不能丢失；
- 隐藏内容不得继续被键盘聚焦或被屏幕阅读器读取；
- 颜色不是状态的唯一表达；
- 下一步按钮必须具有准确、完整的可访问名称。

## 九、工程工作包

### WP1-A：投射契约与纯函数适配器

- 建立版本化 Surface Projection Schema 与 Guard；
- 建立录入端、Learning 两套白名单；
- 建立内部术语与状态映射；
- 适配器只读取既有状态，不依赖写接口；
- 未知状态提供保守降级。

### WP1-B：录入端默认展示收口

重点审查并调整：

- `MaterialResourceProductionWorkbench.jsx`；
- `materialResourceWorkbenchState.ts`；
- `materialResourceProductionCommandState.ts`；
- 候选题、正式题、发布中、发布失败和恢复的卡片投射；
- 页面级 Toast 与卡片内错误的定位关系。

不修改 Candidate、Adoption 或 Publication 服务。

### WP1-C：Learning 默认展示收口

重点审查并调整：

- `UnifiedLearningEntry.jsx`；
- `ContinuousLearningDemo.jsx`；
- `LearningTaskWorkspace.jsx`；
- `LearningWorkspaceHeader.jsx`；
- `StudentFeedbackPanel.jsx`；
- `FeedbackGuidedRevision.jsx`；
- `SingleChoiceResponseInput.jsx`；
- `WorkspaceToast.jsx`。

不修改 Learning Queue、Diagnosis、Revision、Targeted 或 Evidence 服务。

### WP1-D：错误原位投射与恢复入口

- 统一错误分类到用户文案；
- 保留内部错误引用供 Internal 使用；
- 底部操作错误在本地可发现；
- 重试复用原命令和幂等身份；
- 服务不可用时明确已保存内容和恢复操作。

### WP1-E：Internal 边界

- Internal 页面继续展示完整 Finding、Code 和 Trace；
- 普通页面不得通过调试 Query、Fixture 或 Acceptance 状态泄露内部信息；
- 开发验证开关只能在 Internal Route 生效；
- Acceptance 数据保持隔离。

### WP1-F：自动化 Debug 与快照验收

- 建立纯函数投射 Debug；
- 对关键状态生成稳定快照；
- 比较投射前后领域 Digest；
- 验证命令调用、触发结果和写入数量不变。

### WP1-G：真实浏览器联调与报告

- 走查录入端和 Learning 关键状态；
- 验证键盘、焦点、Toast、错误原位和刷新恢复；
- 验证普通页面无内部术语；
- 输出旧主链零回归与阶段边界报告。

## 十、自动化 Debug 验收矩阵

冻结 `C1-01—C1-28`：

| 编号 | 验收项 |
| --- | --- |
| C1-01 | 合法 Surface Projection 通过 Guard |
| C1-02 | 未知版本、受众、状态和操作引用被拒绝或保守降级 |
| C1-03 | 相同事实重复投射结果稳定 |
| C1-04 | 投射器不依赖保存、发布、作答或 Profile 写接口 |
| C1-05 | Internal 页面保留完整术语，普通页面隐藏内部术语 |
| C1-06 | 录入端无候选状态只显示生成主操作 |
| C1-07 | 候选可用状态只显示一个采用主操作 |
| C1-08 | 发布中原主按钮 busy 且不存在第二个可点击主按钮 |
| C1-09 | 已发布状态不再显示可以发布、待处理或历史失败 |
| C1-10 | 单题成功不改变同组其他题的投射状态 |
| C1-11 | 当前版本冲突不暴露 Revision、Hash 或 Expected Version |
| C1-12 | 录入端失败说明操作结果、数据保留和本地恢复 |
| C1-13 | 页面底部命令失败不会只在顶部出现 |
| C1-14 | Learning 当前题不展示 Scheduler 解释 |
| C1-15 | Learning 不展示 Load、Thread、Evidence、Profile 或 Admission |
| C1-16 | 提示未打开时提示正文不渲染 |
| C1-17 | Revision 未触发时入口和占位均不渲染 |
| C1-18 | Revision 已触发时仅投射学生可理解的修订动作 |
| C1-19 | Targeted 未触发时入口和说明均不渲染 |
| C1-20 | Targeted 已触发时不展示工程身份且完成后保留正式顺序 |
| C1-21 | Retest / Transfer 作为当前题时不展示工程角色 |
| C1-22 | 下一题文案显示实际下一题号与总数 |
| C1-23 | 尚有正式题时不把返回入口作为唯一出口 |
| C1-24 | 题组完成时才显示完成结论与返回入口 |
| C1-25 | 空反馈区块、重复目标和重复状态不渲染 |
| C1-26 | 错误、进行中和成功的 aria-live 语义正确 |
| C1-27 | 投射前后正式资源、Session、Attempt、Evidence、Profile 与 Calibration Digest 不变 |
| C1-28 | 投射收口前后命令次数、触发结果、题组顺序与写入事实一致 |

## 十一、真实浏览器验收矩阵

工程完成后执行 `B1-01—B1-18`：

| 编号 | 场景 |
| --- | --- |
| B1-01 | 录入端首次加载只显示当前材料和必要生产操作 |
| B1-02 | 生成中只有一个 busy 主操作且重复点击被阻止 |
| B1-03 | 候选方案正常生成，普通页面无 Candidate / Gate / Hash |
| B1-04 | 采用并发布过程中状态、按钮和 Toast 一致 |
| B1-05 | 单题发布只更新当前题，其他题保持真实状态 |
| B1-06 | 发布成功后只保留“已发布”和必要详情入口 |
| B1-07 | 发布失败在当前卡片可发现，说明保留情况并可重试 |
| B1-08 | 页面底部操作失败无需滚到顶部即可发现 |
| B1-09 | Learning 入口和恢复页面无内部调度、证据或画像说明 |
| B1-10 | 单选题只显示材料、题目、选项和当前操作 |
| B1-11 | 开放文本题只显示材料、题目、按需提示和作答操作 |
| B1-12 | 提示展开与收起不改变 Attempt、题组顺序或触发事实 |
| B1-13 | Revision 未触发时完全不可见；触发时可完成一次修订 |
| B1-14 | Targeted 未触发时完全不可见；触发时完成后返回正式序列 |
| B1-15 | 下一题按钮题号准确，尚有题目时连续进入下一题 |
| B1-16 | 题组完成后才显示完成结论和返回入口 |
| B1-17 | 刷新、重试与跨标签恢复不制造重复提交或重复发布 |
| B1-18 | 普通页面控制台无错误，Internal 页面仍可追踪完整事实 |

真实浏览器测试涉及发布或作答时必须使用隔离 Fixture 或可恢复测试数据；不得把 Acceptance 记录计入正式资源、真实 Attempt、Profile 或真实校准分母。

## 十二、旧主链回归集合

阶段 1 至少回归：

- Material Resource Workbench State / Selection；
- Material Production Command State；
- Question Candidate Workbench 与 Adoption / Publication；
- Question Workbench Command E2E；
- Learning Entry / Session Queue / Round Completion；
- Phase 16.3 Real Learning Chain；
- Learning Persistence 与恢复；
- Single Choice；
- Feedback Guided Revision Stage 1—4；
- Targeted Micro-training Stage 1—4；
- Reading Training Progressive Load Stage 0—4；
- Evidence、Profile 与 Calibration 写入计数；
- Production Build。

任何触发差异、命令次数差异、题组顺序变化、正式写入差异或历史资源不可消费都视为阶段 1 回归。

## 十三、迁移、开关与回滚

阶段 1 不迁移领域数据，不重写历史正式资源。

推荐使用单一版本化投射开关：

```text
legacy_surface_projection
product_complexity_convergence_stage1_surface_projection_v1
```

要求：

- 开关只选择展示适配器，不选择业务服务；
- 同一事实输入下两套投射调用相同命令；
- 回滚只恢复旧展示，不回滚领域数据；
- Internal Acceptance 记录投射版本；
- Production 默认切换前必须完成自动化与真实浏览器验收；
- 不允许组件各自建立不可追踪的临时开关。

## 十四、工程交付物

阶段 1 工程完成时至少交付：

- 版本化 Surface Projection Schema 与 Guard；
- 录入端和 Learning 白名单投射适配器；
- 内部术语、状态和错误映射；
- 唯一主操作与状态一致性规则；
- 局部错误与恢复投射组件；
- `C1-01—C1-28` 自动化 Debug；
- `B1-01—B1-18` 真实浏览器验收入口或签署记录；
- 投射前后不可变性与命令一致性报告；
- 旧主链回归和 Production Build 结果；
- 未处理问题及其阶段 2 / 3 / 4 去向。

## 十五、阶段完成门槛

只有同时满足以下条件，阶段 1 才可标记为 `ENGINEERING COMPLETE / DEBUG ACCEPTED / FULL BROWSER ACCEPTED`：

1. `C1-01—C1-28` 全部通过；
2. `B1-01—B1-18` 全部通过；
3. 普通录入端和 Learning 不再暴露冻结的内部术语；
4. 同一操作区不存在两个同权主操作；
5. 未触发 Revision、Targeted、Retest 或 Transfer 不占据页面；
6. 错误在当前操作附近可发现，并具备数据保留说明和可执行出口；
7. 下一题、题组完成和返回入口与真实队列一致；
8. 投射前后条件能力触发结果、题组顺序、命令调用和领域写入一致；
9. 旧主链专项回归和 Production Build 通过；
10. Internal / Fixture 数据未进入正式资源、真实 Attempt、Profile 或真实校准分母；
11. 报告明确保留阶段 2、3、4 问题，不提前宣称已解决；
12. 回滚仅切换展示适配器，不需要修复领域数据。

## 十六、进入阶段 2 的边界

阶段 2 的 Schema、策略、迁移与验收边界见：[阶段 2 条件触发策略收口工程实施与 Debug 验收文档](./PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_CONDITIONAL_POLICY_ENGINEERING_AND_DEBUG_PLAN.md)。

阶段 1 完成后，阶段 2 才允许处理：

- Revision、Targeted、Retest、Transfer 的统一触发与不触发记录；
- 明确触发问题、结构化收益、退出条件和防循环边界；
- shadow audit 与正式策略一致性；
- 按能力逐项启用收口后的条件策略。

阶段 2 仍不得重建主链、覆盖 Frozen Resource、合并证据身份或建立第二套事实来源。

以下内容继续留到阶段 3：

- 从多个 Diagnosis 缺口中收敛一个主要缺口；
- 反馈生成策略与非模板化表达；
- CoreAbilitySummary 等 Profile 只读投影；
- 基于真实表现的长期展示收口。

## 十七、当前结论边界

工程实现与验收完成后，可以宣称：

- 阶段 1 页面投射与默认展示收口已经完成；
- `C1-01—C1-28` 自动化 Debug 与 `B1-01—B1-18` 真实浏览器矩阵全部通过；
- 普通录入端与 Learning 已接入用户可理解的状态、唯一主操作、条件能力隐藏和本地恢复语义；
- 投射未改变旧主链、条件能力触发、题组顺序或正式数据写入；
- Internal Acceptance 继续保留完整工程事实。

不得宣称：

- 页面收口已经实现；
- 用户理解成本已经下降；
- 条件能力触发已经优化；
- 反馈质量或教育效果已经改善；
- 任何低价值能力已经退役。

条件能力触发策略、反馈生成和能力展示仍分别保留至阶段 2、3、4，不在本阶段提前宣称完成。

## 十八、冻结声明

`product_complexity_convergence_stage1_surface_projection_v1` 冻结以下事实：

1. 阶段 1 只改变普通页面投射，不改变领域事实和运行决策；
2. 录入端与 Learning 使用白名单展示；
3. 同一操作区最多一个主操作；
4. 未触发条件能力完全不展示；
5. 内部术语、调度、证据和画像管线只进入 Internal；
6. 错误必须原位可发现，并说明保留情况和可执行出口；
7. 投射适配器不得成为第二套状态机；
8. 每项工程修改都必须证明旧主链零回归和本阶段边界内生效。

如需改变上述边界，必须升级阶段契约版本并重新执行 Debug、真实浏览器与旧主链回归。
