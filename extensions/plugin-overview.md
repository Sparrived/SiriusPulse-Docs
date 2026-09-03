# Plugin 总览

Plugin 是用户显式触发的聊天扩展，也可以声明由框架托管的后台任务并主动向聊天平台推送消息。外部插件代码位于宿主机项目根目录 `plugins/` Git submodule 中；框架运行时代码仍位于 `sirius_pulse/plugins/`。Docker/Compose 将宿主机目录挂载到 `/app/plugins`，外部源码和 `_config.json` 不会进入核心镜像。`github_monitor` 已作为外部 Plugin 提供，不再属于内置 Tool；其部署、密钥与迁移说明见 [GitHub Monitor 外部 Plugin](./github-monitor)。

## 核心文件

| 文件 | 说明 |
|---|---|
| `plugins/base.py` | Plugin 基类、生命周期和后台任务声明。 |
| `plugins/decorators.py` | `@command` 等声明式装饰器。 |
| `plugins/lexer.py` | 命令文本解析。 |
| `plugins/dispatcher.py` | 匹配和分发。 |
| `plugins/executor.py` | 权限、执行、后台任务和生命周期管理。 |
| `plugins/registry.py` | 注册表。 |
| `extension_runtime.py` | Tool 与 Plugin 共用的扩展运行时契约。 |

## 能力边界

- 用户命令：使用 `@command`，返回 `PluginResponse`。
- 定时事件：使用 `_plugin_events` / `_plugin_schedule`，由 `PluginScheduler` 调度。
- 长周期后台任务：覆写 `create_background_tasks()`，返回 `BackgroundTaskSpec`。
- 主动消息：使用 `await self.ctx.dispatch_proactive_message(...)`，不要直接调用平台私有 API。
- 附件：使用 `self.get_artifact_dir()` 获取插件专用目录。
- 可视化配置：作者可声明受限的 `_plugin_ui_schema`，为 `_plugin_parameters` 提供中文分区、标签和对象数组卡片；部署者只编辑参数值。

输出模式：`direct`、`llm`、`silent`。

`_plugin_parameters` 始终是类型、默认值、必填、范围、选项、对象子字段和稳定身份的唯一契约。`_plugin_ui_schema` 只影响 WebUI 展示，不会持久化，也不能声明 HTML/CSS/JavaScript、秘密字段或任意组件。没有有效 Schema 时自动使用通用表单。完整契约见 [编写自定义 Plugin](./plugin-authoring#参数契约与可视化-schema)。

## 与 Tool 的关系

Plugin 与 Tool 不共用完整的注册表和执行器，但可以共享底层能力服务。当前 `BackgroundTaskSpec` 已抽取到 `sirius_pulse/extension_runtime.py`，Tool 和 Plugin 都可以从各自公开 API 导入它。

推荐的复用方式是：

```text
公共能力服务
├── 后台任务契约
├── 数据存储
├── 主动消息
├── Webhook / 事件订阅
└── 重试、遥测和 Secret 脱敏

Tool：ToolRegistry + ToolExecutor + ToolResult
Plugin：PluginRegistry + PluginExecutor + PluginResponse
```

不要把 `ToolExecutor` 直接当成 Plugin 执行器。
