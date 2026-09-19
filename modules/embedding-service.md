# Embedding 模块

## 位置

`sirius_pulse/embedding/`

## 职责

向量化由 **AMKR** 提供，本框架不再自己运行模型：`client.py` 封装对 AMKR `/v1/embeddings` 的同步调用，供记忆、日记与检索流程使用。请求带的模型名来自 `global_config.json` 的 `embedding_model`（默认 `BAAI/bge-m3`），凭据用该人格工作空间的**推理 key**。

## 关键协作

- 由 CLI、WebUI 或人格 worker 初始化；`create_embedding_client()` 负责把 AMKR 地址、推理 key 与模型名拼成一个客户端。
- 与 `core/` 的对话管线通过明确的数据模型协作。
- 配置来源优先来自 `data/global_config.json` 和 `data/personas/<name>/`。
- 健康检查走 AMKR `/health`（免费、免鉴权），顺带确认模型已配置。

## 更换模型与索引重建

向量维度随模型变化（`bge-small-zh` 512 维、`bge-m3` 1024 维）。ChromaDB 的 collection 在创建时固定维度并记下模型名，因此换模型后旧索引必须整体重建：WebUI 仪表盘的 Embedding 项会显示「待重建」，气泡内提供重建入口（`POST /api/embedding/rebuild`）。

## 排查建议

1. 先确认相关配置文件是否存在且 JSON 合法。
2. 再检查 WebUI API 返回值和日志。
3. Embedding 报错时，先在 AMKR 侧确认模型已配置、供应商与 Key 可用，且模型名已加入该工作空间的模型白名单。
4. 最后定位对应模块的类和函数，避免跨层修改。
