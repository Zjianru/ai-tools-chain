# AI Tools Chain – Documentation v2

This directory contains the **second-generation documentation set** for the AI Tools Chain project.

> **Goal:** make the project understandable and maintainable as a _system_ (phases, agents, state machines, schemas), not just as a CLI tool.

If you are new to the project, read in this order:

1. `00-intro.md` – Why this system exists and what this doc set is for.
2. `01-overview.md` – System-level overview: lifecycle, phases, and core concepts.
3. `system/` – How the engine works:
   - `architecture.md` – High-level architecture and responsibilities.
   - `phases/*.md` – Each phase's purpose, inputs and outputs.
   - `workflows/*.md` – State machines and lifecycle flows.
   - `agents/*.md` – What each agent does and how they cooperate.
   - `schemas/*.md` – JSON/markdown schemas for important artifacts.
   - `timeline.md` – The canonical specification of the project timeline.

4. `planning/` – Additional materials for the planning domain:
   - `timeline-schema.md` – Tabular schema for the timeline file.
   - `glossary.md` – Terms and definitions used in planning docs.
   - `adr/` – Architecture Decision Records (ADRs) related to planning.
   - `examples/` – Example briefs, plans and timelines.

5. Root-level docs:
   - `roadmap.md` – Future directions and major TODOs.
   - `changelog.md` – Notable changes in the documentation and system design.

## Relationship to `docs/` (legacy docs)

- `docs/` contains the original, more narrative-style documentation.
- `docs_v2/` is the structured, contract-oriented documentation set.
- Over time, all **canonical** design, workflow and schema descriptions will live here.
- Legacy docs may still contain nuanced discussions and historical notes; when a design is fully captured in `docs_v2/`, `docs/` should be treated as historical background only.

## Target audiences

- **Contributors / maintainers** – Understand system design, constraints and contracts.
- **Advanced users** – Learn how phases, agents and artifacts map to the CLI behavior.
- **Tool integrators** – Use schemas and workflows to integrate external tools (e.g. editors, CI, providers) in a stable way.