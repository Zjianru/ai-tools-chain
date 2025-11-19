# Phase: Accept

The **accept** phase makes an explicit decision:

> Should we accept the work produced by this task?

It considers:

- the plan and its review,
- the code and its review,
- test / evaluation results,
- and any human judgment.

---

## 1. Goals

The accept phase should:

1. Make a clear **go / no-go** decision.
2. Record the reasoning.
3. Link all relevant artifacts.
4. Optionally update the project timeline.

---

## 2. Inputs

- `planning/plan.md`
- `review/plan-review.json` (if any)
- `code/diff.patch`, `code/files/`
- `review/code-review.json` / `.md` (if any)
- `eval/eval-report.json`
- Task metadata and timeline entry.

---

## 3. Process

1. **Evidence collection**
   - Gather:
     - plan & plan review,
     - code & code review,
     - eval report.

2. **Model-assisted assessment (optional)**
   - An accept agent may:
     - summarize evidence,
     - highlight concerns,
     - propose a recommendation.

3. **Human decision**
   - A maintainer or task owner:
     - reviews the summary and evidence,
     - chooses:
       - `accept`,
       - `reject/needs-work`,
       - `defer`.

4. **Recording**
   - Persist a structured decision artifact.
   - Optionally update the timeline row:
     - set `status` to `accepted` or `reverted`,
     - update `accept_link`.

---

## 4. Outputs

Under the task directory:

- `accept/decision.json`
  - verdict (`accepted` / `rejected` / `deferred`),
  - reasons,
  - links to artifacts,
  - timestamp,
  - decision maker (human / agent).

- `accept/summary.md` (optional)
  - human-readable explanation.

The `accept_link` in the timeline SHOULD point to `decision.json` or
`summary.md`.

---

## 5. State machine

In the global state machine:

- `test` → `accept` once tests finish.
- `accept` → `done` (or equivalent terminal state) if accepted.
- `accept` → `codegen` / `review` / `test` if “needs work”.
- `accept` → `revert` if previous acceptance is being undone.

The orchestrator should:

- treat `accept` as the final explicit gate,
- not silently auto-accept work without a decision artifact.

---

## 6. CLI & user interaction

### 6.1 Commands

- `ai-tools accept` – run the accept phase.
- `/accept` – in REPL, trigger acceptance flow.

### 6.2 User responsibilities

- Read the summarized evidence.
- Make an explicit decision.
- If overriding model recommendations:
  - briefly record the rationale.

---

## 7. Failure modes & handling

- **Decision without evidence**
  - Accepting work without tests or reviews.
  - Handling:
    - the decision artifact should reflect missing evidence explicitly.

- **Implicit acceptance**
  - Work gets merged without an accept decision.
  - Handling:
    - tooling or process should encourage using the accept phase,
    - or record manual acceptance retroactively.

- **Timeline not updated**
  - Timeline still shows `in-progress` despite acceptance.
  - Handling:
    - add a “sync timeline” step,
    - or automate timeline updates where safe.