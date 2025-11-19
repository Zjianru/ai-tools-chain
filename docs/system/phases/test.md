# Phase: Test

The **test** phase runs automated checks against the proposed changes.

These checks may include:

- unit / integration tests,
- linters / static analysis,
- prompt evaluation suites.

---

## 1. Goals

The test phase should:

1. Provide an objective signal about the health of the changes.
2. Produce a structured report that can be:
   - consumed by the accept phase,
   - inspected later (regression analysis).

---

## 2. Inputs

- Working tree with applied changes (or an equivalent test environment).
- Task-level artifacts:
  - `code/diff.patch`,
  - `code/files/`,
  - `planning/plan.md` (for context, if needed).

- Test configuration:
  - `eval.conf` or similar, describing:
    - which commands to run,
    - which suites apply to this task.

- `planning/planning.ai.json` (optional)
  - If present, its `test_plan` field is used to summarize the intended test strategy.
  
### Inputs（补充）

- 来自规划的测试计划（可选）：
  - `planning/planning.ai.json` 中的 `test_plan` 字段；
  - `planning/plan.md` 中的 “Test Plan / 测试计划摘要” 小节。

实现备注：

- 当前实现中，测试阶段主要由 `eval.conf` 与外部命令驱动；
- `test_plan` 目前更多用于文档与报告，不会强制 gate；
- 后续将：
  - 把 `test_plan.cases` 作为测试用例生成/校验的来源之一；
  - 在 `eval/eval-report.json` 中显式标记哪些用例已覆盖 / 未覆盖。
---

## 3. Process

1. **Configuration resolution**
   - Determine which tests to run:
     - global configuration,
     - per-project overrides,
     - per-task hints.

2. **Execution**
   - Run the configured commands:
     - `npm test`, `pytest`, `go test`, etc.
     - `npm run lint`, etc.
     - prompt evaluation tools (e.g. promptfoo).

3. **Aggregation**
   - Collect results:
     - exit codes,
     - logs,
     - summary metrics.
   - Normalize into a structured report.

---

## 4. Outputs

Under the task directory:

- `eval/eval-report.json`
  - per-suite and per-test results,
  - high-level pass/fail,
  - metadata (timestamps, environment).

- Optional:
  - `eval/logs/` with raw logs,
  - `eval/summary.md` as a human-readable overview.

Schemas:

- `docs/system/schemas/eval-schema.md` (once defined).

---

## 5. State machine

In the global state machine:

- `review` → `test` when the code is ready to be validated.
- `test` → `accept` once tests complete.
- `test` → `codegen` if failures require further changes.

The orchestrator uses `eval-report.json` to decide:

- whether to recommend acceptance,
- or to push back to earlier phases.

---

## 6. CLI & user interaction

### 6.1 Commands

- `ai-tools test` – run the test phase.
- `/test` – in REPL, trigger tests.

### 6.2 User responsibilities

- Maintain `eval.conf` (or equivalent) so that:
  - tests are meaningful,
  - suites are not excessively slow for interactive use.

- Interpret test results with context:
  - some failures may be known issues,
  - some may be flaky tests.

---

## 7. Failure modes & handling

- **No tests configured**
  - Handling:
    - test phase should report “no tests” explicitly,
    - accept phase should reflect reduced confidence.

- **Flaky tests**
  - Handling:
    - rerun selected suites,
    - mark known flaky tests in configuration.

- **Overly slow suites**
  - Handling:
    - separate fast vs slow suites,
    - configure only fast suites for default runs,
    - leave full suites for CI.