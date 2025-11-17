import { generateOpenSpecArtifacts } from "./openspecArtifacts.mjs";
import { generateHumanPlanMd } from "./humanPlan.mjs";

/**
 * 基于 inputs + planning 生成 OpenSpec 产物和 planning/plan.md。
 * 不负责更新 task meta，调用方在外层处理。
 */
export async function generateOpenSpecAndPlan({
    cwd, // 目前未使用，保留以兼容调用方签名
    aiDir,
    tasksDir,
    taskId,
    inputs,
    planning
}) {
    const openspecPlanMd = await generateOpenSpecArtifacts({
        aiDir,
        tasksDir,
        taskId,
        inputs,
        planning
    });
    generateHumanPlanMd({
        tasksDir,
        taskId,
        inputs,
        planning,
        openspecPlanMd
    });
}
