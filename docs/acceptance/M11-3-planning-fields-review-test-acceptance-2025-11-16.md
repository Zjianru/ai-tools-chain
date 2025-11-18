# M11-3 规划扩展字段在 Review/Test 阶段的验收脚本（2025-11-16）

> 目标：验证 `planning.ai.json` 中的扩展字段（`scope/non_goals/file_impacts/open_questions/test_plan`）在 **Review** 与 **Test(/eval)** 阶段被实际消费，而不是仅停留在 JSON 里；特别关注：
> - Review 阶段能基于规划识别“可能超出规划范围”的改动；
> - ReviewMeeting 能展示 Scope/Non-goals/越界文件；
> - Test 阶段能显示 test_plan 摘要，并在 eval-report 中附带覆盖提示。

工作目录：`playgrounds/testProject`

---

## 0. 预备

- [ ] 项目根执行 `npm install`（如需），确保 `ai-tools` 可用。  
- [ ] `cd playgrounds/testProject`。  
- [ ] `git status` 干净（无未提交改动），方便观察本轮变更。  

---

## 1. /plan：生成带扩展字段的规划

1. 启动 REPL，新建 Task：
   - [ ] 执行：`ai-tools repl`。  
   - [ ] 如提示“检测到上次任务…”，选择 `new`。  
   - [ ] 记下 REPL 提示中的 `Task: <taskId>`。

2. 触发一次 /plan，要求模型尽量输出扩展字段：
   - [ ] 在 REPL 输入类似需求（可按需调整语气）：
     ```text
     > /plan 为当前项目添加一个 scripts 目录下的部署脚本，要求：
     - 只能改 scripts/ 和 docs/ 目录
     - 清楚写出哪些范围内的事情不做（non_goals）
     - 给出测试计划和关键用例（test_plan）
     - 如果有不确定的问题，写在 open_questions 里
     ```

3. 规划完成后，检查 `planning.ai.json`（**可选增强项**）：
   - [ ] 打开：`tasks/<taskId>/planning/planning.ai.json`。  
   - [ ] 尝试确认是否存在以下扩展字段（**允许缺失，缺失不视为验收失败**）：
     - [ ] `scope`（数组或字符串）  
     - [ ] `non_goals`（数组）  
     - [ ] `file_impacts`（数组，包含 `path/type/purpose` 等字段）  
     - [ ] `test_plan`（包含 `strategy/cases/automation`）  
     - [ ] `open_questions`（数组）  

4. 可选：粗查 plan 摘要与会议纪要是否已包含这些字段（存在时应被展示）：
   - [ ] 如 `planning.ai.json` 中有 scope/non_goals/open_questions，则期望在：  
     - `tasks/<taskId>/planning/plan.md` 中看到相关描述；  
     - `tasks/<taskId>/planning/planning.meeting.md` 中看到 scope/non_goals/open_questions 的计数或摘要。  

> 小结：扩展字段属于“最佳努力的增强信息”。模型产出时应在后续 Review/Test 中被利用；模型未产出时，本验收脚本后续步骤中涉及这些字段的检查可以跳过，不应阻断验收。

---

## 2. 制造“规划内 + 规划外”的代码改动

目的：让 Review 阶段有机会发现“可能超出规划范围”的文件。

1. 先让 AI 按规划生成一轮代码（可选但推荐）：
   - [ ] 在 REPL 中执行：`/codegen`，按提示输入“确认生成”。  
   - [ ] 确认 codegen 正常结束（无致命错误）。

2. 手工在“规划范围内”的目录做少量改动：
   - [ ] 从 `planning.ai.json.draft_files` 或 `file_impacts[].path` 中挑一两个路径（如 `scripts/deploy.sh` / `docs/deploy.md`）。  
   - [ ] 在这些文件里随便改一行注释或增加一行无害代码。  

3. 手工在“规划范围外”的目录做少量改动（制造越界）：
   - [ ] 选择一个规划中**没有提到**的路径，例如：
     - `src/SomeUnplannedFile.java`，或者  
     - 任意不在 `draft_files` 和 `file_impacts[].path` 列表中的文件。  
   - [ ] 同样只改一行注释或增加无害代码。  

4. 确认 git diff 同时包含“规划内 + 规划外”文件：
   - [ ] 执行：`git diff --name-only`。  
   - [ ] 检查：
     - [ ] 至少 1 个文件路径位于规划中给出的目录里；  
     - [ ] 至少 1 个文件路径明显不在规划的 draft_files/file_impacts 中。  

---

## 3. /review：范围检查与 review.json 的规划信息

### 3.1 REPL 输出中的“基于规划的范围检查”

1. 在 REPL 中执行：
   - [ ] `> /review`

2. 在终端输出中找到这段内容（顺序可能略有差异）：
   - [ ] 有一块标题类似：
     ```text
     基于规划的范围检查：
       - 规划中的目标文件数量：X（draft_files + file_impacts）
     ```
   - [ ] 若之前确实有“越界文件”，应看到：
     ```text
       - 检测到 N 个“可能超出规划范围”的文件：
           • <某个不在 draft_files/file_impacts 里的路径>
     ```
   - [ ] 如规划中有 non_goals，应看到：
     ```text
       - 规划明确的不做事项（non_goals）：
           • ...
     ```

3. 验收点：
   - [ ] “规划中的目标文件数量”显示的 X > 0（说明 draft_files/file_impacts 被解析成功）；  
   - [ ] 你故意越界修改的那个文件路径出现在“可能超出规划范围”的列表中；  
   - [ ] 如规划中有 non_goals，这里能看到对应短句摘要。

### 3.2 review.json 中的 planning_context / planning_checks

1. 打开 review JSON：
   - [ ] 文件：`tasks/<taskId>/review.json`

2. 检查新增字段：
   - [ ] 保留原有字段：`summary/risks/suggestions` 等；  
   - [ ] 增加：
     ```json
     "planning_context": {
       "meta": { ... },
       "scope": [...],
       "non_goals": [...],
       "open_questions": [...],
       "test_plan": {...}
     },
     "planning_checks": {
       "planned_files": ["..."],
       "touched_files": ["..."],
       "out_of_scope_files": ["..."],
       "non_goals": [...],
       "open_questions": [...]
     }
     ```

3. 验收点：
   - [ ] `planning_context.scope/non_goals/open_questions/test_plan` 与 `planning.ai.json` 中的内容一致或高度一致；  
   - [ ] `planned_files` 至少包含部分规划中出现的文件路径；  
   - [ ] `out_of_scope_files` 中包含你在第 2 步刻意制造的“规划外”改动文件路径。

---

## 4. review.meeting.md：Scope & 越界文件展示

1. 打开会议纪要：
   - [ ] 文件：`tasks/<taskId>/review.meeting.md`

2. 找到新增的 “Planning Scope & Checks” 小节（在 AI 会议或 fallback 输出的中后部）：
   - [ ] 结构类似：
     ```markdown
     ## Planning Scope & Checks

     - Scope:
       - ...

     - Non-goals:
       - ...

     - Possible out-of-scope files:
       - some/unplanned/file.java
     ```

3. 验收点：
   - [ ] Scope 与 Non-goals 段落存在（若 planning 中有这些字段）；  
   - [ ] “Possible out-of-scope files” 列表包含你刻意越界修改的那个文件路径；  
   - [ ] 这一节无论 review_meeting 调用 AI 成功与否都应存在（AI 失败时 fallback 版本同样包含）。

---

## 5. /eval：test_plan 摘要与覆盖提示

前提：`planning.ai.json.test_plan` 非空，并包含 `strategy/cases/automation`。

### 5.1 REPL 输出中的 test_plan 摘要 + 覆盖提示

1. 在 REPL 中执行：
   - [ ] `> /eval`

2. 观察开头部分，确认有 test_plan 摘要：
   - [ ] 输出类似：
     ```text
     规划中的测试计划（test_plan）：
       - 策略: ...
       - 关键用例:
         • 用例1
         • 用例2
       - 自动化范围: ...
     ```

3. 等评测执行结束（无论是否有失败），继续往下看：
   - [ ] 在“评测计划”附近，应出现：
     ```text
     基于 test_plan 的简单覆盖提示（仅供参考，不作为 Gate）：
       - 规划用例数：N，其中大致可映射到评测步骤的约 M 个。
       - 下列用例目前未能映射到任何评测步骤：
         • 某个比较业务化的用例描述
     ```
   - 如果用例与某些步骤名称极为相近，M 可能 > 0，否则 M 多半为 0，这属于正常情况。

4. 验收点：
   - [ ] 有 test_plan 摘要块；  
   - [ ] 有覆盖提示块（即使所有用例都“未能映射”，提示也应存在）；  
   - [ ] 即便提示中指出有未覆盖用例，/eval 仍正常跑完，不会被 Gate 掉。

### 5.2 eval-report.json 中的 test_plan_summary

1. 打开报告文件：
   - [ ] `tasks/<taskId>/eval-report.json`

2. 查找新增字段：
   - [ ] 存在：
     ```json
     "test_plan_summary": {
       "total_cases": N,
       "approx_covered": M,
       "approx_uncovered": ["用例1", "用例2", ...],
       "notes": "coverage 为基于用例描述与评测步骤名称/命令的简单字符串匹配，仅用于提示。"
     }
     ```

3. 验收点：
   - [ ] `total_cases` 与 `planning.test_plan.cases.length` 相符；  
   - [ ] `approx_uncovered` 至少包含部分用例描述（尤其是与步骤名不相似的用例）；  
   - [ ] 再次执行 `/eval` 时，该字段会被更新为最新一轮结果，但结构不变。

### 5.3 test_plan 缺失时的退化行为（可选）

1. 选择一个规划没有 test_plan 的 Task（或手动从 `planning.ai.json` 中删除 `test_plan`），执行 `/eval`：
   - [ ] REPL 输出中不出现“规划中的测试计划（test_plan）”和覆盖提示段落；  
   - [ ] 评测照常执行，`eval-report.json` 无 `test_plan_summary` 字段。

---

## 6. 验收通过的判断标准

当下面这些条件全部满足时，认为 “M11-3 规划扩展字段在 Review/Test 阶段的第一阶段落地” 验收通过：

- [ ] 在 /review 时，REPL 输出中能看到“基于规划的范围检查”，并正确识别人工制造的越界文件；  
- [ ] `review.json` 中包含合理的 `planning_context/planning_checks`，`out_of_scope_files` 和 non_goals 与规划一致；  
- [ ] `review.meeting.md` 中包含 “Planning Scope & Checks” 段落，列出 Scope/Non-goals/越界文件；  
- [ ] 在 /eval 时，REPL 输出 test_plan 摘要与覆盖提示，不影响评测执行；  
- [ ] `eval-report.json` 中有 `test_plan_summary`，能反映 test_plan 中用例的大致覆盖情况；  
- [ ] test_plan 缺失时，以上增强功能自动退化为“无提示但不报错”，整个 pipeline 仍然可用。
