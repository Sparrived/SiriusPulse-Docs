# 快速开始

## 1. 启动 WebUI

```bash
python main.py webui
```

访问 `http://127.0.0.1:8080`。也可以使用 `python main.py run` 同时启动活跃人格和 WebUI。

## 2. 创建或选择人格

```bash
python main.py persona list
python main.py persona create default
python main.py persona activate default
```

WebUI 也提供创建、启动、停止和切换人格的页面。

## 3. 连接 AMKR

Sirius Pulse 自身不再内置任何模型厂商实现，所有模型调用统一发往本地 [AMKR](https://github.com/Sparrived/auto-model-key-router)（`auto-model-key-router`，OpenAI 兼容路由）。请先跑起 AMKR，然后在 WebUI 的「全局设置」中填写：

- `amkr_base_url`：AMKR 地址，默认 `http://127.0.0.1:8000`。
- `amkr_local_api_key`：AMKR 的本地授权 Key，与 AMKR 自带面板的管理员凭据相同。**只用于建空间与注册任务名**——模型调用用的是建空间时按人格自动签发的推理 key，不需要你手填。
- `amkr_workspace`：本应用在共享 AMKR 中的命名空间前缀，默认 `sirius-pulse`。

## 4. 注册任务名并配置模型

Sirius Pulse 用**任务名**代替模型名：它把 `response_generate`、`memory_extract` 这类任务名直接填进请求的 `model` 字段，由 AMKR 查表换成真实模型。内置 11 个任务名。

到 WebUI 的「AMKR 运维」页查看连通性与各人格的 `registered` / `missing`，点一次「注册任务名」即可补齐缺失项。注册是只创建、不修改：已存在的任务一律不动。

模型选择、温度、最大 token 和故障切换都在 AMKR 自带面板里按任务配置，Sirius Pulse 内没有模型或参数编辑入口。页面上还提供跳转 AMKR 面板的外链。

## 5. 接入 QQ

NapCat 适配器示例：

```json
{
  "adapter_type": "onebot_v11_napcat",
  "ws_url": "ws://127.0.0.1:3001",
  "access_token": "",
  "enabled": true,
  "group_whitelist": []
}
```

保存后重启人格或点击 WebUI 的引擎重载。

## 6. 查看运行状态

- WebUI 仪表盘：人格状态、Token、日志和健康检查。
- API：`GET /api/monitoring/health`、`GET /api/persona/status`、`GET /api/amkr/status`。
