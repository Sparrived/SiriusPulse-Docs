# 内置 Tool 参考

内置 Tool 位于 `sirius_pulse/tools/builtin/`。

| 文件 | 功能 |
|---|---|
| `bash.py` | 在当前容器内执行标准 Bash 命令，并通过代理管理其他容器；支持项目级 `crontab -l`、`crontab -r` 和 `printf ... | crontab -`。 |
| `autonomy.py` | 人格的自主时间：读她惦记的意图，按纯规则决定要不要推进其中一件。不对模型可见。 |
| `intend_share.py` | 让她登记"想对谁说什么"，只登记不发送，留给 `autonomy` 在合适的时机投递。 |
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

## autonomy 与 intend_share

`autonomy` 给每个人格一段属于自己的时间。它不向模型暴露工具入口，只作为被动 Tool 注册一个慢速心跳。心跳不是闹钟：它的职责是"看看她心里还惦记着什么"，而不是"到点了该产出点什么"，所以大多数时候的结论就是什么都不做。

### 动机来自意图，不来自空闲

她惦记的事记为**意图**（`{persona}/memory/intentions.json`），是跨心跳存在的持久状态。意图在她**遇到**某样东西时产生——群里有人发了一篇文章、一个没弄明白的问题、一句想接的话——而不是由心跳凭空制造。心跳只做一件事：读一遍意图，按纯规则决定要不要为其中一件花一次模型调用。

因此等待本身不会让事情变重要：意图的紧急度只随时间**衰减**，不会因为空闲变长而升高；空闲时间（`restlessness`）只是给已有意图做加权，单独存在时不构成行动理由。没有意图时（例如刚启动、意图都已处理完），心跳一律静默。

### 两种结局，同一种形状

意图只有两种归宿，都是同一份数据的不同 `resolution`：

- `do`：她自己去做点什么——查资料、读一篇文章、写点东西、整理想法，或者只是在心里想一想。`kind` 是自由标签而非固定分类，自主性不等同于"完成作品"。
- `tell`：她想把某件事说给某个人听。**受众是意图的一部分**，不是事后才补的字段：一句话本来就是说给某个人听的，不该变成广播。

`tell` 的投递是机械的：内容（`what`）和目标（`audience`）在意图形成时就定了，投递一次即 `shared_at` 标记，**不会重复说第二遍**。分享另有独立的节奏限制（`share_cooldown_seconds`），并通过既有主动消息管线发送，因此白名单、投递确认和 `event_id` 幂等都由框架保证。

`intend_share` 是唯一对模型可见的自主相关 Tool。它只**登记**她想说的话、由她自己指定说给谁，绝不立即发送；也可以带上 `intention_id` 给一条"还没想好说给谁"的旧意图补上受众，而不是重复登记同样的内容。受众候选来自确实可达的会话（活跃群 + 已配置的主人私聊），不可达的目标不会出现在候选里，避免意图指向一个发不出去的地方而永远悬着。

### 记忆不等于分享

产出写入 `{persona}/memory/autonomy/episodes.json`，同时作为 `scope=persona` 的记忆单元进入既有记忆，让她以后**知道**自己做过这件事。这只是"她知道"，不是"她说了"：记忆检索是否带出、要不要主动提起，由正常对话另行决定。上下文组装器对自主经历的措辞是"这是你自己做过或留意到的事，相关时可以用你自己的口吻提起"。

### 边界与配置

自主回合内会拒绝一切 `external_write` / `destructive` 类工具，因此她不能在做事的当口顺手往群里发消息；说与做始终是两个决定。唯一豁免的是 `intend_share`（`allowed_when_self_initiated`），因为它只登记、不投递。

WebUI 的 `autonomy` 配置表单只有两项：`check_interval_seconds`（心跳多久检查一次，最少 60 秒）与 `share_cooldown_seconds`（两次主动分享之间的最小间隔）。配置与 `_enabled` 一起保存在 `{persona}/tool_data/autonomy.json`；`share_cooldown_seconds` 每次心跳都会重新读取，`check_interval_seconds` 在人格重启后生效。自主回合使用独立的 `autonomy_generate` 任务名，因此不会占用也不会触发正常回复的冷却。

### 没有每日配额

自主行为**不受次数限制**：没有每日上限，也没有"两次自主之间必须间隔多久"的冷却。她只要确实惦记着什么，就可以在任意一次心跳上行动；真正的节奏上限就是 `check_interval_seconds` 本身。

限制她的是意图本身，而不是计数器：一件做完的事会被 `resolve`，说过的话会被 `shared_at` 标记，放久了会自然淡去，因此没有意图时心跳一律静默。唯一的兜底是单条意图最多尝试 `3` 次——否则一件始终做不完、或她反复决定不做的事，会在每个心跳上各烧一次模型调用。想完全停用自主行为，把 `_enabled` 设为 `false`。

需要留意的是，取消配额后**自主行为没有与聊天分开的 token 预算**，实际花费由心跳间隔与单条意图的尝试上限间接决定；`bash` 等只读工具可在容器内任意读取，自主写入也尚未收敛到她自己的工作区。

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
