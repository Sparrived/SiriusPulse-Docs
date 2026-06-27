# 异步延迟任务文档

## 概述

**延迟任务** 是 `sirius_pulse` 中用于处理需要隐式、异步或计划性执行的消息响应的核心模块。它通过一个独立的后台队列（`DelayedQueueTasks`）来管理消息的延迟处理和 `plan` 模式下的工具调用流。延迟任务功能允许模型在 `plan` 模式下执行多步私有思考，然后通过 `exit_plan` 或 `abort_plan` 返回结果，同时支持在普通聊天中查询或更新隐藏计划的公开进度。

## 配置

延迟任务的行为由`sirius_pulse/config`中的策略对象控制。在 `OrchestrationPolicy` 中新增了以下配置项：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `plan_mode_chat_awareness_enabled` | bool | `false` | 当启用时，在普通聊天（非 plan 模式）的 prompt 中注入当前活跃隐藏计划的公开进度快照。 |

其他相关配置项（如 `plan_mode_enabled`、`plan_mode_limit_normal_tools` 等）沿用已有定义。

## 使用方式

### 进入 / 退出 Plan 模式

- `enter_plan`：在消息中调用该工具（需配置 `plan_mode_enabled` 为 true）可以启动一个隐藏计划会话。模型随后进入 plan 模式，所有后续工具调用（除 `exit_plan`、`abort_plan`、`update_plan_progress` 外）均为私有，不直接发送文本。
- `exit_plan`：模型调用该工具将结束计划并输出最终回复。
- `abort_plan`：模型调用该工具将放弃计划，不输出最终回复（或输出空回复）。

### 查询计划状态

在普通聊天（非 plan 模式）中，如果组内存在活跃的隐藏计划，模型可以选择调用 `get_plan_status` 工具来获取公开进度快照。该工具无参数，返回格式化的公开状态信息，不会暴露私有推理或工具细节。

### 更新计划进度

在 plan 模式下，模型可以调用 `update_plan_progress` 工具来更新隐藏计划的公开进度快照。该工具接受以下参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `phase` | string | 否 | - | 公开阶段标签，如 "searching"、"analyzing"、"verifying"。长度不超过32字符。 |
| `summary` | string | 否 | - | 公开进度摘要，不应包含隐私信息。 |
| `confidence` | enum ["low", "medium", "high"] | 否 | - | 公开的当前进度置信度。 |
| `visible` | boolean | 否 | true | 该快照是否允许在普通聊天中展示。 |

更新成功后，模型会收到一条工具返回消息，内容为 "Public planning progress updated."。

## 架构说明

### 核心文件

- `sirius_pulse/core/bg_tasks_delayed.py`：主处理类 `DelayedQueueTasks`，负责管理消息的延迟处理和 plan 模式下的工具调用循环。
- `sirius_pulse/core/plan_runtime.py`：定义了 `PlanSession` 数据结构（包含 `public_phase`、`public_summary`、`public_confidence`、`public_updated_at`、`public_visible` 等字段）以及 `update_plan_progress` 函数。

### 工作流程

1. 普通消息进入 `DelayedQueueTasks` 的处理循环。
2. 如果启用了 `plan_mode_enabled` 且当前不是 plan 模式，模型可能调用 `enter_plan` 进入 plan 模式。
3. 进入 plan 模式后，循环会创建一个 `PlanSession`，模型可以调用私有工具（如搜索、分析）以及 `update_plan_progress` 来记录公开进度。
4. 模型调用 `exit_plan` 或 `abort_plan` 退出 plan 模式，同时 `finish_plan_session` 被调用以清理会话。
5. 在普通聊天中，如果存在活跃的隐藏计划且配置了 `plan_mode_chat_awareness_enabled`，则系统 prompt 会自动注入该计划的公开状态快照。
6. 模型也可以主动通过 `get_plan_status` 工具查询公开进度。

### 新增工具定义

在 `bg_tasks_delayed.py` 中定义了两个新工具：

- `UPDATE_PLAN_PROGRESS_TOOL_DEF`：用于更新公开进度。
- `GET_PLAN_STATUS_TOOL_DEF`：用于获取公开状态。

这些工具的名称被添加到 `PLAN_CONTROL_TOOL_NAMES` 集合中。

## 示例

### 配置示例（config.jsonc）

```json
{
  "orchestration": {
    "plan_mode_enabled": true,
    "plan_mode_chat_awareness_enabled": true
  }
}
```

### 在普通聊天中查询计划状态

用户消息："你在做什么？"
模型调用 `get_plan_status`，系统返回类似：

```
Phase: analyzing
Summary: Gathering information from web sources
Confidence: medium
Updated at: 2025-04-01T10:30:00Z
Visible: true
```

### 在 plan 模式下更新进度

模型在私有推理过程中调用 `update_plan_progress`：

```json
{
  "name": "update_plan_progress",
  "arguments": {
    "phase": "verifying",
    "summary": "Cross-checking sources with official data",
    "confidence": "high"
  }
}
```

工具返回确认后，模型继续处理。

## 注意事项

- 公开进度快照不应包含私有推理、工具结果、密钥或待发送的聊天文本。模型应仅使用 `update_plan_progress` 发布安全的摘要信息。
- 当 `plan_mode_chat_awareness_enabled` 为 true 时，系统 prompt 会附加额外的上下文，可能影响模型行为。
- `get_plan_status` 仅在普通聊天中存在活跃计划时可用；如果无活跃计划，工具返回提示信息。