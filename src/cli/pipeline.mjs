import chalk from "chalk";
import { resolve } from "path";
import { ensureProjectInited, readIni, autoArchiveOldTasks } from "../core/task.mjs";
import { runDemoOpenspecPipeline } from "./pipelines/demoOpenspec.mjs";
import { runAgentsPipeline } from "./pipelines/agents.mjs";

export async function runPipeline(name, cwd) {
    if (name !== "demo-openspec" && name !== "agents") {
        console.log(chalk.red("当前仅支持 demo-openspec / agents 两种管线"));
        process.exitCode = 1;
        return;
    }

    const aiDir = ensureProjectInited(cwd);
    const confPath = resolve(aiDir, "config", "toolchain.conf");
    const cfg = readIni(confPath, {});

    await autoArchiveOldTasks(aiDir);

    if (name === "demo-openspec") {
        await runDemoOpenspecPipeline({ cwd, aiDir, cfg });
        return;
    }

    await runAgentsPipeline({ cwd, aiDir, cfg });
}

