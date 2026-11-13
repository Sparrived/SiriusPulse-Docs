# 编写自定义 Tool

外部 Tool 由每个人格独立发现，建议放在 `data/personas/<name>/tools/` 下；它们不属于核心 Python 包，也不会随外部 Plugin submodule 共享。

```python
from sirius_pulse.tools.models import ToolResult

TOOL_META = {
    "name": "echo_text",
    "description": "原样返回一段文本。",
    "parameters": [
        {"name": "text", "type": "string", "description": "要返回的文本", "required": True}
    ],
}

async def run(text: str, **kwargs):
    return ToolResult.ok(data={"text": text}, text=f"收到：{text}")
```

元数据写给模型看，应说明何时使用、参数边界和权限限制。

## 行为声明

框架怎么对待一个 Tool，只看它在 `TOOL_META` 里声明了什么，不看它叫什么名字。下列字段都是可选的：

| 字段 | 默认 | 作用 |
|---|---|---|
| `side_effect` | `unknown` | `read_only` / `external_write` / `destructive`。非只读的调用同一轮里按参数去重；`external_write` 与 `destructive` 在她自己发起的（自主）回合里会被拒绝。 |
| `retry_safe` | `false` | 遇到超时、连接错误等暂时性失败时，执行器可以自动重试。 |
| `silent` | `false` | 这次调用本身就是回复（例如发了一张图）：同轮伴随的正文不再单独发出。 |
| `allowed_when_self_initiated` | `false` | 即使有外部副作用，也允许在自主回合里使用（只记录、不投递的工具）。 |
| `work_mode_only` | `false` | 重工具：只在工作模式里出现在工具列表中，普通聊天只看得到 `enter_work_mode`。 |
| `redact_logs` | `false` | 参数与结果不进通用日志、遥测和 AgentTurn 摘要（人物资料、私有资产、小本）。 |
| `chat_scoped` | `false` | 只读写某个具体聊天里的内容：没有可信聊天来源的自主回合既看不到也调不了。 |
| `action_param` | `"action"` | 多 action 工具里，哪个参数表示 action。 |
| `actions` | `{}` | 按 action 覆盖上面的 `side_effect` / `retry_safe` / `silent` / `engagement_exempt`，例如 `{"status": {"side_effect": "read_only", "retry_safe": True}}`。 |

下面这些会**放宽**权限，只对包内内置 Tool（`sirius_pulse/tools/builtin/`）生效；工作区里的 Tool 即使同名、照抄同样的声明也拿不到：

| 字段 | 作用 |
|---|---|
| `engagement_exempt` | 不受互动门槛限制：群里互动很少的人触发也照常执行。 |
| `request_source` | 调用要收窄到本回合已接纳的那条指令的作者，再按作者判断权限。 |
| `request_source_params` | 与 `request_source` 搭配：只有这些参数之一有值时才需要绑定来源（例如生图只在画具体人物时）。 |
| `bookkeeping` | 她私人的记录工具：同轮正文只是草稿不发出；整轮只调它时写完直接作答。 |

内置 Tool 还可以在模块里导出两个钩子：`request_source_optional(params) -> bool`（按明确 ID 查找时可以不选来源，保留调用者做范围判断但不授予写权限），以及 `after_success(result, *, engine_context, group_id)`（成功后在事件循环上调用；`run()` 可能在线程里执行，需要排期后台工作的放这里）。投递成功的内置 Tool 可以在结果的 `internal_metadata["history_receipt"]` 里给出 `content` / `tags` / `platform_message_id`，框架会把它写进聊天历史，让她下一轮知道已经发过。
