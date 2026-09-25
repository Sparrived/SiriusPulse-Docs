# WebUI API 参考

WebUI API 路由集中定义在 `sirius_pulse/webui/routes.py`。

## 全局 API

`/api/global-config`、`/api/models`、`/api/amkr/status`、`/api/amkr/panel`、`/api/amkr/rotate-inference-key`、`/api/amkr/register`、`/api/tokens`、`/api/telemetry`、`/api/embedding/status`、`/api/embedding/rebuild`、`/api/system/logs`、`/api/auth/login`、`/api/auth/status`、`/api/monitoring/overview`、`/api/monitoring/metrics`、`/api/monitoring/health`、`/api/dispatcher/overview`、`/api/shutdown`。

`/api/models` 返回的是 13 个 AMKR 任务名（`available_models` / `model_choices`），不再是厂商模型列表。`/api/amkr/status` 为只读巡检（含各人格 `panel_ready` / `inference_ready`，但**不含**任何 key），`/api/amkr/register` 建出工作空间并补齐缺失任务名（请求体 `{"persona": "..."}` 或 `{}` 表示全部人格）。`/api/amkr/panel?persona=<名字>` **仅管理员可用**，返回可嵌入的工作空间面板地址（fragment 内为明文面板 key），即运维页 iframe 的来源。`/api/amkr/rotate-inference-key` **仅管理员可用**，请求体 `{"persona": "..."}`，换一把该空间的推理 key 并返回 `{"persona", "inference_key"}`——明文只回这一次，旧 key 立即失效且**不影响面板 key**。旧的 `/api/providers*` 端点已全部移除。

## 人格管理

`/api/personas`、`/api/personas/active`、`/api/personas/{name}/activate`、`/api/persona/start`、`/api/persona/stop`、`/api/persona/status`。

## 当前人格配置

`/api/persona`、`/api/persona/logs`、`/api/persona/persona`、`/api/persona/persona/interview`、`/api/persona/experience`、`/api/persona/adapters`、`/api/persona/engine/reload`。

模型编排页面与 `/api/persona/orchestration`、`/api/persona/task-params` 已移除；模型与采样参数改在 AMKR 自带面板配置。

## 记忆与观测

`/api/persona/tokens`、`/api/persona/cognition`、`/api/persona/cognition/analysis`、`/api/persona/diary`、`/api/persona/vector-store-status`、`/api/persona/vector-store/rebuild`、`/api/persona/profile/*`、`/api/persona/memory-viz`、`/api/persona/conversations`。

## 自主行为

`/api/persona/autonomy` **只读**，返回她当前惦记的意图（`memory/intentions.json`）与自己做过的事（`memory/autonomy/episodes.json`），以及两者共用的 `summary`（未了意图数、累计自主数、最近一次时间）和文件路径。`limit` 可限制返回条数（1–200，默认 100），两类记录均按时间倒序。

之所以没有写接口：从后台替她行动会让她变成"可配置"而不是"自主"。页面同样只读。

## 工作模式

`GET /api/persona/work-mode` 返回每次工作模式的轨迹（`memory/work_mode/sessions.json`）：`goal`（她进去准备做什么）、`source`（`chat` 她自己进去的 / `autonomy` 自主回合 / `scheduled` 定时任务回合）、`task_name`（这次用的任务名，即 AMKR 的模型入口）、`steps`（逐轮的正文、工具调用与工具结果、`send_midway_msg` 发出的话）、`result`（退出时给出的工作结果）、`status`（`running` / `completed` / `aborted`）与起止时间。`summary` 给出累计次数、已完成数、进行中数、步骤总数与最近一次的目标；`limit` 可限制返回条数（1–100，默认 50），按时间倒序。同一次响应还带 `settings.task_name`（当前设置）与 `task_options`（可选任务名及其中文标签，即 `/api/models` 的同一份目录）。

`POST /api/persona/work-mode` **只接受 `{"task_name": "..."}`**，用来设置"工作期间使用的模型"：任务名就是 AMKR 的模型入口，空字符串表示沿用本回合原本的任务名（普通聊天即 `response_generate`）。写入 `memory/work_mode/settings.json`，每次开始工作时重新读取，因此改完下一次工作模式生效、不需要重启人格。任务名限定字母、数字、下划线、点和横线，最多 64 个字符（它会被当作 `model` 字段发给 AMKR）。

轨迹本身仍然只读：进出工作模式是模型自己的决定，从 WebUI 替她进入或退出就不是"她自己做"了。轨迹文件落在 `memory/` 下，写入后经既有的文件监听推送 `data_changed`（资源名 `work-mode`），无需另开通道。

## WebSocket

- `GET /ws/events`：订阅全部人格事件。
- `GET /ws/events/{name}`：订阅指定人格事件。

连接由 `webui/event_bridge.py` 供给内容：它订阅每个人格引擎的 `SessionEventBus`，把事件按人格广播给浏览器。`agent_turn_updated` 带 `data.origin` 区分来源——`self_initiated` 表示这是她自己发起的回合，自主行为页面据此实时显示。人格引擎被重建时会换成新的事件总线，桥按引擎身份重新订阅。
