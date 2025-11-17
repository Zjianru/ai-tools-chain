import chalk from "chalk";
import fs from "fs-extra";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { loadPlanningAndReview, buildPlanningMeetingArtifacts } from "../planning/planningMeetingCore.mjs";

export class PlanningMeetingAgent {
    constructor() {
        this.name = "planning_meeting";
    }

    /**
     * step({ cwd, aiDir, tasksDir, taskId })
     */
    async step(ctx) {
        const { aiDir, cwd, tasksDir, taskId } = ctx;
        const taskDir = resolve(tasksDir, taskId);
        fs.ensureDirSync(taskDir);

        const {
            planningDir,
            planningPath,
            planReviewPath,
            planMdPath,
            planning,
            planReview,
            planMd,
            currentRound
        } = loadPlanningAndReview({ tasksDir, taskId });

        const logs = [];
        if (!planning) {
            logs.push(chalk.gray("尚未找到 planning.ai.json，无法生成规划会议纪要。"));
            return { logs };
        }

        let aiMeeting = null;

        // 优先尝试调用 planning_meeting 模型角色生成结构化会议纪要
        try {
            const { invokeRole } = await import("../models/broker.mjs");
            const ai = await invokeRole(
                "planning_meeting",
                { planning, planReview, planMd },
                { aiDir, cwd }
            );
            if (ai?.ok && ai.meeting) {
                aiMeeting = ai.meeting;
                logs.push(chalk.cyan("已通过 planning_meeting 模型生成规划会议纪要。"));
            }
        } catch {
            // 模型失败时回退到规则拼装
        }

        const { meetingJson, mdLines } = buildPlanningMeetingArtifacts({
            taskId,
            planning,
            planReview,
            planMd,
            aiMeeting,
            currentRound
        });

        const jsonPath = resolve(planningDir, "planning.meeting.json");
        writeFileSync(jsonPath, JSON.stringify(meetingJson, null, 2), "utf-8");

        const mdPath = resolve(planningDir, "planning.meeting.md");
        writeFileSync(mdPath, mdLines.join("\n"), "utf-8");

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
