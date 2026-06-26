# Plan Runtime 文档

## 概述

`plan_runtime` 是 Sirius Pulse 系统中用于实现隐藏规划模式（Hidden Planning Mode）的核心模块。它允许 AI 模型在聊天环境中启动一个私有的规划会话（plan session），在该会话中执行复杂的多步骤工具调用、推理或后台工作，而不会将中间过程暴露给群聊用户。规划完成后，模型可以选择输出一个最终回复给用户，或者终止规划。该模块与 `DelayedQueueTasks` 集成，提供工具定义、会话管理和事件消费功能。

## 关键概念

- **规划会话（Plan Session）**：一个由 `start_plan_session` 创建的私有运行环境，具有独立的状态、事件队列和生命周期（active / finished / aborted）。
- **规划事件（Plan Event）**：在规划会话过程中产生的状态变更或中间信息，通过 `consume_plan_events` 获取并格式化为模型可以消费的文本。
- **规划工具（Plan Tools）**：一组特殊工具（`enter_plan`, `exit_plan`, `abort_plan`），用于控制规划会话的进入、退出和终止。

## 配置

规划模式的行为由 `OrchestrationPolicy` 中的 `plan_mode_*` 字段控制。这些字段可通过 JSONC 配置文件或代码中的 `build_orchestration_policy_from_dict` 设置。

### 配置字段及默认值

| 字段名 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `plan_mode_enabled` | bool | `false` | 是否启用隐藏规划模式。 |
| `plan_mode_limit_normal_tools` | bool | `false` | 启用规划模式后，是否限制普通聊天仅能使用轻量工具（不暴露完整技能）。 |
| `plan_mode_allow_light_chat` | bool | `true` | 允许在规划活跃期间进行无关的轻量聊天。 |
| `plan_mode_presence_enabled` | bool | `false` | 是否在隐藏规划开始时发送一条简短的角色状态消息。 |
| `plan_mode_presence_min_interval_seconds` | float | `45.0` | 规划状态消息的最小发送间隔（秒）。 |
| `plan_mode_presence_enter_message` | str | `"我看到了，这个得稍微捋一下。"` | 进入隐藏规划模式时发送的可见状态文本。 |
| `plan_mode_presence_update_message` | str | `"补充我看到了，我会按新的前提来。"` | 接收到规划事件时发送的可见状态文本。 |

### 配置示例（JSONC）

```jsonc
{
  "orchestration": {
    "plan_mode_enabled": true,
    "plan_mode_limit_normal_tools": true,
    "plan_mode_allow_light_chat": true,
    "plan_mode_presence_enabled": true,
    "plan_mode_presence_min_interval_seconds": 30,
    "plan_mode_presence_enter_message": "让我想想...",
    "plan_mode_presence_update_message": "收到更新，我会重新考虑。"
  }
}
```

## 架构与函数

`plan_runtime` 模块提供以下核心函数（位于 `sirius_pulse/core/plan_runtime.py`）：

### `start_plan_session(group_id: str, goal: str) -> PlanSession`
- **描述**：为指定群聊创建一个新的规划会话，并返回会话对象。
- **参数**：`group_id` 群聊唯一标识，`goal` 规划的具体目标描述。
- **返回值**：`PlanSession` 实例，包含会话 ID、状态、事件队列等。

### `consume_plan_events(session: PlanSession) -> list[PlanEvent]`
- **描述**：消费规划会话中累积的所有待处理事件，并清空事件队列。
- **参数**：当前规划会话对象。
- **返回值**：待处理事件列表。

### `format_plan_events_for_model(events: list[PlanEvent]) -> str`
- **描述**：将规划事件列表格式化为适合注入到模型消息中的纯文本。
- **参数**：事件列表（通常来自 `consume_plan_events`）。
- **返回值**：格式化后的字符串，例如 `"[规划事件] 步骤1 完成\n[规划事件] 步骤2 完成"`。

### `finish_plan_session(session: PlanSession)`
- **描述**：结束规划会话，将状态标记为 finished。
- **参数**：规划会话对象。

### `abort_plan_session(session: PlanSession)`
- **描述**：终止规划会话，将状态标记为 aborted。
- **参数**：规划会话对象。

## 工具定义

以下是规划模式专用的工具定义（位于 `bg_tasks_delayed.py`）：

### enter_plan
- **名称**：`enter_plan`
- **描述**：进入隐藏规划模式用于复杂请求。当任务需要多次工具调用或进行仔细的幕后工作时使用。规划模式中的中间文本是私有的，调用 `exit_plan` 以发送最终消息。
- **参数**：
  - `goal`（string，必需）：隐藏规划会话的具体目标。
  - `reason`（string，可选）：需要规划模式的简短理由。

### exit_plan
- **名称**：`exit_plan`
- **描述**：退出隐藏规划模式，可选择向聊天发送一条最终消息。
- **参数**：
  - `final_message`（string，必需）：要发送到聊天室的最终可见消息。
  - `send_to_group`（boolean，可选，默认 true）：`final_message` 是否应被发送。
  - `summary`（string，可选）：用于日志的私有执行摘要。

### abort_plan
- **名称**：`abort_plan`
- **描述**：当任务不应继续、被取消或无法安全完成时，中止隐藏规划模式。
- **参数**：
  - `reason`（string，可选）：中止规划的私有原因。
  - `message`（string，可选）：要发送到聊天室的可见消息。
  - `send_to_group`（boolean，可选，默认 false）：是否发送可选消息。

## 使用流程

1. **启用规划模式**：在配置中设置 `plan_mode_enabled: true`。
2. **普通聊天阶段**：如果 `plan_mode_limit_normal_tools` 为 true，则普通聊天只暴露轻量工具，并且系统提示会包含指引：当请求需要复杂操作时调用 `enter_plan`。
3. **进入规划**：模型在生成回复时识别到需要复杂推理，调用 `enter_plan` 工具。系统创建一个新的规划会话，并将配置的状态消息（如果 `plan_mode_presence_enabled` 为 true）发送到群聊。
4. **规划执行**：模型继续在私有上下文中接收规划事件（通过 `consume_plan_events` 和 `format_plan_events_for_model` 注入）。模型可以调用任何可用的技能工具，所有中间结果通过规划事件反馈给模型。
5. **退出规划**：模型通过调用 `exit_plan` 完成规划，并提供最终可见消息。系统结束规划会话，并将最终消息发送至群聊。如果调用 `abort_plan`，则规划被终止，可选发送取消消息。
6. **限制**：在同一群聊中，同一时间只能有一个活动规划会话。如果规划会话已存在，普通聊天无法再次调用 `enter_plan`，直到当前规划被结束或中止。

## 注意事项

- 规划模式与延迟队列集成：规划会话的生命周期受 `DelayedQueueTasks` 管理，确保在 tick 循环中正确处理规划事件。
- `plan_mode_limit_normal_tools` 可防止普通聊天使用完整技能，避免无意中触发复杂行为。
- 规划状态消息的发送受 `plan_mode_presence_min_interval_seconds` 间隔限制，避免刷屏。
- 如果 `plan_mode_allow_light_chat` 为 true，即使规划活跃，普通聊天也能正常进行（仅轻量工具可用）。

## 测试

测试文件 `tests/test_plan_runtime.py` 覆盖了规划会话的创建、事件消费、格式化和生命周期管理。

## 相关文件

- `sirius_pulse/core/plan_runtime.py`：模块实现。
- `sirius_pulse/core/bg_tasks_delayed.py`：工具定义和规划模式集成。
- `sirius_pulse/config/models.py`：`OrchestrationPolicy` 中的配置字段。
- `sirius_pulse/config/helpers.py`：配置构建函数。
- `sirius_pulse/config/jsonc.py`：注释和默认配置。
- `sirius_pulse/core/delayed_response_queue.py`：`DelayedResponseItem` 新增 `lane` 和 `plan_id` 字段。