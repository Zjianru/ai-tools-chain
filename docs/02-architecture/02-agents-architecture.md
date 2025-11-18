# AI Tools Chain — Agents Architecture (Draft)

| 属性 | 值 |
|------|-----|
| **最后更新** | 2025-11-18 |
| **版本** | v1.0 |
| **状态** | ✅ Current |

---

## 📝 更新历史

- **2025-11-18**: 初稿完成

---

> 说明：关于规划阶段（/plan）与“规划工作坊”的行为、角色与澄清策略，  
> 如本文件与 `PLANNING-WORKSHOP-DESIGN-2025-11-17.md` 存在不一致，以后者为准。  
> 目标：逐步从 REPL 内嵌业务逻辑迁移到显式 Agent 架构，为后续图式编排与策略/强化学习留出清晰的状态与接口。

---

## 1. 任务状态与工件（task_state + artifacts）

每个任务以 `task_id` 为中心，拥有一个逻辑上的任务状态（目前计划落在 `tasks/<taskId>/state.json` 或等价结构中）：

```json
{
  "task_id": "20251115-0111-001",
  "phase": "planning | plan_review | codegen | code_review | test_codegen | test_run | done",
  "actors": {
    "planning": { "round": 2, "status": "in_progress" },
    "codegen": { "round": 1, "status": "idle" },
    "review":  { "round": 1, "status": "idle" },
    "test":    { "status": "idle" }
  },
  "artifacts": {
    "planning": {
      "current": "planning.ai.json",
      "final":   "planning.final.json",
      "transcript": "planning.transcript.jsonl"
    },
    "plan_files": "plan.files.json",
    "openspec": {
      "change": "openspec/changes/task-.../change.md",
      "spec":   "openspec/changes/task-.../specs/task/spec.md",
      "tasks":  "openspec/changes/task-.../tasks.md"
    },
    "code": {
      "patch": "patch.json",
      "files_dir": "files/"
    },
    "review": {
      "plan": "plan-review.json",
      "code": "review.json",
      "second_opinion": "second_opinion.md"
    },
    "test": {
      "plan":   "test-plan.json",
      "report": "eval-report.json"
    }
  }
}
```

- Agent 不直接“发明路径”，只通过 `artifacts` 中声明的文件位置读写规划/代码/审查/测试等工件。
- `phase` 用于 orchestrator 决定下一步应调用哪个 Agent；`actors.*.round/status` 用于持久化每个 Agent 的多轮进度。

---

## 2. Agent 接口（统一约定）

概念上的 Agent 接口：

```ts
type AgentMessage = {
  from: "user" | "agent";
  content: string;
};

type AgentResult = {
  statePatch?: object;      // 对 task_state 的增量修改（例如 phase/actors/artifacts 的更新）
  logs?: string[];          // 给用户展示的摘要信息（计划、风险、决策）
  actions?: string[];       // 建议的下一步动作，例如 "ask_user", "call_review", "run_tests"
  questions?: string[];     // 如需向用户澄清的自然语言问题列表
};

interface Agent {
  name: string;
  async step(taskState: object, msg?: AgentMessage): Promise<AgentResult>;
}
```

短期目标：先为 `PlanningAgent` 定义并实现上述接口（包裹现有多轮规划逻辑），再逐步将 `CodegenAgent`、`ReviewAgent`、`TestAgent` 迁移上来。

---

## 3. 规划阶段 Agents（PlanningAgent / PlanReviewAgent / PlanningMeetingAgent）

**PlanningAgent**

- 职责：
  - 根据用户初始描述与项目 context，召集“规划工作坊”，让多个内部角色（Product/System/SeniorDev/Test/Risk 等）协作产出规划草案；
  - 通过 `invokeRole("planning")` 调用模型，产出符合 `planning.ai.json` schema 的结构化规划（包含 requirements/scope/non_goals/test_plan/assumptions/open_questions 等）；
  - 将规划落盘为 `planning.ai.json`、`plan.files.json`，并调用 OpenSpec 映射生成 `change.md/spec.md/tasks.md` 和 `plan.md`。
- 典型 `step` 行为（简化）：
  1. 如 `msg.from === "user"` 且 `phase === "planning"`：
     - 将 `msg.content` 作为新的 `userBrief` 写入 transcript；
     - 调用规划工作坊逻辑（内部可多次调用 `invokeRole("planning")` 与 planning_meeting 相关角色），让各专家角色先基于常识/上下文自行协作达成初步共识；  
     - 更新 `artifacts.planning.*` 与 `phase: "planning_done"`，返回日志和可能的 `actions: ["suggest_plan_review"]`。

**PlanReviewAgent**

- 职责：
  - 审查规划（而非代码），指出范围/需求/风险/测试计划上的缺失；
  - 将结果写入 `plan-review.json` / `plan-review.md`，并给出 gate 结论与问题列表；
  - 可选调用 `plan_review` 模型角色，补充 AI 视角的审查意见（写入 `plan-review.json.ai_review`）。

**PlanningMeetingAgent**

- 职责：
  - 在规划完成且 PlanReview 生成后，整合 `planning.ai.json` + `plan-review.json` + `plan.md`，以“敏捷教练/会议主持人”的身份组织多角色会议并生成“规划阶段会议纪要”；
  - 优先调用 `planning_meeting` 模型角色（Meeting Chair），在失败时回退到规则拼接版；  
  - 负责在内部汇总多角色 verdict，形成会议简报，并在需要时触发“用户 + 特定角色 + 教练”的澄清小会（教练作为传声筒在用户与该角色之间转述问题和回答）。
  - 输出：  
    - `planning.meeting.json`：包含 `planning_summary`（why/what/scope/non_goals/open_questions 计数等）、issues、以及可选的 `ai_meeting` 结构；  
    - `planning.meeting.md`：面向人类的规划会议纪要。

---

## 4. Codegen/Review/Test/Accept Agents

**CodegenAgent**

- 读取 `plan.md` 与 `plan.files.json`，通过 `invokeRole("codegen")` 生成/更新代码（两阶段：`codegen.plan.json` → 实际落笔）；
- 更新 `codegen.plan.json` / `codegen.ir.json` / `patch.json` 与 `files/*.full`，统计 diff 摘要并将 `phase` 切换到 `code_review`。

**CodeReviewAgent**

- 合成“完整本次变更的 diff”（基于 git diff + patch.json + files.full）；
- 调用 `invokeRole("review")` 与 `invokeRole("second_opinion")` 获取代码审查意见；
- 将结果写入 `review.json` / `second_opinion.md`，并给出是否建议修改的 `actions`。

**TestAgent**

- 读取 `planning.ai.json.test_plan`（如存在），在执行评测前输出测试策略与关键用例摘要；  
- 根据 `.ai-tools-chain/config/eval.conf` 执行测试命令（如 `npm test`/`mvn test`/`pytest`），将结果汇总到 `eval-report.json`；
- 在 `AgentResult.logs` 中给出明晰的测试总结（通过/失败与关键失败用例），并更新 `state.json.phase = "test_run"` 与 `actors.test.status`（`completed/failed/error`）。

**AcceptAgent**

- 角色：评测 Gate + 提交执行者。  
- 关注点：
  - 封装 `runAcceptCore`，在不带 `commitMessage` 时只做 Gate 判定（通过/失败/可否 override）；  
  - 在 REPL `/accept` 中分为“两段式”：先用 AcceptAgent 做 Gate 判定，再在用户确认 override + 提供 commit message 后再次调用 AcceptAgent 完成提交；  
  - 更新 `state.json.phase = "accept"`，并在 `actors.accept` 中记录最新 Gate/提交结果（`status/reason/failedStep`）。

**RevertAgent**

- 角色：回滚执行者。  
- 关注点：
  - 基于 `patch.json` 和 git（restore/clean）回滚本次 codegen 变更；  
  - 将新增文件删除，将修改过的文件恢复到 codegen 前状态，并将 `meta.status` 标记为 `redo`；  
  - 更新 `state.json`，将 `phase` 回退到 `planning`，并设置 `actors.revert.status = "completed"`、`actors.codegen.status = "redo"`。

---

## 5. Orchestrator 的角色（取代“胖 REPL”）

Orchestrator（当前可以隐藏在 CLI 层）仅做三件事：

1. 维护 `task_state`：
   - 在每次命令（例如 `/plan`）前从磁盘读入最新的 `task_state`；
   - 根据 `AgentResult.statePatch` 合并并写回。
2. 调用合适的 Agent：
   - 基于当前 `phase` 和用户命令决定调用哪个 Agent 的 `step()`；
   - 例如 `/plan` 总是调用 `PlanningAgent`，而自动触发的 plan-review 可以由 `actions` 决定。
3. 展示 Logs / 问题：
   - 将 `AgentResult.logs` 输出到终端；
   - 如果 `questions` 非空，则按顺序向用户提问，并将用户回答转换为下一轮的 `msg` 发送给 Agent。

短期内，现有的 REPL 会继续作为用户的入口，但业务逻辑将逐步迁移到上述 Agents 与 orchestrator 上，直到 REPL 成为纯粹的“终端 UI”。

---

## 6. 长期愿景（Graph & Policy / RL）

在上述 Agent 架构和状态模型稳定后，可以考虑：

- **Graph / Workflow 编排**：将 `phase` 与 Agent 调用关系显式建成一个图，并以 declarative 的方式定义“从 planning 到 codegen/test 的路径”，便于可视化与验证。
- **Program / IR 驱动**：将 `planning.ai.json` 进一步演进为更严谨的 IR（包含 scope/non_goals/design/file_impacts/test_plan 等），让 OpenSpec、codegen 和 test 都以 IR 为核心输入。
- **Policy / RL 驱动编排（长期实验）**：在有足够任务轨迹（state + actions + reward）后，让一个策略层学习“何时多问/何时多 review/何时生成测试”，而不是全部手写状态机。

当前迭代聚焦于 Phase 1：引入 `PlanningAgent` 并将 `/plan` 的逻辑迁移到 Agent 层，同时保持现有 CLI 行为不变。后续迭代将基于本文档持续演进架构。 

---

## 7. 专家席与“教练/经理”角色（2025-11-15 草案）

> 为了让 Orchestrator 更像“敏捷教练/项目经理”，而不是简单状态机，这里对当前与规划中“专家席”角色做一次梳理，后续可以在此基础上扩展。

### 7.1 现有专家（已实现的 Agents）

- `PlanningAgent`  
  - 角色：规划主笔（规划专家）。  
  - 关注点：将用户的一句需求变成结构化的 `planning.ai.json` 和 OpenSpec 产物。  
  - 输出：`planning.ai.json / planning.draft.json / plan.files.json / plan.md`。

- `PlanReviewAgent`  
  - 角色：规划守门人（结构+规范审查）。  
  - 关注点：规划是否“能用”：字段是否齐全、OpenSpec 是否通过。  
  - 输出：`plan-review.json / plan-review.md`，给出 gate 结论与问题列表。

- `CodegenAgent`  
  - 角色：代码生成执行者。  
  - 关注点：基于 plan 和 IR，将变更写入业务代码，并产出 `codegen.plan.json / codegen.ir.json / patch.json / files/*.full`。

- `CodeReviewAgent`  
  - 角色：代码审查专家。  
  - 关注点：基于 diff 合成 second_opinion + review 结果，输出代码层面的风险与建议。  
  - 输出：`review.json / second_opinion.md`，以及 REPL 中的代码审查摘要。

- `ReviewMeetingAgent`  
  - 角色：代码审查会议记录员。  
  - 关注点：整合 `review.json` 和 `second_opinion.md`，沉淀一份“代码审查会议纪要”。  
  - 输出：`review.meeting.json / review.meeting.md`。

- `TestAgent`  
  - 角色：测试执行者。  
  - 关注点：根据 `eval.conf` 执行测试/评测步骤，记录通过/失败结果。  
  - 输出：`eval-report.json` 及 `eval-*.log`。

### 7.2 现有专家（模型角色级）

- `planning`  
  - 职责：生成新协议的规划 JSON（`planning.ai.json`）。  
  - prompt：`.ai-tools-chain/prompts/planning.system.md`。

- `codegen`  
  - 职责：根据 plan 和目标文件，生成 `files[]` 形式的 codegen IR（再由本地执行）。  
  - prompt：`.ai-tools-chain/prompts/codegen.system.md`。

- `review`  
  - 职责：对 diff 做代码审查，给出 summary/risks/suggestions。  
  - prompt：`.ai-tools-chain/prompts/review.system.md`。

- `second_opinion`  
  - 职责：从整体方案 + diff 角度给出第二视角意见。  
  - prompt：`.ai-tools-chain/prompts/second_opinion.system.md`。

### 7.3 规划中的新增专家（待实现）

> 以下角色尚未实现，仅在文档中占位，为后续扩展专家席提供方向。

- `ProductPlanner`（产品/需求规划专家）  
  - 在 `PlanningAgent` 之前或之中提供 user story、scope/non_goals 的拆解。  
  - 产物：更清晰的 `scope/non_goals` 字段，供后续阶段参考。

- `RiskPlanner`（风险规划专家）  
  - 专注梳理和补全规划中的风险、依赖、回滚策略。  
  - 产物：更丰富的 `risks` 字段，可能扩展为结构化 risk 对象。

- `DesignAdvisor`（设计/架构顾问）  
  - 在规划与 codegen 之间给出实现思路（设计节、模块划分、跨模块约束）。  
  - 产物：`design` 字段，为 codegen/review 提供高层设计上下文。

- `FileImpactPlanner`（文件影响规划者）  
  - 专注从规划/设计映射到 `file_impacts`（每个文件的 purpose/type）。  
  - 产物：`file_impacts` 字段，进一步支撑 draft_files 和 IR 规划。

- `TestPlanner`（测试规划专家）  
  - 从规划侧出发，设计 test_plan（策略/关键用例/自动化范围）。  
  - 产物：`test_plan` 字段，为 TestAgent 和 `/eval` 提供更强的测试指导。

- `SecurityReview`（安全审查专家）  
  - 在 code review 阶段专门关注安全相关问题（权限、数据、注入等）。  
  - 可作为独立模型角色或 review 的子角色。

### 7.4 教练/经理类角色（Orchestrator & Meeting Chair）

- **Orchestrator（程序层“项目经理”）**  
  - 依赖：`tasks/<taskId>/state.json` 与 `artifacts` 清单。  
  - 职责：
    - 根据当前 `phase` 决定调用哪个 Agent（planning → plan_review → codegen → review → test → accept）。  
    - 合并 Agent 的 `statePatch`，维护 `state.json`。  
    - 收集 `logs/actions/questions`，在不同 UI（REPL/非交互 pipeline）中以合适方式呈现。

- **Meeting Chair（模型层“会议主持 + 纪要者”）**  
  - 针对不同会议场景（planning review meeting / code review meeting / test debrief）设计：  
    - 输入：相关专家（plan_review / code_review / test 等）的结构化输出。  
    - 输出：结构化会议纪要（共识、分歧、风险、下一步行动）以及可选的下一步建议（actions）。  
  - 典型形态：
    - `planning_meeting`：围绕规划和 plan-review 的结果进行整理；  
    - `code_review_meeting`：围绕 diff、review.json、second_opinion.md 进行整理（当前 ReviewMeetingAgent 是非 AI 版本的最小实现）。

### 7.5 与 TODO 的关系（后续工作方向）

结合本节“专家席”草图，详细的中期 TODO 与设计草案已经整理在：  
- `docs/agents/AGENTS-TODO-MIDTERM-2025-11-15.md`

该文件覆盖了以下方向：
- AcceptAgent/RevertAgent（提交与回滚 Agent 化）；  
- Orchestrator 策略升级（基于 `state.json` 的状态机，而不是固定线性）；  
- PlanningMeeting/ReviewMeeting 升级为 AI 会议主持；  
- TestPlanner 与 `test_plan` 驱动的评测；  
- 规划扩展字段（scope/non_goals/file_impacts/open_questions 等）的落地使用；  
- 多专家席与 Meeting Chair 的逐步引入策略。

后续实现应以该 TODO 文档为依据，并保持与本文件、`pipeline-artifacts-and-contracts.md` 和 `planning-schema-and-prompt.md` 的一致性。
