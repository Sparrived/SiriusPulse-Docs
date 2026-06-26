# 延迟任务处理模块 (bg_tasks_delayed)

## 概述

`bg_tasks_delayed` 是 Sirius Pulse 的核心模块之一，负责处理**延迟队列**中的消息和事件。延迟队列允许消息在特定时间窗口内被暂存、聚合后再触发回复。该模块当前已集成**隐藏规划模式（Plan Mode）**，支持在普通聊天过程中发起私密的多步规划会话，使复杂请求的处理不干扰群聊的轻量氛围。

## 核心职责

- **定时检查**：定期扫描各群组的延迟队列，找出已到期的消息项。
- **触发回复**：将到期项合并为一个提示词，调用引擎生成回复。
- **流程控制**：管理 `continue` / `stop` 等内置工具，控制多轮技能调用的结束。
- **规划模式集成**：提供 `enter_plan` / `exit_plan` / `abort_plan` 工具，用于在隐蔽会话中执行复杂推理和工具链。
- **角色状态感知**：可选地在规划模式进入或更新时向群聊发送角色风格的短状态消息（presence）。

## 配置项

规划模式相关的配置在 `OrchestrationPolicy` 中定义，可通过 `orchestration.*` JSONC 键设置：

| 配置键 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `plan_mode_enabled` | bool | `false` | 是否启用隐藏规划模式 |
| `plan_mode_limit_normal_tools` | bool | `false` | 启用规划模式后，是否限制普通聊天只能使用轻量运行时工具 |
| `plan_mode_allow_light_chat` | bool | `true` | 在规划进行中是否允许群聊中的无关轻聊 |
| `plan_mode_presence_enabled` | bool | `false` | 规划开始或更新时是否发送角色状态消息 |
| `plan_mode_presence_min_interval_seconds` | float | 45.0 | 两次状态消息之间的最小间隔（秒） |
| `plan_mode_presence_enter_message` | string | “我看到了，这个得稍微捋一下。” | 进入规划模式时发送的文本 |
| `plan_mode_presence_update_message` | string | “补充我看到了，我会按新的前提来。” | 规划事件到达时发送的更新文本 |

配置示例：

```jsonc
{
  "orchestration": {
    "plan_mode_enabled": true,
    "plan_mode_limit_normal_tools": true,
    "plan_mode_presence_enabled": true,
    "plan_mode_presence_enter_message": "让我仔细想想……",
    "plan_mode_presence_update_message": "嗯，有了新的信息，我调整一下方案。"
  }
}
```

## 内部工具定义

该模块定义了三个规划控制工具，允许模型自主进入、退出和终止规划会话：

### `enter_plan`

- **用途**：进入隐藏规划模式，执行多步工具调用或复杂逻辑。
- **参数**：
  - `goal`（string，必填）：规划的具体目标。
  - `reason`（string，可选）：为何需要规划模式的简短理由。
- **行为**：启动一个新的规划会话（`start_plan_session`），此后模型的中间输出不会发送到群聊，直到调用 `exit_plan`。

### `exit_plan`

- **用途**：退出规划模式，可选择发送一条最终消息到群聊。
- **参数**：
  - `final_message`（string，必填）：最终的可见消息内容。
  - `send_to_group`（boolean，默认 `true`）：是否将 `final_message` 发送到群聊。
  - `summary`（string，可选）：私有执行摘要（仅日志）。
- **行为**：结束规划会话（`finish_plan_session`），将最终消息通过正常回复通道发送。

### `abort_plan`

- **用途**：中止规划模式，例如任务被取消或无法安全完成。
- **参数**：
  - `reason`（string，可选）：中止的私有原因。
  - `message`（string，可选）：可选的可见消息发送到群聊。
  - `send_to_group`（boolean，默认 `false`）：是否发送 `message`。
- **行为**：清理规划会话，模型返回正常聊天模式。

## 关键执行流程

### 正常延迟任务处理

1. `tick_delayed_queue` 方法被定时调用，针对给定 `group_id`。
2. 从延迟队列中查询到期的项（`get_and_ack_expired_items`）。
3. 如果当前没有活跃的规划会话且配置允许，构建提示词时可能附加“计划模式”说明。
4. 调用引擎生成回复（`chat_or_summarize`），内置 `continue` / `stop` 工具。
5. 如果引擎返回 `continue`，将工具调用结果注入上下文，重新进入生成循环。
6. 循环直至 `stop` 或达到最大轮次。

### 规划模式下的流程

1. 模型在普通聊天中调用 `enter_plan` 工具。
2. 系统创建一个隐藏规划会话，`plan_id` 与当前消息项关联。
3. 后续生成循环切换到规划模式：工具集替换为 `exit_plan` / `abort_plan`，普通技能可用性由配置决定。
4. 模型在规划会话内执行多步推理和工具调用，每次事件都通过 `consume_plan_events` 获取并作为新用户消息注入。
5. 可选地，每次事件到达时通过 `_maybe_send_plan_presence` 发送角色状态消息（受最短间隔限制）。
6. 模型调用 `exit_plan` 输出最终消息，或 `abort_plan` 放弃。规划会话随即结束。
7. 如果规划会话因非 `active` 状态被退出，系统自动终止循环且不发送消息。

## 注意事项

- 规划模式启用后，若 `plan_mode_limit_normal_tools` 为 `true`，普通聊天将不会暴露技能工具，只有 `enter_plan` 等控制工具可用。
- 规划会话的生命周期与 `DelayedQueueTasks` 实例绑定，每个群组最多同时存在一个活跃规划会话。
- 规划 presence 消息依赖于 `engine` 对象上的 `_plan_presence_sent_at` 属性，该属性在内存中记录发送时间。
- 所有工具定义（`ENTER_PLAN_TOOL_DEF` 等）均为静态字典，可被 PromptFactory 或其他组装器使用。

## 相关文件

- `sirius_pulse/core/bg_tasks_delayed.py`：本模块主文件。
- `sirius_pulse/core/plan_runtime.py`：提供规划会话的启动、结束、事件推送等原语。
- `sirius_pulse/core/delayed_response_queue.py`：延迟队列的基础管理。
- `sirius_pulse/config/models.py`：`OrchestrationPolicy` 数据类。
- `sirius_pulse/config/jsonc.py`：配置加载与注释。
- `sirius_pulse/config/helpers.py`：配置字典构建。

## 变更历史

- **新增**：隐藏规划模式完整支持，包括三个控制工具、presence 机制、普通聊天工具限制。
- **变更**：`tick_delayed_queue` 循环增加了 `plan_mode`、`plan_session` 相关逻辑。
- **新增**：`_maybe_send_plan_presence` 方法。