# 指南

Sirius Pulse 的使用路径建议从安装、快速启动、人格配置开始，再逐步理解架构、记忆、平台和扩展系统。

## 推荐阅读顺序

1. [安装](./installation)：准备 Python、依赖和运行目录。
2. [Docker 部署](./docker-deployment)：部署、迁移和更新服务器上的单容器服务。
3. [快速开始](./quickstart)：启动 WebUI，创建人格并配置 Provider。
4. [配置](./configuration)：理解全局配置、人格配置、模型编排和适配器配置。
5. [人格系统](./persona-system)：了解人格目录、子进程和生命周期。
6. [系统架构全景](./architecture-overview)：把 CLI、WebUI、人格进程、平台和模型串起来。
7. [记忆系统](./memory-system)：理解长期记忆如何进入 Prompt。
8. [NapCat / OneBot](./platform-napcat)：接入 QQ。
9. [扩展开发](../extensions/)：了解 Tool 与 Plugin 的能力边界及开发方式。

## 运行形态

- `python main.py webui`：只启动 WebUI 管理服务。
- `python main.py run`：启动活跃人格引擎，同时启动 WebUI。
- `python main.py persona ...`：命令行管理人格。
- `python -m sirius_pulse.persona_worker --config data/personas/<name>`：WebUI 背后用于启动单个人格的子进程入口。

## 目录约定

- `data/global_config.json`：全局设置与当前活跃人格。
- `data/personas/<name>/`：人格配置、记忆、运行状态和日志相关文件。
- `data/providers/`：Provider 配置与模型列表缓存。
- `data/personas/<name>/tools/`：该人格安装或开发的外部 Tool；内置 Tool 位于核心包的 `sirius_pulse/tools/builtin/`。
- `plugins/`：宿主机共享的外部 Plugin Git submodule，可包含 `github_monitor`、`amkr_key_manager`、`sub2api_monitor` 等扩展；具体目录以子模块版本为准。`github_monitor` 已外置，不属于核心包或内置 Tool，见 [GitHub Monitor 外部 Plugin](../extensions/github-monitor)。
- `sub2api_monitor`：通过 `sources` 管理多站点；每站 ID 派生 `SUB2API_<ID>_EMAIL/PASSWORD`，`display_name` 仅用于展示，接口路径运行时必填且不硬编码。全局通知群可按站继承，命令可用 ID、唯一显示名称或 `all` 选择；显式 `sources: []` 禁用全部站点。Playwright Chromium 仅提供可选图片，自动渲染失败时文字通知仍继续。旧版单站配置在没有 `sources` 键时保持兼容；切换为显式单目标且凭据齐全、目标无新状态时，只有 endpoint/account/timezone 旧指纹逐集合精确匹配的状态会确定性迁移，多站、已有新状态或不匹配时绝不猜测，旧顶层数据保留。凭据不能保存到 WebUI/settings；安全与排障见 [Sub2API Monitor](https://github.com/Sparrived/SiriusPulse-Plugins/tree/master/sub2api_monitor)。
