# Schema: Planning (planning.ai.json)

This document defines the structure of the **planning output** written to:

```text
.ai-tools-chain/tasks/<id>/planning/planning.ai.json
```
It is the single source of truth for the structured plan produced by the
PlanningAgent.

plan.md and plan.files.json are projections derived from this JSON.

> **Implementation note**
> - The `TestAgent` (`src/agents/testAgent.mjs`) consumes `planning.test_plan`
>   to print a test strategy summary before running evaluations.
> - This creates a direct link between planning and the test phase.

⸻

1. Top-level shape
```json
{
  "id": "TASK-001",
  "title": "Short human-readable task title",
  "brief": "Original brief or refined problem statement",
  "context": {
    "repository": "...",
    "milestone": "M1",
    "priority": "P1",
    "depends": ["TASK-000"],
    "notes": "Optional extra context"
  },
  "goals": [
    {
      "id": "G1",
      "description": "What success looks like for this task."
    }
  ],
  "scope": {
    "in_scope": [
      "Things we explicitly intend to change or deliver."
    ],
    "out_of_scope": [
      "Things explicitly not touched by this task."
    ]
  },
  "work": {
    "tasks": [],
    "milestones": []
  },
  "risks": [],
  "assumptions": [],
  "acceptance_criteria": [],
  "file_plan": [],
  "notes": []
}
```
All sections are described below.

⸻

2. Fields

2.1 id (string, required)
	•	Identifier for this task, usually matching the timeline id.
	•	Example: "TASK-001".

2.2 title (string, required)
	•	Short, human-readable title summarizing the task.

2.3 brief (string, required)
	•	Refined, self-contained problem statement.
	•	May expand on the original user brief.

⸻

3. context (object, optional but recommended)
```json
"context": {
  "repository": "monorepo-name or path",
  "milestone": "M1: Planning MVP",
  "priority": "P0",
  "depends": ["TASK-0001", "TASK-0002"],
  "timeline_ref": "docs/planning/timeline.md#TASK-001",
  "notes": "Any extra high-level context."
}
```
Fields:
	•	repository (string) – name or path of the repo, if relevant.
	•	milestone (string) – corresponds to timeline milestone.
	•	priority (string) – typically P0–P3.
	•	depends (array of string) – IDs of dependent tasks.
	•	timeline_ref (string) – link to the timeline row, if available.
	•	notes (string) – miscellaneous context.

⸻

4. goals (array of objects)

Each goal describes an outcome.
```json
"goals": [
  {
    "id": "G1",
    "description": "Implement an end-to-end planning MVP for a single task.",
    "success_metrics": [
      "A task can be planned, reviewed, and accepted end-to-end.",
      "Core artifacts exist and are valid."
    ]
  }
]
```
Fields:
	•	id (string) – local identifier (G1, G2, …)
	•	description (string, required)
	•	success_metrics (array of string, optional)

⸻

5. scope (object)
```json
"scope": {
  "in_scope": [
    "Planning flow for a single task.",
    "Artifacts: planning.ai.json, plan.md, plan.files.json."
  ],
  "out_of_scope": [
    "Multi-repo coordination.",
    "Cross-task orchestration."
  ]
}
```
Fields:
	•	in_scope (array of string, required)
	•	out_of_scope (array of string, optional)

⸻

6. work (object)

Contains tasks and optional milestones.

6.1 work.tasks (array)

Each entry:
```json
{
  "id": "T1",
  "title": "Implement PlanningAgent skeleton",
  "description": "High-level description of the work item.",
  "kind": "implementation",
  "depends": ["T0"],
  "eta": "2025-03-10",
  "risk_level": "medium",
  "status": "planned",
  "notes": "Any extra notes."
}
```

Fields:
	•	id (string, required) – local task ID (within this plan).
	•	title (string, required)
	•	description (string, optional)
	•	kind (string, optional) – e.g. design, implementation, testing, spike.
	•	depends (array of string, optional) – dependencies between plan-level tasks.
	•	eta (string, optional, YYYY-MM-DD or TBD).
	•	risk_level (string, optional) – low, medium, high.
	•	status (string, optional) – simple status label, e.g. planned.
	•	notes (string, optional).

6.2 work.milestones (array, optional)

```json
{
  "id": "M1",
  "title": "Planning MVP",
  "description": "First end-to-end planning experience.",
  "tasks": ["T1", "T2", "T3"]
}
```
Fields:
	•	id (string)
	•	title (string)
	•	description (string, optional)
	•	tasks (array of string) – references to work.tasks[].id.

⸻

7. risks (array)

Each risk entry:

```json
{
  "id": "R1",
  "description": "Planning artifacts become stale and diverge from code.",
  "likelihood": "medium",
  "impact": "high",
  "mitigations": [
    "Make planning artifacts easy to update.",
    "Keep planning docs close to code."
  ]
}
```
Fields:
	•	id (string)
	•	description (string, required)
	•	likelihood (enum) – low, medium, high (recommended).
	•	impact (enum) – low, medium, high.
	•	mitigations (array of string, optional).

⸻

8. assumptions (array)

```json
{
  "id": "A1",
  "description": "Developers are comfortable running CLI tools locally.",
  "status": "open"
}
```

Fields:
	•	id (string)
	•	description (string, required)
	•	status (string, optional) – e.g. open, validated, invalid.

⸻

9. acceptance_criteria (array)

```json
{
  "id": "AC1",
  "description": "A single task can be planned and reviewed end-to-end.",
  "must_have": true
}
```

Fields:
	•	id (string)
	•	description (string, required)
	•	must_have (boolean, optional, default true).

These map directly to what the accept phase will check.

⸻

10. file_plan (array)

Each entry describes intended changes at the file level.

```json
{
  "path": "docs/system/phases/planning.md",
  "intent": "create_or_update",
  "role": "doc",
  "summary": "Document the planning phase.",
  "notes": "Align with planning-schema.md"
}
```

Fields:
	•	path (string, required) – relative file path.
	•	intent (enum, required) – e.g. create, update, delete, create_or_update.
	•	role (string, optional) – code, doc, config, etc.
	•	summary (string, optional) – short description of the change.
	•	notes (string, optional).

This is the main input for the codegen phase regarding scope.

⸻

11. notes (array, optional)

```json
{
  "id": "N1",
  "kind": "open_question",
  "text": "Should timeline be auto-updated by the CLI?"
}
```

Fields:
	•	id (string)
	•	kind (string) – e.g. open_question, decision, background.
	•	text (string, required).

⸻

12. Validation & invariants
	1.	id, title, brief MUST be present.
	2.	file_plan[].path MUST be unique within the array.
	3.	work.tasks[].id MUST be unique.
	4.	References from:
	•	work.milestones[].tasks → work.tasks[].id
	•	MUST be valid.

If validation fails, PlanningAgent should:
	•	surface errors,
	•	and either re-prompt the model or ask the user to fix the plan manually.

### X. test_plan (object, optional)

> 测试计划：由规划阶段给 Test Phase 提供的“期望测试范围”。

- `strategy` (string, optional)
  - 总体测试策略描述，如 “单元测试覆盖核心用例 + 简单集成测试”。
- `cases[]` (string[], optional)
  - 关键测试用例的自然语言描述。
- `automation` (string, optional)
  - 自动化程度说明，例如 “仅手工测试” / “必须有自动化” / 指定框架等。

实现备注（Implementation note）：

- PlanningAgent 在生成 `planning.ai.json` 时会同时生成 `test_plan`；
- `plan.md` / 规划报告会根据 `test_plan` 生成 “Test Plan / 测试计划摘要” 小节；
- Test 阶段后续将使用该部分来决定：
  - 哪些测试必须存在；
  - 哪些用例可以作为 promptfoo / E2E 的输入。

---

### Y. memory / meeting.jsonl 衍生文件

虽然 `meeting.jsonl` 的 schema 已在 `planning-meeting-schema.md` 中定义，但项目还会使用一个**规划记忆文件**来记录跨轮次信息，例如：

- `planning.memory.jsonl`（名称可调整，以实际实现为准）。

该文件用于：

- 存储教练总结、风险聚合、跨轮次信号；
- 为下一轮规划、后续 review / accept 提供上下文。

实现备注（Implementation note）：

- `src/planning/memory.mjs` 负责读写该文件；
- 目前该机制已在代码中试验性使用，但文档只要求：
  - memory 文件是 **附加的**（可选）；
  - 不作为唯一真相源，SSOT 仍是 `planning.ai.json` 与 `plan.md`。