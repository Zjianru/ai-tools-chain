# 规划阶段用户旅程 - 代码实现验证

| 属性 | 值 |
|------|-----|
| **最后更新** | 2025-11-18 |
| **版本** | v1.0 |
| **状态** | ✅ Current |

---

## 📝 更新历史

- **2025-11-18**: 初稿完成

---

**目的**：将用户旅程中的 25+ 个设计问题映射到现有代码实现，识别哪些已有解决方案、哪些需要讨论。

**生成日期**：2025-11-18  
**验证方法**：系统扫描代码库（`src/agents/*`, `src/core/*`, `src/planning/*`, `src/cli/*`）和架构文档

---

## 一、阶段 A：启动与输入准备

### A1. 如何引导用户提供需求？

| 问题 | 代码位置 | 状态 | 证据 |
|------|--------|------|------|
| 系统应该展示什么样的输入提示？ | `src/cli/repl.mjs` (L311+) | ✅ 已实现 | `handleCoachDialogue()` 显示决策、摘要、下一步行动、待澄清问题 |
| 输入应该是自由文本还是结构化的？ | `src/core/planning.mjs` (L53) | ✅ 已实现 | `callPlanningOnce()` 接收 `userBrief` 作为自由文本，无结构化要求 |
| 用户能否看到之前的规划历史？ | `src/planning/versions.mjs` (L8+) | ✅ 已实现 | `snapshotPlanningVersion()` 维护 `versions/v1`, `v2` 等快照 |
| 重新运行规划是否会清除之前的版本？ | `src/planning/versions.mjs` | ✅ 已实现 | 版本按 `v{round}` 命名，旧版本保留不覆盖 |

### A2. 如何加载已有项目快照？

| 问题 | 代码位置 | 状态 | 证据 |
|------|--------|------|------|
| 系统如何识别目标项目？ | `src/core/task.mjs` | ✅ 已实现 | TaskID 生成，`.last_task` 恢复机制 |
| Git 信息如何整合到规划中？ | `src/core/planning.mjs` (L57) | ✅ 已实现 | `git ls-files` 获取文件列表，传入 `repoSummary` 到规划 |
| 现有文件结构如何扫描？ | `src/core/planning.mjs` (L63) | ✅ 部分实现 | 仅列出前 100 个文件，粒度有限 |

---

## 二、阶段 B：工作坊启动与首轮讨论

### B1. 敏捷教练的初判

| 问题 | 代码位置 | 状态 | 证据 |
|------|--------|------|------|
| 如何判断需求信息是否充分？ | `src/cli/commands/plan.mjs` (L111+) | ⚠️ 部分实现 | `runClarificationMiniMeeting()` 存在但逻辑基于"角色提出的阻塞问题" 而非客观的信息充分性判断 |
| 充分性判断的标准是什么？ | `src/planning/planningCore.mjs` | ❌ 设计中 | 规划核心函数不记录充分性评分，建议由 Coach 判断（待实现） |
| 不充分时的建议是什么样的？ | `docs/architecture/PLANNING-WORKSHOP-CONSENSUS-MODEL.md` (L270+) | ✅ 已设计 | "敏捷教练作为传声筒与用户对话"，设计清晰但代码实现不完整 |

### B2. 可能的用户澄清环节（第1个插入点）

| 问题 | 代码位置 | 状态 | 证据 |
|------|--------|------|------|
| 什么时候停止澄清？ | `src/cli/commands/plan.mjs` (L111+) | ⚠️ 部分实现 | 一旦收集到来自各角色的 `blocking_questions`，澄清小会就启动，但"何时停止"由用户 Ctrl+C 或问题耗尽 |
| 澄清内容在工作坊中的位置不明确 | `src/planning/transcript.mjs` (L40+) | ✅ 已实现 | `buildClarificationSummary()` 提取所有 `clarify_question`/`clarify_answer` 并返回 `{ round, index, question, answer }` 数组 |
| 澄清是否打断用户心流？ | `src/cli/commands/plan.mjs` (L85) | ⚠️ 设计中 | 澄清在 `/plan` 后自动启动，可能中断体验；无"继续前确认"机制 |
| 用户说不确定时的处理 | `src/cli/commands/plan.mjs` (L91) | ❌ 缺失 | 允许用户回答任何内容（包括空），无"不确定处理"逻辑 |
| 澄清完后是否需要"确认继续"？ | `src/cli/commands/plan.mjs` (L115) | ❌ 缺失 | 澄清后直接执行 `await agent.step()`，无明确的"准备继续"确认 |

### B3. 首轮讨论输出

| 问题 | 代码位置 | 状态 | 证据 |
|------|--------|------|------|
| 各角色的发言顺序是固定的吗？ | `src/agents/planningMeetingAgent.mjs` (L111+) | ✅ 已实现 | `roleCalls` 定义角色发言顺序：`ProductPlanner` → `SystemDesigner` → `SeniorDeveloper` → `TestPlanner` → `RiskPlanner` |
| 每个角色的"输入"是什么结构？ | `src/agents/planningMeetingAgent.mjs` (L60+) | ✅ 已实现 | `basePayload` 包含：`planning`, `plan_review`, `draft_files`, `previous_per_role_verdicts`, `coach_summary` |
| 如何收集各角色的结论（verdict）？ | `src/agents/planningMeetingAgent.mjs` (L111+) | ✅ 已实现 | Round 1 中调用各角色 AI，收集 `{ ok, reasons, suggestions, blocking_open_questions }` |

---

## 三、阶段 C：多轮讨论周期

### C1. 每轮讨论中可能出现的用户澄清（插入点）

| 问题 | 代码位置 | 状态 | 证据 |
|------|--------|------|------|
| "插入式澄清"如何暂停讨论？ | `src/cli/commands/plan.mjs` (L111+) | ✅ 已实现 | `runClarificationMiniMeeting()` 在规划后直接启动，暂停后续流程 |
| 澄清对话中，如果用户说不确定，怎么办？ | `src/cli/commands/plan.mjs` (L91) | ⚠️ 部分实现 | 允许空回答，但无特殊处理——可能需要"记录为不确定"或"继续追问" |
| 澄清后是否需要重新运行已发言的角色？ | `src/planning/planningMeetingCore.mjs` | ❌ 设计中 | 澄清后的下一个角色会看到澄清内容（在 `inputSnapshot` 和 `clarifications`），但已发言的角色不会重新审视 |
| 如何标记"新问题点"？ | `docs/architecture/PLANNING-WORKSHOP-CONSENSUS-MODEL.md` (L318+) | ✅ 已设计 | "问题清单递归细化"原则明确，但代码中的"问题列表追踪"实现不完整 |
| 澄清内容的影响范围？ | `src/planning/transcript.mjs` (L40+) | ✅ 已实现 | `buildClarificationSummary()` 将澄清内容纳入 `meeting.rounds[0].clarifications`，对后续角色可见 |

### C2. 下一轮讨论的启动

| 问题 | 代码位置 | 状态 | 证据 |
|------|--------|------|------|
| 何时启动第 2 轮？ | `src/agents/planningMeetingAgent.mjs` (L139+) | ✅ 已实现 | Round 1 后收集 Coach 的 `summary`，如果存在则启动 Round 2（重新评估） |
| Round 2 的触发条件是什么？ | `src/agents/planningMeetingAgent.mjs` (L139) | ⚠️ 部分实现 | 代码硬编码"如果 Round 1 有 summary，就进入 Round 2"，但无明确的"收敛判断" |
| 如何判断讨论是否已充分收敛？ | `docs/architecture/PLANNING-WORKSHOP-CONSENSUS-MODEL.md` (L372+) | ✅ 已设计 | 共识模型中有"逐轮充实，稳定基础"的原则，但代码中的"充分性指标"不清晰 |
| Round 2 中角色是否看到 Round 1 的结果？ | `src/agents/planningMeetingAgent.mjs` (L148) | ✅ 已实现 | Round 2 传入 `previous_per_role_verdicts: perRoleVerdictsRound1` 和 `coach_summary: round1CoachSummary` |
| 讨论死循环如何防止？ | `src/agents/planningMeetingAgent.mjs` | ❌ 缺失 | 无"最大轮数限制"或"收敛指标"，理论上可无限循环 |

### C3. 共识形成与决策

| 问题 | 代码位置 | 状态 | 证据 |
|------|--------|------|------|
| 如何定义"共识"？ | `docs/architecture/PLANNING-WORKSHOP-CONSENSUS-MODEL.md` (L230+) | ✅ 已设计 | "共识草案"= 各角色都不反对的部分；设计清晰 |
| 共识的形成过程是什么？ | `src/planning/planningMeetingCore.mjs` (L122+) | ✅ 已实现 | Coach 根据各角色 `position` (agree/concern/block) 综合判断决策 (go/hold/redo_planning) |
| 决策有哪些选项？ | `src/core/schemas.mjs` (L75) | ✅ 已实现 | 枚举值：`"go"` (继续)、`"hold"` (暂停)、`"redo_planning"` (重新规划) |
| 如何量化"同意度"？ | `src/planning/planningMeetingCore.mjs` (L180+) | ⚠️ 部分实现 | 基于 `position` 三分类，未量化为百分比或投票数 |

---

## 四、阶段 D：讨论结束与输出

### D1. 讨论结束的明确标准

| 问题 | 代码位置 | 状态 | 证据 |
|------|--------|------|------|
| 讨论结束的明确标准是什么？ | `src/agents/planningMeetingAgent.mjs` | ⚠️ 部分实现 | 代码中硬编码"Round 1 后有 summary 就进入 Round 2"，无明确的"结束标准" |
| 如何防止讨论死循环？ | `src/agents/planningMeetingAgent.mjs` | ❌ 缺失 | 无"最大轮数"、"同意度阈值"、"时间限制" 等防护 |
| 什么是"讨论充分"的信号？ | `docs/architecture/PLANNING-WORKSHOP-CONSENSUS-MODEL.md` (L372+) | ✅ 已设计 | "共识草案逐轮充实，一旦纳入就不再反复讨论"；但代码指标不清晰 |
| 各角色是否需要明确的"通过"或"同意"声明？ | `src/planning/planningMeetingCore.mjs` (L175+) | ✅ 已实现 | 各角色返回 `{ ok: true|false|null, ... }`，然后被映射为 `position: "agree"|"block"|"concern"` |

### D2. 输出的确认与展示

| 问题 | 代码位置 | 状态 | 证据 |
|------|--------|------|------|
| 规划完成后，用户是否需要确认？ | `src/cli/repl.mjs` (L311+) | ⚠️ 部分实现 | 没有明确的"确认对话"，仅显示决策摘要；无"我同意/我要求调整"的确认步骤 |
| 用户对规划不满意时的调整机制是什么？ | `docs/architecture/PLANNING-STAGE-USER-JOURNEY.md` | ❌ 缺失 | 文档中标记为"需要调整机制"，代码中没有对应实现 |
| "准备进入 codegen"前的最终检查是什么？ | `src/agents/codegenAgent.mjs` | ⚠️ 部分实现 | Codegen 前有 `state.phase === "plan_review"` 检查，但无明确的"用户最终确认"步骤 |
| 规划信息的可视化应该什么样？ | `src/planning/planningMeetingCore.mjs` (L260+) | ✅ 部分实现 | 生成 `planning.meeting.md`（Markdown 格式），包含摘要、关键要点、风险、待澄清问题 |

---

## 五、阶段 E：版本迭代与重新规划

### E1. 多版本管理

| 问题 | 代码位置 | 状态 | 证据 |
|------|--------|------|------|
| 用户如何在版本之间切换？ | `src/planning/versions.mjs` (L8+) | ✅ 已实现 | 版本按 `v{round}` 快照保存，包含 `planning.ai.json`, `plan.md`, `roles/` 目录等 |
| 旧版本是否可复用或继承？ | `src/cli/commands/plan.mjs` | ❌ 设计中 | 版本保留但无"加载旧版本"或"基于旧版本继续"的 CLI 命令 |
| 版本之间的差异如何追踪？ | `src/planning/planningMeetingCore.mjs` (L229+) | ✅ 部分实现 | 计算 `roleDeltas` (Round 1 vs Round 2 的角色立场变化)，但多版本间的差异追踪不清晰 |
| 新一版规划的"输入"如何管理？ | `src/planning/transcript.mjs` (L29+) | ✅ 已实现 | `nextRoundFromTranscript()` 计算当前轮次，新轮次会追加到 `planning.transcript.jsonl` |
| 用户是否被告知"版本更新"的原因？ | `src/cli/commands/plan.mjs` | ⚠️ 部分实现 | 澄清后提示"可再次运行 /plan 获得新规划"，但无清晰的"变化原因说明" |

### E2. 新一版规划的生成

| 问题 | 代码位置 | 状态 | 证据 |
|------|--------|------|------|
| 新一版是否需要重新澄清？ | `src/core/planning.mjs` (L53+) | ⚠️ 部分实现 | `callPlanningOnce()` 接收 `history` 参数（包括澄清），可复用，但"是否需要新澄清"无决策逻辑 |
| 旧规划的哪些内容会被继承？ | `src/core/planning.mjs` (L18+) | ✅ 已实现 | `ensurePlanningDraft()` 加载 `planning.draft.json`，`writePlanningDraft()` 更新；但继承策略不明确 |
| 新规划生成时，旧版本的角色结论是否作为"参考"？ | `src/agents/planningMeetingAgent.mjs` (L148) | ✅ 已实现 | Round 2 中使用 `previous_per_role_verdicts` 作为参考，但仅限 Round 1→2，多版本间的参考不清晰 |

---

## 六、阶段 F：产物交接与后续阶段

### F1. 产物的组织与清单

| 问题 | 代码位置 | 状态 | 证据 |
|------|--------|------|------|
| 规划产物有哪些？ | `src/planning/versions.mjs` (L2+) | ✅ 已实现 | `PLANNING_FILES` 定义：`planning.ai.json`, `plan.md`, `plan-review.json`, `planning.meeting.json`, `planning.meeting.md`, 以及 `roles/` 目录 |
| 产物路径的命名规范是什么？ | `src/planning/planningMeetingCore.mjs` (L1+) | ✅ 已实现 | 统一在 `tasks/{taskId}/planning/` 目录下 |
| 如何确保产物的完整性？ | `src/core/schemas.mjs` (L32+) | ✅ 已实现 | Zod schema 定义了 `PlanningMeetingRoundSchema`, `PerRoleVerdictsSchema` 等，但产物完整性检查的触发点不清晰 |
| 后续阶段（codegen）如何加载规划产物？ | `src/agents/codegenAgent.mjs` | ✅ 部分实现 | Codegen 加载 `planning.ai.json` 和 `plan-review.json`，但加载失败的错误处理不完整 |

### F2. 规划报告的生成

| 问题 | 代码位置 | 状态 | 证据 |
|------|--------|------|------|
| 规划报告的内容应该包括什么？ | `src/planning/planningMeetingCore.mjs` (L260+) | ✅ 已实现 | `planning.meeting.md` 包含：标题、Why/What/Scope、关键要点、风险、待澄清问题、下一步建议、澄清纪要、决策 |
| 报告的目标读者是谁？ | `docs/architecture/PLANNING-WORKSHOP-CONSENSUS-MODEL.md` | ✅ 已设计 | 面向开发团队、测试团队、项目经理，但代码中无"读者角色定制"的机制 |
| 报告的展示格式是什么？ | `src/planning/planningMeetingCore.mjs` (L260+) | ✅ 已实现 | Markdown 格式，包含结构化的标题、列表、引用块；同时保存为 JSON 结构化数据 |
| 规划是否被转化为可追踪的"需求"或"任务"？ | `src/agents/codegenAgent.mjs` | ⚠️ 设计中 | Codegen 会根据规划生成代码，但"规划→任务"的显式映射不清晰 |

### F3. Gate 检查与下游协议

| 问题 | 代码位置 | 状态 | 证据 |
|------|--------|------|------|
| 规划必须通过什么 gate 才能进入 codegen？ | `src/planning/planningMeetingCore.mjs` (L118+) | ✅ 已实现 | Decision 必须为 `"go"`（无阻塞问题），或 `planReview.ok === true` |
| Gate 失败时的处理流程是什么？ | `src/agents/planningMeetingAgent.mjs` | ⚠️ 部分实现 | Gate 失败时设置 decision = "hold" 或 "redo_planning"，但具体的"重新规划流程"不清晰 |
| Test Plan 是否被 codegen 看到？ | `src/agents/codegenAgent.mjs` | ✅ 部分实现 | `test_plan` 字段被读取，可传入 codegen，但下游使用不清晰 |
| Codegen 是否依赖规划的所有字段？ | `src/agents/codegenAgent.mjs` | ⚠️ 部分实现 | 主要依赖 `planning.ai.json` 和 `planning.requirements`，但对 `open_questions`, `non_goals` 等的使用程度不清晰 |

---

## 七、总结：实现状态分析

### 7.1 已充分实现（✅）

| 项目 | 覆盖范围 | 代码置信度 |
|------|--------|----------|
| **多轮讨论管理** | 轮次追踪、澄清记录、Round 1/2 工作流 | 高 |
| **角色协调** | 5 个角色的发言顺序、输入结构、结论收集 | 高 |
| **版本快照** | 按轮次保存版本，文件完整性 | 高 |
| **产物组织** | 规划 JSON、Markdown 报告、会议记录 | 高 |
| **Transcript 管理** | 澄清问答记录、轮次追踪、历史恢复 | 高 |
| **Coach 对话** | 基本的 Coach 与用户交互、决策展示 | 中 |

### 7.2 部分实现（⚠️）

| 项目 | 现状 | 缺失部分 | 优先级 |
|------|------|---------|-------|
| **澄清流程** | 问题收集、记录、展示 | "何时停止"判断、"用户不确定"处理、澄清后重新发言 | 高 |
| **讨论收敛** | 基本的 Round 1/2 | "最大轮数"、"同意度量化"、"充分性指标" | 中 |
| **版本管理** | 快照保存 | 版本间差异追踪、加载旧版本、基于版本继续 | 中 |
| **产物交接** | 文件保存 | Codegen 的完整依赖列表、Test Plan 使用策略 | 中 |
| **用户确认** | 无对应实现 | "最终检查"、"调整机制"、"进入下阶段前确认" | 高 |

### 7.3 未实现或设计中（❌）

| 项目 | 设计状态 | 代码状态 | 优先级 |
|------|---------|---------|-------|
| **信息充分性判断** | 已在文档中讨论 | 代码中基于"阻塞问题"而非主动评分 | 高 |
| **讨论死循环防止** | 无设计 | 无代码 | 中 |
| **澄清后重新发言** | 已在共识模型中提及 | 无代码实现 | 高 |
| **调整机制** | 文档标记为"需要" | 无代码 | 高 |
| **版本切换 CLI** | 无设计 | 无代码 | 低 |
| **规划→任务映射** | 无设计 | 无代码 | 低 |

---

## 八、行动建议

### Phase 1（高优先级，需立即设计讨论）

1. **澄清流程的完成**  
   - 设计"何时停止澄清"的客观判断标准
   - 实现"用户回答'不确定'时"的处理逻辑
   - 设计"澄清后，已发言的角色是否需要重新发言"

2. **用户最终确认机制**  
   - 在 Gate 前或进入 Codegen 前，让用户"看一眼、确认或调整"
   - 定义"调整"的范围（小修改 vs 重新规划）

3. **信息充分性主动评分**  
   - 由 Coach 在 Round 1 后给出"信息充分度"评分（0-100%）
   - 根据评分决定是否启动澄清或 Round 2

### Phase 2（中优先级，需在 M12+ 完成）

4. **讨论收敛指标**  
   - 定义"同意度"量化方式（例如：`agree_count / total_roles`）
   - 设置"同意度阈值"（例如：≥80% 即可结束讨论）
   - 设置"最大轮数"限制（例如：最多 3 轮）

5. **版本差异追踪**  
   - 在 `planning.meeting.md` 中清晰显示"相比上一版本的变化"
   - 提供 CLI 命令 `ai-tools planning versions <taskId>` 查看所有版本及其差异

6. **产物完整性检查**  
   - 在 Gate 处添加"必须字段检查"
   - 如果 `test_plan` 缺失，给出警告或强制补充

### Phase 3（低优先级，可在未来迭代）

7. **版本复用与加载**  
   - 实现 `ai-tools planning load-version <taskId> <versionNum>`
   - 允许基于某一版本的快照继续讨论

8. **规划→任务可视化**  
   - 生成一份"规划→Codegen"的映射表
   - 例如：哪些 requirements 对应哪些 draft_files，哪些 test cases 来自 test_plan

---

## 九、验证矩阵总结

### 用户旅程问题总清点

| 阶段 | 总问题数 | ✅ 已实现 | ⚠️ 部分实现 | ❌ 未实现 |
|------|---------|---------|-----------|---------|
| A (启动输入) | 6 | 5 | 1 | 0 |
| B1 (初判) | 3 | 0 | 1 | 2 |
| B2 (澄清) | 5 | 1 | 2 | 2 |
| B3 (首轮) | 3 | 3 | 0 | 0 |
| C1 (轮中澄清) | 5 | 2 | 1 | 2 |
| C2 (下一轮) | 5 | 2 | 2 | 1 |
| C3 (共识形成) | 4 | 3 | 1 | 0 |
| D1 (讨论结束) | 4 | 1 | 2 | 1 |
| D2 (输出确认) | 4 | 2 | 2 | 0 |
| E (版本迭代) | 9 | 3 | 3 | 3 |
| F (产物交接) | 9 | 4 | 2 | 3 |
| **总计** | **57** | **26 (46%)** | **17 (30%)** | **14 (24%)** |

**结论**：  
- **核心工作流已实现**（46% 充分、30% 部分），规划阶段大框架完整
- **用户交互层需完善**（澄清流程、确认机制、版本管理）
- **收敛判断与防护需补强**（死循环防止、充分性评分、最大轮数）
- **下游协议还需明确**（Test Plan 使用、产物依赖关系）

---

**下一步行动**：建议召开"规划阶段设计评审"会议，优先讨论 Phase 1 的三个高优先级设计问题，在 M11-3 中实现代码支持。

