# Planning 多版本 & 多 Agent 演进设计（M12 草案，2025-11-18）

| 属性 | 值 |
|------|-----|
| **最后更新** | 2025-11-18 |
| **版本** | v1.0 |
| **状态** | ✅ Current |

---

## 📝 更新历史

- **2025-11-18**: 同步最后更新日期并修正引用路径
- **2025-11-16**: 初稿完成

---

> 说明：本文件是规划阶段多版本与多 Agent 的演进草案。  
> 如本文件与 [10-planning-workshop-design.md](./10-planning-workshop-design.md) 对规划工作坊行为/角色/澄清策略的描述不一致，以后者为准。  
> 目标：让同一个 Task 可以多次进入规划阶段，每次规划阶段内部由多个 AI 专家协作产出新的规划版本，同时保持“阶段清晰、产物有条理、可审计”。
> 说明：本设计建立在 M11（Agents + Orchestrator + 协议统一）之上，作为后续 M12 的演进方向。

---

## 1. 背景与现状（M11 状态）

- 规划阶段的当前行为：
  - `/plan`：`PlanningAgent` 多轮澄清 → 调 `planning` 模型 → 写入：
    - `tasks/<id>/planning/planning.ai.json`（当前定稿）  
    - `tasks/<id>/planning/plan.files.json`  
    - OpenSpec：`openspec/changes/task-<id>/{change.md,specs...,tasks.md,proposal.md}`  
    - 人类可读摘要：`tasks/<id>/planning/plan.md`  
    - 结构/openspec 审查：`planning/plan-review.json/.md`  
    - 规划会议纪要：`planning/planning.meeting.json/.md`
  - `planning.draft.json`：目前只在 ready 时写一次，语义接近“定稿拷贝”，未真正承担“多轮草稿”的角色。
- 下游阶段（codegen/review/eval/accept）只读取：
  - `planning.ai.json` / `plan.files.json` / `planning/plan.md` / OpenSpec 产物；
  - 不再依赖 `planning.draft.json`。
- Orchestrator 支持：
  - `/redo planning` 只改 `state.json.phase`，不维护规划版本历史。

痛点与机会：
- 用户希望在同一 Task 内“反复开规划会”（多次 `/plan`），形成 v1/v2/v3…；
- 希望规划阶段内部不是单一角色，而是一组专家（产品/风险/测试/设计）协作；
- 现有文件结构和状态模型没有显式支撑“多版本规划”和“多 Agent 协作”。

---

## 2. 目标概述

1. **多次规划 / 多版本**  
   - 同一 Task 可以多次进入规划阶段（通过 `/redo planning` 或用户主动选择）；  
   - 每次规划得到一个新的版本（v1/v2/...），历史版本可回溯。

2. **规划阶段内部多 Agent 协作**  
   - 外部仍然只有一个 `/plan` + `PlanningAgent.step`；  
   - 内部由多个子角色/子 Agent 协作（ProductPlanner/RiskPlanner/TestPlanner/DesignAdvisor/...），由一个“PlanningOrchestrator”统筹。

3. **产物有条理、可审计**  
   - 当前版本与历史版本在文件系统中有明确分层；  
   - `planning.ai.json` / `planning/plan.md` 始终代表“当前版本”；  
   - `versions/` 保留历史版本及其审查/会议纪要，兼顾空间与审计需求。

---

## 3. 文件结构演进设计

以 `tasks/<id>/planning/` 目录为例：

```text
tasks/<id>/
  planning/
    planning.ai.json           # 当前版本（vN）定稿
    plan.md                    # 当前版本（vN）可读摘要
    plan.files.json            # 当前版本目标文件列表
    plan-review.json           # 当前版本审查结果
    plan-review.md
    planning.meeting.json
    planning.meeting.md
    planning.transcript.jsonl  # 最近一轮规划对话

    versions/
      v1/
        planning.ai.json
        plan.md
        plan-review.json
        planning.meeting.json
      v2/
        ...
```

说明：
- `planning.ai.json` / `plan.md` / `plan.files.json` / `plan-review.*` / `planning.meeting.*` 始终代表 **当前版本 vN**；  
- 每次进入新的规划版本前（例如 `/redo planning` 或 `/plan` 完成后再进入下一轮），将当前版本快照复制到 `versions/vN/`；  
- `planning.draft.json` 的未来去向：
  - 方案 A：删掉，完全由 `planning.ai.json` + `versions` 承担历史与定稿；
  - 方案 B：保留为“当前版本的工作草稿”，每次多 Agent 内部更新该文件，再在 ready 时提升为 `planning.ai.json`。

---

## 4. 多版本生命周期与状态模型

### 4.1 状态字段扩展

在 `state.json` 中：

```json
{
  "phase": "planning | plan_review | ...",
  "actors": {
    "planning": {
      "status": "idle | in_progress | completed | redo",
      "round": 2,        // 当前规划版本号 v2
      "last_version": 1  // 上一个版本号（如存在）
    },
    ...
  },
  "artifacts": {
    "planning_ai": "tasks/<id>/planning/planning.ai.json",
    "planning_versions": "tasks/<id>/planning/versions/"
  }
}
```

### 4.2 版本流程（示意）

1. 初始 `/plan`：  
   - `round = 1`；  
   - 生成 `planning.ai.json` + `plan.md` + `plan-review` + `planning.meeting`；  
   - `actors.planning.status = "completed"`。

2. 用户发现规划不满意 → `/redo planning`：  
   - 将当前版本快照复制到 `versions/v1/`；  
   - `actors.planning.last_version = 1`，`round` 增加为 `2`，`status = "redo"`；  
   - `phase` 回到 `planning`。

3. 第二轮 `/plan`：  
   - 基于 `versions/v1/planning.ai.json` + transcript 等信息生成新版本；  
   - 生成 v2 的 `planning.ai.json/plan.md/plan-review/planning.meeting`；  
   - `actors.planning.round = 2`，`status = "completed"`。

下游（codegen/review/eval/accept）始终只看“当前版本”路径，无需关心版本号。

---

## 5. 规划阶段内部多 Agent 协作（单入口，多专家）

### 5.1 角色分层

- 对外 Agent（REPL 调用）：  
  - `PlanningAgent`：对外仍然是 `step({ cwd, aiDir, tasksDir, taskId, metaPath })`，负责整个规划阶段。

- 内部子角色（模型级或子 Agent）：  
  - `planning`：主规划生成；  
  - `product_planner`：补充/纠正 scope/non_goals；  
  - `risk_planner`：补充/纠正 risks；  
  - `test_planner`：生成/修正 `test_plan`；  
  - `file_impact_planner`：生成 `file_impacts` 等。

### 5.2 内部 orchestrator（PlanningAgent 内部）

PlanningAgent 内部可以演进为一个简单的“规划 orchestrator”：

1. 初始化：  
   - 读取当前版本（或上一版）的 `planning.ai.json`，作为初始草案；  
   - 收集 transcript/history。

2. 多子角色协作：  
   - 调用 `invokeRole("planning", payload)` 产生基础规划；  
   - 按顺序调用 `product_planner/risk_planner/test_planner/...`，每个子角色只修改自己负责的字段；  
   - 每次子角色输出后，合并回同一个草案对象。

3. 定稿：
   - 最终草案写入 `planning.ai.json`；  
   - 调用 `applyPlanningAndOpenSpec` → OpenSpec → plan.md；  
   - 调用 PlanReviewAgent 和 PlanningMeetingAgent。

外部看起来仍然只是 `/plan` 跑了一次，但内部已经是“多角色协作 + orchestrator 合成”的过程。

---

## 6. 与业界/主流方案的关系

- 当前主流工程实践：
  - 大多是“单 Agent + 工具链 + 显式工作流”：类似 LangGraph / workflow engine，节点是单次模型调用或工具调用；  
  - 多数场景下不会让 Agent 自组织，而是让一个 orchestrator（通常是显式的图/状态机）驱动流程。
- 我们的演进方案：
  - 更接近“结构化工作流 + 多角色协作”：  
    - 阶段（/plan 等）由 Orchestrator 控制；  
    - 阶段内部由单入口 Agent（PlanningAgent）组织多角色协作；  
    - 所有中间产物落到本地文件（planning.ai.json/versions/...），作为黑板+审计线。  
  - 不打算演变成完全自组织的 Agent 群，而是“人定义阶段和协议，AI 在阶段内做事和开会”。

因此，这个演进与我们已有的 Agents + Orchestrator 架构是完全兼容的，只是把规划阶段做得更深、更贴近用户对“多次开规划会”的实际需求。

---

## 7. TODO 分解（优先级建议）

### TODO 7.1：多版本规划（M12-P0）

- 在 `tasks/<id>/planning/` 下引入 `versions/` 目录：  
  - 每次 `/redo planning` 时，将当前 `planning.ai.json/plan.md/plan-review.json/planning.meeting.json` 复制到 `versions/v<round>/`；  
  - 调整 `state.json.actors.planning.round/last_version` 语义。
- 文档更新：  
  - 在 `AGENTS-ARCH.md` 与 `pipeline-artifacts-and-contracts.md` 中补充版本存储结构与状态字段说明。  
- REPL：  
  - `/redo planning` 输出当前版本号与上一个版本路径提示。

### TODO 7.2：PlanningAgent 内部 orchestrator（M12-P1）

- 扩展 `PlanningAgent`：  
  - 将当前的“单次 planning 调用”重构为：  
    - 基础 `planning` 调用 → 草案；  
    - 可选调用 `test_planner`（先从 prompt 多 persona 过渡到独立角色）；  
  - 把草案管理统一收敛到一个内部函数，便于未来挂更多子角色。
- 在 `AGENTS-ARCH.md` 中记录内部 orchestrator 的大致调用链。

### TODO 7.3：多角色规划专家（M12-P2）

- 逐步引入独立的规划专家角色（可从 `test_planner`、`risk_planner` 开始）：  
  - 为每个角色定义 `*.system.md` prompt；  
  - 在 `models.conf` 中声明对应 role；  
  - 在 `PlanningAgent` 中按顺序调用，合并输出。  
- 在 `AGENTS-TODO-MIDTERM` 中记录每个角色的职责与当前实现状态。

---

## 8. 后续如何接手这个演进

- 若有人接手 M12：  
  - 请先阅读：  
    - `docs/architecture/AGENTS-ARCH.md`  
    - `docs/architecture/planning-schema-and-prompt.md`  
    - 本文档  
  - 然后按本节 TODO 7.1 → 7.2 → 7.3 的顺序推进，每完成一小步即更新文档与验收脚本。

---

## 9. 「规划工作坊」与 planning_meeting 黑盒模式（精化共识）

> 本节是对我们本项目“规划阶段”的长期定位，它超出了 M11 的实现范围，是 M12 及之后的设计指南。

### 9.1 对用户：`/plan` = 和一个“规划工作组”开会

从用户视角出发，我们希望 `/plan` 不再只是“单次调用 planning 模型 + 输出 JSON”，而是：

- `/plan` = 进入一个持续存在的“规划工作坊”（planning workshop）：  
  - 有一桌“愿意做事、有专业能力的人”在帮你想方案：产品、资深开发、架构师、测试、技术经理等；  
  - 你给一句需求，这个小组内部讨论，然后拿出一版草案（规划方案 + 会议纪要）；  
  - 你觉得哪里不对，可以直接和“小组”对话，提出问题/反对/补充条件；  
  - 小组会把你的反馈带回内部再次讨论，给你第二版、第三版……直到大家都觉得可以进入 codegen。

对外只暴露一个统一的接口角色——**敏捷教练/主持人**：

- 入口：教练负责接收你的需求与反馈，用人话解释小组当前的理解；  
- 内部：教练组织各个角色讨论，安排发言顺序、控制节奏、防止过度发散；  
- 出口：教练汇总讨论结果，给出结构化规划（planning.ai.json + plan.md）、会议纪要以及清晰的“下一步建议”。

### 9.2 对内：planning_meeting = 多 Agent 协作模式，而不是单一角色

在实现视角，`planning_meeting` 不再只是“一个生成会议纪要的模型角色”，而是：

- 一种 **多 Agent 协作模式** 的代号：  
  - 模式内包含多个专家角色（ProductPlanner / SystemDesigner / TestPlanner / RiskPlanner / …）；  
  - 同时包含一个“敏捷教练/主持人”角色，负责调度和裁决。  
- 每个专家角色都是一个“小 AI 微服务”：  
  - 有统一的底层能力（RAG、代码库搜索、外部资料查询等）；  
  - 通过 prompt 和协议被限制在自己的专业领域（只对 scope/non_goals/acceptance 或 draft_files/file_impacts 等发言）；  
  - 对某些问题拥有“专业决策权”，而不是所有事情都交给教练拍板。

敏捷教练在盒子里的职责：

- 协调：决定谁先看、谁后看、需要多少轮讨论；  
- 收敛：避免会议无限发散，把讨论拉回当前迭代和用户需求；  
- 聚合：将各个角色的 verdict（OK/Not OK/Concern/Confidence）聚合成一版草案和一个清晰的决策（go/hold/redo_planning）；  
- 对外沟通：把复杂的内部讨论翻译成用户能理解的文字和建议。

### 9.3 单次 `/plan` 内部的“写作循环”

每一次 `/plan` 调用内部，我们希望形成一个统一的写作循环（可以先用单模型多 persona 模拟，后续再拆成多 Agent）：

1. **收集输入**  
   - 当前需求快照：最新 brief + 最近一轮用户对话摘要；  
   - 上一版规划草案：`planning.ai.json`（如有） + `plan.md`；  
   - 历史决策/未决问题：`planning.meeting.md` 里的 round 记录，以及 transcript。

2. **角色分头思考**（隐式，可以在一个 prompt 内用多 persona，后续再拆成独立 Agent）  
   - ProductPlanner：scope / non_goals / acceptance；  
   - SystemDesigner：draft_files / file_impacts / 设计要点；  
   - TestPlanner：test_plan / 可测性；  
   - RiskPlanner：risks / open_questions；  
   - 每个角色在思考时都携带：用户需求、之前所有角色发言的简要记录、上一轮教练给出的会议简报。

3. **教练整合与多轮共识收敛**  
   - 教练在每轮内部讨论后，综合各角色输出，形成一份“会议简报”：当前共识、主要分歧、关键假设（assumptions）、未决问题（open_questions）；  
   - 教练按角色轮询，将该简报传递给每个角色，询问其是否有异议或补充：  
     - 若某角色有异议，则记录该角色的新意见并更新简报，再携带更新后的简报继续询问下一位角色；  
     - 如此往复多轮，直到主要问题上达成共识或识别出必须先澄清的阻塞点；  
   - 在达成当前轮次共识后：  
     - 形成统一的草案对象（planning.ai.json），包含各角色的综合结果以及 assumptions/open_questions；  
     - 生成新的 plan.md（人类可读的规划说明）；  
     - 在 planning.meeting.md 中增加本轮小节：输入 → 关键讨论点 → 草案变化 → 未决问题/关键假设 → 下一步建议。

4. **结构/openspec 审查（作为工具视角）**  
   - 调现有的 `plan_review` 逻辑 + openspec validate；  
   - 将错误和警告写入会议纪要的问题/风险部分；  
   - 对教练的“下一步建议”产生影响（例如强烈建议 redo_planning，而不是进入 codegen）。

> 注意：在这个模型里，`planning / plan_review / planning_meeting` 都是 **规划阶段内部的视角/角色**，  
> 外部阶段机理上只需要一个“规划工作坊”阶段即可，后续 Orchestrator 控制的是“规划阶段 vs 下游阶段”，而不是这三个内部步骤。

### 9.4 三层视角：从单任务工作坊到项目级 PMO

为了避免一上来就做“全局 PMO”，我们将演进拆成三层视角：

1. **层 1：单任务规划工作坊（M12 重点）**  
   - 目标：让 `/plan` 在单 task 维度，真正像一个“和规划小组开会”的体验；  
   - 支持多轮、版本（通过 round/versions）、会议纪要和清晰的封版决策。

2. **层 2：项目内多任务协调（后续，可以视为 M13+）**  
   - 基于所有 `tasks/*/state.json + artifacts`，做 PMO 视角：  
     - 任务之间的依赖/冲突（修改同一模块的多个任务）；  
     - backlog 管理和优先级；  
     - 自动提示“这个新需求其实和 task-X 类似，是否合并/复用？”。

3. **层 3：方法论内化（Scrum/敏捷/迭代）**  
   - 将迭代/Sprint/回顾会议等概念内化到 Orchestrator 和会议 Agent 中：  
     - 定期总结“这几轮自动规划/生成/审查做得好不好”；  
     - 将发现的问题沉淀为风险/技术债/改进项。

当前 M12 的设计重点是**层 1**，同时在状态结构和文档中为层 2/3 的演进预留空间，而不提前实现。

### 9.5 角色决策 heuristics 的设计原则

- 每个专家角色拥有自己的“专业决策权”：  
  - ProductPlanner 决定需求是否收敛、scope/non_goals 是否清晰；  
  - SystemDesigner 决定设计是否可行、draft_files/file_impacts 是否合理；  
  - TestPlanner 决定当前规划能否被有效测试；  
  - RiskPlanner 决定是否存在不能接受的风险或信息黑洞。

- 教练的 heuristics 主要是“调度与裁决规则”，而非专业判断本身：  
  - 聚合各角色的 verdict：`ok / not_ok / confidence / recommended_next_step`；  
  - 决定是继续规划（再一轮 `/plan`）、尝试封版进入 codegen，还是要求用户/角色先解决某个关键问题；  
  - 将这些裁决以及分歧写入 planning.meeting.*，供后续 codegen/review/test 参考。

实现上，前期可以在单个 `planning_meeting` 调用中模拟上述行为（多 persona + 统一 JSON 输出），  
后续再按本文件 TODO 分解成独立的 Agent 与更精细的状态机。

---

## 10. 本轮共识：M12 第一阶段的边界与规范（仅聚焦 /plan）

> 本节是 2025-11-17 的补充结论，明确这一轮 M12 只改“规划阶段内部”，不改全局 Orchestrator。

### 10.1 范围边界：只改 `/plan` 阶段

- 本轮 M12 改造只聚焦 **规划阶段内部** 的行为和体验：  
  - `/plan` 命令；  
  - `PlanningAgent` + `planning_meeting` + `plan_review` 在阶段内部的协作方式；  
  - `planning.meeting.json/.md`、`planning.transcript.jsonl` 以及规划阶段内部的“记忆”存储。
- 不做/暂缓的内容：  
  - 不改全局 `Orchestrator` 的阶段列表和状态机；  
  - 不上线多版本快照目录 `planning/versions/`（仍保留为后续演进方向）；  
  - 不调整 `/next` 的推荐逻辑，只要求其在 M11 现有行为下正常工作。

可以理解为：**这一波只把“规划工作坊”做扎实，依然挂在现有的单次 `/plan` 阶段之下**，多版本/多轮跨阶段的玩法留到后续迭代。

### 10.2 规划工作坊内部的角色设定（persona 最小集）

目标：在一开始就把“规划小组”的角色类型拆清楚，并为每个角色定义独立 persona，强调专业性和边界。

建议的最小角色集：

- `ProductPlanner`（产品经理视角）  
  - 关注：业务目标、用户价值、范围（scope）、非目标（non_goals）、验收口径（acceptance）。  
  - 边界：不深入技术实现细节，不负责测试用例设计。

- `SystemDesigner`（架构师 / 资深开发）  
  - 关注：系统边界、模块拆分、影响面（file_impacts）、draft_files、架构风险。  
  - 边界：不拍板业务优先级，不独立定义验收标准。

- `SeniorDeveloper`（实现视角）  
  - 关注：落地可行性、复杂度评估、对既有代码的影响、实现路径建议。  
  - 边界：不替产品定义需求，不替测试拍板覆盖率。

- `TestPlanner`（测试视角）  
  - 关注：test_plan、可测性、边界用例、自动化测试的可行性。  
  - 边界：不主导功能设计，只对“是否可测/如何测”发表意见。

- `RiskPlanner`（风险/不确定性）  
  - 关注：信息缺口、外部依赖、风险项、open_questions。  
  - 边界：不给实现方案细节，只指出风险及需要澄清的问题。

- `Coach`（敏捷教练 / 会议主持人）  
  - 对内：负责协调上述角色，不让讨论跑偏，推动收敛；  
  - 对外：作为唯一对用户暴露的 persona，诚实简洁地汇报内部讨论结果，并提出下一步建议。

实现建议：

- 即使前期仍用“单模型 + 一个 prompt”实现，也应在 prompt 中显式拆出各角色的小节：  
  - 明确每个角色：关注点、禁区（不要做什么）、如何与其他角色协作；  
  - 强调“你们正在协作，而不是互相覆盖或重复描述”。  
- 为每个角色预留独立 prompt 片段（例如 `prompts/planning/ProductPlanner.md` 等），  
  方便未来演进为真正的多 Agent 架构时，直接复用这些 persona 定义。

### 10.3 教练与用户的交互模式（简短汇报 + 按需展开）

交互目标：用户感觉自己在和“教练 + 小组”开会，而不是和一个单一的大模型聊天。

第一版交互规范：

- 每一轮内部讨论结束后（一次 `planning_meeting` 调用），教练对用户输出应包含两层：
  1. **简短综合汇报**（必有）  
     - 一段自然语言总结：当前对需求的理解、规划草案的大方向。  
     - 2–5 条“请你确认/选择的问题”：例如范围是否 OK、某个风险是否可接受、是否愿意牺牲某个目标等。
  2. **按需展开的详细视图**（可按用户请求返回）  
     - 多个 section，按角色拆分：  
       - 产品视角（ProductPlanner）  
       - 技术/架构视角（SystemDesigner + SeniorDeveloper）  
       - 测试视角（TestPlanner）  
       - 风险视角（RiskPlanner）  
     - 每个 section 保持“一两句话 + 少量 bullet”，避免冗长。

- 用户在 `/plan` 之后可以：
  - 直接用自然语言继续提问或表达不满（不需要额外命令）；  
  - 显式请求“展开某个视角”，如“给我看看测试视角的详细想法”；  
  - 教练负责将用户的新输入带回内部小组，再开一轮会。

REPL 层面的约定（本轮设计，只写规范不强行一次到位实现）：

- 大阶段仍然通过命令划分：`/plan` 进入规划阶段，其他阶段使用 `/codegen` 等命令；  
- 规划阶段内部的多轮交互尽量“无侵入”：  
  - `/plan` 之后，用户可以直接输入自然语言，系统默认将其路由到规划工作坊；  
  - 如需退出规划工作坊或显式封版，可以考虑后续增加 `/plan-accept` / `/plan-abort` 等命令（本轮只在规范中预留，不要求立即实现）。

### 10.4 规划阶段的“本地记忆”设计（轻量版）

目标：给规划小组一块“本地记忆”，用于记录他们的具体思考和输入输出，而不仅仅是最终的 planning.ai.json。

第一版约定（设计层）：

- 存储位置：仍然挂在 task 的 planning 目录下，例如：  

  ```text
  tasks/<id>/planning/
    planning.transcript.jsonl      # 用户与规划工作坊的对话（已有）
    planning.memory.jsonl          # 内部角色的思考与中间结论（新增）
  ```

- `planning.memory.jsonl` 建议结构（逐行 JSON）：  

  ```json
  {
    "at": "2025-11-17T12:34:56Z",
    "round": 1,
    "role": "ProductPlanner | SystemDesigner | ... | Coach",
    "kind": "thought | question | answer | option | decision",
    "content": "自然语言或简短结构化内容"
  }
  ```

- 设计原则：  
  - **轻量、append-only**：不用一开始就做复杂数据库，先按日志 append；  
  - 只记录“有助于解释规划决策”的关键信息，而不是所有 token 级别思考；  
  - 为后续「可视化会议过程」「回放某一轮讨论」预留依据。

实现优先级：

- 本轮 M12 可以先从 `planning.transcript.jsonl` 中抽象一个轻量 memory 写入逻辑（例如仅记录每轮各角色的最终 verdict）；  
  再逐步丰富 `kind` 和 `content`。  
- 更复杂的“记忆查询/检索”能力，可以在后续与 RAG 或图结构结合时再演进。

### 10.5 状态机与跨阶段产物

根据当前共识：

- 规划阶段内部的多轮交互和多角色协作，在本轮 M12 **不强行绑定到全局状态机**；  
- `state.json.phase` 仍然使用现有的简单阶段枚举（planning/plan_review/...），  
  只在 `actors.planning.round` 等字段中记录“这是第几次规划轮次”；  
- 全局 Orchestrator 如何利用 `planning_meeting` 的决策（go/hold/redo_planning）、  
  如何结合多版本 `versions/`，在本文件中作为后续演进方向保留，但不在本轮实现。

也就是说：**这一轮，我们先把“规划工作坊内部的写作模式和角色协作”设计扎实、文档写清楚**，  
代码实现从 `/plan` 这一阶段开始小步演进；等体验跑顺了，再回过头来做多版本、状态机、全局 PMO 等更大的演化。

---

## 11. 当前「规划工作坊」落地 TODO（仅规划阶段内部）

> 本节是针对目前已经落地的 M12 第一阶段（/plan 内部工作坊）的一份细化 TODO，**只聚焦规划阶段内部**，不改全局 Orchestrator。

1. **/plan REPL 体验增强**  

### 11.x 澄清策略：聪明助手而非表单

- 规划阶段的 AI 默认应当：
  - 尽量基于常识、已有文档与仓库上下文给出完整方案；  
  - 对不确定但可接受的细节采用合理默认值，并在 `assumptions[]`/`notes` 中显式记录；  
  - 仅在选项之间存在明显风险差异或强烈偏好冲突时，才向用户提问。  
- 不再要求“信息不足就必须通过多轮澄清才能继续”，澄清问题从“必答表单”降级为“模型内部记下的疑点”：  
  - 模型可以在规划输出中填充 `open_questions[]`，由后续 review/meeting 阶段与用户一起处理；  
  - `/plan` 不应因为缺少细枝末节信息而频繁阻塞流程。  
- REPL + 教练 侧策略：  
  - 默认不逐条弹出澄清问题给用户回答，而是在规划摘要与规划报告中提示“存在若干未决问题/假设”，并指出可在 review/meeting 中继续讨论；  
  - 当某个专家角色明确标记需要用户澄清的 blocking 问题时，由教练发起“用户 + 该角色 + 教练”的小会：教练作为传声筒转述问题、记录用户回答，并将摘要反馈给该角色；  
  - 澄清对话采用自然语言往返，不限制澄清轮次，由教练和该角色共同判断“当前信息是否已足够继续本轮讨论”。
   - 在 `/plan` 结束时，在终端输出：  
     - 本轮 planning_meeting 的 `rounds[0].decision`；  
     - 各角色（Product/System/SeniorDeveloper/Test/Risk）的红灯/黄灯摘要（来自 `per_role_verdicts`）；  
     - 一两句提示：“你可以继续用自然语言和规划教练对话，然后再次运行 /plan 生成新一版规划”。  

2. **meeting.md 中的多角色视图**  
   - 在 `planning.meeting.md` 中新增一节 `## 各角色结论（概要）`：  
     - 从 `per_role_verdicts` 中为每个角色提取 `ok/reasons`，以 1–2 行形式展示；  
     - 保持当前 `key_points/risks/open_questions/next_actions` 小节不变，仅作为补充视图。  

3. **规划记忆 planning.memory.jsonl 的丰富**  
   - 在现有“Coach/decision + 各角色 verdict”基础上，增加：  
     - 当前轮的 `coach_summary` 记录（kind = \"summary\"）；  
     - 当前轮的 open_questions 逐条记录（kind = \"open_question\"，role = \"Coach\" 或 \"RiskPlanner\"）。  
   - 仍然保持结构轻量、append-only，不做复杂索引。  

4. **规划主模型 prompt 的多角色化（规划 JSON 视角）**  
   - 在 `planning` 模型的 system prompt 中引入与 planning_meeting 一致的多 persona 设定：  
     - 描述 ProductPlanner/SystemDesigner/TestPlanner/RiskPlanner/SeniorDeveloper/Coach 的职责与边界；  
     - 要求在产出 `planning.ai.json` 时，综合各角色视角，尤其是对 scope/non_goals/test_plan/open_questions 的约束。  
   - 与 `planning_meeting` 保持风格一致，但注意区分：  
     - planning 模型负责“产出规划 JSON”；  
     - planning_meeting 模型负责“解释与决策”。  

5. **文档与验收同步到「单一 /plan 工作坊」模型**  
   - 更新以下文档中的描述：  
     - `docs/acceptance/M11-ALL-ACCEPTANCE-2025-11-16.md`；  
     - `docs/quality/planning-quality-and-optimization.md`；  
     - `docs/agents/AGENTS-TODO-MIDTERM-2025-11-15.md`。  
   - 要点：  
     - 不再把 `planning/plan_review/planning_meeting` 当成三个对外阶段；  
     - 明确 `/plan` 一次调用内包含：规划定稿 + 结构审查 + 规划会议纪要 + 规划记忆更新。  
