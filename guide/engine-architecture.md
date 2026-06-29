# 引擎架构

核心引擎由 `EmotionalGroupChatEngine` 暴露公开能力，主要实现分散在 `engine_core.py`、`pipeline.py`、`brain.py`、`prompt_factory.py`、后台任务和辅助组件中。

## 主要组件

| 组件 | 文件 | 职责 |
|---|---|---|
| `EmotionalGroupChatEngine` | `core/emotional_engine.py` | 对外最终类。 |
| `_EmotionalGroupChatEngineBase` | `core/engine_core.py` | 初始化、生命周期、公开 API 和组件持有。 |
| `Pipeline` | `core/pipeline.py` | 单条消息的五阶段处理。 |
| `Brain` | `core/brain.py` | 构造请求、调用 Provider、执行 Hook 和工具调用流程。 |
| `PromptFactory` | `core/prompt_factory.py` | 汇总人格、记忆、会话、平台上下文和风格参数。 |
| `SessionEventBus` | `core/events.py` | 会话事件发布订阅。 |

## Pipeline 五阶段

1. 感知：接收平台消息，解析发送者、群、私聊、图片、@、回复模式等。
2. 认知：结合上下文、参与策略、冷场状态、情绪与记忆信号。
3. 决策：判断是否回复、是否延迟、是否执行插件或技能。
4. 执行：调用 Brain / Provider，处理工具调用，发送文本、图片或表情。
5. 后台更新：写入记忆、Token、语义画像、日记候选和事件记录。

## Brain 调用

`Brain` 支持 `ChatRequest`、`ChatResult`、`RawRequest`、pre-hook、post-hook、工具调用和 Provider 路由。
