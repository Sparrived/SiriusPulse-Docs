# Participation API

## 概述
`ParticipationPolicy` 是一个纯规则驱动的群聊参与决策模块，位于 `sirius_pulse/core/participation.py`。它的职责是在调用任何 LLM 之前，**基于可解释的启发式规则**决定一条消息是否应进入回复队列。每个组件的得分都会被记录，便于在生产环境中根据实际日志调整阈值。

## 数据结构：`ParticipationDecision`
`ParticipationDecision` 是一个带 slots 的数据类（`@dataclass(slots=True)`），存储一次参与评估的完整结果。

| 字段 | 类型 | 说明 |
|------|------|------|
| `strategy` | `ResponseStrategy` | 最终建议的回复策略（`IMMEDIATE`、`DELAYED`、`SILENT`） |
| `reason` | `str` | 决策原因的简短标签（如 `"private_chat"`, `"addressed"`, `"reply_needed"`, `"natural_join"`, `"below_participation_threshold"`） |
| `score` | `float` | 综合得分，用于与阈值比较 |
| `threshold` | `float` | 实际使用的阈值（取各子维度阈值的最小值） |
| `delay_seconds` | `float` | 如果策略为 `DELAYED`，建议的延迟秒数 |
| `addressing_score` | `float` | 被直接提及/呼叫的得分（0～1） |
| `reply_need_score` | `float` | 消息的回复必要性得分（0～1） |
| `social_opportunity_score` | `float` | 社交机会得分，衡量当前是否适合插话（0～1） |
| `conversation_fit_score` | `float` | 上下文契合度得分（0～1） |
| `suppression_score` | `float` | 抑制分数，值越高越应避免回复（0～1） |
| `context` | `dict[str, Any]` | 额外的上下文快照，包括 `urgency_score`, `directed_score`, `heat_level`, `pace`, `turn_gap_readiness`, `social_intent` |

**属性：**
- `should_reply`（`bool`）: 等价于 `strategy != ResponseStrategy.SILENT`。

**方法：**
- `to_dict()`: 将所有字段（含 `context`）转为 Python 字典，供日志或序列化使用。

## 核心类：`ParticipationPolicy`
### `evaluate()` 方法
`evaluate(**kwargs) -> ParticipationDecision` 是参与决策的唯一入口。它接收以下参数（均为关键字参数）：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `signal` | `SignalAnalysis` | 必选 | 由 `compute_signal` 生成的信号分析对象 |
| `content` | `str` | 必选 | 原始消息文本 |
| `is_private` | `bool` | 必选 | 是否为私聊消息 |
| `sender_type` | `str` | `"human"` | 发送者类型（`human` / `system` / `bot` 等） |
| `seconds_since_reply` | `float` | `999999.0` | 距上次回复的秒数 |
| `cooldown_seconds` | `float` | `0.0` | 冷却期秒数，期间内避免非提及回复 |
| `directed_gate` | `float` | `0.5` | 定向回复的默认阈值 |
| `entitlement_threshold` | `float` | `0.4` | 权限分数阈值，低于此值会增加抑制分数 |
| `reply_frequency` | `str` | `"moderate"` | 回复频率模式（`"moderate"`, `"high"`, `"low"`, `"selective"`） |
| `affinity_score` | `float` | `0.0` | 与发送者的亲密度（-1～1） |

### 子得分计算
每个子得分通过独立私有方法计算，均返回 0～1 的 clamp 值。

#### `_addressing_score(signal, directed_gate)`
- 若 `signal.is_mentioned` 为 True，直接返回 1.0。
- 基础分 = `signal.directed_score`。
- 若 `directed_score >= max(0.05, directed_gate*0.75)`，加 0.10。
- 若是问题或祈使句，各加 0.08。

#### `_reply_need_score(signal, text)`
- 根据 `signal.social_intent` 赋予基础分：`help_seeking` 0.58、`emotional` 0.34、`social` 0.14、`silent` 0.02，其余 0.12。
- 问题加 0.23，祈使句加 0.18。
- 正则匹配 `_HELP_RE`（求助相关词）加 0.22，匹配 `_TIME_RE`（紧急时间词）加 0.10。
- 图片相关特征（`_IMAGE_RE` 匹配或 `signal.image_caption` 非空）各加 0.10。
- 基于 `signal.urgency_score`（除以 100 再乘 0.22）和 `signal.relevance_score * 0.16` 调整。

#### `_social_opportunity_score(signal, text, seconds_since_reply, affinity_score)`
- 根据 heat_level 赋基础分：`cold` 0.36、`warm` 0.24、`hot` 0.10、`overheated` -0.18。
- 根据 pace 赋分：`silent` 0.30、`decelerating` 0.22、`steady` 0.12、`accelerating` -0.06。
- 加上 `turn_gap_readiness * 0.28`。
- 若 social_intent 为 social/emotional，加 0.10。
- 若文本匹配 `_SOCIAL_JOIN_RE`（社交接话词），加 0.12。
- 若情感强烈（`|valence| >= 0.45` 且 `arousal >= 0.45`），加 0.08。
- 若距上次回复 >= 90 秒，加 0.08。
- 根据 `affinity_score` 微调（钳制 ±0.08）。

#### `_conversation_fit_score(signal, text, affinity_score)`
- 基础分 = `relevance_score * 0.60`。
- 根据 social_intent 加分：`help_seeking` 0.18、`emotional` 0.14、`social` 0.08。
- 若文本含 HELP_RE 或 SOCIAL_JOIN_RE 模式，加 0.12。
- 若是问题加 0.08，有图片描述加 0.08。
- 亲密度微调（±0.08 * affinity_score）。

#### `_suppression_score(signal, text, sender_type, seconds_since_reply, cooldown_seconds, entitlement_threshold)`
- 高热度抑制：若 heat_level == "overheated"，加 0.25；若同时检测到 burst，再加 0.35。若 heat_level == "hot" 且 burst，加 0.18。
- 冷却期抑制：若 `cooldown_seconds > 0` 且 `seconds_since_reply < cooldown_seconds` 且未被提及，加 `0.25 + remaining_ratio * 0.35`（remaining_ratio = (cooldown_seconds - seconds_since_reply) / cooldown_seconds）。
- 低信息内容抑制：若未被提及且文本匹配 `_LOW_INFO_RE`（纯语气词/标点），加 0.38；若长度 <= 2 字符，再加 0.20。
- 非人类发送者抑制：加 0.28。
- 权限不足抑制：若 `entitlement_score < entitlement_threshold`，加 0.22。
- 嘲讽检测抑制：若 `sarcasm_score >= 0.65` 且 `directed_score < 0.4`，加 0.10。

### 阈值与策略选择
`evaluate()` 内部根据 `reply_frequency` 和 `directed_gate` 计算三个阈值：
- `direct_threshold`（直接回复阈值，默认 `max(0.38, directed_gate)`）
- `need_threshold`（回复必要阈值，默认 0.58）
- `join_threshold`（自然插话阈值，默认 0.50）

`reply_frequency` 影响：
- `"high"`: direct_threshold *= 0.82、need_threshold -= 0.08、join_threshold -= 0.08
- `"low"`: direct_threshold *= 1.15、need_threshold += 0.08、join_threshold += 0.10
- `"selective"`: direct_threshold *= 1.25、need_threshold += 0.12、join_threshold += 0.16
- `"moderate"`: 不变

若 `affinity_score > 0.35`，need 和 join 阈值各降低 0.04；若 `affinity_score < -0.25`，则各提高 0.05。

**决策流程（按优先级）：**
1. **私聊**：阈值 0.2，取 `max(addressing, reply_need, fit)`。若 urgency >= 70 则 IMMEDIATE，否则 DELAYED（延迟 8 秒）。
2. **被直接提及**（`addressing >= direct_threshold` 且 `suppression < 0.9`）：若被 @ 或 urgency >= 80 则 IMMEDIATE，否则 DELAYED（延迟 12 秒）。
3. **回复必要**（`reply_need >= need_threshold` 且 `need_score = reply_need*0.75 + fit*0.25 - suppression*0.25 >= need_threshold` 且 `suppression < 0.78`）：若 urgency >= 80 则 IMMEDIATE，否则 DELAYED（延迟由 `_delay_for` 计算，基础 18 秒）。
4. **自然插话**（文本长度 >= 4、social >= 0.42、fit >= 0.35、suppression < 0.52、`join_score = social*0.45 + fit*0.35 + reply_need*0.20 - suppression*0.35 >= join_threshold`）：DELAYED（延迟由 `_delay_for` 计算，基础 28 秒）。
5. **保持沉默**：其他情况返回 SILENT，得分取各子维度最大值，阈值取三个阈值的最小值。

### 延迟计算 `_delay_for(signal, *, base)`
- 若 urgency >= 70：返回 10 秒。
- 若 urgency >= 50：返回 `min(base, 15)` 秒（base 为 12/18/28）。
- 若 heat_level == "cold" 或 pace == "silent"：返回 `max(18, base - 6)` 秒。
- 否则返回 base。

## 使用示例
```python
from sirius_pulse.core.participation import ParticipationPolicy
from sirius_pulse.models.signal import SignalAnalysis

policy = ParticipationPolicy()
signal = SignalAnalysis(...)  # 由 compute_signal 生成
decision = policy.evaluate(
    signal=signal,
    content="谁能帮我看看这个报错？",
    is_private=False,
    reply_frequency="moderate",
)
if decision.should_reply:
    print(f"策略: {decision.strategy.value}, 延迟: {decision.delay_seconds}s")
else:
    print("不回复")
```

## 配置参数
| 参数 | 影响 |
|------|------|
| `directed_gate` | 控制“被提到”的敏感度 |
| `entitlement_threshold` | 低于此值的用户会被抑制 |
| `reply_frequency` | 整体回复积极度（可选值：moderate/high/low/selective） |
| `cooldown_seconds` | 强制冷却期，避免连发 |

## 相关模块
- `sirius_pulse.models.signal.SignalAnalysis`：提供信号分析结果。
- `sirius_pulse.models.response_strategy.ResponseStrategy`：枚举回复策略。
- `sirius_pulse.core.pipeline.Pipeline`：实际使用 `ParticipationPolicy` 的管道，在 `process_message` 中调用 `evaluate` 做早期过滤。
- `tests/test_participation_policy.py`：包含该策略的单元测试。