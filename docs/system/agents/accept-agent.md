 Agent: AcceptAgent

The **AcceptAgent** assists in the `accept` phase, helping to:

- aggregate evidence,
- summarize risks and benefits,
- propose a recommendation,
- record the final decision.

Implementation:  
`src/agents/acceptAgent.mjs` (name may vary but refers to the acceptance helper).

---

## 1. Responsibilities

1. **Gather evidence**
   - From:
     - planning artifacts,
     - plan review,
     - code review,
     - evaluation report.

2. **Summarize**
   - Provide a concise overview:
     - what was implemented,
     - test status,
     - known issues and caveats.

3. **Recommend**
   - Suggest:
     - `accept`,
     - `needs-work`,
     - `defer`,
   - with reasons.

4. **Record decision**
   - Assist the human in creating:
     - `accept/decision.json`,
     - and optionally `accept/summary.md`.

---

## 2. Inputs

- `planning/plan.md`
- `review/plan-review.json`
- `review/code-review.json` / `.md`
- `eval/eval-report.json`
- Task metadata and timeline row.

---

## 3. Outputs

Under the task directory:

- `accept/decision.json`
  - structured decision including:
    - final verdict,
    - reasons,
    - references to artifacts,
    - timestamps,
    - decision maker.

- `accept/summary.md` (optional)
  - narrative summary.

The `accept_link` in the timeline SHOULD point to one of these.

---

## 4. Interaction with model broker

The AcceptAgent uses:

- roles like `assistant`, `review`, or a dedicated `accept` role,
- provider chains configured in `models.conf`.

It MUST:

- never auto-merge or auto-apply changes,
- treat acceptance as an advisory decision unless a human confirms.

---

## 5. Relationship to phases & state machine

The AcceptAgent implements logic in:

- `system/phases/accept.md`

And participates in transitions:

- `test` → `accept` → `done` (if accepted),
- `accept` → `codegen` / `review` / `test` (if needs more work),
- `accept` → `revert` (if rollback is initiated).

---

## 6. Failure modes

- **Overly optimistic recommendations**
  - Agent recommends accept despite weak evidence.
  - Handling:
    - require explicit mention of missing evidence (e.g. “no tests ran”),
    - encourage conservative default.

- **Under-specified decision artifacts**
  - `decision.json` lacks reasons or references.
  - Handling:
    - enforce minimal fields in schema,
    - validate before writing.

- **Timeline drift**
  - Task accepted, but timeline not updated.
  - Handling:
    - include a “timeline update” suggestion or command.


⸻

