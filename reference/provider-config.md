# Provider 配置参考

`ProviderConfig` 字段：`provider_type`、`api_key`、`base_url`、`healthcheck_model`、`enabled`、`models`、`models_url`。

已有实现：`openai_compatible`、`deepseek`、`siliconflow`、`aliyun_bailian`、`bigmodel`、`volcengine_ark`、`mimo`、`ytea`、`mock`。

API：`GET /api/providers`、`POST /api/providers`、`POST /api/providers/probe`、`POST /api/providers/refresh-models`、`GET /api/models`。
