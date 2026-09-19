# Brain API

`Brain` 位于 `sirius_pulse/core/brain.py`，负责与 LLM 交互。

数据模型：`ChatRequest`、`ChatResult`、`RawRequest`。Brain 支持 pre-hook 和 post-hook，用于在模型调用前后插入逻辑。Brain 不写死厂商逻辑，也不选择真实模型：它向 `ModelRouter` 询问某个认知任务对应的名称，再交给 `OpenAICompatibleProvider` 发往 AMKR。
