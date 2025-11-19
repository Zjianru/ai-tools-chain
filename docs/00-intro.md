# Introduction to the v2 Documentation

This document set exists because the project grew from a **“cool local CLI”** into a
**small but opinionated system for AI-assisted software delivery**.

The legacy docs (under `docs/`) captured a lot of design thinking, TODOs and
process notes, but they were:

- difficult to _navigate_ (many scattered notes),
- hard to _keep in sync_ with the evolving code,
- and not _machine–friendly_ (schemas, contracts and workflows were implicit).

The goal of `docs_v2/` is to fix that.

---

## Goals of `docs_v2`

1. **Single source of truth for the system design**

   - Phases, agents, workflows and schemas described here must match the code.
   - Any behavior that matters for users or contributors should be documented here.
   - The timeline specification here is the canonical reference for project status.

2. **Make the system understandable as a pipeline, not as a collection of scripts**

   - You should be able to answer: _“What happens to a task from idea to accept?”_
   - The answer should be reconstructible from `system/phases/*.md` +
     `system/workflows/*.md` + `system/agents/*.md`.

3. **Be precise enough to drive tools**

   - Schemas here should be usable as contracts by:
     - CLI commands (validation),
     - editor integrations,
     - CI pipelines,
     - external agents or services.

4. **Keep design choices and TODOs visible, but organized**

   - ADRs capture why important decisions were made.
   - `roadmap.md` centralizes future directions and larger TODOs.

---

## How to read this doc set (for different roles)

### If you are a new contributor

1. Start with `01-overview.md` to understand the overall lifecycle.
2. Read `system/architecture.md` to see how CLI, phases, agents and providers fit.
3. Skim `system/workflows/global-state-machine.md` and `planning-state-machine.md`.
4. Dive into the phase docs for the part you want to modify.

### If you are mainly a user of the CLI

1. Read `01-overview.md` to understand what the tool is _trying_ to do.
2. Skim the relevant phase docs:
   - Planning: `system/phases/planning.md`
   - Codegen: `system/phases/codegen.md`
   - Test & Accept: `system/phases/test.md` and `system/phases/accept.md`
3. Look at `planning/examples/` for concrete examples of briefs and plans.

### If you are integrating tools or providers

1. Look at `system/schemas/*.md` for the artifacts you need to produce or consume.
2. Use `system/timeline.md` and `planning/timeline-schema.md` as the canonical
   reference for status and task-level information.
3. Check `roadmap.md` for planned extensions that might affect your integration.

---

## Migration from legacy docs

The legacy `docs/` directory still contains valuable material:

- Deep-dive design discussions,
- Scattered TODOs,
- Historical notes about early iterations.

As we migrate content into `docs_v2/`, we aim to:

- **Extract** stable designs and contracts into `system/` and `planning/`,
- **Summarize** relevant long-form reasoning as ADRs,
- **Centralize** open TODOs in `roadmap.md`.

If you find an inconsistency between `docs/` and `docs_v2/`, `docs_v2/` should
win — and we should either update or explicitly mark the legacy material as
historical.