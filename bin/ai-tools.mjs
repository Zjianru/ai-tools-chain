#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { readFileSync, existsSync, writeFileSync, appendFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import ora from "ora";
import { execa } from "execa";
import readline from "readline";
import { invokeRole, loadModelsConfig } from "../src/models/broker.mjs";
import { readIni, loadMasks, ensureProjectInited, createNewTask, autoArchiveOldTasks, ensureGitignoreHasToolDirs, nowISO } from "../src/core/task.mjs";
import { runPlanningWithInputs } from "../src/core/planning.mjs";
import { runRepl } from "../src/cli/repl.mjs";
import { runPipeline } from "../src/cli/pipeline.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG = JSON.parse(readFileSync(resolve(__dirname, "..", "package.json"), "utf-8"));

const program = new Command();
program
    .name("ai-tools")
    .description("AI Tools Chain - local-first CLI")
    .version(PKG.version);

function parsePlanFiles(planText) {
    // 从 plan.md 的“将改动的文件（草案）”列表里提取以 '-' 开头的相对路径
    const files = [];
    const lines = planText.split(/\r?\n/);
    for (const ln of lines) {
        const m = ln.match(/^\s*-\s+(.+?)\s*$/);
        if (m) {
            const p = m[1].trim();
            if (p && !p.endsWith("/")) files.push(p);
        }
    }
    return Array.from(new Set(files));
}

function pathIsUnder(p, base) {
    return p === base || p.startsWith(base);
}
function inDanger(pathRel, dangerList) {
    return dangerList.some(d => pathIsUnder(pathRel, d.replace(/^\.\//, "")));
}
function inWhitelist(pathRel, whitelist) {
    if (whitelist === "*" || whitelist === "" || !whitelist) return true;
    const buckets = whitelist.split(",").map(s => s.trim()).filter(Boolean);
    return buckets.some(b => pathIsUnder(pathRel, b.replace(/^\.\//, "")));
}

// 从 patch.json 读出创建/修改列表（用于 /revert）
function readPatchItems(tasksDir, taskId) {
    const p = resolve(tasksDir, taskId, "patch.json");
    if (!existsSync(p)) return [];
    try {
        const { items = [] } = JSON.parse(readFileSync(p, "utf-8"));
        return items;
    } catch { return []; }
}


async function promptLine(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return await new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

async function check(name, fn) {
    try { await fn(); return { name, ok: true }; }
    catch (e) { return { name, ok: false, err: e?.message || String(e) }; }
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

// ---------- version ----------
program.command("version")
    .description("show version")
    .action(() => { console.log(PKG.version); });

// ---------- doctor ----------
program.command("doctor")
    .description("check local environment")
    .action(async () => {
        const spinner = ora("Checking environment...").start();
        const results = [];

        results.push(await check("Node >= 20", async () => {
            const major = parseInt(process.versions.node.split(".")[0], 10);
            if (major < 20) throw new Error(`Node version is ${process.versions.node}`);
        }));
        results.push(await check("git installed", async () => { await execa("git", ["--version"]); }));
        results.push(await check("python available", async () => {
            try { await execa("python3", ["--version"]); } catch { await execa("python", ["--version"]); }
        }));
        results.push(await check("npx available", async () => { await execa("npx", ["--version"]); }));

        spinner.stop();
        for (const r of results) {
            if (r.ok) console.log(chalk.green(`✔ ${r.name}`));
            else console.log(chalk.red(`✖ ${r.name}`), chalk.gray(`→ ${r.err}`));
        }
        if (results.some(r => !r.ok)) {
            console.log("\n" + chalk.yellow("提示：请根据上面的报错安装/修复后，重试 `ai-tools doctor`。"));
            process.exit(1);
        }
        console.log("\n" + chalk.cyan("环境检查通过。"));
    });

// ---------- init ----------
program.command("init")
    .description("initialize templates into the current project")
    .option("-y, --yes", "skip confirmation")
    .action(async (opts) => {
        const cwd = process.cwd();
        const hiddenDir = resolve(cwd, ".ai-tools-chain");
        if (existsSync(hiddenDir)) {
            console.log(chalk.yellow(`已存在：${hiddenDir}`));
            return;
        }

        if (!opts.yes) {
            console.log(chalk.cyan("将在当前项目创建 `.ai-tools-chain/` 目录。"));
            console.log(chalk.cyan("仅复制模板，不会修改你的业务代码。继续请输入: yes"));
            const ans = await promptLine("> ");
            if (ans.toLowerCase() !== "yes") {
                console.log(chalk.yellow("已取消。"));
                return;
            }
        }

        const spinner = ora("Copying templates...").start();
        try {
            const tplRoot = resolve(__dirname, "..", "templates");
            await fs.copy(tplRoot, cwd, { overwrite: false, errorOnExist: false });
            ensureGitignoreHasToolDirs(cwd);
            spinner.succeed("模板已复制。");
            console.log(chalk.green("完成："));
            console.log("  - .ai-tools-chain/config/toolchain.conf");
            console.log("  - .ai-tools-chain/config/eval.conf");
            console.log("  - .ai-tools-chain/config/plugins.conf");
            console.log("  - .ai-tools-chain/openspec/spec.yaml");
            console.log("  - .ai-tools-chain/openspec/schema.yaml");
            console.log("  - .ai-tools-chain/promptfoo/promptfooconfig.yaml");
            console.log("  - .gitignore（追加 .vscode / .ai-tools-chain）");
        } catch (e) {
            spinner.fail("复制失败。");
            console.error(e);
            process.exit(1);
        }
    });

// ---------- repl ----------
program.command("repl")
    .description("start a local REPL and log to .ai-tools-chain/tasks/<taskid>/transcript.jsonl")
    .action(async () => {
        const cwd = process.cwd();
        await runRepl(cwd);
    });

// ---------- pipeline (demo) ----------
program.command("pipeline")
    .argument("name", "pipeline name")
    .description("run a non-interactive demo pipeline (for tests/gates)")
    .action(async (name) => {
        const cwd = process.cwd();
        await runPipeline(name, cwd);
    });

program.parseAsync(process.argv);
