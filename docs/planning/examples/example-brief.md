# Example Brief – Planning MVP

## Context

We want a **local-first AI development helper** that can guide a task from:

- an initial idea,
- through planning,
- to code generation, review, test and accept.

This example focuses on the **Planning MVP**: making the planning phase usable
end-to-end for a single task.

## Problem

Right now, the project has:

- some agents and CLI commands,
- some legacy docs under `docs/`,
- but no clear, single source of truth for planning artifacts and workflow.

We need to:

- formalize the planning output as `planning.ai.json`,
- generate a human-readable `plan.md`,
- and define a file-level plan for downstream codegen.

## Desired outcome

After running the planning phase for a task, we should have:

- a clear structured plan with:
  - goals,
  - scope,
  - work breakdown,
  - risks,
  - assumptions,
  - acceptance criteria,
  - file-level changes.

- artifacts should live under:
  - `.ai-tools-chain/tasks/<id>/planning/`
  - and conform to the schemas in `docs_v2/system/schemas/`.