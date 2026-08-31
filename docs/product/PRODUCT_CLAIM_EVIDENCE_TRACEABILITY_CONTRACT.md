# 产品主张与证据可追溯契约

英文名称：Product Claim and Evidence Traceability Contract

文档类型：`NORMATIVE_CONTRACT`

状态：`ACTIVE / DESIGN FROZEN / ENGINEERING READY`

生效日期：2026-08-31

当前状态来源：[当前产品状态](./CURRENT_PRODUCT_STATE.md)

文档治理：[产品文档治理契约](./PRODUCT_DOCUMENT_GOVERNANCE_CONTRACT.md)

领域语义：[产品领域语义与主链契约](./PRODUCT_DOMAIN_SEMANTICS_AND_MAIN_CHAIN_CONTRACT.md)

机器注册表：[`product-claim-evidence-registry.json`](./product-claim-evidence-registry.json)

## 一、目的

本契约冻结产品主张、工程证据、产品验收、实时证明和教育效果之间的证据层级与可追溯规则。

它解决的问题不是“有没有文档写过 PASS”，而是：

> 某项产品主张由哪份长期契约定义，当前有哪些工程证据，是否经过真实产品验收，是否仍具备当前运行身份，以及是否已有真实学习数据支持教育效果。

P3 不修改产品代码、正式资源、学生记录、Runtime、Provider 或 Trial 状态，也不重建现有主链。

## 二、证据阶梯

产品证据按以下顺序分层：

```text
Design Authority
→ Engineering Evidence
→ Product Acceptance
→ Live / Runtime Proof
→ Educational Effect Evidence
```

每一层只证明本层范围内的事实。不得向上跨层推断：

1. 契约设计完成，不等于工程已经落地；
2. 自动化、Debug 或构建通过，不等于学生产品验收通过；
3. 隔离浏览器或受控浏览器通过，不等于真实学生自然使用通过；
4. 产品验收通过，不等于当前 Runtime、Provider、正式资源和 Trial 仍然有效；
5. 当前真实运行可用，不等于教育效果已经成立；
6. 一次真实作答、一次 Revision 或一次 Retest，不得自动升级为长期能力提升结论。

## 三、主张身份

每项可对外或对内使用的产品主张必须有稳定 `claimId`，并在机器注册表中至少登记：

```text
claimId
authority
requiredTokens
engineering.status / evidence
productAcceptance.status / scope / evidence
live.status / source / proofTypes
educationalEffect.status / evidence
```

同义描述不得建立重复主张。跨文档引用同一能力时必须复用已有 `claimId`。

## 四、权威与证据边界

### 4.1 权威来源

`authority` 只能指向文档权威清单中处于 `ACTIVE` 的：

- `CURRENT_CONTROL`；
- `NORMATIVE_CONTRACT`。

`IMPLEMENTATION_PLAN`、`ACCEPTANCE_REPORT` 和 `HISTORICAL_SNAPSHOT` 只能提供过程或证据，不能重新定义长期产品主张。

### 4.2 工程证据

`engineering.status = PASS` 时必须至少绑定一份存在的工程、Debug、集成或构建证据。

工程 PASS 只表示对应范围的实现和验证已经通过，不自动投射为：

- 当前服务可用；
- 当前正式资源可消费；
- 真实学生体验通过；
- 教育效果成立。

### 4.3 产品验收

`productAcceptance.status = PASS` 时必须同时具备：

- 明确的验收范围 `scope`；
- 至少一份产品验收证据；
- 证据正文中明确的产品验收 PASS 结论。

仅有自动化、隔离内存、受控故障注入或开发者自测时，产品验收保持 `PENDING` 或 `NOT_APPLICABLE`。

### 4.4 实时证明

任何涉及 Runtime、Provider、正式资源、Learning 新会话、Trial 或当前可用性的主张都不得在静态注册表中写死 `ACTIVE`。

其 `live.status` 必须为 `DEFER_TO_CURRENT_STATE`，并以 [当前产品状态](./CURRENT_PRODUCT_STATE.md) 为唯一当前状态入口。需要实时证明的主张必须同时声明 `proofTypes`，例如：

- `runtime_health`；
- `runtime_identity`；
- `provider_health`；
- `formal_store_identity`；
- `active_registry`；
- `learning_consumable`；
- `launch_record`；
- `trial_binding`。

代码、正式资源、Provider 配置或 Runtime Identity 变化后，旧实时证明自动失效；历史验收报告不得继续充当当前证明。

### 4.5 教育效果

教育效果只有在真实学生自然使用数据满足对应契约的样本、身份、独立性和复测要求时，才能标记为 `PASS_REAL_DATA`。

受控答案、Fixture、Demo、开发者自测、一次 Revision 或隔离浏览器验收不能计入教育效果证据。

## 五、特殊边界

### 5.1 Rubric 对齐反馈

评分要点对齐反馈的阶段方案与浏览器报告属于工程证据，不单独成为长期产品权威。其长期责任继续锚定到现有 Learning 反馈与修订契约；Runtime Projection 可以知道完整 Rubric，但学生端只投射本次需要的具体反馈和行动，不展示标准答案模板。

### 5.2 单项选择

单项选择的受控 PC / Tablet 产品验收可以保留为限定范围 PASS；该结论不等于当前 Learning 一定可进入，也不等于真实学生学习效果已经证明。

### 5.3 Trial 与真实 Learning

Trial 激活和真实 Learning 数据采集必须同时满足当前 Runtime Identity、Provider、正式资源和 Launch / Trial Binding。静态文档只保存规则与历史证据，不保存“当前已激活”的永久结论。

## 六、冲突处理

发生冲突时按以下顺序处理：

1. 当前 Runtime、Provider、正式资源和 Trial 事实读取 `CURRENT_PRODUCT_STATE.md`；
2. 对象与主链语义读取领域语义契约；
3. 长期能力边界读取对应 ACTIVE NORMATIVE 契约；
4. 工程和验收报告只解释其采样时点与范围；
5. 机器注册表只建立引用与状态层级，不覆盖上述权威。

如果证据层级不足，必须降级主张，而不是寻找措辞绕过门槛。

## 七、P3 工程边界

P3 只允许：

- 建立机器可读主张证据注册表；
- 建立自动审计；
- 同步产品文档入口和权威清单；
- 输出 P3 Debug 验收记录。

P3 禁止：

- 修改 `src/` 产品代码；
- 写入正式资源、Registry、Learning、Evidence 或 Trial 数据；
- 启动或激活 Trial；
- 把历史 PASS 改写为当前 LIVE；
- 以文档审计替代真实产品或教育效果验收。

## 八、完成定义

P3 完成必须同时满足：

1. 每项登记主张具有唯一 `claimId`；
2. 每个 authority 都是 ACTIVE 当前控制或规范文档；
3. 工程 PASS 均有存在的证据文件；
4. 产品验收 PASS 均有明确范围与正文结论；
5. 运行相关主张全部转交当前状态来源；
6. 教育效果没有由工程或受控浏览器证据推断；
7. P1、P2、P3 审计全部通过；
8. Production Build 通过；
9. 产品代码与正式数据写入为 0；
10. 旧主链零回归，新证据语义只在 P3 文档治理边界内生效。

