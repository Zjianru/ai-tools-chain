# 系统总览（Overview）

## 用户旅程 {#user-journey}
- plan → Planning Phase
- Review → 设计评审与一致性校验
- Test → 自动化与手工测试
- Accept → 验收与 DoD
- Revert → 回滚与恢复

## 系统边界 {#system-boundary}
- 本地化 AI 工具链：面向个人和小团队，运行在本地环境。
- 外部依赖：版本控制（如 Git）、CI/测试框架（可选），不在文档系统内维护进度状态。
- 文档边界：
  - `planning/timeline.md` 为唯一进度/状态 SSOT。
  - `system/*` 为设计/流程/契约 SSOT。

## 阶段职责 {#phase-responsibilities}
- Planning：明确需求与范围，形成 Draft → Formal Plan（JSON），并建立状态机与约束。
- Review：架构/流程评审，确保一致性与可实现性（链接到 Schemas/Workflows）。
- Test：对实现进行验证（单测/集成/端到端），不在系统文档维护状态，仅链接。
- Accept：验收与 DoD，完成度判定与交付确认（与 Timeline 的 `status=done` 呼应）。
- Revert：当验收不达标或发现问题时的回滚策略与记录。

## 数据契约索引 {#data-contracts}
- Formal Plan（JSON）：字段与约束见 `../system/schemas/planning-schema.md#fields`。
- 规划状态机：状态与转换见 `../system/workflows/planning-state-machine.md#states`。
- 验收 DoD：在 Accept 阶段引用并判定达标（可在各 Phase 文档定义条目）。

## 关联文档 {#links}
- Phases: ../system/phases/planning.md#overview | ../system/phases/review.md#overview | ../system/phases/test.md#overview | ../system/phases/accept.md#overview
- Workflows: ../system/workflows/planning-state-machine.md#diagram | ../system/workflows/global-state-machine.md#diagram
- Schemas: ../system/schemas/planning-schema.md#fields | ../system/schemas/planning-meeting-schema.md#fields
- Agents: ../system/agents/overview.md#overview | ../system/agents/orchestrator.md#overview | ../system/agents/planning-agent.md#overview



## 外部集成 {#integrations}

本项目依赖但不“吞掉”的外部系统包括：

- **OpenSpec**
  - 位置：`.ai-tools-chain/openspec/`（spec.yaml / schema.yaml / changes/*）
  - 用途：
    - 作为需求与变更的上游设计源；
    - 通过 `ai-tools spec:*` 与 `/plan`，生成 `planning/planning.ai.json` 与 `planning/plan.md` 的草稿；
    - 在规划阶段做结构与一致性检查（plan review）。
  - 当前状态：🟡 部分实现
    - 已有 `src/planning/openspecArtifacts.mjs` 与 `src/cli/pipelines/demoOpenspec.mjs` 可用作 demo；
    - 尚未与 Timeline 与全生命周期自动打通（例如多任务、多变更协同）。

- **promptfoo**
  - 位置：`.ai-tools-chain/promptfoo/promptfooconfig.yaml`，由 `ai-tools init` 模板生成；
  - 用途：
    - 作为 eval pipeline 中的一种外部评测工具，通过 `eval.conf` 配置；
    - 执行结果汇总到 `eval/eval-report.json`。
  - 当前状态：🟡 部分实现
    - 已能作为 eval 步骤被调用，但尚未在 schema 中专门建模 promptfoo 的结果结构。

- **Git**
  - 用途：
    - 提供 diff 与文件快照（Review 阶段）；
    - 提供提交与回滚能力（Accept / Revert 阶段）。
  - 当前状态：🟡 部分实现
    - Accept / Revert 已经使用 Git，但快照命名规则与元数据（例如与 `timeline` 的联动）仍在演进中。