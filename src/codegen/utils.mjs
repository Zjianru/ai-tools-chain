import fs from "fs-extra";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import crypto from "crypto";
import { summarizeModifiedWithGit, summarizeCreatedFiles } from "../domain/diff.mjs";

export function sha256(buf) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}

export function isLikelyXml(text) {
    const t = (text || "").trim();
    if (!t) return false;
    if (t.startsWith("<?xml")) return true;
    if (t.startsWith("<project") || t.startsWith("<dependencies")) return true;
    const angleCount = (t.match(/</g) || []).length;
    const braceCount = (t.match(/[{}]/g) || []).length;
    return angleCount > 10 && angleCount > braceCount * 2;
}

export function isLikelyJava(text) {
    const t = (text || "").trim();
    if (!t) return false;
    if (/package\s+[a-zA-Z0-9_.]+;/.test(t)) return true;
    if (/public\s+class\s+[A-Z][A-Za-z0-9_]*/.test(t)) return true;
    if (/import\s+org\.springframework\./.test(t)) return true;
    return false;
}

export function stripCodeFence(text) {
    if (!text) return "";
    const m = text.match(/```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/);
    if (m && m[1]) return m[1].trim();
    return text.trim();
}

export function looksLikeWholeJsonForFiles(text) {
    const t = (text || "").trim();
    if (!t) return false;
    if (!t.startsWith("{") || !t.endsWith("}")) return false;
    if (t.includes("\"files\"") && t.includes("\"content\"")) return true;
    return false;
}

export function normalizeGeneratedContent(pathRel, rawContent) {
    const lowerPath = (pathRel || "").toLowerCase();
    let text = typeof rawContent === "string" ? rawContent : "";
    text = stripCodeFence(text);

    const isSourceLike =
        lowerPath.endsWith(".java") ||
        lowerPath.endsWith(".kt") ||
        lowerPath.endsWith(".ts") ||
        lowerPath.endsWith(".tsx") ||
        lowerPath.endsWith(".js") ||
        lowerPath.endsWith(".jsx") ||
        lowerPath.endsWith(".py") ||
        lowerPath.endsWith(".cs") ||
        lowerPath.endsWith(".go") ||
        lowerPath.endsWith(".rb") ||
        lowerPath.endsWith(".php");

    if (isSourceLike && looksLikeWholeJsonForFiles(text)) {
        throw new Error(
            `codegen 生成的 ${pathRel} 内容看起来仍是 JSON（包含 files/content），而非源码，请调整提示或模型配置后重试。`
        );
    }

    return text;
}

export function loadPlanText(taskDir, planTextOverride) {
    const planFile = resolve(taskDir, "planning", "plan.md");
    if (planTextOverride) return planTextOverride;
    if (existsSync(planFile)) return readFileSync(planFile, "utf-8");
    return "# (空计划)";
}

export function loadFilesFromPlan(taskDir) {
    const filesJsonPath = resolve(taskDir, "planning", "plan.files.json");
    if (!existsSync(filesJsonPath)) return [];
    try {
        const parsed = JSON.parse(readFileSync(filesJsonPath, "utf-8"));
        return Array.isArray(parsed.files) ? parsed.files : [];
    } catch {
        return [];
    }
}

export function loadCachedProposals({ tasksDir, taskId }) {
    const taskDir = resolve(tasksDir, taskId);
    const planPath = resolve(taskDir, "codegen.plan.json");
    if (!existsSync(planPath)) return [];
    try {
        const cached = JSON.parse(readFileSync(planPath, "utf-8"));
        return Array.isArray(cached.files) ? cached.files : [];
    } catch {
        return [];
    }
}

export function applyChangesToWorkspace({ cwd, changes }) {
    for (const c of changes) {
        const srcAbs = resolve(cwd, c.path);
        const dstDir = dirname(srcAbs);
        fs.ensureDirSync(dstDir);
        // 内容已经在主循环中写入，这里只确保目录存在
    }
}

export function writeSnapshots({ cwd, taskDir, changes }) {
    const filesDir = resolve(taskDir, "files");
    for (const c of changes) {
        const srcAbs = resolve(cwd, c.path);
        const dstAbs = resolve(filesDir, c.path + ".full");
        fs.ensureDirSync(dirname(dstAbs));
        const txt = readFileSync(srcAbs, "utf-8");
        writeFileSync(dstAbs, txt, "utf-8");
    }
}

export function summarizeDiff({ cwd, changes }) {
    const files = [];
    let added = 0;
    let deleted = 0;

    const newFiles = changes.filter((c) => c.op === "create");
    const newSummary = summarizeCreatedFiles(cwd, newFiles);
    files.push(...newSummary.files);
    added += newSummary.totalAdded;

    return { files, added, deleted };
}

