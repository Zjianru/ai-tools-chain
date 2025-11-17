import chalk from "chalk";
import { applyStatePatch } from "../../core/state.mjs";
import { autoArchiveOldTasks } from "../../core/task.mjs";
import { TestAgent } from "../../agents/testAgent.mjs";

export async function handleEvalCommand({ cwd, aiDir, tasksDir, taskId, ask }) {
    const ok = await ask(
        chalk.yellow("将按 eval.conf 执行评测。输入 “开始评测” 继续，或回车取消 > ")
    );
    if (ok !== "开始评测") {
        console.log(chalk.yellow("已取消评测。"));
        return;
    }

    try {
        const agent = new TestAgent();
        const result = await agent.step({ cwd, aiDir, tasksDir, taskId });
        (result.logs || []).forEach((ln) => console.log(ln));
        await autoArchiveOldTasks(aiDir);
        if (result.statePatch) {
            applyStatePatch(tasksDir, taskId, result.statePatch);
        }
    } catch (e) {
        console.log(chalk.red("评测执行失败："), e.message || e);
    }
}

