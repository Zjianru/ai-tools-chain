import fs from "fs-extra";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execa } from "execa";
import { invokeRole } from "../models/broker.mjs";
import { generateOpenSpecAndPlan } from "../planning/planningCore.mjs";

export async function runPlanningWithInputs({
    cwd,
    aiDir,
    tasksDir,
    taskId,
    metaPath,
    inputs,
    planning
}) {
    await generateOpenSpecAndPlan({ cwd, aiDir, tasksDir, taskId, inputs, planning });
    const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
    meta.status = "plan";
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

export function ensurePlanningDraft({ tasksDir, taskId }) {
    const taskDir = resolve(tasksDir, taskId);
    const planningDir = resolve(taskDir, "planning");
    fs.ensureDirSync(planningDir);
    const draftPath = resolve(planningDir, "planning.draft.json");
    if (!existsSync(draftPath)) {
        // 当前版本仅在规划 ready 后写入草案快照；不存在时返回 null 即可
        return null;
    }
    try {
        const raw = readFileSync(draftPath, "utf-8");
        return JSON.parse(raw);
    } catch {
        // 解析失败时视作尚无有效草案，由调用方决定是否覆盖写入
        return null;
    }
}

export function writePlanningDraft({ tasksDir, taskId, planning }) {
    const taskDir = resolve(tasksDir, taskId);
    const planningDir = resolve(taskDir, "planning");
    fs.ensureDirSync(planningDir);
    const draftPath = resolve(planningDir, "planning.draft.json");
    writeFileSync(draftPath, JSON.stringify(planning, null, 2), "utf-8");
}

export async function callPlanningOnce({
    cwd,
    aiDir,
    tasksDir,
    taskId,
    userBrief,
    history = [],
    round = 1,
    draft = null
}) {
    const taskDir = resolve(tasksDir, taskId);
    fs.ensureDirSync(taskDir);

    let repoSummary = "";
    try {
        const { stdout } = await execa("git", ["ls-files"], { cwd });
        const files = stdout.split(/\r?\n/).filter(Boolean);
        repoSummary = files.slice(0, 100).join("\n");
    } catch {
        repoSummary = "";
    }

    const planningRes = await invokeRole(
        "planning",
        { userBrief, repoSummary, history, draft },
        { aiDir, cwd }
    );
    if (!planningRes?.ok) {
        throw new Error(planningRes?.error || "planning 调用失败");
    }

    // 记录 AI 调用日志和 token 使用情况（每轮一个文件）
    try {
        const logsDir = resolve(tasksDir, taskId, "logs", "models");
        fs.ensureDirSync(logsDir);
        const log = {
            role: "planning",
            provider: "deepseek",
            model: planningRes.raw?.model || "",
            round,
            created_at: new Date().toISOString(),
            user_brief: userBrief,
            repo_summary_sample: repoSummary.slice(0, 400),
            history,
            usage: planningRes.usage || null
        };
        writeFileSync(resolve(logsDir, `planning.deepseek.${round}.json`), JSON.stringify(log, null, 2), "utf-8");
    } catch {
        // logging best-effort
    }

    return planningRes;
}

export async function applyPlanningAndOpenSpec({ cwd, aiDir, tasksDir, taskId, metaPath, planning }) {
    const taskDir = resolve(tasksDir, taskId);
    fs.ensureDirSync(taskDir);
    const planningDir = resolve(taskDir, "planning");
    fs.ensureDirSync(planningDir);

    const planningPath = resolve(planningDir, "planning.ai.json");
    writeFileSync(planningPath, JSON.stringify(planning, null, 2), "utf-8");
    const title = planning.meta?.title || planning.title || `Task ${taskId}`;
    const why = planning.why || "";
    const what = planning.what || "";
    const requirements = Array.isArray(planning.requirements) ? planning.requirements : [];
    const targets = Array.isArray(planning.targets) ? planning.targets : [];
    const acceptance = Array.isArray(planning.acceptance) ? planning.acceptance : [];
    const risks = planning.risks || "";

    const reqTexts = requirements
        .map((r) => {
            if (!r) return "";
            if (typeof r === "string") return r;
            return r.title || r.shall || "";
        })
        .filter((s) => s && s.trim());

    const inputs = {
        title,
        why,
        what,
        req: reqTexts.join(","),
        targets: targets.join(","),
        risks,
        accept: acceptance.join(",")
    };

    if (Array.isArray(planning.draft_files) && planning.draft_files.length) {
        const filesJsonPath = resolve(planningDir, "plan.files.json");
        writeFileSync(
            filesJsonPath,
            JSON.stringify({ files: planning.draft_files }, null, 2),
            "utf-8"
        );
    }

    await runPlanningWithInputs({ cwd, aiDir, tasksDir, taskId, metaPath, inputs, planning });
}

// 保留单次 AI 规划 + OpenSpec 的封装，供非交互式场景复用
export async function runAIPlanningAndOpenSpec({ cwd, aiDir, tasksDir, taskId, metaPath, userBrief }) {
    const res = await callPlanningOnce({ cwd, aiDir, tasksDir, taskId, userBrief, history: [], round: 1 });
    if (!res.planning) {
        throw new Error(res.error || "planning 未返回规划结果");
    }
    await applyPlanningAndOpenSpec({ cwd, aiDir, tasksDir, taskId, metaPath, planning: res.planning });
}
