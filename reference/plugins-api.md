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
- `PersonImageError`（[受管人物生图](#受管人物生图)没做成时抛出，带 `code`）

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

`generate_image` 与 `image_generate` Tool 的直接生图同一条路：任务名固定为 `image_generate`（AMKR 里必须绑定生图模型），有参考图走编辑端点、没有走文生图端点。`get_persona_reference_images` 返回人格自己的形象图（`{persona}/assets/`，三视图、正视图优先）。这条路**不**处理真实人物的受管参考图——要画真实的人走下面的[受管人物生图](#受管人物生图)；它也**不**计入部署方的人物生图额度，调用频率由插件自己限额。生图可能耗时数分钟，应放在后台任务里做，不要在指令回复里同步等待。

### 受管人物生图

想把某个群友按他自己登记的形象画进图里，插件不能拿他的参考图字节去调 `generate_image`：人物参考图属于[视觉资产系统](../guide/person-profiles)，使用必须经过本人同意、留审计、可撤回。框架为此提供一个受管入口，走的是与 `image_generate` Tool `subjects` 路径相同的一套编译、额度、预检与隔离。

```python
from sirius_pulse.plugins.api import PersonImageError

# 1. 本人在群里发指令同意（证据就是他这条消息）
consent = self.ctx.engine.grant_person_image_consent(
    user_id=self.ctx.message.user_id,
    group_id=self.ctx.message.group_id,
    evidence_ref=self.ctx.message.evidence_ref,
)
consent["has_reference"]  # 他现在有没有可用的正式形象图

# 2. 之后（通常在后台任务里）画他
try:
    result = await self.ctx.engine.generate_person_image(
        "她在月光下给阿明递一张卡",
        user_id=member_id,
        group_id=group_id,
        persona_references=2,
        timeout_seconds=300,
    )
except PersonImageError as exc:
    ...  # exc.code 说明哪一关没过；回退到不画真人的做法，并如实告诉大家

# 3. 本人撤回（不需要证据）
await self.ctx.engine.revoke_person_image_consent(user_id=member_id, group_id=group_id)
```

| 方法 | 作用 |
| --- | --- |
| `grant_person_image_consent(user_id, group_id, evidence_ref)` | 用本人这条消息的来源证据（`ctx.message.evidence_ref`，宿主在感知阶段为每条群消息记下）在视觉资产系统里记一条授权：人物与被授权人都是他自己，能力只有 `upload_generate`，作用域 `group:<群号>`，`recipe` 标为 `plugin:<插件名>`。证据必须是他本人、本群、账号已绑定的消息，否则抛 `PersonImageError("evidence_invalid")`。已同意过则返回原来那条。返回 `{"grant_id", "has_reference"}` |
| `generate_person_image(prompt, *, user_id, group_id, persona_references=2, timeout_seconds=300)` | 按本人的同意与正式形象画一张，返回 `{"image_bytes", "mime_type", "job_id"}`。人格自己若在视觉资产系统里登记了正式形象，就作为第二个人物主体一起编译；否则带上 `{persona}/assets/` 里至多 `persona_references` 张形象图作附加参考 |
| `revoke_person_image_consent(user_id, group_id)` | 撤回这个插件在这个群的同意。没提交的生成取消并退额度，依据这条同意画出的结果在视觉资产系统里隔离。返回 `{"revoked", "cancelled_jobs", "isolated_assets"}`；插件自己存下的成品由插件处理 |
| `get_person_image_consent(user_id, group_id)` | `{"consented", "grant_id", "has_reference"}` |

`generate_person_image` 一次调用里依次做：

1. 找到本人在这个群、对这个插件仍然有效的同意（没有就 `consent_required`）；
2. `compile_generation` 绑定他的人物 UUID、已启用的正式修订、参考图序与哈希，提示词里写清哪张图是谁（没有正式形象就 `required_asset_missing`）；
3. 把同意绑到任务的人物主体上，之后每一道复查都按这条授权重验；
4. 扣一次**部署方人物生图额度**（用尽就 `quota_exceeded`，什么都没发出去）；
5. `begin_generation` → 预检 → 领取提交许可 → 落盘提交边界，任一步发现撤权、停用就取消并退额度；
6. 调 AMKR 的 `image_generate` 任务；
7. `complete_generation` 保存结果并再验一次授权：生成途中被撤回的，结果隔离、不交付，抛 `cancelled_by_revocation`。

任务、授权、结果都记在视觉资产系统里（`manifest.requested_by = "plugin:<插件名>"`），可在人物档案的管理入口查到。常见错误码：`consent_required`、`required_asset_missing`、`quota_exceeded`、`cancelled_by_revocation`、`evidence_invalid`、`account_unbound`、`unavailable`（引擎没接入人物/视觉服务）。网络或上游失败按原样抛出（不是 `PersonImageError`），已越过提交边界的按“结果未知”处理，不退额度。

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
