# 产品文档权威清单

英文名称：Product Document Authority Manifest

文档类型：`CURRENT_CONTROL`

状态：`ACTIVE / COMPLETE INVENTORY`

更新日期：2026-08-31

状态轴：`Design = NOT_APPLICABLE / Engineering = NOT_APPLICABLE / Product Acceptance = PENDING / Live = DEFER_TO_CURRENT_STATE`

当前状态来源：[当前产品状态](./CURRENT_PRODUCT_STATE.md)

治理规则：[产品文档治理契约](./PRODUCT_DOCUMENT_GOVERNANCE_CONTRACT.md)

## 一、用途

本文是产品文档的可读导航；逐文件机器权威清单见 [`product-document-authority-manifest.json`](./product-document-authority-manifest.json)。JSON 清单覆盖 `docs/product` 中全部 Markdown，并由自动审计保证没有遗漏、重复或悬空引用。

本文不声明 Runtime、Provider、正式资源或 Trial 当前可用。

本次清单共登记 `108` 份 Markdown：

| 文档类型 | 数量 |
| --- | ---: |
| `CURRENT_CONTROL` | 4 |
| `NORMATIVE_CONTRACT` | 37 |
| `IMPLEMENTATION_PLAN` | 48 |
| `ACCEPTANCE_REPORT` | 18 |
| `HISTORICAL_SNAPSHOT` | 1 |

生命周期分布为：`ACTIVE 51 / COMPLETED 55 / SUPERSEDED 2`。其中历史快照可以同时处于 `SUPERSEDED`，表示原始记录保留但当前职责已被后继文档接管。

## 二、当前控制层

| 文档 | 责任 |
| --- | --- |
| [当前产品状态](./CURRENT_PRODUCT_STATE.md) | 唯一当前状态来源 |
| [产品负责人控制表](./PRODUCT_CONTROL_TABLE.md) | 产品控制面与路线状态 |
| [正式资源生产契约地图](./FORMAL_RESOURCE_PRODUCTION_CONTRACT_MAP.md) | 正式资源生产责任入口 |
| 本文 | 文档分类、生命周期与权威导航 |

## 三、长期规范层

长期产品原则以 `ACTIVE NORMATIVE_CONTRACT` 为准，主要包括：

- [产品总纲](./PRODUCT.md)
- [产品文档治理契约](./PRODUCT_DOCUMENT_GOVERNANCE_CONTRACT.md)
- [产品领域语义与主链统一契约](./PRODUCT_DOMAIN_SEMANTICS_AND_MAIN_CHAIN_CONTRACT.md)
- [产品主张与证据可追溯契约](./PRODUCT_CLAIM_EVIDENCE_TRACEABILITY_CONTRACT.md)
- [材料语料质量与版本化契约](./MATERIAL_CORPUS_QUALITY_AND_VERSIONING_CONTRACT.md)
- [统一资源生产工作台契约](./UNIFIED_RESOURCE_PRODUCTION_WORKBENCH_CONTRACT.md)
- [Learning 体验规范](./PC_LEARNING_WORKSPACE_UX_CALIBRATION.md)
- [真实 Learning 数据采集与观察契约](./REAL_LEARNING_DATA_COLLECTION_AND_OBSERVATION_CONTRACT.md)
- [产品复杂度收口契约](./PRODUCT_COMPLEXITY_CONVERGENCE_CONTRACT.md)
- [运行可靠性与真实 Trial 重新准入契约](./PRODUCT_RUNTIME_RELIABILITY_AND_REAL_TRIAL_REENTRY_CONTRACT.md)

完整规范列表以机器清单为准。

## 四、阶段计划与验收证据

`IMPLEMENTATION_PLAN` 说明某一阶段准备如何实现；`ACCEPTANCE_REPORT` 记录该阶段曾经验证过什么。两者均不能覆盖当前状态来源。

阶段计划即使标记 `COMPLETED`，也只表示其工程责任已经完成；验收报告即使写有 `PASS`，也不自动表示当前 Runtime、Provider 或 Trial 仍然有效。

## 五、历史快照

`HISTORICAL_SNAPSHOT` 和 `SUPERSEDED` 文档继续保留，供追踪界面演进、旧设计口径和迁移决策，不再作为当前产品实现依据。

当前明确的替代关系包括：

- [资源生产工作台 UX 规范](./RESOURCE_PRODUCTION_WORKBENCH_UX_STANDARD.md)替代旧[素材资源录入平台 UX 校准记录](./MATERIAL_WORKBENCH_UX_CALIBRATION_2026-07-30.md)作为生产端当前体验规范；
- [统一资源生产工作台契约](./UNIFIED_RESOURCE_PRODUCTION_WORKBENCH_CONTRACT.md)吸收旧[单任务重新生成契约](./SINGLE_TRAINING_TASK_REGENERATION_CONTRACT.md)的当前生产责任。

## 六、维护方式

新增、重命名、替代或删除产品文档时，必须同步更新 JSON 清单并执行：

```bash
npm run audit:product-doc-governance
npm run audit:product-doc-semantics
npm run audit:product-claim-evidence
```

任一审计失败时不得宣称文档治理、语义对齐或主张证据追溯完成。
