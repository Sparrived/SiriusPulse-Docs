# Python API

Sirius Pulse 的公开 Python API，覆盖核心模块、配置、模型、Provider、技能和插件。

## 导入方式

```python
from sirius_pulse import (
    EmotionalGroupChatEngine,
    create_emotional_engine,
    PromptFactory,
    SkillRegistry,
    SkillExecutor,
    PluginRegistry,
    PluginLoader,
    PluginExecutor,
    IdentityResolver,
    IdentityContext,
    IdentityResolution,
    # ...
)
```

## 核心引擎

### EmotionalGroupChatEngine

```python
from sirius_pulse import EmotionalGroupChatEngine, create_emotional_engine

# 创建引擎实例
engine = create_emotional_engine(
    persona_profile=profile,         # PersonaProfile
    provider_registry=providers,     # ProviderRegistry
    config=engine_config,            # dict
    work_path="/path/to/persona",
    embedding_client=client,         # EmbeddingClient
)

# 处理消息
result = await engine.process_message(
    message="你好！",
    participants=[...],
    group_id="123456",
)
```

### PromptFactory

```python
from sirius_pulse import PromptFactory

# 构建聊天的完整 prompt
bundle = PromptFactory.assemble_chat(
    persona=persona_profile,
    emotion=current_emotion,
    user_profiles=[...],
    memories=[...],
    group_profile=profile,
    skill_registry=skills,
    plugin_registry=plugins,
    # ...
)
# bundle.system_prompt, bundle.user_content, bundle.token_breakdown
```

## 技能系统 API

### SkillRegistry

```python
from sirius_pulse import SkillRegistry

registry = SkillRegistry()

# 加载技能
registry.load_from_directory("/path/to/skills", include_builtin=True)

# 按名查找
skill = registry.get("bing_search")

# 构建 LLM 工具描述
tool_desc = registry.build_tool_descriptions(
    adapter_type="napcat",
)
```

### SkillExecutor

```python
from sirius_pulse import SkillExecutor, SkillInvocationContext

executor = SkillExecutor(work_path="/path/to/persona")
executor.set_chat_context(group_id="123", user_id="456")

# 执行技能
result = executor.execute(
    skill=skill_def,
    params={"query": "Python"},
    invocation_context=SkillInvocationContext(caller=...),
)
# result.success, result.text_blocks, result.multimodal_blocks
```

### 解析 SKILL_CALL

```python
from sirius_pulse.skills.executor import parse_skill_calls, strip_skill_calls

text = """让我搜索一下。
[SKILL_CALL: bing_search | {"query": "Python 3.13"}]
[SKILL_CALL: file_read | {"path": "${bing_search.data}"}]
"""

calls = parse_skill_calls(text)
# [("bing_search", {"query": "Python 3.13"}), ("file_read", {"path": "${bing_search.data}"})]

clean_text = strip_skill_calls(text)
# "让我搜索一下。\n\n"
```

## 插件系统 API

### PluginLoader

```python
from sirius_pulse.plugins import PluginLoader

loader = PluginLoader(plugins_dir="/path/to/plugins")

# 发现所有插件
plugin_paths = loader.discover()

# 加载定义
definitions = loader.load_all_definitions()
```

### PluginRegistry

```python
from sirius_pulse.plugins import PluginRegistry

registry = PluginRegistry()
registry.register(definition, instance)

# 匹配消息
match = registry.match_message("/weather 北京")
# match.plugin_name, match.command_name, match.lexed

# 获取 LLM 描述
desc = registry.get_plugin_descriptions(caller_is_developer=False)
```

### PluginExecutor

```python
from sirius_pulse.plugins import PluginExecutor

executor = PluginExecutor(
    registry=registry,
    persona_data_path="/path/to/persona",
    engine=engine,
    adapter=adapter,
)

# 执行命令
responses = await executor.execute(
    plugin_name="weather",
    cmd=command_ast,
    group_id="123",
    user_id="456",
)
```

## Provider API

```python
from sirius_pulse import (
    AutoRoutingProvider,
    MimoProvider,
    MimoTokenPlanProvider,
    OpenAICompatibleProvider,
    MockProvider,
    ProviderRegistry,
)

# 创建 registry
registry = ProviderRegistry()

# 添加 provider
registry.register("deepseek", OpenAICompatibleProvider(
    api_key="sk-xxx",
    base_url="https://api.deepseek.com",
))

# 小米MIMO平台按量付费
registry.register("mimo", MimoProvider(
    api_key="sk-xxx",
    base_url="https://api.xiaomimimo.com/v1",
))

# 小米MIMO Token Plan订阅制
registry.register("mimo-tokenplan", MimoTokenPlanProvider(
    api_key="tp-xxx",
    base_url="https://token-plan-cn.xiaomimimo.com/v1",
))

# 路由调用
provider = AutoRoutingProvider(registry)
result = provider.generate(GenerationRequest(
    model="deepseek-chat",
    system_prompt="...",
    messages=[...],
))
```

## 数据模型

```python
from sirius_pulse.models import (
    Message,
    Transcript,
    UnifiedUser,
    EmotionState,
    ResponseStrategy,
)

from sirius_pulse.skills import (
    SkillDefinition,
    SkillResult,
    SkillChainContext,
    BackgroundTaskSpec,
    TriggerSpec,
)

from sirius_pulse.plugins.models import (
    PluginDefinition,
    PluginResponse,
    CommandAST,
)
```

## 配置 API

```python
from sirius_pulse.config import ConfigManager

manager = ConfigManager(data_dir="./data")

# 读配置
config = manager.load_global_config()
persona = manager.load_persona("my-bot")

# 写配置
manager.save_persona("my-bot", persona)
```

## 异常

```python
from sirius_pulse.exceptions import (
    ProviderError,
    ConfigurationError,
    SkillExecutionError,
    PluginLoadError,
    PermissionError,
    # ...
)
```
