# TUI 与命令行

当前项目主要提供 CLI 和 WebUI；`pyproject.toml` 依赖中包含 Textual，但主要管理界面是 aiohttp 静态 WebUI。

## 命令

| 命令 | 说明 |
|---|---|
| `run` | 启动活跃人格引擎和 WebUI。 |
| `webui` | 启动 WebUI 管理服务。 |
| `webui --foreground` | 前台运行 WebUI。 |
| `webui --status` | 查看 WebUI 后台状态。 |
| `webui --stop` | 停止后台 WebUI。 |
| `persona list` | 列出人格。 |
| `persona create <name>` | 创建人格。 |
| `persona activate <name>` | 切换活跃人格。 |
| `persona delete <name> [--force]` | 删除非活跃人格。 |
