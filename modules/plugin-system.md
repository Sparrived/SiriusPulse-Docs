# Plugin 系统模块

## 位置

- `sirius_pulse/plugins/`：核心 Plugin 运行时，包括基类、加载、注册、执行、命令分发和调度。
- 工作区根目录 `plugins/`：宿主机维护的外部 Plugin Git submodule；Docker 中挂载为 `/app/plugins`，共享设置为 `plugins/_config.json`。

## 职责

Plugin 是用户显式触发的扩展系统，支持命令装饰器、命令解析、权限、事件、调度、执行和多种渲染模式。

Plugin 与 Tool 应保持各自独立的注册、执行和返回契约，同时可以共享稳定的底层能力服务，例如数据存储、后台任务、主动消息、Webhook/事件订阅、重试、遥测和 Secret 脱敏。外部 Plugin 可包含 `github_monitor`、`amkr_key_manager`、`sub2api_monitor` 等扩展，实际目录以子模块版本为准；其中 `github_monitor` 已从内置 Tool 迁出，见 [GitHub Monitor 外部 Plugin](../extensions/github-monitor)。

## 关键协作

- 由 CLI、WebUI 或人格 worker 初始化。
- 与 `core/` 的对话管线通过明确的数据模型协作。
- 配置来源优先来自 `data/global_config.json` 和 `data/personas/<name>/`。
- 运行时状态会被 WebUI API、日志和事件流观察。

## 排查建议

1. 先确认相关配置文件是否存在且 JSON 合法。
2. 再检查 WebUI API 返回值和日志。
3. 最后定位对应模块的类和函数，避免跨层修改。
