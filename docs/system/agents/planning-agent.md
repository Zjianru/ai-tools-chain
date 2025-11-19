# Agent: PlanningAgent

The **PlanningAgent** runs the planning phase.

It:

- conducts a multi-round workshop,
- asks clarifying questions,
- iteratively refines the plan,
- and produces all planning artifacts.

Implementation:  
`src/agents/planningAgent.mjs` (name may vary in code, but refers to the planning orchestration agent).

---

## 1. Responsibilities

1. **Initialize planning**
   - Ensure the task directory exists.
   - Create or update:
     - `planning/brief.md`
     - `planning/meeting.jsonl`

2. **Run workshop rounds**
   - For each round:
     - read existing transcript,
     - call the planning model role via the broker,
     - write new transcript entries.

3. **Manage internal planning states**
   - Maintain substates:
     - `draft`, `clarifying`, `workshop`, `formalizing`, `review_ready`.
   - Persist current substate in:
     - `state.json.actors.planning`.

4. **Produce final artifacts**
   - `planning/planning.ai.json`
   - `planning/plan.md`
   - `planning/plan.files.json`
   - (optional) `planning/meeting.md`

---

## 2. Inputs

- User brief:
  - REPL input for the task,
  - or `planning/brief.md`.

- Existing planning transcript:
  - `planning/meeting.jsonl`.

- Timeline row (optional):
  - used to pull `id`, `milestone`, `priority`, etc.

- Repo context (optional):
  - directory listing,
  - key files.

---

## 3. Outputs

- **Transcript**:
  - `planning/meeting.jsonl` (JSONL stream of rounds).

- **Structured plan**:
  - `planning/planning.ai.json`
  - conforms to `system/schemas/planning-schema.md`.

- **Human-readable plan**:
  - `planning/plan.md`

- **File plan**:
  - `planning/plan.files.json`
  - per-file instructions used by codegen.

- **State**:
  - `state.json.actors.planning` updated with substate and round.

---

## 4. Interaction with model broker

The PlanningAgent:

- uses the **planning** role (or equivalent) from the broker,
- may orchestrate multiple virtual roles:
  - ProductPlanner,
  - SystemDesigner,
  - SeniorDeveloper,
  - TestPlanner,
  - RiskPlanner.

Their prompts live under:

- `src/models/prompts/planning/`

The agent is responsible for:

- feeding the right context,
- enforcing required output structure (JSON),
- handling parse errors gracefully.

---

## 5. Internal state machine

The internal planning state machine is defined in:

- `system/workflows/planning-state-machine.md`

The agent MUST:

- obey that state machine,
- use signals like:
  - `blocking_questions`,
  - `no_new_info`,
  - `commitment_readiness`,
- to decide when to advance substates.

---

## 6. CLI / REPL behavior

The PlanningAgent is invoked via:

- `ai-tools plan`
- `/plan`
- `/redo planning`

When re-running:

- should archive previous planning artifacts (or version them),
- but keep transcripts for history.

---

## 7. Failure modes

- **Transcript bloat**
  - Very long planning history.
  - Handling:
    - periodic summarization,
    - or splitting into segments.

- **Invalid plan JSON**
  - Model output fails schema validation.
  - Handling:
    - re-prompt model with explicit error,
    - surface error clearly to user.

- **File plan mismatch**
  - `plan.files.json` contradicts `planning.ai.json`.
  - Handling:
    - treat file plan as derived,
    - re-generate from the structured plan.


⸻
