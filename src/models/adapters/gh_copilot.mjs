import { execa } from "execa";

export const copilotAdapter = {
    async invoke(role, payload, { cwd }) {
        if (role !== "second_opinion") return { ok: false };
        try {
            const prompt = `请作为资深审查者，对下面的 diff 给出风险与二次确认建议：\n${(payload.diffText || "").slice(0, 60000)}`;
            const { stdout } = await execa("gh", ["copilot", "chat", "-p", prompt], { cwd });
            return { ok: true, verdict: "ok", notes: stdout || "" };
        } catch (e) {
            return { ok: false, error: "gh copilot 不可用" };
        }
    }
};