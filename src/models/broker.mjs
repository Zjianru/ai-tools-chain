// src/models/broker.mjs
import ini from "ini";
import fs from "fs";
import path from "path";
import { anthropicAdapter } from "./adapters/anthropic.mjs";
import { openaiAdapter } from "./adapters/openai.mjs";
import { copilotAdapter } from "./adapters/gh_copilot.mjs";

const registry = { anthropic: anthropicAdapter, openai: openaiAdapter, gh_copilot: copilotAdapter };

export function loadModelsConfig(aiDir) {
    const file = path.resolve(aiDir, "config", "models.conf");
    const raw = fs.readFileSync(file, "utf-8");
    const conf = ini.parse(raw);

    const active = (conf.models?.active_profile || "default").trim();
    const profiles = {};

    // 从所有 section 提取 profile.<name>.<role>.<n>
    for (const section of Object.keys(conf)) {
        const m = section.match(/^profile\.([^\.]+)\.(codegen|review|second_opinion)\.(\d+)$/);
        if (!m) continue;
        const [, name, role, order] = m;
        const step = { order: Number(order), ...conf[section] };
        profiles[name] ||= { roles: { codegen: [], review: [], second_opinion: [] } };
        profiles[name].roles[role].push(step);
    }
    // 按序号排序
    for (const name of Object.keys(profiles)) {
        for (const role of Object.keys(profiles[name].roles)) {
            profiles[name].roles[role].sort((a, b) => a.order - b.order);
        }
    }

    // prompts（可选）
    const prompts = conf.prompts || {};
    return { activeProfile: active, profiles, prompts };
}

export async function invokeRole(role, payload, ctx) {
    const { aiDir, cwd, profile } = ctx;
    const cfg = loadModelsConfig(aiDir);
    const prof = cfg.profiles[profile || cfg.activeProfile] || {};
    const chain = (prof.roles?.[role] || []).map(s => ({
        provider: (s.provider || "").toLowerCase(),
        model: s.model || "",
        apiKeyEnv: s.api_key_env || "",
        mode: s.mode || "messages"
    }));
    if (!chain.length) return { ok: false, error: `models.conf: 未配置 role ${role}` };

    const errors = [];
    for (const step of chain) {
        const adapter = registry[step.provider];
        if (!adapter) { errors.push(`未知 provider: ${step.provider}`); continue; }
        try {
            const res = await adapter.invoke(role, payload, { cwd, step, aiDir, prompts: cfg.prompts });
            if (res?.ok) return res;
            errors.push(`${step.provider} 返回非 ok`);
        } catch (e) {
            errors.push(`${step.provider} 失败: ${e?.message || e}`);
        }
    }
    return { ok: false, error: errors.join(" | ") };
}