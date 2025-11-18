# AI Planning Schema & Prompt Design (Draft)

> 目标：让模型主导规划阶段的“内容”，包括需求拆解与 draft_files 列表；由程序根据统一的 JSON schema 机械生成 OpenSpec 文本与辅助文件；并支持多轮澄清对话与完整日志。

---

## 1. 顶层结构与 status 协议

规划模型（role: `planning`）的输出约定为一个 JSON 对象：

```json
{
  "status": "need_clarification" | "ready",
  "questions": ["..."],
  "planning": { /* 见下文 schema */ }
}
```

- `status`：
  - `"need_clarification"`：当前信息不足以安全生成规划，应在 `questions` 中给出 1–3 个需要用户回答的澄清问题；此时 `planning` 可为 `null` 或空对象。
  - `"ready"`：信息充足，可以输出完整规划；此时 `questions` 应为空数组，`planning` 必须符合下文 schema。
- `questions`：
  - 当 `status = "need_clarification"` 时使用；
  - 每次最多 3 个问题，聚焦于影响需求定义与设计决策的关键点。
- `planning`：
  - 当 `status = "ready"` 时必须填充；
  - 承载后续 OpenSpec、codegen、review 所需的全部结构化信息。

---

## 2. planning.ai.json 目标 schema（初版）

当 `status = "ready"` 时，`planning` 字段目标结构如下（字段可迭代，但尽量保持兼容）：

```json
{
  "schema_version": 1,
  "meta": {
    "id": "task-20251114-2259-001",
    "title": "为 src 添加一个 Java 打印逻辑",
    "risk": "low | medium | high | critical",
    "owner": "@you"
  },
  "why": "为什么要做（1–3 句话）",
  "what": "大致改动内容（1–3 段文字）",

  "requirements": [
    {
      "id": "REQ-1",
      "title": "在 src 中添加一个 Java 程序，打印“好你”",
      "shall": "The system SHALL print the exact string \"好你\" to stdout when the new script is invoked.",
      "rationale": "可选，解释原因或背景",
      "scenarios": [
        {
          "name": "basic invocation",
          "steps": [
            "开发者在项目根目录运行约定命令（例如 ./scripts/hello.sh）。",
            "终端输出一行：`好你`。"
          ],
          "notes": "可选补充说明/边界情况。"
        }
      ]
    }
  ],

  "targets": [
    "src/",
    "scripts/"
  ],

  "risks": [
    "误改现有业务代码，导致构建失败。",
    "Shell/Java 版本兼容性问题。"
  ],

  "acceptance": [
    "在项目根目录执行约定脚本能打印“好你”。",
    "CI 中相关测试通过。"
  ],

  "draft_files": [
    "src/Main.java",
    "scripts/hello.sh"
  ],

  "tasks": [
    "在 src 下添加 Java 入口类 Main，完成打印逻辑。",
    "在 scripts 下添加 hello.sh，调用 Java 程序或直接打印。",
    "为新逻辑添加至少一个自动化测试。",
    "更新 README 或相关文档。"
  ],

  "notes": "可选的补充说明或待确认事项。"
}
```

约束与用途：

- `schema_version`：用于未来 schema 调整时做兼容处理（当前为 1，后续演进时只追加字段，尽量不破坏已存在的键）。
- `meta`：用于 change.md 的 YAML 头部（id/title/risk/owner）。
- `why` / `what`：用于 change.md 的 `## Why` / `## What Changes` 段。
- `requirements`：
  - 每条 requirement 将映射为 spec.md 中的一个 requirement 区块；
  - `shall` 必须使用英文 SHALL 句式，方便 OpenSpec 校验；
  - 每条 requirement 至少应有一个 scenario。
- `targets`：用于 change.md 的 `## Targets` 段。
- `risks`：用于 change.md 的 `## Risks and Mitigations` 段。
- `acceptance`：用于 change.md 的 `## Acceptance` 段。
- `draft_files`：
  - 将写入 `tasks/<taskId>/plan.files.json` 中的 `files` 数组；
  - codegen 仅对这些文件进行生成/修改（如为空则宁可失败，不做兜底）。
- `tasks`：用于 tasks.md 的任务列表。
- `notes`：仅用于人类阅读与后续调整，不直接进入 OpenSpec 校验逻辑。

### 2.1 规划信息的后续扩展方向（暂不强制）

在不破坏现有字段的前提下，未来可以按以下方向逐步丰富 `planning`：

- `scope` / `non_goals`：
  ```json
  "scope": ["本次必须完成的范围点"],
  "non_goals": ["本次明确不做的事情"]
  ```
  - 用于在 plan.md 或 planning 摘要中更清晰地表达任务边界。

- `design`（实现思路）：
  ```json
  "design": {
    "overview": "整体实现思路（1–3 段）",
    "key_decisions": ["关键设计决策 1", "关键设计决策 2"],
    "alternatives": ["曾考虑但放弃的方案（可选）"],
    "dependencies": ["依赖的模块/外部服务（可选）"]
  }
  ```
  - 主要服务于 codegen/review 阶段的上下文，不必全部映射到 OpenSpec。

- `file_impacts`（按文件的影响说明）：
  ```json
  "file_impacts": [
    {
      "path": "src/Calculator.java",
      "purpose": "新增一个简单计算器类，用于演示",
      "type": "create | modify | delete",
      "notes": "例如与哪些现有类交互"
    }
  ]
  ```
  - `path` 可汇总到 `draft_files` 中驱动 codegen；
  - 其余字段用于生成更细粒度的提示（设计/审查摘要）。

- `test_plan`（测试与验收细化）：
  ```json
  "test_plan": {
    "strategy": "整体测试策略",
    "cases": ["测试用例 1", "测试用例 2"],
    "automation": "需要/不需要自动化测试及范围"
  }
  ```
  - 与 `acceptance` 配合，为 eval/CI 设计提供参考。

- `open_questions`（开放问题）：
  ```json
  "open_questions": ["仍然不确定的问题 1", "问题 2"]
  ```
  - 在 REPL 摘要中可以单独展示，提醒用户规划中尚待澄清的部分。

> 以上字段目前视作“可选扩展”，优先在 prompt 中尝试产出，同时确保 JSON→OpenSpec 映射在字段缺失时采取“有则用、无则跳过”的策略。

---

## 3. JSON → OpenSpec 文本映射（机械生成）

基于上述 schema，代码层将按如下方式生成 OpenSpec 文件：

- `change.md`
  - YAML front-matter：
    - `id` ← `planning.meta.id` 或 `task-<taskId>`
    - `title` ← `planning.meta.title`
    - `owner` ← `planning.meta.owner`（默认 `@you`）
    - `risk` ← `planning.meta.risk`（默认 `medium`）
  - 正文：
    - `## Why` ← `planning.why`
    - `## What Changes` ← `planning.what`
    - `## Requirements` ← `planning.requirements[].title` 或简化描述
    - `## Targets` ← `planning.targets`
    - `## Risks and Mitigations` ← `planning.risks`
    - `## Acceptance` ← `planning.acceptance`

- `specs/task/spec.md`
  - 开头：`## ADDED Requirements`
  - 对于每个 `requirements[i]`：
    ```markdown
    ### Requirement: <title> (ID: <id>)

    The system SHALL: <shall>

    #### Scenario: <scenario.name>
    - <scenario.steps[0]>
    - <scenario.steps[1]>
    ...
    ```

- `tasks.md`
  ```markdown
  # Tasks

  1. <tasks[0]>
  2. <tasks[1]>
  ...
  ```

- `plan.files.json`
  ```json
  { "files": [ /* draft_files */ ] }
  ```

---

## 4. planning prompt 设计要点（待细化）

在 `planning` 角色的系统 prompt 中，需要明确：

1. 角色与目标
   - 你是资深软件规划助手，负责为单个开发任务产出规范、可执行的规划 JSON，用于驱动 OpenSpec 和后续 codegen/review/eval。

2. 输出契约
   - 严格输出一个 JSON 对象，结构为：
     - `status`: `"need_clarification"` 或 `"ready"`;
     - `questions`: string[]；
     - `planning`: 对象，符合本文件定义的 schema。
   - 不允许输出 Markdown 代码块标记（```）、注释或额外解释文字。

3. status 与多轮澄清规则
   - 若当前信息不足以安全生成规划：
     - 设 `status = "need_clarification"`；
     - 在 `questions` 中给出 1–3 个关键问题（避免一次性问太多）；
     - `planning` 可以为空对象。
   - 若信息已经足够：
     - 设 `status = "ready"`；
     - `questions` 置为空数组；
     - 完整填充 `planning` 对象（尤其是 `requirements` 与 `draft_files`）。
   - 多轮约束（实现层约定）：
     - 系统最多允许 3–5 轮 `need_clarification` 循环；到达上限仍无法 `ready` 时，模型应在 `notes` 中说明无法给出可靠规划的原因，并给出当前最保守的建议。

4. draft_files 的约束
   - `draft_files` 应列出你建议新增/修改的具体文件路径，后续 codegen 只对这些文件生成代码；
   - 尽量复用现有目录结构，如 `src/`, `app/`, `scripts/`；
   - 不要包含依赖目录或构建产物目录（如 `node_modules`, `build/`, `.git/` 等）。

5. requirements 与 scenarios 的要求
   - 每条 requirement 都应有一个简洁明了的 `title` 和一条英文 SHALL 句式的 `shall` 描述；
   - 如有必要，补充 `scenarios`，列出典型使用场景及步骤，用于驱动验收与测试。

6. 失败与 notes
   - 当你仍然无法给出可靠规划时，应在 `notes` 中说明原因和需要进一步澄清的问题，但仍输出一个结构完整的 JSON（使用最保守假设）。

7. 计费与 usage 记录（后续增强）
   - 各 provider 的计费规则不同（按 tokens 或按调用），因此当前阶段仅记录原始 `usage` 字段（如 prompt_tokens / completion_tokens / total_tokens），不试图在 CLI 内计算金额。
   - 后续可按 provider 维护一份价格表，在日志聚合或 UI 层估算 cost，但不应硬编码在规划 prompt 中。

> 后续工作：将本文件中的 schema 与约束固化到 `planning` 的系统 prompt 中（可放在 `.ai-tools-chain/prompts/planning.md`），并在 `runAIPlanningAndOpenSpec` / REPL `/plan` 中实现多轮 `status`/`questions` 对话循环（带 history），将最终 `planning` 对象传入 OpenSpec 映射逻辑；在此基础上，对 codegen / review / second_opinion 等角色也统一记录 usage，以便后续做跨 provider 的计费统计。 

---

## 5. Planning Meeting（规划会议）schema（初版草案）

> 说明：本节定义 `tasks/<taskId>/planning/planning.meeting.json` 的目标结构。  
> 当前实现只覆盖其中一部分字段，剩余字段将在 M12 及之后逐步填充。

顶层结构建议如下：

```json
{
  "taskId": "20251117-1500-001",
  "title": "为项目添加一个 shell 计算器",
  "ok": true,
  "planning_summary": {
    "why": "...",
    "what": "...",
    "scope": "...",
    "nonGoalsCount": 1,
    "openQuestionsCount": 0,
    "requirementsCount": 3,
    "draftFilesCount": 2,
    "acceptanceCount": 2
  },
  "issues": [],
  "plan_md_present": true,

  "rounds": [
    {
      "round": 1,
      "at": "2025-11-17T15:00:00.000Z",
      "input_snapshot": {
        "brief": "用户原始需求文本或摘要",
        "user_feedback": "上一轮用户反馈的要点（如有）"
      },
      "per_role_verdicts": {
        "product": {
          "ok": true,
          "confidence": 0.8,
          "reasons": ["需求范围基本清晰", "non_goals 仍可补充"],
          "suggestions": ["在下一轮补上非目标说明"]
        },
        "system": {
          "ok": true,
          "confidence": 0.7,
          "reasons": ["技术方案可行"],
          "suggestions": []
        },
        "test": {
          "ok": false,
          "confidence": 0.9,
          "reasons": ["缺少 test_plan.cases"],
          "suggestions": ["下一轮需补充关键用例"]
        }
      },
      "options": [
        {
          "name": "方案 A：纯 shell",
          "pros": ["实现最快", "依赖最少"],
          "cons": ["扩展性有限"]
        }
      ],
      "coach_summary": "本轮确认了需求范围与技术方案，测试同学要求下一轮补充 test_plan。",
      "decision": "redo_planning"  // go | hold | redo_planning | ask_user | ask_more_info
    }
  ],

  "ai_meeting": {
    "summary": "自然语言会议总结（当前可选字段）",
    "key_points": ["..."],
    "risks": ["..."],
    "open_questions": ["..."],
    "next_actions": ["..."],
    "decision": "go | hold | redo_planning"
  }
}
```

字段说明（初版）：

- 顶层：  
  - `taskId` / `title`：与 `planning.ai.json` 对齐，用于快速定位会议上下文；  
  - `ok`：整体 gate 结果（目前等价于 plan_review.ok），未来可以综合多轮决策；  
  - `planning_summary`：基于当前规划提炼出的核心统计信息，便于 codegen/review/test 快速了解范围与密度；  
  - `issues`：来自 plan_review + openspec 的问题列表；  
  - `plan_md_present`：是否存在 plan.md。

- `rounds[]`：  
  - 每个元素代表一次“规划写作轮次”（Round），这是 M12 以后的重点扩展对象；  
  - `input_snapshot`：本轮开始时的输入情况，至少包含 brief/用户反馈摘要；  
  - `per_role_verdicts`：按角色记录各自的判断与建议：  
    - 角色命名建议：`product/system/test/risk/...`，后续可在文档中固化；  
    - 每个 verdict 中的字段为：  
      - `ok`：该角色是否认为当前规划在其职责范围内可接受；  
      - `confidence`：0–1 之间的置信度（可选）；  
      - `reasons[]`：主要原因；  
      - `suggestions[]`：下一轮应做的调整或需要补充的信息。  
  - `options[]`：本轮如果出现了多个备选方案，记录各方案的 name/pros/cons，便于后续对比；  
  - `coach_summary`：敏捷教练对本轮讨论的总结，用人话解释“我们干了什么、结论是什么”；  
  - `decision`：本轮的决策，取值建议：  
    - `"go"`：可以进入 codegen；  
    - `"hold"`：当前轮先不进入 codegen，但不强制 redo，可等用户进一步反馈；  
    - `"redo_planning"`：需要新一轮规划；  
    - `"ask_user"`：需要用户回答某些问题；  
    - `"ask_more_info"`：需要内部专家进一步调研。

- `ai_meeting`：  
  - 保持与现有 `planning_meeting` 模型输出兼容的字段：`summary/key_points/risks/open_questions/next_actions/decision`；  
  - 当前实现已部分使用这些字段来生成 Markdown 会议纪要，未来可以将其视为“教练视角”的自然语言补充。

当前实现情况（M11/M11+）：

- 已存在的字段：`taskId/title/ok/planning_summary/issues/plan_md_present/ai_meeting`；  
- 尚未实现但在本 schema 中预留的字段：`rounds[]/per_role_verdicts/options/coach_summary/decision`。  

> 约定：在这些字段未完全实现之前，消费方（codegen/review/test/Orchestrator）应将它们视为 **best-effort 增强信息**，  
> 缺失时不得导致流程失败；对外协议如有调整，应更新本节定义并在变更说明中标明版本。
