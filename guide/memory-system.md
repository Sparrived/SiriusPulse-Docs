# 记忆系统

Sirius Pulse 的记忆系统是一组面向不同粒度的上下文组件。

## 模块分层

| 子系统 | 目录 | 说明 |
|---|---|---|
| 基础记忆 | `memory/basic/` | 最近对话、热度与短期事实。 |
| 语义画像 | `memory/semantic/` | 群、用户、全局层面的语义画像。 |
| 日记 | `memory/diary/` | 对会话进行聚类、总结、索引和检索。 |
| 记忆单元 | `memory/units/` | 更结构化的长期记忆片段生成、索引和检索。 |
| 用户档案 | `memory/profile/` | 面向用户的人格化档案条目。 |
| 术语表 | `memory/glossary/` | 通过 Skill 学习和渲染专有术语。 |
| 统一用户 | `memory/user/` | 跨平台用户身份与关系锚点。 |

## 数据进入 Prompt

1. 平台消息写入会话和基础记忆。
2. 认知分析、语义画像、术语和日记后台更新。
3. `ContextAssembler` 与 `PromptFactory` 按当前会话、用户、群和任务筛选记忆。
4. 筛选结果进入模型上下文，影响下一轮回复。

## WebUI 入口

- `/api/persona/diary`
- `/api/persona/memory-viz`
- `/api/persona/glossary`
- `/api/persona/profile/*`
- `/api/persona/conversations`
