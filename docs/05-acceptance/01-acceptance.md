# M11 全量验收脚本（Agents + Orchestrator + Planning/Codegen/Review/Test）

| 属性 | 值 |
|------|-----|
| **最后更新** | 2025-11-16 |
| **版本** | v1.0 |
| **状态** | ✅ Current |

---

## 📝 更新历史

- **2025-11-16**: 初稿完成

---

> 目标：在 `playgrounds/testProject` 中，围绕单个 `taskId`，完整走通  
> `/plan（规划工作坊） → /codegen → /review → /eval`，同时带上 Orchestrator 与扩展字段，  
> 统一覆盖原有两份验收文档：
> - `M11-agents-orchestrator-checklist-2025-11-15.md`
> - `M11-3-planning-fields-review-test-acceptance-2025-11-16.md`
>
> 使用方式：按顺序执行命令并勾选清单；如模型未产出某些“增强字段”（scope/non_goals 等），
> 对应检查项可跳过，但必须在备注中说明。

工作目录：`playgrounds/testProject`

---

## 0. 预备

- [ ] 项目根执行一次 `npm install`（如需），确保 `ai-tools` 可用。  
- [ ] `cd playgrounds/testProject`。  
- [ ] `git status` 干净（无未提交改动），便于观察本轮 diff。  
- [ ] `ai-tools` 版本已是当前分支最新代码（包含本次重构）。

---

## 1. 新建 Task + 基础状态

命令：

- [ ] 执行 `ai-tools repl`。  
- [ ] 如提示“检测到上次任务…”，选择 `new`。  
- [ ] 记下 REPL 提示中的 `Task: <taskId>`。

检查：

- [ ] `.ai-tools-chain/tasks/<taskId>/meta.json` 存在，`status = "draft"` 或等价初始状态。  
- [ ] `.ai-tools-chain/tasks/<taskId>/state.json` 存在，`phase = "draft"` 或等价初始阶段。  
- [ ] `docs/AGENTS-ARCH.md` 中描述的 state 结构与实际 `state.json` 字段一致（phase/actors 等，不需要逐字段完全吻合，但无明显偏差）。

---

## 2. /plan：规划工作坊（多轮规划 + OpenSpec + 审查 + 会议纪要）

命令：

- [ ] 在 REPL 中输入一行需求，例如：  
  `> /plan 生成一个简单的计算器,实现简单的加减乘除,使用 shell 脚本`  
  或者类似你真实想做的小任务。

检查目录结构（`tasks/<taskId>/planning/`）：

- [ ] 存在 `planning.transcript.jsonl`，至少包含一条 `role:"user", kind:"brief"` 的记录。  
- [ ] 存在 `planning.ai.json`，顶层为新 schema（无旧版 schema_version/meta/why/what/draft_files 等冗余字段混用）。  
- [ ] 存在 `plan.files.json`，结构为 `{ "files": [...] }`，文件列表与 `planning.ai.json.draft_files` 一致或可解释。  
- [ ] 存在 `plan.md`，内容包括：  
  - [ ] Overview / Why / Requirements 段落；  
  - [ ] Draft Files / Targets / Risks / Acceptance / Test Plan / Open Questions 中若有数据则有对应段落；  
  - [ ] 尾部有 `OpenSpec Change (raw)` 附录（源自 openspec change.md）。

检查 OpenSpec 产物（`openspec/changes/task-<taskId>/`）：

- [ ] `change.md` 存在，包含 Why / What Changes / Requirements / Targets / Risks / Acceptance，并附加 Scope / Non-goals / Draft Files / Test Plan / Open Questions（如规划中存在这些字段）。  
- [ ] `proposal.md` 存在，内容为“指路牌”，明确声明**不**是权威 plan，指向 `tasks/<taskId>/planning/plan.md`。  
- [ ] `specs/task/spec.md` 与 `tasks.md` 存在，内容合理（自动生成的即可）。  
- [ ] `logs/openspec/validate.json` 存在，若有错误则在 `plan-review` 阶段体现。

state 与 REPL 输出：

- [ ] `state.json` 中 `actors.planning.status = "completed"`，`phase` 前进到 `planning_done` 或等价。  
- [ ] `tasks/<taskId>/planning/plan-review.json` 与 `plan-review.md` 已由 `/plan` 内部自动生成，内容符合原“/planreview”小节的检查要求（可按需抽查）。  
- [ ] `tasks/<taskId>/planning/planning.meeting.json` 与 `planning.meeting.md` 已由 `/plan` 内部自动生成，内容符合原“PlanningMeeting”小节的检查要求：  
  - [ ] `planning.meeting.json.planning_summary` 字段完整；  
  - [ ] 若 `ai_meeting` 存在，包含 summary/key_points/risks/open_questions/next_actions/decision；  
  - [ ] `planning.meeting.md` 中有“发现的问题/风险”“各角色结论（概要）”“下一步建议”等小节。  
- [ ] /plan 结束时的 REPL 输出中，有本轮决策（decision）与各角色红灯摘要，以及继续与规划教练对话的提示文案。

> 说明：如仍需单独验证 plan-review 或 planning_meeting，可继续使用 `/planreview` 命令，但  
> 核心验收流程以 `/plan` 一次性完成“规划定稿 + 审查 + 会议纪要”为准。

---

## 3. /codegen：两阶段生成 + IR + patch

命令：

- [ ] 在 REPL 中输入 `/codegen`，按提示输入“确认生成”。  
- [ ] 如配置 `per_task_branch=true`，按提示输入分支类型和 slug（随意但合法）。

检查生成产物（`tasks/<taskId>/`）：

- [ ] 存在 `codegen.plan.json`（phase 1）且通过 zod 校验（本工具已强制校验，文件存在即可）。  
- [ ] 存在 `codegen.ir.json`（文件级 IR），结构为 `{ taskId, generated_at, files: [...] }`。  
- [ ] 存在 `patch.json` 与 `files/<path>.full`（每个改动文件一份 full 快照）。  
- [ ] `plan.files.json.files[]` 中列出的路径就是实际写入的业务文件（可用 `git diff --name-only` 对照）；如模型返回额外路径，应被强协议拒绝。

协议错误兜底：

- [ ] 当模型返回非法 JSON/IR 时，REPL 显示类似：  
  `codegen 失败： codegen_json_*` 或 “内容看起来仍是 JSON”；  
  同时提示：未写入任何业务文件 + 日志路径。  

state：

- [ ] `state.json` 中 `phase` 进入 `code_review` 或之后；`actors.codegen.status = "completed"`（失败时对应 status 表达清晰）。

---

## 6. /review：代码审查 + 多专家会议 + 规划范围检查

命令：

- [ ] 在 REPL 中执行：`/review`。

REPL 输出（扩展字段使用）：

- [ ] 输出中出现“基于规划的范围检查”一节：  
  - [ ] 显示规划中的目标文件数量（draft_files + file_impacts）；  
  - [ ] 显示“可能超出规划范围”的文件列表（如果你在规划外故意改动了文件）；  
  - [ ] 如规划中有 non_goals，显示“不做事项”的摘要。

检查 `tasks/<taskId>/review.json`：

- [ ] JSON 存在，包含：`ok / summary / risks / suggestions`。  
- [ ] `planning_context` 中携带 scope/non_goals/open_questions/test_plan 等信息（若规划有）。  
- [ ] `planning_checks` 中携带 `planned_files / touched_files / out_of_scope_files`。  

检查 `tasks/<taskId>/review.meeting.json` 与 `.md`：

- [ ] `review.meeting.json` 存在，包含 `planning_context / planning_checks`（直接转发自 review.json）。  
- [ ] `review.meeting.md` 中有一节类似 “Planning Scope & Checks”：  
  - [ ] 展示 Scope / Non-goals 摘要；  
  - [ ] 列出 out_of_scope_files（如存在）；  
  - [ ] 简单说明是否建议在进入 accept 前修复越界或非目标改动。

second opinion：

- [ ] 存在 `.ai-tools-chain/second-opinion/<taskId>/second_opinion.md`，内容非空。  
- [ ] `review.meeting.md` 中有 Second Opinion/多专家视角的摘要。

state：

- [ ] `actors.review.status = "completed"`；  
- [ ] `actors.review_meeting.status = "completed"`。

---

## 5. /eval：评测 + test_plan 摘要

命令：

- [ ] 在 REPL 中执行：`/eval`，按提示输入“开始评测”。

REPL 输出：

- [ ] 在评测开始前，终端打印规划中的 test_plan 摘要：  
  - [ ] strategy；  
  - [ ] cases 列表（如存在）；  
  - [ ] automation 描述（如存在）。  
- [ ] 评测过程：  
  - [ ] 显示“评测计划”（每步名称 + 命令）；  
  - [ ] 步骤失败时提示失败步骤名和 `eval-<step>.log` 路径；  
  - [ ] 全部通过时有明确“评测全部通过”文案。

检查 `tasks/<taskId>/eval-report.json`：

- [ ] JSON 存在，包含每个步骤的结果；  
- [ ] 附带 `test_plan_summary` 或同等字段，将规划中的 test_plan 概要沉淀下来。

state：

- [ ] `phase = "test_run"`；  
- [ ] `actors.test.status` 为 `"completed" | "failed" | "error"` 之一。

---

## 6. Orchestrator & /next /redo（可选但推荐）

命令：

- [ ] 在 REPL 中使用 `/status` 查看当前 `state.json`。  
- [ ] 使用 `/next` 多次，观察 Orchestrator 给出的阶段建议与实际 state 是否一致。  
- [ ] 试一次 `/redo planning` 或 `/redo codegen`，确认：  
  - [ ] `state.json.phase` 与 `actors.<phase>.status/round` 发生合理变化；  
  - [ ] `/redo` 本身不自动回滚代码，只改状态。

验收结论：

- [ ] Orchestrator 的阶段决策能反映我们预期的“线性流程 + 条件跳转”；  
- [ ] `/next` 与直呼命令（/planreview /codegen /review /eval）行为一致，不会跳过必要阶段。

---

## 7. 验收通过标准（总体）

当以下条件同时满足时，可认为 M11 当前阶段的改造通过验收：

- [ ] 按本脚本走完 `/plan（含内部 plan-review + planning_meeting） → /codegen → /review → /eval`，中间无明显崩溃或协议级错误；  
- [ ] 所有关键产物（planning/openspec/codegen/review/eval）路径和结构与文档描述一致；  
- [ ] 扩展字段（scope/non_goals/file_impacts/open_questions/test_plan）在存在时被合理消费；缺失时不会导致链路失败；  
- [ ] Orchestrator 的 `/next` / `/redo` 行为与 state.json 描述一致，且不会造成“卡死在某阶段”或莫名跳过阶段；  
- [ ] 你作为验收者，对链路行为与 docs（AGENTS-ARCH / pipeline-artifacts-and-contracts / planning-schema-and-prompt 等）的描述没有核心冲突。

如在执行过程中发现文档与实现不符、或行为不符合预期，建议先在 `docs/acceptance/M11-3-...` 或本文件中补充备注，再决定是否进行修复迭代或接受当前折衷方案。
