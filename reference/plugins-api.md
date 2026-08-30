# Plugins API

## Python API

核心模型：

- `PluginBase`
- `PluginDefinition`
- `PluginCommandDef`
- `PluginCommandGroupDef`
- `PluginEventDef`
- `PluginPermissionDef`
- `PluginRenderDef`
- `PluginResponse`
- `CommandAST`
- `PluginContext`
- `EngineProxy`
- `PluginDataStore`
- `BackgroundTaskSpec`

推荐统一从下面的入口导入：

```python
from sirius_pulse.plugins.api import (
    BackgroundTaskSpec,
    PluginBase,
    PluginResponse,
    command,
)
```

### 后台任务

```python
class ExamplePlugin(PluginBase):
    async def poll(self) -> None:
        ...

    def create_background_tasks(self) -> list[BackgroundTaskSpec]:
        return [BackgroundTaskSpec("poll", 60, self.poll)]
```

任务由 `PluginExecutor` 创建、追踪和取消。任务契约位于 `sirius_pulse/extension_runtime.py`，因此与被动 Tool 共享底层任务语义，但不共享完整的 `ToolExecutor`。

### 主动消息

```python
await self.ctx.dispatch_proactive_message(
    group_id="1057020972",
    text="插件主动通知",
    adapter_type="napcat",
    image_path="/path/to/image.png",
)
```

### 数据和附件

```python
store = self.get_data_store()
store.set("last_event", event_id)
artifact_dir = self.get_artifact_dir()
```

`PluginDataStore` 按插件独立保存数据，并提供 `reload()`、`store_path` 和 `artifact_dir`。

## WebUI API

- `GET /api/plugins`
- `GET /api/plugins/{plugin_name}`
- `POST /api/plugins/{plugin_name}/toggle`
- `GET /api/plugins/{plugin_name}/config`
- `PUT /api/plugins/{plugin_name}/config`
- `GET /api/plugins/{plugin_name}/settings`
- `POST /api/plugins/{plugin_name}/settings`
- `POST /api/plugins/reload`

修改插件启停、权限或设置后，WebUI 会请求 Persona Worker 重建运行时，以清理旧插件的后台任务并加载新配置。
