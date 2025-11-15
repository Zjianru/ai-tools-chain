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

export class PlanningMeetingAgent {
    constructor() {
        this.name = "planning_meeting";
    }

    /**
     * step({ cwd, aiDir, tasksDir, taskId })
     */
    async step(ctx) {
        const { tasksDir, taskId } = ctx;
        const taskDir = resolve(tasksDir, taskId);
        fs.ensureDirSync(taskDir);

        const planningPath = resolve(taskDir, "planning.ai.json");
        const planReviewPath = resolve(taskDir, "plan-review.json");
        const planMdPath = resolve(taskDir, "plan.md");

        const planning = readJsonSafe(planningPath, null);
        const planReview = readJsonSafe(planReviewPath, null);
        let planMd = "";
        try {
            planMd = readFileSync(planMdPath, "utf-8");
        } catch {
            planMd = "";
        }

        const logs = [];
        if (!planning) {
            logs.push(chalk.gray("尚未找到 planning.ai.json，无法生成规划会议纪要。"));
            return { logs };
        }

        const title = planning.meta?.title || planning.title || `Task ${taskId}`;
        const why = planning.why || "";
        const what = planning.what || "";
        const requirements = Array.isArray(planning.requirements) ? planning.requirements : [];
        const draftFiles = Array.isArray(planning.draft_files) ? planning.draft_files : [];
        const acceptance = Array.isArray(planning.acceptance) ? planning.acceptance : [];

        const issues = Array.isArray(planReview?.issues) ? planReview.issues : [];
        const blocking = issues.filter((i) => i.severity === "error");
        const warnings = issues.filter((i) => i.severity === "warning");

        const meetingJson = {
            taskId,
            title,
            ok: planReview ? !!planReview.ok : blocking.length === 0,
            planning_summary: {
                why,
                what,
                requirementsCount: requirements.length,
                draftFilesCount: draftFiles.length,
                acceptanceCount: acceptance.length
            },
            issues,
            plan_md_present: !!planMd
        };

        const jsonPath = resolve(taskDir, "planning.meeting.json");
        writeFileSync(jsonPath, JSON.stringify(meetingJson, null, 2), "utf-8");

        const lines = [];
        lines.push(`# Planning Meeting Notes for task ${taskId}`);
        lines.push("");
        lines.push(`- 规划标题：${title}`);
        if (why) lines.push(`- Why：${why}`);
        if (what) lines.push(`- What：${what}`);
        lines.push(
            `- 概览：requirements=${requirements.length}, draft_files=${draftFiles.length}, acceptance=${acceptance.length}`
        );
        if (planReview) {
            lines.push(`- 结构与 openspec gate：${planReview.ok ? "通过" : "未通过"}`);
        }
        lines.push("");

        if (issues.length) {
            lines.push("## 发现的问题/风险");
            lines.push("");
            issues.forEach((i) => {
                lines.push(`- [${i.severity}] (${i.type}) ${i.message}`);
            });
            lines.push("");
        } else {
            lines.push("## 发现的问题/风险");
            lines.push("");
            lines.push("- （当前未发现结构层问题）");
            lines.push("");
        }

        lines.push("## 下一步建议");
        lines.push("");
        if (blocking.length) {
            lines.push("- 先修复上述 error 再进入 codegen。");
        } else if (warnings.length) {
            lines.push("- 可以进入 codegen，但建议先评估并处理上述 warning。");
        } else {
            lines.push("- 规划结构合理，可进入 codegen 阶段。");
        }

        const mdPath = resolve(taskDir, "planning.meeting.md");
        writeFileSync(mdPath, lines.join("\n"), "utf-8");

        logs.push(chalk.cyan(`已生成规划会议纪要：${mdPath}`));

        return {
            logs,
            statePatch: {
                phase: "planning_meeting",
                actors: {
                    planning_meeting: { status: "completed" }
                }
            }
        };
    }
}

