# Phase: Revert

The **revert** phase is used when previously accepted work needs to be undone.

It helps:

- restore the codebase to a known-good state,
- update the task and timeline to reflect the rollback,
- record the reason for the revert.

---

## 1. Goals

The revert phase should:

1. Make rollback **deliberate and documented**.
2. Use existing artifacts (diffs, full files) to restore state.
3. Capture the reason and impact.

---

## 2. Inputs

- Prior acceptance decision:
  - `accept/decision.json`
- Code artifacts:
  - `code/diff.patch`
  - `code/files/` (desired state of files)
- Current working tree state.

Optionally:

- Additional context about why the revert is needed.

---

## 3. Process

1. **Determine target state**
   - Decide which state we are reverting to:
     - immediately before the task’s changes,
     - or another specific revision.

2. **Apply revert**
   - Use:
     - Git (e.g. `git revert` / `git apply`),
     - or stored artifacts (e.g. previous full file versions),
   - to restore the codebase.

3. **Record revert**
   - Write a `revert` artifact:
     - reason,
     - who initiated it,
     - which commit or state we reverted to.

4. **Update timeline**
   - Set `status` to `reverted` for the associated item.
   - Optionally link to a new “follow-up” task.

---

## 4. Outputs

Under the task directory:

- `revert/record.json`
  - includes:
    - reason,
    - timestamp,
    - links to commits or patches,
    - impact summary (if known).

- `revert/notes.md` (optional)
  - free-form explanation.

---

## 5. State machine

In the global state machine:

- `accept` → `revert` if an accepted change needs to be undone.
- `revert` → terminal state (e.g. `done`) for this task.

Reverting does not necessarily delete artifacts:

- original planning, code, tests, accept decision remain as history.

---

## 6. CLI & user interaction

### 6.1 Commands

- `ai-tools revert` – trigger revert helpers.
- `/revert` – in REPL, start a revert flow for the current task.

### 6.2 User responsibilities

- Confirm that revert is desired.
- Review what will be changed:
  - commits,
  - files.
- Provide a reason that will be stored in `revert/record.json`.

---

## 7. Failure modes & handling

- **Partial revert**
  - Only some changes are undone, leaving the system inconsistent.
  - Handling:
    - prefer Git-based revert where possible,
    - or thorough diff-based restoration.

- **Missing artifacts**
  - `diff.patch` or `code/files/` are not available.
  - Handling:
    - fall back to Git history,
    - or mark revert as “best effort” with clear notes.

- **Timeline not updated**
  - Handling:
    - ensure processes or tooling include a step to adjust the timeline.