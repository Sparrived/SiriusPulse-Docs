# Memory Units API 文档

## 概述

`memory/units` 模块提供**结构化记忆单元（Memory Unit）**的生成、索引、存储和管理功能。该模块替代了旧有的日记（Diary）子系统，实现了更灵活、可扩展的记忆持久化机制。核心职责包括：

- 从候选的 BasicMemory 条目中提取关键信息，生成多个结构化的记忆单元（每个单元包含标题、摘要、时间戳和标签）。
- 对生成的记忆单元建立向量索引，支持语义检索。
- 管理记忆单元的持久化存储（JSON + 向量索引）。
- 作为 Context Assembler 的数据来源之一，用于增强对话上下文。

## 模块结构

```
memory/units/
├── __init__.py        # 导出 MemoryUnitManager 等
├── generator.py       # 记忆单元生成器（调用 LLM）
├── indexer.py         # 向量索引器（基于 FAISS）
├── manager.py         # 核心管理器，协调生成、索引、存储
├── models.py          # 数据模型（MemoryUnit, UnitsGenerationResult）
└── store.py           # 存储层（JSON 文件读写）
```

## 数据模型 (`models.py`)

### `MemoryUnit`

单个记忆单元的数据结构。

```python
@dataclass
class MemoryUnit:
    unit_id: str          # 唯一标识（UUID）
    title: str            # 标题（简短概括）
    summary: str          # 摘要（一段话）
    created_at: float     # 生成时间戳
    source_group_id: str  # 来源群组 ID
    tags: list[str]       # 标签列表
    source_entry_ids: list[str]  # 来源 BasicMemory entry_id 列表
```

### `UnitsGenerationResult`

生成结果的数据结构。

```python
@dataclass
class UnitsGenerationResult:
    units: list[MemoryUnit]
    raw_response: str  # LLM 的原始响应（供调试）
```

## 核心类与 API

### `MemoryUnitManager` (`manager.py`)

**主要入口**，通过 Engine 初始化。提供以下方法：

| 方法 | 说明 |
|------|------|
| `generate_from_candidates(group_id, candidates, persona_name, persona_description, brain, model_name, min_candidate_count)` | 根据候选条目列表生成记忆单元。如果候选不足则跳过。返回 `UnitsGenerationResult` 或 `None`。 |
| `is_source_checkpointed(group_id, entry_id)` | 检查指定 entry_id 是否已被生成过（避免重复处理）。 |
| `remove_source_checkpoint(group_id, entry_id)` | 移除某个 entry 的已检查点标记（用于重试）。 |
| `get_units_by_group(group_id, limit, offset)` | 分页获取某群组的所有记忆单元（按时间降序）。 |
| `search_similar(query_text, group_id, top_k)` | 基于语义相似度搜索记忆单元，返回 `MemoryUnit` 列表。 |
| `get_unit_by_id(unit_id)` | 根据 unit_id 获取单个单元。 |
| `get_all_units(group_id)` | 获取某群组的所有单元列表（无分页）。 |

**构造函数**：

```python
def __init__(self, work_path: str, embedding_client: AbstractEmbeddingClient)
```

- `work_path`：持久化根目录（内部创建 `memory_units/` 子目录）。
- `embedding_client`：向量嵌入客户端，用于构建索引。

### `MemoryUnitGenerator` (`generator.py`)

**生成逻辑**：

1. 收集候选条目后，调用 LLM（通过 `brain.raw_call`）进行提取。
2. LLM 返回 JSON 格式的多个记忆单元（每个包含 title、summary、tags）。
3. 解析后为每个单元分配 unit_id、时间戳、source_entry_ids。

**核心方法**：

```python
def build_prompt(candidates, persona_name, persona_description, min_candidate_count) -> tuple[str, str, str]
# 返回 (system_prompt, user_content, assistant_content_prefix)

def parse_response(raw: str, source_entry_ids: set[str], source_group_id: str) -> UnitsGenerationResult
# 解析 LLM 响应并返回结果
```

### `MemoryUnitIndexer` (`indexer.py`)

**基于 FAISS 的向量索引**，用于语义搜索。

| 方法 | 说明 |
|------|------|
| `add_units(units: list[MemoryUnit])` | 向索引中添加新单元。会在后台计算 embedding 后追加。 |
| `search(query: str, top_k: int, group_id: str | None) -> list[MemoryUnit]` | 搜索最相似单元。支持按群组过滤。 |
| `remove_unit(unit_id: str)` | 从索引中移除指定单元。 |
| `persist(path: str)` | 将索引保存到磁盘。 |
| `load(path: str)` | 从磁盘加载索引。 |

**注意**：索引使用 L2 距离，嵌入维度固定为 `EMBEDDING_DIM`（默认 768，可通过环境变量 `MEMORY_UNITS_EMBEDDING_DIM` 覆盖）。

### `MemoryUnitStore` (`store.py`)

**基于 JSON 文件的持久化**。每个群组一个独立文件，路径为 `{work_path}/memory_units/{group_id}.json`。

| 方法 | 说明 |
|------|------|
| `save_units(group_id, units: list[MemoryUnit])` | 追加保存多个单元并写回磁盘。 |
| `load_all_units(group_id) -> list[MemoryUnit]` | 加载某群组所有单元。 |
| `mark_checkpoint(group_id, entry_id)` | 记录已处理的 entry_id 到独立文件 `checkpoints.json`。 |
| `is_checkpointed(group_id, entry_id) -> bool` | 检查是否已处理。 |
| `remove_checkpoint(group_id, entry_id)` | 移除检查点记录。 |

## 后台任务 (`bg_tasks.py`)

### `_memory_unit_checkpointer`

替代旧有的 `_diary_promoter` 和 `_diary_consolidator`，定期执行记忆单元生成。

**触发条件**：
- 群组处于“冷寂”状态（热量 < 阈值 且 静默时长 >= 阈值）。
- 群组中有足够数量的未检查点的候选条目（数量 >= `memory_unit_volume_threshold`，默认 8）。

**行为**：
- 调用 `MemoryUnitManager.generate_from_candidates` 生成单元。
- 生成成功后，将结果中的单元保存到存储，并标记所有来源 entry 为已检查点。
- 统计成功生成的单元数并记录日志。

**配置项**（位于 Engine 的 config 字典）：

| 键 | 类型 | 默认值 | 说明 |
|----|------|--------|------|
| `memory_promote_interval_seconds` | int | 180 | 检查间隔（秒） |
| `memory_unit_volume_threshold` | int | `diary_volume_threshold` 或 8 | 触发生成所需的最小候选数 |
| `memory_idle_consolidation_seconds` | int | 3600 | 判定群组静默的秒数阈值（冷寂检测用） |

### 向后兼容

保留 `_diary_promoter` 方法作为 `_memory_unit_checkpointer` 的别名，确保旧有调用不会中断。

## 与 Context Assembler 的集成

`ContextAssembler` 在初始化时接收两个新参数：
- `memory_unit_retriever`：指向 `MemoryUnitManager`。
- `is_source_checkpointed`：回调函数，用于替代旧的 `is_source_diarized`。

这使得对话上下文可以包含最近的记忆单元摘要。

## 从 Diary 迁移说明

如果你之前使用 `diary_manager`，现在建议迁移到 `memory_unit_manager`。

| 旧 API | 新 API |
|--------|--------|
| `engine.diary_manager.is_source_diarized(group_id, entry_id)` | `engine.memory_unit_manager.is_source_checkpointed(group_id, entry_id)` |
| `engine.diary_manager.generate_from_candidates(...)` | `engine.memory_unit_manager.generate_from_candidates(...)` |
| `engine.diary_manager` 属性 | `engine.memory_unit_manager` 属性 |

## 完整使用示例

```python
# 在 Engine 中已经初始化，直接使用
manager = engine.memory_unit_manager

# 为指定群组生成记忆单元
candidates = engine.basic_memory.get_consolidation_candidates(
    group_id, min_age=3600, max_count=20
)
result = await manager.generate_from_candidates(
    group_id=group_id,
    candidates=candidates,
    persona_name=engine.persona.name,
    persona_description=engine.persona.persona_summary or engine.persona.backstory or "",
    brain=engine.brain,
    model_name=cfg.model_name,
    min_candidate_count=8,
)
if result:
    logger.info(f"Generated {len(result.units)} memory units")

# 语义搜索记忆单元
units = manager.search_similar(
    query_text="今天聊了什么？",
    group_id="group_xxx",
    top_k=5
)
for unit in units:
    print(unit.title, unit.summary[:50])
```

## 测试

单元测试位于 `tests/test_memory_units.py`，涵盖了生成、索引、存储的全链路。

运行测试：
```bash
pytest tests/test_memory_units.py -v
```