import chalk from "chalk";
import fs from "fs-extra";
import { writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { nowISO, createNewTask } from "../../core/task.mjs";
import { loadTaskState, applyStatePatch } from "../../core/state.mjs";
import { suggestNextFromState } from "../../core/orchestrator.mjs";
import { PlanningAgent } from "../../agents/planningAgent.mjs";
import { PlanReviewAgent } from "../../agents/planReviewAgent.mjs";
import { CodegenAgent } from "../../agents/codegenAgent.mjs";
import { CodeReviewAgent } from "../../agents/codeReviewAgent.mjs";
import { ReviewMeetingAgent } from "../../agents/reviewMeetingAgent.mjs";
import { TestAgent } from "../../agents/testAgent.mjs";
import { AcceptAgent } from "../../agents/acceptAgent.mjs";

function writePipelineResult(pipelineResultPath, taskId, stages) {
    const result = {
        taskId,
        finishedAt: nowISO(),
        stages
    };
    try {
        fs.ensureDirSync(dirname(pipelineResultPath));
        writeFileSync(pipelineResultPath, JSON.stringify(result, null, 2), "utf-8");
    } catch {
        // ignore
    }
}

export async function runAgentsPipeline({ cwd, aiDir, cfg }) {
    const { taskId, tasksDir, metaPath } = createNewTask(aiDir, cfg);
    console.log(chalk.green(`[agents pipeline] Task ${taskId}`));
    loadTaskState(tasksDir, taskId);

    const pipelineResultPath = resolve(tasksDir, taskId, "pipeline-result.json");
    const stages = [];

    const recordStage = (name, status, errorMsg) => {
        stages.push({ name, status, error: errorMsg || null });
    };

    const runAgent = async (label, agent, ctx) => {
        console.log(chalk.cyan(`[agents] ${label}...`));
        try {
            const res = await agent.step(ctx);
            (res.logs || []).forEach((ln) => console.log(ln));
            if (res.statePatch) {
                applyStatePatch(tasksDir, taskId, res.statePatch);
            }
            recordStage(label, res.error ? "failed" : "ok", res.error || null);
            return !res.error;
        } catch (e) {
            const msg = e.message || String(e);
            console.error(chalk.red(`[agents] ${label} failed:`), msg);
            recordStage(label, "failed", msg);
            return false;
        }
    };

    const ctxBase = { cwd, aiDir, tasksDir, taskId, metaPath, cfg };
    const autoAccept = String(cfg?.pipeline?.auto_accept || "false") === "true";

    const planningTranscript = resolve(tasksDir, taskId, "planning", "planning.transcript.jsonl");
    const brief = "为当前项目生成一个简单的演示变更（agents pipeline demo）。";
    fs.ensureDirSync(dirname(planningTranscript));
    if (!existsSync(planningTranscript)) {
        writeFileSync(
            planningTranscript,
            JSON.stringify({ ts: nowISO(), role: "user", kind: "brief", text: brief }) + "\n",
            "utf-8"
        );
    }

    let currentPhase = "planning";
    const planningAgent = new PlanningAgent();
    const planReviewAgent = new PlanReviewAgent();
    const codegenAgent = new CodegenAgent();
    const codeReviewAgent = new CodeReviewAgent();
    const meetingAgent = new ReviewMeetingAgent();
    const testAgent = new TestAgent();
    const acceptAgent = new AcceptAgent();

    const phaseToAgent = {
        planning: planningAgent,
        plan_review: planReviewAgent,
        codegen: codegenAgent,
        code_review: codeReviewAgent,
        code_review_meeting: meetingAgent,
        test: testAgent,
        accept: acceptAgent
    };

    const okFirst = await runAgent(currentPhase, phaseToAgent[currentPhase], ctxBase);
    if (!okFirst) {
        console.log(chalk.red(`[agents] ${currentPhase} 阶段失败，停止后续阶段。`));
        writePipelineResult(pipelineResultPath, taskId, stages);
        return;
    }

    while (true) {
        const { phase: nextPhase, reason } = suggestNextFromState(tasksDir, taskId);
        if (!nextPhase) {
            console.log(chalk.green("[agents] orchestrator 没有更多阶段，流水线结束。"));
            break;
        }
        if (nextPhase === "accept" && !autoAccept) {
            console.log(
                chalk.gray(
                    "[agents] orchestrator 建议进入 accept 阶段，但当前未启用 auto_accept，流水线在 test 阶段结束。"
                )
            );
            break;
        }
        console.log(chalk.gray(`[agents] orchestrator 建议下一阶段: ${nextPhase} (${reason})`));
        const agent = phaseToAgent[nextPhase];
        if (!agent) {
            console.log(chalk.yellow(`[agents] 未找到阶段 ${nextPhase} 对应的 Agent，停止。`));
            break;
        }
        currentPhase = nextPhase;
        const ok = await runAgent(currentPhase, agent, ctxBase);
        if (!ok && currentPhase === "codegen") {
            console.log(chalk.red("[agents] codegen 阶段失败，停止后续阶段。"));
            break;
        }
        if (!ok) {
            console.log(
                chalk.yellow(
                    `[agents] 阶段 ${currentPhase} 失败，按当前策略继续尝试后续阶段（demo）。`
                )
            );
        }
        const suggestion = suggestNextFromState(tasksDir, taskId);
        if (!suggestion.phase) {
            console.log(chalk.green("[agents] orchestrator 没有更多阶段，流水线结束。"));
            break;
        }
    }

    writePipelineResult(pipelineResultPath, taskId, stages);
}

