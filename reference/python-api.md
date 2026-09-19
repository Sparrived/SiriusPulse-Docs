# Python API 参考

## 稳定入口

- 引擎：`EmotionalGroupChatEngine`、`Brain`、`ChatRequest`、`ChatResult`、`Pipeline`、`PromptFactory`。
- 配置：`OrchestrationPolicy`、`SessionConfig`、`WorkspaceConfig`、`ConfigManager`。
- AMKR 接入：`LLMProvider`、`AsyncLLMProvider`、`GenerationRequest`、`GenerationResult`、`OpenAICompatibleProvider`、`MockProvider`、`AmkrSettings`、`load_amkr_settings`、`register_persona_tasks`、`SyncResult`、`AmkrError`。
- Tool：`ToolDefinition`、`ToolResult`、`ToolRegistry`、`ToolExecutor`。
- Plugin：`PluginBase`、`command`、`PluginResponse`、`CommandAST`。
- 消息：`Message`、`Transcript`、`ReplyRuntimeState`、`MessageGroup`、`TextSegment`、`ImageSegment`。
