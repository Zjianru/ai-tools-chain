# Agent: Review Agents (Code Review)

The **review agents** support the `review` phase by:

- inspecting diffs and generated files,
- checking alignment with the plan,
- producing structured feedback.

Implementation:  
Primarily in `src/agents/reviewAgent.mjs` (and related helpers).

---

## 1. Responsibilities

1. **Summarize changes**
   - Read:
     - `code/diff.patch`,
     - `code/files/`,
   - produce:
     - a concise summary of what changed,
     - key impacted areas.

2. **Check alignment with plan**
   - Compare implementation against:
     - `planning/plan.md`
     - optionally `planning/planning.ai.json`
   - Detect:
     - missing parts,
     - over-implementation beyond scope.

3. **Highlight issues**
   - Style / consistency concerns,
   - Missing tests,
   - Risk points.

4. **Produce review artifacts**
   - Structured JSON for tools,
   - Optional markdown for humans.

---

## 2. Inputs

- Code artifacts:
  - `code/diff.patch`
  - `code/files/`

- Planning artifacts:
  - `planning/plan.md`
  - `planning/planning.ai.json` (optional)

- Plan review output:
  - `review/plan-review.json` (optional)

- Context:
  - repo structure,
  - relevant README/config files.

---

## 3. Outputs

Under the task directory:

- `review/code-review.json`
  - summary of:
    - issues,
    - severities,
    - affected files.

- `review/code-review.md`
  - human-readable review notes.

Schema is flexible, but SHOULD eventually be formalized in:

- `system/schemas/` (e.g. `code-review-schema.md`).

---

## 4. Interaction with model broker

The review agents use:

- roles like `review` or `assistant`,
- provider chains configured in `models.conf`.

They MUST:

- keep prompts grounded in the plan,
- enforce a structured JSON output format where needed.

---

## 5. Relationship to phases

The review agents implement logic for:

- `system/phases/review.md`

They run:

- after `codegen` is complete,
- before `test` normally starts.

The orchestrator inspects review outputs to decide:

- whether to proceed to test,
- or to send the task back to codegen/planning.

---

## 6. Failure modes

- **Overly noisy feedback**
  - Too many minor comments.
  - Handling:
    - tune prompts to focus on “material risks”.

- **Shallow review**
  - Only surface-level comments.
  - Handling:
    - encourage deeper reasoning in prompts,
    - add explicit checklists (tests? data migration? docs?).

- **Plan mismatch not detected**
  - Implementation diverges from plan but review misses it.
  - Handling:
    - emphasize plan alignment as a first-class review axis.


⸻
