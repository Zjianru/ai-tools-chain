import { callDeepseekChat, loadProjectPrompt, extractJson } from "./common.mjs";

export async function handlePlanningMeeting({ apiKey, model, aiDir, payload }) {
    const planning = payload.planning || null;
    const planReview = payload.planReview || null;
    const planMd = payload.planMd || "";

    const systemContent = loadProjectPrompt(aiDir, "planning_meeting", "");

    const systemMsg = {
        role: "system",
        content: systemContent
    };

    const planningText = planning ? JSON.stringify(planning, null, 2) : "(无 planning.ai.json)";
    const planReviewText = planReview ? JSON.stringify(planReview, null, 2) : "(无 plan-review.json)";
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
        return {
            ok: true,
            meeting: parsed.meeting || parsed,
            usage: data?.usage || null,
            raw: data
        };
    } catch {
        return { ok: false, error: "planning_meeting_json_parse_failed" };
    }
}
