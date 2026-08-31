# 配置

Sirius Pulse 的配置分为全局配置、Provider 配置、人格配置、模型编排配置、平台适配器配置和扩展配置。

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

相关 API：`GET /api/global-config`、`POST /api/global-config`。

## 人格目录

默认位置：`data/personas/<name>/`。

| 文件 | 说明 |
|---|---|
| `persona.json` | 人格名称、人设、语气、性格等。 |
| `orchestration.json` | 模型任务编排与回复策略。 |
| `adapters.json` | 平台适配器配置，例如 NapCat WebSocket。 |
| `experience.json` | 背景经历和可编辑经验材料。 |
| `persona.db` | 统一 SQLite 数据库，保存部分记忆、Token、认知和状态。 |

## 编排配置

代码模型位于 `sirius_pulse/config/models.py` 的 `OrchestrationPolicy`。

常用字段：`unified_model`、`task_models`、`task_enabled`、`task_temperatures`、`task_max_tokens`、`task_retries`、`enable_prompt_driven_splitting`、`session_reply_mode`、`engagement_sensitivity`、`min_reply_interval_seconds`、`main_model_reply_cooldown_seconds`、`memory`。

相关 API：`GET /api/persona/orchestration`、`POST /api/persona/orchestration`、`GET /api/persona/task-params`、`POST /api/persona/task-params`。

## Provider 配置

`ProviderConfig` 字段：`name`、`provider_type`、`api_key`、`base_url`、`healthcheck_model`、`enabled`、`models`、`models_url`。

其中 `name` 是全局唯一且可修改的 Provider 识别名称，模型配置通过 `name/model` 路由；相同 API 端点和平台类型的不同 Key 可通过不同名称并存。旧配置会在首次加载时自动补齐名称，冲突名称自动追加数字后缀。

相关 API：`GET /api/providers`、`POST /api/providers`、`POST /api/providers/probe`、`POST /api/providers/refresh-models`。

### Provider 环境变量

快速测试或无 WebUI 配置时，可以通过启动进程的环境变量提供一个 Provider：

| 变量 | 说明 |
|---|---|
| `SIRIUS_PROVIDER_TYPE` | Provider 类型，默认 `openai-compatible`。 |
| `SIRIUS_API_KEY` | API 密钥；也可填写 `env:变量名` 或全大写变量名作为间接引用。 |
| `SIRIUS_BASE_URL` | 可选的 OpenAI-compatible 服务地址。 |
| `SIRIUS_MODEL` | 默认模型名，默认 `gpt-4o-mini`。 |
| `SIRIUS_PROVIDER_NAME` | 可选的 Provider 标识名；未设置时使用 Provider 类型。 |

这些变量必须存在于实际启动 WebUI/Persona Worker 的进程环境中；仅写入 Compose `.env` 不会自动传入容器，Docker 部署须在 `environment` 或 `env_file` 中显式映射。生产环境优先使用 WebUI/ProviderRegistry 的持久化配置，并避免把密钥提交到仓库。

## 适配器配置

当前主要平台实现是 NapCat OneBot v11。适配器配置保存在人格目录的 `adapters.json`，由 `EngineRuntime` 读取并启动。

常见字段：`adapter_type`、`ws_url`、`access_token`、`enabled`、`group_whitelist`。
