# AI Tools Chain - 项目文档导航与待办清单

**最后更新**：2025-11-18  
**项目状态**：M11（代理+编排器完成中）→ M12（多版本规划）  
**规划阶段设计**：✅ 已最终确认（11 个关键决策）

---

## 📋 目录导航

### 一、顶层战略文档

#### 📌 项目现状与路线图
- **`docs/milestones/ROADMAP-BACKLOG-2025-11-16.md`** ⭐⭐⭐
  - **内容**：M11 到 M13+ 的完整里程碑规划
  - **关键信息**：
    - M11（当前）：Agent 完成、编排器细化、规划字段深入
    - M12：多版本规划、OpenSpec 深度集成、Promptfoo 解析
    - M13+：可视化、高级编排
  - **行动**：作为总目标参考，导航下面的所有工作

- **`docs/milestones/ai-tools-chain-milestones-DoD-MVP.md`**
  - **内容**：MVP 完成标准定义
  - **用途**：定义"什么时候算完成"

- **`docs/milestones/ai-tools-chain-refactor-status-2025-11-14.md`**
  - **内容**：重构进度状态（较旧，需更新）
  - **状态**：⚠️ 需要同步到最新决策

#### 📌 架构概述
- **`docs/overview/AI-Tools-Chain-项目介绍与设计说明.md`**
  - **内容**：项目的整体愿景与设计哲学
  - **关键概念**：多 agent 管道、安全栏杆、可审计性

---

### 二、规划阶段设计（本周重点）

#### ✅ 已最终确认的设计文档

| 文档 | 关键内容 | 优先级 | 状态 |
|------|--------|-------|------|
| **`PLANNING-FINAL-DECISIONS-2025-11-18.md`** ⭐ | 11 个最终决策总结 | P0 | ✅ 完成 |
| **`PLANNING-CLARIFICATION-MEETING-2025-11-18.md`** ⭐ | 小会的两阶段 invoke 设计 | P0 | ✅ 完成 |
| **`PLANNING-DESIGN-DECISIONS-2025-11-18.md`** ⭐ | 7 大关键决策记录 | P0 | ✅ 完成 |
| **`PLANNING-WORKSHOP-CONSENSUS-MODEL-2025-11-18.md`** | 多轮共识渐进模型 | P1 | ✅ 完成 |
| **`PLANNING-STAGE-USER-JOURNEY-2025-11-18.md`** | 用户完整旅程体验 | P1 | ⚠️ 待更新 |
| **`PLANNING-JOURNEY-VALIDATION-2025-11-18.md`** | 57 个用户旅程问题的实现验证 | P2 | ⚠️ 待更新 |

#### 🔄 待更新的旧设计文档

- **`PLANNING-DESIGN-QUESTIONS-2025-11-18.md`**
  - **当前状态**：列举的 19 个问题中，13 个已被最新决策解答
  - **行动**：标记哪些已解答，哪些需要后续讨论

- **`PLANNING-WORKSHOP-DESIGN-2025-11-17.md`**
  - **当前状态**：可能与最新的"快速路径+共识提炼"模型有冲突
  - **行动**：审查并更新

---

### 三、架构与实现设计

#### 📌 Agent 相关
- **`docs/architecture/AGENTS-ARCH.md`**
  - **内容**：5 个规划角色的详细定义
  - **覆盖**：ProductPlanner, SystemDesigner, SeniorDeveloper, TestPlanner, RiskPlanner
  - **状态**：✅ 基本完成，但需与最新决策同步

- **`docs/agents/AGENTS-TODO-MIDTERM-2025-11-15.md`**
  - **内容**：Agent 实现的中期 TODO
  - **关键任务**：AcceptAgent 完成、Orchestrator 策略细化
  - **状态**：需要同步最新的规划决策

#### 📌 流程与契约
- **`docs/architecture/pipeline-artifacts-and-contracts.md`**
  - **内容**：各阶段产物的格式与契约
  - **关键内容**：
    - 规划产物的输入/输出契约
    - Codegen 对规划产物的依赖
  - **状态**：⚠️ 需要根据"规划案 JSON vs 规划草案 Markdown"更新

#### 📌 多轮规划演进
- **`planning-evolution-multi-agent-2025-11-16.md`**
  - **内容**：规划多轮演进的机制
  - **状态**：可能需要与"快速路径"设计对齐

- **`planning-multi-agent-roles-io-2025-11-17.md`**
  - **内容**：各角色的输入/输出协议
  - **状态**：✅ 基本准确，但需补充"Round 3 的精确输入结构"

- **`planning-schema-and-prompt.md`**
  - **内容**：规划的数据结构与 prompt 设计
  - **状态**：需要更新以支持"共识提炼"

---

### 四、验收与质量

#### 📌 M11 验收标准
- **`docs/acceptance/M11-ALL-ACCEPTANCE-2025-11-16.md`** ⭐
  - **内容**：M11 阶段的完整验收清单
  - **关键部分**：
    - Planning Agent 验收标准
    - Planning Meeting Agent 验收标准
    - Orchestrator 验收标准
  - **状态**：需要根据本周的设计决策更新

- **`docs/acceptance/M11-3-planning-fields-review-test-acceptance-2025-11-16.md`**
  - **内容**：规划字段在 Review/Test 阶段的应用
  - **状态**：基本完整

- **`docs/acceptance/M11-agents-orchestrator-checklist-2025-11-15.md`**
  - **内容**：Agent + Orchestrator 的完成检查表
  - **状态**：需要更新

#### 📌 M12 计划
- **`docs/acceptance/M12-planning-workshop-acceptance-2025-11-17.md`**
  - **内容**：M12 规划工作坊的验收标准
  - **状态**：基本框架，待补充细节

#### 📌 质量与优化
- **`docs/quality/PIPELINE-E2E-ACCEPTANCE-2025-11-15.md`**
  - **内容**：E2E 流程的验收标准
  - **状态**：需要补充规划阶段的新增逻辑

- **`docs/quality/planning-quality-and-optimization.md`**
  - **内容**：规划质量指标与优化方向
  - **状态**：可参考

---

### 五、工作日志

- **`docs/worklog/worklog-2025-11-13.md`** 
- **`docs/worklog/worklog-2025-11-14.md`**

**当前缺失**：2025-11-18 的工作日志（本周设计讨论的总结）

---

## 🎯 M11-3 实现待办清单

**里程碑**：M11-3（规划阶段 Phase 1）  
**目标**：实现"快速路径 + 小会澄清 + 共识提炼 + 产物分化"的完整规划流程  
**预计时间**：2025-11-20 ~ 2025-12-05  
**验收标准**：`M11-ALL-ACCEPTANCE-2025-11-16.md` 的规划部分

### 高优先级（必做）

#### Task 1：快速路径与共识提炼核心逻辑
- [ ] 修改 `planningMeetingAgent.mjs`：Round 1 全同意时跳过 Round 2/3
- [ ] 新增 `consensusSynthesis.mjs`：实现共识提炼 invoke 逻辑
- [ ] 修改 `planningMeetingCore.mjs`：所有产物生成前调用共识提炼
- [ ] 新增 `src/core/schemas.mjs`：ConsensusSchema 和产物类型定义
- **验收**：单元测试覆盖快速路径和共识提炼两条路径

#### Task 2：小会澄清的两阶段 Invoke
- [ ] 新增 `clarificationMeeting.mjs`：小会核心逻辑
- [ ] 实现 `planning_clarify_review` invoke：AI 二次判断
- [ ] 实现 `planning_clarify_ask` invoke：AI 最终提问
- [ ] 修改 `plan.mjs`：集成新的小会流程
- [ ] 实现用户可见的"思考过程"打印
- **验收**：集成测试，确保 AI 能避免冗余问题

#### Task 3：产物格式的严格区分
- [ ] 修改 `planningMeetingCore.mjs`：分别生成 JSON（规划案）和 Markdown（规划草案）
- [ ] 实现规划案的 JSON 序列化：包含 consensus_snapshot
- [ ] 实现规划草案的 Markdown 生成：清晰标记异议
- [ ] 添加产物类型标记到 metadata
- **验收**：手工测试，确认两种产物的格式和内容正确

#### Task 4：规划案 / 草案的硬性门槛
- [ ] 在共识提炼后添加判断逻辑：0 异议 → 规划案；任何异议 → 规划草案
- [ ] 修改 `codegenAgent.mjs`：检查产物类型，草案时显示警告
- [ ] 实现 Draft gate：用户必须显式确认后才能进入 Codegen
- [ ] 记录用户的确认信息到日志
- **验收**：单元测试 + 集成测试

#### Task 5：models.conf 新增角色配置
- [ ] 在 `.ai-tools-chain/config/models.conf` 中注册 5 个新 role：
  - `planning_clarify_review`
  - `planning_clarify_ask`
  - `planning_consensus_synthesis`
  - `planning_intent_check`
  - `planning_review_revision` (确认已有)
- **验收**：doctor 命令能检测到所有 role

#### Task 6：单元测试与集成测试
- [ ] 编写 `test/planningPhase1.test.mjs`，覆盖：
  - 快速路径（Round 1 全同意）
  - 完整路径（Round 1→2→小会→3）
  - 共识提炼的三种输出（全同意/保留/反对）
  - 小会中 AI 避免冗余问题
  - 产物格式的正确性
- **验收**：所有测试通过，覆盖率 > 80%

#### Task 7：文档更新与验收
- [ ] 更新 `PLANNING-STAGE-USER-JOURNEY-2025-11-18.md`：体现最新决策
- [ ] 更新 `PLANNING-JOURNEY-VALIDATION-2025-11-18.md`：重新评估 57 个问题的状态
- [ ] 更新 `docs/acceptance/M11-ALL-ACCEPTANCE-2025-11-16.md`：规划部分的验收标准
- [ ] 生成本周的 `docs/worklog/worklog-2025-11-18.md`
- **验收**：所有文档与代码实现保持同步

### 中优先级（Phase 2 - M12）

#### Task 8：用户意图判断
- [ ] 新增 `intentCheck.mjs`：实现 `planning_intent_check` invoke
- [ ] 集成到 `planningAgent.mjs`：新输入时首先进行意图判断
- [ ] 根据 intent 决定是否加载旧规划作为背景

#### Task 9：版本管理与 UI
- [ ] 实现版本查询接口
- [ ] 实现版本对比功能
- [ ] 实现版本回滚功能

#### Task 10：Codegen 的 Draft Gate 强化
- [ ] 详细的异议展示
- [ ] 用户确认对话的改进
- [ ] 完整的风险追溯链

### 低优先级（Phase 3+）

- [ ] 人类专家介入机制
- [ ] 规划案质量评分
- [ ] 规划→任务可视化映射

---

## 📊 文档整理归档

### 需要归档到 `_archive/` 的旧文档

以下文档因有更新的版本而可以归档：

- [ ] `PLANNING-DESIGN-QUESTIONS-2025-11-18.md` 
  → 已由 `PLANNING-FINAL-DECISIONS-2025-11-18.md` 取代

- [ ] `PLANNING-WORKSHOP-DESIGN-2025-11-17.md`
  → 已由 `PLANNING-WORKSHOP-CONSENSUS-MODEL-2025-11-18.md` 取代

- [ ] `planning-evolution-multi-agent-2025-11-16.md`
  → 内容已整合到最新设计文档中

### 需要保留但标记为"历史参考"的文档

- [ ] `planning-schema-and-prompt.md`
  - 标记：⚠️ 需要同步最新 payload 结构
  
- [ ] `docs/agents/HANDOVER-2025-11-15.md`
  - 标记：⚠️ 旧交接文档，仅作历史参考

- [ ] `docs/agents/NEXT-ASSISTANT-PROMPT-2025-11-15.md`
  - 标记：⚠️ 旧 prompt 建议，已被最新设计取代

---

## 🗂️ 推荐的文档组织结构

```
docs/
├─ README.md ⭐
│  └─ 新增：快速导航索引 + M11/M12/M13 概览
│
├─ architecture/ ⭐ (核心设计文档)
│  ├─ PLANNING-FINAL-DECISIONS-2025-11-18.md ⭐⭐⭐
│  ├─ PLANNING-CLARIFICATION-MEETING-2025-11-18.md
│  ├─ PLANNING-WORKSHOP-CONSENSUS-MODEL-2025-11-18.md
│  ├─ PLANNING-STAGE-USER-JOURNEY-2025-11-18.md
│  ├─ AGENTS-ARCH.md
│  ├─ pipeline-artifacts-and-contracts.md
│  ├─ planning-multi-agent-roles-io-2025-11-17.md
│  └─ _archived/
│     ├─ PLANNING-DESIGN-QUESTIONS-2025-11-18.md
│     └─ PLANNING-WORKSHOP-DESIGN-2025-11-17.md
│
├─ milestones/ ⭐ (路线图与里程碑)
│  ├─ ROADMAP-BACKLOG-2025-11-16.md ⭐
│  ├─ ai-tools-chain-milestones-DoD-MVP.md
│  └─ M11-M12-M13-IMPLEMENTATION-PLAN.md (新，待创建)
│
├─ acceptance/ ⭐ (验收标准)
│  ├─ M11-ALL-ACCEPTANCE-2025-11-16.md ⭐ (需更新)
│  ├─ M11-3-planning-fields-review-test-acceptance-2025-11-16.md
│  └─ M12-planning-workshop-acceptance-2025-11-17.md
│
├─ quality/
│  ├─ PIPELINE-E2E-ACCEPTANCE-2025-11-15.md
│  └─ planning-quality-and-optimization.md
│
├─ worklog/ (工作日志)
│  ├─ worklog-2025-11-13.md
│  ├─ worklog-2025-11-14.md
│  └─ worklog-2025-11-18.md (新)
│
└─ overview/
   └─ AI-Tools-Chain-项目介绍与设计说明.md
```

---

## ✅ 后续行动

### 立即执行（今天）

1. **生成 M11-3 实现计划**
   - 文件：`docs/milestones/M11-3-IMPLEMENTATION-PLAN-2025-11-18.md`
   - 内容：上面"M11-3 实现待办清单"的详细版
   - 包含：任务分解、代码文件、测试覆盖、验收标准

2. **更新 docs/README.md**
   - 添加"快速导航"section，指向最新的规划设计文档
   - 添加"当前里程碑"summary

3. **整理并归档旧文档**
   - 创建 `docs/architecture/_archived/` 目录
   - 移动已过时的设计文档

### 短期执行（本周）

4. **生成 worklog-2025-11-18.md**
   - 总结本周的规划设计讨论
   - 记录 11 个最终决策

5. **验证与同步**
   - 确保所有文档与新决策保持一致
   - 特别是 `PLANNING-STAGE-USER-JOURNEY-2025-11-18.md` 和 `PLANNING-JOURNEY-VALIDATION-2025-11-18.md` 需要更新

### 下一步（M11-3 开始编码前）

6. **生成详细的实现规范**
   - 每个 Task 对应一份 `.md` 文件，包含：
     - 技术细节
     - 代码改动位置
     - 测试用例
     - 验收标准

---

**准备就绪！** 🚀

这份文档导航为整个项目提供了：
- ✅ 清晰的文档分类与优先级
- ✅ M11-3 的详细实现待办清单
- ✅ 文档整理的建议结构
- ✅ 后续行动的清晰路线

**下一步是什么？**
1. 要不要立即生成 `M11-3-IMPLEMENTATION-PLAN-2025-11-18.md`？
2. 还是先更新 `docs/README.md` 作为导航中心？

