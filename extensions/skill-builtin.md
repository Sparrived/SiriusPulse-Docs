# 内置 Skill 参考

内置 Skill 位于 `sirius_pulse/skills/builtin/`。

| 文件 | 功能 |
|---|---|
| `bash.py` | 在容器内执行标准 Bash 命令。 |
| `container_admin.py` | 通过宿主机受限代理管理宿主机的全部容器。 |
| `interaction.py` | 统一处理戳一戳、表情包和指定消息撤回。 |
| `file_upload.py` | 统一处理图片发送和文件上传。 |
| `group_management.py` | 统一处理 QQ 群管理员操作。 |
| `chat_with_developer.py` | 与开发者沟通。 |
| `desktop_screenshot.py` | 获取桌面截图。 |
| `micro_device_status.py` | 获取 developer 的 MicroDeviceStatus 公开设备状态。 |
| `github_monitor.py` | 监控 GitHub 仓库事件。 |
| `learn_term.py` | 学习术语并写入术语表。 |
| `reminder.py` | 创建提醒。 |
| `web_lookup.py` | Web 查询。 |
| `qq_member_info.py` | 查询 QQ 群成员信息。 |

## Bash

`bash` 可在整个容器文件系统中执行，`cwd` 支持容器内任意存在的目录和绝对路径。它支持标准 Bash 语法，包括管道、重定向、here-document、变量和命令替换；所有调用者均可使用。工具保留工作目录存在性校验、命令长度、执行超时和输出长度限制。

在 WebUI 的 `bash` 配置表单中调整 `max_timeout_seconds` 和 `max_output_chars`。配置保存在 `{persona}/skill_data/bash.json`，每次调用都会重新读取。

## Container Admin

`container_admin` 仅对 developer 开放，支持 `list`、`inspect`、`logs`、`start`、`stop` 和 `restart`。`list` 直接返回宿主机的全部容器，包括已停止容器。`inspect` 会保留原始容器 `State` 作为排障内容，同时查询容器 CPU、内存、网络 I/O、块 I/O、PID，以及宿主机 CPU、内存、根磁盘、负载与运行时长；Playwright 渲染状态卡片后通过 `file_upload` 立即发送到当前 QQ 群聊或私聊。卡片发送失败不会丢失排障结果。它连接 `/run/sirius-container-admin.sock`，不会获得 `/var/run/docker.sock`。宿主机代理仍以固定 Docker 参数执行操作，默认允许状态变更；设置 `allow_mutations: false` 可关闭启停重启；部署方法见 Docker 部署指南。

## Developer Status

在 WebUI 的 `developer_status` 配置表单中填写 MDS 公开状态令牌、服务基地址和请求超时。配置保存在 `{persona}/skill_data/developer_status.json`；环境变量 `MDS_PUBLIC_STATUS_TOKEN` 和 `MDS_API_BASE_URL` 仅作为未配置时的后备。
