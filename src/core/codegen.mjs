import fs from "fs-extra";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { execa } from "execa";
import { nowISO } from "./task.mjs";
import { summarizeModifiedWithGit } from "../domain/diff.mjs";
import { invokeRole } from "../models/broker.mjs";
import { CodegenPlanSchema, CodegenIRSchema } from "./schemas.mjs";
import {
    sha256,
    isLikelyXml,
    isLikelyJava,
    normalizeGeneratedContent,
    loadPlanText,
    loadFilesFromPlan,
    loadCachedProposals,
    applyChangesToWorkspace,
    writeSnapshots,
    summarizeDiff
} from "../codegen/utils.mjs";

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

async function generateCodegenPlan({
    cwd,
    aiDir,
    tasksDir,
    taskId,
    planText,
    repoSummary,
    filesFromPlan
}) {
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
    // 强协议：在落盘前校验 IR 结构
    CodegenPlanSchema.parse(plan);
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
    const planText = loadPlanText(taskDir, planTextOverride);
    const repoSummary = repoSummaryOverride ?? "(可选) 这里可以用 git ls-files + 目录树生成概览";
    const filesFromPlan = loadFilesFromPlan(taskDir);
    let proposals = loadCachedProposals({ tasksDir, taskId });
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
        if (!p || typeof p.path !== "string") {
            throw new Error("codegen IR 中存在缺少 path 的条目，请检查模型输出或协议实现。");
        }
        const abs = resolve(cwd, p.path);
        fs.ensureDirSync(dirname(abs));
        const isNew = !existsSync(abs);
        const content = normalizeGeneratedContent(p.path, p.content);

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

    applyChangesToWorkspace({ cwd, changes });
    writeSnapshots({ cwd, taskDir, changes });

    // 写出 codegen IR 文件，描述本次生成/修改的文件级意图
    const ir = {
        taskId,
        generated_at: nowISO(),
        files: irFiles
    };
    // 校验 codegen IR 结构，避免写入不合法文件描述
    CodegenIRSchema.parse(ir);
    writeFileSync(resolve(taskDir, "codegen.ir.json"), JSON.stringify(ir, null, 2), "utf-8");

    const patchJson = { taskId, generated_at: nowISO(), items: changes };
    writeFileSync(resolve(taskDir, "patch.json"), JSON.stringify(patchJson, null, 2), "utf-8");

    meta.status = "review";
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    // 汇总变更摘要：
    // - 对于新建文件（create），按文件内容行数统计新增行；
    // - 对于修改文件（modify），使用 git diff --numstat 统计增删行；
    const { files: diffFiles, added, deleted } = summarizeDiff({ cwd, changes });

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
            diffFiles.push({ path: mf.path, added: diff.added, deleted: diff.deleted });
        }
    }

    const deletedFilesEntries = changes.filter((c) => c.op === "delete");
    for (const df of deletedFilesEntries) {
        diffFiles.push({ path: df.path, added: 0, deleted: 0 });
    }

    return {
        taskId,
        branchName: branchName && branchName.trim() ? branchName.trim() : null,
        changes,
        diffSummary: {
            filesCount: diffFiles.length,
            added,
            deleted,
            files: diffFiles
        },
        config: cfg
    };
}
