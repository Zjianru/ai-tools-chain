# AI Tools Chain — 交接说明（2025-11-15）

| 属性 | 值 |
|------|-----|
| **最后更新** | 2025-11-15 |
| **版本** | v1.0 |
| **状态** | ✅ Current |

---

## 📝 更新历史

- **2025-11-15**: 初稿完成

---

> 说明：关于规划阶段（/plan）与规划工作坊的最新行为/角色/澄清策略，  
> 请优先以 [docs/02-architecture/10-planning-workshop-design.md](../02-architecture/10-planning-workshop-design.md) 为准；本文件中的相关描述如有出入，以该总纲为准。  
> 这是一份面向“下一位助手/贡献者”的交接文档，补充说明当前（2025-11-15）仓库状态、已完成工作、待办事项与优先级，以及相关协议文档。  
> 请优先配合阅读：
> - `docs/architecture/pipeline-artifacts-and-contracts.md`
> - `docs/architecture/AGENTS-ARCH.md`
> - `docs/architecture/planning-schema-and-prompt.md`
> - `docs/quality/PIPELINE-E2E-ACCEPTANCE-2025-11-15.md`（端到端验收脚本）
> - `docs/agents/NEXT-ASSISTANT-PROMPT-2025-11-15.md`（下一位 AI 助手推荐使用的系统 Prompt）

---

## 1. 当前整体状态（高层视图）

- **定位**：本地优先的 AI 工具链 CLI，在业务项目内提供“规划 → 强确认 → codegen → 第二视角/审查 → 评测 → 提交/回滚”的审计闭环。  
- **关键改动（相对 2025-11-13/14）**：
  - 规划阶段统一使用新的 `planning.ai.json` schema，不再兼容旧的 `plan.*` 输出结构。
  - 引入了一批 Agents（Planning/PlanReview/Codegen/CodeReview/Test/Meeting），REPL 变成薄 UI，核心逻辑下沉到 `src/agents/*` + `src/core/*`。
  - 新增非交互式的 `ai-tools pipeline agents` 管线，作为最小 Orchestrator demo：按阶段串联各 Agent 并维护 `state.json`。
  - 为 planning/codegen/review/second_opinion/plan_review 等模型角色提供项目级 prompt 文件（`.ai-tools-chain/prompts/*.system.md`）。
- 梳理并落地“协议清单”：各阶段产物、路径与 AI 输入/输出契约统一记录在 `docs/architecture/pipeline-artifacts-and-contracts.md`。

---

## 2. 关键协议与产物（Artifacts & Contracts）

请以 `docs/architecture/pipeline-artifacts-and-contracts.md` 为准，这里只按阶段做简要提醒：

- **Planning（/plan + PlanningAgent）**
  - 输入：用户 brief（一句话需求或附带上一版规划报告） + transcript；  
  - AI 角色：`planning`（DeepSeek 等，内部模拟多角色规划工作坊）；  
  - 输出：
    - `planning.ai.json`（新 schema，含 `schema_version/meta/why/what/requirements/targets/risks/acceptance/draft_files/tasks/notes/test_plan/assumptions/open_questions`）；  
    - `planning.draft.json`（草案）；
    - `plan.files.json`（仅来自 `planning.draft_files`）；
    - `plan.md` + OpenSpec 相关产物；
    - `planning.transcript.jsonl`。

- **Plan Review（/planreview + PlanReviewAgent）**
  - 输入：`planning.ai.json + plan.md + logs/openspec/validate.json`。  
  - AI 角色：
    - 规则 + openspec 检查（无模型）；  
    - 可选 `plan_review` 模型：对规划作语义审查。
  - 输出：
    - `plan-review.json`：`{ ok, reasons, issues[], summary, openspec, ai_review? }`；  
    - `plan-review.md`：面向人类的规划审查摘要。

- **Planning Meeting（自动触发 + PlanningMeetingAgent）**
  - 输入：`planning.ai.json + plan-review.json + plan.md`。  
  - 输出：
    - `planning.meeting.json`；
    - `planning.meeting.md`：总结规划要点、PlanReview issues 与“下一步建议”（是否适合进入 codegen）。

- **Codegen（/codegen + CodegenAgent + runCodegenCore）**
  - 输入：`plan.md + plan.files.json.files[]`。  
  - AI 角色：`codegen`。  
  - 两阶段：
    - Phase 1：模型生成 `codegen.plan.json`（文件级 IR）；
    - Phase 2：本地执行 plan，写业务文件、`patch.json`、`files/*.full`、`codegen.ir.json`。

- **Review & Meeting（/review + CodeReviewAgent + ReviewMeetingAgent）**
  - 输入：git diff、`patch.json`、`files/*.full`、`plan.md`。  
  - AI 角色：`second_opinion` + `review`。  
  - 输出：
    - `second_opinion.md`（第二视角）；
    - `review.json`（代码审查结构化结果）；  
    - `review.meeting.json / review.meeting.md`（代码审查会议纪要）。

- **Test & Eval（/eval + TestAgent）**
  - 输入：项目根 + `.ai-tools-chain/config/eval.conf`。  
  - 输出：
    - 对每步评测写 `eval-<step>.log`；
    - 汇总到 `eval-report.json`。

- **Task 状态（state.json）**
  - 位于 `tasks/<taskId>/state.json`。  
  - 由各 Agent 的 `statePatch` 维护，包含：
    - `phase`：当前推荐阶段（例如 `planning / plan_review / codegen / code_review / code_review_meeting / test_run`）。  
    - `actors.*.status/round`：各 Agent 的状态与轮次。  
  - 是 Orchestrator 决策的核心状态源。

---

## 3. 已实现的主要模块（2025-11-15 版本）

### 3.1 Agents（`src/agents/*`）

- `PlanningAgent`  
  - 规划工作坊入口：读取 transcript + brief + history 调 `planning` 模型，在内部组织多角色（产品/系统/测试/风险等）协作，生成包含 scope/non_goals/test_plan/assumptions/open_questions 的 `planning.ai.json`，并写 `plan.files.json`、OpenSpec 文件。  
  - 在 REPL `/plan` 中使用，默认由各角色先基于常识和上下文自行补齐信息，仅在关键 blocking 情况下通过教练发起与用户的澄清小会。

- `PlanReviewAgent`  
  - 结构/openspec 检查：生成 `plan-review.json/.md`，统计 requirements/draft_files/acceptance 等字段并打 issues。  
  - 尝试调用 `plan_review` 模型，将 AI 规划审查结果附加到 `plan-review.json.ai_review`（失败不阻断）。

- `PlanningMeetingAgent`（新）  
  - 读取 `planning.ai.json + plan-review.json + plan.md`，以敏捷教练/主持人身份组织规划会议：聚合多角色 verdict、形成会议简报与决策（go/hold/redo_planning），在需要时触发与用户的澄清对话；  
  - 生成 `planning.meeting.json/.md`，为最终对用户的规划报告与后续阶段提供依据。

- `CodegenAgent`  
  - 包装 `runCodegenCore`：负责 Git 护栏 + 调用 `codegen` + 写 `codegen.plan.json / codegen.ir.json / patch.json / files/*.full`，并更新 `meta.status` 与 `state.json`。

- `CodeReviewAgent`  
  - 包装 `runReviewCore`：合成 diffText，调用 second_opinion + review 模型，写 `second_opinion.md / review.json`，并输出摘要日志。

- `ReviewMeetingAgent`  
  - 基于 `review.json + second_opinion.md` 生成 `review.meeting.json/.md`，给出代码审查会议纪要。

- `TestAgent`  
  - 包装 `runEvalCore`：按 `eval.conf` 执行评测步骤并写 `eval-report.json`，在 REPL 中输出评测计划与结果摘要。

### 3.2 Orchestrator demo（`src/cli/pipeline.mjs`）

- 命令：`ai-tools pipeline agents`  
  - 创建新 task；  
  - 写一个固定 brief 到 `planning.transcript.jsonl`；  
  - 顺序调用：
    1. `PlanningAgent`（planning）
    2. `PlanReviewAgent`（plan_review）
    3. `CodegenAgent`（codegen）
    4. `CodeReviewAgent`（code_review）
    5. `ReviewMeetingAgent`（code_review_meeting）
    6. `TestAgent`（test）
  - 每步：
    - 打印 Agent logs；
    - 用 `applyStatePatch` 写入 `state.json`；
    - 记录 `{ name, status, error }` 到 `pipeline-result.json.stages[]`。

### 3.3 REPL（`src/cli/repl.mjs`）现状

- 支持命令：
  - `/plan`：规划 + 自动 PlanReview + 自动 PlanningMeeting；  
  - `/planreview`：手动触发 PlanReviewAgent；  
  - `/codegen`：强确认 + 调 CodegenAgent；  
  - `/review`：调用 CodeReviewAgent + ReviewMeetingAgent；  
  - `/eval`：调用 TestAgent；  
  - `/accept`：沿用原有 Gate 逻辑（基于 `eval-report.json`）；  
  - `/revert`：回滚本次 codegen 变更（基于 `patch.json + git snapshot`）；  
  - `/status`：打印 `state.json`。  

---

## 4. 待办事项与优先级（简版 Backlog）

> 本节只列出与当前重构线紧密相关的 TODO，其他如插件系统/Promptfoo 深度接入等可参考历史文档。

### P0（下一位接手者优先处理）

1. **Orchestrator 接口稳定化**
   - 在 `src/core/state.mjs` 和 `src/cli/pipeline.mjs` 基础上，提炼出一个明确的 Orchestrator 接口：
     - `next(taskState) -> AgentName`：根据 `phase` 决定下一步推荐 Agent；
     - `redo(taskState, phase)`：回退到指定阶段并 bump `actors[phase].round`。
   - 将这套逻辑从 `pipeline agents` demo 提炼为可重用模块，为 REPL 的 `/next`、未来的图式编排打基础。

2. **规划层 AI PlanReview 的行为打磨**
   - 当前 `plan_review` 模型的输出已写入 `plan-review.json.ai_review`，但 prompt 与字段仍较粗糙。  
   - 需要：
     - 在 `plan_review.system.md` 中更清晰地定义输出 schema；
     - 在 `PlanReviewAgent` 中使用这些字段（例如决定 gate 建议、在 `planning.meeting.md` 中展示 AI 观点）。

3. **Planning prompt 的稳定性验证**
   - 确认在典型需求（脚本、后端 API、小型重构）下，`planning.ai.json` 始终符合新 schema：  
     - 有 `schema_version=1`；  
     - `meta/title/why/what/requirements/draft_files/acceptance` 不缺关键字段。  
   - 如模型仍有倾向输出旧结构，需进一步收紧 prompt 或在项目级 prompt 中增加 few-shot 示例。

### P1（中期应完成）

4. **PlanningMeetingAgent 升级为 AI 会议主持（planning_meeting 模型角色）**
   - 当前版本是纯规则+拼接的纪要。  
   - 后续可增加 `planning_meeting` 模型角色：
     - 输入：`planning.ai.json + plan-review.json + plan-review.json.ai_review`；  
     - 输出：更自然且结构化的会议纪要与下一步行动建议。

5. **REPL 与 Orchestrator 更紧密结合**
   - 在 REPL 中增加：
     - `/next`：调用 Orchestrator 的 `next`，自动执行下一阶段 Agent。  
     - `/redo <phase>`：回退阶段（实现前须定义清晰的回退策略和快照行为）。

6. **扩展规划 schema 的部分字段**
   - 优先考虑：
     - `scope / non_goals`：明确边界；
     - `test_plan`：为 TestAgent 提供更丰富的测试设计信息；
     - `file_impacts`：按文件描述用途与影响。
   - 这些字段应先在 `planning-schema-and-prompt.md` 定义，然后在 planning prompt 中尝试产出，最后在相关 Agent 中使用（PlanReview/PlanningMeeting/CodeReview/Test）。

### P2（后续增强/探索方向）

7. **多语言护栏策略**
   - 将当前针对 `.java` 的 XML 内容检查抽象为：
     - 按 `language` 定义一组基本 heuristics（Java/Python/TS/YAML 等）；  
     - 在 codegen 执行层应用这些 heuristic，防止明显错误的内容落盘。

8. **TestPlanner 与评测编排**
   - 在 planning 中引入 `test_plan` 字段；  
   - 设计 `TestPlanner` 角色或扩展 TestAgent，使评测步骤部分由 `test_plan` 驱动，而不仅是静态 `eval.conf`。

9. **更细粒度的 CodeReview 专家**
   - 在现有 review 角色基础上：  
     - 引入语言专用 review 角色（例如 Java 专家 / 前端专家）；  
     - 安排它们在 CodeReviewMeeting 中发言，由 MeetingAgent 汇总。

---

## 5. 对下一位助手的建议

- 在动代码前，请先通读：
  - `docs/architecture/pipeline-artifacts-and-contracts.md`（协议总览）；  
  - `docs/architecture/AGENTS-ARCH.md`（Agents/Orchestrator/专家席说明）；  
  - 当前这份 `docs/agents/HANDOVER-2025-11-15.md`。
- 任何新增阶段或角色，请同步更新：
  - 对应的 prompt 模板（`.ai-tools-chain/prompts/*.system.md`）；  
  - `models.conf` 中的 role 配置（profile.*.role.n）；  
  - 协议文档中的产物说明（pipeline-artifacts-and-contracts）。
- 尽量避免再引入“临时兼容旧协议”的逻辑，如果必须兼容旧数据，优先通过一次性迁移脚本或显式升级步骤，而不是在主路径里做隐式转换。

---

## 6. 推荐给“下一位 AI 助手”的 Prompt（草案）

> 可作为系统 prompt 或首条说明，帮助新接手的 AI 助手快速对齐上下文。

你正在接手一个名为“AI Tools Chain”的本地优先 CLI 项目，目标是在业务项目中提供“规划 → 强确认 → 代码生成 → 审查/第二视角 → 评测 → 提交/回滚”的可审计闭环。  

当前仓库已经完成了以下重构：
- 规划阶段统一使用新的 `planning.ai.json` schema，由 `planning` 角色输出，`PlanningAgent` 负责多轮澄清与 OpenSpec 集成；  
- PlanReview/PlanningMeeting/Codegen/CodeReview/ReviewMeeting/Test 等阶段已 Agent 化，REPL 只负责交互与日志；  
- `ai-tools pipeline agents` 提供了一个非交互的 Orchestrator demo，通过 `state.json` 串联各 Agent；  
- 各阶段的产物与 AI 输入/输出协议整理在：  
  - `docs/architecture/pipeline-artifacts-and-contracts.md`  
  - `docs/architecture/AGENTS-ARCH.md`  
  - `docs/architecture/planning-schema-and-prompt.md`。

你的工作原则：
- **绝不重新引入旧的 planning 协议**（例如 `plan.*`），所有规划输出必须符合新 schema；  
- 在修改或扩展阶段行为时，务必保持 `state.json`、各阶段产物与上述文档中的契约一致；  
- 在引入新的 Agent/模型角色时：
  - 为其设计对应的 `.ai-tools-chain/prompts/<role>.system.md`；  
  - 在 `models.conf` 中声明对应的 profile/role 配置；  
  - 在 `AGENTS-ARCH.md` 和 `pipeline-artifacts-and-contracts.md` 中补充角色说明与产物。

当前优先级（建议你从这里开始）：
1. 完善 Orchestrator：基于 `state.json` 抽象出 `next / redo` 接口，并在 REPL 中提供 `/status` / `/next` / `/redo` 等命令；  
2. 提升规划阶段的智能审查能力：完善 `plan_review` 模型角色和 PlanReviewAgent/PlanningMeetingAgent 的行为；  
3. 在确保协议稳定的前提下，再考虑扩展新的专家角色（ProductPlanner / RiskPlanner / TestPlanner 等），并将其输出作为新的 schema 字段（例如 `scope/non_goals/test_plan/file_impacts`）落到 `planning.ai.json`。

你的首要任务，是尊重并巩固现有协议与结构，而不是推翻它们。请把这三个文件视作你行动的“法律文本”：  
`docs/architecture/pipeline-artifacts-and-contracts.md`、`docs/architecture/AGENTS-ARCH.md`、`docs/architecture/planning-schema-and-prompt.md`。

---

## 4. 待办 / 已办 / 变更索引在哪里看？

为了避免 TODO 和设计散落在多处，后续约定按下面几类文档维护：

- **总入口：文档索引**  
  - `docs/README.md`  
    - 文档分类总览（overview/milestones/architecture/agents/quality/...），适合作为接手时的第一站。

- **里程碑 & Backlog（按阶段归档“已办 / 待办”）**  
  - `docs/milestones/ai-tools-chain-milestones-DoD-MVP.md`  
    - M0–M10：MVP 期的里程碑与 DoD；  
    - M11：Agents + Orchestrator + 协议统一的目标与完成定义。  
  - `docs/milestones/ROADMAP-BACKLOG-2025-11-16.md`  
    - 当前统一的 Roadmap & Backlog 索引；  
    - 把 M11/M12/M13 各阶段的**尚未完成能力**、对应 TODO 编号和详细设计文档都挂在这里。

- **中期 Agents 能力 TODO（设计草案为主）**  
  - `docs/agents/AGENTS-TODO-MIDTERM-2025-11-15.md`  
    - TODO 1–7：Accept/Revert Agent 化、Orchestrator 策略、Meeting/多专家席、TestPlanner、规划扩展字段、多版本 & 多 Agent 等；  
    - 每条都有“现状检查 / 目标 / 设计草案 / 验收建议”，实现前后都应与本文件和 Roadmap 保持同步。

- **规划演进（多版本 + 多 Agent）**  
  - `docs/architecture/planning-evolution-multi-agent-2025-11-16.md`  
    - 对应 M12 的专门设计说明：文件结构演进（versions/）、状态机字段扩展、多子角色 orchestrator 等；  
    - 若后续继续演进 /plan 行为，请优先更新此文档，再更新 AGENTS-TODO 与 Roadmap。

- **质量与验收脚本**  
  - `docs/quality/PIPELINE-E2E-ACCEPTANCE-2025-11-15.md`  
    - 端到端验收 checklist：从 `/plan` 到 `/revert`；  
    - 每轮较大改造（例如完成某个 M11-x TODO）后，最好按此脚本在 playground 项目跑一遍。  
  - （可选）后续若新增更细粒度的验收脚本，请统一放在 `docs/quality/` 与 `docs/acceptance/` 下，并在 Roadmap 文档中挂上链接。

接手者如果想快速了解“哪些已经做完、哪些还在路上、具体设计在哪”，推荐顺序是：
1. 看 `docs/milestones/ROADMAP-BACKLOG-2025-11-16.md`，找到当前关注的里程碑（例如 M11/M12）和对应子条目；  
2. 顺着该条目的“关联文档”链接跳转到更细的设计（AGENTS-TODO / planning-evolution / AGENTS-ARCH 等）；  
3. 若需要确认行为是否对齐预期，再对照 `PIPELINE-E2E-ACCEPTANCE` 或相关验收脚本跑一遍 playground。
