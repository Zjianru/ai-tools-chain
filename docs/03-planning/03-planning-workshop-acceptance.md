# M12 Planning Workshop – 验收脚本与打磨清单（2025-11-17）

| 属性 | 值 |
|------|-----|
| **最后更新** | 2025-11-17 |
| **版本** | v1.0 |
| **状态** | ✅ Current |

---

## 📝 更新历史

- **2025-11-17**: 初稿完成

---

> 本文用于指导下一轮“规划工作坊体验打磨”之前的验收与复盘。  
> 目标：基于 M12-A～E 已落地的能力，系统验证当前体验，并记录仍需打磨的重点。

---

## 0. 预置说明

- 工作目录：`playgrounds/testProject/`（或与实际项目同等复杂度的仓库）。  
- 新建任务：`ai-tools repl` → `new task`。  
- 建议先准备两份 brief：V1（初版需求）、V2（在 V1 结果上追加反馈/变更）。  
- 验收前确保 `node --test test/planningMeeting.test.mjs` 全部通过。

---

## 1. 打磨清单（当前尚未完成，但需要纳入后续产品打磨）

1. **澄清结果的“可见性与反哺”**  
   - 目前澄清小会只写入 `planning.transcript.jsonl`，没有在 `planning.meeting.md` 或报告中提示“澄清过哪些问题、结论是什么”。  
   - 建议：在报告/meeting 中增加“澄清纪要”段落；下一轮 `/plan` 内部调用时显式引用这些问答。

2. **多轮对比的呈现**  
   - Round 1/2 verdict 已写入 `per_role_verdicts_history`，但报告和 UI 还没有显示“上一轮 vs 本轮差异”。  
   - 建议：在 `planning.report.md` 中增加“本轮相较上一轮的变化”栏目。

3. **per-role 决策映射更细**  
   - 目前只硬利用 Test/Risk verdict。  
   - 需要把 Product/System/SeniorDev 的 reasons/suggestions 映射到报告/meeting 的对应板块，形成更具体的行动项。

4. **Clarification 触发策略**  
   - 现阶段 “decision=hold/redo” 时会兜底抓 `open_questions`。需要更智能的筛选（例如去重、按角色分组、给出优先级）。

5. **版本对比工具**  
   - `/redo planning` 会保存 `planning/versions/vN`，但没有命令/脚本让用户快速 diff v1/v2。  
   - 需要后续设计 `ai-tools plan:diff v1 v2` 或在报告中自动列出“上一版 vs 本版”的关键信息。

6. **报告结构继续打磨**  
   - 目前的 `planning.report.md` 是平面化的 summary，需要：  
     - 分角色小节（产品/设计/实现/测试/风险）；  
     - 明确把 `assumptions`、`open_questions` 与建议关联起来；  
     - 支持“推荐下一步”更加结构化（例如 gating、需要用户输入、需要额外调查）。

7. **Clarification Rounds 的自动重启**  
   - 现在澄清问完不会触发新一轮 `/plan`，需要用户手动再执行。  
   - 未来可以在 `/plan` 尾部提示“要不要根据新澄清自动生成 vN+1”，或提供 `/plan --continue`。

---

## 2. 验收步骤

### Step 1：创建初版规划（V1）
1. `ai-tools repl` → `new` → `/plan <brief_v1>`。  
2. 观察输出：  
   - `planning.ai.json`、`plan.md`、`plan-review.*`、`planning.meeting.*`、`reports/planning/v1`。  
   - `planning.report.md` 内容是否包含：教练总结、决策、scope/non_goals、assumptions/open_questions、test_plan 摘要、各角色 verdict。  
3. 若存在 blocking open_questions，确认 `/plan` 尾部出现“澄清小会”。  
4. 查 `planning/transcript.jsonl`，确认 brief / clarify 问答记录均在。

### Step 2：redo + 多版本
1. 在 REPL 中执行 `/redo planning`：  
   - `state.json.actors.planning.round` 应从 1 → 2；  
   - `planning/versions/v1/` 生成完整快照（含 planning.report.md）。  
2. 修改 brief（或通过 `latest/planning.report.md` + 用户吐槽组合），再次 `/plan`：  
   - 确认第二轮 `planning.report.md` 保存为 `reports/planning/v2/`。  
   - PlanningAgent 日志应提示“已自动把上一版报告作为输入”。  
   - `planning/versions/v2` 按需生成（若之后继续 redo）。

### Step 3：多轮会议与澄清链路
1. 打开 `planning.meeting.json`：  
   - `rounds[0].per_role_verdicts` 应承载经过 Round 2 复核后的 verdict；  
   - `rounds[0].per_role_verdicts_history.round1/round2` 记录两轮的差异。  
2. 检查 `planning.meeting.md` 是否展示：  
   - 关键要点/风险/决策；  
   - 按角色的红灯概要；  
   - “角色结论变化（上一轮 vs 本轮）”段落，列出对比结果。  
   - 新增“澄清纪要”段落，列出最近的澄清问答。  
3. 若 `/plan` 触发澄清：  
   - 验证教练提出的问题确实来自 role verdict 的 `blocking_open_questions`；  
   - transcript 中 `from_role` 字段正确；  
   - 澄清结束后提示用户“可再次 /plan 生成新版本”。

### Step 4：报告 & 版本目录
1. `reports/planning/latest/planning.report.md` 与 `reports/planning/v2/planning.report.md` 内容一致。  
2. `planning/versions/v1/` 与 `planning/versions/v2/` 各自包含：  
   - `planning.ai.json/plan.md/plan-review.*/planning.meeting.*/roles/（如有）/planning.report.md`。  
3. 报告中应包含“角色结论变化”“澄清纪要”段落，与 meeting.md 一致；  
4. 可手动对比 v1/v2 报告，确认差异符合第二次 brief 的预期。

---

## 3. 记录验收问题与打磨点

- 在执行 Step 1–4 过程中，如发现体验缺陷或 bug：  
  1. 直接在本文件或附属工作日志里按“步骤→发现→预期→建议”记录；  
  2. 归类到上方“打磨清单”对应条目，或新增条目。  
- 验收完成后，输出一份“问题列表 + 优先级”，作为下一轮打磨 backlog。

---

## 4. 后续动作

- 按本脚本验收后，若核心流程（生成规划/redo/澄清/报告）全部通过，则进入“精细打磨”阶段：  
  - 创建针对每一个打磨点的具体任务（UX、CLI 提示、报告结构等）；  
  - 结合用户/产品反馈决定优先级。  
- 若发现阻塞性缺陷（例如多版本丢失产物、澄清无法记录），需先 fix 再进入打磨。
