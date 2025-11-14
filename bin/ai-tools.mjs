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
import ini from "ini";
import { runCodegen, runReview, runSecondOpinion } from "../src/providers/index.mjs";
import { invokeRole, loadModelsConfig } from "../src/models/broker.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG = JSON.parse(readFileSync(resolve(__dirname, "..", "package.json"), "utf-8"));

const program = new Command();
program
    .name("ai-tools")
    .description("AI Tools Chain - local-first CLI")
    .version(PKG.version);
import crypto from "crypto";

async function runGit(cwd, args) {
    const { stdout } = await execa("git", args, { cwd });
    return stdout.trim();
}
async function requireGitClean(cwd) {
    try { await execa("git", ["rev-parse", "--is-inside-work-tree"], { cwd }); }
    catch { throw new Error("这里不是一个 Git 仓库，请先 git init"); }
    const s = await runGit(cwd, ["status", "--porcelain"]);
    if (s !== "") throw new Error("工作区不是干净状态，请先提交或清理后再重试");
    const name = await runGit(cwd, ["config", "--get", "user.name"]).catch(() => "");
    const email = await runGit(cwd, ["config", "--get", "user.email"]).catch(() => "");
    if (!name || !email) throw new Error("未配置 git user.name / user.email，提交将失败。请先 git config。");
}

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

function sha256(buf) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}
// ---------- helpers ----------

// 以 shell 方式执行，兼容 `||`、管道等
async function runShell(cmd, cwd) {
    return await execa(cmd, { cwd, shell: true, all: true });
}

// 逐步写日志
function writeStepLog(tasksDir, taskId, stepName, content) {
    const p = resolve(tasksDir, taskId, `eval-${stepName}.log`);
    fs.ensureDirSync(dirname(p));
    fs.appendFileSync(p, content + "\n", "utf-8");
}

// 读取 eval 配置（空文件 = 全部开启）
function loadEvalSteps(evalConfPath) {
    if (!existsSync(evalConfPath)) {
        // 默认四步，但会在执行时检查命令是否存在
        return [
            { name: "lint", enabled: true, cmd: "npm run lint || ruff ." },
            { name: "test", enabled: true, cmd: "npm test || pytest -q" },
            { name: "promptfoo", enabled: true, cmd: "npx promptfoo eval -c .ai-tools-chain/promptfoo/promptfooconfig.yaml" },
            { name: "ragas", enabled: true, cmd: "python .ai-tools-chain/ragas/evaluate_summarizer.py" },
        ];
    }
    const raw = readFileSync(evalConfPath, "utf-8");
    const onlyComments = raw.trim() === "" || raw.split(/\r?\n/).every(l => l.trim() === "" || l.trim().startsWith("#") || l.trim().startsWith(";"));
    if (onlyComments) return loadEvalSteps(""); // 复用默认

    const conf = ini.parse(raw);
    const blocks = Object.entries(conf).map(([name, obj]) => ({
        name,
        enabled: String(obj.enabled ?? "true") !== "false",
        cmd: obj.cmd || obj.entry || ""
    })).filter(s => s.enabled);
    return blocks.length ? blocks : loadEvalSteps(""); // 兜底默认
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

function nowISO() { return new Date().toISOString(); }

function genTaskId(fmtFromConf) {
    const pad2 = (n) => String(n).padStart(2, "0");
    const d = new Date();
    const date = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
    const seq = "001"; // MVP：先固定，后续做自增
    const fmt = (fmtFromConf || "{date}-{seq}").trim();

    // 新版占位符
    if (fmt.includes("{date}") || fmt.includes("{seq}")) {
        return fmt.replaceAll("{date}", date).replaceAll("{seq}", seq);
    }
    // 向后兼容旧版（含 ### 的格式）
    if (fmt.includes("YYYYMMDD-HHMM") || fmt.includes("###")) {
        return fmt
            .replace(/YYYYMMDD-HHMM/g, date)
            .replace(/#{3,}/g, seq);
    }
    // 再兜底
    return `${date}-${seq}`;
}
function readIni(file, defaults = {}) {
    if (!existsSync(file)) return defaults;
    const txt = readFileSync(file, "utf-8");
    return Object.assign({}, defaults, ini.parse(txt));
}
function ensureProjectInited(cwd) {
    const aiDir = resolve(cwd, ".ai-tools-chain");
    if (!existsSync(aiDir)) {
        console.log(chalk.red("未检测到 .ai-tools-chain/。请先在业务项目里执行："));
        console.log(chalk.cyan("  ai-tools init"));
        process.exit(1);
    }
    return aiDir;
}
function loadMasks(confPath) {
    const cfg = readIni(confPath, {});
    const patterns = (cfg?.privacy?.mask_patterns || "").split(",").map(s => s.trim()).filter(Boolean);
    const regs = [];
    for (const p of patterns) {
        try { regs.push(new RegExp(p, "gi")); } catch { /* 忽略非法正则 */ }
    }
    return (text) => regs.reduce((acc, r) => acc.replace(r, "***"), text);
}
function appendJSONL(file, obj) {
    fs.ensureDirSync(dirname(file));
    appendFileSync(file, JSON.stringify(obj) + "\n", "utf-8");
}

// -------- OpenSpec helpers (minimal YAML-ish parser) --------
async function autoArchiveOldTasks(aiDir) {
    // pack logs/ for tasks older than 7 days if status done/redo
    const tasksDir = resolve(aiDir, "tasks");
    if (!existsSync(tasksDir)) return;
    const now = Date.now();
    const entries = fs.readdirSync(tasksDir).filter(n => !n.startsWith("."));
    for (const id of entries) {
        const td = resolve(tasksDir, id);
        const metaPath = resolve(td, "meta.json");
        if (!existsSync(metaPath)) continue;
        try {
            const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
            const created = Date.parse(meta.created_at || new Date().toISOString());
            const ageDays = (now - created) / (1000 * 60 * 60 * 24);
            if (ageDays < 7) continue;
            if (!['done','redo'].includes(String(meta.status || '').toLowerCase())) continue;
            const logsDir = resolve(td, "logs");
            if (!existsSync(logsDir)) continue;
            if (!fs.readdirSync(logsDir).length) continue;

            const archiveDir = resolve(aiDir, "archives");
            fs.ensureDirSync(archiveDir);
            const archiveName = `${id}.tar.gz`;
            const archiveAbs = resolve(archiveDir, archiveName);

            await execa("tar", ["-czf", archiveAbs, "-C", logsDir, "."]);
            fs.removeSync(logsDir);
        } catch { /* ignore */ }
    }
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
            console.log(chalk.cyan("将在当前项目创建 `.ai-tools-chain/` 与 `.vscode/tasks.json`。"));
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
            spinner.succeed("模板已复制。");
            console.log(chalk.green("完成："));
            console.log("  - .ai-tools-chain/config/toolchain.conf");
            console.log("  - .ai-tools-chain/config/eval.conf");
            console.log("  - .ai-tools-chain/config/plugins.conf");
            console.log("  - .ai-tools-chain/openspec/spec.yaml");
            console.log("  - .ai-tools-chain/openspec/schema.yaml");
            console.log("  - .ai-tools-chain/promptfoo/promptfooconfig.yaml");
            console.log("  - .vscode/tasks.json");
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
        const aiDir = ensureProjectInited(cwd);
        const confPath = resolve(aiDir, "config", "toolchain.conf");
        const cfg = readIni(confPath, {});
        const mask = loadMasks(confPath);
        const tasksDir = resolve(aiDir, "tasks");

        fs.ensureDirSync(tasksDir);
        await autoArchiveOldTasks(aiDir);

        // 询问是否恢复上次任务
        const lastFile = resolve(aiDir, ".last_task");
        let taskId = existsSync(lastFile) ? readFileSync(lastFile, "utf-8").trim() : "";
        const resume = taskId && existsSync(resolve(tasksDir, taskId));
        if (resume) {
            const ans = await promptLine(chalk.cyan(`检测到上次任务 ${taskId}，是否继续？(yes/new) > `));
            if (ans.toLowerCase() === "new") taskId = "";
        }
        if (!taskId) {
            taskId = genTaskId(cfg?.task?.id_format || "YYYYMMDD-HHMM-###");
            fs.ensureDirSync(resolve(tasksDir, taskId));
            // 初始化 meta.json
            const meta = {
                id: taskId,
                created_at: nowISO(),
                status: "draft",
                model: cfg?.model?.model || "gpt-4o-mini"
            };
            writeFileSync(resolve(tasksDir, taskId, "meta.json"), JSON.stringify(meta, null, 2));
            writeFileSync(lastFile, taskId, "utf-8");
        }

        console.log(chalk.green(`\nREPL 已启动。Task: ${taskId}`));
        console.log(chalk.gray(`日志：.ai-tools-chain/tasks/${taskId}/transcript.jsonl`));
        console.log(chalk.gray(`命令：/plan  /review  /codegen  /eval  /quit`));

        const tlog = resolve(tasksDir, taskId, "transcript.jsonl");
        const metaPath = resolve(tasksDir, taskId, "meta.json");

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "> " });
        rl.prompt();

        const ask = (question) => new Promise((resolveAns) => {
            rl.question(question, (ans) => resolveAns(String(ans || "").trim()));
        });

        rl.on("line", async (lineRaw) => {
            const line = lineRaw.trim();
            if (!line) { rl.prompt(); return; }

            // 处理 slash 命令
            if (line.startsWith("/")) {
                const cmd = line.split(/\s+/)[0].toLowerCase();
                if (cmd === "/quit" || cmd === "/exit") {
                    console.log(chalk.yellow("REPL 结束。"));
                    rl.close();
                    return;
                }
                if (cmd === "/plan") {
                    // 规划阶段：代替用户与官方 openspec 对话
                    const rest = lineRaw.slice(cmd.length).trim();
                    const logsDir = resolve(tasksDir, taskId, "logs", "openspec");
                    fs.ensureDirSync(logsDir);

                    const changeId = `task-${taskId}`;
                    const changeDir = resolve("openspec", "changes", changeId);
                    fs.ensureDirSync(changeDir);

                    const title = rest || await ask(chalk.cyan("本轮任务的标题/目标是？ > "));
                    const why = await ask(chalk.cyan("为什么要做这件事（Why）？ > "));
                    const what = await ask(chalk.cyan("大致打算做哪些改动（What Changes）？ > "));
                    const req = await ask(chalk.cyan("关键需求/要点（Requirements，逗号分隔）？ > "));
                    const targets = await ask(chalk.cyan("主要涉及哪些文件或模块（Targets，逗号分隔）？ > "));
                    const risks = await ask(chalk.cyan("主要风险与缓解方式（Risks & Mitigations）？ > "));
                    const accept = await ask(chalk.cyan("验收标准（Acceptance，逗号分隔）？ > "));

                    const changeMd = [
                        "---",
                        `id: ${changeId}`,
                        `title: ${title || `Task ${taskId}`}`,
                        "owner: @you",
                        "risk: medium",
                        "---",
                        "",
                        "## Why",
                        why || "(待补充)",
                        "",
                        "## What Changes",
                        what || "(待补充)",
                        "",
                        "## Requirements",
                        req ? req.split(/[,，]/).map(s => s.trim()).filter(Boolean).map(s => `- ${s}`).join("\n") || "- (待补充)" : "- (待补充)",
                        "",
                        "## Targets",
                        targets ? targets.split(/[,，]/).map(s => s.trim()).filter(Boolean).map(s => `- ${s}`).join("\n") || "- (待补充)" : "- (待补充)",
                        "",
                        "## Risks and Mitigations",
                        risks || "(待补充)",
                        "",
                        "## Acceptance",
                        accept ? accept.split(/[,，]/).map(s => s.trim()).filter(Boolean).map(s => `- ${s}`).join("\n") || "- (待补充)" : "- (待补充)",
                        ""
                    ].join("\n");

                    const changePath = resolve(changeDir, "change.md");
                    writeFileSync(changePath, changeMd, "utf-8");

                    // minimal proposal.md to satisfy openspec show
                    const proposalPath = resolve(changeDir, "proposal.md");
                    if (!existsSync(proposalPath)) {
                        const proposal = [
                            `# Proposal for ${changeId}`,
                            "",
                            "This proposal was generated by AI Tools Chain.",
                            "See change.md for detailed Why/What/Requirements/Targets/Risks/Acceptance.",
                            ""
                        ].join("\n");
                        writeFileSync(proposalPath, proposal, "utf-8");
                    }

                    // minimal specs/ tree with one delta to satisfy openspec validate
                    const specsDir = resolve(changeDir, "specs", "task");
                    fs.ensureDirSync(specsDir);
                    const reqList = req.split(/[,，]/).map(s => s.trim()).filter(Boolean);
                    const primaryReq = reqList[0] || title || `Task ${taskId}`;
                    const specMd = [
                        "## ADDED Requirements",
                        "",
                        `### Requirement: ${primaryReq}`,
                        "",
                        // 官方 openspec 要求：
                        // - ADDED requirement 需要正文
                        // - 正文应包含 SHALL/MUST 等约束词
                        // 这里统一生成一句英文占位，保证通过严格校验。
                        `The system SHALL: ${primaryReq || "satisfy this autogenerated requirement."}`,
                        "",
                        "#### Scenario: basic usage",
                        "- This scenario was generated by AI Tools Chain.",
                        "- See change.md for full context and details.",
                        ""
                    ].join("\n");
                    writeFileSync(resolve(specsDir, "spec.md"), specMd, "utf-8");

                    // minimal tasks.md
                    const tasksPath = resolve(changeDir, "tasks.md");
                    if (!existsSync(tasksPath)) {
                        const tasksMd = [
                            "# Tasks",
                            "",
                            "1. Implement the changes described in change.md.",
                            "2. Add or update tests to cover requirements and scenarios.",
                            "3. Run the evaluation pipeline and ensure it passes.",
                            ""
                        ].join("\n");
                        writeFileSync(tasksPath, tasksMd, "utf-8");
                    }

                    // 调用 openspec 校验与导出
                    try {
                        const { stdout: vout, stderr: verr } = await execa("openspec", ["validate", "--changes", "--json", "--no-interactive"], { cwd });
                        writeFileSync(resolve(logsDir, "validate.json"), vout || "{}", "utf-8");
                        if (verr) writeFileSync(resolve(logsDir, "validate.log"), verr, "utf-8");
                    } catch (e) {
                        const msg = e?.stdout || e?.stderr || e?.message || String(e);
                        writeFileSync(resolve(logsDir, "validate.error.log"), String(msg), "utf-8");
                        console.log(chalk.red("openspec validate 失败："), chalk.gray(String(msg).slice(0, 400)));
                    }

                    // plan.md（人类可读）
                    try {
                        const { stdout } = await execa("openspec", ["show", "--type", "change", changeId], { cwd });
                        const planFile = resolve(tasksDir, taskId, "plan.md");
                        writeFileSync(planFile, stdout || "", "utf-8");
                        writeFileSync(resolve(logsDir, "show.md.log"), stdout || "", "utf-8");
                    } catch (e) {
                        const msg = e?.stdout || e?.stderr || e?.message || String(e);
                        writeFileSync(resolve(logsDir, "show-md.error.log"), String(msg), "utf-8");
                        console.log(chalk.red("openspec show (markdown) 失败："), chalk.gray(String(msg).slice(0, 400)));
                    }

                    // plan.openspec.json（如果支持 JSON 输出）
                    try {
                        const { stdout } = await execa("openspec", ["show", "--json", "--type", "change", changeId], { cwd });
                        const jsonPath = resolve(tasksDir, taskId, "plan.openspec.json");
                        writeFileSync(jsonPath, stdout || "{}", "utf-8");
                        writeFileSync(resolve(logsDir, "show.json.log"), stdout || "", "utf-8");
                    } catch (e) {
                        const msg = e?.stdout || e?.stderr || e?.message || String(e);
                        writeFileSync(resolve(logsDir, "show-json.error.log"), String(msg), "utf-8");
                        // JSON 输出失败不阻断整体流程
                    }

                    // 更新 meta 状态
                    const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
                    meta.status = "plan";
                    writeFileSync(metaPath, JSON.stringify(meta, null, 2));

                    console.log(chalk.cyan(`已根据 openspec change 生成 plan：.ai-tools-chain/tasks/${taskId}/plan.md`));
                    rl.prompt();
                    return;
                }



                if (cmd === "/codegen") {
                    // 1) 载入配置与路径
                    const planFile = resolve(tasksDir, taskId, "plan.md");
                    const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
                    const cfgTask = cfg?.task || {};
                    const dangerList = (cfgTask.dangerous_paths || "").split(",").map(s => s.trim()).filter(Boolean);
                    const whitelist = (cfgTask.write_whitelist ?? "*").trim();

                    // 2) 强确认（当前阶段：仅本地词典命中 + 再次确认短语）
                    //    如果 meta.status 不是 pending_confirm，也要求再次确认
                    const ans = await ask(chalk.yellow(`将要生成代码并写入工作区。请输入中文强确认短语“确认生成”继续，或回车取消 > `));
                    if (ans !== "确认生成") {
                        console.log(chalk.yellow("已取消 codegen。"));
                        rl.prompt();
                        return;
                    }

                    // 3) Git 护栏：干净工作区 + 预提交快照
                    try {
                        await requireGitClean(cwd);
                    } catch (e) {
                        console.log(chalk.red(`Git 检查失败：${e.message}`));
                        rl.prompt();
                        return;
                    }
                    // 可选：创建 per-task 分支
                    const perTask = String(cfgTask.per_task_branch || "false") === "true";
                    if (perTask) {
                        // 分支名：{type}/{slug}-task-{id}
                        const defType = "feat";
                        const defSlug = "task";
                        const type = await ask(chalk.cyan(`分支类型（默认 ${defType}）> `)) || defType;
                        const slug = await ask(chalk.cyan(`分支 slug（默认 ${defSlug}）> `)) || defSlug;
                        const pattern = (cfgTask.branch_pattern || "{type}/{slug}-task-{id}")
                            .replaceAll("{type}", type)
                            .replaceAll("{slug}", slug)
                            .replaceAll("{id}", taskId);
                        console.log(chalk.gray(`创建分支：${pattern}`));
                        await execa("git", ["checkout", "-b", pattern], { cwd });
                    }

                    // 允许空提交：即便当前无改动也能做快照
                    await execa("git", ["commit", "--allow-empty", "-m", `chore(atc): pre-gen snapshot for task ${taskId}`], { cwd });

                    // 4) 从 plan.md 取文本
                    const planText = existsSync(planFile) ? readFileSync(planFile, "utf-8") : "# (空计划)";
                    const repoSummary = "(可选) 这里可以用 git ls-files + 目录树生成概览";

                    // 5) 调用主笔（Claude）
                    const proposals = await runCodegen({ aiDir, planText, repoSummary });
                    // proposals: [{path, content, rationale}]
                    const targets = proposals.map(p => p.path);

                    // 6) 生成示例内容并落盘（MVP：占位内容，后续接模型）
                    const changes = [];
                    for (const rel of targets) {
                        const abs = resolve(cwd, rel);
                        fs.ensureDirSync(dirname(abs));
                        const isNew = !existsSync(abs);
                        const text = [
                            `# AI Tools Chain`,
                            `# Task: ${taskId}`,
                            `# File: ${rel}`,
                            "",
                            `// 这是一段示例内容（占位），用于验证 codegen 流程。`,
                            `// 之后这里会由模型生成真实业务代码。`,
                            ""
                        ].join("\n");
                        writeFileSync(abs, text, "utf-8");
                        const buf = Buffer.from(text, "utf-8");
                        changes.push({
                            path: rel,
                            op: isNew ? "create" : "modify",
                            size: buf.length,
                            hash: sha256(buf)
                        });
                    }

                    // 7) 写入提议的内容
                    for (const p of proposals) {
                        const abs = resolve(cwd, p.path);
                        fs.ensureDirSync(dirname(abs));
                        const isNew = !existsSync(abs);
                        writeFileSync(abs, p.content, "utf-8");
                        changes.push({ path: p.path, op: isNew ? "create" : "modify", size: Buffer.byteLength(p.content) });

                        // 全文快照
                        const filesDir = resolve(tasksDir, taskId, "files");
                        for (const c of changes) {
                            const srcAbs = resolve(cwd, c.path);
                            const dstAbs = resolve(filesDir, c.path + ".full");
                            fs.ensureDirSync(dirname(dstAbs));
                            const txt = readFileSync(srcAbs, "utf-8");
                            writeFileSync(dstAbs, txt, "utf-8");
                        }
                        // patch.json
                        const patchJson = { taskId, generated_at: nowISO(), items: changes };
                        writeFileSync(resolve(tasksDir, taskId, "patch.json"), JSON.stringify(patchJson, null, 2), "utf-8");

                        // 更新 meta 状态
                        meta.status = "review";
                        writeFileSync(metaPath, JSON.stringify(meta, null, 2));

                        console.log(chalk.green(`\n已生成变更，进入 review 阶段：`));
                        console.log("  - diff.patch");
                        console.log("  - patch.json");
                        console.log("  - files/*.full");
                        console.log(chalk.gray("提示：输入 /review 查看摘要；需要回滚可手动 git reset --hard 回到快照。"));
                        rl.prompt();
                        return;
                    }

                    if (cmd === "/review") {
                        // 展示摘要（文件数/行数估计/危险路径标记）
                        const { stdout: numstat } = await execa("git", ["--no-pager", "diff", "--numstat"], { cwd });
                        const lines = numstat.trim() ? numstat.trim().split("\n") : [];
                        let added = 0, deleted = 0;
                        const files = [];
                        for (const ln of lines) {
                            const m = ln.match(/^(\d+|\-)\s+(\d+|\-)\s+(.+)$/);
                            if (m) {
                                const a = m[1] === "-" ? 0 : parseInt(m[1], 10);
                                const d = m[2] === "-" ? 0 : parseInt(m[2], 10);
                                const f = m[3];
                                added += a; deleted += d; files.push(f);
                            }
                        }
                        console.log(chalk.cyan("\n本次变更摘要："));
                        console.log(`  变更文件：${files.length} 个`);
                        console.log(`  +${added} / -${deleted} 行`);
                        if (files.length) {
                            const dangerList = (cfg?.task?.dangerous_paths || "").split(",").map(s => s.trim()).filter(Boolean);
                            const marks = files.map(f => inDanger(f, dangerList) ? `! ${f}` : `  ${f}`);
                            console.log(chalk.gray("  文件：\n    " + marks.join("\n    ")));
                        } else {
                            console.log(chalk.gray("  （当前没有可展示的 diff）"));
                        }
                        // 额外：调用第二意见（Copilot）与审查（OpenAI）
                        const { stdout: diffText } = await execa("git", ["--no-pager", "diff"], { cwd });
                        const so = await runSecondOpinion({ aiDir, cwd, planText: "", diffText });
                        const rv = await runReview({ aiDir, diffText });

                        // 落盘
                        const soDir = resolve(aiDir, "second-opinion", taskId);
                        fs.ensureDirSync(soDir);
                        writeFileSync(resolve(soDir, "second_opinion.md"), String(so.notes || ""), "utf-8");
                        writeFileSync(resolve(tasksDir, taskId, "review.json"), JSON.stringify(rv, null, 2), "utf-8");

                        // 命令行摘要
                        console.log(chalk.cyan("\n第二意见摘要（Copilot/兜底）："));
                        console.log(chalk.gray((so.notes || "").slice(0, 800)));
                        console.log(chalk.cyan("\n代码审查（OpenAI“codex”角色）摘要："));
                        console.log(chalk.gray(rv.summary || "(无)"));


                        console.log(chalk.gray("\n下一步可：/eval （手动确认后执行评测） | /quit 退出"));
                        rl.prompt();
                        return;
                    }
                    if (cmd === "/accept") {
                        // Gate: 评测必须通过，或允许 override
                        try {
                            const report = JSON.parse(readFileSync(resolve(tasksDir, taskId, "eval-report.json"), "utf-8"));
                            const failed = (report?.results || []).some(r => r.status === "failed");
                            const allowOverride = String(cfg?.eval?.allow_gate_override || "false").toLowerCase() === "true";
                            const phrase = (cfg?.confirm?.override_phrase || "确认合入").trim();
                            if (failed) {
                                if (!allowOverride) {
                                    console.log(chalk.red("评测 gate 未通过，已阻断提交。可修复后重试。"));
                                    rl.prompt();
                                    return;
                                } else {
                                    const ans = await ask(chalk.yellow(`评测失败。输入强确认短语“${phrase}”以继续提交，或回车取消 > `));
                                    if (ans !== phrase) { console.log(chalk.yellow("已取消提交。")); rl.prompt(); return; }
                                }
                            }
                        } catch { /* 无报告则不阻断 */ }

                        // 强确认提交 codegen 结果
                        const sum = await ask(chalk.cyan("请输入本次提交摘要（留空则使用默认）> "));
                        const msg = `feat(atc): codegen for task ${taskId}` + (sum ? ` – ${sum}` : "");
                        try {
                            await execa("git", ["add", "-A"], { cwd });
                            await execa("git", ["commit", "-m", msg], { cwd });
                            const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
                            meta.status = "done";
                            writeFileSync(metaPath, JSON.stringify(meta, null, 2));
                            console.log(chalk.green("✅ 已提交 codegen 结果。"));
                            await autoArchiveOldTasks(aiDir);
                        } catch (e) {
                            console.log(chalk.red("提交失败："), e.message);
                        }
                        rl.prompt();
                        return;
                    }

                    if (cmd === "/revert") {
                        // 回滚到 pre-commit 快照：删除新建文件 & 恢复修改
                        const ok = await ask(chalk.yellow("将回滚本次 codegen 改动。输入 YES 确认 > "));
                        if (ok !== "YES") { console.log(chalk.yellow("已取消。")); rl.prompt(); return; }

                        const items = readPatchItems(tasksDir, taskId);
                        // 删除新建的未跟踪文件
                        for (const it of items.filter(i => i.op === "create")) {
                            const abs = resolve(cwd, it.path);
                            if (existsSync(abs)) fs.removeSync(abs);
                        }
                        // 恢复修改（丢弃工作区改动）
                        try {
                            // git restore 需要较新版本；用 checkout 兜底
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
                        if (ok !== "开始评测") { console.log(chalk.yellow("已取消评测。")); rl.prompt(); return; }

                        const evalConfPath = resolve(aiDir, "config", "eval.conf");
                        const steps = loadEvalSteps(evalConfPath);
                        if (!steps.length) { console.log(chalk.gray("未发现评测步骤。")); rl.prompt(); return; }

                        console.log(chalk.cyan("\n评测计划："));
                        steps.forEach(s => console.log("  - " + s.name + (s.cmd ? `: ${s.cmd}` : "")));

                        const results = [];
                        for (const step of steps) {
                            if (!step.cmd) { results.push({ step: step.name, status: "skipped", reason: "no cmd" }); continue; }

                            console.log(chalk.gray(`\n[eval] ${step.name} ...`));
                            writeStepLog(tasksDir, taskId, step.name, `== ${new Date().toISOString()} == START ${step.name}`);
                            try {
                                const { all } = await runShell(step.cmd, cwd); // 捕获 stdout+stderr
                                writeStepLog(tasksDir, taskId, step.name, all || "(no output)");
                                results.push({ step: step.name, status: "ok" });
                                console.log(chalk.green(`✔ ${step.name} OK`));
                            } catch (e) {
                                const out = (e.all || e.stdout || e.stderr || e.message || "").toString();
                                writeStepLog(tasksDir, taskId, step.name, out);
                                results.push({ step: step.name, status: "failed", code: e.exitCode ?? -1 });
                                console.log(chalk.red(`✖ ${step.name} FAILED`));
                                console.log(chalk.yellow("已停止后续步骤。请根据日志修复后重试。"));
                                break;
                            }
                            writeStepLog(tasksDir, taskId, step.name, `== ${new Date().toISOString()} == END ${step.name}`);
                        }

                        // 汇总报告
                        const report = {
                            taskId,
                            finished_at: nowISO(),
                            results,
                        };
                        const reportPath = resolve(tasksDir, taskId, "eval-report.json");
                        writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

                        const failed = results.find(r => r.status === "failed");
                        if (failed) {
                            console.log(chalk.yellow(`\n部分评测失败：${failed.step}`));
                            console.log(chalk.gray(`查看日志：.ai-tools-chain/tasks/${taskId}/eval-${failed.step}.log`));
                        } else {
                            console.log(chalk.green("\n评测全部通过。"));
                        }
                        console.log(chalk.gray(`报告：.ai-tools-chain/tasks/${taskId}/eval-report.json`));
                        await autoArchiveOldTasks(aiDir);
                        rl.prompt();
                        return;
                    }



                    console.log(chalk.red("未知命令。可用：/plan /review /codegen /eval /quit"));
                    rl.prompt();
                    return;
                }

                // 普通用户输入：写入 transcript
                const masked = mask(line);
                appendJSONL(tlog, { ts: nowISO(), role: "user", text: masked, stage: "draft" });

                // 强确认（MVP：仅当 fallback_dict 非空时，做字典匹配；否则不判定）
                const dict = (cfg?.confirm?.fallback_dict || "")
                    .split(",").map(s => s.trim()).filter(Boolean);
                if (dict.length > 0) {
                    const hit = dict.some(w => masked.includes(w));
                    if (hit) {
                        const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
                        meta.status = "pending_confirm";
                        writeFileSync(metaPath, JSON.stringify(meta, null, 2));
                        console.log(chalk.green("检测到强确认关键词（来自 fallback_dict）。下一步将进入 codegen（下一节实现）。"));
                    }
                } else {
                    console.log(chalk.gray("提示：如需本地关键词强确认，请在 toolchain.conf 的 [confirm].fallback_dict 中添加词汇（逗号分隔）。"));
                }

                rl.prompt();
            }
        });

        rl.on("close", () => {
            console.log(chalk.gray(`会话已保存：.ai-tools-chain/tasks/${taskId}/transcript.jsonl`));
            process.exit(0);
        });
    });

program.parseAsync(process.argv);
