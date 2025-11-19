/**
 * Phase A Tests - CoachOrchestrator & ConsensusStrategy
 * Node.js native test harness
 */

import test from "node:test";
import assert from "node:assert";
import CoachOrchestrator from "../src/planning/coachOrchestrator.mjs";
import {
    detectAllSignals,
    detectBlockingQuestions,
    detectNoNewInfo,
    detectRequirementClarity,
    detectNarrativeDivergence,
    detectCommitmentReadiness,
    detectUserUncertainty,
    shouldTriggerClarificationMeeting
} from "../src/planning/consensusStrategy.mjs";

// ============================================================================
// CoachOrchestrator Tests
// ============================================================================

test("CoachOrchestrator - consensus_coverage calculation", async (t) => {
    const coach = new CoachOrchestrator();
    const ctx = {
        round: 1,
        perRoleVerdicts: [
            { role: "A", ok: true, confidence: 0.8 },
            { role: "B", ok: true, confidence: 0.7 },
            { role: "C", ok: false, confidence: 0.4 },
            { role: "D", ok: true, confidence: 0.5 }, // confidence < 0.6, so not consensus
            { role: "E", ok: true, confidence: 0.65 }
        ],
        userBrief: { text: "test" },
        roundSummaries: []
    };

    const metrics = coach._computeMetrics(ctx, []);
    assert.strictEqual(metrics.roles_blocking.length, 2); // C and D
    assert.strictEqual(metrics.consensus_coverage, 0.6); // 3 out of 5
    assert.ok(metrics.avg_confidence > 0.6);
});

test("CoachOrchestrator - critical signal triggers clarify decision", async (t) => {
    const coach = new CoachOrchestrator();
    const ctx = {
        round: 1,
        perRoleVerdicts: [
            { role: "A", ok: false, confidence: 0.3, blocking_open_questions: ["Q1", "Q2"] }
        ],
        userBrief: { text: "test" },
        roundSummaries: []
    };

    const result = await coach.evaluateConsensus(ctx);
    assert.strictEqual(result.decision, "clarify");
    assert.ok(result.signals_detected.some(s => s.type === "blocking_questions"));
});

test("CoachOrchestrator - high consensus triggers go decision", async (t) => {
    const coach = new CoachOrchestrator();
    const ctx = {
        round: 1,
        perRoleVerdicts: [
            { role: "A", ok: true, confidence: 0.9 },
            { role: "B", ok: true, confidence: 0.85 },
            { role: "C", ok: true, confidence: 0.8 },
            { role: "D", ok: true, confidence: 0.75 }
        ],
        userBrief: { text: "test" },
        roundSummaries: []
    };

    const result = await coach.evaluateConsensus(ctx);
    assert.strictEqual(result.decision, "go");
    assert.strictEqual(result.convergence_status, "converged");
});

test("CoachOrchestrator - max rounds triggers hold or redo", async (t) => {
    const coach = new CoachOrchestrator({ maxRoundsBeforeClarify: 2 });
    const ctx = {
        round: 2,
        perRoleVerdicts: [
            { role: "A", ok: true, confidence: 0.6 },
            { role: "B", ok: false, confidence: 0.4 }
        ],
        userBrief: { text: "test" },
        roundSummaries: [
            {
                round: 1,
                timestamp: "2025-01-15T10:00:00Z",
                consensus_points: [],
                divergence_points: ["issue"],
                key_assumptions: [],
                pending_clarifications: [],
                per_role_snapshot: [],
                signals_detected: []
            },
            {
                round: 2,
                timestamp: "2025-01-15T11:00:00Z",
                previous_round_consensus_still_valid: false,
                new_consensus_gained: [],
                remaining_divergence: ["issue"],
                new_blocking_questions: [],
                per_role_snapshot: [],
                signals_detected: [],
                overall_convergence_status: "partial",
                coach_decision_summary: "...",
                next_action: "hold"
            }
        ]
    };

    const result = await coach.evaluateConsensus(ctx);
    // 达到最大轮数，共识 = 0.5，应该 hold（用户决定）
    assert.strictEqual(result.decision, "hold");
});

test("CoachOrchestrator - max rounds + low consensus triggers redo", async (t) => {
    const coach = new CoachOrchestrator({ maxRoundsBeforeClarify: 2 });
    const ctx = {
        round: 2,
        perRoleVerdicts: [
            { role: "A", ok: false, confidence: 0.3 },
            { role: "B", ok: false, confidence: 0.4 },
            { role: "C", ok: true, confidence: 0.5 }
        ],
        userBrief: { text: "test" },
        roundSummaries: [
            {
                round: 1,
                timestamp: "2025-01-15T10:00:00Z",
                consensus_points: [],
                divergence_points: ["issue"],
                key_assumptions: [],
                pending_clarifications: [],
                per_role_snapshot: [],
                signals_detected: []
            },
            {
                round: 2,
                timestamp: "2025-01-15T11:00:00Z",
                previous_round_consensus_still_valid: false,
                new_consensus_gained: [],
                remaining_divergence: ["issue"],
                new_blocking_questions: [],
                per_role_snapshot: [],
                signals_detected: [],
                overall_convergence_status: "partial",
                coach_decision_summary: "...",
                next_action: "hold"
            }
        ]
    };

    const result = await coach.evaluateConsensus(ctx);
    // 达到最大轮数且共识 < 0.5，应该 redo_planning
    assert.strictEqual(result.decision, "redo_planning");
});

test("CoachOrchestrator - draft_info_updates structure", async (t) => {
    const coach = new CoachOrchestrator();
    const ctx = {
        round: 1,
        perRoleVerdicts: [{ role: "A", ok: true, confidence: 0.9 }],
        userBrief: { text: "test" },
        roundSummaries: []
    };

    const result = await coach.evaluateConsensus(ctx);
    assert.ok(result.draft_info_updates);
    assert.ok(result.draft_info_updates.status);
    assert.ok(result.draft_info_updates.decision);
    assert.ok(Array.isArray(result.draft_info_updates.round_convergence_history));
});

// ============================================================================
// Signal Detection Tests
// ============================================================================

test("detectBlockingQuestions - triggered when blocking questions exist", (t) => {
    const ctx = {
        perRoleVerdicts: [
            {
                role: "A",
                blocking_open_questions: ["Q1", "Q2"]
            }
        ]
    };

    const result = detectBlockingQuestions(ctx);
    assert.strictEqual(result.triggered, true);
    assert.strictEqual(result.severity, "critical");
    assert.strictEqual(result.evidence.total_count, 2);
});

test("detectBlockingQuestions - not triggered when no blocking questions", (t) => {
    const ctx = {
        perRoleVerdicts: [{ role: "A", blocking_open_questions: [] }]
    };

    const result = detectBlockingQuestions(ctx);
    assert.strictEqual(result.triggered, false);
});

test("detectNoNewInfo - triggered when round 2 has no new consensus", (t) => {
    const ctx = {
        round: 2,
        roundSummaries: [
            {
                round: 1,
                consensus_points: ["CP1"],
                divergence_points: ["DP1", "DP2"]
            },
            {
                round: 2,
                new_consensus_gained: [],
                remaining_divergence: ["DP1", "DP2"]
            }
        ]
    };

    const result = detectNoNewInfo(ctx);
    assert.strictEqual(result.triggered, true);
    assert.strictEqual(result.severity, "high");
});

test("detectRequirementClarity - triggered with pending clarifications", (t) => {
    const ctx = {
        roundSummaries: [
            {
                round: 1,
                pending_clarifications: ["Need to clarify auth method", "DB schema?"]
            }
        ]
    };

    const result = detectRequirementClarity(ctx);
    assert.strictEqual(result.triggered, true);
    assert.strictEqual(result.evidence.total_count, 2);
});

test("detectNarrativeDivergence - triggered with disagreeing roles", (t) => {
    const ctx = {
        perRoleVerdicts: [
            { role: "A", ok: false, comments: "I disagree" },
            { role: "B", ok: true, comments: "I agree" }
        ]
    };

    const result = detectNarrativeDivergence(ctx);
    assert.strictEqual(result.triggered, true);
    assert.strictEqual(result.evidence.total_disagreeing_roles, 1);
});

test("detectCommitmentReadiness - triggered with low confidence roles", (t) => {
    const ctx = {
        perRoleVerdicts: [
            { role: "A", ok: true, confidence: 0.9 },
            { role: "B", ok: true, confidence: 0.4 } // < 0.6
        ]
    };

    const result = detectCommitmentReadiness(ctx, 0.6);
    assert.strictEqual(result.triggered, true);
    assert.strictEqual(result.evidence.total_low_confidence_roles, 1);
});

test("detectUserUncertainty - triggered when user has uncertainty flags", (t) => {
    const ctx = {
        userBrief: {
            text: "I'm not sure about the direction",
            flags: ["uncertain", "unclear"]
        }
    };

    const result = detectUserUncertainty(ctx);
    assert.strictEqual(result.triggered, true);
    assert.strictEqual(result.severity, "high");
});

test("detectUserUncertainty - not triggered without flags", (t) => {
    const ctx = {
        userBrief: {
            text: "Clear requirement",
            flags: []
        }
    };

    const result = detectUserUncertainty(ctx);
    assert.strictEqual(result.triggered, false);
});

// ============================================================================
// Signal Aggregation Tests
// ============================================================================

test("shouldTriggerClarificationMeeting - critical signal triggers", (t) => {
    const signals = [
        { triggered: true, severity: "critical", reason: "Critical issue" }
    ];

    const result = shouldTriggerClarificationMeeting(signals);
    assert.strictEqual(result.shouldTrigger, true);
});

test("shouldTriggerClarificationMeeting - 2+ high signals trigger", (t) => {
    const signals = [
        { triggered: true, severity: "high", reason: "High issue 1" },
        { triggered: true, severity: "high", reason: "High issue 2" }
    ];

    const result = shouldTriggerClarificationMeeting(signals);
    assert.strictEqual(result.shouldTrigger, true);
});

test("shouldTriggerClarificationMeeting - user uncertainty + other signal", (t) => {
    const signals = [
        { triggered: true, severity: "high", reason: "Other", evidence: { uncertainty_flags: ["uncertain"] } },
        { triggered: true, severity: "medium", reason: "Another" }
    ];

    const result = shouldTriggerClarificationMeeting(signals);
    assert.strictEqual(result.shouldTrigger, true);
});

test("shouldTriggerClarificationMeeting - low severity signals don't trigger", (t) => {
    const signals = [
        { triggered: true, severity: "medium", reason: "Medium issue" },
        { triggered: true, severity: "low", reason: "Low issue" }
    ];

    const result = shouldTriggerClarificationMeeting(signals);
    assert.strictEqual(result.shouldTrigger, false);
});

// ============================================================================
// Integration Tests
// ============================================================================

test("detectAllSignals - complete workflow", (t) => {
    const ctx = {
        round: 2,
        perRoleVerdicts: [
            { role: "A", ok: false, confidence: 0.3, blocking_open_questions: ["Q1"] },
            { role: "B", ok: true, confidence: 0.8 }
        ],
        userBrief: {
            text: "Unclear direction",
            flags: ["uncertain"]
        },
        roundSummaries: [
            {
                round: 1,
                consensus_points: [],
                divergence_points: ["Issue"],
                key_assumptions: [],
                pending_clarifications: ["Clarify requirement"],
                per_role_snapshot: [],
                signals_detected: []
            },
            {
                round: 2,
                previous_round_consensus_still_valid: false,
                new_consensus_gained: [],
                remaining_divergence: ["Issue"],
                new_blocking_questions: [],
                per_role_snapshot: [],
                signals_detected: [],
                overall_convergence_status: "partial",
                coach_decision_summary: "...",
                next_action: "hold"
            }
        ]
    };

    const result = detectAllSignals(ctx);
    assert.ok(result.triggered_signals.length > 0);
    assert.strictEqual(result.should_trigger_clarification, true);
});

console.log("\n✅ Phase A Tests Ready");
