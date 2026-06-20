# WebUI API

Sirius Pulse 内置的 WebUI 提供了 REST API 用于管理和监控。

## 基础信息

- **默认端口**: `8080`
- **绑定地址**: `127.0.0.1`
- **协议**: HTTP + JSON

## 人格管理

### 获取所有人格

```
GET /api/personas
```

响应：
```json
{
  "personas": [
    {
      "name": "小星",
      "status": "running",
      "port": 3001,
      "pid": 12345
    }
  ]
}
```

### 创建人格

```
POST /api/personas/create
Content-Type: application/json

{
  "name": "新人格"
}
```

### 启动人格

```
POST /api/personas/{name}/start
```

### 停止人格

```
POST /api/personas/{name}/stop
```

### 删除人格

```
DELETE /api/personas/{name}
```

### 获取人格配置

```
GET /api/personas/{name}/config
```

### 更新人格配置

```
PUT /api/personas/{name}/config
Content-Type: application/json

{ ... }
```

### 获取体验配置

```
GET /api/personas/{name}/experience
```

响应：
```json
{ ... }
```

## 记忆管理

### 获取群聊记忆

```
GET /api/memory/{persona_name}/groups/{group_id}
```

响应包含：
- `entries`: 基础记忆条目列表（每个条目包含 `content`、`role`、`tags`、`conversation_chain` 等字段）
- `heat`: 群聊热度
- `diary_entries`: 相关日记

### 获取用户记忆

```
GET /api/memory/{persona_name}/users/{user_id}
```

响应包含：
- `entries`: 用户记忆条目列表（每个条目包含 `content`、`role`、`tags`、`conversation_chain` 等字段）

### 获取人物传记

```
GET /api/biography/{persona_name}
```

响应格式包含以下字段：
- `name`: 用户名称
- `aliases`: 别名列表
- `short_bio`: 简介
- `identity_anchors`: 身份锚点
- `relationships`: 关系列表
- `fact_history`: 事实历史
- `source_record_ids`: 来源记录 ID
- `active_fact_count`: 活跃事实数
- `superseded_fact_count`: 被取代事实数

### 获取对话历史

```
GET /api/personas/{name}/conversations
```

查询参数：
- `group_id`（可选）：筛选指定群组
- `limit`（可选）：返回条数，默认100
- `offset`（可选）：偏移量，用于分页

响应：
```json
{
  "messages": [
    {
      "role": "user",
      "content": "你好",
      "group_id": "123",
      "tags": [
        {"type": "sticker", "label": "动画表情 ×2"},
        {"type": "image", "label": "图片 ×1"}
      ]
    },
    {
      "role": "assistant",
      "content": "你好呀！今天有什么想聊的？",
      "group_id": "123",
      "system_prompt": "你是一个友善的助手。",
      "conversation_chain": [
        {"role": "system", "content": "你是一个友善的助手。"},
        {"role": "user", "content": "你好"},
        {"role": "assistant", "content": "你好呀！今天有什么想聊的？"}
      ],
      "tags": [
        {"type": "sticker", "label": "表情包: 微笑"}
      ]
    }
  ],
  "total": 500,
  "has_more": true
}
```

`tags` 字段用于标识消息中的特殊内容，如表情包、图片、钉住/取消钉住指令等。

- **用户消息**中的标签：`sticker`（动画表情，label 格式如 `动画表情 ×2`）、`image`（普通图片，label 格式如 `图片 ×3`）
- **模型回复**中的标签：`sticker`（表情包，label 格式如 `表情包: 开心`）、`pin`（钉住消息）、`unpin`（取消钉住）

`conversation_chain` 字段（仅 `assistant` 角色消息拥有）记录了该条回复生成时使用的完整 LLM 调用消息链，格式为一个数组，每个元素包含 `role` 和 `content` 字段，用于调试和追溯。

`received_during_bot_send` 字段（布尔值）表示该消息是否在 Bot 正在发送多段回复时到达，用于避免打断逻辑。

`mentions_current_bot` 字段（布尔值）表示该消息是否明确提到或 @ 了当前 Bot 的名称或别名。

## Plugin 管理

### 获取插件列表

```
GET /api/plugins/{persona_name}
```

### 获取插件详情

```
GET /api/plugins/{persona_name}/{plugin_name}
```

响应：
```json
{
  "name": "example_plugin",
  "display_name": "示例插件",
  "description": "...",
  "version": "1.0.0",
  "author": "dev",
  "enabled": true,
  "parameters": [
    {
      "name": "param1",
      "description": "参数说明",
      "required": true,
      "default": "默认值",
      "choices": ["选项A", "选项B"],
      "group": "基本设置"
    }
  ]
}
```

### 更新插件配置

```
PUT /api/plugins/{persona_name}/{plugin_name}/config
Content-Type: application/json

{
  "enabled": true,
  "permissions": {
    "group_blacklist": []
  }
}
```

## Skill 管理

### 获取技能列表

```
GET /api/skills/{persona_name}
```

### 获取技能数据

```
GET /api/skills/{persona_name}/{skill_name}/data
```

### 更新技能数据

```
PUT /api/skills/{persona_name}/{skill_name}/data
Content-Type: application/json

{ ... }
```

## NapCat 管理

### 获取 NapCat 状态

```
GET /api/napcat/status
```

### 安装 NapCat

```
POST /api/napcat/install
Content-Type: application/json

{
  "path": "D:\\napcat",
  "qq": 123456789
}
```

### 启动 NapCat 实例

```
POST /api/napcat/start
Content-Type: application/json

{
  "qq": 123456789,
  "port": 3001
}
```

### 停止 NapCat 实例

```
POST /api/napcat/stop
Content-Type: application/json

{
  "qq": 123456789
}
```

## Provider 管理

### 获取 Provider 配置

```
GET /api/providers
```

### 更新 Provider 配置

支持传入 **对象** 或 **数组** 格式。

**对象格式**（按名称覆盖或新增）：
```
PUT /api/providers
Content-Type: application/json

{
  "deepseek": {
    "api_key": "sk-xxx",
    "base_url": "https://api.deepseek.com"
  }
}
```

**数组格式**（每个元素需包含 `name` 字段，不在数组中的旧 Provider 将被删除）：
```
PUT /api/providers
Content-Type: application/json

[
  {
    "name": "deepseek",
    "type": "deepseek",
    "base_url": "https://api.deepseek.com",
    "api_key": "sk-xxx",
    "enabled": true,
    "models": []
  }
]
```

支持的提供商类型包括：`deepseek`, `aliyun-bailian`, `bigmodel`, `mimo`, `mimo-tokenplan`, `siliconflow`, `volcengine-ark`, `ytea` 以及通用 `openai-compatible` 类型。

> **自动热重载**：更新 Provider 配置后，系统会自动向所有运行中的人格发送 `provider` 热重载信号，无需手动重启人格即可使新配置生效。若通过 `POST /api/providers/refresh-models` 刷新模型列表，也会触发同样的热重载。

## Token 统计

### 获取 Token 用量

```
GET /api/token/{persona_name}/usage?since=2026-01-01
```

### 获取分析报告

```
GET /api/token/{persona_name}/report
```

## 全局配置

### 获取全局配置

```
GET /api/config/global
```

### 更新全局配置

```
PUT /api/config/global
Content-Type: application/json

{ ... }
```

## WebSocket 事件

```
ws://localhost:8080/ws/events?persona={name}
```

实时推送引擎事件：
- `message_received`: 新消息到达
- `reply_sent`: AI 发送了回复
- `emotion_changed`: 情绪变化
- `token_usage`: Token 用量更新
- `skill_executed`: 技能执行完成
- `plugin_executed`: 插件执行完成
