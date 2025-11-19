# System Overview

This document explains the AI Tools Chain as a **system**, not just a CLI.

It focuses on:

- the lifecycle of a task,
- the phases and state machines,
- the key artifacts produced along the way,
- and how agents and providers are orchestrated.

---

## 1. What problem does this system solve?

Modern “AI coding” workflows often look like this:

- chat with a model,
- paste code into an editor,
- manually juggle diffs, tests and reviews.

This works for _one-off_ experiments, but breaks down when you need:

- traceability (who decided what, and why?),
- repeatability (can we re-run the pipeline later?),
- and safety (can we accept or revert changes in a controlled way?).

The AI Tools Chain treats **AI-assisted development as a delivery pipeline**:

> _From “idea / brief” → to “accepted change” → with all intermediate artifacts
> (plans, reviews, diffs, tests) stored locally as first-class citizens._

---

## 2. High-level lifecycle

At the highest level, a task moves through these phases:

1. **Planning** – understand and decompose the work.
2. **Plan Review** – stress-test the plan with multiple “virtual roles”.
3. **Codegen** – generate or modify code according to the plan.
4. **Review** – sanity-check the changes and capture feedback.
5. **Test** – run automated checks (lint, tests, prompt evaluations, etc.).
6. **Accept** – make a deliberate decision to accept or reject the work.
7. **Revert** – if needed, roll back to a previous state.

The global state machine in `system/workflows/global-state-machine.md` describes
this in more detail.

Each **task** has:

- a dedicated directory under `.ai-tools-chain/tasks/`,
- a `state.json` describing the current phase and sub-state,
- a collection of artifacts produced by each phase.

---

## 3. Core concepts

### 3.1 Task

- **Unit of work** that travels through the lifecycle.
- Identified by a task id and backed by a directory on disk.
- Acts as the anchor point for:
  - planning artifacts,
  - code diffs,
  - evaluation reports,
  - acceptance decisions.

### 3.2 Phase

- A named stage in the lifecycle (planning, codegen, test, …).
- Phases are:
  - reflected in the global state machine,
  - implemented by CLI commands,
  - documented in `system/phases/*.md`.

### 3.3 Agent

- A logical role that performs work within a phase.
- Examples:
  - `PlanningAgent` – runs multi-round planning workshops.
  - `planReviewAgent` – aggregates verdicts from multiple “virtual reviewers”.
  - `acceptAgent` – helps make a final go/no-go decision.
- Agents communicate with models through a provider-agnostic broker.

### 3.4 Provider & Profiles

- Providers are model backends (Anthropic, OpenAI, GitHub Copilot, …).
- Profiles define:
  - which providers are active,
  - how roles map to specific models or chains of models.
- The broker layer hides provider details from agents.

### 3.5 Artifacts

Every meaningful step produces artifacts on disk, for example:

- `planning/planning.ai.json` – structured plan.
- `planning/plan.md` – human-readable plan.
- `diff.patch` / `files/*.full` – code changes.
- `eval-report.json` – test and evaluation results.
- `accept/decision.json` – acceptance decision, reasons and links.

Schemas for these artifacts live under `system/schemas/`.

---

## 4. Relationship between timeline, tasks and state

At the project level, the **timeline** is the single source of truth for:

- what tasks exist,
- how they relate to milestones,
- and their current status.

Roughly:

- Each row in the timeline corresponds to one task.
- Each task directory contains the actual artifacts and state.
- The CLI and agents _project_ task-level state back into the timeline.

The precise rules and schema are described in:

- `system/timeline.md` – conceptual and behavioral specification.
- `planning/timeline-schema.md` – tabular schema for the timeline file.

---

## 5. Where to go next

- For a concrete view of how states change:  
  → `system/workflows/global-state-machine.md`

- To understand what each phase is responsible for:  
  → `system/phases/*.md`

- To see how agents are wired to models and providers:  
  → `system/agents/*.md` and the code under `src/agents/` and `src/models/`.

- To work specifically on planning:  
  → `planning/*` and the related schemas.