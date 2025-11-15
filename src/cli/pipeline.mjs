import chalk from "chalk";
import fs from "fs-extra";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { execa } from "execa";
import { ensureProjectInited, readIni, createNewTask, autoArchiveOldTasks, nowISO } from "../core/task.mjs";
import { runPlanningWithInputs } from "../core/planning.mjs";
import { runCodegenCore } from "../core/codegen.mjs";
import { loadTaskState, applyStatePatch } from "../core/state.mjs";
import { PlanningAgent } from "../agents/planningAgent.mjs";
import { PlanReviewAgent } from "../agents/planReviewAgent.mjs";
import { CodegenAgent } from "../agents/codegenAgent.mjs";
import { CodeReviewAgent } from "../agents/codeReviewAgent.mjs";
import { ReviewMeetingAgent } from "../agents/reviewMeetingAgent.mjs";
import { TestAgent } from "../agents/testAgent.mjs";

export async function runPipeline(name, cwd) {
    if (name !== "demo-openspec" && name !== "agents") {
        console.log(chalk.red("当前仅支持 demo-openspec / agents 两种管线"));
        process.exitCode = 1;
        return;
    }

    const aiDir = ensureProjectInited(cwd);
    const confPath = resolve(aiDir, "config", "toolchain.conf");
    const cfg = readIni(confPath, {});

    await autoArchiveOldTasks(aiDir);

    if (name === "demo-openspec") {
        const { taskId, tasksDir, metaPath } = createNewTask(aiDir, cfg);
        console.log(chalk.green(`[pipeline] Task ${taskId}`));

        const inputs = {
            title: "我想为这个项目添加一个 sh 脚本,脚本的作用是,当我运行这个脚本,在终端打印 你好 这句话",
            why: "测试",
            what: "测试",
            req: "测试",
            targets: "测试",
            risks: "测试",
            accept: "测试"
        };

        const pipelineResultPath = resolve(tasksDir, taskId, "pipeline-result.json");
        let planningStatus = "pending";
        let codegenStatus = "pending";
        let commitStatus = "pending";
        let error = null;
        let currentStage = "init";

        try {
            currentStage = "planning";
            console.log(chalk.cyan("[pipeline] planning (openspec)..."));
            await runPlanningWithInputs({ cwd, aiDir, tasksDir, taskId, metaPath, inputs });
            planningStatus = "ok";
            console.log(chalk.cyan("[pipeline] planning done."));

            currentStage = "codegen";
            console.log(chalk.cyan("[pipeline] codegen (demo)..."));
            const cfgTask = cfg?.task || {};
            let branchName = null;
            const perTask = String(cfgTask.per_task_branch || "false") === "true";
            if (perTask) {
                const defType = "feat";
                const defSlug = "pipeline";
                branchName = (cfgTask.branch_pattern || "{type}/{slug}-task-{id}")
                    .replaceAll("{type}", defType)
                    .replaceAll("{slug}", defSlug)
                    .replaceAll("{id}", taskId);
            }

            const codegenResult = await runCodegenCore({
                cwd,
                aiDir,
                tasksDir,
                taskId,
                metaPath,
                cfg,
                branchName,
                repoSummaryOverride: "demo pipeline"
            });
            codegenStatus = "ok";
            console.log(chalk.cyan("[pipeline] codegen done."));

            if (codegenResult.diffSummary) {
                const { stdout: numstat } = await execa("git", ["--no-pager", "diff", "--numstat"], { cwd });
                console.log(chalk.cyan("[pipeline] diff summary:"));
                console.log(numstat || "(no diff)");
            }

            currentStage = "commit";
            await execa("git", ["add", "-A"], { cwd });
            const msg = `feat(atc): demo pipeline for task ${taskId}`;
            try {
                await execa("git", ["commit", "-m", msg], { cwd });
                commitStatus = "ok";
            } catch (e) {
                const out = (e.stdout || e.stderr || e.message || "").toString();
                if (!out.includes("nothing to commit")) {
                    commitStatus = "failed";
                    throw e;
                }
                commitStatus = "skipped";
                console.log(chalk.gray("[pipeline] nothing to commit after codegen (demo)."));
            }

            const meta2 = JSON.parse(readFileSync(metaPath, "utf-8"));
            meta2.status = "done";
            writeFileSync(metaPath, JSON.stringify(meta2, null, 2));

            console.log(chalk.green("[pipeline] OK"));
        } catch (e) {
            error = e;
            if (currentStage === "planning") planningStatus = planningStatus === "pending" ? "failed" : planningStatus;
            else if (currentStage === "codegen") codegenStatus = codegenStatus === "pending" ? "failed" : codegenStatus;
            else if (currentStage === "commit") commitStatus = commitStatus === "pending" ? "failed" : commitStatus;
            console.error(chalk.red("[pipeline] FAILED:"), e?.message || e);
            process.exitCode = 1;
        } finally {
            const result = {
                taskId,
                finishedAt: nowISO(),
                stages: [
                    { name: "planning", status: planningStatus },
                    { name: "codegen", status: codegenStatus },
                    { name: "commit", status: commitStatus }
                ],
                error: error ? (error.message || String(error)) : null
            };
            try {
                fs.ensureDirSync(dirname(pipelineResultPath));
                writeFileSync(pipelineResultPath, JSON.stringify(result, null, 2), "utf-8");
            } catch {
                // ignore write errors
            }
        }
        return;
    }

    // agents pipeline（Orchestrator 最小实现）：planning → plan_review → codegen → code_review → test
    const { taskId, tasksDir, metaPath } = createNewTask(aiDir, cfg);
    console.log(chalk.green(`[agents pipeline] Task ${taskId}`));
    loadTaskState(tasksDir, taskId);

    const pipelineResultPath = resolve(tasksDir, taskId, "pipeline-result.json");
    const stages = [];

    const recordStage = (name, status, errorMsg) => {
        stages.push({ name, status, error: errorMsg || null });
    };

    const runAgent = async (label, agent, ctx) => {
        console.log(chalk.cyan(`[agents] ${label}...`));
        try {
            const res = await agent.step(ctx);
            (res.logs || []).forEach((ln) => console.log(ln));
            if (res.statePatch) {
                applyStatePatch(tasksDir, taskId, res.statePatch);
            }
            recordStage(label, res.error ? "failed" : "ok", res.error || null);
            return !res.error;
        } catch (e) {
            const msg = e.message || String(e);
            console.error(chalk.red(`[agents] ${label} failed:`), msg);
            recordStage(label, "failed", msg);
            return false;
        }
    };

    const ctxBase = { cwd, aiDir, tasksDir, taskId, metaPath, cfg };

    // 1) planning（非交互 demo：使用固定 brief）
    const planningAgent = new PlanningAgent();
    const brief = "为当前项目生成一个简单的演示变更（agents pipeline demo）。";
    const planningTranscript = resolve(tasksDir, taskId, "planning.transcript.jsonl");
    fs.ensureDirSync(dirname(planningTranscript));
    writeFileSync(
        planningTranscript,
        JSON.stringify({ ts: nowISO(), role: "user", kind: "brief", text: brief }) + "\n",
        "utf-8"
    );
    const okPlanning = await runAgent("planning", planningAgent, ctxBase);
    if (!okPlanning) {
        console.log(chalk.red("[agents] planning 阶段失败，停止后续阶段。"));
        writePipelineResult(pipelineResultPath, taskId, stages);
        return;
    }

    // 2) plan_review
    const planReviewAgent = new PlanReviewAgent();
    const okPlanReview = await runAgent("plan_review", planReviewAgent, ctxBase);
    if (!okPlanReview) {
        console.log(chalk.yellow("[agents] 规划审查未通过或失败，按当前策略仍继续后续阶段（demo）。"));
    }

    // 3) codegen
    const codegenAgent = new CodegenAgent();
    const okCodegen = await runAgent("codegen", codegenAgent, ctxBase);
    if (!okCodegen) {
        console.log(chalk.red("[agents] codegen 阶段失败，停止后续阶段。"));
        writePipelineResult(pipelineResultPath, taskId, stages);
        return;
    }

    // 4) code_review + meeting
    const codeReviewAgent = new CodeReviewAgent();
    const okReview = await runAgent("code_review", codeReviewAgent, ctxBase);
    if (!okReview) {
        console.log(chalk.yellow("[agents] code_review 阶段失败，按当前策略仍继续测试阶段（demo）。"));
    }
    const meetingAgent = new ReviewMeetingAgent();
    await runAgent("code_review_meeting", meetingAgent, ctxBase);

    // 5) test
    const testAgent = new TestAgent();
    await runAgent("test", testAgent, ctxBase);

    writePipelineResult(pipelineResultPath, taskId, stages);
}

function writePipelineResult(pipelineResultPath, taskId, stages) {
    const result = {
        taskId,
        finishedAt: nowISO(),
        stages
    };
    try {
        fs.ensureDirSync(dirname(pipelineResultPath));
        writeFileSync(pipelineResultPath, JSON.stringify(result, null, 2), "utf-8");
    } catch {
        // ignore
    }
}
