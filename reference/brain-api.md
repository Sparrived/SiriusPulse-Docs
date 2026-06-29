# Brain API

`Brain` 位于 `sirius_pulse/core/brain.py`，负责与 LLM Provider 交互。

数据模型：`ChatRequest`、`ChatResult`、`RawRequest`。Brain 支持 pre-hook 和 post-hook，用于在模型调用前后插入逻辑。Brain 不直接写死厂商逻辑，而是通过 Provider 抽象和模型路由完成调用。
