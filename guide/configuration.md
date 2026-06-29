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

`ProviderConfig` 字段：`provider_type`、`api_key`、`base_url`、`healthcheck_model`、`enabled`、`models`、`models_url`。

相关 API：`GET /api/providers`、`POST /api/providers`、`POST /api/providers/probe`、`POST /api/providers/refresh-models`。

## 适配器配置

当前主要平台实现是 NapCat OneBot v11。适配器配置保存在人格目录的 `adapters.json`，由 `EngineRuntime` 读取并启动。

常见字段：`adapter_type`、`ws_url`、`access_token`、`enabled`、`group_whitelist`。
