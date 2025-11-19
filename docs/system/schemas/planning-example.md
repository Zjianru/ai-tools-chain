# Planning Example {#example}

```json
{
  "id": "M11-3",
  "title": "Planning Phase 迁移与加固",
  "scope": "完成 planning 文档重构与状态机/Schema 落地",
  "assumptions": ["docs 为新入口", "timeline 为唯一状态SSOT"],
  "risks": [{"id":"R1","desc":"锚点不一致导致断链","level":"medium"}],
  "milestones": [{"id":"M11","title":"Docs v2 基础骨架完成","eta":"2025-12-01"}],
  "tasks": [
    {"id":"M11-3-1","title":"编写 timeline-schema 与样例","priority":"P0"},
    {"id":"M11-3-2","title":"提炼并绘制状态机","priority":"P0"}
  ],
  "acceptance": {"dod": ["无断链","字段/枚举一致","Schema 校验通过"]},
  "version": "1.0.0",
  "created_at": "2025-11-19T00:00:00Z",
  "updated_at": "2025-11-19T00:00:00Z"
}
```