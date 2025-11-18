# AI Tools Chain — 端到端验收脚本（2025-11-15）

> 目的：给维护者和“下一位助手”一套可重复的手动验收流程，覆盖 planning → plan_review → planning_meeting → codegen → review → review_meeting → eval → accept → revert 的主要 Agent 行为与产物。

以下步骤假设在 `playgrounds/testProject/` 中执行，并已安装本项目 CLI（`ai-tools`）。

---

## 1. 初始化与 /plan

1. 进入 playground：
   - `cd playgrounds/testProject`
2. 启动 REPL（创建新 task）：
   - `ai-tools repl` → 选择 `new`。
3. 执行 `/plan`，输入一个简单需求（例如“添加一个打印 Hello 的脚本”）。

验收要点：
- `.ai-tools-chain/tasks/<taskId>/` 下存在：
  - `planning.transcript.jsonl`（包含 brief 和澄清问答）；
  - `planning.ai.json`（新 schema，包含 `schema_version/meta/why/what/requirements/targets/risks/acceptance/draft_files/tasks/notes/test_plan?`）；
  - `plan.files.json`（仅来自 planning.draft_files）；  
  - `plan.md` 和 OpenSpec 产物。  
- `planning.ai.json.test_plan` 在多数情况下存在，至少包含 `strategy` 字段。

---

## 2. /planreview 与规划会议

1. 在同一个 REPL 会话中执行 `/planreview`（或观察 `/plan` 自动触发的 PlanReview）。

验收要点（PlanReviewAgent）：
- `plan-review.json`：
  - `ok/reasons/issues/summary/openspec` 字段齐全；
  - 当 acceptance/test_plan 缺失时，存在 `ACCEPTANCE_EMPTY/TEST_PLAN_EMPTY` 等 warning；  
  - 若 `plan_review` 模型配置正确且调用成功，存在 `ai_review` 字段。
- `plan-review.md`：
  - 展示 gate 结论、openspec 状态与问题列表。

2. 规划会议纪要（PlanningMeetingAgent）：
   - 自动或手动触发后，检查：
     - `planning.meeting.json`：  
       - 包含 `planning_summary`（含 scope/nonGoalsCount/openQuestionsCount 等）；  
       - 如调用 `planning_meeting` 成功，包含 `ai_meeting` 字段。  
     - `planning.meeting.md`：  
       - 至少包含：总结、Scope/Non-goals、问题/风险、下一步建议；  
       - AI 成功时还有决策（go/hold/redo_planning）等内容。

---

## 3. /codegen 与 codegen 产物

1. 在 REPL 中执行 `/codegen`：
   - 按提示输入“确认生成”。

验收要点（CodegenAgent）：
- `.ai-tools-chain/tasks/<taskId>/` 下存在：
  - `codegen.plan.json`（phase 1 计划）；
  - `codegen.ir.json`（文件级 IR）；  
  - `patch.json`（记录本次变更的 items）；  
  - `files/<path>.full`（变更文件的完整快照）。  
- 工作区代码实际发生变更（结合 `git diff` 查看）。
- `state.json` 中：
  - `phase` 更新为 `code_review`；  
  - `actors.codegen.status` 为 `completed` 或等价值。

---

## 4. /review 与审查会议

1. 在 REPL 中执行 `/review`。

验收要点（CodeReviewAgent + ReviewMeetingAgent）：
- `.ai-tools-chain/tasks/<taskId>/` 下存在：
  - `review.json`：包含 `ok/summary/risks/suggestions`；  
  - `review.meeting.json`：包含 `summary/risks/suggestions/second_opinion_preview`，如调用 `review_meeting` 成功，则附带 `ai_meeting`。  
  - `review.meeting.md`：  
    - 至少包含 Overall Summary/Risks/Suggestions/Second Opinion (Preview)；  
    - AI 成功时还有 Open Questions/Next Actions/Decision 段落。  
- REPL 输出中：
  - 有 diff 摘要（变更文件数、增删行数、危险路径标记）；  
  - 有 second_opinion 与 review 摘要；  
  - 末尾提示下一步可 `/eval` 或 `/accept`。
- `state.json` 中：
  - `phase` 为 `code_review_meeting` 或之后；  
  - `actors.review.status = "completed"`，`actors.review_meeting.status = "completed"`。

---

## 5. /eval 与测试计划

1. 在 REPL 中执行 `/eval`：
   - 按提示输入“开始评测”。

验收要点（TestAgent）：
- REPL 输出开头：
  - 若 `planning.ai.json.test_plan` 存在，打印“规划中的测试计划（test_plan）”摘要，包含 strategy/cases/automation。  
- 评测执行：
  - 显示评测计划（步骤名称 + 命令）；  
  - 若有失败步骤，展示第一个失败步骤名与 log 路径；  
  - 所有步骤通过时打印“评测全部通过”；  
  - `eval-report.json` 存在（包含 steps/results）。  
- `state.json` 中：
  - `phase = "test_run"`；  
  - `actors.test.status = "completed" | "failed" | "error"`。

---

## 6. /accept 与 Gate + 提交

1. 在 REPL 中执行 `/accept`：
   - 第一次调用不带 commit message，仅做 Gate 判定。

验收要点（AcceptAgent）：
- Gate 判定：
  - 若 `eval-report.json` 所有步骤通过：  
    - 输出“评测 Gate 已通过，可以安全提交。”；  
    - `actors.accept.status` 变为 `gate_passed` 或等价值。  
  - 若存在失败步骤：  
    - 输出失败步骤名；  
    - 若 `allowOverride = false`，不会进入提交流程；  
    - 若 `allowOverride = true`，提示用户输入强确认短语（默认“确认合入”）。  
- 提交：
  - 正确输入强确认短语后，系统询问提交摘要，并调用 AcceptAgent 完成 git 提交；  
  - 验证：
    - `git log` 中出现新 commit；  
    - `meta.json.status = "done"`；  
    - `state.json.actors.accept.status = "committed"` 或等价值。

---

## 7. /revert 与回滚

1. 在 codegen 后执行 `/revert`：
   - 按提示输入 `YES`。

验收要点（RevertAgent）：
- 工作区：
  - `patch.json.items[op="create"]` 中列出的文件被删除；  
  - 其余变更通过 git restore/clean 回滚，`git diff` 显示无差异。  
- 元数据：
  - `meta.json.status = "redo"`；  
  - `state.json.phase = "planning"`；  
  - `actors.codegen.status = "redo"`；  
  - `actors.revert.status = "completed"`。  
- 若未输入 `YES` 即退出：
  - 工作区与上述元数据均不应发生变化。

---

## 8. 与 TODO/文档的一致性检查

在完成一轮端到端验收后，可对照以下文档确认协议是否一致：

- `docs/AGENTS-ARCH.md`：Agents 架构与 state.json 说明；  
- `docs/pipeline-artifacts-and-contracts.md`：各阶段产物与 AI 契约；  
- `docs/AGENTS-TODO-MIDTERM-2025-11-15.md`：中期能力 TODO 与当前进展/验收标准；  
- `docs/NEXT-ASSISTANT-PROMPT-2025-11-15.md`：给下一位助手的系统 Prompt。

