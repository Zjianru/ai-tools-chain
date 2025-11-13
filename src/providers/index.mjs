import ini from "ini";
import { readFileSync } from "fs";
import { resolve } from "path";
import { codegenWithClaude } from "./anthropic.mjs";
import { reviewWithOpenAI, secondOpinionFallback } from "./openai.mjs";
import { secondOpinionCopilot } from "./gh-copilot.mjs";

export function loadProviderConfig(aiDir) {
    const conf = ini.parse(readFileSync(resolve(aiDir, "config", "toolchain.conf"), "utf-8"));
    return {
        codegen: conf["model.codegen"] || {},
        review: conf["model.review"] || {},
        secondOpinion: conf["model.second_opinion"] || {},
        openspec: conf["openspec"] || {}
    };
}

export async function runCodegen({ aiDir, planText, repoSummary }) {
    const cfg = loadProviderConfig(aiDir).codegen;
    if ((cfg.provider || "").toLowerCase() === "anthropic") {
        return await codegenWithClaude({
            planText, repoSummary, model: cfg.model, apiKey: process.env[cfg.api_key_env || ""]
        });
    }
    throw new Error("未支持的 codegen provider");
}

export async function runReview({ aiDir, diffText }) {
    const cfg = loadProviderConfig(aiDir).review;
    if ((cfg.provider || "").toLowerCase() === "openai") {
        return await reviewWithOpenAI({ diffText, model: cfg.model, apiKey: process.env[cfg.api_key_env || ""] });
    }
    return { summary: "未配置 review provider", risks: [], suggestions: [] };
}

export async function runSecondOpinion({ aiDir, cwd, planText, diffText }) {
    const cfg = loadProviderConfig(aiDir).secondOpinion;
    if ((cfg.provider || "").toLowerCase() === "gh_copilot") {
        const r = await secondOpinionCopilot({ cwd, diffText });
        if (r.verdict !== "unknown") return r;
        // 回退到 openai
        if ((cfg.fallback_provider || "").toLowerCase() === "openai") {
            return await secondOpinionFallback({
                planText, diffText, model: cfg.fallback_model, apiKey: process.env[cfg.fallback_key_env || ""]
            });
        }
        return r;
    }
    // 其它实现：openai / anthropic 都可以作为第二意见
    return await secondOpinionFallback({
        planText, diffText, model: cfg.fallback_model, apiKey: process.env[cfg.fallback_key_env || ""]
    });
}