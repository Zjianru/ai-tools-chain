# Example Timeline

This is a minimal example illustrating how a project-level timeline table
should look, according to `planning/timeline-schema.md`.

```markdown
| id        | type    | title                           | milestone           | eta        | priority | status      | depends   | design_link                                   | accept_link                                                    | notes                           |
|-----------|---------|---------------------------------|---------------------|------------|----------|-------------|-----------|-----------------------------------------------|-----------------------------------------------------------------|---------------------------------|
| TASK-001  | feature | Planning MVP for single task    | M1: Planning MVP    | 2025-03-15 | P0       | accepted    |           | docs/planning/examples/example-plan.md     | .ai-tools-chain/tasks/TASK-001/accept/decision.json            | First end-to-end planning flow  |
| TASK-002  | chore   | Align docs with docs  | M1: Planning MVP    | 2025-03-20 | P1       | in-progress | TASK-001  | docs/system/timeline.md                    |                                                                 | Migrate missing designs/TODOs   |
| TASK-003  | spike   | Explore alternate providers     | M2: Providers       | TBD        | P2       | idea        | TASK-001  |                                             |                                                                 | Might affect broker design      |