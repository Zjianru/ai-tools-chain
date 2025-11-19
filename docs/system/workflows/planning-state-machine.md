
# Planning State Machine

This document describes the **internal state machine** used by the
`PlanningAgent`.

While the global lifecycle tracks phase-level progress, the planning state
machine governs the multi-round workshop process that produces a good plan.

---

# 1. States

The planning agent cycles through the following substates:

draft
clarifying
workshop
formalizing
review_ready

---

# 2. State diagram

```mermaid
stateDiagram-v2
    [*] --> draft

    draft --> clarifying: first questions needed
    clarifying --> workshop: user answers provided
    clarifying --> formalizing: no new questions

    workshop --> workshop: more rounds needed
    workshop --> formalizing: structure stabilized

    formalizing --> review_ready: structured plan synthesized

This machine runs inside the global planning phase.

⸻

3. State definitions

draft
	•	Only the brief exists.
	•	No plan material has been generated yet.

clarifying
	•	Model asks clarifying questions.
	•	User may answer interactively (via REPL).
	•	Transition to workshop when:
	•	questions are resolved,
	•	OR the agent decides no more clarifications are needed.

workshop
	•	Multi-round iterative development of:
	•	tasks & subtasks,
	•	assumptions & risks,
	•	acceptance criteria,
	•	file-level strategy.
	•	Sub-round tracked as:
	•	actors.planning.round.

formalizing
	•	The agent compiles:
	•	structured JSON plan,
	•	file plan,
	•	narrative plan.

review_ready
	•	All artifacts:
	•	planning.ai.json,
	•	plan.md,
	•	plan.files.json,
have been generated.

The orchestrator may now transition global state to plan_review.

⸻

4. Transition rules

draft → clarifying

If:
	•	brief exists,
	•	planning is starting.

clarifying → workshop

If:
	•	questions have been answered,
	•	AND the agent requires brainstorming/structuring iterations.

clarifying → formalizing

If:
	•	no significant open questions remain,
	•	AND the brief is sufficiently clear.

workshop → workshop

If:
	•	new suggestions,
	•	new structure improvements,
	•	or deeper decomposition are needed.

workshop → formalizing

If:
	•	structure stabilizes,
	•	no major uncertainties remain.

formalizing → review_ready

If:
	•	all outputs compile without schema violations.

⸻

5. Signals used by the agent

Internal heuristics (simplified):
	•	blocking_questions
→ remain in clarifying
	•	no_new_info
→ move toward formalizing
	•	commitment_readiness
→ signal that the plan is stable enough
	•	file_plan_consistency
→ check if plan.files.json matches high-level plan

These signals SHOULD be documented in the planning prompts and enforced in tests.

⸻

6. Persistence

Planning rounds are persisted as:
	•	planning/meeting.jsonl
	•	each entry:
	•	round,
	•	actor,
	•	phase,
	•	content.

This transcript is used to reconstruct context when re-running planning.

⸻

7. CLI behavior
	•	/plan can run planning repeatedly.
	•	/redo planning:
	•	snapshots existing artifacts,
	•	restarts from draft,
	•	but keeps transcript for historical context.

⸻

8. Invariants
	1.	A structured plan MUST NOT be produced before formalizing.
	2.	review_ready requires all planning outputs.
	3.	planning.ai.json is the SSOT for the plan; plan.md is a projection.
	4.	Transcript MUST NOT be lost unless explicitly archived.

---
