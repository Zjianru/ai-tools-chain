import fs from "fs-extra";
import { resolve } from "path";

const PLANNING_FILES = [
    "planning.ai.json",
    "plan.md",
    "plan-review.json",
    "plan-review.md",
    "planning.meeting.json",
    "planning.meeting.md"
];

export function snapshotPlanningVersion({ tasksDir, taskId, round }) {
    if (!round || round < 1) return;
    const planningDir = resolve(tasksDir, taskId, "planning");
    if (!fs.existsSync(planningDir)) return;

    const versionsRoot = resolve(planningDir, "versions");
    const targetDir = resolve(versionsRoot, `v${round}`);
    if (fs.existsSync(targetDir)) return;
    fs.ensureDirSync(targetDir);

    for (const fileName of PLANNING_FILES) {
        const src = resolve(planningDir, fileName);
        if (fs.existsSync(src)) {
            fs.copySync(src, resolve(targetDir, fileName));
        }
    }

    const rolesDir = resolve(planningDir, "roles");
    if (fs.existsSync(rolesDir)) {
        fs.copySync(rolesDir, resolve(targetDir, "roles"));
    }

    const reportCandidates = [
        resolve(tasksDir, taskId, "reports", "planning", `v${round}`, "planning.report.md"),
        resolve(tasksDir, taskId, "reports", "planning", "latest", "planning.report.md")
    ];

    for (const src of reportCandidates) {
        if (fs.existsSync(src)) {
            fs.copySync(src, resolve(targetDir, "planning.report.md"));
            break;
        }
    }
}
