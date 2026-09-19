# WebUI API 参考

WebUI API 路由集中定义在 `sirius_pulse/webui/routes.py`。

## 全局 API

`/api/global-config`、`/api/models`、`/api/amkr/status`、`/api/amkr/panel`、`/api/amkr/register`、`/api/tokens`、`/api/telemetry`、`/api/embedding/status`、`/api/embedding/restart`、`/api/system/logs`、`/api/auth/login`、`/api/auth/status`、`/api/monitoring/overview`、`/api/monitoring/metrics`、`/api/monitoring/health`、`/api/dispatcher/overview`、`/api/shutdown`。

`/api/models` 返回的是 12 个 AMKR 任务名（`available_models` / `model_choices`），不再是厂商模型列表。`/api/amkr/status` 为只读巡检（含各人格 `panel_ready`，但**不含**面板 key），`/api/amkr/register` 建出工作空间并补齐缺失任务名（请求体 `{"persona": "..."}` 或 `{}` 表示全部人格）。`/api/amkr/panel?persona=<名字>` **仅管理员可用**，返回可嵌入的工作空间面板地址（fragment 内为明文面板 key），即运维页 iframe 的来源。旧的 `/api/providers*` 端点已全部移除。

## 人格管理

`/api/personas`、`/api/personas/active`、`/api/personas/{name}/activate`、`/api/persona/start`、`/api/persona/stop`、`/api/persona/status`。

## 当前人格配置

`/api/persona`、`/api/persona/logs`、`/api/persona/persona`、`/api/persona/persona/interview`、`/api/persona/experience`、`/api/persona/adapters`、`/api/persona/engine/reload`。

模型编排页面与 `/api/persona/orchestration`、`/api/persona/task-params` 已移除；模型与采样参数改在 AMKR 自带面板配置。

## 记忆与观测

`/api/persona/tokens`、`/api/persona/cognition`、`/api/persona/cognition/analysis`、`/api/persona/diary`、`/api/persona/vector-store-status`、`/api/persona/vector-store/rebuild`、`/api/persona/profile/*`、`/api/persona/memory-viz`、`/api/persona/conversations`。

## WebSocket

- `GET /ws/events`：订阅全部人格事件。
- `GET /ws/events/{name}`：订阅指定人格事件。
