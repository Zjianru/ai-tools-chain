import { z } from "zod";

export const CodegenPlanFileSchema = z.object({
    path: z.string().min(1, "file path is required"),
    language: z.string().optional(),
    intent: z.string().optional(),
    rationale: z.string().optional(),
    content: z.string().default("")
});

export const CodegenPlanSchema = z.object({
    taskId: z.string().min(1),
    generated_at: z.string().min(1),
    files: z.array(CodegenPlanFileSchema)
});

export const CodegenIRFileSchema = z.object({
    path: z.string().min(1),
    op: z.enum(["create", "modify", "delete"]),
    language: z.string().min(1),
    intent: z.string().optional()
});

export const CodegenIRSchema = z.object({
    taskId: z.string().min(1),
    generated_at: z.string().min(1),
    files: z.array(CodegenIRFileSchema)
});

export const PlanningMeetingVerdictSchema = z.object({
    ok: z.boolean().nullable().default(null),
    confidence: z.number().min(0).max(1).optional(),
    reasons: z.array(z.string()).default([]),
    suggestions: z.array(z.string()).default([])
});

export const PerRoleVerdictsSchema = z.record(PlanningMeetingVerdictSchema);

export const PlanningMeetingRoundSchema = z.object({
    round: z.number().int().min(1),
    at: z.string(),
    input_snapshot: z.record(z.any()).default({}),
    per_role_verdicts: PerRoleVerdictsSchema.optional(),
    options: z.array(z.string()).default([]),
    coach_summary: z.string().default(""),
    decision: z.enum(["go", "hold", "redo_planning"])
});

export const PlanningMeetingSchema = z.object({
    taskId: z.string().min(1),
    title: z.string().min(1),
    ok: z.boolean(),
    planning_summary: z.record(z.any()).optional(),
    issues: z.array(z.any()).default([]),
    plan_md_present: z.boolean().default(false),
    rounds: z.array(PlanningMeetingRoundSchema).min(1),
    ai_meeting: z.any().optional()
});
