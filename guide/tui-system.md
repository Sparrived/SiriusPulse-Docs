# Sirius Pulse TUI 系统

Sirius Pulse 提供了一套基于终端的用户界面（Terminal User Interface，TUI），用于在命令行环境中交互式地监控、管理和操作机器人。TUI 系统基于 Textual 框架构建（或自定义渲染），支持实时刷新、多面板布局和键盘导航。

## 架构概述

TUI 系统由以下主要组件构成：

- **sirius_pulse/tui.py** – TUI 应用主模块，定义界面布局、事件处理和更新逻辑。
- **sirius_pulse/cli.py** – 命令行入口，包含 TUI 屏幕切换辅助函数（`_enter_tui_screen`、`_exit_tui_screen`）、帧渲染辅助（`_write_frame`、`_capture_render`）以及工具函数（`_header_text`）。
- **全局变量 `_TUI_SCREEN_ACTIVE`** – 标记当前是否处于 TUI 屏幕模式，用于避免嵌套切换。

## 主要功能

- **实时监控**：显示机器人运行状态、消息流、技能执行记录、Token 消耗等。
- **交互式操作**：通过键盘快捷键或面板按钮执行暂停、恢复、配置修改等操作。
- **日志查看**：集成立即的日志输出窗口，支持过滤和搜索。
- **多面板布局**：可自定义分隔的主区域、侧边栏、底部状态栏。

## 启动方式

TUI 可通过 CLI 命令启动：

```bash
python -m sirius_pulse.cli --tui
```

或通过子命令：

```bash
sirius-pulse tui
```

进入 TUI 后，屏幕将切换至备用缓冲区（alternate screen），隐藏光标；退出时恢复原终端状态。

## 核心模块解析

### `sirius_pulse/tui.py`

该模块（尚未在本次代码变更中完全展示，但预期包含以下内容）：

- `TUIApp` 类，继承自 `textual.app.App`（或 `textual.widgets.Widget`），定义应用主题、键绑定、CSS 样式。
- 左右面板（或上下面板）：左侧为消息流列表，右侧为详情/控制面板。
- 底部输入栏：支持命令输入。
- 状态栏：显示连接状态、版本、时间。
- 异步更新循环，通过 `set_interval` 或消息队列刷新数据。

### `sirius_pulse/cli.py` 中的辅助函数

这些函数为 TUI 提供底层终端控制：

| 函数 | 说明 |
|------|------|
| `_enter_tui_screen()` | 切换到备用屏幕，隐藏光标，设置 `_TUI_SCREEN_ACTIVE = True`。 |
| `_exit_tui_screen()` | 显示光标，退出备用屏幕，恢复原始屏幕内容。 |
| `_write_frame(frame)` | 刷新终端内容，写入帧并清除屏幕（使用 ANSI 转义序列）。 |
| `_capture_render(render)` | 捕获可调用对象的打印输出，返回字符串（用于帧构建）。 |
| `_header_text(title, subtitle)` | 生成带有标题和副标题的蓝色装饰器文本块。 |

这些函数通常被 `tui.py` 中的渲染循环调用，而不是直接暴露给用户。

## 配置

TUI 的配置通过全局配置或环境变量控制：

- `TUI_ENABLED`（环境变量）：设为 `1` 可默认启动 TUI。
- `TUI_REFRESH_INTERVAL`（环境变量）：帧刷新间隔（秒），默认 0.5。

## 与其他模块的集成

- **WebUI**：TUI 可与 WebUI 并存，两者通过相同的核心引擎（`Brain`、`EventBus`）共享数据。
- **插件系统**：TUI 面板可注册为插件，显示插件特定的信息。
- **日志系统**：通过 `logging` 模块捕获日志并在 TUI 窗口中实时显示。

## 开发者指南

若要扩展 TUI 功能，可参考以下步骤：

1. 在 `sirius_pulse/tui.py` 中创建新的 `Widget` 子类。
2. 将 widget 添加到 `TUIApp` 的布局中。
3. 使用 `_write_frame` 和 `_capture_render` 实现自定义渲染（如果需要纯终端方式）。
4. 在 `cli.py` 的 `tui` 子命令中注册新 widget 的启动逻辑。

## 注意事项

- TUI 要求终端支持 ANSI 转义序列（大多数现代终端支持）。
- 在非 TTY 环境下，`_enter_tui_screen` 和 `_exit_tui_screen` 不会生效，回退为正常输出。
- 避免与同时使用 `curses` 的其他库冲突（若使用 Textual 则无冲突）。