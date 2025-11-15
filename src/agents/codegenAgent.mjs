import chalk from "chalk";
import { resolve } from "path";
import fs from "fs-extra";
import { runCodegenCore } from "../core/codegen.mjs";

export class CodegenAgent {
    constructor() {
        this.name = "codegen";
    }

    /**
     * step({ cwd, aiDir, tasksDir, taskId, metaPath, cfg, branchName, planTextOverride, repoSummaryOverride })
     */
    async step(ctx) {
        const { cwd, aiDir, tasksDir, taskId, metaPath, cfg, branchName = null, planTextOverride = null, repoSummaryOverride = null } = ctx;

        const logs = [];
        try {
            const result = await runCodegenCore({
                cwd,
                aiDir,
                tasksDir,
                taskId,
                metaPath,
                cfg,
                branchName,
                planTextOverride,
                repoSummaryOverride
            });

            logs.push(chalk.green("\n已生成变更，进入 review 阶段："));
            logs.push("  - patch.json");
            logs.push("  - files/*.full");
            const taskDir = resolve(tasksDir, taskId);
            logs.push(chalk.gray(`  - codegen IR: ${resolve(taskDir, "codegen.ir.json")}`));
            if (result.diffSummary) {
                logs.push(chalk.cyan("\n本次变更摘要："));
                logs.push(`  变更文件：${result.diffSummary.filesCount} 个`);
                logs.push(`  +${result.diffSummary.added} / -${result.diffSummary.deleted} 行`);
            }
            logs.push(
                chalk.gray("提示：输入 /review 查看摘要；需要回滚可手动 git reset --hard 回到快照。")
            );

            return {
                logs,
                statePatch: {
                    phase: "codegen_done",
                    actors: {
                        codegen: { status: "completed" }
                    }
                },
                diffSummary: result.diffSummary || null
            };
        } catch (e) {
            const msg = e.message || String(e);
            logs.push(chalk.red("codegen 失败：") + " " + msg);
            return { logs, error: msg };
        }
    }
}

