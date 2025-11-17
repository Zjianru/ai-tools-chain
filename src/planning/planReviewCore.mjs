import fs from "fs-extra";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

function readJsonSafe(path, fallback = null) {
    try {
        const raw = readFileSync(path, "utf-8");
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

export function runPlanReviewCore({ tasksDir, taskId }) {
    const taskDir = resolve(tasksDir, taskId);
    fs.ensureDirSync(taskDir);

    const planningDir = resolve(taskDir, "planning");
    const planningPath = resolve(planningDir, "planning.ai.json");
    const planMdPath = resolve(planningDir, "plan.md");
    const openspecValidatePath = resolve(taskDir, "logs", "openspec", "validate.json");

    const logs = [];
    const issues = [];

    const planning = readJsonSafe(planningPath, null);
    const planMd = (() => {
        try {
            return readFileSync(planMdPath, "utf-8");
        } catch {
            return "";
        }
    })();
    const openspec = readJsonSafe(openspecValidatePath, null);

    if (!planning) {
        issues.push({
            id: "PLANNING_MISSING",
            type: "planning",
            severity: "error",
            message: "planning.ai.json 不存在或解析失败。"
        });
    }

    if (!planMd.trim()) {
        issues.push({
            id: "PLAN_MD_MISSING",
            type: "planning",
            severity: "error",
            message: "plan.md 不存在或为空。"
        });
    }

    const openspecErrors = [];
    const openspecWarnings = [];
    if (openspec && typeof openspec === "object") {
        const errs = openspec.errors || openspec.error || [];
        if (Array.isArray(errs)) {
            errs.forEach((e, idx) => {
                const msg = typeof e === "string" ? e : e?.message || JSON.stringify(e);
                openspecErrors.push(msg);
                issues.push({
                    id: `OPEN_SPEC_ERR_${idx + 1}`,
                    type: "openspec",
                    severity: "error",
                    message: msg
                });
            });
        }
        const warns = openspec.warnings || [];
        if (Array.isArray(warns)) {
            warns.forEach((w, idx) => {
                const msg = typeof w === "string" ? w : w?.message || JSON.stringify(w);
                openspecWarnings.push(msg);
                issues.push({
                    id: `OPEN_SPEC_WARN_${idx + 1}`,
                    type: "openspec",
                    severity: "warning",
                    message: msg
                });
            });
        }
    }

    let summary = {
        title: "",
        why: "",
        what: "",
        requirementsCount: 0,
        draftFilesCount: 0,
        targets: [],
        risksCount: 0,
        acceptanceCount: 0
    };

    if (planning) {
        const reqs = Array.isArray(planning.requirements) ? planning.requirements : [];
        if (!reqs.length) {
            issues.push({
                id: "REQ_EMPTY",
                type: "planning",
                severity: "warning",
                message: "规划中未包含任何 requirements。"
            });
        }

        const draftFiles = Array.isArray(planning.draft_files) ? planning.draft_files : [];
        const acceptance = Array.isArray(planning.acceptance) ? planning.acceptance : [];

        summary = {
            title: planning.meta?.title || planning.title || "",
            why: planning.why || "",
            what: planning.what || "",
            requirementsCount: reqs.length,
            draftFilesCount: draftFiles.length,
            targets: Array.isArray(planning.targets) ? planning.targets : [],
            risksCount: Array.isArray(planning.risks) ? planning.risks.length : planning.risks ? 1 : 0,
            acceptanceCount: acceptance.length
        };

        if (!draftFiles.length) {
            issues.push({
                id: "DRAFT_FILES_EMPTY",
                type: "planning",
                severity: "warning",
                message: "规划中未提供 draft_files，codegen 将无法安全生成代码。"
            });
        }
        if (!acceptance.length) {
            issues.push({
                id: "ACCEPTANCE_EMPTY",
                type: "planning",
                severity: "warning",
                message: "规划中未明确验收标准（acceptance）。"
            });
        }
        if (!planning.test_plan || !planning.test_plan.strategy) {
            issues.push({
                id: "TEST_PLAN_EMPTY",
                type: "planning",
                severity: "warning",
                message: "规划中未给出测试计划（test_plan.strategy）。建议补充测试策略与关键用例。"
            });
        }
    }

    const hasError = issues.some((i) => i.severity === "error");
    const ok = !hasError;
    const reasons = issues
        .filter((i) => i.severity === "error")
        .map((i) => i.message);

    const reviewJson = {
        taskId,
        ok,
        reasons,
        issues,
        summary,
        openspec: {
            ok: !openspecErrors.length,
            errors: openspecErrors,
            warnings: openspecWarnings
        }
    };

    const reviewJsonPath = resolve(planningDir, "plan-review.json");
    writeFileSync(reviewJsonPath, JSON.stringify(reviewJson, null, 2), "utf-8");

    const lines = [];
    lines.push(`# Plan Review for task ${taskId}`);
    lines.push("");
    lines.push(`- 结论（gate）：${ok ? "通过" : "未通过"}`);
    lines.push(`- openspec 校验：${openspecErrors.length ? "存在错误" : "无阻塞错误"}`);
    if (summary.title) {
        lines.push(`- 规划标题：${summary.title}`);
    }
    if (summary.requirementsCount || summary.draftFilesCount) {
        lines.push(
            `- 规划概览：requirements=${summary.requirementsCount}, draft_files=${summary.draftFilesCount}`
        );
    }
    lines.push("");
    if (issues.length) {
        lines.push("## 发现的问题/风险");
        lines.push("");
        issues.forEach((i) => {
            lines.push(`- [${i.severity}] (${i.type}) ${i.message}`);
        });
        lines.push("");
    } else {
        lines.push("## 发现的问题/风险");
        lines.push("");
        lines.push("- （当前未发现结构层问题）");
        lines.push("");
    }

    // 若规划中存在 scope/non_goals/open_questions/test_plan，可在审查报告中简单呈现
    if (planning) {
        const scope = planning.scope || "";
        const nonGoals = Array.isArray(planning.non_goals) ? planning.non_goals : [];
        const openQuestions = Array.isArray(planning.open_questions)
            ? planning.open_questions
            : [];
        const testPlan = planning.test_plan || null;

        if (scope || nonGoals.length) {
            lines.push("## Scope / Non-goals（来自规划）");
            lines.push("");
            if (scope) {
                lines.push(`- Scope：${scope}`);
            }
            if (nonGoals.length) {
                lines.push(`- Non-goals：${nonGoals.join("; ")}`);
            }
            lines.push("");
        }

        if (openQuestions.length) {
            lines.push("## Open Questions（来自规划）");
            lines.push("");
            openQuestions.forEach((q) => lines.push(`- ${q}`));
            lines.push("");
        }

        if (testPlan && (testPlan.strategy || (Array.isArray(testPlan.cases) && testPlan.cases.length))) {
            lines.push("## Test Plan（来自规划）");
            lines.push("");
            if (testPlan.strategy) {
                lines.push(`- 策略: ${testPlan.strategy}`);
            }
            if (Array.isArray(testPlan.cases) && testPlan.cases.length) {
                lines.push("- 关键用例:");
                testPlan.cases.forEach((c) => lines.push(`  - ${c}`));
            }
            if (testPlan.automation) {
                lines.push(`- 自动化范围: ${testPlan.automation}`);
            }
            lines.push("");
        }
    }

    const reviewMdPath = resolve(planningDir, "plan-review.md");
    writeFileSync(reviewMdPath, lines.join("\n"), "utf-8");

    return {
        planningDir,
        planningPath,
        planMdPath,
        reviewJsonPath,
        reviewMdPath,
        reviewJson,
        planning,
        planMd,
        ok,
        issues
    };
}

