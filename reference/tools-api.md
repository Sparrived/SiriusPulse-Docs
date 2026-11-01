# Tools API

Python 模型：`ToolDefinition`、`ToolParameter`、`ToolResult`、`ToolContentBlock`、`ToolInvocationContext`、`BackgroundTaskSpec`、`TriggerSpec`。

WebUI API：`GET /api/persona/tools`、`POST /api/persona/tools/{tool_name}/toggle`、`GET /api/persona/tools/{tool_name}/config`、`POST /api/persona/tools/{tool_name}/config`、`GET /api/persona/tool-history`。Tool 配置中的密钥读取时只回显掩码 `********`，回传掩码即保留原值，详见 [Tool 系统 · API](../guide/tool-system.md#api)。

## 人物与视觉工具

以下是模型工具的实际入口；字段以对应 `TOOL_META` 为准。对话调用示例、权限解释和最小管理 HTTP 请求见[人物档案与视觉资产指南](../guide/person-profiles.md)，需求背景见[PRD 与实施映射](person-profile-assets-requirements.md#实施映射)。

| 工具 | 主要输入 | 实际行为与限制 |
| --- | --- | --- |
| `person_query` | `target`、`sections`、`detail`、`query`、`limit`、`cursor` | 只读查询 `names`、`claims`、`relationships`、`memories`、`visual`、`changes`、`consents`、`jobs`。`visual.drafts` 最多 5 条无 `refs` 的修订摘要；只有 draft 时 `state=draft_only`。目标支持 `requester`、`persona`、`person_id`、`name`、`mention_ref`；名称重名最多返回 5 个候选，`limit` 为 1–5。不导出原始聊天、账号列表或文件路径 |
| `person_update` | `action`、`target`、`evidence_ref`，以及对应修订和字段参数 | `set_names`、`propose_claim`、`correct_claim`、`retire_claim`、`confirm_change`、`create_character`。本人修改和确认关联当轮证据；`expected_revision` 做人物资料 CAS。不允许任意字段或账号绑定修改 |
| `visual_asset_manage` | `action`、`target`、`source`、`profile_id`、`revision`、`expected_revision`、`capabilities`、`grantee` 等 | 动作包括 `create_character`、`stage`、`derive`、`activate`、`set_policy`、`revoke_consent`、`retire`。真实当轮附件／source asset 可直接绑定当前可见 subject 为草稿，上传者可不同于主体；非维护者 `activate:true` 不启用，并返回 `activation.confirmation_required`。维护者按当前正式修订 CAS 启用。`view`、`vision_read`、`upload_generate`、`external_send` 手动共享不消耗逐人物 grant，不等于控制权或部署额度 |
| `image_generate` | `prompt`、`subjects`、`source_ref`、`reference_images` | `subjects` 是人物引用数组，每项支持 `ref`、`value`、`revision`、`profile_id`、`outfit_override`；可分别指定 `persona` 和 `requester`。人物正式参考由服务绑定，额外参考仍用 `reference_images`。提交后立即返回，完成仅回调本地路径给 Agent，不自动外发 |
| `read_image` | `paths`、`assets`、`focus` | 图片合计最多 4 张。当前可见 subject／profile 的受管资产可按 `vision_read` 手动共享，不消耗 grant；受管裸路径、`file://`、相对路径及 `~` 形式也不能绕过会话范围、来源停用／删除或身份隐私边界 |
| `group_file_exec` | `action=image`、`image_path` 等 | 当前可见素材按 `external_send` 能力校验，手动外发不消耗 grant；内联 base64／data URI 与 URL 下载后的已知内容也按哈希回溯，不是外链直接透传。发送结果与生成结果不是同一状态；普通非人物功能保持原契约 |

### 目标引用与权限

`{"ref":"requester"}` 指当轮可验证请求者，`{"ref":"persona"}` 指当前人格，`{"ref":"person_id","value":"<UUID>"}` 指已登记人物。账号绑定决定身份，名称只用于称呼和候选检索。`person_query` 的 `memories` 只查询当前群的精确身份键，最多 3 条本地摘要，不执行新的联网检索。

`visual_asset_manage` 的授权支持 `manual` 与 `auto_candidate` 模式、`revision_scope`、`scope`、`expires_at`、`max_uses`。`grantee` 是实际可使用许可的人物 UUID，默认操作者。旧 `manual` grant 保留兼容，但不限制上述手动共享；撤回只取消实际绑定的旧 grant／自动任务，不影响独立的新手动共享任务。`auto_candidate` 仍需明确有限 grant、部署开关和额度，并复查 recipe、revision 与范围。

手动 `derive`／人物生图只消耗部署额度；`set_policy` 不增加额度或控制权。跨 subject 重用同字节／asset 保留原来源，来源停用或删除阻断子引用；私聊／群私有素材不扩大范围，扩大人格 scope 仍需应用管理员。任意路径／URL 不能作为入库来源。部署方总额度、自动总开关和每日限额只在[管理 API](webui-api.md#人物档案与视觉资产)设置；`retention_days` 仅持久化，不自动执行 TTL 清理。

普通工具的 `expected_revision` 是整数；管理 API 对首次启用可显式传 `null` 表示当前无正式修订。使用旧 CAS 值遇到并发更新会返回冲突，应重新查询而不是强制覆盖。自动候选即使运行也只保存候选，不自动启用或发送。
