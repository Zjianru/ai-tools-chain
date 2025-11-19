# Timeline Specification

The **timeline** is the project-level view of work.

It answers questions like:

- What tasks exist?
- How do they relate to milestones?
- What is the current status and priority?
- Where can I jump into the system to continue work?

This document defines the timeline as a **contract**.

---

## 1. Purpose and scope

The timeline is the **single source of truth (SSOT)** for:

- which units of work (tasks) exist,
- how they are grouped into milestones or themes,
- and what their current status is.

It is **project-scoped**:

- There is exactly one timeline per project repository.
- All tasks run by the CLI for this repo should either:
  - have an entry in the timeline, or
  - be explicitly marked as “scratch / experiment” in the task metadata.

The timeline is a **human-editable file** (typically a markdown table) with a
fixed schema described in:

- `planning/timeline-schema.md`

This document focuses on semantics and behavior.

---

## 2. File location and format

By convention, the main timeline file lives at:

- `docs/planning/timeline.md` (or a project-specific location documented here).

The file:

- is a markdown document,
- contains one or more tables,
- where at least one table conforms to the timeline schema.

The table is row-oriented: each row corresponds to **one logical item of work**.

The canonical column set is defined in `planning/timeline-schema.md`, and
typically includes columns such as:

- `id`
- `type`
- `title`
- `milestone`
- `eta`
- `priority`
- `status`
- `depends`
- `design_link`
- `accept_link`
- `notes`

---

## 3. Relationship to tasks and `state.json`

At runtime, work is done in per-task directories under `.ai-tools-chain/`.

A **timeline row** and a **task** relate as follows:

- `timeline.id` ↔ `task.id` (or a well-defined mapping).
- `timeline.status` ↔ projection of `task.state.phase` and acceptance decision.
- `timeline.accept_link` ↔ path to the canonical acceptance artifact.

### 3.1 One-to-one vs one-to-many

The intended default is:

- **One timeline row ↔ one task directory.**

However, the system should tolerate:

- A single timeline item being implemented via multiple tasks (e.g. spikes).
- Scratch tasks that are not (yet) reflected in the timeline.

When there is ambiguity, the timeline row should point to the **primary** task
that contains the canonical accepted work.

### 3.2 Mapping rules (recommended)

Implementation details can vary, but the recommended mapping is:

- `timeline.id` matches `tasks/<id>/` directory name.
- `accept_link` points to a stable artifact inside the task, e.g.:
  - `.ai-tools-chain/tasks/<id>/accept/decision.json`
  - or a README-like summary file in the task directory.

These conventions should be documented consistently in:

- `planning/timeline-schema.md`
- and in any `accept`-related agent docs.

---

## 4. Columns and semantics

This section describes the intended semantics of standard columns. The exact
names are defined in the timeline schema ADR and `timeline-schema.md`.

### 4.1 `id`

- **Type:** string, unique within the project.
- **Purpose:** stable identifier to link:
  - timeline rows,
  - task directories,
  - commit messages,
  - external tooling (e.g. issue trackers).

Once assigned, an `id` should not be reused for different work.

### 4.2 `type`

- **Type:** enum.
- **Examples:** `feature`, `chore`, `bug`, `spike`, `doc`, `infra`.
- **Purpose:** categorize work for planning and reporting.

The allowed values are defined in an ADR (e.g. `adr-2025-0001-naming-enums.md`).

### 4.3 `title`

- **Type:** short free-text.
- **Purpose:** human-readable name that appears in UIs and reports.

Should be concise but descriptive enough to make sense in isolation.

### 4.4 `milestone`

- **Type:** string / enum.
- **Purpose:** group related items into a larger goal or timeframe.

Examples:

- `M1: Planning MVP`
- `M2: Provider Abstraction`
- `2025-Q2`

Milestone naming conventions should be captured in planning ADRs.

### 4.5 `eta`

- **Type:** date or free-text (“TBD”, “unknown”) with a recommended date format.
- **Purpose:** rough expected completion date.

This is not a strict SLA, but should be kept reasonably up to date as the task
progresses.

### 4.6 `priority`

- **Type:** enum or ordinal.
- **Examples:** `P0`, `P1`, `P2`, `P3` or `1`–`4`.
- **Purpose:** guide attention and scheduling.

Priority is informational for humans, but may be used by tooling to suggest
which tasks to pick up next.

### 4.7 `status`

- **Type:** enum.
- **Examples:** `idea`, `planned`, `in-progress`, `blocked`, `in-review`, `testing`, `accepted`, `reverted`, `archived`.
- **Purpose:** summarize where the work is in its lifecycle.

#### Status lifecycle (recommended)

A typical flow:

```text
idea
  → planned
  → in-progress
  → in-review
  → testing
  → accepted
    or
    → reverted
  → archived
```

  How these map to actual CLI phases:
	•	planned → planning complete, plan accepted.
	•	in-progress → codegen and/or implementation ongoing.
	•	in-review → code / plan under review.
	•	testing → tests / evaluations running or pending.
	•	accepted → accept phase produced a positive decision.
	•	reverted → accepted work later rolled back.
	•	archived → no further work expected; row kept for history.

The exact mapping and allowed values should be defined in:
	•	planning/timeline-schema.md
	•	ADRs for naming and enums.

4.8 depends
	•	Type: comma-separated list of other ids (or empty).
	•	Purpose: express task-level dependencies.

Informational, but can be used by tooling to:
	•	warn when starting work on a task whose dependencies are not yet accepted,
	•	visualize dependency graphs.

4.9 design_link
	•	Type: URL or relative path.
	•	Purpose: point to a design document, plan, or spec.

Examples:
	•	docs/planning/examples/example-plan.md
	•	.ai-tools-chain/tasks/<id>/planning/plan.md

4.10 accept_link
	•	Type: URL or relative path.
	•	Purpose: point to the canonical acceptance artifact.

Examples:
	•	.ai-tools-chain/tasks/<id>/accept/decision.json
	•	.ai-tools-chain/tasks/<id>/accept/summary.md

⸻

5. Editing rules and responsibilities

5.1 Who edits the timeline?
	•	Humans:
	•	add new rows when new work is scoped,
	•	update title, milestone, eta, priority, depends, notes,
	•	may adjust status for purely planning changes (e.g. idea → planned).
	•	Tools / agents:
	•	may propose or apply status updates based on task state,
	•	may update accept_link once a decision is made.

5.2 Source of truth precedence

When there is a conflict between:
	•	timeline.status, and
	•	state.json or acceptance artifacts,

the system should define a clear precedence rule. Recommended:
	•	Runtime behavior uses task-level artifacts as truth.
	•	Timeline is considered out of date and should be reconciled.
	•	Tooling may offer a “sync timeline” command or report.

This behavior should be implemented at the CLI/orchestrator level and described
in any commands that manipulate the timeline.

⸻

6. Examples

A minimal example table (columns truncated for brevity):

| id        | type    | title                               | milestone       | eta        | priority | status      | depends | design_link                             | accept_link                                      | notes                 |
|-----------|---------|-------------------------------------|-----------------|------------|----------|-------------|---------|------------------------------------------|--------------------------------------------------|-----------------------|
| TASK-001  | feature | End-to-end planning MVP             | M1: Planning    | 2025-03-15 | P0       | accepted    |         | .ai-tools-chain/tasks/TASK-001/plan.md  | .ai-tools-chain/tasks/TASK-001/accept/decision.json | First end-to-end demo |
| TASK-002  | chore   | Refine timeline schema and enums    | M1: Planning    | 2025-03-20 | P1       | in-progress |         | docs/planning/timeline-schema.md     |                                                  | Align docs and code   |
| TASK-003  | spike   | Experiment with alternate providers | M2: Providers   | TBD        | P2       | idea        |         |                                          |                                                  |                        |

The exact example(s) used in this repository live under:
	•	docs/planning/examples/example-timeline.md

and should conform to the schema defined in timeline-schema.md.

⸻

7. Evolution and governance

Because the timeline is central, any changes to:
	•	column names,
	•	allowed enums (e.g. type, status, priority),
	•	semantics of status transitions,

should be made via an ADR (Architecture Decision Record), referenced from:
	•	docs/planning/adr/

This ensures that:
	•	external tools can rely on a stable contract,
	•	contributors understand why changes were made,