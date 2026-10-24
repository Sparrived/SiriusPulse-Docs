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

## 编排配置热重载

运行时只读取 `engine_state/orchestration.json`，不再要求人格根目录的同名旧文件。初次启动时没有编排文件可使用默认配置。

保存合法对象后触发 `orchestration` 热重载；保存 `{}` 表示清除本地超时、重试和并发上限的配置覆盖，无需重启（调用方显式传入的引擎配置仍优先）。热重载使用同一次校验成功的配置快照，同时刷新 Brain 的路由与并发配置。文件缺失、无法读取、JSON 错误、不是对象或包含非有限数值时，保留运行中的旧配置并记录错误，不把加载失败当成“恢复默认”。WebUI 的整轮引擎重载（`all`）也先做这一检查；失败则中止本轮重载，不继续以默认配置重建引擎。
