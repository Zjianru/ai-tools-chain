# Roadmap

This roadmap captures **where the AI Tools Chain is going**, not just what it
already does.

It is intentionally high-level and grouped by theme. Concrete, near-term work
should be reflected in the project timeline instead.

---

## 1. Planning & Workflow

### 1.1 Planning Phase Maturity

- [ ] Harden the PlanningAgent implementation to fully match:
  - `system/phases/planning.md`
  - `system/workflows/planning-state-machine.md`
  - `system/schemas/planning-schema.md`
  - `system/schemas/planning-meeting-schema.md`
- [ ] Implement robust validation and error handling for `planning.ai.json`.
- [ ] Support incremental updates to the plan (e.g. v2, v3) without losing history.
- [ ] Add tests for planning state transitions and signals
  (`blocking_questions`, `commitment_readiness`, etc.).

### 1.2 Plan Review

- [ ] Align implementation of plan review with:
  - `phases/plan-review.md`
  - `schemas/plan-review-schema.md`
- [ ] Add additional reviewer roles or checklists as needed.
- [ ] Allow human reviewers to contribute structured feedback via CLI/REPL.

---

## 2. Codegen & Review

### 2.1 Codegen Lifecycle

- [ ] Implement the full lifecycle described in:
  - `workflows/codegen-lifecycle.md`
- [ ] Add stronger safeguards around scope:
  - enforce `file_plan` from `planning.ai.json`,
  - detect and prevent unwanted file modifications.
- [ ] Support multiple strategies:
  - full-file generation,
  - patch-based generation,
  - hybrid modes.

### 2.2 Code Review

- [ ] Formalize schema for `review/code-review.json`.
- [ ] Improve prompts for plan alignment checks.
- [ ] Add severity levels and tags for review findings.
- [ ] Explore integration with external review tools (e.g. GitHub PRs).

---

## 3. Testing & Evaluation

- [ ] Implement test runner that:
  - reads configuration (e.g. `eval.conf`),
  - executes suites (tests, lint, prompt evaluation),
  - writes `eval/eval-report.json` matching `eval-schema.md`.
- [ ] Support streaming or incremental updates to eval reports (optional).
- [ ] Provide helpers for:
  - marking known flaky tests,
  - separating fast vs slow suites.
- [ ] Integrate with CI providers to reuse the same evaluation structure.

---

## 4. Acceptance & Revert

- [ ] Define and implement schema for `accept/decision.json`.
- [ ] Add CLI UX for guided acceptance:
  - show evidence summary,
  - capture decision and rationale.
- [ ] Implement RevertAgent with:
  - Git-based revert helpers,
  - fallbacks using stored `code/files/` artifacts.
- [ ] Provide a safe “dry run” mode for revert.

---

## 5. Timeline & Project-Level View

- [ ] Align actual timeline file with:
  - `system/timeline.md`
  - `planning/timeline-schema.md`
- [ ] Implement a `timeline sync` command that:
  - reads tasks and their artifacts,
  - proposes status updates for `timeline.md`.
- [ ] Add visualizations or summaries:
  - per-milestone progress,
  - status counts,
  - dependency graph.

---

## 6. Providers & Profiles

- [ ] Expand provider support:
  - more Anthropic/OpenAI models,
  - better GitHub Copilot integration,
  - local LLMs (via e.g. OpenAI-compatible endpoints).
- [ ] Improve `models.conf` UX:
  - profile selection,
  - per-role provider chains,
  - environment-specific defaults.
- [ ] Add diagnostics:
  - model call logs,
  - token and cost summaries per task.

---

## 7. Editor & UX Integration

- [ ] VS Code integration (or other editors):
  - surface task status,
  - render planning/review/eval artifacts inline,
  - run CLI commands from the editor.
- [ ] Better REPL UX:
  - more discoverable commands,
  - inline summaries of state and next steps.
- [ ] Optional TUI (text-based UI) for navigating tasks and phases.

---

## 8. Documentation & Governance

- [ ] Continue migration from `docs/` to `docs_v2/`:
  - extract stable designs into `system/` and `planning/`,
  - convert major decisions into ADRs under `planning/adr/`.
- [ ] Add more examples under `planning/examples/`:
  - realistic briefs,
  - non-trivial plans,
  - timelines with dependencies.
- [ ] Create a “contributor guide”:
  - how to modify docs and keep them in sync with code and schemas.

---

## 9. Metrics & Observability (Future)

- [ ] Add optional metrics for:
  - number of rounds in planning,
  - test flakiness,
  - average time per phase.
- [ ] Provide a simple task-level dashboard (CLI or web).
- [ ] Explore anonymized telemetry (opt-in only) to improve defaults.

---

## 10. Long-term Directions (Exploratory)

These are **exploratory** and not committed:

- Rich multi-task / multi-user coordination.
- Advanced scheduling or capacity planning based on the timeline.
- Deeper integration with external issue trackers and PM tools.