import fs from "fs-extra";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { execa } from "execa";
import ini from "ini";
import { nowISO } from "./task.mjs";

async function runShell(cmd, cwd) {
    return await execa(cmd, { cwd, shell: true, all: true });
}

function writeStepLog(tasksDir, taskId, stepName, content) {
    const p = resolve(tasksDir, taskId, `eval-${stepName}.log`);
    fs.ensureDirSync(dirname(p));
    fs.appendFileSync(p, content + "\n", "utf-8");
}

function loadEvalSteps(evalConfPath) {
    if (!existsSync(evalConfPath)) {
        return [
            { name: "lint", enabled: true, cmd: "npm run lint || ruff ." },
            { name: "test", enabled: true, cmd: "npm test || pytest -q" },
            { name: "promptfoo", enabled: true, cmd: "npx promptfoo eval -c .ai-tools-chain/promptfoo/promptfooconfig.yaml" },
            { name: "ragas", enabled: true, cmd: "python .ai-tools-chain/ragas/evaluate_summarizer.py" }
        ];
    }
    const raw = readFileSync(evalConfPath, "utf-8");
    const onlyComments = raw.trim() === "" || raw.split(/\r?\n/).every((l) => {
        const t = l.trim();
        return t === "" || t.startsWith("#") || t.startsWith(";");
    });
    if (onlyComments) return loadEvalSteps("");

    const conf = ini.parse(raw);
    const blocks = Object.entries(conf).map(([name, obj]) => ({
        name,
        enabled: String(obj.enabled ?? "true") !== "false",
        cmd: obj.cmd || obj.entry || ""
    })).filter((s) => s.enabled);
    return blocks.length ? blocks : loadEvalSteps("");
}

export async function runEvalCore({ cwd, aiDir, tasksDir, taskId }) {
    const evalConfPath = resolve(aiDir, "config", "eval.conf");
    const steps = loadEvalSteps(evalConfPath);
    if (!steps.length) {
        return {
            steps: [],
            reportPath: null,
            results: [],
            hasFailure: false
        };
    }

    const results = [];
    for (const step of steps) {
        if (!step.cmd) {
            results.push({ step: step.name, status: "skipped", reason: "no cmd" });
            continue;
        }

        writeStepLog(tasksDir, taskId, step.name, `== ${new Date().toISOString()} == START ${step.name}`);
        try {
            const { all } = await runShell(step.cmd, cwd);
            writeStepLog(tasksDir, taskId, step.name, all || "(no output)");
            results.push({ step: step.name, status: "ok" });
        } catch (e) {
            const out = (e.all || e.stdout || e.stderr || e.message || "").toString();
            writeStepLog(tasksDir, taskId, step.name, out);
            results.push({ step: step.name, status: "failed", code: e.exitCode ?? -1 });
            break;
        }
        writeStepLog(tasksDir, taskId, step.name, `== ${new Date().toISOString()} == END ${step.name}`);
    }

    const report = {
        taskId,
        finished_at: nowISO(),
        results
    };
    const reportPath = resolve(tasksDir, taskId, "eval-report.json");
    writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

    const hasFailure = results.some((r) => r.status === "failed");
    return {
        steps,
        reportPath,
        results,
        hasFailure
    };
}

