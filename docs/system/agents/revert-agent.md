# Agent: RevertAgent

The **RevertAgent** supports the `revert` phase.

It helps:

- identify what needs to be reverted,
- coordinate code restoration,
- and record the rollback decision.

Implementation:  
`src/agents/revertAgent.mjs` (or similarly named).

---

## 1. Responsibilities

1. **Plan the revert**
   - Determine scope:
     - entire task’s changes,
     - or a subset of files.

2. **Coordinate code restoration**
   - Use:
     - Git history,
     - or stored artifacts (`code/files/`, previous snapshots),
   - to revert the working tree to the desired state.

3. **Record revert**
   - Create:
     - `revert/record.json`,
     - optionally `revert/notes.md`.

4. **Suggest follow-ups**
   - If revert reveals deeper issues:
     - propose new tasks,
     - or timeline entries.

---

## 2. Inputs

- `accept/decision.json` (prior acceptance info).
- `code/diff.patch` and `code/files/`.
- Git history (through CLI).
- User input:
  - reason for revert,
  - scope (if partial).

---

## 3. Outputs

Under the task directory:

- `revert/record.json`
  - what was reverted,
  - why,
  - by whom,
  - link to commits or snapshots.

- `revert/notes.md` (optional)
  - narrative explanation.

---

## 4. Interaction with external tools

The RevertAgent may delegate to:

- Git:
  - `git revert`,
  - `git apply`,
  - `git checkout` of specific files.

The exact commands and safety checks should be:

- documented in the agent implementation,
- and kept minimal in this spec.

---

## 5. Relationship to phases & state machine

The RevertAgent is used in:

- `system/phases/revert.md`

It participates in transitions:

- `accept` → `revert` → `done`

Reverts do not delete history; they add a new layer of artifacts.

---

## 6. Failure modes

- **Incomplete revert**
  - Only some files reverted.
  - Handling:
    - agent should attempt to verify consistency (e.g. via Git status),
    - and record any partial revert explicitly.

- **Missing artifacts**
  - No diff or code files available.
  - Handling:
    - fall back to Git,
    - or mark revert as “best effort”.

- **Loss of context**
  - Why the revert happened is unclear later.
  - Handling:
    - enforce a non-empty “reason” in `revert/record.json`.


