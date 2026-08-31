# 扩展开发

Sirius Pulse 有两套扩展系统：Tool 和 Plugin。

| 需求 | 使用 |
|---|---|
| 让模型在回复中自主调用工具 | Tool |
| 用户输入 `/命令`、`#命令` 或关键词触发 | Plugin |
| 需要返回给模型继续推理的结构化结果 | Tool |
| 需要直接给用户一个命令结果 | Plugin |

## 目录与加载位置

| 类型 | 位置 | 加载与持久化边界 |
|---|---|---|
| 内置 Tool | `sirius_pulse/tools/builtin/` | 随核心 Python 包发布。 |
| 外部 Tool | `data/personas/<name>/tools/` | 每人格扫描；同名外部 Tool 可覆盖内置 Tool。 |
| 框架 Plugin | `sirius_pulse/plugins/` | 提供 Plugin 基类、加载、注册、执行和调度框架。 |
| 外部 Plugin | 工作区根目录 `plugins/` Git submodule | 所有人格共享发现；设置写入宿主机 `plugins/_config.json`。Docker 中挂载为 `/app/plugins`。 |

## 复用原则

Tool 与 Plugin 面向不同的触发和返回场景，应保持各自独立的注册、执行和结果契约。后台任务、数据存储、主动消息、Webhook/事件订阅、重试、遥测和 Secret 脱敏等稳定能力可以抽取为公共服务。

- Tool 由模型根据 `TOOL_META` 和当前上下文决定调用，返回 `ToolResult` 供后续模型推理使用；其配置和状态默认存于人格的 `tool_data/`。
- Plugin 由用户命令、声明式事件或框架托管的后台任务触发，返回 `PluginResponse` 或主动消息；外部 Plugin 的共享设置存于 `plugins/_config.json`，人格状态存于 `plugin_data/`。
- 长期轮询、Webhook 和主动通知不因其“能做外部请求”而自动成为 Tool；若主要由用户/运维配置和管理，应实现为 Plugin。

- [Tool 总览](./tool-overview)：了解模型可调用工具的定义、执行与权限边界。
- [Plugin 总览](./plugin-overview)：了解用户命令、事件调度、后台任务和主动消息。
- [GitHub Monitor 外部 Plugin](./github-monitor)：配置 GitHub 仓库监控、环境变量和 Webhook。
