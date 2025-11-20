# Implementation Status

> 本文是「文档 ↔ 代码」对齐的**总索引**。  
> 原则：**以文档为准**，代码落后或超前都要在这里标记清楚，并给出落地点。

## 0. 状态约定

- ✅ implemented — 文档描述的行为已在代码中实现，偏差可忽略。
- 🟡 partial / experimental — 部分实现，或行为与文档有明显差异。
- 🔴 not implemented — 只有设计/文档，还没有对应代码。
- ⚠️ code ahead of docs — 有实现，但文档没写或写得不够。

---

## 1. Planning 相关

### 1.1 Formal Plan / PlanningAgent

- **Spec**
  - `system/phases/planning.md`
  - `system/workflows/planning-state-machine.md`
  - `system/schemas/planning-schema.md`
  - `system/schemas/planning-meeting-schema.md`
- **Code**
  - `src/agents/planningAgent.mjs`
  - `src/models/deepseek/planning.mjs`
  - `src/planning/planWriter.mjs`（生成 `plan.md` 等）
- **Status**：🟡 partial
- **Notes**
  - 已能生成：
    - `planning/planning.ai.json`
    - `planning/plan.md`
    - `planning/plan-review.json`
    - meeting / transcript（见 `.tmp-tests/planning-*` 资产）。
  - 规划状态机和 schema 已基本落地（见 `system/workflows/planning-state-machine.md`），但：
    - 还没有系统性的 schema 校验（多数是“隐式假设”）。
    - 错误恢复/redo 流程主要在测试脚本里体现，还没抽成正式 API。
  - 部分字段（如 `test_plan`、更细颗粒度的 requirements 场景）在代码里已经开始被消费，但文档暂时只描述了结构，没有讲完“怎么用”。

---

### 1.2 Planning Memory

- **Spec**
  - 目前只在设计里提到 “planning memory / coach 记忆”，还没有成文的规范。
  - 目标是挂在：
    - `system/schemas/planning-schema.md`（增加 `memory` 段）
    - `system/schemas/planning-meeting-schema.md`（在 meeting 结果里引用 memory）
- **Code**
  - （当前仓库中 **还没有** `src/planning/memory.mjs` 或 `planning.memory.jsonl` 之类的实现）
- **Status**：🔴 not implemented
- **Notes**
  - 你在文档/对话中已经多次提到“教练记忆 / 历史总结”，包括对下一轮 planning 的影响，这属于**设计已经成型但尚未物化**的部分。
  - 建议后续实现路线：
    1. 在 `planning-schema` 里加一个 `memory` 段（可以先作为 `notes[]` / `insights[]`）。
    2. 约定简单的落盘格式（例如 `planning/memory.jsonl`，每轮一行）。
    3. 在 `PlanningAgent` 中：
       - 读：上一轮 memory（如果有）作为 prompt 上下文的一部分。
       - 写：每轮结束把关键摘要/信号写入 memory。
    4. 在 `planning-meeting-schema` 中引用 memory，使 meeting / report 也知道有哪些历史结论。

---

### 1.3 Test Plan（来自规划）

- **Spec**
  - `system/schemas/planning-schema.md`（`test_plan` 字段）
  - `system/phases/test.md`（应该引用并解释 test_plan 如何驱动测试）
- **Code**
  - `src/planning/planWriter.mjs`（把 `test_plan` 渲染进 `plan.md`）
  - `src/reports/planningReport.mjs`（在规划报告里展示测试计划摘要）
- **Status**：🟡 partial
- **Notes**
  - 规划 JSON 中的 `test_plan` 已被消费并渲染到：
    - `planning/plan.md`
    - 规划报告（report）中。
  - 测试阶段目前**还没有**把 `test_plan` 作为“硬约束”来驱动具体的测试执行——更多是「展示/摘要」：
    - eval pipeline 读取的是 `eval.conf` + CLI 配置；
    - `test_plan` 只在规划视角被引用。
  - 后续可以考虑：
    - 在 `system/phases/test.md` 中补充 “如何从 test_plan 映射到 eval steps”；
    - 给出一个最小 demo：某个 `test_plan` → 对应 eval.conf 片段。

---

## 2. Review / Test / Accept 相关

### 2.1 Review artifacts（code-review）

- **Spec**
  - `system/phases/review.md`
  - `system/agents/review-agent.md`
  - （未来）`system/schemas/code-review-schema.md`
- **Code**
  - `src/agents/reviewAgent.mjs`
  - `src/models/deepseek/review.mjs`（如果存在）
  - `src/models/deepseek/secondOpinion.mjs` / review meeting 相关文件
- **Status**：🟡 partial
- **Notes**
  - 已有 review agent，关心：
    - diff、
    - 危险路径、
    - 第二意见（second opinion）、
    - 审查摘要。
  - REPL 中已经能看到 review 摘要输出，但还没有稳定的 artifacts 结构：
    - 没有标准化的 `review/code-review.json` / `review/code-review.md`；
    - 输出主要体现在 console 日志和内部数据结构。
  - 建议下一步：
    - 在 `system/schemas/` 下补一个 `code-review-schema.md`；
    - 在 `ReviewAgent` 里把摘要写到 `review/` 目录，并保证 schema 稳定。

---

### 2.2 Accept artifacts（decision）

- **Spec**
  - `system/phases/accept.md`
- **Code**
  - `src/agents/acceptAgent.mjs`
  - `src/accept/runAcceptCore.mjs`（或类似命名的核心逻辑）
- **Status**：🟡 partial
- **Notes**
  - Accept 阶段已经实现：
    - Eval Gate（`/eval` 通过与否会影响 `/accept` 行为）；
    - Git 提交/回滚逻辑（结合 `/revert`）。
  - 当前记录分散在：
    - task `state.json`；
    - Git 提交日志；
    - `eval-report.json`。
  - 但还没有标准化的：
    - `accept/decision.json`
    - `accept/summary.md`
  - 推荐动作：
    - 在 Accept 阶段末尾：
      - 生成一个结构化的决策 JSON（包括 go / no-go 原因、关联 eval 报告、关联 commit hash）；
      - 生成一份简短的 markdown 摘要；
    - 与 `timeline.accept_link` 连起来——从 timeline 就能点回具体决策文件。

---

### 2.3 Test / Eval pipeline

> 这是之前 implementation-status 里缺失的一块，现在补上。

- **Spec**
  - `system/phases/test.md`
  - `system/schemas/eval-schema.md`
- **Code**
  - `src/agents/testAgent.mjs`  
    - 负责从 `planning.ai.json` / `meta.json` 中读取与测试相关的信息（包括 `test_plan`），并触发评测。 [oai_citation:0‡project-dump.txt](sediment://file_00000000272072098ad2a65a96f239e5)
  - `src/core/eval.mjs`  
    - 包含 eval 核心逻辑（读取 `.ai-tools-chain/config/eval.conf`、顺序执行各个 step、聚合结果到 `eval-report.json` 等）。 [oai_citation:1‡project-dump.txt](sediment://file_00000000272072098ad2a65a96f239e5)
  - `.ai-tools-chain/config/eval.conf`  
    - 用于声明 lint/test/promptfoo 等外部命令的执行顺序。
  - `.tmp-tests/orchestrator/.../eval-report.json`  
    - 展示了当前 eval pipeline 的实际输出格式。 [oai_citation:2‡project-dump.txt](sediment://file_00000000272072098ad2a65a96f239e5)
- **Status**：🟡 partial
- **Notes**
  - 现在已经可以：
    - 通过 REPL `/eval` 命令跑一条评测流水线；
    - 产出 `eval-report.json`（见 `.tmp-tests` 中的例子）；
    - 在 `/accept` 时作为 Gate 的输入。
  - 还存在的差距：
    - `eval-schema.md` 与实际 `eval-report.json` 字段结构还没完全对齐；
    - 没有一个“最小端到端 demo”文档化说明：从 plan → codegen → test → accept 一次跑通；
    - 对 promptfoo、lint、unit test 等 step 的失败/中断情况处理逻辑还比较脚本化。
  - 下一步可以做成一个明确的里程碑：
    - **TEST-001: 串起一个“示例任务”的完整 eval pipeline**
      - 目标：一条 README 中可复制的命令序列 + 对应的 artifacts 截图 / 链接；
      - 完成后，把它挂到 `docs/08-milestones/` 或 `planning/timeline.md` 上。

---

## 3. Integrations

### 3.1 OpenSpec

- **Spec**
  - `01-overview.md` / `system/architecture.md` 中的 Integrations 小节（现在可以补充一段 “OpenSpec 作为规划 SSOT” 的描述）。
  - `system/timeline.md` 中提到的「以 OpenSpec change 为单位的任务」设想。
- **Code**
  - `src/planning/openspecArtifacts.mjs`
  - `src/cli/pipeline.mjs`（demo pipeline）
  - CLI 子命令：
    - `ai-tools spec:scaffold`
    - `ai-tools spec:lint`
    - `ai-tools spec:plan`
- **Status**：🟡 partial
- **Notes**
  - 已经可以：
    - 从 `.ai-tools-chain/openspec/` 读取 change / spec；
    - 生成 `plan.md` 草案；
    - 在 `/plan` 中强制用 OpenSpec 作为输入；
    - 合并 guardrails / acceptance 到 `meta.json`。
  - 目前还是偏 demo 性质：
    - 没有把 OpenSpec change id 严格对齐到 timeline 中；
    - 还没有把“一个 change”稳定映射到“一个 task id”。

---

### 3.2 promptfoo

> 这里修正了文件路径：现在 eval 逻辑在 `src/core/eval.mjs`，而不是 `src/eval/runEvalPipeline.mjs`。

- **Spec**
  - `system/phases/test.md`（需要在 integrations 段落提到 promptfoo）
- **Code**
  - `.ai-tools-chain/config/eval.conf`（声明 promptfoo 是其中一个 eval step）
  - `src/core/eval.mjs`（解析 `eval.conf`，按顺序执行 lint/test/promptfoo 等命令） [oai_citation:3‡project-dump.txt](sediment://file_00000000272072098ad2a65a96f239e5)
- **Status**：🟡 partial
- **Notes**
  - 目前 promptfoo 被当作 eval pipeline 中的“一种 command step”：
    - 通过 `npx promptfoo ...` 之类的命令执行；
    - 输出 JSON / log 后再由 `eval.mjs` 做统一汇总。
  - 在 schema 里没有给 promptfoo 单独建模（没有 “per-prompt metrics / distributions” 的字段）。
  - 后续可以考虑：
    - 在 `eval-schema.md` 中增加对 promptfoo 结果的抽象（例如 `metrics/llm_eval` 维度）；
    - timeline 中增加一列简化的 “评测通过率/失败数”。

---

### 3.3 Git

- **Spec**
  - `system/phases/review.md`（diff / dangerous paths）
  - `system/phases/accept.md`（提交与回滚）
  - `docs/planning/adr/0001-directory-structure.md` 中的实现状态注释。 [oai_citation:4‡project-dump.txt](sediment://file_00000000272072098ad2a65a96f239e5)
- **Code**
  - `src/git/*`
  - `AcceptAgent` / `RevertAgent`
  - `bin/ai-tools.mjs` 里的 `/codegen` / `/accept` / `/revert` 流程。 [oai_citation:5‡project-dump.txt](sediment://file_00000000272072098ad2a65a96f239e5)
- **Status**：🟡 partial
- **Notes**
  - 已经有：
    - 脏工作区检查；
    - 预提交快照；
    - diff / patch / revert 路径；
    - per-task `.ai-tools-chain/tasks/<id>/` 目录结构（见 ADR 0001）。 [oai_citation:6‡project-dump.txt](sediment://file_00000000272072098ad2a65a96f239e5)
  - 但约定仍然偏“代码内约定”，文档层面不够明确：
    - 快照的 tag / branch 命名规则；
    - 每个 phase 具体写入哪些 Git 相关元数据（例如 commit hash、父 commit 等）。
  - 建议：
    - 在 `system/phases/accept.md` 里补一段“Git 集成的契约”（输入输出是什么）；
    - 在 ADR 0001 的 Implementation status 段落同步更新当前行为。

---

## 4. How to use this doc

- **新开设计 / 重构时**
  - 先在这里加一行：
    - 哪个 spec 文档；
    - 哪段代码；
    - 初始状态（通常是 🔴 / ⚠️）。
- **改完实现后**
  - 回来更新：
    - `Status`；
    - `Notes`（说明“文档落后代码”还是“代码追上文档了”）。
- **日常使用**
  - 当你有“我现在到底实现到哪了？”这种焦虑时：
    - 先看这里的大块状态（planning / review / test / accept / integrations）；
    - 再去看具体 phase / agent / schema 的细节文档。