import fs from "fs-extra";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { execa } from "execa";
import crypto from "crypto";
import { nowISO } from "./task.mjs";
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
    const meta = JSON.parse(readFileSync(metaPath, "utf-8"));

    await requireGitClean(cwd);

    if (branchName && branchName.trim()) {
        await execa("git", ["checkout", "-b", branchName.trim()], { cwd });
    }

    await execa("git", ["commit", "--allow-empty", "-m", `chore(atc): pre-gen snapshot for task ${taskId}`], { cwd });

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
            // ignore parse errors, fallback to planText
        }
    }

    // 通过 models/broker 调用当前 profile 下的 codegen 链
    const codegenResult = await invokeRole(
        "codegen",
        { planText, repoSummary, files: filesFromPlan },
        { aiDir, cwd }
    );
    if (!codegenResult?.ok) {
        throw new Error(codegenResult?.error || "codegen 调用失败");
    }
    const proposals = Array.isArray(codegenResult.files) ? codegenResult.files : [];

    const changes = [];
    for (const p of proposals) {
        if (!p?.path) continue;
        const abs = resolve(cwd, p.path);
        fs.ensureDirSync(dirname(abs));
        const isNew = !existsSync(abs);
        const content = p.content ?? "";
        writeFileSync(abs, content, "utf-8");
        const buf = Buffer.from(content, "utf-8");
        changes.push({
            path: p.path,
            op: isNew ? "create" : "modify",
            size: buf.length,
            hash: sha256(buf)
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
    for (const nf of newFiles) {
        const abs = resolve(cwd, nf.path);
        let text = "";
        try {
            text = readFileSync(abs, "utf-8");
        } catch {
            text = "";
        }
        const lineCount = text ? text.split(/\r?\n/).length : 0;
        added += lineCount;
        files.push({ path: nf.path, added: lineCount, deleted: 0 });
    }

    const modifiedFiles = changes.filter((c) => c.op === "modify");
    if (modifiedFiles.length) {
        try {
            const args = ["--no-pager", "diff", "--numstat", "--", ...modifiedFiles.map((m) => m.path)];
            const { stdout: numstat } = await execa("git", args, { cwd });
            const lines = numstat.trim() ? numstat.trim().split("\n") : [];
            const diffByPath = new Map();
            for (const ln of lines) {
                const m = ln.match(/^(\d+|\-)\s+(\d+|\-)\s+(.+)$/);
                if (!m) continue;
                const a = m[1] === "-" ? 0 : parseInt(m[1], 10);
                const d = m[2] === "-" ? 0 : parseInt(m[2], 10);
                const p = m[3];
                diffByPath.set(p, { added: a, deleted: d });
                added += a;
                deleted += d;
            }
            for (const mf of modifiedFiles) {
                const diff = diffByPath.get(mf.path) || { added: 0, deleted: 0 };
                files.push({ path: mf.path, added: diff.added, deleted: diff.deleted });
            }
        } catch {
            // 若 git diff 失败，不影响文件本身和 patch.json，只是摘要缺少行级统计
            for (const mf of modifiedFiles) {
                files.push({ path: mf.path, added: 0, deleted: 0 });
            }
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
