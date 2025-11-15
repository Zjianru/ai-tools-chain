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
        const { aiDir, tasksDir, taskId } = ctx;
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

        const meeting = {
            taskId,
            summary: review?.summary || "",
            risks: review?.risks || [],
            suggestions: review?.suggestions || [],
            second_opinion_preview: soText ? String(soText).slice(0, 1000) : ""
        };

        const taskDir = resolve(tasksDir, taskId);
        fs.ensureDirSync(taskDir);
        const meetingJsonPath = resolve(taskDir, "review.meeting.json");
        writeFileSync(meetingJsonPath, JSON.stringify(meeting, null, 2), "utf-8");

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

        const meetingMdPath = resolve(taskDir, "review.meeting.md");
        writeFileSync(meetingMdPath, lines.join("\n"), "utf-8");

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

