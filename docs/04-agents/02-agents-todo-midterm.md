# Agents 中期能力 TODO 与设计草案（2025-11-15）

| 属性 | 值 |
|------|-----|
| **最后更新** | 2025-11-15 |
| **版本** | v1.0 |
| **状态** | ✅ Current |

---

## 📝 更新历史

- **2025-11-15**: 初稿完成

---

> 本文是针对“中期能力”的专门 TODO 列表，每一条都附带最小设计草案。  
> 代码实现必须与下列设计以及以下文档保持一致：  
> - `docs/architecture/AGENTS-ARCH.md`  
> - `docs/architecture/pipeline-artifacts-and-contracts.md`  
> - `docs/architecture/planning-schema-and-prompt.md`  
> - `docs/agents/NEXT-ASSISTANT-PROMPT-2025-11-15.md`

当前仓库已完成：Planning/PlanReview/PlanningMeeting/Codegen/CodeReview/ReviewMeeting/Test Agents、最小 Orchestrator（`pipeline agents` + REPL `/next`/`/redo`）。  
本文件聚焦“尚未完成或仅有雏形”的中期能力。

---

## TODO 1：AcceptAgent / RevertAgent（提交与回滚 Agent 化）

**现状检查**

- `/accept`：直接调用 `runAcceptCore`（`src/core/accept.mjs`），不通过 Agent，不更新 `state.json.actors.accept`。  
- `/revert`：REPL 内部直接操作 git + `patch.json`，未抽象为 Agent，也无 `actors.revert` 状态。

**目标**

- 将“评测 Gate + 提交 + 回滚”纳入 Agent 体系和 `state.json`：  
  - `AcceptAgent`：负责读取 `eval-report.json` + 调用 `runAcceptCore`，生成 commit 或给出 Gate 建议。  
  - `RevertAgent`：负责执行现有 `/revert` 逻辑（基于 `patch.json` + git），并更新 `meta.status` 和 `state.json`。

**设计草案**

- 新增 Agent：
  - `src/agents/acceptAgent.mjs`（名称：`AcceptAgent`，phase：`accept`）  
    - 输入：
      - `cwd, aiDir, tasksDir, taskId, metaPath, cfg`  
      - 依赖：`eval-report.json`（可选）  
    - 行为：
      1. 调用 `runAcceptCore({ ..., commitMessage?, overrideGate? })`，但默认先以 `doCommit = false` 模式执行 Gate 判定；  
      2. 根据返回的 `{ok, reason, allowOverride, overridePhrase, failedStep}` 生成日志与下一步建议；  
      3. 在 REPL 中，由用户决定是否 override + 真正提交（可通过再次调用 `runAcceptCore` 完成 commit）；  
      4. 写入 `statePatch`：
         ```json
         {
           "phase": "accept",
           "actors": {
             "accept": {
               "status": "completed" | "gate_failed" | "needs_override",
               "round": <number>,
               "last_reason": "<reason from gate>"
             }
           },
           "artifacts": {
             "eval_report": "tasks/<taskId>/eval-report.json"
           }
         }
         ```
  - `src/agents/revertAgent.mjs`（名称：`RevertAgent`，phase：`revert` 或 `rollback`）  
    - 输入：
      - `cwd, aiDir, tasksDir, taskId, metaPath`  
      - 依赖：`patch.json` + git 工作区  
    - 行为：抽取现有 `/revert` 的逻辑：  
      - 删除 `patch.json` 标记的新增文件；  
      - 调用 `git restore` / `git clean` 回滚工作区；  
      - 更新 `meta.status = "redo"`；  
      - 写入 `statePatch`：
        ```json
        {
          "phase": "planning",
          "actors": {
            "revert": { "status": "completed", "round": <number> },
            "codegen": { "status": "redo" }
          }
        }
        ```

- Orchestrator 集成：
  - Online REPL：  
    - `/accept` 命令改为调用 `AcceptAgent`，然后视返回的 Gate 状态再询问用户是否 override 并提交；  
    - `/revert` 可以选择直接调用 `RevertAgent`，或提供一个 `/redo codegen` + `/revert` 组合提示。  
  - 非交互 pipeline：  
    - Orchestrator 的线性阶段可在 `test` 之后增加 `accept`，但必须支持“只跑到 test，不自动 accept”模式。

**验收标准草案**

在 `playgrounds/testProject` 中，使用 `ai-tools repl` 验收：

- `/accept` 行为：
  - 在执行 `/eval` 后运行 `/accept`：
    - 若 `eval-report.json` 中所有步骤 `status = passed`：
      - 第一轮 `/accept` 会打印“评测 Gate 已通过，可以安全提交。”，并在 `state.json.actors.accept.status` 中记录 `gate_passed` 或等价值；
      - 第二轮 `/accept` 在输入提交摘要后会完成 git 提交，并将 `actors.accept.status` 更新为 `committed`（或等价枚举），`meta.status` 变为 `done`。
    - 若存在失败步骤：
      - 第一轮 `/accept` 会提示 Gate 未通过，并打印失败步骤名称；
      - 如 `allowOverride = false`，命令直接结束，不执行提交；
      - 如 `allowOverride = true`，会提示强确认短语（默认“确认合入”），用户未正确输入时不得提交。
  - 运行结束后，`tasks/<taskId>/state.json` 中：
    - `phase` 应为 `accept` 或后续阶段；
    - `actors.accept` 存在，并包含 `status` 与最近一次 Gate 原因。

- `/revert` 行为：
  - 在完成一次 `/codegen` 后执行 `/revert`，确认输入 `YES`：
    - 工作区中的新增文件会根据 `patch.json.items[op=create]` 删除；
    - 修改过的文件通过 `git restore`/`git clean` 回到变更前状态；
    - `meta.json.status` 被写为 `redo`；
    - `state.json` 中：
      - `phase` 回到 `planning`；
      - `actors.codegen.status` 为 `redo`；
      - `actors.revert.status` 为 `completed`。
  - 未输入 `YES` 时，`/revert` 不应对工作区或状态产生任何改动。

---

## TODO 2：Orchestrator 策略升级（从线性到基于状态）

**现状检查**

- `src/core/orchestrator.mjs`：  
  - 维护固定线性阶段数组：`["planning","plan_review","codegen","code_review","code_review_meeting","test"]`；  
  - `suggestNextFromState` 只看 `state.phase`，不会参考 `actors.*.status` 或 PlanReview/Eval 结果。
- REPL `/next`：基于当前 `phase` 推荐下一 Agent，没有 gate 或回退策略。

**目标**

- 让 Orchestrator 成为一个“基于状态 + 策略”的建议器，而不只是线性推进：  
  - 能根据 `plan-review.ok`、`eval-report` 结果、`meta.status` 决定“推进 / 回到某阶段 / 停在当前阶段”；  
  - 给出推荐的同时附带 reason，方便 REPL 里解释。

**设计草案**

- 扩展 `state.json` 使用约定：
  - `phase`：当前推荐交互阶段（例如 `planning`、`plan_review`、`codegen`、`code_review`、`test`、`accept`）。  
  - `actors.<phase>.status`：  
    - 枚举：`idle | in_progress | completed | failed | redo | gate_failed | needs_override`。  
  - `artifacts`：  
    - 约定关键路径：  
      - `planning_ai`: `planning.ai.json`  
      - `plan_review`: `plan-review.json`  
      - `planning_meeting`: `planning.meeting.json`  
      - `codegen_ir`: `codegen.ir.json`  
      - `review`: `review.json`  
      - `review_meeting`: `review.meeting.json`  
      - `eval_report`: `eval-report.json`

- 升级 `suggestNextFromState(tasksDir, taskId)`：
  - 读取 `state.json` + 部分关键 artifacts，执行有限状态机策略，例如：
    - 若 `phase = "planning"` 且 `actors.planning.status = "completed"` → 下一阶段 `plan_review`；  
    - 若 `phase = "plan_review"` 且 `plan-review.json.ok = false` → 推荐回到 `planning`，reason: "plan_review_not_ok"；  
    - 若 `phase = "codegen"` 且 `actors.codegen.status = "failed"` → 推荐 `revert` 或回到 `planning`，由策略决定；  
    - 若 `phase = "test"` 且 `eval-report.json` 中存在 failed → 推荐 `accept`，但标记为 `gate_failed`/`needs_override`。  
  - 返回结构可扩展为：
    ```json
    {
      "phase": "codegen",
      "reason": "plan_review_ok",
      "details": {
        "from": "plan_review",
        "plan_review_ok": true
      }
    }
    ```

- REPL `/next` 行为调整：
  - 打印推荐阶段 + 关键理由；  
  - 在 Gate 类场景（例如 plan_review 不通过）时，不强制执行 Agent，而是先提示用户可选项：
    - “继续 codegen”  
    - “回到 planning（/redo planning）”  
  - 后续可引入“自动执行模式”（非交互 pipeline 和 CI 场景）。

**验收标准草案**

- 在 `plan_review` 之后调用 `/next`：
  - 若 `tasks/<taskId>/plan-review.json.ok === false`：
    - `/next` 应打印推荐阶段为 `planning`，reason 为 `plan_review_not_ok`；
    - `details.from` 为 `"plan_review"`，`details.planReviewOk` 为 `false`；
    - 不自动执行任何 Agent，仅给出建议。
  - 若 `plan-review.json.ok === true`：
    - `/next` 至少应推荐 `codegen` 或后续阶段，reason 为 `linear_pipeline: plan_review -> codegen` 或等价值。

- 在 `/eval` 完成后调用 `/next`：
  - 若 `eval-report.json` 中存在 `status = "failed"` 的步骤：
    - `/next` 应推荐阶段为 `accept`，reason 为 `eval_failed_needs_gate`；
    - `details.failedStep` 为首个失败步骤名；
    - REPL 应提示“请使用 /accept 完成 gate 判定”，而不是自动提交或回退。
  - 若所有步骤通过：
    - `/next` 应推荐阶段为 `accept`，reason 为 `eval_passed_ready_for_accept`；
    - 同样不自动执行 Agent，只做推荐，由用户决定何时运行 `/accept`。

---

## TODO 3：PlanningMeeting / ReviewMeeting 升级为 AI 会议主持

**现状检查**

- `PlanningMeetingAgent`：已存在，但实现为规则+拼接，未调用单独模型角色。  
- `ReviewMeetingAgent`：类似，未引入 `review_meeting` 模型角色。  
- `.ai-tools-chain/prompts/` 目前只有：planning / codegen / review / second_opinion / plan_review。

**目标**

- 在规划和代码审查两个阶段，引入“会议主持 + 纪要者”模型：  
  - `planning_meeting`：整理 planning + plan_review 的结果，生成会议纪要与下一步行动建议；  
  - `review_meeting`：整理 review + second_opinion 的结果，生成审查会议纪要。

**设计草案**

- 新增模型角色与 prompt 模板：
  - 在 `templates/.ai-tools-chain/prompts/` 中新增：  
    - `planning_meeting.system.md`  
    - `review_meeting.system.md`  
  - 在 `templates/.ai-tools-chain/config/models.conf` 示例中增加对应 `role = planning_meeting / review_meeting` 条目。

- 升级 `PlanningMeetingAgent`：
  - 调整输入：
    - `planning.ai.json`  
    - `plan-review.json`（含 `ai_review`）  
    - `plan.md` / OpenSpec change 摘要  
  - 调用 `invokeRole("planning_meeting", payload, ctx)`：  
    - `payload` 包含规划要点、PlanReview issues、openspec warnings 等；  
    - 让模型输出结构化 JSON（例如 `{summary, risks, open_questions, next_actions[], decision}`）；  
  - 落盘：
    - `planning.meeting.json`：保存结构化输出；  
    - `planning.meeting.md`：人类可读纪要（可以由模型直接生成或由代码渲染 JSON）。

- 升级 `ReviewMeetingAgent`：
  - 类似方式引入 `review_meeting` 角色：  
    - 输入：`review.json` + `second_opinion.md` + diff 摘要；  
    - 输出：`review.meeting.json` + `review.meeting.md`，包含结论、一致/分歧、风险、TODO。

**验收标准草案**

- `PlanningMeetingAgent` 行为：
  - 在执行 `/plan` 后自动触发的规划会议阶段，应在 `tasks/<taskId>/` 下生成：  
    - `planning.meeting.json`：包含 `taskId/title/planning_summary/issues/plan_md_present`，若模型调用成功，还应包含 `ai_meeting` 字段；  
    - `planning.meeting.md`：  
      - 模型成功时，包含 `总结/关键要点/风险/尚待澄清的问题/下一步建议/决策` 等段落；  
      - 模型失败或未配置对应 role 时，至少保留原有规则版的“发现的问题/风险 + 下一步建议”结构。  
  - 在 `state.json` 中：  
    - `phase` 最终应更新为 `planning_meeting` 或后续阶段；  
    - `actors.planning_meeting.status` 为 `"completed"`。

- `ReviewMeetingAgent` 行为：
  - 在执行 `/review` 后，应在 `tasks/<taskId>/` 下生成：  
    - `review.meeting.json`：包含 `taskId/summary/risks/suggestions/second_opinion_preview`，若模型调用成功，还应包含 `ai_meeting` 字段；  
    - `review.meeting.md`：  
      - 模型成功时，包含 `Overall Summary/Risks/Suggestions/Open Questions/Next Actions/Decision` 等段落，并附带 second_opinion 预览；  
      - 模型失败或未配置对应 role 时，至少保留原有规则版的“Summary/Risks/Suggestions/Second Opinion (Preview)”结构。  
  - 在 `state.json` 中：  
    - `phase` 更新为 `code_review_meeting`；  
    - `actors.review_meeting.status` 为 `"completed"`。

---

## TODO 4：TestPlanner 与 test_plan 驱动的评测

**现状检查**

- `planning-schema-and-prompt.md` 已定义 `test_plan` 字段，但在 prompt 中只是“可选扩展”；  
- `TestAgent` / `runEvalCore` 最初只依赖静态的 `eval.conf`，尚未消费 `test_plan`；  
- 当前进展（2025-11-16）：  
  - `PlanningAgent` 已尝试推动模型填充 `planning.test_plan`；  
  - `PlanReviewAgent` 在 `test_plan` 为空时会给出 `TEST_PLAN_EMPTY` warning；  
  - `TestAgent` 会在执行 eval 前打印 `test_plan.strategy/cases/automation` 摘要，并在 eval 后基于步骤名称与用例描述做**粗粒度覆盖提示**，同时把 `test_plan_summary` 写入 `eval-report.json`（仅提示，不 Gate）。

**目标**

- 让测试规划成为一等公民：  
  - 在 planning 阶段产出可用的 `test_plan`；  
  - 在评测阶段（/eval）基于 `test_plan` 给出更贴合需求的测试步骤/建议。

**设计草案**

- 方案 A：独立 Agent `TestPlanner`：
  - 新增 `src/agents/testPlannerAgent.mjs`：  
    - 角色：`TestPlanner`，phase：`test_plan` 或归属于 `planning` 子阶段；  
    - 输入：`planning.ai.json` + 任务上下文；  
    - 输出：更新 `planning.ai.json.test_plan` 字段，并写入 `statePatch.actors.test_plan`。  
  - Prompt：
    - 新增 `test_planner.system.md`，强调覆盖 strategy /关键 cases/自动化范围。

- 方案 B：扩展现有 `planning` 模型：
  - 在 `planning.system.md` 中加强 `test_plan` 的要求；  
  - 由 `PlanningAgent` 负责检查并补全 `test_plan`（必要时多轮澄清）；  
  - PlanReviewAgent 针对 `test_plan` 做质量检查（为空时打 warning）。

- 与 `TestAgent` 集成：
  - `TestAgent` 读取 `planning.ai.json.test_plan`：  
    - 在执行 `eval.conf` 前先打印测试策略和关键用例；  
    - 在未来版本中，可根据 `test_plan` 选择性启用/跳过某些 eval 步骤。

**当前进展与验收标准草案（阶段 1：基于现有 planning 模型）**

- prompt 与规划产物：
  - `templates/.ai-tools-chain/prompts/planning.system.md` 已包含 `test_plan` 字段说明：  
    - 要求在 `planning.test_plan` 中给出 `strategy/cases/automation`；  
    - 并强调在信息不足时给出保守占位方案并在 notes 中说明。  
  - 验收：在 `playgrounds/testProject` 中多次执行 `/plan`，观察 `planning.ai.json`：  
    - 大部分情况下应包含 `test_plan` 字段，且至少有非空 `strategy`；  
    - 如模型偶尔缺失该字段，PlanReviewAgent 会打出 `TEST_PLAN_EMPTY` warning（见下文）。

- PlanReviewAgent：
  - 当 `planning.test_plan` 不存在或缺少 `strategy` 字段时：  
    - 在 `plan-review.json.issues` 中新增一条：  
      - `id = "TEST_PLAN_EMPTY"`；  
      - `type = "planning"`；  
      - `severity = "warning"`；  
      - `message` 提醒“建议补充测试策略与关键用例”；  
    - 在 `plan-review.md` 中对应展示该 warning。  

-- TestAgent 与 /eval：
  - `src/agents/testAgent.mjs` 会在调用 `runEvalCore` 之前尝试读取 `planning.ai.json.test_plan`：  
    - 如存在且非空：  
      - 在 REPL 输出中打印一段“规划中的测试计划（test_plan）”摘要，包括 `strategy`、`cases`（逐条列出）和 `automation`；  
      - 然后照常执行 `eval.conf` 中定义的评测步骤。  
    - 如不存在或解析失败：  
      - 不会影响评测执行，仅不输出 test_plan 摘要。  
  - 在 eval 执行完成后：  
    - 基于 `test_plan.cases` 与实际成功的评测步骤名称做简单字符串匹配，给出“粗粒度覆盖提示”（已覆盖/未能映射的用例）；  
    - 将 `test_plan_summary` 附加写入 `eval-report.json`，包含 `total_cases/approx_covered/approx_uncovered/notes`。

-- 最小验收路径：
  1. 在 playground 项目中执行 `/plan`，确认 `planning.ai.json` 中多次出现 `test_plan` 字段；  
  2. 执行 `/planreview`，在 `plan-review.json` 中，如果 `test_plan` 缺失，应看到 `TEST_PLAN_EMPTY` warning；  
  3. 执行 `/eval`，在 REPL 输出中看到“规划中的测试计划（test_plan）”摘要、粗粒度覆盖提示，并且评测步骤正常执行。  

> 后续阶段（可选）：
> - 引入独立 `TestPlanner` Agent，专门负责在 planning 之后补充/修正 `test_plan`；  
> - 将 `test_plan` 与 `eval.conf` 更紧密结合，根据规划的测试策略动态选择或生成评测步骤。

---

## TODO 5：规划扩展字段的落地使用（scope/non_goals/file_impacts/open_questions 等）

**现状检查**

- 在 `planning-schema-and-prompt.md` / `worklog-*` 中已定义：  
  - `scope` / `non_goals` / `design` / `file_impacts` / `test_plan` / `open_questions`；  
- 早期阶段只有 schema 与文档层定义，Agents 尚未系统性消费这些字段；  
- 当前进展（2025-11-16，阶段 1）：  
  - PlanReviewAgent / PlanningMeetingAgent 已在 summary 中展示 scope/non_goals/open_questions；  
  - CodeReviewAgent / ReviewMeetingAgent 已开始消费 `planning.draft_files/file_impacts/non_goals/open_questions`：  
    - 在 review 调用中将 `planning` 作为额外上下文注入模型；  
    - 在 `review.json` 中增加 `planning_context/planning_checks`；  
    - 在 REPL review 输出与 `review.meeting.md` 中展示“可能越界文件”“non_goals 摘要”等；  
  - TestAgent 已与 TODO 4 的 `test_plan` 集成，给出简单覆盖提示，并写入 `eval-report.json.test_plan_summary`。

**目标**

- 让这些扩展字段逐步影响后续行为：PlanReview、CodeReview、Test 等都能用到它们。  
- 在当前阶段，将其视为 **“最佳努力的增强信息（best-effort enhancement）”**：  
  - 模型产出时尽可能利用；  
  - 模型缺失时不得 Gate 掉整个流水线或导致验收失败。

**设计草案**

- PlanReviewAgent：
  - 检查并输出 issue/warning：  
    - `scope` 是否清晰（为空时 warning）；  
    - `non_goals` 是否覆盖典型“不要做什么”；  
    - `open_questions` 非空时，在 `plan-review.md` 中单独列出；  
    - `file_impacts` 与 `draft_files` 是否一致（路径存在/用途合理）。

- CodeReviewAgent / ReviewMeetingAgent：
  - 将 `scope/non_goals/file_impacts` 作为上下文注入 review prompt：  
    - 确保审查时重点关注“规划中承诺要改的文件与范围”；  
    - 在会议纪要中标记“是否有越界/欠账”的情况。  
  - 在 M11 阶段，仅用于增强可见性和提示（out_of_scope files / non_goals 摘要），不 Gate 行为。

- TestAgent：
  - 与 TODO 4 的 `test_plan` 集成：  
    - 输出时明确哪些评测步骤覆盖了 `test_plan.cases`；
    - 对未覆盖的用例给出提示；  
  - `test_plan` 缺失时，只是不展示相关提示，不影响评测执行。

**当前进展与验收标准草案（阶段 1：以可见性和告警为主）**

- PlanReviewAgent：
  - 当前已实现对 `planning.acceptance` 和 `planning.test_plan` 的检查：  
    - 当 `acceptance` 为空时，`plan-review.json.issues` 中包含 `ACCEPTANCE_EMPTY` warning；  
    - 当 `test_plan` 缺失或没有 `strategy` 字段时，包含 `TEST_PLAN_EMPTY` warning。  
  - 后续阶段可按同样模式对 `scope/non_goals/open_questions/file_impacts` 增加更细粒度的提醒。

- PlanningMeetingAgent：
  - 在 `planning.meeting.json.planning_summary` 中，已包含：  
    - `scope`；  
    - `nonGoalsCount`；  
    - `openQuestionsCount`；  
    - 以及原有的 requirements/draft_files/acceptance 数量。  
  - 在 `planning.meeting.md`（无论是 AI 版本还是规则 fallback 版本）中：  
    - 顶部 Summary 区域会额外输出：  
      - `Scope：...`（若存在）；  
      - `Non-goals：...`（若非空），以分号分隔。  

- Review/Meeting（阶段 1 已完成的部分）：  
  - CodeReviewAgent：  
    - 在调用 review 模型时注入 `planning`（scope/non_goals/file_impacts/open_questions 等）作为上下文；  
    - 在 REPL 输出中新增“基于规划的范围检查”，展示规划中的目标文件数量与“可能超出规划范围”的文件列表，以及 non_goals 摘要；  
  - ReviewMeetingAgent：  
    - 在 `review.meeting.json` 中保留 `planning_context/planning_checks`；  
    - 在 `review.meeting.md` 中新增 “Planning Scope & Checks” 一节，列出 scope、non_goals 与可能越界的文件。  

- 最小验收路径（阶段 1）：  
  1. 执行 `/plan` 生成 `planning.ai.json`，并确保其中包含 `scope/non_goals/open_questions`（由 prompt 驱动，允许偶尔缺失）；  
  2. 执行 `/planreview`，在 `plan-review.json` 中看到 `ACCEPTANCE_EMPTY/TEST_PLAN_EMPTY` 等告警（取决于实际规划内容）；  
  3. 执行 `/review`，在 REPL 输出中看到“基于规划的范围检查”，并在 `review.json` 中找到 `planning_context/planning_checks`；  
  4. 查看 `planning.meeting.json` 与 `planning.meeting.md`，确认 scope/non_goals/open_questions 的计数和文案已出现在会议纪要中；  
  5. 查看 `review.meeting.json` 与 `review.meeting.md`，如存在 non_goals 或 out_of_scope files，则在 Planning Scope 区块中得到体现；  
  6. 如模型未产出扩展字段，则上述增强信息允许缺失，整个 pipeline 仍应可用、验收不应因此失败。

---

## TODO 7：Planning 多版本 & 多 Agent 演进（M12 草案）

> 详细设计见：`docs/architecture/planning-evolution-multi-agent-2025-11-16.md`

**目标**

- 同一 Task 可以多次进入规划阶段，形成规划版本 v1/v2/...，历史版本可回溯；  
- 每次规划阶段内部由多个专家角色协作（产品/风险/测试/设计），但对外只有一个 `/plan` 阶段。

> 2025-11-17 进展：已完成阶段 0 的最小“规划报告 + 版本化”支撑：  
> - 在 `tasks/<id>/reports/planning/` 下生成 `v<round>/planning.report.md` 与 `latest/planning.report.md`；  
> - 报告由 PlanningMeetingAgent 基于 `planning.ai.json` + `planning.meeting.json/.md` 汇总产生，作为对用户汇报用的规划输出。  

**阶段 1（结构打底）**

- 在 `tasks/<id>/planning/` 下引入 `versions/` 目录，并在 `/redo planning` 时对当前规划产物做快照：  
  - `planning.ai.json / plan.md / plan-review.json / planning.meeting.json` → `versions/v<round>/...`；  
  - 更新 `state.json.actors.planning.round/last_version`。  
- 2025-11-17：已实现 `/redo planning` 自动快照当前规划产物：  
  - 对 `planning.ai.json/plan.md/plan-review.json/.md/planning.meeting.json/.md/roles/` 以及 `planning.report.md` 做完整复制，存放于 `planning/versions/v<round>/`；  
  - `redoPhase` 在保存快照后，将 `actors.planning.round` 自增，下一次 `/plan` 会从上一版报告 + 新 brief 开始。  
- 文档更新：  
  - 在 `AGENTS-ARCH.md` 与 `pipeline-artifacts-and-contracts.md` 中补充版本存储结构与状态字段说明。

**阶段 2（PlanningAgent 内部 orchestrator）**

- 将 `PlanningAgent` 重构为内部 orchestrator：  
  - 基础 `planning` 调用产生草案；  
  - 按需调用 `test_planner` 等子角色（初期可仍作为同一模型中的 persona 实现）；  
  - 统一在内部合成草案，然后写入 `planning.ai.json` + 调用 OpenSpec/PlanReview/PlanningMeeting。  

**阶段 3（多专家角色逐步拆分）**

- 为 `ProductPlanner/RiskPlanner/TestPlanner/FileImpactPlanner` 等角色设计独立的模型 role 和 prompt；  
- 在 `PlanningAgent` 内按顺序调用这些角色，将它们的输出合并到一个 `planning` 草案对象；  
- 在 `AGENTS-ARCH` 与 `planning-evolution-multi-agent-2025-11-16.md` 中持续更新角色职责与数据流。

**验收建议（每阶段）**

- 阶段 1：  
  - `/redo planning` 前后，`planning/` 下的当前版本与 `versions/vN/` 快照是否一致且可回溯；  
  - 下游 codegen/review 是否始终只看“当前版本”路径。  
- 阶段 2：  
  - 从用户视角看 `/plan` 行为不变，但内部日志中可以看到 orchestrator 多次调用子角色的痕迹；  
  - `planning.ai.json` 的字段质量有明显提升（尤其是 test_plan/scope/non_goals）。  
- 阶段 3：  
  - 可以在 logs/models 中看到多个规划子角色调用记录；  
  - PlanningMeeting/PlanReview 中的内容明显体现多专家视角（而不仅是单一 planning 调用的结果）。

---

## TODO 6：多专家席与会议组织者（ProductPlanner / RiskPlanner / Meeting Chair 强化）

**现状检查**

- 文档中已有专家席草图（`AGENTS-ARCH.md` 7.3 / 7.4），但尚未实现：  
  - `ProductPlanner` / `RiskPlanner` / `DesignAdvisor` / `FileImpactPlanner` / `SecurityReview` 等；  
  - Meeting Chair 仅在设计层存在，代码层只有简单的 `ReviewMeetingAgent`。

**目标**

- 在不破坏现有主线的前提下，引入少量关键专家角色，并准备好扩展空间。

**设计草案（渐进式）**

1. 第一阶段：只在 prompt 层模拟多专家视角  
   - 在现有 `plan_review.system.md` / `review.system.md` 中，通过 persona 的方式增加“产品/风险/测试”等视角，而不增加新的模型角色；  
   - 记录这一设计在文档中，作为“轻量多专家席”的实现路径。

2. 第二阶段：拆出独立专家角色  
   - 选择 1–2 个优先级最高的角色（例如 `RiskPlanner`、`SecurityReview`）；  
   - 新增对应 system prompt 与 `models.conf` role；  
   - 在 PlanReview/CodeReview Agent 中顺序调用多个角色，将输出聚合到 review 结果中。

3. 第三阶段：由 Meeting Chair 汇总  
   - 在 `planning_meeting` / `review_meeting` prompt 中，明确输入为“多个专家席的结构化输出”；  
   - 由 Meeting Chair 模型负责汇总共识/分歧/风险/行动项，形成最终会议纪要。

**当前进展与验收标准草案（阶段 1：仅在 prompt 层模拟多专家席）**

- Prompt 层：
  - `templates/.ai-tools-chain/prompts/plan_review.system.md`：  
    - 已将角色定义为“Plan Review Chair”，并显式引入 ProductPlanner/RiskPlanner/TestPlanner/Design/FileImpactPlanner 等专家 persona；  
    - 要求输出时从“多专家讨论后的统一结论”角度给出 `ok/summary/risks/gaps/suggestions/next_actions`。  
  - `templates/.ai-tools-chain/prompts/review.system.md`：  
    - 已将角色定义为“Code Review Chair”，并引入 Language Specialist/Design Advisor/SecurityReview/TestPlanner 等 persona；  
    - 说明在有 scope/non_goals/test_plan 信息时，应优先关注越界/欠账与测试覆盖。  

- 行为层（PlanReviewAgent/CodeReviewAgent）：  
  - 暂未拆出独立专家角色调用链，仍使用单一 `plan_review`/`review` 调用；  
  - 但通过 prompt 已经鼓励模型在一次调用中“扮演多位专家并汇总结论”。  

- 验收（阶段 1）建议：  
  - 人工观察若干次 `/planreview` 与 `/review` 的 AI 文本：  
    - 是否明显提及 scope/non_goals/test_plan/file_impacts 等概念；  
    - 是否有“从多个角度”审查的痕迹（例如同时关注产品价值、风险、测试）；  
  - 在后续阶段，如果这些 persona 无法稳定被激活，再考虑拆出独立专家角色和专门的 Meeting Chair 汇总逻辑。

---

## TODO 8：Codegen 强协议 + 两阶段 IR 落地（M11 优先）

**现状检查**

- 模型调用 `invokeRole("codegen")` 的原始输出协议较松散：  
  - 可能包含 ``` fenced block；  
  - 可能返回一整段 JSON（含 files 数组，其中 content 才是源码）；  
  - `runCodegenCore` 目前只做了“`.java` 不允许看起来像 XML/pom”的简单检查，其余情况直接写入文件。  
- 已有两阶段雏形：  
  - 阶段 1：将模型输出写入 `codegen.plan.json`（files IR）；  
  - 阶段 2：`runCodegenCore` 基于 IR 落盘 + 生成 `codegen.ir.json/patch.json`；  
  - 但 **强协议与 IR 的结合不够严格**，导致当前出现“整个 JSON 被写入 Java 文件”的坏样本。

**目标**

- 将“强协议 + 两阶段 IR”作为 codegen 的硬契约能力打牢：  
  - 任何偏离约定 schema 的模型输出，不会落盘，只会在 REPL 报“协议错误”；  
  - `.java/.ts/.py/...` 等关键语言文件不得写入明显非源码内容（整段 JSON / fenced code 等）。

**设计草案**

- 协议（模型输出 → IR）：  
  - 定义标准 IR schema（写入 `codegen.plan.json`）：  
    ```json
    {
      "taskId": "...",
      "generated_at": "...",
      "files": [
        {
          "path": "src/Foo.java",
          "language": "java",
          "intent": "brief description",
          "content": "final source code string"
        }
      ]
    }
    ```  
  - 解析模型响应时：  
    - 统一剥离最外层 ``` 包裹（如 ```json / ```java）；  
    - 如响应本身是对象且含 `files[]` 字段，则直接视为 IR；  
    - 如响应只有 `content` 字段，且里面是 JSON 字符串，再解析一层取 files；  
    - 任一层 JSON.parse 失败或出现混杂文本时：  
      - 不写 `codegen.plan.json`；  
      - 抛出错误，由 REPL 打印“codegen 协议错误，请调整提示或模型配置”。  

- IR → 落盘：  
  - 在 `runCodegenCore` 中新增 `normalizeCodegenContent(file)` 步骤：  
    - 保证最终写入的 content 为纯字符串、不含外层 ```；  
    - 对 `.java/.ts/.py` 等关键后缀做轻量检测：  
      - 禁止整段 JSON 或明显非源码结构（例如最外层 `{ "files": ... }`）；  
      - 如命中，则抛错并中止 codegen。  
  - 将正常化后的 IR 落盘，并同时写入：  
    - `codegen.plan.json`（原始 IR + 正常化标记）；  
    - `codegen.ir.json`（供后续 Agent/Review 使用）；  
    - `patch.json` 与 `files/*.full`。

**验收建议**

- 在 playground 中构造两类场景：  
  1. 模型返回“外层 JSON + files[] + content”的典型响应；  
  2. 模型误返回“整段 JSON + fenced block”。  
- 对应行为：  
  - 场景 1：  
    - `codegen.plan.json/files/*.full` 中只出现展开后的源码，不再包含外层 JSON 与 ```；  
    - /review 能对源码做正常 diff 与审查。  
  - 场景 2：  
    - codegen 直接失败，REPL 打印明确的协议错误信息；  
    - 工作区业务文件不被污染。  

---

## 总结：实现顺序建议

实际实现顺序可以根据时间与风险调整，但推荐路线是：

1. 完成 **TODO 8（Codegen 强协议 + 两阶段 IR）**：收紧 codegen 协议与护栏，防止垃圾内容落盘。  
2. 完成 **TODO 1（AcceptAgent/RevertAgent）**：将提交/回滚纳入 Agent + state.json。  
3. 升级 **TODO 2（Orchestrator 策略）**：让 `/next` 能做有理由的推荐。  
4. 推进 **TODO 3（PlanningMeeting/ReviewMeeting AI 化）**：补足会议主持角色。  
5. 按需落地 **TODO 4/5/6/7**：逐步引入 TestPlanner、扩展字段使用、多专家席、多版本规划。  
6. 在此基础上推进 **TODO 9（PlanningMeeting 多角色 verdict 的强利用）**：让多角色 verdict 成为规划决策与 Orchestrator 的一等输入。

实现过程中，如有与本文设计不一致的调整，请先更新本文件和相关架构文档，再修改代码。

---

## TODO 9：PlanningMeeting 多角色 verdict 的“强利用”（M12 起点）

> 关联文档：  
> - `docs/architecture/planning-evolution-multi-agent-2025-11-16.md` 第 10 节  
> - `src/planning/planningMeetingCore.mjs` / `src/agents/planningMeetingAgent.mjs`

**现状检查**

- `planning_meeting` 模型 prompt 中已定义多角色 persona：ProductPlanner/SystemDesigner/SeniorDeveloper/TestPlanner/RiskPlanner/Coach。  
- 模型输出允许包含：  
  - 顶层 `meeting.summary/key_points/risks/open_questions/next_actions/decision`；  
  - 可选扩展：`meeting.per_role_verdicts`、`meeting.options`。  
- `planningMeetingCore` / `PlanningMeetingAgent` 当前行为：  
  - 如果模型输出 `per_role_verdicts/options`，会原样写入 `planning.meeting.json.rounds[0]`；  
  - 同时把各角色 verdict 以 JSON 字符串形式写入 `planning.memory.jsonl`（kind = \"verdict\"）。  
- 但目前这些 verdict 只被“记录”，尚未在决策和提示层形成“强约束”：  
  - 没有 schema 级别校验/默认值；  
  - Coach 的决策仅在 blocking errors / aiMeeting.decision / plan_review.ok 之间选择；  
  - `/plan` 和 `/next` 对 per_role_verdicts 不做任何 gate。

**目标**

- 让多角色 verdict 从“软注释”升级为“决策输入”：  
  1. 通过 schema 和默认值，让 `per_role_verdicts` 结构稳定、可依赖；  
  2. 在规划阶段内部利用这些 verdict 给出更明确的红灯/黄灯提示（软 gate）；  
  3. 为后续将这些 verdict 纳入 Orchestrator 状态机和 `/next` 推荐打基础（强 gate）。

**设计草案**

拆成三步落地：

1. **Step 1：为 planning.meeting.json 定义 zod schema（硬结构）**  
   - 在 `src/core/schemas.mjs` 新增 `PlanningMeetingVerdictSchema`、`PerRoleVerdictsSchema`、`PlanningMeetingRoundSchema`、`PlanningMeetingSchema`：  
     - 每个角色 verdict：  
       - `ok: boolean | null`  
       - `confidence: number 0–1（可选）`  
       - `reasons: string[]`（默认空数组）  
       - `suggestions: string[]`（默认空数组）  
     - `rounds[0]` 中：  
       - `per_role_verdicts` 为可选对象；缺失时视为 `{}`；  
       - `options` 为 `string[]`，默认空数组；  
       - `coach_summary` 为 `string`，默认空字符串；  
       - `decision` 为 `\"go\" | \"hold\" | \"redo_planning\"`。  
   - 在 `buildPlanningMeetingArtifacts` 内部，对生成的 `meetingJson` 调用 schema 进行校验与标准化：  
     - 如果模型输出字段缺失或类型不对，自动归一化到默认结构，而不是把脏值写盘；  
     - 校验失败时回退到“无 per_role_verdicts/options 的最小结构”，但不阻断主流程。  

2. **Step 2：在规划阶段内部做“软 gate + 明确提示”**  
   - 在 `buildPlanningMeetingArtifacts` 中增加一层基于 per_role_verdicts 的 soft gate 逻辑（不改全局 Orchestrator）：  
     - 例如：  
       - 如 `TestPlanner.ok === false`：  
         - 在 `planning.meeting.md` 的 “下一步建议” 中明确写出“测试视角认为当前规划不可测”；  
         - 将 `decision` 倾向设置为 `\"hold\"`，除非存在 blocking errors 需要 `redo_planning`。  
       - 如 `RiskPlanner.ok === false` 且 `confidence >= 0.8`：  
         - 在 meeting md 中追加“高风险”提示；  
         - Coach summary 中突出该风险。  
   - 在 REPL `/plan` 结束时的提示中，增加“按角色的红灯/黄灯摘要”，但仍由用户决定是否继续 `/planreview` / `/codegen`。  

3. **Step 3：将 per_role_verdicts 纳入后续决策（Orchestrator 的预留）**  
   - 本步暂不实现，只写设计方向：  
     - 在 `state.json.actors.planning` 下增加字段：  
       - `last_per_role_verdicts`：最近一轮 round 的 verdict 快照；  
     - `/next` 的推荐逻辑可使用这些 verdict：  
       - 如 `TestPlanner.ok === false`：不推荐直接进入 `/codegen`，而是推荐 `/plan` 或 `/planreview`；  
       - 如 `RiskPlanner.ok === false`：在推荐中注明“风险视角不通过”。  
   - 具体的状态字段和推荐规则将留到 M12/M13 的 Orchestrator 设计中统一处理。

**当前进展与验收标准草案（阶段 1）**

- 代码：  
  - `planning_meeting` prompt 已包含角色定义和 `per_role_verdicts/options` 示例；  
  - `planningMeetingCore` 已能接收并写出 `per_role_verdicts/options`；  
  - `PlanningMeetingAgent` 已将每个角色的 verdict 写入 `planning.memory.jsonl`。  
  - 2025-11-17：在 PlanningMeetingAgent 中增加了一次“基于上一轮简报的复核轮次”（Round 2）：  
    - Round 1：各角色基于当前 planning/plan_review/plan.md 给出初始 verdict；  
    - Coach 汇总 Round 1 verdict，形成简要教练总结；  
    - Round 2：各角色在 payload 中携带 `previous_per_role_verdicts` 与 `coach_summary` 再次评估；  
    - 最终 per_role_verdicts 作为 Round 2 的结果写入 `planning.meeting.json`，Round 1/2 的 verdict 历史写入 `rounds[0].per_role_verdicts_history`。  
  - 2025-11-18：角色 verdict 失败提示优化  
    - 对用户：统一提示“XX 视角暂缺，建议补充XX”，不再输出“未能给出 verdict”字样；  
    - 对内部：在 `planning/logs/planning_meeting_role_issues.log` 中记录详细错误，以便排查模型调用问题。
  - 2025-11-17（澄清小会起点，M12-D）：  
    - 在 verdict schema 中为每个角色新增可选字段 `blocking_open_questions: string[]`，用于标记该角色认为必须向用户澄清的问题；  
    - 在 REPL `/plan` 流程中增加“澄清小会”：  
      - 读取 `planning.meeting.json` 与 `planning.ai.json`，找出角色级 `blocking_open_questions`，若不存在则在决策为 `hold/redo_planning` 且存在 open_questions 时退化为 Coach 级关键问题；  
      - 由敏捷教练以自然语言将这些问题逐条转述给用户，用户自由回答（不限轮次）；  
      - 将问答以 `clarify_question/clarify_answer` 的形式写入 `planning.transcript.jsonl`，包含 `from_role/round/index` 等元信息，供下一轮 `/plan` 作为补充上下文消费。  
  - 2025-11-18：澄清纪要可视化  
    - `planning.meeting.json.rounds[0].clarifications`、`planning.meeting.md` 与 `reports/planning/vN/planning.report.md` 均新增“澄清纪要”段落，展示每条提问/回答以及对应角色；  
    - Coach 对话与澄清小会的问答将自动出现在会议纪要与规划报告中，方便用户回顾历史澄清内容。
- 下一阶段（本 TODO 的第一步）验收建议：  
  1. 为 `planning.meeting.json` 引入 zod schema，并在单元测试中增加：  
     - 模型输出缺少 `per_role_verdicts` 时，文件中该字段为 `{}`；  
     - 模型输出非法 `confidence` 类型时，schema 会归一化为 `null` 或默认值；  
  2. 确认 schema 收紧后，`/plan` → `planning_meeting` 仍能正常生成 meeting 产物，且结构稳定；  
  3. 在 `planningMeeting.test.mjs` 中新增针对 schema 归一化行为的测试用例。  
