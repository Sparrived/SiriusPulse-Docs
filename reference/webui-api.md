# WebUI API 参考

WebUI API 路由集中定义在 `sirius_pulse/webui/routes.py`。

## 全局 API

`/api/global-config`、`/api/models`、`/api/amkr/status`、`/api/amkr/panel`、`/api/amkr/rotate-inference-key`、`/api/amkr/register`、`/api/tokens`、`/api/telemetry`、`/api/embedding/status`、`/api/embedding/rebuild`、`/api/system/logs`、`/api/auth/login`、`/api/auth/status`、`/api/monitoring/overview`、`/api/monitoring/metrics`、`/api/monitoring/health`、`/api/dispatcher/overview`、`/api/shutdown`。

`/api/models` 返回的是 12 个 AMKR 任务名（`available_models` / `model_choices`），不再是厂商模型列表。`/api/amkr/status` 为只读巡检（含各人格 `panel_ready` / `inference_ready`，但**不含**任何 key），`/api/amkr/register` 建出工作空间并补齐缺失任务名（请求体 `{"persona": "..."}` 或 `{}` 表示全部人格）。`/api/amkr/panel?persona=<名字>` **仅管理员可用**，返回可嵌入的工作空间面板地址（fragment 内为明文面板 key），即运维页 iframe 的来源。`/api/amkr/rotate-inference-key` **仅管理员可用**，请求体 `{"persona": "..."}`，换一把该空间的推理 key 并返回 `{"persona", "inference_key"}`——明文只回这一次，旧 key 立即失效且**不影响面板 key**。旧的 `/api/providers*` 端点已全部移除。

## 监控健康口径

`/api/monitoring/health`、`/api/monitoring/metrics` 与 `/api/monitoring/overview` 使用同一健康判定。`running` 仅保留 Worker 生命周期声明，不代表适配器在线；`healthy` 还要求已完成启动、最近 30 秒内有效心跳、无适配器降级，以及配置/记忆检查正常。总览另提供 `healthy_personas`，不再用运行数量冒充健康数量。

健康详情的 `checks.heartbeat` 返回心跳状态与年龄，`checks.adapter` 返回连接/降级状态；陈旧心跳、断线或启动中均不会显示进程检查正常。缺省 `engine_state/orchestration.json` 可使用默认配置，不视为缺文件；存在但格式错误则报告配置异常，旧人格根目录的编排文件不再作为健康条件。

## 人格管理

`/api/personas`、`/api/personas/active`、`/api/personas/{name}/activate`、`/api/persona/start`、`/api/persona/stop`、`/api/persona/status`。

## 当前人格配置

`/api/persona`、`/api/persona/logs`、`/api/persona/persona`、`/api/persona/persona/interview`、`/api/persona/experience`、`/api/persona/adapters`、`/api/persona/engine/reload`。

模型编排页面与 `/api/persona/orchestration`、`/api/persona/task-params` 已移除；模型与采样参数改在 AMKR 自带面板配置。

## 记忆与观测

`/api/persona/tokens`、`/api/persona/cognition`、`/api/persona/cognition/analysis`、`/api/persona/memory-units`、`/api/persona/profile/*`、`/api/persona/memory-viz`、`/api/persona/conversations`。

## 自主行为

`/api/persona/autonomy` **只读**，返回她当前惦记的意图（`memory/intentions.json`）与自己做过的事（`memory/autonomy/episodes.json`），以及两者共用的 `summary`（未了意图数、累计自主数、最近一次时间）和文件路径。`limit` 可限制返回条数（1–200，默认 100），两类记录均按时间倒序。

之所以没有写接口：从后台替她行动会让她变成"可配置"而不是"自主"。页面同样只读。

## 工作模式

`GET /api/persona/work-mode` 返回每次工作模式的轨迹（`memory/work_mode/sessions.json`）：`goal`（她进去准备做什么）、`source`（`chat` 她自己进去的 / `autonomy` 自主回合 / `scheduled` 定时任务回合）、`task_name`（这次用的任务名，即 AMKR 的模型入口）、`steps`（逐轮的正文、工具调用与工具结果、`send_midway_msg` 发出的话）、`result`（退出时给出的工作结果）、`status`（`running` / `completed` / `aborted`）与起止时间。`summary` 给出累计次数、已完成数、进行中数、步骤总数与最近一次的目标；`limit` 可限制返回条数（1–100，默认 50），按时间倒序。同一次响应还带 `settings.task_name`（当前设置）与 `task_options`（可选任务名及其中文标签，即 `/api/models` 的同一份目录）。

`POST /api/persona/work-mode` **只接受 `{"task_name": "..."}`**，用来设置"工作期间使用的模型"：任务名就是 AMKR 的模型入口，空字符串表示沿用本回合原本的任务名（普通聊天即 `response_generate`）。写入 `memory/work_mode/settings.json`，每次开始工作时重新读取，因此改完下一次工作模式生效、不需要重启人格。任务名限定字母、数字、下划线、点和横线，最多 64 个字符（它会被当作 `model` 字段发给 AMKR）。

轨迹本身仍然只读：进出工作模式是模型自己的决定，从 WebUI 替她进入或退出就不是"她自己做"了。轨迹文件落在 `memory/` 下，写入后经既有的文件监听推送 `data_changed`（资源名 `work-mode`），无需另开通道。

## 人物档案与视觉资产

这些最小管理路由定义在 `routes.py`，由 `people_api.py` 分派，全部要求 `auth_role=admin`，作用于当前人格；viewer、群管理员不自动拥有此权限。没有新增完整人物图库 GUI。面向用户与部署者的完整步骤见[人物档案与视觉资产指南](../guide/person-profiles.md)，模型工具字段见[Tools API](tools-api.md#人物与视觉工具)。

| 方法与路由 | 请求体／参数 | 用途 |
| --- | --- | --- |
| `GET /api/persona/people/state` | `group_id` 可选 | 当前部署额度、自动候选开关、保留设置和人格 UUID |
| `GET /api/persona/people/{person_id}` | `group_id` 可选 | 人物资料与视觉摘要；视觉含最多 5 条无 `refs` 的 `drafts`，只有草稿时 `state=draft_only`。`state`、`migration` 是两个保留的 GET 路径，其余按人物 UUID 查询；维护者也不自动扩大私聊／群范围 |
| `POST /api/persona/people/policy` | `controller`、`total_quota`、`auto_enabled`、`retention_days`、`per_person_daily`、`per_persona_daily`，均可选 | 只修改传入的部署策略。`controller` 应为可信人物 UUID；不能由普通人物工具提高额度 |
| `POST /api/persona/people/visual` | `action`、`target`、`payload`，以及可选 `evidence_ref`、`source_ref` | 调用同一视觉领域服务。`payload` 不得包含 `access`、`queue`、`target`、`evidence_ref`、`source_ref`、`action` 等保留字段 |
| `GET /api/persona/people/migration` | 无 | 旧人物数据 dry-run，等价于 migration-preview |
| `POST /api/persona/people/migration-preview` | `{}` | 仅预览映射与冲突，不写人物数据 |
| `POST /api/persona/people/migration-apply` | `{}` | 执行幂等迁移，返回 `migration_id` 与本地备份路径 |
| `POST /api/persona/people/migration-rollback` | `{"migration_id":"..."}` | 回滚该次尚无后续活动的新增映射；不是数据库任意时间点恢复 |
| `POST /api/persona/people/deletion-preview` | `{"person_id":"<UUID>","scope":"person"}` | 返回影响预览、未决边界与一次性 `confirm_token`，此时不删除 |
| `POST /api/persona/people/deletion-confirm` | `{"confirm_token":"del_..."}` | 按预览确认清理本地可定位副本；令牌绑定操作者并有时效 |

`visual` 的激活请求示例：

```json
{
  "action": "activate",
  "target": {"ref": "person_id", "value": "<人物UUID>"},
  "payload": {
    "profile_id": "vp_example",
    "revision": 2,
    "expected_revision": 1
  }
}
```

`visual` 路由不会凭管理员身份捏造用户附件证据：`stage` 仍要求当轮真实 `evidence_ref`，`derive` 还要求已接入的生成队列。此最小管理端点当前不注入队列，不能将它当成任意上传或无条件付费生成入口；派生请从接有队列的对话工具发起。

首次启用尚无正式修订时，管理 API 可显式传 `"expected_revision": null`；此值不同于省略。`null` 不会绕过已有正式修订的 CAS 冲突。真实当轮来源可绑定明确可见主体为草稿；非维护者 `activate:true` 仅返回 `activation.confirmation_required`，不改 active、身份或 claims。`derive` 产生候选，只有维护者明确 `activate` 才切换正式指针。当前可见素材的手动共享不消耗 grant；自动候选仍要求有限 grant、部署开关、额度及重验，旧 manual grant 撤回不取消独立的新手动任务。普通工具的字段与 CAS 表达方式见[工具参考](tools-api.md#人物与视觉工具)。

错误响应包含 `code`：未通过管理员检查返回 403，其余 `permission_denied`／`consent_required` 也返回 403；`revision_conflict`／`confirm_invalid` 返回 409，其他无效请求或领域拒绝通常为 400；未捕获的服务异常返回 503。不能把 HTTP 成功解释为真实图片质量或平台外发成功。

### 保留、删除与部署边界

`scope:person` 删除的是该人物的视觉域，而非整个人物身份：清理本地资产／任务副本、关联修订描述和任务输入、参考链接及 JSON 队列快照，相关审计脱敏，保留最小防重放／计费墓碑。身份、称呼、声明、原聊天和来源证据不删除，预览与结果的 `retained` 明示此范围。文件或队列擦除失败会列入 `unresolved`；逻辑字段清空不等于 SQLite 空闲页、WAL 或磁盘历史的安全擦除。

`retention_days` 当前仅保存配置，**没有自动到期清理任务**。删除需要预览与确认两步；本地清理不承诺撤回外部生成服务已收到的请求、聊天平台已发消息或离线备份，备份须按运维策略另行处理。生产环境仍需单独验证外部网络与 JWT 鉴权、真实双人图像效果及多进程性能，不能将本地接口回归等同于这些部署结论。

## WebSocket

- `GET /ws/events`：订阅全部人格事件。
- `GET /ws/events/{name}`：订阅指定人格事件。

连接由 `webui/event_bridge.py` 供给内容：它订阅每个人格引擎的 `SessionEventBus`，把事件按人格广播给浏览器。`agent_turn_updated` 带 `data.origin` 区分来源——`self_initiated` 表示这是她自己发起的回合，自主行为页面据此实时显示。人格引擎被重建时会换成新的事件总线，桥按引擎身份重新订阅。
