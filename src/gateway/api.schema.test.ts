import { describe, it, expect } from 'vitest';
import {
    ChatCompletionRequestSchema,
    ChatMessageSchema,
    SessionCreateSchema,
    SessionUpdateSchema,
    CronJobSchema,
    ExecApprovalSchema,
    HealthResponseSchema,
    validateChatRequest,
    safeValidateChatRequest,
    validateCronJob,
} from './api.schema.js';

describe('ChatMessageSchema', () => {
    it('accepts valid user message', () => {
        const result = ChatMessageSchema.safeParse({ role: 'user', content: 'hello' });
        expect(result.success).toBe(true);
    });

    it('accepts all valid roles', () => {
        for (const role of ['user', 'assistant', 'system', 'tool']) {
            expect(ChatMessageSchema.safeParse({ role, content: 'x' }).success).toBe(true);
        }
    });

    it('rejects invalid role', () => {
        expect(ChatMessageSchema.safeParse({ role: 'admin', content: 'x' }).success).toBe(false);
    });

    it('accepts optional name and toolCallId', () => {
        const result = ChatMessageSchema.safeParse({ role: 'tool', content: 'ok', name: 'fn', toolCallId: 'tc-1' });
        expect(result.success).toBe(true);
    });
});

describe('ChatCompletionRequestSchema', () => {
    const validRequest = {
        messages: [{ role: 'user', content: 'hello' }],
    };

    it('accepts minimal valid request', () => {
        expect(ChatCompletionRequestSchema.safeParse(validRequest).success).toBe(true);
    });

    it('requires at least one message', () => {
        expect(ChatCompletionRequestSchema.safeParse({ messages: [] }).success).toBe(false);
    });

    it('accepts all optional fields', () => {
        const result = ChatCompletionRequestSchema.safeParse({
            ...validRequest,
            model: 'gpt-4o',
            temperature: 0.7,
            maxTokens: 1000,
            stream: true,
            sessionId: 'sess-1',
            agentId: 'coder',
            stop: ['END'],
        });
        expect(result.success).toBe(true);
    });

    it('rejects temperature > 2', () => {
        expect(ChatCompletionRequestSchema.safeParse({ ...validRequest, temperature: 3 }).success).toBe(false);
    });

    it('rejects negative temperature', () => {
        expect(ChatCompletionRequestSchema.safeParse({ ...validRequest, temperature: -1 }).success).toBe(false);
    });

    it('accepts tools array', () => {
        const result = ChatCompletionRequestSchema.safeParse({
            ...validRequest,
            tools: [{
                type: 'function',
                function: { name: 'search', description: 'Search the web' },
            }],
        });
        expect(result.success).toBe(true);
    });

    it('defaults stream to false', () => {
        const result = ChatCompletionRequestSchema.parse(validRequest);
        expect(result.stream).toBe(false);
    });
});

describe('SessionCreateSchema', () => {
    it('accepts valid session', () => {
        const result = SessionCreateSchema.safeParse({ sessionKey: 'my-session' });
        expect(result.success).toBe(true);
    });

    it('defaults agentId to "default"', () => {
        const result = SessionCreateSchema.parse({ sessionKey: 'test' });
        expect(result.agentId).toBe('default');
    });

    it('rejects empty sessionKey', () => {
        expect(SessionCreateSchema.safeParse({ sessionKey: '' }).success).toBe(false);
    });

    it('rejects overly long sessionKey', () => {
        expect(SessionCreateSchema.safeParse({ sessionKey: 'x'.repeat(257) }).success).toBe(false);
    });
});

describe('SessionUpdateSchema', () => {
    it('accepts partial updates', () => {
        expect(SessionUpdateSchema.safeParse({ model: 'gpt-4o' }).success).toBe(true);
        expect(SessionUpdateSchema.safeParse({ temperature: 1.5 }).success).toBe(true);
        expect(SessionUpdateSchema.safeParse({}).success).toBe(true);
    });
});

describe('CronJobSchema', () => {
    const validCron = {
        name: 'daily-report',
        schedule: '0 9 * * *',
        prompt: 'Generate daily report',
    };

    it('accepts valid cron job', () => {
        expect(CronJobSchema.safeParse(validCron).success).toBe(true);
    });

    it('defaults enabled to true', () => {
        expect(CronJobSchema.parse(validCron).enabled).toBe(true);
    });

    it('defaults timezone to UTC', () => {
        expect(CronJobSchema.parse(validCron).timezone).toBe('UTC');
    });

    it('rejects invalid cron expression', () => {
        expect(CronJobSchema.safeParse({ ...validCron, schedule: 'invalid' }).success).toBe(false);
    });

    it('rejects empty name', () => {
        expect(CronJobSchema.safeParse({ ...validCron, name: '' }).success).toBe(false);
    });
});

describe('ExecApprovalSchema', () => {
    it('accepts valid approval', () => {
        expect(ExecApprovalSchema.safeParse({ command: 'ls -la', approved: true }).success).toBe(true);
    });

    it('rejects empty command', () => {
        expect(ExecApprovalSchema.safeParse({ command: '', approved: true }).success).toBe(false);
    });
});

describe('validateChatRequest', () => {
    it('returns parsed data on valid input', () => {
        const result = validateChatRequest({ messages: [{ role: 'user', content: 'hi' }] });
        expect(result.messages).toHaveLength(1);
    });

    it('throws on invalid input', () => {
        expect(() => validateChatRequest({ messages: [] })).toThrow();
    });
});

describe('safeValidateChatRequest', () => {
    it('returns success and data on valid input', () => {
        const result = safeValidateChatRequest({ messages: [{ role: 'user', content: 'hi' }] });
        expect(result.success).toBe(true);
        expect(result.data?.messages).toHaveLength(1);
    });

    it('returns errors on invalid input', () => {
        const result = safeValidateChatRequest({ messages: [] });
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors!.length).toBeGreaterThan(0);
    });
});

describe('validateCronJob', () => {
    it('parses valid cron job', () => {
        const result = validateCronJob({ name: 'test', schedule: '0 9 * * *', prompt: 'do stuff' });
        expect(result.name).toBe('test');
    });
});
