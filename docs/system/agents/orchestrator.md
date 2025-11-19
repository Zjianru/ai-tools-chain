# Agent: Orchestrator

The **orchestrator** coordinates the task lifecycle.

It is responsible for:

- reading and updating `state.json`,
- deciding which phase to run next,
- enforcing the global state machine,
- and suggesting next actions to the CLI / REPL.

Implementation:  
`src/agents/orchestrator.mjs` (and related helpers in `src/core/`).

---

## 1. Responsibilities

1. **Track the current phase**
   - `state.json.phase` holds the current top-level phase.
   - Valid phases are documented in:
     - `system/workflows/global-state-machine.md`.

2. **Inspect artifacts**
   - Check for the presence and content of:
     - planning artifacts,
     - plan review verdicts,
     - codegen outputs,
     - test/eval reports,
     - accept and revert records.

3. **Compute next steps**
   - Use:
     - the global state machine,
     - artifact signals (e.g. `ok === false`, test failures),
   - to decide:
     - which phase is valid,
     - whether to advance, stay, or regress.

4. **Update state**
   - Persist changes to `state.json`.
   - Optionally adjust per-phase actor substates.

5. **Provide suggestions to the REPL**
   - Expose a `suggestNextFromState`-type API:
     - used by `/next`,
     - and by the REPL UI.

---

## 2. Inputs

- `state.json` for the current task:
  - `phase`,
  - `actors.<phase>.*` substates.

- Task directory contents:
  - `planning/` artifacts,
  - `review/` artifacts,
  - `code/` outputs,
  - `eval/` outputs,
  - `accept/` and `revert/` records.

- Global docs / configuration (indirectly):
  - expected phases,
  - file names,
  - schema expectations.

---

## 3. Outputs

- Updated `state.json`:
  - `phase`,
  - `actors.<phase>`.

- A “next step” suggestion object, e.g.:

```json
{
  "currentPhase": "plan_review",
  "suggestedNext": "codegen",
  "reason": "plan-review.ok === true and no blocking issues"
}
```
The REPL uses this suggestion when the user runs /next.

⸻

4. Behavior & transition rules

The orchestrator MUST implement the transition rules defined in:
	•	system/workflows/global-state-machine.md

Key examples:
	•	After successful planning:
	•	move planning → plan_review.
	•	If plan review is blocked:
	•	route back to planning.
	•	If tests fail:
	•	route test → codegen.
	•	After an accepted decision:
	•	move to done (terminal).

Additionally, the orchestrator should:
	•	treat missing artifacts as a signal that a phase is incomplete,
	•	avoid skipping phases unless explicitly overridden.

⸻

5. Interaction with CLI / REPL

The CLI:
	•	delegates to the orchestrator when:
	•	determining what /next should do,
	•	deciding if a phase can run.

The orchestrator:
	•	does not perform the work of a phase,
	•	it only coordinates which agent should run next.

⸻

6. Human override

The orchestrator SHOULD provide a way for:
	•	humans to override suggested transitions,
	•	while recording a reason.

Example:
	•	/next --override "I want to run tests even though review is missing"

The reason should be:
	•	logged to the transcript,
	•	included in task history.

⸻

7. Failure modes
	•	Inconsistent state.json
	•	Phase says codegen, but required artifacts are missing.
	•	Handling:
	•	orchestrator should detect this and suggest re-running the phase,
	•	or rolling back to the last consistent phase.
	•	Unknown phase
	•	state.json.phase not in the global state machine.
	•	Handling:
	•	treat as error,
	•	surface clear message to user.
	•	Artifact schema mismatch
	•	e.g. plan-review.json missing ok field.
	•	Handling:
	•	treat as invalid phase output,
	•	suggest re-running the phase or fixing artifacts manually.

---
