import { callDeepseekChat, loadProjectPrompt } from "./common.mjs";

export async function handleReview({ apiKey, model, aiDir, payload }) {
    const diff = payload.diffText || "";
    const systemContent = loadProjectPrompt(
        aiDir,
        "review",
        ""
    );
    const systemMsg = {
        role: "system",
        content: systemContent
    };
    const userMsg = {
        role: "user",
        content: `下面是代码 diff，请用简要条目说明：1）总体评价；2）潜在风险；3）改进建议。\n\n${diff.slice(
            0,
            60000
        )}`
    };
    const { content } = await callDeepseekChat({
        apiKey,
        model,
        messages: [systemMsg, userMsg],
        extra: {}
    });
    return {
        ok: true,
        summary: content || "（DeepSeek）代码审查结果",
        risks: [],
        suggestions: []
    };
}
