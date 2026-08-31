# 安装

## 环境要求

- Python 3.12 或更高版本。
- Windows、macOS 或 Linux；当前仓库包含 `start.pyw`，更偏向 Windows 桌面双击启动场景。
- 可访问所需模型 Provider 的网络环境。
- 如需 QQ 接入，需要本地或远端 NapCat OneBot v11 WebSocket 服务。

## 获取代码

```bash
git clone https://github.com/Sparrived/SiriusPulse.git
cd SiriusPulse
git submodule update --init --recursive
```

外部插件独立维护在 [SiriusPulse-Plugins](https://github.com/Sparrived/SiriusPulse-Plugins)，作为宿主机项目根目录的 `plugins/` submodule 使用。`plugins/` 是独立维护的外部 Plugin 目录，其中可包含 `github_monitor`、`amkr_key_manager`、`sub2api_monitor` 等扩展，实际目录以固定的子模块版本为准。`github_monitor` 不属于核心包、PyPI 分发或 `sirius_pulse/tools/builtin/`；源码和 `plugins/_config.json` 留在宿主机，Docker 部署时由 Compose 挂载到 `/app/plugins`，不会进入核心镜像。详见 [GitHub Monitor 外部 Plugin](../extensions/github-monitor)。

`sub2api_monitor` 的站点与接口路径均通过运行时插件设置提供；`subscriptions_path` 和 `group_rates_path` 是必填监控路径，插件不绑定或硬编码任何站点/监控端点。使用 `SUB2API_EMAIL` 与 `SUB2API_PASSWORD` 作为启动 Sirius Pulse 进程的凭据，密码不得通过 WebUI 或 settings 保存。`notify_group_ids` 是显式通知允许列表；`run_on_persona` 必须明确填写唯一轮询 Persona，留空会禁用后台轮询和 `/sub2api poll`。首次快照和监控来源改变时都静默；失败或未确认投递的逐群 ACK 会保留并在后续轮询重试，且框架确认仅可能表示适配器/平台已受理或确认发送，不表示最终用户已阅读。详细配置见仓库中的 `plugins/sub2api_monitor/README.md`。

## 安装依赖

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e .
```

开发依赖：

```bash
pip install -e ".[dev]"
```

## 文档站点

`docs/` 是独立 VitePress 站点：

```bash
cd docs
npm install
npm run dev
```

## 首次启动

```bash
python main.py webui
```

默认 WebUI 监听 `0.0.0.0:8080`。首次运行会自动创建 `data/global_config.json` 和默认数据目录。
