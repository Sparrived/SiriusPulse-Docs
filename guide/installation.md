# 安装

## 环境要求

- Python 3.12 或更高版本。
- Windows、macOS 或 Linux；当前仓库包含 `start.pyw`，更偏向 Windows 桌面双击启动场景。
- 可访问所需模型 Provider 的网络环境。
- 如需 QQ 接入，需要本地或远端 NapCat OneBot v11 WebSocket 服务。

## 获取代码

```bash
git clone https://github.com/Sparrived/SiriusChat.git
cd SiriusChat
```

## 安装依赖

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e .
```

开发依赖：

```bash
pip install -e ".[dev]"
```

## 文档站点

`docs/` 是独立 VitePress 站点：

```bash
cd docs
npm install
npm run dev
```

## 首次启动

```bash
python main.py webui
```

默认 WebUI 监听 `0.0.0.0:8080`。首次运行会自动创建 `data/global_config.json` 和默认数据目录。
