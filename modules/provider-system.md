# AMKR 接入模块

## 位置

`sirius_pulse/providers/`

## 职责

`providers/` 是框架唯一的 LLM 边界：所有模型调用都发往本地 [AMKR](https://github.com/Sparrived/auto-model-key-router)（`auto-model-key-router`），一个 OpenAI 兼容的本地路由服务。供应商、Key 池、故障切换、真实模型选择与采样参数全部由 AMKR 承担，框架自身不再内置任何厂商实现。

| 文件 | 职责 |
|---|---|
| `base.py` | `LLMProvider`、`AsyncLLMProvider`、`GenerationRequest` 抽象，以及多模态消息规范化 `prepare_openai_compatible_messages()`。 |
| `openai_compatible.py` | 唯一的真实实现 `OpenAICompatibleProvider`，对话端点固定为 `<amkr_base_url>/v1/chat/completions`；图像请求走 `/v1/images/generations` 与 `/v1/images/edits`。 |
| `amkr.py` | `AmkrSettings`、`load_amkr_settings()`：只解析「怎么连上 AMKR」。 |
| `amkr_sync.py` | 向 AMKR 注册任务名，以及供 WebUI 使用的只读巡检。 |
| `mock.py` | 测试用 Mock Provider。 |
| `response_utils.py` | 响应文本解析辅助。 |

框架不再包含厂商 Provider 实现、`models.dev` 模型目录、进程级 HTTP 代理配置或本地路由注册表。

## 任务名契约

核心设计：AMKR 把一个**任务名**解析成真实模型。因此框架把任务名本身填进 OpenAI 兼容请求的 `model` 字段，而不是填模型 ID。

内置 13 个任务名：`cognition_analyze`、`memory_extract`、`response_generate`、`work_mode_generate`、`proactive_generate`、`plugin_analyze`、`plugin_generate`、`plugin_render`、`plugin_raw`、`passive_tool`、`autonomy_generate`、`image_generate`、`fallback_generate`。其中 `work_mode_generate` 供工作模式使用、`autonomy_generate` 供自主行为回合使用，都可以在 AMKR 面板里单独指向另一个模型；`image_generate` 专供生图工具，必须绑一个生图模型；`fallback_generate` 是内容策略拦截时的兜底通道，应绑一个不受 Google/Gemini 内容过滤影响的模型（原因见下文）。

- 框架**从不发送** `temperature` 与 `max_tokens`：`GenerationRequest` 已不含这两个字段，请求体里只有 `model` 与消息等必要内容。模型选择与采样参数都由 AMKR 的任务定义决定，取值的权威只在 AMKR 一侧。
- 命中任务名时 `model` 就是任务名本身，由 AMKR 查表换成真实模型；任务名必须与 AMKR 工作空间里的任务同名，否则 AMKR 会把它当成真实模型去查找并失败。`ModelRouter.resolve()` 也不会为未登记的任务名回退或另选模型，只会借用兜底任务的本地超时 / 重试。
- 框架只**创建**任务名，模型与参数由 AMKR 决定。新建的任务模型为空，在运维于面板里绑定模型之前，调用它会 404——「已登记」不等于「已配好」。
- 任务的超时与重试属于**本地传输层**关注点，由 `data/personas/<name>/engine_state/orchestration.json` 的 `task_timeout`、`task_retries` 控制，与模型无关。

多模态输入仍由框架预处理：`prepare_openai_compatible_messages()` 会把本地文件路径与 `file://` URI 转成 data URL 再发往 AMKR，AMKR 不负责这一步。

## 传输方式：统一流式

所有模型调用都以**流式**发出（请求体 `stream: true`）：`OpenAICompatibleProvider` 在本地把 SSE 增量聚合成完整结果，`Brain` 等调用方拿到的仍是一次完整的 `GenerationResult`（正文、`reasoning_content`、`tool_calls`、`finish_reason` 与真实 `usage`）。

这样做是为了可靠性而不是逐字展示：CPA 这类上游在「非流式整段聚合」路径上经常返回 `200` 空响应，流式逐块转发绕开了那条路径；长生成也不再受「整个请求超时」限制，只有块间静默超过超时才算失败。请求同时带 `stream_options: {"include_usage": true}`，否则流式响应默认不带用量、token 记账会退化成估算。个别网关忽略 `stream` 直接回 JSON 时，provider 仍按整段响应解析（兼容回退）。

## 内容策略拦截与兜底任务

Gemini 经 CPA 的 `antigravity` 通道会这样失败：prompt 命中 Google 的 Prohibited Use 策略后，上游仍回 `HTTP 200`、没有 error 事件、`usage` 全 0，正文就是一句拒绝文案（"The prompt could not be submitted…"）。它形态上是一次成功完成，所以 CPA 不会报错、AMKR 不会重试也不会触发任务备选；不处理就会被当成模型回复发进群（线上真实事故：10 月 19 日至少 8 次把这条报错发进群）。

处理分两层：

1. `OpenAICompatibleProvider` 在流式聚合与 JSON 回退两条路径上都检查正文，命中固定标记（`the prompt could not be submitted` / `prompt contains sensitive words` / `generative ai prohibited use policy`）就抛 `ProviderContentFilteredError`（`error_code=PROVIDER_CONTENT_FILTERED`，不可重试），并清空本轮的 `usage`。
2. `Brain._call_with_retry()` 识别该异常后，把请求的 `model` 换成任务配置里的 `fallback_model_name`（默认 `fallback_generate`）重发一次。按原任务重试没有意义——拦的是 prompt 本身；换到另一个供应商的模型才能把这一轮救回来。兜底也失败时抛异常，由调用方丢弃本轮：**宁可这一轮不回复，也不能把拦截文案发出去**。

`ModelRouter` 给四个跑 Gemini 的任务（`response_generate`、`work_mode_generate`、`proactive_generate`、`autonomy_generate`）配了同一个兜底任务名。兜底任务和其他任务一样只登记名字，**必须在 AMKR 面板里绑定一个非 Google 模型**（生产为 `deepseek-v4.1-flash`），否则命中拦截时会 404，等于没有兜底。token 记录里的 `model` 会如实写成 `fallback_generate`，便于从用量侧看出兜底被用了几次。

## 图像端点

图片生成由**同一个** `OpenAICompatibleProvider` 负责（`generate_image_async`），只是把端点换成 AMKR 的图像面：

| 场景 | 端点 | 请求体 |
|---|---|---|
| 无参考图 | `POST <amkr_base_url>/v1/images/generations` | JSON：`model`（任务名）+ `prompt` |
| 有参考图 | `POST <amkr_base_url>/v1/images/edits` | JSON：`model`（任务名）、`prompt`、`images: [{"image_url": "data:image/png;base64,…"}]` |

- `model` 仍是任务名（`image_generate`），不是真实模型 ID。工作空间的推理 key 同样适用于图像端点，管理员 key（`amkr_local_api_key`）不参与。
- 图像请求**不走流式**：生图天然是"一次请求、一次整张返回"，所以这里是普通 JSON 响应。返回的 `data[0]` 优先取内联 `b64_json`，没有时回退下载 `url`；媒体类型按字节魔数判定，不信任文件名后缀。
- 带参考图时把图片编成 data URL 放进 `images[].image_url`，这是生图上游（ChatGPT 图像风格）的约定。**不要**改回 OpenAI 经典的 multipart 表单：AMKR 只从表单里读 `model` 做路由，然后按字节原样转发，表单里的 `model` 仍是任务名，上游会以「images endpoint requires an image model」400 拒绝；JSON 形态才会被 AMKR 正常改写 `model`。
- 图像请求还固定携带一个常见浏览器 `User-Agent`：生图上游套着 Cloudflare 校验，默认 httpx/python UA 会被 403（error code 1010）拦掉，而 AMKR 会把客户端请求头原样转发给上游——这一层只能在客户端补。

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

`ui_url` 默认是**本框架自己源上的反代路径** `/amkr/ui`（见下）。凭据必须在 **fragment** 里：fragment 不会被浏览器发给服务端，因此既不进 `Referer`，也不进 AMKR 或任何反向代理的访问日志。运维页按需取该地址再塞进 iframe；AMKR 未设 `X-Frame-Options` 与 CSP `frame-ancestors`，嵌入是它设计的用法。

AMKR **不发 CORS 头**，因此面板页与它所调的接口必须同源。同机部署（`amkr_base_url` 为回环、`amkr_public_url` 留空）下，WebUI 自己在 `/amkr/` 上做这个反代（`webui/amkr_proxy.py`）：剥掉 `/amkr` 前缀转发给 AMKR，并改写上游的绝对跳转。面板因此与运维页同源，不必再给它配域名或证书。

反代**不注入密钥**，透传浏览器带来的 `Authorization`——面板用自己的面板 key 取数，天然免输入。这也是一条免本框架 JWT 的路径（iframe 是独立文档，带不了 JWT），所以它只放行面板用得到的 `/ui/*`、`/health` 与 `/api/tasks`，其余一律 403。**不要**在这里注入 `amkr_local_api_key`：那等于开出一条无需本框架认证即可增删供应商与 Key 池的同源路径。

AMKR 在别的机器上、且浏览器能直连它时，用 `amkr_public_url` 显式指定浏览器侧地址，此时不经过本框架反代（该地址必须自己保证与面板同源）。

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
