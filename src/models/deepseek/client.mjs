export const DEFAULT_BASE_URL = "https://api.deepseek.com/chat/completions";

export async function callDeepseekChat({ apiKey, model, messages, extra }) {
    if (!apiKey) {
        throw new Error("缺少 DEEPSEEK_API_KEY（或配置的 api_key_env 环境变量）");
    }

    const body = {
        model: model || "deepseek-chat",
        messages,
        temperature: 1,
        top_p: 1,
        max_tokens: 4096,
        stream: false,
        response_format: { type: "text" },
        ...extra
    };

    const res = await fetch(process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`DeepSeek HTTP ${res.status}: ${txt.slice(0, 400)}`);
    }

    const data = await res.json();
    const choice = (data.choices && data.choices[0]) || {};
    const message = choice.message || {};
    const content = typeof message.content === "string" ? message.content : "";

    return { data, content };
}
