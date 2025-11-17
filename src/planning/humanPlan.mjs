import fs from "fs-extra";
import { writeFileSync } from "fs";
import { resolve } from "path";

function buildPlanLines({ taskId, inputs, planning, openspecPlanMd }) {
    const { title, why, what, targets, risks, accept } = inputs;
    const titleText = title || `Task ${taskId}`;
    const planningObj = planning || {};

    const scope = planningObj.scope || "";
    const nonGoals = Array.isArray(planningObj.non_goals) ? planningObj.non_goals : [];
    const draftFiles = Array.isArray(planningObj.draft_files) ? planningObj.draft_files : [];
    const testPlan = planningObj.test_plan || null;
    const openQuestions = Array.isArray(planningObj.open_questions)
        ? planningObj.open_questions
        : [];

    const lines = [];
    lines.push(`# Plan for ${titleText}`);
    lines.push("");

    // Overview
    lines.push("## Overview");
    lines.push(what || "(待补充)");
    lines.push("");

    // Why
    lines.push("## Why");
    lines.push(why || "(待补充)");
    lines.push("");

    // Requirements
    if (Array.isArray(planningObj.requirements) && planningObj.requirements.length) {
        lines.push("## Requirements");
        planningObj.requirements.forEach((r) => {
            if (!r) return;
            const rid = r.id ? `${r.id}: ` : "";
            const titleReq = r.title || r.shall || "";
            const shall = r.shall || "";
            if (titleReq) {
                lines.push(`- ${rid}${titleReq}`);
            }
            if (shall && shall !== titleReq) {
                lines.push(`  - SHALL: ${shall}`);
            }
            const scenarios = Array.isArray(r.scenarios) ? r.scenarios : [];
            scenarios.forEach((sc) => {
                const name = sc.name || "Scenario";
                const steps = Array.isArray(sc.steps) ? sc.steps : [];
                lines.push(`  - Scenario: ${name}`);
                if (steps.length) {
                    steps.forEach((st) => lines.push(`    - ${st}`));
                }
            });
        });
        lines.push("");
    }

    // Draft files
    if (draftFiles.length) {
        lines.push("## Draft Files");
        draftFiles.forEach((p) => lines.push(`- ${p}`));
        lines.push("");
    }

    // Targets （来自 inputs.targets）
    const targetList = (targets || "")
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (targetList.length) {
        lines.push("## Targets");
        targetList.forEach((t) => lines.push(`- ${t}`));
        lines.push("");
    }

    // Scope / Non-goals
    if (scope) {
        lines.push("## Scope");
        lines.push(scope);
        lines.push("");
    }
    if (nonGoals.length) {
        lines.push("## Non-Goals");
        nonGoals.forEach((ng) => lines.push(`- ${ng}`));
        lines.push("");
    }

    // Risks
    const risksList = Array.isArray(planningObj.risks)
        ? planningObj.risks
        : risks
        ? [risks]
        : [];
    if (risksList.length) {
        lines.push("## Risks");
        risksList.forEach((r) => lines.push(`- ${r}`));
        lines.push("");
    }

    // Acceptance
    const acceptanceList = Array.isArray(planningObj.acceptance)
        ? planningObj.acceptance
        : accept
        ? accept.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
        : [];
    if (acceptanceList.length) {
        lines.push("## Acceptance Criteria");
        acceptanceList.forEach((a) => lines.push(`- ${a}`));
        lines.push("");
    }

    // Test plan
    if (testPlan && (testPlan.strategy || (Array.isArray(testPlan.cases) && testPlan.cases.length))) {
        lines.push("## Test Plan");
        if (testPlan.strategy) lines.push(`- 策略: ${testPlan.strategy}`);
        if (Array.isArray(testPlan.cases) && testPlan.cases.length) {
            lines.push("- 关键用例:");
            testPlan.cases.forEach((c) => lines.push(`  - ${c}`));
        }
        if (testPlan.automation) lines.push(`- 自动化范围: ${testPlan.automation}`);
        lines.push("");
    }

    // Open questions
    if (openQuestions.length) {
        lines.push("## Open Questions");
        openQuestions.forEach((q) => lines.push(`- ${q}`));
        lines.push("");
    }

    // 可选：附上原始 OpenSpec change 视图作为附录
    if (openspecPlanMd) {
        lines.push("---");
        lines.push("## OpenSpec Change (raw)");
        lines.push("");
        lines.push(openspecPlanMd.trim());
        lines.push("");
    }

    return lines;
}

/**
 * 生成更贴近 planning.ai.json 的人类可读 plan.md。
 * 失败时静默忽略，不阻断主流程。
 */
export function generateHumanPlanMd({
    tasksDir,
    taskId,
    inputs,
    planning,
    openspecPlanMd
}) {
    try {
        const taskDir = resolve(tasksDir, taskId);
        const planningDir = resolve(taskDir, "planning");
        fs.ensureDirSync(planningDir);
        const planFile = resolve(planningDir, "plan.md");

        const lines = buildPlanLines({
            taskId,
            inputs,
            planning,
            openspecPlanMd
        });

        writeFileSync(planFile, lines.join("\n"), "utf-8");
    } catch {
        // best-effort 生成 plan.md，不阻断主流程
    }
}
