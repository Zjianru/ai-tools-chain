
# Schema: Evaluation Report (eval-report.json)

This document defines the structure of the **evaluation report** written to:

```text
.ai-tools-chain/tasks/<id>/eval/eval-report.json
```
The report aggregates results from:
	•	tests,
	•	linters,
	•	prompt evaluation tools,
	•	any other automated checks run in the test phase.

⸻

1. Top-level shape
```json
{
  "task_id": "TASK-001",
  "status": "completed",
  "overall_pass": true,
  "summary": {
    "passed": 12,
    "failed": 1,
    "skipped": 2,
    "error": 0
  },
  "suites": [],
  "meta": {
    "started_at": "2025-03-01T12:00:00.000Z",
    "finished_at": "2025-03-01T12:05:30.000Z",
    "env": {
      "branch": "feature/planning-mvp",
      "commit": "abc123",
      "node": "v20.0.0"
    }
  }
}
```


⸻

2. Fields

2.1 task_id (string, required)
	•	ID of the task.

2.2 status (string, required)
	•	pending – test phase started but not completed.
	•	running – tests currently running (if streaming).
	•	completed – all configured checks finished.
	•	failed – evaluation itself failed (not just tests).

2.3 overall_pass (boolean, required)
	•	true if the evaluation considered the task “passing” overall.
	•	false if any non-allowed failure occurred.

This is what the accept phase will look at first.

2.4 summary (object, required)
```json
"summary": {
  "passed": 0,
  "failed": 0,
  "skipped": 0,
  "error": 0
}
```
Counts across all suites.

⸻

3. suites (array of objects, required)

Each suite represents a logical group of checks.

```json 
{
  "id": "unit-tests",
  "name": "Unit Tests",
  "kind": "test",
  "command": "npm test",
  "status": "completed",
  "overall_pass": true,
  "summary": {
    "passed": 10,
    "failed": 0,
    "skipped": 0,
    "error": 0
  },
  "cases": []
}
```
Fields:
	•	id (string, required)
	•	short identifier, e.g. unit-tests, lint, prompt-eval.
	•	name (string, optional)
	•	human-readable name.
	•	kind (string, optional)
	•	e.g. test, lint, prompt_eval, custom.
	•	command (string, optional)
	•	the command used to run this suite.
	•	status (string, required)
	•	pending, running, completed, failed.
	•	overall_pass (boolean, required)
	•	true if suite is considered passing.
	•	summary (object, required)
	•	same structure as top-level summary.
	•	cases (array, optional)
	•	detailed results per test/check.

⸻

4. cases (array of objects)

Each case is one test/check result.
```json
{
  "id": "test-planning-schema",
  "name": "Planning schema validation",
  "status": "passed",
  "duration_ms": 1200,
  "details": "All sample plans validated successfully.",
  "metadata": {
    "file": "tests/planning-schema.test.ts",
    "tags": ["schema", "planning"]
  }
}
```
Fields:
	•	id (string, required)
	•	test identifier.
	•	name (string, optional)
	•	human-readable description.
	•	status (string, required)
	•	passed, failed, skipped, error.
	•	duration_ms (number, optional)
	•	duration in milliseconds.
	•	details (string, optional)
	•	human-readable details, stack traces, etc.
	•	metadata (object, optional)
	•	arbitrary key-value data.

⸻

5. meta (object, optional)
```json
"meta": {
  "started_at": "2025-03-01T12:00:00.000Z",
  "finished_at": "2025-03-01T12:05:30.000Z",
  "env": {
    "branch": "feature/planning-mvp",
    "commit": "abc123",
    "os": "macOS-14",
    "node": "v20.0.0"
  }
}
```
Fields:
	•	started_at (string, timestamp)
	•	finished_at (string, timestamp)
	•	env (object)
	•	environment details such as:
	•	branch / commit,
	•	OS,
	•	language/runtime versions.

⸻

6. Invariants & accept phase usage
	1.	overall_pass MUST be present and boolean.
	2.	If any suite has overall_pass === false, then:
	•	top-level overall_pass SHOULD be false,
	•	unless explicitly overridden in post-processing.

The AcceptAgent should:
	•	treat overall_pass === false as a strong signal against acceptance,
	•	but allow humans to override with explicit reasoning in accept/decision.json.
