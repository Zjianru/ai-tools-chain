# Timeline Schema

This document defines the **schema**, **types**, and **constraints** for the
project-level timeline.

It is the low-level contract used by:

- contributors,
- agents,
- CLI commands,
- external tools (e.g. editor integrations, dashboards).

---

# 1. Purpose

The timeline is a **structured table** representing all units of work in a
project. It MUST follow this schema.

The canonical timeline file lives in:

docs_v2/planning/timeline.md

The timeline MAY contain additional human-readable text, but at least one table
must conform to the schema below.

---

# 2. Required columns

The timeline table MUST contain **all** of the following columns, in **any order**:

| Column        | Required | Type        | Description |
|---------------|----------|-------------|-------------|
| `id`          | yes      | string      | Unique identifier for the work item. |
| `type`        | yes      | enum        | Category of work. |
| `title`       | yes      | string      | Short human-readable name. |
| `milestone`   | no       | string      | Optional grouping (release, theme…). |
| `eta`         | no       | date/string | Estimated completion date (YYYY-MM-DD or `TBD`). |
| `priority`    | no       | enum        | Importance. |
| `status`      | yes      | enum        | Lifecycle state of the item. |
| `depends`     | no       | list/string | Dependencies, comma-separated. |
| `design_link` | no       | string/URL  | Link to plan or design. |
| `accept_link` | no       | string/URL  | Link to acceptance artifact. |
| `notes`       | no       | string      | Free-form notes. |

If additional columns are required by future ADRs, they MUST be documented here.

---

# 3. Types & Valid Values

## 3.1 `id`

- MUST be unique across the entire timeline.
- SHOULD be stable over time.
- Recommended format: `TASK-###` or `<prefix>-<slug>`.
- Allowed characters: `A–Z`, `a–z`, `0–9`, `-`.

## 3.2 `type` (enum)

Recommended allowed values:

feature | bug | chore | spike | doc | infra

Projects may extend this list, but all values MUST be documented in an ADR.

## 3.3 `title`

- Short free text.
- SHOULD avoid ambiguity and SHOULD stand alone.

Examples:

- `Refactor task state machine`
- `Add provider-fallback logic`

## 3.4 `milestone`

Free-text grouping label.

- SHOULD map to planning artifacts (`M1: Core Pipeline`, `2025-Q2`, etc.)
- No strict schema; stable naming conventions SHOULD be defined in an ADR.

## 3.5 `eta`

Allowed formats:

YYYY-MM-DD
TBD
unknown

Notes:

- Tools SHOULD NOT rely on `eta` for scheduling.
- This is an “informational field”, not an SLA.

## 3.6 `priority` (enum or ordinal)

Strongly recommended values:

P0 | P1 | P2 | P3

Or numeric:

1 | 2 | 3 | 4

Projects SHOULD choose one format and stick to it.

## 3.7 `status` (enum)

Allowed values:

idea
planned
in-progress
in-review
testing
accepted
reverted
archived

### Status semantics

| Status        | Meaning |
|---------------|---------|
| `idea`        | Work has been proposed but not fully scoped. |
| `planned`     | A plan exists and is accepted. |
| `in-progress` | Work is being actively executed (codegen or manual coding). |
| `in-review`   | Plan or code is under review. |
| `testing`     | Tests or evaluation suites are being run. |
| `accepted`    | Accepted by the Accept Agent or a human maintainer. |
| `reverted`    | Work was accepted previously but has since been rolled back. |
| `archived`    | No further action is expected; kept for record. |

### Mapping to CLI phases

This mapping SHOULD be respected by all tooling:

| status        | typical CLI phase |
|---------------|-------------------|
| `planned`     | planning → plan_review |
| `in-progress` | codegen |
| `in-review`   | review |
| `testing`     | test |
| `accepted`    | accept |
| `reverted`    | revert |
| `archived`    | (no active phase) |

## 3.8 `depends`

- Either empty or comma-separated list of other IDs.
- Circular dependencies SHOULD NOT exist.
- Tools MAY visualize dependency graphs.

## 3.9 `design_link`

- Any URL or relative path.
- SHOULD refer to a plan or design artifact.
- MUST be stable if used by tools.

## 3.10 `accept_link`

- Should point to the canonical acceptance artifact.
- Recommended:

.ai-tools-chain/tasks//accept/decision.json

## 3.11 `notes`

- Free text.
- SHOULD be short but may capture context or caveats.

---

# 4. Table formatting rules

- MUST be a valid markdown table (pipe-delimited).
- Column headers MUST match schema.
- Rows MUST NOT change meaning over time (id/title SHOULD remain stable).
- Additional tables may exist, but only one table is canonical.

Tools should:

- read the first schema-conforming table they find, OR
- read the table explicitly marked via an annotation (future extension).

---

# 5. Versioning & Governance

Changes to:

- column names,
- allowed enums,
- field semantics,

MUST go through an ADR under:

docs_v2/planning/adr/

The timeline schema is versioned implicitly via ADRs, not through a version
number embedded in the file.

---

# 6. Example (minimal)

```markdown
| id        | type    | title               | milestone | eta        | priority | status      | depends | design_link               | accept_link                                       | notes |
|-----------|---------|---------------------|-----------|------------|----------|-------------|---------|----------------------------|---------------------------------------------------|-------|
| TASK-001  | feature | Planning phase MVP  | M1        | 2025-03-15 | P0       | accepted    |         | planning/plan.md          | .ai-tools-chain/tasks/TASK-001/accept/decision.json |       |
| TASK-002  | chore   | Improve schema docs | M1        | 2025-03-20 | P1       | in-progress |         | planning/timeline-schema.md |                                                    |       |
```
Artifacts in examples/ MUST conform to this schema.

---
