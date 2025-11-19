# Schema: Planning Meeting Transcript (meeting.jsonl)

This document defines the schema for the planning workshop transcript:

```text
.ai-tools-chain/tasks/<id>/planning/meeting.jsonl
```
Each line in this file is a separate JSON object.

The transcript provides a recoverable history of the planning conversation.

⸻

1. Line-level JSON shape

Each line is a JSON object like:
```json
{
  "ts": "2025-03-01T10:15:30.123Z",
  "round": 3,
  "actor": "SystemDesigner",
  "phase": "workshop",
  "role": "planning",
  "source": "model",
  "content_type": "markdown",
  "content": "Proposed tasks and file-level changes ...",
  "meta": {
    "task_id": "TASK-001",
    "message_id": "uuid-or-provider-id",
    "provider": "anthropic",
    "tokens_in": 123,
    "tokens_out": 456
  }
}
```



⸻

2. Fields

2.1 ts (string, required)
	•	ISO 8601 timestamp with milliseconds in UTC.
	•	Example: "2025-03-01T10:15:30.123Z".

2.2 round (integer, required)
	•	Planning round number (1-based).
	•	Multiple entries may share the same round.

2.3 actor (string, required)

The “persona” speaking:
	•	User – human user.
	•	PlanningAgent – orchestrating agent.
	•	ProductPlanner, SystemDesigner, SeniorDeveloper, TestPlanner, RiskPlanner – virtual roles.

Projects may extend this list, but values should be documented in prompts and/or ADRs.

2.4 phase (string, required)

Planning substate at the time of the message:
	•	draft
	•	clarifying
	•	workshop
	•	formalizing
	•	review_ready

Must match the planning state machine:
	•	system/workflows/planning-state-machine.md

2.5 role (string, required)

Model role used via the broker, e.g.:
	•	planning
	•	assistant

This allows replay tooling to reconstruct how the message was produced.

2.6 source (string, required)
	•	"user" – human input,
	•	"model" – model output,
	•	"system" – internal system note or meta.

2.7 content_type (string, optional)
	•	"markdown" (recommended default),
	•	"text",
	•	"json".

Used to decide how to render content.

2.8 content (string, required)
	•	The actual message body.
	•	For model messages:
	•	may contain instructions, plan snippets, etc.
	•	For system messages:
	•	should be human-readable explanations of actions taken.

2.9 meta (object, optional)

Used for implementation details and analytics.

Recommended fields:
	•	task_id (string)
	•	message_id (string) – unique message identifier.
	•	provider (string) – e.g. anthropic, openai, copilot.
	•	tokens_in (number)
	•	tokens_out (number)
	•	cost (number, optional) – if known, cost in currency.

Additional fields may be added, but SHOULD remain additive and backward compatible.

⸻

3. Invariants
	1.	round MUST be non-negative integer and MUST NOT decrease over time.
	2.	For a given round, phase SHOULD be consistent unless explicitly transitioning.
	3.	ts SHOULD be monotonic non-decreasing for new lines.

⸻

4. Usage
	•	The PlanningAgent appends lines as planning progresses.
	•	Replay tooling can:
	•	reconstruct any state,
	•	summarize history,
	•	audit model calls.

⸻

5. Privacy & redaction

If sensitive content is logged:
	•	redaction or summarization MAY be applied before storing,
	•	but content should remain meaningful enough for debugging.

A future ADR may define redaction policies.

