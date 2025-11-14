import fs from "fs-extra";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { execa } from "execa";
import crypto from "crypto";
import { runCodegen } from "../providers/index.mjs";
import { nowISO } from "./task.mjs";

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

    const proposals = await runCodegen({ aiDir, planText, repoSummary });
    const targets = proposals.map((p) => p.path);

    const changes = [];
    for (const rel of targets) {
        const abs = resolve(cwd, rel);
        fs.ensureDirSync(dirname(abs));
        const isNew = !existsSync(abs);
        const text = [
            "# AI Tools Chain",
            `# Task: ${taskId}`,
            `# File: ${rel}`,
            "",
            "// 这是一段示例内容（占位），用于验证 codegen 流程。",
            "// 之后这里会由模型生成真实业务代码。",
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

    for (const p of proposals) {
        const abs = resolve(cwd, p.path);
        fs.ensureDirSync(dirname(abs));
        const isNew = !existsSync(abs);
        writeFileSync(abs, p.content, "utf-8");
        changes.push({
            path: p.path,
            op: isNew ? "create" : "modify",
            size: Buffer.byteLength(p.content)
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

    const { stdout: numstat } = await execa("git", ["--no-pager", "diff", "--numstat"], { cwd });
    const lines = numstat.trim() ? numstat.trim().split("\n") : [];
    let added = 0;
    let deleted = 0;
    const files = [];
    for (const ln of lines) {
        const m = ln.match(/^(\d+|\-)\s+(\d+|\-)\s+(.+)$/);
        if (m) {
            const a = m[1] === "-" ? 0 : parseInt(m[1], 10);
            const d = m[2] === "-" ? 0 : parseInt(m[2], 10);
            const f = m[3];
            added += a;
            deleted += d;
            files.push({ path: f, added: a, deleted: d });
        }
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
