# ADR 0002 – Multi-Agent Architecture

**Status:** Accepted  
**Date:** 2025-03-02  
**Deciders:** Project authors  
**Supersedes:** None

---

## Context

The system orchestrates complex workflows:

- multi-round planning,
- plan reviews by different personas,
- code generation across multiple files,
- structured code review,
- evaluation,
- acceptance,
- revert.

Early experiments attempted to use **one large “do everything” prompt**.

Problems observed:

- difficult to control, maintain, and debug,
- mixing of responsibilities,
- poor reproducibility,
- impossible to enforce schemas or state-machine transitions,
- model outputs became brittle with new versions.

---

## Decision

Adopt a **multi-agent architecture**, where each phase is implemented by a dedicated agent:

- `PlanningAgent`
- `PlanReviewAgent`
- `CodegenAgent`
- `ReviewAgent`
- `AcceptAgent`
- `RevertAgent`

And an **Orchestrator** coordinates these according to:

- `global-state-machine.md`
- each phase’s contract in `system/phases/`

Agents are “virtual roles” executed through the model broker, not necessarily separate processes.

---

## Rationale

1. **Single Responsibility Principle**  
   Each agent handles one logical part of the workflow.

2. **Better control**  
   Prompts, schemas, and state transitions are tailored per agent.

3. **More debuggable**  
   A failing step is isolated.

4. **Better extensibility**  
   Add a new review role? Add a new agent without touching others.

5. **Consistent artifacts**  
   Each agent produces predictable files under its own directory.

6. **Foundation for automation**  
   Humans or CI tools can run agents individually.

---

## Consequences

### Positive

- Clear boundaries.
- Better prompts.
- Easier maintenance.
- Easier to replace one agent without breaking the system.
- Enables hybrid workflows (LLM + human).

### Negative

- More initial boilerplate (more agents to create).
- Requires a more thoughtful orchestrator.

---

## Alternatives considered

### 1. Single monolithic “super agent”  
Rejected — unmaintainable, inherently unstable.

### 2. Hard-coded sequence of prompts without an orchestrator  
Rejected — no ability to recover state, no resilience.

### 3. Code-only automation (no agents)  
Rejected — removes flexibility and future LLM-role expansion.

---

## Future work

- Introduce optional “meta-agents” to propose workflow shortcuts.
- Auto-generate agent skeletons from schemas.