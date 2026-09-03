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

### Sub2API 多站监控准备

`sub2api_monitor` 使用 `sources` 数组管理多个独立站点。每站的 `subscriptions_path` 和 `group_rates_path` 都是运行时必填项，插件不绑定或硬编码任何站点/监控端点；文档和模板中的 `.invalid` URL、`/your/...` 路径只能作为占位符。`display_name` 用于通知与图表，凭据变量则由稳定 ID 派生：站点 `primary` 使用 `SUB2API_PRIMARY_EMAIL` 与 `SUB2API_PRIMARY_PASSWORD`。所有变量必须进入实际 Persona Worker 进程，Docker/Compose 部署还需在 `environment` 或 override 中显式映射；不得通过 WebUI/settings 保存密码或 token。

顶层 `notify_group_ids` 是显式通知允许列表；每站通过 `inherit_notify_group_ids` 决定是否继承，再与站点专属列表合并。`run_on_persona` 必须明确填写唯一负责所有站点的 Persona，留空会禁用后台和手动轮询。命令支持站点 ID、唯一 `display_name` 或 `all` 选择器。显式设置 `"sources": []` 会禁用全部站点，并阻止旧版顶层单站字段回退生效。

图片通知与 `/sub2api report` 需要 Playwright Chromium。官方 Docker 镜像已准备浏览器；非 Docker 环境安装 Python 依赖后还需执行：

```bash
python -m playwright install chromium
```

Linux 缺少浏览器系统库时，由有权限的部署流程执行 `python -m playwright install --with-deps chromium`。自动变化图生成失败会降级为文字通知，不影响轮询或逐群 ACK；显式 `/sub2api report` 生成失败则直接报告 Chromium/可视化错误。

旧版单站设置在没有 `sources` 键时继续使用 `SUB2API_EMAIL` / `SUB2API_PASSWORD` 和旧版顶层状态。迁移前应备份 `plugins/_config.json` 与 Persona 插件数据。首次切换到显式 `sources` 时，只有恰好一个可用目标、该目标凭据齐全且 `source_states.<id>` 尚无状态，并且旧顶层某集合的 endpoint/account/timezone 指纹与目标精确匹配，插件才把该匹配集合的 snapshot、轮询时间状态和相关 ACK 确定性迁入新状态；未匹配集合静默建立新基线。多目标、已有新状态或指纹不匹配时绝不猜测，旧顶层数据无论结果如何都保留。投递失败或未确认时会保留站点隔离的逐群 ACK，仅重试未确认群；每轮 200 次物理投递上限会按所选站点和集合公平预分配，重试顺序也会轮转，前序失败站点或群不会长期阻塞后序目标。框架确认可能只是适配器/平台已受理或确认发送，不表示用户已阅读。详细命令、迁移、安全上限与排障见 [Sub2API Monitor](https://github.com/Sparrived/SiriusPulse-Plugins/tree/master/sub2api_monitor)。

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
