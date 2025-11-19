/**
 * CoachOrchestrator - Planning Phase Consensus Decision Engine
 * Phase A Implementation
 *
 * 职责：
 * - 检测 6 个澄清小会触发信号
 * - 计算共识覆盖度与平均信心度
 * - 做出"go" / "hold" / "clarify" / "redo_planning" 的决策
 * - 生成报告所需的决策摘要与建议
 *
 * 基于行业最佳实践：Scrum.org、Agile Coaching Institute、敏捷教练实战
 */

import { EvaluateResultSchema, SignalSchema } from "../core/schemas.mjs";

/**
 * CoachOrchestrator 类
 *
 * 用法：
 *   const coach = new CoachOrchestrator();
 *   const result = await coach.evaluateConsensus(ctx);
 */
export class CoachOrchestrator {
    constructor(options = {}) {
        // 可配置的阈值
        this.consensusCoverageThreshold = options.consensusCoverageThreshold ?? 0.75; // 75%
        this.confidenceThreshold = options.confidenceThreshold ?? 0.6;
        this.maxRoundsBeforeClarify = options.maxRoundsBeforeClarify ?? 2;
    }

    /**
     * 主入口：评估当前共识状态
     *
     * @param {import('../core/schemas.mjs').ConsensusEvalContext} ctx
     * @returns {Promise<import('../core/schemas.mjs').EvaluateResult>}
     */
    async evaluateConsensus(ctx) {
        const signals = [];
        const issues = [];

        // 1. 检测 6 个信号
        this._detectBlockingQuestions(ctx, signals, issues);
        this._detectNoNewInfo(ctx, signals, issues);
        this._detectRequirementClarity(ctx, signals, issues);
        this._detectNarrativeDivergence(ctx, signals, issues);
        this._detectCommitmentReadiness(ctx, signals, issues);
        this._detectUserUncertainty(ctx, signals, issues);

        // 2. 计算指标
        const metrics = this._computeMetrics(ctx, signals);

        // 3. 做出决策
        const decision = this._makeDecision(
            ctx,
            signals,
            issues,
            metrics
        );

        // 4. 生成摘要
        const reason_summary = this._generateReasonSummary(
            decision,
            signals,
            metrics
        );

        // 5. 准备 draft_info 更新
        const draft_info_updates = this._prepareDraftInfoUpdates(
            ctx,
            decision,
            signals,
            issues,
            metrics
        );

        return {
            decision,
            convergence_status: this._mapDecisionToConvergenceStatus(decision),
            signals_detected: signals,
            reason_summary,
            blocking_issues: issues.filter(i => i.severity === "critical" || i.severity === "high"),
            metrics,
            draft_info_updates
        };
    }

    // ========================================================================
    // 6 个信号检测
    // ========================================================================

    /**
     * 信号 1：信息缺口直接阻塞 (Kanban 流程原则)
     * 检查是否存在 blocking_open_questions
     */
    _detectBlockingQuestions(ctx, signals, issues) {
        const blockingQuestions = [];

        for (const verdict of ctx.perRoleVerdicts) {
            if (verdict.blocking_open_questions?.length > 0) {
                blockingQuestions.push(...verdict.blocking_open_questions);
            }
        }

        if (blockingQuestions.length > 0) {
            signals.push({
                type: "blocking_questions",
                severity: "critical",
                description: `${blockingQuestions.length} 个未解答的阻塞性问题`,
                evidence: blockingQuestions
            });

            issues.push({
                id: `issue-blocking-${Date.now()}`,
                signal_type: "blocking_questions",
                severity: "critical",
                status: "open",
                description: `发现 ${blockingQuestions.length} 个未解答的阻塞性问题：\n${blockingQuestions.map(q => `- ${q}`).join("\n")}`,
                suggestion: "需要立即通过澄清小会与用户确认这些关键问题"
            });
        }
    }

    /**
     * 信号 2：讨论进入循环 (Scrum.org + Lyssa Adkins)
     * Round 1→2 无新信息表示可能在循环讨论
     */
    _detectNoNewInfo(ctx, signals, issues) {
        if (ctx.round < 2) return;

        const roundSummaries = ctx.roundSummaries || [];
        if (roundSummaries.length < 2) return;

        const round1 = roundSummaries[0];
        const round2 = roundSummaries[1];

        // 判断是否新增了共识点
        const consensusGained = round2.new_consensus_gained?.length > 0;
        const newDivergence = round2.remaining_divergence?.length > 0;

        // 如果没有新共识但仍有分歧，判定为循环
        if (!consensusGained && newDivergence) {
            signals.push({
                type: "no_new_info",
                severity: "high",
                description: "Round 1→2 讨论未产生新共识，可能陷入循环",
                evidence: {
                    round1_divergence: round1.divergence_points?.length,
                    round2_remaining_divergence: newDivergence.length
                }
            });

            issues.push({
                id: `issue-loop-${Date.now()}`,
                signal_type: "no_new_info",
                severity: "high",
                related_rounds: [1, 2],
                status: "open",
                description: "第 2 轮讨论未产生新共识且仍有分歧，团队可能在循环讨论同样的话题",
                suggestion: "建议通过澄清小会改变讨论角度或引入用户的优先级指导"
            });
        }
    }

    /**
     * 信号 3：需求解释不清 (Mike Cohn 规则)
     * 检查是否存在 pending_clarifications
     */
    _detectRequirementClarity(ctx, signals, issues) {
        const roundSummaries = ctx.roundSummaries || [];
        let pendingClarifications = [];

        for (const summary of roundSummaries) {
            pendingClarifications.push(...(summary.pending_clarifications || []));
        }

        if (pendingClarifications.length > 0) {
            signals.push({
                type: "requirement_clarity",
                severity: pendingClarifications.length > 3 ? "high" : "medium",
                description: `存在 ${pendingClarifications.length} 个待澄清的需求点`,
                evidence: pendingClarifications
            });

            issues.push({
                id: `issue-clarity-${Date.now()}`,
                signal_type: "requirement_clarity",
                severity: pendingClarifications.length > 3 ? "high" : "medium",
                status: "open",
                description: `有 ${pendingClarifications.length} 个待澄清的需求点无法在内部讨论中解决`,
                suggestion: "需要与用户进行澄清小会来确认这些需求点"
            });
        }
    }

    /**
     * 信号 4：方向分歧 (Jeff Patton)
     * 检查是否有角色 stance 为 "disagree" 或 "mixed" 且无法调和
     */
    _detectNarrativeDivergence(ctx, signals, issues) {
        const disagreingRoles = ctx.perRoleVerdicts.filter(v => !v.ok);

        if (disagreingRoles.length > 0) {
            // 只有当有明确的不同意时才标记为分歧
            const narratives = disagreingRoles.map(r => `${r.role}: ${r.comments || "无意见"}`);

            signals.push({
                type: "narrative_divergence",
                severity: disagreingRoles.length > 2 ? "high" : "medium",
                description: `${disagreingRoles.length} 个角色持有不同或混合立场`,
                evidence: narratives
            });

            issues.push({
                id: `issue-divergence-${Date.now()}`,
                signal_type: "narrative_divergence",
                severity: disagreingRoles.length > 2 ? "high" : "medium",
                status: "open",
                description: `角色方向分歧：${narratives.join("; ")}`,
                suggestion: "需要澄清用户的真实需求来调和这些分歧"
            });
        }
    }

    /**
     * 信号 5：承诺缺失 (Scrum Ready)
     * 检查任何角色 confidence < 0.6 或 ok = false
     */
    _detectCommitmentReadiness(ctx, signals, issues) {
        const lowConfidenceRoles = ctx.perRoleVerdicts.filter(
            v => v.confidence < 0.6 || !v.ok
        );

        if (lowConfidenceRoles.length > 0) {
            const rolesInfo = lowConfidenceRoles.map(
                r => `${r.role}(信心度: ${(r.confidence * 100).toFixed(0)}%)`
            ).join(", ");

            signals.push({
                type: "commitment_readiness",
                severity: "medium",
                description: `${lowConfidenceRoles.length} 个角色信心度不足或无法承诺`,
                evidence: rolesInfo
            });

            issues.push({
                id: `issue-commitment-${Date.now()}`,
                signal_type: "commitment_readiness",
                severity: "medium",
                status: "open",
                description: `以下角色无法承诺或信心度不足：${rolesInfo}`,
                suggestion: "通过澄清小会降低这些角色的风险或明确它们的顾虑"
            });
        }
    }

    /**
     * 信号 6：用户明确不确定 (Scrum PO 原则)
     * 检查 userBrief 中的 flags
     */
    _detectUserUncertainty(ctx, signals, issues) {
        const uncertaintyFlags = ctx.userBrief?.flags || [];

        if (uncertaintyFlags.includes("uncertain") || uncertaintyFlags.includes("unclear")) {
            signals.push({
                type: "user_uncertainty",
                severity: "high",
                description: "用户在需求上明确表示不确定",
                evidence: uncertaintyFlags
            });

            issues.push({
                id: `issue-user-uncertain-${Date.now()}`,
                signal_type: "user_uncertainty",
                severity: "high",
                status: "open",
                description: "用户在需求定义上存在不确定性",
                suggestion: "必须通过澄清小会与用户交互，明确需求方向"
            });
        }
    }

    // ========================================================================
    // 指标计算
    // ========================================================================

    /**
     * 计算共识覆盖度、平均信心度、阻塞角色列表
     */
    _computeMetrics(ctx, signals) {
        const verdicts = ctx.perRoleVerdicts;

        // 共识覆盖度：ok=true && confidence>=0.6 的角色比例
        const consensusRoles = verdicts.filter(v => v.ok && v.confidence >= this.confidenceThreshold);
        const consensus_coverage = verdicts.length > 0
            ? consensusRoles.length / verdicts.length
            : 0;

        // 平均信心度
        const avg_confidence = verdicts.length > 0
            ? verdicts.reduce((sum, v) => sum + v.confidence, 0) / verdicts.length
            : 0;

        // 阻塞角色列表
        const roles_blocking = verdicts
            .filter(v => !v.ok || v.confidence < this.confidenceThreshold)
            .map(v => v.role);

        return {
            consensus_coverage,
            avg_confidence,
            roles_blocking
        };
    }

    // ========================================================================
    // 决策逻辑
    // ========================================================================

    /**
     * 根据信号和指标做出决策
     *
     * 决策规则：
     * - critical 信号 → "clarify"
     * - 共识覆盖度 >= 阈值 && 无 high+ 信号 → "go"
     * - 达到最大轮数 && 未收敛 → "hold"（用户决定）
     * - 其他 → "hold"（需要澄清）
     */
    _makeDecision(ctx, signals, issues, metrics) {
        // 优先级 1：存在 critical 信号
        const criticalSignals = signals.filter(s => s.severity === "critical");
        if (criticalSignals.length > 0) {
            return "clarify";
        }

        // 优先级 2：完全共识且无高风险信号
        const highSignals = signals.filter(s => s.severity === "high");
        if (
            metrics.consensus_coverage >= this.consensusCoverageThreshold &&
            highSignals.length === 0
        ) {
            return "go";
        }

        // 优先级 3：达到最大轮数
        if (ctx.round >= this.maxRoundsBeforeClarify) {
            // 如果有足够共识可以 hold（用户决定）
            if (metrics.consensus_coverage >= 0.5) {
                return "hold";
            }
            // 否则建议重新规划
            return "redo_planning";
        }

        // 默认：hold（需要澄清或继续讨论）
        return "hold";
    }

    /**
     * 将决策映射到收敛状态
     */
    _mapDecisionToConvergenceStatus(decision) {
        const mapping = {
            "go": "converged",
            "hold": "partial",
            "clarify": "need_clarification",
            "redo_planning": "none"
        };
        return mapping[decision] || "partial";
    }

    // ========================================================================
    // 生成人类可读的决策摘要
    // ========================================================================

    /**
     * 生成"为什么是这个决策"的自然语言摘要
     */
    _generateReasonSummary(decision, signals, metrics) {
        const parts = [];
        const consensusPercent = (metrics.consensus_coverage * 100).toFixed(0);
        const confidentPercent = (metrics.avg_confidence * 100).toFixed(0);

        // 共识状态
        parts.push(
            `当前共识覆盖度 ${consensusPercent}%（${metrics.roles_blocking.length} 个角色未达成共识），` +
            `平均信心度 ${confidentPercent}%。`
        );

        // 检测到的信号
        if (signals.length > 0) {
            const signalSummary = signals
                .map(s => `${this._getSignalName(s.type)}(${s.severity})`)
                .join("、");
            parts.push(`检测到信号：${signalSummary}。`);
        } else {
            parts.push("未检测到重大阻塞信号。");
        }

        // 决策理由
        switch (decision) {
            case "go":
                parts.push(
                    "各角色已达成充分共识，可以进入代码生成阶段。"
                );
                break;
            case "hold":
                parts.push(
                    "虽然共识度不足，但需要澄清用户需求或继续讨论以获得更多信息。" +
                    "建议与用户进行澄清小会或继续内部讨论。"
                );
                break;
            case "clarify":
                parts.push(
                    "存在关键的阻塞性信息缺口或需求不确定性，" +
                    "必须通过澄清小会与用户交互来解决。"
                );
                break;
            case "redo_planning":
                parts.push(
                    "经过多轮讨论仍未收敛且共识度较低，" +
                    "建议返回规划开始重新讨论，可能需要重新理解需求。"
                );
                break;
        }

        return parts.join(" ");
    }

    /**
     * 将信号类型转换为人类可读的名称
     */
    _getSignalName(signalType) {
        const names = {
            "blocking_questions": "信息缺口",
            "no_new_info": "讨论循环",
            "requirement_clarity": "需求不清",
            "narrative_divergence": "方向分歧",
            "commitment_readiness": "承诺缺失",
            "user_uncertainty": "用户不确定"
        };
        return names[signalType] || signalType;
    }

    // ========================================================================
    // 准备 draft_info 更新
    // ========================================================================

    /**
     * 生成 draft_info 的状态更新
     */
    _prepareDraftInfoUpdates(ctx, decision, signals, issues, metrics) {
        const currentStatus = ctx.previousDraftInfo?.status || "draft";
        const currentRounds = ctx.previousDraftInfo?.rounds_completed || 0;

        // 决定新的状态
        let newStatus = "draft";
        let newReason = "max_rounds_reached";

        if (decision === "go") {
            newStatus = "finalized";
            newReason = "converged";
        } else if (decision === "clarify") {
            newStatus = "draft";
            newReason = "awaiting_clarification";
        } else if (decision === "redo_planning") {
            newStatus = "draft";
            newReason = "max_rounds_reached";
        }

        return {
            status: newStatus,
            reason: newReason,
            decision,
            rounds_completed: ctx.round,
            round_convergence_history: [
                ...(ctx.previousDraftInfo?.round_convergence_history || []),
                {
                    round: ctx.round,
                    convergence_status: this._mapDecisionToConvergenceStatus(decision),
                    consensus_coverage: metrics.consensus_coverage,
                    signals_detected: signals.map(s => s.type),
                    summary: this._generateReasonSummary(decision, signals, metrics)
                }
            ],
            issues_encountered: [
                ...(ctx.previousDraftInfo?.issues_encountered || []),
                ...issues
            ]
        };
    }
}

/**
 * 便捷函数：创建并运行评估
 */
export async function evaluateConsensus(ctx, options = {}) {
    const coach = new CoachOrchestrator(options);
    return coach.evaluateConsensus(ctx);
}

export default CoachOrchestrator;
