# 产品文档治理契约

英文名称：Product Document Governance Contract

文档类型：`NORMATIVE_CONTRACT`

状态：`ACTIVE / DESIGN FROZEN / ENGINEERING READY`

生效日期：2026-08-31

当前状态来源：[当前产品状态](./CURRENT_PRODUCT_STATE.md)

领域语义来源：[产品领域语义与主链契约](./PRODUCT_DOMAIN_SEMANTICS_AND_MAIN_CHAIN_CONTRACT.md)

主张证据来源：[产品主张与证据可追溯契约](./PRODUCT_CLAIM_EVIDENCE_TRACEABILITY_CONTRACT.md)

## 一、目标

本契约统一产品文档的类型、权威顺序、生命周期、状态轴和冲突处理方式，解决历史契约、阶段计划、验收报告和即时运行状态相互混用的问题。

本契约只治理文档，不改变产品 Runtime、正式资源、Learning 数据或 Trial 状态。

## 二、文档类型

每份 `docs/product/*.md` 必须且只能归入以下一种类型：

| 类型 | 责任 | 是否可以声明当前实时状态 |
| --- | --- | --- |
| `CURRENT_CONTROL` | 当前状态、控制表、权威索引 | 可以，但 Runtime / Provider / Trial 仍必须以实时事实为准 |
| `NORMATIVE_CONTRACT` | 冻结长期产品原则、领域责任和不变量 | 不可以 |
| `IMPLEMENTATION_PLAN` | 冻结某阶段工程边界、实施顺序和验收条件 | 不可以 |
| `ACCEPTANCE_REPORT` | 记录某一提交、样本或阶段已经验证的证据 | 不可以 |
| `HISTORICAL_SNAPSHOT` | 保留历史校准、旧口径和已替代界面快照 | 不可以 |

禁止仅根据文件名中的 `CONTRACT`、`PLAN` 或 `ACCEPTANCE` 推断当前事实；文档责任以[产品文档权威清单](./PRODUCT_DOCUMENT_AUTHORITY_MANIFEST.md)为准。

## 三、权威顺序

发生冲突时按照以下顺序裁决：

```text
实时 Runtime Health / Runtime Identity / Trial Binding
→ CURRENT_PRODUCT_STATE.md
→ CURRENT_CONTROL 文档
→ ACTIVE NORMATIVE_CONTRACT
→ IMPLEMENTATION_PLAN
→ ACCEPTANCE_REPORT
→ HISTORICAL_SNAPSHOT
```

高权威文档可以限制低权威文档的解释范围，但不得篡改历史证据。历史文档中“已完成”“已激活”“下一阶段未开始”等表达只对其记录时点有效。

## 四、生命周期

| 生命周期 | 含义 |
| --- | --- |
| `ACTIVE` | 当前仍承担控制、规范或未完成运行责任 |
| `COMPLETED` | 工程或验收责任已经完成，保留为可追溯证据 |
| `SUPERSEDED` | 已由明确后继文档替代，不再作为当前口径 |
| `HISTORICAL` | 仅作为历史快照或校准记录保留 |

`COMPLETED` 不等于当前产品 `LIVE`；`ACTIVE` 也不代表 Runtime 正在运行。

## 五、四轴状态

文档状态必须分开表达，禁止把工程通过自动投射成产品验收或线上可用。

### 5.1 Design

允许值：`PASS`、`PENDING`、`NOT_APPLICABLE`、`NOT_DECLARED`。

### 5.2 Engineering

允许值：`PASS`、`PENDING`、`NOT_APPLICABLE`、`NOT_DECLARED`。

### 5.3 Product Acceptance

允许值：`PASS`、`PENDING`、`NOT_APPLICABLE`、`NOT_CLAIMED`。

### 5.4 Live

允许值：`ACTIVE`、`OFF`、`PENDING`、`NOT_APPLICABLE`、`NOT_CLAIMED`、`DEFER_TO_CURRENT_STATE`。

四轴只记录文档明确证明的范围。缺少证据时必须使用 `NOT_DECLARED` 或 `NOT_CLAIMED`，不得按文档标题或阶段编号补推。

## 六、治理元数据

完整元数据由机器清单维护：

```text
path
title
documentType
authority
lifecycle
asOf
supersedes
supersededBy
currentStateSource
statusAxes
```

正文只要求保留对读者有帮助的最小头部状态；历史文档不因治理升级而批量改写原始结论。

## 七、当前状态与历史兼容

1. 所有文档的 `currentStateSource` 统一指向 `CURRENT_PRODUCT_STATE.md`。
2. Trial 激活、Provider smoke、正式资源数量和 Runtime Identity 都是带时间边界的证据。
3. 代码、正式资源或运行身份变化后，旧 Trial 自动成为历史证据，不能继续作为当前准入证明。
4. 后继契约必须通过 `supersedes / supersededBy` 明确替代关系；禁止静默覆盖。
5. 旧文档内容与当前事实冲突时保留原文，并由清单生命周期和当前状态来源消歧。

## 八、自动审计

`npm run audit:product-doc-governance` 必须验证：

- `docs/product` 中每份 Markdown 在机器清单中恰好出现一次；
- 枚举、路径、替代关系和当前状态来源合法；
- 当前控制文档能够回到唯一当前状态来源；
- 产品文档相对链接无断链；
- 新增文档未登记时审计失败；
- 历史验收不得被自动提升为当前 `LIVE ACTIVE`。

## 九、P1 完成定义

P1 只有同时满足以下条件才完成：

1. 文档类型、生命周期、权威顺序和四轴状态已冻结；
2. 全部产品 Markdown 已登记；
3. 缺失或含糊的权威文档状态已补齐；
4. 自动审计通过且相对链接零断链；
5. 产品代码、正式资源和 Learning 数据零写入。
