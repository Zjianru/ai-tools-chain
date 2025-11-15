import chalk from "chalk";
import fs from "fs-extra";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { callPlanningOnce, applyPlanningAndOpenSpec } from "../core/planning.mjs";
import { nowISO } from "../core/task.mjs";

function appendJSONL(file, obj) {
    fs.ensureDirSync(dirname(file));
    writeFileSync(file, JSON.stringify(obj) + "\n", { flag: "a", encoding: "utf-8" });
}

export class PlanningAgent {
    constructor() {
        this.name = "planning";
    }

    /**
     * step({ cwd, aiDir, tasksDir, taskId, metaPath }, { from, content })
     */
    async step(ctx, msg) {
        const { cwd, aiDir, tasksDir, taskId, metaPath } = ctx;
        const userBrief = (msg?.content || "").trim();
        const history = [];
        const maxRounds = 3;
        let planning = null;
        let usedRound = 0;
        const logs = [];
        const transcriptPath = resolve(tasksDir, taskId, "planning.transcript.jsonl");

        if (!userBrief) {
            logs.push("未提供任务描述，无法启动 AI 规划。");
            return { logs };
        }

        try {
            for (let round = 1; round <= maxRounds; round++) {
                const res = await callPlanningOnce({
                    cwd,
                    aiDir,
                    tasksDir,
                    taskId,
                    userBrief,
                    history,
                    round
                });

                const status = res.status || "ready";
                const questions = Array.isArray(res.questions) ? res.questions : [];

                if (status === "need_clarification" && questions.length > 0 && round < maxRounds) {
                    const qa = { round, questions: [], answers: [] };
                    for (const q of questions) {
                        qa.questions.push(q);
                        // 这里只记录问题，具体提问和回答由 UI/REPL 完成后再将 answers 写回 history
                        appendJSONL(transcriptPath, {
                            ts: nowISO(),
                            role: "assistant",
                            round,
                            question: q
                        });
                    }
                    history.push(qa);
                    logs.push(`第 ${round} 轮：AI 认为信息不足，需要进一步澄清 ${questions.length} 个问题。`);
                    // 交给 UI 层根据 questions 发起提问
                    return { logs, questions };
                }

                if (res.planning) {
                    planning = res.planning;
                    usedRound = round;
                    break;
                }
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
            await applyPlanningAndOpenSpec({ cwd, aiDir, tasksDir, taskId, metaPath, planning });
            const rounds = usedRound || 1;
            const reqCount = Array.isArray(planning.requirements) ? planning.requirements.length : 0;
            const files = Array.isArray(planning.draft_files) ? planning.draft_files : [];

            logs.push(chalk.cyan(`已通过 AI + openspec 生成 plan：.ai-tools-chain/tasks/${taskId}/plan.md`));
            logs.push(chalk.gray(`规划详情：.ai-tools-chain/tasks/${taskId}/planning.ai.json（含 draft_files）`));
            logs.push(chalk.cyan("\n规划摘要："));
            logs.push(`  标题：${planning.title || `Task ${taskId}`}`);
            logs.push(`  需求数量：${reqCount}`);
            logs.push(`  建议改动文件：${files.length ? files.join(", ") : "(未提供 draft_files，请必要时补充 plan.files.json)"}`);
            if (rounds > 1) {
                logs.push(chalk.gray(`  AI 共进行了 ${rounds - 1} 轮澄清问答。`));
            } else {
                logs.push(chalk.gray("  AI 认为现有信息已足够，无需额外澄清。"));
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

