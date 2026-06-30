# Experience 页面

## 简介

Experience 页面是 Web UI 中用于管理和可视化 AI 角色（Persona）交互体验的核心面板。通过该页面，用户可以实时调整影响角色响应行为的各项参数，观察时间曲线对参与度决策的影响，并保存配置。页面基于 JavaScript（`experience.js`）实现前端交互逻辑，通过 REST API 与后端 `persona_api.py` 通信，支持复选框、滑块、时间轴编辑等控件。

## 功能概述

Experience 页面提供以下主要功能：
- **响应时间曲线编辑**：允许用户自定义一天中不同时间段的回复时间系数（`reply_time_coefficient`），影响角色在该时段的响应倾向。
- **参与度系数调节**：提供滑块或数值输入，调整参与度决策中的缩放系数（`coefficient`），间接影响 `ParticipationPolicy` 的最终分数。
- **实时预览与测试**：在调整参数后，页面会模拟当前时间点的系数值，并显示其对参与度决策的影响（如得分变化）。
- **配置持久化**：通过 API 将当前配置保存到 Persona 配置文件中，或从现有配置加载。
- **状态指示**：显示当前激活的曲线点、系数值、以及对应的决策阈值变化。

## 页面组件与交互

### 1. 响应时间曲线配置

- **时间轴**：水平轴代表一天 24 小时，垂直轴代表系数值（范围 0.0 ~ 2.0）。
- **控制点**：用户可添加、拖动或删除关键时间点的系数值，构成分段线性曲线。
- **复选框切换**：页面提供“启用时间曲线”复选框，对应后端配置 `reply_time_curve_enabled`。勾选后曲线生效；取消后系数恒为 1.0。
- **实时反馈**：当曲线变化时，页面会根据当前系统时间自动定位到对应区间，并高亮显示当前生效的系数。

### 2. 参与度系数调节

- **全局调整滑块**：滑块范围 0.0 ~ 2.0，步长 0.01。拖动滑块会即时更新 `reply_time_coefficient` 值。
- **重置按钮**：一键将系数重置为 1.0，并清空曲线点（仅当曲线启用时保留形状）。
- **联动展示**：系数变化时，页面会重新计算当前参与度分数（模拟），并显示在“决策预览”区域。

### 3. 决策预览区域

- **当前分数**：实时显示经过系数缩放后的参与度分数（`final_score`）。
- **阈值对比**：显示对应的直接回复阈值、需要回复阈值、加入对话阈值，并用颜色区分是否达标。
- **历史快照**（可选）：记录每次调整前的状态，支持对比。

### 4. 工具栏

- **保存配置**：将当前所有体验参数提交到后端 API（`/api/persona/{persona_name}/experience`），覆盖原有配置。
- **加载配置**：从后端拉取当前 Persona 的体验配置并填充到界面。
- **恢复默认**：重置为系统默认值（系数=1.0，曲线关闭）。

## 数据流与 API

### 数据模型

Experience 页面操作的数据结构对应后端 `PersonaConfig` 中的 `experience` 字段：

```json
{
  "reply_time_curve_enabled": true,
  "reply_time_curve_points": [
    {"time": "00:00", "coefficient": 0.8},
    {"time": "06:00", "coefficient": 1.2},
    ...
  ],
  "reply_time_coefficient": 1.0  // 全局覆盖，当曲线启用时此字段被曲线值覆盖
}
```

### 主要 API 端点

- `GET /api/persona/{persona_name}/experience` – 获取体验配置。
- `PUT /api/persona/{persona_name}/experience` – 保存体验配置。
- `GET /api/persona/{persona_name}/experience/preview?time=HH:MM` – 获取指定时间点的系数值与模拟分数。

### 前端实现

- `experience.js` 使用原生 JavaScript（无框架），通过 `fetch` 调用 API。
- 复选框状态绑定 `reply_time_curve_enabled`，变化时触发曲线控件启用/禁用。
- 滑块绑定 `reply_time_coefficient`，实时更新预览。
- 时间曲线控件支持鼠标拖拽和点击添加点，并通过事件循环更新预览。

## 集成方式

- 页面注册在 Web UI 的导航栏中，通过 `page-context.js` 管理页面加载与生命周期。
- 页面样式定义在 `style.css`，包含曲线容器、滑块、复选框等组件的样式类。
- 后端 `persona_api.py` 在启动时自动注册路由，无需额外配置。

## 注意事项

- 系数值范围限制为 0.0 ~ 2.0，超出会被后端截断。
- 曲线启用时，`reply_time_coefficient` 字段被忽略，由 `get_reply_time_coefficient` 函数根据当前时间计算。
- 页面依赖浏览器支持 Canvas 或 SVG（用于绘制曲线），否则会回退到数值列表输入。
- 测试文件 `tests/js/experience-page-checkboxes.test.mjs` 覆盖了复选框切换、滑块交互和 API 调用场景。

（以上内容基于代码变更推断，具体实现细节请参照 `webui/static/pages/experience.js` 源文件。）