# Plugin 总览

Plugin 是用户显式触发的聊天扩展。

## 核心文件

| 文件 | 说明 |
|---|---|
| `plugins/base.py` | Plugin 基类。 |
| `plugins/decorators.py` | `@command` 等声明式装饰器。 |
| `plugins/lexer.py` | 命令文本解析。 |
| `plugins/dispatcher.py` | 匹配和分发。 |
| `plugins/executor.py` | 执行处理器。 |
| `plugins/registry.py` | 注册表。 |

输出模式：`direct`、`llm`、`silent`。
