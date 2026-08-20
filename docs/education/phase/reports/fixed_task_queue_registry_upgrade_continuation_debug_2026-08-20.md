# 固定题组 Registry 切换后连续学习补充验收（2026-08-20）

## 问题

真实 Learning 会话在反馈后显示“下一题（3/4）”，点击后却提示“暂无符合当前能力和任务要求的正式任务”。题组明明已经冻结第 4 题，运行时却重新从 Active Registry Current Head 集合中查找；录入端发布后继版本后，队列引用的旧 Frozen Version 不再是 Current Head，因而被错误地当成无匹配任务。

## 收口边界

1. 新会话仍只从最新 Active Registry Current Head 与最新质量准入结果创建队列；
2. 已开始会话直接按队列 `resourceVersionId` 读取不可变 Frozen Version；
3. Current Head 切换不改写、不移除活动队列中的版本；
4. 活动队列旧版本必须继续保留原 Validation / Review Trace，并只用于该活动会话；
5. 版本确实缺失或身份错位时继续明确阻断，不允许静默换题。

## Debug 结果

| 验收项 | 结果 |
| --- | --- |
| Phase 17.3 Learning Entry Integration | `17 / 17 PASS` |
| 固定题组 Queue | `19 / 19 PASS` |
| Revision Stage 4 | `19 / 19 PASS` |
| 最新正式题质量准入 | `8 / 8 PASS`，`79 / 79` 可进入新会话 |
| Production Build | `PASS` |
| Learning 页面刷新与控制台错误检查 | `PASS`，无运行时错误 |

新增回归 `02E` 明确证明：同一正式资源的 Registry Current Head 被后继版本替换后，普通严格读取不会重新采用旧版本，而带活动题组身份的读取仍能准备并执行队列冻结版本。

## 结论

问题已按“新会话用最新版、活动会话用冻结版”边界修复。完成修订、刷新页面或生产端发布新版，都不应再把尚未完成的固定题组提前截断。
