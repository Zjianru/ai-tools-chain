// src/models/broker.mjs
import ini from "ini";
import fs from "fs";
import path from "path";
import { anthropicAdapter } from "./adapters/anthropic.mjs";
import { openaiAdapter } from "./adapters/openai.mjs";
import { copilotAdapter } from "./adapters/gh_copilot.mjs";
import { deepseekAdapter } from "./adapters/deepseek.mjs";

const registry = {
    anthropic: anthropicAdapter,
    openai: openaiAdapter,
    gh_copilot: copilotAdapter,
    deepseek: deepseekAdapter
};

export function loadModelsConfig(aiDir) {
    const file = path.resolve(aiDir, "config", "models.conf");
    const raw = fs.readFileSync(file, "utf-8");
    const conf = ini.parse(raw);

    const active = (conf.models?.active_profile || "default").trim();
    const profiles = {};

    // 解析 profile.<name>.<role>.<序号>，ini 会把它们展开为：
    // conf.profile[name][role][order] = { provider, model, api_key_env, ... }
    const profileRoot = conf.profile || {};
    for (const name of Object.keys(profileRoot)) {
        const roleRoot = profileRoot[name] || {};
        const roles = { codegen: [], review: [], second_opinion: [], planning: [], plan_review: [] };
        for (const role of Object.keys(roles)) {
            const stepsObj = roleRoot[role] || {};
            for (const orderKey of Object.keys(stepsObj)) {
                const stepConf = stepsObj[orderKey] || {};
                const order = Number(orderKey) || 0;
                roles[role].push({ order, ...stepConf });
            }
            roles[role].sort((a, b) => a.order - b.order);
        }
        profiles[name] = { roles };
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
            const detail = res && typeof res.error === "string" && res.error
                ? `: ${res.error}`
                : "";
            errors.push(`${step.provider} 返回非 ok${detail}`);
        } catch (e) {
            errors.push(`${step.provider} 失败: ${e?.message || e}`);
        }
    }
    return { ok: false, error: errors.join(" | ") };
}
