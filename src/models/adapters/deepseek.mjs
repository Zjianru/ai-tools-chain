// DeepSeek adapter - OpenAI-style chat completions
import fs from "fs";
import path from "path";

const DEFAULT_BASE_URL = "https://api.deepseek.com/chat/completions";

async function callDeepseekChat({ apiKey, model, messages, extra }) {
    if (!apiKey) {
        throw new Error("缺少 DEEPSEEK_API_KEY（或配置的 api_key_env 环境变量）");
    }

    const body = {
        model: model || "deepseek-chat",
        messages,
        // 默认参数可以由 models.conf 中 future 字段扩展，这里先给出一组保守默认值
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

function loadProjectPrompt(aiDir, key, fallback) {
    try {
        if (!aiDir) return fallback;
        const base = path.resolve(aiDir, "prompts");
        const candidates = [
            path.resolve(base, `${key}.system.md`),
            path.resolve(base, `${key}.md`)
        ];
        for (const p of candidates) {
            if (fs.existsSync(p)) {
                return fs.readFileSync(p, "utf-8");
            }
        }
    } catch {
        // ignore
    }
    return fallback;
}

export const deepseekAdapter = {
    async invoke(role, payload, { step, aiDir }) {
        const apiKeyEnv = step.apiKeyEnv || step.api_key_env || "DEEPSEEK_API_KEY";
        const apiKey = process.env[apiKeyEnv];
        const model = step.model || "deepseek-chat";

        // 根据角色构造不同的系统提示和用户内容
        if (role === "review") {
            const diff = payload.diffText || "";
            const systemContent = loadProjectPrompt(
                aiDir,
                "review",
                "你是一个资深代码审查助手，请阅读 diff 并给出风险与建议。"
            );
            const systemMsg = {
                role: "system",
                content: systemContent
            };
            const userMsg = {
                role: "user",
                content: `下面是代码 diff，请用简要条目说明：1）总体评价；2）潜在风险；3）改进建议。\n\n${diff.slice(0, 60000)}`
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

        if (role === "second_opinion") {
            const plan = payload.planText || "";
            const diff = payload.diffText || "";
            const systemContent = loadProjectPrompt(
                aiDir,
                "second_opinion",
                "你是一个第二视角审查者，请从整体方案和 diff 的角度给出审查意见。"
            );
            const systemMsg = {
                role: "system",
                content: systemContent
            };
            const userMsg = {
                role: "user",
                content: `下面是计划与 diff，请给出高层次的第二意见（可以用要点列出）：\n\n[PLAN]\n${plan.slice(0, 2000)}\n\n[DIFF]\n${diff.slice(0, 60000)}`
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

        if (role === "codegen") {
            const plan = payload.planText || "";
            const filesFromPayload = Array.isArray(payload.files) ? payload.files : [];
            const targets = filesFromPayload.length
                ? filesFromPayload
                : extractTargets(plan);
            if (!targets.length) {
                return {
                    ok: false,
                    error: "未从计划中解析到目标文件；请在规划中增加文件列表，或在 plan.files.json 中显式指定。"
                };
            }

            const systemContent = loadProjectPrompt(
                aiDir,
                "codegen",
                [
                    "你是代码生成助手，请根据规划为每个目标文件生成合理的代码实现。",
                    "",
                    "严格输出一个 JSON 对象，结构为：",
                    "{",
                    '  "files": [',
                    "    {",
                    '      "path": "相对文件路径，如 src/Main.java 或 pom.xml",',
                    '      "language": "java | xml | yaml | other",',
                    '      "content": "该文件的完整内容字符串"',
                    "    }",
                    "  ]",
                    "}",
                    "",
                    "- files 数组中，每个目标文件 path 只出现一次；",
                    "- 如果是 pom.xml，请生成标准 Maven pom；",
                    "- 如果是 .java 文件，请生成可编译的 Java 源码；",
                    "- 禁止输出 Markdown 代码块（```）；",
                    "- 禁止输出注释说明或额外文字，只能输出 JSON。"
                ].join("\n")
            );
            const systemMsg = {
                role: "system",
                content: systemContent
            };
            const userMsg = {
                role: "user",
                content: [
                    "根据下面的规划，为这些目标文件生成对应的实现：",
                    "",
                    "目标文件列表：",
                    targets.map((f) => `- ${f}`).join("\n"),
                    "",
                    "[PLAN]",
                    plan.slice(0, 4000)
                ].join("\n")
            };

            const { content } = await callDeepseekChat({
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
                // 若解析失败，回退到旧的粗粒度行为：将整体内容作为占位代码写入所有文件
                const codeBody = stripCodeFence(content || "");
                const filesFallback = targets.map((p) => ({
                    path: p,
                    content: `// generated by DeepSeek\n// file: ${p}\n\n${codeBody}`,
                    rationale: "generated by deepseekAdapter (fallback)"
                }));
                return { ok: true, files: filesFallback };
            }

            const jsonFiles = Array.isArray(parsed.files) ? parsed.files : [];
            // 若解析成功但未提供 files 数组，同样退回到粗粒度 fallback，避免直接失败阻断流程
            if (!jsonFiles.length) {
                const codeBody = stripCodeFence(content || "");
                const filesFallback = targets.map((p) => ({
                    path: p,
                    content: `// generated by DeepSeek\n// file: ${p}\n\n${codeBody}`,
                    rationale: "generated by deepseekAdapter (fallback_no_files)"
                }));
                return { ok: true, files: filesFallback };
            }

            const files = jsonFiles
                .filter((f) => f && typeof f.path === "string" && typeof f.content === "string")
                .map((f) => ({
                    path: f.path,
                    content: f.content,
                    rationale: f.rationale || "generated by deepseekAdapter",
                    intent: f.intent || ""
                }));

            return { ok: true, files };
        }

        if (role === "plan_review") {
            const planning = payload.planningText || "";
            const planMd = payload.planText || "";
            const issues = Array.isArray(payload.issues) ? payload.issues : [];
            const systemContent = loadProjectPrompt(
                aiDir,
                "plan_review",
                "你是规划审查专家，请根据规划 JSON、plan.md 与初步问题列表，给出更精细的规划审查意见和下一步建议。严格输出 JSON。"
            );
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

        if (role === "planning_meeting") {
            const planning = payload.planning || null;
            const planReview = payload.planReview || null;
            const planMd = payload.planMd || "";

            const systemContent = loadProjectPrompt(
                aiDir,
                "planning_meeting",
                [
                    "你是一个软件项目的规划阶段会议主持人（Planning Meeting Chair）。",
                    "你的任务是根据规划 JSON、规划审查结果与 plan.md，给出结构化的会议纪要和下一步行动建议。",
                    "",
                    "严格输出一个 JSON 对象，结构为：",
                    "{",
                    '  "meeting": {',
                    '    "summary": "一句话总结当前规划是否可进入 codegen（例如：结构合理，可进入 codegen）",',
                    '    "key_points": ["要点 1", "要点 2"],',
                    '    "risks": ["风险 1", "风险 2"],',
                    '    "open_questions": ["尚待澄清的问题 1"],',
                    '    "next_actions": ["下一步行动 1", "行动 2"],',
                    '    "decision": "go | hold | redo_planning"',
                    "  }",
                    "}",
                    "",
                    "- 严禁输出 Markdown 代码块标记（```），只输出 JSON。"
                ].join("\n")
            );

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

        if (role === "review_meeting") {
            const review = payload.review || null;
            const secondOpinion = payload.secondOpinion || "";

            const systemContent = loadProjectPrompt(
                aiDir,
                "review_meeting",
                [
                    "你是一个软件项目的代码审查会议主持人（Code Review Meeting Chair）。",
                    "你的任务是根据 review.json 和 second_opinion.md，给出结构化的会议纪要和下一步行动建议。",
                    "",
                    "严格输出一个 JSON 对象，结构为：",
                    "{",
                    '  "meeting": {',
                    '    "summary": "总体审查结论",',
                    '    "risks": ["风险 1", "风险 2"],',
                    '    "suggestions": ["建议 1", "建议 2"],',
                    '    "open_questions": ["尚待澄清的问题 1"],',
                    '    "next_actions": ["下一步行动 1"],',
                    '    "decision": "approve | request_changes | hold"',
                    "  }",
                    "}",
                    "",
                    "- 严禁输出 Markdown 代码块标记（```），只输出 JSON。"
                ].join("\n")
            );

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

        if (role === "planning") {
            const brief = payload.userBrief || "";
            const repoSummary = payload.repoSummary || "";
            const history = Array.isArray(payload.history) ? payload.history : [];

            const systemContent = loadProjectPrompt(
                aiDir,
                "planning",
                [
                    "你是资深软件规划助手，负责为单个开发任务产出规范、可执行的规划 JSON，用于驱动 OpenSpec 和后续 codegen/review/eval。",
                    "",
                    "严格输出一个 JSON 对象，结构为：",
                    "{",
                    '  "status": "need_clarification" | "ready",',
                    '  "questions": ["..."],',
                    '  "planning": {',
                    '    "schema_version": 1,',
                    '    "meta": { "id": "task-...", "title": "简短标题", "risk": "low|medium|high|critical", "owner": "@you" },',
                    '    "why": "为什么要做（1–3 句话）",',
                    '    "what": "大致改动内容（1–3 段）",',
                    '    "requirements": [',
                    '      {',
                    '        "id": "REQ-1",',
                    '        "title": "需求标题",',
                    '        "shall": "The system SHALL ...",',
                    '        "rationale": "可选",',
                    '        "scenarios": [',
                    '          { "name": "场景名称", "steps": ["步骤 1", "步骤 2"], "notes": "可选" }',
                    '        ]',
                    '      }',
                    '    ],',
                    '    "targets": ["src/", "scripts/"],',
                    '    "risks": ["风险 1", "风险 2"],',
                    '    "acceptance": ["验收标准 1", "验收标准 2"],',
                    '    "draft_files": ["建议改动或新增的文件路径，如 src/Main.java"],',
                    '    "tasks": ["具体任务 1", "具体任务 2"],',
                    '    "notes": "可选补充说明/待确认事项"',
                    "  }",
                    "}",
                    "",
                    "- 若当前信息不足以安全生成规划：",
                    '  * 请设置 status = "need_clarification"，在 questions 中给出 1–3 个关键问题，planning 可设为 {}。',
                    "- 若信息已经足够：",
                    '  * 请设置 status = "ready"，questions 为空数组，并完整填充 planning 对象（尤其是 requirements 与 draft_files）。',
                    "- 严禁输出 Markdown 代码块标记（```）、注释或额外说明文字。仅输出 JSON。"
                ].join("\n")
            );
            const systemMsg = {
                role: "system",
                content: systemContent
            };

            const historyText = history.length
                ? history.map((h, idx) => {
                    const qs = (h.questions || []).map((q) => `Q: ${q}`).join("\n");
                    const as = (h.answers || []).map((a) => `A: ${a}`).join("\n");
                    return `[#${idx + 1}]\n${qs}\n${as}`;
                }).join("\n\n")
                : "(无历史对话)";

            const userMsg = {
                role: "user",
                content: [
                    "当前任务的用户需求描述：",
                    brief || "(用户未提供详细描述)",
                    "",
                    "项目概要（截取部分文件列表，可选）：",
                    repoSummary || "(略)",
                    "",
                    "此前的澄清问答历史（如有）：",
                    historyText,
                    "",
                    "请根据以上信息，输出符合前述 schema 的 JSON。"
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

            // 兼容两种形态：
            // 1) 完整的 {status, questions, planning}
            // 2) 仅返回 planning 对象
            if (!parsed.status && parsed.planning) {
                parsed.status = "ready";
            } else if (!parsed.status && !parsed.planning) {
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

        return { ok: false };
    }
};

function extractTargets(planText = "") {
    return (planText.match(/^\s*-\s+(.+?)\s*$/gim) || [])
        .map((l) => l.replace(/^\s*-\s+/, "").trim())
        .filter(Boolean);
}

function extractJson(text) {
    // 若模型返回中包含形如 ```json ... ``` 的代码块，优先提取其中内容
    const m = text.match(/```json\s*([\s\S]*?)```/i);
    if (m && m[1]) return m[1].trim();
    return text.trim();
}

function stripCodeFence(text) {
    if (!text) return "";
    const m = text.match(/```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/);
    if (m && m[1]) return m[1].trim();
    return text.trim();
}
