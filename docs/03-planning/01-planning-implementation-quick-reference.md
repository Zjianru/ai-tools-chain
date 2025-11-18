# 规划阶段实现快速参考卡

| 属性 | 值 |
|------|-----|
| **最后更新** | 2025-11-18 |
| **版本** | v1.0 |
| **状态** | ✅ Current |

---

## 📝 更新历史

- **2025-11-18**: 初稿完成

---

**用途**：M11-3 开发过程中的快速查阅  
**打印建议**：适合打印 A4 贴在开发环境旁  
**更新周期**：每周更新一次

---

## 🎯 11 个关键决策速查

| # | 决策 | 含义 | 代码改动 |
|----|------|------|---------|
| 1️⃣ | 快速路径 | Round 1 全同意 → 直接产规划案 | `planningMeetingAgent.mjs` |
| 2️⃣ | Round 3 输入 | 需求+共识+澄清+用户回答+前面AI答复 | `planningMeetingCore.mjs` |
| 3️⃣ | 风险记录 | 允许用草案做 codegen，但记完整追溯链 | `codegenAgent.mjs` |
| 4️⃣ | 小会群聊 | AI 看前面问题后可避免冗余 | `clarificationMeeting.mjs` |
| 5️⃣ | 意图判断 | AI invoke 判断是"细化"还是"新规划" | `intentCheck.mjs` |
| 6️⃣ | 全程参与 | 用户全程看讨论进度，小会时"做 battle" | `repl.mjs` |
| 7️⃣ | 产物分化 | JSON（规划案）vs Markdown（规划草案）| `planningMeetingCore.mjs` |
| 8️⃣ | 共识提炼 | 所有讨论后都要进行共识提炼 | `consensusSynthesis.mjs` |
| 9️⃣ | 产物格式 | 规划案 JSON（机器读）vs 规划草案 MD（人类读）| `planningMeetingCore.mjs` |
| 🔟 | 意图 AI invoke | 使用 AI 来判断用户意图 | `intentCheck.mjs` |
| 1️⃣1️⃣ | 共识门槛 | 只要有一个不同意 → 必须是草案 | `planningMeetingCore.mjs` |

---

## 📊 M11-3 实现 7 大 Task

### Task 1：快速路径与共识提炼
```
文件：planningMeetingAgent.mjs, planningMeetingCore.mjs, consensusSynthesis.mjs (新)
代码量：~200 行
难度：⭐⭐
关键逻辑：
  - Round 1 全同意的快速路径
  - 共识提炼 invoke 的集成
  - 产物类型决策
```

### Task 2：小会两阶段 Invoke
```
文件：clarificationMeeting.mjs (新), plan.mjs
代码量：~400 行
难度：⭐⭐⭐
关键逻辑：
  - planning_clarify_review invoke（AI 二次判断）
  - planning_clarify_ask invoke（AI 最终提问）
  - 群聊式 UI 展示（打印思考过程）
```

### Task 3：产物格式区分
```
文件：planningMeetingCore.mjs
代码量：~300 行
难度：⭐⭐
关键逻辑：
  - JSON 序列化（规划案）
  - Markdown 生成（规划草案）
  - 清晰的产物头部标记
```

### Task 4：规划案 / 草案硬性门槛
```
文件：planningMeetingCore.mjs, codegenAgent.mjs
代码量：~150 行
难度：⭐⭐
关键逻辑：
  - 共识判断：0 异议规则
  - Codegen gate：Draft 检查
  - 用户确认对话
```

### Task 5：models.conf 配置
```
文件：.ai-tools-chain/config/models.conf
代码量：~20 行
难度：⭐
关键内容：
  - planning_clarify_review
  - planning_clarify_ask
  - planning_consensus_synthesis
  - planning_intent_check
```

### Task 6：单元 & 集成测试
```
文件：test/planningPhase1.test.mjs (新)
代码量：~600 行
难度：⭐⭐⭐
覆盖场景：
  ✅ 快速路径（Round 1 全同意）
  ✅ 完整路径（Round 1→2→小会→3）
  ✅ 共识提炼三种输出（全同意/保留/反对）
  ✅ 小会避免冗余问题
  ✅ 产物格式正确性
  ✅ 硬性门槛应用
```

### Task 7：文档更新与验收
```
文件：多个 .md 文档
工作量：~5 小时
关键更新：
  - PLANNING-STAGE-USER-JOURNEY
  - PLANNING-JOURNEY-VALIDATION
  - M11-ALL-ACCEPTANCE（规划部分）
  - worklog-2025-11-18
```

---

## 🔑 核心数据结构

### Round 3 的精确 Payload 结构

```javascript
{
  user_brief: "用户原始需求",
  consensus_from_r1_r2: {
    agreed_points: [...],
    conflicting_points: [...]
  },
  clarification_questions: {
    "Q1": "系统是否要与现有用户系统绑定？",
    "Q2": "数据迁移是否在 scope 内？"
  },
  user_answers: {
    "Q1": "是的，需要绑定",
    "Q2": "不在这次 scope 内"
  },
  previous_ai_responses_in_r3: {
    ProductPlanner: { ok, reasons },
    SystemDesigner: { ok, reasons }
  },
  my_prompt: "你作为 TestPlanner 的角色 prompt..."
}
```

### 共识提炼的输出结构

```javascript
{
  ok: true,
  consensus: {
    agreed_points: [
      "系统需要与现有50万用户绑定",
      "API权限需要细粒度控制"
    ],
    reserved_points: [
      {
        role: "TestPlanner",
        concern: "数据库性能不足",
        severity: "warning"
      }
    ],
    strong_disagreements: [
      {
        topic: "系统架构",
        positions: {
          ProductPlanner: "微服务",
          SystemDesigner: "单体"
        }
      }
    ]
  },
  summary: "..." // 用于规划案或草案
}
```

---

## ✅ 产物判断规则

### 规划案（planning.ai.json）

```
条件：
  ✓ 所有 5 个角色都 ok === true
  ✓ 共识提炼无任何 reserved_points 或 strong_disagreements
  
格式：JSON（机器读）
用途：传递给 Codegen Agent
可否用于 codegen：✅ 是
```

### 规划草案（planning.draft.md）

```
条件：
  ✗ 有任何角色 ok === false 或 ok === null
  ✗ 共识提炼有任何异议
  
格式：Markdown（人类读）
用途：展示给用户，便于理解问题
可否用于 codegen：❌ 否（但可以覆盖用户确认）
```

---

## 🧪 关键测试场景

### 场景 1：快速成功
```
Round 1：所有角色都同意 ✅✅✅✅✅
  ↓
共识提炼 → 无异议
  ↓
生成：planning.ai.json（规划案）
  ↓
Codegen：✅ 直接进入
```

### 场景 2：完整讨论
```
Round 1：有异议 ✅✅❌✅❌
  ↓
Round 2：部分改善 ✅✅✅❌❌
  ↓
小会：用户澄清了 2 个问题
  ↓
Round 3：仍有 1 个反对 ✅✅✅✅❌
  ↓
共识提炼 → 有 strong_disagreements
  ↓
生成：planning.draft.md（规划草案）
  ↓
Codegen：⚠️ 需要用户确认后才能进
```

### 场景 3：小会避免冗余
```
ProductPlanner 提问："系统是否要与现有用户系统绑定？"
用户回答："是的"
  ↓
SystemDesigner 二次判断：
  "我原来想问'系统是否需要与现有系统兼容'，但这已被覆盖了"
  "决定改为问'数据库选型'"
  ↓
SystemDesigner 提问："数据库选型有什么限制？"
  ↓
[用户回答，继续下一个角色]
```

---

## 🚨 常见陷阱 & 避免方案

| 陷阱 | 症状 | 解决方案 |
|------|------|---------|
| **小会中 AI 问重复问题** | 用户说"你们刚问过啦" | 二次判断 invoke 中明确要求 AI 避免重复 |
| **共识提炼判断错误** | 规划案中其实有异议 | 在 prompt 中明确定义"异议"的阈值 |
| **产物格式混淆** | 给 Codegen 传了 Markdown | 在产物头部加 `type: "plan"` or `"draft"` 标记 |
| **用户用草案做 codegen** | 代码生成失败无法追溯 | 强制记录 `draft_usage_confirmation` 的时间戳和用户ID |
| **Round 3 输入不完整** | AI 根本不知道前面的澄清 | 在 payload 中明确包含所有前面的 Q&A |

---

## 📈 代码改动统计

```
新增代码量：~1,500 行
  - clarificationMeeting.mjs：400 行
  - consensusSynthesis.mjs：200 行
  - intentCheck.mjs：150 行
  - test/planningPhase1.test.mjs：600 行
  - models.conf：20 行
  - schemas.mjs：130 行

修改现有代码：~600 行
  - planningMeetingAgent.mjs：150 行
  - planningMeetingCore.mjs：250 行
  - codegenAgent.mjs：100 行
  - plan.mjs：50 行
  - 其他：50 行

总计：~2,100 行代码

测试覆盖：~600 行测试代码
覆盖率目标：> 80%
```

---

## ⏱️ 预计时间表

| Task | 预计工期 | 难度 | 依赖 |
|------|---------|------|------|
| Task 1 | 3-4 天 | ⭐⭐ | 无 |
| Task 2 | 5-6 天 | ⭐⭐⭐ | Task 1 |
| Task 3 | 2-3 天 | ⭐⭐ | Task 1 |
| Task 4 | 2-3 天 | ⭐⭐ | Task 1, 3 |
| Task 5 | 0.5 天 | ⭐ | 无 |
| Task 6 | 4-5 天 | ⭐⭐⭐ | Task 1-4 |
| Task 7 | 2-3 天 | ⭐ | 所有完成 |
| **总计** | **19-24 天** | - | - |

**实际预计**：2025-11-20 ~ 2025-12-15（包括集成测试和验收）

---

## 📞 快速求助指南

| 问题 | 参考文档 |
|------|---------|
| "这个决策是为什么？" | `PLANNING-FINAL-DECISIONS-2025-11-18.md` |
| "小会的流程具体怎么样？" | `PLANNING-CLARIFICATION-MEETING-2025-11-18.md` |
| "规划案和规划草案的区别？" | `PLANNING-DESIGN-DECISIONS-2025-11-18.md` (决策 #9) |
| "所有文档在哪里？" | `PROJECT-DOCUMENTATION-MAP-2025-11-18.md` |
| "用户旅程的完整流程" | `PLANNING-STAGE-USER-JOURNEY-2025-11-18.md` |
| "我想看代码的影响范围" | `PLANNING-FINAL-DECISIONS-2025-11-18.md` (第 9 节) |
| "昨天做了什么？" | `docs/worklog/worklog-2025-11-18.md` |

---

**打印这个卡片，贴在你的显示器旁！** 📌

