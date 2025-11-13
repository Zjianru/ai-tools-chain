import { execa } from "execa";

export async function secondOpinionCopilot({ cwd, diffText }) {
    try {
        // 方式 A：直接把 diff 丢给 copilot，让它给出风险摘要
        const prompt = "请作为资深审查者审阅下面的 diff，指出风险点和需要二次确认的变更：\n" + diffText.slice(0, 60000);
        const { stdout } = await execa("gh", ["copilot", "chat", "-p", prompt], { cwd });
        return { verdict: "ok", notes: stdout };
    } catch (e) {
        return { verdict: "unknown", notes: "gh copilot 不可用或出错：" + (e.message || e) };
    }
}