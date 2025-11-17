import { appendFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { nowISO } from "../core/task.mjs";

function ensureDirForFile(path) {
    const dir = dirname(path);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

export async function appendPlanningMemoryEntry(planningDir, entry) {
    const path = resolve(planningDir, "planning.memory.jsonl");
    ensureDirForFile(path);
    const record = {
        at: entry.at || nowISO(),
        round: entry.round ?? null,
        role: entry.role || "Unknown",
        kind: entry.kind || "note",
        content: entry.content || ""
    };
    appendFileSync(path, JSON.stringify(record) + "\n", "utf-8");
    return record;
}

