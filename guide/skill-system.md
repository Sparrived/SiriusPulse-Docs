# Skill 系统

Skill 是模型可自主调用的工具系统。它不同于 Plugin：Skill 服务于模型推理和工具调用，Plugin 服务于用户显式指令。

## 目录

- 内置 Skill：`sirius_pulse/skills/builtin/`。
- 外部 Skill：`skills/`。
- 注册与加载：`sirius_pulse/skills/registry.py`。
- 执行：`sirius_pulse/skills/executor.py`。
- 鉴权：`sirius_pulse/skills/security.py`。
- 执行记录：`sirius_pulse/skills/telemetry.py`。

## 核心模型

`SkillDefinition`、`SkillParameter`、`SkillResult`、`SkillInvocationContext`、`BackgroundTaskSpec`、`TriggerSpec`。

Skill 可以通过 `SKILL_META["config"]` 声明不暴露给模型的、按人格保存的配置参数。配置通过人格 Skill API 保存到 `skill_data/{skill_name}.json`，运行时由 Skill 自己从注入的 `data_store` 读取。

内置 `bash` 是受控命令工具：默认只开放只读命令，限制在人格工作区内，拒绝命令串联、重定向、嵌套解释器和危险路径。文件发送使用 `file_upload`，因为 Bash 不直接拥有聊天平台桥接能力。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/persona/skills` | 列出人格 Skill。 |
| `POST` | `/api/persona/skills/{skill_name}/toggle` | 启停 Skill。 |
| `GET` | `/api/persona/skills/{skill_name}/config` | 获取 Skill 配置。 |
| `POST` | `/api/persona/skills/{skill_name}/config` | 保存 Skill 配置。 |
| `GET` | `/api/persona/skill-history` | 查看 Skill 执行历史。 |
