# Tool 系统

Tool 是模型可自主调用的工具系统。它不同于 Plugin：Tool 服务于模型推理和工具调用，Plugin 服务于用户显式指令。

## 目录

- 内置 Tool：`sirius_pulse/tools/builtin/`。
- 外部 Tool：`tools/`。
- 注册与加载：`sirius_pulse/tools/registry.py`。
- 执行：`sirius_pulse/tools/executor.py`。
- 鉴权：`sirius_pulse/tools/security.py`。
- 执行记录：`sirius_pulse/tools/telemetry.py`。

## 核心模型

`ToolDefinition`、`ToolParameter`、`ToolResult`、`ToolInvocationContext`、`BackgroundTaskSpec`、`TriggerSpec`。

Tool 可以通过 `TOOL_META["config"]` 声明不暴露给模型的、按人格保存的配置参数。配置通过人格 Tool API 保存到 `tool_data/{tool_name}.json`，运行时由 Tool 自己从注入的 `data_store` 读取。

内置 `bash` 是受控命令工具：默认只开放只读命令，限制在人格工作区内，拒绝命令串联、重定向、嵌套解释器和危险路径。文件发送使用 `group_file_exec`，因为 Bash 不直接拥有聊天平台桥接能力。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/persona/tools` | 列出人格 Tool。 |
| `POST` | `/api/persona/tools/{tool_name}/toggle` | 启停 Tool。 |
| `GET` | `/api/persona/tools/{tool_name}/config` | 获取 Tool 配置。 |
| `POST` | `/api/persona/tools/{tool_name}/config` | 保存 Tool 配置。 |
| `GET` | `/api/persona/tool-history` | 查看 Tool 执行历史。 |
