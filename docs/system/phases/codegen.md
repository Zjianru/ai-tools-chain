# Phase: Codegen

The **codegen** phase turns an accepted plan into concrete code changes.

It can:

- generate new files,
- modify existing files,
- or propose patches for manual review.

---

## 1. Goals

The codegen phase should:

1. Implement the plan at the code level.
2. Stay within the scope defined in the plan.
3. Produce changes in a form that is:
   - inspectable (diffs, files),
   - reversible (patches),
   - and testable.

---

## 2. Inputs

### 2.1 Required

- `planning/plan.md` – narrative plan.
- `planning/plan.files.json` – per-file plan, if available.

### 2.2 Optional

- `planning/planning.ai.json` – structured plan details.
- `review/plan-review.json` – to be aware of caveats.
- Repo summary:
  - directories, existing modules, key files.

---

## 3. Process

1. **Context assembly**
   - Collect:
     - relevant parts of the plan,
     - existing code snippets,
     - repo structure.

2. **Generation**
   - Call a codegen role via the model broker:
     - may use one or more providers (e.g. Anthropic, OpenAI, Copilot).
   - Generate:
     - full file contents, or
     - patches / inline edits.

3. **Materialization**
   - Write results under the task directory:
     - `code/files/` – full versions of modified/created files,
     - `code/diff.patch` – unified diff against the working tree.
   - Optionally apply the patch to the working tree:
     - depending on configuration and safety checks.

---

## 4. Outputs

Under the task directory:

- `code/files/`
  - one file per target file path, representing the desired state.
- `code/diff.patch`
  - a unified diff against the current repo state.
- Additional logs if needed:
  - provider responses (sanitized),
  - intermediate summaries.

Downstream phases (review, test) use these artifacts.

---

## 5. State machine

In the global state machine:

- Codegen corresponds to the `codegen` phase.

Typical transitions:

- `plan_review` → `codegen` (if plan accepted).
- `codegen` → `review` (once code is generated).
- `codegen` → `planning` or `plan_review` if scope issues are detected.

The orchestrator may:

- detect missing or invalid outputs,
- suggest re-running codegen or revisiting planning.

---

## 6. CLI & user interaction

### 6.1 Commands

- `ai-tools codegen` – run the codegen phase once.
- `/codegen` – in REPL, trigger code generation.

### 6.2 User responsibilities

- Inspect:
  - the diff (`code/diff.patch`),
  - the generated files.
- Make decisions about:
  - whether to accept the patch into the working tree,
  - whether to tweak the plan or re-run codegen.

Configuration SHOULD allow for:

- dry-run mode (no automatic patch application),
- aggressive mode (apply patch and stage changes).

---

## 7. Failure modes & handling

- **Scope creep**
  - Generated changes go beyond the planned scope.
  - Handling:
    - adjust prompts to enforce adherence to `plan.files.json`,
    - use additional heuristics to limit which files can be changed.

- **Broken code**
  - Code fails to compile or tests fail immediately.
  - Handling:
    - rely on test phase to catch issues,
    - allow for multiple codegen iterations.

- **Unmergeable patch**
  - Patch fails to apply due to local changes.
  - Handling:
    - rebase / regenerate diff from updated repo,
    - keep full files in `code/files/` as a source of truth.