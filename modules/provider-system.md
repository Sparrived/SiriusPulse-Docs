# AMKR 接入模块

## 位置

`sirius_pulse/providers/`

## 职责

`providers/` 是框架唯一的 LLM 边界：所有模型调用都发往本地 [AMKR](https://github.com/Sparrived/auto-model-key-router)（`auto-model-key-router`），一个 OpenAI 兼容的本地路由服务。供应商、Key 池、故障切换、真实模型选择与采样参数全部由 AMKR 承担，框架自身不再内置任何厂商实现。

| 文件 | 职责 |
|---|---|
| `base.py` | `LLMProvider`、`AsyncLLMProvider`、`GenerationRequest` 抽象，以及多模态消息规范化 `prepare_openai_compatible_messages()`。 |
| `openai_compatible.py` | 唯一的真实实现 `OpenAICompatibleProvider`，端点固定为 `<amkr_base_url>/v1/chat/completions`。 |
| `amkr.py` | `AmkrSettings`、`load_amkr_settings()`：只解析「怎么连上 AMKR」。 |
| `amkr_sync.py` | 向 AMKR 注册任务名，以及供 WebUI 使用的只读巡检。 |
| `mock.py` | 测试用 Mock Provider。 |
| `response_utils.py` | 响应文本解析辅助。 |

框架不再包含厂商 Provider 实现、`models.dev` 模型目录、进程级 HTTP 代理配置或本地路由注册表。

## 任务名契约

核心设计：AMKR 把一个**任务名**解析成真实模型。因此框架把任务名本身填进 OpenAI 兼容请求的 `model` 字段，而不是填模型 ID。

内置 12 个任务名：`cognition_analyze`、`memory_extract`、`response_generate`、`proactive_generate`、`passive_tool`、`plugin_analyze`、`plugin_generate`、`plugin_render`、`plugin_raw`、`diary_generate`、`diary_consolidate`、`topic_cluster`。

- `model` 命中上述任务名时，框架**不发送** `temperature` 与 `max_tokens`，由 AMKR 的任务定义决定；显式传入任务已固定的参数会被 AMKR 以 400 拒绝，因此不能两边各配一份。
- `model` 不是任务名时按普通模型直连，此时采样参数仍由框架决定。
- 任务的超时与重试属于**本地传输层**关注点，由 `data/personas/<name>/engine_state/orchestration.json` 的 `task_timeout`、`task_retries` 控制，与模型无关。

多模态输入仍由框架预处理：`prepare_openai_compatible_messages()` 会把本地文件路径与 `file://` URI 转成 data URL 再发往 AMKR，AMKR 不负责这一步。

## 工作空间

AMKR 是**共享单实例**，并非多租户：多个 AI 服务可以同时使用它。隔离靠请求头 `X-AMKR-Workspace`。框架按人格划分命名空间：`<amkr_workspace>/<persona>`（例如 `sirius-pulse/sirius`），由 `workspace_for()` 拼接。

工作空间由「在里面建第一个任务」隐式产生，没有独立的「新建工作空间」步骤。请求头为空时不发送，等价于 AMKR 的默认工作空间。

## 注册策略

`amkr_sync.py` 只负责**创建缺失的任务名**：已存在的任务不比对、不修改，因为后续所有模型与参数调整都在 AMKR 自己的 WebUI 里完成。写入遵循 AMKR 的乐观并发（携带 `config_revision`），版本过期返回 409 时重读并重试一次。

主要入口：

- `register_persona_tasks()`、`register_persona_tasks_async()`：注册缺失任务。
- `collect_amkr_status()`、`inspect_persona_workspace()`、`amkr_ui_url()`：只读巡检，不创建也不修改任何任务。
- `WorkspaceState`、`SyncResult`、`AmkrError`、`AmkrAdminClient`：状态与错误模型。

## 关键协作

- 由 `EngineRuntime._build_provider()` 构建，连接配置来自 `data/global_config.json`（环境变量优先）。
- `Brain` 与 `core/model_router.py` 只说明「这是哪个任务」，不选择模型。
- WebUI 通过 `GET /api/amkr/status` 观察状态、`POST /api/amkr/register` 触发注册，见 [WebUI API](../reference/webui-api)。

## 排查建议

1. 先看 WebUI 的「AMKR 运维」页：`reachable` 为假说明地址、Key 或 AMKR 进程有问题。
2. `missing` 非空时点一次「注册任务名」；`registered` 已有名字但调用仍失败，则去 AMKR 面板确认该任务指向的模型与 Key 是否可用。
3. 返回 `401` 表示 `amkr_local_api_key` 不是 AMKR 认可的本地授权 Key——它同时是 AMKR 的管理员凭据。
4. AMKR 以 `--no-ops` 启动时，`/api/logs`、`/api/tool`、`/api/service/*`、`/api/integrations/*` 会 404，`/health` 报 `ops_enabled:false`，但任务与配置接口仍可用。
