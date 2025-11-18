# AI Tools Chain — Roadmap & Backlog 总览（2025-11-16）

> 目的：把分散在各文档里的里程碑、Agents 中期 TODO、规划演进设想统一挂到一个入口，便于接手者快速知道“现在在哪、还缺什么、下一步做什么”。  
> 详细设计仍以各子文档为准，本文件只做索引和粗粒度状态跟踪。

---

## 1. 里程碑索引（高层）

详细里程碑、DoD 与 MVP 说明见：

- `docs/milestones/ai-tools-chain-milestones-DoD-MVP.md`

当前重要里程碑标签：

- **M0–M10：MVP 期**  
  - 完成 CLI/REPL、配置、Git 护栏、codegen/review/eval 基本链路。
- **M11：Agents + Orchestrator + 统一协议（当前进行中）**  
  - 把 `/plan /codegen /review /eval /accept /revert` 迁移到 Agents 层；  
  - 引入 `state.json` + Orchestrator；  
  - 统一 planning / codegen / review 等阶段的产物与 AI 契约。
- **M12：规划多版本 + 多 Agent（设计中，尚未落地）**  
  - 在一个 Task 内支持多版规划、规划回退；  
  - 规划阶段内部由多个子角色协作完成（Product/Risk/Test Planner 等）。  
- **M13+：显式状态机 / 图 / 可视化（远期方向）**  
  - 用显式状态机或有向图描述 pipeline 与 Agents 流转；  
  - 结合可视化或更强的 orchestrator 策略。

---

## 2. 当前进行中的里程碑：M11 Backlog

> 设计详情参考：  
> - `docs/architecture/AGENTS-ARCH.md`  
> - `docs/architecture/pipeline-artifacts-and-contracts.md`  
> - `docs/architecture/planning-schema-and-prompt.md`  
> - `docs/agents/AGENTS-TODO-MIDTERM-2025-11-15.md`
>
> 当前优先推进项（2025-11-16）：**M11-3｜让规划扩展字段在 Review/Test 阶段真正发挥作用**。

本节只列 **M11 已有设计中，尚未完全落地或仍有明显优化空间** 的部分。

### M11-1｜AcceptAgent / RevertAgent Agent 化（TODO 1）

- **当前状态**  
  - `/accept` 与 `/revert` 命令仍以核心函数为主（`runAcceptCore` + 直接 git 操作），在 `state.json.actors` 中的建模不够完整。  
  - 部分 Gate 逻辑与用户交互存在于 REPL 内部，而不是 Agent 层。
- **目标**  
  - `AcceptAgent`：基于 `eval-report.json` 做评测 Gate，给出“是否可提交 / 是否允许 override”建议，并在需要时触发真正的 Git 提交；  
  - `RevertAgent`：封装当前回滚逻辑（基于 `patch.json` + git），更新 `meta.status` 与 `state.json`，并为 `/redo planning` 或 `/redo codegen` 做好衔接。  
- **关联文档**  
  - `docs/agents/AGENTS-TODO-MIDTERM-2025-11-15.md`｜TODO 1。

### M11-2｜Orchestrator 策略与 REPL 集成（TODO 2）

- **当前状态**  
  - 已有最小 Orchestrator 与 `ai-tools pipeline agents`、REPL `/next` `/redo` 命令；  
  - 阶段推荐和回退策略还比较朴素，部分逻辑依赖人工记忆。
- **目标**  
  - 形成清晰的：`next(taskState) -> { phase, agentName, reason }` 与 `redo(taskState, phase)` 接口；  
  - 在 REPL 中，基于 `state.json` 与 `plan-review.json` / `eval-report.json` 给出更智能的下一步建议；  
  - 将「一轮完整流水线」与「用户按需局部调用某阶段」统一到一套 orchestrator 策略下。  
- **关联文档**  
  - `docs/architecture/AGENTS-ARCH.md`  
  - `docs/agents/AGENTS-TODO-MIDTERM-2025-11-15.md`｜TODO 2。

### M11-3｜规划扩展字段在 Review/Test 阶段的使用（TODO 5）

- **当前状态**  
  - `planning.ai.json` 已包含 `scope/non_goals/file_impacts/test_plan/open_questions/notes` 等扩展字段；  
  - `plan.md`、`plan-review.md`、`planning.meeting.md` 中会展示部分字段摘要；  
  - Review/Test 阶段对这些字段的利用仍偏弱，主要停留在“展示层”和简单 warning（如 `ACCEPTANCE_EMPTY`、`TEST_PLAN_EMPTY`）。
- **目标（Phase 1：落地使用，先不 Gate）**  
  - **Review / ReviewMeeting**：  
    - 对照 `scope/non_goals/file_impacts/open_questions` 标记“是否存在越界改动”“哪些风险没有被代码触达/仍悬而未决”；  
    - 在 `review.meeting.md` 中形成清晰的 checklist 提示。  
  - **TestAgent / eval 阶段**：  
    - 对照 `test_plan.cases` 标记“已覆盖/未覆盖”的用例（基于执行结果与文件路径匹配即可，先不做强 Gate）；  
    - 在 `eval-report.json` 或附加 md 中给出简要摘要。  
- **关联文档**  
  - `docs/architecture/planning-schema-and-prompt.md`  
  - `docs/quality/planning-quality-and-optimization.md`  
  - `docs/agents/AGENTS-TODO-MIDTERM-2025-11-15.md`｜TODO 5。

### M11-4｜TestPlanner 与 test_plan 驱动评测（TODO 4）

- **当前状态**  
  - `planning.system.md` 已强化了 `test_plan` 的要求，`PlanningAgent` 会尝试让模型填充该字段；  
  - PlanReviewAgent 在 `test_plan` 为空时会给出 `TEST_PLAN_EMPTY` warning；  
  - `TestAgent` / `runEvalCore` 仍以 `eval.conf` 为主，尚未真正“由 test_plan 驱动”评测决策。
- **目标**  
  - **阶段 1（M11 可完成部分）**  
    - 在 `TestAgent` 中读取 `planning.ai.json.test_plan`：  
      - 在执行评测前打印策略/关键用例；  
      - 在评测结果中标记哪些步骤/命令大致覆盖了哪些 `test_plan.cases`。  
  - **阶段 2（可视为 M12 早期）**  
    - 视情况引入独立 `TestPlannerAgent`，或在 Planning 内部 orchestrator 中增加 `test_planner` 子角色；  
    - 在 eval 阶段根据 `test_plan` 选择性启用/跳过部分 eval 步骤。  
- **关联文档**  
  - `docs/agents/AGENTS-TODO-MIDTERM-2025-11-15.md`｜TODO 4  
  - `docs/architecture/planning-evolution-multi-agent-2025-11-16.md`

### M11-5｜Codegen 强协议 + 两阶段 IR 落地（TODO 8 草案）

- **当前状态**  
  - 已有两阶段雏形：`invokeRole("codegen")` 生成 `codegen.plan.json`（files IR），`runCodegenCore` 基于 IR 落盘并生成 `codegen.ir.json/patch.json`；  
  - 但对模型输出的协议约束较弱：  
    - 未统一剥离 ``` fenced block；  
    - 如模型返回外层 JSON（含 files[] + content），可能被整体写入目标文件（见当前 RainWaterTrapping 示例）；  
    - `.java` 等关键语言文件仅检测“是否为 XML”，对 JSON/混合内容缺乏护栏。
- **目标（视为 M11 的 Hard Contract 优先级）**  
  - **强协议层**：  
    - 规范 `codegen.plan.json` schema：`files[]` 中每项必须为 `{ path, language?, intent?, content }`；  
    - 对模型原始输出做“只接受这一种结构”的校验：  
      - 剥离外层 ``` 包裹；  
      - 如检测到“外层 JSON + 内部 files[]”，统一解析后生成标准 IR；  
      - 解析失败或内容残留混杂文本时，立即中止 codegen，并在 REPL 明确报“协议错误”。  
  - **IR → 落盘层**：  
    - 在写入 `.java/.ts/.py/...` 前做轻量语言 sanity check（例如禁止整段 JSON / fenced block）；  
    - 将规范化后的内容与 IR 一并写入 `codegen.ir.json`，作为后续 Agent/Review 的唯一权威来源。  
  - 后续 M12 可在此基础上进一步演进为“IR 驱动的局部 patch/模板”，但 M11 的目标是先把“强协议 + 两阶段 IR”打牢，避免垃圾内容落盘。
- **关联文档**  
  - `docs/agents/AGENTS-TODO-MIDTERM-2025-11-15.md`｜TODO 8（待补充）  
  - `docs/architecture/pipeline-artifacts-and-contracts.md`

### M11-6｜Meeting / 多专家席的细化（TODO 3 & 6 的延续）

- **当前状态**  
  - 已有 `PlanningMeetingAgent` / `ReviewMeetingAgent` 生成会议纪要 md；  
  - 多专家席（例如不同角色的 reviewer / architect / QA）的设定还主要存在于 prompt 与文档中。
- **目标**  
  - 在不暴露过多内部细节给 REPL 用户的前提下：  
    - 为规划/代码评审阶段引入更清晰的“会议主持（Meeting Chair）”与“专家席（多个角色，如产品/风险/测试/架构等）”分工；  
    - 将多角色的讨论结果聚合为统一的结构化输出（例如 `*.meeting.json`），md 只是人类视图。  
- **关联文档**  
  - `docs/architecture/AGENTS-ARCH.md`  
  - `docs/agents/AGENTS-TODO-MIDTERM-2025-11-15.md`｜TODO 3、TODO 6  
  - `docs/architecture/planning-evolution-multi-agent-2025-11-16.md`（规划多 Agent 的远期设想）。

### M11-7｜文档与产物目录的持续整理

- **当前状态**  
  - docs 目录已按 overview/milestones/architecture/agents/quality/acceptance/worklog 分类；  
  - 规划阶段产物已收拢到 `tasks/<id>/planning/` 子目录；  
  - OpenSpec `proposal.md` 保留为“指路牌”，说明不再作为主规划依据。  
- **后续优化方向**  
  - 对于每个阶段（plan/codegen/review/eval/accept/revert），在 `pipeline-artifacts-and-contracts.md` 中持续维护：  
    - 产物列表；  
    - 实际使用到的字段；  
    - 已废弃/暂未使用字段与说明；  
  - 确保新增/调整 Agent 能力时，文档与实现同步演进。

---

## 3. 下一阶段：M12 规划多版本 + 多 Agent

> 详细设计见：  
> - `docs/architecture/planning-evolution-multi-agent-2025-11-16.md`  
> - `docs/agents/AGENTS-TODO-MIDTERM-2025-11-15.md`｜TODO 7

### M12-1｜规划多版本与回退

- 为每个 Task 引入规划版本号与历史：  
  - `tasks/<id>/planning/versions/v1/v2/...` 或等价结构；  
  - `state.json.actors.planning.round` 与“当前生效版本”之间建立明确关系。  
- `/redo planning` 时：  
  - 自动 snapshot 当前规划为新版本；  
  - 支持用户在不同规划版本之间对比与选择。

### M12-2｜规划阶段多 Agent 协作

- 在一个 `/plan` 流程内，由多个子角色协作完成规划，而 REPL 仍只暴露一个命令：  
  - Product Planner：聚焦需求、scope/non_goals；  
  - Risk Planner：补充风险与应对；  
  - Test Planner：负责 test_plan；  
  - File Impact Planner：负责 draft_files / file_impacts。  
- 对外仍然以 `PlanningAgent` 作为单入口，内部通过 orchestrator 串联多个 `invokeRole()` 调用，最终只产出一份 `planning.ai.json`。

---

## 4. 更远期：M13+ 状态机 / 图 / 可视化

> 目前仅为方向设想，尚未形成正式设计文档。

- 为 Task 生命周期与 Agents 流转引入显式图/状态机层：  
  - 用 DSL 或 JSON schema 描述阶段（nodes）与跳转（edges）；  
  - Orchestrator 从“硬编码的 if/else”演进为“解释图”的执行器。  
- 后续可探索：  
  - 与 LangGraph 等图式 orchestrator 的理念对齐；  
  - 提供 CLI 或简单可视化，帮助用户理解一个 Task 当前所在位置和可选下一步。

---

## 5. 使用建议

- **新增大粒度能力或阶段** 时：  
  - 先在本文件中为其新增一个条目（Mxx-N），标明“目标 / 粗略设计 / 关联文档”；  
  - 再在对应的 architecture/agents/quality 文档中写细节与验收标准。  
- **接手开发** 时：  
  - 先从本文件确认当前主要精力所在的里程碑与 Backlog；  
  - 再按链接跳转到对应的设计与验收文档，避免遗漏历史设想或重复造轮子。
