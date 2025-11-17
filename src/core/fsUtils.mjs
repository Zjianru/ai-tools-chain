import fs from "fs-extra";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import chalk from "chalk";
import { execa } from "execa";

export function ensureProjectInited(cwd) {
    const aiDir = resolve(cwd, ".ai-tools-chain");
    if (!existsSync(aiDir)) {
        console.log(chalk.red("未检测到 .ai-tools-chain/。请先在业务项目里执行："));
        console.log(chalk.cyan("  ai-tools init"));
        process.exit(1);
    }
    return aiDir;
}

export async function autoArchiveOldTasks(aiDir) {
    const tasksDir = resolve(aiDir, "tasks");
    if (!existsSync(tasksDir)) return;
    const now = Date.now();
    const entries = fs.readdirSync(tasksDir).filter((n) => !n.startsWith("."));
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

            await execa("tar", ["-czf", archiveAbs, "-C", logsDir, "."], { cwd: aiDir });
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
    const hasEntry = (target) =>
        lines.some((ln) => {
            const t = target.replace(/^\/+/, "");
            const s = ln.trim().replace(/^\/+/, "").replace(/\/+$/, "");
            return s === t;
        });
    let changed = false;
    if (!hasEntry(".ai-tools-chain")) {
        lines.push(".ai-tools-chain");
        changed = true;
    }
    if (!changed && existsSync(giPath)) return;
    const next =
        lines
            .filter(
                (ln, idx, arr) =>
                    !(
                        idx === arr.length - 1 &&
                        ln.trim() === "" &&
                        arr.length > 1
                    )
            )
            .join("\n") + "\n";
    writeFileSync(giPath, next, "utf-8");
}

