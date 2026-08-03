# 架构复盘

本文基于当前源码结构对 Sirius Pulse 做全量复盘，目标是帮助维护者快速定位模块边界和后续风险。

## 当前结论

Sirius Pulse 已形成清晰的本地多进程架构：WebUI 作为管理面，人格 worker 作为运行单元，`EngineRuntime` 把平台适配器和核心引擎连接起来，Provider / Memory / Tools / Plugins 分别承担模型、记忆、工具和用户命令扩展职责。

## 优点

- 人格运行隔离，便于重启和故障隔离。
- Provider 抽象相对集中，厂商接入不会污染核心引擎。
- Tools 与 Plugins 分工明确，模型工具和用户命令没有混在一起。
- WebUI 路由集中在 `routes.py`，便于生成 API 文档和检查覆盖。

## 主要风险

- 文档和代码迭代速度不一致，容易出现过期 API、旧 Tool 名称和不存在模块。
- WebUI API 数量多，缺少自动生成的 OpenAPI 或路由测试时容易漏改。
- 记忆系统数据路径多，排查问题需要同时看文件、SQLite、向量库和 API。
- 内置 Tool 涉及本地文件、桌面截图和群管理，应默认最小授权。
