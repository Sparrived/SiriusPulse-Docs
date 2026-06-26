# 角色管理器 API 参考

本文档描述了 `persona-manager-api` 模块提供的 API 端点，用于管理当前激活的人格（即运行中的人格实例）的启动、停止和状态查询。

## 概览

角色管理器 API 提供以下端点：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/persona/start` | 启动（激活）当前人格 |
| POST | `/api/persona/stop` | 停用当前人格 |
| GET  | `/api/persona/status` | 获取当前人格的运行状态 |

所有端点均以 WebUI 服务器的基地址为前缀，例如 `http://localhost:8080/api/persona/status`。

## 通用行为

- 所有响应均为 JSON 格式。
- 成功时返回 `{"success": true}` 及可能的额外字段。
- 错误时返回 `{"success": false, "error": "错误信息"}`。
- 这些端点仅在 WebUI 启动后可用，并且当前必须已选择一个激活的人格（即 `store.currentPersona` 有值）。

## 端点详情

### POST /api/persona/start

激活（启动）当前选择的人格。该操作会将当前人格的名称写入根数据目录下的 `global_config.json` 中的 `"active_persona"` 字段。

**请求示例**

```http
POST /api/persona/start
Content-Type: application/json

{}
```

**成功响应**

```json
{
  "success": true,
  "active": "my-persona"
}
```

**字段说明**
- `active`：当前已激活的人格名称。

### POST /api/persona/stop

停用当前选择的人格。如果当前激活的人格名称与请求的人格名称匹配，则清空 `global_config.json` 中的 `"active_persona"` 字段（设为空字符串）。

**请求示例**

```http
POST /api/persona/stop
Content-Type: application/json

{}
```

**成功响应**

```json
{
  "success": true
}
```

### GET /api/persona/status

获取当前选择的人格的状态信息。包括是否激活、运行标志、进程 ID、心跳时间和启动时间。

**请求示例**

```http
GET /api/persona/status
Accept: application/json
```

**成功响应**

```json
{
  "name": "my-persona",
  "active": true,
  "running": false,
  "pid": null,
  "heartbeat_at": null,
  "started_at": null
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | 字符串 | 当前人格的名称（来自 data_dir.name） |
| `active` | 布尔 | 是否已标记为全局激活的人格 |
| `running` | 布尔 | 人格引擎工作进程是否处于“running”状态 |
| `pid` | 整数/null | 工作进程的进程 ID |
| `heartbeat_at` | 字符串/null | 最后一次心跳时间（ISO 格式） |
| `started_at` | 字符串/null | 工作进程启动时间（ISO 格式） |

## 辅助函数

### _find_root_dir(persona_dir: Path) -> Path

从人格目录（`data/personas/{name}/`）推导根数据目录（`data/`）。逻辑如下：
- 如果 `persona_dir.parent.name == "personas"`，则返回 `persona_dir.parent.parent`。
- 否则（兼容旧目录结构）直接返回 `persona_dir`。

该函数用于定位存储全局配置的 `global_config.json` 文件。

## 路由注册

这些端点已在 `sirius_pulse/webui/routes.py` 中注册：

```python
RouteSpec("POST", "/api/persona/start", "api_persona_start"),
RouteSpec("POST", "/api/persona/stop", "api_persona_stop"),
RouteSpec("GET", "/api/persona/status", "api_persona_status"),
```

对应处理函数位于 `sirius_pulse/webui/persona_manager_api.py`。

## 前后端交互

前端（JavaScript）中所有原有形如 `/personas/{name}/...` 的 API 调用已统一修改为 `/persona/...`。这表示这些端点不再需要传递人格名称，而是直接操作当前选中的 `store.currentPersona`。

- `selectPersona(name)` 函数设置 `store.currentPersona`，然后通过 `GET /persona/status` 获取状态。
- 其他页面（如 adapters、biography-view、cognition 等）均使用 `pApi(path)` 函数生成 `/persona/{path}` 的路径。

## 关闭程序端点

新增了一个配套的关闭端点 `POST /api/shutdown`，用于优雅地停止整个程序。该端点会延迟 0.5 秒后调用 `os._exit(0)` 终止进程。前端在仪表板右下角添加了关闭按钮。

---

*本文档基于代码提交自动生成，对应变更集 [Summit commit hash]。*