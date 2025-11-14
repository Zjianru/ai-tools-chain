import fs from "fs-extra";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import chalk from "chalk";
import ini from "ini";
import { execa } from "execa";

export function nowISO() {
    return new Date().toISOString();
}

export function genTaskId(fmtFromConf) {
    const pad2 = (n) => String(n).padStart(2, "0");
    const d = new Date();
    const date = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
    const seq = "001";
    const fmt = (fmtFromConf || "{date}-{seq}").trim();
    if (fmt.includes("{date}") || fmt.includes("{seq}")) {
        return fmt.replaceAll("{date}", date).replaceAll("{seq}", seq);
    }
    if (fmt.includes("YYYYMMDD-HHMM") || fmt.includes("###")) {
        return fmt.replace(/YYYYMMDD-HHMM/g, date).replace(/#{3,}/g, seq);
    }
    return `${date}-${seq}`;
}

export function readIni(file, defaults = {}) {
    if (!existsSync(file)) return defaults;
    const txt = readFileSync(file, "utf-8");
    return Object.assign({}, defaults, ini.parse(txt));
}

export function loadMasks(confPath) {
    const cfg = readIni(confPath, {});
    const patterns = (cfg?.privacy?.mask_patterns || "").split(",").map(s => s.trim()).filter(Boolean);
    const regs = [];
    for (const p of patterns) {
        try { regs.push(new RegExp(p, "gi")); } catch { /* ignore invalid regex */ }
    }
    return (text) => regs.reduce((acc, r) => acc.replace(r, "***"), text);
}

export function ensureProjectInited(cwd) {
    const aiDir = resolve(cwd, ".ai-tools-chain");
    if (!existsSync(aiDir)) {
        console.log(chalk.red("未检测到 .ai-tools-chain/。请先在业务项目里执行："));
        console.log(chalk.cyan("  ai-tools init"));
        process.exit(1);
    }
    return aiDir;
}

export function createNewTask(aiDir, cfg) {
    const tasksDir = resolve(aiDir, "tasks");
    fs.ensureDirSync(tasksDir);
    const taskId = genTaskId(cfg?.task?.id_format || "YYYYMMDD-HHMM-###");
    const taskDir = resolve(tasksDir, taskId);
    fs.ensureDirSync(taskDir);
    const metaPath = resolve(taskDir, "meta.json");
    const meta = {
        id: taskId,
        created_at: nowISO(),
        status: "draft",
        model: cfg?.model?.model || "gpt-4o-mini"
    };
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    const lastFile = resolve(aiDir, ".last_task");
    writeFileSync(lastFile, taskId, "utf-8");
    return { taskId, tasksDir, metaPath };
}

export async function autoArchiveOldTasks(aiDir) {
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
            if (!["done", "redo"].includes(String(meta.status || "").toLowerCase())) continue;
            const logsDir = resolve(td, "logs");
            if (!existsSync(logsDir)) continue;
            if (!fs.readdirSync(logsDir).length) continue;

            const archiveDir = resolve(aiDir, "archives");
            fs.ensureDirSync(archiveDir);
            const archiveName = `${id}.tar.gz`;
            const archiveAbs = resolve(archiveDir, archiveName);

            await execa("tar", ["-czf", archiveAbs, "-C", logsDir, "."]);
            fs.removeSync(logsDir);
        } catch {
            // ignore per-task archive errors
        }
    }
}

export function ensureGitignoreHasToolDirs(cwd) {
    const giPath = resolve(cwd, ".gitignore");
    let content = "";
    if (existsSync(giPath)) {
        content = readFileSync(giPath, "utf-8");
    }
    const lines = content.split(/\r?\n/);
    const hasEntry = (target) => lines.some((ln) => {
        const t = target.replace(/^\/+/, "");
        const s = ln.trim().replace(/^\/+/, "").replace(/\/+$/, "");
        return s === t;
    });
    let changed = false;
    if (!hasEntry(".vscode")) {
        lines.push(".vscode");
        changed = true;
    }
    if (!hasEntry(".ai-tools-chain")) {
        lines.push(".ai-tools-chain");
        changed = true;
    }
    if (!changed && existsSync(giPath)) return;
    const next = lines.filter((ln, idx, arr) => !(idx === arr.length - 1 && ln.trim() === "" && arr.length > 1)).join("\n") + "\n";
    writeFileSync(giPath, next, "utf-8");
}

