# 编写自定义 Skill

外部 Skill 建议放在仓库根目录的 `skills/` 下。

```python
from sirius_pulse.skills.models import SkillResult

SKILL_META = {
    "name": "echo_text",
    "description": "原样返回一段文本。",
    "parameters": [
        {"name": "text", "type": "string", "description": "要返回的文本", "required": True}
    ],
}

async def run(text: str, **kwargs):
    return SkillResult.ok(data={"text": text}, text=f"收到：{text}")
```

元数据写给模型看，应说明何时使用、参数边界和权限限制。
