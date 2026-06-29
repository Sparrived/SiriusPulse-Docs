# 开发参考

```bash
pip install -e ".[dev]"
python -m pytest
python -m black --check sirius_pulse tests
python -m isort --check-only sirius_pulse tests
```

## 修改原则

- Provider 逻辑放在 `sirius_pulse/providers/`。
- 平台逻辑放在 `sirius_pulse/platforms/`。
- WebUI 路由先更新 `sirius_pulse/webui/routes.py`。
- 新增 Skill 或 Plugin 时同步扩展文档。
- 不要提交 API Key、账号 Cookie 或私有数据。
