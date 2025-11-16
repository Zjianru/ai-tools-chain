import chalk from "chalk";
import fs from "fs-extra";
import { readFileSync } from "fs";
import { resolve } from "path";
import { runEvalCore } from "../core/eval.mjs";

export class TestAgent {
    constructor() {
        this.name = "test";
    }

    /**
     * step({ cwd, aiDir, tasksDir, taskId })
     */
    async step(ctx) {
        const { cwd, aiDir, tasksDir, taskId } = ctx;
        const logs = [];
        try {
            // 若存在 planning.ai.json.test_plan，先输出测试策略摘要
            try {
                const taskDir = resolve(tasksDir, taskId);
                const planningDir = resolve(taskDir, "planning");
                const planningNew = resolve(planningDir, "planning.ai.json");
                const planningLegacy = resolve(taskDir, "planning.ai.json");
                const planningPath = fs.existsSync(planningNew) ? planningNew : planningLegacy;
                if (planningPath && fs.existsSync(planningPath)) {
                    const planning = JSON.parse(readFileSync(planningPath, "utf-8"));
                    const tp = planning.test_plan || null;
                    if (tp) {
                        logs.push(chalk.cyan("\n规划中的测试计划（test_plan）："));
                        if (tp.strategy) logs.push("  - 策略: " + tp.strategy);
                        if (Array.isArray(tp.cases) && tp.cases.length) {
                            logs.push("  - 关键用例:");
                            tp.cases.forEach((c) => logs.push("    • " + c));
                        }
                        if (tp.automation) logs.push("  - 自动化范围: " + tp.automation);
                    }
                }
            } catch {
                // ignore planning parse errors
            }

            const result = await runEvalCore({ cwd, aiDir, tasksDir, taskId });
            if (!result.steps.length) {
                logs.push(chalk.gray("未发现评测步骤。"));
                return {
                    logs,
                    statePatch: {
                        phase: "test_run",
                        actors: {
                            test: { status: "skipped" }
                        }
                    }
                };
            }

            logs.push(chalk.cyan("\n评测计划："));
            result.steps.forEach((s) => {
                logs.push("  - " + s.name + (s.cmd ? `: ${s.cmd}` : ""));
            });

            const failed = result.results.find((r) => r.status === "failed");
            if (failed) {
                logs.push(chalk.yellow(`\n部分评测失败：${failed.step}`));
                logs.push(
                    chalk.gray(
                        `查看日志：.ai-tools-chain/tasks/${taskId}/eval-${failed.step}.log`
                    )
                );
            } else {
                logs.push(chalk.green("\n评测全部通过。"));
            }
            if (result.reportPath) {
                logs.push(chalk.gray(`报告：${result.reportPath}`));
            } else {
                logs.push(
                    chalk.gray(
                        `.ai-tools-chain/tasks/${taskId}/eval-report.json（默认路径，若存在）`
                    )
                );
            }

            return {
                logs,
                statePatch: {
                    phase: "test_run",
                    actors: {
                        test: { status: failed ? "failed" : "completed" }
                    }
                }
            };
        } catch (e) {
            const msg = e.message || String(e);
            logs.push(chalk.red("评测执行失败：") + " " + msg);
            return {
                logs,
                statePatch: {
                    phase: "test_run",
                    actors: {
                        test: { status: "error" }
                    }
                },
                error: msg
            };
        }
    }
}
