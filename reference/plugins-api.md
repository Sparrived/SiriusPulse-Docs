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

### 用她的口气说话

```python
text = await self.ctx.engine.generate_text(
    system_prompt,
    group_id=group_id,
    messages=[{"role": "user", "content": "（说一句）"}],
    task_name="plugin_generate",
)
```

`generate_text` 走与聊天相同的 Brain 生成链路，宿主会自动注入完整人设（包括人格自己的形象图说明），插件的提示词只需要写内容要求，不要替她定口气。`generate_raw(..., inject_persona=True)` 只注入人格名与 `full_system_prompt`，适合不需要人格说话方式的分析类任务。

### 生图

```python
references = self.ctx.engine.get_persona_reference_images(limit=2)
result = await self.ctx.engine.generate_image(
    "月光下的钟楼，她坐在屋顶上看星星",
    reference_images=references,
    timeout_seconds=300,
)
png = result["image_bytes"]  # 还有 result["mime_type"]
```

`generate_image` 与 `image_generate` Tool 的直接生图同一条路：任务名固定为 `image_generate`（AMKR 里必须绑定生图模型），有参考图走编辑端点、没有走文生图端点。`get_persona_reference_images` 返回人格自己的形象图（`{persona}/assets/`，三视图、正视图优先）。这条路**不**处理真实人物的受管参考图——那必须经过视觉资产系统的授权与审计；也**不**计入部署方的人物生图额度，调用频率由插件自己限额。生图可能耗时数分钟，应放在后台任务里做，不要在指令回复里同步等待。

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

插件列表与详情响应中的每项可包含 `ui_schema`。它是经过服务端重新校验的只读展示元数据，浏览器还会在自身信任边界再次校验；无效时回退通用表单。`POST /settings` 只接收 `_plugin_parameters` 已声明的参数值，`ui_schema`、`identity`、类型与默认值不会被合并到 settings 或写入 `plugins/_config.json`。

修改插件启停、权限或设置后，WebUI 会请求 Persona Worker 重建运行时，以清理旧插件的后台任务并加载新配置。
