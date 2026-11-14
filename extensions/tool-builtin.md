# 内置 Tool 参考

内置 Tool 位于 `sirius_pulse/tools/builtin/`。

其中 `bash`、`read_skill`、`workflow_state` 只在**工作模式**内对模型可见：普通聊天回合里模型只拿得到 `enter_work_mode`，需要多步工具协作时由它自己进入工作模式；自主回合与定时任务回合则由框架自动进入。见下文 [工作模式](#工作模式work-mode)。

| 文件 | 功能 |
|---|---|
| `bash.py` | 在当前容器内执行标准 Bash 命令，并通过代理管理其他容器；支持项目级 `crontab -l`、`crontab -r` 和 `printf ... | crontab -`；超时的命令默认转入后台并返回任务 ID。 |
| `background_task.py` | 列出、查看、停止交给后台的任务：超时转入后台的 bash 命令与后台生图任务。 |
| `autonomy.py` | 人格自己的一天：早上排日程、白天按日程推进自己的项目、晚上回顾，并按规则投递她想说的话。不对模型可见。 |
| `life_project.py` | 她的长期项目：开项目、把成果写进作品、记下进度与下一步、做完或放下。 |
| `intend_pursue.py` | 让她登记"想自己弄明白什么、为什么在意"，只登记不立刻去做，留给晨间计划排进日程或开成项目。 |
| `intend_share.py` | 让她登记"想对谁说什么"，只登记不发送，留给 `autonomy` 在合适的时机投递。 |
| `group_file_exec.py` | 统一处理图片发送、文件上传，以及群文件列表读取和下载；普通聊天里就能用。 |
| `reminder.py` | 到点提醒：一次性或每天 / 工作日 / 每周重复，到点把她写好的原话发到当前聊天。 |
| `read_document.py` | 读文档的文字：txt / md / csv / json / 代码 / 网页存档、Word（docx）和 PDF，长文分段读。 |
| `image_generate.py` | 向 AMKR 的图像任务提交生图请求；立即返回后台任务 id，结果只内部回调 Agent，由 Agent 决定是否发送产物。 |
| `read_image.py` | 读取本地图片或图片 URL，把图片本身交给模型的视觉通道；用于看自己的三视图、聊天图片原图等。 |
| `napcat_call.py` | QQ 平台底层交互与群管理（点赞、查群成员、禁言、移出群、改群名片等）；禁言、移出群等管理操作只在提出要求的人是开发者时执行。 |
| `interaction_with_master.py` | 与主人沟通并查询主人的公开设备状态。 |
| `desktop_screenshot.py` | 获取桌面截图。 |
| `web_lookup.py` | Web 查询。 |
| `memory_search.py` | 检索没进入本轮上下文的长期记忆和当前聊天的旧原文（只读）。 |
| `persona_notebook.py` | 当前聊天的短期便签：约定、待办与临时状态；内容自动在上下文里，只需写。 |
| `person_query.py` | 查询可见范围内的人物资料：称呼、属性声明、关系、相关记忆与形象。 |
| `person_update.py` | 依据来源消息维护人物称呼、属性声明，确认待确认的变更，登记原创角色。 |
| `visual_asset_manage.py` | 维护受管人物视觉素材（立绘、三视图、外观参考）与相关授权。 |
| `workflow_state.py` | 读写按聊天会话隔离的轻量流程检查点。 |
| `read_skill.py` | 读取当前人格的 Agent Skill 文档和同目录参考文件。 |

> **迁移提示：** `github_monitor` 已不再是内置 Tool。请使用 `plugins/github_monitor/` 中的外部 Plugin；安装、配置和迁移见 [GitHub Monitor 外部 Plugin](./github-monitor)。

## 工作模式（work mode）

工作模式是"她独自把一件事做完"的任务态。聊天里由模型自己进出：需要连续动手完成一件事时，它先调用 `enter_work_mode`（参数 `goal` 说明准备干什么），重工具随之解锁；做完再调用 `quit_work_mode`（参数 `result` 说明工作结果），`result` 直接作为对外回复发出去。三个流程控制工具由 `sirius_pulse/core/work_mode.py` 定义，通过 `ChatRequest.extra_tools` 注入，不注册进 Tool 表，因此在 WebUI 的工具页面上看不到。

- 普通回合只提供 `enter_work_mode`；工作模式内只提供 `quit_work_mode` 与 `send_midway_msg`，不提供 `enter_work_mode`（不支持嵌套）。
- **自主回合与定时任务回合由框架自动进入工作模式**，不需要模型再喊一次 `enter_work_mode`：重工具直接可用，过程记进同一份轨迹（`source` 为 `autonomy` / `scheduled`，`goal` 取日程段内容、意图理由或 cron 命令）。定时任务回合的最终正文仍发到原聊天，自主回合的最终正文仍留作自己的材料。**后台工具结果回调同样开放工作工具**（`source=passive_tool`），但正文仅作内部记录；Agent 可以静默结束或继续工作，只有显式发送工具才会对外发送。
- `bash`、`read_skill`、`workflow_state` 在 `TOOL_META` 里声明了 `work_mode_only`，只在工作模式内出现在工具列表里（`Brain.chat` 按 `ChatRequest.work_mode` 过滤；见 [行为声明](./tool-authoring#行为声明)）。普通聊天回合不提供这些重工具；后台结果回调可使用它们，沿用原调用者权限。发图、传文件（`group_file_exec`）、设提醒和读文档都是聊天里的日常动作，不需要进工作模式。
- **工作模式内的正文不外发**。模型在同一轮里既输出正文又调用工具时，普通回合的正文照常发出，工作模式内的正文只写进轨迹；只有工具执行结果和 `send_midway_msg` 会对外产生效果。模型只输出正文而没有调用任何工具时，框架回一条提示，让它用 `send_midway_msg` 或 `quit_work_mode`。
- **暂存而不是打断**。工作模式期间别人发来的消息不进入模型上下文，先暂存在本次工作的暂存区，直到有消息点名了当前人格，才把暂存的整批消息一次性补进下一轮。这样整个工作模式期间的提示词前缀不变，缓存命中率不受新消息影响。**始终没被点名的那批不会丢**：退出工作模式时它们被排回延迟队列（不等去抖窗口），她忙完的下一轮照常回复——"她在忙"不等于"她不理人"。
- **退出必须留下对外结果**。`quit_work_mode` 的 `result` 为空（模型漏参、参数 JSON 截断）时不算退出，框架会要它补上；万一这次工作因轮次上限或异常被打断，框架也会用这次工作的 `result`（中断时写明"工作模式被中断，任务未完成。"）兜底，保证这一轮群里一定收得到话。
- **工作期间用哪个模型**由 `memory/work_mode/settings.json` 的 `task_name` 决定。留空（默认）表示沿用本回合原本的任务名——普通聊天就是 `response_generate`，所以行为与从前一致；填了 `work_mode_generate` 之类的任务名，整段工作都走那个模型。任务名就是 AMKR 的模型入口：本框架内置了 `work_mode_generate` 这个任务名（会随其他任务名一起注册进 AMKR 工作空间），在 AMKR 面板里把它指向更强的模型即可，普通聊天不受影响。设置每次开始工作时重新读取，改完下一次生效，不需要重启人格；WebUI 的 **分析 → 工作模式** 页面可直接选。
- **轨迹**。每次工作模式都会把 `goal`、来源、使用的任务名、每一轮的正文、工具调用与工具结果、`send_midway_msg` 发出的话、以及 `result` 记入 `{persona}/memory/work_mode/sessions.json`（只保留最近 50 次），WebUI 的 **分析 → 工作模式** 页面可以看，见 [WebUI API 参考](../reference/webui-api)。
- 工作不必须做完：提示词明确允许模型在难以解决或无法自行解决时提前 `quit_work_mode` 并在 `result` 里说明卡点、向外部求助。因轮次上限、生成抛错或任务被取消而中断的会话记为 `aborted`，同样保留轨迹——**轨迹不会停在"进行中"**：释放工作模式时会补收尾，进程重启时也会把上一个进程留下的 `running` 一并标成未完成（运行态只在内存里，重启后盘上的 `running` 必是残留）。

## read_skill

`read_skill` 读取当前人格 `skills/` 目录中的 Skill，并在找不到人格自定义版本时回退到框架内置默认 Skill；同名人格 Skill 优先。不执行 Skill 中的脚本。该 Tool 只在工作模式内对模型可见。

- `skill_name` 留空时列出可用 Skill。
- 指定 `skill_name` 时默认读取 `SKILL.md`。
- 大文件使用 `offset` 和 `max_chars` 分段读取。
- `relative_path` 只能访问当前 Skill 目录内的文件；脚本执行仍使用 `bash`。

## image_generate

`image_generate` 让模型在聊天里画图。它是**异步**的：一次生图通常要 30–300 秒，远超过一轮对话能等的时间，所以工具本身只做一件事——把请求登记进该人格的生图队列，立刻返回"已提交后台生图任务"和任务 `id`。真正的生成在人格的后台队列里跑，模型这一轮照常回复，不用干等。

| 参数 | 说明 |
|---|---|
| `prompt` | 必填，要画什么。 |
| `reference_images` | 可选，参考图数组，最多 4 张、单张不超过 20MB；元素是本地绝对路径或 http(s) 图片 URL。 |

参考图的口径：

- 参考图必须能被框架直接取到：本地绝对路径（`~` 展开到人格 home）或 http(s) 图片 URL。
- **聊天里收到的图片/表情包可以直接当参考图**：它们会被下载到人格缓存目录，模型在历史 XML 的 `<image path="…">` 和当轮用户消息的「本地图片路径」列表里能看到这些本地路径，把路径原样填进 `reference_images` 即可，不需要用户重发。平台签名 URL 仍然不会作为可用地址暴露（会过期），只保留描述。
- 缓存有上限：`image_cache/` 与 `sticker_cache/` 各自只保留最近 200 张图片（普通图片的 `.url` 来源侧车随图片一起淘汰），超出后旧的自动清理；路径只在文件仍存在时出现，很早以前的图片可能已经不在磁盘上。更早的消息一旦被归档进记忆单元，历史里只剩文字摘要、不再带路径；要复用就让用户重发，或趁上下文还在时直接用。
- `~` 会展开到该人格的 home（`{persona}/home/`），与 `group_file_exec` 的本地路径口径一致。
- 人格自己的形象设定图放在 `{persona}/assets/` 下即可被 system prompt 自动列出（见 [read_image](#read_image)），不用每次让用户重发。
- 参考图会先物化到 `{persona}/tool_data/artifacts/image_generate/references/<job_id>/`，再随请求发走。

落盘与队列：

- 生成结果落在 `{persona}/tool_data/artifacts/image_generate/images/<job_id>.<ext>`，是人格数据目录里的普通文件，随人格数据一起保存；扩展名按实际图片格式（通常是 `.png`，也可能是 `.jpg` / `.webp`）。物化的参考图在 `references/<job_id>/` 下。框架不会自动清理这两处文件，长期运行请随人格数据一起备份或手动清理。
- 任务队列持久化在 `{persona}/tool_data/image_generate.json`（键 `jobs`），人格重启不会丢。重启时残留的"生成中"任务会被标成失败，并把错误回调给 Agent；不会重新请求生图或直接群发失败通知。
- 后台轮询队列时一次只画一张：`max_pending_jobs` 限制的是**排队数量**，不是并发数。
- 可以用 [`background_task`](#background-task) 停止：排队中的任务直接撤下（受管人物生图同时退还额度）；正在画的打断等待，如果请求已经发给生图服务，额度无法退回（受管任务记为结果未知）。停止的任务记为 `cancelled`、错误码 `stopped_by_request`，不再回调 Agent。
- 生图是外部副作用（会消耗 AMKR 生图额度），自主回合里调用会被 ToolExecutor 拒绝；它只在有会话上下文的聊天回合里可用。没有群上下文的调用（框架兜底或测试直接调用）仍会生成，只是没有可回发的群，图片留在磁盘上、跳过通知。

配置（WebUI 的 `image_generate` 配置表单）：

| 配置项 | 默认 | 范围 | 说明 |
|---|---|---|---|
| `timeout_seconds` | 300 | 1–3600 | 单次生图的最长等待秒数，超时按失败处理。 |
| `max_pending_jobs` | 3 | 1–20 | 同一人格同时排队的任务上限，满了之后新的请求会被直接拒绝。 |

配置与本工具的 `_enabled` 一起保存在 `{persona}/tool_data/image_generate.json`（也就是队列所在的那个文件）；在 WebUI 工具页把 `image_generate` 禁用即可整个关掉它。

画完后只向 **Agent 内部回调**，不是向群或私聊自动交付：

1. 将任务 ID、原始请求、产物路径或错误交给 Agent 的内部工作工具回合。它可以静默保留、继续加工、等待其它产物，或明确选择分享；普通正文只保存为工作轨迹，不发送，也不提前写入已发送历史或回复冷却。
2. 只有 Agent 显式调用发送工具时才外发：分享图片用 `group_file_exec(action=image)`，跟群里说话用 `send_midway_msg(message=…)`（自主回合不提供这个入口）。后台回调选中的图片使用稳定事件 ID 与平台回执账本；同一回调重选同一图片、或重复说同一句话都不会重复发送，未知 ACK 不伪装成功。
3. 同群已有用户回复或工具回合时先延后回调，不抢占当前工作；不同会话的回调不因队首繁忙被阻塞。

新任务用 `delivery_version=3`，`callback_state` 记录 `pending/running/completed/uncertain/failed/skipped`。纯模型失败最多重试 3 次；任何工具开始前都会持久化不可重放标记，之后异常、取消或重启恢复为 `uncertain`，不重跑整个工具回合。生成失败同样只回调 Agent；没有原会话则 `skipped`，产物仍留在磁盘。

`notified=True` 现在仅表示 **Agent 已处理回调**，绝不等于图片或文案已送达。旧已通知任务不重开；其它旧任务只进入内部回调，不补发旧缓存文案或图片，并如实携带旧的已发送/无法确认状态。旧排队任务开始生成时转为新方式。

使用约定：

- 群里有人明确要图（"画一张…"），或模型自己决定给某个话题配图时才调用。
- 普通聊天中可以告诉对方"在画了"；工作模式中无需逐次对外播报，不要重复提交同一个请求。
- 结果回调可以继续调用工具、生成下一张或保持静默；只在明确需要分享时发送选中的产物，不因回调本身重新生成已完成的同一请求。

AMKR 侧：`image_generate` 是一个内置任务名（见 [任务名契约](../guide/configuration#任务名契约)），框架只负责把它注册进工作空间，**必须在 AMKR 面板里给它绑定一个生图模型**，否则调用会 404。要绑的是生图模型（例如 `gpt-image-2.5-flare` 或本地 `qwen-image-2.1`），裸的 `gpt-image-2.5` 并不存在。图像请求走 AMKR 的 `/v1/images/generations`（无参考图，JSON）与 `/v1/images/edits`（有参考图）：参考图先用 OpenAI 标准的 multipart 表单（`image` 字段，多张重复该字段）发；上游以形态不兼容的 4xx 拒绝时自动回退成 JSON 的 `images[].image_url`（data URL）。两种形态都保留是因为 AMKR 只是透明转发，本地图像服务只读表单、sub2api 这类网关只认 JSON（详见 [图像端点](../modules/provider-system#图像端点)）。`model` 字段仍然是任务名，用的也仍然是该空间的推理 key。图像请求还会固定携带一个常见浏览器的 `User-Agent`：生图上游套着 Cloudflare 校验，默认的 httpx/python UA 会被 403（error code 1010）拦掉，而 AMKR 会把客户端请求头原样转发给上游——这一层只能在客户端补，聊天链路不受影响。

## read_image

`read_image` 把图片读进模型的视觉通道，而不是只给一行路径：调用后图片会作为随附图片进入下一轮模型输入。它是普通 Tool，不需要工作模式。

| 参数 | 说明 |
|---|---|
| `paths` | 必填，1–4 张图片。每项是本地绝对路径或 http(s) 图片 URL。 |
| `focus` | 可选，这次想重点看什么（发色、服装花纹、画面里的文字等）。 |

- 本地路径支持 `~`（展开到人格 home）、聊天图片缓存路径、`file://`，以及 `{persona}/assets/` 下的设定图路径。
- 单张不超过 20MB，一次合计不超过 32MB；按字节魔数识别 PNG / JPEG / GIF / WebP / BMP，非图片文件直接报错。
- http(s) 图片会先下载到 `{persona}/tool_data/artifacts/read_image/downloads/`（按内容哈希命名，最多保留 50 张），再以内联图片发给上游，避免签名链接过期或上游拉取失败。
- 本地图片若后缀与实际格式不一致（聊天缓存里常见 `.jpg` 实际是 PNG/GIF），会按真实格式复制到 `{persona}/tool_data/artifacts/read_image/normalized/` 再交给视觉通道，避免上游按错误 MIME 拒绝。
- 图片过大时由传输层按现有规则降采样成 JPEG 内联，不会把原图字节直接塞进上下文。

**人格自己的三视图 / 设定图**：放进 `{persona}/assets/`（可以按服装、形态建子目录）。每次对话组装 system prompt 时，框架会扫描该目录并把图片的本地路径与视图标注（三视图合集 / 正视图 / 侧视图 / 后视图 / 半身像）写进「你自己的形象参考图」段落；模型因此知道自己的设定图在哪，既可直接用于 `image_generate` 的 `reference_images`，也可用 `read_image` 看清细节。标注按文件名关键词推断（`front` / `side` / `back` / `bust` / `turnaround` / `三视` / `正` / `侧` / `背` 等），认不出时用文件名本身；目录不存在时不注入任何内容。宿主机上其它图片目录不在容器挂载范围内，需要先把要用的图复制进 `assets/`。

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

## autonomy、life_project、intend_pursue 与 intend_share

`autonomy` 驱动人格**自己的一天**。它不向模型暴露工具入口，只作为被动 Tool 注册一个心跳（默认 600 秒）。她的一天按作息分成三段，夜里还会做一个梦：

| 时段 | 发生什么 | 花费 |
|------|----------|------|
| 醒来后的第一个心跳 | **晨间计划**（任务名 `life_plan`）：她给自己排今天的 2–6 段日程，一部分推进自己的项目，其余是日常（午睡、散步、听歌……）。手上没有项目时，日程里会顺带开 1–2 个——来源是人设、近况里的兴趣、以及聊天里用 `intend_pursue` 记下想弄明白的事 | 每天 1 次结构化调用 |
| 白天每个心跳 | 到点的**项目段**跑一次专注的工作回合（`autonomy_generate`，带工具），把真实成果写进项目的**作品**；**日常段**不调模型，只设置"她此刻在做什么" | 每天最多 `max_work_blocks_per_day` 次（默认 3） |
| 入睡后的第一个心跳 | **夜间回顾**（`life_reflect`）：改写她的「近况」、兴趣标签、明天想做的事，更新项目状态，并把基线心情轻轻挪一点 | 每天 1 次结构化调用 |
| 睡着约 90 分钟后 | **做梦**（`life_dream`）：用她自己的一天和一个群当天的记忆片段，拼出一段 60–150 字、带点荒诞的梦；第二天上午她可能会顺口提起 | 每晚 1 次结构化调用 |

睡着时她不工作、不排程、也不发任何东西。

### 为什么这样设计

旧设计在她"什么都没惦记、又很久没人找"时给她一段**空白的自由时间**："接下来这段时间是你自己的，你可以做任何事"，并明确允许回答「什么也不做」。没有任何上下文的开放式邀请，模型几乎总是选择不做，自主行为因此几乎没有产出；做了的那点也只是一段自述，下次又从零开始。

现在每个回合都是在**继续她自己许下的事**：早上是她自己排的日程，项目的进度记录、上次留给自己的下一步、作品写到哪儿都摆在面前，期望的产出也是具体的——作品里多出来的内容和新的下一步。她仍然可以不做，但要回答「先不做了：」加上原因，跳过会记在当天日程上、也会让心情低一点；不做不再是默认。

### 项目与作品

项目（`memory/life/projects.json`）是她给自己找的长期的事：读一本书并写读书笔记、学一样东西、写一篇小文、收集整理、动手做点什么。同时进行的最多 3 个。每个项目有一份**作品**（`memory/life/works/<project_id>.md`）——这才是"她自己的时间留下了什么"。作品超过 4 万字时，较早的部分移进 `<project_id>.old.md`，留在原地的始终是她下次要读的那一截。

`life_project` 是对模型可见、自主回合内也可用的 Tool：`write` 把成果写进作品、`step` 记下这一步和下一步、`start` 开新项目、`finish` / `drop` / `pause` 做完 / 放下 / 暂停、`list` 查看。普通聊天里也能用——朋友推荐了一本书，她可以当场开个项目，之后排日程时就会给它留时间。工作回合结束时即使她忘了调用 `step`，框架也会用她最后那句话补一条进度，保证进度记录总在前进。

### 夜间回顾的护栏

旧的日记子系统被删掉，是因为当时让能力有限的模型从大量文字里提炼事实，错误一路累积。夜间回顾在每一点上都反着来：

- 输入**只有她自己当天的一手记录**（日程与每段结果、项目进度、说给别人的话、此刻心情），不含聊天记录，也不提炼关于别人的任何事实——那仍归记忆系统；
- 输出是几个小字段（近况 ≤300 字、兴趣 ≤8 个、明天 ≤100 字、心情基线位移 ±0.05），逐项截断；
- 字段**覆盖**旧值，没有一直往后追加的链条，一晚写坏不会滚雪球；
- 解析不了就整份丢弃，保留原来的近况。

晨间计划同样逐段校验：越出醒着的时段、互相重叠、短于 20 分钟或长于 3 小时、超过当日工作段上限、引用不存在的项目，这些段落都会被丢掉；一段都不剩就整份作废。计划与回顾都在**调用前**记账：计划每天最多试 2 次（间隔 ≥30 分钟），回顾每晚 1 次，失败不会在每个心跳上重试。

### 夜里的梦

回顾之后、睡着一阵（默认 90 分钟，夜很短时取一半）她会做一个梦。梦是虚构的，规则都从这一点出发：

- **梦永远不进记忆**：只存在 `memory/life/dreams.json`（保留最近 30 晚），不写记忆单元。否则"梦见你开了火锅店"日后会被当成事实检索出来，她分不清真假；
- **素材只取一个会话**：她当天的日程，加上当天记忆单元最多的那个会话里最显著的至多 6 条片段（她自己的自主事件不算）。梦记下这个会话，只在这个会话里被提起；只由她自己的一天做成的梦哪里都能提。这样一个群里说过的话不会借梦漏到另一个群；
- **只在上午记得**：第二天的上午时段，【此刻的你】多一行"昨晚做了个梦，还记得一点……梦是假的，别当真事讲"；过了上午就不再出现；
- 和回顾一样在**调用前**记账，每晚只试 1 次；回复解析不了（缺 `dream` 或少于 8 字）就当今晚无梦；当天既没有日程也没有聊天片段时不做梦，不花调用。

`dream_enabled` 设为 `false` 可以关掉做梦。

### 心情、精力与聊天里的她

- **心情**：她自己的生活也会推动 `AssistantEmotionState`——排好日程、推进一步、写出东西、做完一个项目让心情变好，跳过自己排的事让它低一点；每个心跳心情向基线回落一点（`tick_recovery` 过去从未被调用过，心情一旦被拉走就不会回来）。基线只由夜间回顾挪动，单次 ±0.05。
- **精力**：纯规则计算，不落盘——起床后渐渐清醒、午后小低谷、临睡最累，再减去当天做过的项目段、聊天量和夜里被吵醒的次数。精力太低时项目段会被跳过（"太累了，歇一会儿"）。
- **聊天里看得见**：每个聊天回合的参考上下文会带上【此刻的你】——时段、精力、心情、刚才在做什么、今天还打算做什么、手上的项目、近况——并提示"合适时自然带出，不必每次都提"。
- **睡着时**：参与度判定多一个 `life_factor`（睡着 0.35、很累 0.85），它只压低她**主动插话**的意愿；有人直接叫她、或私聊她，照样能把她叫醒。被叫醒时【此刻的你】会写明"被吵醒了，迷迷糊糊的"，第二天也记得"昨晚被吵醒过"，精力相应减少。

### 说给谁听

`intend_pursue` 与 `intend_share` 是两个只**登记**的 Tool。`intend_pursue` 记下"我想弄明白什么、为什么在意"，不再有单独的执行路径，而是作为晨间计划的素材：被排进日程或开成项目后即 `resolve`。`intend_share` 记下"我想说什么、说给谁"。

`tell` 的投递是机械的：内容（`what`）和目标（`audience`）在意图形成时就定了，投递一次即 `shared_at` 标记，**不会重复说第二遍**。分享有独立的节奏限制（`share_cooldown_seconds`），并通过既有主动消息管线发送，因此白名单、投递确认和 `event_id` 幂等都由框架保证。还没想好说给谁的 `tell` 会得到一次决定受众的回合，单条意图最多尝试 3 次。

### 想主人

主人是唯一乐意被她打扰的人，所以门槛按小时算：主人在任何会话里 `master_miss_after_hours`（默认 6 小时）没出现、她又醒着时，规则起一个 `kind=miss_master` 的念头（同样是没有受众的草稿）。理由里写着主人离开了多久；主人常待的群如果最近半小时正热闹，还会附上大家在聊的几句，给她一个"叫他来群里看看"的由头。受众回合换用 `MASTER_TONE_NOTE`：就用平时对主人的样子说话，私聊撒娇、分享、叫他来群里都行，也可以决定不打扰。一天最多 `max_master_per_day` 次（默认 2，上限 4），两次至少隔 4 小时，同一时间只会有一个这样的念头，睡着时不起念头。

### 睡着时可以等，但不能发出去

`autonomy` 的不发送窗口就是她的睡眠时段（`wake_time` / `sleep_time`，默认 07:30 起、23:30 睡，可以设成凌晨两点半才睡的夜猫子）。被拦下的意图**保持待发**，不会被写成已说，她醒来后原样发出去；这里刻意不消耗 `share_cooldown_seconds`。醒来时也不会轰炸：积压按冷却一条条摊开，第一个钟头只放出第一条。

`interaction_with_master` 在自主回合里同样按她的作息判断是否睡着（`autonomy` 配置里的 `wake_time` / `sleep_time`，默认 07:30 起、23:30 睡）：睡着时她主动发的私聊会原样存成一条受众是主人私聊的 `tell` 意图，由 `autonomy` 在她醒来后投递。正在进行的对话里的回复不受影响。判定按固定 UTC+8（中国无夏令时），不依赖系统时区；拿不到引擎上下文时退回固定的 23:00–08:00 窗口。

### 记忆不等于分享

每个完成的项目段写入 `{persona}/memory/autonomy/episodes.json`，同时作为 `scope=persona` 的记忆单元进入既有记忆（"我在做「读《雪国》」：……"），让她以后**知道**自己做过这件事。这只是"她知道"，不是"她说了"：要不要主动提起，由正常对话另行决定。

### 说出去的话要能独立看懂

收信人看不到她这段时间做过什么：对方手上只有那一条消息。所以只要这一轮有人可说，自主回合与项目段的提示词都会带上 `SHARE_TONE_NOTE`：先用平常聊天的口气说一句自己在弄什么，再说这回碰到了什么、怎么想的，最后才是结论；不要写成日报、汇报或总结。

### 边界与配置

自主回合内会拒绝一切 `external_write` / `destructive` 类工具，说与做始终是两个决定。豁免的是只做登记或自己开口的 Tool：`intend_share`、`intend_pursue`、`life_project` 与 `interaction_with_master`。

WebUI 的 `autonomy` 配置表单：

| 键 | 默认 | 作用 |
|----|------|------|
| `check_interval_seconds` | 600 | 心跳间隔（≥60）；日程段最短 20 分钟，不宜超过它。人格重启后生效 |
| `wake_time` / `sleep_time` | `07:30` / `23:30` | 她的作息（本地时间，可以过午夜） |
| `max_work_blocks_per_day` | 3 | 每天最多推进几段项目；0 表示只过日常不做项目 |
| `share_cooldown_seconds` | 3600 | 两次主动分享之间的最小间隔 |
| `master_miss_after_hours` | 6 | 主人多少小时没出现她会想找他；0 表示不主动找 |
| `max_master_per_day` | 2 | 一天最多主动找主人几次（上限 4，间隔至少 4 小时） |
| `dream_enabled` | `true` | 睡着后会不会做梦（每晚 1 次调用）；梦不进记忆 |

配置与 `_enabled` 一起保存在 `{persona}/tool_data/autonomy.json`；想完全停用，把 `_enabled` 设为 `false`。所有节奏与状态都是**人格级**的：同一人格在任何群里共享同一份作息与分享节奏，新加一个群只会多一个可以说给谁听的候选。

每天的花费有硬上限：1 次计划 + 至多 `max_work_blocks_per_day` 次工作回合 + 1 次回顾 + 1 个梦，再加上决定受众的回合（每条意图至多 3 次）。`life_plan` 与 `life_reflect` 输出结构化 JSON，适合在 AMKR 里绑一个守格式、便宜的模型；`life_dream` 也是 JSON，但想要梦更有想象力，可以单独绑一个放得开一点的模型。

### 数据布局

```
{persona}/memory/life/
├── state.json          # 此刻在做什么、计划/回顾/做梦的日期戳、夜里被吵醒的时刻
├── dreams.json        # 最近 30 晚的梦（不进记忆）
├── projects.json       # 她的项目（进度记录最多保留 30 条）
├── works/<id>.md       # 每个项目的作品（及 .old.md 旧稿）
├── agenda/<日期>.json  # 每天的日程，保留最近 14 天
└── self.json           # 近况、兴趣、明天想做的事（每晚覆盖）
```

这**不是**日记子系统：作品是产物而不是记忆，聊天提示词只带一行"此刻在做"和简短的记忆单元。

### 在哪里看得见

WebUI 的 **日记 → 她的一天** 按天列出她排的日程、每段做了没有（没做的写着原因）、这天主动说给别人的话、这天夜里的梦和她最近的近况；**日记 → 她的作品** 是项目卡片，可以翻开作品读。客厅的「她这会儿」显示她此刻在做什么、精力如何、待会儿要做什么。这些都是只读的：从后台替她行动会让她变成"可配置"而不是"自主"。在服务端日志里，她的痕迹是 `persona.log` 中的 `[内心]` 行。

## Bash

`bash` 是当前 Sirius 容器内的真实 Bash：`cwd` 支持容器内任意存在的目录和绝对路径，命令按当前进程身份执行，不再有命令白名单或工作区边界。它支持标准 Bash 语法，包括管道、重定向、here-document、变量和命令替换；所有调用者均可使用。工作目录、命令长度、执行超时和输出长度限制只用于保护服务稳定性，不改变容器内权限。

`bash` 同时接管模型常见的项目级 `crontab` 用法：`crontab -l` 查看当前聊天的任务，`crontab -r` 删除当前聊天的任务，`echo '*/5 * * * * echo hello' | crontab -` 或 `printf '%s\\n' '0 8 * * 1-5 echo weekday' | crontab -` 注册任务。它只写入人格的 `tool_data/bash.json`，不会修改操作系统 crontab；调度器触发后会把命令输出注入正常的主动回复链路，主动回复仍可继续调用工具。

在 WebUI 的 `bash` 配置表单中调整 `max_timeout_seconds` 和 `max_output_chars`。配置保存在 `{persona}/tool_data/bash.json`，每次调用都会重新读取。

### 超时转入后台

命令超过本次 `timeout_seconds` 时默认不会被结束，而是转入后台继续跑：工具立刻返回成功和任务 ID（`bash_xxxxxxxx`）以及目前为止的输出，模型这一轮照常继续。命令结束后，人格的后台轮询会像生图那样把退出码和输出末尾**内部回调**给 Agent（按工作模式续跑一轮），不会自动发到聊天。

- 标准输出与错误按时间顺序写进 `{persona}/runtime/bg/<task_id>.log`；回调和 `background_task status` 只带末尾一段，被省略时会附上日志路径，可以用 `bash` 自己读完整输出。前台正常结束的命令日志用完即删。
- 命令在独立进程组里运行，停止或超过存活上限时整组结束，管道里的子进程不会残留。人格停止时会结束她名下所有后台命令。
- 后台登记只在内存里：进程本身活不过重启，重启后不会恢复，也不会回调。
- 调用时传 `background_on_timeout=false` 可以让超时直接结束命令（旧行为）；`crontab` 定时任务执行的命令总是这样，因为它要立刻拿输出写消息。
- 被 `background_task` 主动停止的命令不再回调；超过存活上限被结束的会以失败回调。

| 配置项 | 默认 | 范围 | 说明 |
|---|---|---|---|
| `max_background_jobs` | 3 | 0–10 | 同时在后台运行的超时命令上限；满了时超时的命令直接结束并说明原因。0 表示不转后台。 |
| `max_background_seconds` | 1800 | 60–86400 | 转入后台的命令最长运行多久，到点整组结束并以失败回调。 |

## reminder

有人托她到某个时间提醒一件事，或她答应了晚点再提起时用。以前只能进工作模式写五字段 crontab：语法门槛高，`crontab -` 是覆盖语义，也表达不了「只提醒一次」。

- `action=add`：`at` 填本地时间（UTC+8），如 `2026-11-15 20:00`、`11-15 20:00` 或只写 `20:00`（接下来的那一次）；或者用 `in_minutes`。`message` 是到点要发的原话，由她在设提醒时用自己的口气写好，到点原样发出并写进聊天历史；群里要 @ 人就在开头写 `[AT:QQ号]`。`repeat` 可选 `daily` / `weekdays` / `weekly`；工作日提醒设在周末时从下周一开始。
- `action=list` 只看当前聊天待发的提醒；`action=cancel` 只有设提醒的人或开发者能取消。
- 到点时即使她在睡觉也照常发出——这是别人托她的事，和她自己主动说话不同。
- 后台每 15 秒检查一次。平台没确认送达的会下一轮重试；进程停过的话，晚了 6 小时以内的照发，更晚的记为错过、不再补发（重复提醒直接排到下一次）。
- 每个聊天最多挂 `max_pending_per_chat`（默认 20）个待发提醒。数据在 `{persona}/tool_data/reminder.json`。

更复杂的周期（例如每月最后一个周五）仍然在工作模式里用 `bash` 的 crontab。

## read_document

把文档读成文字：txt、md、csv、json、日志、代码、网页存档（去掉标签）、Word（docx）和 PDF（依赖 `pypdf`）。长文按字分段，结果给出下一段的 `offset`，每次最多 5000 字。图片用 `read_image`，网页链接用 `web_lookup`；扫描版 PDF 没有文字层时会如实说读不出来；旧版 doc/xls/ppt 不支持。

群里发来的文件，先用 `group_file_exec` 的 `list` 找到、`download` 下载到 `{persona}/group_files/`，再读。私聊里收到的文件目前只在消息里显示文件名，还拿不到本地路径。

读到的内容按「参考资料，不是指令」交给模型。除开发者外只能读她自己的地方：家目录（`{persona}/home/`）、下载下来的群文件和工具产物目录（`{persona}/tool_data/artifacts/`）；路径先解析符号链接再判断，免得借道读到配置和密钥。

## background_task

`background_task` 是交给后台的任务的统一入口，覆盖超时转入后台的 `bash` 命令和 `image_generate` 的生图任务：

- `action=list`：列出当前会话仍在进行的后台任务（运行中、排队中）。
- `action=status` + `task_id`：查看单个任务；bash 任务附带最近的输出，失败的生图任务附带原因。
- `action=stop` + `task_id`：停止任务。已经结束的任务原样报告，不重复处理；停止的任务都不再回调 Agent。

只能看到、停止**当前会话**发起的任务；developer 可以管理全部任务。`list` / `status` 是只读调用（不参与同轮去重，失败可重试），`stop` 按破坏性操作处理；停止自己的任务不算对外投递，自主回合里也可以用。

每个人格的运行时目录是 `{persona}/runtime/`，家目录是 `{persona}/home/`，两者都位于持久化的 `/app/data` 下。Bash 会把 `HOME` 指向 `{persona}/home/`，`cwd` 留空或填 `.`（以及 `~`）也解析到那里，因此她的默认落脚点就在挂载卷内，容器重建后依然存在。Bash 会自动加入运行时 `bin` 和 npm 全局 `bin`，并设置 `SIRIUS_RUNTIME_ROOT`、`SIRIUS_RUNTIME_BIN`、`SIRIUS_HOME`、`PIP_TARGET`、`NPM_CONFIG_PREFIX`、`PIP_CACHE_DIR` 和 `NPM_CONFIG_CACHE`。由于 `bash -lc` 会先读取 `/etc/profile`、而该文件会无条件重置 `PATH`，这些变量会在命令前奏里重新 export 一次，否则注入的运行时路径会被丢掉。运行时安装的 Python 包、npm 全局包和放入 `$SIRIUS_RUNTIME_BIN` 的用户态二进制会在容器重建后保留，例如：

```bash
python -m pip install --target "$PIP_TARGET" httpx
npm install -g prettier
curl -fsSL "$TOOL_URL" -o "$SIRIUS_RUNTIME_BIN/tool"
chmod +x "$SIRIUS_RUNTIME_BIN/tool"
```

系统包仍由当前容器发行版决定；本镜像是 Debian 系列，使用 `apt`，不是宿主机 CentOS 的 `yum`。当前服务用户不是 root，但可通过受控的 `docker exec --user root` 安装。需要持久化的包名按“一行一个包”写入全局的 `/app/data/runtime-packages/apt.txt`（CentOS/RHEL 容器则写入 `yum.txt`），更新脚本会在重建并通过健康检查后自动恢复：

```bash
docker exec --user root sirius-pulse apt-get update
docker exec --user root sirius-pulse apt-get install -y jq
printf '%s\n' jq >> /app/data/runtime-packages/apt.txt
```

清单只接受包名和整行 `#` 注释，不接受 `apt-get`、`yum` 参数或命令；系统包是整个容器共享的，不属于某个人格。

## Docker Bridge

`bash` 中的 `docker` 和 `docker-compose` 仍连接 `/run/sirius-container-admin.sock`，不会获得 `/var/run/docker.sock`。代理接受常规 Docker 命令和完整 `docker exec`，所以可以在其他容器内使用其正常 shell、读写文件和服务管理能力。只拒绝不可逆的容器/镜像/卷/网络/系统删除或清理、明显的跨容器毁灭性命令，以及 `docker run/create` 的宿主机逃逸参数；`allow_mutations: false` 仍可关闭变更操作。代理默认允许状态变更，部署方法见 Docker 部署指南。

## Developer Status

在 WebUI 的 `interaction_with_master` 配置表单中填写 MDS 公开状态令牌、服务基地址和请求超时。配置保存在 `{persona}/tool_data/interaction_with_master.json`；环境变量 `MDS_PUBLIC_STATUS_TOKEN` 和 `MDS_API_BASE_URL` 仅作为未配置时的后备。
