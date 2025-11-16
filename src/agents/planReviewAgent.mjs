import chalk from "chalk";
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

export class PlanReviewAgent {
    constructor() {
        this.name = "plan_review";
    }

    /**
     * step({ cwd, aiDir, tasksDir, taskId, metaPath })
     */
    async step(ctx) {
        const { tasksDir, taskId } = ctx;
        const taskDir = resolve(tasksDir, taskId);
        fs.ensureDirSync(taskDir);

        const planningPath = resolve(taskDir, "planning.ai.json");
        const planMdPath = resolve(taskDir, "plan.md");
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

        const reviewJsonPath = resolve(taskDir, "plan-review.json");
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
        }
        const reviewMdPath = resolve(taskDir, "plan-review.md");
        writeFileSync(reviewMdPath, lines.join("\n"), "utf-8");

        // 可选：调用 plan_review 模型角色，获取更细粒度的 AI 规划审查意见
        if (planning) {
            try {
                const planningText = readFileSync(planningPath, "utf-8");
                const ai = await (await import("../models/broker.mjs")).invokeRole(
                    "plan_review",
                    { planningText, planText: planMd, issues },
                    { aiDir: ctx.aiDir, cwd: ctx.cwd }
                );
                if (ai?.ok && ai.review) {
                    const current = readJsonSafe(reviewJsonPath, reviewJson);
                    const merged = { ...current, ai_review: ai.review };
                    writeFileSync(reviewJsonPath, JSON.stringify(merged, null, 2), "utf-8");
                    logs.push(chalk.cyan("已附加 AI 规划审查意见（ai_review）到 plan-review.json。"));
                }
            } catch {
                // AI plan review 失败时忽略，保持规则结果
            }
        }

        logs.push(chalk.cyan(`已生成规划审查结果：${reviewJsonPath}`));
        logs.push(chalk.gray(`人类可读版：${reviewMdPath}`));
        if (!ok) {
            logs.push(chalk.yellow("提示：规划存在阻塞性问题，建议修复后再进入 codegen 阶段。"));
        }

        return {
            logs,
            statePatch: {
                phase: "plan_review",
                actors: {
                    plan_review: { status: "completed" }
                }
            }
        };
    }
}
