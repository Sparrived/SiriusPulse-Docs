# Brain API 参考

Brain 是 LLM 交互中枢，负责对话生成、模型路由、人格注入、语气对齐等核心能力。框架提供了 PreHook / PostHook 扩展机制，允许在 LLM 生成前后介入处理。

## 使用方式

```python
# 从顶层导入（推荐）
from sirius_pulse import Brain, PreHook, PostHook, ChatRequest, ChatResult

# 快捷类型别名
from sirius_pulse import PreHook, PostHook
```

---

## Brain 类

引擎内部持有的单例，外部通过 `engine.brain` 访问。提供两个调用通道。

### 对话生成：chat()

```python
async def chat(self, request: ChatRequest) -> ChatResult
```

上下文感知的对话生成，走完整管线。调用之间通过 `asyncio.Lock` 串行化，保证消息处理顺序。

**处理链（按执行顺序）：**

| 阶段 | 步骤 | 说明 |
|:---|:---|:---|
| pre-hooks | 用户自定义 | 按 priority 升序，受 `post_process` + `task_filter` 控制 |
| 内置预处理 | 人格注入 | `persona.build_system_prompt()` + 表情包提示 |
| | 语气对齐 | 调整个性化语气风格 |
| | 时间注入 | 注入当前时间作为上下文 |
| | 模型路由 | `rhythm_analyzer` + `model_router` 选择模型 |
| | 风格覆盖 | 设置 temperature / max_tokens |
| | 构建请求 | 组装 `GenerationRequest` |
| LLM 调用 | `provider.generate_async()` | 带 transport 级重试 |
| 内置后处理 | XML 剥离 | 移除 `<conversation_history>` 等标签 |
| | SKIP 检测 | 检测 `<skip/>` 标签 |
| | SKILL_CALL 解析 | 提取 `[SKILL_CALL: ...]` 标记 |
| | 表情包解析 | 提取表情包标签 |
| | token 记录 | 记录用量 |
| post-hooks | 用户自定义 | 按 priority 升序，受 `post_process` + `task_filter` 控制 |

### 原生调用：raw_call()

```python
async def raw_call(self, request: RawRequest) -> str
```

绕过人格注入和 hook 管线的直接 LLM 调用，用于 Cognition 分析等场景。

---

## Hook 扩展机制

Hook 允许外部代码在 Brain 的 LLM 生成前后注入自定义逻辑，**不修改引擎代码**即可扩展行为。

### PreHook

在 LLM 调用前修改请求参数或注入上下文。

```python
PreHook = Callable[["Brain", ChatRequest, dict[str, Any]], None]
```

| 参数 | 说明 |
|:---|:---|
| `brain` | Brain 实例 |
| `request` | ChatRequest，可修改 system_prompt、messages 等 |
| `ctx` | 跨 hook 共享的字典，内置步骤也通过它传递中间状态 |

**使用场景：**
- 向 system_prompt 注入额外指令
- 修改 temperature / max_tokens
- 在请求中添加自定义消息
- 记录请求日志或做审计

**示例：**
```python
def inject_short_style(brain: Brain, request: ChatRequest, ctx: dict) -> None:
    """让所有回复更简短"""
    request.system_prompt += "\n\n请用简短风格回复，不超过 50 字。"
    request.max_tokens = 200

brain.register_pre_hook(inject_short_style, priority=0)
```

---

### PostHook

在 LLM 调用后处理生成结果。

```python
PostHook = Callable[["Brain", ChatRequest, ChatResult, dict[str, Any]], None]
```

| 参数 | 说明 |
|:---|:---|
| `brain` | Brain 实例 |
| `request` | 原始的 ChatRequest |
| `result` | ChatResult，可修改 clean_text、sticker_names 等 |
| `ctx` | 携带前处理阶段产生的中间状态 |

**使用场景：**
- 对生成文本做后处理过滤
- 记录生成耗时和质量指标
- 触发自定义动作（如发送表情包）
- 做回复去重或内容审核

**示例：**
```python
def log_generation_metrics(brain, request, result, ctx):
    """记录生成耗时到日志"""
    logger.info(
        "[%s] 模型=%s 耗时=%.1fms 长度=%d",
        request.task_name,
        result.model_name,
        result.duration_ms,
        len(result.clean_text),
    )

brain.register_post_hook(
    log_generation_metrics,
    priority=100,
    task_filter={"response_generate"},
)
```

---

## ChatRequest

对话生成请求参数，是 `chat()` 通道的唯一入口。

```python
@dataclass(slots=True)
class ChatRequest:
    group_id: str                    # 群 ID
    user_id: str                     # 用户 ID
    system_prompt: str               # 系统提示词
    messages: list[dict]             # 消息历史

    task_name: str = "response_generate"  # 任务名称，影响模型路由
    urgency: int = 0

    temperature: float | None = None # 覆盖默认温度
    max_tokens: int | None = None    # 覆盖默认最大 token
    style_params: StyleParams | None = None

    enable_skills: bool = True       # 是否启用 SKILL
    caller_is_developer: bool = False

    post_process: bool = False       # True=启用 hook 调度（总闸）
    retry_max: int = 1               # 最大重试次数
    retry_delay: float = 1.0         # 重试间隔（秒）
```

**关键字段说明：**
- `post_process`：hook 总闸。设为 `True` 才会触发 pre-hooks 和 post-hooks。`generate_text()` 等便捷方法默认关闭此开关。
- `task_name`：影响模型路由选择，也用于 `task_filter` 匹配。
- `enable_skills`：设为 `False` 可临时禁用 SKILL_CALL 能力。

---

## ChatResult

对话生成的结果。

```python
@dataclass(slots=True)
class ChatResult:
    raw_text: str                    # 原始模型输出
    clean_text: str                  # 后处理后的纯净文本
    model_name: str                  # 实际使用的模型名
    duration_ms: float               # 生成耗时（毫秒）
    token_record: Any                # token 用量记录
    system_prompt: str               # 本次对话使用的完整 system prompt
    sticker_names: list[str]         # 识别的表情包名
    injected_tool_names: list[str]   # 注入的工具名称列表
    has_skill_call: bool             # 是否包含 SKILL_CALL
    skill_calls: list[tuple[str, dict]]  # 提取的 SKILL_CALL 列表
```

**hook 中可修改的字段：** `clean_text` 和 `sticker_names` 可以在 post-hook 中修改，影响最终输出。

---

## 注册 API

### register_pre_hook

```python
def register_pre_hook(
    self,
    hook: PreHook,
    priority: int = 0,
    task_filter: set[str] | None = None,
) -> None
```

### register_post_hook

```python
def register_post_hook(
    self,
    hook: PostHook,
    priority: int = 100,
    task_filter: set[str] | None = None,
) -> None
```

### 参数说明

| 参数 | 说明 |
|:---|:---|
| `hook` | PreHook / PostHook 回调函数 |
| `priority` | 优先级，值越大越晚执行 |
| `task_filter` | 任务名称过滤，`None` 表示对所有任务生效 |

### 默认优先级表

**pre-hooks：**

| 优先级 | 角色 | 说明 |
|:---|:---|:---|
| 0 | 用户自定义 | 最先执行 |
| 50 | 引擎内置 | 人格注入、语气对齐等 |

**post-hooks（引擎内置 5 个）：**

| 优先级 | hook 名 | 行为 | task_filter |
|:---|:---|:---|:---|
| 0 | `_hook_depth` | 更新对话深度 | `response_generate`, `proactive_generate` |
| 20 | `_hook_stickers` | 异步发送表情包 | `response_generate`, `proactive_generate` |
| 30 | `_hook_dedup` | 文本相似度去重 | `response_generate` |
| 40 | `_hook_memory` | 写入记忆 | `response_generate`, `proactive_generate` |
| 50 | `_hook_timestamp` | 更新回复时间戳 | `response_generate`, `proactive_generate` |
| 100 | 用户自定义 | 最后执行 | 由用户指定 |

---

## 完整示例

### 1. 群聊内容审核

```python
from sirius_pulse import PreHook, PostHook

def pre_filter(brain, request, ctx):
    """前置过滤：检测敏感词"""
    last_msg = request.messages[-1]["content"] if request.messages else ""
    if "敏感词" in last_msg:
        ctx["blocked"] = True
        request.system_prompt = "请回复：该消息包含敏感内容，无法处理。"
        request.max_tokens = 50

def post_audit(brain, request, result, ctx):
    """后置审核：记录高风险回复"""
    if ctx.get("blocked"):
        logger.warning("已拦截含敏感词的请求: group=%s", request.group_id)
    if "违规内容" in result.clean_text:
        result.clean_text = "[该回复已被审核拦截]"

brain.register_pre_hook(pre_filter, priority=0)
brain.register_post_hook(post_audit, priority=90)
```

### 2. 调试日志

```python
def debug_log(brain, request, result, ctx):
    """记录每次 LLM 调用的完整信息"""
    print(f"[Brain] task={request.task_name} model={result.model_name}")
    print(f"[Brain]   prompt_len={sum(len(m.get('content','')) for m in request.messages)}")
    print(f"[Brain]   reply_len={len(result.clean_text)} duration={result.duration_ms:.0f}ms")
    print(f"[Brain]   skill_calls={result.skill_calls}")

brain.register_post_hook(debug_log, priority=100)
```

### 3. 多语言翻译桥接

```python
from sirius_pulse import PreHook

def auto_translate(brain, request, ctx):
    """自动将群聊中的英文消息翻译为中文回复"""
    last_msg = request.messages[-1]["content"] if request.messages else ""
    if last_msg and all(ord(c) < 128 for c in last_msg):
        request.system_prompt += "\n用户发来了英文消息，请用中文回复。"
        ctx["translated"] = True

brain.register_pre_hook(auto_translate, priority=0)
```

---

## 注意事项

| 要点 | 说明 |
|:---|:---|
| **hook 是同步函数** | 签名返回 `None`，不能直接 `await`。如需异步操作，使用 `asyncio.create_task` |
| **post_process 总闸** | `ChatRequest.post_process=False` 时所有 hook 完全跳过。`generate_text()` 便捷方法默认关闭此开关，且返回 clean_text（经过后处理的纯净文本）。 |
| **仅 chat() 通道生效** | `raw_call()` 通道没有任何 hook，人格注入和后处理也全部跳过 |
| **task_filter 路由** | 设为 `{"response_generate"}` 可让 hook 仅在 AI 回复生成时触发，不影响分析任务 |
| **ctx 字典生命周期** | 每次 `chat()` 调用创建一个新的空字典，pre-hook 写入的 ctx 在 post-hook 中可见，调用结束后释放 |
| **多个 hook 注册** | 可按需注册任意多个 hook，按 priority 排序依次执行。同 priority 的按注册顺序执行 |

---

## 相关文档

- [AI API 参考](./ai-api#3-brain-hooks) — AI 友好的完整参考（含 `__all__`、类型签名等）
- [技能系统总览](../extensions/skill-overview) — Skills 扩展机制
- [插件系统总览](../extensions/plugin-overview) — Plugins 扩展机制
