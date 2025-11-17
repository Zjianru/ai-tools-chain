import chalk from "chalk";
import fs from "fs-extra";
import { readFileSync } from "fs";
import { resolve } from "path";
import { callPlanningOnce, applyPlanningAndOpenSpec, ensurePlanningDraft, writePlanningDraft } from "../core/planning.mjs";
import { nowISO } from "../core/task.mjs";
import {
    appendJSONL,
    loadPlanningTranscript,
    buildHistoryFromTranscript,
    readLatestBrief,
    nextRoundFromTranscript
} from "../planning/transcript.mjs";

export class PlanningAgent {
    constructor() {
        this.name = "planning";
    }

    /**
     * step({ cwd, aiDir, tasksDir, taskId, metaPath })
     *
     * 说明：
     * - userBrief / history / draft 均从磁盘恢复；
     * - 调用方在追加 brief 与澄清答案后再调用本方法；
     * - 如返回 questions，调用方需在 transcript 中写入对应 round/index 的 clarify_answer。
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

        let planning = null;
        let usedRound = 0;

        try {
            const round = nextRoundFromTranscript(entries);
            const res = await callPlanningOnce({
                cwd,
                aiDir,
                tasksDir,
                taskId,
                userBrief,
                history,
                round,
                draft
            });

            const status = res.status || "ready";
            const questions = Array.isArray(res.questions) ? res.questions : [];

            if (status === "need_clarification" && questions.length > 0) {
                questions.forEach((q, idx) => {
                    appendJSONL(transcriptPath, {
                        ts: nowISO(),
                        role: "assistant",
                        kind: "clarify_question",
                        round,
                        index: idx + 1,
                        text: q
                    });
                });
                logs.push(
                    `第 ${round} 轮：AI 认为信息不足，需要进一步澄清 ${questions.length} 个问题。`
                );
                return { logs, questions, round };
            }

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
            if (rounds > 1) {
                logs.push(chalk.gray(`  AI 共进行了 ${rounds - 1} 轮澄清问答。`));
            } else {
                logs.push(chalk.gray("  AI 认为现有信息已足够，无需额外澄清。"));
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
                    "下一步可：/planreview 审查规划，或使用 /next 根据 Orchestrator 建议前进。"
                )
            );

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
