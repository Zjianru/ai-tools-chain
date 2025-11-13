export const openaiAdapter = {
    async invoke(role, payload, { step }) {
        const apiKey = process.env[step.apiKeyEnv || ""];
        if (!apiKey) throw new Error("缺少 OPENAI_API_KEY");
        if (role === "review") {
            return { ok: true, summary: "（OpenAI demo）代码审查通过", risks: [], suggestions: [] };
        }
        if (role === "second_opinion") {
            return { ok: true, verdict: "ok", notes: "（OpenAI demo）无阻塞问题" };
        }
        if (role === "codegen") {
            // 也可以作为兜底 codegen
            const files = (payload.files || extractTargets(payload.planText)).map(p => ({
                path: p, content: "// openai demo code", rationale: "demo"
            }));
            return { ok: true, files };
        }
        return { ok: false };
    }
};
function extractTargets(planText = "") { return (planText.match(/^\s*-\s+(.+?)\s*$/gmi) || []).map(l => l.replace(/^\s*-\s+/, "").trim()); }