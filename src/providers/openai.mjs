export async function reviewWithOpenAI({ diffText, model, apiKey }) {
    // 同样给出“最小可用”模拟：返回一个固定的 review 结构
    return {
        summary: "代码审查（demo）：未发现高风险问题。",
        risks: [],
        suggestions: []
    };
}

export async function secondOpinionFallback({ planText, diffText, model, apiKey }) {
    return { verdict: "ok", notes: "第二意见（OpenAI 兜底 demo）" };
}