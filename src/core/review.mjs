import fs from "fs-extra";
import { readFileSync, writeFileSync, existsSync } from "fs";
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

    const taskDir = resolve(tasksDir, taskId);
    const planningDir = resolve(taskDir, "planning");
    const planFile = resolve(planningDir, "plan.md");
    const planningPath = resolve(planningDir, "planning.ai.json");

    let planText = "";
    try {
        planText = readFileSync(planFile, "utf-8");
    } catch {
        planText = "";
    }

    let planning = null;
    try {
        if (existsSync(planningPath)) {
            planning = JSON.parse(readFileSync(planningPath, "utf-8"));
        }
    } catch {
        planning = null;
    }

    // 基于 planning 扩展字段做范围/风险的辅助检查（仅做提示，不 Gate）
    const planningContext = {};
    const planningChecks = {};
    if (planning && typeof planning === "object") {
        const scope = Array.isArray(planning.scope)
            ? planning.scope
            : planning.scope
                ? [planning.scope]
                : [];
        const nonGoals = Array.isArray(planning.non_goals) ? planning.non_goals : [];
        const openQuestions = Array.isArray(planning.open_questions)
            ? planning.open_questions
            : [];
        const testPlan = planning.test_plan || null;

        planningContext.meta = planning.meta || {};
        if (scope.length) planningContext.scope = scope;
        if (nonGoals.length) planningContext.non_goals = nonGoals;
        if (openQuestions.length) planningContext.open_questions = openQuestions;
        if (testPlan) planningContext.test_plan = testPlan;

        const draftFiles = Array.isArray(planning.draft_files) ? planning.draft_files : [];
        const fileImpacts = Array.isArray(planning.file_impacts)
            ? planning.file_impacts
            : [];
        const impactPaths = fileImpacts
            .map((fi) => (fi && typeof fi === "object" ? fi.path : null))
            .filter(Boolean);

        const plannedPaths = Array.from(
            new Set(
                [...draftFiles, ...impactPaths]
                    .map((p) => (typeof p === "string" ? p.trim() : ""))
                    .filter(Boolean)
            )
        );
        const touchedPaths = files.map((f) => f.path);

        let outOfScopeFiles = [];
        if (plannedPaths.length) {
            const plannedSet = new Set(plannedPaths);
            outOfScopeFiles = touchedPaths.filter((p) => !plannedSet.has(p));
        }

        planningChecks.planned_files = plannedPaths;
        planningChecks.touched_files = touchedPaths;
        planningChecks.out_of_scope_files = outOfScopeFiles;
        planningChecks.non_goals = nonGoals;
        planningChecks.open_questions = openQuestions;
    }

    // 使用 models/broker，根据 models.conf 决定 second_opinion / review 的 provider
    let so = { ok: false, notes: "" };
    let rv = { ok: false, summary: "未配置 review provider", risks: [], suggestions: [] };
    try {
        const soRes = await invokeRole(
            "second_opinion",
            { planText, diffText, planning },
            { aiDir, cwd }
        );
        if (soRes?.ok) so = soRes;
    } catch {
        // ignore, 保持默认
    }
    try {
        const rvRes = await invokeRole(
            "review",
            { diffText, planText, planning },
            { aiDir, cwd }
        );
        if (rvRes?.ok) rv = rvRes;
    } catch {
        // ignore, 保持默认
    }

    const soDir = resolve(aiDir, "second-opinion", taskId);
    fs.ensureDirSync(soDir);
    const soPath = resolve(soDir, "second_opinion.md");
    writeFileSync(soPath, String(so.notes || ""), "utf-8");

    const reviewPath = resolve(tasksDir, taskId, "review.json");
    const fullReview = {
        ...rv,
        planning_context: Object.keys(planningContext).length ? planningContext : undefined,
        planning_checks: Object.keys(planningChecks).length ? planningChecks : undefined
    };
    writeFileSync(reviewPath, JSON.stringify(fullReview, null, 2), "utf-8");

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
        secondOpinionPreview: String(so.notes || "").slice(0, 800),
        planningContext,
        planningChecks
    };
}
