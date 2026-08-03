# 内置 Tool 参考

内置 Tool 位于 `sirius_pulse/tools/builtin/`。

| 文件 | 功能 |
|---|---|
| `bash.py` | 在当前容器内执行标准 Bash 命令，并通过代理管理其他容器。 |
| `group_file_exec.py` | 统一处理图片发送、文件上传，以及群文件列表读取和下载。 |
| `group_management.py` | 统一处理 QQ 群管理员操作。 |
| `interaction_with_master.py` | 与主人沟通并查询主人的公开设备状态。 |
| `desktop_screenshot.py` | 获取桌面截图。 |
| `github_monitor.py` | 监控 GitHub 仓库事件。 |
| `learn_term.py` | 学习术语并写入术语表。 |
| `reminder.py` | 创建提醒。 |
| `web_lookup.py` | Web 查询。 |
| `qq_member_info.py` | 查询 QQ 群成员信息。 |

## Bash

`bash` 是当前 Sirius 容器内的真实 Bash：`cwd` 支持容器内任意存在的目录和绝对路径，命令按当前进程身份执行，不再有命令白名单或工作区边界。它支持标准 Bash 语法，包括管道、重定向、here-document、变量和命令替换；所有调用者均可使用。工作目录、命令长度、执行超时和输出长度限制只用于保护服务稳定性，不改变容器内权限。

在 WebUI 的 `bash` 配置表单中调整 `max_timeout_seconds` 和 `max_output_chars`。配置保存在 `{persona}/tool_data/bash.json`，每次调用都会重新读取。

每个人格的运行时目录是 `{persona}/runtime/`，位于持久化的 `/app/data` 下。Bash 会自动加入运行时 `bin` 和 npm 全局 `bin`，并设置 `SIRIUS_RUNTIME_ROOT`、`SIRIUS_RUNTIME_BIN`、`PIP_TARGET`、`NPM_CONFIG_PREFIX`、`PIP_CACHE_DIR` 和 `NPM_CONFIG_CACHE`。运行时安装的 Python 包、npm 全局包和放入 `$SIRIUS_RUNTIME_BIN` 的用户态二进制会在容器重建后保留，例如：

```bash
python -m pip install --target "$PIP_TARGET" httpx
npm install -g prettier
curl -fsSL "$TOOL_URL" -o "$SIRIUS_RUNTIME_BIN/tool"
chmod +x "$SIRIUS_RUNTIME_BIN/tool"
```

系统包仍由当前容器发行版决定；本镜像是 Debian 系列，使用 `apt`，不是宿主机 CentOS 的 `yum`。当前服务用户不是 root，但可通过受控的 `docker exec --user root` 安装。需要持久化的包名按“一行一个包”写入全局的 `/app/data/runtime-packages/apt.txt`（CentOS/RHEL 容器则写入 `yum.txt`），更新脚本会在重建并通过健康检查后自动恢复：

```bash
docker exec --user root sirius-pulse-v2-test apt-get update
docker exec --user root sirius-pulse-v2-test apt-get install -y jq
printf '%s\n' jq >> /app/data/runtime-packages/apt.txt
```

清单只接受包名和整行 `#` 注释，不接受 `apt-get`、`yum` 参数或命令；系统包是整个容器共享的，不属于某个人格。

## Docker Bridge

`bash` 中的 `docker` 和 `docker-compose` 仍连接 `/run/sirius-container-admin.sock`，不会获得 `/var/run/docker.sock`。代理接受常规 Docker 命令和完整 `docker exec`，所以可以在其他容器内使用其正常 shell、读写文件和服务管理能力。只拒绝不可逆的容器/镜像/卷/网络/系统删除或清理、明显的跨容器毁灭性命令，以及 `docker run/create` 的宿主机逃逸参数；`allow_mutations: false` 仍可关闭变更操作。代理默认允许状态变更，部署方法见 Docker 部署指南。

## Developer Status

在 WebUI 的 `interaction_with_master` 配置表单中填写 MDS 公开状态令牌、服务基地址和请求超时。配置保存在 `{persona}/tool_data/interaction_with_master.json`；环境变量 `MDS_PUBLIC_STATUS_TOKEN` 和 `MDS_API_BASE_URL` 仅作为未配置时的后备。
