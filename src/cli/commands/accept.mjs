import chalk from "chalk";
import { applyStatePatch } from "../../core/state.mjs";
import { AcceptAgent } from "../../agents/acceptAgent.mjs";

export async function handleAcceptCommand({ cwd, aiDir, tasksDir, taskId, metaPath, cfg, ask }) {
    try {
        const acceptAgent = new AcceptAgent();
        const gateResult = await acceptAgent.step({
            cwd,
            aiDir,
            tasksDir,
            taskId,
            metaPath,
            cfg
        });
        (gateResult.logs || []).forEach((ln) => console.log(ln));
        if (gateResult.statePatch) {
            applyStatePatch(tasksDir, taskId, gateResult.statePatch);
        }

        const gate = gateResult.gate;
        if (!gate) {
            console.log(chalk.red("未获取到 gate 结果，无法继续提交。"));
            return;
        }

        if (!gate.ok && gate.reason === "gate_failed") {
            console.log(chalk.red("评测 gate 未通过，已阻断提交。可修复后重试。"));
            return;
        }

        let overrideGate = false;
        if (!gate.ok && gate.reason === "needs_override" && gate.allowOverride) {
            const phrase =
                gate.overridePhrase || (cfg?.confirm?.override_phrase || "确认合入").trim();
            const ans = await ask(
                chalk.yellow(`评测失败。输入强确认短语“${phrase}”以继续提交，或回车取消 > `)
            );
            if (ans !== phrase) {
                console.log(chalk.yellow("已取消提交。"));
                return;
            }
            overrideGate = true;
        }

        const sum = await ask(chalk.cyan("请输入本次提交摘要（留空则使用默认）> "));
        const msg = `feat(atc): codegen for task ${taskId}` + (sum ? ` – ${sum}` : "");
        const commitAgent = new AcceptAgent();
        const commitResult = await commitAgent.step({
            cwd,
            aiDir,
            tasksDir,
            taskId,
            metaPath,
            cfg,
            commitMessage: msg,
            overrideGate
        });
        (commitResult.logs || []).forEach((ln) => console.log(ln));
        if (commitResult.statePatch) {
            applyStatePatch(tasksDir, taskId, commitResult.statePatch);
        }
    } catch (e) {
        console.log(chalk.red("accept 失败："), e.message || e);
    }
}

