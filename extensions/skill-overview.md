# Skill 总览

Skill 是模型可见工具。模型根据当前对话和工具描述决定是否调用，执行结果再进入模型上下文或直接影响平台动作。

## 核心文件

| 文件 | 说明 |
|---|---|
| `skills/registry.py` | 扫描、加载和注册 Skill。 |
| `skills/executor.py` | 执行 Skill 函数并处理注入参数。 |
| `skills/models.py` | Skill 定义、参数、结果和上下文模型。 |
| `skills/security.py` | 开发者与管理员权限校验。 |
| `skills/telemetry.py` | 执行历史记录。 |
