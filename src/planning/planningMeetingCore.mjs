import { readFileSync } from "fs";
import { resolve } from "path";
import { loadTaskState } from "../core/state.mjs";
import { nowISO } from "../core/task.mjs";

function readJsonSafe(path, fallback = null) {
    try {
        const raw = readFileSync(path, "utf-8");
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

export function loadPlanningAndReview({ tasksDir, taskId }) {
    const planningDir = resolve(tasksDir, taskId, "planning");
    const planningPath = resolve(planningDir, "planning.ai.json");
    const planReviewPath = resolve(planningDir, "plan-review.json");
    const planMdPath = resolve(planningDir, "plan.md");

    const planning = readJsonSafe(planningPath, null);
    const planReview = readJsonSafe(planReviewPath, null);
    let planMd = "";
    try {
        planMd = readFileSync(planMdPath, "utf-8");
    } catch {
        planMd = "";
    }

    const state = loadTaskState(tasksDir, taskId);
    const planningActor = (state.actors && state.actors.planning) || {};
    const currentRound = planningActor.round || 1;

    return {
        planningDir,
        planningPath,
        planReviewPath,
        planMdPath,
        planning,
        planReview,
        planMd,
        currentRound
    };
}

export function buildPlanningMeetingArtifacts({
    taskId,
    planning,
    planReview,
    planMd,
    aiMeeting,
    currentRound
}) {
    const title = planning.meta?.title || planning.title || `Task ${taskId}`;
    const why = planning.why || "";
    const what = planning.what || "";
    const requirements = Array.isArray(planning.requirements) ? planning.requirements : [];
    const draftFiles = Array.isArray(planning.draft_files) ? planning.draft_files : [];
    const acceptance = Array.isArray(planning.acceptance) ? planning.acceptance : [];
    const scope = planning.scope || "";
    const nonGoals = Array.isArray(planning.non_goals) ? planning.non_goals : [];
    const openQuestions = Array.isArray(planning.open_questions) ? planning.open_questions : [];
    const testPlan = planning.test_plan || null;

    const issues = Array.isArray(planReview?.issues) ? planReview.issues : [];
    const blocking = issues.filter((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning");

    let decision = "hold";
    if (blocking.length) {
        decision = "redo_planning";
    } else if (planReview && planReview.ok) {
        decision = "go";
    }

    const baseMeetingJson = {
        taskId,
        title,
        ok: planReview ? !!planReview.ok : blocking.length === 0,
        planning_summary: {
            why,
            what,
            scope,
            nonGoalsCount: nonGoals.length,
            openQuestionsCount: openQuestions.length,
            requirementsCount: requirements.length,
            draftFilesCount: draftFiles.length,
            acceptanceCount: acceptance.length
        },
        issues,
        plan_md_present: !!planMd,
        rounds: [
            {
                round: currentRound || 1,
                at: nowISO(),
                input_snapshot: {},
                per_role_verdicts: {},
                options: [],
                coach_summary: "",
                decision
            }
        ]
    };

    let meetingJson = baseMeetingJson;
    let mdLines = null;

    if (aiMeeting) {
        meetingJson = {
            ...baseMeetingJson,
            ai_meeting: aiMeeting
        };
        const m = aiMeeting;
        const lines = [];
        lines.push(`# Planning Meeting Notes for task ${taskId}`);
        lines.push("");
        if (m.summary) lines.push(`- 总结：${m.summary}`);
        lines.push(`- 规划标题：${title}`);
        if (why) lines.push(`- Why：${why}`);
        if (what) lines.push(`- What：${what}`);
        lines.push(
            `- 概览：requirements=${requirements.length}, draft_files=${draftFiles.length}, acceptance=${acceptance.length}`
        );
        if (scope) lines.push(`- Scope：${scope}`);
        if (nonGoals.length) lines.push(`- Non-goals：${nonGoals.join("; ")}`);
        if (planReview) {
            lines.push(`- 结构与 openspec gate：${planReview.ok ? "通过" : "未通过"}`);
        }
        lines.push("");
        if (Array.isArray(m.key_points) && m.key_points.length) {
            lines.push("## 关键要点");
            lines.push("");
            m.key_points.forEach((p) => lines.push(`- ${p}`));
            lines.push("");
        }
        if (Array.isArray(m.risks) && m.risks.length) {
            lines.push("## 风险");
            lines.push("");
            m.risks.forEach((r) => lines.push(`- ${r}`));
            lines.push("");
        }
        const openQs = Array.isArray(m.open_questions) ? m.open_questions : [];
        if (openQs.length) {
            lines.push("## 尚待澄清的问题");
            lines.push("");
            openQs.forEach((q) => lines.push(`- ${q}`));
            lines.push("");
        }
        const actions = Array.isArray(m.next_actions) ? m.next_actions : [];
        lines.push("## 下一步建议");
        lines.push("");
        if (actions.length) {
            actions.forEach((a) => lines.push(`- ${a}`));
        } else if (blocking.length) {
            lines.push("- 先修复上述 error 再进入 codegen。");
        } else if (warnings.length) {
            lines.push("- 可以进入 codegen，但建议先评估并处理上述 warning。");
        } else {
            lines.push("- 规划结构合理，可进入 codegen 阶段。");
        }
        if (m.decision) {
            lines.push("");
            lines.push(`> 决策：${m.decision}`);
        }
        mdLines = lines;
    }

    if (!mdLines) {
        const lines = [];
        lines.push(`# Planning Meeting Notes for task ${taskId}`);
        lines.push("");
        lines.push(`- 规划标题：${title}`);
        if (why) lines.push(`- Why：${why}`);
        if (what) lines.push(`- What：${what}`);
        if (scope) lines.push(`- Scope：${scope}`);
        if (nonGoals.length) lines.push(`- Non-goals：${nonGoals.join("; ")}`);
        lines.push(
            `- 概览：requirements=${requirements.length}, draft_files=${draftFiles.length}, acceptance=${acceptance.length}`
        );
        if (planReview) {
            lines.push(`- 结构与 openspec gate：${planReview.ok ? "通过" : "未通过"}`);
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

        if (testPlan && (testPlan.strategy || (Array.isArray(testPlan.cases) && testPlan.cases.length))) {
            lines.push("## 测试计划摘要（来自规划）");
            lines.push("");
            if (testPlan.strategy) lines.push(`- 策略: ${testPlan.strategy}`);
            if (Array.isArray(testPlan.cases) && testPlan.cases.length) {
                lines.push("- 关键用例:");
                testPlan.cases.forEach((c) => lines.push(`  - ${c}`));
            }
            if (testPlan.automation) lines.push(`- 自动化范围: ${testPlan.automation}`);
            lines.push("");
        }

        lines.push("## 下一步建议");
        lines.push("");
        if (blocking.length) {
            lines.push("- 先修复上述 error 再进入 codegen。");
        } else if (warnings.length) {
            lines.push("- 可以进入 codegen，但建议先评估并处理上述 warning。");
        } else {
            lines.push("- 规划结构合理，可进入 codegen 阶段。");
        }
        mdLines = lines;
    }

    return { meetingJson, mdLines };
}
