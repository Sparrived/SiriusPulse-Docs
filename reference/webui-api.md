# WebUI API 参考

WebUI API 路由集中定义在 `sirius_pulse/webui/routes.py`。

## 全局 API

`/api/global-config`、`/api/providers`、`/api/providers/probe`、`/api/providers/refresh-models`、`/api/models`、`/api/tokens`、`/api/telemetry`、`/api/embedding/status`、`/api/embedding/restart`、`/api/system/logs`、`/api/auth/login`、`/api/auth/status`、`/api/monitoring/overview`、`/api/monitoring/metrics`、`/api/monitoring/health`、`/api/shutdown`。

## 人格管理

`/api/personas`、`/api/personas/active`、`/api/personas/{name}/activate`、`/api/persona/start`、`/api/persona/stop`、`/api/persona/status`。

## 当前人格配置

`/api/persona`、`/api/persona/logs`、`/api/persona/persona`、`/api/persona/persona/interview`、`/api/persona/orchestration`、`/api/persona/task-params`、`/api/persona/experience`、`/api/persona/adapters`、`/api/persona/engine/reload`。

## 记忆与观测

`/api/persona/tokens`、`/api/persona/cognition`、`/api/persona/cognition/analysis`、`/api/persona/diary`、`/api/persona/vector-store-status`、`/api/persona/vector-store/rebuild`、`/api/persona/glossary`、`/api/persona/profile/*`、`/api/persona/memory-viz`、`/api/persona/conversations`。

## WebSocket

- `GET /ws/events`：订阅全部人格事件。
- `GET /ws/events/{name}`：订阅指定人格事件。
