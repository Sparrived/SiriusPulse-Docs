# AMKR 接入配置参考

Sirius Pulse 不再有 Provider 注册表。所有模型调用都发往本地 [AMKR](https://github.com/Sparrived/auto-model-key-router)（`auto-model-key-router`，OpenAI 兼容路由），框架只保存「怎么连上它」。

## 连接配置

位置：`data/global_config.json`。

| 字段 | 默认值 | 说明 |
|---|---|---|
| `amkr_base_url` | `http://127.0.0.1:8000` | AMKR 地址。请求发往 `<base_url>/v1/chat/completions`。 |
| `amkr_local_api_key` | 空 | AMKR 的本地授权 Key，**与 AMKR 自带面板的管理员凭据是同一个**，可增删供应商与 Key，因此只保存在服务端。 |
| `amkr_workspace` | `sirius-pulse` | 本应用在共享 AMKR 中的命名空间前缀。 |
| `amkr_ui_enabled` | `true` | WebUI 全局设置里的「启用 AMKR 自带 WebUI」开关。 |

`amkr_local_api_key` 在 WebUI API 响应中被脱敏为 `sk-a****`；提交脱敏值时服务端保留磁盘上的原值，不会把掩码写回配置。

环境变量优先于配置文件：

| 环境变量 | 覆盖 |
|---|---|
| `SIRIUS_AMKR_BASE_URL` | `amkr_base_url` |
| `SIRIUS_AMKR_API_KEY` | `amkr_local_api_key` |
| `SIRIUS_AMKR_WORKSPACE` | `amkr_workspace` |

`amkr_local_api_key` 还支持间接写法：`env:变量名`，或「全大写且不含空格的名字」也会先当作环境变量名解析，取不到再按字面量处理。

旧的 `SIRIUS_PROVIDER_TYPE`、`SIRIUS_API_KEY`、`SIRIUS_BASE_URL`、`SIRIUS_MODEL`、`SIRIUS_PROVIDER_NAME` 已全部移除。

## 任务名契约

AMKR 把**任务名**解析成真实模型，因此框架把任务名直接填进 `model` 字段。内置 12 个任务名：

`cognition_analyze`、`memory_extract`、`response_generate`、`proactive_generate`、`passive_tool`、`plugin_analyze`、`plugin_generate`、`plugin_render`、`plugin_raw`、`diary_generate`、`diary_consolidate`、`topic_cluster`

- `model` 命中任务名时，框架**不发送** `temperature` 与 `max_tokens`，模型选择、温度、最大 token 和故障切换都取 AMKR 任务定义里的值。
- `model` 不是任务名时按普通模型直连，采样参数由框架给出。任务名必须与 AMKR 工作空间里的任务同名，否则 AMKR 会把它当成真实模型去查找并失败。
- 每个任务在本地的超时与重试写在 `data/personas/<name>/engine_state/orchestration.json` 的 `task_timeout` / `task_retries`，属于传输层参数。

## 工作空间与隔离

AMKR 是共享单实例，允许多个 AI 服务同时使用，**不是多租户**。隔离靠请求头 `X-AMKR-Workspace`，框架按人格拼接为 `<amkr_workspace>/<persona>`（例如 `sirius-pulse/sirius`）。

工作空间由「在里面建第一个任务」隐式产生，没有单独的创建步骤。请求头为空时不发送，等价于 AMKR 的默认工作空间。

## 注册策略

框架**只创建缺失的任务名**，已存在的一律不比对、不更新——后续所有模型与参数调整都在 AMKR 自带 WebUI 里完成，避免每次启动把运维调好的配置打回去。注册是幂等的，可以重复触发。

## API

- `GET /api/amkr/status`：只读。返回 `configured`、`base_url`、`workspace_base`、`ui_url`、`reachable`、`version`、`ops_enabled`、`webui_mounted`、`known_tasks`，以及每个人格的 `{persona, workspace, registered[], missing[], error}`。
- `POST /api/amkr/register`：补齐缺失任务名。请求体 `{"persona": "..."}` 指定单个人格，`{}` 表示全部人格。
- `GET /api/models`：仍然存在，但 `available_models` / `model_choices` 返回的是上述 12 个任务名（含中文标签），不再是厂商模型列表。

`/api/providers`、`/api/providers/probe`、`/api/providers/refresh-models`、`/api/providers/models-probe`、`/api/providers/proxy` 已全部移除，代理配置与 `data/providers/proxy.json` 也不再存在。

## 相关配置

- 全局配置的其余字段见 [全局配置参考](./global-config)。
- WebUI 的「AMKR 运维」页只报告连通性与注册状态，并外链到 AMKR 自己的面板；Sirius Pulse 内**没有**模型或采样参数编辑入口。
- AMKR 应绑定 `127.0.0.1` 或内网地址；Sirius Pulse 的 `docker-compose.yml` 使用 `network_mode: host`，因此 `http://127.0.0.1:8000` 能直接到达 AMKR。
