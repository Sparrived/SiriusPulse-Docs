# WebUI 模块

## 位置

`sirius_pulse/webui/`

## 职责

WebUI 使用 aiohttp 提供 REST API、静态前端和 WebSocket 事件。routes.py 是 API 路由表。

全局页面包括「全局设置」（含 AMKR 连接）与「AMKR 运维」页。后者报告连通性、AMKR 版本、`ops_enabled` 与各人格任务登记状态，并可就地嵌入所选人格的 AMKR 工作空间面板（用量读数与任务增删改都在 AMKR 自己的页面里完成）；Sirius Pulse 内没有模型或采样参数编辑入口。面板地址由管理员专用的 `GET /api/amkr/panel` 按需下发，不写进前端源码。

## 前端：月白的小屋

`/` 是新版前端「月白的小屋」：不是运维控制台，而是去她家串门。一个持续存在的 3D 夜空场景
（随真实时间变成白天、黄昏，天空颜色随她的心情偏暖或偏冷）里站着她的立绘，会呼吸、头发会飘、会转头看你的鼠标，
摸她的头会冒出小爱心。引擎的实时事件变成她头顶的小念头（「群里有人说话了」「用一下某个工具」「回好啦」）。
导航是底部的房间码头和 `Ctrl/⌘ + K` 的「想去哪儿？」面板。

| 房间 | 内容 |
|------|------|
| 客厅 | 此刻的心情、醒着/睡着（叫醒/哄睡 = 启停人格）、最近 24 小时的动静与对话 |
| 星图 · 镜子 · 日记 · 回忆 · 心事 · 背包 · 信箱 · 小账本 · 阁楼 | 逐步搬入中；搬好前给出旧版对应页面的入口 |

旧版控制台在搬家期间保留于 `/legacy/`，功能齐全。

- 源码在仓库根目录 `frontend/`（Vite + React + TypeScript + React Three Fiber + Motion + TanStack Query）。
- 构建产物写入 `sirius_pulse/webui/app/` 并**随包提交**，源码与 Docker 用户无需 Node；
  CI 会重新构建并要求与提交的产物逐字节一致。
- 字体全部自托管（霞鹜文楷屏幕阅读版按 unicode-range 分片按需加载），不依赖外部 CDN。
- 偏好里的「安静模式」关闭摇摆与视差（跟随系统的减少动态效果），「省电模式」减少粒子并关闭光晕。

```bash
cd frontend
pnpm install
pnpm dev     # http://localhost:5180/app/ ，API 反代到 SIRIUS_WEBUI_URL（默认 127.0.0.1:8080）
pnpm build   # 类型检查 + 构建到 sirius_pulse/webui/app/
```

### 伙伴视角接口

| 接口 | 说明 |
|------|------|
| `X-Sirius-Persona: <人格目录名>` 请求头 | 让 `/api/persona/*` 作用于指定人格而不改动进程级活跃人格；每个标签页各看各的。人格不存在或名字带路径时返回 404 |
| `GET /api/persona/glance` | 首页一瞥：`mood`（她自己的 valence/arousal 与对应情绪）、最近 24 小时听到/回复的条数与活跃群、最近说过的话、新增与总记忆数、自主行为 |
| `GET /api/personas/{name}/avatar` | 立绘；没有自定义时返回内置默认图，`X-Avatar-Custom` 标明是否自定义 |
| `POST /api/personas/{name}/avatar` | 请求体即图片（≤ 8 MB），统一转成 PNG 并限制最长边 2048 |
| `DELETE /api/personas/{name}/avatar` | 恢复默认立绘 |

## 关键协作

- 由 CLI、WebUI 或人格 worker 初始化。
- 与 `core/` 的对话管线通过明确的数据模型协作。
- 配置来源优先来自 `data/global_config.json` 和 `data/personas/<name>/`。
- 运行时状态会被 WebUI API、日志和事件流观察。

## 排查建议

1. 先确认相关配置文件是否存在且 JSON 合法。
2. 再检查 WebUI API 返回值和日志。
3. 最后定位对应模块的类和函数，避免跨层修改。
