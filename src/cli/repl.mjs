import chalk from "chalk";
import fs from "fs-extra";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { resolve, dirname } from "path";
import readline from "readline";
import { execa } from "execa";
import { readIni, loadMasks, ensureProjectInited, createNewTask, autoArchiveOldTasks, nowISO } from "../core/task.mjs";
import { runPlanningWithInputs, callPlanningOnce, applyPlanningAndOpenSpec } from "../core/planning.mjs";
import { runCodegenCore } from "../core/codegen.mjs";
import { runReviewCore } from "../core/review.mjs";
import { runEvalCore } from "../core/eval.mjs";
import { runAcceptCore } from "../core/accept.mjs";

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

    console.log(chalk.green(`\nREPL 已启动。Task: ${taskId}`));
    console.log(chalk.gray(`日志：.ai-tools-chain/tasks/${taskId}/transcript.jsonl`));
            console.log(chalk.gray("命令：/plan  /review  /codegen  /eval  /accept  /revert  /quit"));

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

        console.log(chalk.cyan(`已根据 openspec change 生成 plan：.ai-tools-chain/tasks/${taskId}/plan.md`));
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
                const history = [];
                const maxRounds = 3;
                let planning = null;
                let usedRound = 0;
                try {
                    for (let round = 1; round <= maxRounds; round++) {
                        const res = await callPlanningOnce({
                            cwd,
                            aiDir,
                            tasksDir,
                            taskId,
                            userBrief: brief,
                            history,
                            round
                        });

                        const status = res.status || "ready";
                        const questions = Array.isArray(res.questions) ? res.questions : [];
                        if (status === "need_clarification" && questions.length > 0 && round < maxRounds) {
                            const qa = { round, questions: [], answers: [] };
                            for (const q of questions) {
                                const ans = await ask(chalk.cyan(`${q} > `));
                                qa.questions.push(q);
                                qa.answers.push(ans);

                                const transcriptPath = resolve(tasksDir, taskId, "planning.transcript.jsonl");
                                appendJSONL(transcriptPath, {
                                    ts: nowISO(),
                                    role: "assistant",
                                    round,
                                    question: q
                                });
                                appendJSONL(transcriptPath, {
                                    ts: nowISO(),
                                    role: "user",
                                    round,
                                    answer: ans
                                });
                            }
                            history.push(qa);
                            continue;
                        }

                        if (res.planning) {
                            planning = res.planning;
                            usedRound = round;
                            break;
                        }
                    }
                } catch (e) {
                    console.log(chalk.yellow("AI 规划失败，回退到手动问答："), e.message || e);
                }

                if (!planning) {
                    console.log(chalk.yellow("AI 规划未完成或未返回规划结果，将回退到手动问答流程。"));
                    await runManualPlan(lineRaw, aiDir, tasksDir, taskId, metaPath);
                } else {
                    try {
                        await applyPlanningAndOpenSpec({ cwd, aiDir, tasksDir, taskId, metaPath, planning });
                        console.log(chalk.cyan(`已通过 AI + openspec 生成 plan：.ai-tools-chain/tasks/${taskId}/plan.md`));
                        console.log(chalk.gray(`规划详情：.ai-tools-chain/tasks/${taskId}/planning.ai.json（含 draft_files）`));
                        const rounds = usedRound || 1;
                        const reqCount = Array.isArray(planning.requirements) ? planning.requirements.length : 0;
                        const files = Array.isArray(planning.draft_files) ? planning.draft_files : [];
                        console.log(chalk.cyan("\n规划摘要："));
                        console.log(`  标题：${planning.title || `Task ${taskId}`}`);
                        console.log(`  需求数量：${reqCount}`);
                        console.log(`  建议改动文件：${files.length ? files.join(", ") : "(未提供 draft_files，请必要时补充 plan.files.json)"}`);
                        if (rounds > 1) {
                            console.log(chalk.gray(`  AI 共进行了 ${rounds - 1} 轮澄清问答。`));
                        } else {
                            console.log(chalk.gray("  AI 认为现有信息已足够，无需额外澄清。"));
                        }
                    } catch (e) {
                        console.log(chalk.yellow("基于 AI 规划生成 OpenSpec 失败，回退到手动问答："), e.message || e);
                        await runManualPlan(lineRaw, aiDir, tasksDir, taskId, metaPath);
                    }
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
                    const result = await runCodegenCore({
                        cwd,
                        aiDir,
                        tasksDir,
                        taskId,
                        metaPath,
                        cfg,
                        branchName,
                        repoSummaryOverride: "(可选) 这里可以用 git ls-files + 目录树生成概览"
                    });

                    console.log(chalk.green("\n已生成变更，进入 review 阶段："));
                    console.log("  - patch.json");
                    console.log("  - files/*.full");
                    if (result.diffSummary) {
                        console.log(chalk.cyan("\n本次变更摘要："));
                        console.log(`  变更文件：${result.diffSummary.filesCount} 个`);
                        console.log(`  +${result.diffSummary.added} / -${result.diffSummary.deleted} 行`);
                    }
                    console.log(chalk.gray("提示：输入 /review 查看摘要；需要回滚可手动 git reset --hard 回到快照。"));
                } catch (e) {
                    console.log(chalk.red("codegen 失败："), e.message || e);
                }
                rl.prompt();
                return;
            }

            if (cmd === "/review") {
                try {
                    const result = await runReviewCore({ cwd, aiDir, tasksDir, taskId, cfg });
                    console.log(chalk.cyan("\n本次变更摘要："));
                    console.log(`  变更文件：${result.summary.filesCount} 个`);
                    console.log(`  +${result.summary.added} / -${result.summary.deleted} 行`);
                    if (result.files.length) {
                        const marks = result.files.map((f) => (f.danger ? `! ${f.path}` : `  ${f.path}`));
                        console.log(chalk.gray("  文件：\n    " + marks.join("\n    ")));
                    } else {
                        console.log(chalk.gray("  （当前没有可展示的 diff）"));
                    }

                    console.log(chalk.cyan("\n第二意见摘要（Copilot/兜底）："));
                    console.log(chalk.gray(result.secondOpinionPreview || ""));
                    console.log(chalk.cyan("\n代码审查（OpenAI“codex”角色）摘要："));
                    console.log(chalk.gray(result.reviewSummary || "(无)"));
                    console.log(chalk.gray(`\nsecond opinion: ${result.secondOpinionPath}`));
                    console.log(chalk.gray(`review JSON  : ${result.reviewPath}`));
                } catch (e) {
                    console.log(chalk.red("review 失败："), e.message || e);
                }

                console.log(chalk.gray("\n下一步可：/eval （手动确认后执行评测） | /accept 提交 | /quit 退出"));
                rl.prompt();
                return;
            }

            if (cmd === "/accept") {
                try {
                    const gate = await runAcceptCore({
                        cwd,
                        aiDir,
                        tasksDir,
                        taskId,
                        metaPath,
                        cfg
                    });

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
                    const result = await runAcceptCore({
                        cwd,
                        aiDir,
                        tasksDir,
                        taskId,
                        metaPath,
                        cfg,
                        commitMessage: msg,
                        overrideGate
                    });

                    if (result.ok) {
                        console.log(chalk.green("✅ 已提交 codegen 结果。"));
                    } else if (result.reason === "commit_failed") {
                        console.log(chalk.red("提交失败："), result.error || "");
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

                const patchPath = resolve(tasksDir, taskId, "patch.json");
                let items = [];
                if (existsSync(patchPath)) {
                    try {
                        const { items: parsed = [] } = JSON.parse(readFileSync(patchPath, "utf-8"));
                        items = parsed;
                    } catch {
                        items = [];
                    }
                }

                for (const it of items.filter((i) => i.op === "create")) {
                    const abs = resolve(cwd, it.path);
                    if (existsSync(abs)) fs.removeSync(abs);
                }
                try {
                    await execa("git", ["restore", "--worktree", "."], { cwd }).catch(async () => {
                        await execa("git", ["checkout", "--", "."], { cwd });
                    });
                    await execa("git", ["clean", "-fd"], { cwd });
                } catch (e) {
                    console.log(chalk.red("回滚时出现问题："), e.message);
                }
                const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
                meta.status = "redo";
                writeFileSync(metaPath, JSON.stringify(meta, null, 2));
                console.log(chalk.green("↩ 已回滚到 pre-commit 快照。"));
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
                    const result = await runEvalCore({ cwd, aiDir, tasksDir, taskId });
                    if (!result.steps.length) {
                        console.log(chalk.gray("未发现评测步骤。"));
                        rl.prompt();
                        return;
                    }

                    console.log(chalk.cyan("\n评测计划："));
                    result.steps.forEach((s) => console.log("  - " + s.name + (s.cmd ? `: ${s.cmd}` : "")));

                    const failed = result.results.find((r) => r.status === "failed");
                    if (failed) {
                        console.log(chalk.yellow(`\n部分评测失败：${failed.step}`));
                        console.log(chalk.gray(`查看日志：.ai-tools-chain/tasks/${taskId}/eval-${failed.step}.log`));
                    } else {
                        console.log(chalk.green("\n评测全部通过。"));
                    }
                    console.log(chalk.gray(`报告：.ai-tools-chain/tasks/${taskId}/eval-report.json`));
                    await autoArchiveOldTasks(aiDir);
                } catch (e) {
                    console.log(chalk.red("评测执行失败："), e.message || e);
                }
                rl.prompt();
                return;
            }

            console.log(chalk.red("未知命令。可用：/plan /review /codegen /eval /accept /revert /quit"));
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
