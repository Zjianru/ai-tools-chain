import fs from "fs";
import path from "path";

const planningRolePromptFiles = {
    planning_product_planner: "../prompts/planning/ProductPlanner.md",
    planning_system_designer: "../prompts/planning/SystemDesigner.md",
    planning_senior_developer: "../prompts/planning/SeniorDeveloper.md",
    planning_test_planner: "../prompts/planning/TestPlanner.md",
    planning_risk_planner: "../prompts/planning/RiskPlanner.md"
};

export function loadProjectPrompt(aiDir, key, fallback) {
    let prompts = {};
    try {
        const jsonPath = new URL("./prompts.json", import.meta.url);
        const raw = fs.readFileSync(jsonPath, "utf-8");
        prompts = JSON.parse(raw);
    } catch {
        // ignore
    }
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

    // 其次尝试加载内置的规划角色 prompt（src/models/prompts/planning/*.md）
    try {
        const rel = planningRolePromptFiles[key];
        if (rel) {
            const url = new URL(rel, import.meta.url);
            return fs.readFileSync(url, "utf-8");
        }
    } catch {
        // ignore
    }
    const defaultPrompt = prompts[key];
    if (Array.isArray(defaultPrompt)) {
        return defaultPrompt.join("\n");
    }
    return typeof defaultPrompt === "string" ? defaultPrompt : fallback;
}

export function extractTargets(planText = "") {
    return (planText.match(/^\s*-\s+(.+?)\s*$/gim) || [])
        .map((l) => l.replace(/^\s*-\s+/, "").trim())
        .filter(Boolean);
}

export function extractJson(text) {
    const m = text.match(/```json\s*([\s\S]*?)```/i);
    if (m && m[1]) return m[1].trim();
    return text.trim();
}

export function stripCodeFence(text) {
    if (!text) return "";
    const m = text.match(/```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/);
    if (m && m[1]) return m[1].trim();
    return text.trim();
}
