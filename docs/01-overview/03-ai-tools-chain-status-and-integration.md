# （已归档）AI Tools Chain — 当前状态 & Promptfoo / OpenSpec 集成设计（2025-11-13 历史版本）

| 属性 | 值 |
|------|-----|
| **最后更新** | 2025-11-18 |
| **版本** | v1.0 |
| **状态** | ✅ Current |

---

## 📝 更新历史

- **2025-11-18**: 初稿完成

---

> 重要说明（2025-11-15 更新）：  
> 本文是 2025-11-13 左右的历史状态与集成设计草案，主要用于记录当时的 Promptfoo 与 OpenSpec 设计思路。  
> **最新的重构进展、Agents/Orchestrator 设计与交接信息，请优先参考：**  
> - `docs/milestones/ai-tools-chain-refactor-status-2025-11-14.md`（高层重构状态摘要）  
> - `docs/architecture/pipeline-artifacts-and-contracts.md`（规划/plan_review/codegen/review 等阶段的产物与协议）  
> - `docs/architecture/AGENTS-ARCH.md`（Agents 架构与“专家席”/Orchestrator 设计）  
> 本文保留作参考，不再作为主交接文档。

> 本文包含三部分：1) 当时已完成的工作；2) 尚未完成/待办；3) Promptfoo 与 OpenSpec 的集成设计（MVP 实施方案 + 路线）。

---

## 1) 已完成（可验证）
- **CLI 基座（ESM）**：`ai-tools version / doctor / init / repl`。
- **模板初始化**：`ai-tools init` 将 `.ai-tools-chain/config/*.conf` 与 `.vscode/tasks.json` 落到业务项目。
- **配置解析（INI）与脱敏规则加载**：`[privacy].mask_patterns` 生效。
- **REPL 留痕**：`.ai-tools-chain/tasks/<taskid>/transcript.jsonl`，自动恢复上次任务。
- **Task 资产**：`meta.json / plan.md / patch.json / diff.patch / files/*.full`。
- **强确认流（本地词典占位）**：输入“确认生成”后进入 codegen。
- **Git 护栏**：脏工作区拦截、`--allow-empty` 快照、（可选）per-task 分支命名占位。
- **受控写入**：基于 plan 的目标文件生成示例内容；白名单/危险路径/大改动二次确认。
- **Review 摘要**：`git diff --numstat` 汇总并高亮危险路径。
- **评测执行器（占位）**：`/eval` 读取 `eval.conf`，按步执行，写 `eval-*.log` 与 `eval-report.json`。
- **提交/回滚**：`/accept` 提交本次 codegen；`/revert` 回滚到快照并清理新建文件。
- **Playground 管理脚本**：`scripts/reset_playground.sh`（仓库内固定路径）。
- **`id_format` 兼容**：支持 `{date}-{seq}` 与旧 `YYYYMMDD-HHMM-###`（处理 INI 注释坑）。

---

## 2) 未完成 / 待办
- **真实模型接入**：与 Claude Code / OpenAI 模型的 codegen 实际落笔（当前为示例内容）。
- **第二意见（模型）**：plan/review 阶段的真正调用与风险聚合。
- **插件系统**：`plugins.conf` 顺序与短路机制的执行框架 + 示例插件可插拔化。
- **定时扫描与周快照**：`ai-tools maintain` + 压缩归档与清理实现。
- **评测依赖守护**：`doctor` 的检查项细化（promptfoo、ragas 可执行性）；失败时的快速指引。
- **VS Code 任务完善**：命令映射到 REPL 的关键子流程、常用脚本别名。
- **发布与文档**：npm 包发布流、README/使用指南/故障排查。
- **Windows 兼容列表**：`git restore/checkout`、路径分隔等差异收敛。

---

## 3) 集成设计：Promptfoo

### 3.1 目标
- 将 **Prompt/Agent 质量评测**纳入 `/eval`，让每次 codegen 后都能跑一组可配置的提示词/数据集评测，生成**可门禁**的报告（失败则中止）。

### 3.2 目录与配置
```
.ai-tools-chain/
  promptfoo/
    promptfooconfig.yaml      # 主配置（模板）
    datasets/                 # 数据集（yaml/csv/jsonl）
    prompts/                  # 复用或存放提示模板（可选）
```
- 在 `eval.conf` 里已有：
  ```ini
  [promptfoo]
  enabled = true
  config = .ai-tools-chain/promptfoo/promptfooconfig.yaml
  ```

### 3.3 执行与报告
- `/eval` 调用命令（默认）：  
  `npx promptfoo eval -c .ai-tools-chain/promptfooconfig.yaml`
- 输出由我们现有的评测执行器捕获并写入：  
  `.ai-tools-chain/tasks/<taskid>/eval-promptfoo.log` 与 `eval-report.json` 的对应条目。

### 3.4 数据映射（将 Task 转为评测样例）
- 增加一个导出器：`ai-tools pf:export`（后续命令），从：
  - `transcript.jsonl`（用户最近 N 条需求/澄清）
  - `plan.md`（目标与改动文件清单）  
  生成一个临时数据集：`.ai-tools-chain/promptfoo/datasets/task-<taskid>.yaml`，可作为 promptfoo 的 `providers.inputs` 或 `scenarios`。

### 3.5 Gate（门禁）策略
- `promptfooconfig.yaml` 中定义评分器与阈值（例如 LLM-as-a-judge / 规则打分）。
- 当 **任一 Gate 不满足**：我们在 `/eval` 中将 promptfoo 步骤标记为 `failed` 并**停止后续步骤**。

### 3.6 CLI 扩展（MVP）
- `ai-tools pf:scaffold`：生成最小模板（配置 + 一个示例数据集）。
- `ai-tools pf:export`：从当前 Task 导出评测样例（覆盖或追加）。

### 3.7 最小模板（示例片段）
```yaml
# .ai-tools-chain/promptfoo/promptfooconfig.yaml
providers:
  - id: openai:gpt-4o-mini
    config:
      apiKeyEnvar: OPENAI_API_KEY

prompts:
  - "请根据以下需求为函数写单元测试：{{requirement}}"

tests:
  - vars:
      requirement: "对 /api/sum 的错误处理写单测"
    assert:
      - type: javascript
        value: "output && output.length > 0"
```

---

## 4) 集成设计：OpenSpec

> 这里的 **OpenSpec** 作为“需求/设计规范”的本地文件格式与工作流，不依赖云服务；用于：**约束 plan、生成目标文件清单、绑定验收标准**。

### 4.1 目录与文件
```
.ai-tools-chain/
  openspec/
    spec.yaml            # 当前任务/模块的规范
    schema.yaml          # 规范的 JSON Schema（用于 lint）
```
- 在 `plan` 阶段可选择“从 `openspec/spec.yaml` 生成 `plan.md`”。

### 4.2 `spec.yaml` 结构建议
```yaml
meta:
  id: "SUM-API-001"
  title: "求和接口的错误处理"
  owner: "@864156480"
  risk: "medium"

requirements:
  - id: R1
    text: "当任一参数不是数字时，返回 400 与明确错误码"
  - id: R2
    text: "当内部错误时，记录日志并返回 500"

non_functional:
  - "新增的日志打印必须通过 lint 检查"
  - "新增/修改的代码必须覆盖率 >= 70%"

targets:
  files:
    - "src/api/sum.ts"
    - "tests/api/sum.test.ts"
  globs:
    - "src/**/sum*.ts"

guardrails:
  dangerous_paths: [".github/", "deploy/", "k8s/"]
  allow_delete: false
  max_files: 10
  max_lines: 1000

acceptance:
  steps:
    - "lint 通过"
    - "测试通过"
    - "promptfoo 评分 >= 0.7"
```

### 4.3 工作流接入点
- **`/plan`**：新增 `plan <- openspec` 选项：读取 `openspec/spec.yaml` → 生成 `plan.md` 的“将改动的文件清单 + 要点 + 验收标准”。
- **写入护栏**：`guardrails` 与我们全局 `toolchain.conf [task]` 合并覆盖，落在本次 Task 的 `meta.json` 中，仅对当前任务生效。
- **`/eval` 门禁**：把 `acceptance.steps` 转换为需要启用的 eval 步骤（如未达标则失败）。

### 4.4 CLI 扩展（MVP）
- `ai-tools spec scaffold`：生成 `openspec/spec.yaml` 与 `schema.yaml` 模板。
- `ai-tools spec lint`：基于 `schema.yaml` 校验 `spec.yaml`（失败则不允许 `/plan <- openspec`）。
- `ai-tools spec plan`：从 `spec.yaml` 生成/更新 `plan.md`。

### 4.5 最小 `schema.yaml` 片段
```yaml
type: object
required: [meta, requirements, targets]
properties:
  meta:
    type: object
    required: [id, title]
    properties:
      id: { type: string }
      title: { type: string }
      owner: { type: string }
      risk: { type: string, enum: [low, medium, high, critical] }
  targets:
    type: object
    properties:
      files: { type: array, items: { type: string } }
      globs: { type: array, items: { type: string } }
```

---

## 5) 实施路线（把两者接入到现有 CLI）

### 5.1 Milestone-P（Promptfoo）
- **P1**：`pf:scaffold`（模板落盘）  
- **P2**：`pf:export`（从 `transcript + plan` 导出数据集）  
- **P3**：在 `/eval` 中加入 promptfoo 的失败门禁（已有占位命令，补充结果解析）

### 5.2 Milestone-S（OpenSpec）
- **S1**：`spec scaffold` + `spec lint`（Schema 校验）  
- **S2**：`spec plan`（生成/更新 `plan.md`；合并 guardrails）  
- **S3**：在 `/eval` 读取 `acceptance` 将其映射为必须启用的步骤

---

## 6) 对现有代码的最小改动面
- 在 `eval.conf` 中确认 `[promptfoo]` 已启用（默认已加）。
- `repl` 的 `/plan` 增加一个开关：`/plan from:openspec`（后续实现）。
- 新增命令：`ai-tools pf:scaffold | pf:export | spec scaffold | spec lint | spec plan`。
- `doctor` 增加检查：`npx promptfoo --version`、Schema 校验依赖（如 AJV）。

---

## 7) 文件与模板（建议先落仓）
- `templates/.ai-tools-chain/promptfoo/promptfooconfig.yaml`
- `templates/.ai-tools-chain/openspec/spec.yaml`
- `templates/.ai-tools-chain/openspec/schema.yaml`

落库后，你就能：
1) `ai-tools init -y` 把模板带到业务项目；  
2) `/plan` 选择从 OpenSpec 生成；  
3) `/eval` 自动跑 Promptfoo 并将评分纳入门禁。

---

更新于 2025.11.03（最新）


收到，我按“最新 GitHub 仓库主页可见内容”又核对了一轮，然后把进度快照 / 已完成 / 待办 / 新的产品思考整理如下（仓库首页能看到 bin/、node_modules/、playgrounds/ scripts、src/、templates/、.DS_Store、.gitignore、README.md、package-lock.json、package.json，且当前显示 1 次提交）｡  ￼

进度快照（Repo）
	•	目录结构：根下包含 bin/、src/、templates/、playgrounds/ scripts 等。 ￼
	•	注意点：node_modules/ 与 .DS_Store 仍在版本库中（建议移除并加入 .gitignore）。 ￼
	•	提交历史：当前页面显示“1 Commit”。 ￼

已完成（MVP 主链打通）
	•	CLI：version / doctor / init / repl。初始化会复制模板到业务项目。
	•	REPL 留痕：.ai-tools-chain/tasks/<taskid>/transcript.jsonl，支持恢复上次任务、脱敏。
	•	任务资产：meta.json / plan.md / patch.json / diff.patch / files/*.full。
	•	强确认与护栏：中文“确认生成”，白名单/危险路径/大改动二次确认。
	•	Git 保护：脏工作区拦截、pre-commit 空提交快照（--allow-empty），可选 per-task 分支。
	•	Codegen 骨架：按 plan 写入示例内容（后续由模型替换）。
	•	Review：git diff --numstat 摘要；/accept 提交、/revert 回滚快照并清理新建文件。
	•	Eval 执行器：读取 eval.conf 分步执行（lint/test/promptfoo/ragas 预留），产出 eval-*.log 与 eval-report.json。
	•	Playground 管理：scripts/reset_playground.sh（只作用于仓库内 playground/）。

待办（按优先级）

P0（立即）
	•	把 node_modules/、.DS_Store 从 git 历史移除并加入忽略；保持仓库洁净。 ￼

P1（这一两天）
	•	模板核对：templates/.ai-tools-chain/config/ 下确保有 toolchain.conf / eval.conf / plugins.conf / models.conf；templates/.vscode/tasks.json 也在。 ￼
	•	bin/ai-tools.mjs 可执行权限与 shebang 校验；package.json 的 bin 映射检查。
	•	doctor 增强：检查 models.conf 是否存在与可解析；链路涉及的 API_KEY 是否设置；gh copilot -h 是否可用（提示级）。
	•	README：补“快速上手 5 分钟”（init→plan→codegen→review→eval→accept）与“发布/版本策略”。

P2（本周内）
	•	统一模型配置：新增 models.conf（INI），把“主笔 codegen（Claude）/ 审查 review（OpenAI）/ 第二意见（Copilot→OpenAI 兜底）”配置到 profile/链式回退。
	•	模型调度器（Broker）+ 适配器（Adapters）：src/models/broker.mjs + src/models/adapters/{anthropic,openai,gh_copilot}.mjs；在 /codegen 与 /review 调用 invokeRole('codegen'|'review'|'second_opinion')，其余护栏不变。
	•	Promptfoo：pf:scaffold（落默认配置与示例数据集）、pf:export（把 transcript/plan 导出成临时数据集），并在 /eval 中作为门禁一步。
	•	OpenSpec：spec scaffold/lint/plan（从 spec.yaml 生成 plan.md，把 guardrails/acceptance 注入 task 限定）。
	•	CI：最小 GitHub Actions（Node 18/20）跑 node bin/ai-tools.mjs version 和 doctor 冒烟。

新的产品思考（结合你的目标“Claude 主笔 / Copilot 第二意见 / Codex 审查 / OpenSpec 方案”）
	1.	“三角色一套调用路径”是正确抽象：REPL 永远只调 invokeRole(role)；provider/模型切换靠 models.conf，把厂商差异封装在 adapter。这样既稳又易扩展（未来加本地模型、DeepSeek、阿里都不破 REPL）。
	2.	强确认可升级为“双重强确认”：先 NLU 判定意图（模型或词典），再中文口令“确认生成”，两者都满足才落笔；高风险（删除/重命名/大规模改动）启用三重确认。
	3.	OpenSpec → plan → 护栏联动：规范里定义 targets/guardrails/acceptance，一次下发到本 task 的 meta.json，让护栏与 eval 都按“任务局部规则”运作。
	4.	Second Opinion 分层：默认只“建议”，遇到高/中高风险才要求用户确认（你的设想已很好）；把风险级别映射到不同的终端样式与提示音。
	5.	Promptfoo 真正“门禁化”：把关键指标（准确性/一致性/风格/误改动率）阈值写进 promptfooconfig.yaml，未达标则 /eval 失败、阻断 /accept。
	6.	任务可复现与归档：每个 task 目录内存 providers/ 子目录（请求/响应 JSON，脱敏后），配合每周“快照压缩”，形成可回溯的产线级记录。
	7.	插件权限模型：在 plugins.conf 为每个插件声明 capabilities（读/写/删除/执行外部命令等），REPL 在运行前做权限提示与白名单确认。
	8.	可观测性（本地）：给 eval-report.json 加“简单分布图/趋势”（本地渲染或输出 ASCII），帮助看每次 codegen 的质量曲线。
	9.	人机协同的“变更预算”：为单个 task 设置“文件/行数”预算，超过预算需要二次确认或拆分 task；能减少大改动带来的风险。
	10.	后续 IDE 轻耦合：保留“打开 VS Code”的便利命令，但不把写入权交给 IDE 插件；全部写入仍经 REPL 护栏与留痕。

⸻

建议的下一步（很快能落地）
	1.	先做 P0 清理（node_modules / .DS_Store）。
	2.	把 models.conf 模板放进 templates/，新增 broker/adapters 三个文件，把 /codegen 与 /review 接上 broker（先用 demo 返回值，稍后换真 API）。
	3.	doctor 增强三项检查。
	4.	打一个 v0.1.0 tag，README 写清“已实现/未实现”和使用步骤。
