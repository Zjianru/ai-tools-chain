import fs from "fs-extra";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import ini from "ini";
import {
    ensureProjectInited,
    autoArchiveOldTasks,
    ensureGitignoreHasToolDirs
} from "./fsUtils.mjs";

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
export { ensureProjectInited, autoArchiveOldTasks, ensureGitignoreHasToolDirs };

