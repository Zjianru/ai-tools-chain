/**
 * Consensus Strategy - 6 Signal Detection & Clarification Meeting Triggers
 * Phase A Implementation
 *
 * 基于行业最佳实践的澄清小会触发规则：
 * 1. 信息缺口直接阻塞 (Kanban 流程原则)
 * 2. 讨论进入循环 (Scrum.org + Lyssa Adkins)
 * 3. 需求解释不清 (Mike Cohn 规则)
 * 4. 方向分歧 (Jeff Patton)
 * 5. 承诺缺失 (Scrum Ready)
 * 6. 用户明确不确定 (Scrum PO 原则)
 */

/**
 * @typedef {Object} SignalDetectionResult
 * @property {boolean} triggered - 信号是否被触发
 * @property {string} reason - 触发原因（自然语言）
 * @property {*} evidence - 支撑证据
 * @property {'critical'|'high'|'medium'|'low'} severity
 */

/**
 * 信号 1：信息缺口直接阻塞
 * Kanban 流程原则 - 如果一条道路被阻塞，必须立即处理
 *
 * @param {import('../core/schemas.mjs').ConsensusEvalContext} ctx
 * @returns {SignalDetectionResult}
 */
export function detectBlockingQuestions(ctx) {
    const blockingQuestions = [];
    const affectedRoles = new Set();

    for (const verdict of ctx.perRoleVerdicts) {
        const questions = verdict.blocking_open_questions || [];
        if (questions.length > 0) {
            blockingQuestions.push(...questions);
            affectedRoles.add(verdict.role);
        }
    }

    if (blockingQuestions.length === 0) {
        return {
            triggered: false,
            reason: "无阻塞性问题"
        };
    }

    return {
        triggered: true,
        reason:
            `检测到 ${blockingQuestions.length} 个阻塞性问题，影响 ${affectedRoles.size} 个角色。` +
            `这些问题阻止了团队前进（Kanban 原则）。`,
        evidence: {
            total_count: blockingQuestions.length,
            affected_roles: Array.from(affectedRoles),
            questions: blockingQuestions
        },
        severity: "critical"
    };
}

/**
 * 信号 2：讨论进入循环
 * Scrum.org + Lyssa Adkins - 如果讨论没有产生新信息，说明可能在循环
 *
 * @param {import('../core/schemas.mjs').ConsensusEvalContext} ctx
 * @returns {SignalDetectionResult}
 */
export function detectNoNewInfo(ctx) {
    if (ctx.round < 2) {
        return {
            triggered: false,
            reason: "还在第一轮，无法判断是否循环"
        };
    }

    const roundSummaries = ctx.roundSummaries || [];
    if (roundSummaries.length < 2) {
        return {
            triggered: false,
            reason: "缺少完整的轮次总结数据"
        };
    }

    const round1 = roundSummaries[0];
    const round2 = roundSummaries[1];

    // 指标：是否有新共识，是否还有分歧
    const consensusInRound1 = round1.consensus_points?.length || 0;
    const divergenceInRound1 = round1.divergence_points?.length || 0;

    const newConsensusInRound2 = round2.new_consensus_gained?.length || 0;
    const remainingDivergence = round2.remaining_divergence?.length || 0;

    // 判断循环：没有新共识但仍有未解决的分歧
    const isLooping = newConsensusInRound2 === 0 && remainingDivergence > 0;

    if (!isLooping) {
        return {
            triggered: false,
            reason: `Round 2 有新进展：新共识 ${newConsensusInRound2} 项`
        };
    }

    return {
        triggered: true,
        reason:
            `讨论陷入循环：Round 1 有 ${divergenceInRound1} 个分歧点，` +
            `到了 Round 2 仍未增加新共识，仍有 ${remainingDivergence} 个分歧点未解决。` +
            `这表明内部讨论已无法推进（Scrum.org）。`,
        evidence: {
            round1_divergence_count: divergenceInRound1,
            round2_new_consensus_count: newConsensusInRound2,
            round2_remaining_divergence_count: remainingDivergence,
            round2_convergence_status: round2.overall_convergence_status
        },
        severity: "high"
    };
}

/**
 * 信号 3：需求解释不清
 * Mike Cohn 规则 - 如果 30 秒内无法清楚说明，就需要澄清
 * 在我们的上下文中，看是否有待澄清的需求点
 *
 * @param {import('../core/schemas.mjs').ConsensusEvalContext} ctx
 * @returns {SignalDetectionResult}
 */
export function detectRequirementClarity(ctx) {
    const roundSummaries = ctx.roundSummaries || [];
    const pendingClarifications = [];

    for (const summary of roundSummaries) {
        const pending = summary.pending_clarifications || [];
        pendingClarifications.push(...pending);
    }

    // 去重
    const uniqueClarifications = Array.from(new Set(pendingClarifications));

    if (uniqueClarifications.length === 0) {
        return {
            triggered: false,
            reason: "所有需求点都已澄清"
        };
    }

    const severity = uniqueClarifications.length > 3 ? "high" : "medium";

    return {
        triggered: true,
        reason:
            `检测到 ${uniqueClarifications.length} 个待澄清的需求点。` +
            `这些点无法通过内部讨论确定，需要用户的直接输入（Mike Cohn）。`,
        evidence: {
            total_count: uniqueClarifications.length,
            clarifications: uniqueClarifications
        },
        severity
    };
}

/**
 * 信号 4：方向分歧
 * Jeff Patton - 如果两个角色的逻辑方向相反（而非补充），需要澄清用户需求来调和
 *
 * @param {import('../core/schemas.mjs').ConsensusEvalContext} ctx
 * @returns {SignalDetectionResult}
 */
export function detectNarrativeDivergence(ctx) {
    const disagreingRoles = ctx.perRoleVerdicts.filter(v => !v.ok);

    if (disagreingRoles.length === 0) {
        return {
            triggered: false,
            reason: "所有角色都同意或接受当前方向"
        };
    }

    const rolesInfo = disagreingRoles.map(
        r => `${r.role}(信心度: ${(r.confidence * 100).toFixed(0)}%): ${r.comments || "无具体意见"}`
    );

    const severity = disagreingRoles.length > 2 ? "high" : "medium";

    return {
        triggered: true,
        reason:
            `检测到 ${disagreingRoles.length} 个角色持有不同的立场。` +
            `这种分歧需要通过澄清用户的真实需求来调和（Jeff Patton）。`,
        evidence: {
            total_disagreeing_roles: disagreingRoles.length,
            roles: rolesInfo
        },
        severity
    };
}

/**
 * 信号 5：承诺缺失
 * Scrum Ready - 如果关键角色无法承诺或信心度不足，需要通过澄清降低风险
 *
 * @param {import('../core/schemas.mjs').ConsensusEvalContext} ctx
 * @param {number} [confidenceThreshold=0.6]
 * @returns {SignalDetectionResult}
 */
export function detectCommitmentReadiness(ctx, confidenceThreshold = 0.6) {
    const lowConfidenceRoles = ctx.perRoleVerdicts.filter(
        v => v.confidence < confidenceThreshold || !v.ok
    );

    if (lowConfidenceRoles.length === 0) {
        return {
            triggered: false,
            reason: `所有角色信心度都 >= ${(confidenceThreshold * 100).toFixed(0)}%`
        };
    }

    const rolesInfo = lowConfidenceRoles.map(
        r => `${r.role}(信心度: ${(r.confidence * 100).toFixed(0)}%)`
    ).join(", ");

    const severity = lowConfidenceRoles.length > 2 ? "high" : "medium";

    return {
        triggered: true,
        reason:
            `检测到 ${lowConfidenceRoles.length} 个角色信心度不足或无法承诺：${rolesInfo}。` +
            `这些角色的顾虑需要通过澄清小会来降低（Scrum Ready）。`,
        evidence: {
            total_low_confidence_roles: lowConfidenceRoles.length,
            roles: rolesInfo,
            roles_detail: lowConfidenceRoles.map(r => ({
                role: r.role,
                confidence: r.confidence,
                ok: r.ok,
                concerns: r.comments
            }))
        },
        severity
    };
}

/**
 * 信号 6：用户明确不确定
 * Scrum PO 原则 - 如果用户明确表示不确定，必须通过澄清小会交互
 *
 * @param {import('../core/schemas.mjs').ConsensusEvalContext} ctx
 * @returns {SignalDetectionResult}
 */
export function detectUserUncertainty(ctx) {
    const flags = ctx.userBrief?.flags || [];
    const uncertaintyKeywords = ["uncertain", "unclear", "unsure", "ambiguous"];

    const hasUncertainty = uncertaintyKeywords.some(kw => flags.includes(kw));

    if (!hasUncertainty) {
        return {
            triggered: false,
            reason: "用户在需求上表现出清晰和确定"
        };
    }

    return {
        triggered: true,
        reason:
            `用户在需求定义上明确表示不确定（flags: ${flags.join(", ")}）。` +
            `这要求必须通过澄清小会与用户交互来明确需求方向（Scrum PO 原则）。`,
        evidence: {
            uncertainty_flags: flags,
            user_brief: ctx.userBrief.text.substring(0, 100) + "..."
        },
        severity: "high"
    };
}

/**
 * 综合判断：是否需要触发澄清小会
 *
 * 触发条件（任一）：
 * - 任何 critical 信号
 * - 2 个及以上 high 信号
 * - 用户明确不确定 + 其他任何信号
 *
 * @param {SignalDetectionResult[]} signals
 * @returns {Object} { shouldTrigger: boolean, reason: string }
 */
export function shouldTriggerClarificationMeeting(signals) {
    // 统计严重程度
    const bySeverity = {};
    for (const signal of signals) {
        if (!bySeverity[signal.severity]) {
            bySeverity[signal.severity] = [];
        }
        bySeverity[signal.severity].push(signal);
    }

    // 规则 1：任何 critical 信号
    if (bySeverity.critical && bySeverity.critical.length > 0) {
        return {
            shouldTrigger: true,
            reason: `存在 ${bySeverity.critical.length} 个 critical 级别信号：${bySeverity.critical.map(s => s.reason).join("; ")}`
        };
    }

    // 规则 2：2 个及以上 high 信号
    if (bySeverity.high && bySeverity.high.length >= 2) {
        return {
            shouldTrigger: true,
            reason: `存在 ${bySeverity.high.length} 个 high 级别信号，风险较大`
        };
    }

    // 规则 3：用户明确不确定 + 其他任何信号
    const userUncertainty = signals.find(s => s.evidence?.uncertainty_flags);
    if (userUncertainty && signals.length > 1) {
        return {
            shouldTrigger: true,
            reason: "用户明确不确定，需要澄清小会"
        };
    }

    return {
        shouldTrigger: false,
        reason: "信号强度不足，可继续讨论或进入代码生成"
    };
}

/**
 * 一键检测所有 6 个信号
 *
 * @param {import('../core/schemas.mjs').ConsensusEvalContext} ctx
 * @param {Object} [options]
 * @param {number} [options.confidenceThreshold=0.6]
 * @returns {Object} { signals: SignalDetectionResult[], shouldTrigger: boolean, summary: string }
 */
export function detectAllSignals(ctx, options = {}) {
    const confidenceThreshold = options.confidenceThreshold ?? 0.6;

    const signals = [
        detectBlockingQuestions(ctx),
        detectNoNewInfo(ctx),
        detectRequirementClarity(ctx),
        detectNarrativeDivergence(ctx),
        detectCommitmentReadiness(ctx, confidenceThreshold),
        detectUserUncertainty(ctx)
    ];

    const triggeredSignals = signals.filter(s => s.triggered);
    const triggerDecision = shouldTriggerClarificationMeeting(triggeredSignals);

    return {
        signals,
        triggered_signals: triggeredSignals,
        should_trigger_clarification: triggerDecision.shouldTrigger,
        trigger_reason: triggerDecision.reason,
        summary: `检测到 ${triggeredSignals.length} 个触发的信号，${triggerDecision.shouldTrigger ? "建议" : "不建议"}触发澄清小会`
    };
}

export default {
    detectBlockingQuestions,
    detectNoNewInfo,
    detectRequirementClarity,
    detectNarrativeDivergence,
    detectCommitmentReadiness,
    detectUserUncertainty,
    shouldTriggerClarificationMeeting,
    detectAllSignals
};
