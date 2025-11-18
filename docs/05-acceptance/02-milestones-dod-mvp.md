# AI Tools Chain — 里程碑（Milestones）& DoD & MVP 清单

> 说明：本文件基于我们已对齐的 PRD v1 共识，作为落地执行的计划书。包含：里程碑拆解、每个里程碑的完成定义（DoD）、以及 MVP 必做清单。  
> 当前（2025-11-15）已在 MVP 基础上推进了一轮“Agents + Orchestrator + 统一协议”的中期重构，相关设计与验收脚本见：  
> - `docs/architecture/AGENTS-ARCH.md`  
> - `docs/architecture/pipeline-artifacts-and-contracts.md`  
> - `docs/agents/AGENTS-TODO-MIDTERM-2025-11-15.md`  
> - `docs/quality/PIPELINE-E2E-ACCEPTANCE-2025-11-15.md`

---

## 里程碑（Milestones）

### M0｜项目基座与配置约束
**目标**：确定目录与配置规范，跑通配置解析与校验。  
**产物**：`.ai-tools-chain/` 目录结构；`toolchain.conf / eval.conf / plugins.conf` 模板；默认“危险路径/TaskID 格式/分支命名规则/风险分级”。  
**能力**：解析 INI 配置；默认值生效；非法配置报错并给修复建议。

**DoD**
- 读取三类配置并完成 schema 校验（必填项/枚举/路径存在性）。
- 默认集（危险路径、风险级别、最大改动阈值）可覆盖且有单测。
- 生成样例配置与文档（注释解释每个配置项）。

---

### M1｜CLI 基座 & REPL 会话
**目标**：提供终端入口与会话管理。  
**命令**：`ai-tools repl`、`ai-tools task (new|list|open)`。  
**能力**：会话持久化（按配置选择恢复/创建新 Task）；中文**强确认**交给模型判断；信心不足→一律请用户明确确认。  
**资产**：`tasks/<taskid>/transcript.jsonl` 滚动保存。

**DoD**
- REPL 支持 `/plan`、`/review`、`/codegen`、`/eval`、`/quit`。  
- 退出重启后可按配置恢复上次 Task。  
- 强确认仅中文，模型不确定时必须明确确认词才继续。

---

### M2｜Task 有限状态机（draft→plan）
**目标**：跑通 `draft → clarify → plan → pending_confirm`。  
**产物**：`plan.md`（拟改文件列表、要点）、`meta.json`（状态、模型、时间等）。  
**第二意见**：在 **plan** 阶段生成“风险与建议”，存放 `second-opinion/<taskid>/`。

**DoD**
- 进入 **pending_confirm** 前不写任何业务文件。  
- 第二意见日志与 task 日志分目录存储；风险分级（low/medium/high/critical）正确落盘。

---

### M3｜Git 护栏（快照、分支、冲突）
**目标**：写代码前的 Git 安全线。  
**能力**：脏工作区禁止继续；**pre-commit 快照**必做；按配置创建 per-task 分支（可读命名）。  
**冲突策略**：遇到 Git 冲突或**同文件被其他未合并 Task 修改**→停在 **review**，征得同意才继续。

**DoD**
- `pre-gen snapshot` 与 `codegen commit` 使用用户 Git 身份；提交信息包含 TaskID。  
- 脏工作区/无远端/权限异常等场景均能给出清晰提示并中止。

---

### M4｜写入路径（codegen、白名单、二次确认）
**目标**：受控写业务代码并全链路留痕。  
**能力**：生成 `patch.json`（结构化补丁）；应用到**白名单**路径；**删除禁止**（需理由+影响评估+二次确认）；**危险路径**二次确认；**大改动阈值**二次确认。  
**产物**：`diff.patch`、`files/*.full`（改后全文快照）。

**DoD**
- 同一 Task 支持“选择性应用”文件；应用结果一致、可回滚到 pre-commit。  
- 非法路径/删除/超阈值均触发提示并需明确确认。

---

### M5｜Review 展示 & 第二意见（review）
**目标**：让用户看懂并决定是否继续。  
**能力**：在终端展示本次 `git diff` 摘要；标注风险（颜色/符号）；插入第二意见摘要。  
**操作**：允许仅应用部分文件、取消或回滚。

**DoD**
- Review 页面信息完整：变更文件数、行数、危险路径标记、大改动提示、第二意见摘要。  
- 选择性应用能正确更新 `patch.json` 与实际写入结果。

---

### M6｜评测执行器（eval）
**目标**：按 `eval.conf` 执行评测；**手动确认**后再跑。  
**能力**：`lint / test / promptfoo / ragas / custom` 可按块配置开关；空文件=全部开启。  
**依赖缺失**：立即停止并输出“如何安装”的指引（不代安装）。

**DoD**
- 每一步有独立日志与退出码；失败给出**失败环节**与**下一步选择**（继续/放弃/回滚）。  
- 评测报告保存到 `tasks/<taskid>/eval-report.json|html`。

---

### M7｜脱敏、隐私与归档计划
**目标**：所有日志本地存储并做敏感信息掩码；按计划归档。  
**能力**：对匹配 `mask_patterns` 的内容掩码；每日扫描提醒；每 7 天快照打包并清理原始目录。

**DoD**
- 指定的密钥模式被正确掩码（含自定义规则）；归档命名规范；压缩后原目录已清空且保留快照。

---

### M8｜VS Code Tasks & 文档
**目标**：生成可用的 VS Code 任务与最小文档。  
**产物**：`.vscode/tasks.json` 映射 `repl / codegen / eval / maintain`；README（安装、配置、工作流）。

**DoD**
- 从 VS Code 命令面板可直接触发核心流程；用户按文档可完成 E2E。

---

### M9｜插件系统（顺序与短路）
**目标**：最小可用插件机制。  
**能力**：按 `plugins.conf` 定义每个 Hook 的执行顺序；支持“任一插件拒绝即阻断 / 仅警告”的策略。

**DoD**
- 提供示例插件（如 `secret-scan`、`size-limit`）；顺序与短路行为可被单测覆盖。

---

### M10｜打包与初始化体验（MVP 发布）
**目标**：以 npm 包发布；`npx ai-tools init` 初始化隐藏目录与配置模板。  
**能力**：生成 `.ai-tools-chain`、VS Code 任务、模板评测配置；不动业务代码。

**DoD**
- 在一个干净仓库内，一条命令完成初始化；随即可以 `repl → plan → confirm → codegen → review → eval` 走通最小闭环。

---

### M11｜Agents + Orchestrator + 协议统一（2025-11-15）

**目标**：在 MVP 基础上，将规划/生成/审查/评测/提交/回滚阶段 Agent 化，并用统一协议与 Orchestrator 串起来，形成可审计、可编排的本地工作流。

**产物与规范**：
- 协议与架构文档：
  - `docs/architecture/AGENTS-ARCH.md`：描述 Agents 架构、state.json、专家席与 Orchestrator/Meeting Chair。  
  - `docs/architecture/pipeline-artifacts-and-contracts.md`：各阶段产物与 AI 契约清单。  
  - `docs/architecture/planning-schema-and-prompt.md`：planning.ai.json schema 与 JSON→OpenSpec 映射。  
- 中期 TODO 与验收：
  - `docs/agents/AGENTS-TODO-MIDTERM-2025-11-15.md`：P0/P1/P2 Backlog，逐条附设计与验收标准。  
  - `docs/quality/PIPELINE-E2E-ACCEPTANCE-2025-11-15.md`：端到端手动验收脚本（/plan→…→/revert）。
- 交接与 Prompt：
  - `docs/agents/HANDOVER-2025-11-15.md`：当前仓库状态与接力说明；  
  - `docs/agents/NEXT-ASSISTANT-PROMPT-2025-11-15.md`：给下一位 AI 助手的系统 Prompt。

**能力（Agent 化阶段粒度）**：
- Planning 阶段：
  - `PlanningAgent`：多轮澄清 → `planning.ai.json`（新 schema）+ `plan.files.json` + OpenSpec 产物；  
  - `PlanReviewAgent`：结构+OpenSpec + AI 规划审查（plan_review 角色）→ `plan-review.json/.md`；  
  - `PlanningMeetingAgent`：规划会议主持（planning_meeting 角色+规则兜底）→ `planning.meeting.json/.md`。
- Codegen / Review / Meeting / Test：
  - `CodegenAgent`：两阶段 codegen（`codegen.plan.json` + `codegen.ir.json`/`patch.json`/`files/*.full`）；  
  - `CodeReviewAgent`：合成 diffText + second_opinion/review 模型 → `review.json` + `second_opinion.md`；  
  - `ReviewMeetingAgent`：代码审查会议主持（review_meeting 角色+规则兜底）→ `review.meeting.json/.md`；  
  - `TestAgent`：按 `eval.conf` 执行评测，读取 `planning.test_plan` 并输出测试策略摘要 → `eval-report.json`。
- Accept / Revert：
  - `AcceptAgent`：封装 `runAcceptCore`，实现 Gate 判定与提交，两段式 `/accept`（先 Gate，再提交），并更新 `state.json` 与 `meta.json`；  
  - `RevertAgent`：基于 `patch.json` + git 回滚工作区，更新 `state.json.phase = planning` 与 `actors.codegen/revert` 状态。
- Orchestrator：
  - `src/core/orchestrator.mjs`：基于 `state.json` + 关键 artifacts（`plan-review.json`、`eval-report.json`）推荐下一阶段（/next）和支持阶段回退（/redo）；  
  - REPL 接口：`/next`（推荐并可选择自动执行某些阶段）、`/redo <phase>`（仅改状态，不回滚代码）。

**DoD（M11）**
- 文档：
  - `AGENTS-ARCH.md`、`pipeline-artifacts-and-contracts.md` 与实际代码行为一致，且在新增/变更 Agent 时维持同步；  
  - `AGENTS-TODO-MIDTERM-2025-11-15.md` 中 TODO1–TODO6 至少完成第一阶段设计与实现，并有明确验收条目。
- 代码与 REPL：
  - `/plan /planreview /codegen /review /eval /accept /revert /status /next /redo` 全部走 Agent + Orchestrator 流程，不再混用旧协议；  
  - `planning.ai.json` 只使用新 schema；`plan.files.json` 为 codegen 唯一目标文件源；  
  - 端到端流程可按 `PIPELINE-E2E-ACCEPTANCE-2025-11-15.md` 的步骤逐条验收通过。

**参考业界与实验室实践（为后续 M12+ 做铺垫）**

- Workflow / Graph：  
  - 借鉴 LangGraph 等“显式 DAG/状态机 + 工具”的做法，将 `/plan → /codegen → /review → /eval → /accept` 看作固定图，由 Orchestrator 驱动，而非自组织 Agent 群。  
- 自反馈规划（ReAct / Reflexion）：  
  - 规划阶段后续可支持“模型基于上一版规划 + 执行/审查结果生成新版本”的自反馈机制，用于 M12 的多版本规划。  
- 多角色协作框架（AutoGen / CrewAI）：  
  - 保留多专家席（产品/风险/测试/设计/安全）的角色设计，但收束在单入口 Agent 内部，由 Meeting Chair/PlanningOrchestrator 汇总，而不是放开放聊。  
- Task Tree / Scratchpad（Cursor/Copilot Workspace 类）：  
  - 为 `planning.tasks[]` 和后续 codegen/review 的“打勾/补任务”预留空间，让任务树成为跨阶段的真实工作面板。  
- ADR / Design Doc 体系：  
  - 将 `planning/plan.md` 演进为轻量 ADR（背景/决策/备选/风险/后续工作），方便团队协作与审计。

---

## MVP 必做清单（Checklist）

### 交互 & 会话
- [ ] 终端 REPL 与 `/plan /review /codegen /eval /quit` 指令  
- [ ] 中文强确认由模型判断；不确定→提示明确确认  
- [ ] 会话恢复策略：ask|always|never（可配置）

### Task 生命周期与日志
- [ ] FSM：draft→clarify→plan→pending_confirm→codegen→review→eval→done/redo  
- [ ] `tasks/<taskid>/` 产物：`transcript.jsonl / plan.md / patch.json / diff.patch / files/*.full / eval-report* / meta.json`
 - [ ] 通过 CLI 或简单视图提供最小“规划看板 / 状态总览”，基于上述产物展示当前阶段、关键角色 verdict 与最近一轮规划/评测结果

### Git 安全线
- [ ] 脏工作区禁止继续  
- [ ] pre-commit 快照必做  
- [ ] 可选 per-task 分支（可读命名）  
- [ ] 冲突检测与中止确认

### 写入控制
- [ ] 白名单控制（默认允许新增/修改，删除需二次确认）  
- [ ] 危险路径二次确认（默认集可改）  
- [ ] 大改动阈值二次确认（默认 10 文件 / 1000 行，可配）  
- [ ] 生成 `patch.json`、`diff.patch`、全文快照

### 第二意见
- [ ] 在 plan & review 阶段生成与展示  
- [ ] 中高风险需二次确认  
- [ ] 独立目录存储：`second-opinion/<taskid>/`

### 评测（eval）
- [ ] `eval.conf`（空=全开；INI 分块）  
- [ ] 支持 lint/test/promptfoo/ragas/custom；手动确认后执行  
- [ ] 依赖缺失：停止并给安装指引  
- [ ] 逐步日志、退出码、最终报告文件

### 隐私与归档
- [ ] 脱敏规则可配置并默认包含常见密钥模式  
- [ ] 每日扫描提醒（按时区）；每 7 天快照压缩并清理原目录（立即）

### VS Code 与文档
- [ ] 生成 `.vscode/tasks.json`  
- [ ] README（安装、配置、工作流、故障排查）

### 插件机制
- [ ] `plugins.conf` 指定 Hook 顺序与短路策略  
- [ ] 内置示例插件（secret-scan/size-limit）与单测

### 发布
- [ ] npm 包：`npx ai-tools init` 初始化  
- [ ] 版本号与变更日志，禁用遥测
