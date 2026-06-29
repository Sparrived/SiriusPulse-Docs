# Plugin 指令系统

Plugin 指令由 `@command` 装饰器声明，由 lexer 解析文本，再由 dispatcher 匹配到处理器。

| 参数 | 说明 |
|---|---|
| `name` | 指令名。 |
| `prefix` | 前缀，如 `/`、`#`、`!`。 |
| `patterns` | 触发词列表。 |
| `pattern_type` | `prefix`、`keyword` 或 `regex`。 |
| `render_mode` | `direct`、`llm` 或 `silent`。 |
| `hidden_from_intent` | 是否从自然语言意图中隐藏。 |
