# 引擎架构

核心引擎由 `EmotionalGroupChatEngine` 暴露公开能力，主要实现分散在 `engine_core.py`、`pipeline.py`、`brain.py`、`prompt_factory.py`、后台任务和辅助组件中。

## 主要组件

| 组件 | 文件 | 职责 |
|---|---|---|
| `EmotionalGroupChatEngine` | `core/emotional_engine.py` | 对外最终类。 |
| `_EmotionalGroupChatEngineBase` | `core/engine_core.py` | 初始化、生命周期、公开 API 和组件持有。 |
| `Pipeline` | `core/pipeline.py` | 单条消息的五阶段处理。 |
| `Brain` | `core/brain.py` | 构造请求、调用 LLM、执行 Hook 和工具调用流程。 |
| `PromptFactory` | `core/prompt_factory.py` | 汇总人格、记忆、会话、平台上下文和风格参数。 |
| `SessionEventBus` | `core/events.py` | 会话事件发布订阅。 |

## Pipeline 五阶段

1. 感知：接收平台消息，解析发送者、群、私聊、图片、@、回复模式等。
2. 认知：结合上下文、参与策略、冷场状态、情绪与记忆信号。
3. 决策：判断是否回复、是否延迟、是否执行插件或工具。
4. 执行：调用 Brain 与 AMKR，处理工具调用，发送文本、图片或表情。
5. 后台更新：写入记忆、Token、语义画像、记忆单元和事件记录。

## Brain 调用

`Brain` 支持 `ChatRequest`、`ChatResult`、`RawRequest`、pre-hook、post-hook 和工具调用。它不选择真实模型：`ModelRouter` 把认知任务解析成 AMKR 任务名，`OpenAICompatibleProvider` 再把这个名字作为 `model` 字段发往 AMKR。除任务名外的本地参数只有超时与重试（`orchestration.json` 的 `task_timeout` / `task_retries`）。

## 工具循环与工作模式

延迟队列的一轮回复在 `core/bg_tasks_delayed.py` 里跑多轮工具调用：每轮把工具结果作为 `role="tool"` 消息追加回去，直到模型不再调用工具或到达 `max_tool_rounds`。

**工作模式**（`core/work_mode.py`）是"她独自把一件事做完"的任务态，用来把"需要连续动手的长任务"和"普通聊天"分开：普通聊天回合里 `bash`、`read_skill`、`workflow_state`、`group_file_exec` 不对模型可见，只有 `enter_work_mode` 可见；进入后重工具解锁，正文不再外发，出口是 `send_midway_msg`（对外发言）和 `quit_work_mode`（退出并把 `result` 作为回复发出）。

**自主回合与定时任务回合由框架自动进入工作模式**（`core/tool_engine_context.py` 的 `_run_tool_loop`）：它们本来就是她自己动手的时刻，重工具直接可用，过程写进同一份轨迹，只是不提供 `enter_work_mode` / `quit_work_mode`——进出由回合本身界定，原有的交付约定也不变。工作模式期间用哪个模型由任务名决定：`memory/work_mode/settings.json` 的 `task_name` 留空则沿用本回合原本的任务名，填了 `work_mode_generate` 之类的任务名就整段走它，在 AMKR 面板里把该任务名指向想要的模型即可。

工作模式期间到达的消息不进入模型上下文，而是先暂存，直到有消息点名当前人格才整批补进下一轮——这样整段工作的提示词前缀保持不变，KV 缓存得以命中。始终没被点名的那批在退出时排回延迟队列（不等去抖窗口），所以她忙完的下一轮会把工作期间攒下的话一并回掉，而不是丢掉。同理，`quit_work_mode` 的 `result` 为空不算退出（框架会要它补上），被打断的工作也一定留下一个说明，避免这一轮群里收不到任何话。每次工作的 `goal`、来源、使用的任务名、逐轮正文、工具调用与结果、`result` 都写入 `{persona}/memory/work_mode/sessions.json`，供 WebUI 的 **分析 → 工作模式** 页面查看。细节见 [内置 Tool 参考](../extensions/tool-builtin#工作模式work-mode)。
