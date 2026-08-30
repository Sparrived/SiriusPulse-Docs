# Plugin 系统模块

## 位置

`sirius_pulse/plugins/`

## 职责

Plugin 是用户显式触发的扩展系统，支持命令装饰器、命令解析、权限、事件、调度、执行和多种渲染模式。

Plugin 可以复用 Tool 的底层能力服务（存储、重试、Webhook、主动消息、后台任务和遥测），但不应直接复用 `ToolRegistry`、`ToolExecutor` 或 `ToolResult`。GitHub 监控的具体拆分建议见[《GitHub 集成与插件化评估》](./github-integration)。

## 关键协作

- 由 CLI、WebUI 或人格 worker 初始化。
- 与 `core/` 的对话管线通过明确的数据模型协作。
- 配置来源优先来自 `data/global_config.json` 和 `data/personas/<name>/`。
- 运行时状态会被 WebUI API、日志和事件流观察。

## 排查建议

1. 先确认相关配置文件是否存在且 JSON 合法。
2. 再检查 WebUI API 返回值和日志。
3. 最后定位对应模块的类和函数，避免跨层修改。
