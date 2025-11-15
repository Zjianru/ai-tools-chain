import fs from "fs-extra";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

export function loadTaskState(tasksDir, taskId) {
    const taskDir = resolve(tasksDir, taskId);
    fs.ensureDirSync(taskDir);
    const statePath = resolve(taskDir, "state.json");
    if (!fs.existsSync(statePath)) {
        const initial = {
            task_id: taskId,
            phase: "planning",
            actors: {
                planning: { status: "idle" },
                plan_review: { status: "idle" },
                codegen: { status: "idle" },
                review: { status: "idle" },
                test: { status: "idle" }
            },
            artifacts: {}
        };
        writeTaskState(tasksDir, taskId, initial);
        return initial;
    }
    try {
        const raw = readFileSync(statePath, "utf-8");
        return JSON.parse(raw);
    } catch {
        // 若 state.json 损坏，使用最小初始状态覆盖
        const fallback = {
            task_id: taskId,
            phase: "planning",
            actors: {
                planning: { status: "idle" },
                plan_review: { status: "idle" },
                codegen: { status: "idle" },
                review: { status: "idle" },
                test: { status: "idle" }
            },
            artifacts: {}
        };
        writeTaskState(tasksDir, taskId, fallback);
        return fallback;
    }
}

export function writeTaskState(tasksDir, taskId, state) {
    const taskDir = resolve(tasksDir, taskId);
    fs.ensureDirSync(taskDir);
    const statePath = resolve(taskDir, "state.json");
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}

export function applyStatePatch(tasksDir, taskId, patch) {
    const state = loadTaskState(tasksDir, taskId);
    const next = { ...state };
    if (patch.phase) {
        next.phase = patch.phase;
    }
    if (patch.actors) {
        next.actors = {
            ...(state.actors || {}),
            ...patch.actors
        };
    }
    if (patch.artifacts) {
        next.artifacts = {
            ...(state.artifacts || {}),
            ...patch.artifacts
        };
    }
    writeTaskState(tasksDir, taskId, next);
    return next;
}

