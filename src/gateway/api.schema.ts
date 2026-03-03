/**
 * gateway/api.schema.ts
 * Zod validation for API request/response payloads.
 *
 * Validates incoming API requests before they reach handlers.
 * Covers chat completions, session management, cron jobs, and webhooks.
 */

import { z } from 'zod';

// ── Chat Completion (OpenAI-compatible) ──────────────────────────────────

export const ChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'system', 'tool']),
    content: z.string(),
    name: z.string().optional(),
    toolCallId: z.string().optional(),
});

export const ChatCompletionRequestSchema = z.object({
    messages: z.array(ChatMessageSchema).min(1),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).max(2_000_000).optional(),
    stream: z.boolean().default(false),
    tools: z.array(z.object({
        type: z.literal('function'),
        function: z.object({
            name: z.string(),
            description: z.string().optional(),
            parameters: z.record(z.string(), z.unknown()).optional(),
        }),
    })).optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
    sessionId: z.string().optional(),
    agentId: z.string().optional(),
});

export type ValidatedChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;

// ── Session Management ───────────────────────────────────────────────────

export const SessionCreateSchema = z.object({
    sessionKey: z.string().min(1).max(256),
    agentId: z.string().default('default'),
    cwd: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export const SessionUpdateSchema = z.object({
    systemPrompt: z.string().optional(),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ValidatedSessionCreate = z.infer<typeof SessionCreateSchema>;

// ── Cron Jobs ────────────────────────────────────────────────────────────

export const CronJobSchema = z.object({
    name: z.string().min(1).max(100),
    schedule: z.string().min(1).regex(
        /^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/,
        'Must be a valid cron expression (e.g. "*/5 * * * *")',
    ),
    agentId: z.string().default('default'),
    prompt: z.string().min(1).max(10000),
    enabled: z.boolean().default(true),
    timezone: z.string().default('UTC'),
    maxRetries: z.number().int().min(0).max(10).default(0),
    timeoutMs: z.number().int().min(1000).max(3_600_000).default(300_000),
});

export type ValidatedCronJob = z.infer<typeof CronJobSchema>;

// ── Exec Approval ────────────────────────────────────────────────────────

export const ExecApprovalSchema = z.object({
    command: z.string().min(1),
    approved: z.boolean(),
    reason: z.string().optional(),
    sessionId: z.string().optional(),
});

// ── Health Check Response ────────────────────────────────────────────────

export const HealthResponseSchema = z.object({
    status: z.enum(['ok', 'degraded', 'error']),
    version: z.string(),
    uptime: z.number(),
    uptimeHuman: z.string(),
    agent: z.object({
        model: z.string(),
        provider: z.string(),
    }),
    channels: z.record(z.string(), z.boolean()),
    features: z.record(z.string(), z.boolean()),
});

// ── Validation Helpers ───────────────────────────────────────────────────

/** Validate a chat completion request. */
export function validateChatRequest(raw: unknown): ValidatedChatCompletionRequest {
    return ChatCompletionRequestSchema.parse(raw);
}

/** Safe validation for chat requests. */
export function safeValidateChatRequest(raw: unknown): {
    success: boolean;
    data?: ValidatedChatCompletionRequest;
    errors?: string[];
} {
    const result = ChatCompletionRequestSchema.safeParse(raw);
    if (result.success) return { success: true, data: result.data };
    return {
        success: false,
        errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
    };
}

/** Validate a cron job definition. */
export function validateCronJob(raw: unknown): ValidatedCronJob {
    return CronJobSchema.parse(raw);
}
