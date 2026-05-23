# Plugins API 参考

`sirius_pulse.plugins.api` 是插件开发的统一导入入口，所有插件开发所需的类型、基类和装饰器都可以从这里导入。

## 使用方式

```python
from sirius_pulse.plugins.api import (
    PluginBase,               # 插件基类（所有插件必须继承）
    command,                  # 声明式指令注册装饰器
    PluginResponse,           # 返回结果
    PluginContext,            # 运行时上下文
    EngineProxy,              # 引擎安全代理
    PluginDataStore,          # 持久化 KV 存储
    CommandAST,               # 指令抽象语法树
    PluginCommandMeta,        # @command 装饰器记录的元数据
    RenderMode,               # 输出策略枚举
    TriggerType,              # 触发方式枚举
    PatternType,              # 匹配模式枚举
    PluginDefinition,         # 插件完整定义
    PluginCommandDef,         # 指令触发器定义
    PluginEventDef,           # 事件触发器定义
    PluginPermissionDef,      # 权限定义
    PluginRenderDef,          # 渲染策略定义
    PluginNaturalLangDef,     # 自然语言触发定义
    PluginParameterDef,       # 参数定义
    ArgNode,                  # 指令参数节点
    UserMention,              # 被 @ 的用户
    GroupMention,             # 群聊上下文
    MessageReference,         # 消息引用
    ImageAttachment,          # 图片附件
)
```

---

## 插件基类

### PluginBase

所有插件的基类。支持两种指令定义方式：覆写 `execute()` 或使用 `@command` 装饰器（推荐）。

```python
class PluginBase:
    # ── 类属性（在子类上覆写） ──
    _plugin_name: str = ""
    _plugin_display_name: str = ""
    _plugin_description: str = ""
    _plugin_version: str = "1.0.0"
    _plugin_author: str = ""
    _plugin_events: list[dict] = []
    _plugin_schedule: list[dict] = []  # [{"time": "HH:MM", "duration": 1440}, ...] 声明式定时，由 from_class() 自动转为 PluginEventDef
    _plugin_permissions: dict | None = None
    _plugin_nl_examples: list[str] = []
    _plugin_nl_slots: dict = {}
    _plugin_dependencies: list[str] = []
    _plugin_prompt_inject: str = ""

    # ── 属性 ──
    @property
    def name(self) -> str           # 插件名称
    @property
    def ctx(self) -> PluginContext  # 执行上下文
    @property
    def source_path(self) -> Path | None  # 源代码路径

    # ── 生命周期方法 ──
    def on_load(self) -> None       # 加载时调用一次
    def on_unload(self) -> None     # 卸载时调用一次

    # ── 核心方法 ──
    def execute(self, cmd: CommandAST) -> PluginResponse           # 同步执行
    async def execute_async(self, cmd: CommandAST) -> list[PluginResponse]  # 异步执行

    # ── 辅助方法 ──
    @property
    def logger(self) -> logging.Logger   # 专用 logger
    def get_data_store(self)             # 获取数据存储
    def get_adapter(self)                # 获取平台适配器
    def render_template(self, name: str, data: dict) -> str  # 渲染模板
```

**使用场景：** 所有插件必须继承此类。推荐使用 `@command` 装饰器方式，不需要覆写 `execute()`。

**推荐的编写方式：**
```python
from sirius_pulse.plugins.api import PluginBase, command, PluginResponse

class MyPlugin(PluginBase):
    _plugin_name = "my_plugin"
    _plugin_description = "示例插件"

    @command(name="hello", patterns=["/hello"])
    async def hello(self) -> PluginResponse:
        return PluginResponse.ok(text="你好！")
```

---

## 装饰器

### @command

声明式指令注册装饰器，替代覆写 `execute()` 的方式。

```python
@command(
    name: str,                         # 指令名
    prefix: str = "",                  # 前缀（/ # !）
    patterns: list[str] = None,        # 触发词列表
    pattern_type: str = "prefix",      # prefix / keyword / regex
    description: str = "",             # 描述
    examples: list[str] = None,        # 使用示例
    render_mode: str = "direct",       # direct / llm / silent
    hidden_from_intent: bool = False,  # 对意图识别隐藏
    system_prompt_suffix: str = "",    # LLM 模式的附加提示
    max_tokens: int = 500,             # LLM 模式最大 token
    temperature: float = 0.8,          # LLM 模式温度
    mood_hint: str = "",               # LLM 模式情绪提示
    timeout: float = 0.0,             # 指令级超时
)
```

**参数自动提取：** 装饰的方法签名决定了如何从用户输入提取参数。位置参数按序消费，命名参数通过 `--key=value` 或 `-k value` 匹配，布尔标志通过 `--flag` 匹配。类型注解自动转换（int / float / bool / str / list[str]）。

**示例：**
```python
@command(name="echo", patterns=["/echo"])
async def echo(self, message: str, count: int = 1, uppercase: bool = False) -> PluginResponse:
    result = message * count
    if uppercase:
        result = result.upper()
    return PluginResponse.ok(text=result)
```
用户输入 `/echo hello --count=3 --uppercase` → 自动调用 `echo("hello", 3, True)`

---

## 返回结果

### PluginResponse

插件处理器返回给框架的响应，是 handler 与框架之间的核心输出契约。

```python
@dataclass
class PluginResponse:
    success: bool = True               # 执行是否成功
    data: Any = None                   # 结构化数据（llm 模式下用于人格化生成）
    text: str = ""                     # 纯文本输出（direct 模式下直接发送）
    error: str = ""                    # 错误信息
    render_mode: str = ""              # 覆盖默认的渲染模式
    mood_hint: str = ""               # 情绪提示
    tone_override: str = ""            # 语气覆写
    image_urls: list[str] = field(default_factory=list)
    message_group: Any = None          # 多模态输出
    metadata: dict[str, Any] = field(default_factory=dict)

    @staticmethod
    def ok(text: str = "", data: Any = None, **kwargs) -> PluginResponse

    @staticmethod
    def fail(error: str) -> PluginResponse
```

**使用场景：** 每个 handler 方法的返回值。通过 `PluginResponse.ok()` 和 `PluginResponse.fail()` 快捷构造。

**渲染模式的影响：**
| render_mode | text 字段 | data 字段 |
|:---|:---|:---|
| `direct` | 直接发送给用户 | 忽略 |
| `llm` | 忽略 | 传给引擎做人格化润色 |
| `silent` | 忽略 | 忽略（仅执行副作用） |

---

## 运行时上下文

### PluginContext

插件执行时的完整上下文，通过 `self.ctx` 访问。

```python
@dataclass
class PluginContext:
    engine: EngineProxy                # 引擎代理
    adapter: Any = None                # 平台适配器（BaseAdapter 实例）
    message: MessageContext            # 当前消息上下文
    data_store: PluginDataStore | None = None  # 数据存储
    config: dict[str, Any] = field(default_factory=dict)  # 插件配置
    plugin_name: str = ""              # 插件名称

    @property
    def logger(self) -> logging.Logger  # 专用 logger
```

**使用场景：** 在 handler 中通过 `self.ctx` 访问一切运行时信息。

**示例：**
```python
@command(name="whoami")
async def whoami(self) -> PluginResponse:
    persona = self.ctx.engine.get_persona_name()
    user = self.ctx.message.user_id
    group = self.ctx.message.group_id
    return PluginResponse.ok(text=f"我是{persona}，当前在群{group}，你是{user}")
```

---

### EngineProxy

引擎能力的安全代理，通过 `self.ctx.engine` 访问。提供插件可以安全调用的引擎能力。

**主要方法：**
| 方法 | 说明 |
|:---|:---|
| `generate_text(prompt, *, group_id, ...)` | 调用引擎完整管线生成人格化文本 |
| `generate_text_analysis(prompt, *, group_id, ...)` | 使用分析模型生成结构化分析文本 |
| `generate_raw(prompt, *, system_prompt, inject_persona, ...)` | 直接调用 LLM 绕过引擎管线，保留 token 追踪 |
| `get_persona_name()` | 获取当前人格名称 |
| `execute_skill_chain(chain, ...)` | 执行 SKILL 调用链 |
| `register_plugin_event(event_type, callback)` | 注册插件事件监听 |

---

### PluginDataStore

插件独立的键值持久化存储，通过 `self.ctx.data_store` 或 `self.get_data_store()` 访问。

```python
class PluginDataStore:
    def get(self, key: str, default: Any = None) -> Any
    def set(self, key: str, value: Any) -> None
    def delete(self, key: str) -> None
    def keys(self) -> list[str]
    def clear(self) -> None
```

**使用场景：** 需要持久化插件状态时使用。数据自动保存到插件目录。

**示例：**
```python
@command(name="counter")
async def counter(self) -> PluginResponse:
    store = self.get_data_store()
    count = store.get("count", 0) + 1
    store.set("count", count)
    return PluginResponse.ok(text=f"这是第 {count} 次调用")
```

---

## 数据模型

### CommandAST

从用户输入解析得到的指令抽象语法树。

```python
@dataclass
class CommandAST:
    command: str                       # 指令名，如 "weather"
    raw_text: str                      # 原始完整文本
    prefix: str = ""                   # 触发前缀，如 "/"
    args: list[ArgNode] = field(default_factory=list)   # 位置参数
    kwargs: dict[str, ArgNode] = field(default_factory=dict)  # 命名参数
    flags: set[str] = field(default_factory=set)         # 布尔开关
```

**辅助方法：** `get_str(name, default)` / `get_int(name, default)` / `get_float(name, default)` / `get_bool(name, default)` — 按类型安全地获取参数值。

---

### ArgNode

指令参数节点。

```python
@dataclass
class ArgNode:
    value: str | int | float | bool    # 解析后的值
    raw: str                           # 原始字符串
    type_hint: str = "str"             # 类型提示
```

---

### PluginCommandMeta

由 `@command` 装饰器记录的指令元数据，包含路由信息、渲染策略和方法引用。

```python
@dataclass
class PluginCommandMeta:
    name: str                          # 指令名
    prefix: str = ""         
```