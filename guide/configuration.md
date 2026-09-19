# 配置

Sirius Pulse 的配置分为全局配置（含 AMKR 连接）、人格配置、任务编排配置、平台适配器配置和扩展配置。模型、供应商与采样参数不在本框架内配置——它们属于 AMKR。

## 全局配置

默认位置：`data/global_config.json`。

| 字段 | 说明 |
|---|---|
| `active_persona` | 当前活跃人格名称，CLI `run` 会启动它。 |
| `webui_host` | WebUI 监听地址，默认 `0.0.0.0`。 |
| `webui_port` | WebUI 端口，默认 `8080`。 |
| `napcat_install_dir` | NapCat 安装目录。 |
| `log_level` | 日志级别。 |
| `max_sentence_chars` | 回复切分相关的句子长度参考值。 |
| `amkr_base_url` | AMKR 地址，默认 `http://127.0.0.1:8000`。 |
| `amkr_local_api_key` | AMKR 本地授权 Key，同时也是 AMKR 面板的管理员凭据；WebUI API 只回显掩码。 |
| `amkr_workspace` | 本应用在共享 AMKR 中的命名空间前缀，默认 `sirius-pulse`。 |
| `amkr_ui_enabled` | WebUI 全局设置里的「启用 AMKR 自带 WebUI」开关。 |

相关 API：`GET /api/global-config`、`POST /api/global-config`。

## 人格目录

默认位置：`data/personas/<name>/`。

| 文件 | 说明 |
|---|---|
| `persona.json` | 人格名称、人设、语气、性格等。 |
| `orchestration.json` | 人格级编排配置；模型与采样参数不在这里，见下方「任务编排配置」。 |
| `adapters.json` | 平台适配器配置，例如 NapCat WebSocket。 |
| `experience.json` | 背景经历和可编辑经验材料。 |
| `persona.db` | 统一 SQLite 数据库，保存部分记忆、Token、认知和状态。 |

## 任务编排配置

模型选择、温度、最大 token 和故障切换都不在本框架内配置——这些属于 AMKR 的任务定义，请在 AMKR 自带面板里调整。Sirius Pulse 只保留**本地传输层**参数：

- `task_timeout`：按任务设置请求超时。
- `task_retries`：按任务设置失败重试次数。

代码模型位于 `sirius_pulse/config/models.py` 的 `OrchestrationPolicy`，同时承载与模型无关的回复策略，例如 `task_enabled`、`enable_prompt_driven_splitting`、`engagement_sensitivity`、`min_reply_interval_seconds`、`main_model_reply_cooldown_seconds`、`memory`。旧的 `unified_model`、`task_models`、`task_temperatures`、`task_max_tokens` 已不再生效。

WebUI 不再提供模型编排页面，`/api/persona/orchestration` 与 `/api/persona/task-params` 端点已移除。

## AMKR 连接配置

Sirius Pulse 不再有 Provider 注册表，所有模型调用统一发往本地 AMKR。全局配置中的键：

| 字段 | 说明 |
|---|---|
| `amkr_base_url` | AMKR 地址，**供服务端进程访问**，默认 `http://127.0.0.1:8000`。 |
| `amkr_local_api_key` | AMKR 的本地授权 Key，与 AMKR 自带面板的管理员凭据相同，可增删供应商与 Key，只保存在服务端；WebUI API 只回显掩码。 |
| `amkr_workspace` | 本应用在共享 AMKR 中的命名空间前缀，默认 `sirius-pulse`。 |
| `amkr_public_url` | AMKR 地址，**供用户浏览器访问**（运维页外链与内嵌面板）；留空表示与 `amkr_base_url` 相同。 |
| `amkr_ui_enabled` | WebUI 全局设置里的「启用 AMKR 自带 WebUI」开关。 |

`amkr_base_url` 与 `amkr_public_url` 在同机部署下必须分开：容器走回环最省事，但回环在用户浏览器里指向用户自己的机器；面板由浏览器直连 AMKR 取数，因此远程访问必须填写 `amkr_public_url`（通常是反代域名，且需与面板同源）。

相关 API：`GET /api/amkr/status`（只读连接状态与各人格任务登记情况）、`POST /api/amkr/register`（建出工作空间并补齐缺失任务名，请求体 `{"persona": "..."}` 或 `{}` 表示全部人格）、`GET /api/amkr/panel?persona=...`（仅管理员，返回可嵌入的面板地址）、`GET /api/models`（返回 12 个任务名作为可选模型）。

### AMKR 环境变量

环境变量优先于 `global_config.json`：

| 变量 | 说明 |
|---|---|
| `SIRIUS_AMKR_BASE_URL` | 覆盖 `amkr_base_url`。 |
| `SIRIUS_AMKR_API_KEY` | 覆盖 `amkr_local_api_key`；也可填写 `env:变量名` 或全大写变量名作为间接引用。 |
| `SIRIUS_AMKR_WORKSPACE` | 覆盖 `amkr_workspace`。 |
| `SIRIUS_AMKR_PUBLIC_URL` | 覆盖 `amkr_public_url`。 |

旧的 `SIRIUS_PROVIDER_TYPE`、`SIRIUS_API_KEY`、`SIRIUS_BASE_URL`、`SIRIUS_MODEL`、`SIRIUS_PROVIDER_NAME` 已移除。

这些变量必须存在于实际启动 WebUI/Persona Worker 的进程环境中；仅写入 Compose `.env` 不会自动传入容器，Docker 部署须在 `environment` 或 `env_file` 中显式映射。密钥不应提交到仓库。

## 任务名契约

AMKR 把一个**任务名**解析成真实模型，因此框架把任务名本身填进 OpenAI 兼容请求的 `model` 字段。内置 12 个任务名：`cognition_analyze`、`memory_extract`、`response_generate`、`proactive_generate`、`passive_tool`、`plugin_analyze`、`plugin_generate`、`plugin_render`、`plugin_raw`、`diary_generate`、`diary_consolidate`、`topic_cluster`。

`model` 命中任务名时，框架**不发送** `temperature` 与 `max_tokens`，由 AMKR 的任务定义决定；两边同时配置会被 AMKR 以 400 拒绝。

隔离靠请求头 `X-AMKR-Workspace`：框架按人格拼接为 `<amkr_workspace>/<persona>`（例如 `sirius-pulse/sirius`）。AMKR 是共享单实例，并非多租户。工作空间由框架**显式创建**（`POST /api/workspaces`）：创建的那一刻是拿到该空间**面板 key** 的唯一时机，因此顺序是**先建空间拿 key，再注册任务**。

面板 key 存在 `data/global_config.json` 的 `amkr_panel_keys`，不随全局配置接口回显；「AMKR 运维」页可就地嵌入所选人格的工作空间面板（面板是 AMKR 自己的页面，用量读数与任务增删改都在那里完成）。

注册策略是**只创建缺失的任务名**，已存在的任务不比对、不更新，后续调整全部在 AMKR 面板里完成。详见 [AMKR 接入配置参考](../reference/provider-config) 与 [AMKR 接入模块](../modules/provider-system)。

## 适配器配置

当前主要平台实现是 NapCat OneBot v11。适配器配置保存在人格目录的 `adapters.json`，由 `EngineRuntime` 读取并启动。

常见字段：`adapter_type`、`ws_url`、`access_token`、`enabled`、`group_whitelist`。
