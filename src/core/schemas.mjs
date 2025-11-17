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

