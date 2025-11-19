/**
 * Phase B Schema 扩展
 * 为澄清小会和传声筒机制添加数据结构定义
 *
 * 使用 Zod 进行运行时验证
 */

import { z } from "zod";

// ============================================================================
// ClarificationQuestion Schema - 澄清问题 (必须先定义，被其他Schema使用)
// ============================================================================

export const ClarificationQuestionSchema = z.object({
    questionId: z.string().describe("问题唯一标识"),
    priority: z.enum(["Critical", "High", "Medium", "Low"]).describe("优先级"),
    category: z.enum([
        "blocking",
        "uncertainty",
        "clarity",
        "divergence",
        "commitment",
        "gate"
    ]).describe("问题类别"),
    question: z.string().describe("问题文本"),
    context: z.string().optional().describe("问题背景"),
    details: z.object({
        signal: z.string().describe("触发的信号"),
        relatedRoles: z.array(z.string()).describe("相关的规划角色"),
        expectedAnswerType: z.enum(["text", "binary", "multiselect"]).describe("期望答案类型")
    }).describe("问题细节"),
    status: z.enum(["pending", "answered", "skipped"]).describe("问题状态"),
    answer: z.string().optional().describe("用户答案"),
    answerConfidence: z.number().min(0).max(1).optional().describe("用户答案的信心度")
});

// ============================================================================
// RoleUpdate Schema - 角色更新 (必须在 TelephoneGameResult 之前定义)
// ============================================================================

export const RoleUpdateSchema = z.object({
    role: z.enum([
        "ProductPlanner",
        "SystemDesigner",
        "SeniorDeveloper",
        "TestPlanner",
        "RiskPlanner"
    ]).describe("规划角色"),
    previousStance: z.enum(["agree", "disagree", "mixed", "unknown"]).describe("之前的立场"),
    newStance: z.enum(["agree", "disagree", "mixed"]).describe("新立场"),
    previousConfidence: z.number().min(0).max(1).optional(),
    confidence: z.number().min(0).max(1).describe("新信心度"),
    updatedComments: z.string().describe("更新的评价"),
    blocking_questions: z.array(z.string()).optional().describe("仍有的阻塞问题"),
    reasoning: z.string().optional().describe("推理过程")
});

// ============================================================================
// TelephoneGameResult Schema - 传声筒结果
// ============================================================================

export const TelephoneGameResultSchema = z.object({
    timestamp: z.string().datetime().describe("执行时间"),
    perRoleUpdates: z.array(RoleUpdateSchema).describe("每个角色的更新"),
    newConsensusPoints: z.array(z.string()).describe("达成的新共识点"),
    remainingDivergence: z.array(z.string()).describe("仍有分歧的点"),
    status: z.enum(["in_progress", "completed", "failed"]).describe("状态"),
    error: z.string().optional().describe("如果失败，错误信息"),
    metrics: z.object({
        totalRoles: z.number(),
        agreeCount: z.number(),
        disagreeCount: z.number(),
        mixedCount: z.number(),
        consensusRatio: z.number().min(0).max(1).optional(),
        averageConfidenceImprovement: z.number().optional()
    }).optional().describe("统计指标")
});

// ============================================================================
// ClarificationSession Schema - 澄清会话
// ============================================================================

export const ClarificationSessionSchema = z.object({
    sessionId: z.string().describe("澄清会话唯一标识"),
    taskId: z.string().describe("任务 ID"),
    roundNumber: z.number().int().min(1).max(3).describe("澄清轮次（最多3轮）"),
    status: z.enum([
        "initialized",
        "generating_questions",
        "awaiting_user_input",
        "collecting_feedback",
        "telephone_game",
        "synthesizing",
        "complete"
    ]).describe("会话状态"),
    questions: z.array(ClarificationQuestionSchema).describe("本轮澄清问题列表"),
    userFeedback: z.object({
        answers: z.array(
            z.object({
                questionId: z.string(),
                question: z.string(),
                answer: z.string().or(z.literal("skip")),
                confidence: z.number().min(0).max(1).optional(),
                timestamp: z.string().datetime()
            })
        ).describe("用户的答案"),
        additionalComments: z.string().optional().describe("额外备注")
    }).optional().describe("用户反馈内容"),
    telephoneResult: TelephoneGameResultSchema.optional(),
    signalsDetected: z.array(
        z.enum([
            "blocking_questions",
            "user_uncertainty",
            "requirement_clarity",
            "narrative_divergence",
            "commitment_readiness",
            "readiness_gate"
        ])
    ).describe("本轮检测到的信号"),
    timestamps: z.object({
        created: z.string().datetime(),
        questionsGenerated: z.string().datetime().optional(),
        userFeedbackReceived: z.string().datetime().optional(),
        telephoneCompleted: z.string().datetime().optional(),
        completed: z.string().datetime().optional()
    }).describe("时间戳记录"),
    metadata: z.object({
        durationSeconds: z.number().optional(),
        questionsAccepted: z.number().optional(),
        questionsSkipped: z.number().optional(),
        averageUserConfidence: z.number().min(0).max(1).optional()
    }).optional().describe("会话统计数据")
});

// ============================================================================
// ClarificationSessionHistory Schema - 澄清会话历史
// ============================================================================

export const ClarificationSessionHistorySchema = z.object({
    taskId: z.string().describe("任务 ID"),
    sessions: z.array(ClarificationSessionSchema).describe("所有澄清会话历史"),
    totalRounds: z.number().describe("总澄清轮次"),
    finalStatus: z.enum([
        "not_started",
        "in_progress",
        "clarified",
        "abandoned"
    ]).describe("最终状态"),
    summary: z.object({
        totalQuestionsAsked: z.number(),
        totalQuestionsAnswered: z.number(),
        averageUserConfidence: z.number().min(0).max(1),
        consensusAchieved: z.boolean(),
        consensusPoints: z.array(z.string()),
        remainingConcerns: z.array(z.string())
    }).optional().describe("总结数据"),
    timestamps: z.object({
        started: z.string().datetime(),
        completed: z.string().datetime().optional()
    }).describe("时间戳")
});

// ============================================================================
// UserFeedback Schema - 用户反馈
// ============================================================================

export const UserFeedbackSchema = z.object({
    sessionId: z.string().describe("澄清会话 ID"),
    answers: z.array(
        z.object({
            questionId: z.string(),
            question: z.string(),
            answer: z.string().or(z.literal("skip")),
            confidence: z.number().min(0).max(1).optional(),
            timestamp: z.string().datetime()
        })
    ).describe("用户的答案"),
    additionalComments: z.string().optional().describe("用户补充说明"),
    sessionDuration: z.number().optional().describe("会话耗时（秒）"),
    userSentiment: z.enum(["positive", "neutral", "negative"]).optional().describe("用户态度")
});

// ============================================================================
// SignalDetection Schema - 信号检测
// ============================================================================

export const SignalDetectionSchema = z.object({
    signal: z.enum([
        "blocking_questions",
        "user_uncertainty",
        "requirement_clarity",
        "narrative_divergence",
        "commitment_readiness",
        "readiness_gate"
    ]).describe("信号类型"),
    detected: z.boolean().describe("是否检测到"),
    severity: z.enum(["critical", "high", "medium", "low"]).optional(),
    evidence: z.array(z.string()).describe("证据列表"),
    suggestedQuestions: z.array(z.string()).describe("建议的澄清问题"),
    relatedRoles: z.array(z.string()).optional().describe("相关角色")
});

// ============================================================================
// 验证函数
// ============================================================================

export function validateClarificationSession(data) {
    return ClarificationSessionSchema.safeParse(data);
}

export function validateUserFeedback(data) {
    return UserFeedbackSchema.safeParse(data);
}

export function validateTelephoneGameResult(data) {
    return TelephoneGameResultSchema.safeParse(data);
}

// ============================================================================
// 导出
// ============================================================================

export default {
    ClarificationSessionSchema,
    ClarificationQuestionSchema,
    TelephoneGameResultSchema,
    RoleUpdateSchema,
    ClarificationSessionHistorySchema,
    UserFeedbackSchema,
    SignalDetectionSchema,
    validateClarificationSession,
    validateUserFeedback,
    validateTelephoneGameResult
};
