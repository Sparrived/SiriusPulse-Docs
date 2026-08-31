# GitHub Monitor 外部 Plugin

`github_monitor` 已从核心包和内置 Tool 中移出。它现在是外部 Plugin，源码位于宿主机工作区的 `plugins/github_monitor/`，由根目录 `plugins/` Git submodule 提供。

- 不要在 `sirius_pulse/tools/builtin/` 查找、复制或注册 GitHub Monitor。
- 初始化或更新外部插件时，在宿主机项目根目录执行 `git submodule update --init --recursive`。
- 人格运行时从工作区共享的 `plugins/` 目录发现 Plugin；Docker 容器中对应路径为 `/app/plugins`。

GitHub Monitor 同时提供 `/github status`、`/github poll` 命令和由框架托管的后台轮询/Webhook 能力，因此应通过 **Plugin** 页面配置和运维，而不是作为模型自主调用的 Tool。

## 宿主机目录、配置与状态

| 内容 | 宿主机路径 | 容器路径 | 是否应进入核心镜像/PyPI |
|---|---|---|---|
| Plugin 源码与共享设置 | `plugins/`、`plugins/_config.json` | `/app/plugins` | 否 |
| 人格运行状态与监控游标 | `data/personas/<name>/plugin_data/` | `/app/data/personas/<name>/plugin_data/` | 否 |

官方 Compose 将 `./plugins` 以读写方式挂载到 `/app/plugins`。因此 WebUI 的启停和设置会写回宿主机的 `plugins/_config.json`；宿主机目录必须允许容器内 UID `10001` 写入，同时仍应由宿主机 Git 用户管理源码。部署细节见 [Docker 部署](../guide/docker-deployment)。

## 基本配置

在 WebUI 的 **Plugin** 页面启用 `github_monitor`，并在其设置中配置：

| 字段 | 说明 |
|---|---|
| `poll_seconds` | 轮询间隔，范围 30–3600 秒。 |
| `api_base_url` | GitHub REST API 地址；默认 `https://api.github.com`。 |
| `api_allowed_hosts` | 使用 GitHub Enterprise 时允许的额外主机名；只填写主机名，不填写路径或端口。 |
| `repos` | 每个仓库的 `owner`、`repo`、`mode`（`poll` 或 `webhook`）、事件类型、通知群及可选 Token 环境变量名。 |
| `webhook_host` / `webhook_port` | Webhook 本地监听地址和端口；端口为 `0` 时由系统分配。 |
| `webhook_secret_env` | 保存 Webhook HMAC Secret 的环境变量名。 |

仓库的 `events` 可选 `issues`、`pulls`、`releases`、`comments`、`pushes`。`groups` 是接收通知的群号列表；没有有效仓库或通知目标时，插件不会产生监控通知。

以下是无密钥的结构示例，展示 `plugins/_config.json` 中由 WebUI 保存的设置形态：

```json
{
  "github_monitor": {
    "enabled": true,
    "permissions": {},
    "settings": {
      "poll_seconds": 120,
      "api_base_url": "https://api.github.com",
      "webhook_secret_env": "SIRIUS_GITHUB_WEBHOOK_SECRET",
      "repos": [
        {
          "owner": "Sparrived",
          "repo": "SiriusPulse",
          "mode": "poll",
          "events": ["issues", "pulls", "releases", "comments", "pushes"],
          "groups": ["123456789"],
          "github_token_env": "SIRIUS_GITHUB_TOKEN_SIRIUS_PULSE"
        }
      ]
    }
  }
}
```

示例中的环境变量名仅为示例，并非框架自动识别的固定名称。`github_token_env` 是**每个仓库独立**的环境变量名，`webhook_secret_env` 是 Plugin 的**全局**环境变量名；两者保存的都是变量名，不是密钥本身。请把实际变量名分别填入对应字段；插件只会读取这些字段所指定、且名称合法的进程环境变量。

`api_base_url` 必须是 HTTPS 的无凭据、无查询参数 API 地址，只允许默认 HTTPS 端口；GitHub Enterprise 常用的 API 前缀（如 `/api/v3`）可以保留。使用 GitHub Enterprise 时，主机名还必须列在 `api_allowed_hosts` 中，且该列表只接受主机名，不接受路径或端口。未设置或未注入已配置的环境变量时，变量解析为空：轮询会按无 Token 请求，Webhook 则不会启动，除非明确开启仅限本机调试的无签名模式。

## 密钥与环境变量

`github_token` 和 `webhook_secret` 都是敏感值。新部署只能使用 `github_token_env` 和 `webhook_secret_env`：它们保存变量名，不保存值。WebUI 会保留掩码占位符，但拒绝将新的明文 Token 或 Webhook Secret 写入 `plugins/_config.json`。不要把 Token、Webhook Secret、Cookie 或私有 URL 提交进设置文件、示例文件或 Git 历史。

Docker Compose 的 `.env` 文件主要用于 Compose 变量替换，**不会自动把其中所有变量传入容器进程**。官方 `docker-compose.yml` 为本页示例名保留了可选的空值映射；若设置里使用其他变量名，必须在不提交的 `docker-compose.override.yml` 中显式传递相同名称，例如：

```yaml
services:
  sirius-pulse:
    environment:
      SIRIUS_GITHUB_TOKEN_SIRIUS_PULSE: ${SIRIUS_GITHUB_TOKEN_SIRIUS_PULSE}
      SIRIUS_GITHUB_WEBHOOK_SECRET: ${SIRIUS_GITHUB_WEBHOOK_SECRET}
```

随后在同一部署环境的 `.env`、系统服务 `EnvironmentFile` 或秘密管理器中提供真实值。非 Docker 部署也必须保证启动 Persona Worker 的进程环境包含这些变量；只在交互式 shell 中临时设置、再由其他服务管理器启动进程通常不会生效。修改 Docker 的环境变量映射或密钥后，必须重建或重启容器/Persona Worker；仅执行 Plugin reload 不会改变已经运行进程的环境变量。

## Webhook 安全

Webhook 监听器仅接受回环地址（如 `127.0.0.1`），并且生产环境必须配置 HMAC Secret。`allow_unsigned_local` 仅适用于本机调试，生产环境应保持关闭。

Webhook 上游地址为 `http://127.0.0.1:<webhook_port>/webhook/github`。生产环境应配置固定的非零 `webhook_port`；`0` 会动态分配端口，不适合作为反向代理的固定上游。GitHub 无法直接访问回环地址，因此应由受控的反向代理或隧道在宿主机边界转发到该地址；不要将 Plugin 监听器直接绑定到公网地址。GitHub、转发层和 Plugin 必须使用同一个 HMAC Secret。无签名模式只根据 TCP 对端是否为回环地址判断，转发头不会使代理变为受信任来源。

## Webhook 持久化与本地数据

Webhook 队列、重试进度和可重放的死信投递会按人格保存在 PluginDataStore，以实现有界的尽力而为、至少一次投递语义。持久状态可能含有原始 GitHub payload 中的仓库名称、提交/Issue/PR/评论文本、用户账号与显示信息等数据，并会保留到投递状态被修剪；可重放 body 的总量限制为 32 MiB。实现会尽力将状态文件设为 `0600`，但权限位**不是加密**，也不会保护备份、卷快照或已获主机权限的账户：请限制 `data/personas/<name>/plugin_data/` 及备份的读取权限。

每一个 Webhook `state_path` 必须只由一个 Plugin 进程/服务器拥有。当前没有跨进程共享状态锁或协调机制；多个进程指向同一路径可能互相覆盖投递、重试或死信状态，也会造成重复处理。当前也没有 WebUI 死信重放界面，管理员需通过受控运维流程处理重放。

对 GitHub API、Compare API 和截图页面的 DNS 预检只是在请求前过滤明显不安全的解析结果，**不是 socket pinning**，也不能阻止 DNS 重绑定或连接阶段改变目的地址。生产部署仍应在连接时实施出口网络控制（例如 egress 防火墙、代理 allowlist 或受限网络命名空间），只允许预期的 GitHub/GHE 主机和端口。

## 迁移现有内置 Tool 配置

首次加载时，Plugin 会尝试从下列旧版人格级文件迁移监控状态：

- `tool_data/github_monitor.json`
- `skill_data/github_monitor.json`
- `skill_data/.persona_skills.json`

迁移后的游标和运行状态保存在 `plugin_data/_plugin_github_monitor_data.json`。旧文件不会被自动删除或重写。若发现历史明文 `github_token`、`webhook_secret`，迁移会保持未完成并保留可用来源，绝不会擅自以未注入的 `*_env` 名称替换它；管理员必须先人工轮换凭据、在进程环境/秘密管理器中提供新值，并显式配置对应 `*_env` 名称。仅当来源可安全解析且没有待处理的明文凭据时才记录完成标记，避免跨文件非事务性更新造成配置丢失。

升级或滚动发布期间，不要让旧监控实例与 `github_monitor` Plugin 同时监控同一仓库，否则会产生重复通知。

## Tool 与 Plugin 的边界

GitHub Monitor 是外部 Plugin：用户通过命令和 WebUI 管理它，它维护后台任务并向群聊主动发送通知。它不是模型根据 `TOOL_META` 自主选择调用、再把 `ToolResult` 返回给模型推理的 Tool。通用边界和自定义扩展位置见 [扩展开发总览](./) 与 [Plugin 总览](./plugin-overview)。
