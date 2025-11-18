# M11 Agents + Orchestrator 验收清单（2025-11-15）

> 目标：在 `playgrounds/testProject` 中走通一条完整流水线，验证 M11 + TODO1–4（Accept/Revert/Orchestrator/Meeting/TestPlan）的第一阶段是否达到预期。  
> 使用方式：按顺序执行命令，每完成一条就在对应的复选框打勾（纸上/工具里均可）。

工作目录：`playgrounds/testProject`

---

## 0. 预备

- [ ] 项目根执行 `npm install`（如需）并确保 `ai-tools` 可用。  
- [ ] `cd playgrounds/testProject`。  
- [ ] 仓库工作区干净（`git status` 无改动）。

---

## 1. /plan：多轮规划 + test_plan

命令：
- [ ] `ai-tools repl` → 选择 `new`，记下 `taskId`。  
- [ ] 在 REPL 输入 `/plan <一句话需求>`，例如“添加一个打印 Hello 的脚本”。

检查（`tasks/<taskId>/`）：
- [ ] 存在 `planning.transcript.jsonl`，包含 brief 和澄清问答。  
- [ ] 存在 `planning.ai.json`，顶层包含：`schema_version/meta/why/what/requirements/targets/risks/acceptance/draft_files/tasks/notes`。  
- [ ] `planning.ai.json` 中多次尝试后通常能看到 `test_plan` 字段，至少有非空 `strategy`。  
- [ ] 存在 `plan.files.json`，结构为 `{ "files": [...] }`，文件列表来自 `planning.draft_files`。  
- [ ] OpenSpec 产物存在：`openspec/changes/task-<taskId>/change.md` 等，以及 `plan.md`。

---

## 2. /planreview：规划审查 + AI 审查

命令：
- [ ] 在 REPL 输入 `/planreview`。

检查：
- [ ] `plan-review.json` 存在，字段包括：`taskId/ok/reasons/issues/summary/openspec`。  
- [ ] 当 acceptance/test_plan 缺失或不完整时，issues 中包含 `ACCEPTANCE_EMPTY` / `TEST_PLAN_EMPTY` 等 warning。  
- [ ] 如已配置 `plan_review` 模型，`plan-review.json` 中存在 `ai_review` 字段（解析失败可为空，但不得影响规则结果）。  
- [ ] `plan-review.md` 展示 gate 结论、openspec 状态和问题列表。

---

## 3. PlanningMeeting：规划会议纪要

（可自动在 /plan 之后触发，也可手动再次 `/plan` 来触发）

检查（`tasks/<taskId>/`）：
- [ ] 存在 `planning.meeting.json`：  
  - [ ] 包含 `planning_summary`，字段包括 `why/what/scope/nonGoalsCount/openQuestionsCount/requirementsCount/draftFilesCount/acceptanceCount`；  
  - [ ] 如 `planning_meeting` 调用成功，包含 `ai_meeting` 字段。  
- [ ] 存在 `planning.meeting.md`：  
  - [ ] 顶部有总结、Scope 与 Non-goals 信息；  
  - [ ] 有“发现的问题/风险”和“下一步建议”段落；  
  - [ ] 如 AI 成功，包含决策（go/hold/redo_planning）描述。

---

## 4. /codegen：两阶段生成 + IR + patch

命令：
- [ ] 在 REPL 输入 `/codegen`，按提示输入“确认生成”。

检查：
- [ ] `plan.files.json.files[]` 中列出的文件在实际 codegen 中是唯一写入目标（可用 `git diff` 对照）；  
- [ ] 存在 `codegen.plan.json`（phase 1 计划）和 `codegen.ir.json`（文件级 IR）；  
- [ ] 存在 `patch.json` 与 `files/<path>.full`（每个改动文件一份 full 快照）。  
- [ ] `state.json` 中：  
  - [ ] `phase` 更新到 `code_review` 或之后；  
  - [ ] `actors.codegen.status = "completed"` 或等价枚举。

---

## 5. /review：代码审查 + 多专家会议

命令：
- [ ] 在 REPL 输入 `/review`。

检查：
- [ ] `review.json` 存在，包含 `ok/summary/risks/suggestions`；  
- [ ] `.ai-tools-chain/second-opinion/<taskId>/second_opinion.md` 存在；  
- [ ] `review.meeting.json` 存在，包含 `summary/risks/suggestions/second_opinion_preview`，如 `review_meeting` 成功则附 `ai_meeting`。  
- [ ] `review.meeting.md`：  
  - [ ] 至少有 Overall Summary/Risks/Suggestions/Second Opinion (Preview) 段落；  
  - [ ] 如 AI 成功，还有 Open Questions/Next Actions/Decision 段落。  
- [ ] REPL 输出中有 diff 摘要 + 第二视角 + 审查摘要，并提示下一步可 `/eval` 或 `/accept`。  
- [ ] `state.json` 中：  
  - [ ] `actors.review.status = "completed"`；  
  - [ ] `actors.review_meeting.status = "completed"`。

---

## 6. /eval：评测 + test_plan 摘要

命令：
- [ ] 在 REPL 输入 `/eval`，按提示输入“开始评测”。

检查：
- [ ] REPL 输出开头有“规划中的测试计划（test_plan）”摘要：  
  - [ ] 显示 strategy；  
  - [ ] 如有 cases，逐条列出；  
  - [ ] 显示 automation 信息。  
- [ ] 评测执行：  
  - [ ] 输出“评测计划”列表（步骤名称 + 命令）；  
  - [ ] 有失败步骤时显示失败步骤名和对应 `eval-<step>.log` 路径；  
  - [ ] 全部通过时打印“评测全部通过”。  
- [ ] 存在 `eval-report.json`，包含 steps/results；  
- [ ] `state.json.phase = "test_run"`，`actors.test.status = "completed" | "failed" | "error"`。

---

## 7. /accept：Gate + 提交（TODO1 验收）

准备两种情况验证 Gate 行为：  
（可以用一个正常 eval 通过的 Task + 一个故意让 eval 失败的 Task）

**7.1 eval 通过场景**

命令：
- [ ] 在 eval 通过的 Task 下执行 `/accept`（第一次）。

检查：
- [ ] REPL 输出“评测 Gate 已通过，可以安全提交。”；  
- [ ] `state.json.actors.accept.status` 为 `gate_passed` 或等价值。

命令：
- [ ] 同一 Task 下再次 `/accept`，按提示输入强确认短语（如需要）+ 提交摘要。

检查：
- [ ] git log 中出现新的 commit（包含当前 `taskId`）；  
- [ ] `meta.json.status = "done"`；  
- [ ] `state.json.actors.accept.status = "committed"` 或等价枚举。

**7.2 eval 失败场景**

准备：
- [ ] 构造一个 eval 会失败的场景（例如修改 eval.conf 或刻意让测试失败）。  
- [ ] 执行 `/eval`，确认 `eval-report.json` 中存在 `status = "failed"` 的步骤。

命令：
- [ ] 在该 Task 下执行 `/accept`。

检查：
- [ ] REPL 输出 Gate 未通过，并显示失败步骤名；  
- [ ] 如 `allowOverride = false`，不会进入提交摘要输入步骤；  
- [ ] 如 `allowOverride = true`，在未输入正确 override 短语前不会提交。

---

## 8. /revert：回滚（TODO1 验收）

命令：
- [ ] 在有 codegen 改动的 Task 中执行 `/revert`，输入 `YES` 确认。

检查：
- [ ] `patch.json.items[op="create"]` 中的文件从工作区被删除；  
- [ ] 其他改动通过 git restore/clean 回滚，`git diff` 显示无差异；  
- [ ] `meta.json.status = "redo"`；  
- [ ] `state.json` 中：  
  - [ ] `phase = "planning"`；  
  - [ ] `actors.codegen.status = "redo"`；  
  - [ ] `actors.revert.status = "completed"`。

命令：
- [ ] 重复 `/revert`，但这次不输入 `YES`。

检查：
- [ ] 工作区无新增变化；  
- [ ] `meta.json` 与 `state.json` 未发生变化。

---

## 9. Orchestrator /next & pipeline agents（可选补充）

**9.1 REPL `/next`**

- [ ] 在 `phase = plan_review` 时执行 `/next`：  
  - 当 `plan-review.json.ok = false` 时，应推荐阶段为 `planning`，reason 为 `plan_review_not_ok`。  
- [ ] 在 `/eval` 后执行 `/next`：  
  - eval 失败时推荐 `accept`，reason 为 `eval_failed_needs_gate`，并提示通过 `/accept` 继续；  
  - eval 通过时推荐 `accept`，reason 为 `eval_passed_ready_for_accept`。

**9.2 非交互 pipeline**

- [ ] 在 playground 项目根执行：`ai-tools pipeline agents`。  
- [ ] 确认输出日志中出现 orchestrator 推荐阶段信息；  
- [ ] 如未开启 `pipeline.auto_accept`，pipeline 应在 test 阶段结束，而不会自动提交。

