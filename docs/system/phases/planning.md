# Phase: Planning

The **planning** phase turns a brief idea into a structured plan.

It is designed as a multi-round, multi-role “workshop” that produces:

- a machine-readable plan (`planning.ai.json`),
- a human-readable plan (`plan.md`),
- and file-level intentions (`plan.files.json`).

---

## 1. Goals

The planning phase should:

1. Clarify what problem we are solving and why.
2. Decompose the work into coherent tasks and sub-tasks.
3. Identify risks, assumptions, and constraints.
4. Define acceptance criteria.
5. Propose a file-level implementation strategy.

The output should be good enough that:

- a contributor could implement the work,
- or a codegen agent could generate a reasonable draft.

---

## 2. Inputs

### 2.1 Required

- **Task brief**
  - Short text description of the work.
  - Usually captured in:
    - `planning/brief.md`, or
    - the initial REPL prompt for the task.

### 2.2 Optional

- **Existing code / repo context**
  - The current repository is implicitly available.
  - Agents may build or use a repo summary if configured.

- **Timeline entry**
  - The task’s row in `docs_v2/planning/timeline.md`, if it exists.
  - Used to pull:
    - `id`,
    - `milestone`,
    - `priority`,
    - `depends`.

- **Legacy notes or specs**
  - Linked via `design_link` in the timeline,
  - or added manually to the brief.

---

## 3. Process

The planning phase is orchestrated by `PlanningAgent` and follows roughly:

1. **Initialization**
   - Create a task directory if needed.
   - Store the brief in `planning/brief.md`.
   - Initialize `planning/meeting.jsonl` for the workshop transcript.

2. **Workshop rounds**
   - Each round:
     - reads the transcript so far,
     - calls a model role configured for planning (via the broker),
     - produces:
       - new questions,
       - clarifications,
       - proposed structure or updates to the plan.
   - Multiple “virtual roles” may be involved (Product, System Design, etc.).

3. **Convergence & validation**
   - The agent monitors:
     - remaining blocking questions,
     - clarity of scope,
     - stability of the plan structure.
   - Once the plan is “good enough”:
     - synthesize a final structured plan (`planning.ai.json`).

4. **Materialization**
   - Generate artifacts:
     - `planning.ai.json` – structured plan.
     - `plan.md` – human-readable narrative.
     - `plan.files.json` – per-file change intentions.

---

## 4. Outputs

All outputs are written under the task directory, typically:

- `planning/brief.md`
- `planning/planning.ai.json`
- `planning/plan.md`
- `planning/plan.files.json`
- `planning/meeting.jsonl` (workshop transcript)
- optionally, `planning/meeting.md` as a human-readable summary.

Schemas:

- `docs_v2/system/schemas/planning-schema.md`
- `docs_v2/system/schemas/planning-meeting-schema.md`

---

## 5. State machine

At the global level, planning corresponds to the `planning` phase in:

- `system/workflows/global-state-machine.md`

The planning-specific state machine (inside the agent) is documented in:

- `system/workflows/planning-state-machine.md`

Typical sub-states:

- `draft` → `clarifying` → `workshop` → `formalizing` → `review-ready`.

The orchestrator transitions to `plan_review` once planning succeeds.

---

## 6. CLI & user interaction

### 6.1 Commands

- `ai-tools plan` – run the planning phase once.
- `/plan` in the REPL – trigger planning for the current task.
- `/redo planning` – re-run planning, typically snapshotting previous artifacts.

### 6.2 User responsibilities

- Provide a clear initial brief.
- Answer clarifying questions when prompted.
- Review the generated `plan.md` and adjust if necessary.

---

## 7. Failure modes & handling

Common failure modes:

- **Plan too vague**
  - Symptoms:
    - missing acceptance criteria,
    - vague scope.
  - Handling:
    - rerun planning with explicit guidance,
    - or refine `brief.md` and restart.

- **Plan too detailed**
  - Symptoms:
    - excessive low-level steps,
    - plan is hard to maintain.
  - Handling:
    - adjust prompts / roles to aim for higher-level decomposition.

- **Inconsistent file plan**
  - Symptoms:
    - `plan.files.json` contradicts `plan.md`.
  - Handling:
    - re-generate file plan from the structured plan,
    - or treat `plan.files.json` as derived and re-sync.

These failure modes and their mitigations should be reflected in the agent
implementation and prompts.