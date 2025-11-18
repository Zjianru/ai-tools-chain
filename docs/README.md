# AI Tools Chain 文档中心 📚

> **欢迎来到 AI Tools Chain 项目文档库**  
> 这里汇集了项目的所有设计文档、实现指南、验收标准和工作日志。  
> 就像一本书一样，你可以从"目录"开始，逐层深入了解项目。

**最后更新**：2025-11-18  
**文档版本**：v1.0  
**维护者**：@user

---

## 📖 目录导航

### 快速导航（推荐阅读路径）

| 我想... | 查看文档 |
|--------|---------|
| 🚀 **快速了解项目** | [项目介绍](#01-项目概览) → [架构设计](#02-架构设计) |
| 🛠️ **实现功能或修复** | [规划实现](#03-规划实现) → [Agent 设计](#04-agents-与-交接) |
| ✅ **验收与测试** | [验收标准](#05-验收标准) → [工作日志](#07-工作日志) |
| 📚 **接手项目** | [项目介绍](#01-项目概览) → [交接文档](./04-agents/03-handover.md) → [系统 Prompt](./04-agents/04-next-assistant-prompt.md) |

---

## 01 项目概览

这一部分涵盖了项目的基础信息：是什么、为什么、怎么做。

| 文件 | 说明 |
|------|------|
| **[01-AI-Tools-Chain-项目介绍与设计说明.md](./01-overview/01-AI-Tools-Chain-项目介绍与设计说明.md)** | 项目缘起、愿景、核心特性与整体设计原则 |
| **[02-ai-tools-chain-PRD-v1.txt](./01-overview/02-ai-tools-chain-PRD-v1.txt)** | 初版产品需求文档（PRD）与功能清单 |
| **[03-ai-tools-chain-status-and-integration.md](./01-overview/03-ai-tools-chain-status-and-integration.md)** | 项目当前状态、集成情况、待办清单 |

**关键概念**：本地优先、Git 护栏、OpenSpec 驱动、可审计流程

---

## 02 架构设计

这一部分详细描述了系统架构、各个组件之间的交互、以及关键的设计决策。

### 2.1 核心架构

| 文件 | 说明 | 更新日期 |
|------|------|---------|
| **[02-AGENTS-ARCH.md](./02-architecture/02-AGENTS-ARCH.md)** | Agents 架构、状态管理、Orchestrator 设计 | 2025-11-18 |
| **[11-pipeline-artifacts-and-contracts.md](./02-architecture/11-pipeline-artifacts-and-contracts.md)** | 各阶段产物定义、AI 契约、数据流 | 2025-11-18 |
| **[14-planning-schema-and-prompt.md](./02-architecture/14-planning-schema-and-prompt.md)** | 规划 JSON Schema、字段定义、提示词模板 | 2025-11-18 |

### 2.2 规划工作坊设计 ⭐ 最新

规划阶段是整个系统的核心。这些文档详细描述了多轮讨论、澄清会、共识模型等机制。

| 文件 | 说明 | 更新日期 |
|------|------|---------|
| **[06-planning-final-decisions.md](./02-architecture/06-planning-final-decisions.md)** ⭐ | **11 个最终设计决策**（快速路径、共识提炼、硬性门槛、5 个新 Invoke Roles） | 2025-11-18 |
| **[01-planning-design-summary.md](./02-architecture/01-planning-design-summary.md)** | 规划设计总结与决策演进 | 2025-11-18 |
| **[09-planning-workshop-consensus-model.md](./02-architecture/09-planning-workshop-consensus-model.md)** | 多角色共识模型与工作坊流程 | 2025-11-18 |
| **[03-planning-clarification-meeting.md](./02-architecture/03-planning-clarification-meeting.md)** | 澄清小会（clarification meeting）的设计 | 2025-11-18 |
| **[10-planning-workshop-design.md](./02-architecture/10-planning-workshop-design.md)** | 工作坊总体设计与参与者角色 | 2025-11-17 |
| **[13-planning-multi-agent-roles-io.md](./02-architecture/13-planning-multi-agent-roles-io.md)** | 5 个角色的 I/O 规范 (ProductPlanner, SystemDesigner, SeniorDev, TestPlanner, RiskPlanner) | 2025-11-17 |
| **[12-planning-evolution-multi-agent.md](./02-architecture/12-planning-evolution-multi-agent.md)** | 多 Agent 架构的演进与思考 | 2025-11-16 |

### 2.3 设计过程与思考

| 文件 | 说明 | 更新日期 |
|------|------|---------|
| **[04-planning-design-decisions.md](./02-architecture/04-planning-design-decisions.md)** | 规划设计过程中的关键决策 | 2025-11-18 |
| **[05-planning-design-questions.md](./02-architecture/05-planning-design-questions.md)** | 设计过程中的开放问题与思考 | 2025-11-18 |
| **[07-planning-journey-validation.md](./02-architecture/07-planning-journey-validation.md)** | 用户旅程验证 | 2025-11-18 |
| **[08-planning-stage-user-journey.md](./02-architecture/08-planning-stage-user-journey.md)** | 规划阶段详细的用户旅程 | 2025-11-18 |

### 2.4 端到端验收

| 文件 | 说明 | 更新日期 |
|------|------|---------|
| **[15-pipeline-e2e-acceptance.md](./02-architecture/15-pipeline-e2e-acceptance.md)** | 从 `/plan` 到 `/revert` 的完整验收脚本 | 2025-11-15 |

---

## 03 规划实现

这一部分专注于规划阶段的**实现细节**，包括快速上手指南、字段扩展、质量优化等。

| 文件 | 说明 | 更新日期 |
|------|------|---------|
| **[01-planning-implementation-quick-reference.md](./03-planning/01-planning-implementation-quick-reference.md)** ⭐ | **实现快速参考**（Round 快速路径、小会流程、共识提炼、产物生成） | 2025-11-18 |
| **[02-planning-fields-review-test-acceptance.md](./03-planning/02-planning-fields-review-test-acceptance.md)** | M11-3 规划字段扩展与验收 | 2025-11-16 |
| **[03-planning-workshop-acceptance.md](./03-planning/03-planning-workshop-acceptance.md)** | M12 规划工作坊进阶设计 | 2025-11-17 |
| **[04-planning-quality-and-optimization.md](./03-planning/04-planning-quality-and-optimization.md)** | 规划质量、Metrics、常见问题 | 2025-11-18 |

---

## 04 Agents 与交接

这一部分涵盖了 Agent 设计、实现检查项、交接文档，以及系统 Prompt 供下一位接手者使用。

| 文件 | 说明 | 更新日期 |
|------|------|---------|
| **[01-agents-orchestrator-checklist.md](./04-agents/01-agents-orchestrator-checklist.md)** | M11 Agents + Orchestrator 验收清单 | 2025-11-15 |
| **[02-agents-todo-midterm.md](./04-agents/02-agents-todo-midterm.md)** | 中期能力 TODO（每条附设计草案） | 2025-11-15 |
| **[03-handover.md](./04-agents/03-handover.md)** | 📜 **交接文档**（当前状态、已完成、Backlog、推荐阅读顺序） | 2025-11-15 |
| **[04-next-assistant-prompt.md](./04-agents/04-next-assistant-prompt.md)** | 🤖 **下一位 AI 助手的系统 Prompt**（可直接复制使用） | 2025-11-15 |

---

## 05 验收标准

这一部分定义了项目的验收标准、测试矩阵、DoD（Definition of Done）。

| 文件 | 说明 | 更新日期 |
|------|------|---------|
| **[01-acceptance.md](./05-acceptance/01-acceptance.md)** | M11 全量验收脚本（完整的检查项清单） | 2025-11-16 |
| **[02-milestones-dod-mvp.md](./05-acceptance/02-milestones-dod-mvp.md)** | M0–M11 里程碑与 DoD | 2025-11-15 |

---

## 06 试验场（Playgrounds）

项目包含完整的测试项目用于演示和验证。

| 位置 | 说明 |
|------|------|
| `playgrounds/testProject/` | 完整的测试项目，用于 `/plan → /codegen → /review → /eval` 验证 |
| `playgrounds/scripts/` | 管理脚本（如 `reset_playground.sh`） |

**快速开始**：
```bash
cd playgrounds/testProject
ai-tools repl
```

---

## 07 工作日志

这一部分记录了项目的开发进程、每日工作内容和路线图。

| 文件 | 说明 | 日期 |
|------|------|------|
| **[04-worklog-2025-11-18.md](./07-worklog/04-worklog-2025-11-18.md)** | 最新工作日志（11 个设计决策、7 份规划文档、完整成果总结） | 2025-11-18 |
| **[03-worklog-2025-11-14.md](./07-worklog/03-worklog-2025-11-14.md)** | 工作日志 | 2025-11-14 |
| **[02-worklog-2025-11-13.md](./07-worklog/02-worklog-2025-11-13.md)** | 工作日志 | 2025-11-13 |
| **[01-roadmap-backlog.md](./07-worklog/01-roadmap-backlog.md)** | 统一的 Roadmap & Backlog 索引 | 2025-11-16 |

---

## 08 里程碑

这一部分记录了项目的版本演进与重要里程碑。

| 文件 | 说明 | 更新日期 |
|------|------|---------|
| **[01-refactor-status.md](./08-milestones/01-refactor-status.md)** | 重构状态总结与关键转折点 | 2025-11-14 |

---

## 99 归档

已归档的参考文档和早期版本。

| 文件 | 说明 |
|------|------|
| **[01-project-documentation-map.md](./99-archive/01-project-documentation-map.md)** | 项目文档完整地图（早期版本） |
| **[02-README.md](./99-archive/02-README.md)** | 文档索引备份 |
| **[03-delivery-summary.md](./99-archive/03-delivery-summary.md)** | 交付总结 |

---

## 🔗 重要链接与交叉引用

### 新手必读
1. **起点**：[项目介绍](./01-overview/01-AI-Tools-Chain-项目介绍与设计说明.md)
2. **然后**：[架构设计 - 核心概念](./02-architecture/02-AGENTS-ARCH.md)
3. **最后**：[规划实现 - 快速参考](./03-planning/01-planning-implementation-quick-reference.md)

### 接手项目的必读
1. **交接文档**：[03-handover.md](./04-agents/03-handover.md)
2. **系统 Prompt**：[04-next-assistant-prompt.md](./04-agents/04-next-assistant-prompt.md)
3. **工作日志**：[最新的工作日志](./07-worklog/04-worklog-2025-11-18.md)

### 设计决策相关
- **核心决策**（必读）：[06-planning-final-decisions.md](./02-architecture/06-planning-final-decisions.md)
- **验收标准**：[05 验收标准](#05-验收标准)

### 实现相关
- **快速参考**：[01-planning-implementation-quick-reference.md](./03-planning/01-planning-implementation-quick-reference.md)
- **字段定义**：[14-planning-schema-and-prompt.md](./02-architecture/14-planning-schema-and-prompt.md)
- **质量保证**：[04-planning-quality-and-optimization.md](./03-planning/04-planning-quality-and-optimization.md)

---

## 📚 使用本文档的建议

### 按角色查找

**产品/需求方**：
- [项目介绍](./01-overview/01-AI-Tools-Chain-项目介绍与设计说明.md)
- [规划设计](./02-architecture/09-planning-workshop-consensus-model.md)

**系统设计/架构师**：
- [架构设计](./02-architecture/02-AGENTS-ARCH.md)
- [数据流与契约](./02-architecture/11-pipeline-artifacts-and-contracts.md)

**开发工程师**：
- [规划实现](./03-planning/01-planning-implementation-quick-reference.md)
- [字段定义与 Schema](./02-architecture/14-planning-schema-and-prompt.md)
- [验收清单](./05-acceptance/01-acceptance.md)

**测试/QA**：
- [验收标准](./05-acceptance/01-acceptance.md)
- [端到端验收脚本](./02-architecture/15-pipeline-e2e-acceptance.md)

**项目接手者**：
- [交接文档](./04-agents/03-handover.md)
- [系统 Prompt](./04-agents/04-next-assistant-prompt.md)
- [最新工作日志](./07-worklog/04-worklog-2025-11-18.md)

### 按需求查找

| 我需要... | 参考文档 |
|---------|---------|
| 理解项目整体概念 | [01 项目概览](#01-项目概览) |
| 了解系统架构 | [02 架构设计](#02-架构设计) |
| 实现规划功能 | [03 规划实现](#03-规划实现) |
| Agent 相关的设计 | [04 Agents](#04-agents-与-交接) |
| 测试/验证项目 | [05 验收标准](#05-验收标准) |
| 追踪项目进度 | [07 工作日志](#07-工作日志) |
| 查看历史版本 | [99 归档](#99-归档) |

---

## 📝 文档维护指南

### 新增或更新文档时

1. **保持命名规范**：使用 `NN-kebab-case-filename.md` 格式
   - `NN` 是序号（01-99）
   - `kebab-case` 是小写+连字符格式
   - 不要在文件名中包含日期

2. **添加头部元数据**：在文件开头按以下格式添加
   ```markdown
   # 文档标题
   
   | 属性 | 值 |
   |------|-----|
   | **最后更新** | YYYY-MM-DD |
   | **版本** | v1.0 |
   | **状态** | ✅ Current |
   
   ---
   
   ## 📝 更新历史
   
   - **YYYY-MM-DD**: 描述变更
   
   ---
   ```

3. **更新本 README.md**：如果是新增文档，请在适当的章节添加条目

4. **添加交叉引用**：在相关文档中用 `See also: [链接](路径)` 相互引用

### 文件夹分类

| 序号 | 文件夹 | 用途 |
|------|--------|------|
| 01 | `01-overview/` | 项目介绍、PRD、状态 |
| 02 | `02-architecture/` | 架构设计、设计决策、工作坊 |
| 03 | `03-planning/` | 规划实现、字段扩展、质量 |
| 04 | `04-agents/` | Agent 设计、交接、Prompt |
| 05 | `05-acceptance/` | 验收标准、DoD、里程碑 |
| 06 | `06-playgrounds/` | （预留）试验场说明 |
| 07 | `07-worklog/` | 工作日志、Roadmap |
| 08 | `08-milestones/` | 里程碑、版本演进 |
| 99 | `99-archive/` | 归档的参考文档 |

---

## 🎯 下一步

- [ ] 阅读[项目介绍](./01-overview/01-AI-Tools-Chain-项目介绍与设计说明.md)了解项目背景
- [ ] 查看[架构设计](./02-architecture/02-AGENTS-ARCH.md)理解系统设计
- [ ] 参考[规划实现](./03-planning/01-planning-implementation-quick-reference.md)快速上手
- [ ] 浏览[工作日志](./07-worklog/04-worklog-2025-11-18.md)追踪项目进度

---

**祝你在阅读本文档库时收获满满！** 📖✨

如有任何疑问或需要补充内容，欢迎提出建议。
