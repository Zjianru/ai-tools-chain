# Phase: Plan Review

The **plan review** phase stress-tests the plan produced during planning.

It uses multiple “virtual reviewers” (roles) to:

- check for gaps,
- highlight risks,
- propose improvements,
- and decide whether the plan is _acceptable_ or should be revised.

---

## 1. Goals

The plan review phase should:

1. Provide structured feedback from different perspectives:
   - Product / UX,
   - System design / architecture,
   - Implementation,
   - Testing,
   - Risk / operations.
2. Decide whether the plan is:
   - **accepted as-is**, or
   - **requires changes**, or
   - **blocked** until critical issues are resolved.
3. Produce a condensed summary for the human owner.

---

## 2. Inputs

### 2.1 Required

- `planning/planning.ai.json` – structured plan.
- `planning/plan.md` – human-readable plan.

### 2.2 Optional / contextual

- Task brief and workshop transcript:
  - `planning/brief.md`
  - `planning/meeting.jsonl`
- Timeline row:
  - from `docs_v2/planning/timeline.md`
- Repo context, if relevant:
  - summary of the current codebase.

---

## 3. Process

1. **Per-role review**
   - For each configured reviewer role (e.g. ProductPlanner, SystemDesigner, …):
     - Feed relevant context to the model role,
     - Ask for a structured verdict:
       - `ok` flag,
       - confidence,
       - reasons,
       - specific suggestions.

2. **Aggregation**
   - Collect all per-role verdicts.
   - Synthesize:
     - an overall decision (`ok` / `needs_changes` / `blocked`),
     - a combined list of action items.

3. **Materialization**
   - Save machine-readable output:
     - `review/plan-review.json`
   - Optionally generate:
     - `review/plan-review.md` – a human-readable summary.

---

## 4. Outputs

Under the task directory:

- `review/plan-review.json`
  - list of reviewer verdicts,
  - aggregated result,
  - suggested actions.
- `review/plan-review.md`
  - human-friendly summary (optional but recommended).

Schemas:

- `docs_v2/system/schemas/plan-review-schema.md` (to be kept in sync).

---

## 5. State machine

In the global state machine:

- The plan review phase corresponds to `plan_review`.

Transitions:

- `planning` → `plan_review` (once planning succeeds).
- `plan_review` → `codegen` if `ok === true` and no blocking issues.
- `plan_review` → `planning` if `ok === false` or `blocked`.

The orchestrator should:

- inspect `review/plan-review.json`,
- decide whether to advance or suggest revisiting planning.

---

## 6. CLI & user interaction

### 6.1 Commands

- `ai-tools review plan` – run plan review only.
- `/review plan` – in REPL, trigger plan review.
- `/next` – may suggest plan review if planning is complete.

### 6.2 User responsibilities

- Read `plan-review.md`.
- Address critical issues by:
  - revising the brief or plan,
  - re-running planning,
  - or explicitly overriding (if allowed by policy).

If overrides are allowed, the decision and rationale should be recorded in the
task’s `accept` artifacts or additional notes.

---

## 7. Failure modes & handling

- **Models disagree strongly**
  - Some reviewers say “ok”, others “blocked”.
  - Handling:
    - treat the most conservative reviewer as default,
    - or expose disagreements clearly in `plan-review.md`.

- **Feedback too vague**
  - Suggestions like “improve tests” without specifics.
  - Handling:
    - adjust prompts to enforce concrete, actionable feedback.

- **Plan review ignored**
  - Codegen starts despite a clearly blocked plan.
  - Handling:
    - orchestrator MUST respect `ok === false`,
    - overrides SHOULD be explicit and logged.