# 编写自定义 Plugin

外部 Plugin 放在仓库根目录的 `plugins/` 下。

```python
from sirius_pulse.plugins.base import PluginBase
from sirius_pulse.plugins.decorators import command
from sirius_pulse.plugins.models import PluginResponse

class HelloPlugin(PluginBase):
    name = "hello"
    display_name = "Hello"
    description = "演示插件"

    @command("hello", prefix="/", patterns=["hello", "你好"], render_mode="direct")
    async def hello(self, name: str = "世界") -> PluginResponse:
        return PluginResponse.ok(text=f"你好，{name}！")
```
