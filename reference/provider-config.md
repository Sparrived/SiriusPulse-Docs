# Provider 配置参考

`ProviderConfig` 字段：`name`、`provider_type`、`api_key`、`base_url`、`healthcheck_model`、`enabled`、`models`、`models_url`。

`name` 是用户可修改的全局唯一 Provider 标识，不能包含 `/` 或 `\\`，模型编排使用 `name/model` 指定路由。因此相同平台、相同 API 端点但 API Key 不同的 Provider 也可以同时存在。旧版没有 `name` 的 `provider_keys.json` 会在首次加载时使用原配置键生成名称；发生重复时自动追加 `-2`、`-3` 等后缀并写回。

已有实现：`openai_compatible`、`deepseek`、`siliconflow`、`aliyun_bailian`、`bigmodel`、`volcengine_ark`、`mimo`、`mimo_tokenplan`、`ytea`、`opencode`、`opencode_go`、`mock`。

API：`GET /api/providers`、`POST /api/providers`、`POST /api/providers/probe`、`POST /api/providers/models-probe`、`GET /api/providers/proxy`、`POST /api/providers/proxy`、`POST /api/providers/refresh-models`、`GET /api/models`。

## 网络代理

全局代理配置保存在 `<config_root>/providers/proxy.json`，字段为 `http`、`https`、`no_proxy`。通过 WebUI Provider 页面的「网络代理设置」卡片维护，保存后立即对后续 Provider 请求生效（会通知各人格子进程重建 provider）；重启后由 `ProviderRegistry` 自动加载。生效范围：OpenAI 兼容请求、models 接口探测、models.dev 拉取。

## models 接口探测

`POST /api/providers/models-probe` 调用 Provider 自己的 `models` 接口探测可用模型列表并返回（WebUI 编辑卡片与添加弹窗均有「探测模型」按钮，自动合并进模型列表）：

- 请求体支持两种形态：`{"name": "<已保存 provider 名>"}`（服务端读取磁盘真实 API Key）或 `{"type", "base_url", "api_key", "models_url"}`（草稿探测，用于新建 Provider）。
- 未指定 `models_url` 时，按 `<base>/models`、`<base>/v1/models` 顺序尝试候选地址，取第一个成功响应。
- 兼容 OpenAI 风格（`data[].id`）、Ollama 风格（`models[].name`）与顶层数组等响应格式。
