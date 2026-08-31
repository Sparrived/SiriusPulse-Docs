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
