# Tool 系统模块

## 位置

`sirius_pulse/tools/`

## 职责

Tool 系统加载内置和外部工具，生成模型可见工具定义，执行工具函数并记录遥测。

Tool 与 Plugin 可以共享底层能力服务，但保持各自的注册、执行和返回契约。对于 GitHub 监控，当前最低风险的拆分方式是先迁移为外部被动 Tool，再在 Plugin 的主动任务和 Webhook 能力完善后迁移为真正的 Plugin。详见[《GitHub 集成与插件化评估》](./github-integration)。

## 关键协作

- 由 CLI、WebUI 或人格 worker 初始化。
- 与 `core/` 的对话管线通过明确的数据模型协作。
- 配置来源优先来自 `data/global_config.json` 和 `data/personas/<name>/`。
- 运行时状态会被 WebUI API、日志和事件流观察。

## 排查建议

1. 先确认相关配置文件是否存在且 JSON 合法。
2. 再检查 WebUI API 返回值和日志。
3. 最后定位对应模块的类和函数，避免跨层修改。
