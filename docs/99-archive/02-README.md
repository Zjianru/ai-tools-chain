# AI Tools Chain 文档索引（2025-11-15）

| 属性 | 值 |
|------|-----|
| **最后更新** | 2025-11-18 |
| **版本** | v1.0 |
| **状态** | ✅ Current |

---

## 📝 更新历史

- **2025-11-18**: 初稿完成

---

> 目的：把散落的设计/里程碑/协议/交接文档按类别组织起来，方便接手者从“大图 → 阶段 → 细节”逐层阅读。

推荐阅读顺序：
- 先看「概览 & PRD」：了解项目是什么、要解决什么问题；
- 再看「里程碑」：知道现在走到哪一阶段（M0–M11）；
- 然后看「架构 / 协议」：理解 Agents + Orchestrator + Pipeline 的接口与产物；
- 最后根据需要查「Agents/TODO」和「验收脚本/Worklog」等细粒度文档。

---

## 1. 概览 / PRD（overview/）

- `docs/overview/AI-Tools-Chain-项目介绍与设计说明.md`  
  - 项目缘起、愿景、本地优先原则与整体设计说明。
- `docs/overview/ai-tools-chain-PRD-v1.txt`  
  - 初版产品需求文档（PRD v1）。  
- `docs/overview/ai-tools-chain-status-and-integration.md`  
  - 高层状态与集成情况概览（从产品/工程视角看当前进度）。

---

## 2. 里程碑 / 版本演进（milestones/）

- `docs/milestones/ai-tools-chain-milestones-DoD-MVP.md`  
  - M0–M10：MVP 期的里程碑与 DoD；  
  - **M11：Agents + Orchestrator + 协议统一（2025-11-15）**：当前我们这一轮重构的目标/产物/DoD。  
- `docs/milestones/ROADMAP-BACKLOG-2025-11-16.md`  
  - 统一的 Roadmap & Backlog 索引：按里程碑（M0–M13）汇总尚未完成或规划中的能力，以及它们在各子文档中的位置。
- `docs/milestones/ai-tools-chain-refactor-status-2025-11-14.md`  
  - 2025-11-14 重构状态总结，记录从“传统 REPL 流程”到“Agent + 统一协议”的关键转折点。

---

## 3. 架构与协议（architecture/）

- `docs/architecture/AGENTS-ARCH.md`  
  - 任务状态 `state.json`、Agents 架构、Orchestrator、专家席/Meeting Chair 等高层设计。  
- `docs/architecture/planning-schema-and-prompt.md`  
  - `planning.ai.json` schema 与 JSON→OpenSpec 映射规则；  
  - 规划阶段的多轮澄清与 draft_files/test_plan 等字段定义。  
- `docs/architecture/pipeline-artifacts-and-contracts.md`  
  - 各阶段（planning/plan_review/planning_meeting/codegen/review/review_meeting/eval/accept/revert）的产物与 AI 契约清单。

---

## 4. Agents / 交接 / Prompt（agents/）

- `docs/agents/AGENTS-TODO-MIDTERM-2025-11-15.md`  
  - 中期能力 TODO（AcceptAgent/Orchestrator 策略/MeetingAgent/TestPlanner/扩展字段/多专家席），每条都有设计草案和验收标准。  
- `docs/agents/HANDOVER-2025-11-15.md`  
  - 面向下一位贡献者的交接说明：当前状态、已完成工作、Backlog、推荐阅读顺序。  
- `docs/agents/NEXT-ASSISTANT-PROMPT-2025-11-15.md`  
  - 给「下一位 AI 助手」使用的系统 Prompt，可直接复制到新对话作为接力说明。

---

## 5. 质量 / 验收 / 规划细化（quality/）

- `docs/quality/PIPELINE-E2E-ACCEPTANCE-2025-11-15.md`  
  - 端到端验收脚本：从 `/plan` 到 `/revert` 的完整手动测试清单（覆盖产物与状态）。  
- `docs/quality/planning-quality-and-optimization.md`  
  - 围绕规划质量的专项思考与优化方向（metrics、常见问题、如何让 planning 更稳）。

---

## 6. Worklog / 历史记录（worklog/）

- `docs/worklog/worklog-2025-11-13.md`  
- `docs/worklog/worklog-2025-11-14.md`  
  - 日常开发日志与当日思考记录（可作为理解设计决策演变的补充材料）。

---

## 7. 如何维护这套文档体系

- 新增里程碑或阶段时：
  - 在 `docs/milestones/ai-tools-chain-milestones-DoD-MVP.md` 中新增一段 Milestone（M12/M13/...），并将相关详细文档路径写入该段；  
  - 将协议/架构变更优先写入 `architecture/` 下的相应文档，再调整实现。
- 新增或调整 Agent 行为时：
  - 更新 `docs/architecture/AGENTS-ARCH.md` 与 `docs/architecture/pipeline-artifacts-and-contracts.md`；  
  - 在 `docs/agents/AGENTS-TODO-MIDTERM-2025-11-15.md` 中增补 TODO 或标记已完成，并写明验收标准。
- 新的大规模重构或探索：
  - 在 `docs/milestones/` 下新增一份 `ai-tools-chain-refactor-status-YYYY-MM-DD.md` 或使用 worklog 记录背景，避免决策散落在对话中。
