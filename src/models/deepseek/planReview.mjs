import { callDeepseekChat, loadProjectPrompt, extractJson } from "./common.mjs";

export async function handlePlanReview({ apiKey, model, aiDir, payload }) {
    const planning = payload.planningText || "";
    const planMd = payload.planText || "";
    const issues = Array.isArray(payload.issues) ? payload.issues : [];
    const systemContent = loadProjectPrompt(aiDir, "plan_review", "");
    const systemMsg = {
        role: "system",
        content: systemContent
    };
    const issuesText = issues
        .map((i) => {
            if (!i) return "";
            if (typeof i === "string") return i;
            return `[${i.severity || "info"}] (${i.type || "planning"}) ${i.message || ""}`;
        })
        .filter(Boolean)
        .join("\n");
    const userMsg = {
        role: "user",
        content: [
            "下面是本次规划的 JSON 与 plan.md 片段，以及结构/openspec 层发现的问题列表。",
            "",
            "[PLANNING.JSON]",
            planning.slice(0, 4000),
            "",
            "[PLAN.MD]",
            planMd.slice(0, 4000),
            "",
            "[ISSUES]",
            issuesText || "(无)"
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
            review: parsed,
            usage: data?.usage || null,
            raw: data
        };
    } catch {
        return { ok: false, error: "plan_review_json_parse_failed" };
    }
}
