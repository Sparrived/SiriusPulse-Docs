# 全局配置参考

位置：`data/global_config.json`。

```json
{
  "active_persona": "default",
  "webui_host": "0.0.0.0",
  "webui_port": 8080,
  "napcat_install_dir": "napcat",
  "log_level": "INFO",
  "max_sentence_chars": 20,
  "amkr_base_url": "http://127.0.0.1:8000",
  "amkr_local_api_key": "",
  "amkr_workspace": "sirius-pulse",
  "amkr_public_url": "",
  "amkr_ui_enabled": true
}
```

API：`GET /api/global-config`、`POST /api/global-config`。

AMKR 相关的字段详见 [AMKR 接入配置参考](./provider-config)；`amkr_local_api_key` 是 AMKR 的管理员凭据，WebUI API 只回显掩码（`amkr_panel_keys` 则整字段不回显）。

## 启动环境变量

以下变量由启动进程直接读取，适用于快速测试、Docker 部署或覆盖默认服务地址：

| 变量 | 用途 |
|---|---|
| `SIRIUS_AMKR_BASE_URL`、`SIRIUS_AMKR_API_KEY`、`SIRIUS_AMKR_WORKSPACE`、`SIRIUS_AMKR_PUBLIC_URL` | 覆盖 `global_config.json` 中的 AMKR 连接配置，环境变量优先。 |
| `SIRIUS_EMBEDDING_URL` | 共享 Embedding 服务地址，默认 `http://127.0.0.1:18900`。 |
| `SIRIUS_CONTAINER_ADMIN_SOCKET` | `bash` 使用的容器管理代理 Socket；未设置时使用安全占位路径。 |
| `SIRIUS_PULSE_HOME`、`SIRIUS_PULSE_FILE_ROOT` | 工作区和文件访问根目录的运行时约定。 |

环境变量必须注入实际启动 WebUI/Persona Worker 的进程。Docker Compose 的 `.env` 只负责变量替换；需要在服务的 `environment` 或 `env_file` 中显式传递。密钥变量不应写入 Git。AMKR 变量的详细说明见 [配置指南](../guide/configuration)。
