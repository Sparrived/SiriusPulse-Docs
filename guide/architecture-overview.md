# 系统架构全景

> **v1.2 多人格架构的真实执行路径与模块边界**
>
> 本文档用人类易读的方式，从"一条消息怎么被处理"到"整个系统怎么运转"，完整描述 Sirius Pulse 的架构。流程图使用 Mermaid 语法。

---

## 第一章：系统全景图

### 1.1 你在看什么

Sirius Pulse 是一个**支持多人格启用的异步角色扮演程序**。想象一个 QQ 群里同时有几个不同的 AI 角色在聊天——有的活泼、有的高冷、有的毒舌——每个人格独立运行、独立记忆、独立配置。

### 1.2 进程模型

```mermaid
flowchart TD
    subgraph MainProcess["主进程"]
        CLI["python -m sirius_pulse run"]
        PM["PersonaManager<br/>扫描/启停/端口分配"]
        WebUI["WebUIServer<br/>aiohttp REST + WebSocket + 认证"]
        NM["NapCatManager<br/>全局安装/多实例调度"]
    end

    CLI --> PM
    CLI --> WebUI
    CLI --> NM

    subgraph PersonaA["子进程 A（人格：月白）"]
        PWA["PersonaWorker<br/>--config data/personas/月白"]
        RTA["EngineRuntime"]
        EngineA["EmotionalGroupChatEngine"]
        BrainA["Brain（LLM 中枢）"]
        AdapterA["NapCatAdapter"]
        PWA --> RTA --> EngineA
        PWA --> AdapterA
        RTA --> AdapterA
        EngineA --> BrainA
    end

    subgraph PersonaB["子进程 B（人格：Sirius）"]
        PWB["PersonaWorker<br/>--config data/personas/Sirius"]
        RTB["EngineRuntime"]
        EngineB["EmotionalGroupChatEngine"]
        BrainB["Brain（LLM 中枢）"]
        AdapterB["NapCatAdapter"]
        PWB --> RTB --> EngineB
        PWB --> AdapterB
        RTB --> AdapterB
        EngineB --> BrainB
    end

    PM -->|"subprocess.Popen<br/>CREATE_NEW_CONSOLE"| PWA
    PM -->|"subprocess.Popen<br/>CREATE_NEW_CONSOLE"| PWB
    NM -->|"共享全局二进制<br/>独立配置/日志"| AdapterA
    NM -->|"共享全局二进制<br/>独立配置/日志"| AdapterB

    PM -->|"维护"| Registry["data/adapter_port_registry.json<br/>端口分配表"]
    BrainA -->|"共用"| Providers["data/providers/provider_keys.json<br/>全局 Provider 注册表"]
    BrainB -->|"共用"| Providers
```

### 1.3 关键设计决策

| 决策 | 说明 |
|------|------|
| **独立子进程** | 每个人格一个独立进程，崩溃不影响其他人格 |
| **数据隔离** | 每个人格有自己的目录 `data/personas/{name}/`，记忆、配置、日志完全隔离 |
| **Brain 统一调用** | 所有人格共用 `provider_keys.json`，但各自有独立的 Brain 实例，LLM 调用总是通过 Brain 完成，不再散落各处 |
| **chat 串行，raw 并行** | `chat()` 通道串行化保证消息顺序；`raw_call()` 通道不受限，可与 chat 并行 |
| **NapCat 多实例** | 每个人格独立的 QQ 实例，共享全局二进制，独立配置和日志 |
| **端口自动分配** | `PersonaManager` 从 3001 开始递增分配 WebSocket 端口 |
| **内存+持久化双写** | 每次记忆写入 `basic_memory`（内存窗口）后自动同步到 `basic_store`（持久化存储），确保重启后上下文不丢失 |

---

## 第二章：主进程启动流程

### 2.1 从命令行到运行

```bash
python -m sirius_pulse run
```

```mermaid
flowchart TD
    A["python -m sirius_pulse run"] --> B["加载 data/global_config.json"]
    B --> C["创建 PersonaManager<br/>扫描 data/personas/ 目录"]
    C --> D["NapCatManager 全局安装检查<br/>自动安装缺失的 NapCat 二进制"]
    D --> E["为每个 enabled 人格<br/>分配 NapCat 端口与实例目录"]
    E --> F["为每个人格启动 NapCat 实例<br/>CREATE_NEW_CONSOLE"]
    F --> G["为每个人格启动 PersonaWorker 子进程<br/>python -m sirius_pulse.persona_worker --config {pdir}"]
    G --> H["启动 WebUIServer<br/>aiohttp REST API"]
    H --> I["主进程阻塞等待<br/>SIGTERM/SIGINT 优雅退出"]
    I --> J["停止所有子进程<br/>停止 NapCat 实例<br/>停止 WebUI"]
```

### 2.2 主进程三大组件

**PersonaManager（人格管家）**
- `create_persona(name)` — 创建新人格目录和默认配置
- `start_persona(name)` — 启动单个人格（含 NapCat 自动管理）
- `run_all()` — 批量启动所有 enabled 人格
- `get_logs(name)` — 读取子进程日志
- `get_status(name)` — 读取子进程心跳状态

**WebUIServer（管理面板）**
- 提供 REST API：人格列表、状态、配置、日志、监控
- 提供 WebSocket 事件推送：实时接收引擎事件
- 提供 JWT 认证：admin/viewer 角色权限控制
- 提供静态页面：Dashboard + 配置面板 + 监控页面
- 不直接操作 NapCat 进程，只通过 API 与 PersonaManager 交互
- 保存 Provider 配置后自动通知所有运行中的人格外进程热重载 provider 配置；WebUI 的存储相关 API 以只读模式打开数据库，避免与引擎写操作产生锁冲突
- 提供用户别名管理 API（添加、删除、shadow 标记），别名数据直接持久化在 `memory.db` 的 `aliases` 表，管理操作不再依赖演化链中间缓存。

**NapCatManager（QQ 管理器）**
- 管理 NapCat 全局二进制（安装、更新）
- 为每个人格创建独立实例目录
- 启动/停止 NapCat 进程

---

## 第三章：人格子进程启动流程

### 3.1 子进程内部发生了什么

```mermaid
flowchart TD
    A["PersonaWorker.run()"] --> B["加载配置<br/>adapters.json / experience.json /<br/>orchestration.json / persona.json"]
    B --> C["创建 EngineRuntime<br/>work_path=人格目录<br/>global_data_path=data/"]
    C --> D["启动 EngineRuntime<br/>懒加载 EmotionalGroupChatEngine<br/>创建 Brain（LLM 中枢）"]
    D --> E["为每个 enabled adapter<br/>创建 NapCatAdapter"]
    E --> F["adapter.start()<br/>启动 WebSocket 连接"]
    F --> G["启动心跳循环<br/>每 10 秒写入 worker_status.json"]
    G --> H["阻塞等待关闭信号"]
    H --> I["清理：停止 adapter、停止 runtime"]
```

### 3.2 子进程内的关键协作

- 所有 bridge 共享同一个 `EngineRuntime` 和同一个 Brain 实例
- 每个 bridge 有自己的 `allowed_group_ids` 配置
- engine 的 `_pending_reminders` 是共享的（所有 bridge 都能投递提醒）
- Brain 是单例的，`chat()` 串行执行，`raw_call()` 可与 chat 并行
- **Brain system prompt 变更**：v1.3 起，Brain 的默认 pre‑hook 不再自动拼接 `memory_spec` 部分。构建系统提示时，将由 `PromptFactory.assemble_chat()` 等上层调用负责组装客户化记忆相关指令。如需自定义记忆策略，请通过 `build_system_prompt()` 或在配置中调整。
- **IdentityResolver 增强解析**：`IdentityResolver` 新增 `resolve_with_alias()` 方法，支持四层解析链（精确平台ID→Bot自识别→别名精确→模糊匹配），返回值含置信度和来源，用于开发者判断和用户解析。
- 引擎支持配置文件热重载，通过写入 `engine_state/reload_requested` 标志文件触发，支持类型：`persona`、`orchestration`、`experience`、`provider`、`all`。其中 `provider` 类型会重新构建 Provider 实例，使 provider 配置变更无需重启引擎。

---

## 第四章：消息处理完整流程

### 4.1 一条消息的一生

假设群里有人发了一条消息："今天工作好累"，看看它怎么被处理。

```mermaid
flowchart TD
    A["QQ 群消息<br/>'今天工作好累'"] --> B["NapCatAdapter<br/>OneBot v11 事件"]
    B --> C["NapCatAdapter.on_message()<br/>解析事件 → 提取内容/发送者/群号<br/>解析引用消息段 (reply)"]
    C --> D["EngineRuntime.process_message()"]
    D --> E["EmotionalGroupChatEngine.process_message()"]

    subgraph Perception["① 感知层（零 LLM 成本）"]
        E --> P1["IdentityResolver.resolve_with_alias()<br/>增强解析链 L1~L4<br/>'今天工作好累' 是谁发的？"]
        P1 --> P2["UserManager.register()<br/>更新/创建用户档案"]
        P2 --> P3["BasicMemoryManager.add_entry()<br/>加入群聊窗口<br/>并持久化到 basic_store"]
        P3 --> P4["RhythmAnalyzer.analyze()<br/>计算群聊热度"]
        P4 --> P5["emit PERCEPTION_COMPLETED"]
    end

    subgraph Cognition["② 认知层（统一 CognitionAnalyzer）"]
        P5 --> C1["联合规则引擎<br/>零成本热路径（~90% 命中率）"]
        C1 --> C2["单次 LLM fallback<br/>通过 Brain.raw_call()"]
        P5 --> C3["记忆检索<br/>BasicMemory + DiaryManager"]
        C2 --> C4["emit COGNITION_COMPLETED"]
        C3 --> C4
    end

    subgraph Decision["③ 决策层（纯规则，零 LLM 成本）"]
        C4 --> D1["RhythmAnalyzer<br/>heat_level / pace / topic_stability"]
        D1 --> D2["ThresholdEngine<br/>threshold = base × activity × engagement × time"]
        D2 --> D3["ResponseStrategyEngine<br/>IMMEDIATE / DELAYED / SILENT / PROACTIVE"]
        D3 --> D4["更新 AssistantEmotionState"]
        D4 --> D5["emit DECISION_COMPLETED"]
    end

    subgraph Execution["④ 执行层"]
        D5 --> X1{"策略？"}
        X1 --"IMMEDIATE"--> X2["立即生成回复"]
        X1 --"DELAYED"--> X3["入 DelayedResponseQueue<br/>等待话题间隙"]
        X1 --"SILENT"--> X4["仅更新内部状态<br/>不生成回复"]
        X1 --"PROACTIVE"--> X5["由 ProactiveTrigger 外部触发<br/>生成自然开场白"]
        X2 --> X6["PromptFactory.assemble_chat()<br/>组装 prompt"]
        X6 --> X7["StyleAdapter 输出长度/语气指令"]
        X7 --> X8["ModelRouter 选择模型"]
        X8 --> X9["Brain.chat()<br/>→ 获取串行锁<br/>→ 构建 gen_request<br/>→ _call_with_retry(rebuild_fn)<br/>→ Provider.generate_async()"]
        X9 --> X10["解析 function_call (tools)"]
        X10 --> X11["Token 追踪记录"]
        X11 --> X12["emit EXECUTION_COMPLETED"]
    end

    X12 --> U["_background_update()<br/>更新群体氛围 + 群规范学习 + 反馈结算 + 情感孤岛检测"]
```

> **新增持久化说明**：在 `BasicMemoryManager.add_entry()` 步骤中，消息不仅被加入内存窗口（最近 30 条），还会通过 `engine.basic_store.append()` 持久化到磁盘。这意味着即使引擎重启，基本记忆仍然可以恢复，对话上下文不会丢失。此持久化同样适用于 AI 回复记录和 SKILL 执行结果。
>
> **纯表情包回复的记忆记录**：当 AI 使用 `send_sticker` 工具发送表情包时，引擎会将使用的表情包名称（最多 3 个）记录到基本记忆中（如 `[STICKERS: 猫猫.jpg, 狗狗.jpg]`），确保纯表情包回复不会丢失。v1.4 起，表情包发送不再通过文本标记，改为工具调用。
>
> **标签记录（用户消息）**：在处理用户消息时，引擎会提取其中的多模态输入（图片、动画表情等）并生成对应的 `tags` 添加到基本记忆中。例如，动画表情产生 `{ "type": "sticker", "label": "动画表情 ×2" }`，普通图片产生 `{ "type": "image", "label": "图片 ×3" }`。这些标签可用于后续检索和统计。
>
> **标签记录（AI 回复）**：AI 回复中的表情包和钉住/取消钉住操作也会以 `tags` 形式记录，例如 `{ "type": "sticker", "label": "表情包: 猫猫.jpg, 狗狗.jpg" }` 或 `{ "type": "pin", "label": "钉住 ×1" }`。v1.4 起，钉住/取消钉住通过 `pin_message` / `unpin_message` 工具实现，不再写入文本标记。
>
> ~~**完整 LLM 消息链记录**：每次 AI 回复生成后（包括立即回复和延迟回复），引擎会将本次对话的完整 LLM 消息链（包含 system prompt 和所有用户/助手交替消息）作为 `conversation_chain` 字段保存到 `BasicMemoryEntry` 中。这为后续检索、调试和上下文重建提供了精确的输入记录，提升了记忆回溯的准确性。~~
>
> **v1.3 变更**：该功能已移除。自动记忆记录和回复时间戳追踪（`_last_reply_at`）不再通过 Brain post‑hooks 执行。延迟回复的记忆写入与去重逻辑已统一由 Brain post‑hooks 处理（见 `_hook_stickers`、`_hook_dedup`、`_hook_pin_messages` 等），因此不再单独保存完整 LLM 消息链。如需保留上下文记录，建议通过 `BasicMemoryManager.add_entry()` 手动写入。

> **插件命令快速拦截**：引擎新增插件命令拦截机制。在感知层完成消息记录后、认知层进行 LLM 或规则分析之前，引擎会检查消息内容是否匹配已注册的插件命令（如 `/ca analyse`）。若匹配，则直接执行插件逻辑并返回结果，避免了 LLM 对命令模式的错误理解。此步骤完全基于规则，零 LLM 成本，确保插件命令的及时响应。
>
> **引用消息解析**：NapCatAdapter 在解析消息段时，新增引用消息（reply 类型）的处理。当检测到回复段时，Adapter 会通过 NapCat API `get_msg` 获取被引用消息的内容和发送者信息，并将其格式化为 `[引用消息 msg_id="xxx" speaker="张三"] 内容 [/引用消息]` 注入到 prompt 中。这确保了 AI 在生成回复时能理解回复的上下文。此步骤完全基于规则，零 LLM 成本。
>
> **@提及解析**：NapCatAdapter 在解析消息时，会自动将 OneBot 协议中的 `@{user_id}` 格式转换为 `AtSegment`。此外，v1.4 扩展了对模型常见输出格式的支持：裸 `@12345` 和 `@qq_12345` 也将被视为提及（即使来源不是协议消息）。对于未知的用户 ID（不在有效用户列表中），此格式会保留为普通文本。解析时优先将纯数字匹配为 QQ 号，避免与中文昵称别名冲突（将数字分支放在正则前面）。

### 4.2 认知层内部细节

```mermaid
flowchart TD
    A["消息内容 + 上下文"] --> B{"规则引擎置信度<br/>≥ 0.9 ?"}
    B --"是（~90%）"--> C["零 LLM 成本返回"]
    B --"否（~10%）"--> D["Brain.raw_call() →<br/>单次 LLM 请求（轻量模型）<br/>自动 transport 重试"]

    subgraph RuleEngine["联合规则引擎"]
        A --> E1["情感词典匹配<br/>valence / arousal / intensity"]
        A --> E2["意图模式匹配<br/>social_intent / subtype"]
        A --> E3["12维指向性信号<br/>mention / reference / name_match / ..."]
        A --> E4["讽刺检测<br/>5 类启发式规则"]
        A --> E5["资格感判断<br/>persona 与话题重叠度"]
        E1 --> C
        E2 --> C
        E3 --> C
        E4 --> C
        E5 --> C
    end

    subgraph LLMFallback["单次 LLM fallback"]
        D --> F1["轻量模型请求联合 JSON<br/>包含 sticker_caption"]
        F1 --> F2["返回完整分析结果<br/>含 sticker_caption 字段"]
    end

    C --> G["上下文融合<br/>情感轨迹 + 群体氛围 + 助手情绪"]
    F2 --> G
    G --> H["返回三元组<br/>EmotionState + IntentAnalysisV3 + EmpathyStrategy"]
```

> **联合规则引擎补充说明**：
> - **情感词典匹配**：基于预定义情感词典计算 valence、arousal、intensity。
> - **意图模式匹配**：识别社交意图（social_intent）及其子类型。
> - **12维指向性信号**：涉及多种信号，包括 mention、reference、name_match、other_mention_score 等。
> - **other_mention_score（v1.4 修正）**：当文本中出现 `@其他用户` 时，如果同时包含 AI 名字（例如“月白，@我一下”），则不再视为 `other_mention`，避免误判。此修正确保指向 AI 的对话不会被错误标记为 @别人。
> - **讽刺检测**：使用 5 类启发式规则识别讽刺。
> - **资格感判断**：根据 persona 配置与话题重叠度评估。

### 4.3 延迟回复的触发

```mermaid
sequenceDiagram
    participant User as 用户
    participant QQ as QQ 群
    participant Adapter as NapCatAdapter
    participant Engine as EmotionalEngine
    participant Brain as Brain
    participant LLM as Provider

    User->>QQ: "今天工作好累"
    QQ->>Adapter: OneBot v11 消息事件
    Adapter->>Engine: process_message()
    Engine->>Engine: 感知层 + 认知层 + 决策层
    Engine-->>Engine: 策略 = DELAYED
    Engine->>Engine: 加入 DelayedResponseQueue
    Engine-->>Adapter: 返回（无立即回复）

    Note over Adapter,Engine: 3 秒后，后台投递循环

    Adapter->>Engine: tick_delayed_queue()
    Engine->>Engine: 话题间隙就绪度 = 0.8 > threshold
    Engine->>Engine: 触发延迟回复生成
    Engine->>Engine: PromptFactory.assemble_chat() 组装 prompt
    Engine->>Brain: Brain.chat(request)
    Note over Brain: 获取串行锁 → 构建 gen_request
    Brain->>LLM: _call_with_retry() → provider.generate_async()
    Note over Brain,LLM: 失败时自动重试 3 次<br/>重试前刷新上下文
    LLM-->>Brain: "辛苦啦！周末好好休息~"
    Brain-->>Engine: ChatResult
    Engine->>Engine: Token 追踪
    Engine-->>Adapter: 返回回复文本
    Adapter->>QQ: 发送群消息
    QQ->>User: "辛苦啦！周末好好休息~"
```

> **搜索内容优化**：延迟回复在构建上下文时，`search_query` 使用去除 XML 标签的原始聊天内容，避免标签干扰日记检索的准确性。
>
> **v1.3 Hook 统一处理**：延迟回复的最终回复处理（表情包解析、去重、记忆记录、时间戳更新）已全部移入 `Brain` 的 post‑hooks，不再由 `DelayedQueueTasks` 内部手动管理。因此 `delayed_response_queue` 中的 `sticker_names`、`clean_text` 等字段直接依赖 `ChatResult` 中 hook 处理后的结果。
>
> **统一消息标签**：v1.4 起，所有 `<message>` XML 标签统一通过 `PromptFactory.tag_message()` 生成，保证格式一致。新增 `platform_message_id` 参数，用于缓存一致性和引用回复，该参数在延迟队列、即时回复、上下文组装中均会传递。

### 4.4 四种响应策略的触发条件

| 策略 | 触发场景 | 行为 |
|------|---------|------|
| **IMMEDIATE** | 被 @、紧急求助、高 relevance | 立即生成并发送回复 |
| **DELAYED** | 一般性对话、话题间隙不够 | 加入队列，等自然间隙再回 |
| **SILENT** | 无关话题、低 relevance、冷却中 | 不回复，只后台学习 |
| **PROACTIVE** | 群聊沉默过久、记忆触发、情感触发 | 主动发起新话题 |

---

## 第五章：后台任务系统

### 5.1 引擎后台任务

引擎内置 8 个后台任务，另有被动 SKILL 注册的任务（如 reminder）并行运行：

```mermaid
flowchart LR
    subgraph BG["内置后台任务（并行运行）"]
        T1["任务1<br/>延迟队列 ticker<br/>智能休眠（3-30s）"]
        T2["任务2<br/>主动触发 checker<br/>每 60 秒"]
        T3["任务3<br/>日记生成 promoter（含情景提取与补提）<br/>每 180 秒"]
        T4["任务4<br/>日记 consolidator<br/>每 600 秒"]
        T5["任务5<br/>开发者私聊 checker<br/>每 60 秒"]
        T6["任务6<br/>表情包新鲜度更新<br/>每 3600 秒"]
        T7["任务7<br/>背景精炼器<br/>每 600 秒"]
    T8["任务8<br/>表情包缓存预热<br/>启动时一次性执行（如无缓存则通过 LLM 生成二元对立关系）"]
    end

    subgraph PassiveSK["被动 SKILL 任务"]
        T8["reminder checker<br/>每 15 秒<br/>通过 create_background_tasks
```