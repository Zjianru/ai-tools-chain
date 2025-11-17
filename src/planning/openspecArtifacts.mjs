import fs from "fs-extra";
import { writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execa } from "execa";
import chalk from "chalk";

function buildChangeMarkdown({ changeId, titleText, inputs, planningObj }) {
    const { why, what, req, targets, risks, accept } = inputs;

    const lines = [
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
            : "- (待补充)")
    ];

    const scope = planningObj.scope || "";
    const nonGoals = Array.isArray(planningObj.non_goals) ? planningObj.non_goals : [];
    const draftFiles = Array.isArray(planningObj.draft_files) ? planningObj.draft_files : [];
    const testPlan = planningObj.test_plan || null;
    const openQuestions = Array.isArray(planningObj.open_questions)
        ? planningObj.open_questions
        : [];

    if (scope) {
        lines.push("");
        lines.push("## Scope");
        lines.push(scope);
    }

    if (nonGoals.length) {
        lines.push("");
        lines.push("## Non-Goals");
        nonGoals.forEach((ng) => lines.push(`- ${ng}`));
    }

    if (draftFiles.length) {
        lines.push("");
        lines.push("## Draft Files");
        draftFiles.forEach((p) => lines.push(`- ${p}`));
    }

    if (testPlan && (testPlan.strategy || (Array.isArray(testPlan.cases) && testPlan.cases.length))) {
        lines.push("");
        lines.push("## Test Plan");
        if (testPlan.strategy) {
            lines.push(`- 策略: ${testPlan.strategy}`);
        }
        if (Array.isArray(testPlan.cases) && testPlan.cases.length) {
            lines.push("- 关键用例:");
            testPlan.cases.forEach((c) => lines.push(`  - ${c}`));
        }
        if (testPlan.automation) {
            lines.push(`- 自动化范围: ${testPlan.automation}`);
        }
    }

    if (openQuestions.length) {
        lines.push("");
        lines.push("## Open Questions");
        openQuestions.forEach((q) => lines.push(`- ${q}`));
    }

    lines.push("");
    return lines.join("\n");
}

function ensureProposal({ changeDir, changeId, taskId }) {
    const proposalPath = resolve(changeDir, "proposal.md");
    if (existsSync(proposalPath)) return;

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

function writeSpecFile({ specsDir, planningObj, req, titleText, taskId }) {
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
        return;
    }

    const reqList = (req || "").split(/[,，]/).map((s) => s.trim()).filter(Boolean);
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

function writeTasksFile({ changeDir, planningObj }) {
    const tasksPath = resolve(changeDir, "tasks.md");
    if (existsSync(tasksPath)) return;

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

async function runOpenspecValidateAndShow({ aiDir, tasksDir, taskId, changeId }) {
    const logsDir = resolve(tasksDir, taskId, "logs", "openspec");
    fs.ensureDirSync(logsDir);
    const openspecRoot = aiDir;

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

    return openspecPlanMd;
}

/**
 * 基于 inputs + planning 生成 OpenSpec 产物：
 * - change.md / proposal.md
 * - specs/task/spec.md
 * - tasks.md
 * 同时调用 openspec validate/show 并把结果写入 logs。
 *
 * 返回 openspec 展示用的 markdown（用于后续生成 plan.md）。
 */
export async function generateOpenSpecArtifacts({
    aiDir,
    tasksDir,
    taskId,
    inputs,
    planning
}) {
    const changeId = `task-${taskId}`;
    const changeDir = resolve(aiDir, "openspec", "changes", changeId);
    fs.ensureDirSync(changeDir);

    const planningObj = planning || {};
    const titleText = inputs.title || `Task ${taskId}`;

    const changeMd = buildChangeMarkdown({
        changeId,
        titleText,
        inputs,
        planningObj
    });
    writeFileSync(resolve(changeDir, "change.md"), changeMd, "utf-8");

    ensureProposal({ changeDir, changeId, taskId });

    const specsDir = resolve(changeDir, "specs", "task");
    fs.ensureDirSync(specsDir);
    writeSpecFile({ specsDir, planningObj, req: inputs.req, titleText, taskId });

    writeTasksFile({ changeDir, planningObj });

    const openspecPlanMd = await runOpenspecValidateAndShow({
        aiDir,
        tasksDir,
        taskId,
        changeId
    });

    return openspecPlanMd;
}
