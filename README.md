# AI Tools Chain (CLI)

本项目是一个本地优先（local‑first）的 AI 工具链 CLI，帮助个人开发者在任意业务项目内，以“可审计、可回退”的方式完成一次完整的任务（task）：从 OpenSpec 规划 → 强确认 → 代码生成 → 第二视角与审查 → 评测门禁 → 提交或回滚。

提示：当前仓库处于 MVP 快照阶段，已跑通核心流程与护栏；模型调用与部分集成仍为占位实现，可逐步替换为真实 API。

**核心特性**
- 本地优先与可审计：所有过程性资产落在业务项目的 `.ai-tools-chain/` 内，随代码一并受 Git 管控。
- Git 护栏：脏工作区拦截、pre‑commit 空快照、可选 per‑task 分支，随时回滚。
- OpenSpec 驱动：/plan 强制依赖 OpenSpec 规划（强约束）；支持快照与合并 guardrails/acceptance 进任务元数据。
- 模型三角色（占位）：Claude 负责 codegen、Copilot 给第二视角、Codex 做审查；通过配置可替换。
- 评测门禁：/eval 执行 lint/test/promptfoo 等，默认“严格 Gate”；支持配置强制放行（override）。
- VS Code 任务与模板：一键初始化项目模板，开箱即用。

**目录导航**
- 安装与前置依赖
- 快速上手（5 分钟）
- 常用命令与流程
- 配置说明（INI）
- 任务资产与日志归档
- OpenSpec 与 Promptfoo 集成
- 故障排查与常见问题
- 里程碑与路线

---

**安装与前置**
- 环境要求
  - `Node >= 20`
  - `git` 已安装并配置 `user.name`/`user.email`
  - `macOS`（MVP 优先支持；后续考虑 Windows/Linux）
- 推荐工具（用于完整体验；若缺失，相关子流程会提示）
  - OpenSpec CLI：`openspec`（用于规划/校验；默认假设已安装）
  - Promptfoo：建议使用 `npx promptfoo` 或全局安装 `npm i -g promptfoo`
- 本地开发/试用方式（二选一）
  - 全局可执行（开发模式）：在本仓库执行 `npm link`，即可得到 `ai-tools` 命令
  - 直接运行：`node bin/ai-tools.mjs --help`

---

**快速上手（5 分钟）**
- 在你的业务项目根目录执行：
  - 初始化模板：`ai-tools init -y`
  - 环境体检：`ai-tools doctor`
  - 启动 REPL：`ai-tools repl`
- 在 REPL 中按顺序执行：
  - `> /plan`（强制从 OpenSpec 生成 plan 并快照）
  - `> 确认生成`（中文强确认短语）
  - `> /codegen`（生成占位代码，后续可接真实模型）
  - `> /review`（查看 diff 摘要、第二意见与审查摘要）
  - `> /eval`（按 `eval.conf` 执行评测，产出报告，作为 Gate）
  - `> /accept` 或 `> /revert`

---

**常用命令**
- `ai-tools version`：显示版本
- `ai-tools doctor`：环境体检（Node/Git/Python/npx/OpenSpec 存在性等）
- `ai-tools init [-y]`：把模板复制到当前业务项目（不会修改业务代码）
- `ai-tools repl`：进入交互式流程，产生 task 资产并记录对话
- `ai-tools spec:scaffold`：生成/补全 `.ai-tools-chain/openspec/` 模板
- `ai-tools spec:lint`：最小校验 OpenSpec（结构必填项）
- `ai-tools spec:plan`：对最近任务从 OpenSpec 生成/更新 `plan.md` 并快照

REPL 内支持的斜杠命令：
- `/plan`：强制从 OpenSpec 生成计划与快照，并合并 guardrails/acceptance 至本 task 的 `meta.json`
- `/codegen`：执行强确认（“确认生成”），创建 Git 预提交快照后写入示例代码（占位）
- `/review`：显示 `git diff` 摘要、危险路径标记，并尝试调用第二意见与审查（占位实现）
- `/eval`：读取 `eval.conf` 按顺序执行步骤，产出 `eval-*.log` 与 `eval-report.json`
- `/accept`：提交当前改动；默认要求评测 Gate 全通过（可配置 override）
- `/revert`：回滚到本次 codegen 的快照；删除新建文件与丢弃变更
- `/quit`：退出并保存对话

---

**配置说明（INI）**
- 主配置：`.ai-tools-chain/config/toolchain.conf`
  - `[system]`：本地化与数据根目录
  - `[model]`：默认模型与密钥环境变量（占位）
  - `[task]`：TaskID 格式、分支策略、危险路径、白名单、阈值等
  - `[confirm]`：强确认策略
    - `override_phrase`：当 Gate 开启 override 时的强确认短语（默认：确认合入）
  - `[eval]`：评测配置入口与 Gate 策略
    - `config = .ai-tools-chain/config/eval.conf`
    - `allow_gate_override = false`（默认严格；true 时允许强确认放行）
  - `[second_opinion]`：第二意见相关配置（风险分级/阻断策略）
  - `[privacy]`：掩码规则（正则）
- 评测配置：`.ai-tools-chain/config/eval.conf`
  - 分块开启/关闭 `lint/test/promptfoo/ragas/...`，空文件=全部开启
  - 每个块可指定 `cmd` 或 `entry`（我们会捕获 stdout/stderr，写入逐步日志）
- 模型链配置（雏形）：`.ai-tools-chain/config/models.conf`
  - 通过 `profile.<name>.<role>.<序号>` 声明回退链（role: codegen/review/second_opinion）
  - 目前 REPL 仍使用 providers 占位实现，后续将切换至统一 broker/adapter
- 插件配置（预留）：`.ai-tools-chain/config/plugins.conf`
  - 预留 `pre_write/post_write/pre_eval/on_conflict` 钩子顺序与短路策略

---

**任务资产与日志归档**
- 任务目录：`.ai-tools-chain/tasks/<taskid>/`
  - `meta.json`：任务元数据（状态/时间/模型/guardrails/acceptance 等）
  - `plan.md`：人类可读计划（来自 OpenSpec）
  - `transcript.jsonl`：REPL 对话记录（已脱敏）
  - `diff.patch`：变更补丁
  - `patch.json`：结构化补丁清单（create/modify/size/hash）
  - `files/*.full`：改后全文快照
  - `eval-*.log`、`eval-report.json`：评测日志与汇总
- 自动归档（MVP）
  - 当某个任务完成（done/redo）且创建时间超过 7 天，会自动打包部分日志（如 `transcript.jsonl` 与 `eval-*.log`）到 `.ai-tools-chain/archives/<taskid>.tar.gz` 并清理对应日志
  - 后续版本将统一日志到 `tasks/<id>/logs/` 并对整个 logs 目录归档（含 openspec/promptfoo/providers 等），以覆盖更全面的过程性文件

---

**OpenSpec 与 Promptfoo 集成**
- 设计目标：用户“无感知”，在 /plan 与 /eval 中由工具自动调用；若未安装，将在 doctor 或流程中提示安装，用户自行处理。
- OpenSpec（规划/验收来源）
  - 官方 CLI 工作流：在项目根使用 `openspec init .`，以“change”为最小单元。
  - 我们在 `/plan` 中代替用户与 openspec 交互：根据官方要求问 Why/What Changes/Requirements/Targets/Risks/Acceptance 等问题，生成 `openspec/changes/task-<taskId>/change.md` 并调用 `openspec show` 导出 Markdown/JSON，落盘为 `.ai-tools-chain/tasks/<taskId>/plan.md` 与可选的 `plan.openspec.json`。
  - 我们不自创新的 spec DSL，只将 openspec 的输出原样作为 Claude Code / Copilot / Codex 的上下文输入（最多做少量文件列表等字段提取）。
- Promptfoo（评测门禁）
  - 模板路径：`.ai-tools-chain/promptfoo/promptfooconfig.yaml`
  - 执行方式：`npx promptfoo eval -c <config> -o <result.json> --no-table --no-progress-bar --no-write`
  - Gate 判定：退出码非 0，或 result.json 中 `failures>0`/`errors>0` 判为失败；默认阻断 `/accept`，可在 `toolchain.conf` 配置 override 放行。

---

**安全与护栏**
- 强确认：默认要求输入中文短语“确认生成”；后续可接入本地小模型做语义判断（不阻断现有流程）。
- 写入控制：写入前做 Git 快照，支持白名单、危险路径与大改动阈值；删除默认禁止（需再次确认与评估）。
- 回滚路径：`/revert` 回到快照，删除新建文件并丢弃变更。
- 隐私与脱敏：按 `[privacy].mask_patterns` 对对话/日志中的疑似敏感内容进行掩码。

---

**常见问题（FAQ）**
- doctor 提示缺少 OpenSpec/Promptfoo？
  - OpenSpec：请安装官方 CLI（例如 `npm i -g openspec` 或按其文档）；安装后重新 `ai-tools doctor` 或直接重试。
  - Promptfoo：可直接使用 `npx promptfoo`；或安装 `npm i -g promptfoo`。
- `/plan` 提示 OpenSpec 校验失败？
  - 按提示修复 spec/change 内容后再执行；未通过前不进入 codegen。
- `/accept` 被 Gate 阻断？
  - 修复问题并 `/eval` 通过后再提交；如需临时放行，在 `toolchain.conf` 设置 `[eval].allow_gate_override=true`，并在提示时输入 `[confirm].override_phrase`。
- `git` 相关报错？
  - 确保工作区干净、`user.name/email` 已配置；必要时提交/清理，再重试。

---

**里程碑与路线**
- 近期重点
  - 切换 REPL 的 `/codegen`、`/review`、第二意见到统一 `invokeRole` + `models.conf` 链式调用
  - OpenSpec 官方 CLI 深度接入（基于 change 的 JSON/MD 输出）
  - Promptfoo 结果解析细化为指标阈值，补充 Gate 策略
  - 日志目录化与整目录归档（7 天规则）
- 更多细节见：`docs/AI-Tools-Chain-项目介绍与设计说明.md`、`docs/ai-tools-chain-status-and-integration.md`、`docs/ai-tools-chain-milestones-DoD-MVP.md`、`docs/ai-tools-chain-PRD-v1.txt`

---

**贡献与许可**
- 开发建议
  - PR 小步迭代，附带必要的文档/模板改动；新增 provider 需包含适配器与 doctor 检查。
  - 在 `docs/` 记录变更/工作日志（示例：`docs/worklog-YYYY-MM-DD.md`）。
- 许可证
  - 本项目采用 MIT 许可。
