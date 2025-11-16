import chalk from "chalk";
import fs from "fs-extra";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

function readJsonSafe(path, fallback = null) {
    try {
        const raw = readFileSync(path, "utf-8");
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

export class ReviewMeetingAgent {
    constructor() {
        this.name = "review_meeting";
    }

    /**
     * step({ cwd, aiDir, tasksDir, taskId })
     */
    async step(ctx) {
        const { aiDir, cwd, tasksDir, taskId } = ctx;
        const logs = [];

        const reviewPath = resolve(tasksDir, taskId, "review.json");
        const soPath = resolve(aiDir, "second-opinion", taskId, "second_opinion.md");

        const review = readJsonSafe(reviewPath, null);
        let soText = "";
        try {
            soText = readFileSync(soPath, "utf-8");
        } catch {
            soText = "";
        }

        if (!review && !soText) {
            logs.push(chalk.gray("尚未找到 review.json 或 second_opinion.md，无法生成会议纪要。"));
            return { logs };
        }

        const baseMeeting = {
            taskId,
            summary: review?.summary || "",
            risks: review?.risks || [],
            suggestions: review?.suggestions || [],
            second_opinion_preview: soText ? String(soText).slice(0, 1000) : "",
            planning_context: review?.planning_context,
            planning_checks: review?.planning_checks
        };

        let meeting = baseMeeting;
        let mdLines = null;

        // 优先尝试调用 review_meeting 模型角色生成会议纪要
        try {
            const { invokeRole } = await import("../models/broker.mjs");
            const ai = await invokeRole(
                "review_meeting",
                { review, secondOpinion: soText },
                { aiDir, cwd }
            );
            if (ai?.ok && ai.meeting) {
                meeting = {
                    ...baseMeeting,
                    ai_meeting: ai.meeting
                };
                const m = ai.meeting;
                const lines = [];
                lines.push(`# Code Review Meeting Notes for task ${taskId}`);
                lines.push("");
                if (m.summary) {
                    lines.push("## Overall Summary");
                    lines.push("");
                    lines.push(m.summary);
                    lines.push("");
                }
                const risks = Array.isArray(m.risks) ? m.risks : review?.risks || [];
                if (risks.length) {
                    lines.push("## Risks");
                    lines.push("");
                    risks.forEach((r) => lines.push(`- ${r}`));
                    lines.push("");
                }
                const suggestions = Array.isArray(m.suggestions)
                    ? m.suggestions
                    : review?.suggestions || [];
                if (suggestions.length) {
                    lines.push("## Suggestions");
                    lines.push("");
                    suggestions.forEach((s) => lines.push(`- ${s}`));
                    lines.push("");
                }
                const openQs = Array.isArray(m.open_questions) ? m.open_questions : [];
                if (openQs.length) {
                    lines.push("## Open Questions");
                    lines.push("");
                    openQs.forEach((q) => lines.push(`- ${q}`));
                    lines.push("");
                }
                const actions = Array.isArray(m.next_actions) ? m.next_actions : [];
                if (actions.length) {
                    lines.push("## Next Actions");
                    lines.push("");
                    actions.forEach((a) => lines.push(`- ${a}`));
                    lines.push("");
                }
                if (m.decision) {
                    lines.push("");
                    lines.push(`> Decision: ${m.decision}`);
                }
                if (baseMeeting.second_opinion_preview) {
                    lines.push("");
                    lines.push("## Second Opinion (Preview)");
                    lines.push("");
                    lines.push(baseMeeting.second_opinion_preview);
                    lines.push("");
                }

                const pc = meeting.planning_checks || baseMeeting.planning_checks;
                const pctx = meeting.planning_context || baseMeeting.planning_context;
                if (pc || pctx) {
                    lines.push("");
                    lines.push("## Planning Scope & Checks");
                    lines.push("");
                    if (pctx?.scope && Array.isArray(pctx.scope) && pctx.scope.length) {
                        lines.push("- Scope:");
                        pctx.scope.forEach((s) => lines.push(`  - ${s}`));
                    }
                    if (pctx?.non_goals && Array.isArray(pctx.non_goals) && pctx.non_goals.length) {
                        lines.push("");
                        lines.push("- Non-goals:");
                        pctx.non_goals.forEach((ng) => lines.push(`  - ${ng}`));
                    }
                    const outOfScope =
                        Array.isArray(pc?.out_of_scope_files) && pc.out_of_scope_files.length
                            ? pc.out_of_scope_files
                            : [];
                    if (outOfScope.length) {
                        lines.push("");
                        lines.push("- Possible out-of-scope files:");
                        outOfScope.forEach((p) => lines.push(`  - ${p}`));
                    }
                }
                mdLines = lines;
                logs.push(chalk.cyan("已通过 review_meeting 模型生成代码审查会议纪要。"));
            }
        } catch {
            // 模型失败时回退到规则拼装
        }

        const taskDir = resolve(tasksDir, taskId);
        fs.ensureDirSync(taskDir);
        const meetingJsonPath = resolve(taskDir, "review.meeting.json");
        writeFileSync(meetingJsonPath, JSON.stringify(meeting, null, 2), "utf-8");

        if (!mdLines) {
            const lines = [];
            lines.push(`# Code Review Meeting Notes for task ${taskId}`);
            lines.push("");
            if (meeting.summary) {
                lines.push("## Overall Summary");
                lines.push("");
                lines.push(meeting.summary);
                lines.push("");
            }
            if (meeting.risks?.length) {
                lines.push("## Risks");
                lines.push("");
                meeting.risks.forEach((r) => lines.push(`- ${r}`));
                lines.push("");
            }
            if (meeting.suggestions?.length) {
                lines.push("## Suggestions");
                lines.push("");
                meeting.suggestions.forEach((s) => lines.push(`- ${s}`));
                lines.push("");
            }
            if (meeting.second_opinion_preview) {
                lines.push("## Second Opinion (Preview)");
                lines.push("");
                lines.push(meeting.second_opinion_preview);
                lines.push("");
            }
            if (meeting.planning_context || meeting.planning_checks) {
                const pc = meeting.planning_checks;
                const pctx = meeting.planning_context;
                lines.push("## Planning Scope & Checks");
                lines.push("");
                if (pctx?.scope && Array.isArray(pctx.scope) && pctx.scope.length) {
                    lines.push("- Scope:");
                    pctx.scope.forEach((s) => lines.push(`  - ${s}`));
                    lines.push("");
                }
                if (pctx?.non_goals && Array.isArray(pctx.non_goals) && pctx.non_goals.length) {
                    lines.push("- Non-goals:");
                    pctx.non_goals.forEach((ng) => lines.push(`  - ${ng}`));
                    lines.push("");
                }
                const outOfScope =
                    Array.isArray(pc?.out_of_scope_files) && pc.out_of_scope_files.length
                        ? pc.out_of_scope_files
                        : [];
                if (outOfScope.length) {
                    lines.push("- Possible out-of-scope files:");
                    outOfScope.forEach((p) => lines.push(`  - ${p}`));
                    lines.push("");
                }
            }
            mdLines = lines;
        }

        const meetingMdPath = resolve(taskDir, "review.meeting.md");
        writeFileSync(meetingMdPath, mdLines.join("\n"), "utf-8");

        logs.push(chalk.cyan(`已生成代码审查会议纪要：${meetingMdPath}`));

        return {
            logs,
            statePatch: {
                phase: "code_review_meeting",
                actors: {
                    review_meeting: { status: "completed" }
                }
            }
        };
    }
}
