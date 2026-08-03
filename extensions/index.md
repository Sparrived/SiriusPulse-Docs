# 扩展开发

Sirius Pulse 有两套扩展系统：Tool 和 Plugin。

| 需求 | 使用 |
|---|---|
| 让模型在回复中自主调用工具 | Tool |
| 用户输入 `/命令`、`#命令` 或关键词触发 | Plugin |
| 需要返回给模型继续推理的结构化结果 | Tool |
| 需要直接给用户一个命令结果 | Plugin |

## 目录

- 内置 Tool：`sirius_pulse/tools/builtin/`
- 外部 Tool：`tools/`
- 框架 Plugin：`sirius_pulse/plugins/`
- 外部 Plugin：`plugins/`
