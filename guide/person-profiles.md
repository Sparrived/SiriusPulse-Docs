# 人物档案与视觉资产

Sirius Pulse 已提供 A–D 对应的人物身份、资料工具、视觉资产和自动候选接口。它们复用现有人格引擎、SQLite 与生图队列，不是独立图库服务；目前没有完整人物图库 GUI。本文说明现行用法，[需求与实施映射](../reference/person-profile-assets-requirements.md)保留设计依据，字段全集见[工具](../reference/tools-api.md#人物与视觉工具)和[管理 API](../reference/webui-api.md#人物档案与视觉资产)。

## 1. 身份、资料与记忆

`person_id` 是人格工作区内持久化的 UUID。平台账号绑定决定身份；首选称呼、别名和平台显示名只用于交流与候选检索。重名不会合并人物，改名也不会改变 UUID。人类、人格和显式登记的 OC 都是人物主体，但控制关系不同。

- `person_query`：按 `requester`、`persona`、`person_id` 或名称只读查询；可分页处理重名，不返回账号清单、原始聊天或资产路径。
- `person_update`：依据当轮原消息修改称呼、提出或纠正声明、确认草稿、登记 OC；不提供任意字段或账号绑定修改。
- `visual_asset_manage`：管理原图、修订、候选、素材授权与停用。

`person_query` 的 `visual` 含最多 5 条 `drafts` 修订摘要，不含 `refs`；无 active／candidate 但有 draft 时 `state=draft_only`。投稿者可据此取得 `profile_id` 与 `revision`，交本人／控制者启用；旧 `unbound` 草稿不会自动猜绑定，仍可用显式 `assign_draft` 迁移，新投稿直接归属明确主体。维护者查询也不自动扩大私聊／群范围。

查询 `memories` 时，仅检索**当前群**、按人物 UUID／兼容旧 ID／已绑定账号的精确键关联的本地既有记忆，不发起新的联网检索，最多返回 3 条短摘要，不返回完整历史；`unavailable` 表示检索不可用，不等于没有记忆。

## 2. 从原图到正式形象

上传者在聊天中提供真实当轮附件或受控 source asset，并明确指定当前可见的人物／OC／人格，工具将素材保存为**该主体的草稿**；上传者与主体可以不同，不需要目标人物本人另行确认归属。`activate:false` 可让保存与启用分开确认。任意本地路径或 URL 不作为入库凭据；私聊／群私有素材保持原来源范围，扩大为人格范围仍需应用管理员。

```json
{
  "action": "stage",
  "target": {"ref": "requester"},
  "source": {"kind": "attachment", "index": 0},
  "evidence_ref": "<框架提供的当轮 evidence_ref>",
  "activate": false
}
```

查询得到 `profile_id`、`revision` 和当前 `active_revision` 后，本人或角色控制者再明确执行 `activate`：

```json
{
  "action": "activate",
  "target": {"ref": "requester"},
  "profile_id": "vp_example",
  "revision": 2,
  "expected_revision": 1,
  "evidence_ref": "<框架提供的当轮 evidence_ref>"
}
```

非维护者即使传 `activate:true` 也只保存草稿，返回 `data.activation={success:false,status:"confirmation_required",code:"permission_denied"}`，不改变正式形象、人物身份或 claims。`expected_revision` 是维护者启用的 CAS：必须填写本次确认前看到的**当前正式修订**，不是刚保存的候选号。并发修改导致不一致时返回 `revision_conflict`，应重新查询再决定，不能静默覆盖。管理 API 中，尚无正式修订时显式传 `"expected_revision": null`；普通工具的维护者可用 `stage` 的 `activate:true` 完成首次启用。AI 派生结果始终是候选，只有维护者明确 `activate` 才成为正式形象。

双人合照使用 `image_generate`，为每个人分别绑定主体，正式参考图由服务编译，不靠模型猜路径：

```json
{
  "prompt": "月白与当前请求者并肩看星星，保留两人的服装与配色",
  "source_ref": "<框架提供的当轮 evidence_ref>",
  "subjects": [
    {"ref": "persona"},
    {"ref": "requester"}
  ]
}
```

任务完成只把本地结果路径回调给 Agent；Agent 可继续检查，必须显式调用发送工具才会外发，不会自动发回原群。

## 3. 手动共享、自动授权与旧路径

人格视觉素材库按当前可见 subject／profile 及其会话范围共享。`view`、`vision_read`、`upload_generate`、`external_send` 的手动使用**无需逐人物 grant，也不消耗 grant**；身份可见性、私有资料范围、素材状态和部署方生图额度仍是独立边界。手动 `derive`／人物生图只受部署额度限制，不把一次请求扩展为持续付费授权。

`set_policy` 保留旧手动许可兼容，也用于自动候选；它可授予真实 `grantee`（人物 UUID，默认操作者）限定能力、修订、有效期和 `max_uses`，不赋予控制权或部署额度。旧手动 grant 不再限制上述手动共享；`revoke_consent` 只撤回实际绑定的旧 grant 和自动任务，不取消不依赖旧 grant 的新手动共享任务。

| 能力 | 用途 |
| --- | --- |
| `view` | 查看受控摘要／档案元数据 |
| `vision_read` | `read_image` 实际读取图像 |
| `upload_generate` | 将受管参考用于派生或人物生图 |
| `external_send` | `group_file_exec` 将受管图像外发 |

`activate` 的 CAS、`retire`／`delete` 由本人、控制者或管理入口的控制权约束，不能用手动共享或素材 grant 转授。受管资产的旧 `file://`、相对路径、`~`、任务副本及 legacy 引用也会重新识别人物、范围、来源状态与能力；无法验证绑定的旧受管队列仍失败关闭，裸路径不能绕过这些边界。

受管内容还会按哈希回溯。另存为本地副本、使用内联 base64／data URI，或从 URL 下载后解析，都不会洗去来源；跨 subject 重用同字节／asset 仍保留原来源，原来源停用或删除会阻断子引用。相应读取／发送入口仍校验当前范围及 `vision_read`／`external_send`，不是把任意外链直接透传；共享使用不代表素材归属或控制权转移。

部署管理员通过 `policy` 设置 `controller`（应为可信人物的 UUID，而非昵称或 QQ 号）、`total_quota`、`auto_enabled` 和每日上限。`auto_enabled` 默认关闭；只有部署开关、可用额度、明确有限的人物 `auto_candidate` 预授权，以及对应 grantee、recipe、来源 revision、会话范围和执行时重验同时满足，才自动补缺失项。它仍只生成候选，不自动启用或外发。普通工具不能提高这些部署额度。

## 4. 最小 HTTP 管理入口

所有以下请求都要求 **WebUI 应用管理员**，作用于当前人格；viewer、群管理员不等同于应用管理员。先 `GET /api/persona/people/state` 查看部署状态，或 `GET /api/persona/people/{person_id}` 查询人物和视觉摘要。示例 ID 仅作占位，使用时替换为查询所得真实值。

```http
POST /api/persona/people/policy
Content-Type: application/json

{"controller":"6d3bf3c2-0e1f-4b1f-96de-98b8737db90a","total_quota":20,"auto_enabled":false,"retention_days":30}
```

启用修订：

```http
POST /api/persona/people/visual
Content-Type: application/json

{"action":"activate","target":{"ref":"person_id","value":"6d3bf3c2-0e1f-4b1f-96de-98b8737db90a"},"payload":{"profile_id":"vp_example","revision":2,"expected_revision":1}}
```

迁移依次调用 `GET /api/persona/people/migration`（或 `POST /api/persona/people/migration-preview`）、`POST /api/persona/people/migration-apply`、`POST /api/persona/people/migration-rollback`。dry-run 不写人物数据；apply 返回 `migration_id` 与本地备份路径。回滚示例为 `{"migration_id":"<apply 返回值>"}`，仅撤销该次尚无后续活动的新增映射，不是任意数据恢复；有冲突账号应先核查。

删除必须两步，不能由模型仅凭一句话静默执行：

```http
POST /api/persona/people/deletion-preview

{"person_id":"6d3bf3c2-0e1f-4b1f-96de-98b8737db90a","scope":"person"}
```

```http
POST /api/persona/people/deletion-confirm

{"confirm_token":"<预览返回的一次性令牌>"}
```

预览先报告影响范围，确认才清理本地可定位资产与副本，并擦除关联视觉修订描述、任务 prompt／manifest、参考链接和 JSON 队列输入；相关审计只保留脱敏操作墓碑，保留 ID／哈希／状态以阻止重放并核对计费。`scope:person` 仅指该人物的视觉资产，**不删除身份、称呼、声明、原聊天或来源证据**，预览和执行结果的 `retained` 会明确列出。这里是逻辑字段擦除，不承诺 SQLite 空闲页、WAL、磁盘历史或已进入执行内存的数据被安全抹除。

`retention_days` 目前只是持久配置，**没有自动到期清理任务**；删除确认与离线备份清理仍需按运维策略执行。外部服务副本、已发消息和备份不承诺彻底删除。

## 5. 验证边界

当前接口与本地业务回归不等于真实图片效果已经达标。真实双人一致性、外部网络／JWT 部署、多进程性能仍需独立验证；AMKR 按任务名路由，实际模型选择与效果由其配置决定。不能据此宣称全部验收、无限并发或生成效果均已通过。
