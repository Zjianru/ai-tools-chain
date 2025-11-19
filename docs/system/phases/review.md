# Phase: Review

The **review** phase inspects generated code (and possibly the plan) before
running tests or accepting changes.

It can be:

- automated (model-based review),
- manual (human review),
- or a combination of both.

---

## 1. Goals

The review phase should:

1. Catch obvious issues early (logic, style, missing tests).
2. Ensure the implementation still aligns with the plan.
3. Produce actionable feedback and a rough risk assessment.

---

## 2. Inputs

- `code/diff.patch` – unified diff of proposed changes.
- `code/files/` – full versions of modified/created files.
- `planning/plan.md` – to check intent vs implementation.
- `review/plan-review.json` – prior concerns from plan review (optional).

---

## 3. Process

1. **Automated review (optional)**
   - Use a review agent to:
     - summarize changes,
     - highlight potential problems,
     - propose improvements or follow-up tasks.

2. **Manual review**
   - A human may:
     - inspect diffs in their editor,
     - read auto-generated review notes,
     - add comments or annotations.

3. **Synthesis**
   - Aggregate feedback into:
     - structured review output,
     - or notes for the accept phase.

---

## 4. Outputs

Under the task directory, for example:

- `review/code-review.json`
  - summary of issues,
  - severity levels,
  - suggested follow-ups.
- `review/code-review.md`
  - human-readable review notes.

Exact schema is flexible, but SHOULD be documented once stabilized.

---

## 5. State machine

In the global state machine:

- `codegen` → `review` when code is ready for inspection.
- `review` → `test` if the review does not block.
- `review` → `codegen` if significant issues require changes.
- `review` → `planning` in extreme cases (if the plan itself was flawed).

The orchestrator uses review artifacts to decide:

- whether to advance,
- or to recommend additional codegen / planning work.

---

## 6. CLI & user interaction

### 6.1 Commands

- `ai-tools review code` – run code review helpers.
- `/review code` – in REPL, trigger review for current task.

### 6.2 User responsibilities

- Read review notes (auto + manual).
- Decide whether:
  - to address issues immediately,
  - to capture follow-up items in the timeline,
  - or to accept some risk for now.

---

## 7. Failure modes & handling

- **Overly generic feedback**
  - e.g. “improve tests” with no detail.
  - Handling:
    - tighten prompts,
    - enforce minimal concrete suggestions.

- **Mismatch between plan and implementation**
  - Handling:
    - re-open planning or plan review,
    - update timeline and artifacts to reflect reality.

- **Review noise**
  - Too many low-value comments.
  - Handling:
    - tune reviewer roles,
    - filter by severity.