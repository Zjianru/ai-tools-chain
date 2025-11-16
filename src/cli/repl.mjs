import chalk from "chalk";
import fs from "fs-extra";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { resolve, dirname } from "path";
import readline from "readline";
import { execa } from "execa";
import { readIni, loadMasks, ensureProjectInited, createNewTask, autoArchiveOldTasks, nowISO } from "../core/task.mjs";
import { loadTaskState, applyStatePatch } from "../core/state.mjs";
import { suggestNextFromState, redoPhase } from "../core/orchestrator.mjs";
import { runPlanningWithInputs } from "../core/planning.mjs";
import { runCodegenCore } from "../core/codegen.mjs";
import { runReviewCore } from "../core/review.mjs";
import { runEvalCore } from "../core/eval.mjs";
import { runAcceptCore } from "../core/accept.mjs";
import { PlanningAgent } from "../agents/planningAgent.mjs";
import { PlanReviewAgent } from "../agents/planReviewAgent.mjs";
import { CodegenAgent } from "../agents/codegenAgent.mjs";
import { CodeReviewAgent } from "../agents/codeReviewAgent.mjs";
import { TestAgent } from "../agents/testAgent.mjs";
import { ReviewMeetingAgent } from "../agents/reviewMeetingAgent.mjs";
import { AcceptAgent } from "../agents/acceptAgent.mjs";
import { RevertAgent } from "../agents/revertAgent.mjs";

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

    async function runManualPlan(lineRaw, aiDir, tasksDir, taskId, metaPath) {
        const rest = lineRaw.slice("/plan".length).trim();
        const title = rest || await ask(chalk.cyan("本轮任务的标题/目标是？ > "));
        const why = await ask(chalk.cyan("为什么要做这件事（Why）？ > "));
        const what = await ask(chalk.cyan("大致打算做哪些改动（What Changes）？ > "));
        const req = await ask(chalk.cyan("关键需求/要点（Requirements，逗号分隔）？ > "));
        const targets = await ask(chalk.cyan("主要涉及哪些文件或模块（Targets，逗号分隔）？ > "));
        const risks = await ask(chalk.cyan("主要风险与缓解方式（Risks & Mitigations）？ > "));
        const accept = await ask(chalk.cyan("验收标准（Acceptance，逗号分隔）？ > "));

        await runPlanningWithInputs({
            cwd,
            aiDir,
            tasksDir,
            taskId,
            metaPath,
            inputs: { title, why, what, req, targets, risks, accept }
        });

        console.log(chalk.cyan(`已根据 openspec change 生成 plan：.ai-tools-chain/tasks/${taskId}/planning/plan.md`));
    }

    function appendPlanningJSONL(tasksDir, taskId, obj) {
        const taskDir = resolve(tasksDir, taskId);
        const planningDir = resolve(taskDir, "planning");
        fs.ensureDirSync(planningDir);
        const p = resolve(planningDir, "planning.transcript.jsonl");
        fs.ensureDirSync(dirname(p));
        appendFileSync(p, JSON.stringify(obj) + "\n", "utf-8");
    }

    rl.on("line", async (lineRaw) => {
        if (askResolver) {
            const resolver = askResolver;
            askResolver = null;
            const answer = lineRaw.trim();
            // 恢复默认提示符，避免后续仍显示上一次问题文案
            rl.setPrompt(defaultPrompt);
            resolver(answer);
            return;
        }
        const line = lineRaw.trim();
        if (!line) { rl.prompt(); return; }

        if (line.startsWith("/")) {
            const cmd = line.split(/\s+/)[0].toLowerCase();
            if (cmd === "/quit" || cmd === "/exit") {
                console.log(chalk.yellow("REPL 结束。"));
                rl.close();
                return;
            }
            if (cmd === "/plan") {
                const rest = lineRaw.slice(cmd.length).trim();
                const brief = rest || await ask(chalk.cyan("用一两句话描述这次你想完成的改动（回车结束） > "));
                try {
                    const agent = new PlanningAgent();
                    appendPlanningJSONL(tasksDir, taskId, {
                        ts: nowISO(),
                        role: "user",
                        kind: "brief",
                        text: brief
                    });

                    let roundCount = 0;
                    const maxRounds = 5;
                    let plannedByAI = false;
                    while (roundCount < maxRounds) {
                        const result = await agent.step({ cwd, aiDir, tasksDir, taskId, metaPath });
                        (result.logs || []).forEach((ln) => console.log(ln));
                        if (result.statePatch) {
                            applyStatePatch(tasksDir, taskId, result.statePatch);
                        }

                        if (result.questions && result.questions.length) {
                            const round = result.round || (roundCount + 1);
                            for (let i = 0; i < result.questions.length; i += 1) {
                                const q = result.questions[i];
                                const ans = await ask(chalk.cyan(`${q} > `));
                                appendPlanningJSONL(tasksDir, taskId, {
                                    ts: nowISO(),
                                    role: "user",
                                    kind: "clarify_answer",
                                    round,
                                    index: i + 1,
                                    text: ans
                                });
                            }
                            roundCount += 1;
                            if (roundCount >= maxRounds) {
                                console.log(chalk.yellow("已达到本轮澄清上限，将基于当前草案生成规划（如可能）。"));
                                const finalResult = await agent.step({ cwd, aiDir, tasksDir, taskId, metaPath });
                                (finalResult.logs || []).forEach((ln) => console.log(ln));
                                if (finalResult.statePatch) {
                                    applyStatePatch(tasksDir, taskId, finalResult.statePatch);
                                }
                                if (finalResult.logs && finalResult.logs.length) {
                                    plannedByAI = true;
                                } else if (!finalResult.logs && !finalResult.questions) {
                                    console.log(chalk.gray("AI 未能在澄清上限内给出完整规划，可考虑改用手动规划。"));
                                }
                                break;
                            }
                            continue;
                        }

                        if (!result.questions) {
                            if (!result.logs || !result.logs.length) {
                                console.log(chalk.yellow("AI 规划未返回结果，将回退到手动问答流程。"));
                                await runManualPlan(lineRaw, aiDir, tasksDir, taskId, metaPath);
                            }
                            if (result.logs && result.logs.length) {
                                plannedByAI = true;
                            }
                            break;
                        }
                    }

                    // 规划完成后自动触发一次规划审查（PlanReviewAgent）与规划会议纪要（PlanningMeetingAgent）
                    if (plannedByAI) {
                        try {
                            const planReviewAgent = new PlanReviewAgent();
                            const reviewResult = await planReviewAgent.step({ cwd, aiDir, tasksDir, taskId, metaPath });
                            (reviewResult.logs || []).forEach((ln) => console.log(ln));
                            if (reviewResult.statePatch) {
                                applyStatePatch(tasksDir, taskId, reviewResult.statePatch);
                            }
                            const { PlanningMeetingAgent } = await import("../agents/planningMeetingAgent.mjs");
                            const meetingAgent = new PlanningMeetingAgent();
                            const meetingResult = await meetingAgent.step({ cwd, aiDir, tasksDir, taskId, metaPath });
                            (meetingResult.logs || []).forEach((ln) => console.log(ln));
                            if (meetingResult.statePatch) {
                                applyStatePatch(tasksDir, taskId, meetingResult.statePatch);
                            }
                        } catch (e) {
                            console.log(chalk.yellow("规划已生成，但自动规划审查失败："), e.message || e);
                        }
                    }
                } catch (e) {
                    console.log(chalk.yellow("AI 规划失败，回退到手动问答："), e.message || e);
                    await runManualPlan(lineRaw, aiDir, tasksDir, taskId, metaPath);
                }
                rl.prompt();
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
                const cfgTask = cfg?.task || {};
                const ans = await ask(chalk.yellow("将要生成代码并写入工作区。请输入中文强确认短语“确认生成”继续，或回车取消 > "));
                if (ans !== "确认生成") {
                    console.log(chalk.yellow("已取消 codegen。"));
                    rl.prompt();
                    return;
                }

                let branchName = null;
                const perTask = String(cfgTask.per_task_branch || "false") === "true";
                if (perTask) {
                    const defType = "feat";
                    const defSlug = "task";
                    const type = await ask(chalk.cyan(`分支类型（默认 ${defType}）> `)) || defType;
                    const slug = await ask(chalk.cyan(`分支 slug（默认 ${defSlug}）> `)) || defSlug;
                    branchName = (cfgTask.branch_pattern || "{type}/{slug}-task-{id}")
                        .replaceAll("{type}", type)
                        .replaceAll("{slug}", slug)
                        .replaceAll("{id}", taskId);
                    console.log(chalk.gray(`创建分支：${branchName}`));
                }

                try {
                    const agent = new CodegenAgent();
                    const result = await agent.step({
                        cwd,
                        aiDir,
                        tasksDir,
                        taskId,
                        metaPath,
                        cfg,
                        branchName,
                        repoSummaryOverride: "(可选) 这里可以用 git ls-files + 目录树生成概览"
                    });
                    (result.logs || []).forEach((ln) => console.log(ln));
                    if (result.statePatch) {
                        applyStatePatch(tasksDir, taskId, result.statePatch);
                    }
                } catch (e) {
                    console.log(chalk.red("codegen 失败："), e.message || e);
                }
                rl.prompt();
                return;
            }

            if (cmd === "/review") {
                try {
                    const agent = new CodeReviewAgent();
                    const result = await agent.step({ cwd, aiDir, tasksDir, taskId, cfg });
                    (result.logs || []).forEach((ln) => console.log(ln));
                    if (result.statePatch) {
                        applyStatePatch(tasksDir, taskId, result.statePatch);
                    }

                    try {
                        const meetingAgent = new ReviewMeetingAgent();
                        const meeting = await meetingAgent.step({
                            cwd,
                            aiDir,
                            tasksDir,
                            taskId
                        });
                        (meeting.logs || []).forEach((ln) => console.log(ln));
                        if (meeting.statePatch) {
                            applyStatePatch(tasksDir, taskId, meeting.statePatch);
                        }
                    } catch (e) {
                        console.log(
                            chalk.yellow("review 已完成，但会议纪要生成失败："),
                            e.message || e
                        );
                    }
                } catch (e) {
                    console.log(chalk.red("review 失败："), e.message || e);
                }
                rl.prompt();
                return;
            }

            if (cmd === "/accept") {
                try {
                    const acceptAgent = new AcceptAgent();
                    // 先做 gate 判定
                    const gateResult = await acceptAgent.step({
                        cwd,
                        aiDir,
                        tasksDir,
                        taskId,
                        metaPath,
                        cfg
                    });
                    (gateResult.logs || []).forEach((ln) => console.log(ln));
                    if (gateResult.statePatch) {
                        applyStatePatch(tasksDir, taskId, gateResult.statePatch);
                    }

                    const gate = gateResult.gate;
                    if (!gate) {
                        console.log(chalk.red("未获取到 gate 结果，无法继续提交。"));
                        rl.prompt();
                        return;
                    }

                    if (!gate.ok && gate.reason === "gate_failed") {
                        console.log(chalk.red("评测 gate 未通过，已阻断提交。可修复后重试。"));
                        rl.prompt();
                        return;
                    }

                    let overrideGate = false;
                    if (!gate.ok && gate.reason === "needs_override" && gate.allowOverride) {
                        const phrase = gate.overridePhrase || (cfg?.confirm?.override_phrase || "确认合入").trim();
                        const ans = await ask(chalk.yellow(`评测失败。输入强确认短语“${phrase}”以继续提交，或回车取消 > `));
                        if (ans !== phrase) {
                            console.log(chalk.yellow("已取消提交。"));
                            rl.prompt();
                            return;
                        }
                        overrideGate = true;
                    }

                    const sum = await ask(chalk.cyan("请输入本次提交摘要（留空则使用默认）> "));
                    const msg = `feat(atc): codegen for task ${taskId}` + (sum ? ` – ${sum}` : "");
                    const commitAgent = new AcceptAgent();
                    const commitResult = await commitAgent.step({
                        cwd,
                        aiDir,
                        tasksDir,
                        taskId,
                        metaPath,
                        cfg,
                        commitMessage: msg,
                        overrideGate
                    });
                    (commitResult.logs || []).forEach((ln) => console.log(ln));
                    if (commitResult.statePatch) {
                        applyStatePatch(tasksDir, taskId, commitResult.statePatch);
                    }
                } catch (e) {
                    console.log(chalk.red("accept 失败："), e.message || e);
                }
                rl.prompt();
                return;
            }

            if (cmd === "/revert") {
                const ok = await ask(chalk.yellow("将回滚本次 codegen 改动。输入 YES 确认 > "));
                if (ok !== "YES") { console.log(chalk.yellow("已取消。")); rl.prompt(); return; }

                try {
                    const agent = new RevertAgent();
                    const result = await agent.step({ cwd, tasksDir, taskId, metaPath });
                    (result.logs || []).forEach((ln) => console.log(ln));
                    if (result.statePatch) {
                        applyStatePatch(tasksDir, taskId, result.statePatch);
                    }
                } catch (e) {
                    console.log(chalk.red("revert 失败："), e.message || e);
                }
                rl.prompt();
                return;
            }

            if (cmd === "/eval") {
                const ok = await ask(chalk.yellow("将按 eval.conf 执行评测。输入 “开始评测” 继续，或回车取消 > "));
                if (ok !== "开始评测") {
                    console.log(chalk.yellow("已取消评测。"));
                    rl.prompt();
                    return;
                }

                try {
                    const agent = new TestAgent();
                    const result = await agent.step({ cwd, aiDir, tasksDir, taskId });
                    (result.logs || []).forEach((ln) => console.log(ln));
                    await autoArchiveOldTasks(aiDir);
                    if (result.statePatch) {
                        applyStatePatch(tasksDir, taskId, result.statePatch);
                    }
                } catch (e) {
                    console.log(chalk.red("评测执行失败："), e.message || e);
                }
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
