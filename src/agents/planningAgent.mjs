import chalk from "chalk";
import fs from "fs-extra";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
    callPlanningOnce,
    applyPlanningAndOpenSpec,
    ensurePlanningDraft,
    writePlanningDraft
} from "../core/planning.mjs";
import { nowISO } from "../core/task.mjs";
import {
    appendJSONL,
    loadPlanningTranscript,
    buildHistoryFromTranscript,
    readLatestBrief,
    nextRoundFromTranscript
} from "../planning/transcript.mjs";
import { runPlanReviewCore } from "../planning/planReviewCore.mjs";
import { PlanningMeetingAgent } from "./planningMeetingAgent.mjs";

export class PlanningAgent {
    constructor() {
        this.name = "planning";
    }

    /**
     * step({ cwd, aiDir, tasksDir, taskId, metaPath })
     *
     * 说明：
     * - userBrief / history / draft 均从磁盘恢复；
     * - 调用方在追加 brief 后再调用本方法；
     * - 澄清问题不再阻塞 /plan，会以 open_questions/assumptions 的形式体现在 planning.ai.json 中。
     */
    async step(ctx) {
        const { cwd, aiDir, tasksDir, taskId, metaPath } = ctx;
        const logs = [];
        const taskDir = resolve(tasksDir, taskId);
        const planningDir = resolve(taskDir, "planning");
        fs.ensureDirSync(planningDir);
        const transcriptPath = resolve(planningDir, "planning.transcript.jsonl");

        const entries = loadPlanningTranscript(transcriptPath);
        const userBrief = readLatestBrief(entries);
        if (!userBrief) {
            logs.push("未在 planning.transcript.jsonl 中找到本轮任务描述，请先写入 brief。");
            return { logs };
        }

        const history = buildHistoryFromTranscript(entries);
        const draft = ensurePlanningDraft({ tasksDir, taskId });
        let userBriefPayload = userBrief;
        let previousReportUsed = false;

        try {
            const latestReportPath = resolve(
                tasksDir,
                taskId,
                "reports",
                "planning",
                "latest",
                "planning.report.md"
            );
            if (fs.existsSync(latestReportPath)) {
                const report = readFileSync(latestReportPath, "utf-8").trim();
                if (report) {
                    userBriefPayload = `${userBrief}\n\n[PREVIOUS_PLANNING_REPORT]\n${report}`;
                    previousReportUsed = true;
                }
            }
        } catch {
            // ignore report loading errors
        }

        let planning = null;
        let usedRound = 0;

        try {
            const round = nextRoundFromTranscript(entries);
            const res = await callPlanningOnce({
                cwd,
                aiDir,
                tasksDir,
                taskId,
                userBrief: userBriefPayload,
                history,
                round,
                draft
            });

            if (res.planning) {
                planning = res.planning;
                usedRound = round;
            }
        } catch (e) {
            logs.push(`AI 规划调用失败：${e.message || e}`);
            return { logs };
        }

        if (!planning) {
            logs.push("AI 规划未返回有效规划结果。");
            return { logs };
        }

        try {
            writePlanningDraft({ tasksDir, taskId, planning });
        } catch {
            // best-effort 保存草案
        }

        try {
            await applyPlanningAndOpenSpec({ cwd, aiDir, tasksDir, taskId, metaPath, planning });
            const rounds = usedRound || 1;
            const reqCount = Array.isArray(planning.requirements) ? planning.requirements.length : 0;
            const files = Array.isArray(planning.draft_files) ? planning.draft_files : [];
            const why = planning.why || "";
            const what = planning.what || "";
            const tasks = Array.isArray(planning.tasks) ? planning.tasks : [];
            const risks = Array.isArray(planning.risks) ? planning.risks : planning.risks ? [planning.risks] : [];
            const acceptance = Array.isArray(planning.acceptance)
                ? planning.acceptance
                : planning.acceptance
                ? [planning.acceptance]
                : [];

            logs.push(chalk.cyan(`已通过 AI + openspec 生成 plan：.ai-tools-chain/tasks/${taskId}/planning/plan.md`));
            logs.push(chalk.gray(`规划详情：.ai-tools-chain/tasks/${taskId}/planning/planning.ai.json（含 draft_files）`));
            logs.push(chalk.cyan("\n规划摘要："));
            logs.push(`  标题：${planning.title || `Task ${taskId}`}`);
            if (why) logs.push(`  Why：${why}`);
            if (what) logs.push(`  What：${what}`);
            logs.push(`  需求数量：${reqCount}`);
            if (files.length) {
                logs.push(`  建议改动文件（draft_files）：${files.join(", ")}`);
            } else {
                logs.push(
                    "  建议改动文件（draft_files）：(未提供，请必要时补充 plan.files.json)"
                );
            }
            if (tasks.length) {
                const preview = tasks.slice(0, 5);
                logs.push("  AI 拟定的主要任务：");
                preview.forEach((t, idx) => {
                    logs.push(`    ${idx + 1}. ${t}`);
                });
                if (tasks.length > preview.length) {
                    logs.push(chalk.gray(`    ... 其余 ${tasks.length - preview.length} 项略`));
                }
            }
            if (risks.length) {
                logs.push("  AI 关注的主要风险：");
                risks.slice(0, 5).forEach((r) => {
                    logs.push(`    - ${r}`);
                });
            }
            if (acceptance.length) {
                logs.push("  关键验收条件：");
                acceptance.slice(0, 5).forEach((a) => {
                    logs.push(`    - ${a}`);
                });
            }
            if (previousReportUsed) {
                logs.push(
                    chalk.gray("  已自动把上一版规划报告作为输入上下文，辅助 Workshop 对比新旧方案。")
                );
            }
            if (rounds > 1) {
                logs.push(chalk.gray(`  AI 共进行了 ${rounds - 1} 轮澄清问答。`));
            } else {
                logs.push(chalk.gray("  AI 认为现有信息已足够，无需额外澄清。"));
            }

            // 在 /plan 阶段内部串联规划审查与规划会议视角
            try {
                const review = runPlanReviewCore({ tasksDir, taskId });
                logs.push(
                    chalk.cyan(
                        `已生成规划审查结果：.ai-tools-chain/tasks/${taskId}/planning/plan-review.json`
                    )
                );
                logs.push(
                    chalk.gray(
                        `人类可读版：.ai-tools-chain/tasks/${taskId}/planning/plan-review.md`
                    )
                );
                if (!review.ok) {
                    logs.push(
                        chalk.yellow(
                            "提示：规划存在阻塞性问题，建议在进入 codegen 前先根据审查结果修正规划。"
                        )
                    );
                }
            } catch (e) {
                logs.push(
                    chalk.yellow(
                        `规划审查（plan-review）阶段内部执行失败：${e.message || e}（已跳过，不影响本轮规划产物写入）`
                    )
                );
            }

            try {
                const meetingAgent = new PlanningMeetingAgent();
                const meetingResult = await meetingAgent.step({
                    cwd,
                    aiDir,
                    tasksDir,
                    taskId,
                    metaPath
                });
                (meetingResult.logs || []).forEach((ln) => logs.push(ln));
            } catch (e) {
                logs.push(
                    chalk.yellow(
                        `规划会议视角（planning_meeting）生成失败：${e.message || e}（已跳过，不影响本轮规划产物写入）`
                    )
                );
            }

            logs.push(
                chalk.gray(
                    `\n详细规划文件：.ai-tools-chain/tasks/${taskId}/planning/plan.md（供人工查看）`
                )
            );
            logs.push(
                chalk.gray(
                    `结构化规划 JSON：.ai-tools-chain/tasks/${taskId}/planning/planning.ai.json（供后续阶段使用）`
                )
            );
            logs.push(
                chalk.gray(
                    "下一步可：直接 /codegen 进入生成，或使用 /next 根据当前状态查看推荐。"
                )
            );

            // 简短汇总本轮规划会议的多角色结论（如果存在）
            try {
                const meetingPath = resolve(
                    tasksDir,
                    taskId,
                    "planning",
                    "planning.meeting.json"
                );
                const raw = readFileSync(meetingPath, "utf-8");
                const meeting = JSON.parse(raw);
                const round = Array.isArray(meeting.rounds) ? meeting.rounds[0] : null;
                if (round) {
                    const decision = round.decision || "unknown";
                    const perRole = round.per_role_verdicts || {};
                    logs.push(chalk.cyan("\n本轮规划会议总体决策："));
                    logs.push(`  decision: ${decision}`);
                    const roles = [
                        "ProductPlanner",
                        "SystemDesigner",
                        "SeniorDeveloper",
                        "TestPlanner",
                        "RiskPlanner"
                    ];
                    logs.push(chalk.cyan("各角色红灯摘要："));
                    roles.forEach((role) => {
                        const v = perRole[role];
                        let status = "未知";
                        if (v && v.ok === true) status = "OK";
                        else if (v && v.ok === false) status = "NOT_OK";
                        logs.push(`  - ${role}: ${status}`);
                    });
                    logs.push(
                        chalk.gray(
                            "你可以继续用自然语言和规划教练对话，澄清问题后再次运行 /plan 生成新一版规划。"
                        )
                    );
                }
            } catch {
                // best-effort 展示会议摘要，失败时忽略
            }

            return {
                logs,
                statePatch: {
                    phase: "planning_done",
                    actors: {
                        planning: { round: usedRound, status: "completed" }
                    }
                }
            };
        } catch (e) {
            logs.push(`基于 AI 规划生成 OpenSpec 失败：${e.message || e}`);
            return { logs };
        }
    }
}
