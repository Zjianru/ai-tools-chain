import fs from "fs-extra";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { execa } from "execa";
import { runReview, runSecondOpinion } from "../providers/index.mjs";

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

    const dangerList = (cfg?.task?.dangerous_paths || "").split(",").map((s) => s.trim()).filter(Boolean);
    const filesWithDanger = files.map((f) => ({
        ...f,
        danger: inDanger(f.path, dangerList)
    }));

    const { stdout: diffText } = await execa("git", ["--no-pager", "diff"], { cwd });

    const planFile = resolve(tasksDir, taskId, "plan.md");
    let planText = "";
    try {
        planText = readFileSync(planFile, "utf-8");
    } catch {
        planText = "";
    }

    const so = await runSecondOpinion({ aiDir, cwd, planText, diffText });
    const rv = await runReview({ aiDir, diffText });

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
