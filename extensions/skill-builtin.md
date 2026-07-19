# 内置 Skill 参考

内置 Skill 位于 `sirius_pulse/skills/builtin/`。

| 文件 | 功能 |
|---|---|
| `bash.py` | 在人格工作区内执行受命令白名单、管道、路径、超时和输出限制控制的 Bash。 |
| `interaction.py` | 统一处理戳一戳和表情包。 |
| `file_upload.py` | 统一处理图片发送和文件上传。 |
| `group_management.py` | 统一处理 QQ 群管理员操作。 |
| `chat_with_developer.py` | 与开发者沟通。 |
| `desktop_screenshot.py` | 获取桌面截图。 |
| `micro_device_status.py` | 获取 developer 的 MicroDeviceStatus 公开设备状态。 |
| `github_monitor.py` | 监控 GitHub 仓库事件。 |
| `learn_term.py` | 学习术语并写入术语表。 |
| `reminder.py` | 创建提醒。 |
| `web_lookup.py` | Web 查询。 |
| `user_profile.py` | 用户档案。 |
| `qq_member_info.py` | 查询 QQ 群成员信息。 |
| `recall_message.py` | 撤回最近的指定消息，保持独立。 |

## Bash 权限

`bash` 默认只允许只读命令，且工作目录和命令参数只能引用当前人格工作区内的相对路径。命令串联、重定向、变量/子命令替换、嵌套解释器、`find -exec` 和危险 Git 操作会被拒绝。

通过人格 Skill 配置接口调整 `bash` 的 `allowed_commands`、`max_timeout_seconds` 和 `max_output_chars`。写入命令需要显式开启 `allow_write_commands`；删除命令还需要单独开启 `allow_destructive_commands`。配置保存在 `{persona}/skill_data/bash.json`，每次调用都会重新读取。
