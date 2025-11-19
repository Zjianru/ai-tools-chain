/**
 * ClarificationSessionAgent - Phase B
 * 澄清小会会话管理
 *
 * 职责:
 * - 初始化澄清会话
 * - 生成澄清问题
 * - 收集用户反馈
 * - 更新规划信息
 * - 管理澄清循环
 */

import { randomUUID } from "crypto";

/**
 * 澄清会话状态
 * @typedef {Object} ClarificationSession
 * @property {string} id - 会话 ID
 * @property {string} taskId - 任务 ID
 * @property {number} sessionNumber - 第几个澄清会话 (1-based)
 * @property {Object} triggeredBy - 触发信息
 * @property {Object[]} clarificationQuestions - 澄清问题列表
 * @property {Object} userResponse - 用户响应
 * @property {Object} telephoneGameResult - 传声筒结果
 * @property {string} summary - 会话摘要
 * @property {string} status - 会话状态
 */

export class ClarificationSessionAgent {
    constructor(options = {}) {
        this.maxClarifications = options.maxClarifications ?? 3;
        this.questionTimeout = options.questionTimeout ?? 300000; // 5 分钟
    }

    /**
     * Agent 的主入口方法
     * @param {Object} ctx - 任务上下文
     * @returns {Promise<Object>} { ok, phase, artifacts, error? }
     */
    async step(ctx) {
        try {
            // 1. 初始化澄清会话
            const session = await this.initializeClarificationSession(ctx);

            // 2. 生成澄清问题
            const questions = await this.generateClarificationQuestions(ctx, session);
            session.clarificationQuestions = questions;

            // 3. 准备 REPL 消息
            const replMessage = this.formatReplyForUser(session);
            ctx.repl?.log(replMessage);

            // 4. 返回状态，等待 REPL 交互
            return {
                ok: true,
                phase: "plan_clarification",
                status: "awaiting_user_response",
                session,
                artifacts: {
                    clarificationSession: session
                },
                replPrompt: replMessage
            };
        } catch (error) {
            return {
                ok: false,
                error: `澄清会话创建失败: ${error.message}`
            };
        }
    }

    /**
     * 初始化澄清会话
     * @param {Object} ctx
     * @returns {Promise<ClarificationSession>}
     */
    async initializeClarificationSession(ctx) {
        const clarifications = ctx.planning?.clarifications || {};
        const sessionNumber = (clarifications.sessionCount || 0) + 1;

        if (sessionNumber > this.maxClarifications) {
            throw new Error(
                `超过最大澄清次数限制 (${this.maxClarifications})`
            );
        }

        // 获取最近的 EvaluateResult
        const evalResult = ctx.planning?.lastEvaluateResult;
        if (!evalResult) {
            throw new Error("无澄清触发信息");
        }

        const session = {
            id: `clarify-${sessionNumber}-${Date.now()}`,
            taskId: ctx.taskId,
            sessionNumber,
            triggeredBy: {
                round: ctx.planning?.round || 2,
                signals: evalResult.signals_detected.map(s => s.type),
                signalsSummary: this._summarizeSignals(
                    evalResult.signals_detected
                ),
                timestamp: new Date().toISOString()
            },
            clarificationQuestions: [],
            userResponse: null,
            telephoneGameResult: null,
            summary: "",
            status: "initiated"
        };

        return session;
    }

    /**
     * 生成澄清问题
     * @param {Object} ctx
     * @param {ClarificationSession} session
     * @returns {Promise<Object[]>}
     */
    async generateClarificationQuestions(ctx, session) {
        const questions = [];
        const signals = session.triggeredBy.signals;
        const evalResult = ctx.planning?.lastEvaluateResult || {};
        const issues = evalResult.blocking_issues || [];

        let questionId = 1;

        // 1. 来自 blocking_questions 的直接问题
        if (signals.includes("blocking_questions")) {
            const blockingIssues = issues.filter(
                i => i.signal_type === "blocking_questions"
            );
            for (const issue of blockingIssues) {
                questions.push({
                    id: `q${questionId++}`,
                    question: this._formatBlockingQuestion(issue),
                    context: issue.description,
                    relatedSignal: "blocking_questions",
                    priority: "critical",
                    fromRoles: issue.from_role ? [issue.from_role] : [],
                    answered: false
                });
            }
        }

        // 2. 来自 user_uncertainty 的澄清
        if (signals.includes("user_uncertainty")) {
            questions.push({
                id: `q${questionId++}`,
                question: "您对项目方向或需求有什么疑虑吗?请详细说明",
                context: "用户在需求定义上表示不确定",
                relatedSignal: "user_uncertainty",
                priority: "high",
                answered: false
            });
        }

        // 3. 来自 requirement_clarity 的澄清
        if (signals.includes("requirement_clarity")) {
            const clarityIssues = issues.filter(
                i => i.signal_type === "requirement_clarity"
            );
            for (const issue of clarityIssues) {
                questions.push({
                    id: `q${questionId++}`,
                    question: this._formatClarityQuestion(issue),
                    context: issue.description,
                    relatedSignal: "requirement_clarity",
                    priority: issue.severity === "high" ? "high" : "medium",
                    answered: false
                });
            }
        }

        // 4. 来自 narrative_divergence 的澄清
        if (signals.includes("narrative_divergence")) {
            const divergenceIssues = issues.filter(
                i => i.signal_type === "narrative_divergence"
            );
            for (const issue of divergenceIssues) {
                questions.push({
                    id: `q${questionId++}`,
                    question: this._formatDivergenceQuestion(issue),
                    context: issue.description,
                    relatedSignal: "narrative_divergence",
                    priority: issue.severity === "high" ? "high" : "medium",
                    fromRoles: issue.from_role ? [issue.from_role] : [],
                    answered: false
                });
            }
        }

        // 5. 来自 commitment_readiness 的澄清
        if (signals.includes("commitment_readiness")) {
            const readinessIssues = issues.filter(
                i => i.signal_type === "commitment_readiness"
            );
            for (const issue of readinessIssues) {
                questions.push({
                    id: `q${questionId++}`,
                    question: this._formatReadinessQuestion(issue),
                    context: issue.description,
                    relatedSignal: "commitment_readiness",
                    priority: "medium",
                    fromRoles: issue.from_role ? [issue.from_role] : [],
                    answered: false
                });
            }
        }

        // 按优先级排序
        questions.sort(
            (a, b) => this._priorityOrder(b.priority) - this._priorityOrder(a.priority)
        );

        return questions;
    }

    /**
     * 收集用户反馈
     * @param {ClarificationSession} session
     * @param {Object} answers - { questionId: answer }
     * @returns {Promise<Object>}
     */
    async collectUserFeedback(session, answers) {
        const feedback = {
            timestamp: new Date().toISOString(),
            answers: []
        };

        for (const question of session.clarificationQuestions) {
            const answer = answers[question.id] || null;
            feedback.answers.push({
                questionId: question.id,
                question: question.question,
                answer,
                clarity: this._calculateClarity(answer, question)
            });
        }

        session.userResponse = feedback;
        session.status = "feedback_collected";

        return feedback;
    }

    /**
     * 准备用户回复消息
     * @param {ClarificationSession} session
     * @returns {string}
     */
    formatReplyForUser(session) {
        const questions = session.clarificationQuestions;
        const critical = questions.filter(q => q.priority === "critical");
        const high = questions.filter(q => q.priority === "high");
        const medium = questions.filter(q => q.priority === "medium");

        let msg = "\n";
        msg += "🔍 澄清小会已触发\n";
        msg += `\n触发原因: ${session.triggeredBy.signalsSummary}\n`;
        msg += `\n📋 需要澄清的问题 (共 ${questions.length} 个):\n`;

        if (critical.length > 0) {
            msg += `\n⚠️ 关键问题 (${critical.length} 个):\n`;
            critical.forEach(q => {
                msg += `  [${q.id}] ${q.question}\n`;
                if (q.context) msg += `      背景: ${q.context}\n`;
            });
        }

        if (high.length > 0) {
            msg += `\n🔴 高优先级 (${high.length} 个):\n`;
            high.forEach(q => {
                msg += `  [${q.id}] ${q.question}\n`;
                if (q.context) msg += `      背景: ${q.context}\n`;
            });
        }

        if (medium.length > 0) {
            msg += `\n🟡 中优先级 (${medium.length} 个):\n`;
            medium.forEach(q => {
                msg += `  [${q.id}] ${q.question}\n`;
            });
        }

        msg += `\n请依次回答问题 (或输入 'skip' 跳过):\n`;
        msg += `\n使用命令: /answer <问题ID> <答案>\n`;
        msg += `示例: /answer q1 我们的用户是企业管理员\n`;
        msg += `\n输入 /done 完成澄清，系统将分析您的答案。\n`;

        return msg;
    }

    /**
     * 更新规划信息
     * @param {Object} ctx
     * @param {ClarificationSession} session
     * @param {Object} feedback
     * @param {Object} telephoneResult
     * @returns {Promise<void>}
     */
    async updatePlanningInfo(ctx, session, feedback, telephoneResult) {
        // 1. 更新 brief (如果用户改变了需求)
        const updatedBrief = this._mergeBriefWithFeedback(
            ctx.planning.userBrief,
            feedback
        );
        ctx.planning.userBrief = updatedBrief;

        // 2. 更新 per_role_verdicts (基于新信息)
        ctx.planning.perRoleVerdicts = this._mergeRoleVerdicts(
            ctx.planning.perRoleVerdicts,
            telephoneResult.perRoleUpdates
        );

        // 3. 记录澄清过程
        if (!ctx.planning.clarifications) {
            ctx.planning.clarifications = {
                sessionCount: 0,
                sessions: []
            };
        }
        ctx.planning.clarifications.sessionCount++;
        ctx.planning.clarifications.sessions.push(session.id);
        ctx.planning.clarifications.lastSessionResult = {
            userFeedback: feedback,
            telephoneGameResult: telephoneResult
        };

        // 4. 标记为 Round 2.5
        ctx.planning.round = 2 + (session.sessionNumber * 0.5);
    }

    // ========================================================================
    // 辅助方法
    // ========================================================================

    /**
     * 总结信号为人类可读的摘要
     */
    _summarizeSignals(signals) {
        const descriptions = {
            blocking_questions: "信息缺口",
            no_new_info: "讨论循环",
            requirement_clarity: "需求不清",
            narrative_divergence: "方向分歧",
            commitment_readiness: "承诺缺失",
            user_uncertainty: "用户不确定"
        };

        const summaries = signals
            .map(s => descriptions[s.type] || s.type)
            .join(" + ");

        return summaries;
    }

    /**
     * 格式化阻塞问题
     */
    _formatBlockingQuestion(issue) {
        return issue.description || issue.suggestion || "请澄清此关键问题";
    }

    /**
     * 格式化需求澄清问题
     */
    _formatClarityQuestion(issue) {
        if (issue.description.includes("?")) {
            return issue.description;
        }
        return `关于"${issue.description}"，您能提供更多细节吗?`;
    }

    /**
     * 格式化分歧问题
     */
    _formatDivergenceQuestion(issue) {
        return `关于"${issue.description.split("；")[0]}"，从用户角度，您更倾向哪个方案?`;
    }

    /**
     * 格式化承诺就绪问题
     */
    _formatReadinessQuestion(issue) {
        return `您对此方案的主要顾虑是什么? ${issue.suggestion || ""}`;
    }

    /**
     * 优先级排序
     */
    _priorityOrder(priority) {
        return { critical: 4, high: 3, medium: 2, low: 1 }[priority] || 0;
    }

    /**
     * 计算答案清晰度 (0-1)
     */
    _calculateClarity(answer, question) {
        if (!answer) return 0;
        if (answer === "skip") return 0;

        const length = answer.length;
        const hasDetails = answer.split(" ").length > 5;

        let clarity = Math.min(1, length / 200);
        if (hasDetails) clarity = Math.min(1, clarity + 0.2);

        return clarity;
    }

    /**
     * 合并反馈到 brief
     */
    _mergeBriefWithFeedback(brief, feedback) {
        const mergedBrief = { ...brief };

        // 收集所有答案
        const allAnswers = feedback.answers
            .filter(a => a.answer && a.answer !== "skip")
            .map(a => a.answer)
            .join("\n");

        if (allAnswers) {
            mergedBrief.text = `${mergedBrief.text}\n\n【澄清信息】\n${allAnswers}`;
            mergedBrief.lastClarification = new Date().toISOString();
        }

        return mergedBrief;
    }

    /**
     * 合并角色意见更新
     */
    _mergeRoleVerdicts(oldVerdicts, roleUpdates) {
        const merged = [...oldVerdicts];

        for (const update of roleUpdates) {
            const idx = merged.findIndex(v => v.role === update.role);
            if (idx >= 0) {
                merged[idx] = {
                    ...merged[idx],
                    ok: update.newStance === "agree",
                    confidence: update.confidence,
                    comments: update.updatedComments,
                    blocking_open_questions: update.blocking_questions || []
                };
            }
        }

        return merged;
    }
}

/**
 * 便捷函数：创建和运行澄清会话
 */
export async function initiateClarificationSession(ctx, options = {}) {
    const agent = new ClarificationSessionAgent(options);
    return agent.step(ctx);
}

export default ClarificationSessionAgent;
