# AI Tools Chain — 项目介绍与设计说明（MVP 快照）
_更新：2025-11-13 15:43:24_

> 目标：把 **本地优先（local‑first）** 的 AI 开发工具链落地到任何业务项目，提供「方案 → 强确认 → 生成 → 审查/第二意见 → 评测 → 提交/回滚」的**可审计**闭环。

---

## 1. 项目愿景
- **让 AI 真正成为“本地协作的工程助手”**：所有与 AI 的交互、决策与输出均落地到业务项目内的 `.ai-tools-chain/`。
- **开发者“可控、可回退、可审计”**：每次改动都是一个 task，有快照、diff、评测与日志。
- **模型与供应商解耦**：通过统一抽象（Broker/Adapter + models.conf），随时切换 Claude / OpenAI / Copilot / 本地模型。

---

## 2. 设计原则（我们讨论达成的一致）
1) **Local‑first**：不上传过程数据，日志/记忆/规则都在业务项目的 `.ai-tools-chain/` 下；只有代码在用户同意后写入业务目录。  
2) **强确认 + 护栏**：任何写操作必须中文“确认生成”；危险路径/删除/大改动二次确认。  
3) **可回溯**：task 级资产完整：`meta.json / plan.md / patch.json / diff.patch / files/*.full / eval-report.json / transcript.jsonl`。  
4) **Git 保护**：先做 **pre‑commit 空提交快照**（`--allow-empty`），脏工作区拒绝；可选 per‑task 分支。  
5) **单一入口**：交互统一在 `ai-tools repl`；IDE 插件（Claude Code/Copilot）**不直接写文件**，避免绕过护栏。  
6) **配置统一**：全部采用 **INI**（`toolchain.conf / eval.conf / plugins.conf / models.conf`），规则清晰、易于版本化。  
7) **多角色一条路**：`codegen / review / second_opinion` 通过同一 `invokeRole(role, payload)` 接口调度，实现可替换与回退链。

---

## 3. 当前功能快照（已完成）
- **CLI**：`version / doctor / init / repl`（Node 20+）。
- **初始化模板**：把 `.ai-tools-chain/config/*.conf` 与 `.vscode/tasks.json` 复制到业务项目。
- **REPL 留痕**：`.ai-tools-chain/tasks/<taskid>/transcript.jsonl`，支持恢复上次任务与内容脱敏（`[privacy].mask_patterns`）。
- **Task 资产**：自动生成 `meta.json / plan.md / patch.json / diff.patch / files/*.full`。
- **强确认流**：中文“确认生成”；命中“危险路径/大改动”二次确认。
- **Git 护栏**：脏工作区拦截、**pre‑commit 空提交快照**、可选 per‑task 分支（命名可配置）。
- **Codegen 骨架**：从 plan 提取文件清单，写入示例内容（后续被模型替换）。
- **Review 与提交/回滚**：`/review` 摘要（`git diff --numstat`），`/accept` 提交，`/revert` 恢复到快照并清理新建文件。
- **评测执行器（占位）**：`/eval` 读取 `eval.conf` 顺序执行（lint/test/promptfoo/ragas 预留），产出 `eval-*.log` 与 `eval-report.json`。
- **Playground**：`scripts/reset_playground.sh` 仅作用于仓库内 `playground/`，带多重确认。

---

## 4. 体系结构（MVP）
```text
业务项目/
└─ .ai-tools-chain/
   ├─ config/
   │  ├─ toolchain.conf      # 系统/任务/护栏配置
   │  ├─ eval.conf           # 评测编排
   │  ├─ plugins.conf        # 插件清单（执行顺序/权限）
   │  └─ models.conf         # 模型与角色的回退链（profile）
   ├─ tasks/<taskid>/
   │  ├─ meta.json
   │  ├─ plan.md
   │  ├─ transcript.jsonl
   │  ├─ diff.patch
   │  ├─ patch.json
   │  ├─ files/*.full
   │  └─ eval-report.json
   └─ second-opinion/<taskid>/second_opinion.md
```
- **REPL 指令**：`/plan`（生成/更新）· `/codegen`（强确认→写入）· `/review`（摘要 + 第二意见/审查摘要）· `/eval`（门禁评测）· `/accept` · `/revert` · `/quit`。

---

## 5. 模型与角色（讨论结果 → 方案）
- **主笔 Codegen：Claude Code**（以 Anthropic API 为实现）  
- **第二视角 Second‑Opinion：Copilot Chat**（优先 gh copilot CLI；失败兜底 OpenAI）  
- **审查 Review：“Codex”角色**（以 OpenAI 模型实现）  

> **统一抽象**：新增 Broker/Adapter 层  
> - `invokeRole('codegen'|'review'|'second_opinion', payload, ctx)`  
> - 由 `models.conf` 决定当前 profile 与 回退链（1→2→…）  
> - 适配器只负责「组 Prompt → 调用 Provider → 标准化输出」，并将请求/响应（脱敏后）写回 `tasks/<taskid>/providers/`。

### 5.1 Prompt 组织与定制约定（2025-11-15 更新）

- 项目级 Prompt 统一放在业务项目的 `.ai-tools-chain/prompts/` 目录下，而不是散落在代码中：
  - `planning.system.md`：规划阶段（`planning` 角色 / PlanningAgent）的系统 prompt；
  - `codegen.system.md`：代码生成阶段（`codegen` 角色）的系统 prompt；
  - `review.system.md`：代码审查阶段（`review` 角色）的系统 prompt；
  - `second_opinion.system.md`：第二视角阶段（`second_opinion` 角色）的系统 prompt。
- `ai-tools init` 会在 `.ai-tools-chain/prompts/` 下生成上述默认模板文件，业务项目可以直接编辑这些文件，自定义各阶段/各角色的行为与风格。
- 模型适配器（如 `deepseekAdapter`）在调用时会遵循如下优先级：
  1. 若业务项目下存在 `.ai-tools-chain/prompts/<role>.system.md` 或 `<role>.md`，优先读取该文件作为 system prompt；
  2. 否则回退到适配器内置的默认 prompt 文本。
- 后续在规划审查（PlanReviewAgent）、测试评估（TestAgent）等阶段，亦将采用相同约定新增对应的 `<phase>.system.md`，保证「每个阶段 × 每个 AI 角色」都有可配置的 prompt 文件，并为后续对接手册与企业内统一规范预留空间。

**models.conf（示例）**
```ini
[models]
active_profile = default

[profile.default.codegen.1]
provider = anthropic
model = claude-3-5-sonnet
api_key_env = "ANTHROPIC_API_KEY"

[profile.default.review.1]
provider = openai
model = gpt-4o
api_key_env = "OPENAI_API_KEY"

[profile.default.second_opinion.1]
provider = gh_copilot

[profile.default.second_opinion.2]
provider = openai
model = gpt-4o-mini
api_key_env = "OPENAI_API_KEY"
```

---

## 6. OpenSpec 与 Promptfoo（接入设计）
### 6.1 OpenSpec（方案 → 计划/护栏/验收）
- 目录：`.ai-tools-chain/openspec/spec.yaml` 与 `schema.yaml`  
- 流程：`/plan from:openspec` → 读取 `spec.yaml` 生成 `plan.md`、将 `guardrails/acceptance` 注入本 task 的 `meta.json`（仅当前任务生效）。
- 命令：`ai-tools spec scaffold | spec lint | spec plan`。

### 6.2 Promptfoo（质量门禁）
- 目录：`.ai-tools-chain/promptfoo/promptfooconfig.yaml`、`datasets/`、`prompts/`  
- 流程：`/eval` 中执行 `npx promptfoo eval -c ...`，把分数/断言写入 `eval-promptfoo.log` 与 `eval-report.json`；未达标则中止评测。
- 命令：`ai-tools pf:scaffold | pf:export`（从 transcript + plan 导出样例）。

---

## 7. 安全与隐私
- **默认本地存储**：日志、模型请求/响应（脱敏后）、计划、评测、补丁全部在 `.ai-tools-chain/`。  
- **脱敏**：`[privacy].mask_patterns` 按正则替换为 `***`。  
- **危险操作防御**：白名单、危险路径、删除/重命名与大改动的二次/三次确认。

---

## 8. 使用指南（5 分钟上手）
```bash
# 业务项目根目录
ai-tools init -y
ai-tools repl
> /plan                      # 编辑 plan.md 的“将改动的文件清单”
> 确认生成
> /codegen                   # 触发强确认与写入（现为 demo；后续接模型）
> /review                    # 查看摘要与第二意见/审查结果
> /eval                      # 跑 lint/test/promptfoo/ragas（按 eval.conf）
> /accept                    # 提交；或 /revert 回滚到快照
> /quit
```

---

## 9. 进度与待办（Roadmap）
**已完成**
- REPL 闭环（强确认/护栏/落盘/评测/提交/回滚）  
- 统一 INI 配置与任务资产格式  
- Playground 清理脚本与 Git 快照策略

**待办（优先级）**
- **P0**：仓库卫生（移除 node_modules 与 .DS_Store，忽略之）  
- **P1**：补齐模板（含 models.conf）、增强 doctor（models & keys & copilot 检查）、README 快速上手  
- **P2**：落地 models.conf + Broker/Adapters；在 /codegen、/review 接入 invokeRole；接 Promptfoo/OpenSpec 的 scaffold 与门禁；最小 CI（Node 18/20 冒烟）

---

## 10. 新的产品思考
1) **三角色一套路径**让“模型/供应商可拔插”成为现实，降低未来切换成本。  
2) **双重强确认**与**变更预算**（行数/文件数阈值）对企业环境更友好。  
3) **任务可复现**：每周自动打“快照压缩”，形成长期可回溯的工程资产。  
4) **插件权限模型**：对每个插件声明 capabilities（读/写/删/执行外部命令），运行前提示用户确认。  
5) **评测门禁**：把 Promptfoo 的关键指标写入配置，未达标即拒绝 /accept。

---

## 11. 贡献与发布
- **发布策略**：从 v0.1.0 起按语义化版本；初期可设置 "private": true 避免误发。  
- **贡献**：PR 坚持小步、可回滚；新增 provider 需附「适配器 + 文档 + doctor 检查」。

—— 完 ——
