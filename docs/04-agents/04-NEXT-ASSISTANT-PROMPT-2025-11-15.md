## 给下一位 AI 助手的系统 Prompt（2025-11-15 修订版）

你正在接手一个名为 **“AI Tools Chain”** 的本地优先 CLI 项目。你的工作是在现有基础上，继续推进「规划 → 强确认 → 代码生成 → 审查/第二视角 → 评测 → 提交/回滚」这一条本地可审计工具链，重点是 **Agents + Orchestrator + 统一协议**，而不是推翻已有设计。

请在开始任何改动前，完整读完本文件和下文列出的核心文档，并严格遵守其中的约定。

---

### 1. 项目目标与设计原则

- 项目目标：在任意业务仓库中，提供一条本地流水线：  
  `规划（OpenSpec + planning.ai.json） → 强确认 → codegen → 第二视角/代码审查 → 评测 → 提交/回滚`。
- 设计原则：
  - **Local-first**：所有交互与产物都保存在业务项目下的 `.ai-tools-chain/` 目录，不上传远端。
  - **强确认 + 护栏**：任何写代码的操作必须经过中文强确认；危险路径 / 大规模变更需要额外确认。
  - **可审计**：每个任务都有完整的 artifacts（规划、IR、diff、评测、提交历史等），支持回溯和审计。
  - **模型 / 供应商解耦**：通过 `invokeRole(role, payload, ctx)` + `models.conf` 管理 provider 链，prompt 与具体模型解耦。

---

### 2. 先读哪些文档

在动任何代码或协议前，必须优先阅读以下文档——它们是当前设计的「法律文本」（如有冲突，以本列表中排列靠前者为准）：

1. `docs/architecture/PLANNING-WORKSHOP-DESIGN-2025-11-17.md`  
   - 统一描述 `/plan` 的用户旅程、“规划工作坊”内部协作、敏捷教练/传声筒澄清机制、多版本规划与规划报告的目标形态。
2. `docs/architecture/planning-schema-and-prompt.md`  
  - 定义 **planning.ai.json 的新 schema**：  
     `schema_version / meta / why / what / requirements / targets / risks / acceptance / draft_files / tasks / notes`。  
  - 说明 JSON → OpenSpec 文本的映射方式。  
  - 描述规划阶段的“规划工作坊”模式与 `draft_files` 约束（只有规划明确给出的文件可以进入 codegen），澄清问题由内部角色优先基于常识/上下文自行解决，仅在关键 blocking 情况下才通过教练与用户对话。

3. `docs/architecture/pipeline-artifacts-and-contracts.md`  
   - 为各阶段（planning / plan_review / planning_meeting / codegen / review / review_meeting / eval）列出：  
     - 必选 artifacts（文件名 / 路径 / 作用）；  
     - AI 的输入输出契约；  
     - 每个阶段产物之间的依赖关系与来源。

4. `docs/architecture/AGENTS-ARCH.md`  
   - 定义 `task_state` / `state.json` 结构（`phase + actors.*.status / round + artifacts`）；  
   - 描述现有 Agents（Planning / PlanReview / PlanningMeeting / Codegen / CodeReview / ReviewMeeting / Test）与 Orchestrator；  
   - 说明「专家席 + 敏捷教练 / 项目经理（Orchestrator & MeetingChair）」的角色设计。

5. `docs/agents/HANDOVER-2025-11-15.md`  
   - 汇总当前已完成的工作、Backlog（P0 / P1 / P2）、关键决策和注意事项，是你接手时的全局视图。

如果文档与代码存在不一致，以 **上述文档为准先修文档，再修代码**。

---

### 3. 当前实现概览（你必须尊重的部分）

你不应该推翻以下已有设计，而是在其基础上扩展 /打磨：

- **Agents（`src/agents/*`）**
  - `PlanningAgent`  
    - 组织“规划工作坊”：基于用户 brief 与上下文，召集内部多角色（Product/System/SeniorDev/Test/Risk 等）协作形成规划草案；  
    - 调用 `invokeRole("planning")`，只接受 **新 schema**，产出包含 scope/non_goals/test_plan/assumptions/open_questions 的 `planning.ai.json`；  
    - 输出：`planning.ai.json`（新 schema） + `plan.files.json` + `plan.md` + OpenSpec 产物。
  - `PlanReviewAgent`  
    - 输入：`planning.ai.json` + `plan.md` + OpenSpec validate 结果；  
    - 负责结构/openspec gate，调用 `invokeRole("plan_review")`；  
    - 输出：`plan-review.json` + `plan-review.md`，其中可包含 `ai_review` 字段。
  - `PlanningMeetingAgent`  
    - 基于 `planning.ai.json` + `plan-review.json` + `plan.md`，以敏捷教练/主持人身份组织规划会议：  
      - 聚合各角色 verdict，形成会议简报与决策（go/hold/redo_planning）；  
      - 在需要时发起“用户 + 某个角色 + 教练”的澄清小会，由教练作为传声筒转述问题和回答；  
      - 产出 `planning.meeting.json` + `planning.meeting.md`，并为最终规划报告提供素材。
  - `CodegenAgent`  
    - 严格依赖 `plan.files.json.files[]` 作为目标文件列表；  
    - 两阶段 codegen：  
      1. 调 `invokeRole("codegen")` → 生成 `codegen.plan.json`（文件级 IR / 计划）；  
      2. Git 护栏 + 实际写文件 → `files/*.full` + `patch.json` + `codegen.ir.json`。  
  - `CodeReviewAgent`  
    - 合成「git diff + 新增文件伪 diff」的 `diffText`；  
    - 调 `second_opinion` + `review` 模型；  
    - 输出：`review.json` + `second_opinion.md`。
  - `ReviewMeetingAgent`  
    - 基于 `review.json` + `second_opinion.md`，写代码审查会议纪要：  
      `review.meeting.json` + `review.meeting.md`。
  - `TestAgent`  
    - 包装 `runEvalCore`，按 `eval.conf` 执行 lint / test 等，输出 `eval-report.json`。

- **Core & Orchestrator**
  - `src/core/planning.mjs`  
    - 只使用新 schema 顶层字段生成 OpenSpec 文本；  
    - 不再兼容任何旧的 `plan.*` 输出结构。
  - `src/core/codegen.mjs`  
    - 目标文件只来自 `plan.files.json.files[]`；  
    - 实现两阶段 codegen 与 Git 护栏；  
    - 记录 patch / full files / IR。
  - `src/cli/pipeline.mjs`  
    - `runPipeline("agents")` 作为 Orchestrator demo：  
      顺序调用各 Agent，维护 `state.json` 和 `pipeline-result.json`。

- **REPL（`src/cli/repl.mjs`）**
  - `/plan`：多轮规划 → 自动 PlanReview → 自动 PlanningMeeting；  
  - `/planreview`：手动触发 PlanReview；  
  - `/codegen`：封装 CodegenAgent + 强确认；  
  - `/review`、`/eval`、`/accept`、`/revert`、`/status`：已接入对应 Agent 或 core。

你在改动时，应基于这些实现做「增强 / 扩展」，而不是重写或绕过它们（尤其不能回退到旧的 planning 协议）。

---

### 4. 硬约束和禁止事项

1. **Planning 协议只能使用新 schema**  
   - `planning.ai.json` 必须符合 `planning-schema-and-prompt.md` 中的新 schema：  
     - 顶层字段包括：`schema_version / meta / why / what / requirements / targets / risks / acceptance / draft_files / tasks / notes`；  
     - 不允许在任何新代码中继续兼容或引用旧的 `plan.*` / `planning.plan.*` 结构。  
   - 如模型输出不符合新 schema，应：  
     - 优先调整相应 system / user prompt；  
     - 如仍失败，应在日志和 REPL 中明确报错，而不是在 core 内「偷偷转换」。

2. **`plan.files.json` 是 codegen 的唯一权威文件列表**  
   - `plan.files.json.files[]` 必须由 `planning.ai.json.draft_files` 显式生成；  
   - `runCodegenCore` / `CodegenAgent` 不得「猜测」或自动发明路径，也不要从 diff /历史文件中反推；  
   - 当 `plan.files.json` 为空或缺失时，`/codegen` 应明确拒绝继续，并给出可操作的提示。

3. **文档与 prompt 优先于实现，改动必须同步**  
   - 若你调整了一段 Agent 行为或协议结构，必须同步更新：  
     - `docs/architecture/pipeline-artifacts-and-contracts.md`；  
     - `docs/architecture/AGENTS-ARCH.md`；  
     - 相关角色的系统 prompt（如 `.ai-tools-chain/prompts/*.system.md` 或模板内的 prompts）。  
   - 不允许在未更新文档的情况下改变协议；发现不一致时，先修文档再修代码。

4. **Orchestrator 提供「建议」，不强制用户路径**  
   - Orchestrator（目前 demo 在 `pipeline agents`）负责根据 `state.json` 推荐下一阶段；  
   - 用户仍可以通过 REPL 命令手动选择阶段（`/plan`、`/codegen`、`/review` 等）；  
   - 未来增加的 `/next` / `/redo` 只是快捷操作，不应锁死用户流程。

---

### 5. Backlog 与优先级（接力方向）

详细 Backlog 请看 `docs/agents/HANDOVER-2025-11-15.md`，这里只列出你接手时最重要的几个方向：

- **P0：Orchestrator 接口稳定化**
  - 在（建议新建）`src/core/orchestrator.mjs` 中抽象：  
    - `next(taskState) -> { phase, agentName }`：基于 `state.json` 计算推荐下一步；  
    - `redo(taskState, phase)`：支持将任务回退到指定阶段，并更新相应 `actors[phase].round` / 状态。  
  - 将 `pipeline agents` 里的串联逻辑下沉到 Orchestrator 模块，CLI 只负责调用。

- **P0：规划 PlanReview 行为打磨**
  - 收紧 `plan_review.system.md` 的输出 schema，例如：  
    - `ai_review: { ok, summary, risks[], gaps[], suggestions[], next_actions[] }`；  
  - 在 `PlanReviewAgent` 中：  
    - 标准化 `ai_review` 的结构与错误处理；  
    - 在 `plan-review.json` 和 `planning.meeting.md` 中充分利用这些字段。

- **P1：PlanningMeeting 变成真正的「会议主持」角色**
  - 新增 `planning_meeting` 模型角色与对应 system prompt；  
  - 将 `PlanningMeetingAgent` 升级为：  
    - 先聚合 planning + plan-review + openspec 结果；  
    - 再调用 `planning_meeting` 生成会议纪要（替代当前仅靠规则拼接的版本）。

- **P1：REPL 与 Orchestrator 深度集成**
  - 设计并实现 `/next` 命令：  
    - 读取 `state.json` → 调用 Orchestrator `next` → 执行对应 Agent → 更新 `state.json`。  
  - 设计并实现 `/redo <phase>`：  
    - 支持从 codegen 回到 planning 等「阶段回退」；  
    - 与 `/revert` 的行为保持一致或至少可解释（例如回退 codegen 前自动提示是否回滚工作区改动）。  
  - 在 docs 中补充 Orchestrator 与 `/next` / `/redo` 的用法示例。

---

### 6. 建议的起步动作

为了快速建立直觉和检查协议，你可以这样开始：

1. 在 `playgrounds/testProject` 中运行 REPL：  
   - `ai-tools repl` → `/plan` → `/planreview` → `/codegen` → `/review` → `/eval`；  
   - 对照 `pipeline-artifacts-and-contracts.md` 检查 `.ai-tools-chain/tasks/<taskId>/` 下的产物是否齐全、结构是否符合预期。
2. 运行非交互 Orchestrator demo：  
   - `ai-tools pipeline agents`；  
   - 检查 `state.json` 和 `pipeline-result.json` 是否按阶段演进。
3. 从 P0 开始实现/打磨 Orchestrator 与 PlanReview；  
4. 完成一小段改动后，先更新文档，再视情况建议用户做一次小步提交。

---

### 7. 总结：你在接力时要牢记的几句「硬话」

- **所有规划只认新 schema，不要再救旧协议**；  
- **所有 codegen 只认 `plan.files.json`，不要自己猜路径**；  
- **任何协议变更先修 docs 再修代码**；  
- **Orchestrator 是管家，不是独裁者；REPL 永远是第一入口**；  
- **保持小步提交与高质量交接文档，让下一位助手能无缝接手你现在的工作**。
