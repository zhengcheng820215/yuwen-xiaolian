# WP-R3 Runtime Identity、Trial 自动失效与浏览器验收记录

日期：2026-08-26
工程基线：`629de2fde915dbed0ca5f6aded2b3aacedd9c62b`
工作包：`product_runtime_reliability_wp_r3_v1`
结论：`ENGINEERING COMPLETE / DEBUG ACCEPTED / BROWSER ACCEPTED / WP-R4 AUTHORIZED`

## 一、工程结果

WP-R3 已完成以下能力：

- 建立 `product_runtime_identity_v1` 与八类内容寻址输入；
- 对源码、依赖锁、构建配置、Production Artifact、Current Frozen Resource、可执行策略、Trial 策略与 Provider 边界生成 SHA-256 摘要；
- Candidate、时间、Store Revision、文档、密钥和学生内容不进入 Runtime Identity；
- 建立 `real_trial_runtime_identity_binding_v1` 读取与比较契约；
- Activation State / Audit 兼容升级至 v2；
- 旧非 off Trial、missing、invalid、dirty、legacy 与 mismatch 状态自动、单向、幂等回落 off；
- 自动失效只允许 Activation State 1 次与 Audit 1 次最小写入；
- Identity 不一致时 Observation 为 0，Learning 与 Workbench 继续 fail-open；
- Health 与 Internal 只读显示身份状态、短 Digest 与 Alignment，不向普通产品页面投射内部术语；
- 建立隔离浏览器验收页，不提供 Trial 激活、正式资源保存或学习提交入口。

## 二、当前运行身份

本轮 Production Build 后生成：

```text
Runtime Identity Digest:
sha256:f8610044cdea9f109445d95327c14fe572b39251ab5e940d321a9ea25315bdf1

Runtime Identity Status: dirty
Source File Count: 590
Artifact File Count: 4
Formal Store Revision: 1963
Active Material / Current Question: 24 / 81
```

`dirty` 是预期的安全结果：验收发生在尚未提交的 WP-R3 工作区内，因此真实 Trial 必须保持 off。提交完成后仍须进入 WP-R4 重新构建身份、重新执行 Preflight，并创建新的 Launch Record 与 Runtime Identity Binding；禁止自动复活旧 Trial。

## 三、自动化 Debug

| 验收集合 | 结果 |
| --- | --- |
| WP-R3 Runtime Identity / Invalidation | `40 / 40 PASS` |
| WP-R3 Browser Matrix | `16 / 16 PASS` |
| WP-R0 Runtime Baseline | `32 / 32 PASS` |
| WP-R1 Launcher / Health | `36 / 36 PASS` |
| WP-R1 Launcher Integration | `14 / 14 PASS` |
| WP-R2 Failure / Recovery Projection | `40 / 40 PASS` |
| Stage 4 Real Trial Preflight | `56 / 56 PASS` |
| WP-R0 Browser Matrix | `12 / 12 PASS` |
| WP-R1 Browser Matrix | `14 / 14 PASS` |
| WP-R2 Browser Matrix | `18 / 18 PASS` |
| Production Build | `PASS` |

Production Build 仅保留既有大 Chunk 与同模块静态、动态混合导入提示，无新增阻断错误。

## 四、真实浏览器验收

真实浏览器只读验收结果：

- WP-R3 验收页显示 `16/16 全部通过`；
- Internal Runtime Health 显示结构化 Runtime Identity 状态和缩短 Digest；
- 当前 dirty 身份使 Trial 投射为 off，并显示重新准入要求；
- Learning 可打开并读取正式资源；
- Material Resource Workbench 可打开；
- Learning 与 Workbench 均未出现 Runtime Identity、Binding、Launch Record 或 Digest mismatch 等内部术语；
- 验收页没有激活、保存正式资源或学习提交入口。

## 五、写入边界

只读身份生成验证、Health、Internal 与 Browser Acceptance 对以下产品数据写入均为 0：

```text
Formal Resource = 0
Student Session = 0
Student Attempt = 0
Diagnosis / Evidence = 0
Profile = 0
Calibration / Real Denominator = 0
Trial Window / Launch / Binding = 0
Trial Observation = 0
```

构建命令仅写入 `dist` 与 `dist/.runtime/product-runtime-identity.json`。自动失效测试只在 In-Memory Repository 中验证允许的 State 1 / Audit 1 及重复执行 0 / 0，没有改写正式业务数据。

## 六、遗留边界与下一步

- 当前身份为 dirty，不具备真实 Trial 准入资格；
- AI Provider 在本地未完成 live availability verification，不具备真实 Trial 准入资格；
- 历史 Launch 无 Runtime Identity Binding，只能解释为 `legacy_unverifiable`；
- WP-R3 不创建 Window、Launch 或 Binding，也不激活 Trial；
- 下一步只能进入 WP-R4：清洁提交后重新构建身份、执行新 Preflight、创建新 Launch 与不可变 Binding，再决定是否激活新的真实 Trial Window。

最终结论：WP-R3 工程边界已经完成，旧主链零回归，真实 Trial 安全保持 off，允许进入 WP-R4，但尚未重新准入真实 Trial。
