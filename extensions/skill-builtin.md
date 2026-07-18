# 内置 Skill 参考

内置 Skill 位于 `sirius_pulse/skills/builtin/`。

| 文件 | 功能 |
|---|---|
| `interaction.py` | 统一处理戳一戳、图片、表情包和文件上传。 |
| `group_management.py` | 统一处理 QQ 群管理员操作。 |
| `chat_with_developer.py` | 与开发者沟通。 |
| `desktop_screenshot.py` | 获取桌面截图。 |
| `github_monitor.py` | 监控 GitHub 仓库事件。 |
| `learn_term.py` | 学习术语并写入术语表。 |
| `reminder.py` | 创建提醒。 |
| `send_image.py` / `send_sticker.py` / `upload_file.py` | `interaction.py` 的内部实现。 |
| `workspace_file.py` | 工作区文件能力。 |
| `web_lookup.py` | Web 查询。 |
| `system_info.py` | 获取系统信息。 |
| `user_profile.py` | 用户档案。 |
| `qq_member_info.py` | 查询 QQ 群成员信息。 |
| `kick_member.py` / `mute_member.py` / `mute_all.py` / `set_group_card.py` | `group_management.py` 的内部实现。 |
| `poke.py` / `recall_message.py` | `poke.py` 由 `interaction.py` 统一入口调用；`recall_message.py` 保持独立。 |
