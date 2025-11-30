# ADR 0001 – Directory Structure for Task Artifacts

**Status:** Accepted  
**Date:** 2025-11-01  
**Deciders:** Project authors  
**Supersedes:** None

---

## Context

The system produces many artifacts across phases:

- planning → `planning.ai.json`, transcripts, file plan
- plan review → `plan-review.json`
- codegen → generated files, diffs
- review → code review outputs
- test → evaluation reports
- accept → decision summaries
- revert → rollback records

Early prototypes stored these files in ad-hoc locations (e.g. under `docs/`, directly in repo root, mixed with Git-tracked files).

This caused:

- conflicts with real source code,
- difficulty cleaning up experiments,
- confusion when navigating multiple tasks,
- inability to snapshot or archive tasks cleanly.

---

## Decision

All task artifacts MUST live under a **single root folder**:

```TEXT
.ai-tools-chain/tasks//
```

This folder is:

- **private** (ignored by Git unless the user opts in),
- **isolated** (per-task),
- **structured** (subfolders per phase).

> **Implementation status**
> - Status: Partially implemented
> - Implemented:
>   - `planning/` directory with `planning.ai.json`, `plan.md`, `plan-review.json`, etc.
> - Not yet implemented:
>   - `review/`, `code/`, `eval/`, `accept/`, `revert/` subdirectories.
> - Current behavior:
>   - `eval-report.json` lives at task root (see `src/core/eval.mjs`).
>   - Plan review JSON lives under `planning/` (see planning agents).
> - Migration plan:
>   - Gradually move artifacts into phase-specific subdirectories as
>     implementations catch up.


### Structure

.ai-tools-chain/
tasks/
TASK-001/
planning/
review/
code/
eval/
accept/
revert/
state.json

Each phase owns its own subfolder, and writes only within it.

---

## Rationale

1. **Avoid polluting the main repo**  
   Codegen and test artifacts should not accidentally be committed.

2. **Support multiple tasks concurrently**  
   Different tasks can be planned or coded without conflict.

3. **Enable history & archival**  
   Tasks can be zipped or deleted safely.

4. **One SSOT per task**  
   `state.json` inside the task folder cleanly captures the lifecycle.

5. **Align with other modern tools**  
   Tools like Terraform, Dagster, and many LLM dev tools use a `.tool-name/` pattern.

---

## Consequences

### Positive

- Clear separation of generated artifacts vs. real repo code.
- Easier debugging and reproducibility.
- Consistent structure for new contributors.

### Negative

- Some users may initially be confused why files appear “outside the repo”.
- Integrating with Git or remote tooling requires wrappers.

> **Implementation status**
> - Status: Partially implemented
> - Implemented:
>   - `planning/` directory with `planning.ai.json`, `plan.md`, `plan-review.json`, etc.
> - Not yet implemented:
>   - `review/`, `code/`, `eval/`, `accept/`, `revert/` subdirectories.
> - Current behavior:
>   - `eval-report.json` lives at task root (see `src/core/eval.mjs`).
>   - Plan review JSON lives under `planning/` (see planning agents).
> - Migration plan:
>   - Gradually move artifacts into phase-specific subdirectories as
>     implementations catch up.

---

## Alternatives considered

### 1. Store everything under project root  
Rejected due to noise and risk of accidental commits.

### 2. Store artifacts inside `.git/`  
Rejected — too fragile, hard to explore, tightly coupled to Git.

### 3. Use OS temp folders  
Rejected — artifacts need persistence, navigability, and references in `timeline.md`.

---

## Future work

- Provide a `ai-tools clean` command to clean old tasks.
- Allow configuration of the root folder via `ai-tools.conf`.

