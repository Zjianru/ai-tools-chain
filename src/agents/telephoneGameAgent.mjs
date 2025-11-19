/**
 * TelephoneGameAgent - Phase B
 * 传声筒机制实现
 *
 * 职责:
 * - 准备角色的新信息上下文
 * - 分发给各个角色获取新意见
 * - 收集和汇总角色更新
 * - 合成新的共识信息
 */

/**
 * 传声筒结果
 * @typedef {Object} TelephoneGameResult
 * @property {string} timestamp
 * @property {Object[]} perRoleUpdates - 每个角色的更新
 * @property {string[]} newConsensusPoints - 新共识点
 * @property {string[]} remainingDivergence - 仍有分歧的点
 * @property {string} status - "in_progress" | "completed" | "failed"
 */

export class TelephoneGameAgent {
    constructor(options = {}) {
        this.roleTimeout = options.roleTimeout ?? 5000; // 5 秒/角色
        this.maxParallelInvokes = options.maxParallelInvokes ?? 5;
    }

    /**
     * 执行传声筒机制
     * @param {ClarificationSession} session - 澄清会话
     * @param {Object} userFeedback - 用户反馈
     * @param {Object} ctx - 任务上下文（包含 invokeRole 等）
     * @returns {Promise<TelephoneGameResult>}
     */
    async execute(session, userFeedback, ctx) {
        try {
            // 1. 为每个角色准备提示词
            const telephonePrompts = this.prepareTelephonePrompts(
                session,
                userFeedback,
                ctx
            );

            // 2. 分发给各角色获取反馈
            const roleResponses = await this.invokeRolesInParallel(
                telephonePrompts,
                ctx
            );

            // 3. 收集角色更新
            const roleUpdates = this.collectRoleUpdates(roleResponses);

            // 4. 汇总共识
            const consensus = this.synthesizeConsensus(
                roleUpdates,
                ctx.planning?.perRoleVerdicts || []
            );

            return {
                timestamp: new Date().toISOString(),
                perRoleUpdates: roleUpdates,
                newConsensusPoints: consensus.points,
                remainingDivergence: consensus.divergence,
                status: "completed"
            };
        } catch (error) {
            return {
                timestamp: new Date().toISOString(),
                perRoleUpdates: [],
                newConsensusPoints: [],
                remainingDivergence: [],
                status: "failed",
                error: error.message
            };
        }
    }

    /**
     * 为每个角色准备传声筒提示词
     * @param {ClarificationSession} session
     * @param {Object} userFeedback
     * @param {Object} ctx
     * @returns {Object[]} - 提示词列表
     */
    prepareTelephonePrompts(session, userFeedback, ctx) {
        const roles = [
            "ProductPlanner",
            "SystemDesigner",
            "SeniorDeveloper",
            "TestPlanner",
            "RiskPlanner"
        ];

        const userAnswers = this._summarizeUserAnswers(userFeedback);
        const verdicts = ctx.planning?.perRoleVerdicts || [];

        return roles.map(role => {
            const previousVerdict = verdicts.find(v => v.role === role) || {};

            return {
                role,
                prompt: this._generateTelephonePrompt(
                    role,
                    session,
                    userAnswers,
                    previousVerdict
                )
            };
        });
    }

    /**
     * 并行调用各个角色
     * @param {Object[]} telephonePrompts
     * @param {Object} ctx
     * @returns {Promise<Object[]>}
     */
    async invokeRolesInParallel(telephonePrompts, ctx) {
        const results = [];

        // 分批并行调用 (避免过多并发)
        for (let i = 0; i < telephonePrompts.length; i += this.maxParallelInvokes) {
            const batch = telephonePrompts.slice(
                i,
                i + this.maxParallelInvokes
            );

            const batchResults = await Promise.allSettled(
                batch.map(({ role, prompt }) =>
                    this._invokeRoleWithTimeout(role, prompt, ctx)
                )
            );

            for (let j = 0; j < batchResults.length; j++) {
                const result = batchResults[j];
                const originalIdx = i + j;

                if (result.status === "fulfilled") {
                    results[originalIdx] = {
                        role: batch[j].role,
                        response: result.value,
                        success: true
                    };
                } else {
                    results[originalIdx] = {
                        role: batch[j].role,
                        response: null,
                        success: false,
                        error: result.reason?.message || "Unknown error"
                    };
                }
            }
        }

        return results;
    }

    /**
     * 收集角色更新
     * @param {Object[]} roleResponses
     * @returns {Object[]}
     */
    collectRoleUpdates(roleResponses) {
        return roleResponses.map(({ role, response, success, error }) => {
            if (!success || !response) {
                return {
                    role,
                    previousStance: "unknown",
                    newStance: "unknown",
                    confidence: 0,
                    updatedComments: `[系统] 未能获取 ${role} 的反馈: ${error}`,
                    blocking_questions: []
                };
            }

            // 解析角色的响应
            return this._parseRoleResponse(role, response);
        });
    }

    /**
     * 汇总共识
     * @param {Object[]} roleUpdates
     * @param {Object[]} oldVerdicts
     * @returns {{ points: string[], divergence: string[] }}
     */
    synthesizeConsensus(roleUpdates, oldVerdicts) {
        // 统计各个角色的立场
        const agreeCount = roleUpdates.filter(u => u.newStance === "agree").length;
        const disagreeCount = roleUpdates.filter(u => u.newStance === "disagree").length;
        const mixedCount = roleUpdates.filter(u => u.newStance === "mixed").length;
        const totalRoles = roleUpdates.length;

        const consensusRatio = agreeCount / totalRoles;

        const points = [];
        const divergence = [];

        // 如果超过 75% 同意，这可能是新共识点
        if (consensusRatio >= 0.75) {
            points.push(
                "各角色在基本方向上已经达成共识，可以进入下一阶段"
            );
        }

        // 如果有分歧，记录为待解决
        if (disagreeCount > 0 || mixedCount > 0) {
            const divergingRoles = [
                ...roleUpdates.filter(u => u.newStance === "disagree").map(u => u.role),
                ...roleUpdates.filter(u => u.newStance === "mixed").map(u => u.role)
            ];
            divergence.push(
                `${divergingRoles.join(", ")} 对某些方面仍有不同看法`
            );
        }

        // 如果信心度有提升，记录改进
        const confidenceImprovement = roleUpdates.filter(u => {
            const oldConfidence = (
                oldVerdicts.find(v => v.role === u.role)?.confidence || 0
            );
            return u.confidence > oldConfidence;
        });

        if (confidenceImprovement.length > 0) {
            points.push(
                `${confidenceImprovement.map(u => u.role).join(", ")} ` +
                `对方案的信心度有所提升`
            );
        }

        // 如果有新的阻塞问题，标记为待处理
        const newBlockingQuestions = roleUpdates.filter(
            u => u.blocking_questions && u.blocking_questions.length > 0
        );

        if (newBlockingQuestions.length > 0) {
            divergence.push(
                `${newBlockingQuestions.map(u => u.role).join(", ")} ` +
                `仍有阻塞性问题需要解决`
            );
        }

        return {
            points: points.length > 0 ? points : ["澄清后各角色意见有所调整"],
            divergence: divergence.length > 0 ? divergence : []
        };
    }

    // ========================================================================
    // 辅助方法
    // ========================================================================

    /**
     * 生成角色的传声筒提示词
     */
    _generateTelephonePrompt(role, session, userAnswers, previousVerdict) {
        return `
你是 AI 规划团队中的 ${role}。

我们正在进行规划澄清阶段。用户刚刚回答了一些澄清问题。

【用户反馈】
${userAnswers}

【你之前的立场】
- 同意: ${previousVerdict.ok !== false}
- 信心度: ${previousVerdict.confidence || 0.5}
- 备注: ${previousVerdict.comments || "无"}
- 未解答问题: ${previousVerdict.blocking_open_questions?.join(", ") || "无"}

【现在的任务】
基于用户提供的新信息，请重新评估你的立场:

1. 你的新立场是什么? (同意/不同意/混合)
2. 你的新信心度是多少? (0-1)
3. 你的具体看法是什么?
4. 是否还有未解答的问题?

请以 JSON 格式返回:
{
  "stance": "agree|disagree|mixed",
  "confidence": 0.0-1.0,
  "comments": "你的具体看法...",
  "blocking_questions": ["问题1", "问题2"],
  "reasoning": "你的推理过程..."
}
`;
    }

    /**
     * 总结用户答案
     */
    _summarizeUserAnswers(userFeedback) {
        if (!userFeedback || !userFeedback.answers) {
            return "(用户未提供任何反馈)";
        }

        return userFeedback.answers
            .filter(a => a.answer && a.answer !== "skip")
            .map(a => `Q: ${a.question}\nA: ${a.answer}`)
            .join("\n\n");
    }

    /**
     * 调用角色并处理超时
     */
    async _invokeRoleWithTimeout(role, prompt, ctx) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error(`${role} 响应超时`)),
                this.roleTimeout
            );

            ctx.broker.invoke(role, prompt)
                .then(result => {
                    clearTimeout(timeout);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeout);
                    reject(error);
                });
        });
    }

    /**
     * 解析角色的响应
     */
    _parseRoleResponse(role, response) {
        try {
            // 假设响应是 JSON 格式
            const parsed = typeof response === "string"
                ? JSON.parse(response)
                : response;

            return {
                role,
                previousStance: "unknown",
                newStance: parsed.stance || "mixed",
                confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
                updatedComments: parsed.comments || "",
                blocking_questions: parsed.blocking_questions || []
            };
        } catch (error) {
            return {
                role,
                previousStance: "unknown",
                newStance: "mixed",
                confidence: 0.5,
                updatedComments: String(response),
                blocking_questions: []
            };
        }
    }
}

/**
 * 便捷函数：执行传声筒机制
 */
export async function executeTelephoneGame(session, feedback, ctx, options = {}) {
    const agent = new TelephoneGameAgent(options);
    return agent.execute(session, feedback, ctx);
}

export default TelephoneGameAgent;
