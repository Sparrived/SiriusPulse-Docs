# 内置 Tool 参考

内置 Tool 位于 `sirius_pulse/tools/builtin/`。

其中 `bash`、`read_skill`、`workflow_state`、`group_file_exec` 只在**工作模式**内对模型可见：普通聊天回合里模型只拿得到 `enter_work_mode`，需要多步工具协作时由它自己进入工作模式；自主回合与定时任务回合则由框架自动进入。见下文 [工作模式](#工作模式work-mode)。

| 文件 | 功能 |
|---|---|
| `bash.py` | 在当前容器内执行标准 Bash 命令，并通过代理管理其他容器；支持项目级 `crontab -l`、`crontab -r` 和 `printf ... | crontab -`。 |
| `autonomy.py` | 人格的自主时间：读她惦记的意图，按纯规则决定要不要推进其中一件。不对模型可见。 |
| `intend_pursue.py` | 让她登记"想自己弄明白什么、为什么在意"，只登记不立刻去做，留给 `autonomy` 在合适的时机推进。 |
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

## 工作模式（work mode）

工作模式是"她独自把一件事做完"的任务态。聊天里由模型自己进出：需要连续动手完成一件事时，它先调用 `enter_work_mode`（参数 `goal` 说明准备干什么），重工具随之解锁；做完再调用 `quit_work_mode`（参数 `result` 说明工作结果），`result` 直接作为对外回复发出去。三个流程控制工具由 `sirius_pulse/core/work_mode.py` 定义，通过 `ChatRequest.extra_tools` 注入，不注册进 Tool 表，因此在 WebUI 的工具页面上看不到。

- 普通回合只提供 `enter_work_mode`；工作模式内只提供 `quit_work_mode` 与 `send_midway_msg`，不提供 `enter_work_mode`（不支持嵌套）。
- **自主回合与定时任务回合由框架自动进入工作模式**，不需要模型再喊一次 `enter_work_mode`：这两类回合本来就在"她独自做事"，所以重工具直接可用，过程直接记进同一份轨迹（`source` 分别为 `autonomy` / `scheduled`，`goal` 取意图理由或 cron 命令）。它们原有的交付约定不变——定时任务回合的最终正文仍然是发到原聊天的主动消息，自主回合的最终正文仍然是留给自己的材料。
- `bash`、`read_skill`、`workflow_state`、`group_file_exec` 只在工作模式内出现在工具列表里（`Brain.chat` 按 `ChatRequest.work_mode` 过滤）。由于上面那条自动进入，拿不到它们的只剩"普通聊天回合"。
- **工作模式内的正文不外发**。模型在同一轮里既输出正文又调用工具时，普通回合的正文照常发出，工作模式内的正文只写进轨迹；只有工具执行结果和 `send_midway_msg` 会对外产生效果。模型只输出正文而没有调用任何工具时，框架回一条提示，让它用 `send_midway_msg` 或 `quit_work_mode`。
- **暂存而不是打断**。工作模式期间别人发来的消息不进入模型上下文，先暂存在本次工作的暂存区，直到有消息点名了当前人格，才把暂存的整批消息一次性补进下一轮。这样整个工作模式期间的提示词前缀不变，缓存命中率不受新消息影响。**始终没被点名的那批不会丢**：退出工作模式时它们被排回延迟队列（不等去抖窗口），她忙完的下一轮照常回复——"她在忙"不等于"她不理人"。
- **退出必须留下对外结果**。`quit_work_mode` 的 `result` 为空（模型漏参、参数 JSON 截断）时不算退出，框架会要它补上；万一这次工作因轮次上限或异常被打断，框架也会用这次工作的 `result`（中断时写明"工作模式被中断，任务未完成。"）兜底，保证这一轮群里一定收得到话。
- **工作期间用哪个模型**由 `memory/work_mode/settings.json` 的 `task_name` 决定。留空（默认）表示沿用本回合原本的任务名——普通聊天就是 `response_generate`，所以行为与从前一致；填了 `work_mode_generate` 之类的任务名，整段工作都走那个模型。任务名就是 AMKR 的模型入口：本框架内置了 `work_mode_generate` 这个任务名（会随其他任务名一起注册进 AMKR 工作空间），在 AMKR 面板里把它指向更强的模型即可，普通聊天不受影响。设置每次开始工作时重新读取，改完下一次生效，不需要重启人格；WebUI 的 **分析 → 工作模式** 页面可直接选。
- **轨迹**。每次工作模式都会把 `goal`、来源、使用的任务名、每一轮的正文、工具调用与工具结果、`send_midway_msg` 发出的话、以及 `result` 记入 `{persona}/memory/work_mode/sessions.json`（只保留最近 50 次），WebUI 的 **分析 → 工作模式** 页面可以看，见 [WebUI API 参考](../reference/webui-api)。
- 工作不必须做完：提示词明确允许模型在难以解决或无法自行解决时提前 `quit_work_mode` 并在 `result` 里说明卡点、向外部求助。因轮次上限或异常中断的会话记为 `aborted`，同样保留轨迹。

## read_skill

`read_skill` 读取当前人格 `skills/` 目录中的 Skill，并在找不到人格自定义版本时回退到框架内置默认 Skill；同名人格 Skill 优先。不执行 Skill 中的脚本。该 Tool 只在工作模式内对模型可见。

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

## autonomy、intend_pursue 与 intend_share

`autonomy` 给每个人格一段属于自己的时间。它不向模型暴露工具入口，只作为被动 Tool 注册一个慢速心跳。心跳不是闹钟：它的职责是"看看她心里还惦记着什么"，而不是"到点了该产出点什么"，所以大多数时候的结论就是什么都不做。

### 动机来自意图，空闲只是入场券

她惦记的事记为**意图**（`{persona}/memory/intentions.json`），是跨心跳存在的持久状态。心跳只做一件事：读一遍意图，按纯规则决定要不要为其中一件花一次模型调用。

关键在于意图**在哪里产生**：它只在她真实思考的回合里形成，由她自己判断"这件事值得回头再做"，而不是由心跳扫描群聊记录来猜。心跳拿不到"她已经处理过什么"，所以从聊天里捡素材只会把她在正常回复中**刚刚读过、查过、答过**的东西又排一遍队——比如有人发了链接，她在回复时已经用 `web_lookup` 读过了，心跳再把那条消息变成一条"想弄明白"的意图，就只是让她把同一个链接重读一遍。更糟的是，这样记下的动因只能是一句常量，而不是她真实的理由。

但意图不能是**唯一**入口，否则整件事就闭环了：每条意图都得来自一次回复，她就永远没法自己开始任何事，群一安静她就永久沉默。所以在「什么都没惦记」且「很久没人找她」时，心跳会给她一段**自由时间**——不带任何素材，就是"接下来这段时间是你自己的"，她可以自己起个头，也可以照旧回答「什么也不做」。这是唯一一条从零开始的路径，由 `free_time_interval_seconds` 单独控速。

因此等待本身不会让已有的意图变重要：意图的紧急度只随时间**衰减**，不会因为空闲变长而升高；空闲时间（`restlessness`）只是给已有意图做加权。自由时间是这条规则的**刻意例外**，两者不冲突——意图的紧急度不该被等待抬高，而一个只能因为别人说话才能开始做事的人格，根本谈不上自主。没有意图且间隔未到时，心跳一律静默。

### 两种结局，同一种形状

意图只有两种归宿，都是同一份数据的不同 `resolution`：

- `do`：她自己去做点什么——查资料、读一篇文章、写点东西、整理想法，或者只是在心里想一想。`kind` 是自由标签而非固定分类，自主性不等同于"完成作品"。
- `tell`：她想把某件事说给某个人听。**受众是意图的一部分**，不是事后才补的字段：一句话本来就是说给某个人听的，不该变成广播。

`tell` 的投递是机械的：内容（`what`）和目标（`audience`）在意图形成时就定了，投递一次即 `shared_at` 标记，**不会重复说第二遍**。分享另有独立的节奏限制（`share_cooldown_seconds`），并通过既有主动消息管线发送，因此白名单、投递确认和 `event_id` 幂等都由框架保证。

### 夜里可以做事，但不能发出去

本地（中国）时间 **23:00 到次日 08:00** 之间，`autonomy` 只做一件事：不发。夜里发出去的消息，对方最早也要第二天才读到，而且多半是反感多于惊喜，所以静默期只拦**投递**，不拦**做事**——她照样可以读、可以写、可以想，只有那条要发出去的话在等。

等待不等于取消：被静默期拦下的意图**保持待发状态**，也**不会**被写成已说，天亮后（08:00 起）原样发出去，一个字都不改。这里刻意不消耗 `share_cooldown_seconds`，否则每晚的拦截都会把第二天的节奏也一起吃掉。

夜里她想记多少条都行（`intend_share` 不设上限）——晚上做了多少事是她自己的事。真正要防的是**天亮时的轰炸**：因为清空受 `share_cooldown_seconds` 限制，积压多少条就会被摊到多少个钟头，08:00 那一刻**只放出第一条**，其余按冷却一条条跟上，不会攒到某一刻一起倒出来。代价是越靠后的越不新鲜，所以 `share_cooldown_seconds` 同时也是"陈旧内容能拖多久"的旋钮。

判定按固定 UTC+8（中国无夏令时），与 `tools/cron_tasks.py` 的本地时间口径一致，不依赖系统时区。

`intend_pursue` 与 `intend_share` 是仅有的两个对模型可见的自主相关 Tool，分别对应 `do` 和 `tell`。两者都只**登记**、绝不立即执行：`intend_pursue` 记下"我想弄明白什么、为什么在意"，`intend_share` 记下"我想说什么、说给谁"。登记不等于行动——她这次回复里已经在做的事（已经读过的链接、已经查过的资料）不该再登记一遍。

`intend_pursue` 的 `kind` 是自由标签（`reading` / `building` / `note` / `musing`，缺省 `musing`），`urgency` 决定它多快被推进。`intend_share` 也可以带上 `intention_id` 给一条"还没想好说给谁"的旧意图补上受众，而不是重复登记同样的内容。受众候选来自确实可达的会话（活跃群 + 已配置的主人私聊），不可达的目标不会出现在候选里，避免意图指向一个发不出去的地方而永远悬着。

### 记忆不等于分享

产出写入 `{persona}/memory/autonomy/episodes.json`，同时作为 `scope=persona` 的记忆单元进入既有记忆，让她以后**知道**自己做过这件事。这只是"她知道"，不是"她说了"：记忆检索是否带出、要不要主动提起，由正常对话另行决定。上下文组装器对自主经历的措辞是"这是你自己做过或留意到的事，相关时可以用你自己的口吻提起"。

### 边界与配置

自主回合内会拒绝一切 `external_write` / `destructive` 类工具，因此她不能在做事的当口顺手往群里发消息；说与做始终是两个决定。豁免的是两个只做登记的 Tool：`intend_share`（决定"这条没想好受众的话说给谁"）与 `intend_pursue`。后者同样必须豁免——自由时间正是她**唯一**能自己起头做一件事的时刻，如果那时不能把冒出来的新念头记下来，每开一条线索都会在回合结束时断掉，她也就只剩别人的消息这一个持久来源了。真正防止链条失控的不是这个开关，而是意图仍要各自过 `autonomy` 的闸门与尝试上限才会花掉一次调用。

WebUI 的 `autonomy` 配置表单有三项：`check_interval_seconds`（心跳多久检查一次，最少 60 秒）、`share_cooldown_seconds`（两次主动分享之间的最小间隔）与 `free_time_interval_seconds`（无事惦记且长时间没人找她时，隔多久给一段空白的自主时间；默认 3600，设 0 表示关闭、退回纯意图闸门）。配置与 `_enabled` 一起保存在 `{persona}/tool_data/autonomy.json`；`share_cooldown_seconds` 与 `free_time_interval_seconds` 每次心跳都会重新读取，`check_interval_seconds` 在人格重启后生效。自主回合使用独立的 `autonomy_generate` 任务名，因此不会占用也不会触发正常回复的冷却。夜间静默期不是配置项，而是固定的礼貌约束。

### 作用域：按人格，不按群

这些节奏与状态全部是**人格级**的，不是群级的：配置存在 `{persona}/tool_data/autonomy.json`，意图与产出存在 `{persona}/memory/`，`last_share_at` 与 `last_free_time_at` 也是这个人格的一份时间戳。群只在单条意图上以 `origin_group` / `audience` 出现——那是**她自己挑的收件人**，不是判定作用域。

两个直接推论：其一，同一人格在任何群里的自主行为共享同一份节奏，所以给 A 群发了一条，`share_cooldown_seconds` 对 B 群同样生效；其二，新加一个群不会让她更活跃，只会让她多一个可以说给谁听的候选。多人格并存时各自独立计时、互不影响。

### 没有每日配额

自主行为**不受次数限制**：没有每日上限，也没有"两次自主之间必须间隔多久"的冷却。她只要确实惦记着什么，就可以在任意一次心跳上行动；真正的节奏上限就是 `check_interval_seconds` 本身。

限制她的是意图本身，而不是计数器：一件做完的事会被 `resolve`，说过的话会被 `shared_at` 标记，放久了会自然淡去。唯一的兜底是单条意图最多尝试 `3` 次——否则一件始终做不完、或她反复决定不做的事，会在每个心跳上各烧一次模型调用。自由时间则完全不看意图，只由 `free_time_interval_seconds` 控速，且**拒绝同样消耗掉这次机会**（否则每个心跳都会重新提供一次、每次都白烧一次调用）。想完全停用自主行为，把 `_enabled` 设为 `false`。

需要留意的是，取消配额后**自主行为没有与聊天分开的 token 预算**，实际花费由心跳间隔、单条意图的尝试上限与自由时间间隔共同决定；`bash` 等只读工具可在容器内任意读取，自主写入也尚未收敛到她自己的工作区。

### 在哪里看得见

WebUI 的 **分析 → 自主行为** 页面（`/api/persona/autonomy`）列出她当前惦记的意图与自己做过的事；她自己发起的回合会经由引擎事件桥实时出现在页面顶部的「刚刚」。页面是只读的：从后台替她行动会让她变成"可配置"而不是"自主"。在服务端日志里，她的自主痕迹是 `persona.log` 中的 `[内心]` 行。

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
