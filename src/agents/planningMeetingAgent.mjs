import chalk from "chalk";
import fs from "fs-extra";
import { writeFileSync, readFileSync } from "fs";
import { resolve } from "path";
import {
    loadPlanningAndReview,
    buildPlanningMeetingArtifacts
} from "../planning/planningMeetingCore.mjs";
import { appendPlanningMemoryEntry } from "../planning/memory.mjs";
import { writeRoleMeetingFiles } from "../planning/roleFiles.mjs";

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
            currentRound,
            inputSnapshot
        } = loadPlanningAndReview({ tasksDir, taskId });

        const logs = [];
        if (!planning) {
            logs.push(chalk.gray("尚未找到 planning.ai.json，无法生成规划会议纪要。"));
            return { logs };
        }

        let aiMeeting = null;
        const perRoleVerdicts = {};

        logs.push(chalk.cyan("正在召集规划工作坊成员开会讨论当前规划..."));

        // 先调用各个规划角色模型，获取多角色 verdict
        try {
            const { invokeRole } = await import("../models/broker.mjs");
            const basePayload = { planning, planReview, planMd };

            const roleCalls = [
                ["ProductPlanner", "planning_product_planner"],
                ["SystemDesigner", "planning_system_designer"],
                ["SeniorDeveloper", "planning_senior_developer"],
                ["TestPlanner", "planning_test_planner"],
                ["RiskPlanner", "planning_risk_planner"]
            ];

            for (const [roleName, roleKey] of roleCalls) {
                try {
                    logs.push(chalk.gray(`  - ${roleName} 正在评估规划...`));
                    const ai = await invokeRole(roleKey, basePayload, { aiDir, cwd });
                    if (ai?.ok && ai.verdict) {
                        perRoleVerdicts[roleName] = ai.verdict;
                        logs.push(
                            chalk.gray(`    ${roleName} 已给出结论（ok=${String(ai.verdict.ok)}）。`)
                        );
                    } else {
                        logs.push(
                            chalk.yellow(
                                `    ${roleName} 本轮未能给出结构化 verdict（忽略该角色输出）。`
                            )
                        );
                    }
                } catch {
                    // 某个角色失败时忽略，保持其它角色结果
                    logs.push(
                        chalk.yellow(`    ${roleName} 调用失败或超时，本轮将跳过该角色。`)
                    );
                }
            }

            // 优先尝试调用 planning_meeting 模型角色生成结构化会议纪要
            logs.push(chalk.cyan("各角色发言结束，敏捷教练正在汇总会议纪要..."));
            const ai = await invokeRole(
                "planning_meeting",
                { planning, planReview, planMd, perRoleVerdicts },
                { aiDir, cwd }
            );
            if (ai?.ok && ai.meeting) {
                aiMeeting = {
                    ...ai.meeting,
                    per_role_verdicts: ai.meeting.per_role_verdicts || perRoleVerdicts
                };
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
            currentRound,
            inputSnapshot
        });

        const jsonPath = resolve(planningDir, "planning.meeting.json");

        // 将本轮 issues_discussion 与历史 meeting 合并，形成多轮讨论记录
        try {
            if (fs.existsSync(jsonPath)) {
                const prevRaw = readFileSync(jsonPath, "utf-8");
                const prev = JSON.parse(prevRaw);
                if (
                    Array.isArray(prev.issues_discussion) &&
                    Array.isArray(meetingJson.issues_discussion)
                ) {
                    const merged = [...prev.issues_discussion];
                    for (const issue of meetingJson.issues_discussion) {
                        const existing = merged.find((i) => i.issue_id === issue.issue_id);
                        if (existing && Array.isArray(existing.rounds)) {
                            existing.rounds = [
                                ...existing.rounds,
                                ...(Array.isArray(issue.rounds) ? issue.rounds : [])
                            ];
                        } else {
                            merged.push(issue);
                        }
                    }
                    meetingJson.issues_discussion = merged;
                }
            }
        } catch {
            // 历史会议读取失败时忽略，继续写入本轮
        }

        writeFileSync(jsonPath, JSON.stringify(meetingJson, null, 2), "utf-8");

        const mdPath = resolve(planningDir, "planning.meeting.md");
        writeFileSync(mdPath, mdLines.join("\n"), "utf-8");

        try {
            writeRoleMeetingFiles({
                planningDir,
                taskId,
                planning,
                meetingJson
            });
            logs.push(
                chalk.gray(
                    `已为各角色生成细化会议记录：.ai-tools-chain/tasks/${taskId}/planning/roles/*.meeting.md`
                )
            );
        } catch {
            // 角色文件生成失败不阻断主流程
        }

        // 记录一条基础的会议决策记忆，作为后续多轮/多角色记忆的起点
        try {
            await appendPlanningMemoryEntry(planningDir, {
                round: currentRound,
                role: "Coach",
                kind: "decision",
                content: meetingJson.rounds?.[0]?.decision || "unknown"
            });

            const perRoleVerdicts = meetingJson.rounds?.[0]?.per_role_verdicts || {};
            if (perRoleVerdicts && typeof perRoleVerdicts === "object") {
                for (const [role, verdict] of Object.entries(perRoleVerdicts)) {
                    await appendPlanningMemoryEntry(planningDir, {
                        round: currentRound,
                        role,
                        kind: "verdict",
                        content: JSON.stringify(verdict)
                    });
                }
            }

            const round = meetingJson.rounds?.[0] || null;
            if (round && round.coach_summary) {
                await appendPlanningMemoryEntry(planningDir, {
                    round: currentRound,
                    role: "Coach",
                    kind: "summary",
                    content: round.coach_summary
                });
            }

            const openQuestions =
                (aiMeeting && Array.isArray(aiMeeting.open_questions) && aiMeeting.open_questions) ||
                (planning && Array.isArray(planning.open_questions) && planning.open_questions) ||
                [];
            for (const q of openQuestions) {
                await appendPlanningMemoryEntry(planningDir, {
                    round: currentRound,
                    role: "Coach",
                    kind: "open_question",
                    content: q
                });
            }
        } catch {
            // 记忆失败不阻断主流程
        }

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
