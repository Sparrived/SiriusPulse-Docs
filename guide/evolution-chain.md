# 演化链

演化链是 WebUI 中用于观察人格长期变化的一组视图。当前代码把它与记忆、日记、认知事件和用户档案共同呈现。

## 数据来源

- 对话历史：`/api/persona/conversations`。
- 日记：`/api/persona/diary`。
- 认知事件：`/api/persona/cognition` 与 `/api/persona/cognition/analysis`。
- 记忆可视化：`/api/persona/memory-viz`。
- 用户档案和术语表：`/api/persona/profile/*`、`/api/persona/glossary`。

## 注意事项

演化链不是单独的模型或数据库。它是对既有记忆和认知数据的聚合展示，因此排查问题时应先检查对应 API 是否有数据。
