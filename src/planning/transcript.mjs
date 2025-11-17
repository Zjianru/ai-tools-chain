import fs from "fs-extra";
import { writeFileSync } from "fs";
import { dirname } from "path";

export function appendJSONL(file, obj) {
    fs.ensureDirSync(dirname(file));
    writeFileSync(file, JSON.stringify(obj) + "\n", { flag: "a", encoding: "utf-8" });
}

export function loadPlanningTranscript(transcriptPath) {
    if (!fs.existsSync(transcriptPath)) return [];
    try {
        const raw = fs.readFileSync(transcriptPath, "utf-8");
        return raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(Boolean);
    } catch {
        return [];
    }
}

export function buildHistoryFromTranscript(entries) {
    const rounds = new Map();
    for (const e of entries) {
        if (e.kind !== "clarify_question" && e.kind !== "clarify_answer") continue;
        const r = Number(e.round) || 0;
        if (!r) continue;
        if (!rounds.has(r)) {
            rounds.set(r, { round: r, questions: [], answers: [] });
        }
        const bucket = rounds.get(r);
        const idx = Number(e.index) || 0;
        if (!idx) continue;
        if (e.kind === "clarify_question") {
            bucket.questions[idx - 1] = e.text || "";
        } else if (e.kind === "clarify_answer") {
            bucket.answers[idx - 1] = e.text || "";
        }
    }
    return Array.from(rounds.values()).sort((a, b) => a.round - b.round);
}

export function readLatestBrief(entries) {
    for (let i = entries.length - 1; i >= 0; i -= 1) {
        const e = entries[i];
        if (e.role === "user" && e.kind === "brief" && typeof e.text === "string") {
            const trimmed = e.text.trim();
            if (trimmed) return trimmed;
        }
    }
    return "";
}

export function nextRoundFromTranscript(entries) {
    let maxRound = 0;
    for (const e of entries) {
        if (typeof e.round === "number" || typeof e.round === "string") {
            const r = Number(e.round) || 0;
            if (r > maxRound) maxRound = r;
        }
    }
    return maxRound + 1;
}

