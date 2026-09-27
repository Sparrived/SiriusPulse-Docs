# 人格配置参考

人格配置位于 `data/personas/<name>/`。

| 文件 | API | 说明 |
|---|---|---|
| `persona.json` | `/api/persona/persona` | 人格基础设定。 |
| `engine_state/orchestration.json` | 本地文件（引擎热重载） | 人格级编排配置：`task_timeout`、`task_retries`、`task_enabled` 等本地与回复策略参数。模型与采样参数在 AMKR 侧。 |
| `experience.json` | `/api/persona/experience` | 人格经历和背景。 |
| `adapters.json` | `/api/persona/adapters` | 平台适配器。 |
| `accounts.json` | `/api/persona/accounts` | 人格自己的外部服务账号（如 GitHub）。凭据以掩码读取，执行 Bash 时按账号注入环境变量。 |
| `persona.db` | 内部使用 | 统一数据库。 |

模型编排页面与 `/api/persona/orchestration`、`/api/persona/task-params` 已移除；模型选择、温度和最大 token 改在 AMKR 自带面板配置，见 [AMKR 接入配置参考](./provider-config)。
