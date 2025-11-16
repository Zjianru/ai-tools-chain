import chalk from "chalk";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";
import { runAcceptCore } from "../core/accept.mjs";

export class AcceptAgent {
    constructor() {
        this.name = "accept";
    }

    async step(ctx) {
        const { cwd, aiDir, tasksDir, taskId, metaPath, cfg, commitMessage, overrideGate = false } = ctx;
        const logs = [];
        try {
            const gate = await runAcceptCore({
                cwd,
                aiDir,
                tasksDir,
                taskId,
                metaPath,
                cfg,
                // 第一轮只做 gate 判定，不一定真的提交
                commitMessage,
                overrideGate
            });

            const evalReportPath = resolve(tasksDir, taskId, "eval-report.json");
            if (existsSync(evalReportPath)) {
                logs.push(chalk.gray(`评测报告：${evalReportPath}`));
            }

            if (!commitMessage) {
                if (gate.ok && gate.reason === "gate_passed") {
                    logs.push(chalk.green("评测 Gate 已通过，可以安全提交。"));
                } else if (!gate.ok && gate.reason === "gate_failed") {
                    logs.push(chalk.red(`评测 Gate 未通过（失败步骤：${gate.failedStep || "未知"}）。`));
                } else if (!gate.ok && gate.reason === "needs_override") {
                    logs.push(
                        chalk.yellow(
                            `评测失败，允许通过强确认短语“${gate.overridePhrase}”继续提交（allowOverride = true）。`
                        )
                    );
                } else if (gate.ok && gate.reason === "committed") {
                    logs.push(chalk.green("已完成提交。"));
                }
            } else if (commitMessage && gate.ok && gate.reason === "committed") {
                logs.push(chalk.green("已完成提交。"));
            }

            const actorStatus = (() => {
                if (gate.ok && gate.reason === "gate_passed") return "gate_passed";
                if (gate.ok && gate.reason === "committed") return "committed";
                if (!gate.ok && gate.reason === "gate_failed") return "gate_failed";
                if (!gate.ok && gate.reason === "needs_override") return "needs_override";
                if (!gate.ok && gate.reason === "commit_failed") return "commit_failed";
                return "unknown";
            })();

            const statePatch = {
                phase: "accept",
                actors: {
                    accept: {
                        status: actorStatus,
                        reason: gate.reason,
                        failedStep: gate.failedStep || null
                    }
                },
                artifacts: {}
            };

            if (!gate.ok && gate.reason === "commit_failed" && gate.error) {
                logs.push(chalk.red(`提交失败：${gate.error}`));
            }

            return { logs, statePatch, gate };
        } catch (e) {
            logs.push(chalk.red("AcceptAgent 执行失败："), e.message || String(e));
            return { logs, statePatch: null, error: e.message || String(e) };
        }
    }
}

