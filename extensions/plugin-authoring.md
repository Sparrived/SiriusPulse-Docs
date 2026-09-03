# 编写自定义 Plugin

外部 Plugin 放在宿主机仓库根目录的 `plugins/` Git submodule 下。它们不属于核心 Python 包；Docker 部署时通过 Compose 将该目录挂载到容器 `/app/plugins`，不要把插件源码复制进镜像。

```python
from sirius_pulse.plugins.base import PluginBase
from sirius_pulse.plugins.decorators import command
from sirius_pulse.plugins.models import PluginResponse


class HelloPlugin(PluginBase):
    _plugin_name = "hello"
    _plugin_display_name = "Hello"
    _plugin_description = "演示插件"
    _plugin_version = "1.0.0"
    _plugin_min_framework_version = "1.3.0"

    @command("hello", prefix="/", patterns=["hello", "你好"], render_mode="direct")
    async def hello(self, name: str = "世界") -> PluginResponse:
        return PluginResponse.ok(text=f"你好，{name}！")
```

`_plugin_min_framework_version` 是运行时兼容性契约；已安装的 Sirius Pulse 低于该版本时，PluginLoader 会拒绝加载。若同时维护 `plugin.json`，其中的 `version`、`min_framework_version` 与 `dependencies` 必须和类属性保持一致；CI 应在不执行 Plugin 代码的情况下用 JSON/AST 校验这组元数据。

## 参数契约与可视化 Schema

插件作者只需声明一次参数与展示元数据：

- `_plugin_parameters` 是唯一的数据契约，负责名称、类型、默认值、必填、选项、数值边界、对象子字段与 `identity: true`；
- `_plugin_ui_schema` 只负责 WebUI 的中文标签、帮助文本、分区、顺序、列宽和安全控件；
- 部署者只在 WebUI 中填写参数值，不需要也不能配置 `identity`、字段类型或 Schema；
- WebUI 只把参数值写入 `plugins/_config.json`，不会持久化 `_plugin_ui_schema`；
- 没有 Schema 的既有插件继续使用通用表单；Schema 无效时整个 Schema 会被忽略并回退到通用表单，不会部分解释。

下面的例子将一个对象数组显示为站点卡片：

```python
class MonitorPlugin(PluginBase):
    _plugin_name = "monitor"
    _plugin_min_framework_version = "1.3.0"
    _plugin_parameters = [
        {
            "name": "sources",
            "type": "object_array",
            "default": [],
            "fields": [
                {
                    "name": "id",
                    "type": "str",
                    "required": True,
                    "identity": True,
                },
                {"name": "display_name", "type": "str"},
                {"name": "enabled", "type": "bool", "default": True},
                {"name": "base_url", "type": "str", "required": True},
                {"name": "timeout", "type": "int", "default": 20, "minimum": 1, "maximum": 300},
            ],
        },
        {"name": "poll_seconds", "type": "int", "default": 300, "minimum": 30},
    ]
    _plugin_ui_schema = {
        "version": 1,
        "layout": "wide",
        "title": "多站监控",
        "description": "稳定 ID 用于状态命名；显示名称只用于展示。",
        "sections": [
            {
                "id": "sites",
                "title": "监控站点",
                "parameters": ["sources"],
                "columns": 1,
                "tone": "accent",
            },
            {
                "id": "runtime",
                "title": "运行参数",
                "parameters": ["poll_seconds"],
                "columns": 2,
            },
        ],
        "parameters": {
            "sources": {
                "label": "站点列表",
                "add_label": "添加站点",
                "empty_title": "尚未配置站点",
                "item_title_field": "display_name",
                "item_fallback_field": "id",
                "item_subtitle_field": "base_url",
                "item_badge_field": "id",
                "item_status_field": "enabled",
                "fields": {
                    "id": {"label": "站点 ID", "widget": "code", "span": 6},
                    "display_name": {"label": "显示名称", "span": 6},
                    "enabled": {
                        "label": "状态",
                        "widget": "switch",
                        "true_label": "监控中",
                        "false_label": "已停用",
                    },
                    "base_url": {
                        "label": "站点地址",
                        "widget": "url",
                        "placeholder": "https://your-service-host.invalid",
                    },
                    "timeout": {"label": "请求超时", "unit": "秒"},
                },
                "fieldsets": [
                    {
                        "id": "identity",
                        "title": "身份与入口",
                        "fields": ["enabled", "id", "display_name", "base_url"],
                    },
                    {
                        "id": "network",
                        "title": "网络",
                        "fields": ["timeout"],
                        "collapsed": True,
                    },
                ],
            },
            "poll_seconds": {"label": "轮询间隔", "unit": "秒", "span": 6},
        },
    }
```

### 顶层结构

| 字段 | 说明 |
|---|---|
| `version` | 必须显式为 `1`。 |
| `layout` | `standard` 或 `wide`；只影响配置弹窗宽度。 |
| `title` / `description` | 配置面板的纯文本介绍。 |
| `sections` | 参数分区；每个参数最多出现在一个分区。 |
| `parameters` | 按参数名提供展示元数据；只能引用 `_plugin_parameters` 中已声明的参数。 |

分区支持 `id`、`title`、`description`、`parameters`、`columns`（`1` 或 `2`）、`collapsed` 和 `tone`（`default`、`accent`、`muted`）。分区未列出的参数会进入框架生成的“其他配置”，因此 Schema 不会改变参数是否可保存。

### 字段展示

所有字段都可使用：

- `label`：显示标签；
- `help`：辅助说明；
- `span`：在 12 列网格中占 `1`–`12` 列。

按参数类型还可使用：

| 参数类型 | 展示字段 |
|---|---|
| `str` / `string` | `placeholder`；`widget` 可为 `text`、`url`、`path`、`code`、`textarea`。 |
| `int` / `float` / `number` | `unit`。 |
| `bool` / `boolean` | `widget: "switch"`、`true_label`、`false_label`。 |
| `list` / `array` | `add_label`、`item_placeholder`。 |
| `schedule` | 无专用展示字段（只使用通用 `label`/`help`/`span`）；按 `[{"time": "HH:MM", "duration": 分钟}]` 校验并可视化编辑，与 `_plugin_schedule` 声明格式一致。 |
| `object_array` | 卡片摘要字段、嵌套 `fields`、`fieldsets`、空状态与添加按钮文本。 |

`object_array` 的 `item_title_field`、`item_fallback_field`、`item_subtitle_field`、`item_badge_field` 只能引用已声明的非秘密标量字段；`item_status_field` 还必须引用布尔字段。`fields` 仍然只是展示映射，不能加入新字段。`fieldsets` 中同一个子字段最多出现一次，未分组字段会由框架放入“其他设置”。

## 安全边界

`_plugin_ui_schema` 是受限 JSON 元数据，不是组件扩展 API。禁止加入：

- HTML、CSS、JavaScript、事件回调、任意组件名或模板表达式；
- `type`、`required`、`identity`、`default`、`choices`、`minimum`、`maximum` 等数据契约字段；
- `__proto__`、`prototype`、`constructor`；
- 未声明、重复或歧义的参数/子字段引用；
- 把 password、token、key、secret、credential、session 等秘密字段用作卡片标题、角标或状态；
- 带 userinfo 或秘密查询参数的 URL 文本。

框架在 Python 模型构造、静态元数据加载、WebUI API 和浏览器四个边界分别校验。Schema 最大 64 KiB，最多 16 个分区、每个对象数组最多 16 个字段组、最多 128 个参数/展示项，嵌套深度最多 8。无效元数据会 fail closed。

秘密参数及名称看起来像秘密的字段不会在 WebUI 中提供明文编辑器。插件应让部署平台从进程环境或受支持的 Secret 管理器注入秘密，不要让用户把明文秘密写入 settings、Schema、README 或示例配置。
