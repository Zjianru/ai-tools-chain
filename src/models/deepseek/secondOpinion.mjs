import { callDeepseekChat, loadProjectPrompt } from "./common.mjs";

export async function handleSecondOpinion({ apiKey, model, aiDir, payload }) {
    const plan = payload.planText || "";
    const diff = payload.diffText || "";
    const systemContent = loadProjectPrompt(aiDir, "second_opinion", "");
    const systemMsg = {
        role: "system",
        content: systemContent
    };
    const userMsg = {
        role: "user",
        content: `下面是计划与 diff，请给出高层次的第二意见（可以用要点列出）：\n\n[PLAN]\n${plan.slice(
            0,
            2000
        )}\n\n[DIFF]\n${diff.slice(0, 60000)}`
    };
    const { content } = await callDeepseekChat({
        apiKey,
        model,
        messages: [systemMsg, userMsg],
        extra: {}
    });
    return {
        ok: true,
        verdict: "ok",
        notes: content || "（DeepSeek）第二意见"
    };
}
