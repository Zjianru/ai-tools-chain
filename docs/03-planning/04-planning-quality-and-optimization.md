# Planning Quality & Optimization Notes (Draft)

| 属性 | 值 |
|------|-----|
| **最后更新** | 2025-11-18 |
| **版本** | v1.0 |
| **状态** | ✅ Current |

---

## 📝 更新历史

- **2025-11-18**: 初稿完成

---

> 目标：围绕规划阶段（planning.ai.json）的“语义质量”，记录除了 prompt 以外的改进思路，作为后续大版本迭代的设计备忘录。当前阶段只用 prompt 顶一下，不立即实现本文所有方案。

---

## 1. 强 schema + 程序化校验

- 保持 `planning.ai.json` 的结构稳定，并在代码层为关键字段增加校验：
  - `requirements` 至少 1 条，每条应包含 `id/title/shall`，`shall` 必须包含英文 `SHALL`。
  - `draft_files` 仅允许业务目录下的有效路径，不包含 `node_modules/`、构建产物或隐藏目录。
  - `acceptance/test_plan` 为空时打 warning，视情况触发额外澄清。
- 将这些校验实现为轻量级的“IR 校验器”，与 OpenSpec 校验分层：
  - OpenSpec 校验负责文本是否符合规范。
  - IR 校验负责结构与基础语义是否合理，必要时提示返回规划阶段修正。

---

## 2. PlanReview 作为专门的 Verifier/Critic

- 使用独立的 PlanReviewAgent 对规划做“审查”，而不是再次生成：
  - 输入：`planning.final.json`、`plan.md`、openspec validate 结果。
  - 输出：`plan-review.json`（机器可读 gate 结果）+ `plan-review.md`（人类阅读版）。
- PlanReview 关注点：
  - 范围（scope/non_goals）是否清晰，是否有明显越界。
  - 关键风险、边界情况、回滚策略是否覆盖。
  - `draft_files` 是否与需求/目录结构匹配，是否遗漏关键文件。
  - `test_plan/acceptance` 是否可操作，而不只是口号。
- 在 gate 层的约束：
  - OpenSpec 校验失败（结构/规则错误）视为硬失败，阻断进入 codegen。
  - 规划内容问题更多作为 warnings/问题列表呈现，由用户决定是否返工。

---

## 3. 利用真实任务轨迹做“例子驱动”优化

- 将真实任务的轨迹视作语料，而不仅是一次性日志：
  - `userBrief + planning.ai.json + plan-review.json + 最终代码/Eval 结果`。
  - 从“好的规划案例”中抽取 few-shot 示例，供 planning/plan-review prompt 使用。
- 针对典型模式（例如“新增脚本打印消息”、“添加一个 API”、“改小功能”）：
  - 形成模板化 few-shot，减少模型在简单场景下的发散。
  - 这些模板不影响 schema，本质是 prompt 层的“经验注入”。

---

## 4. 执行结果反向反馈到规划（Execution-Grounded Planning）

- 在规划阶段之后，利用实际执行结果修正规划假设：
  - 根据 `draft_files` 对仓库做一次“干跑”检查：路径是否存在、是否与约定的目录结构冲突。
  - 将 codegen/review/eval 的失败模式进行归类，定期汇总为“规划反模式”列表。
- 反馈路径：
  - 规划反模式 → 更新 planning/plan-review 的 check-list 或提示词。
  - 明显结构问题（例如总在某类需求上漏掉测试）→ 扩展 schema 或校验规则。

---

## 5. 评测驱动的 Prompt/策略迭代

- 使用已有的评测框架思想（/eval + promptfoo）来优化规划质量，而不是纯人工调 prompt：
  - 为规划定义一组简单的 metric（是否有 test_plan、requirements 是否包含 SHALL、draft_files 与 repo 结构匹配度等）。
  - 选取少量任务作为“规划评测集”，对不同 prompt/配置进行 A/B 对比。
- 长期可引入简单的“程序化 prompt 调优”：
  - 通过脚本枚举或微调 prompt 模板，结合 metric 自动筛选更稳的配置。
  - 不要求引入完整 DSPy，只需利用现有 CLI + eval 管线即可。

---

## 6. 人在环与责任边界

- 明确定位：规划阶段的目标是“辅助人类形成可执行的规划与 OpenSpec 文本”，而不是自动替代人类决策。
- 系统职责：
  - 提供结构化 schema 与强约束（OpenSpec + IR 校验）。
  - 通过 PlanReviewAgent 给出清晰的风险与问题列表。
  - 完整记录：`planning.ai.json / planning.draft.json / planning.transcript.jsonl / plan-review.json / plan-review.md`。
- 人类职责：
  - 决定是否接受当前规划进入 codegen。
  - 在存在 warnings/问题时，有意识地权衡“返工 vs 继续”，工具不强行替用户做价值判断。

---

## 7. 实施顺序建议（供后续迭代参考）

1. 优先实现 codegen 的 IR 化（P1）：引入 `codegen.ir.json` 等中间表示，明确“哪些文件、何种操作、意图为何”，并在本地执行层而非模型侧掌控最终写入逻辑。
2. 在不改变现有行为的前提下，为 `planning.ai.json` 增加轻量级校验与 warning 机制。
3. 落地 PlanReviewAgent，先聚焦 OpenSpec 结果 + 基础规划质量（范围/风险/draft_files/test_plan）。
4. 引入一小批真实任务作为“规划评测集”，用 /eval 或独立脚本评估不同 planning/plan-review prompt。
5. 随着任务积累，逐步把优秀规划案例整理为 few-shot，并更新 prompt。
6. 若需要，再考虑将评测与 prompt 调整脚本化，形成轻量的“规划质量回归测试”。
