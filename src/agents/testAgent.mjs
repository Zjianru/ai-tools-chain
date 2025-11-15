import chalk from "chalk";
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

