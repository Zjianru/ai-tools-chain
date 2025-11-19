# Example Plan – Planning MVP

> This is a **human-readable projection** of a structured plan that would be
> stored in `planning/planning.ai.json`.

---

## 1. Summary

Implement a **Planning MVP** for AI Tools Chain that:

- takes a brief for a single task,
- runs a multi-round planning workshop,
- produces structured planning artifacts,
- and prepares a file-level plan for codegen.

---

## 2. Goals

- Provide a repeatable planning flow for a single task.
- Store all planning artifacts under `.ai-tools-chain/tasks/<id>/planning/`.
- Make the plan consumable by:
  - humans (via `plan.md`),
  - codegen and review agents (via `planning.ai.json` and `plan.files.json`).

---

## 3. Scope

### In scope

- Defining `planning.ai.json` schema.
- Implementing PlanningAgent basic flow.
- Generating:
  - `planning/planning.ai.json`
  - `planning/plan.md`
  - `planning/plan.files.json`
- Documenting planning phase and state machine in docs_v2.

### Out of scope

- Multi-task coordination.
- Editor integrations.
- Production-ready provider configuration.

---

## 4. Work Breakdown (High-level)

1. **Define schemas**
   - `planning-schema.md`
   - `planning-meeting-schema.md`

2. **Implement PlanningAgent**
   - read brief,
   - run rounds,
   - write transcript,
   - produce final artifacts.

3. **Wire into CLI / REPL**
   - `/plan`
   - `/redo planning`

4. **Docs v2**
   - `system/phases/planning.md`
   - `system/workflows/planning-state-machine.md`
   - `planning/examples/*`

---

## 5. Risks & Assumptions (Sample)

- **Risk:** planning becomes too verbose / heavy for small tasks.
  - Mitigation: allow shallow plans; let users stop early if satisfied.

- **Assumption:** contributors are comfortable with JSON + markdown artifacts.
  - If false: provide more helper commands and summaries.

---

## 6. File-level Plan (Excerpt)

| path                                      | intent           | role | summary                                   |
|-------------------------------------------|------------------|------|-------------------------------------------|
| docs_v2/system/phases/planning.md        | create_or_update | doc  | Document the planning phase.              |
| docs_v2/system/workflows/planning-state-machine.md | create_or_update | doc  | Define planning state machine.            |
| docs_v2/system/schemas/planning-schema.md | create_or_update | doc  | Specify planning.ai.json schema.          |
| docs_v2/system/schemas/planning-meeting-schema.md | create_or_update | doc  | Specify planning transcript schema.       |
| docs_v2/planning/examples/example-plan.md | create_or_update | doc  | Provide a sample human-readable plan.     |

The equivalent JSON representation would live in `planning.ai.json` as `file_plan`.