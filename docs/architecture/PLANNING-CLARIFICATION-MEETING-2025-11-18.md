# 小会澄清流程 - 实现细节设计

**时间**：2025-11-18  
**版本**：1.0  
**目标**：精确定义小会中 AI 避免冗余问题的实现方式

---

## 一、小会的核心逻辑

### 1.1 小会的参与者与顺序

```
小会参与者（固定顺序）：
  1. ProductPlanner
  2. SystemDesigner
  3. SeniorDeveloper
  4. TestPlanner
  5. RiskPlanner
  6. Coach（旁听、记录、控制节奏）

小会启动条件：
  Round 2 结束后，仍有任何 blocking_open_questions
```

### 1.2 小会的流程架构

```
【小会启动】
系统提示用户和 AI：
  "进入规划澄清小会"
  "参会者：ProductPlanner, SystemDesigner, SeniorDeveloper, TestPlanner, RiskPlanner"
  "待澄清问题：
    - 系统是否要与现有用户系统绑定？
    - 数据迁移是否在 scope 内？
    - API 权限是细粒度还是粗粒度？"
  [显示来源：ProductPlanner 提出 Q1, Q3; TestPlanner 提出 Q2]

【每个 AI 的轮流发言流程】
for each role in [ProductPlanner, SystemDesigner, SeniorDeveloper, TestPlanner, RiskPlanner]:
  
  Step 1: AI 看到"前面的问答"
    输入给 AI：
      - 所有前面角色在小会中的问题
      - 所有用户对前面问题的回答
      - 所有前面角色做出的"二次判断"结果
  
  Step 2: AI 进行"二次判断"（第一个 invoke）
    Invoke 一个特殊的 role："planning_clarify_review"
    输入 payload：
      {
        "my_role": "SystemDesigner",
        "my_original_questions": [
          "数据库选型有什么限制吗？",
          "系统架构是单体还是微服务？"
        ],
        "clarification_so_far": {
          "Q1": "系统是否要与现有用户系统绑定？",
          "A1": "是的，需要绑定。50 万用户需要平滑迁移。",
          "Q3": "API 权限是细粒度还是粗粒度？",
          "A3": "需要细粒度控制，精确到 API 端点级别。"
        },
        "previous_ai_reviews": {
          "ProductPlanner": {
            "original_question": "系统是否要与现有用户系统绑定？",
            "review_result": "该问题已被我自己问出并得到回答，跳过"
          }
        },
        "my_prompt": "你是系统设计师..."
      }
    
    期望输出：
      {
        "ok": true,
        "questions_to_ask": [
          {
            "original": "数据库选型有什么限制吗？",
            "status": "ask",      // "ask" = 提出 | "skip" = 跳过
            "reason": "这个问题与用户回答没有重复"
          },
          {
            "original": "系统架构是单体还是微服务？",
            "status": "modify",   // "modify" = 修改后提出
            "modified": "基于用户已回答'需要与现有系统绑定'，系统架构是否需要考虑双向兼容？",
            "reason": "原问题仍有价值，但需要基于新澄清进行调整"
          }
        ]
      }
  
  Step 3: 打印 AI 的思考过程（用户可见）
    输出示例：
      "🤔 SystemDesigner 正在思考..."
      "  ⚠️ 检查我的问题是否与已澄清的内容重复"
      "  ✅ '数据库选型' - 需要提问，未被覆盖"
      "  🔄 '系统架构' - 修改后提问"
      "     原问题：系统架构是单体还是微服务？"
      "     新问题：基于用户已回答'需要与现有系统绑定'，系统架构是否需要考虑双向兼容？"
  
  Step 4: AI 基于"二次判断"的结果，决定实际提问
    提问：最终确定的问题列表
    记录：question, AI role, user answer
    
【小会结束】
系统总结并展示最终的澄清纪要
```

---

## 二、两个关键的 Invoke 点

### 2.1 Invoke #1: 二次判断（planning_clarify_review）

**目的**：让 AI 看到前面的问答后，判断自己的问题是否需要改变

**Role Name**：`planning_clarify_review`

**Payload 结构**：

```typescript
interface ClarifyReviewPayload {
  my_role: string;                    // 当前 AI 角色（e.g., "SystemDesigner"）
  my_original_questions: string[];    // 我在 Round 2 中提出的原始问题
  
  clarification_so_far: {
    [key: string]: string;            // Q1, A1, Q2, A2, Q3, A3, ...
  };
  
  previous_ai_reviews: {
    [role: string]: {
      original_question: string;
      review_result: "skip" | "ask" | "modify";
      modified_question?: string;
    }
  };
  
  my_prompt: string;                  // 我的角色 prompt
}
```

**期望输出结构**：

```typescript
interface ClarifyReviewResult {
  ok: boolean;
  questions: {
    original: string;
    status: "ask" | "skip" | "modify";
    modified?: string;                // 如果 status === "modify" 时填写
    reason: string;                   // 简短的理由（用于打印给用户）
  }[];
}
```

**Prompt 示例**（伪代码）：

```
你是一个名为 SystemDesigner 的 AI 角色。
你在规划讨论的第二轮中，提出了以下问题来澄清需求：
1. 数据库选型有什么限制吗？
2. 系统架构是单体还是微服务？

现在，规划讨论进入了"澄清小会"阶段。
用户已经回答了部分问题：
  - [ProductPlanner]: 系统是否要与现有用户系统绑定？
    用户回答：是的，需要绑定。50 万用户需要平滑迁移。
  - [TestPlanner]: API 权限是细粒度还是粗粒度？
    用户回答：需要细粒度控制，精确到 API 端点级别。

同时，ProductPlanner 看到这些澄清后，决定跳过他自己的"系统是否要与现有用户系统绑定？"这个问题（因为已被覆盖）。

请你判断：你的两个问题是否仍然需要提出？
  1. 如果该问题已被其他角色或用户回答，请标记为 "skip"
  2. 如果该问题仍有价值但需要基于新澄清进行调整，请标记为 "modify" 并给出修改后的问题
  3. 如果该问题仍需原样提出，请标记为 "ask"

请以 JSON 格式返回你的判断，包含每个问题的状态和理由。
```

### 2.2 Invoke #2: 最终提问（planning_clarify_ask）

**目的**：基于二次判断的结果，AI 进行最终的提问

**Role Name**：`planning_clarify_ask`

**Payload 结构**：

```typescript
interface ClarifyAskPayload {
  my_role: string;
  questions_to_ask: {
    original: string;
    status: "ask" | "modify";
    modified?: string;
  }[];
  
  user_brief: string;
  consensus_from_r1_r2: any;
  clarification_so_far: any;
  my_prompt: string;
}
```

**期望输出**：

```typescript
interface ClarifyAskResult {
  ok: boolean;
  question_to_present: string;        // 真正要问用户的问题（可以是原问题或修改后的问题）
  follow_up_guidance?: string;        // 可选的后续指导信息
}
```

**Prompt 示例**（伪代码）：

```
你是 SystemDesigner，现在要在澄清小会中提问。
你已经判断出自己的以下问题需要提出：
  1. [ask] 数据库选型有什么限制吗？
  2. [modify] 基于用户已回答'需要与现有系统绑定'，系统架构是否需要考虑双向兼容？

当前的用户需求背景：
  [用户原始需求]
  [已达成的共识]
  [已澄清的内容]

请基于这个背景，生成一个清晰、简洁的提问。
考虑：
  - 提问要与已澄清的内容逻辑连贯
  - 避免使用技术术语（除非用户已经用过）
  - 一次只提出一个问题
  
返回格式：
{
  "ok": true,
  "question_to_present": "你问的具体问题是什么？"
}
```

---

## 三、小会完整流程示例

### 场景假设

```
Round 2 结束时的 blocking_open_questions：
  - ProductPlanner: "系统是否要与现有用户系统绑定？"
  - TestPlanner: "数据迁移是否在 scope 内？"
  - SystemDesigner: "API 权限是细粒度还是粗粒度？", "数据库选型有什么限制吗？"
```

### 执行过程

```
【小会启动】
Console Output:
  📞 规划澄清小会已启动
  👥 参会者：ProductPlanner, SystemDesigner, SeniorDeveloper, TestPlanner, RiskPlanner
  📋 待澄清问题共 4 个
  ─────────────────────

【Round 1 - ProductPlanner 发言】
🎤 ProductPlanner 进行二次判断...
  ✅ 我的原始问题："系统是否要与现有用户系统绑定？"
  📊 前面的澄清：（无，我是第一个）
  ➜ 决定：直接提出该问题

🎤 ProductPlanner: "系统是否要与现有用户系统绑定？"

> 用户回答：是的，需要绑定。而且还要支持现有 50 万用户平滑迁移。

✅ 已记录
─────────────────────

【Round 2 - SystemDesigner 发言】
🤔 SystemDesigner 进行二次判断...
  检查我的原始问题：
    1️⃣ "API 权限是细粒度还是粗粒度？"
    2️⃣ "数据库选型有什么限制吗？"
  
  📊 前面的澄清：
    Q1: 系统是否要与现有用户系统绑定？
    A1: 是的，需要绑定。50 万用户需要平滑迁移。
  
  🔍 分析：
    ✅ "API 权限是细粒度还是粗粒度？" 
       → 状态：ask（与前面澄清无关，需要提出）
    ✅ "数据库选型有什么限制吗？" 
       → 状态：modify（需要基于'绑定 50 万现有用户'调整）
       → 修改为："既然需要与现有系统绑定 50 万用户，现有数据库是否需要继续使用，还是可以迁移到新数据库？"

🎤 SystemDesigner: "API 权限是细粒度还是粗粒度？"

> 用户回答：细粒度，精确到 API 端点级别。

✅ 已记录

🎤 SystemDesigner: "既然需要与现有系统绑定 50 万用户，现有数据库是否需要继续使用，还是可以迁移到新数据库？"

> 用户回答：先用现有数据库，后期考虑迁移。

✅ 已记录
─────────────────────

【Round 3 - SeniorDeveloper 发言】
🤔 SeniorDeveloper 进行二次判断...
  检查我的原始 blocking_open_questions：
    → （假设 SeniorDeveloper 在 Round 2 没有 blocking_questions，直接跳过）

SeniorDeveloper: 没有需要澄清的问题。

✅ 跳过
─────────────────────

【Round 4 - TestPlanner 发言】
🤔 TestPlanner 进行二次判断...
  检查我的原始问题：
    1️⃣ "数据迁移是否在 scope 内？"
  
  📊 前面的澄清：
    Q1: 系统是否要与现有用户系统绑定？
    A1: 是的，需要绑定。50 万用户需要平滑迁移。
    Q2: API 权限是细粒度还是粗粒度？
    A2: 细粒度，精确到 API 端点级别。
    Q3: 既然需要与现有系统绑定 50 万用户，现有数据库是否需要继续使用？
    A3: 先用现有数据库，后期考虑迁移。
  
  🔍 分析：
    ✅ "数据迁移是否在 scope 内？"
       → 状态：modify（用户已回答'先用现有数据库，后期考虑迁移'）
       → 修改为："那么这次'新权限系统'的发布中，是否包含现有 50 万用户数据的迁移任务？还是说用户数据保持在现有数据库，只是权限系统新增？"

🎤 TestPlanner: "那么这次'新权限系统'的发布中，是否包含现有 50 万用户数据的迁移任务？还是说用户数据保持在现有数据库，只是权限系统新增？"

> 用户回答：暂时不包含，我们先完成权限系统新增，用户数据仍在现有数据库。

✅ 已记录
─────────────────────

【Round 5 - RiskPlanner 发言】
🤔 RiskPlanner 进行二次判断...
  检查我的原始 blocking_open_questions：
    → （假设 RiskPlanner 在 Round 2 没有 blocking_questions，直接跳过）

RiskPlanner: 没有需要澄清的问题。

✅ 跳过
─────────────────────

【小会结束】
✅ 澄清小会已完成
📝 纪要：共澄清 3 个问题，5 位角色参与

澄清内容摘要：
  • 系统需要与现有 50 万用户绑定并支持平滑迁移
  • API 权限需要细粒度控制到端点级别
  • 现有数据库继续使用，后期考虑迁移
  • 新权限系统暂不包含数据迁移任务
```

---

## 四、代码实现框架

### 4.1 新增模块：`src/planning/clarificationMeeting.mjs`

```javascript
/**
 * 运行规划澄清小会的核心逻辑
 */

import { invokeRole } from "../models/broker.mjs";
import chalk from "chalk";

/**
 * 获取某个角色在本次小会中应该提出的问题
 * 
 * @param {Object} params
 * @param {string} params.role - 当前角色（e.g., "SystemDesigner"）
 * @param {string[]} params.originalQuestions - 该角色在 Round 2 中提出的原始问题
 * @param {Object} params.clarificationSoFar - 目前已澄清的 Q&A 对象
 * @param {Object} params.previousAiReviews - 前面角色的二次判断结果
 * @param {string} params.userBrief - 用户原始需求
 * @param {Object} params.consensusFromR1R2 - 前两轮达成的共识
 * @param {string} params.prompt - 该角色的 prompt
 * @param {Object} params.aiDir - AI 配置目录
 * @param {string} params.cwd - 工作目录
 * 
 * @returns {Object}
 *   - questions: { original, status, modified?, reason }[]
 *   - displayText: 用户可见的思考过程
 */
export async function reviewClarifyQuestions({
  role,
  originalQuestions,
  clarificationSoFar,
  previousAiReviews,
  userBrief,
  consensusFromR1R2,
  prompt,
  aiDir,
  cwd
}) {
  const payload = {
    my_role: role,
    my_original_questions: originalQuestions,
    clarification_so_far: clarificationSoFar,
    previous_ai_reviews: previousAiReviews,
    my_prompt: prompt
  };

  const ai = await invokeRole(
    "planning_clarify_review",
    payload,
    { aiDir, cwd }
  );

  if (!ai?.ok) {
    throw new Error(`${role} 的二次判断失败`);
  }

  // 生成用户可见的思考过程
  const displayLines = [
    chalk.cyan(`🤔 ${role} 正在思考...`),
    chalk.gray("  ⚠️ 检查我的问题是否与已澄清的内容重复")
  ];

  for (const q of ai.questions) {
    if (q.status === "ask") {
      displayLines.push(
        chalk.green(`  ✅ "${q.original}"`)
      );
      displayLines.push(chalk.gray(`     ${q.reason}`));
    } else if (q.status === "skip") {
      displayLines.push(
        chalk.yellow(`  ⊘ "${q.original}" - 跳过`)
      );
      displayLines.push(chalk.gray(`     ${q.reason}`));
    } else if (q.status === "modify") {
      displayLines.push(
        chalk.blue(`  🔄 "${q.original}"`)
      );
      displayLines.push(
        chalk.blue(`     修改为：${q.modified}`)
      );
      displayLines.push(chalk.gray(`     ${q.reason}`));
    }
  }

  return {
    questions: ai.questions,
    displayText: displayLines.join("\n")
  };
}

/**
 * 获取某个角色在本次小会中的最终提问
 */
export async function askClarifyQuestion({
  role,
  questionsToAsk,
  userBrief,
  consensusFromR1R2,
  clarificationSoFar,
  prompt,
  aiDir,
  cwd
}) {
  const payload = {
    my_role: role,
    questions_to_ask: questionsToAsk,
    user_brief: userBrief,
    consensus_from_r1_r2: consensusFromR1R2,
    clarification_so_far: clarificationSoFar,
    my_prompt: prompt
  };

  const ai = await invokeRole(
    "planning_clarify_ask",
    payload,
    { aiDir, cwd }
  );

  if (!ai?.ok) {
    throw new Error(`${role} 的提问失败`);
  }

  return ai.question_to_present;
}

/**
 * 运行完整的规划澄清小会
 */
export async function runPlanningClarificationMeeting({
  tasksDir,
  taskId,
  planning,
  planReview,
  blockingQuestions,
  ask,
  aiDir,
  cwd
}) {
  // 1. 小会启动
  console.log(chalk.cyan("\n📞 规划澄清小会已启动"));
  console.log(chalk.gray("👥 参会者：ProductPlanner, SystemDesigner, SeniorDeveloper, TestPlanner, RiskPlanner"));
  console.log(chalk.gray(`📋 待澄清问题共 ${blockingQuestions.length} 个\n`));

  // 2. 按顺序让每个角色发言
  const roleOrder = [
    "ProductPlanner",
    "SystemDesigner",
    "SeniorDeveloper",
    "TestPlanner",
    "RiskPlanner"
  ];

  const clarificationSoFar = {};
  const previousAiReviews = {};
  let questionIndex = 0;

  for (const role of roleOrder) {
    const roleBlockingQuestions = blockingQuestions.filter(q => q.role === role).map(q => q.text);
    
    if (roleBlockingQuestions.length === 0) {
      console.log(chalk.gray(`  ⊘ ${role} 没有需要澄清的问题\n`));
      continue;
    }

    // 2.1 进行二次判断
    const reviewResult = await reviewClarifyQuestions({
      role,
      originalQuestions: roleBlockingQuestions,
      clarificationSoFar,
      previousAiReviews,
      userBrief: planning.why || "",
      consensusFromR1R2: {},
      prompt: `你是${role}`,
      aiDir,
      cwd
    });

    console.log(reviewResult.displayText);

    // 2.2 按照二次判断的结果，逐个提问
    for (const q of reviewResult.questions) {
      if (q.status === "skip") continue;

      const finalQuestion = q.status === "ask" ? q.original : q.modified;
      
      console.log(chalk.cyan(`\n🎤 ${role}: ${finalQuestion}`));
      
      // 2.3 等待用户回答
      const userAnswer = await ask(chalk.cyan("> "));
      
      // 2.4 记录澄清内容
      questionIndex += 1;
      clarificationSoFar[`Q${questionIndex}`] = finalQuestion;
      clarificationSoFar[`A${questionIndex}`] = userAnswer;
      
      console.log(chalk.green("✅ 已记录\n"));
    }

    // 记录该角色的二次判断结果
    previousAiReviews[role] = {
      reviewed_at: new Date().toISOString(),
      questions_reviewed: reviewResult.questions.length,
      questions_asked: reviewResult.questions.filter(q => q.status !== "skip").length
    };
  }

  // 3. 小会结束
  console.log(chalk.cyan("\n✅ 澄清小会已完成"));
  console.log(chalk.gray(`📝 共澄清 ${questionIndex} 个问题\n`));

  return {
    clarifications: clarificationSoFar,
    meeting_metadata: {
      started_at: new Date().toISOString(),
      participant_reviews: previousAiReviews,
      total_questions_asked: questionIndex
    }
  };
}
```

### 4.2 修改 `src/cli/commands/plan.mjs`

```javascript
// 替换原有的 runClarificationMiniMeeting 调用
import { runPlanningClarificationMeeting } from "../../planning/clarificationMeeting.mjs";

// 在 handlePlanCommand 中
const meetingResult = await runPlanningClarificationMeeting({
  tasksDir,
  taskId,
  planning,
  planReview,
  blockingQuestions: meeting.rounds[0].per_role_verdicts,  // 需要调整格式
  ask,
  aiDir,
  cwd
});
```

---

## 五、新增的 Invoke Roles

需要在 `models.conf` 中注册两个新的 role：

```ini
[model]
; 规划澄清二次判断
profile.default.planning_clarify_review.1 = anthropic:claude-opus
profile.default.planning_clarify_review.2 = openai:gpt-4-turbo

; 规划澄清最终提问
profile.default.planning_clarify_ask.1 = anthropic:claude-opus
profile.default.planning_clarify_ask.2 = openai:gpt-4-turbo
```

---

## 六、用户可见的效果示意

```
📞 规划澄清小会已启动
👥 参会者：ProductPlanner, SystemDesigner, SeniorDeveloper, TestPlanner, RiskPlanner
📋 待澄清问题共 4 个
─────────────────────

🤔 ProductPlanner 正在思考...
  ⚠️ 检查我的问题是否与已澄清的内容重复
  ✅ "系统是否要与现有用户系统绑定？"
     这是我的新问题，需要提出

🎤 ProductPlanner: 系统是否要与现有用户系统绑定？
> 是的，需要。而且要支持 50 万现有用户的平滑迁移。
✅ 已记录

─────────────────────

🤔 SystemDesigner 正在思考...
  ⚠️ 检查我的问题是否与已澄清的内容重复
  ✅ "API 权限是细粒度还是粗粒度？"
     与前面澄清无关，需要提出
  🔄 "数据库选型有什么限制吗？"
     修改为：既然需要绑定 50 万现有用户，现有数据库是否继续使用？
     原问题背景已变化，需要调整

🎤 SystemDesigner: API 权限是细粒度还是粗粒度？
> 细粒度，精确到 API 端点级别。
✅ 已记录

🎤 SystemDesigner: 既然需要绑定 50 万现有用户，现有数据库是否继续使用？
> 先用现有数据库，后期考虑迁移。
✅ 已记录

─────────────────────

⊘ SeniorDeveloper 没有需要澄清的问题

─────────────────────

🤔 TestPlanner 正在思考...
  ⚠️ 检查我的问题是否与已澄清的内容重复
  🔄 "数据迁移是否在 scope 内？"
     修改为：这次权限系统发布中，是否包含现有 50 万用户的数据迁移？
     用户已回答'先用现有数据库'，我需要澄清是否需要迁移任务

🎤 TestPlanner: 这次权限系统发布中，是否包含现有 50 万用户的数据迁移？
> 不包含，我们先完成权限系统，用户数据仍在现有数据库。
✅ 已记录

─────────────────────

⊘ RiskPlanner 没有需要澄清的问题

─────────────────────

✅ 澄清小会已完成
📝 共澄清 3 个问题

[继续进入 Round 3...]
```

---

## 七、核心优势

这个设计方案的优势：

✅ **每个思考都对应一个 invoke** —— 代表真实的 AI 思考过程  
✅ **用户可见的思考过程** —— 打印简短但有意义的推理  
✅ **避免冗余问题** —— 二次判断确保提问的有效性  
✅ **智能问题修改** —— AI 基于前面的澄清调整自己的问题  
✅ **群聊式体验** —— 用户看到"小会进行中"的感觉，而不是"后台黑盒"

