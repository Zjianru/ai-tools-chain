# System Architecture

This document describes the architecture of **AI Tools Chain** as a system.

It explains:

- the main runtime components,
- how they interact,
- how their responsibilities map to files on disk,
- and the key design principles behind the system.

The goal is that a contributor can look at this page and answer:

> “When I run a CLI command for a task, what happens where?”

---

## 1. Architectural goals

1. **Deterministic workflows**  
   The system should produce repeatable, inspectable outputs for each phase.

2. **Human-controllable automation**  
   Users can run one phase at a time, redo phases, and override transitions.

3. **Separation of concerns**  
   CLI, orchestrator, agents, broker and providers each have clear roles.

4. **Structured artifacts**  
   Every important step writes machine-checkable JSON/Markdown under a task dir.

5. **Local-first**  
   Everything runs on the developer’s machine; no server is required.

6. **Model-agnostic core**  
   Providers can change without rewriting phase logic or agents.

---

## 2. High-level view

At the highest level the system is:

- a **local-first CLI** (`ai-tools`),
- that drives a **task lifecycle** through a set of **phases**,
- implemented by **agents**,
- which call out to **model providers** via a **broker**,
- and persist artifacts under a **per-project work directory**
  (`.ai-tools-chain/` by default).

Conceptual diagram:

```text
User (CLI / REPL)
        |
        v
   CLI Commands  ——  REPL
        |               |
        +----------+----+
                   v
            Orchestrator
                   |
          +--------+-----------------------------+
          |        |        |        |           |
          v        v        v        v           v
    Planning   Codegen   Review    Test       Accept/Revert
      Agent     Agent    Agents   Agent          Agents
          \        |        |        |          /
           \       |        |        |         /
            \      |        |        |        /
             v     v        v        v       v
               Model Broker (roles, profiles)
                       |
                       v
             Providers (Anthropic, OpenAI, Copilot, ...)

All along the way, artifacts are written to disk so that the full history of a
task is inspectable and versionable in Git.
```
⸻

3. Main components

3.1 CLI & REPL

Responsibilities
	•	Parse commands (ai-tools init, ai-tools repl, ai-tools plan, …).
	•	Ensure the project is initialized (config + workdir).
	•	Create or resume tasks.
	•	Delegate to the appropriate phase orchestration (e.g. planning).
	•	Record a transcript of user commands and system events.

Key behaviors
	•	The REPL is the main interactive entry point:
	•	understands commands like /plan, /review, /codegen, /test,
/accept, /next, /redo.
	•	uses the orchestrator to suggest the next phase based on state.json.
	•	logs each interaction into a per-task transcript file (usually JSONL).

Implementation
	•	CLI commands: src/cli/commands/*
	•	REPL loop: src/cli/repl.mjs
	•	Project / task initialization helpers: src/core/*

⸻

3.2 Task workdir & filesystem layout

Each project has a root-level workdir:
	•	.ai-tools-chain/

Within that, each task gets its own subdirectory:
```text
.ai-tools-chain/
  tasks/
    <task-id>/
      state.json
      meta.json
      transcript.jsonl
      planning/
        brief.md
        planning.ai.json
        plan.md
        plan.files.json
        meeting.jsonl
        ...
      review/
        plan-review.json
        plan-review.md
        code-review.json
        ...
      code/
        diff.patch
        files/
          ...
      eval/
        eval-report.json
        logs/
          ...
      accept/
        decision.json
        notes.md
      revert/
        record.json
        notes.md
      logs/
        ...
```
Invariants
	•	Every phase that runs for a task must leave artifacts in the task dir.
	•	state.json reflects the current phase and the status of its actors.
	•	Nothing important lives only “in memory” – if it matters, it lands on disk.

The rationale for this layout is described in ADR 0001 (directory structure).

⸻

3.3 Orchestrator & state machine

The orchestrator:
	•	knows the global lifecycle of a task (which phases exist and in what order),
	•	reads and writes state.json,
	•	decides what to do next based on:
	•	current phase,
	•	presence and content of key artifacts
(e.g. plan review verdicts, evaluation results).

Example decisions
	•	After planning finishes, move to plan_review.
	•	If plan_review produces a blocking verdict, suggest going back to planning.
	•	After codegen and tests, route to accept with the evaluation summary.
	•	On /redo, snapshot relevant artifacts and revisit a phase.

Implementation
	•	Orchestrator logic: src/agents/orchestrator.mjs (and related helpers).
	•	State utilities: src/core/state.mjs, src/core/task.mjs.

The global state machine is documented in:
	•	system/workflows/global-state-machine.md

Planning-specific substates are in:
	•	system/workflows/planning-state-machine.md

⸻

3.4 Agents

An agent is a logical role that:
	•	executes a specific phase or sub-phase,
	•	talks to models through the broker,
	•	reads and writes artifacts in the task directory.

Examples:
	•	PlanningAgent
	•	runs multi-round planning workshops,
	•	produces planning.ai.json and plan.md.
	•	Plan review agents
	•	take a plan as input and generate structured verdicts,
	•	aggregate multiple “virtual reviewers” (product, system design, risk, …).
	•	Codegen agent
	•	reads the plan and a repo summary,
	•	generates draft code changes as files and/or patches.
	•	Review agents
	•	inspect diffs and plans,
	•	produce comments or structured verdicts.
	•	Test / eval agent
	•	executes configured commands (lint, tests, prompt evaluations),
	•	produces an evaluation report.
	•	Accept / Revert agents
	•	help decide whether to accept a task’s output,
	•	trigger local actions to apply or revert the changes.

Implementation
	•	Agents: src/agents/*.mjs
	•	Matching docs: docs_v2/system/agents/*.md

The rationale for multi-agent architecture is in ADR 0002.

⸻

3.5 Model broker, roles and providers

Agents do not talk directly to Anthropic, OpenAI, Copilot or other providers.
Instead they call the model broker with a role.

Concepts
	•	Role
	•	a named capability (e.g. planning, review, codegen, assistant);
	•	configured with prompts, default models, tool usage settings, etc.
	•	Profile
	•	a set of provider choices and options for a given environment
(e.g. local-dev, anthropic-first, openai-first).
	•	Broker
	•	given a role and a request payload:
	•	looks up the active profile,
	•	resolves the chain of providers to try,
	•	adapts the call for each provider (via adapters),
	•	returns the first successful model response.
	•	Providers
	•	implement the actual API calls or integrations:
	•	hosted APIs (Anthropic, OpenAI),
	•	local tools (GitHub CLI for Copilot),
	•	future: local models, custom endpoints, etc.

Implementation
	•	Broker & role handling: src/models/broker.mjs
	•	Provider adapters: src/models/providers/*.mjs
	•	Role prompts and instructions: src/models/prompts/**/*
	•	Provider-independent schemas: docs_v2/system/schemas/

⸻

3.6 External tools and integrations

The system may delegate specific duties to external tools, for example:
	•	Git – snapshotting, diff generation, and safety checks.
	•	OpenSpec CLI – generating structured specs from plans (if installed).
	•	Prompt evaluation tools – e.g. promptfoo (via configured eval commands).
	•	Editor / IDE integrations – future:
	•	surface task status,
	•	show artifacts (plans, reviews, eval reports),
	•	trigger CLI commands.

Integration contracts are documented either:
	•	in system/schemas/ (for data structures), or
	•	in system/phases/*.md (for behavior and expectations).

⸻

4. State management

4.1 Task state (state.json)

Stored at:
```text
.ai-tools-chain/tasks/<id>/state.json
```
Contains, at minimum:
```json
{
  "phase": "codegen",
  "actors": {
    "planning": { "round": 3, "status": "workshop" },
    "codegen": { "status": "pending" }
  }
}
```
	•	phase holds the current top-level state.
	•	actors.<phase> holds substate or round information, when applicable.

The orchestrator:
	•	reads state.json,
	•	inspects artifacts on disk,
	•	determines valid next states,
	•	updates state.json accordingly.

4.2 Artifact-based validation

Phases progress only when:
	•	required files exist,
	•	JSON schema is valid,
	•	no blocking issues are reported in phase outputs.

This ensures deterministic, inspectable workflows.

⸻

5. Workflow lifecycle

At the global level, the task lifecycle is:

planning → plan_review → codegen → review → test → accept → done

With possible regressions:
	•	plan_review → planning
	•	codegen → planning / plan_review
	•	review → codegen / planning
	•	test → codegen
	•	accept → revert

Details:
	•	Phases: docs_v2/system/phases/*.md
	•	Workflows: docs_v2/system/workflows/*.md

⸻

6. Design principles

The architecture follows these principles:
	1.	Local-first and asset-centric
	•	Everything important ends up as a file under .ai-tools-chain/.
	•	This makes it easy to inspect history, version with Git, and debug problems.
	2.	Separation of concerns
	•	CLI / REPL: user interaction.
	•	Orchestrator: state and phase progression.
	•	Agents: do actual work in a well-defined scope.
	•	Broker / providers: talk to models.
	•	Docs / schemas: define contracts.
	3.	Model-agnostic core
	•	Providers and models can change without rewriting agent logic.
	•	The system can be configured differently per environment.
	4.	Explicit workflows
	•	State machines are documented and reflected in code.
	•	Phases are explicit, not implicit side-effects.

If a contributor wants to change behavior, they should:
	•	update the relevant docs under docs_v2/,
	•	adjust orchestrator / agents / schemas accordingly,
	•	keep the system coherent at the architectural level.

⸻

7. Future architecture directions

Potential future work:
	•	semantic plan diffing and plan evolution (v2+),
	•	CI integration for test / eval phase using the same artifacts,
	•	optional UI (VS Code sidebar or TUI),
	•	richer provider plugins and model routing policies,
	•	meta-agents that propose workflow shortcuts.

⸻

8. Summary

This architecture:
	•	enforces structure,
	•	supports automation,
	•	remains flexible and override-friendly,
	•	and scales with future complexity.

It is the foundation of the entire AI Tools Chain system.
