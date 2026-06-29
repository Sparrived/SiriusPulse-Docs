# 被动 Skill

被动 Skill 不一定由模型在单轮回复中主动调用，而是通过后台任务、事件或生命周期钩子运行。

## 类型

- 后台任务：按固定间隔执行。
- 事件触发：收到特定会话事件后执行。
- 加载钩子：Skill 加载时初始化资源。
- 卸载钩子：Skill 停用或重载时清理资源。

相关模型：`BackgroundTaskSpec`、`TriggerSpec`、`SkillPassiveType`、`SkillChainContext`。
