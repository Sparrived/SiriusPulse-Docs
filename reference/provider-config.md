# AMKR 接入配置参考

Sirius Pulse 不再有 Provider 注册表。所有模型调用都发往本地 [AMKR](https://github.com/Sparrived/auto-model-key-router)（`auto-model-key-router`，OpenAI 兼容路由），框架只保存「怎么连上它」。

## 连接配置

位置：`data/global_config.json`。

| 字段 | 默认值 | 说明 |
|---|---|---|
| `amkr_base_url` | `http://127.0.0.1:8000` | AMKR 地址，**供本框架的服务端进程访问**。请求发往 `<base_url>/v1/chat/completions`。 |
| `amkr_local_api_key` | 空 | AMKR 的本地授权 Key，**与 AMKR 自带面板的管理员凭据是同一个**，可增删供应商与 Key，因此只保存在服务端。**只用于管理操作**（建空间、注册任务名），不用于模型调用。 |
| `amkr_workspace` | `sirius-pulse` | 本应用在共享 AMKR 中的命名空间前缀。 |
| `amkr_public_url` | 空 | AMKR 地址，**供用户的浏览器访问**（运维页外链与内嵌面板）。留空且 `amkr_base_url` 为回环时走本框架的同源反代 `/amkr/`。见下方「两个地址」。 |
| `amkr_ui_enabled` | `true` | WebUI 全局设置里的「启用 AMKR 自带 WebUI」开关。 |
| `amkr_panel_keys` | `{}` | `{工作空间: 面板 key}`（`amkr_ws_…`），建空间时自动写入。用于嵌入式面板。 |
| `amkr_inference_keys` | `{}` | `{工作空间: 推理 key}`（`amkr_ik_…`），建空间时自动写入。**模型调用用的就是它。** |

`amkr_local_api_key` 在 WebUI API 响应中被脱敏为 `sk-a****`；提交脱敏值时服务端保留磁盘上的原值，不会把掩码写回配置。`amkr_panel_keys` 与 `amkr_inference_keys` 则**整字段都不回显**——它们都是明文凭据映射，而那个接口任何已登录用户都能读。

### 两把按空间签发的凭据

工作空间在 AMKR 侧**显式创建**，创建的那一刻是拿到两把凭据的唯一时机（之后 AMKR 不再重发）。两把都由 AMKR 生成并自动存入上面的两个字段：

| 凭据 | 前缀 | 用途 | Sirius 里从哪取 |
|---|---|---|---|
| 面板 key | `amkr_ws_` | 嵌入式工作空间面板：读写**该空间**的任务与读数 | `GET /api/amkr/panel?persona=`（仅管理员） |
| 推理 key | `amkr_ik_` | `/v1` 模型调用 | 引擎内部读取，**不经任何接口回显**；轮换时随 `POST /api/amkr/rotate-inference-key` 的响应回一次 |

两者**互不通用**：面板 key 调 `/v1` 会被 `401`，推理 key 调 `/api/*` 同样 `401`。

**模型调用只用推理 key，不用 `amkr_local_api_key`。** 后者能增删供应商与 Key，把它放进每次对话补全的请求头等于让推理路径随时可以升级成管理操作。推理 key 被 AMKR 钉死在**单个工作空间**上：请求头 `X-AMKR-Workspace` 在它生效时会被忽略，因此一把泄漏的推理 key 换不来别的空间，也做不了管理操作。

因此**推理 key 缺失时引擎不就绪**——不会回落到管理员凭据。这会在 `POST /api/amkr/register` 时自动补上（建空间一并发放）。若空间建于该能力之前（或从只含面板 key 的备份恢复），本地只有面板 key 而推理 key 已无法取回，唯一补救是轮换：

```bash
# 换一把推理 key（不影响面板 key）。旧 key 立即失效。
curl -X POST http://127.0.0.1:8080/api/amkr/rotate-inference-key \
  -H "Authorization: Bearer <你自己的 WebUI 管理员凭据>" \
  -H "Content-Type: application/json" \
  -d '{"persona": "sirius"}'
```

WebUI 的「AMKR 运维」页也提供这个按钮（标在缺凭据的人格上）。轮换后本框架会自动让该人格重建 provider，无需手动重启。

### 两个地址：服务端 vs 浏览器

`amkr_base_url` 是**容器/服务端**怎么连 AMKR，`amkr_public_url` 是**用户浏览器**怎么连同一个 AMKR：

- 容器与 AMKR 同机时，服务端走回环最省事（`http://127.0.0.1:8000`），但回环地址在用户浏览器里指向**用户自己的机器**，外链与面板 iframe 都会直接失败；
- AMKR 在**别的机器**上、且浏览器能直连它时，把 `amkr_public_url` 填成那个浏览器可达的地址（通常是反代域名）。

两者都留空、或 `amkr_base_url` 本身就是回环（`127.0.0.1` / `localhost` / `::1`）时，面板走**本框架自己的同源反代路径 `/amkr/`**，无需任何外部配置：

```
浏览器 ──► https://<本框架域名>/amkr/ui/panel.html#k=<面板 key>
                    │
                    └─ 反代剥掉 /amkr 前缀 ──► http://127.0.0.1:8000/ui/panel.html
```

这条路径由 WebUI 直接提供（`sirius_pulse/webui/amkr_proxy.py`），因此**同机部署不需要给 AMKR 单独申请域名或证书**。面板能适配子路径是因为 AMKR 的 `apiBase()` 从 `location.pathname` 里截取 `/ui/` 之前的前缀，于是它会把请求发到 `/amkr/api/...`。

反代**不注入任何密钥**，透传浏览器带来的 `Authorization`：面板从 URL fragment 取自己的**面板 key**（`#k=amkr_ws_…`）并逐条请求带上，所以面板天然免输入，且拿到的只是一把只对自己空间有效的受限凭据。反过来，若在反代里替浏览器注入 `amkr_local_api_key`，就等于开出一条**无需本框架认证即可管理整个 AMKR** 的同源路径。因此该路径只放行面板用得到的 `/ui/*`、`/health` 与 `/api/tasks`，其余（`/api/providers`、`/api/settings`、`/api/logs`、`/docs` 等）一律 `403`——管理面请直接访问 AMKR 自身地址并携带管理员 key。

> 自己动手反代的话也必须让面板与接口**同源**：AMKR 不发送任何 CORS 头，跨源直连会被浏览器同源策略挡下。把 AMKR 挂在自己域名下的一个路径（nginx/Caddy 反代），而不要指望跨源。

环境变量优先于配置文件：

| 环境变量 | 覆盖 |
|---|---|
| `SIRIUS_AMKR_BASE_URL` | `amkr_base_url` |
| `SIRIUS_AMKR_API_KEY` | `amkr_local_api_key` |
| `SIRIUS_AMKR_WORKSPACE` | `amkr_workspace` |
| `SIRIUS_AMKR_PUBLIC_URL` | `amkr_public_url` |

`amkr_local_api_key` 还支持间接写法：`env:变量名`，或「全大写且不含空格的名字」也会先当作环境变量名解析，取不到再按字面量处理。

旧的 `SIRIUS_PROVIDER_TYPE`、`SIRIUS_API_KEY`、`SIRIUS_BASE_URL`、`SIRIUS_MODEL`、`SIRIUS_PROVIDER_NAME` 已全部移除。

## 任务名契约

AMKR 把**任务名**解析成真实模型，因此框架把任务名直接填进 `model` 字段。内置 13 个任务名：

`cognition_analyze`、`memory_extract`、`response_generate`、`work_mode_generate`、`proactive_generate`、`passive_tool`、`plugin_analyze`、`plugin_generate`、`plugin_render`、`plugin_raw`、`diary_generate`、`diary_consolidate`、`topic_cluster`

`work_mode_generate` 专供工作模式：默认不启用（工作模式沿用本回合原本的任务名），在 WebUI 的 **分析 → 工作模式** 页面把"工作期间使用的模型"选成它，再在 AMKR 面板里把它指向想要的模型即可。

- `model` 命中任务名时，框架**不发送** `temperature` 与 `max_tokens`，模型选择、温度、最大 token 和故障切换都取 AMKR 任务定义里的值。
- `model` 不是任务名时按普通模型直连，采样参数由框架给出。任务名必须与 AMKR 工作空间里的任务同名，否则 AMKR 会把它当成真实模型去查找并失败。
- 每个任务在本地的超时与重试写在 `data/personas/<name>/engine_state/orchestration.json` 的 `task_timeout` / `task_retries`，属于传输层参数。

## 工作空间与隔离

AMKR 是共享单实例，允许多个 AI 服务同时使用，**不是多租户**。隔离靠**凭据本身**：模型调用用该空间的推理 key，AMKR 据此决定请求落在哪个空间，请求头 `X-AMKR-Workspace` 在推理 key 生效时**会被忽略**（框架仍发送它，仅为兼容旧版 AMKR）。空间名按人格拼接为 `<amkr_workspace>/<persona>`（例如 `sirius-pulse/sirius`）。

工作空间由框架**显式创建**（`POST /api/workspaces`），不再靠「建第一个任务」隐式产生：创建的那一刻是拿到该空间**两把凭据**的唯一时机，之后 AMKR 不再返回它们，因此顺序必须是**先建空间拿凭据，再注册任务**。引擎构建同理：**先备齐凭据再建 provider**——否则全新安装上 provider 永远拿不到推理 key。

若空间已在 AMKR 侧存在而本地没有 key，AMKR 只返回 409 且不会重发 key——注册会报错并提示去读 AMKR 配置文件的 `workspaces.<空间>.api_key`（面板 key）与 `workspaces.<空间>.inference_key`（推理 key），或删掉该空间后重建。

## 注册策略

框架**只创建缺失的任务名**，已存在的一律不比对、不更新——后续所有模型与参数调整都在 AMKR 自带 WebUI 里完成，避免每次启动把运维调好的配置打回去。注册是幂等的，可以重复触发。

注意：任务名**不受** AMKR 侧空间 `models` 直呼白名单的限制（任务自己固定的模型就是该空间被授权用的），但写成普通模型名直呼时必须落在白名单内。

## API

- `GET /api/amkr/status`：只读。返回 `configured`、`base_url`、`workspace_base`、`ui_url`、`reachable`、`version`、`ops_enabled`、`webui_mounted`、`known_tasks`，以及每个人格的 `{persona, workspace, registered[], missing[], error, panel_ready, inference_ready}`。**不含**任何 key 或面板地址，只报「有没有」。
- `GET /api/amkr/panel?persona=<名字>`：**仅管理员**（非 admin 返回 403）。返回 `{"persona", "url"}`，`url` 是可嵌入的 AMKR 工作空间面板地址（fragment 内是明文面板 key）；该人格没有 key 时返回 409 并说明补救路径。
- `POST /api/amkr/rotate-inference-key`：**仅管理员**（非 admin 返回 403）。请求体 `{"persona": "..."}`，为该人格的空间换一把推理 key，返回 `{"persona", "inference_key"}` —— **明文只回这一次**。旧 key 立即失效，**不影响面板 key**；轮换后框架自动给该人格写 `provider` 重载标志重建 provider。用于空间建于该能力之前（本地只有面板 key）或凭据疑似泄漏。
- `POST /api/amkr/register`：建出工作空间（含取两把凭据）并补齐缺失任务名。请求体 `{"persona": "..."}` 指定单个人格，`{}` 表示全部人格。
- `GET /api/models`：仍然存在，但 `available_models` / `model_choices` 返回的是上述 13 个任务名（含中文标签），不再是厂商模型列表。

`/api/providers`、`/api/providers/probe`、`/api/providers/refresh-models`、`/api/providers/models-probe`、`/api/providers/proxy` 已全部移除，代理配置与 `data/providers/proxy.json` 也不再存在。

## 相关配置

- 全局配置的其余字段见 [全局配置参考](./global-config)。两把凭据分别存在 `amkr_panel_keys` 与 `amkr_inference_keys`（都是 `{工作空间: key}`），两个字段都**不随 `GET /api/global-config` 回显**。
- WebUI 的「AMKR 运维」页报告连通性与注册状态，并可就地嵌入所选人格的工作空间面板；Sirius Pulse 内**没有**模型或采样参数编辑入口——面板本身就是 AMKR 的页面。
- AMKR 应绑定 `127.0.0.1` 或内网地址；Sirius Pulse 的 `docker-compose.yml` 使用 `network_mode: host`，因此 `http://127.0.0.1:8000` 能直接到达 AMKR。但**面板是浏览器直接连 AMKR 的**：若 AMKR 地址是回环地址，只有从部署机本机打开运维页才加载得出来，远程访问请用同源反向代理。
