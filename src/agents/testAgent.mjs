import chalk from "chalk";
import fs from "fs-extra";
import { readFileSync, writeFileSync } from "fs";
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
            let planningTestPlan = null;
            let planningDir = null;
            // 若存在 planning.ai.json.test_plan，先输出测试策略摘要
            try {
                const taskDir = resolve(tasksDir, taskId);
                planningDir = resolve(taskDir, "planning");
                const planningPath = resolve(planningDir, "planning.ai.json");
                if (fs.existsSync(planningPath)) {
                    const planning = JSON.parse(readFileSync(planningPath, "utf-8"));
                    const tp = planning.test_plan || null;
                    if (tp) {
                        planningTestPlan = tp;
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

            // 基于 test_plan.cases 与 eval 结果给出粗粒度覆盖提示（不 Gate）
            if (
                planningTestPlan &&
                Array.isArray(planningTestPlan.cases) &&
                planningTestPlan.cases.length &&
                Array.isArray(result.results) &&
                result.results.length
            ) {
                const okSteps = result.results
                    .filter((r) => r.status === "ok")
                    .map((r) => r.step || r.name)
                    .filter(Boolean);
                const coverage = [];
                const lowerSteps = okSteps.map((s) => String(s).toLowerCase());
                planningTestPlan.cases.forEach((c) => {
                    const desc =
                        typeof c === "string"
                            ? c
                            : c && typeof c === "object"
                                ? c.name || c.title || JSON.stringify(c)
                                : String(c);
                    const ld = desc.toLowerCase();
                    let coveredBy = null;
                    for (let i = 0; i < lowerSteps.length; i += 1) {
                        if (ld.includes(lowerSteps[i]) || lowerSteps[i].includes(ld)) {
                            coveredBy = okSteps[i];
                            break;
                        }
                    }
                    coverage.push({ desc, coveredBy });
                });
                const covered = coverage.filter((c) => c.coveredBy);
                const uncovered = coverage.filter((c) => !c.coveredBy);

                logs.push(
                    chalk.cyan("\n基于 test_plan 的简单覆盖提示（仅供参考，不作为 Gate）：")
                );
                logs.push(
                    chalk.gray(
                        `  - 规划用例数：${coverage.length}，其中大致可映射到评测步骤的约 ${covered.length} 个。`
                    )
                );
                if (uncovered.length) {
                    logs.push(chalk.yellow("  - 下列用例目前未能映射到任何评测步骤："));
                    uncovered.forEach((u) => logs.push(chalk.yellow(`      • ${u.desc}`)));
                }

                // 附加写入 eval-report.json 的摘要（best-effort）
                try {
                    if (result.reportPath && fs.existsSync(result.reportPath)) {
                        const raw = readFileSync(result.reportPath, "utf-8");
                        const report = JSON.parse(raw);
                        report.test_plan_summary = {
                            total_cases: coverage.length,
                            approx_covered: covered.length,
                            approx_uncovered: uncovered.map((u) => u.desc),
                            notes:
                                "coverage 为基于用例描述与评测步骤名称/命令的简单字符串匹配，仅用于提示。"
                        };
                        writeFileSync(result.reportPath, JSON.stringify(report, null, 2), "utf-8");
                    }
                } catch {
                    // 忽略 eval-report 更新失败
                }
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
