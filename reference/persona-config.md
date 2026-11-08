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

## 群里的主动

她的自主性主要放在不打扰别人的地方：自己的生活与项目、和主人的私聊（见 [内置工具 · autonomy](../extensions/tool-builtin)）。群里的主动只有一条很窄、有额度的通道，现有的"要不要接话"逻辑不变。

`experience.json` 里的两个键控制档位：

| 键 | 默认 | 说明 |
|---|---|---|
| `initiative_level` | `normal` | 人格默认档位：`off` / `quiet` / `normal`。 |
| `group_initiative_levels` | `{}` | 按群覆盖，例如 `{"123456": "quiet"}`；未知档位会被忽略。 |

| 档位 | 每天 | 每小时 |
|---|---|---|
| `normal` | 8 | 2 |
| `quiet` | 3 | 1 |
| `off` | 0 | 0 |

目前唯一的群内主动是**惦记的事，等对方出现时顺势问一句**：人物印象里记着某人要面试、要考试，日子到了、对方自己在群里冒头时，她等 45–120 秒后可能借这个机会问一句（也可能决定不问，输出 `[SKIP]`）。同一件事只安排一次，问过就在印象里记下 `asked_at`，之后只提示她"已经问过了"。

以下情况她不会主动：对方是别的 Bot；她已经和群里说上话了（交给正常回复）；群里正热闹（5 分钟内 4 个不同的人在说话，或 3 分钟内 10 条消息）；她睡着了或在工作模式里；额度用完。连续两次主动没人接，当天额度减半，直到有人接话；有人叫着她说「别吵」「安静点」「闭嘴」之类，这个群立刻静默 2 小时。账本在 `engine_state/initiative.json`，重启后仍然有效。

此外，有戳一戳或表情包可用时，回复规范会告诉她：只戳一下、只发个表情包也是完整的回应，不必非要配一句话。
