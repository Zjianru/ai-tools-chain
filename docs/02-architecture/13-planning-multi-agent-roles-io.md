# Planning 多角色 Agent I/O 规范草案（2025-11-17）

> 说明：本文件定义各规划角色与 Coach 的 I/O 协议。  
> 如本文件与 `PLANNING-WORKSHOP-DESIGN-2025-11-17.md` 在整体流程或澄清策略上存在不一致，以后者为准。  
> 目标：为规划工作坊内部的每个角色（Product/System/SeniorDev/Test/Risk/Coach）定义清晰的输入/输出协议，  
> 为后续拆成独立 Agent 做准备。当前实现仍主要通过 `planning` / `planning_meeting` 单次调用模拟多角色，  
> 本文档是“下一步拆分”的设计草案，部分字段尚未在代码中完全落地。

---

## 1. 公共上下文（所有角色共享）

无论哪个角色，基础输入上下文是一致的：

- `task_meta`  
  - `taskId`：任务 ID。  
  - `cwd`：当前仓库根目录。  
  - `repo_summary`：仓库文件列表摘要（例如 `git ls-files` 前 100 条）。

- `planning_context`  
  - `planning_ai`：当前版 `planning.ai.json`（如有）。  
  - `plan_md`：`planning/plan.md` 文本。  
  - `plan_review`：`planning/plan-review.json`（含 openspec 结果与 issues）。  
  - `meeting_history`：`planning/planning.meeting.json/.md` 中既往轮次的概要（可选）。  
  - `transcript`：`planning.transcript.jsonl` 中的 brief 与 clarify 对话（摘要形式）。  

- `round_info`  
  - `round`：当前规划轮次（从 `state.json.actors.planning.round`）。  
  - `previous_rounds`：过去轮次的简要结论（可选）。

所有角色在协议上应当 **只读** 这些输入；任何对规划本身的修改，必须通过“建议/patch”形式输出，不直接改文件。

---

## 2. 公共输出结构：Role Verdict 基线

每个角色在本轮会议中至少输出一个“Verdict 对象”，挂载在 `planning.meeting.json.rounds[].per_role_verdicts[role]` 下。

基线 schema（已在代码中落地为 `PlanningMeetingVerdictSchema`）：

```jsonc
{
  "ok": true,                 // true/false/null：本角色是否认为规划在其关注维度上可接受
  "confidence": 0.8,          // 可选，0–1 之间的置信度
  "reasons": ["..."],         // 本角色做出 ok/not_ok 的关键理由（1–N 条）
  "suggestions": ["..."],     // 建议的优化/改动方向（1–N 条）
  "blocking_open_questions": ["..."] // 可选：该角色认为必须向用户澄清的问题（blocking 的 open_questions）
}
```

后续可以在此基础上为每个角色附加专属字段，例如：

```jsonc
{
  "ok": false,
  "confidence": 0.9,
  "reasons": ["test_plan.strategy 缺失，无法设计有效回归用例"],
  "suggestions": ["补充 test_plan.strategy，至少覆盖 happy path / error path"],
  "proposed_changes": {      // 可选：建议对 planning.ai.json 做的结构化修改
    "patch_type": "planning_patch",
    "patch": {
      "test_plan": {
        "strategy": "..."
      }
    }
  }
}
```

当前代码只消费 `ok/confidence/reasons/suggestions` 四个字段；`proposed_changes` 等扩展字段暂留作未来增强。

---

## 3. ProductPlanner（产品视角）

**职责与关注点**

- 负责业务价值与范围边界：  
  - 明确 `why/what`；  
  - 定义 `scope` 与 `non_goals`；  
  - 校验 `acceptance` 是否覆盖关键业务场景。

**主要输入**

- 来自 `planning.ai.json`：  
  - `meta.title` / `why` / `what`  
  - `requirements[]`（含 scenarios）  
  - `scope` / `non_goals`  
  - `acceptance[]`  
  - `open_questions[]`（与业务相关的疑问）
- 来自 plan-review：  
  - `issues` 中与 planning/requirements/acceptance 相关的 warning/error。

**输出（基于公共 verdict）**

- `ok` = true：  
  - scope/non_goals 边界清晰，主要业务场景有 requirements & acceptance 覆盖。  
- `ok` = false：  
  - 至少一个严重问题：范围不清、目标冲突、验收条件缺失等。  
- `reasons`：  
  - 指出 scope/requirements/acceptance 的具体缺陷。  
- `suggestions`：  
  - 建议补充/拆分需求、明确非目标、补足业务验收点。

---

## 4. SystemDesigner（系统设计视角）

**职责与关注点**

- 负责改动范围与模块视角的合理性：  
  - `targets` 与 `draft_files` 是否覆盖该做的、不越界；  
  - `file_impacts` 是否合理描述新增/修改/删除；  
  - 设计是否与既有系统结构相吻合（通过 repo_summary 推断）。

**主要输入**

- 来自 `planning.ai.json`：  
  - `targets[]`  
  - `draft_files[]`  
  - `file_impacts[]`  
  - `risks[]`（技术或架构风险）
- 来自 repo/context：  
  - `repo_summary`（文件列表快照）

**输出**

- `ok` = true：  
  - 当前 draft_files/targets/file_impacts 覆盖合理，无明显越界或遗漏。  
- `ok` = false：  
  - 例如：目标文件过粗/过细、缺少关键模块、影响面描述不清。  
- `reasons`：  
  - 针对 draft_files/targets/file_impacts 的问题。  
- `suggestions`：  
  - 建议新增/删除/调整 draft_files 和 file_impacts；  
  - 提示需要显式记录的技术风险或设计假设。

---

## 5. SeniorDeveloper（实现视角）

**职责与关注点**

- 站在“落地实现”的角度评估规划：  
  - 复杂度是否合理；  
  - 是否隐含超出一次迭代的工作量；  
  - 是否需要拆分为多个 task。

**主要输入**

- 来自 `planning.ai.json`：  
  - `tasks[]`  
  - `draft_files[]` / `targets[]`  
  - `risks[]` / `acceptance[]`

**输出**

- `ok` = true：  
  - 当前规划在一次任务维度可实现。  
- `ok` = false：  
  - 例如：任务过大、耦合度过高、缺少前置技术准备。  
- `reasons`：  
  - 指出实现难点和可能的失败点。  
- `suggestions`：  
  - 建议拆分任务、引入预研/Spike、调整优先级等。

---

## 6. TestPlanner（测试视角）

**职责与关注点**

- 负责测试计划与可测性：  
  - `test_plan.strategy/cases/automation` 是否存在且合理；  
  - requirements 是否可以映射到可执行用例；  
  - 是否存在“无法测试”的区域。

**主要输入**

- 来自 `planning.ai.json`：  
  - `requirements[]`（尤其是 scenarios）  
  - `test_plan.strategy` / `test_plan.cases[]` / `test_plan.automation`  
  - `acceptance[]`
- 来自 plan-review：  
  - `TEST_PLAN_EMPTY` 等与 test_plan 相关的 issues。

**输出**

- `ok` = true：  
  - 有明确 test_plan，覆盖主要 requirements。  
- `ok` = false（当前已经部分强利用）：  
  - strategy 缺失或明显不足；  
  - 无法对关键需求设计有效用例。  
- `reasons`：  
  - 指出 test_plan/requirements/acceptance 中的缺陷。  
- `suggestions`：  
  - 建议补充测试策略、关键用例、自动化范围；  
  - 标记哪些需求暂时无法有效测试。

---

## 7. RiskPlanner（风险视角）

**职责与关注点**

- 负责识别风险与信息黑洞：  
  - `risks[]` 是否完整；  
  - `open_questions[]` 是否指出了关键不确定性；  
  - 是否存在“无法接受”的外部依赖或前置条件。

**主要输入**

- 来自 `planning.ai.json`：  
  - `risks[]`  
  - `open_questions[]`  
  - `notes`（可选补充说明）
- 来自 plan-review：  
  - 与 openspec、结构问题相关的 error/warning。

**输出**

- `ok` = true：  
  - 风险已被合理识别并记录，剩余不确定性可接受。  
- `ok` = false（当前已经部分强利用）：  
  - 存在高风险或关键信息缺失，规划无法安全进入 codegen。  
- `reasons`：  
  - 列出高风险点与信息空白。  
- `suggestions`：  
  - 建议增加调研、缩小范围、拆分 task 或调整优先级。

---

## 8. Coach（敏捷教练 / 主持人）

**职责与关注点**

- 内部：协调与裁决（规划工作坊主持人）  
  - 召集并轮询各专家角色发言，确保每一轮讨论中每个角色都基于最新共识给出观点；  
  - 聚合各角色 verdict，控制讨论节奏，避免无限发散；  
  - 在需要时组织“用户 + 特定角色”的小会：当某个角色提出必须向用户澄清的问题时，由教练作为传声筒将问题转述给用户、再将用户回答原样+必要摘要反馈给该角色，并敦促双方对话不偏离主题；  
  - 决定本轮整体决策：`go | hold | redo_planning`。  
- 外部：向用户汇报（单一对外窗口）  
  - 用自然语言向用户解释当前规划共识与分歧，而不是暴露内部多角色细节；  
  - 输出一段简洁 summary；  
  - 给出下一步建议；  
  - 告诉用户哪些维度存在红灯/黄灯，并在需要时发起澄清对话。

**主要输入**

- 所有前述角色的 verdict：`per_role_verdicts`。  
- plan-review 结果与 openspec issues。  
- 规划工作坊的 transcript 摘要（最近几轮用户反馈）。

**输出**

- 在 `planning.meeting.json.meeting` 中：  
  - `summary`：一句话总结是否建议进入 codegen。  
  - `key_points[]`：主要结论。  
  - `risks[]`：从各角色、plan-review 综合来的风险摘要。  
  - `open_questions[]`：需要用户或后续阶段解答的问题。  
  - `next_actions[]`：明确的下一步行动建议。  
  - `decision`: `"go" | "hold" | "redo_planning"`。  
- 在 `rounds[0]` 中：  
  - `coach_summary`：对本轮讨论的简短文字总结。  

---

## 9. 每个角色还缺什么？（能力缺口与设计补充）

### 9.1 Product/System/SeniorDev：从“看描述”到“看代码”

当前三者主要只看 `planning.ai.json` 中的字段，还缺：

- 对真实代码/目录结构的更深入感知：  
  - 需要引入按模块聚合的 repo 视图（比如“模块 → 目录/文件列表”），而不仅是文件清单字符串。  
  - 为 SystemDesigner/SeniorDev 设计统一的 `code_structure` 输入：  
    ```jsonc
    {
      "modules": [
        { "name": "billing-core", "paths": ["src/billing/**"], "languages": ["java"] }
      ]
    }
    ```
- 对“多任务之间冲突”的视角：  
  - Product/System 角色未来要能看到：其它 task 是否也在改同一模块；  
  - 需要预留一个 `project_context.other_tasks[]` 输入（后续 PMO 级设计）。

设计补充（可写入 future schema，而暂不强制实现）：

- ProductPlanner 增加：  
  - `impact_summary`: 概括对用户/业务的影响；  
  - `non_goal_risks[]`: 说明 non_goals 若被误做的潜在后果。
- SystemDesigner 增加：  
  - `design_notes[]`: 针对架构/模块的简短建议；  
  - `migration_risks[]`: 若涉及重构/迁移的额外风险。  
- SeniorDeveloper 增加：  
  - `effort_estimate`: 粗粒度工作量估计（S/M/L/XL）；  
  - `split_suggestions[]`: 如认为 task 过大，给出拆分建议。

### 9.2 TestPlanner：与 /eval 的闭环

当前 TestPlanner 只在规划阶段给 verdict，还缺：

- 与 `TestAgent` 的协议绑定：  
  - 在 `test_plan` 中标记哪些 cases 建议做成 eval 步骤；  
  - 让 TestAgent 能读懂这些标记，生成/筛选 eval.conf。
- 对“测试数据/环境”的考虑：  
  - 增加 `test_plan.data_requirements[]` 和 `env_requirements[]` 字段，提示需要的测试账户/配置/依赖服务。

设计补充：

- 在 verdict 中增加：  
  ```jsonc
  {
    "ok": false,
    "reasons": ["缺少回归用例"],
    "suggestions": ["为 REQ-1/REQ-2 各增加至少 1 条回归用例"],
    "eval_links": [
      { "case": "用户正常下单", "suggested_step": "e2e_order_flow" }
    ]
  }
  ```
- 中期可以让 TestPlanner 为 eval 贡献“命名好的测试步骤提示”，而 TestAgent 负责把它们映射到实际命令。

### 9.3 RiskPlanner：与跨阶段门禁规则

当前 RiskPlanner 的 not_ok 只在规划会议内部触发 soft gate，还缺：

- 对“无法接受的风险”的更明确枚举：  
  - 例如 `severity: low|medium|high|critical`，以及 `blocker: boolean`。  
- 与跨阶段决策的约束：  
  - 一旦存在 `blocker = true` 的风险，后续阶段（尤其是 codegen/accept）至少要有显式提示甚至禁止自动前进。

设计补充：

- 在 verdict 中增加：  
  ```jsonc
  {
    "ok": false,
    "confidence": 0.9,
    "reasons": ["外部支付服务 API 不明确，无法定义错误处理策略"],
    "suggestions": ["先明确支付 API 契约，或降级为本地 mock 模式"],
    "blocker": true
  }
  ```
- 未来 Orchestrator 或 Coach 可据此将 `decision` 强制设为 `"redo_planning"` 或 `"hold"`。

### 9.4 Coach：对话节奏与多轮记忆

当前 Coach 更多是“合成一次性决策”，还缺：

- 对多轮对话的节奏约束：  
  - 例如“每轮最多问 3 个澄清问题”“用户连续两轮都表示困惑时，建议缩小范围”。  
- 对记忆的主动管理：  
  - 哪些信息写入 `planning.memory.jsonl`，哪些仅留在当轮；  
  - 如何在新一轮 `/plan` 时，给用户回顾上一轮讨论的要点。

设计补充：

- 为 Coach 定义一个 `conversation_policy`：  
  ```jsonc
  {
    "max_questions_per_round": 3,
    "max_rounds_before_summary": 2,
    "always_remind_scope_before_codegen": true
  }
  ```
- 将 Coach 对话策略写入 prompt 和 meeting.meeting 中，作为这个角色“人格”的一部分。

---

## 10. 后续拆分为独立 Agent 的方向

在当前“单次调用 + 多 persona”基础上，未来拆分可按以下顺序推进：

1. 为每个角色新增独立 prompt 文件与模型 role：  
   - 如 `prompts/planning/ProductPlanner.system.md`；  
   - 在 `models.conf` 中声明对应 role。  
2. 增加中间层 orchestrator：  
   - 依次调用 Product/System/Test/Risk/SeniorDev 角色；  
   - 汇总各自 verdict + proposed_changes。  
3. 将教练逻辑（Coach）拆成独立 Agent：  
   - 只消费各角色 verdict 与 plan-review 结果；  
   - 负责写入 `planning.meeting.json/.md` 与决策。  

本文件中的 I/O 规范应作为拆分时的参考：**先保证 schema 和职责稳定，再逐步从“单模型多 persona”迁移到“多 Agent + 状态机”实现**。***

---

## 11. 讨论协议（多轮、多角色）

> 本节定义“讨论/开会”本身的协议：当多个规划角色围绕某个议题开会时，  
> 如何按轮次、顺序、有记忆地进行多轮发言与收敛，直到所有角色达成共识。

### 11.1 基本概念

- **议题（topic/issue）**  
  - 一次讨论围绕一个明确议题展开，例如：“scope 是否过大”“test_plan 是否足够”。  
  - 每个议题应有一个稳定的 `issue_id`：  
    ```jsonc
    {
      "issue_id": "scope-too-broad",
      "title": "本次规划的 scope 是否过大",
      "created_at": "2025-11-17T12:34:56Z"
    }
    ```

- **轮次（round）**  
  - 每轮包含一个固定的发言顺序：Product → System → SeniorDev → Test → Risk → Coach。  
  - 同一轮内，每个角色最多发言一次（可以选择“无新意见”）。  

- **立场（position）**  
  - 每次角色发言都应明确立场：  
    - `"agree"`：同意当前规划在本议题上的状态；  
    - `"concern"`：有疑虑但不认为必须阻塞；  
    - `"block"`：认为必须解决后才能继续；  
    - `"skip"`：本轮不发言（例如已在上一轮明确同意、不再补充）。  

### 11.2 单轮讨论记录结构

在 `planning.meeting.json` 中，为每个议题新增一个 `issues_discussion[]`（命名可后续微调）：

```jsonc
{
  "issue_id": "scope-too-broad",
  "title": "本次规划的 scope 是否过大",
  "rounds": [
    {
      "round": 1,
      "at": "2025-11-17T12:34:56Z",
      "entries": [
        {
          "role": "ProductPlanner",
          "position": "block",
          "comment": "当前 scope 覆盖了两个迭代的内容，建议拆分。",
          "based_on_roles": [],   // 首轮可为空
          "verdict_snapshot": {   // 可选，记录当轮该角色的 verdict 摘要
            "ok": false,
            "reasons": ["..."]
          }
        },
        {
          "role": "SystemDesigner",
          "position": "concern",
          "comment": "draft_files 涵盖两个子系统，建议按模块拆 task。",
          "based_on_roles": ["ProductPlanner"]
        },
        {
          "role": "SeniorDeveloper",
          "position": "concern",
          "comment": "实现工作量较大，但可通过拆分子任务解决。",
          "based_on_roles": ["ProductPlanner", "SystemDesigner"]
        },
        {
          "role": "TestPlanner",
          "position": "block",
          "comment": "当前 test_plan 无法覆盖所有场景，建议明确 M1/M2 的边界。",
          "based_on_roles": ["ProductPlanner"]
        },
        {
          "role": "RiskPlanner",
          "position": "concern",
          "comment": "不清楚第二阶段的外部依赖，建议在 notes 中明确。",
          "based_on_roles": ["ProductPlanner", "SystemDesigner"]
        },
        {
          "role": "Coach",
          "position": "block",
          "comment": "综合来看，应先缩小 scope，再重新确认 test_plan。",
          "based_on_roles": ["ProductPlanner", "TestPlanner"]
        }
      ]
    }
  ]
}
```

说明：

- `based_on_roles[]` 用于记录该发言引用/回应了哪些角色的观点，帮助回放“谁影响了谁”。  
- `verdict_snapshot` 可选：用于记录当轮该角色在其整体 verdict（`per_role_verdicts`）中的状态，便于对比前后变化。

### 11.3 多轮讨论与共识规则

**发言顺序与输入：**

- 每轮固定发言顺序：Product → System → SeniorDev → Test → Risk → Coach。  
- 从第二轮开始，每个角色在思考时都应携带上一轮所有角色的发言和立场：  
  - 输入增加 `previous_rounds`，包含上一轮的 entries 摘要。  
  - 角色可以选择：维持原立场、调整为 agree、提出新的 concern/block。

**是否开启下一轮（由 Coach 决策）：**

- Coach 在每轮结束时检查所有角色的立场：  
  - 若存在任一角色 `position = "block"`，则必须开启新一轮讨论（前提是有可讨论空间）；  
  - 若只有 `concern`，由 Coach 判断是通过调整规划（例如缩小 scope）进入下一轮，还是直接以 “hold” 决策结束当前议题；  
  - 若全部角色 `position = "agree"` 或 `position = "skip"`，则认为本议题达成共识，讨论结束。

**跳过已达成共识的角色：**

- 从第二轮开始，若某角色在上一轮已经 `position = "agree"`，且其关注点未被后续讨论明显改变：  
  - 在新一轮中允许该角色直接输出一条 `position = "skip"` 的 entry，或者完全省略该角色的 entry；  
  - Coach 在 summary 中可以标记“本轮跳过了已达成共识的角色 A/B/C”。

**结束条件与输出：**

- 当所有角色在某一轮后 `position` 均为 `"agree"` 或 `"skip"`：  
  - 该议题的 `status` 记为 `"resolved"`；（当前实现中，简化为当 Coach 的整体 `decision = "go"` 时视为 resolved，其它情况视为 `"unresolved"`）  
  - Coach 在 `meeting.summary` 与 `next_actions` 中写入结论与对应改动建议（如“scope 已缩小为 A/B，下一步按照新规划进入 codegen”）。  
- 若讨论达到预设最大轮次仍存在 `block`：  
  - 该议题的 `status` 记为 `"unresolved"`；  
  - Coach 的 `decision` 倾向设为 `"redo_planning"` 或 `"hold"`，并在 `risks/open_questions` 中明确记录未解决点。

### 11.4 与现有产物的关系

- `per_role_verdicts`：  
  - 表示本轮会议每个角色的整体结论（跨议题的综合 verdict）。  
  - 可从 `issues_discussion` 中按角色聚合，也可以单独调用 per-role 模型生成。  
- `planning.memory.jsonl`：  
  - 建议将 `issues_discussion.rounds[].entries` 的精简版本写入 memory：  
    - 如 `kind = "discussion_entry"`, `content = { issue_id, round, role, position, comment }`。  
  - 方便未来对某个议题做“时间轴回放”或跨任务分析。

> 当前代码阶段：我们已具备 per-role verdict、多模型调用和简单决策，  
> 本节定义的“按议题多轮讨论协议”暂未完全实现，作为下一阶段演进的明确规范。  

---

## 12. 规划工作坊后续细化 TODO（备忘）

> 以下为当前尚未完全落地、但在本文件或其它文档中已经有雏形的细化点，可作为后续迭代 TODO。

1. **issues_discussion 多议题化与状态细化**  
   - 目前仅有默认议题 `overall-planning`，status 简化为由 Coach decision 推导：`go → resolved`，否则 `unresolved`。  
   - TODO：  
     - 根据 plan-review issues/test_plan/scope 等拆分成多个 `issue_id`；  
     - 按议题维度记录 `status: resolved/unresolved` 与根因摘要。

2. **多轮讨论的“跳过规则”和立场变化记录**  
   - 现在仅记录单轮 entries，未显式标记从 `block/concern → agree` 的变化。  
   - TODO：  
     - 在后续轮次中为已达成共识的角色生成 `position = "skip"` 的 entry 或完全略过；  
     - 为 entries 增加 `previous_position` 字段，记录立场变化。

3. **per-role verdict 扩展字段落地**  
   - 文档中为各角色设计了扩展字段（如 Product 的 `impact_summary`、Test 的 `eval_links`、Risk 的 `severity/blocker`），当前未在 schema 中体现。  
   - TODO：  
     - 在 `PlanningMeetingVerdictSchema` 中逐步加入这些字段；  
     - 在 planning_meeting.md 和 roles/*.meeting.md 中展示这些扩展字段。

4. **TestPlanner 与 /eval 的闭环**  
   - 现在 TestPlanner 只在规划阶段给出 verdict 和建议。  
   - TODO：  
     - 在 `test_plan` 中支持 `eval_links[]`，由 TestPlanner 填写；  
     - 在 `TestAgent` 中读取这些链接，为 eval 生成或筛选步骤。

5. **RiskPlanner 与跨阶段门禁的集成**  
   - 目前 RiskPlanner 的 not_ok 仅在 planning_meeting 内部影响 decision。  
   - TODO：  
     - 为 RiskPlanner verdict 增加 `severity/blocker` 字段；  
     - 在规划之后的关键命令（/codegen /accept）前，对 blocker 级风险给出更强的提示甚至禁止自动前进。

6. **Coach 的对话节奏策略**  
   - 现在 Coach 的行为主要是合成 summary + decision，未显式建模对话节奏。  
   - TODO：  
     - 引入 `conversation_policy`（如每轮问题上限、最大轮次、何时强制总结）；  
     - 在 `planning.memory.jsonl` 中根据该策略记录关键对话节点。

7. **记忆与讨论记录的统一**  
   - 目前 memory 中有决策、per-role verdict、summary、open_questions，而 issues_discussion 只存于 meeting JSON。  
   - TODO：  
     - 将 `issues_discussion.rounds[].entries` 的简化版本同步写入 memory（kind = "discussion_entry"）；  
     - 为后续按议题/按角色回放会议提供统一的数据源。
