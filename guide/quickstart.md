# 快速开始

## 1. 启动 WebUI

```bash
python main.py webui
```

访问 `http://127.0.0.1:8080`。也可以使用 `python main.py run` 同时启动活跃人格和 WebUI。

## 2. 创建或选择人格

```bash
python main.py persona list
python main.py persona create default
python main.py persona activate default
```

WebUI 也提供创建、启动、停止和切换人格的页面。

## 3. 配置 Provider

在 WebUI 的 Provider 页面添加模型服务。常见字段：

- `provider_type`：如 `openai_compatible`、`deepseek`、`siliconflow`、`aliyun_bailian`、`bigmodel`、`volcengine_ark`、`mimo`、`opencode`、`opencode_go`。
- `api_key`：服务密钥。
- `base_url`：OpenAI-compatible 服务地址或厂商地址。
- `models`：可用模型列表。
- `enabled`：是否启用。

## 4. 配置人格模型编排

在人格编排配置中选择 `unified_model` 或按任务配置 `task_models`、`task_temperatures`、`task_max_tokens`、`task_retries`。

## 5. 接入 QQ

NapCat 适配器示例：

```json
{
  "adapter_type": "onebot_v11_napcat",
  "ws_url": "ws://127.0.0.1:3001",
  "access_token": "",
  "enabled": true,
  "group_whitelist": []
}
```

保存后重启人格或点击 WebUI 的引擎重载。

## 6. 查看运行状态

- WebUI 仪表盘：人格状态、Token、日志和健康检查。
- API：`GET /api/monitoring/health`、`GET /api/persona/status`。
