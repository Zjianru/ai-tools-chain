import chalk from "chalk";
import { applyStatePatch } from "../../core/state.mjs";
import { RevertAgent } from "../../agents/revertAgent.mjs";

export async function handleRevertCommand({ cwd, tasksDir, taskId, metaPath, ask }) {
    const ok = await ask(chalk.yellow("将回滚本次 codegen 改动。输入 YES 确认 > "));
    if (ok !== "YES") {
        console.log(chalk.yellow("已取消。"));
        return;
    }

    try {
        const agent = new RevertAgent();
        const result = await agent.step({ cwd, tasksDir, taskId, metaPath });
        (result.logs || []).forEach((ln) => console.log(ln));
        if (result.statePatch) {
            applyStatePatch(tasksDir, taskId, result.statePatch);
        }
    } catch (e) {
        console.log(chalk.red("revert 失败："), e.message || e);
    }
}

