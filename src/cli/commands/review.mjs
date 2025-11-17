import chalk from "chalk";
import { applyStatePatch } from "../../core/state.mjs";
import { CodeReviewAgent } from "../../agents/codeReviewAgent.mjs";
import { ReviewMeetingAgent } from "../../agents/reviewMeetingAgent.mjs";

export async function handleReviewCommand({ cwd, aiDir, tasksDir, taskId, cfg }) {
    try {
        const agent = new CodeReviewAgent();
        const result = await agent.step({ cwd, aiDir, tasksDir, taskId, cfg });
        (result.logs || []).forEach((ln) => console.log(ln));
        if (result.statePatch) {
            applyStatePatch(tasksDir, taskId, result.statePatch);
        }

        try {
            const meetingAgent = new ReviewMeetingAgent();
            const meeting = await meetingAgent.step({
                cwd,
                aiDir,
                tasksDir,
                taskId
            });
            (meeting.logs || []).forEach((ln) => console.log(ln));
            if (meeting.statePatch) {
                applyStatePatch(tasksDir, taskId, meeting.statePatch);
            }
        } catch (e) {
            console.log(
                chalk.yellow("review 已完成，但会议纪要生成失败："),
                e.message || e
            );
        }
    } catch (e) {
        console.log(chalk.red("review 失败："), e.message || e);
    }
}

