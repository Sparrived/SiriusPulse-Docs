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
- `plugins/`：宿主机共享的外部 Plugin Git submodule，可包含 `github_monitor`、`amkr_key_manager`、`sub2api_monitor` 等扩展；具体目录以子模块版本为准。`github_monitor` 已外置，不属于核心包或内置 Tool，见 [GitHub Monitor 外部 Plugin](../extensions/github-monitor)。`sub2api_monitor` 的站点与所有接口路径均为运行时配置，其中订阅和倍率监控路径必填；凭据只使用 `SUB2API_EMAIL` / `SUB2API_PASSWORD` 进程环境变量，密码不可经 WebUI 或 settings 保存。其 `notify_group_ids` 是显式允许列表，`run_on_persona` 必须指定唯一轮询 Persona；留空会禁用后台和手动轮询。详见 [Sub2API Monitor](https://github.com/Sparrived/SiriusPulse-Plugins/tree/master/sub2api_monitor)。
