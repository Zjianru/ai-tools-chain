# Architectural Decision Records (ADR)

This folder contains **Architectural Decision Records (ADRs)**.

ADRs capture **key technical and product decisions** that shape the system.
They are living documents meant to:

- make reasoning visible,
- preserve institutional knowledge,
- help contributors understand *why* things are the way they are,
- support future refactoring or redesign discussions.

## Principles

- **One ADR per decision**.
- **Never change history** — if a decision changes, create a new ADR.
- ADRs should be:
  - short,
  - structured,
  - focused on one idea,
  - linked from other docs where relevant.

## Current ADRs

- `0001-directory-structure.md`  
  Why all task artifacts live under `.ai-tools-chain/tasks/<id>/…`.

- `0002-agent-architecture.md`  
  Why the system uses a multi-agent model (PlanningAgent, ReviewAgent, etc.) coordinated by an orchestrator.

- `0003-planning-rationale.md`  
  Why the project adopts a multi-round workshop planning model with structured JSON (`planning.ai.json`) as the SSOT.

More ADRs will be added over time as the system grows.