# 内置 Tool 参考

内置 Tool 位于 `sirius_pulse/tools/builtin/`。

| 文件 | 功能 |
|---|---|
| `bash.py` | 在当前容器内执行标准 Bash 命令，并通过代理管理其他容器；支持项目级 `crontab -l`、`crontab -r` 和 `printf ... | crontab -`。 |
| `group_file_exec.py` | 统一处理图片发送、文件上传，以及群文件列表读取和下载。 |
| `group_management.py` | 统一处理 QQ 群管理员操作。 |
| `interaction_with_master.py` | 与主人沟通并查询主人的公开设备状态。 |
| `desktop_screenshot.py` | 获取桌面截图。 |
| `web_lookup.py` | Web 查询。 |
| `qq_member_info.py` | 查询 QQ 群成员信息。 |
| `qq_like.py` | 通过已连接的 NapCat 适配器给 QQ 用户点赞，并支持复用当前会话上一次成功目标。 |
| `workflow_state.py` | 读写按聊天会话隔离的轻量流程检查点。 |
| `read_skill.py` | 读取当前人格的 Agent Skill 文档和同目录参考文件。 |

> **迁移提示：** `github_monitor` 已不再是内置 Tool。请使用 `plugins/github_monitor/` 中的外部 Plugin；安装、配置和迁移见 [GitHub Monitor 外部 Plugin](./github-monitor)。

## read_skill

`read_skill` 读取当前人格 `skills/` 目录中的 Skill，并在找不到人格自定义版本时回退到框架内置默认 Skill；同名人格 Skill 优先。不执行 Skill 中的脚本。

- `skill_name` 留空时列出可用 Skill。
- 指定 `skill_name` 时默认读取 `SKILL.md`。
- 大文件使用 `offset` 和 `max_chars` 分段读取。
- `relative_path` 只能访问当前 Skill 目录内的文件；脚本执行仍使用 `bash`。

## qq_like

`qq_like` 是 QQ 点赞的唯一执行入口，直接复用当前 NapCat bridge 的 `send_like` API。用户明确要求重复上一次点赞且没有新目标时，传 `reuse_last=true`；上一次调用必须成功，失败调用不会覆盖已保存目标。

## workflow_state

`workflow_state` 是按聊天类型和聊天 ID 隔离的可恢复流程状态机与流程目录，状态保存在当前 ToolDataStore。模型只按下面的固定顺序使用它：

`list` -> 找到候选就 `resume` -> 找不到时 `begin` 自动登记 -> `claim` -> 专用 Tool -> 成功 `checkpoint` / 失败 `fail` -> 有 `next_step` 就继续 -> 没有 `next_step` 时 `checkpoint` 自动完成。

- `list` 列出当前聊天已登记流程的摘要；`key` 留空列出全部流程，填写后按 key 过滤。列表只是索引，必须再 `resume`，不能直接据此执行外部操作。
- `begin` 创建或复用同一 `key` 和 `version` 的流程；新建必须返回 `registered=true`；`reused=true` 不代表应该再次执行，已完成流程必须先 `restart`。
- 对有副作用的专用 Tool，先用稳定的 `step`、`tool_name` 和 `idempotency_key` 调用 `claim`。只有 `claimed=true` 才执行；`already_done=true` 跳过重复外部调用；`in_progress=true` 不得立即重复调用。
- 后续 `claim.step` 必须等于当前 `next_step`，已完成流程不能开始新的 `claim` 或 `fail`；重复提交同一成功 checkpoint 只允许幂等回放。
- `claim` 返回的 `claim_token` 必须原样带到后续 `checkpoint` 或 `fail`；租约接管后旧调用的迟到结果会被拒绝。
- 专用 Tool 成功后用同一个幂等键和 claim token 调用 `checkpoint`，失败调用 `fail`；`next_step` 为空时该 checkpoint 自动完成流程。`restart` 用于从头开始一轮已结束或失败的流程。
- 写操作可传 `expected_revision` 做乐观并发校验；流程契约改变时递增 `version`，避免把新参数套进旧状态。claim 租约范围为 30-3600 秒，超时后才允许接管。
- `state_json` 只保存目标 ID、必要参数、外部 ID 和短结果摘要。Tool 会裁剪数据并过滤常见密钥字段；仍不得写入令牌、密码、Cookie、完整聊天记录、完整命令输出或堆栈。

## Bash

`bash` 是当前 Sirius 容器内的真实 Bash：`cwd` 支持容器内任意存在的目录和绝对路径，命令按当前进程身份执行，不再有命令白名单或工作区边界。它支持标准 Bash 语法，包括管道、重定向、here-document、变量和命令替换；所有调用者均可使用。工作目录、命令长度、执行超时和输出长度限制只用于保护服务稳定性，不改变容器内权限。

`bash` 同时接管模型常见的项目级 `crontab` 用法：`crontab -l` 查看当前聊天的任务，`crontab -r` 删除当前聊天的任务，`echo '*/5 * * * * echo hello' | crontab -` 或 `printf '%s\\n' '0 8 * * 1-5 echo weekday' | crontab -` 注册任务。它只写入人格的 `tool_data/bash.json`，不会修改操作系统 crontab；调度器触发后会把命令输出注入正常的主动回复链路，主动回复仍可继续调用工具。

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
