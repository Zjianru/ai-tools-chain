import { callDeepseekChat, loadProjectPrompt, extractJson } from "./common.mjs";

export async function handlePlanning({ apiKey, model, aiDir, payload }) {
    const brief = payload.userBrief || "";
    const repoSummary = payload.repoSummary || "";
    const history = Array.isArray(payload.history) ? payload.history : [];

    const systemContent = loadProjectPrompt(aiDir, "planning", "");

    const systemMsg = {
        role: "system",
        content: systemContent
    };

    const historyText = history
        .map((h) => {
            if (!h || !h.ts || !h.role || !h.text) return "";
            return `[${h.ts}] [${h.role}] ${h.text}`;
        })
        .filter(Boolean)
        .join("\n");
    const userMsg = {
        role: "user",
        content: [
            "下面是本次任务的简要说明、代码仓库概览与历史对话，请基于这些信息给出当前版本的规划 JSON。",
            "",
            "[BRIEF]",
            brief.slice(0, 2000) || "(无)",
            "",
            "[REPO_SUMMARY]",
            repoSummary.slice(0, 2000) || "(无)",
            "",
            "[HISTORY]",
            historyText.slice(0, 8000) || "(无)"
        ].join("\n")
    };

    const { data, content } = await callDeepseekChat({
        apiKey,
        model,
        messages: [systemMsg, userMsg],
        extra: {}
    });

    let parsed = null;
    try {
        const text = extractJson(content || "");
        parsed = JSON.parse(text);
    } catch {
        return { ok: false, error: "planning_json_parse_failed" };
    }

    if (!parsed.status && parsed.planning) {
        parsed = {
            status: "ready",
            questions: [],
            planning: parsed
        };
    }

    return {
        ok: true,
        status: parsed.status || "ready",
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
        planning: parsed.planning || null,
        usage: data?.usage || null,
        raw: data
    };
}
