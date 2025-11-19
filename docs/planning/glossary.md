# Glossary

This glossary defines key terms used across the AI Tools Chain system,
documentation and codebase.

It exists to ensure contributors and tools share a consistent vocabulary.

---

# A. Core Concepts

### **Task**
A unit of work that passes through the system’s lifecycle.  
Each task has:

- a unique ID,
- a directory under `.ai-tools-chain/tasks/`,
- a `state.json` describing its phase,
- artifacts produced by each phase.

Tasks are the smallest trackable deliverables in the system.

---

### **Phase**
A distinct stage in the task lifecycle, implemented by an agent.

Current phases:

planning
plan_review
codegen
review
test
accept
revert

Phases map to CLI commands and orchestrator logic.

---

### **Agent**
A component that performs structured work within a phase.

Examples:

- `PlanningAgent`
- `planReviewAgent`
- `codegenAgent`
- `testAgent`
- `acceptAgent`

Agents:

- read artifacts,
- call models through the broker,
- write structured outputs back to the task directory.

---

### **Model Broker**
A provider-agnostic layer that:

- maps roles → providers,
- resolves profiles,
- tries providers in fallback chains,
- normalizes responses.

Agents never call models directly.

---

### **Provider**
A backend capable of fulfilling a role.

Examples:

- Anthropic API (Claude)
- OpenAI API
- GitHub Copilot CLI
- Local LLMs (future)

Providers are configured in `models.conf` and implemented under `src/models/providers/`.

---

### **Role**
A named model capability like:

planning
review
assistant
codegen
summary

Roles define prompt templates and expected output structure.

A role may map to multiple providers via a chain.

---

### **Profile**
A configuration bundle selecting:

- which providers to use,
- how to prioritize them,
- which roles are enabled.

Profiles are environment-scoped (e.g. dev/local/enterprise).

---

# B. Planning Concepts

### **Brief**
A short description of the task, written by the user or PlanningAgent.

This is the seed input for planning.

---

### **Planning Workshop**
A multi-round iterative planning session:

- transcript stored in JSONL,
- each round evaluated by multiple virtual roles,
- produces structured `planning.ai.json`.

---

### **Planning Schema**
The JSON structure describing:

- scope,
- tasks,
- risks,
- assumptions,
- acceptance criteria,
- file-level plan.

Documented in:  
`docs_v2/system/schemas/planning-schema.md`.

---

### **Plan Review**
A review step where multiple roles (Product, System Design, Engineering, Test, Risk)
evaluate the plan and output structured verdicts.

Documented in:  
`docs_v2/system/phases/plan-review.md`.

---

# C. Execution Concepts

### **Repo Summary**
A structured representation of the codebase used during codegen.

Agents build this summary or load it from disk.

---

### **Code Diff / Patch**
The output of the codegen phase, stored as:

- `diff.patch`
- expanded files in `code/files/`

---

### **Evaluation Report**
The output of the test phase, usually found under:

- `eval/eval-report.json`

Contains:

- test results,
- lint results,
- prompt evaluations (if configured),
- environment details.

---

### **Acceptance Decision**
The output of the accept phase.

Should include:

- final verdict,
- reasons,
- links to artifacts (plan, diff, eval report),
- any human notes.

Stored under:

.ai-tools-chain/tasks//accept/

---

# D. Timeline & Project-Level Concepts

### **Timeline**
Project-level table listing:

- tasks,
- milestones,
- current status.

The canonical file is:

docs_v2/planning/timeline.md

Schema defined in:  
`docs_v2/planning/timeline-schema.md`.

---

### **Milestone**
A grouping mechanism for timeline items.

Examples:

- “M1: Planning MVP”
- “2025-Q2”

---

### **Dependency**
A reference from one timeline item to another via `depends`.

---

### **SSOT (Single Source of Truth)**
The design principle that:

- timeline = project-level truth,
- task artifacts = task-level truth,
- state.json = runtime truth.

Cross-file inconsistencies must be reconciled.

---

# E. Meta & Governance

### **ADR (Architecture Decision Record)**
A short document explaining:

- what decision was made,
- why,
- alternatives considered.

Used to evolve schemas, enums, and conventions.

---

### **Schema**
A formal specification of structure and types for generated or consumed files.

Schemas are treated as contracts.

---

### **Artifact**
Any file produced during a phase.

Artifacts are:

- durable,
- inspectable,
- versioned,
- the foundation of reproducibility.
