# Persona Worker 模块

## 概述

Persona Worker（小跟班）模块允许机器人作为其他 AI（称为“宿主”）的跟班，直接接收并执行任务，而不经过完整的社交决策流程。该模块适用于以下场景：

- 群聊中，其他 AI 通过 @ 提及机器人并下达指令。
- 机器人以“跟班”身份执行技能调用（如查询、计算、生成内容），并返回结果。
- 宿主可以信任为开发者，从而绕过部分权限限制。

核心逻辑位于 `sirius_pulse/persona_worker.py`，其底层依赖 `engine_core.py` 中的 `process_sidekick_task` 方法及 `PromptFactory.assemble_sidekick_task_prompt`。

## 配置

在 `persona_config.py` 中，通过 `sidekick` 键配置小跟班行为：

```python
# persona_config.py 示例
# 模块配置项
sidekick: dict = {
    "max_skill_rounds": 5,           # 技能调用最大轮数（默认3）
    "enable_skills": True,           # 是否允许技能调用
    "allowed_skills": ["weather", "calc"],  # 白名单技能列表（为空表示全部允许）
    "denied_skills": ["admin"],      # 黑名单技能列表
    "trust_host_as_developer": False, # 是否将宿主视为开发者（允许调用任何技能）
}
```

配置项说明：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `max_skill_rounds` | int | 3 | 单次任务中 LLM 连续调用技能的最大轮数，防止无限循环 |
| `enable_skills` | bool | True | 是否允许执行主人格技能列表中的技能 |
| `allowed_skills` | list[str] | [] | 显式允许的技能名列表，空列表表示所有技能均允许（需结合 `denied_skills`） |
| `denied_skills` | list[str] | [] | 禁止调用的技能名列表 |
| `trust_host_as_developer` | bool | False | 若为 True，宿主被视为开发者，可调用任意技能（忽略黑白名单） |

## 触发机制

小跟班任务由**平台级 @ 提及**触发。适配器（如 Napcat）负责解析用户消息中的 `@` 元数据，并设置 `ParsedEvent` 中的字段：
- `at_user_ids: list[str]`：所有被 @ 的用户 ID 列表。
- `mention_all: bool`：是否 @ 了全体成员。

当适配器检测到机器人被 @（且消息来自其他 AI 或预设的宿主），则调用 `persona_worker` 模块处理，而非走常规消息循环。

## 任务处理流程

1. **注册宿主感知**：将宿主用户信息（名称、ID、平台标识）注册到群聊感知中，后续上下文可引用。
2. **构建系统 Prompt**：调用 `PromptFactory.assemble_sidekick_task_prompt`，注入宿主名称、任务文本、技能注册表、开发者标志等。
3. **组装上下文**：使用 `ContextAssembler` 获取历史消息，并与系统 prompt 拼接。
4. **LLM 首次调用**：通过 `brain.chat` 生成回复，task_name 设为 `"sidekick_execute"`，跳过引擎后处理钩子。
5. **技能调用循环**：
   - 若 LLM 返回 tool_calls，则按权限检查（白/黑名单）。
   - 使用 `SkillInvocationContext` 执行技能，结果作为 tool 消息返回。
   - 再次调用 LLM 直到无更多 tool_calls 或达到 `max_skill_rounds`。
6. **返回结果**：返回包含 `reply`（最终文本）、`reply_references` 的字典，适配器据此发送消息。

核心方法签名：

```python
async def process_sidekick_task(
    self,
    *,
    host_user_id: str,
    host_nickname: str,
    task_text: str,
    group_id: str,
    message_type: str = "group",
    platform_message_id: str = "",
    at_user_ids: list[str] | None = None,
    mention_all: bool = False,
) -> dict[str, Any]
```

## Prompt 构造

`PromptFactory.assemble_sidekick_task_prompt` 生成系统提示，结构如下：

- 角色设定：机器人作为宿主的“小跟班”，需直接执行任务，不需要社交礼仪。
- 任务描述：原始 `task_text`。
- 技能列表：若启用技能，列出可用技能名称和描述。
- 权限提示：若 `caller_is_developer=True`，声明宿主为开发者，可调用任何技能。
- 输出格式：要求输出简洁、不带前缀。

最终 prompt 由 `ContextAssembler` 与其他上下文拼接后送入 LLM。

## 技能权限控制

权限检查顺序：
1. 若 `trust_host_as_developer=True`，跳过检查。
2. 若技能在 `denied_skills` 中，返回拒绝。
3. 若 `allowed_skills` 非空且技能不在列表中，返回拒绝。
4. 其他情况允许执行。

拒绝时向 LLM 返回工具调用错误消息（如 `"Skill 'xxx' not in allowed list"`），LLM 需调整策略。

## 回复延迟控制

在处理 partial reply 时，`bg_tasks_delayed.py` 新增了最小领先时间窗口（`partial_reply_lead_seconds`），确保客户端视觉刷新后再发送最终回复，避免文字闪动。该时间可通过 `config.get("partial_reply_lead_seconds", 1.5)` 调整。

## 使用示例（适配器端）

```python
# Napcat 适配器示例（伪代码）
if parsed_event.at_user_ids and bot_id in parsed_event.at_user_ids:
    # 检查发言者是否为预设的宿主 AI
    if speaker.is_ai:
        result = await engine.process_sidekick_task(
            host_user_id=speaker.user_id,
            host_nickname=speaker.nickname,
            task_text=parsed_event.text,
            group_id=parsed_event.group_id,
            platform_message_id=parsed_event.message_id,
            at_user_ids=parsed_event.at_user_ids,
            mention_all=parsed_event.mention_all,
        )
        await send_reply(result["reply"], reply_references=result["reply_references"])
```

## 注意事项

- **禁用后处理**：`post_process=False` 确保引擎的社交决策、情绪分析等后处理不会干扰任务执行。
- **技能安全性**：建议严格配置 `allowed_skills`，避免宿主误调用危险技能。
- **宿主验证**：建议在适配器中验证消息来源的真实性（如检查 session key），防止冒充。
- **上下文长度**：技能调用循环可能产生大量 tool 消息，注意 LLM 的上下文窗口限制。
- **异步兼容**：`process_sidekick_task` 是异步方法，需要在事件循环中调用。

## 依赖模块

| 模块 | 作用 |
|------|------|
| `sirius_pulse.persona_worker` | 提供统一的侧边任务入口 |
| `sirius_pulse.core.engine_core` | 底层任务处理（`process_sidekick_task`） |
| `sirius_pulse.core.prompt_factory` | 构建专用系统提示 |
| `sirius_pulse.memory.context_assembler` | 获取对话历史 |
| `sirius_pulse.skills.models` | 技能调用上下文 |
| `sirius_pulse.persona_config` | 侧边任务配置 |

---

> 本文档基于 v0.18.0 代码生成，具体接口可能随版本更新。请参考 `engine_core.py::process_sidekick_task` 的最新实现。