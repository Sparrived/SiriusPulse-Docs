# 计划运行时模块 (Plan Runtime)

计划运行时（Plan Runtime）是 SiriusPulse 中负责管理隐藏计划执行状态的核心模块。它提供了计划会话的生命周期管理、进度更新、状态查询以及计划感知（Chat Awareness）功能，使普通聊天能获知计划进展的同时保护私有推理细节。

## 配置项

计划运行时相关的配置项位于 `orchestration` 命名空间下，通过 `OrchestrationPolicy` 数据类定义。

### `plan_mode_chat_awareness_enabled`

- **类型**: `bool`
- **默认值**: `false`
- **说明**: 启用后，当有激活的隐藏计划时，会将计划的公开进度快照注入到普通聊天的系统提示中。该快照仅包含阶段、摘要、信心等公开信息，不包含私有推理或工具结果。

### 其他相关配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `plan_mode_enabled` | bool | false | 是否启用计划模式 |
| `plan_mode_limit_normal_tools` | bool | false | 计划模式下是否限制普通工具 |
| `plan_mode_allow_light_chat` | bool | true | 计划激活时是否允许无关闲聊 |
| `plan_mode_presence_enabled` | bool | false | 是否发送代表身份的状态消息 |
| `plan_mode_presence_min_interval_seconds` | float | 45.0 | 状态消息最小间隔（秒） |

## 计划会话 (PlanSession)

计划会话是隐藏计划执行期间的核心数据结构，包含以下公开字段用于进度追踪：

- `public_phase`: 当前阶段（如 `searching`, `analyzing`, `verifying`）
- `public_summary`: 公开摘要文本
- `public_confidence`: 信心水平（`low`/`medium`/`high`）
- `public_updated_at`: 最后更新时间（ISO 8601）
- `public_visible`: 是否允许在聊天中展示该快照

会话在创建时自动填充 `public_summary` 为计划的原因/目标。

## 工具定义

计划运行时暴露以下工具供模型调用，用于更新和查询计划状态：

### `update_plan_progress`

更新当前激活计划的公开进度快照。此工具不会发送聊天消息，并且**禁止**包含私有推理、工具结果、密钥或待发送消息文本。

**参数**:

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `phase` | string | 是 | 公开的阶段标签，例如 `searching`、`analyzing`、`verifying`，长度不超过32字符 |
| `summary` | string | 是 | 简要的公开进度摘要，安全用于普通聊天感知 |
| `confidence` | string | 是 | 公开的信心水平，可选值：`low`、`medium`、`high` |
| `visible` | boolean | 否 | 是否允许在聊天中展示该快照，默认 `true` |

**示例**:

```json
{
  "phase": "searching",
  "summary": "正在搜索相关文档和代码示例...",
  "confidence": "medium",
  "visible": true
}
```

### `get_plan_status`

读取当前群组中激活计划的公开状态快照。仅返回公开进度，私有推理和工具细节不会被暴露。

**参数**: 无

**返回值示例**:

```
当前计划阶段：searching
摘要：正在搜索相关文档和代码示例...
信心：medium
更新时间：2025-04-03T12:34:56Z
```

如果无激活计划，则返回 `No active hidden planning session in this group.`。

## 运行机制

### 计划感知注入 (Chat Awareness)

当满足以下条件时，计划运行时会自动将计划快照注入到普通聊天提示中：

1. `plan_mode_enabled` 为 `true`
2. 当前请求的初始车道不是 `plan`（即普通聊天）
3. 存在激活的计划会话
4. 配置 `plan_mode_chat_awareness_enabled` 为 `true`

注入方式为在系统提示末尾追加 `format_public_plan_status()` 生成的内容，包含阶段、摘要、信心和更新时间。

### 进度更新流程

1. 模型在计划模式下可调用 `update_plan_progress` 工具更新公开快照。
2. 工具调用后，`plan_runtime.update_plan_progress()` 函数会验证并存储字段：
   - `phase` 长度限制为 32 字符
   - `summary`、`confidence` 按需更新
   - `public_updated_at` 自动设为当前时间
3. 若没有激活的计划会话，工具返回 `No active hidden planning session to update.`

### 状态查询流程

- 在非计划模式下，如果群组中存在激活计划，模型可以调用 `get_plan_status` 工具获取公开状态。
- 工具返回格式化文本，模型应据此自然回答用户询问，并避免重复调用。

### 会话生命周期

- **创建**: 通过 `enter_plan` 工具触发，`start_plan_session()` 初始化会话。
- **更新**: 通过 `update_plan_progress` 更新公开字段。
- **中断**: 如果达到最大轮次且未正常退出，会话状态会被设为 `aborted`，并发送最终回复。
- **结束**: 通过 `exit_plan` 或 `abort_plan` 工具正常结束。

## 安全考量

- 所有公开字段（`public_phase`、`public_summary` 等）必须视为可安全展示给用户的文本，不允许包含敏感信息。
- 工具提示中明确禁止注入私有推理、工具结果或待发送消息。
- `format_public_plan_status()` 函数仅提取公开字段，不暴露任何私有事件。