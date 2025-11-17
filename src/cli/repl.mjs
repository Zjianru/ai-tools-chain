import chalk from "chalk";
import fs from "fs-extra";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { resolve, dirname } from "path";
import readline from "readline";
import { execa } from "execa";
import { readIni, loadMasks, ensureProjectInited, createNewTask, autoArchiveOldTasks, nowISO } from "../core/task.mjs";
import { loadTaskState, applyStatePatch } from "../core/state.mjs";
import { suggestNextFromState, redoPhase } from "../core/orchestrator.mjs";
import { PlanningAgent } from "../agents/planningAgent.mjs";
import { PlanReviewAgent } from "../agents/planReviewAgent.mjs";
import { CodegenAgent } from "../agents/codegenAgent.mjs";
import { CodeReviewAgent } from "../agents/codeReviewAgent.mjs";
import { TestAgent } from "../agents/testAgent.mjs";
import { ReviewMeetingAgent } from "../agents/reviewMeetingAgent.mjs";
import { handlePlanCommand } from "./commands/plan.mjs";
import { handleReviewCommand } from "./commands/review.mjs";
import { handleAcceptCommand } from "./commands/accept.mjs";
import { handleRevertCommand } from "./commands/revert.mjs";
import { handleEvalCommand } from "./commands/eval.mjs";
import { handleCodegenCommand } from "./commands/codegen.mjs";

async function promptLine(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return await new Promise((resolve) => rl.question(question, (ans) => {
        rl.close();
        resolve(ans.trim());
    }));
}

function appendJSONL(file, obj) {
    fs.ensureDirSync(dirname(file));
    appendFileSync(file, JSON.stringify(obj) + "\n", "utf-8");
}

async function ensureTaskForRepl(aiDir, cfg) {
    const tasksDir = resolve(aiDir, "tasks");
    fs.ensureDirSync(tasksDir);
    const lastFile = resolve(aiDir, ".last_task");
    let taskId = existsSync(lastFile) ? readFileSync(lastFile, "utf-8").trim() : "";
    const resume = taskId && existsSync(resolve(tasksDir, taskId));
    if (resume) {
        const ans = await promptLine(chalk.cyan(`检测到上次任务 ${taskId}，是否继续？(yes/new) > `));
        if (ans.toLowerCase() === "new") taskId = "";
    }
    if (!taskId) {
        const created = createNewTask(aiDir, cfg);
        taskId = created.taskId;
    }
    const metaPath = resolve(tasksDir, taskId, "meta.json");
    return { taskId, tasksDir, metaPath };
}

export async function runRepl(cwd) {
    const aiDir = ensureProjectInited(cwd);
    const confPath = resolve(aiDir, "config", "toolchain.conf");
    const cfg = readIni(confPath, {});
    const mask = loadMasks(confPath);

    await autoArchiveOldTasks(aiDir);

    const { taskId, tasksDir, metaPath } = await ensureTaskForRepl(aiDir, cfg);
    loadTaskState(tasksDir, taskId);

    console.log(chalk.green(`\nREPL 已启动。Task: ${taskId}`));
    console.log(chalk.gray(`日志：.ai-tools-chain/tasks/${taskId}/transcript.jsonl`));
    console.log(
        chalk.gray(
            "命令：/plan  /planreview  /review  /codegen  /eval  /accept  /revert  /status  /next  /redo  /quit"
        )
    );

    const tlog = resolve(tasksDir, taskId, "transcript.jsonl");

    const defaultPrompt = "> ";
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: defaultPrompt });
    rl.prompt();

    let askResolver = null;
    const ask = (question) => new Promise((resolveAns) => {
        askResolver = resolveAns;
        rl.setPrompt(question);
        rl.prompt();
    });


    rl.on("line", async (lineRaw) => {
        if (askResolver) {
            const resolver = askResolver;
            askResolver = null;
            const answer = lineRaw.trim();
            rl.setPrompt(defaultPrompt);
            resolver(answer);
            return;
        }
        const line = lineRaw.trim();
        if (!line) {
            rl.prompt();
            return;
        }

        if (line.startsWith("/")) {
            const cmd = line.split(/\s+/)[0].toLowerCase();
            if (cmd === "/quit" || cmd === "/exit") {
                console.log(chalk.yellow("REPL 结束。"));
                rl.close();
                return;
            }
            if (cmd === "/plan") {
                await handlePlanCommand({ lineRaw, cwd, aiDir, tasksDir, taskId, metaPath, cfg, ask });
                return;
            }

            if (cmd === "/status") {
                try {
                    const state = loadTaskState(tasksDir, taskId);
                    console.log(chalk.cyan("\n当前任务状态（state.json）："));
                    console.log(JSON.stringify(state, null, 2));
                } catch (e) {
                    console.log(chalk.red("读取 task 状态失败："), e.message || e);
                }
                rl.prompt();
                return;
            }

            if (cmd === "/next") {
                try {
                    const suggestion = suggestNextFromState(tasksDir, taskId);
                    if (!suggestion.phase) {
                        console.log(chalk.green("Orchestrator 没有推荐的下一阶段（可能已经在最后阶段）。"));
                        rl.prompt();
                        return;
                    }
                    const phase = suggestion.phase;
                    const extra = suggestion.details
                        ? `，详情：${JSON.stringify(suggestion.details)}`
                        : "";
                    console.log(
                        chalk.cyan(`Orchestrator 推荐下一阶段：${phase}（${suggestion.reason}${extra}）`)
                    );

                    // 根据阶段选择对应 Agent
                    const ctxBase = { cwd, aiDir, tasksDir, taskId, metaPath, cfg };
                    let agent = null;
                    if (phase === "planning") agent = new PlanningAgent();
                    else if (phase === "plan_review") agent = new PlanReviewAgent();
                    else if (phase === "codegen") agent = new CodegenAgent();
                    else if (phase === "code_review") agent = new CodeReviewAgent();
                    else if (phase === "code_review_meeting") agent = new ReviewMeetingAgent();
                    else if (phase === "test") agent = new TestAgent();
                    // accept 阶段可由 /accept 命令显式触发，这里只做推荐，不自动执行
                    if (phase === "accept") {
                        console.log(
                            chalk.yellow(
                                "已建议进入 accept 阶段，请使用 /accept 命令完成 gate 判定与提交。"
                            )
                        );
                        rl.prompt();
                        return;
                    }

                    if (!agent) {
                        console.log(chalk.yellow(`暂不支持通过 /next 自动执行阶段：${phase}`));
                        rl.prompt();
                        return;
                    }

                    const result = await agent.step(ctxBase);
                    (result.logs || []).forEach((ln) => console.log(ln));
                    if (result.statePatch) {
                        applyStatePatch(tasksDir, taskId, result.statePatch);
                    }
                } catch (e) {
                    console.log(chalk.red("/next 执行失败："), e.message || e);
                }
                rl.prompt();
                return;
            }

            if (cmd === "/redo") {
                const parts = line.split(/\s+/);
                const phase = parts[1];
                if (!phase) {
                    console.log(chalk.yellow("用法：/redo <phase>，例如 /redo planning 或 /redo codegen"));
                    rl.prompt();
                    return;
                }
                try {
                    const state = redoPhase(tasksDir, taskId, phase);
                    console.log(chalk.cyan("已更新任务阶段："));
                    console.log(JSON.stringify(state, null, 2));
                    console.log(chalk.yellow("注意：/redo 仅修改状态，不自动回滚代码。如需回滚，请配合 /revert 使用。"));
                } catch (e) {
                    console.log(chalk.red("/redo 执行失败："), e.message || e);
                }
                rl.prompt();
                return;
            }

            if (cmd === "/planreview") {
                try {
                    const agent = new PlanReviewAgent();
                    const result = await agent.step({ cwd, aiDir, tasksDir, taskId, metaPath });
                    (result.logs || []).forEach((ln) => console.log(ln));
                    if (result.statePatch) {
                        applyStatePatch(tasksDir, taskId, result.statePatch);
                    }
                } catch (e) {
                    console.log(chalk.red("计划审查失败："), e.message || e);
                }
                rl.prompt();
                return;
            }

            if (cmd === "/codegen") {
                await handleCodegenCommand({ line, cfg, cwd, aiDir, tasksDir, taskId, metaPath, ask });
                rl.prompt();
                return;
            }

            if (cmd === "/review") {
                await handleReviewCommand({ cwd, aiDir, tasksDir, taskId, cfg });
                rl.prompt();
                return;
            }

            if (cmd === "/accept") {
                await handleAcceptCommand({ cwd, aiDir, tasksDir, taskId, metaPath, cfg, ask });
                rl.prompt();
                return;
            }

            if (cmd === "/revert") {
                await handleRevertCommand({ cwd, tasksDir, taskId, metaPath, ask });
                rl.prompt();
                return;
            }

            if (cmd === "/eval") {
                await handleEvalCommand({ cwd, aiDir, tasksDir, taskId, ask });
                rl.prompt();
                return;
            }

            console.log(chalk.red("未知命令。可用：/plan /planreview /review /codegen /eval /accept /revert /quit"));
            rl.prompt();
            return;
        }

        const masked = mask(line);
        appendJSONL(tlog, { ts: nowISO(), role: "user", text: masked, stage: "draft" });

        const dict = (cfg?.confirm?.fallback_dict || "")
            .split(",").map((s) => s.trim()).filter(Boolean);
        if (dict.length > 0) {
            const hit = dict.some((w) => masked.includes(w));
            if (hit) {
                const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
                meta.status = "pending_confirm";
                writeFileSync(metaPath, JSON.stringify(meta, null, 2));
                console.log(chalk.green("检测到强确认关键词（来自 fallback_dict）。下一步将进入 codegen。"));
            }
        } else {
            console.log(chalk.gray("提示：如需本地关键词强确认，请在 toolchain.conf 的 [confirm].fallback_dict 中添加词汇（逗号分隔）。"));
        }

        rl.prompt();
    });

    rl.on("close", () => {
        console.log(chalk.gray(`会话已保存：.ai-tools-chain/tasks/${taskId}/transcript.jsonl`));
        process.exit(0);
    });
}
