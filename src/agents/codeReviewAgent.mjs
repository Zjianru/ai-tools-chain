import chalk from "chalk";
import { runReviewCore } from "../core/review.mjs";

export class CodeReviewAgent {
    constructor() {
        this.name = "code_review";
    }

    /**
     * step({ cwd, aiDir, tasksDir, taskId, cfg })
     */
    async step(ctx) {
        const { cwd, aiDir, tasksDir, taskId, cfg } = ctx;
        const logs = [];
        try {
            const result = await runReviewCore({ cwd, aiDir, tasksDir, taskId, cfg });

            logs.push(chalk.cyan("\n本次变更摘要："));
            logs.push(`  变更文件：${result.summary.filesCount} 个`);
            logs.push(`  +${result.summary.added} / -${result.summary.deleted} 行`);
            if (result.files.length) {
                const marks = result.files.map((f) => (f.danger ? `! ${f.path}` : `  ${f.path}`));
                logs.push(chalk.gray("  文件：\n    " + marks.join("\n    ")));
            } else {
                logs.push(chalk.gray("  （当前没有可展示的 diff）"));
            }

            logs.push(chalk.cyan("\n第二意见摘要（Copilot/兜底）："));
            logs.push(chalk.gray(result.secondOpinionPreview || ""));
            logs.push(chalk.cyan("\n代码审查（review 角色）摘要："));
            logs.push(chalk.gray(result.reviewSummary || "(无)"));
            logs.push(chalk.gray(`\nsecond opinion: ${result.secondOpinionPath}`));
            logs.push(chalk.gray(`review JSON  : ${result.reviewPath}`));

            // 简单“会后纪要”：基于 diff 摘要与危险文件列表给出一个合成结论
            const dangerCount = result.files.filter((f) => f.danger).length;
            logs.push(chalk.cyan("\n会议纪要："));
            if (!result.summary.filesCount) {
                logs.push("  - 本次变更为空，无需进一步处理。");
            } else {
                logs.push(
                    `  - 本次共变更 ${result.summary.filesCount} 个文件，+${result.summary.added} / -${result.summary.deleted} 行。`
                );
                if (dangerCount) {
                    logs.push(`  - 其中 ${dangerCount} 个文件位于危险路径，建议优先人工复查。`);
                } else {
                    logs.push("  - 未检测到位于危险路径的文件。");
                }
                if (result.reviewSummary) {
                    logs.push("  - review 角色给出的总体评价已见上文摘要。");
                }
                if (result.secondOpinionPreview) {
                    logs.push("  - second_opinion 提供了补充视角，可结合一并考虑。");
                }
            }

            logs.push(
                chalk.gray(
                    "\n下一步可：/eval （手动确认后执行评测） | /accept 提交 | /quit 退出"
                )
            );

            return {
                logs,
                statePatch: {
                    phase: "code_review",
                    actors: {
                        review: { status: "completed" }
                    }
                }
            };
        } catch (e) {
            const msg = e.message || String(e);
            logs.push(chalk.red("review 失败：") + " " + msg);
            return { logs, error: msg };
        }
    }
}
