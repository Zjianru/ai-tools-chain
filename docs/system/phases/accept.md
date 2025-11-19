# Phase: Accept

The **accept** phase makes an explicit decision:

> Should we accept the work produced by this task?

It considers:

- the plan and its review,
- the code and its review,
- test / evaluation results,
- and any human judgment.

---

## 1. Goals

The accept phase should:

1. Make a clear **go / no-go** decision.
2. Record the reasoning.
3. Link all relevant artifacts.
4. Optionally update the project timeline.

---

## 2. Inputs

- `planning/plan.md`
- `review/plan-review.json` (if any)
- `code/diff.patch`, `code/files/`
- `review/code-review.json` / `.md` (if any)
- `eval/eval-report.json`
- Task metadata and timeline entry.

---

## 3. Process

1. **Evidence collection**
   - Gather:
     - plan & plan review,
     - code & code review,
     - eval report.

2. **Model-assisted assessment (optional)**
   - An accept agent may:
     - summarize evidence,
     - highlight concerns,
     - propose a recommendation.

3. **Human decision**
   - A maintainer or task owner:
     - reviews the summary and evidence,
     - chooses:
       - `accept`,
       - `reject/needs-work`,
       - `defer`.

4. **Recording**
   - Persist a structured decision artifact.
   - Optionally update the timeline row:
     - set `status` to `accepted` or `reverted`,
     - update `accept_link`.

---

## 4. Outputs

Under the task directory:

- `accept/decision.json`
  - verdict (`accepted` / `rejected` / `deferred`),
  - reasons,
  - links to artifacts,
  - timestamp,
  - decision maker (human / agent).

- `accept/summary.md` (optional)
  - human-readable explanation.

The `accept_link` in the timeline SHOULD point to `decision.json` or
`summary.md`.

---

## 5. State machine

In the global state machine:

- `test` → `accept` once tests finish.
- `accept` → `done` (or equivalent terminal state) if accepted.
- `accept` → `codegen` / `review` / `test` if “needs work”.
- `accept` → `revert` if previous acceptance is being undone.

The orchestrator should:

- treat `accept` as the final explicit gate,
- not silently auto-accept work without a decision artifact.

---

## 6. CLI & user interaction

### 6.1 Commands

- `ai-tools accept` – run the accept phase.
- `/accept` – in REPL, trigger acceptance flow.

### 6.2 User responsibilities

- Read the summarized evidence.
- Make an explicit decision.
- If overriding model recommendations:
  - briefly record the rationale.

---

## 7. Failure modes & handling

- **Decision without evidence**
  - Accepting work without tests or reviews.
  - Handling:
    - the decision artifact should reflect missing evidence explicitly.

- **Implicit acceptance**
  - Work gets merged without an accept decision.
  - Handling:
    - tooling or process should encourage using the accept phase,
    - or record manual acceptance retroactively.

- **Timeline not updated**
  - Timeline still shows `in-progress` despite acceptance.
  - Handling:
    - add a “sync timeline” step,
    - or automate timeline updates where safe.

    ---

## 8. Implementation status

- Status：🟡 partial
- 当前实现：
  - `src/agents/acceptAgent.mjs` + `runAcceptCore` 已实现：
    - 读取 `eval/eval-report.json`；
    - 按 gate 策略做判定（`gate_passed` / `gate_failed` / `needs_override` / `committed` 等）；
    - 在 `/accept` 命令中，根据 gate 结果决定是否执行 Git 提交；
    - 把 accept 阶段结果写入 task state（`phase = "accept"`，`actors.accept.status` 等字段）。  
- 与文档差异：
  - 文档约定的 `accept/decision.json` / `accept/summary.md` 目前尚未生成；
  - timeline 中的 `accept_link` 还没有由工具自动维护。
- 下一步：
  - 在 AcceptAgent 中增加决策 artifact 写入：
    - 创建 `accept/decision.json`，字段包括 `verdict`、`reasons[]`、`artifacts`（plan/review/eval 路径）、`timestamp`、`decider` 等；
    - 可选生成 `accept/summary.md`，与 `decision.json` 内容对应；
  - 更新 Timeline 维护逻辑：
    - 当 accept 成功时，将对应行的 `status` 更新为 `accepted`；
    - 将 `accept_link` 指向 `accept/decision.json` 或 `accept/summary.md`。