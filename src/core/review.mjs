import fs from "fs-extra";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { execa } from "execa";
import { invokeRole } from "../models/broker.mjs";
import { summarizeCreatedFiles, summarizeModifiedWithGit } from "../domain/diff.mjs";

function pathIsUnder(p, base) {
    return p === base || p.startsWith(base);
}

function inDanger(pathRel, dangerList) {
    return dangerList.some((d) => {
        const cleaned = d.startsWith("./") ? d.slice(2) : d;
        return pathIsUnder(pathRel, cleaned);
    });
}

export async function runReviewCore({ cwd, aiDir, tasksDir, taskId, cfg }) {
    let added = 0;
    let deleted = 0;
    const files = [];

    // 基于 git diff 统计修改文件
    try {
        const { stdout: numstat } = await execa("git", ["--no-pager", "diff", "--numstat"], { cwd });
        const lines = numstat.trim() ? numstat.trim().split("\n") : [];
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
    } catch {
        // best-effort
    }

    // 补充：从 patch.json 中读取新增文件，计入摘要
    try {
        const patchPath = resolve(tasksDir, taskId, "patch.json");
        if (fs.existsSync(patchPath)) {
            const { items = [] } = JSON.parse(readFileSync(patchPath, "utf-8"));
            const creates = items.filter((it) => it.op === "create");
            const summary = summarizeCreatedFiles(cwd, creates);
            for (const nf of summary.files) {
                const already = files.find((f) => f.path === nf.path);
                if (already) continue;
                files.push(nf);
            }
            added += summary.totalAdded;
        }
    } catch {
        // 若 patch.json 解析失败，忽略新增文件摘要
    }

    const dangerList = (cfg?.task?.dangerous_paths || "").split(",").map((s) => s.trim()).filter(Boolean);
    const filesWithDanger = files.map((f) => ({
        ...f,
        danger: inDanger(f.path, dangerList)
    }));

    // 合成完整 diff：git diff（针对修改） + 对新增文件的伪 diff
    let diffText = "";
    try {
        const { stdout } = await execa("git", ["--no-pager", "diff"], { cwd });
        diffText = stdout || "";
    } catch {
        diffText = "";
    }

    let extraDiffs = "";
    try {
        const patchPath = resolve(tasksDir, taskId, "patch.json");
        if (fs.existsSync(patchPath)) {
            const { items = [] } = JSON.parse(readFileSync(patchPath, "utf-8"));
            const creates = items.filter((it) => it.op === "create");
            for (const it of creates) {
                const abs = resolve(cwd, it.path);
                let text = "";
                try {
                    text = readFileSync(abs, "utf-8");
                } catch {
                    text = "";
                }
                const linesNew = text ? text.split(/\r?\n/) : [];
                extraDiffs += `\ndiff --git a/${it.path} b/${it.path}\n`;
                extraDiffs += "new file mode 100644\n";
                extraDiffs += "--- /dev/null\n";
                extraDiffs += `+++ b/${it.path}\n`;
                extraDiffs += `@@ -0,0 +1,${linesNew.length} @@\n`;
                for (const ln of linesNew) {
                    extraDiffs += `+${ln}\n`;
                }
            }
        }
    } catch {
        // best-effort
    }

    if (extraDiffs) {
        diffText = `${diffText}\n${extraDiffs}`;
    }

    const planFile = resolve(tasksDir, taskId, "plan.md");
    let planText = "";
    try {
        planText = readFileSync(planFile, "utf-8");
    } catch {
        planText = "";
    }

    // 使用 models/broker，根据 models.conf 决定 second_opinion / review 的 provider
    let so = { ok: false, notes: "" };
    let rv = { ok: false, summary: "未配置 review provider", risks: [], suggestions: [] };
    try {
        const soRes = await invokeRole("second_opinion", { planText, diffText }, { aiDir, cwd });
        if (soRes?.ok) so = soRes;
    } catch {
        // ignore, 保持默认
    }
    try {
        const rvRes = await invokeRole("review", { diffText }, { aiDir, cwd });
        if (rvRes?.ok) rv = rvRes;
    } catch {
        // ignore, 保持默认
    }

    const soDir = resolve(aiDir, "second-opinion", taskId);
    fs.ensureDirSync(soDir);
    const soPath = resolve(soDir, "second_opinion.md");
    writeFileSync(soPath, String(so.notes || ""), "utf-8");

    const reviewPath = resolve(tasksDir, taskId, "review.json");
    writeFileSync(reviewPath, JSON.stringify(rv, null, 2), "utf-8");

    return {
        summary: {
            filesCount: files.length,
            added,
            deleted
        },
        files: filesWithDanger,
        secondOpinionPath: soPath,
        reviewPath,
        reviewSummary: rv.summary || "",
        secondOpinionPreview: String(so.notes || "").slice(0, 800)
    };
}
