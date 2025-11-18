# AI Tools Chain — Pipeline Artifacts & AI Contracts (Draft)

| 属性 | 值 |
|------|-----|
| **最后更新** | 2025-11-18 |
| **版本** | v1.0 |
| **状态** | ✅ Current |

---

## 📝 更新历史

- **2025-11-18**: 初稿完成

---

> 说明：关于规划阶段（/plan）的人机交互、规划工作坊行为与澄清策略，  
> 如本文件与 `PLANNING-WORKSHOP-DESIGN-2025-11-17.md` 存在不一致，以后者为准。  
> 目的：为后续开发者和“对接手册”提供统一的参照，明确在各个阶段（planning / plan_review / codegen / review）：
> - 期望的产物（artifacts）有哪些、放在哪里；
> - 给 AI 的输入是什么、期望 AI 输出什么结构；
> - 这些产物在后续阶段如何被消费。

当前约定只针对 **新协议**：规划阶段统一使用 `planning.ai.json` 的 schema（见 `docs/planning-schema-and-prompt.md`），不再支持旧的 `plan.*` 结构；规划阶段在体验上被视作一次“规划工作坊”，由敏捷教练协调多角色协作完成，而不是简单的单轮问答。

---

## 1. Planning 阶段（/plan + PlanningAgent）

### 1.1 人类交互与输入

- REPL 命令：`/plan <brief?>`
  - `brief`：一两句话的任务描述，可直接写在命令后面，也可由 REPL 提示输入；也可以是上一版规划报告 + 用户补充意见的组合。
- 澄清策略：
  - 规划阶段优先由内部角色（Product/System/SeniorDev/Test/Risk 等）基于常识、仓库上下文与已有文档自行补齐信息，并在 `assumptions[]/open_questions[]` 中记录疑点；  
  - 只有当某个问题被标记为 blocking 且无法合理假设时，由敏捷教练发起“用户 + 对应角色 + 教练”的澄清小会，使用自然语言往返，不再通过固定的多轮问卷式澄清；  
  - 如存在上一版规划报告（`reports/planning/latest/planning.report.md`），系统会在调用 planning 模型前将其以 `[PREVIOUS_PLANNING_REPORT] ...` 附加在 brief 之后，方便 Workshop 对比新旧方案。

### 1.2 主要产物（artifacts）

位于 `tasks/<taskId>/planning/`：

- `planning.transcript.jsonl`
  - 结构：每行一个 JSON，对话记录。
  - 当前使用的 `kind` 类型：
    - `"brief"`：用户的任务描述。
    - （历史兼容）`"clarify_question"`/`"clarify_answer"`：早期多轮澄清问答记录，当前策略中仅作为回放/调试用途。
- `planning.ai.json`
  - 结构：符合 `docs/planning-schema-and-prompt.md` 中定义的新 schema：
    ```json
    {
      "schema_version": 1,
      "meta": { "id": "task-...", "title": "...", "risk": "medium", "owner": "@you" },
      "why": "...",
      "what": "...",
      "requirements": [...],
      "targets": [...],
      "risks": [...],
      "acceptance": [...],
      "draft_files": ["src/...", "pom.xml"],
      "tasks": [...],
      "notes": "...",
      "test_plan": { "strategy": "...", "cases": ["..."], "automation": "..." },
      "scope": ["..."],
      "non_goals": ["..."],
      "open_questions": ["..."],
      "assumptions": ["..."]
    }
    ```
  - 产出方式：由 PlanningAgent 在调用 planning 模型后，直接写入磁盘。
- （可选）`planning.draft.json`
  - 用途：当前规划草案快照，仅供调试或未来多版本规划使用；  
  - 当前版本中，下游阶段不依赖此文件，主要由 PlanningAgent 在规划 ready 时写入一份冗余副本。
- `plan.files.json`
  - 结构：
    ```json
    { "files": ["src/...", "pom.xml"] }
    ```
  - 来源：`planning.draft_files`，由 `applyPlanningAndOpenSpec` 写入。
  - 用途：codegen 阶段作为目标文件列表。
- OpenSpec 相关产物（在 `.ai-tools-chain/openspec/changes/task-<taskId>/`）：
  - `change.md / proposal.md / specs/task/spec.md / tasks.md`
  - 日志：`tasks/<taskId>/logs/openspec/{validate.json, show.md.log}`。
- `plan.md`
  - 位于 `tasks/<taskId>/planning/plan.md`；  
  - 由 `planning.ai.json` + OpenSpec change 信息生成的人类可读规划摘要（包含 Why/What/Requirements/Draft Files/Scope/Non-goals/Risks/Acceptance/Test Plan/Open Questions 等），并在末尾附加原始 OpenSpec change 视图作为参考。

- `planning/versions/v<round>/`
  - `/redo planning` 时自动创建，用于存储上一版规划的快照；  
  - 包含：`planning.ai.json`、`plan.md`、`plan-review.json/.md`、`planning.meeting.json/.md`、`roles/`（如存在）、以及当轮的 `planning.report.md` 等关键产物；  
  - 目录名 `<round>` 等于当时 `state.json.actors.planning.round` 的值，便于回溯 v1/v2/v3。

位于 `tasks/<taskId>/reports/planning/`：

- `v<round>/planning.report.md`
  - 由 PlanningMeetingAgent 在规划会议结束后生成的面向用户的规划报告；  
  - 基于当前版本的 `planning.ai.json` 与 `planning.meeting.json/.md` 汇总：包括教练总结/决策、scope/non_goals、关键假设（assumptions）、未决问题（open_questions）、测试计划摘要与各角色结论概要。  
- `latest/planning.report.md`
  - 始终代表当前版本的规划报告，内容与最近一版 `v<round>/planning.report.md` 一致，便于用户或下游工具引用“最新规划”。

### 1.3 给 AI 的输入（planning 角色）

- 系统 prompt：` .ai-tools-chain/prompts/planning.system.md`
  - 约定：
    - 严格输出 `{ planning }` JSON；
    - `planning` 必须符合新 schema，包含 `schema_version` 和必要字段（why/what/requirements/targets/risks/acceptance/draft_files/test_plan/scope/non_goals/open_questions/assumptions 等）；  
    - 不允许输出 Markdown 代码块和额外自然语言说明。
- 用户侧 payload（代码层）：
  - `userBrief`：来自 REPL 的 brief（可以包含上一版规划报告片段）。  
  - `repoSummary`：简单的仓库文件列表（通过 `git ls-files` 采样）。  
  - `history`：由 `planning.transcript.jsonl` 构建的简要历史（包括之前的 brief 和重要澄清对话摘要）。  
- 期望 AI 输出：
  ```json
  {
    "planning": { /* 新 schema planning 对象，含 test_plan/scope/non_goals/open_questions/assumptions 等 */ }
  }
  ```

---

## 2. Plan Review 阶段（/planreview + PlanReviewAgent）

### 2.1 主要产物

- 输入：
  - `planning.ai.json`（规划结果）。
  - `plan.md`（OpenSpec show 生成的计划）。
  - `logs/openspec/validate.json`（OpenSpec 校验结果）。
- 输出（位于 `tasks/<taskId>/`）：
  - `plan-review.json`
    ```json
    {
      "taskId": "...",
      "ok": true | false,
      "reasons": ["阻塞性问题..."],
      "issues": [
        { "id": "REQ_EMPTY", "type": "planning", "severity": "warning", "message": "..." },
        { "id": "DRAFT_FILES_EMPTY", "type": "planning", "severity": "warning", "message": "..." }
      ],
      "summary": {
        "title": "...",
        "why": "...",
        "what": "...",
        "requirementsCount": 1,
        "draftFilesCount": 3,
        "targets": ["src/...", "scripts/..."],
        "risksCount": 1,
        "acceptanceCount": 2
      },
      "openspec": {
        "ok": true,
        "errors": [],
        "warnings": []
      }
    }
    ```
  - `plan-review.md`
    - 人类可读版审查结果（结论 + openspec 状态 + 问题列表）。

### 2.2 AI 交互（plan_review 角色）

- PlanReviewAgent 主要基于结构与 openspec 做规则检查，并将结果写入 `plan-review.json/.md`：  
  - 检查 `planning.ai.json` 是否存在；  
  - 检查 `plan.md` 是否为空；  
  - 检查 openspec errors/warnings；  
  - 检查 `requirements / draft_files / acceptance / test_plan` 等是否为空（为空时增加 warning）。  
- 可选：调用 `plan_review` 模型角色，获取更细粒度的 AI 规划审查意见：
  - 系统 prompt：`prompts/plan_review.system.md`（Plan Review Chair，多专家 persona）。  
  - payload：
    ```json
    {
      "planningText": "<planning.ai.json 文本>",
      "planText": "<plan.md 内容>",
      "issues": [ /* 结构+openspec 层发现的问题列表 */ ]
    }
    ```
  - 期望输出：
    ```json
    {
      "ok": true,
      "summary": "一两句话的总体评价",
      "risks": ["风险 1", "风险 2"],
      "gaps": ["规划中缺失的点 1", "缺失的点 2"],
      "suggestions": ["建议 1", "建议 2"],
      "next_actions": ["建议下一步行动 1", "建议下一步行动 2"]
    }
    ```
  - PlanReviewAgent 会在解析成功时，将该结果附加到 `plan-review.json.ai_review` 字段中。

---

## 3. Codegen 阶段（/codegen + CodegenAgent + runCodegenCore）

### 3.1 主要产物

位于 `tasks/<taskId>/`：

- 输入：
  - `plan.md`：规划阶段生成。
  - `plan.files.json`：`planning.draft_files` 映射生成。
  - `planning.ai.json`：可作为额外上下文（当前 codegen 核心使用 planText 为主）。
- 模型调用计划（phase 1 / IR）：
  - `codegen.plan.json`：
    ```json
    {
      "taskId": "...",
      "generated_at": "...",
      "files": [
        { "path": "src/...", "content": "...", "rationale": "...", "intent": "..." }
      ]
    }
    ```
  - `logs/models/codegen.invoke.json`：
    ```json
    {
      "role": "codegen",
      "created_at": "...",
      "files_from_plan": ["src/...", "pom.xml"],
      "ok": true,
      "error": null
    }
    ```
- 实际执行结果（phase 2）：
  - 工作区代码文件（在业务项目目录内修改/新增）。
  - `files/<path>.full`：每个生成/修改文件的完整快照。
  - `patch.json`：
    ```json
    {
      "taskId": "...",
      "generated_at": "...",
      "items": [
        { "path": "src/...", "op": "create|modify", "size": 123, "hash": "..." }
      ]
    }
    ```
  - `codegen.ir.json`：
    ```json
    {
      "taskId": "...",
      "generated_at": "...",
      "files": [
        { "path": "src/...", "op": "create", "language": "java", "intent": "..." }
      ]
    }
    ```

### 3.2 给 AI 的输入（codegen 角色）

- 系统 prompt：`.ai-tools-chain/prompts/codegen.system.md`
  - 要求：
    - 严格输出 `{ "files": [ { "path", "language", "content", "intent?" }, ... ] }` JSON；
    - 禁止输出 Markdown 代码块和多余说明。
- 用户侧 payload（代码层）：
  - `planText`：`plan.md` 内容；
  - `repoSummary`：可选的仓库概览（当前默认是一句占位字符串）；
  - `files`: 目标文件列表，来自 `plan.files.json.files[]`。
- 期望 AI 输出：
  ```json
  {
    "files": [
      {
        "path": "src/...",
        "language": "java | xml | yaml | text | ...",
        "content": "完整文件内容",
        "intent": "该文件的意图/用途说明（可选）"
      }
    ]
  }
  ```

---

## 4. Review 阶段（/review + CodeReviewAgent + ReviewMeetingAgent）

### 4.1 主要产物

- 输入：
  - 当前 Git diff（包含代码变更）；
  - `patch.json` + `files/*.full`（用于生成新增文件的伪 diff）；
  - `plan.md`（给 second_opinion 作为上下文）。
- `runReviewCore` 输出：
  - second opinion：
    - 路径：`.ai-tools-chain/second-opinion/<taskId>/second_opinion.md`
    - 内容：second_opinion 模型给出的高层次意见。
  - review 结果：
    - 路径：`tasks/<taskId>/review.json`
    - 结构（示例）：
      ```json
      {
        "ok": true,
        "summary": "总体评价 ...",
        "risks": ["..."],
        "suggestions": ["..."]
      }
      ```
- CodeReviewAgent 的附加输出：
  - REPL 中打印的变更摘要与 AI 摘要（不单独落盘）。
  - `review.meeting.json` / `review.meeting.md`（由 ReviewMeetingAgent 生成）：
    - 汇总 `review.json` 和 `second_opinion.md`，给出“代码审查会议纪要”。

### 4.2 给 AI 的输入（second_opinion / review 角色）

- second_opinion：
  - 系统 prompt：`prompts/second_opinion.system.md`
  - payload：
    ```json
    {
      "planText": "<plan.md 内容>",
      "diffText": "<完整 diff，包括新增文件伪 diff>"
    }
    ```
  - 期望输出：
    ```json
    { "ok": true, "verdict": "ok|warn|block", "notes": "自然语言高层次意见" }
    ```
- review：
  - 系统 prompt：`prompts/review.system.md`
  - payload：
    ```json
    { "diffText": "<完整 diff，包括新增文件伪 diff>" }
    ```
  - 期望输出：
    ```json
    {
      "ok": true,
      "summary": "总体评价 ...",
      "risks": ["风险 1", "风险 2"],
      "suggestions": ["建议 1", "建议 2"]
    }
    ```

---

## 5. 清单汇总（按阶段）

### Planning（/plan）

- 期望产物：
  - `planning.transcript.jsonl`
  - `planning.ai.json`（新 schema）
  - `planning.draft.json`
  - `plan.files.json`
  - `plan.md` + OpenSpec 相关文件与日志
- 模型契约：
  - 角色：`planning`
  - 输入：`userBrief + repoSummary + history`
  - 输出：`{status, questions, planning(schema_version=1, ...)}`

### Plan Review（/planreview 或 /plan 自动触发）

- 期望产物：
  - `plan-review.json`（gate + issues + summary + openspec）
  - `plan-review.md`（人类可读）
- 模型契约：
  - 当前无模型调用，仅规则检查。

### Codegen（/codegen）

- 期望产物：
  - `codegen.plan.json`（IR 计划）
  - `logs/models/codegen.invoke.json`
  - 工作区代码文件
  - `files/*.full`
  - `patch.json`
  - `codegen.ir.json`
- 模型契约：
  - 角色：`codegen`
  - 输入：`planText + repoSummary + files[]`
  - 输出：`{files: [{path, language, content, intent?}, ...]}`

### Review（/review）

- 期望产物：
  - `.ai-tools-chain/second-opinion/<taskId>/second_opinion.md`
  - `review.json`
  - `review.meeting.json` / `review.meeting.md`
- 模型契约：
  - 角色：`second_opinion`
    - 输入：`planText + diffText`
    - 输出：`{ok, verdict, notes}`
  - 角色：`review`
    - 输入：`diffText`
    - 输出：`{ok, summary, risks[], suggestions[]}`

---

此文档作为“协议与产物清单”的起点，后续如果引入新的阶段（例如 plan_review 模型、test 相关模型）或扩展现有 schema，应同步更新本文件，并确保：

- Prompt（`prompts/*.system.md`）与这里的契约一致；
- core/Agent 层代码仅依赖本文档约定的字段，而不再使用临时/历史字段； 
- 任何兼容逻辑（如旧 schema）都收敛在单独的迁移工具或一次性脚本中，而不混入主路径。 
