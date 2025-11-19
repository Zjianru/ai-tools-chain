# Codegen Lifecycle

The codegen lifecycle describes how code generation proceeds **inside** the
global `codegen` phase.

It breaks down into:

1. context assembly,
2. generation,
3. materialization,
4. diff computation,
5. readiness signaling.

---

# 1. Stages

context
generate
materialize
diff
ready

---

# 2. Diagram

```mermaid
stateDiagram-v2
    [*] --> context
    context --> generate
    generate --> materialize
    materialize --> diff
    diff --> ready


⸻

3. Stage definitions

context

Collect all necessary inputs:
	•	plan.md
	•	plan.files.json
	•	repo summary (if enabled)
	•	relevant existing code

A “context package” is built for the codegen model.

⸻

generate

The codegen agent:
	•	invokes one or more model providers (role: codegen),
	•	using:
	•	the context package,
	•	constraints from plan.files.json,
	•	patch/file generation instructions.

Output can be:
	•	full file contents,
	•	or patches,
	•	or hybrid (per-provider behavior).

⸻

materialize

Generated artifacts are written to:

code/files/

Rules:
	•	One output file per target file path.
	•	Directories must be created as needed.
	•	Any conflicting files MUST be overwritten deterministically.

⸻

diff

Compute:
	•	unified diff between code/files/* and the working tree,
	•	store result at:

code/diff.patch

Rules:
	•	The diff must be reproducible (order, context lines, etc. should be stable).
	•	Missing target files in repo should be treated as empty.

⸻

ready

Codegen phase signals completion when:
	•	code/files/ contains at least one file,
	•	code/diff.patch exists and is non-empty (unless explicitly allowed),
	•	materialization succeeded.

The orchestrator may now transition to review.

⸻

4. Failure modes

Missing outputs
	•	No diff produced,
	•	No files produced.

→ agent should mark failure; orchestrator suggests re-run.

Scope mismatch
	•	Generated changes touch files not referenced in plan.files.json.

→ orchestrator should route back to planning or plan_review.

Provider error
	•	Model errors out.

→ agent should retry or fallback based on provider chain.

⸻

5. CLI behavior
	•	/codegen triggers this lifecycle.
	•	/redo codegen should:
	•	archive previous code/files/ and diff.patch,
	•	start from context again.

⸻

6. Invariants
	1.	Codegen MUST NOT modify working tree unless explicitly configured.
	2.	code/files/ is the SSOT for generated code.
	3.	diff.patch is always derived; never primary.
	4.	Codegen must respect planned file paths unless overridden intentionally.
