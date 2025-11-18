import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { loadTaskState, applyStatePatch } from "./state.mjs";
import { snapshotPlanningVersion } from "../planning/versions.mjs";

// 简单的线性阶段定义，后续可从配置或文档中抽取
const LINEAR_PHASES = ["planning", "plan_review", "codegen", "code_review", "code_review_meeting", "test", "accept"];

export function getInitialPhase() {
    return LINEAR_PHASES[0];
}

export function nextPhase(currentPhase) {
    const idx = LINEAR_PHASES.indexOf(currentPhase);
    if (idx === -1 || idx === LINEAR_PHASES.length - 1) {
        return null;
    }
    return LINEAR_PHASES[idx + 1];
}

function normalizePhase(phase) {
    if (!phase) return getInitialPhase();
    if (LINEAR_PHASES.includes(phase)) return phase;
    if (phase.endsWith("_done")) {
        const base = phase.replace(/_done$/, "");
        if (LINEAR_PHASES.includes(base)) return base;
    }
    if (phase === "test_run") return "test";
    return phase;
}

/**
 * 读取当前任务的 state.json 与部分 artifacts，并给出下一步推荐阶段。
 * 返回形如：{ phase, reason, details? }
 */
export function suggestNextFromState(tasksDir, taskId) {
    const state = loadTaskState(tasksDir, taskId);
    const currentPhaseRaw = state.phase || getInitialPhase();
    const currentPhase = normalizePhase(currentPhaseRaw);

    // 基于 plan-review 结果：若未通过，建议回到 planning
    if (currentPhase === "plan_review") {
        const taskDir = resolve(tasksDir, taskId);
        const planReviewPath = resolve(taskDir, "planning", "plan-review.json");
        if (existsSync(planReviewPath)) {
            try {
                const pr = JSON.parse(readFileSync(planReviewPath, "utf-8"));
                if (pr && pr.ok === false) {
                    return {
                        phase: "planning",
                        reason: "plan_review_not_ok",
                        details: { from: currentPhase, planReviewOk: pr.ok }
                    };
                }
            } catch {
                // ignore parse error, fallback to linear
            }
        }
    }

    // 基于评测结果：test_run 后若有失败，推荐进入 accept 阶段，由 AcceptAgent 做 gate 判定
    if (currentPhase === "test_run" || currentPhase === "test") {
        const taskDir = resolve(tasksDir, taskId);
        const reportPath = resolve(taskDir, "eval-report.json");
        if (existsSync(reportPath)) {
            try {
                const report = JSON.parse(readFileSync(reportPath, "utf-8"));
                const failed = (report?.results || []).find((r) => r.status === "failed");
                if (failed) {
                    return {
                        phase: "accept",
                        reason: "eval_failed_needs_gate",
                        details: { from: currentPhase, failedStep: failed.step }
                    };
                }
                return {
                    phase: "accept",
                    reason: "eval_passed_ready_for_accept",
                    details: { from: currentPhase }
                };
            } catch {
                // ignore parse error, fallback to linear
            }
        }
    }

    const next = nextPhase(currentPhase);
    return {
        phase: next,
        reason: `linear_pipeline: ${currentPhase} -> ${next}`
    };
}

/**
 * 回退到指定阶段，仅更新 state.json 中的 phase 和 actors[phase].round。
 * 不做代码回滚，由调用方决定是否配合 /revert 等命令。
 */
export function redoPhase(tasksDir, taskId, phase) {
    const state = loadTaskState(tasksDir, taskId);
    const actors = state.actors || {};
    const actor = actors[phase] || {};
    const currentRound = actor.round || 0;
    if (phase === "planning" && currentRound > 0) {
        snapshotPlanningVersion({ tasksDir, taskId, round: currentRound });
    }
    const nextRound = currentRound + 1 || 1;
    const patch = {
        phase,
        actors: {
            [phase]: {
                ...actor,
                status: "redo",
                round: nextRound
            }
        }
    };
    return applyStatePatch(tasksDir, taskId, patch);
}
