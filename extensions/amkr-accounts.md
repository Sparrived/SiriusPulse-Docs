# AMKR 账号资源外部 Plugin

`amkr_accounts` 位于宿主机 `plugins/` Git submodule，要求 Sirius Pulse **1.3.0+**。它通过 `/amkr account` 从 AMKR 的账号资源接口获取数据，用本地 Pillow 绘制深蓝霓虹科技感看板，通过标准图片消息发送到当前群；`/amkr status` 读取 AMKR 6.9+ 的状态监控，输出渠道健康矩阵与请求趋势。不调用 LLM，也不需要 Playwright / Chromium。

![账号资源看板预览，全部为演示数据](/amkr-accounts-preview.png)

![状态监控看板预览，全部为演示数据](/amkr-status-preview.png)

## 配置与启用

1. 初始化外部插件仓库，确认包含 `amkr_accounts`，然后在 WebUI 的插件管理启用「AMKR 账号资源」。源码不会进入核心 wheel 或 Docker 镜像。
2. 在全局设置中配置 `amkr_base_url` / `amkr_local_api_key`，或为 Persona Worker 注入 `SIRIUS_AMKR_BASE_URL` / `SIRIUS_AMKR_API_KEY`。插件复用框架的凭据解析（支持 `env:NAME`），不要把 Key 发到群里或重复放入插件设置。
3. AMKR 需要支持 `GET /api/cpa-accounts`；在 AMKR 自身面板配置 CPA 实例或可识别订阅供应商，插件只读、不创建账号。`/amkr status` 另需 AMKR **6.9.0+** 并开启 `webui_enabled`，使用 `GET /ui/status-monitor.json`。
4. 所有群成员均可调用，请在可信群中使用；不参与自然语言意图识别，私聊拒绝查询。旧部署若曾配置 `permissions.developer_only=true`，需在插件权限设置中关闭该覆盖。

标准布局根据人格 `work_path` 或 PluginDataStore 从 `data/personas/<人格>` 推导到 `data`；自定义全局目录时，在插件设置 `global_data_path` 填写**绝对路径**。插件不修改全局连接配置。

图片优先使用系统中文字体，缺省尝试源码树已有字体；部署环境如缺少中文字体需安装 Noto Sans CJK / 文泉驿。数字与 ID 优先使用 Cascadia Code，可安装到 `/usr/local/share/fonts/cascadia-code/CascadiaCode.ttf`；Docker 建议持久化到 `/app/data/fonts/cascadia-code/CascadiaCode.ttf`，容器重建后仍可读取。缺少等宽字体则回退已有中文字体。不增加 Python 依赖。

## 使用

```text
/amkr
/amkr account
/amkr account all
/amkr account cpa-main/0
/amkr account opencode-go/main
/amkr account "我的 主力账号"
/amkr account cpa-main
/amkr status
/amkr status 6
```

- 无选择器或 `all` 查询全部 CPA 账号、订阅、空/失败实例。
- CPA 完整 ID 为 `实例ID/auth_index`；订阅 ID 为 `provider_id/key_name`。完整 ID 优先匹配，裸 `auth_index` 不跨实例匹配。
- 名称、邮箱、订阅账号或 Key 名称按唯一值精确匹配；名称含空格可直接输入或加引号。同名时返回候选完整 ID，不会猜选或回退全量。
- CPA 实例 ID 或显示名称可查看该实例全部账号。
- 默认一次发送包含全部匹配资源的横向密集看板，无需页码。**一个账号一条完整横行**，左侧身份只显示一次，右侧以四列布局显示所有额度窗口与数值项；窗口较多仅增加该行高度，不拆成重复账号卡片、不截断窗口。单图最多 64 个账号、高度最多 20000 像素，超过上限会明确提示指定账号或实例缩小查询。
- “指定账号”只是筛选读数，不切换推理账号。
- `/amkr status [小时]` 查询渠道状态，默认近 24 小时，小时数 1–8760。图片包含概览 KPI、每桶请求趋势与失败叠加、非 2xx 错误归因，以及按供应商聚合的健康矩阵（最多 60 行；被 AMKR 截断的行数会在图中说明）。

## 数据口径

显示账号/订阅数、低额度与异常数，以及脱敏标识、供应商、套餐、状态、额度窗口和模型组、重置时刻、余额/积分等数值项。CPA 有成功/失败计数时一并展示。

**所有轨道环均为剩余额度**：AMKR 的 `remaining` 是 0–1 的剩余比例，不是已用百分比。`0.58` 显示剩余 58%；百分比向下取整。缺失窗口或非法比例显示未知，不伪造 0%/满额。不同单位数值不相加、不猜总额度或费用。

窗口来源明确区分“被动快照”（`passive`）和“现场查询”（`quota`）。`fetched_at` 是整轮读取结束时间，不保证被动数据也是刚采集的。时区固定 UTC+08:00；CPA 重置时间扣除其 `server_time_offset_ms`，订阅不造时差。实例、订阅或额度的局部错误不冒充全部成功；保留其余可读资源，错误正文不转发。

状态监控复用 AMKR 状态监控页的同一口径：健康分 = 成功率 60% + 首字 20%（≤1.5s 满分、≥8s 零分）+ 缓存 20%（命中 30% 满分），缺失项按 0 分计；少于 3 次请求显示“样本不足”，0 次显示“无流量”，≥80 健康、50–79 注意、<50 异常。窗口内没有请求时显示“窗口内没有请求”，不把 0/0 显示成 0%。错误归因只汇总同一时间窗口趋势点里的非 2xx 状态码，数量与图中失败总数分开标注。当前固定按供应商（`provider_id`）聚合，不展示上游 Key 名；供应商为空的行显示“未归属”。

## API 与安全边界

插件只有两条只读请求：账号查询为服务端 **`GET {amkr_base_url}/api/cpa-accounts`**，状态查询为 **`GET {amkr_base_url}/ui/status-monitor.json?hours=<小时>&group_by=provider`**，均使用全局管理员凭据的 `Authorization: Bearer` 认证。前者返回 `fetched_at`、`instances[]`（CPA 实例和账号）与 `subscriptions[]`；后者返回同窗口的概览、趋势与按供应商分组的渠道矩阵。不调用含 CPA 管理密钥的 `/api/cpa-instances`，不访问 `/v1` 或 reset/probe/write API，不请求 `/metrics` 明细，也不修改公开 `/amkr` 反代。

这是**整个 AMKR 实例**的运维数据，非某个人格工作空间；`X-AMKR-Workspace` 不提供此处隔离。面板 Key/推理 Key不能代替管理 Key。所有群成员均可查询，请按框架群组访问控制限制使用范围。脱敏后仍有套餐、用量、账号别名等运维信息，只在可信群使用。

响应经白名单投影：隐藏内部地址、原始身份字段、`signals`、`status_message` 和错误正文；邮箱掩码，过滤常见 Key/token 格式及当前管理凭据。不把原始响应交给 LLM，不写账号快照或图片缓存；PNG 在内存生成，并以 Base64 图片片段交给框架，NapCat 无需共享文件系统。账号别名不要自行包含其他秘密。

AMKR **没有单账号或强制刷新接口**；筛选在全量返回后进行。每次命令（包括指定账号）都触发一次真实上游扇出。无后台轮询/自动重试，单插件实例互斥，默认每分钟最多 2 次、每小时最多 30 次。账号读取总超时 75 秒覆盖 AMKR 60 秒预算；状态读取超时 45 秒。账号响应上限 4 MiB、最多 2000 项资源、每账号最多 128 个窗口；状态响应上限 8 MiB、最多 60 行渠道与 500 个趋势点。超限明确报错，不静默截断。

遇到 401/403 检查管理员凭据，404 检查 AMKR 版本与根地址，超时或缺失额度则在 AMKR 面板检查上游实例、订阅与额度提供者。`/amkr status` 返回 404 时，检查 AMKR 是否为 6.9.0+ 且已开启 `webui_enabled`。没有额度提供者不等于余额耗尽。
