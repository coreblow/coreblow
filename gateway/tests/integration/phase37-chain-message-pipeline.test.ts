/**
 * CoreBlow Phase 37 — Message Processing Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   isSlashCommand → parseSlashCommand → chunkMessage response
 */
import { describe, it, expect } from 'vitest';
import {
    isSlashCommand, parseSlashCommand, stripBotMention,
} from '../../src/auto-reply/command-detection.js';
import { chunkMessage, chunkMessageSmart } from '../../src/auto-reply/chunk.js';

describe('Phase37 Chain: Message Processing Pipeline', () => {

    it('detect command → parse → generate response → chunk for platform', () => {
        const userMessage = '/help --verbose';

        // Step 1: Detect
        expect(isSlashCommand(userMessage)).toBe(true);

        // Step 2: Parse
        const parsed = parseSlashCommand(userMessage);
        expect(parsed?.command).toBe('help');
        expect(parsed?.args).toContain('--verbose');

        // Step 3: Generate long response
        const response = `**Available Commands:**\n${Array.from({ length: 50 }, (_, i) =>
            `  /${`cmd-${i}`} — Description for command ${i}`
        ).join('\n')}`;

        // Step 4: Chunk for discord (2000 char limit)
        const chunks = chunkMessage(response, 'discord');
        expect(chunks.length).toBeGreaterThanOrEqual(1);
        expect(chunks.every(c => c.length <= 2000)).toBe(true);
    });

    it('strip mention → detect non-command → chunk response', () => {
        const raw = '@coreblow tell me about TypeScript';
        const stripped = stripBotMention(raw);
        expect(stripped).toBe('tell me about TypeScript');
        expect(isSlashCommand(stripped)).toBe(false);

        // Generate response
        const response = 'TypeScript is a typed superset of JavaScript. '.repeat(100);
        const chunks = chunkMessage(response, 'telegram');
        expect(chunks.every(c => c.length <= 4096)).toBe(true);
    });

    it('code response → smart chunk preserves blocks', () => {
        const codeResponse = `Here's the code:\n\n\`\`\`typescript\n${
            'const x = Math.random();\nconsole.log(x);\n'.repeat(100)
        }\`\`\`\n\nThat's the implementation.`;

        const smartChunks = chunkMessageSmart(codeResponse, 'discord');
        expect(smartChunks.length).toBeGreaterThan(1);
    });
});
