# Global State Machine

This document defines the **task-level lifecycle** used by the orchestrator.

It describes:

- the allowed states (phases),
- transitions between them,
- the conditions for progression or regression,
- and how this maps to `state.json`.

This is the authoritative contract for task-level state transitions.

---

# 1. States

A task moves through the following **top-level phases**:

planning
plan_review
codegen
review
test
accept
revert
done

`done` is a terminal state used when the task’s lifecycle is complete.

---

# 2. State diagram

```mermaid
stateDiagram-v2
    [*] --> planning

    planning --> plan_review: planning succeeded
    planning --> planning: re-plan (redo)
    
    plan_review --> codegen: review ok
    plan_review --> planning: review needs changes
    plan_review --> planning: review blocked

    codegen --> review: codegen completed
    codegen --> planning: scope mismatch
    codegen --> plan_review: plan unclear
    codegen --> codegen: re-run codegen

    review --> test: review passes
    review --> codegen: needs code changes
    review --> planning: plan flawed

    test --> accept: tests complete
    test --> codegen: test failures

    accept --> done: accepted
    accept --> codegen: requires further changes
    accept --> review: unclear / needs review
    accept --> planning: upstream problem
    accept --> revert: revert requested

    revert --> done

This diagram MUST match orchestrator behavior in code.

⸻

3. Transition rules

3.1 planning → plan_review

Requires:
	•	planning/planning.ai.json exists,
	•	AND no blocking questions remain,
	•	AND a valid plan.files.json exists (or default can be inferred).

3.2 plan_review → codegen

Requires:
	•	review/plan-review.json.ok === true
	•	AND blocked === false (per aggregated verdict)

3.3 plan_review → planning

Triggered if:
	•	Any reviewer sets ok: false with severity blocking,
	•	OR a structural flaw is detected in the plan.

3.4 codegen → review

Requires:
	•	code/diff.patch exists
	•	AND generated files exist in code/files/.

3.5 codegen → planning / plan_review

Triggered if:
	•	Scope mismatch between generated files and the plan,
	•	OR essential parts of the plan are missing.

3.6 review → test

Requires:
	•	No “blocking” issues in review output,
	•	OR human override with justification.

3.7 review → codegen / planning
	•	Code issues → go back to codegen,
	•	Plan issues → go back to planning.

3.8 test → accept

Always transitions once tests complete.

3.9 test → codegen

If:
	•	test suite fails,
	•	OR lint/static analysis fails.

3.10 accept → done

If:
	•	the decision is accepted,
	•	AND decision is recorded in accept/decision.json.

3.11 accept → revert

If:
	•	reversal is explicitly requested,
	•	OR a regression is found.

3.12 revert → done

Terminal state.

⸻

4. Mapping to state.json

state.json contains:
```JSON
{
  "phase": "codegen",
  "actors": {
    "planning": { "round": 3, "status": "workshop" },
    "codegen": { "status": "pending" },
    "review": { "status": null },
    "test": { "status": null }
  }
}
```

	•	phase holds the current top-level state.
	•	actors.<phase> holds substate or round information if applicable.

The orchestrator:
	•	reads state.json,
	•	inspects artifacts on disk,
	•	determines valid next states,
	•	updates state.json accordingly.

⸻

5. Orchestrator invariants
	1.	A phase must not be skipped.
(e.g. jumping directly from planning → test is invalid)
	2.	Orchestrator MUST inspect artifacts before suggesting transitions.
	3.	Transitions MUST be idempotent:
re-running the same phase must be safe.
	4.	Terminal states:
	•	done means the task should not advance further,
	•	unless explicitly re-opened via a new /redo.

⸻

6. Allowed regressions

A regression is allowed if justified by artifacts:
	•	test → codegen if tests fail,
	•	review → planning if plan misalignment is discovered,
	•	codegen → plan_review when plan quality is insufficient.

Agents should produce specific signals (needs_changes, blocked) that the orchestrator uses to decide.

⸻

7. Human override

Humans can override transitions only if:
	•	a reason is recorded,
	•	the override is logged to transcript,
	•	the overridden target state is reachable in principle.

Example:

/next --override "I accept the risk of skipping review"


⸻

8. CLI mapping

State	CLI / REPL Trigger
planning	/plan
plan_review	/review plan
codegen	/codegen
review	/review code
test	/test
accept	/accept
revert	/revert
done	(terminal)

---
