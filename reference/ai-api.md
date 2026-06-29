# AI API 参考

AI 调用主要通过 Provider 抽象完成。请求模型是 `GenerationRequest`，结果模型是 `GenerationResult`。

新增 Provider 应继承或复用 `LLMProvider`、`AsyncLLMProvider`、`OpenAICompatibleProvider`。OpenAI-compatible 服务优先复用 `openai_compatible.py`。
