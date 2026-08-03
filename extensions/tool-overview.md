# Tool 总览

Tool 是模型可见工具。模型根据当前对话和工具描述决定是否调用，执行结果再进入模型上下文或直接影响平台动作。

## 核心文件

| 文件 | 说明 |
|---|---|
| `tools/registry.py` | 扫描、加载和注册 Tool。 |
| `tools/executor.py` | 执行 Tool 函数并处理注入参数。 |
| `tools/models.py` | Tool 定义、参数、结果和上下文模型。 |
| `tools/security.py` | 开发者与管理员权限校验。 |
| `tools/telemetry.py` | 执行历史记录。 |
