import chalk from "chalk";
import fs from "fs-extra";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { runPlanReviewCore } from "../planning/planReviewCore.mjs";

export class PlanReviewAgent {
    constructor() {
        this.name = "plan_review";
    }

    /**
     * step({ cwd, aiDir, tasksDir, taskId, metaPath })
     */
    async step(ctx) {
        const { tasksDir, taskId } = ctx;
        const taskDir = resolve(tasksDir, taskId);
        fs.ensureDirSync(taskDir);

        const logs = [];
        const {
            planningDir,
            planningPath,
            planMdPath,
            reviewJsonPath,
            reviewMdPath,
            reviewJson,
            planning,
            planMd,
            ok,
            issues
        } = runPlanReviewCore({ tasksDir, taskId });

        // 可选：调用 plan_review 模型角色，获取更细粒度的 AI 规划审查意见
        if (planning) {
            try {
                const planningText = readFileSync(planningPath, "utf-8");
                const ai = await (await import("../models/broker.mjs")).invokeRole(
                    "plan_review",
                    { planningText, planText: planMd, issues },
                    { aiDir: ctx.aiDir, cwd: ctx.cwd }
                );
                if (ai?.ok && ai.review) {
                    const merged = { ...reviewJson, ai_review: ai.review };
                    writeFileSync(reviewJsonPath, JSON.stringify(merged, null, 2), "utf-8");
                    logs.push(chalk.cyan("已附加 AI 规划审查意见（ai_review）到 plan-review.json。"));
                }
            } catch {
                // AI plan review 失败时忽略，保持规则结果
            }
        }

        logs.push(chalk.cyan(`已生成规划审查结果：${reviewJsonPath}`));
        logs.push(chalk.gray(`人类可读版：${reviewMdPath}`));
        if (!ok) {
            logs.push(chalk.yellow("提示：规划存在阻塞性问题，建议修复后再进入 codegen 阶段。"));
        }

        return {
            logs,
            statePatch: {
                phase: "plan_review",
                actors: {
                    plan_review: { status: "completed" }
                }
            }
        };
    }
}
