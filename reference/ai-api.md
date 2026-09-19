# AI API 参考

AI 调用统一通过 `OpenAICompatibleProvider`（`sirius_pulse/providers/openai_compatible.py`）完成，端点指向本地 AMKR。请求模型是 `GenerationRequest`，结果模型是 `GenerationResult`。

`GenerationRequest.model` 应填**任务名**（例如 `response_generate`、`memory_extract`）。命中任务名时框架不发送 `temperature` 与 `max_tokens`，由 AMKR 的任务定义决定；填其它名字则按普通模型直连，采样参数由本框架给出。这个「是否委托采样参数」的判定由 provider 的 `task_names` 集合控制，任务名需要在 AMKR 工作空间里已注册。

新增实现应继承 `LLMProvider` 或 `AsyncLLMProvider`。厂商接入、Key 池与故障切换属于 AMKR 的职责，不应在本框架内重新实现。
