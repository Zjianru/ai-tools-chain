# ADR 0003 – Planning Rationale and Multi-Round Workshop Model

**Status:** Accepted  
**Date:** 2025-03-02  
**Deciders:** Project authors  
**Supersedes:** None

---

## Context

Planning is the most ambiguous phase in an AI-assisted developer workflow.

Previous attempts:

- single-shot planning prompts (too shallow),
- pre-defined templates (too rigid),
- human-only planning (not reproducible),
- code-first flows (planning emerges implicitly and inconsistently).

These approaches lacked:

- structure,
- machine-checkable outputs,
- repeatability,
- alignment with downstream codegen.

---

## Decision

Adopt a **multi-round “planning workshop” model** with the following characteristics:

1. **Multiple rounds**  
   Clarification → brainstorming → structuring → formalizing.

2. **Transcript as history**  
   All interactions logged in `planning/meeting.jsonl`.

3. **Structured plan JSON**  
   `planning.ai.json` is the single source of truth (SSOT).

4. **File-level plan**  
   `plan.files.json` specifies exactly which files downstream phases may touch.

5. **Narrative projection**  
   `plan.md` is human-readable, projected from the structured JSON.

6. **State machine**  
   Planning follows `planning-state-machine.md`.

---

## Rationale

1. **Planning requires iteration**  
   Task requirements emerge gradually; a single prompt is insufficient.

2. **Traceability**  
   The transcript helps with debugging and compliance.

3. **Separation of concerns**  
   JSON plan is for machines; markdown plan is for humans.

4. **Downstream guarantees**  
   Codegen depends on file-level clarity; review depends on plan alignment.

5. **Future automation**  
   Having a stable structure allows:
   - diffing plans,
   - plan evolution (v2, v3…),
   - partial updates,
   - cross-task reasoning.

---

## Consequences

### Positive

- Planning becomes reproducible and debuggable.
- Every artifact is anchored in a schema.
- Codegen becomes safer and more predictable.
- Reviewers (human/LLM) have stable context.

### Negative

- Requires more steps per task.
- More prompt and model complexity.

---

## Alternatives Considered

### 1. Single-shot planning prompt  
Rejected — too shallow, brittle.

### 2. Plan-in-natural-language only  
Rejected — unstructured, hard to validate.

### 3. Use plan.md as SSOT  
Rejected — markdown cannot reliably encode structure.

---

## Future Work

- Support plan updates (v2+) and semantic diffs.
- Build tooling to summarize transcripts.
- Add heuristics for early stopping if plan stabilizes.
