# NapCat / OneBot 接入

Sirius Pulse 当前内置 QQ 平台实现：`sirius_pulse/platforms/onebot_v11/napcat/adapter.py`。

## 前置条件

- 已安装并登录 NapCat。
- NapCat 已启用 OneBot v11 WebSocket。
- Sirius Pulse 所在机器能访问该 WebSocket 地址。

## 适配器能力

`NapCatAdapter` 支持 WebSocket 自动重连、群聊和私聊消息接收、文本与图片解析、QQ `@` 解析、群成员信息缓存、发送文本/图片/文件、戳一戳、撤回、禁言、全员禁言、踢人、设置群名片和发送限流。

## 配置示例

```json
[
  {
    "adapter_type": "onebot_v11_napcat",
    "enabled": true,
    "ws_url": "ws://127.0.0.1:3001",
    "access_token": "",
    "group_whitelist": [],
    "bot_qq": ""
  }
]
```

## 常见问题

连接失败时检查 `ws_url`、NapCat WebSocket、防火墙和 token。群里不回复时检查人格是否运行、适配器是否启用、群白名单、回复冷却和 Provider 调用日志。
