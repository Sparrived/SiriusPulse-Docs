# Reply Time Curve

## 概述

`reply_time_curve` 模块提供了一种根据时间段动态调整参与分数（Participation Score）的机制。通过定义一天中不同时刻的系数（0.0 – 2.0），您可以控制 AI 角色在特定时间段的回复倾向性，例如在夜间降低活跃度或在高峰时段提高积极性。

该系数会在参与决策流程中对原始分数进行缩放（`score * coefficient`），最终影响是否回复、延迟时间以及回复策略的选择。

## 配置方式

### 1. 启用开关

在 Engine 配置中设置 `reply_time_curve_enabled: true` 来启用该功能：

```yaml
# engine 配置示例
reply_time_curve_enabled: true
```

### 2. 定义曲线点

通过 `reply_time_curve_points` 列表来指定时间‑系数映射。每个元素包含：

- `time`：24小时制时间字符串（格式：`"HH:MM"`），表示该时刻的系数开始生效。
- `coefficient`：浮点数，范围 `0.0` – `2.0`，`1.0` 表示无影响。

系统会自动根据当前时间在两个相邻点之间线性插值计算实时的系数。如果当前时间早于第一个点或晚于最后一个点，则使用最近的点值（不会进行循环插值）。

#### 配置示例

```yaml
reply_time_curve_points:
  - time: "00:00"
    coefficient: 0.3      # 深夜低活跃
  - time: "08:00"
    coefficient: 0.8      # 早晨逐渐恢复
  - time: "10:00"
    coefficient: 1.2      # 上午高峰
  - time: "13:00"
    coefficient: 1.0      # 午间常态
  - time: "18:00"
    coefficient: 1.5      # 晚间高峰
  - time: "22:00"
    coefficient: 0.5      # 准备休息
```

### 3. 通过 API / WebUI 配置

如果项目包含 WebUI（如 `persona_api.py`），您可以在“个性设置”或“引擎配置”页面中启用该功能并填写曲线点。前端界面（`page-context.js`，`experience.js` 等）可能已提供相应的表单支持。

## 工作原理

### 系数获取

`get_reply_time_coefficient(points, current_time)` 函数执行以下逻辑：

1. 将 `points` 列表按时间排序。
2. 找到当前时间 `current_time`（`datetime.time` 对象）所在的时间区间。
3. 如果在两个点之间，则进行线性插值。
4. 如果在所有点之前或之后，则取第一个或最后一个点的系数。
5. 返回 `0.0` – `2.0` 之间的系数。

### 分数调整

在参与决策（`ParticipationPolicy`）中，关键分数（如 `addressing_score`，`reply_need_score`，`join_score`）会与系数相乘，然后进行 `clamp(0, 2)` 截断。调整后的分数用于与阈值比较，从而决定是否回复以及回复策略。

- 系数 > 1.0 → 增加参与倾向（更易触发回复）
- 系数 < 1.0 → 降低参与倾向（更难触发回复）
- 系数 = 1.0 → 无影响

### 最终分数记录

每个参与决策（`ParticipationDecision`）会保存 `raw_score`（原始分数）、`reply_time_coefficient`（使用的系数）以及 `final_score`（缩放后的最终分数），方便日志和分析。

## 与现有配置的兼容性

- 如果 `reply_time_curve_enabled` 为 `false` 或未配置，则系数固定为 `1.0`，行为与旧版本完全一致。
- `reply_time_curve_points` 为空列表或无效格式时，同样会使用默认系数 `1.0`。
- 该功能不会影响 entitlement 分数、情感亲和度等其他维度。

## 在代码中的集成点

### Pipeline 调用

`pipeline.py` 中的 `_decide_participation` 方法会获取当前时间，调用 `get_reply_time_coefficient`，并将结果传递给 `ParticipationPolicy.make_decision()`。

### 参与策略

`participation.py` 中的 `_scale_reply_score` 函数负责将原始分数与系数相乘并截断。所有分支（private_chat, addressed, reply_needed, natural_join, below_threshold）都应用了该缩放。

### 存储

`BasicMemoryEntry` 新增了 `injected_tool_names` 字段，该字段在引擎的群聊引擎（`_EmotionalGroupChatEngineBase`）中从 `ChatResult` 传递至记忆管理器，用于记录本次回复所使用的工具名称。此字段与本模块无直接关联，但属于同一代码变更的一部分。

## 测试

项目包含针对 `ParticipationPolicy` 的单元测试（`test_participation_policy.py`），建议增加覆盖 `reply_time_coefficient` 的测试用例，验证不同时间点的分数变化。

## 常见问题

### Q: 系数超过 1.0 是否可能导致过度回复？

是的，系数上限为 2.0。建议根据实际数据调整，避免系数过大导致 AI 在非对话语境下频繁回复。通常设置 0.3 – 1.5 之间较为合理。

### Q: 如何处理夏令时或时区？

当前实现使用 Python 的 `datetime.now().time()`（本地时间）。如果需要支持时区，请在调用前将 `current_time` 转换为目标时区的 `time` 对象。推荐在 Engine 配置中指定时区。

### Q: 曲线点是否需要按时间排序？

系统内部会自动排序，但建议用户在配置中按时间顺序编写以提高可读性。

## 参考

- 源代码：`sirius_pulse/reply_time_curve.py`
- 参与策略：`sirius_pulse/core/participation.py`
- Pipeline 集成：`sirius_pulse/core/pipeline.py`
- 单元测试：`tests/test_participation_policy.py`
- WebUI 配置：`sirius_pulse/webui/persona_api.py` 及前端相关文件