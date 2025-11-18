# 规划阶段最终设计决策 - 2025-11-18

**时间**：2025-11-18  
**状态**：✅ 最终确认  
**决策者**：@user

---

## 决策 #8：共识提炼的强制流程

**原文**：
> 共识提炼必须有，而且应该是在所有讨论结束后，马上要生产规划案/规划草案的时候，即如果 round1 AI 达成共识，结束讨论，那就在 round1 后面开展提炼，如果是 round3 后还没有达成共识，那也开展一次提炼

**含义**：

无论何种情况，产出产物前**都要进行一次共识提炼**：

```
场景 A：Round 1 全同意（快速路径）
  Round 1 讨论结束
    ↓
  【共识提炼】AI invoke 生成共识摘要
    ↓
  生成 planning.ai.json（规划案）

场景 B：Round 2 + 小会 + Round 3 后仍未全同意
  Round 3 讨论结束
    ↓
  【共识提炼】AI invoke 生成共识摘要 + 异议清单
    ↓
  生成 planning.draft.md（规划草案）
```

**共识提炼的 Invoke（新增）**：

```
Role: "planning_consensus_synthesis"

输入 payload：
{
  "all_discussions": {
    "round1": [ perRoleVerdicts ],
    "round2": [ perRoleVerdicts ],
    "round3": [ perRoleVerdicts ],  // 可能无
    "clarifications": { Q&A... }    // 可能无
  },
  "user_brief": "用户原始需求",
  "planning": { why, what, requirements, ... }
}

输出：
{
  "ok": true,
  "consensus": {
    "agreed_points": [ "point1", "point2", ... ],
    "reserved_points": [
      {
        "role": "TestPlanner",
        "concern": "数据库性能...",
        "severity": "warning|error"
      }
    ],
    "strong_disagreements": [
      {
        "topic": "系统架构",
        "positions": {
          "ProductPlanner": "微服务",
          "SystemDesigner": "单体"
        }
      }
    ]
  },
  "summary": "共识摘要，用于规划案或草案"
}
```

**代码影响**：
- 新增 `src/planning/consensusSynthesis.mjs` 或在 `planningMeetingCore.mjs` 中添加函数
- 所有产物生成前都要调用 `await synthesizeConsensus(...)`
- 如果输出包含 `strong_disagreements` 或任何 `error` severity，直接生成 **规划草案**，否则生成 **规划案**

**相关文件**：`src/agents/planningMeetingAgent.mjs`, `src/planning/planningMeetingCore.mjs`

---

## 决策 #9：产物的严格格式定义

**原文**：
> 规划草案永远是给人看的，所以要用 md 语法，而规划案是给下一阶段的，要用 json

**含义**：

| 产物 | 格式 | 用途 | 生成条件 |
|------|------|------|---------|
| **规划案** | `planning.ai.json` | 传递给 Codegen Agent | 共识提炼输出无异议 |
| **规划草案** | `planning.draft.md` | 展示给用户看、便于理解问题 | 共识提炼输出有任何异议/不同意 |

**规划案的 JSON 结构**：
```json
{
  "meta": {
    "task_id": "...",
    "created_at": "2025-11-18T...",
    "version": 1,
    "consensus_status": "agreed"
  },
  "why": "...",
  "what": "...",
  "requirements": [...],
  "draft_files": [...],
  "acceptance": [...],
  "scope": "...",
  "non_goals": [...],
  "open_questions": [],  // 应该为空或最小化
  "test_plan": {...},
  "consensus_snapshot": {
    "agreed_by": ["ProductPlanner", "SystemDesigner", "SeniorDeveloper", "TestPlanner", "RiskPlanner"],
    "reserved_by": [],
    "synthesis_at": "2025-11-18T..."
  }
}
```

**规划草案的 Markdown 结构**：
```markdown
# 规划草案 - {task_title}

生成时间：2025-11-18 14:30:00  
讨论轮次：Round 1 → Round 2 → 小会澄清 → Round 3

## 原始需求
[用户输入的需求]

## 讨论过程总结

### Round 1 讨论结果
- ProductPlanner: [同意/保留/反对] - [原因]
- SystemDesigner: [同意/保留/反对] - [原因]
- ...

### 小会澄清内容
[Q&A 记录]

### Round 3 讨论结果
- ProductPlanner: [同意/保留/反对] - [原因]
- ...

## ⚠️ 未达成共识的部分（重点标记）

### 问题 1：系统架构
- **ProductPlanner 立场**：应该采用微服务架构，便于后续扩展
- **SystemDesigner 立场**：现阶段单体架构足够，过度设计反而增加复杂度
- **当前状态**：有分歧，需要进一步澄清或调整需求

### 问题 2：数据迁移策略
- **TestPlanner 立场**：必须在发布前完成数据迁移
- **SystemDesigner 立场**：先发布新系统，用户数据分阶段迁移

## 已达成共识的部分
- ✅ 系统需要与现有 50 万用户系统绑定
- ✅ API 权限需要细粒度控制到端点级别
- ✅ ...

## 后续建议

用户有以下选择：
1. 针对未达成共识的部分，提供更多信息或调整需求
2. 基于当前草案，接受某些决策的风险
3. 放弃本次规划，重新开始新需求

---

**警告**：⚠️ 本文档是规划草案，**不代表达成共识**，不能直接用于代码生成。
```

**代码影响**：
- 修改 `buildPlanningMeetingArtifacts()` 以生成不同格式的产物
- 需要区分"规划案输出"和"规划草案输出"两条路径
- 规划案应该是"精简、结构化、给机器读"
- 规划草案应该是"完整、易读、给人类看"

**相关文件**：`src/planning/planningMeetingCore.mjs`

---

## 决策 #10：用户意图判断使用 AI Invoke

**原文**：
> 我认为最好是 AI invoke，携带用户的输入，来判断意图

**含义**：

当用户新输入需求并可能上传历史产物时，使用 AI invoke 来判断意图：

```
Role: "planning_intent_check"

输入 payload：
{
  "user_input": "基于权限系统规划，现在需要添加审计日志功能",
  "uploaded_file": {
    "type": "planning.ai.json",
    "title": "权限系统规划",
    "version": 1,
    "key_points": [...]
  },
  "user_history": {
    "previous_plannings": [ title1, title2, ... ],
    "recent_status": "accepted|draft|in_progress"
  }
}

输出：
{
  "ok": true,
  "intent": "refine",  // "refine" | "new_with_reference" | "new" | "continue_discussion"
  "explanation": "用户想在权限系统的基础上添加新功能，应该继承前次的共识",
  "should_inherit_consensus": true,
  "inherited_consensus_from": "planning-v1-20251118",
  "recommendation": "启动新的 Round 1，使用旧规划的共识作为背景"
}
```

**Intent 的含义**：
- `"refine"`：用户想在旧规划基础上做细化/扩展 → 加载旧共识 → 新 Round 1
- `"new_with_reference"`：新需求但想参考旧规划 → 仅展示旧规划，新 Round 1
- `"new"`：完全新的需求 → 丢弃旧规划 → 新 Round 1
- `"continue_discussion"`：用户想继续上次未完成的讨论 → 从中止点继续

**代码影响**：
- 新增 `src/planning/intentCheck.mjs` 模块
- 在 `PlanningAgent.step()` 初期添加意图检查
- 根据 intent 决定是否加载旧规划作为背景

**相关文件**：`src/agents/planningAgent.mjs`, 新增 `src/planning/intentCheck.mjs`

---

## 决策 #11：共识的硬性门槛

**原文**：
> 只要有一个不同意，那就是草案——这说明还有问题需要澄清，那就说明方案不完善，那就不能投入生产！

**含义**：

```
共识判断的硬规则：

规划案（planning.ai.json）的条件：
  ✅ 所有 5 个角色 ok === true
  ✅ 共识提炼无异议
  
规划草案（planning.draft.md）的条件：
  ❌ 只要有任何一个角色 ok === false 或 ok === null
  ❌ 共识提炼输出包含任何 reserved_points 或 strong_disagreements
  
门槛说明：
  - "保留意见"（ok === null）也视作"未全同意"
  - "明确反对"（ok === false）更是草案
  - 0 异议才能进入 Codegen
```

**代码逻辑**：

```javascript
function determineArtifactType(consensusSynthesis, perRoleVerdicts) {
  // 检查是否有任何反对或保留
  const hasDisagreement = Object.values(perRoleVerdicts).some(v => 
    v.ok === false || v.ok === null
  );
  
  // 检查共识提炼是否有异议
  const hasConflicts = 
    consensusSynthesis.reserved_points?.length > 0 ||
    consensusSynthesis.strong_disagreements?.length > 0;
  
  if (hasDisagreement || hasConflicts) {
    return "draft";  // 规划草案
  } else {
    return "plan";   // 规划案
  }
}
```

**Codegen 的 Gate 检查**：

```javascript
// 在 codegenAgent 启动前
const artifactType = metadata.planning_artifact_type;

if (artifactType === "draft") {
  // 规划草案，需要显式警告
  console.warn("⚠️ 警告：这是规划草案（未达成共识），进行代码生成的风险很高");
  console.warn("具体异议：");
  // 显示所有异议内容
  
  // 需要用户确认
  const confirmed = await ask("我已理解风险，确认继续吗？ (yes/no): ");
  if (confirmed !== "yes") {
    throw new Error("用户中止");
  }
  
  // 记录用户的确认和时间戳
  logWarning({ type: "draft_usage", user_confirmed: true, timestamp: now() });
}
```

**相关文件**：`src/planning/planningMeetingCore.mjs`, `src/agents/codegenAgent.mjs`

---

## 五个新增 Invoke Roles 总结

基于以上决策，规划阶段需要新增以下 5 个 role：

1. **`planning_clarify_review`** - 小会中 AI 的二次判断
2. **`planning_clarify_ask`** - 小会中 AI 的最终提问
3. **`planning_consensus_synthesis`** - 所有讨论后的共识提炼
4. **`planning_intent_check`** - 用户新输入时的意图判断
5. **`planning_review_revision`** - (已有) 规划审查

**需要在 `models.conf` 中注册这些 role**

---

## 影响范围总结

### 代码文件改动清单

| 文件 | 改动类型 | 影响点 |
|------|---------|-------|
| `src/agents/planningMeetingAgent.mjs` | 修改 | 快速路径、共识提炼调用 |
| `src/planning/planningMeetingCore.mjs` | 修改 | 产物生成逻辑、Format 区分 |
| `src/cli/commands/plan.mjs` | 修改 | 意图检查、小会流程调用 |
| `src/agents/planningAgent.mjs` | 修改 | 意图检查、启动逻辑 |
| `src/agents/codegenAgent.mjs` | 修改 | Draft 检查、Gate 强化 |
| `src/planning/clarificationMeeting.mjs` | 新增 | 小会核心逻辑 |
| `src/planning/intentCheck.mjs` | 新增 | 用户意图判断 |
| `src/planning/consensusSynthesis.mjs` | 新增 | 共识提炼逻辑 |
| `src/core/schemas.mjs` | 修改 | 新增 consensus, intent 的 schema |
| `.ai-tools-chain/config/models.conf` | 修改 | 新增 5 个 role 的模型配置 |

### 新增文件结构

```
src/planning/
  ├─ clarificationMeeting.mjs        (新)
  ├─ intentCheck.mjs                 (新)
  ├─ consensusSynthesis.mjs          (新)
  ├─ (已有) planningMeetingCore.mjs
  ├─ (已有) transcript.mjs
  └─ (已有) versions.mjs
```

---

## 实现优先级（M11-3）

### 必做（Phase 1）
1. ✅ 快速路径（Round 1 全同意直接跳过 Round 2/3）
2. ✅ 共识提炼（所有讨论后都要调用）
3. ✅ 产物格式区分（JSON vs Markdown）
4. ✅ 硬性门槛（0 异议才是规划案）
5. ✅ 小会逻辑（AI 二次判断 + 最终提问）

### 后续（Phase 2 - M12）
6. 用户意图判断
7. Draft gate 强化（Codegen 前的检查）
8. 版本管理 UI

---

**所有 11 个设计决策现已确认且记录完毕！**  
**可以开始文档整理工作。** ✅

