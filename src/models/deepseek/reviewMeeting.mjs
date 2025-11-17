import { callDeepseekChat, loadProjectPrompt, extractJson } from "./common.mjs";

export async function handleReviewMeeting({ apiKey, model, aiDir, payload }) {
    const review = payload.review || null;
    const secondOpinion = payload.secondOpinion || "";

    const systemContent = loadProjectPrompt(aiDir, "review_meeting", "");

    const systemMsg = {
        role: "system",
        content: systemContent
    };

    const reviewText = review ? JSON.stringify(review, null, 2) : "(无 review.json)";
    const userMsg = {
        role: "user",
        content: [
            "[REVIEW.JSON]",
            reviewText.slice(0, 4000),
            "",
            "[SECOND_OPINION.MD]",
            (secondOpinion || "(无 second_opinion.md)").slice(0, 4000)
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
        return { ok: false, error: "review_meeting_json_parse_failed" };
    }
}
