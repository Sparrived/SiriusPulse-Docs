# 指南

Sirius Pulse 的使用路径建议从安装、快速启动、人格配置开始，再逐步理解架构、记忆、平台和扩展系统。

## 推荐阅读顺序

1. [安装](./installation)：准备 Python、依赖和运行目录。
2. [快速开始](./quickstart)：启动 WebUI，创建人格并配置 Provider。
3. [配置](./configuration)：理解全局配置、人格配置、模型编排和适配器配置。
4. [人格系统](./persona-system)：了解人格目录、子进程和生命周期。
5. [系统架构全景](./architecture-overview)：把 CLI、WebUI、人格进程、平台和模型串起来。
6. [记忆系统](./memory-system)：理解长期记忆如何进入 Prompt。
7. [NapCat / OneBot](./platform-napcat)：接入 QQ。

## 运行形态

- `python main.py webui`：只启动 WebUI 管理服务。
- `python main.py run`：启动活跃人格引擎，同时启动 WebUI。
- `python main.py persona ...`：命令行管理人格。
- `python -m sirius_pulse.persona_worker --config data/personas/<name>`：WebUI 背后用于启动单个人格的子进程入口。

## 目录约定

- `data/global_config.json`：全局设置与当前活跃人格。
- `data/personas/<name>/`：人格配置、记忆、运行状态和日志相关文件。
- `data/providers/`：Provider 配置与模型列表缓存。
- `skills/`：用户安装或开发的外部 Skill。
- `plugins/`：用户安装或开发的外部 Plugin。
