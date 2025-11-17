import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadPlanningAndReview, buildPlanningMeetingArtifacts } from "../src/planning/planningMeetingCore.mjs";
import { suggestNextFromState } from "../src/core/orchestrator.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function createFakeTaskDir(baseDir, taskId) {
    const tasksDir = resolve(baseDir, ".ai-tools-chain", "tasks");
    const taskDir = resolve(tasksDir, taskId);
    const planningDir = resolve(taskDir, "planning");
    fs.ensureDirSync(planningDir);
    return { tasksDir, taskDir, planningDir };
}

test("planningMeetingCore writes rounds with current round and decision=go when plan_review ok", async () => {
    const baseDir = resolve(__dirname, "..", ".tmp-tests", "planning-meeting-go");
    fs.removeSync(baseDir);

    const taskId = "test-task-go";
    const { tasksDir, taskDir, planningDir } = createFakeTaskDir(baseDir, taskId);

    // state.json with planning.round = 2 and phase "planning_done"
    const statePath = resolve(taskDir, "state.json");
    const state = {
        task_id: taskId,
        phase: "planning_done",
        actors: {
            planning: { status: "completed", round: 2 }
        },
        artifacts: {}
    };
    fs.ensureDirSync(dirname(statePath));
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");

    // minimal planning.ai.json
    const planning = {
        meta: { title: "Test Planning Meeting" },
        why: "why",
        what: "what",
        requirements: [{ id: "R1", title: "req" }],
        draft_files: ["src/demo.sh"],
        acceptance: ["acc"]
    };
    fs.writeFileSync(
        resolve(planningDir, "planning.ai.json"),
        JSON.stringify(planning, null, 2),
        "utf-8"
    );

    // plan-review.json with ok: true and no blocking errors
    const planReview = {
        taskId,
        ok: true,
        issues: []
    };
    fs.writeFileSync(
        resolve(planningDir, "plan-review.json"),
        JSON.stringify(planReview, null, 2),
        "utf-8"
    );

    // empty plan.md
    fs.writeFileSync(resolve(planningDir, "plan.md"), "# Plan\n", "utf-8");

    const {
        planningDir: loadedPlanningDir,
        planning: loadedPlanning,
        planReview: loadedPlanReview,
        currentRound
    } = loadPlanningAndReview({ tasksDir, taskId });

    assert.equal(loadedPlanningDir, planningDir);
    assert.equal(currentRound, 2);
    assert.equal(loadedPlanReview.ok, true);

    const { meetingJson } = buildPlanningMeetingArtifacts({
        taskId,
        planning: loadedPlanning,
        planReview: loadedPlanReview,
        planMd: "# Plan\n",
        aiMeeting: null,
        currentRound
    });

    assert.ok(Array.isArray(meetingJson.rounds));
    assert.equal(meetingJson.rounds[0].round, 2);
    assert.equal(meetingJson.rounds[0].decision, "go");
    assert.equal(meetingJson.ok, true);
});

test("planningMeetingCore rounds decision=redo_planning when there is blocking error", async () => {
    const baseDir = resolve(__dirname, "..", ".tmp-tests", "planning-meeting-redo");
    fs.removeSync(baseDir);

    const taskId = "test-task-redo";
    const { tasksDir, taskDir, planningDir } = createFakeTaskDir(baseDir, taskId);

    const statePath = resolve(taskDir, "state.json");
    const state = {
        task_id: taskId,
        phase: "planning_done",
        actors: {
            planning: { status: "completed", round: 1 }
        },
        artifacts: {}
    };
    fs.ensureDirSync(dirname(statePath));
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");

    const planning = {
        meta: { title: "Test Planning Meeting" },
        why: "why",
        what: "what",
        requirements: [],
        draft_files: [],
        acceptance: []
    };
    fs.writeFileSync(
        resolve(planningDir, "planning.ai.json"),
        JSON.stringify(planning, null, 2),
        "utf-8"
    );

    const planReview = {
        taskId,
        ok: false,
        issues: [
            { id: "OPEN_SPEC_ERR_1", severity: "error", type: "openspec", message: "broken" }
        ]
    };
    fs.writeFileSync(
        resolve(planningDir, "plan-review.json"),
        JSON.stringify(planReview, null, 2),
        "utf-8"
    );
    fs.writeFileSync(resolve(planningDir, "plan.md"), "# Plan\n", "utf-8");

    const { planning: loadedPlanning, planReview: loadedPlanReview, currentRound } =
        loadPlanningAndReview({ tasksDir, taskId });

    const { meetingJson } = buildPlanningMeetingArtifacts({
        taskId,
        planning: loadedPlanning,
        planReview: loadedPlanReview,
        planMd: "# Plan\n",
        aiMeeting: null,
        currentRound
    });

    assert.equal(meetingJson.rounds[0].round, 1);
    assert.equal(meetingJson.rounds[0].decision, "redo_planning");
    assert.equal(meetingJson.ok, false);
});

test("orchestrator suggestNextFromState normalizes planning_done and test_run phases", async () => {
    const baseDir = resolve(__dirname, "..", ".tmp-tests", "orchestrator");
    fs.removeSync(baseDir);

    const tasksDir = resolve(baseDir, ".ai-tools-chain", "tasks");
    const taskId = "test-orch";
    const taskDir = resolve(tasksDir, taskId);
    fs.ensureDirSync(taskDir);

    // case 1: planning_done -> should suggest plan_review (linear)
    const state1 = {
        task_id: taskId,
        phase: "planning_done",
        actors: {
            planning: { status: "completed", round: 1 }
        },
        artifacts: {}
    };
    fs.writeFileSync(resolve(taskDir, "state.json"), JSON.stringify(state1, null, 2), "utf-8");

    const s1 = suggestNextFromState(tasksDir, taskId);
    assert.equal(s1.phase, "plan_review");

    // case 2: test_run with eval-report failed -> accept (gate)
    const state2 = {
        task_id: taskId,
        phase: "test_run",
        actors: {
            test: { status: "completed" }
        },
        artifacts: {}
    };
    fs.writeFileSync(resolve(taskDir, "state.json"), JSON.stringify(state2, null, 2), "utf-8");

    const reportFailed = {
        results: [{ step: "unit", status: "failed" }]
    };
    fs.writeFileSync(
        resolve(taskDir, "eval-report.json"),
        JSON.stringify(reportFailed, null, 2),
        "utf-8"
    );

    const s2 = suggestNextFromState(tasksDir, taskId);
    assert.equal(s2.phase, "accept");
    assert.equal(s2.reason.startsWith("eval_failed_needs_gate"), true);

    // case 3: test_run with eval-report all passed -> accept (ready)
    const reportOk = {
        results: [{ step: "unit", status: "passed" }]
    };
    fs.writeFileSync(
        resolve(taskDir, "eval-report.json"),
        JSON.stringify(reportOk, null, 2),
        "utf-8"
    );

    const s3 = suggestNextFromState(tasksDir, taskId);
    assert.equal(s3.phase, "accept");
    assert.equal(s3.reason.startsWith("eval_passed_ready_for_accept"), true);
});

