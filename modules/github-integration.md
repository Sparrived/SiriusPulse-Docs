# GitHub 集成与插件化评估

> 本文记录当前代码状态下，将 GitHub 相关能力（尤其是仓库监控）从内置模块剥离为外部扩展的可行性、复用边界和实施建议。

## 结论摘要

**Plugin 可以复用当前 Tool 的一部分基础设施，但不建议直接把 `ToolRegistry`、`ToolExecutor` 和 `ToolDefinition` 当作 Plugin 的运行时。**

两套扩展的触发和输出模型不同：

| 维度 | Tool | Plugin |
|---|---|---|
| 主要触发 | 模型 Function Call | 用户命令、自然语言意图、定时事件 |
| 当前入口 | `TOOL_META + run()` | `PluginBase + @command` |
| 被动能力 | `create_background_tasks`、`create_triggers`、生命周期钩子 | `on_event`、`_plugin_schedule` |
| 返回契约 | `ToolResult`，供模型继续推理 | `PluginResponse`，由 Dispatcher 渲染给用户 |
| 权限/审计 | Tool security、admin/developer 校验、ToolTelemetry | Plugin 权限、速率限制、Plugin 配置 |
| 数据存储 | `tool_data/{name}.json` | `plugin_data/_plugin_{name}_data.json` |
| 主动推送 | `ToolEngineContext.dispatch_proactive_message()` | 当前没有等价的完整统一接口 |

因此，合理的目标不是“让 Plugin 伪装成 Tool”，而是：

```text
共享底层能力服务
        ├── Tool 适配层：模型调用 / 被动 Tool
        └── Plugin 适配层：命令 / 定时 / Webhook / 主动推送
```

对 GitHub 监控而言：

- **移动为外部被动 Tool：低难度，推荐作为第一步。**
- **改造成真正的 GitHub Plugin：中高难度，需要先补齐 Plugin 的后台任务、Webhook 和主动推送能力。**
- **将 GitHub API、事件解析、Webhook 和截图全部放入独立包：可行，但应在完成运行时能力补齐后实施。**

## 当前落地状态

第一版独立插件仓库已经创建并作为主项目的 Git submodule 接入：

```text
https://github.com/Sparrived/SiriusPulse-Plugins
项目路径：plugins/
当前指针：60e95c5
```

当前 submodule 包含：

- `amkr_key_manager`：从原项目外部插件目录迁移而来；
- `github_monitor`：GitHub 监控 Plugin 的 Poll MVP；
- `tests/test_github_monitor.py`：首次同步游标、事件筛选和通知分发测试。

GitHub Plugin 当前支持：

- `/github status`：查看配置仓库数；
- `/github poll`：立即执行一次轮询；
- `issues`、`pulls`、`releases`、`pushes` 四类 Events API 事件；
- 每仓库通知群配置；
- 每人格 `PluginDataStore` 游标持久化；
- 首次同步跳过历史事件；
- 通过 `PluginContext.dispatch_proactive_message()` 发送主动通知。

当前版本暂未替代旧的内置被动 Tool 全部能力。Webhook、Playwright 截图、事件聚合、Compare API 详情、coding agent 事件桥接和旧 `tool_data` 数据迁移仍属于后续版本。这样保留旧 Tool 可以降低现有用户升级风险，但生产部署时不应同时配置两套监控订阅，以免重复通知。

## 当前 GitHub 代码组成

### GitHub 通用模块

位置：

```text
sirius_pulse/github/
├── client.py        # GitHub REST API 客户端和标准请求头
├── events.py        # Events / Compare API、重试和限流处理
├── webhook.py       # aiohttp Webhook 服务、签名校验和事件路由
├── event_bridge.py  # GitHub 事件向其他扩展转发
└── __init__.py
```

这一层已经相对接近公共领域 SDK，可以同时供 Tool 和 Plugin 使用。它不应依赖 `PluginBase`、`ToolDefinition` 或具体 QQ 适配器。

### 当前监控业务

位置：

```text
sirius_pulse/tools/builtin/github_monitor.py
```

该文件约 1460 行，实际包含一个完整的监控应用：

- Poll 模式轮询 GitHub Events API；
- Webhook 模式接收 GitHub 推送；
- Issue、PR、Release、Comment、Push 事件解析；
- Push 合并、Compare API 查询和 PR Merge 去重；
- 轮询时间戳持久化和首次同步保护；
- coding agent 仓库及评论作者过滤；
- Playwright 页面截图；
- LLM 生成通知；
- 向多个群发送文本和图片；
- 私聊群激活；
- 通过 `event_bridge` 向其他扩展发出 Issue / PR / Comment 事件。

它没有 `run()`，而是使用被动 Tool 生命周期：

```python
create_background_tasks(ctx)
create_on_load(ctx)
create_on_unload(ctx)
```

因此它在当前设计中本质上是**被动 Tool**，不是普通的命令 Plugin。

### WebUI 和核心层中的 GitHub 专用耦合

目前仍有以下专用引用：

| 位置 | 耦合内容 |
|---|---|
| `sirius_pulse/webui/server_plugin_api.py` | `/api/plugins/monitor_repos` 直接读取 `tool_data/github_monitor.json` |
| `sirius_pulse/core/engine_core.py` | 默认任务模型包含 `github_monitor_notify` |
| `sirius_pulse/core/model_router.py` | 为 `github_monitor_notify` 设置独立路由配置 |
| `sirius_pulse/tools/builtin/github_monitor.py` | 直接调用 GitHub、Playwright、LLM、提醒分发和 `event_bridge` |
| `sirius_pulse/github/event_bridge.py` | API 名称和注释直接以 `github_monitor`、`coding_agent` 为中心 |
| `pyproject.toml` | `playwright` 当前是核心包的基础依赖 |

如果目标是核心包不再内置 GitHub，这些引用需要逐步泛化或迁移。

## Plugin 是否可以复用 Tool 基础设施

### 可以直接复用的部分

#### 1. GitHub 领域基础设施

Plugin 可以直接复用：

```python
from sirius_pulse.github import (
    GitHubClient,
    GitHubWebhookServer,
    fetch_repo_events,
    fetch_compare_details,
)
```

建议继续保持这一层与扩展系统无关。未来也可以把 `sirius_pulse/github/` 整体移动到独立的 `sirius-pulse-github` 包中，由 GitHub Plugin 使用。

#### 2. 通用持久化能力

当前两套存储都属于 JSON KV 存储：

- Tool：`ToolDataStore`，位于 `sirius_pulse/tools/data_store.py`；
- Plugin：`PluginDataStore`，位于 `sirius_pulse/plugins/context.py`。

它们都支持独立文件和 `get/set/delete`，但接口细节不同，文件命名也不同。GitHub Plugin 可以先使用自己的 `PluginDataStore`，通过迁移逻辑读取旧的 `tool_data/github_monitor.json`。

长期建议抽出一个框架级存储协议或实现：

```python
class ExtensionDataStore(Protocol):
    def get(self, key: str, default: Any = None) -> Any: ...
    def set(self, key: str, value: Any) -> None: ...
    def delete(self, key: str) -> None: ...
    def save(self) -> None: ...
    def reload(self) -> None: ...
```

Tool 和 Plugin 各自保留兼容包装层，不直接互相导入内部类。

#### 3. 配置模型和配置表单描述

两套扩展都已经使用公共配置模型：

```text
sirius_pulse/config/models.py
sirius_pulse/config/config_builder.py
```

GitHub Plugin 的 `poll_seconds`、`repos`、`webhook_secret` 等配置可以继续使用声明式参数和 WebUI 配置表单。需要补充的是 `object_array`、密码字段、Secret 脱敏和仓库级校验，不应让每个插件重复实现。

#### 4. 平台适配器和主动消息底层能力

Tool 的 `ToolEngineContext` 已经暴露了较完整的主动消息能力：

```python
queue_pending_message(...)
dispatch_proactive_message(...)
activate_private_group(...)
get_active_groups()
```

Plugin 最终可以复用这些**底层引擎能力**，但应通过 Plugin 自己的上下文代理使用，而不是直接拿 Tool Context：

```python
await self.ctx.dispatch_proactive_message(
    group_id=group_id,
    text=text,
    adapter_type="napcat",
)
```

建议将这部分进一步抽成公共 `ProactiveMessageService`，由 Tool 和 Plugin 分别注入轻量代理。

#### 5. Webhook 签名校验和 HTTP 基础能力

`GitHubWebhookServer` 已经封装了：

- HMAC-SHA256 签名校验；
- aiohttp 生命周期；
- 事件类型处理器；
- 仓库过滤。

Plugin 可以复用其实现，但长期应让 Webhook 服务注册到框架的统一路由/生命周期管理器，避免每个 Plugin 自己占用端口和管理服务器。

#### 6. 重试、遥测和安全策略

GitHub API 重试逻辑可以复用 `sirius_pulse/github/events.py`。Tool 的安全和遥测实现则不宜直接搬到 Plugin，而应提炼为公共能力：

- 通用外部请求超时和重试策略；
- Secret 脱敏；
- 执行耗时、成功率和错误记录；
- 插件级限流；
- 外部写入操作的审计。

### 不建议直接复用的部分

#### 1. `ToolRegistry` / `ToolExecutor`

不能直接用 Tool 执行器承载普通 Plugin，原因是入口不同：

```text
Tool：模型生成参数 → ToolExecutor → run(**kwargs) → ToolResult
Plugin：用户文本 → Lexer/CommandAST → PluginExecutor → PluginResponse
```

如果强行统一，会导致：

- `CommandAST` 被转换为虚假的 Tool 参数；
- Plugin 的命令权限、自然语言意图和 Dispatcher 被绕过；
- `PluginResponse` 与 `ToolResult` 语义混在一起；
- Plugin 生命周期和定时任务无法自然表达；
- 模型可见性与用户可见命令混淆。

正确做法是保留两个执行器，在它们下面共享通用服务。

#### 2. `ToolResult` 和 `PluginResponse`

两者都可以携带文本和结构化数据，但消费方不同：

- `ToolResult` 主要进入模型上下文，并需要防止工具结果被当作指令；
- `PluginResponse` 进入 `OutputDispatcher`，根据 `direct` / `llm` / `silent` 生成用户可见输出。

可以抽出公共的内容块、附件和脱敏工具，但不建议合并两个返回模型。

#### 3. Tool 的 passive runtime

被动 Tool 已经支持：

```python
create_background_tasks(ctx)
create_triggers(ctx)
create_on_load(ctx)
create_on_unload(ctx)
```

这与 GitHub Poll/Webhook 很匹配，但它依赖 `ToolEngineContext` 和 Tool 的 `tool_data` 约定。Plugin 应该复用其中的调度思想，而不是让 Plugin 直接伪造 `ToolDefinition`。

#### 4. Tool 的模型可见性和模型调用权限

GitHub 监控的后台轮询不应该暴露为模型可调用的 Tool。当前 ToolRegistry 已经对只有被动工厂、没有 `run()` 的 Tool 隐藏模型工具定义。

如果迁移成 Plugin，需要明确区分：

- `/github ...` 等用户显式管理命令；
- 后台监控任务；
- GitHub 事件供其他扩展消费；
- 可选的“查询仓库状态”模型工具。

它们不应共享一个模糊的权限入口。

## GitHub 监控改造成 Plugin 的主要缺口

### 1. Plugin 缺少与被动 Tool 等价的后台任务契约

Plugin 当前依靠 `_plugin_events` / `_plugin_schedule` 和 `on_event()`，在 `platforms/runtime.py` 中由 `PluginScheduler` 调度。

这足以实现简单的每日任务，但不理想地承载 GitHub Poll：

- Poll 间隔来自配置，且需要热更新；
- API、Compare、Playwright、LLM 都可能耗时；
- 当前 Scheduler 在循环中直接 `await task.callback()`，长任务可能阻塞其他插件定时任务；
- 任务取消、失败退避和资源清理需要与 Plugin unload 对齐。

建议增加明确的 Plugin 后台任务 API：

```python
class PluginBase:
    def create_background_tasks(self) -> list[BackgroundTaskSpec]:
        return []
```

或者先让 Plugin 使用一个公共 `BackgroundTaskService`，避免复制 Tool 的注册代码。

### 2. Plugin 缺少统一主动消息 API

GitHub 监控需要向多个群推送文本和图片，而不是只返回一次 `PluginResponse`。PluginContext 当前有 `adapter`，但直接操作 Adapter 会把业务绑定到 NapCat。

建议在 `PluginContext` 增加框架级能力：

```python
await self.ctx.dispatch_proactive_message(
    group_id=group_id,
    text=notification,
    adapter_type="napcat",
    image_path=screenshot_path,
)
```

该接口应统一处理：

- 待发送队列；
- 事件总线；
- 图片/文件附件；
- 私聊群激活；
- 适配器类型；
- 回复引用和其他消息附加动作。

### 3. Plugin Webhook 生命周期尚未完整接通

Plugin 模型定义了 Webhook 触发类型，但当前 Runtime 实际主要注册 cron 和 interval 任务，没有通用的 Plugin Webhook 路由注册链路。

短期可以让 GitHub Plugin 在 `on_load()` 中启动 `GitHubWebhookServer`，在 `on_unload()` 中停止，但这不是最终方案，因为多人格运行时会带来：

- 每个人格各自占端口；
- 多个实例端口冲突；
- GitHub 公网回调地址管理复杂；
- Plugin 重载时旧服务器可能残留；
- WebUI 无法统一展示 Webhook 状态。

长期建议：

```text
统一 Webhook Gateway
    ├── 验证签名
    ├── 按仓库路由
    ├── 按人格/插件订阅分发
    └── 管理生命周期和健康状态
```

### 4. Plugin 配置热更新目前只更新文件，不保证重建运行资源

`PluginConfigManager` 支持 `set_enabled()`、`update_settings()` 和监听器，但 Runtime 的初始化流程需要确保：

- 禁用插件时不实例化、不注册任务；
- 已运行插件禁用时停止任务、Webhook 和订阅；
- 仓库列表或 Poll 间隔变化后立即生效；
- Secret 变化后重新配置 Webhook；
- reload 时旧实例的 `on_unload()` 一定执行。

当前 `platforms/runtime.py` 的插件加载流程会扫描和实例化定义，但没有在该流程中明确按 `get_enabled()` 过滤全部插件。GitHub 监控迁移前应先修复这个生命周期问题。

### 5. `event_bridge` 需要从 GitHub/coding 专用 API 泛化

当前桥接 API：

```python
register_issue_handler()
register_pr_handler()
register_comment_handler()
set_issue_repos()
set_coding_bot_login()
```

存在的问题：

- 模块级全局 handler 列表；
- 没有 unregister，插件重载后可能重复注册；
- 事件类型固定为 Issue/PR/Comment；
- Monitor 知道 coding agent 的业务规则；
- 多人格进程之间不共享，也没有明确订阅范围。

建议改成可取消的通用订阅：

```python
subscription = await github_events.subscribe(
    event_types={"issues.opened", "pull_request.opened"},
    repositories={"owner/repo"},
    callback=handler,
)

await subscription.close()
```

GitHub Monitor 只负责采集和规范化事件；coding agent 只负责订阅和业务处理。

## 推荐的复用架构

```text
                    ┌─────────────────────────┐
                    │ sirius_pulse services   │
                    │                         │
                    │ HTTP / retry / storage  │
                    │ proactive message       │
                    │ webhook registry        │
                    │ extension telemetry     │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
   ┌──────────▼──────────┐             ┌──────────▼──────────┐
   │ Tool adapter         │             │ Plugin adapter       │
   │ ToolRegistry         │             │ PluginRegistry       │
   │ ToolExecutor         │             │ PluginExecutor       │
   │ ToolEngineContext    │             │ PluginContext        │
   └──────────┬──────────┘             └──────────┬──────────┘
              │                                   │
              └─────────────────┬─────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │ GitHub domain package │
                    │ client / events /     │
                    │ webhook / parser     │
                    └───────────────────────┘
```

GitHub 领域包不应知道调用它的是 Tool 还是 Plugin。它只提供：

- GitHub API 客户端；
- Poll / Compare 查询；
- Webhook payload 校验和标准化；
- 统一的 GitHub 事件模型；
- 事件去重、合并和筛选；
- 可选的截图服务。

通知生成、目标群管理和扩展间订阅则放在 GitHub Plugin 中。

## 推荐实施顺序

### 阶段 0：先修复基础边界

1. 统一 Plugin 代码目录约定。当前 Runtime 使用 `work_path / "plugins"`，WebUI 使用项目根 `plugins/`，需要明确唯一规则。
2. 让 Plugin 的 `enabled` 状态真正影响实例化、任务注册和 Webhook 启动。
3. 为 Plugin unload 建立完整的任务、订阅和 HTTP 资源清理契约。
4. 给 WebUI 的插件自定义设置增加 Secret 脱敏和结构化配置校验。

### 阶段 1：最低风险拆分

将：

```text
sirius_pulse/tools/builtin/github_monitor.py
```

移动为外部被动 Tool：

```text
tools/github_monitor.py
```

保留现有接口：

```python
create_background_tasks(ctx)
create_on_load(ctx)
create_on_unload(ctx)
```

同时保留：

```text
tool_data/github_monitor.json
```

这样不需要立即修改 Plugin 运行时，预计 1～3 人日即可完成迁移、兼容和回归测试。

### 阶段 2：拆分 GitHub 领域代码

在不改变行为的前提下，将 1460 行业务文件拆成：

```text
github_client.py       # 或复用 sirius_pulse/github/client.py
github_event_parser.py
github_event_aggregate.py
github_subscription.py
github_notify.py
github_screenshot.py
github_monitor_runtime.py
```

优先为以下纯逻辑补测试：

- PushEvent 合并；
- PR Merge Push 去重；
- Poll 时间戳恢复；
- 首次轮询跳过历史事件；
- Compare API 详情回退；
- canonical URL 分组；
- Webhook action 过滤；
- 评论作者和 coding 仓库过滤。

### 阶段 3：补齐可被 Plugin 复用的框架能力

建议新增或抽象：

```text
ExtensionDataStore
ProactiveMessageService
WebhookRegistry
EventSubscription / SubscriptionHandle
BackgroundTaskService
ExtensionTelemetry
```

Plugin 和 Tool 分别通过适配器使用这些服务。

同时修改 Plugin Scheduler：

- 长任务不要串行阻塞所有插件；
- 任务执行支持取消；
- 失败退避和连续失败停用行为可复用；
- 同一插件的任务避免重复并发；
- 配置变化后能更新任务。

### 阶段 4：实现 GitHub Plugin

可采用如下插件结构：

```text
plugins/github_monitor/
├── __init__.py
├── plugin.py
├── monitor.py
├── notify.py
├── screenshot.py
├── migration.py
└── templates/
```

Plugin 负责：

- `/github` 或 `/github-monitor` 管理命令；
- 仓库订阅和目标群配置；
- Poll 任务；
- Webhook 订阅；
- 通知生成和主动消息发送；
- 配置迁移；
- 事件桥接订阅。

GitHub 公共包负责：

- API 和 Webhook 协议；
- 原始事件解析；
- 事件模型和重试。

### 阶段 5：移除核心 GitHub 专用知识

完成 Plugin 稳定运行后再移除：

- `github_monitor_notify` 核心默认任务名，改用通用 `plugin_generate` 或插件任务命名空间；
- `api_plugin_monitor_repos` 这类直接读取 `tool_data` 的硬编码接口；
- `github_monitor` 专用的 `event_bridge` 函数；
- 核心包对 Playwright 的强制依赖；
- 内置 `sirius_pulse/tools/builtin/github_monitor.py`。

## 数据迁移注意事项

旧配置：

```text
data/personas/<name>/tool_data/github_monitor.json
```

建议迁移到：

```text
data/personas/<name>/plugin_data/_plugin_github_monitor_data.json
```

迁移必须保留：

- `repos`；
- `poll_seconds`；
- `api_base_url`；
- Webhook 配置；
- `last_event_timestamps`；
- `_last_poll_at`；
- Secret 和 Token。

迁移策略建议：

1. 首次加载 Plugin 时检测旧文件；
2. 复制而不是直接删除旧文件；
3. 写入迁移版本号；
4. 成功读取新文件后优先使用新文件；
5. 保留旧文件一段时间用于回滚；
6. 日志中不得输出 Token、Secret 或完整 Authorization header。

不保留时间戳会造成重启后重新播报历史事件，是最高优先级的兼容风险之一。

## 依赖和发布建议

当前 `pyproject.toml` 将 `playwright` 放在核心依赖中。GitHub 监控插件化后，建议：

```toml
[project.optional-dependencies]
github = [
    "httpx>=0.24.0",
    "playwright>=1.57.0",
]
```

还需要考虑 Playwright 的 Chromium 安装不是普通 Python 依赖。建议提供明确的安装步骤，例如：

```text
uv pip install sirius-pulse-github
python -m playwright install chromium
```

不建议在普通用户启动核心框架时无条件安装 Chromium。若截图功能是可选项，可以把截图服务拆成 GitHub Plugin 的可选 feature：

```text
GitHub API 监控：默认启用
Webhook：可选
Playwright 截图：可选
```

## 难度、工作量和风险

| 目标 | 难度 | 预计工作量 | 主要工作 |
|---|---:|---:|---|
| 移动为外部被动 Tool | 低 | 1～3 人日 | 目录迁移、依赖、配置兼容、回归测试 |
| 拆分 GitHub 领域模块 | 中 | 2～4 人日 | 纯逻辑拆分、模型和测试整理 |
| 改造成使用 Plugin 的 Poll | 中高 | 3～6 人日 | 后台任务、配置热更新、主动消息 |
| 加入 Plugin Webhook | 高 | 3～7 人日 | 路由注册、端口、生命周期和安全 |
| WebUI 全部插件化 | 高 | 3～7 人日 | 插件自定义 API、状态和表单 |
| 完全移除核心 GitHub 依赖 | 高 | 2～5 人日 | 任务路由、WebUI、桥接、依赖和迁移 |

综合来看，**真正的难点不是 GitHub API，而是 Plugin 当前还没有完全覆盖被动 Tool 的运行时能力**。如果先补框架能力，再迁移 GitHub，整体风险明显低于直接把 1460 行监控代码改写成普通 Plugin。

## 最终建议

### 推荐路线

```text
当前内置被动 Tool
        ↓
外部被动 Tool（低风险验证插件化交付）
        ↓
抽取 GitHub 领域包和通用扩展服务
        ↓
补齐 Plugin 后台任务 / Webhook / 主动消息
        ↓
独立 GitHub Plugin
        ↓
删除核心 GitHub 专用耦合
```

### 明确回答

**Plugins 可以复用当前 Tools 的基础设施，但应复用“能力服务”，不应复用“完整执行器”。**

可以共享：

- GitHub Client、事件解析、Webhook 签名校验；
- HTTP、重试、存储、配置、Secret 脱敏；
- 主动消息、附件、事件订阅、后台任务等通用服务；
- 依赖安装、日志和扩展遥测的公共实现。

不应直接共享：

- `ToolRegistry` 作为 Plugin 注册表；
- `ToolExecutor` 作为 Plugin 执行器；
- `ToolResult` 作为 Plugin 返回值；
- Tool 的模型调用权限作为 Plugin 命令权限。

**短期最稳妥的实现是把 GitHub 监控做成外部被动 Tool；长期正确的形态是“GitHub 领域包 + GitHub Plugin + Core 通用扩展服务”。**
