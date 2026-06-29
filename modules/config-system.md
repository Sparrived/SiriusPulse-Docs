# 配置系统模块

## 位置

`sirius_pulse/config/`

## 职责

配置系统负责读写 JSON/JSONC、构建默认配置、校验配置模型，并为 WebUI、人格进程、Provider 和编排策略提供统一数据结构。

## 关键协作

- 由 CLI、WebUI 或人格 worker 初始化。
- 与 `core/` 的对话管线通过明确的数据模型协作。
- 配置来源优先来自 `data/global_config.json` 和 `data/personas/<name>/`。
- 运行时状态会被 WebUI API、日志和事件流观察。

## 排查建议

1. 先确认相关配置文件是否存在且 JSON 合法。
2. 再检查 WebUI API 返回值和日志。
3. 最后定位对应模块的类和函数，避免跨层修改。
