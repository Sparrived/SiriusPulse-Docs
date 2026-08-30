# Plugin 生命周期与上下文

生命周期：Loader 扫描 `plugins/`，Registry 注册插件定义和命令，Dispatcher 匹配消息，Executor 构建上下文并调用处理器，Scheduler 处理定时事件，WebUI 可启停、重载和修改配置。

## 后台任务

Plugin 可以声明由框架管理的周期任务：

```python
from sirius_pulse.plugins.api import BackgroundTaskSpec, PluginBase


class MonitorPlugin(PluginBase):
    async def poll(self) -> None:
        ...

    def create_background_tasks(self) -> list[BackgroundTaskSpec]:
        return [BackgroundTaskSpec("poll", 60, self.poll)]
```

`BackgroundTaskSpec` 位于扩展公共运行时，并与被动 Tool 共用底层任务契约，但任务归属于 `PluginExecutor`：

- Plugin 实例化成功且引擎启动后台循环后由 Runtime 启动；
- Plugin 卸载或引擎重建时先取消并等待任务；
- 任务异常会被记录，不会自动杀死其他插件；
- 间隔必须大于 0，重复启动同一 Executor 不会重复创建任务；
- 插件不应直接创建无法追踪的 `asyncio.create_task`。

## 主动消息

插件可以通过统一消息管线向群或私聊推送文本、图片及附加动作：

```python
await self.ctx.dispatch_proactive_message(
    group_id="1057020972",
    text="有新的仓库动态～",
    adapter_type="napcat",
    image_path="/path/to/update.png",
)
```

该接口会统一进入事件总线，处理待发送队列、图片、回复引用、表情、戳一戳和私聊激活，不建议 Plugin 直接依赖 NapCat 私有方法。

## 启停与重载

插件配置存储在共享 `plugins/_config.json`，配置管理器按插件目录隔离。WebUI 修改启停、权限或自定义设置后会通知各 Persona Worker 使用兼容的 `all` 类型重建运行时，从而清理旧任务并重新加载配置。禁用插件不会实例化、注册调度任务或启动后台资源。

## 返回值

返回值使用 `PluginResponse`，包含 `success`、`data`、`text`、`error`、`render_mode`、`image_urls`、`message_group` 和 `metadata`。
