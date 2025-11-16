import fs from "fs-extra";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { execa } from "execa";
import chalk from "chalk";
import { invokeRole } from "../models/broker.mjs";

export async function runPlanningWithInputs({ cwd, aiDir, tasksDir, taskId, metaPath, inputs, planning }) {
    const logsDir = resolve(tasksDir, taskId, "logs", "openspec");
    fs.ensureDirSync(logsDir);

    const { title, why, what, req, targets, risks, accept } = inputs;
    const changeId = `task-${taskId}`;
    const openspecRoot = aiDir;
    const changeDir = resolve(openspecRoot, "openspec", "changes", changeId);
    fs.ensureDirSync(changeDir);

    const titleText = title || `Task ${taskId}`;
    const changeLines = [
        "---",
        `id: ${changeId}`,
        `title: ${titleText}`,
        "owner: @you",
        "risk: medium",
        "---",
        "",
        "## Why",
        (why || "(待补充)"),
        "",
        "## What Changes",
        (what || "(待补充)"),
        "",
        "## Requirements",
        (req
            ? req
                  .split(/[,，]/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((s) => `- ${s}`)
                  .join("\n") || "- (待补充)"
            : "- (待补充)"),
        "",
        "## Targets",
        (targets
            ? targets
                  .split(/[,，]/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((s) => `- ${s}`)
                  .join("\n") || "- (待补充)"
            : "- (待补充)"),
        "",
        "## Risks and Mitigations",
        (risks || "(待补充)"),
        "",
        "## Acceptance",
        (accept
            ? accept
                  .split(/[,，]/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((s) => `- ${s}`)
                  .join("\n") || "- (待补充)"
            : "- (待补充)"),
        ""
    ];

    // 结合 planning.ai.json 补充 Scope / Non-goals / Draft Files / Test Plan / Open Questions
    const planningObj = planning || {};
    const scope = planningObj.scope || "";
    const nonGoals = Array.isArray(planningObj.non_goals) ? planningObj.non_goals : [];
    const draftFiles = Array.isArray(planningObj.draft_files) ? planningObj.draft_files : [];
    const testPlan = planningObj.test_plan || null;
    const openQuestions = Array.isArray(planningObj.open_questions)
        ? planningObj.open_questions
        : [];

    if (scope) {
        changeLines.push("## Scope");
        changeLines.push(scope);
        changeLines.push("");
    }

    if (nonGoals.length) {
        changeLines.push("## Non-Goals");
        nonGoals.forEach((ng) => {
            changeLines.push(`- ${ng}`);
        });
        changeLines.push("");
    }

    if (draftFiles.length) {
        changeLines.push("## Draft Files");
        draftFiles.forEach((p) => {
            changeLines.push(`- ${p}`);
        });
        changeLines.push("");
    }

    if (testPlan && (testPlan.strategy || (Array.isArray(testPlan.cases) && testPlan.cases.length))) {
        changeLines.push("## Test Plan");
        if (testPlan.strategy) {
            changeLines.push(`- 策略: ${testPlan.strategy}`);
        }
        if (Array.isArray(testPlan.cases) && testPlan.cases.length) {
            changeLines.push("- 关键用例:");
            testPlan.cases.forEach((c) => changeLines.push(`  - ${c}`));
        }
        if (testPlan.automation) {
            changeLines.push(`- 自动化范围: ${testPlan.automation}`);
        }
        changeLines.push("");
    }

    if (openQuestions.length) {
        changeLines.push("## Open Questions");
        openQuestions.forEach((q) => {
            changeLines.push(`- ${q}`);
        });
        changeLines.push("");
    }

    const changeMd = changeLines.join("\n");
    writeFileSync(resolve(changeDir, "change.md"), changeMd, "utf-8");

    const proposalPath = resolve(changeDir, "proposal.md");
    if (!existsSync(proposalPath)) {
        const proposal = [
            `# Proposal for ${changeId}`,
            "",
            "> Note:",
            "> This project does not use this OpenSpec `proposal.md` as the primary human-readable plan.",
            "> The authoritative plan for this task is:",
            `>   .ai-tools-chain/tasks/${taskId}/planning/plan.md`,
            "",
            "For structured planning details, see:",
            "- `planning.ai.json` under the task directory;",
            "- `change.md / specs/task/spec.md / tasks.md` in this OpenSpec change folder.",
            ""
        ].join("\n");
        writeFileSync(proposalPath, proposal, "utf-8");
    }

    const specsDir = resolve(changeDir, "specs", "task");
    fs.ensureDirSync(specsDir);
    const reqObjs = Array.isArray(planningObj.requirements) ? planningObj.requirements : [];

    if (reqObjs.length) {
        const specLines = ["## ADDED Requirements", ""];
        for (const r of reqObjs) {
            const rid = r.id || "";
            const titleReq = r.title || r.shall || titleText || `Task ${taskId}`;
            const shall = r.shall || `The system SHALL satisfy requirement ${rid || titleReq}.`;
            specLines.push(`### Requirement: ${titleReq}${rid ? ` (ID: ${rid})` : ""}`);
            specLines.push("");
            specLines.push(`The system SHALL: ${shall}`);
            specLines.push("");
            const scenarios = Array.isArray(r.scenarios) ? r.scenarios : [];
            if (scenarios.length) {
                for (const sc of scenarios) {
                    const sName = sc.name || "Scenario";
                    const steps = Array.isArray(sc.steps) ? sc.steps : [];
                    specLines.push(`#### Scenario: ${sName}`);
                    if (steps.length) {
                        for (const st of steps) {
                            specLines.push(`- ${st}`);
                        }
                    } else {
                        specLines.push("- (steps TBD)");
                    }
                    specLines.push("");
                }
            } else {
                specLines.push("#### Scenario: basic usage");
                specLines.push("- (scenario details TBD)");
                specLines.push("");
            }
        }
        const specMd = specLines.join("\n");
        writeFileSync(resolve(specsDir, "spec.md"), specMd, "utf-8");
    } else {
        const reqList = (req || "").split(/[,，]/).map(s => s.trim()).filter(Boolean);
        const primaryReq = reqList[0] || titleText || `Task ${taskId}`;
        const specMd = [
            "## ADDED Requirements",
            "",
            `### Requirement: ${primaryReq}`,
            "",
            `The system SHALL: ${primaryReq || "satisfy this autogenerated requirement."}`,
            "",
            "#### Scenario: basic usage",
            "- This scenario was generated by AI Tools Chain.",
            "- See change.md for full context and details.",
            ""
        ].join("\n");
        writeFileSync(resolve(specsDir, "spec.md"), specMd, "utf-8");
    }

    const tasksPath = resolve(changeDir, "tasks.md");
    if (!existsSync(tasksPath)) {
        const tasksList = Array.isArray(planningObj.tasks) && planningObj.tasks.length
            ? planningObj.tasks
            : [
                "Implement the changes described in change.md.",
                "Add or update tests to cover requirements and scenarios.",
                "Run the evaluation pipeline and ensure it passes."
            ];
        const lines = ["# Tasks", ""];
        tasksList.forEach((t, idx) => {
            lines.push(`${idx + 1}. ${t}`);
        });
        lines.push("");
        const tasksMd = lines.join("\n");
        writeFileSync(tasksPath, tasksMd, "utf-8");
    }

    let openspecPlanMd = "";

    try {
        const { stdout: vout, stderr: verr } = await execa(
            "openspec",
            ["validate", "--changes", "--json", "--no-interactive"],
            { cwd: openspecRoot }
        );
        writeFileSync(resolve(logsDir, "validate.json"), vout || "{}", "utf-8");
        if (verr) writeFileSync(resolve(logsDir, "validate.log"), verr, "utf-8");
    } catch (e) {
        const msg = e?.stdout || e?.stderr || e?.message || String(e);
        writeFileSync(resolve(logsDir, "validate.error.log"), String(msg), "utf-8");
        console.log(chalk.red("openspec validate 失败："), chalk.gray(String(msg).slice(0, 400)));
    }

    try {
        const { stdout } = await execa("openspec", ["show", "--type", "change", changeId], {
            cwd: openspecRoot
        });
        openspecPlanMd = stdout || "";
        writeFileSync(resolve(logsDir, "show.md.log"), openspecPlanMd, "utf-8");
    } catch (e) {
        const msg = e?.stdout || e?.stderr || e?.message || String(e);
        writeFileSync(resolve(logsDir, "show-md.error.log"), String(msg), "utf-8");
        console.log(
            chalk.red("openspec show (markdown) 失败："),
            chalk.gray(String(msg).slice(0, 400))
        );
        openspecPlanMd = "";
    }

    // 生成更贴近 planning.ai.json 的人类可读 plan.md
    try {
        const taskDir = resolve(tasksDir, taskId);
        const planningDir = resolve(taskDir, "planning");
        fs.ensureDirSync(planningDir);
        const planFile = resolve(planningDir, "plan.md");

        const lines = [];
        lines.push(`# Plan for ${titleText}`);
        lines.push("");

        // Overview
        lines.push("## Overview");
        lines.push(what || "(待补充)");
        lines.push("");

        // Why
        lines.push("## Why");
        lines.push(why || "(待补充)");
        lines.push("");

        // Requirements
        if (Array.isArray(planningObj.requirements) && planningObj.requirements.length) {
            lines.push("## Requirements");
            planningObj.requirements.forEach((r) => {
                if (!r) return;
                const rid = r.id ? `${r.id}: ` : "";
                const titleReq = r.title || r.shall || "";
                const shall = r.shall || "";
                if (titleReq) {
                    lines.push(`- ${rid}${titleReq}`);
                }
                if (shall && shall !== titleReq) {
                    lines.push(`  - SHALL: ${shall}`);
                }
                const scenarios = Array.isArray(r.scenarios) ? r.scenarios : [];
                scenarios.forEach((sc) => {
                    const name = sc.name || "Scenario";
                    const steps = Array.isArray(sc.steps) ? sc.steps : [];
                    lines.push(`  - Scenario: ${name}`);
                    if (steps.length) {
                        steps.forEach((st) => lines.push(`    - ${st}`));
                    }
                });
            });
            lines.push("");
        }

        // Draft files
        if (draftFiles.length) {
            lines.push("## Draft Files");
            draftFiles.forEach((p) => lines.push(`- ${p}`));
            lines.push("");
        }

        // Targets （来自 inputs.targets）
        const targetList = (targets || "")
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean);
        if (targetList.length) {
            lines.push("## Targets");
            targetList.forEach((t) => lines.push(`- ${t}`));
            lines.push("");
        }

        // Scope / Non-goals
        if (scope) {
            lines.push("## Scope");
            lines.push(scope);
            lines.push("");
        }
        if (nonGoals.length) {
            lines.push("## Non-Goals");
            nonGoals.forEach((ng) => lines.push(`- ${ng}`));
            lines.push("");
        }

        // Risks
        const risksList = Array.isArray(planningObj.risks)
            ? planningObj.risks
            : risks
            ? [risks]
            : [];
        if (risksList.length) {
            lines.push("## Risks");
            risksList.forEach((r) => lines.push(`- ${r}`));
            lines.push("");
        }

        // Acceptance
        const acceptanceList = Array.isArray(planningObj.acceptance)
            ? planningObj.acceptance
            : accept
            ? accept.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
            : [];
        if (acceptanceList.length) {
            lines.push("## Acceptance Criteria");
            acceptanceList.forEach((a) => lines.push(`- ${a}`));
            lines.push("");
        }

        // Test plan
        if (testPlan && (testPlan.strategy || (Array.isArray(testPlan.cases) && testPlan.cases.length))) {
            lines.push("## Test Plan");
            if (testPlan.strategy) lines.push(`- 策略: ${testPlan.strategy}`);
            if (Array.isArray(testPlan.cases) && testPlan.cases.length) {
                lines.push("- 关键用例:");
                testPlan.cases.forEach((c) => lines.push(`  - ${c}`));
            }
            if (testPlan.automation) lines.push(`- 自动化范围: ${testPlan.automation}`);
            lines.push("");
        }

        // Open questions
        if (openQuestions.length) {
            lines.push("## Open Questions");
            openQuestions.forEach((q) => lines.push(`- ${q}`));
            lines.push("");
        }

        // 可选：附上原始 OpenSpec change 视图作为附录
        if (openspecPlanMd) {
            lines.push("---");
            lines.push("## OpenSpec Change (raw)");
            lines.push("");
            lines.push(openspecPlanMd.trim());
            lines.push("");
        }

        writeFileSync(planFile, lines.join("\n"), "utf-8");
    } catch {
        // best-effort 生成 plan.md，不阻断主流程
    }

    const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
    meta.status = "plan";
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

export function ensurePlanningDraft({ tasksDir, taskId }) {
    const taskDir = resolve(tasksDir, taskId);
    const planningDir = resolve(taskDir, "planning");
    fs.ensureDirSync(planningDir);
    const draftPath = resolve(planningDir, "planning.draft.json");
    if (!existsSync(draftPath)) {
        // 当前版本仅在规划 ready 后写入草案快照；不存在时返回 null 即可
        return null;
    }
    try {
        const raw = readFileSync(draftPath, "utf-8");
        return JSON.parse(raw);
    } catch {
        // 解析失败时视作尚无有效草案，由调用方决定是否覆盖写入
        return null;
    }
}

export function writePlanningDraft({ tasksDir, taskId, planning }) {
    const taskDir = resolve(tasksDir, taskId);
    const planningDir = resolve(taskDir, "planning");
    fs.ensureDirSync(planningDir);
    const draftPath = resolve(planningDir, "planning.draft.json");
    writeFileSync(draftPath, JSON.stringify(planning, null, 2), "utf-8");
}

export async function callPlanningOnce({
    cwd,
    aiDir,
    tasksDir,
    taskId,
    userBrief,
    history = [],
    round = 1,
    draft = null
}) {
    const taskDir = resolve(tasksDir, taskId);
    fs.ensureDirSync(taskDir);

    let repoSummary = "";
    try {
        const { stdout } = await execa("git", ["ls-files"], { cwd });
        const files = stdout.split(/\r?\n/).filter(Boolean);
        repoSummary = files.slice(0, 100).join("\n");
    } catch {
        repoSummary = "";
    }

    const planningRes = await invokeRole(
        "planning",
        { userBrief, repoSummary, history, draft },
        { aiDir, cwd }
    );
    if (!planningRes?.ok) {
        throw new Error(planningRes?.error || "planning 调用失败");
    }

    // 记录 AI 调用日志和 token 使用情况（每轮一个文件）
    try {
        const logsDir = resolve(tasksDir, taskId, "logs", "models");
        fs.ensureDirSync(logsDir);
        const log = {
            role: "planning",
            provider: "deepseek",
            model: planningRes.raw?.model || "",
            round,
            created_at: new Date().toISOString(),
            user_brief: userBrief,
            repo_summary_sample: repoSummary.slice(0, 400),
            history,
            usage: planningRes.usage || null
        };
        writeFileSync(resolve(logsDir, `planning.deepseek.${round}.json`), JSON.stringify(log, null, 2), "utf-8");
    } catch {
        // logging best-effort
    }

    return planningRes;
}

export async function applyPlanningAndOpenSpec({ cwd, aiDir, tasksDir, taskId, metaPath, planning }) {
    const taskDir = resolve(tasksDir, taskId);
    fs.ensureDirSync(taskDir);
    const planningDir = resolve(taskDir, "planning");
    fs.ensureDirSync(planningDir);

    const planningPath = resolve(planningDir, "planning.ai.json");
    writeFileSync(planningPath, JSON.stringify(planning, null, 2), "utf-8");
    const title = planning.meta?.title || planning.title || `Task ${taskId}`;
    const why = planning.why || "";
    const what = planning.what || "";
    const requirements = Array.isArray(planning.requirements) ? planning.requirements : [];
    const targets = Array.isArray(planning.targets) ? planning.targets : [];
    const acceptance = Array.isArray(planning.acceptance) ? planning.acceptance : [];
    const risks = planning.risks || "";

    const reqTexts = requirements
        .map((r) => {
            if (!r) return "";
            if (typeof r === "string") return r;
            return r.title || r.shall || "";
        })
        .filter((s) => s && s.trim());

    const inputs = {
        title,
        why,
        what,
        req: reqTexts.join(","),
        targets: targets.join(","),
        risks,
        accept: acceptance.join(",")
    };

    if (Array.isArray(planning.draft_files) && planning.draft_files.length) {
        const filesJsonPath = resolve(planningDir, "plan.files.json");
        writeFileSync(
            filesJsonPath,
            JSON.stringify({ files: planning.draft_files }, null, 2),
            "utf-8"
        );
    }

    await runPlanningWithInputs({ cwd, aiDir, tasksDir, taskId, metaPath, inputs, planning });
}

// 保留单次 AI 规划 + OpenSpec 的封装，供非交互式场景复用
export async function runAIPlanningAndOpenSpec({ cwd, aiDir, tasksDir, taskId, metaPath, userBrief }) {
    const res = await callPlanningOnce({ cwd, aiDir, tasksDir, taskId, userBrief, history: [], round: 1 });
    if (!res.planning) {
        throw new Error(res.error || "planning 未返回规划结果");
    }
    await applyPlanningAndOpenSpec({ cwd, aiDir, tasksDir, taskId, metaPath, planning: res.planning });
}
