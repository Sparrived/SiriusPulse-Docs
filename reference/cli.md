# CLI 参考

入口：`python main.py <command>`、`sirius-pulse <command>`、`sirius-chat <command>`。

| 命令 | 参数 | 说明 |
|---|---|---|
| `run` | `--butler-port`、`--butler-token` | 启动活跃人格引擎和 WebUI。 |
| `webui` | `--foreground`、`--status`、`--stop` | 启动、查看或停止 WebUI。 |
| `assistant` | `--butler`、`--token`、`--log-level` | 连接管家端。 |
| `persona list` | 无 | 列出所有人格。 |
| `persona create <name>` | 人格名 | 创建人格。 |
| `persona activate <name>` | 人格名 | 切换活跃人格。 |
| `persona delete <name>` | `--force` | 删除非活跃人格。 |
