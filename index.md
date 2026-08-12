---
layout: home
hero:
  name: Sirius Pulse
  text: 异步角色扮演聊天框架
  tagline: 本地优先 · 多人格 · 多模型 · QQ / OneBot 接入 · 可扩展工具与插件
  image:
    src: /yuebai.png
    alt: Yuebai
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quickstart
    - theme: alt
      text: 架构总览
      link: /guide/architecture-overview
features:
  - title: 人格隔离
    details: 每个人格拥有独立配置、记忆、平台适配器和运行状态，由 WebUI 统一启动、停止与切换。
  - title: 多模型编排
    details: 支持统一模型与按任务分配模型，Provider 可接入 OpenAI-compatible、DeepSeek、SiliconFlow、百炼、智谱、火山等。
  - title: 记忆与认知
    details: 基础记忆、语义画像、日记、记忆单元、用户统一档案和认知事件共同构成长期上下文。
  - title: QQ / OneBot
    details: 内置 NapCat OneBot v11 WebSocket 适配器，支持群聊、私聊、图片、@、禁言、戳一戳、撤回和群名片等操作。
  - title: Tools 与 Plugins
    details: Tools 面向模型自主调用工具；Plugins 面向用户显式指令与事件调度，二者独立注册、鉴权和执行。
  - title: WebUI 运维
    details: aiohttp REST API、静态管理面板、WebSocket 事件流、日志、Token、健康状态、记忆可视化和执行历史。
---
