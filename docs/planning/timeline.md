# Timeline（项目时间线）

> 本文件是 **ai-tools-chain** 的项目级时间线，是 timeline 的唯一真相源（SSOT）。  
> 约定：**一行 = 一个工作单元（task 或子里程碑）**。  
> 规范请参考：
> - `docs/system/timeline.md`
> - `docs/planning/timeline-schema.md`

---

## 1. 列与枚举（速查）

### 1.1 列（与 timeline-schema 保持一致）

| 列名         | 含义                          | 说明                                       |
|-------------|-------------------------------|--------------------------------------------|
| `id`        | 工作项唯一 ID                 | 建议格式：`M11-3-1` / `TASK-001` 等       |
| `type`      | 工作类型                      | `feature / bug / chore / spike / doc / infra` |
| `title`     | 标题                          | 能独立看懂的短描述                         |
| `milestone` | 归属里程碑 / 主题             | 如 `M11: 基础 repl 框架完成`              |
| `eta`       | 预期完成日期                  | `YYYY-MM-DD` / `TBD` / `unknown`           |
| `priority`  | 优先级                        | 建议使用：`P0 / P1 / P2 / P3`              |
| `status`    | 当前状态                      | 见下一小节                                 |
| `depends`   | 依赖项                        | 逗号分隔的其他 `id`                        |
| `design_link` | 设计 / 文档落点             | 通常是 `docs/...` 路径                     |
| `accept_link` | 最终验收结果落点            | `.ai-tools-chain/tasks/<id>/accept/...`    |
| `notes`     | 备注                          | 任意补充信息                               |

> 如果以后需要新列，必须先更新 `timeline-schema.md`，再来改这里。

---

### 1.2 `priority` 取值约定

与 schema 保持一致： [oai_citation:1‡project-dump.txt](sediment://file_00000000272072098ad2a65a96f239e5)  

- `P0` — 当前阶段的**最高优先级**，不做就很难推进整体目标。
- `P1` — 高优先级，下一梯队，要在本阶段内解决。
- `P2` — 中优先，合适时插入。
- `P3` — 低优先，更多是 backlog / 想法收集。

---

### 1.3 `status` 取值与语义

合法值（摘自 schema）： [oai_citation:2‡project-dump.txt](sediment://file_00000000272072098ad2a65a96f239e5)  

- `idea` — 只是想法，尚未形成完整 scope。
- `planned` — 已有规划（plan）并认可，可以开始做。
- `in-progress` — 正在实施（写代码 / 写文档 / 整合）。
- `in-review` — 规划或实现正在 review。
- `testing` — 正在跑测试 / eval。
- `accepted` — 已通过 Accept Agent 或人工验收。
- `reverted` — 做过、接受过，但后来回滚了。
- `archived` — 历史记录，不再推进。

> 工具层面会把这些状态映射到各 phase（planning / review / test / accept 等），细节在 `docs/system/timeline.md`。 [oai_citation:3‡project-dump.txt](sediment://file_00000000272072098ad2a65a96f239e5)  

---

## 2. 当前时间线（可编辑表）

> 说明：
> - 下面这张表是 **真实可用的 project backlog 初始版本**，围绕你现在在做的事情：  
>   - 文档重构 / timeline / planning state machine / docs ↔ code 对齐。  
> - `status` 和 `eta` 只是当前估值，你可以随时改。  
> - 后续我们可以把 `docs/implementation-status.md` 和 `docs/planning/roadmap.md` 里的 TODO 一条条搬进来扩充这张表。

| id        | type    | title                                   | milestone                                   | eta        | priority | status      | depends         | design_link                                           | accept_link | notes                                                                 |
|----------|---------|-----------------------------------------|--------------------------------------------|------------|----------|-------------|-----------------|-------------------------------------------------------|------------|------------------------------------------------------------------------|
| M11-3-1  | doc     | 编写 timeline-schema 与示例             | M11: 基础 repl / docs 骨架完成            | 2025-12-01 | P0       | in-progress |                 | docs/planning/timeline-schema.md                     |            | 已有 schema 文档 + example-timeline.md，后续以本表作为真实 timeline   |
| M11-3-2  | doc     | 提炼并绘制 Planning 状态机              | M11: 基础 repl / docs 骨架完成            | TBD        | P0       | planned     | M11-3-1         | docs/system/workflows/planning-state-machine.md      |            | 对齐 planning phase 文档和 meeting / memory schema                      |
| M12-1    | feature | PlanningAgent MVP 接入 `/plan` 流程      | M12: Planning Phase 迁移与验证            | TBD        | P0       | idea        | M11-3-1,M11-3-2 | docs/system/phases/planning.md                       |            | 以 docs 为准，梳理 repl / CLI 行为；确保产出 artifacts 与 schemas 对齐 |
| M12-2    | infra   | 落地 planning memory（planning.memory） | M12: Planning Phase 迁移与验证            | TBD        | P1       | idea        | M12-1           | docs/system/schemas/planning-schema.md               |            | 与 docs 中的 memory / meeting.jsonl 约定对齐，代码已有实验性实现       |
| M13-1    | doc     | 整理 Agents 视图与 Accept/Test/Review   | M13: Agents 视图与占位                     | TBD        | P2       | idea        | M12-1           | docs/system/agents/README.md（占位，可调整具体路径） |            | 建一个总览，让后续阶段有统一入口                                       |
| M14-1    | doc     | 建立 ADR 体系与 docs↔code 收敛机制     | M14: ADR 体系与全局视角                    | TBD        | P2       | idea        | M11-3-1,M11-3-2 | docs/planning/roadmap.md                             |            | 与 docs/implementation-status.md 协同，记录枚举/Schema/流程演进决策    |

---

| id        | type     | title                                                                   | milestone                          | eta        | priority | status      | depends      | design_link                                                | accept_link | notes                                                                 |
|----------|----------|-------------------------------------------------------------------------|-------------------------------------|------------|----------|-------------|--------------|------------------------------------------------------------|-------------|------------------------------------------------------------------------|
| PLN-001  | feature  | PlanningAgent：对齐 planning-state-machine 的所有状态路径     | M12: Planning Phase 对齐与落地               | TBD        | P0       | planned     | M11-3-2         | docs/system/workflows/planning-state-machine.md       |             | 当前实现与状态机基本匹配，但未覆盖 redo/retry 等路径，需要补齐。      |
| PLN-002  | feature  | PlanningAgent：统一 artifacts 写入（planning.ai.json / plan.md / plan-review.json） | M12 | TBD | P0 | in-progress | PLN-001 | docs/system/phases/planning.md | | 目前写入逻辑较分散，需要抽象成统一输出层，确保对齐 schema。 |
| PLN-003  | infra    | 建立 planning schema 校验（强校验 + 提示）                    | M12 | TBD | P1 | idea        | PLN-001         | docs/system/schemas/planning-schema.md               |             | 字段校验当前缺失（requirements、scenarios、test_plan），需补静态校验。 |
| PLN-011  | doc      | 更新 planning-schema：新增 memory / 字段补充 / 完整字段说明   | M12 | TBD | P1 | in-progress | M11-3-2         | docs/system/schemas/planning-schema.md               |             | memory/test_plan/scenarios 等结构已在实现中出现，需要纳入 schema。    |
| PLN-012  | doc      | 更新 planning-meeting-schema：明确 meeting → planning.ai.json 映射 | M12 | TBD | P2 | idea | PLN-011 | docs/system/schemas/planning-meeting-schema.md | | 需要清晰描述 meeting 字段如何映射到 planning.ai.json。 |
| PLN-021  | feature  | 设计 planning memory（memory.jsonl）格式与规范                | M12 | TBD | P1 | planned     | PLN-011         | docs/system/schemas/planning-schema.md               |             | memory 功能已在你的设计中提出，但未正式文档化，需要定义格式与用途。    |
| PLN-022  | feature  | 在 PlanningAgent 中集成 memory 读写（上一轮 → 下一轮）        | M12 | TBD | P1 | idea        | PLN-021         | docs/system/phases/planning.md                       |             | memory 将影响规划 prompt 和 agent 结构，需要合理集成。                |
| PLN-031  | doc      | 完善 test_plan 文档：字段定义、流程说明、如何驱动 eval        | M12 | TBD | P2 | in-progress | PLN-002         | docs/system/schemas/planning-schema.md               |             | test_plan 已在 code 中被消费，但文档尚未完全描述其驱动方式。          |
| PLN-032  | infra    | 建立 test_plan → eval-conf 的最小映射（demo 级）              | M12 | TBD | P2 | idea        | PLN-031         | docs/system/phases/test.md                           |             | 从 test_plan.cases 生成 eval 输入的最简实现，用作测试 pipeline 的雏形。|

---

| id        | type     | title                                                         | milestone                                   | eta        | priority | status      | depends         | design_link                                           | accept_link | notes                                                                 |
|----------|----------|---------------------------------------------------------------|----------------------------------------------|------------|----------|-------------|-----------------|-------------------------------------------------------|-------------|------------------------------------------------------------------------|
| REV-001  | feature  | ReviewAgent：统一输出层（生成 review/code-review.json & .md） | M13: Review Phase 对齐                       | TBD        | P1       | idea        | PLN-002         | docs/system/phases/review.md                          |             | 目前输出仅为 REPL 日志，需产出 artifacts。                           |
| REV-002  | doc      | 定义 code-review-schema.md（审查 JSON 结构）                  | M13                                          | TBD        | P1       | idea        | REV-001         | docs/system/schemas/                                  |             | schema 需描述 issues[] / risk[] / summary 等规范。                   |
| REV-003  | infra    | 危险路径（dangerous paths）检测规则标准化                    | M13                                          | TBD        | P2       | idea        | REV-001         | docs/system/phases/review.md                          |             | 当前危险路径判断逻辑分散，需要标准化为统一规则。                     |
| REV-004  | feature  | 将 Planning → Review 的边界契约固化（scope / constraints）    | M13                                          | TBD        | P2       | idea        | PLN-002         | docs/system/phases/review.md                          |             | ReviewAgent 需要严格使用 plan.md 的 scope/constraints。              |

---

| id        | type     | title                                                         | milestone                                   | eta        | priority | status      | depends         | design_link                                           | accept_link | notes                                                                 |
|----------|----------|---------------------------------------------------------------|----------------------------------------------|------------|----------|-------------|-----------------|-------------------------------------------------------|-------------|------------------------------------------------------------------------|
| TST-001  | infra    | Eval pipeline：统一 eval-report.json（schema 对齐）           | M13: Eval Phase 对齐                        | TBD        | P1       | in-progress | PLN-003         | docs/system/schemas/eval-schema.md                    |             | 当前 eval-report.json 字段不完全符合 schema，需正式落地。            |
| TST-002  | infra    | Eval pipeline：将 promptfoo 结果抽象为统一 metrics            | M13                                          | TBD        | P2       | idea        | TST-001         | docs/system/phases/test.md                            |             | promptfoo 结果需转换为 schema-friendly 结构。                         |
| TST-003  | feature  | Eval pipeline：支持最小 TEST_PLAN → eval-conf 的转换          | M13                                          | TBD        | P2       | idea        | PLN-032         | docs/system/phases/test.md                            |             | 规划里 test_plan 的内容需真正驱动 eval 的输入文件或命令。             |
| TST-004  | infra    | Eval pipeline：失败/中断的错误策略（中止 / 允许继续）         | M13                                          | TBD        | P3       | idea        | TST-001         | docs/system/phases/test.md                            |             | 当前失败处理为脚本化逻辑，需要契约化为状态机行为。                    |

| id        | type     | title                                                         | milestone                                   | eta        | priority | status      | depends         | design_link                                           | accept_link | notes                                                                 |
|----------|----------|---------------------------------------------------------------|----------------------------------------------|------------|----------|-------------|-----------------|-------------------------------------------------------|-------------|------------------------------------------------------------------------|
| ACC-001  | feature  | AcceptAgent：生成 accept/decision.json                        | M14: Accept / Revert Phase 对齐             | TBD        | P1       | idea        | TST-001         | docs/system/phases/accept.md                          |             | decision.json 是 timeline 的关键落点，需要尽快实现。                 |
| ACC-002  | doc      | 定义 accept/decision-schema.md                                | M14                                          | TBD        | P2       | idea        | ACC-001         | docs/system/schemas/                                  |             | 描述 verdict / reasons / links / commit-hash 等字段。                 |
| ACC-003  | infra    | AcceptAgent：写入 accept/summary.md                           | M14                                          | TBD        | P2       | idea        | ACC-001         | docs/system/phases/accept.md                          |             | summary.md 便于人类阅读，可放在 timeline 的 accept_link 下。         |
| ACC-004  | infra    | Git 交互契约标准化（快照命名、hash 记录、关联 timeline）     | M14                                          | TBD        | P2       | idea        | ACC-001         | docs/system/phases/accept.md                          |             | 文档与实现需一致，避免 fast-forward 合并损坏 timeline 结构。         |

| id        | type     | title                                                         | milestone                                   | eta        | priority | status      | depends         | design_link                                           | accept_link | notes                                                                 |
|----------|----------|---------------------------------------------------------------|----------------------------------------------|------------|----------|-------------|-----------------|-------------------------------------------------------|-------------|------------------------------------------------------------------------|
| OPS-001  | feature  | OpenSpec：稳定 spec → plan 的转换流程（强制校验）            | M15: OpenSpec Phase 对齐                    | TBD        | P1       | in-progress | PLN-002         | docs/system/overview.md#integrations                   |             | 已有 demo pipeline，需要正式定义输入输出路径和校验规则。              |
| OPS-002  | feature  | OpenSpec change → timeline item 的映射工具                     | M15                                          | TBD        | P2       | idea        | OPS-001         | docs/system/timeline.md                               |             | 每个 OpenSpec change 应能创建/更新 timeline 条目。                    |
| OPS-003  | infra    | meta.json：合并 guardrails / acceptance 逻辑前移到 Planning   | M15                                          | TBD        | P2       | idea        | OPS-001         | docs/system/phases/planning.md                         |             | 目前 meta.json 的 guardrails 在 /plan 后半段处理，需要前移。         |

---

| id        | type     | title                                                                   | milestone                          | eta        | priority | status      | depends      | design_link                                                | accept_link | notes                                                                 |
|----------|----------|-------------------------------------------------------------------------|-------------------------------------|------------|----------|-------------|--------------|------------------------------------------------------------|-------------|------------------------------------------------------------------------|
| CORE-001 | infra    | 统一所有 Phase 的命名与状态机（codegen / review / test / accept 等）     | M16: Core Orchestrator 对齐         | TBD        | P0       | idea        | PLN-001      | docs/system/workflows/global-state-machine.md              |             | 全局状态机需要最终版：phase 列表、进入/退出条件、自动跳转规则等。     |
| CORE-002 | infra    | 重构 orchestrator：抽象 PhaseRunner 接口                                 | M16                                 | TBD        | P0       | idea        | CORE-001     | docs/system/architecture.md                                |             | 所有阶段逻辑应实现统一接口：init → run → writeArtifacts → next-phase。 |
| CORE-003 | infra    | `state.json` 结构收敛（字段、phase 状态、actors 状态统一）               | M16                                 | TBD        | P1       | idea        | CORE-001     | docs/system/architecture.md                                |             | 当前 state.json 字段存在老旧字段与不一致，需要一次性统一。            |
| CORE-004 | infra    | 引入“phase contract 测试”（每个 phase 的 e2e 契约测试）                  | M16                                 | TBD        | P2       | idea        | CORE-001     | docs/system/phases/                                        |             | 确保 planning→review→test→accept 端到端兼容，避免破坏链路。           |

| id        | type     | title                                                                   | milestone                          | eta        | priority | status      | depends      | design_link                                                | accept_link | notes                                                                 |
|----------|----------|-------------------------------------------------------------------------|-------------------------------------|------------|----------|-------------|--------------|------------------------------------------------------------|-------------|------------------------------------------------------------------------|
| CGN-001  | feature  | CodegenAgent：统一输出格式（code/files/* + diff.patch）                  | M17: CodeGen Phase 对齐             | TBD        | P1       | idea        | PLN-002      | docs/system/phases/codegen.md                              |             | 标准化 codegen 输出目录结构，确保可以稳定 diff / review / eval。      |
| CGN-002  | infra    | Codegen prompt 模板与提示词规范化                                       | M17                                 | TBD        | P2       | idea        | CGN-001      | docs/system/agents/codegen-agent.md                        |             | 当前 codegen 提示词分散在模型 adapter，需要统一。                     |
| CGN-003  | infra    | 危险修改（danger zones）预检测（代码层级）                              | M17                                 | TBD        | P3       | idea        | REV-003      | docs/system/phases/codegen.md                              |             | 在 codegen 阶段提前提示可能的危险性修改。                             |
| CGN-004  | infra    | codegen → review → eval 输入规范版权限隔离                               | M17                                 | TBD        | P3       | idea        | CGN-001      | docs/system/architecture.md                                |             | 需要为 codegen 输出加 metadata（如 impacted-files）以便 review 使用。 |

---

| id        | type     | title                                                                   | milestone                          | eta        | priority | status      | depends      | design_link                                                | accept_link | notes                                                                 |
|----------|----------|-------------------------------------------------------------------------|-------------------------------------|------------|----------|-------------|--------------|------------------------------------------------------------|-------------|------------------------------------------------------------------------|
| UX-001   | feature  | REPL：把所有阶段命令 `/plan /codegen /review /eval /accept /revert` 对齐 | M18: CLI/REPL UX 对齐               | TBD        | P1       | in-progress | PLN-001      | docs/01-overview.md#repl                                   |             | REPL 命令在 Phase A 里实现较散，需要统一输出格式+提示结构。           |
| UX-002   | feature  | REPL：为每个阶段提供交互式确认（confirm / skip / override）             | M18                                 | TBD        | P1       | idea        | UX-001       | docs/system/phases/                                        |             | 设计允许用户在交互式模式中选择继续、修正、跳过，流程更清晰。         |
| UX-003   | doc      | CLI 命令文档（ai-tools <cmd>）规范化与自动生成                           | M18                                 | TBD        | P2       | idea        | UX-001       | docs/01-overview.md#cli                                     |             | 统一 CLI 文档，减少理解门槛，未来可自动生成。                         |

---

| id        | type     | title                                                                   | milestone                          | eta        | priority | status      | depends      | design_link                                                | accept_link | notes                                                                 |
|----------|----------|-------------------------------------------------------------------------|-------------------------------------|------------|----------|-------------|--------------|------------------------------------------------------------|-------------|------------------------------------------------------------------------|
| TLS-001  | infra    | timeline sync 工具（自动填充 accept_link / 任务状态）                   | M19: Timeline & 全局视图             | TBD        | P1       | idea        | ACC-001      | docs/system/timeline.md                                    |             | 使用 task/<id>/accept/decision.json 自动更新 timeline 表。           |
| TLS-002  | infra    | timeline consistency check（检测缺失 artifacts）                       | M19                                 | TBD        | P2       | idea        | TLS-001      | docs/system/timeline.md                                    |             | 检查 plan.md / code-review.json / eval-report.json 是否齐全。         |
| TLS-003  | doc      | 自动生成 milestone summary（每个 Mxx 的 summary.md）                    | M19                                 | TBD        | P3       | idea        | TLS-001      | docs/planning/timeline.md                                  |             | 自动从 timeline 提取某个 milestone 所有任务，生成里程碑总结。         |

| id        | type     | title                                                                   | milestone                          | eta        | priority | status      | depends      | design_link                                                | accept_link | notes                                                                 |
|----------|----------|-------------------------------------------------------------------------|-------------------------------------|------------|----------|-------------|--------------|------------------------------------------------------------|-------------|------------------------------------------------------------------------|
| DOCS-001 | doc      | 清理所有 docs 残留旧路径（docs_v2 等）、统一文件命名                    | M20: Docs Hygiene                   | TBD        | P1       | in-progress | M11-3-1      | docs/                                                    |             | 清理旧文档引用、过期路径，确保 docs 与 implement-status 完全一致。    |
| DOCS-002 | doc      | 建立 docs-lint（检测 dead-links / 不存在的 schema 文件）                | M20                                 | TBD        | P2       | idea        | DOCS-001     | docs/                                                    |             | 通过 lint 脚本自动校验 docs 合法性，避免文档腐烂。                   |
| DOCS-003 | doc      | 建立 docs/architecture-overview 的图示化（数据流 / 架构图）             | M20                                 | TBD        | P3       | idea        | DOCS-001     | docs/system/architecture.md                                |             | 提升可读性，帮助新贡献者理解 phase 之间关系。                        |

---

| id        | type     | title                                                                   | milestone                           | eta | priority | status | depends      | design_link                                   | accept_link | notes |
|----------|----------|-------------------------------------------------------------------------|--------------------------------------|-----|----------|--------|--------------|-----------------------------------------------|-------------|-------|
| MOD-001  | infra    | model broker：抽象“模型注册表”（ModelRegistry）                          | M21: Model / Provider 层对齐         | TBD | P1       | idea   | CORE-001     | docs/system/architecture.md                    |             | 当前 broker 分散在 provider，实现方式不一致，需要统一 Registry。 |
| MOD-002  | infra    | model broker：统一 prompt 调用接口（runPrompt / runChat / runTool）       | M21                                 | TBD | P1       | idea   | MOD-001      | docs/system/architecture.md                    |             | 保证所有 agent 都能通过统一接口调用模型。 |
| MOD-003  | infra    | provider：OpenAI Provider 重构成 provider 插件（plugin-style）            | M21                                 | TBD | P2       | idea   | MOD-002      | docs/system/integrations/providers.md          |             | 未来可支持 Anthropic / OpenRouter / 本地模型。 |
| MOD-004  | infra    | provider：增加“能力探测”（capability metadata）                           | M21                                 | TBD | P2       | idea   | MOD-002      | docs/system/integrations/providers.md          |             | 让 agent 能知道 provider 是否支持 tools、JSON、ReAct 等。 |
| MOD-005  | infra    | provider：加入缓存层（避免重复请求）                                      | M21                                 | TBD | P3       | idea   | MOD-002      | docs/system/architecture.md                    |             | 可减少成本并提高稳定性，可采用 JSON/SQLite 存储。 |
| MOD-006  | infra    | provider：prompt logging（记录原始 prompt + response）                     | M21                                 | TBD | P3       | idea   | MOD-002      | docs/system/integrations/providers.md          |             | 有助于 debugging 和测试 reproducibility。 |
| MOD-007  | feature  | tools 规范化（抽象 ai-tools-chain 的工具调用协议）                        | M21                                 | TBD | P2       | idea   | MOD-002      | docs/system/agents/                             |             | 统一内部工具（search/plan/check/eval），未来可扩展。 |

---

| id        | type     | title                                                                   | milestone                           | eta | priority | status | depends      | design_link                                   | accept_link | notes |
|----------|----------|-------------------------------------------------------------------------|--------------------------------------|-----|----------|--------|--------------|-----------------------------------------------|-------------|-------|
| REP-001  | infra    | repo scanner：抽象文件扫描器（代码/文档/配置）                           | M22: Repo Intelligence                | TBD | P1       | idea   | CORE-001     | docs/system/repo-intel.md                     |             | 为 embeddings / codegen / review 提供基础数据。 |
| REP-002  | infra    | repo summary：生成 `repo-summary.md`                                     | M22                                 | TBD | P1       | idea   | REP-001      | docs/system/repo-intel.md                     |             | 让 agent 拥有对整个项目的可控压缩视图。 |
| REP-003  | infra    | embeddings：按 chunk 生成向量并建立索引                                   | M22                                 | TBD | P2       | idea   | REP-001      | docs/system/repo-intel.md                     |             | 为未来的 semantic search / context picking 服务。 |
| REP-004  | feature  | context builder：自动挑选与当前任务相关的上下文                           | M22                                 | TBD | P1       | idea   | REP-002,REP-003 | docs/system/architecture.md                 |             | CodegenAgent / ReviewAgent 都需要基于它构建 prompt。 |
| REP-005  | infra    | dependency graph：分析 JS/TS 依赖关系                                     | M22                                 | TBD | P3       | idea   | REP-001      | docs/system/repo-intel.md                     |             | 有助于危险路径检查与 codegen 改动风险。 |
| REP-006  | infra    | embedding-cache（避免重复向量计算）                                       | M22                                 | TBD | P3       | idea   | REP-003      | docs/system/repo-intel.md                     |             | 大幅降低 embeddings 费用。 |


---

| id        | type     | title                                                                   | milestone                           | eta | priority | status | depends      | design_link                                   | accept_link | notes |
|----------|----------|-------------------------------------------------------------------------|--------------------------------------|-----|----------|--------|--------------|-----------------------------------------------|-------------|-------|
| AGT-001  | feature  | 抽象 Agent 基类（统一 prompt / context / artifacts 输出）                | M23: Multi-Agent Architecture        | TBD | P1       | idea   | CORE-002      | docs/system/agents/README.md                  |             | 所有 agent（planning/review/test/accept/codegen）都应继承该接口。 |
| AGT-002  | feature  | 角色模型：architect / reviewer / tester / acceptor                      | M23                                 | TBD | P2       | idea   | AGT-001      | docs/system/agents/roles.md                   |             | 每个角色有不同 prompt + 目标。 |
| AGT-003  | infra    | agent chain：agent 之间的 artifacts 依赖传递                             | M23                                 | TBD | P2       | idea   | AGT-001      | docs/system/agents/README.md                  |             | 确保 plan → codegen → review → eval → accept 依赖清晰。 |
| AGT-004  | infra    | agent 回合控制：决定 agent 是否继续（retry/redo/clarify）               | M23                                 | TBD | P1       | idea   | AGT-001      | docs/system/phases/                             |             | 回合机制是大模型时代的关键控制方式。 |
| AGT-005  | feature  | “shadow agent”：隐藏审阅者（第二视角）                                  | M23                                 | TBD | P3       | idea   | AGT-002      | docs/system/agents/shadow-review.md           |             | 提高鲁棒性与审查质量。 |
| AGT-006  | feature  | 自动合议（committee-of-agents）                                          | M23                                 | TBD | P3       | idea   | AGT-002      | docs/system/agents/committee.md               |             | 多 agent 投票决定结果。 |

---

| id        | type     | title                                                                   | milestone                           | eta | priority | status | depends      | design_link                                   | accept_link | notes |
|----------|----------|-------------------------------------------------------------------------|--------------------------------------|-----|----------|--------|--------------|-----------------------------------------------|-------------|-------|
| DX-001   | feature  | 项目可视化：生成 timeline.html（可视化时间线图）                        | M24: Developer Experience             | TBD | P2       | idea   | TLS-001      | docs/system/timeline.md                       |             | 使用 mermaid / d3.js 自动生成图表。 |
| DX-002   | infra    | CLI 输出加颜色 + 结构（更容易阅读）                                    | M24                                 | TBD | P3       | idea   | UX-001       | docs/system/phases/                            |             | 提高 REPL / CLI 的可读性。 |
| DX-003   | infra    | 本地 Web UI（起码展示 artifacts 和 timeline）                            | M24                                 | TBD | P3       | idea   | TLS-001      | docs/system/architecture.md                    |             | 可以用 Next.js / Vite 本地展示任务结构。 |
| DX-004   | infra    | CI：文档 lint / timeline 校验 / schema 校验                              | M24                                 | TBD | P2       | idea   | DOCS-002     | docs/                                          |             | 在 GitHub Actions 中跑文档、schema 测试。 |
| DX-005   | chore    | Snapshots：所有 artifacts 统一加 snapshot 机制                          | M24                                 | TBD | P3       | idea   | CORE-003     | docs/system/phases/                             |             | 有助于 debugging 和 regression testing。 |

---

## 3. 使用约定（给未来的你 / 其他贡献者）

- **新增 TODO / 里程碑**  
  - 先想清楚它是不是一个“工作单元”；是的话就加一行。  
  - `id` 尽量稳定且有含义，例如：`M12-3-timeline-sync`。
  - 填写：
    - `type`：`feature / doc / infra / chore` 选一个。
    - `milestone`：挂到 `M11/12/13/14` 等现有里程碑，或新增一个。
    - `status`：从 `idea` 开始，随着进度推进再改。

- **和代码 / 文档对齐**
  - `design_link` 指向本仓库里的文档（`docs/...`）。
  - 任务做完并通过验收后，再补 `accept_link` 指向  
    `.ai-tools-chain/tasks/<id>/accept/decision.json` 或类似落点。

- **和其他文档的关系**
  - `docs/planning/roadmap.md`：更“叙事化”的路线图，讲 Why。 [oai_citation:4‡project-dump.txt](sediment://file_000000003ba472088f725133253ea9ec)  
  - `docs/implementation-status.md`：记录“文档 ↔ 代码”对齐情况。 [oai_citation:5‡project-dump.txt](sediment://file_00000000272072098ad2a65a96f239e5)  
  - `docs/planning/timeline.md`（本文件）：**可操作的 backlog / 进度视图**，是你下一步要干什么的入口。

---

你可以先照上面内容**完整覆盖 `docs/planning/timeline.md`**。  
弄完之后告诉我一声，我们可以再一起把：

- roadmap 里的 M11–M14 拆得更细一点搬进表里；
- 或者从 `implementation-status.md` 里，把已经列出来的块（Planning / Planning Memory 等）一条条变成 timeline 行，把 status/priority 填好。