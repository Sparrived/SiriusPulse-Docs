# bg-tasks-delayed 模块

## 概述

`bg-tasks-delayed` 模块负责管理**延迟队列**中的任务处理。它作为 `BackgroundTasks` 的子组件，被独立抽取出来以提供更清晰的责任划分。该模块的核心类是 `DelayedQueueTasks`，它从延迟队列中取出待处理的消息，执行多轮对话、技能调用，并支持**流程控制工具**（`continue` / `stop`），使机器人在同一次轮次中可以发送多条消息或提前结束回复。

## 关键职责

- 从延迟队列中提取待处理的消息项。
- 根据策略决策（`strategy_decision`）决定如何处理消息（即时响应、延迟、丢弃等）。
- 处理多轮对话，支持调用技能和内置流程控制工具。
- 管理消息内容的去重（`_seen_contents`），防止在 `continue` 工具触发时重复注入已发送的消息。
- 自动发送 stickers（贴纸）、处理多模态内容。

## 核心类：`DelayedQueueTasks`

### 初始化

```python
class DelayedQueueTasks:
    def __init__(self, engine: Any) -> None:
        self._engine = engine
```

构造函数接收引擎实例，引擎中应包含 `_skill_registry`、`_skill_executor`、消息助手、用户管理器等组件。

### 主要方法

#### `async def process_delayed_item(self, item: dict) -> dict`

处理单个延迟队列项。
- 从 `item` 中提取 `user_id`、`group_id`、`message_content`、`strategy_decision`、`candidate_memories`、`enqueue_time`、`window_seconds` 等字段。
- 根据 `strategy_decision` 决定是否立即处理。
- 调用 `_process_with_strategy` 启动多轮对话循环。
- 返回包含 `reply`、`sticker_names`、`should_send` 等信息的字典。

#### `async def _process_with_strategy(self, ...)`

内部方法，执行实际的多轮对话处理。
- 构造初始消息列表，包含系统提示、记忆上下文、用户消息。
- 循环调用聊天引擎（`chat_async`），并在每次调用后解析工具调用。
- 支持 `continue` 和 `stop` 两个流程控制工具。
  - `continue`：将当前文字回复立即发送给用户，然后继续生成下一条。
  - `stop`：结束本轮回复，最后一条文字消息被发送。
- 如果没有调用任何工具，则自动视为 `stop`（结束循环）。
- 执行普通技能调用（如 `send_sticker`、自定义技能），并根据技能是否 `silent` 决定是否发送文字。
- 记录每轮结果，确保最大轮次限制（`max_rounds`）。

### 工具定义

模块中定义了两个内置流程控制工具：

- **`CONTINUE_TOOL_DEF`**：工具名 `continue`，用于发送当前回复后继续生成。参数固定为 `{"action": "continue"}`。
- **`STOP_TOOL_DEF`**：工具名 `stop`，用于结束本轮回复。参数固定为 `{"action": "stop"}`。

这些工具通过 `_extra_tools` 参数传递给聊天引擎，使模型能够主动控制发送节奏。

### 辅助方法

#### `def _is_autonomous_message_skill(self, skill) -> bool`

判断技能是否为“自主消息技能”（如 `send_text`、`send_sticker`），这些技能即使互动不足也可执行。

#### `def _get_item_context_info(self, item: dict) -> tuple`

从 `item` 中提取 `user_id`、`group_id`、`message_content`、`strategy_decision` 等上下文信息。

## 工作流程

1. **后台调度**：`BackgroundTasks` 定时从延迟队列中获取待处理项目（`get_delayed_items`）。
2. **策略决策**：每个项目携带 `strategy_decision`，决定是否立即处理。
3. **消息组装**：构建对话消息列表，包含系统提示、用户上下文、当前用户消息。
4. **多轮循环**：
   - 调用 LLM 获取回复。
   - 解析回复中的工具调用。
   - 分离流程控制工具和普通技能。
   - 根据流程控制决定：
     - 发送当前文字（如非 silent 技能）。
     - 若 `continue` 被调用，继续下一轮。
     - 若 `stop` 被调用或无需工具调用，结束循环。
   - 执行普通技能，将结果追加到消息列表。
5. **执行结果**：
   - 收集 `sticker_names` 和 `skill_multimodal` 内容。
   - 返回最终回复文本和执行状态。

## 与 `BackgroundTasks` 的关系

`BackgroundTasks` 是总的后台任务管理器，它持有 `DelayedQueueTasks` 实例（通过 `_delayed_tasks` 属性引用）。在 `BackgroundTasks.start()` 中启动周期性任务时，会调用 `DelayedQueueTasks` 的相关方法轮询延迟队列。模块化后，`BackgroundTasks` 不再处理延迟队列的具体逻辑，而是委托给 `DelayedQueueTasks`。

## 配置要求

- LLM 聊天引擎支持 `extra_tools` 参数传递。
- 技能注册表（`skill_registry`）需包含至少 `continue` 和 `stop` 对应的定义（尽管它们是内置工具，由模块直接提供定义）。
- 延迟队列（`delayed_response_queue`）需实现 `get_delayed_items` 接口。

## 注意事项

- 流程控制工具只能在启用 `enable_skills=True` 时使用。
- 每轮对话的轮次上限由 `max_rounds` 参数控制，默认通常为 5。
- 消息去重机制基于 `_seen_contents` 集合，防止同一消息在 `continue` 后重复注入。
- `emotion_state` 字段目前已被移除，不再作为处理参数。