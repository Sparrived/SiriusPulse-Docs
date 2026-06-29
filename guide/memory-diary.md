# 日记记忆

日记系统负责把对话历史压缩成可检索的长期片段。它位于 `sirius_pulse/memory/diary/`。

## 关键类

| 类 | 文件 | 说明 |
|---|---|---|
| `TopicClusterer` | `clusterer.py` | 将候选消息聚类为主题。 |
| `DiaryGenerator` | `generator.py` | 调用模型生成日记内容。 |
| `DiaryConsolidator` | `consolidator.py` | 合并与整理日记。 |
| `DiaryFileStore` | `store.py` | 文件存储。 |
| `DiaryIndexer` | `indexer.py` | 建立索引。 |
| `DiaryRetriever` | `indexer.py` | 按查询检索相关日记。 |
| `DiaryVectorStore` | `vector_store.py` | 向量存储封装。 |

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/persona/diary` | 获取日记。 |
| `POST` | `/api/persona/diary` | 创建日记。 |
| `PUT` | `/api/persona/diary/{entry_id}` | 更新日记。 |
| `DELETE` | `/api/persona/diary/{entry_id}` | 删除日记。 |
| `GET` | `/api/persona/vector-store-status` | 查看向量库状态。 |
| `POST` | `/api/persona/vector-store/rebuild` | 重建向量库。 |
