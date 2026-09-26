# AI API 参考

AI 调用统一通过 `OpenAICompatibleProvider`（`sirius_pulse/providers/openai_compatible.py`）完成，端点指向本地 AMKR。请求模型是 `GenerationRequest`，结果模型是 `GenerationResult`。

`GenerationRequest.model` 填**任务名**（例如 `response_generate`、`memory_extract`）。任务名由 AMKR 解析成真实模型，模型选择与采样参数都取 AMKR 任务定义里的值。框架**从不发送** `temperature` 与 `max_tokens`——`GenerationRequest` 已不含这两个字段，请求体里也不写它们；若某个固定值需要调整，请改 AMKR 侧的任务定义。任务名需要在 AMKR 工作空间里已注册，否则 AMKR 会把它当成真实模型去查找并失败。

新增实现应继承 `LLMProvider` 或 `AsyncLLMProvider`。厂商接入、Key 池与故障切换属于 AMKR 的职责，不应在本框架内重新实现。
