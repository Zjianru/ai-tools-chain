import { z } from "zod";

export const CodegenPlanFileSchema = z.object({
    path: z.string().min(1, "file path is required"),
    language: z.string().optional(),
    intent: z.string().optional(),
    rationale: z.string().optional(),
    content: z.string().default("")
});

export const CodegenPlanSchema = z.object({
    taskId: z.string().min(1),
    generated_at: z.string().min(1),
    files: z.array(CodegenPlanFileSchema)
});

export const CodegenIRFileSchema = z.object({
    path: z.string().min(1),
    op: z.enum(["create", "modify", "delete"]),
    language: z.string().min(1),
    intent: z.string().optional()
});

export const CodegenIRSchema = z.object({
    taskId: z.string().min(1),
    generated_at: z.string().min(1),
    files: z.array(CodegenIRFileSchema)
});

export const PlanningMeetingVerdictSchema = z.object({
    ok: z.boolean().nullable().default(null),
    confidence: z.number().min(0).max(1).optional(),
    reasons: z.array(z.string()).default([]),
    suggestions: z.array(z.string()).default([]),
    blocking_open_questions: z.array(z.string()).optional()
});

export const PerRoleVerdictsSchema = z.record(PlanningMeetingVerdictSchema);

export const PlanningMeetingRoundSchema = z.object({
    round: z.number().int().min(1),
    at: z.string(),
    input_snapshot: z.record(z.any()).default({}),
    per_role_verdicts: PerRoleVerdictsSchema.optional(),
    clarifications: z
        .array(
            z.object({
                round: z.number().optional(),
                index: z.number().optional(),
                role: z.string().optional(),
                question: z.string().optional(),
                answer: z.string().optional()
            })
        )
        .default([]),
    options: z.array(z.string()).default([]),
    coach_summary: z.string().default(""),
    decision: z.enum(["go", "hold", "redo_planning"])
});

export const PlanningMeetingSchema = z.object({
    taskId: z.string().min(1),
    title: z.string().min(1),
    ok: z.boolean(),
    planning_summary: z.record(z.any()).optional(),
    issues: z.array(z.any()).default([]),
    plan_md_present: z.boolean().default(false),
    rounds: z.array(PlanningMeetingRoundSchema).min(1),
    ai_meeting: z.any().optional()
});

// ============================================================================
// Phase A: Planning Phase Extended Schemas (per user confirmation)
// ============================================================================

/**
 * @typedef {Object} RoundConvergenceHistoryItem
 * @property {number} round - 轮次号
 * @property {'none'|'partial'|'converged'|'need_clarification'} convergence_status
 * @property {number} consensus_coverage - 0~1，按角色加权
 * @property {string[]} signals_detected - 检测到的 6 个信号类型
 * @property {string} summary - 1~2 句人类可读描述
 */
export const RoundConvergenceHistoryItemSchema = z.object({
    round: z.number().int().min(1),
    convergence_status: z.enum(["none", "partial", "converged", "need_clarification"]),
    consensus_coverage: z.number().min(0).max(1),
    signals_detected: z.array(
        z.enum([
            "blocking_questions",
            "no_new_info",
            "requirement_clarity",
            "narrative_divergence",
            "commitment_readiness",
            "user_uncertainty"
        ])
    ),
    summary: z.string()
});

/**
 * @typedef {Object} IssueEncountered
 * @property {string} id - 问题标识符
 * @property {string} signal_type - 对应的 6 个信号类型
 * @property {'critical'|'high'|'medium'|'low'} severity
 * @property {string} [from_role] - 哪个 AI 角色提出的
 * @property {number[]} [related_rounds] - 问题出现在哪些轮次
 * @property {'open'|'clarifying'|'resolved'|'wont_fix'} status - 问题的当前状态
 * @property {string} description
 * @property {string} [suggestion] - 处理建议
 */
export const IssueEncounteredSchema = z.object({
    id: z.string(),
    signal_type: z.enum([
        "blocking_questions",
        "no_new_info",
        "requirement_clarity",
        "narrative_divergence",
        "commitment_readiness",
        "user_uncertainty"
    ]),
    severity: z.enum(["critical", "high", "medium", "low"]),
    from_role: z.string().optional(),
    related_rounds: z.array(z.number().int().min(1)).optional(),
    status: z.enum(["open", "clarifying", "resolved", "wont_fix"]),
    description: z.string(),
    suggestion: z.string().optional()
});

/**
 * @typedef {Object} DraftInfoArtifactsPaths
 * @property {Object.<string, string>} [round_summaries] - Round 文件路径映射
 * @property {string[]} [clarification_sessions] - 澄清小会记录路径
 */
export const DraftInfoArtifactsPathsSchema = z.object({
    round_summaries: z.record(z.string()).optional(),
    clarification_sessions: z.array(z.string()).optional()
});

/**
 * @typedef {Object} DraftInfo
 * @property {'draft'|'finalized'|'superseded'} status - 规划的当前状态
 * @property {'converged'|'max_rounds_reached'|'awaiting_clarification'|'user_override'|'aborted'} reason
 * @property {'go'|'hold'|'clarify'|'redo_planning'} decision - Coach 的决策
 * @property {number} rounds_completed
 * @property {RoundConvergenceHistoryItem[]} [round_convergence_history]
 * @property {IssueEncountered[]} [issues_encountered]
 * @property {DraftInfoArtifactsPaths} [artifacts_paths]
 */
export const DraftInfoSchema = z.object({
    status: z.enum(["draft", "finalized", "superseded"]),
    reason: z.enum(["converged", "max_rounds_reached", "awaiting_clarification", "user_override", "aborted"]),
    decision: z.enum(["go", "hold", "clarify", "redo_planning"]),
    rounds_completed: z.number().int().min(1),
    round_convergence_history: z.array(RoundConvergenceHistoryItemSchema).optional(),
    issues_encountered: z.array(IssueEncounteredSchema).optional(),
    artifacts_paths: DraftInfoArtifactsPathsSchema.optional()
});

/**
 * @typedef {Object} RoleSnapshot
 * @property {string} role - AI 角色名
 * @property {'agree'|'disagree'|'mixed'} stance
 * @property {number} confidence - 0~1
 * @property {string[]} [key_concerns]
 */
export const RoleSnapshotSchema = z.object({
    role: z.string(),
    stance: z.enum(["agree", "disagree", "mixed"]),
    confidence: z.number().min(0).max(1),
    key_concerns: z.array(z.string()).optional()
});

/**
 * @typedef {Object} RoundSummaryRound1
 * @property {number} round - 1
 * @property {string} timestamp - ISO 8601
 * @property {string[]} consensus_points
 * @property {string[]} divergence_points
 * @property {string[]} key_assumptions
 * @property {string[]} pending_clarifications
 * @property {RoleSnapshot[]} per_role_snapshot
 * @property {string[]} signals_detected
 */
export const RoundSummaryRound1Schema = z.object({
    round: z.literal(1),
    timestamp: z.string(),
    consensus_points: z.array(z.string()),
    divergence_points: z.array(z.string()),
    key_assumptions: z.array(z.string()),
    pending_clarifications: z.array(z.string()),
    per_role_snapshot: z.array(RoleSnapshotSchema),
    signals_detected: z.array(z.string())
});

/**
 * @typedef {Object} RoundSummaryRound2
 * @property {number} round - 2
 * @property {string} timestamp - ISO 8601
 * @property {boolean} previous_round_consensus_still_valid
 * @property {string[]} new_consensus_gained
 * @property {string[]} remaining_divergence
 * @property {string[]} new_blocking_questions
 * @property {RoleSnapshot[]} per_role_snapshot
 * @property {string[]} signals_detected
 * @property {'partial'|'converged'|'need_clarification'} overall_convergence_status
 * @property {string} coach_decision_summary - 自然语言版决策
 * @property {'go_to_codegen'|'trigger_clarification_session'|'hold'} next_action
 */
export const RoundSummaryRound2Schema = z.object({
    round: z.literal(2),
    timestamp: z.string(),
    previous_round_consensus_still_valid: z.boolean(),
    new_consensus_gained: z.array(z.string()),
    remaining_divergence: z.array(z.string()),
    new_blocking_questions: z.array(z.string()),
    per_role_snapshot: z.array(RoleSnapshotSchema),
    signals_detected: z.array(z.string()),
    overall_convergence_status: z.enum(["partial", "converged", "need_clarification"]),
    coach_decision_summary: z.string(),
    next_action: z.enum(["go_to_codegen", "trigger_clarification_session", "hold"])
});

/**
 * @typedef {RoundSummaryRound1|RoundSummaryRound2} RoundSummary
 */
export const RoundSummarySchema = z.union([
    RoundSummaryRound1Schema,
    RoundSummaryRound2Schema
]);

/**
 * @typedef {Object} Signal
 * @property {string} type - 6 个信号类型之一
 * @property {'critical'|'high'|'medium'|'low'} severity
 * @property {string} [from_role]
 * @property {string} description
 * @property {any} [evidence] - 指向原始数据的引用
 */
export const SignalSchema = z.object({
    type: z.enum([
        "blocking_questions",
        "no_new_info",
        "requirement_clarity",
        "narrative_divergence",
        "commitment_readiness",
        "user_uncertainty"
    ]),
    severity: z.enum(["critical", "high", "medium", "low"]),
    from_role: z.string().optional(),
    description: z.string(),
    evidence: z.any().optional()
});

/**
 * @typedef {Object} ConsensusEvalContext
 * @property {number} round - 当前轮次
 * @property {Array} perRoleVerdicts - 每个角色的评判
 * @property {Object} userBrief - 用户输入
 * @property {RoundSummary[]} [roundSummaries] - 历史总结
 * @property {DraftInfo} [previousDraftInfo] - 前一个 draft_info
 */
export const ConsensusEvalContextSchema = z.object({
    round: z.number().int().min(1),
    perRoleVerdicts: z.array(
        z.object({
            role: z.string(),
            ok: z.boolean(),
            confidence: z.number().min(0).max(1),
            comments: z.string().optional(),
            blocking_open_questions: z.array(z.string()).optional()
        })
    ),
    userBrief: z.object({
        text: z.string(),
        flags: z.array(z.string()).optional()
    }),
    roundSummaries: z.array(RoundSummarySchema).optional(),
    previousDraftInfo: DraftInfoSchema.optional()
});

/**
 * @typedef {Object} EvaluateMetrics
 * @property {number} consensus_coverage - 共识覆盖度
 * @property {number} avg_confidence - 平均信心度
 * @property {string[]} roles_blocking - 阻塞的角色列表
 */
export const EvaluateMetricsSchema = z.object({
    consensus_coverage: z.number().min(0).max(1),
    avg_confidence: z.number().min(0).max(1),
    roles_blocking: z.array(z.string())
});

/**
 * @typedef {Object} EvaluateResult
 * @property {'go'|'hold'|'clarify'|'redo_planning'} decision - Coach 最终决策
 * @property {string} convergence_status
 * @property {Signal[]} signals_detected
 * @property {string} reason_summary
 * @property {IssueEncountered[]} blocking_issues
 * @property {EvaluateMetrics} [metrics]
 * @property {Partial<DraftInfo>} [draft_info_updates] - 状态更新
 */
export const EvaluateResultSchema = z.object({
    decision: z.enum(["go", "hold", "clarify", "redo_planning"]),
    convergence_status: z.enum(["none", "partial", "converged", "need_clarification"]),
    signals_detected: z.array(SignalSchema),
    reason_summary: z.string(),
    blocking_issues: z.array(IssueEncounteredSchema),
    metrics: EvaluateMetricsSchema.optional(),
    draft_info_updates: DraftInfoSchema.partial().optional()
});

/**
 * @typedef {Object} PlanningMeetingExtended
 * @property {string} taskId
 * @property {RoundSummary[]} round_summaries - 所有轮次的总结
 * @property {Object} [per_role_verdicts]
 * @property {string} [coach_decision]
 * @property {Object} [final_convergence_assessment]
 */
export const PlanningMeetingExtendedSchema = z.object({
    taskId: z.string(),
    round_summaries: z.array(RoundSummarySchema),
    per_role_verdicts: z.record(z.any()).optional(),
    coach_decision: z.enum(["go", "hold", "clarify", "redo_planning"]).optional(),
    final_convergence_assessment: z.object({
        status: z.enum(["none", "partial", "converged", "need_clarification"]),
        coverage: z.number().min(0).max(1),
        timestamp: z.string()
    }).optional()
});

// Export all Phase A schemas together
export const PhaseASchemas = {
    DraftInfo: DraftInfoSchema,
    RoundConvergenceHistoryItem: RoundConvergenceHistoryItemSchema,
    IssueEncountered: IssueEncounteredSchema,
    RoleSnapshot: RoleSnapshotSchema,
    RoundSummary: RoundSummarySchema,
    Signal: SignalSchema,
    ConsensusEvalContext: ConsensusEvalContextSchema,
    EvaluateResult: EvaluateResultSchema,
    EvaluateMetrics: EvaluateMetricsSchema,
    PlanningMeetingExtended: PlanningMeetingExtendedSchema
};
