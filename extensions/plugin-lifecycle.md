# Plugin 生命周期与上下文

生命周期：Loader 扫描 `plugins/`，Registry 注册插件定义和命令，Dispatcher 匹配消息，Executor 构建上下文并调用处理器，Scheduler 处理定时事件，WebUI 可启停、重载和修改配置。

返回值使用 `PluginResponse`，包含 `success`、`data`、`text`、`error`、`render_mode`、`image_urls`、`message_group` 和 `metadata`。
