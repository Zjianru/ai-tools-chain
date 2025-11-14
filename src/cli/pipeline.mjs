import chalk from "chalk";
import fs from "fs-extra";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { execa } from "execa";
import { ensureProjectInited, readIni, createNewTask, autoArchiveOldTasks, nowISO } from "../core/task.mjs";
import { runPlanningWithInputs } from "../core/planning.mjs";
import { runCodegenCore } from "../core/codegen.mjs";

export async function runPipeline(name, cwd) {
    if (name !== "demo-openspec") {
        console.log(chalk.red("当前仅支持 demo-openspec 管线"));
        process.exitCode = 1;
        return;
    }

    const aiDir = ensureProjectInited(cwd);
    const confPath = resolve(aiDir, "config", "toolchain.conf");
    const cfg = readIni(confPath, {});

    await autoArchiveOldTasks(aiDir);

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
}

