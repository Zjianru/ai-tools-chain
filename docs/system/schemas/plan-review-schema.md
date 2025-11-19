# Schema: Plan Review (plan-review.json)

This document defines the structure of the **plan review output** written to:

```text
.ai-tools-chain/tasks/<id>/review/plan-review.json
```
It captures:
	•	per-role verdicts,
	•	an aggregated decision,
	•	and actionable suggestions.

⸻

1. Top-level shape
```json
{
  "task_id": "TASK-001",
  "plan_version": "v1",
  "reviewers": [],
  "aggregate": {
    "ok": true,
    "decision": "accepted",
    "confidence": 0.82,
    "reasons": [],
    "suggestions": []
  },
  "meta": {
    "created_at": "2025-03-01T11:00:00.000Z",
    "updated_at": "2025-03-01T11:05:00.000Z"
  }
}
```



⸻

2. Fields

2.1 task_id (string, required)
	•	Typically matches timeline and task directory ID.

2.2 plan_version (string, optional)
	•	Identifier for the plan version being reviewed.
	•	Could be:
	•	a timestamp,
	•	a sequential version number,
	•	or a Git commit hash.

⸻

3. reviewers (array of objects, required)

Each reviewer represents a virtual or human role that reviewed the plan.
```json
{
  "id": "product",
  "name": "ProductPlanner",
  "role": "ProductPlanner",
  "ok": true,
  "decision": "accept",
  "confidence": 0.9,
  "strengths": [
    "Good articulation of user value."
  ],
  "weaknesses": [
    "Timeline assumptions are a bit optimistic."
  ],
  "suggestions": [
    "Clarify non-goals around multi-repo support."
  ],
  "blocking_issues": [],
  "meta": {
    "source": "model",
    "provider": "anthropic"
  }
}
```
Fields:
	•	id (string, required)
	•	short identifier, e.g. product, system, dev, test, risk.
	•	name (string, optional)
	•	human-readable label.
	•	role (string, optional)
	•	maps to the prompt role used via the broker.
	•	ok (boolean, required)
	•	whether this reviewer is comfortable proceeding.
	•	decision (string, optional)
	•	accept, needs_changes, blocked, defer.
	•	confidence (number, optional)
	•	0–1 confidence measure.
	•	strengths (array of string, optional)
	•	weaknesses (array of string, optional)
	•	suggestions (array of string, optional)
	•	improvements that are nice-to-have, not necessarily blockers.
	•	blocking_issues (array of string, optional)
	•	reasons why the plan cannot proceed as-is.
	•	meta (object, optional)
	•	source: "model" or "human",
	•	provider: if source === "model".

⸻

4. aggregate (object, required)

Represents the combined decision derived from all reviewers.
```json
"aggregate": {
  "ok": true,
  "decision": "accepted",
  "confidence": 0.82,
  "reasons": [
    "All reviewers are ok; risk level is acceptable."
  ],
  "suggestions": [
    "Add one more acceptance criterion regarding documentation."
  ],
  "blocking_issues": []
}
```
Fields:
	•	ok (boolean, required)
	•	main flag used by the orchestrator:
	•	true → can proceed to codegen,
	•	false → should go back to planning.
	•	decision (string, optional)
	•	accepted, needs_changes, blocked.
	•	confidence (number, optional)
	•	aggregate confidence score (0–1).
	•	reasons (array of string, optional)
	•	explanation for the aggregate decision.
	•	suggestions (array of string, optional)
	•	high-level improvements to implement before/after codegen.
	•	blocking_issues (array of string, optional)
	•	explicit blockers that require revisiting planning.

⸻

5. meta (object, optional)
```json
"meta": {
  "created_at": "2025-03-01T11:00:00.000Z",
  "updated_at": "2025-03-01T11:05:00.000Z",
  "plan_hash": "sha256-of-plan",
  "generator": "PlanReviewAgent-v1"
}
```
Fields:
	•	created_at (string, timestamp)
	•	updated_at (string, timestamp)
	•	plan_hash (string, optional)
	•	hash of the plan content used for review.
	•	generator (string, optional)
	•	agent or tool that produced this review.

⸻

6. Invariants & orchestrator usage
	1.	aggregate.ok MUST be present and boolean.
	2.	If any reviewer has blocking_issues.length > 0, then:
	•	aggregate.ok SHOULD be false,
	•	or an explicit override MUST be recorded in reasons.

The orchestrator uses:
	•	aggregate.ok === true → plan_review → codegen
	•	aggregate.ok === false → plan_review → planning

Human overrides should be recorded in the task transcript and/or decision notes.

