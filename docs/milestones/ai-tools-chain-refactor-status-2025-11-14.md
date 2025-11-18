# AI Tools Chain — REPL / OpenSpec / Pipeline 重构状态（2025-11-14 / 2025-11-15 更新）

> 说明：此文用于交接当前对话窗口中的重构与调试任务，便于后续助手/贡献者在新的会话中继续工作。重点围绕 REPL、OpenSpec 集成、pipeline Gate 与代码结构重构的进展、阻碍与下一步计划。  
> **2025-11-15 更新**：规划阶段已统一使用新的 `planning.ai.json` schema，并初步引入 Agent 化 orchestrator 与会议纪要机制。最新协议与产物清单请同时参考：
> - `docs/architecture/pipeline-artifacts-and-contracts.md`（各阶段产物与 AI 契约总览）
> - `docs/architecture/AGENTS-ARCH.md`（Agents/Orchestrator/专家席设计）

---

## 1. 当前整体状态（高层视图）

- 项目定位：本地优先的 AI 工具链 CLI，目标是在业务项目内提供“规划（OpenSpec） → 强确认 → codegen → 第二视角/审查 → 评测 → 提交/回滚”的可审计闭环。
- 近两轮工作的核心：**把规划阶段彻底改成“官方 openspec CLI + orchestrator”模式，并为这一套流程加上自动化 Gate（pipeline）**，同时开始把巨大的 `bin/ai-tools.mjs` 拆到 `src/core/`。

核心成果：
- 不再自创 `.ai-tools-chain/openspec/spec.yaml` 的独立 DSL，规划完全围绕官方 openspec change/spec 流程。
- `/plan` 逻辑已抽取为 `src/core/planning.mjs` 的纯函数 `runPlanningWithInputs`。
- 任务/配置/归档等基础逻辑已抽到 `src/core/task.mjs`。
- 新增非交互式 pipeline 命令和 e2e 脚本，能自动跑通“规划 + openspec 校验 + demo codegen + Git 提交”的最小场景。
- REPL 的 `/plan` 已经改为“问答 + 调 core 函数”，不再直接写 openspec 文件。

仍存在问题：
- REPL 中 `/codegen` 的确认交互仍有边界 bug：部分情况下用户输入“确认生成”后，会被误判为新命令，出现“未知命令”提示或确认提示重复出现。
- `/codegen`、`/review`、`/eval`、`/accept` 的业务逻辑还在 `bin/ai-tools.mjs` 内部，尚未完全移入 `src/core/`，导致 REPL 的交互状态与核心逻辑纠缠在一起，增加了 bug 概率。

---

## 2. 已完成的具体工作（按模块）

### 2.1 OpenSpec 集成重构

位置：
- `src/core/planning.mjs`
- `bin/ai-tools.mjs` 中 `/plan` 分支与 `pipeline` 命令
- `.ai-tools-chain/openspec/...`（业务项目中）

关键改动：
- 新增 `runPlanningWithInputs({ cwd, aiDir, tasksDir, taskId, metaPath, inputs })`：
  - 在 `.ai-tools-chain/openspec/changes/task-<taskId>/` 下生成/更新：
    - `change.md`（包含 Why / What Changes / Requirements / Targets / Risks / Acceptance）
    - `proposal.md`（最小提案，便于 `openspec show` 工作）
    - `specs/task/spec.md`（包含 `## ADDED Requirements` + `### Requirement: ...` + 包含 SHALL 的正文 + `#### Scenario`）
    - `tasks.md`（最小任务列表）
  - 调用 openspec CLI：
    - `openspec validate --changes --json --no-interactive`  
      → 输出写入 `.ai-tools-chain/tasks/<taskId>/logs/openspec/validate*.{json,log}`。
    - `openspec show --type change task-<taskId>`  
      → 输出写入 `.ai-tools-chain/tasks/<taskId>/plan.md` 和 `show.md.log`。
    - `openspec show --json --type change task-<taskId>`  
      → 尝试写入 `plan.openspec.json` 和 `show.json.log`（失败不阻断）。
  - 更新 `meta.json` 中当前任务的 `status = "plan"`。
- OpenSpec 工作区完全隐藏在 `.ai-tools-chain/openspec/` 下：
  - `openspec` CLI 的 cwd 为 `aiDir`（业务项目根的 `.ai-tools-chain`），官方期望的 `./openspec/...` 实际落在 `.ai-tools-chain/openspec/...`，不再污染业务项目根目录。

REPL 中的 `/plan`：
- 使用 `ask()` 与用户进行交互，收集 `title/why/what/req/targets/risks/accept`。
- 调用 `runPlanningWithInputs`。
- 在成功后提示：`已根据 openspec change 生成 plan：.ai-tools-chain/tasks/<taskId>/plan.md`。

当前效果：
- 在业务项目中执行：
  - `ai-tools init -y` → 初始化 `.ai-tools-chain/`、`.vscode/` 和 `.gitignore`。
  - `ai-tools repl` → `/plan ...` → 规划问答。
  - 然后跑 `openspec validate --changes --json --no-interactive` → 当前 change `valid: true`（已通过官方要求的 deltas/SHALL/Scenario 等规则）。

### 2.2 Task/配置/归档与 `.gitignore` 抽离

位置：
- `src/core/task.mjs`
- `bin/ai-tools.mjs` 的 `init/repl/pipeline` 命令调用

主要函数：
- `readIni(file, defaults)`：统一解析 INI 配置；`toolchain.conf` 读取由此完成。
- `loadMasks(confPath)`：从 `[privacy].mask_patterns` 构建脱敏正则。
- `ensureProjectInited(cwd)`：保证当前目录下存在 `.ai-tools-chain/`；否则输出提示并 `process.exit(1)`。
- `createNewTask(aiDir, cfg)`：
  - 在 `.ai-tools-chain/tasks/` 下创建新 task 目录；
  - 写入 `meta.json`（含 id/created_at/status/model）；
  - 更新 `.ai-tools-chain/.last_task`。
- `autoArchiveOldTasks(aiDir)`：
  - 对 `tasks/<id>` 中 `meta.status` 为 `done`/`redo` 且创建时间超过 7 天的任务：
    - 打包 `logs/` 整目录为 `.ai-tools-chain/archives/<id>.tar.gz`；
    - 删除原 `logs/` 目录。
- `ensureGitignoreHasToolDirs(cwd)`：
  - 若 `.gitignore` 不存在则创建；
  - 确保包含 `.vscode` 和 `.ai-tools-chain` 两项（避免重复）。

应用点：
- `ai-tools init` 中调用 `ensureGitignoreHasToolDirs`，自动在业务项目根的 `.gitignore` 中追加 `.vscode` 和 `.ai-tools-chain`。
- `repl/pipeline` 启动时调用 `autoArchiveOldTasks`，按策略清理旧任务的 logs。

### 2.3 pipeline 命令与 e2e 脚本（Gate）

位置：
- `bin/ai-tools.mjs`：`pipeline` 命令定义
- `playgrounds/scripts/e2e_openspec_pipeline.sh`

`ai-tools pipeline demo-openspec` 行为：
- `ensureProjectInited(cwd)` + `readIni(toolchain.conf)`。
- 使用 `createNewTask` 新建一个 Task（独立于 REPL）。
- 构造固定规划输入：
  - title：`我想为这个项目添加一个 sh 脚本,脚本的作用是,当我运行这个脚本,在终端打印 你好 这句话`
  - why/what/req/targets/risks/accept：全部填 `"测试"`（demo 场景）。
- 调用 `runPlanningWithInputs` 完成规划 + openspec 校验 + plan 落盘。
- demo codegen：
  - `requireGitClean(cwd)`：确保工作区干净（这条约束在 e2e 脚本中通过初始化 commit 解决）。
  - 可选 per-task 分支（按配置）；默认不开启。
  - `git commit --allow-empty` 生成 pre-gen snapshot。
  - 调用 `runCodegen({ aiDir, planText, repoSummary })` 生成 demo proposals。
  - 落 demo 文件、`patch.json`、`files/*.full`，更新 `meta.status = "review"`。
- 简单 review：
  - 使用 `git diff --numstat` 打印 diff 摘要（仅作为信息）。
- 提交 demo 结果：
  - `git add -A`；
  - 尝试 `git commit`：
    - 若有变更 → 正常 commit；
    - 若无变更（demo 情况常见） → 捕获“nothing to commit”消息，打印 `[pipeline] nothing to commit after codegen (demo).`，不视为失败。
  - 更新 `meta.status = "done"`。
- 任何未预料错误 → `[pipeline] FAILED: ...` 并以非零退出码退出；正常执行 → `[pipeline] OK`。

e2e 脚本 `playgrounds/scripts/e2e_openspec_pipeline.sh`：
- 在仓库根：
  - `npm link`（确保 `ai-tools` 指向当前源码）。
  - 在 `playgrounds/e2e-openspec` 下创建全新 Git 仓库。
  - `ai-tools init -y`。
  - 初始化提交（避免 pipeline 认为工作区脏）：
    - `git add -A && git commit -m "chore: init ai-tools-chain for e2e"`。
  - 调用 `ai-tools pipeline demo-openspec`。
- 当前状态：脚本已能稳定输出 `[pipeline] OK`，退出码为 0，可作为 OpenSpec+codegen 的最小 Gate。

---

## 3. 仍存在的阻碍 / Bug

### 3.1 REPL 中 `/codegen` 的确认交互不稳定

现象：
- 在 REPL 中执行 `/codegen` 时，会提示：
  - `将要生成代码并写入工作区。请输入中文强确认短语“确认生成”继续，或回车取消 >`
- 用户输入 `确认生成` 后，有时会被 REPL 误认为是新的命令行，导致：
  - 输出 `未知命令。可用：/plan /review /codegen /eval /quit`；
  - 或出现确认提示反复出现的情况。

目前的修复尝试：
- 引入 `askResolver` 状态：
  - `ask(question)` 设置 `askResolver`，修改 prompt 为 question，然后 `rl.prompt()`；
  - `rl.on("line")` 的开头，如果 `askResolver` 存在，则优先把当前行交给 resolver，**并立即 return**，避免进入命令解析分支。
- `/plan` 和 `/codegen` 的确认都已改成使用 `ask()`。

问题原因：
- 虽然逻辑上应当阻断命令解析，但在某些实际输入/终端行为下，确认行仍然落入了“普通命令”分支（用户反馈：输入“确认生成”后仍然看到“未知命令”提示）。
- 说明 REPL 的状态机与 readline 行为之间还有细节差异，需要更强硬的分层：**把 `/codegen` 的核心逻辑完全从 REPL 里抽掉，只让 REPL 调一个纯函数**。

建议解决思路（留给下一轮）：
- 把 `/codegen` 业务逻辑移到 `src/core/codegen.mjs`：
  - `runCodegenCore(ctx, { confirm: boolean })` 仅返回一个状态结构，不做交互。
- REPL 中的 `/codegen` 分支：
  - 使用 `ask()` 做确认；
  - 收到 `确认生成` 后只调用 `runCodegenCore`，自身不再执行业务逻辑；
  - `rl.on("line")` 中的分支判断也应尽量减少“嵌套异步”，改为显式的“状态枚举”。

### 3.2 `/review` / `/eval` / `/accept` 仍在 CLI 层

现状：
- 这几个命令的核心逻辑（读取 diff、调用 second opinion/review、执行 eval.conf、Gate 与提交）仍然直接写在 `bin/ai-tools.mjs` 中的 REPL 分支里。
- 导致：
  - REPL 的控制流复杂；
  - 很难为这些阶段写非交互式的 pipeline 子步骤或单元测试；
  - 和 `/plan` 一致的“core+cli 分层”尚未完成。

---

## 4. 后续必做（下一轮重构计划）

> 已写入 `docs/worklog-2025-11-14.md` 的「后续必做」部分，这里再强调一次，作为下一位接手者的 TODO。

- 将 `/codegen`、`/review`、`/eval`、`/accept` 的核心逻辑抽取到 `src/core/` 模块：
  - 示例结构：
    - `src/core/codegen.mjs` → `runCodegenCore(ctx)`；
    - `src/core/review.mjs` → `runReviewCore(ctx)`；
    - `src/core/eval.mjs` → `runEvalCore(ctx)`；
    - `src/core/accept.mjs` → `runAcceptCore(ctx, options)`（含 Gate）。
  - 这些函数只负责任务状态流转、文件/Git/模型调用，不包含 readline 和提示文字。
- 在 `src/cli/` 增加 REPL 与 Pipeline 封装：
  - `src/cli/repl.mjs`：`runRepl(cwd)`；
  - `src/cli/pipeline.mjs`：`runPipeline(name, cwd)`；
  - `bin/ai-tools.mjs` 只负责 Commander 命令注册和调用这两个入口。
- 为 pipeline 增加机器可读的结果文件：
  - 例如 `tasks/<taskId>/pipeline-result.json`，记录：
    - `ok: true/false`
    - `stages: [{ name: "planning", ok: true }, { name: "codegen", ok: true }, ...]`
  - 这样 CI/Gate 可以直接解析 JSON，而不用依赖 stdout 文本匹配。

---

## 5. 现在如何进行验收（给接手者的操作指南）

### 5.1 自动化 Gate 验收（推荐先做）

在仓库根目录（`ai-tools-chain`）：

1. 确保使用最新 `ai-tools` CLI：
   - `npm link`
2. 运行 e2e 脚本：
   - `bash playgrounds/scripts/e2e_openspec_pipeline.sh`
3. 期待结果：
   - 控制台出现：
     - `[pipeline] Task ...`
     - `[pipeline] planning (openspec)...` / `planning done.`
     - `[pipeline] codegen (demo)...` / `codegen done.`
     - `[pipeline] diff summary:`（demo 可能是 `(no diff)`）
     - `[pipeline] OK`
   - 脚本退出码为 0。
4. 检查生成的测试项目：
   - 目录：`playgrounds/e2e-openspec`。
   - 验证：
     - `.ai-tools-chain/openspec/changes/task-<id>/` 下有 change.md/proposal.md/specs/task/spec.md/tasks.md。
     - `.ai-tools-chain/tasks/<id>/plan.md` 存在，`logs/openspec/` 中有 validate/show 的日志。

### 5.2 交互式规划验收（AI 参与）

在任意业务项目（例如 `playgrounds/testProject`）：

1. 初始化：
   - `git init`
   - `ai-tools init -y`
2. 确认 DeepSeek 或其它 provider 已在 `models.conf` 中配置好 `planning` 角色（例如 `provider = deepseek`、`api_key_env = "DEEPSEEK_API_KEY"`），并设置好环境变量。
3. 启动 REPL：
   - `ai-tools repl`
4. 输入规划命令：
   - `/plan 我想为这个项目添加一个 sh 脚本,脚本的作用是,当我运行这个脚本,在终端打印 你好 这句话`
   - REPL 会把这段简要需求作为 `userBrief` 交给 `invokeRole("planning")`，由模型输出一个结构化 JSON（写入 `tasks/<TaskID>/planning.ai.json`），其中包含 title/why/what/requirements/targets/risks/acceptance 以及 `draft_files` 等字段。
   - 然后调用 `runPlanningWithInputs` 生成 OpenSpec change/spec，并运行 `openspec validate/show` 生成最终 `plan.md` / `plan.openspec.json`。
5. 验证：
   - `.ai-tools-chain/openspec/changes/task-<TaskID>/change.md/proposal.md/specs/task/spec.md/tasks.md` 存在且内容合理。
   - `.ai-tools-chain/tasks/<TaskID>/plan.md` 已生成；`planning.ai.json` 中包含规划结构和 `draft_files`（如建议的目标文件列表）。
   - 在项目根运行 `openspec validate --changes --json --no-interactive`：
     - 当前 change `valid: true`（无 ERROR）。

### 5.3 REPL 后续阶段的回归检查

在上述同一个 REPL 会话中：

1. 执行 `/codegen`：
   - 按提示输入 `确认生成`；
   - 由 `runCodegenCore` 通过 `invokeRole("codegen")` 调用当前 profile 的 codegen 模型（如 DeepSeek），不再使用本地“占位内容”策略。
   - 如果从 plan 中（或 `plan.files.json`）解析不到目标文件，codegen 会直接失败并提示“未从计划中解析到目标文件”，而不会生成错误文件或默认的 `src/Main.java`。
2. 执行 `/review`：
   - 由 `runReviewCore` 使用 `invokeRole("second_opinion")` 与 `invokeRole("review")`，second-opinion 与 review 模型完全由 `models.conf` 控制（可配置为 Copilot/DeepSeek/OpenAI 的任意组合）。
   - 生成 `second_opinion.md` 与 `review.json`，并在 REPL 中展示摘要。
3. 执行 `/eval`：
   - REPL 中 `/eval` 已挂接到 `runEvalCore`，按 `eval.conf` 中定义的步骤运行 lint/test/promptfoo/ragas 等评测，输出 `eval-report.json`。
4. 执行 `/accept`：
   - 使用 `runAcceptCore` 做评测 Gate + 强确认提交，评测未通过时可根据配置决定是否允许 override。

---

## 6. 总结（给接力者）

- 规划阶段（OpenSpec 集成与 plan.md 生成）的重构已经完成，并引入了 `planning` 模型角色：REPL `/plan` 先将用户简要需求交给 `invokeRole("planning")` 生成结构化规划（写入 `planning.ai.json` 和可选的 `plan.files.json`），再调用 openspec CLI 完成规范化与校验。规划 JSON 的目标 schema 记录在 `docs/architecture/planning-schema-and-prompt.md` 中。
- `.ai-tools-chain/` 的结构（tasks/openspec/promptfoo/logs/archives）已经有了清晰的职责划分。
- `/codegen` / `/review` / `/eval` / `/accept` 的核心逻辑已抽取到 `src/core/codegen.mjs`、`src/core/review.mjs`、`src/core/eval.mjs` 与 `src/core/accept.mjs`，负责 Git 护栏、文件落盘、评测与 Gate；REPL 与 pipeline 通过 `src/cli/repl.mjs`、`src/cli/pipeline.mjs` 作为 UI 层调用这些 core。
- `bin/ai-tools.mjs` 现仅保留 commander 命令注册与 `runRepl(cwd)` / `runPipeline(name, cwd)` 等入口调用，REPL 中 `/codegen` 的确认逻辑与状态流转更清晰，已不再复用旧的嵌套状态机实现。
- `ai-tools pipeline demo-openspec` 在 `.ai-tools-chain/tasks/<taskId>/pipeline-result.json` 中输出机器可读的结果（planning/codegen/commit 三个阶段的状态），`playgrounds/scripts/e2e_openspec_pipeline.sh` 已改为优先检查该 JSON，而非解析 stdout。
- codegen 阶段不再有 `src/Main.java` 之类的“兜底生成”：如果规划中没有给出明确的目标文件列表，或模型无法解析出文件路径，则宁可失败提示，也不会生成错误文件；摘要中对“新增文件”按行数统计，对“修改文件”使用 `git diff --numstat` 统计增删行，并在未来预留对删除文件 (`op=delete`) 的支持（当前尚未在 codegen 阶段生成删除操作，但设计上会在 `patch.json` 支持这一类，摘要中一并统计）。
- 已经初步引入 `PlanningAgent`（`src/agents/planningAgent.mjs`）并在 REPL `/plan` 中使用；整体 Agent 架构和统一状态模型记录在 `docs/architecture/AGENTS-ARCH.md`。当前只规划阶段 Agent 化，其余 Codegen/Review/Test 仍通过 core 函数调用。
- 下一位接力者可以在此基础上继续扩展：为 review/eval 增加更细粒度的日志结构、在 pipeline 中串起完整的 eval/accept Gate，以及补充更多 playground/CI 脚本用例；进一步优化 `planning` 角色的提示词，让规划中自然产出更适合 codegen 的 `draft_files`，并逐步引入 scope/non_goals/design/file_impacts/test_plan/open_questions 等字段丰富规划 JSON，再在 JSON→OpenSpec 映射中按需使用；按 `docs/AGENTS-ARCH.md` 的设计，将 codegen/review/test 也迁移到 Agent 层，为后续图式编排与策略/强化学习打基础。  

—— 2025-11-14 / 2025-11-15 重构与调试工作总结（更新版，含 Agent 化方向）完 ——

---

## 7. 交接附录（2025-11-15）——给下一位助手的提示

### 7.1 当前关键事实（2025-11-15）

- 规划阶段：
  - `planning` 模型角色已接入（DeepSeek 示例在 `models.conf` 中），输出结构记录在 `docs/architecture/planning-schema-and-prompt.md`。
  - `runAIPlanningAndOpenSpec` 和 `applyPlanningAndOpenSpec` 能将 `planning` JSON → `planning.ai.json` / `plan.files.json` → OpenSpec `change/spec/tasks` → `plan.md`，并记录 openspec validate/show 日志。
  - `PlanningAgent`（`src/agents/planningAgent.mjs`）封装了规划逻辑：接受用户 brief，调用 `callPlanningOnce`，落盘规划与 OpenSpec 文本，并返回规划摘要；REPL `/plan` 通过 Agent 调用。

- codegen/review：
  - codegen 通过 `invokeRole("codegen")` 调模型，严格按照 `plan.files.json`/规划 JSON 中的目标文件生成代码，不再有 `src/Main.java` 等兜底文件。
  - `deepseekAdapter` 的 codegen 会剥离 ``` 代码块包裹，并按 `draft_files` 列表生成文件内容。
  - diff 摘要逻辑抽到 `src/domain/diff.mjs`，在 codegen/review 中统一使用：
    - 新增文件：按当前文件内容行数统计新增行数；
    - 修改文件：使用 `git diff --numstat` 统计增删行数；
    - 删除文件：预留了 `op=delete` 占位，未来在 `patch.json` 支持时可扩展。
  - review 阶段会合成“完整本次变更 diff”：`git diff` + 针对 create 的伪 diff（/dev/null→b/path），传入 second_opinion/review 模型，避免“仅新增文件时 diffText 为空”的问题。

- Agent 架构：
  - `docs/architecture/AGENTS-ARCH.md` 定义了统一的任务状态结构（`task_state + artifacts`）、Agent 接口（`step(state, msg) -> { statePatch, logs, actions, questions }`），并规划了 `PlanningAgent / PlanReviewAgent / CodegenAgent / CodeReviewAgent / TestAgent` 等角色。
  - 当前仅实现了 `PlanningAgent`，并在 REPL `/plan` 中使用；其余 Agent 仍为设计阶段。

### 7.2 尚未完成但已设计好的工作

1. （已升级为 P1）Codegen IR 化与执行链路调整：
   - 将当前“模型直接输出文件内容”的 codegen 流程升级为显式 IR 流程：
     - 先由模型产出结构化 IR（如 `codegen.ir.json`：`files[{ path, op, language, intent, regions? }]`），仅描述“要对哪些文件做什么改动”；
     - 再由本地执行器读取 IR，根据 `language/op/intent` 调用模型/模板生成具体代码，写入 `patch.json` 与 `files/*.full`。
   - 目标：
     - 降低类似“所有文件都被写成 pom.xml 内容”这类错误，将模型从“直接落笔”改为“提供意图和草案”，本地逻辑掌控最终写入；
     - 为后续 CodegenAgent / TestAgent 提供统一的、可审计的变更 IR（与 `planning.ai.json` / OpenSpec 映射自然衔接）。
   - 原 plan 中的其它 P1 事项（如 PlanReviewAgent、Codegen/Review/Test Agent 化）顺延至后续阶段，以 IR 化 codegen 为当前最高优先级。

2. 多轮澄清在 REPL 中的完整支持：
   - 现在 `PlanningAgent` 能返回 `questions`（需要澄清），但 REPL 遇到 questions 时会回退到旧的手动 6 问模式。
   - 目标是：REPL 接收 `questions` 后，在同一 session 内向用户逐条提问 → 把回答写入 `planning.transcript.jsonl` 和一个简易 history → 再次调用 Agent 进行下一轮，直到 `status = "ready"` 或达到轮数上限。

3. 规划审查 Agent（PlanReviewAgent）：
   - 用单独的 Agent 审查规划层面（不是代码 diff），输入为 `planning.final.json + plan.md`。
   - 输出风险与建议（例如范围/需求/风险缺口），写入 `plan-review.json`，并决定下一步是“返回规划阶段迭代”还是“用户确认后进入 codegen”。

4. Codegen/Review/Test 的 Agent 化：
   - 将现有 `runCodegenCore / runReviewCore / runEvalCore` 包装到 `CodegenAgent / CodeReviewAgent / TestAgent` 中，实现统一的 Agent 接口；
   - REPL `/codegen` / `/review` / `/eval` 不再直接调用 core 函数，而是调用对应 Agent；orchestrator（CLI 层）只维护 task_state 和展示 logs。

5. 规划 JSON 的扩展字段（schema 丰富）：
   - 在 `docs/architecture/planning-schema-and-prompt.md` 中已经铺陈了 scope/non_goals/design/file_impacts/test_plan/open_questions 等字段，这些目前仅在文档层定义，prompt 和映射尚未启用。
   - 下一步需要在 planning prompt 中加入这些字段约束，并在 JSON→OpenSpec 映射中（仅在字段存在时）把部分字段映射到 plan.md 或提供给 codegen/review/test 作为附加上下文。

6. 删除文件的完整支持：
   - 目前 diff 摘要对 `op=delete` 仅预留了占位，codegen 流程不生成删除操作。
   - 未来需要：在 `patch.json` 支持 delete 项，并在 codegen/review 摘要与合成 diff 中把删除文件/删除行数一并纳入。

7. usage/计费的统一采集与汇总：
   - DeepSeek 的 planning 调用已经记录 `usage` 到 `logs/models/planning.deepseek.<round>.json`，其它角色尚未统一；
   - 后续可以在 codegen/review/test 中同样记录 usage，再在一个汇总脚本/视图中按 provider 的价格表估算 cost，但不建议把具体计费规则硬编码到业务逻辑内。
