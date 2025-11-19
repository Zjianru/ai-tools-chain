# Planning Report Versioning

## Structure {#structure}
- `.ai-tools-chain/planning_outputs/v{n}/`
- `reports/planning/vN/`
- `reports/planning/latest/` → 指向当前版本（符号链接或约定路径）

## Rules {#rules}
- 同步版本号：`planning_report.md` 与 `planning.ai.json` 使用相同版本标识。
- 完整留痕：保留每版 transcript（JSONL），便于审计与回溯。
- 变更记录：在报告中列出相较上一版的核心变更与原因（来自会议纪要简报）。

## Flow {#flow}
- 用户不满意 → 以上一版报告 + 反馈作为输入 → 运行 `/plan` → 生成新版本。
- 更新 `latest/` 指向；Timeline 不维护版本细节，仅链接到阶段锚点。