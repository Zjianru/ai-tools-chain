import { callDeepseekChat, loadProjectPrompt, extractJson } from "./common.mjs";

async function callRole({ apiKey, model, aiDir, roleKey, planning, planReview, planMd }) {
    const systemContent = loadProjectPrompt(aiDir, roleKey, "");

    const systemMsg = {
        role: "system",
        content: systemContent
    };

    const planningText = planning ? JSON.stringify(planning, null, 2) : "(无 planning.ai.json)";
    const planReviewText = planReview
        ? JSON.stringify(planReview, null, 2)
        : "(无 plan-review.json)";
    const userMsg = {
        role: "user",
        content: [
            "[PLANNING.JSON]",
            planningText.slice(0, 8000),
            "",
            "[PLAN-REVIEW.JSON]",
            planReviewText.slice(0, 4000),
            "",
            "[PLAN.MD]",
            (planMd || "(无 plan.md)").slice(0, 4000)
        ].join("\n")
    };

    const { data, content } = await callDeepseekChat({
        apiKey,
        model,
        messages: [systemMsg, userMsg],
        extra: {}
    });

    try {
        const text = extractJson(content || "");
        const parsed = JSON.parse(text);
        const verdict =
            parsed.verdict ||
            parsed.Verdict ||
            parsed ||
            null;
        if (!verdict || typeof verdict !== "object") {
            return { ok: false, error: "planning_role_verdict_missing", raw: data };
        }
        return {
            ok: true,
            verdict,
            usage: data?.usage || null,
            raw: data
        };
    } catch {
        return { ok: false, error: "planning_role_json_parse_failed" };
    }
}

export async function handlePlanningProductPlanner({ apiKey, model, aiDir, payload }) {
    return await callRole({
        apiKey,
        model,
        aiDir,
        roleKey: "planning_product_planner",
        planning: payload.planning,
        planReview: payload.planReview,
        planMd: payload.planMd
    });
}

export async function handlePlanningSystemDesigner({ apiKey, model, aiDir, payload }) {
    return await callRole({
        apiKey,
        model,
        aiDir,
        roleKey: "planning_system_designer",
        planning: payload.planning,
        planReview: payload.planReview,
        planMd: payload.planMd
    });
}

export async function handlePlanningSeniorDeveloper({ apiKey, model, aiDir, payload }) {
    return await callRole({
        apiKey,
        model,
        aiDir,
        roleKey: "planning_senior_developer",
        planning: payload.planning,
        planReview: payload.planReview,
        planMd: payload.planMd
    });
}

export async function handlePlanningTestPlanner({ apiKey, model, aiDir, payload }) {
    return await callRole({
        apiKey,
        model,
        aiDir,
        roleKey: "planning_test_planner",
        planning: payload.planning,
        planReview: payload.planReview,
        planMd: payload.planMd
    });
}

export async function handlePlanningRiskPlanner({ apiKey, model, aiDir, payload }) {
    return await callRole({
        apiKey,
        model,
        aiDir,
        roleKey: "planning_risk_planner",
        planning: payload.planning,
        planReview: payload.planReview,
        planMd: payload.planMd
    });
}

