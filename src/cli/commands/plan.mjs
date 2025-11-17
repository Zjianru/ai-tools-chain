import chalk from "chalk";
import fs from "fs-extra";
import { appendFileSync } from "fs";
import { resolve, dirname } from "path";
import { nowISO } from "../../core/task.mjs";
import { applyStatePatch } from "../../core/state.mjs";
import { PlanningAgent } from "../../agents/planningAgent.mjs";

/**
 * /plan 命令处理：
 * - 获取 brief，写入 planning.transcript.jsonl；
 * - 调用 PlanningAgent 生成 planning.ai.json / plan.md 等产物；
 * - 如模型需要澄清，会在同一 /plan 会话中多轮提问/回答；
 * - 打印日志并应用 statePatch。
 */
export async function handlePlanCommand({
    lineRaw,
    cwd,
    aiDir,
    tasksDir,
    taskId,
    metaPath,
    cfg,
    ask
}) {
    const taskDir = resolve(tasksDir, taskId);
    fs.ensureDirSync(taskDir);

    const rest = lineRaw.slice("/plan".length).trim();
    let brief = rest;
    if (!brief) {
        brief = await ask(
            chalk.cyan("请输入本轮任务的标题/目标和简要需求（将作为 planning 的 brief）> ")
        );
        if (!brief.trim()) {
            console.log(chalk.yellow("未提供有效 brief，已取消 /plan。"));
            return;
        }
    }

    const planningTranscript = resolve(tasksDir, taskId, "planning", "planning.transcript.jsonl");
    fs.ensureDirSync(dirname(planningTranscript));
    appendFileSync(
        planningTranscript,
        JSON.stringify({
            ts: nowISO(),
            role: "user",
            kind: "brief",
            text: brief
        }) + "\n",
        "utf-8"
    );

    const ctxBase = { cwd, aiDir, tasksDir, taskId, metaPath, cfg };
    try {
        const agent = new PlanningAgent();
        let result = await agent.step(ctxBase);
        (result.logs || []).forEach((ln) => console.log(ln));

        // 如规划模型需要澄清，在同一 /plan 会话内引导用户回答澄清问题，然后再次调用 planning。
        let safety = 0;
        let lastQuestionsKey = null;
        while (result.questions && result.questions.length && safety < 5) {
            const key = JSON.stringify(result.questions);
            if (lastQuestionsKey && lastQuestionsKey === key) {
                console.log(
                    chalk.gray(
                        "AI 再次提出完全相同的澄清问题，已认为信息足够，将直接进入规划生成。"
                    )
                );
                break;
            }
            lastQuestionsKey = key;

            safety += 1;
            const round = result.round || 1;
            for (let idx = 0; idx < result.questions.length; idx += 1) {
                const q = result.questions[idx];
                const answer = await ask(
                    chalk.cyan(
                        `第 ${round} 轮澄清问题 ${idx + 1}/${result.questions.length}：${q}\n> `
                    )
                );
                appendFileSync(
                    planningTranscript,
                    JSON.stringify({
                        ts: nowISO(),
                        role: "user",
                        kind: "clarify_answer",
                        round,
                        index: idx + 1,
                        text: answer
                    }) + "\n",
                    "utf-8"
                );
            }

            result = await agent.step(ctxBase);
            (result.logs || []).forEach((ln) => console.log(ln));
        }

        if (result.statePatch) {
            applyStatePatch(tasksDir, taskId, result.statePatch);
        }
    } catch (e) {
        console.log(chalk.red("AI 规划失败："), e.message || e);
    }
}
