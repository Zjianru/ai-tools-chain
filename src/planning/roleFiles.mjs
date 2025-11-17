import fs from "fs-extra";
import { writeFileSync } from "fs";
import { resolve } from "path";

const ROLE_FOCUS = {
    ProductPlanner:
        "关注业务目标、范围（scope）、不做事项（non_goals）以及验收标准（acceptance）。",
    SystemDesigner:
        "关注设计与模块拆分、目标文件（draft_files）、影响面（file_impacts）以及关键目标目录（targets）。",
    SeniorDeveloper:
        "关注实现可行性与复杂度，对既有代码的影响，以及可能的实现路径建议。",
    TestPlanner:
        "关注测试计划（test_plan）、可测性、关键用例以及自动化测试范围。",
    RiskPlanner:
        "关注风险项与信息黑洞，尤其是规划中的 risks 与 open_questions 字段。"
};

function formatListSection(lines, title, items) {
    if (!items || !items.length) return;
    lines.push(`## ${title}`);
    lines.push("");
    items.forEach((it) => {
        lines.push(`- ${it}`);
    });
    lines.push("");
}

export function writeRoleMeetingFiles({ planningDir, taskId, planning, meetingJson }) {
    const rounds = Array.isArray(meetingJson?.rounds) ? meetingJson.rounds : [];
    const round = rounds[0] || {};
    const perRoleVerdicts =
        round.per_role_verdicts && typeof round.per_role_verdicts === "object"
            ? round.per_role_verdicts
            : {};

    if (!Object.keys(perRoleVerdicts).length) return;

    const dir = resolve(planningDir, "roles");
    fs.ensureDirSync(dir);

    const why = planning?.why || "";
    const what = planning?.what || "";
    const scope = planning?.scope || "";
    const nonGoals = Array.isArray(planning?.non_goals) ? planning.non_goals : [];
    const acceptance = Array.isArray(planning?.acceptance) ? planning.acceptance : [];
    const draftFiles = Array.isArray(planning?.draft_files) ? planning.draft_files : [];
    const targets = Array.isArray(planning?.targets) ? planning.targets : [];
    const fileImpacts = Array.isArray(planning?.file_impacts) ? planning.file_impacts : [];
    const testPlan = planning?.test_plan || null;
    const risks = Array.isArray(planning?.risks)
        ? planning.risks
        : planning?.risks
        ? [planning.risks]
        : [];
    const openQuestions = Array.isArray(planning?.open_questions)
        ? planning.open_questions
        : [];

    for (const [role, verdict] of Object.entries(perRoleVerdicts)) {
        const status =
            verdict.ok === true ? "OK" : verdict.ok === false ? "NOT_OK" : "UNKNOWN";
        const reasons = Array.isArray(verdict.reasons) ? verdict.reasons : [];
        const suggestions = Array.isArray(verdict.suggestions) ? verdict.suggestions : [];

        const lines = [];
        lines.push(`# ${role} 会议记录（Task ${taskId}）`);
        lines.push("");
        lines.push(`- Verdict：${status}`);
        if (typeof verdict.confidence === "number") {
            lines.push(`- Confidence：${verdict.confidence}`);
        }
        const focus = ROLE_FOCUS[role];
        if (focus) {
            lines.push(`- Role Focus：${focus}`);
        }
        lines.push("");

        if (why || what) {
            lines.push("## 规划背景摘要");
            lines.push("");
            if (why) lines.push(`- Why：${why}`);
            if (what) lines.push(`- What：${what}`);
            lines.push("");
        }

        if (role === "ProductPlanner") {
            if (scope) lines.push(`- Scope：${scope}`);
            if (nonGoals.length) {
                lines.push(`- Non-goals：${nonGoals.join("; ")}`);
            }
            if (acceptance.length) {
                lines.push(`- Acceptance（验证点数量）：${acceptance.length}`);
            }
            lines.push("");
        } else if (role === "SystemDesigner" || role === "SeniorDeveloper") {
            if (draftFiles.length) {
                lines.push(`- Draft Files（候选文件数量）：${draftFiles.length}`);
            }
            if (targets.length) {
                lines.push(`- Targets：${targets.join(", ")}`);
            }
            if (fileImpacts.length) {
                lines.push(
                    `- File Impacts：${fileImpacts
                        .map((f) => f.path || "")
                        .filter(Boolean)
                        .join(", ")}`
                );
            }
            lines.push("");
        } else if (role === "TestPlanner") {
            if (testPlan && (testPlan.strategy || testPlan.cases || testPlan.automation)) {
                lines.push("## Test Plan（规划视角）");
                lines.push("");
                if (testPlan.strategy) lines.push(`- Strategy: ${testPlan.strategy}`);
                if (Array.isArray(testPlan.cases) && testPlan.cases.length) {
                    lines.push("- Cases:");
                    testPlan.cases.forEach((c) => lines.push(`  - ${c}`));
                }
                if (testPlan.automation) {
                    lines.push(`- Automation: ${testPlan.automation}`);
                }
                lines.push("");
            }
        } else if (role === "RiskPlanner") {
            formatListSection(lines, "Risks（来自规划）", risks);
            formatListSection(lines, "Open Questions（来自规划）", openQuestions);
        }

        formatListSection(lines, "Reasons（本角色给出的理由）", reasons);
        formatListSection(lines, "Suggestions（本角色建议）", suggestions);

        const filePath = resolve(dir, `${role}.meeting.md`);
        writeFileSync(filePath, lines.join("\n"), "utf-8");
    }
}

