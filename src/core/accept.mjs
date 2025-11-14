import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execa } from "execa";
import { autoArchiveOldTasks } from "./task.mjs";

export async function runAcceptCore({
    cwd,
    aiDir,
    tasksDir,
    taskId,
    metaPath,
    cfg,
    commitMessage,
    overrideGate = false
}) {
    const doCommit = typeof commitMessage !== "undefined";

    let failed = false;
    let failedStep = null;
    const reportPath = resolve(tasksDir, taskId, "eval-report.json");
    if (existsSync(reportPath)) {
        try {
            const report = JSON.parse(readFileSync(reportPath, "utf-8"));
            const firstFailed = (report?.results || []).find((r) => r.status === "failed");
            if (firstFailed) {
                failed = true;
                failedStep = firstFailed.step;
            }
        } catch {
            failed = false;
        }
    }

    const allowOverride = String(cfg?.eval?.allow_gate_override || "false").toLowerCase() === "true";
    const overridePhrase = (cfg?.confirm?.override_phrase || "确认合入").trim();

    if (failed && !overrideGate) {
        if (!allowOverride) {
            return {
                ok: false,
                reason: "gate_failed",
                allowOverride: false,
                failedStep
            };
        }
        return {
            ok: false,
            reason: "needs_override",
            allowOverride: true,
            overridePhrase,
            failedStep
        };
    }

    if (!doCommit) {
        return {
            ok: true,
            reason: "gate_passed",
            failedStep: failed ? failedStep : null,
            allowOverride,
            overridePhrase
        };
    }

    const msg = commitMessage && commitMessage.trim()
        ? commitMessage.trim()
        : `feat(atc): codegen for task ${taskId}`;

    try {
        await execa("git", ["add", "-A"], { cwd });
        await execa("git", ["commit", "-m", msg], { cwd });
        const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
        meta.status = "done";
        writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        await autoArchiveOldTasks(aiDir);
        return {
            ok: true,
            reason: "committed",
            failedStep: failed ? failedStep : null
        };
    } catch (e) {
        return {
            ok: false,
            reason: "commit_failed",
            error: e.message || String(e)
        };
    }
}
