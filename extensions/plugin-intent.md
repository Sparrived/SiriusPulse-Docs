# Plugin 自然语言意图

Plugin 可以暴露自然语言示例，让系统在用户没有输入显式命令时尝试识别意图。

相关模型 `PluginNaturalLangDef` 包含 `examples` 和 `slots`。涉及删除、踢人、禁言、文件写入或外部调用的命令，默认应隐藏自然语言意图，只允许显式命令触发。
