import chalk from "chalk";
import fs from "fs-extra";
import { appendFileSync } from "fs";
import { resolve, dirname } from "path";
import { nowISO } from "../../core/task.mjs";
import { applyStatePatch } from "../../core/state.mjs";
import { PlanningAgent } from "../../agents/planningAgent.mjs";
import {
    appendJSONL,
    loadPlanningTranscript,
    nextRoundFromTranscript
} from "../../planning/transcript.mjs";

async function runClarificationMiniMeeting({ tasksDir, taskId, ask }) {
    const planningDir = resolve(tasksDir, taskId, "planning");
    const meetingPath = resolve(planningDir, "planning.meeting.json");
    const planningPath = resolve(planningDir, "planning.ai.json");
    let meeting;
    let planning;

    try {
        if (!fs.existsSync(meetingPath) || !fs.existsSync(planningPath)) return;
        meeting = JSON.parse(fs.readFileSync(meetingPath, "utf-8"));
        planning = JSON.parse(fs.readFileSync(planningPath, "utf-8"));
    } catch {
        return;
    }

    const round = Array.isArray(meeting.rounds) ? meeting.rounds[0] : null;
    if (!round) return;

    const decision =
        round.decision ||
        (meeting.meeting && typeof meeting.meeting.decision === "string"
            ? meeting.meeting.decision
            : "");

    const blockingQuestions = [];

    const perRole = round.per_role_verdicts || {};
    for (const [role, verdict] of Object.entries(perRole)) {
        if (verdict && Array.isArray(verdict.blocking_open_questions)) {
            verdict.blocking_open_questions.forEach((q) => {
                if (q && typeof q === "string") {
                    blockingQuestions.push({ role, text: q });
                }
            });
        }
    }

    if (!blockingQuestions.length && decision && decision !== "go") {
        const coachOpenQs =
            meeting.meeting && Array.isArray(meeting.meeting.open_questions)
                ? meeting.meeting.open_questions
                : meeting.ai_meeting && Array.isArray(meeting.ai_meeting.open_questions)
                ? meeting.ai_meeting.open_questions
                : [];
        const planningOpenQs = Array.isArray(planning.open_questions)
            ? planning.open_questions
            : [];
        coachOpenQs.concat(planningOpenQs).slice(0, 3).forEach((q) => {
            if (q && typeof q === "string") {
                blockingQuestions.push({ role: "Coach", text: q });
            }
        });
    }

    if (!blockingQuestions.length) return;

    console.log(
        chalk.cyan(
            "\n[澄清小会] 部分角色认为存在必须向你确认的关键信息，敏捷教练将代为转述："
        )
    );

    const transcriptPath = resolve(planningDir, "planning.transcript.jsonl");
    const entries = loadPlanningTranscript(transcriptPath);
    const clarifyRound = nextRoundFromTranscript(entries);

    let index = 0;
    for (const { role, text } of blockingQuestions) {
        index += 1;
        console.log("");
        console.log(chalk.cyan(`[${role}] 的关键问题：${text}`));
        // 用户可自由作答，不强制内容
        const answer = await ask(chalk.cyan("> "));
        if (!answer || !answer.trim()) continue;

        appendJSONL(transcriptPath, {
            ts: nowISO(),
            role: "assistant",
            kind: "clarify_question",
            from_role: role,
            round: clarifyRound,
            index,
            text
        });
        appendJSONL(transcriptPath, {
            ts: nowISO(),
            role: "user",
            kind: "clarify_answer",
            from_role: role,
            round: clarifyRound,
            index,
            text: answer
        });
    }

    console.log(
        chalk.gray(
            "\n[澄清小会] 已记录此次澄清内容。必要时你可以再次运行 /plan，让规划工作坊在新的信息基础上生成新一版规划。"
        )
    );
}

/**
 * /plan 命令处理：
 * - 获取 brief，写入 planning.transcript.jsonl；
 * - 调用 PlanningAgent 生成 planning.ai.json / plan.md 等产物；
 * - 打印日志并应用 statePatch。
 */
export async function handlePlanCommand({
    lineRaw,
    cwd,
    aiDir,
    tasksDir,
    taskId,
    metaPath,
    cfg,
    ask
}) {
    const taskDir = resolve(tasksDir, taskId);
    fs.ensureDirSync(taskDir);

    const rest = lineRaw.slice("/plan".length).trim();
    let brief = rest;
    // 支持从命令行读取附件文件：格式 `/plan <brief...> --files <p1> <p2> ...`
    let fileArgIndex = rest.indexOf("--files");
    let fileArgPaths = [];
    if (fileArgIndex !== -1) {
        const before = rest.slice(0, fileArgIndex).trim();
        const after = rest.slice(fileArgIndex + "--files".length).trim();
        brief = before;
        fileArgPaths = after.split(/\s+/).filter(Boolean);
    }
    if (!brief) {
        brief = await ask(
            chalk.cyan("请输入本轮任务的标题/目标和简要需求（将作为 planning 的 brief）> ")
        );
        if (!brief.trim()) {
            console.log(chalk.yellow("未提供有效 brief，已取消 /plan。"));
            return;
        }
    }

    const planningTranscript = resolve(tasksDir, taskId, "planning", "planning.transcript.jsonl");
    fs.ensureDirSync(dirname(planningTranscript));
    appendFileSync(
        planningTranscript,
        JSON.stringify({
            ts: nowISO(),
            role: "user",
            kind: "brief",
            text: brief
        }) + "\n",
        "utf-8"
    );

    // 附件文件读取（命令行 + uploads 目录）
    const supplementalDocs = [];
    const uploadsDir = resolve(tasksDir, taskId, "planning", "uploads");
    const maxSize = 100 * 1024; // 100KB 上限
    function tryReadFile(path) {
        try {
            const content = fs.readFileSync(path, "utf-8");
            const text = content.length > maxSize ? content.slice(0, maxSize) : content;
            supplementalDocs.push({ path, text });
        } catch {}
    }
    fileArgPaths.forEach((p) => tryReadFile(resolve(cwd, p)));
    if (fs.existsSync(uploadsDir)) {
        try {
            const files = fs.readdirSync(uploadsDir).map((n) => resolve(uploadsDir, n));
            files.forEach((p) => {
                if (p.endsWith(".md") || p.endsWith(".txt") || p.endsWith(".json") || p.endsWith(".yaml") || p.endsWith(".yml")) {
                    tryReadFile(p);
                }
            });
        } catch {}
    }

    const ctxBase = { cwd, aiDir, tasksDir, taskId, metaPath, cfg, supplementalDocs };
    try {
        const agent = new PlanningAgent();
        const result = await agent.step(ctxBase);
        (result.logs || []).forEach((ln) => console.log(ln));

        if (result.statePatch) {
            applyStatePatch(tasksDir, taskId, result.statePatch);
        }

        await runClarificationMiniMeeting({ tasksDir, taskId, ask });
    } catch (e) {
        console.log(chalk.red("AI 规划失败："), e.message || e);
    }
}
