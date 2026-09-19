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

AMKR 是**共享单实例**，并非多租户：多个 AI 服务可以同时使用它。隔离靠**凭据本身**——模型调用发的是该空间的推理 key，AMKR 据此决定请求落在哪个空间，请求头 `X-AMKR-Workspace` 在推理 key 生效时**被忽略**（框架仍发送它，仅为兼容旧版 AMKR）。框架按人格划分命名空间：`<amkr_workspace>/<persona>`（例如 `sirius-pulse/sirius`），由 `workspace_for()` 拼接。

工作空间由框架**显式创建**（`POST /api/workspaces`），不再靠「建第一个任务」隐式产生。原因是创建的那一刻是拿到该空间**两把凭据**的唯一时机——之后 AMKR 的目录与导出都刻意剥掉它们。因此顺序是**先建空间拿凭据，再注册任务**；引擎构建同理，**先备齐凭据再建 provider**，否则全新安装上 provider 永远拿不到推理 key。

若空间已在 AMKR 侧存在而本地没有 key，AMKR 只返回 409 且不会重发 key：注册会报错并提示去读 AMKR 配置文件的 `workspaces.<空间>.api_key`（面板 key）与 `workspaces.<空间>.inference_key`（推理 key），或删掉该空间后重建。

## 两把按空间签发的凭据

工作空间创建时一并发放两把凭据，**互不通用**：

| 凭据 | 前缀 | 用途 | Sirius 里从哪取 |
|---|---|---|---|
| 面板 key | `amkr_ws_` | 嵌入式工作空间面板（读写本空间任务与读数） | `GET /api/amkr/panel?persona=`（仅管理员） |
| 推理 key | `amkr_ik_` | `/v1` 模型调用 | 引擎内部读取，不经接口回显；轮换时随响应回一次 |

**模型调用只用推理 key，不用 `amkr_local_api_key`**：后者是能增删供应商与 Key 的管理员凭据，放进每次对话补全的请求头等于让推理路径随时可以升级成管理操作。推理 key 被 AMKR 钉死在单个空间上，因此它**缺失时引擎不就绪，且绝不回落**到管理员凭据——回落会把一个配置疏漏静默变成一次越权。补救是轮换（空间建于该能力之前时本地只有面板 key，而推理 key 已无法取回）：

```bash
curl -X POST http://127.0.0.1:8080/api/amkr/rotate-inference-key \
  -H "Authorization: Bearer <WebUI 管理员凭据>" \
  -H "Content-Type: application/json" -d '{"persona": "sirius"}'
```

轮换**只换推理 key**，不影响面板 key 与已嵌入的面板；旧 key 立即失效，因此接口会接着给该人格写 `provider` 重载标志重建 provider。

## 面板 key 与嵌入

面板 key 是一把**只对该工作空间有效**的受限凭据：能读写本空间的任务与读数，看不到别的空间，也不能用 `/v1/*` 代理面。

它存在 `data/global_config.json` 的 `amkr_panel_keys`（`{工作空间: key}` 明文映射，只为服务端持有）；推理 key 同样形状地存在 `amkr_inference_keys`。两个字段都**绝不随 `GET /api/global-config` 回显**——那个接口任何已登录用户都能读。面板地址只从管理员专用的 `GET /api/amkr/panel?persona=` 取，形如：

```
<ui_url>/panel.html#k=<面板 key>
```

凭据必须在 **fragment** 里：fragment 不会被浏览器发给服务端，因此既不进 `Referer`，也不进 AMKR 或任何反向代理的访问日志。运维页按需取该地址再塞进 iframe；AMKR 未设 `X-Frame-Options` 与 CSP `frame-ancestors`，嵌入是它设计的用法。

注意 AMKR **不发 CORS 头**：若面板页与接口不同源，浏览器会挡下请求。远程访问应把 AMKR 挂到同一域名下的路径（反向代理），而不是期待跨源直连。

## 注册策略

`amkr_sync.py` 只负责**创建缺失的任务名**：已存在的任务不比对、不修改，因为后续所有模型与参数调整都在 AMKR 自己的 WebUI 里完成。写入遵循 AMKR 的乐观并发（携带 `config_revision`），版本过期返回 409 时重读并重试一次。

主要入口：

- `ensure_persona_workspace_key()`：建出工作空间并保存**两把**凭据（已存过则直接返回）。
- `rotate_persona_inference_key()`：换一把推理 key 并存下来（不影响面板 key）。
- `register_persona_tasks()`、`register_persona_tasks_async()`：先确保空间存在，再注册缺失任务。
- `collect_amkr_status()`、`inspect_persona_workspace()`、`amkr_ui_url()`、`persona_panel_url()`：只读巡检与面板地址，不创建也不修改任何任务。
- `WorkspaceState`、`WorkspaceCredentials`、`SyncResult`、`AmkrError`、`AmkrAdminClient`：状态与错误模型。

## 关键协作

- 由 `EngineRuntime._build_provider()` 构建，连接配置来自 `data/global_config.json`（环境变量优先）；凭据取该人格空间的**推理 key**，缺失时返回 `None`（不就绪）。
- `Brain` 与 `core/model_router.py` 只说明「这是哪个任务」，不选择模型。
- WebUI 通过 `GET /api/amkr/status` 观察状态、`POST /api/amkr/register` 触发注册、`GET /api/amkr/panel` 取面板地址、`POST /api/amkr/rotate-inference-key` 轮换推理凭据，见 [WebUI API](../reference/webui-api)。

## 排查建议

1. 先看 WebUI 的「AMKR 运维」页：`reachable` 为假说明地址、Key 或 AMKR 进程有问题。
2. `missing` 非空时点一次「注册任务名」；`registered` 已有名字但调用仍失败，则去 AMKR 面板确认该任务指向的模型与 Key 是否可用。
3. 返回 `401` 表示 `amkr_local_api_key` 不是 AMKR 认可的本地授权 Key——它同时是 AMKR 的管理员凭据。
4. AMKR 以 `--no-ops` 启动时，`/api/logs`、`/api/tool`、`/api/service/*`、`/api/integrations/*` 会 404，`/health` 报 `ops_enabled:false`，但任务与配置接口仍可用。
