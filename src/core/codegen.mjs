import fs from "fs-extra";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { execa } from "execa";
import crypto from "crypto";
import { nowISO } from "./task.mjs";
import { summarizeModifiedWithGit, summarizeCreatedFiles } from "../domain/diff.mjs";
import { invokeRole } from "../models/broker.mjs";

async function runGit(cwd, args) {
    const { stdout } = await execa("git", args, { cwd });
    return stdout.trim();
}

async function requireGitClean(cwd) {
    await execa("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
    const s = await runGit(cwd, ["status", "--porcelain"]);
    if (s !== "") throw new Error("工作区不是干净状态，请先提交或清理后再重试");
    const name = await runGit(cwd, ["config", "--get", "user.name"]).catch(() => "");
    const email = await runGit(cwd, ["config", "--get", "user.email"]).catch(() => "");
    if (!name || !email) throw new Error("未配置 git user.name / user.email，提交将失败。请先 git config。");
}

function sha256(buf) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}

function isLikelyXml(text) {
    const t = (text || "").trim();
    if (!t) return false;
    if (t.startsWith("<?xml")) return true;
    if (t.startsWith("<project") || t.startsWith("<dependencies")) return true;
    const angleCount = (t.match(/</g) || []).length;
    const braceCount = (t.match(/[{}]/g) || []).length;
    return angleCount > 10 && angleCount > braceCount * 2;
}

function isLikelyJava(text) {
    const t = (text || "").trim();
    if (!t) return false;
    if (/package\s+[a-zA-Z0-9_.]+;/.test(t)) return true;
    if (/public\s+class\s+[A-Z][A-Za-z0-9_]*/.test(t)) return true;
    if (/import\s+org\.springframework\./.test(t)) return true;
    return false;
}

async function generateCodegenPlan({
    cwd,
    aiDir,
    tasksDir,
    taskId,
    planText,
    repoSummary,
    filesFromPlan
}) {
    const taskDir = resolve(tasksDir, taskId);
    const codegenResult = await invokeRole(
        "codegen",
        { planText, repoSummary, files: filesFromPlan },
        { aiDir, cwd }
    );

    try {
        const logsDir = resolve(tasksDir, taskId, "logs", "models");
        fs.ensureDirSync(logsDir);
        const log = {
            role: "codegen",
            created_at: nowISO(),
            files_from_plan: filesFromPlan,
            ok: !!codegenResult?.ok,
            error: codegenResult?.error || null
        };
        writeFileSync(
            resolve(logsDir, "codegen.invoke.json"),
            JSON.stringify(log, null, 2),
            "utf-8"
        );
    } catch {
        // logging best-effort
    }

    if (!codegenResult?.ok) {
        throw new Error(codegenResult?.error || "codegen 调用失败");
    }
    const proposals = Array.isArray(codegenResult.files) ? codegenResult.files : [];
    const plan = {
        taskId,
        generated_at: nowISO(),
        files: proposals
    };
    const planPath = resolve(taskDir, "codegen.plan.json");
    writeFileSync(planPath, JSON.stringify(plan, null, 2), "utf-8");
    return proposals;
}

export async function runCodegenCore({
    cwd,
    aiDir,
    tasksDir,
    taskId,
    metaPath,
    cfg,
    branchName = null,
    planTextOverride = null,
    repoSummaryOverride = null
}) {
    const taskDir = resolve(tasksDir, taskId);
    const planFile = resolve(taskDir, "plan.md");
    const planText = planTextOverride ?? (existsSync(planFile) ? readFileSync(planFile, "utf-8") : "# (空计划)");
    const repoSummary = repoSummaryOverride ?? "(可选) 这里可以用 git ls-files + 目录树生成概览";

    // 若存在 plan.files.json，则优先使用其中的文件列表作为目标文件
    let filesFromPlan = [];
    const filesJsonPath = resolve(taskDir, "plan.files.json");
    if (existsSync(filesJsonPath)) {
        try {
            const parsed = JSON.parse(readFileSync(filesJsonPath, "utf-8"));
            if (Array.isArray(parsed.files)) filesFromPlan = parsed.files;
        } catch {
            // ignore parse errors, fallback to planning.ai.json / planText
        }
    }

    const planPath = resolve(taskDir, "codegen.plan.json");
    let proposals = [];
    if (existsSync(planPath)) {
        try {
            const cached = JSON.parse(readFileSync(planPath, "utf-8"));
            if (Array.isArray(cached.files)) {
                proposals = cached.files;
            }
        } catch {
            // ignore, fallback to regenerate plan
        }
    }
    if (!proposals.length) {
        proposals = await generateCodegenPlan({
            cwd,
            aiDir,
            tasksDir,
            taskId,
            planText,
            repoSummary,
            filesFromPlan
        });
    }

    const meta = JSON.parse(readFileSync(metaPath, "utf-8"));

    await requireGitClean(cwd);

    if (branchName && branchName.trim()) {
        await execa("git", ["checkout", "-b", branchName.trim()], { cwd });
    }

    await execa("git", ["commit", "--allow-empty", "-m", `chore(atc): pre-gen snapshot for task ${taskId}`], { cwd });

    const changes = [];
    const irFiles = [];
    for (const p of proposals) {
        if (!p?.path) continue;
        const abs = resolve(cwd, p.path);
        fs.ensureDirSync(dirname(abs));
        const isNew = !existsSync(abs);
        const content = p.content ?? "";

        // 简单的语言/内容一致性检查，避免将 pom.xml 之类内容写入 .java 文件
        const lowerPath = p.path.toLowerCase();
        if (lowerPath.endsWith(".java")) {
            if (isLikelyXml(content) && !isLikelyJava(content)) {
                throw new Error(
                    `codegen 生成的 ${p.path} 内容看起来是 XML 而非 Java，请调整规划或提示后重试。`
                );
            }
        }

        writeFileSync(abs, content, "utf-8");
        const buf = Buffer.from(content, "utf-8");
        changes.push({
            path: p.path,
            op: isNew ? "create" : "modify",
            size: buf.length,
            hash: sha256(buf)
        });

        // 生成最小 IR 条目，供后续 Agent/编排使用
        const lower = p.path.toLowerCase();
        let language = "text";
        if (lower.endsWith(".java")) language = "java";
        else if (lower.endsWith(".kt")) language = "kotlin";
        else if (lower.endsWith(".xml")) language = "xml";
        else if (lower.endsWith(".yml") || lower.endsWith(".yaml")) language = "yaml";
        else if (lower.endsWith(".json")) language = "json";
        else if (lower.endsWith(".md")) language = "markdown";

        irFiles.push({
            path: p.path,
            op: isNew ? "create" : "modify",
            language,
            intent: p.intent || p.rationale || ""
        });
    }

    const filesDir = resolve(taskDir, "files");
    for (const c of changes) {
        const srcAbs = resolve(cwd, c.path);
        const dstAbs = resolve(filesDir, c.path + ".full");
        fs.ensureDirSync(dirname(dstAbs));
        const txt = readFileSync(srcAbs, "utf-8");
        writeFileSync(dstAbs, txt, "utf-8");
    }

    // 写出 codegen IR 文件，描述本次生成/修改的文件级意图
    const ir = {
        taskId,
        generated_at: nowISO(),
        files: irFiles
    };
    writeFileSync(resolve(taskDir, "codegen.ir.json"), JSON.stringify(ir, null, 2), "utf-8");

    const patchJson = { taskId, generated_at: nowISO(), items: changes };
    writeFileSync(resolve(taskDir, "patch.json"), JSON.stringify(patchJson, null, 2), "utf-8");

    meta.status = "review";
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    // 汇总变更摘要：
    // - 对于新建文件（create），按文件内容行数统计新增行；
    // - 对于修改文件（modify），使用 git diff --numstat 统计增删行；
    const files = [];
    let added = 0;
    let deleted = 0;

    const newFiles = changes.filter((c) => c.op === "create");
    const newSummary = summarizeCreatedFiles(cwd, newFiles);
    files.push(...newSummary.files);
    added += newSummary.totalAdded;

    const modifiedFiles = changes.filter((c) => c.op === "modify");
    if (modifiedFiles.length) {
        const diffByPath = await summarizeModifiedWithGit(
            cwd,
            modifiedFiles.map((m) => m.path)
        );
        for (const mf of modifiedFiles) {
            const diff = diffByPath.get(mf.path) || { added: 0, deleted: 0 };
            added += diff.added;
            deleted += diff.deleted;
            files.push({ path: mf.path, added: diff.added, deleted: diff.deleted });
        }
    }

    const deletedFilesEntries = changes.filter((c) => c.op === "delete");
    for (const df of deletedFilesEntries) {
        files.push({ path: df.path, added: 0, deleted: 0 });
    }

    return {
        taskId,
        branchName: branchName && branchName.trim() ? branchName.trim() : null,
        changes,
        diffSummary: {
            filesCount: files.length,
            added,
            deleted,
            files
        },
        config: cfg
    };
}
