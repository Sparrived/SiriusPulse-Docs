# WebUI 模块

## 位置

`sirius_pulse/webui/`

## 职责

WebUI 使用 aiohttp 提供 REST API、静态前端和 WebSocket 事件。routes.py 是 API 路由表。

全局页面包括「全局设置」（含 AMKR 连接）与「AMKR 运维」页。后者报告连通性、AMKR 版本、`ops_enabled` 与各人格任务登记状态，并可就地嵌入所选人格的 AMKR 工作空间面板（用量读数与任务增删改都在 AMKR 自己的页面里完成）；Sirius Pulse 内没有模型或采样参数编辑入口。面板地址由管理员专用的 `GET /api/amkr/panel` 按需下发，不写进前端源码。

## 关键协作

- 由 CLI、WebUI 或人格 worker 初始化。
- 与 `core/` 的对话管线通过明确的数据模型协作。
- 配置来源优先来自 `data/global_config.json` 和 `data/personas/<name>/`。
- 运行时状态会被 WebUI API、日志和事件流观察。

## 排查建议

1. 先确认相关配置文件是否存在且 JSON 合法。
2. 再检查 WebUI API 返回值和日志。
3. 最后定位对应模块的类和函数，避免跨层修改。
