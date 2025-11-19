# Changelog

This changelog tracks **notable changes in the system design and docs**,
not every code commit.

Follow the principles of [Keep a Changelog](https://keepachangelog.com/)
(adapted for this project).

Format:

- Group entries by version or date.
- Use subsections: `Added`, `Changed`, `Fixed`, `Removed`.
- Link to PRs or commits where useful.

---

## [Unreleased]

### Added
- Initial docs structure:
  - `00-intro.md`, `01-overview.md`, `README.md`.
- System-level docs:
  - `system/architecture.md`
  - `system/timeline.md`
  - `system/phases/*.md`
  - `system/workflows/*.md`
  - `system/agents/*.md`
  - `system/schemas/*.md`
- Planning docs:
  - `planning/timeline-schema.md`
  - `planning/glossary.md`
  - `planning/examples/*` (skeletons).

### Changed
- Established docs as the canonical documentation set for:
  - system design,
  - workflows,
  - schemas.

### Fixed
- Clarified the relationship between:
  - timeline ↔ tasks ↔ state.json.
---

## [2025-03-XX] - docs bootstrap

> Replace `XX` with the actual date when stabilizing the initial set.

### Added
- Bootstrapped docs with:
  - lifecycle, phases, workflows, agents, schemas, and planning docs.

### Changed

### Fixed
- Made timeline semantics explicit and aligned them with task-level state.

### Removed
- N/A