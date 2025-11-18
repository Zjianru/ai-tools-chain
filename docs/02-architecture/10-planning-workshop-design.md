# Planning Workshop — 统一设计总纲（2025-11-18）

| 属性 | 值 |
|------|-----|
| **最后更新** | 2025-11-18 |
| **版本** | v1.0 |
| **状态** | ✅ Current |

---

## 📝 更新历史

- **2025-11-18**: 同步最后更新日期
- **2025-11-17**: 初稿完成

---

> 本文是 **规划阶段（/plan）行为与体验的单一真相来源**。  
> 其他关于 planning / PlanningAgent / planning_meeting / 多角色协作的文档，如与本文不一致，均以本文为准。

---

## 1. 用户视角：/plan = 进入“规划工作坊”

- 用户只需要记住一件事：  
  `/plan <一句话需求>` = 把需求交给一个由敏捷教练主持的“规划工作坊”。  
- 工作坊内部：  
  - 成员：ProductPlanner / SystemDesigner / SeniorDeveloper / TestPlanner / RiskPlanner 等专家角色；  
  - 主持人：Coach（敏捷教练），是用户唯一直接“见到”的角色。  
- 一次 /plan 的基本流程：  
  1. 用户给出简要需求（可附带上一版规划报告 + 自己的反馈）；  
  2. 教练将需求广播给各角色，开启内部研讨；  
  3. 角色们先在内部多轮讨论达成初步共识；  
  4. 教练整理会议结果，生成结构化规划与会议纪要；  
  5. 教练向用户汇报规划摘要与下一步建议。

---

## 2. 内部视角：多角色协作 + 教练多轮收敛

### 2.1 基本循环

单次 `/plan` 内部，遵循统一的“写作循环”：

1. **收集输入**  
   - 用户最新 brief（包括上一版规划报告和补充意见）；  
   - 当前或上一版的 `planning.ai.json` + `plan.md`；  
   - 既往轮次的决策与未决问题（`planning.meeting.*` 摘要 + transcript）。  

2. **角色分头思考**  
   - ProductPlanner：scope / non_goals / acceptance / 需求合理性；  
   - SystemDesigner：draft_files / file_impacts / 模块拆分与设计要点；  
   - SeniorDeveloper：实现可行性 / 复杂度 / 工作量；  
   - TestPlanner：test_plan / 可测性 / 关键用例；  
   - RiskPlanner：risks / open_questions / 信息黑洞。  
   - 每个角色在思考时必须携带：  
     - 用户需求；  
     - 之前所有角色发言的简要记录；  
     - 上一轮教练给出的“会议简报”。  

3. **教练整合与多轮共识收敛**  
   - 在每轮内部讨论之后，教练综合各角色输出，形成一份“会议简报”：  
     - 当前共识；  
     - 主要分歧；  
     - 关键假设（`assumptions`）；  
     - 未决问题（`open_questions`）。  
   - 教练按角色轮询，将该简报传递给每个角色，询问是否有异议或补充：  
     - 若某角色有异议，则记录该角色的新意见并更新简报，再携带更新后的简报继续询问下一位角色；  
     - 如此往复多轮（实现上应设上限），直到主要问题上达成共识或识别出必须先澄清的阻塞点。  

4. **定稿与产物**  
   - 在达成当前轮次共识后，教练与各角色共同完成：  
     - 统一的 `planning.ai.json`：  
       - 符合新 schema，包含 `why/what/requirements/targets/risks/acceptance/draft_files/tasks/notes/test_plan/scope/non_goals/open_questions/assumptions` 等；  
     - 人类可读的 `plan.md`：  
       - 以用户易读的方式总结上述内容；  
     - 结构化会议纪要 `planning.meeting.json/.md`：  
       - 按轮记录“输入 → 关键讨论点 → 草案变化 → 未决问题/关键假设 → 下一步建议”；  
       - 包含多角色 verdict 与 Coach 的决策（`go | hold | redo_planning`）。

---

## 3. 澄清策略：聪明助手，而非表单机器人

### 3.1 默认行为

- 规划阶段的 AI 默认应当：  
  - 优先基于常识、已有文档与仓库上下文给出完整方案；  
  - 对不确定但影响不大的细节采用合理默认值，并在 `assumptions[]/notes` 中显式记录；  
  - 将“真不知道、但又重要”的问题写入 `open_questions[]`，供后续 review/meeting 与用户一起处理。  
- `/plan` 不应因为缺少细枝末节信息而频繁阻塞流程。

### 3.2 澄清小会与传声筒机制

- 当某个角色认为“必须向用户澄清，否则无法安全推进”（blocking 问题）时：  
  - 由该角色将问题交给教练；  
  - 教练发起“用户 + 该角色 + 教练”的小会：  
    - 教练作为传声筒，将问题自然语言转述给用户；  
    - 用户自由回答，不限制澄清轮次；  
    - 教练记录原始回答与必要摘要，再反馈给该角色；  
    - 教练控制对话不偏离当前需求与本轮议题。  
- 澄清结束的判断：  
  - 由提出问题的角色和教练共同判断“信息是否已足够继续本轮讨论”；  
  - 澄清结果被纳入下一轮角色思考和会议简报。  

---

## 4. 产物与报告：对外的一份规划报告 + 多版本

### 4.1 结构化产物（内部）

- `tasks/<id>/planning/`：  
  - `planning.ai.json`：当前版本的结构化规划；  
  - `plan.md`：当前版本的人类可读规划说明；  
  - `plan.files.json`：目标文件列表；  
  - `planning.meeting.json/.md`：本轮会议纪要。  

### 4.2 面向用户的规划报告

- 规划报告目录（示例，最终以 pipeline-artifacts 文档为准）：  
  - `tasks/<id>/reports/planning/`  
    - `v1/planning.report.md`：第一版规划报告；  
    - `v2/planning.report.md`：用户反馈后，第二次 /plan 生成的新版报告；  
    - `latest/planning.report.md` 或符号链接：指向当前版本。  
- 报告内容应由教练基于 `planning.ai.json` + `planning.meeting.*` 汇总生成，尽量保持：  
  - 一份简洁的“给用户看的总结”；  
  - 明确的下一步建议与决策（`go/hold/redo_planning`）；  
  - 清晰暴露关键假设与未决问题，便于用户做决策或写反馈。

### 4.3 多版本 /plan 与复用上一版报告

- 用户若对当前规划不满意，可以：  
  - 将上一版 `planning.report.md` 作为输入内容的一部分；  
  - 在其后附加自己的意见或修改建议；  
  - 再次运行 `/plan`。  
- 教练与各角色应将上一版报告视为输入之一，在新一轮讨论中：  
  - 尊重用户对上一版的反馈；  
  - 在 `versions/` 或 `reports/planning/vN/` 目录中保留各版本历史，便于回溯与审计。

---

## 5. 与现有代码和文档的关系

- 已实现部分（2025-11-17 状态）：  
  - `PlanningAgent` + `planning` 模型：单次调用 + OpenSpec + PlanReview + PlanningMeeting 的最小闭环；  
  - 多角色 verdict 与 Coach 决策的 schema 已在 `planning.meeting.json` 中初步设计；  
  - 部分 prompt 与文档已对齐“规划工作坊 + 聪明澄清”原则。  
- 尚待演进部分：  
  - 真正的多角色协作（独立 Agent 或更细的 prompt 分层）；  
  - 教练内部的多轮“简报→轮询→共识收敛”逻辑；  
  - 澄清小会与传声筒机制在 REPL / CLI 层的具体实现；  
  - 统一的规划报告目录与版本化策略。  

实现层面的详细设计与演进步骤，仍以以下文档为补充说明，但如有冲突，以本文为准：

- `docs/architecture/AGENTS-ARCH.md`  
- `docs/architecture/planning-evolution-multi-agent-2025-11-16.md`  
- `docs/architecture/planning-multi-agent-roles-io-2025-11-17.md`  
- `docs/architecture/pipeline-artifacts-and-contracts.md`  
- `docs/agents/HANDOVER-2025-11-15.md`  
- `docs/agents/NEXT-ASSISTANT-PROMPT-2025-11-15.md`

